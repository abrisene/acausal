const ABI_VERSION = 1;
const U32_MAX = 0xffff_ffff;
const I64_MIN = -(1n << 63n);
const I64_MAX = (1n << 63n) - 1n;
const U64_MAX = (1n << 64n) - 1n;
const MAX_SAFE = BigInt(Number.MAX_SAFE_INTEGER);
const DEFAULT_LIMITS = {
  maxDomainSize: 256,
  maxVariables: 512,
  maxFactors: 1024,
  maxEliminationWidth: 12,
  maxJointSupport: 100_000,
  maxOperations: 1_000_000,
};

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder('utf-8', { fatal: true });

/** Error returned by the Rust engine through the private binding protocol. */
export class AcausalError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AcausalError';
  }
}

function fail(message) {
  throw new AcausalError(message);
}

function asU32(value, name) {
  if (!Number.isSafeInteger(value) || value < 0 || value > U32_MAX) {
    throw new RangeError(`${name} must be an unsigned 32-bit integer`);
  }
  return value;
}

function asCount(value, name) {
  return asU32(value, name);
}

function asI64(value, name) {
  if (typeof value === 'bigint') {
    if (value < I64_MIN || value > I64_MAX) {
      throw new RangeError(`${name} is outside the signed 64-bit range`);
    }
    return value;
  }
  if (!Number.isSafeInteger(value)) {
    throw new TypeError(`${name} must be a safe integer or bigint`);
  }
  return BigInt(value);
}

function asU64(value, name) {
  let result;
  if (typeof value === 'bigint') result = value;
  else if (Number.isSafeInteger(value) && value >= 0) result = BigInt(value);
  else throw new TypeError(`${name} must be a non-negative safe integer or bigint`);
  if (result < 0n || result > U64_MAX) throw new RangeError(`${name} is outside the unsigned 64-bit range`);
  return result;
}

function fromInteger(value, preferBigInt = false) {
  if (preferBigInt || value < -MAX_SAFE || value > MAX_SAFE) return value;
  return Number(value);
}

function bytesFrom(value, name = 'bytes') {
  if (value instanceof Uint8Array) {
    return new Uint8Array(value);
  }
  if (value instanceof ArrayBuffer) {
    return new Uint8Array(value.slice(0));
  }
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength));
  }
  throw new TypeError(`${name} must be an ArrayBuffer or Uint8Array`);
}

class Writer {
  constructor() {
    this.bytes = [];
  }

  u8(value) {
    if (!Number.isInteger(value) || value < 0 || value > 0xff) throw new RangeError('byte out of range');
    this.bytes.push(value);
    return this;
  }

  u32(value) {
    asU32(value, 'u32');
    this.bytes.push(value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff);
    return this;
  }

  i64(value) {
    let word = asI64(value, 'i64');
    if (word < 0n) word += 1n << 64n;
    for (let i = 0; i < 8; i++) {
      this.bytes.push(Number(word & 0xffn));
      word >>= 8n;
    }
    return this;
  }

  u64(value) {
    let word = asU64(value, 'u64');
    for (let i = 0; i < 8; i++) {
      this.bytes.push(Number(word & 0xffn));
      word >>= 8n;
    }
    return this;
  }

  f64(value) {
    if (typeof value !== 'number') throw new TypeError('distribution parameters must be numbers');
    const buffer = new ArrayBuffer(8);
    new DataView(buffer).setFloat64(0, value, true);
    this.bytes.push(...new Uint8Array(buffer));
    return this;
  }

  text(value) {
    if (typeof value !== 'string') throw new TypeError('text values must be strings');
    const encoded = textEncoder.encode(value);
    if (encoded.byteLength > U32_MAX) throw new RangeError('text value is too long');
    this.u32(encoded.byteLength);
    this.bytes.push(...encoded);
    return this;
  }

  strings(values) {
    if (!Array.isArray(values)) throw new TypeError('string lists must be arrays');
    this.u32(asCount(values.length, 'string list length'));
    for (const value of values) this.text(value);
    return this;
  }

  finish() {
    return Uint8Array.from(this.bytes);
  }
}

class Reader {
  constructor(bytes) {
    this.bytes = bytes;
    this.position = 0;
  }

  take(length) {
    if (!Number.isSafeInteger(length) || length < 0 || this.position + length > this.bytes.byteLength) {
      fail('truncated response');
    }
    const result = this.bytes.subarray(this.position, this.position + length);
    this.position += length;
    return result;
  }

  u8() {
    return this.take(1)[0];
  }

  u32() {
    const b = this.take(4);
    return (b[0] | (b[1] << 8) | (b[2] << 16) | (b[3] << 24)) >>> 0;
  }

  u64() {
    const b = this.take(8);
    let value = 0n;
    for (let i = 7; i >= 0; i--) value = (value << 8n) | BigInt(b[i]);
    return value;
  }

  i64() {
    let value = this.u64();
    if (value >= 1n << 63n) value -= 1n << 64n;
    return value;
  }

  f64() {
    const b = this.take(8);
    return new DataView(b.buffer, b.byteOffset, 8).getFloat64(0, true);
  }

  text() {
    try {
      return textDecoder.decode(this.take(this.u32()));
    } catch (error) {
      if (error instanceof AcausalError) throw error;
      fail('invalid UTF-8 in response');
    }
  }

  strings() {
    const count = this.u32();
    if (count > (this.bytes.byteLength - this.position) / 4) fail('invalid string-list count');
    const values = [];
    for (let i = 0; i < count; i++) values.push(this.text());
    return values;
  }

  remaining() {
    return this.bytes.subarray(this.position);
  }

  finish() {
    if (this.position !== this.bytes.byteLength) fail('unexpected response bytes');
  }
}

function decodeMap(reader) {
  const count = reader.u32();
  if (count > (reader.bytes.byteLength - reader.position) / 12) fail('invalid map count');
  const result = {};
  for (let i = 0; i < count; i++) {
    const key = reader.text();
    const value = reader.f64();
    Object.defineProperty(result, key, { value, enumerable: true, configurable: true, writable: true });
  }
  return result;
}

function decodeAssignment(reader) {
  const count = reader.u32();
  if (count > (reader.bytes.byteLength - reader.position) / 8) fail('invalid assignment count');
  const result = {};
  for (let i = 0; i < count; i++) {
    const key = reader.text();
    const value = reader.text();
    Object.defineProperty(result, key, { value, enumerable: true, configurable: true, writable: true });
  }
  return result;
}

function assignmentEntries(value, name = 'assignment') {
  if (value == null) return [];
  if (value instanceof Map) return [...value.entries()].map(([key, item]) => [String(key), String(item)]);
  if (Array.isArray(value)) return value.map((entry) => {
    if (!Array.isArray(entry) || entry.length !== 2) throw new TypeError(`${name} entries must be [variable, value] pairs`);
    return [String(entry[0]), String(entry[1])];
  });
  if (typeof value === 'object') return Object.entries(value).map(([key, item]) => [key, String(item)]);
  throw new TypeError(`${name} must be an object, Map, or entry list`);
}

function writeAssignment(writer, value) {
  const entries = assignmentEntries(value);
  writer.u32(asCount(entries.length, 'assignment length'));
  for (const [key, item] of entries) writer.text(key).text(item);
  return writer;
}

function writeLimits(writer, limits) {
  if (limits == null) return writer.u8(0);
  const fields = ['maxDomainSize', 'maxVariables', 'maxFactors', 'maxEliminationWidth', 'maxJointSupport', 'maxOperations'];
  writer.u8(1);
  for (const field of fields) writer.u32(asU32(limits[field] ?? DEFAULT_LIMITS[field], `limits.${field}`));
  return writer;
}

function normalizeDirection(direction) {
  if (direction === undefined) return 0;
  if (direction === 'forward') return 0;
  if (direction === 'backward') return 1;
  throw new TypeError("direction must be 'forward' or 'backward'");
}

function normalizeStrategy(strategy) {
  const values = ['arithmetic', 'geometric', 'harmonic', 'max', 'min'];
  if (strategy === undefined) return 0;
  const index = values.indexOf(strategy);
  if (index < 0) throw new TypeError(`strategy must be one of ${values.join(', ')}`);
  return index;
}

function distributionParameters(spec) {
  if (!spec || typeof spec !== 'object' || typeof spec.type !== 'string') {
    throw new TypeError('sample expects a typed distribution spec');
  }
  const value = (name) => {
    if (!(name in spec)) throw new TypeError(`${spec.type} distribution requires ${name}`);
    const result = spec[name];
    if (typeof result !== 'number') throw new TypeError(`${spec.type}.${name} must be a number`);
    return result;
  };
  switch (spec.type) {
    case 'uniform': return [0, [value('min'), value('max')]];
    case 'normal': return [1, [value('mean'), value('stddev')]];
    case 'clampedNormal': return [2, [value('mean'), value('stddev'), value('min'), value('max')]];
    case 'logNormal': return [3, [value('mean'), value('stddev')]];
    case 'exponential': return [4, [value('rate')]];
    case 'poisson': return [5, [value('rate')]];
    case 'binomial': return [6, [value('trials'), value('probability')]];
    case 'geometric': return [7, [value('probability')]];
    case 'beta': return [8, [value('alpha'), value('beta')]];
    case 'gamma': return [9, [value('shape'), value('scale')]];
    case 'weibull': return [10, [value('shape'), value('scale'), value('location')]];
    case 'cauchy': return [11, [value('location'), value('scale')]];
    case 'logistic': return [12, [value('location'), value('scale')]];
    case 'bernoulli': return [13, [value('probability')]];
    default: throw new TypeError(`unknown distribution type ${spec.type}`);
  }
}

class Runtime {
  constructor(exports) {
    this.exports = exports;
    this.memory = exports.memory;
    if (!this.memory || typeof this.memory.buffer === 'undefined') fail('WASM module does not export memory');
    for (const name of ['acausal_abi_version', 'acausal_alloc', 'acausal_buffer_ptr', 'acausal_buffer_len', 'acausal_free', 'acausal_call']) {
      if (typeof exports[name] !== 'function') fail(`WASM module is missing export ${name}`);
    }
    const version = Number(exports.acausal_abi_version());
    if (version !== ABI_VERSION) throw new AcausalError(`unsupported acausal ABI version ${version}; expected ${ABI_VERSION}`);
  }

  free(handle) {
    if (handle) this.exports.acausal_free(handle);
  }

  call(operation, payload) {
    const input = bytesFrom(payload, 'payload');
    if (input.byteLength > U32_MAX) throw new RangeError('payload is too large');
    const payloadHandle = Number(this.exports.acausal_alloc(input.byteLength));
    if (!payloadHandle) throw new AcausalError('Rust binding allocation failed');
    let resultHandle = 0;
    try {
      const ptr = Number(this.exports.acausal_buffer_ptr(payloadHandle));
      const len = Number(this.exports.acausal_buffer_len(payloadHandle));
      if (!Number.isSafeInteger(ptr) || ptr < 0 || len !== input.byteLength) fail('Rust binding returned an invalid payload buffer');
      new Uint8Array(this.memory.buffer, ptr, len).set(input);
      resultHandle = Number(this.exports.acausal_call(asU32(operation, 'operation'), payloadHandle));
      if (!resultHandle) throw new AcausalError(`Rust binding call ${operation} returned no result`);
      const resultPtr = Number(this.exports.acausal_buffer_ptr(resultHandle));
      const resultLen = Number(this.exports.acausal_buffer_len(resultHandle));
      if (!Number.isSafeInteger(resultPtr) || resultPtr < 0 || !Number.isSafeInteger(resultLen)) fail('Rust binding returned an invalid result buffer');
      const response = new Uint8Array(this.memory.buffer, resultPtr, resultLen).slice();
      const reader = new Reader(response);
      const status = reader.u8();
      if (status === 0) {
        const message = reader.text();
        reader.finish();
        throw new AcausalError(message);
      }
      if (status !== 1) fail('Rust binding returned an invalid response status');
      return reader.remaining();
    } finally {
      this.free(resultHandle);
      this.free(payloadHandle);
    }
  }
}

let runtime;
let initPromise;

async function bundledWasm() {
  const url = new URL('./acausal.wasm', import.meta.url);
  const isNode = typeof process !== 'undefined' && process?.versions?.node;
  if (isNode) {
    const { readFile } = await import('node:fs/promises');
    return new Uint8Array(await readFile(url));
  }
  if (typeof fetch !== 'function') throw new Error(`cannot load bundled WASM from ${url.href}: fetch is unavailable`);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`cannot load bundled WASM from ${url.href}: HTTP ${response.status}`);
  return new Uint8Array(await response.arrayBuffer());
}

async function wasmSource(source) {
  if (source === undefined) return bundledWasm();
  if (source instanceof WebAssembly.Module) return source;
  if ((typeof Response !== 'undefined' && source instanceof Response) || (source && typeof source.arrayBuffer === 'function' && !(source instanceof ArrayBuffer))) {
    if ('ok' in source && !source.ok) throw new Error(`cannot load WASM source: HTTP ${source.status}`);
    return new Uint8Array(await source.arrayBuffer());
  }
  return bytesFrom(source, 'wasmBytes');
}

async function instantiate(source) {
  const result = source instanceof WebAssembly.Module
    ? await WebAssembly.instantiate(source, {})
    : await WebAssembly.instantiate(await wasmSource(source), {});
  return result instanceof WebAssembly.Instance ? result : result.instance;
}

/** Load the Rust engine once and return the binding constructors. */
export function init(wasmBytes) {
  if (runtime) return Promise.resolve(api);
  if (initPromise) return initPromise;
  initPromise = (async () => {
    const instance = await instantiate(wasmBytes);
    runtime = new Runtime(instance.exports);
    return api;
  })().catch((error) => {
    initPromise = undefined;
    throw error;
  });
  return initPromise;
}

function requireRuntime() {
  if (!runtime) throw new Error('acausal is not initialized; call await init() before constructing a resource');
  return runtime;
}

const finalizer = typeof FinalizationRegistry === 'function'
  ? new FinalizationRegistry(({ engine, handle }) => {
      try { engine.free(handle); } catch { /* process teardown */ }
    })
  : undefined;

function registerResource(resource, engine, handle) {
  resource._engine = engine;
  resource._handle = handle;
  resource._closed = false;
  resource._finalizerToken = {};
  finalizer?.register(resource, { engine, handle }, resource._finalizerToken);
  return resource;
}

function legacySeedPayload(seed, uses) {
  if (Array.isArray(seed)) {
    const writer = new Writer().u8(1).u32(asCount(seed.length, 'seed word count'));
    for (const word of seed) writer.u32(asU32(word, 'seed word'));
    return writer.u64(uses).finish();
  }
  return new Writer().u8(0).u32(asU32(seed, 'seed')).u64(uses).finish();
}

function closeResource(resource) {
  if (resource._closed) return;
  resource._closed = true;
  finalizer?.unregister(resource._finalizerToken);
  resource._engine.free(resource._handle);
  resource._handle = 0;
}

function assertResource(resource) {
  if (resource._closed) throw new Error('acausal resource is closed');
}

/** A caller-owned deterministic random stream. */
export class Rng {
  constructor(seed) {
    const engine = requireRuntime();
    const handle = Array.isArray(seed)
      ? readHandle(engine.call(2, legacySeedPayload(seed, 2000)))
      : readHandle(engine.call(1, new Writer().u32(asU32(seed, 'seed')).finish()));
    registerResource(this, engine, handle);
  }

  static _fromHandle(engine, handle) {
    return registerResource(Object.create(this.prototype), engine, handle);
  }

  static fromState(state) {
    const engine = requireRuntime();
    return this._fromHandle(engine, readHandle(engine.call(4, bytesFrom(state, 'state'))));
  }

  static fromLegacy(seed, uses) {
    const engine = requireRuntime();
    return this._fromHandle(engine, readHandle(engine.call(2, legacySeedPayload(seed, uses))));
  }

  int(min, max) {
    assertResource(this);
    const a = asI64(min, 'min');
    const b = asI64(max, 'max');
    const result = new Reader(this._engine.call(6, new Writer().u32(this._handle).i64(a).i64(b).finish())).i64();
    return fromInteger(result, typeof min === 'bigint' || typeof max === 'bigint');
  }

  float(min, max) {
    assertResource(this);
    return new Reader(this._engine.call(5, new Writer().u32(this._handle).f64(min).f64(max).finish())).f64();
  }

  bool(probability = 0.5) {
    assertResource(this);
    const reader = new Reader(this._engine.call(7, new Writer().u32(this._handle).f64(probability).finish()));
    const result = reader.u8();
    reader.finish();
    if (result !== 0 && result !== 1) fail('Rust binding returned an invalid boolean');
    return result === 1;
  }

  sample(spec) {
    assertResource(this);
    const [tag, parameters] = distributionParameters(spec);
    const writer = new Writer().u32(this._handle).u8(tag).u32(parameters.length);
    for (const parameter of parameters) writer.f64(parameter);
    return new Reader(this._engine.call(8, writer.finish())).f64();
  }

  uses() {
    assertResource(this);
    const reader = new Reader(this._engine.call(9, new Writer().u32(this._handle).finish()));
    const result = fromInteger(reader.u64());
    reader.finish();
    return result;
  }

  snapshot() {
    assertResource(this);
    return this._engine.call(3, new Writer().u32(this._handle).finish());
  }

  clone() {
    assertResource(this);
    return Rng._fromHandle(this._engine, readHandle(this._engine.call(10, new Writer().u32(this._handle).finish())));
  }

  close() { closeResource(this); }
  [Symbol.dispose]() { this.close(); }
}

function readHandle(bytes) {
  const reader = new Reader(bytes);
  const handle = reader.u32();
  reader.finish();
  if (!handle) fail('Rust binding returned an invalid resource handle');
  return handle;
}

function weightedPairs(entries) {
  if (entries instanceof Map) return [...entries.entries()];
  if (Array.isArray(entries)) return entries.map((entry) => {
    if (!Array.isArray(entry) || entry.length !== 2) throw new TypeError('weighted entries must be [value, weight] pairs');
    return [entry[0], entry[1]];
  });
  if (entries && typeof entries === 'object') return Object.entries(entries);
  throw new TypeError('weighted entries must be an object, Map, or entry list');
}

/** A mutable weighted table. String values use their exact wire identity. */
export class Weighted {
  constructor(entries) {
    const pairs = weightedPairs(entries);
    const engine = requireRuntime();
    const writer = new Writer().u32(asCount(pairs.length, 'weighted entry count'));
    this._values = new Map();
    const seen = new Map();
    for (const [value, weight] of pairs) {
      if (typeof value !== 'string') throw new TypeError('Weighted currently accepts string values');
      if (typeof weight !== 'number') throw new TypeError('weighted values must be numbers');
      writer.text(value).f64(weight);
      if (!seen.has(value)) {
        seen.set(value, value);
        this._values.set(value, value);
      }
    }
    registerResource(this, engine, readHandle(engine.call(20, writer.finish())));
  }

  static _fromHandle(engine, handle, values) {
    const resource = registerResource(Object.create(this.prototype), engine, handle);
    resource._values = new Map(values);
    return resource;
  }

  entries() {
    assertResource(this);
    const reader = new Reader(this._engine.call(27, new Writer().u32(this._handle).finish()));
    const count = reader.u32();
    const values = [];
    for (let i = 0; i < count; i++) {
      const key = reader.text();
      const weight = reader.f64();
      values.push([this._values.get(key) ?? key, weight]);
    }
    reader.finish();
    return values;
  }

  probabilities() {
    assertResource(this);
    const reader = new Reader(this._engine.call(21, new Writer().u32(this._handle).finish()));
    const result = {};
    const count = reader.u32();
    for (let i = 0; i < count; i++) {
      const key = reader.text();
      Object.defineProperty(result, key, { value: reader.f64(), enumerable: true, configurable: true, writable: true });
    }
    reader.finish();
    return result;
  }

  draw(rng, exclusions = []) {
    assertResource(this);
    assertRng(rng);
    const reader = new Reader(this._engine.call(22, new Writer().u32(this._handle).u32(rng._handle).strings(exclusions).finish()));
    const value = reader.text();
    reader.finish();
    return this._values.get(value) ?? value;
  }

  drawMany(rng, count, options = {}) {
    assertResource(this);
    assertRng(rng);
    const replacement = options.replacement === false ? 1 : 0;
    const exclude = options.exclude ?? [];
    const writer = new Writer().u32(this._handle).u32(rng._handle).u32(asCount(count, 'count')).u8(replacement).strings(exclude);
    const reader = new Reader(this._engine.call(23, writer.finish()));
    const values = reader.strings().map((value) => this._values.get(value) ?? value);
    reader.finish();
    return values;
  }

  set(key, weight) {
    assertResource(this);
    if (typeof key !== 'string' || typeof weight !== 'number') throw new TypeError('Weighted.set expects a string and number');
    this._engine.call(24, new Writer().u32(this._handle).text(key).f64(weight).finish());
    this._values.set(key, key);
    return this;
  }

  adjust(key, delta) {
    assertResource(this);
    if (typeof key !== 'string' || typeof delta !== 'number') throw new TypeError('Weighted.adjust expects a string and number');
    this._engine.call(25, new Writer().u32(this._handle).text(key).f64(delta).finish());
    this._values.set(key, key);
    return this;
  }

  remove(key) {
    assertResource(this);
    if (typeof key !== 'string') throw new TypeError('Weighted.remove expects a string');
    this._engine.call(26, new Writer().u32(this._handle).text(key).finish());
    this._values.delete(key);
    return this;
  }

  clone() {
    assertResource(this);
    return Weighted._fromHandle(this._engine, readHandle(this._engine.call(10, new Writer().u32(this._handle).finish())), this._values);
  }

  close() { closeResource(this); }
  [Symbol.dispose]() { this.close(); }
}

function assertRng(value) {
  if (!(value instanceof Rng)) throw new TypeError('expected an Rng');
  assertResource(value);
}

/** A mutable typed string Markov model. */
export class Markov {
  constructor(maxOrder) {
    const engine = requireRuntime();
    const writer = new Writer().u32(asU32(maxOrder, 'maxOrder'));
    registerResource(this, engine, readHandle(engine.call(40, writer.finish())));
  }

  static _fromHandle(engine, handle) { return registerResource(Object.create(this.prototype), engine, handle); }

  learn(sequences) {
    assertResource(this);
    if (!Array.isArray(sequences)) throw new TypeError('sequences must be an array');
    const writer = new Writer().u32(this._handle).u32(asCount(sequences.length, 'sequence count'));
    for (const sequence of sequences) writer.strings(sequence);
    this._engine.call(41, writer.finish());
    return this;
  }

  addTransition(context, next, weight = 1) {
    assertResource(this);
    const writer = new Writer().u32(this._handle).strings(context);
    if (next === undefined || next === null) writer.u8(0);
    else writer.u8(1).text(next);
    writer.f64(weight);
    this._engine.call(42, writer.finish());
    return this;
  }

  addEndTransition(context, weight = 1) { return this.addTransition(context, undefined, weight); }

  step(context, rng, direction = 'forward') {
    assertResource(this);
    assertRng(rng);
    const reader = new Reader(this._engine.call(43, new Writer().u32(this._handle).u32(rng._handle).strings(context).u8(normalizeDirection(direction)).finish()));
    const hasValue = reader.u8();
    const result = hasValue ? reader.text() : undefined;
    reader.finish();
    if (hasValue !== 0 && hasValue !== 1) fail('Rust binding returned an invalid Markov step');
    return result;
  }

  generate(rng, options = {}) {
    assertResource(this);
    assertRng(rng);
    const writer = new Writer()
      .u32(this._handle).u32(rng._handle)
      .u32(asCount(options.min ?? 0, 'min'))
      .u32(asCount(options.max ?? 64, 'max'))
      .u32(asCount(options.maxAttempts ?? 1, 'maxAttempts'))
      .u32(asCount(options.order ?? 0, 'order'))
      .u8(normalizeDirection(options.direction))
      .u8(options.strict === true ? 1 : 0)
      .strings(options.start ?? [])
      .strings(options.mustContain ?? [])
      .strings(options.mustNotContain ?? []);
    const reader = new Reader(this._engine.call(44, writer.finish()));
    const result = reader.strings();
    reader.finish();
    return result;
  }

  score(sequence) {
    assertResource(this);
    const reader = new Reader(this._engine.call(45, new Writer().u32(this._handle).strings(sequence).finish()));
    const result = {
      sequence: [...sequence],
      logProb: reader.f64(),
      perplexity: reader.f64(),
      isValid: reader.u8() === 1,
      normalized: reader.f64(),
    };
    reader.finish();
    return result;
  }

  stats() {
    assertResource(this);
    const reader = new Reader(this._engine.call(47, new Writer().u32(this._handle).finish()));
    const result = {
      gramCount: fromInteger(reader.u64()),
      sequenceCount: fromInteger(reader.u64()),
      orderMin: reader.u32(),
      orderMax: reader.u32(),
      avgDegreeIn: reader.f64(),
      avgDegreeOut: reader.f64(),
    };
    reader.finish();
    return result;
  }

  static blend(models, strategy = 'arithmetic') {
    if (!Array.isArray(models) || models.length === 0) throw new TypeError('models must be a non-empty array');
    const engine = requireRuntime();
    const writer = new Writer().u8(normalizeStrategy(strategy)).u32(asCount(models.length, 'model count'));
    for (const pair of models) {
      if (!Array.isArray(pair) || pair.length !== 2) throw new TypeError('blend models must be [Markov, weight] pairs');
      assertResource(pair[0]);
      writer.u32(pair[0]._handle).f64(pair[1]);
    }
    return this._fromHandle(engine, readHandle(engine.call(46, writer.finish())));
  }

  snapshot() {
    assertResource(this);
    return this._engine.call(50, new Writer().u32(this._handle).finish());
  }

  static fromState(state) {
    const engine = requireRuntime();
    return this._fromHandle(engine, readHandle(engine.call(51, bytesFrom(state, 'state'))));
  }

  clone() {
    assertResource(this);
    return Markov._fromHandle(this._engine, readHandle(this._engine.call(10, new Writer().u32(this._handle).finish())));
  }

  close() { closeResource(this); }
  [Symbol.dispose]() { this.close(); }
}

function writeModelSpec(writer, spec, limits) {
  if (!spec || typeof spec !== 'object') throw new TypeError('model description must be an object');
  writeLimits(writer, limits ?? spec.limits);
  const variables = spec.variables ?? [];
  writer.u32(asCount(variables.length, 'variable count'));
  for (const variable of variables) writer.text(variable.id).strings(variable.domain);
  const tables = spec.tables ?? [];
  writer.u32(asCount(tables.length, 'table count'));
  for (const table of tables) {
    writer.text(table.target).strings(table.parents ?? []);
    const rows = table.rows ?? [];
    writer.u32(asCount(rows.length, 'row count'));
    for (const row of rows) {
      writeAssignment(writer, row.given ?? {});
      const weights = row.weights ?? {};
      const pairs = weightedPairs(weights);
      writer.u32(asCount(pairs.length, 'outcome count'));
      for (const [outcome, weight] of pairs) writer.text(outcome).f64(weight);
    }
  }
  const constraints = spec.constraints ?? [];
  writer.u32(asCount(constraints.length, 'constraint count'));
  for (const constraint of constraints) {
    if (constraint && 'forbid' in constraint) {
      writer.u8(0);
      writeAssignment(writer, constraint.forbid);
    } else if (constraint && 'allow' in constraint) {
      writer.u8(1);
      const alternatives = constraint.allow ?? [];
      writer.u32(asCount(alternatives.length, 'allowed group count'));
      for (const alternative of alternatives) writeAssignment(writer, alternative);
    } else {
      throw new TypeError('constraints must contain forbid or allow');
    }
  }
  writer.text(spec.id ?? '').text(spec.revision ?? '');
  return writer;
}

/** A compiled finite-domain conditional model. */
export class Model {
  constructor(description, limits) {
    const engine = requireRuntime();
    registerResource(this, engine, readHandle(engine.call(60, writeModelSpec(new Writer(), description, limits).finish())));
  }

  static _fromHandle(engine, handle) { return registerResource(Object.create(this.prototype), engine, handle); }

  posterior(target, evidence = {}, limits) {
    assertResource(this);
    // Keep the construction explicit: assignment and limits are part of op 61.
    const payload = new Writer().u32(this._handle).text(target);
    writeAssignment(payload, evidence);
    writeLimits(payload, limits);
    const reader = new Reader(this._engine.call(61, payload.finish()));
    const probabilities = decodeMap(reader);
    reader.finish();
    return { target, probabilities };
  }

  sample(rng, evidence = {}, limits) {
    assertResource(this);
    assertRng(rng);
    const payload = new Writer().u32(this._handle).u32(rng._handle);
    writeAssignment(payload, evidence);
    writeLimits(payload, limits);
    const reader = new Reader(this._engine.call(62, payload.finish()));
    const result = decodeAssignment(reader);
    reader.finish();
    return result;
  }

  snapshot() {
    assertResource(this);
    return this._engine.call(63, new Writer().u32(this._handle).finish());
  }

  static fromState(state) {
    const engine = requireRuntime();
    return this._fromHandle(engine, readHandle(engine.call(60, bytesFrom(state, 'state'))));
  }

  clone() {
    assertResource(this);
    return Model._fromHandle(this._engine, readHandle(this._engine.call(10, new Writer().u32(this._handle).finish())));
  }

  close() { closeResource(this); }
  [Symbol.dispose]() { this.close(); }
}

const api = Object.freeze({ init, Rng, Weighted, Markov, Model, AcausalError });
