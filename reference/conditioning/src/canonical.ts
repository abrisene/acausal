import type { Assignment, VariableId } from './model';

const textEncoder = new TextEncoder();

function numberToHex(value: number): string {
  if (Number.isNaN(value)) return 'nan';
  if (value === Number.POSITIVE_INFINITY) return '+inf';
  if (value === Number.NEGATIVE_INFINITY) return '-inf';
  const bytes = new Uint8Array(8);
  new DataView(bytes.buffer).setFloat64(0, value, false);
  return [...bytes].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

export function canonicalSerialize(value: unknown): string {
  if (value === null) return 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return `f64:${numberToHex(value)}`;
  if (typeof value === 'string') {
    const bytes = textEncoder.encode(value);
    return `s${bytes.length}:${value}`;
  }
  if (Array.isArray(value)) {
    return `a${value.length}:[${value.map(canonicalSerialize).join('')}]`;
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).sort(compareCodeUnits);
    return `o${keys.length}:{${keys
      .map(key => `${canonicalSerialize(key)}${canonicalSerialize(record[key])}`)
      .join('')}}`;
  }
  throw new TypeError(`Unsupported canonical value: ${typeof value}`);
}

export function compareCodeUnits(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function fnv1a(input: Uint8Array, offset: number): number {
  let hash = offset >>> 0;
  for (const byte of input) {
    hash = Math.imul(hash ^ byte, 0x01000193) >>> 0;
  }
  return hash;
}

const HASH_BASES = [0x811c9dc5, 0x01000193, 0x9e3779b9, 0x85ebca6b];

export function hashWords(value: string): readonly number[] {
  const bytes = textEncoder.encode(value);
  return HASH_BASES.map(base => fnv1a(bytes, base));
}

export function fingerprint(value: unknown): string {
  return hashWords(canonicalSerialize(value))
    .map(word => word.toString(16).padStart(8, '0'))
    .join('');
}

export function encodeTuple(parts: readonly string[]): string {
  return parts
    .map(part => {
      const bytes = textEncoder.encode(part);
      return `${bytes.length}:${part}`;
    })
    .join('');
}

export function encodeAssignment(scope: readonly VariableId[], assignment: Assignment): string {
  return canonicalSerialize(scope.map(variableId => [variableId, assignment[variableId]]));
}

export function decodeAssignment(key: string): Assignment {
  const entries: Array<[string, string]> = [];
  let cursor = 0;

  function readLength(prefix: string): number {
    if (key[cursor] !== prefix) throw new Error('Invalid assignment key');
    cursor += 1;
    const colon = key.indexOf(':', cursor);
    if (colon === -1) throw new Error('Invalid assignment key length');
    const length = Number(key.slice(cursor, colon));
    cursor = colon + 1;
    return length;
  }

  const arrayLength = readLength('a');
  if (key[cursor] !== '[') throw new Error('Invalid assignment array');
  cursor += 1;
  for (let index = 0; index < arrayLength; index += 1) {
    const pairLength = readLength('a');
    if (pairLength !== 2 || key[cursor] !== '[') {
      throw new Error('Invalid assignment pair');
    }
    cursor += 1;
    const variableLength = readLength('s');
    const variableId = key.slice(cursor, cursor + variableLength);
    cursor += variableLength;
    const valueLength = readLength('s');
    const value = key.slice(cursor, cursor + valueLength);
    cursor += valueLength;
    if (key[cursor] !== ']') throw new Error('Invalid assignment pair ending');
    cursor += 1;
    entries.push([variableId, value]);
  }
  if (key[cursor] !== ']') throw new Error('Invalid assignment ending');
  return Object.fromEntries(entries);
}

export function assignments(
  scope: readonly VariableId[],
  domains: ReadonlyMap<VariableId, readonly string[]>
): readonly Assignment[] {
  let result: Assignment[] = [{}];
  for (const variableId of scope) {
    const domain = domains.get(variableId);
    if (!domain) throw new Error(`Unknown variable ${variableId}`);
    const next: Assignment[] = [];
    for (const partial of result) {
      for (const value of domain) {
        next.push({ ...partial, [variableId]: value });
      }
    }
    result = next;
  }
  return result;
}

export function assignmentCardinality(
  scope: readonly VariableId[],
  domains: ReadonlyMap<VariableId, readonly string[]>,
  ceiling = Number.MAX_SAFE_INTEGER
): number {
  let cardinality = 1;
  for (const variableId of scope) {
    const domain = domains.get(variableId);
    if (!domain) throw new Error(`Unknown variable ${variableId}`);
    if (domain.length > 0 && cardinality > Math.floor(ceiling / domain.length)) {
      return ceiling + 1;
    }
    cardinality *= domain.length;
  }
  return cardinality;
}

export function assignmentMatches(assignment: Assignment, expected: Assignment): boolean {
  return Object.entries(expected).every(([variableId, value]) => assignment[variableId] === value);
}

export function logSumExp(values: readonly number[]): number {
  const finite = values.filter(value => value !== Number.NEGATIVE_INFINITY);
  if (finite.length === 0) return Number.NEGATIVE_INFINITY;
  const maximum = Math.max(...finite);
  let total = 0;
  for (const value of finite) total += Math.exp(value - maximum);
  return maximum + Math.log(total);
}
