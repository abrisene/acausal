"""Dependency-free Python bindings for the acausal Rust engine.

The native library owns all algorithms. This module only marshals values over
the small private ABI and keeps resource handles alive until ``close`` or
context-manager exit.
"""

from __future__ import annotations

import ctypes
import math
import os
import struct
from collections.abc import Iterable, Mapping, Sequence
from pathlib import Path
from typing import Any, Literal, TypedDict

ABI_VERSION = 1
I64_MIN = -(1 << 63)
I64_MAX = (1 << 63) - 1
U32_MAX = (1 << 32) - 1
U64_MAX = (1 << 64) - 1
DEFAULT_LIMITS = {
    "max_domain_size": 256,
    "max_variables": 512,
    "max_factors": 1024,
    "max_elimination_width": 12,
    "max_joint_support": 100_000,
    "max_operations": 1_000_000,
}


class AcausalError(RuntimeError):
    """An error returned by the Rust engine through the private ABI."""


class _Writer:
    def __init__(self) -> None:
        self.parts: list[bytes] = []

    def u8(self, value: int) -> _Writer:
        if not 0 <= value <= 0xFF:
            raise ValueError("byte is outside 0..255")
        self.parts.append(bytes((value,)))
        return self

    def u32(self, value: int, name: str = "u32") -> _Writer:
        _u32(value, name)
        self.parts.append(struct.pack("<I", value))
        return self

    def i64(self, value: int, name: str = "i64") -> _Writer:
        _i64(value, name)
        self.parts.append(struct.pack("<q", value))
        return self

    def u64(self, value: int, name: str = "u64") -> _Writer:
        _u64(value, name)
        self.parts.append(struct.pack("<Q", value))
        return self

    def f64(self, value: float) -> _Writer:
        self.parts.append(struct.pack("<d", float(value)))
        return self

    def text(self, value: str) -> _Writer:
        if not isinstance(value, str):
            raise TypeError("text values must be strings")
        encoded = value.encode("utf-8")
        self.u32(len(encoded), "text length")
        self.parts.append(encoded)
        return self

    def strings(self, values: Iterable[str]) -> _Writer:
        values = list(values)
        self.u32(len(values), "string-list length")
        for value in values:
            self.text(value)
        return self

    def assignment(self, value: AssignmentInput | None) -> _Writer:
        entries = _assignment_entries(value)
        self.u32(len(entries), "assignment length")
        for key, item in entries:
            self.text(key).text(item)
        return self

    def pairs(self, values: Iterable[tuple[str, float]]) -> _Writer:
        values = list(values)
        self.u32(len(values), "pair count")
        for key, weight in values:
            self.text(key).f64(weight)
        return self

    def finish(self) -> bytes:
        return b"".join(self.parts)


class _Reader:
    def __init__(self, data: bytes) -> None:
        self.data = data
        self.position = 0

    def take(self, length: int) -> bytes:
        end = self.position + length
        if length < 0 or end > len(self.data):
            raise AcausalError("truncated response")
        result = self.data[self.position:end]
        self.position = end
        return result

    def u8(self) -> int:
        return self.take(1)[0]

    def u32(self) -> int:
        return struct.unpack("<I", self.take(4))[0]

    def u64(self) -> int:
        return struct.unpack("<Q", self.take(8))[0]

    def i64(self) -> int:
        return struct.unpack("<q", self.take(8))[0]

    def f64(self) -> float:
        return struct.unpack("<d", self.take(8))[0]

    def text(self) -> str:
        try:
            return self.take(self.u32()).decode("utf-8")
        except UnicodeDecodeError as error:
            raise AcausalError("invalid UTF-8 in response") from error

    def strings(self) -> list[str]:
        count = self.u32()
        if count > (len(self.data) - self.position) // 4:
            raise AcausalError("invalid string-list count")
        return [self.text() for _ in range(count)]

    def assignment(self) -> dict[str, str]:
        count = self.u32()
        if count > (len(self.data) - self.position) // 8:
            raise AcausalError("invalid assignment count")
        result: dict[str, str] = {}
        for _ in range(count):
            key = self.text()
            if key in result:
                raise AcausalError("duplicate assignment variable")
            result[key] = self.text()
        return result

    def pairs(self) -> dict[str, float]:
        count = self.u32()
        if count > (len(self.data) - self.position) // 12:
            raise AcausalError("invalid pair count")
        return {self.text(): self.f64() for _ in range(count)}

    def remaining(self) -> bytes:
        return self.data[self.position :]

    def finish(self) -> None:
        if self.position != len(self.data):
            raise AcausalError("unexpected response bytes")


def _u32(value: int, name: str) -> int:
    if isinstance(value, bool) or not isinstance(value, int) or not 0 <= value <= U32_MAX:
        raise ValueError(f"{name} must be an unsigned 32-bit integer")
    return value


def _i64(value: int, name: str) -> int:
    if isinstance(value, bool) or not isinstance(value, int) or not I64_MIN <= value <= I64_MAX:
        raise ValueError(f"{name} must be a signed 64-bit integer")
    return value


def _u64(value: int, name: str) -> int:
    if isinstance(value, bool) or not isinstance(value, int) or not 0 <= value <= U64_MAX:
        raise ValueError(f"{name} must be an unsigned 64-bit integer")
    return value


def _assignment_entries(value: AssignmentInput | None) -> list[tuple[str, str]]:
    if value is None:
        return []
    if isinstance(value, Mapping):
        return [(str(key), str(item)) for key, item in value.items()]
    entries: list[tuple[str, str]] = []
    for entry in value:
        if not isinstance(entry, Sequence) or len(entry) != 2:
            raise TypeError("assignment entries must be (variable, value) pairs")
        entries.append((str(entry[0]), str(entry[1])))
    return entries


def _mapping_entries(value: Mapping[str, float] | Iterable[tuple[str, float]]) -> list[tuple[str, float]]:
    if isinstance(value, Mapping):
        return [(str(key), float(weight)) for key, weight in value.items()]
    entries: list[tuple[str, float]] = []
    for entry in value:
        if not isinstance(entry, Sequence) or len(entry) != 2:
            raise TypeError("entries must be (key, weight) pairs")
        entries.append((str(entry[0]), float(entry[1])))
    return entries


def _direction(value: str) -> int:
    if value == "forward":
        return 0
    if value == "backward":
        return 1
    raise ValueError("direction must be 'forward' or 'backward'")


def _strategy(value: str) -> int:
    try:
        return ("arithmetic", "geometric", "harmonic", "max", "min").index(value)
    except ValueError as error:
        raise ValueError("strategy must be arithmetic, geometric, harmonic, max, or min") from error


class _Limits(TypedDict, total=False):
    max_domain_size: int
    max_variables: int
    max_factors: int
    max_elimination_width: int
    max_joint_support: int
    max_operations: int


def _write_limits(writer: _Writer, limits: LimitsInput | None) -> None:
    if limits is None:
        writer.u8(0)
        return
    writer.u8(1)
    for field in (
        "max_domain_size",
        "max_variables",
        "max_factors",
        "max_elimination_width",
        "max_joint_support",
        "max_operations",
    ):
        writer.u32(limits.get(field, DEFAULT_LIMITS[field]), f"limits.{field}")


class _Runtime:
    def __init__(self, library: str | os.PathLike[str] | None = None) -> None:
        path = _find_library(library)
        try:
            self.library = ctypes.CDLL(str(path))
        except OSError as error:
            raise ImportError(f"cannot load acausal native library at {path}: {error}") from error

        self.library.acausal_abi_version.argtypes = []
        self.library.acausal_abi_version.restype = ctypes.c_uint32
        self.library.acausal_alloc.argtypes = [ctypes.c_uint32]
        self.library.acausal_alloc.restype = ctypes.c_uint32
        self.library.acausal_buffer_ptr.argtypes = [ctypes.c_uint32]
        self.library.acausal_buffer_ptr.restype = ctypes.c_void_p
        self.library.acausal_buffer_len.argtypes = [ctypes.c_uint32]
        self.library.acausal_buffer_len.restype = ctypes.c_uint32
        self.library.acausal_free.argtypes = [ctypes.c_uint32]
        self.library.acausal_free.restype = None
        self.library.acausal_call.argtypes = [ctypes.c_uint32, ctypes.c_uint32]
        self.library.acausal_call.restype = ctypes.c_uint32
        version = int(self.library.acausal_abi_version())
        if version != ABI_VERSION:
            raise AcausalError(f"unsupported acausal ABI version {version}; expected {ABI_VERSION}")

    def free(self, handle: int) -> None:
        if handle:
            self.library.acausal_free(handle)

    def call(self, operation: int, payload: bytes) -> bytes:
        if len(payload) > U32_MAX:
            raise ValueError("payload is too large")
        payload_handle = int(self.library.acausal_alloc(len(payload)))
        if not payload_handle:
            raise AcausalError("Rust binding allocation failed")
        result_handle = 0
        try:
            pointer = self.library.acausal_buffer_ptr(payload_handle)
            length = int(self.library.acausal_buffer_len(payload_handle))
            if length != len(payload) or (length and not pointer):
                raise AcausalError("Rust binding returned an invalid payload buffer")
            if payload:
                ctypes.memmove(pointer, payload, len(payload))
            result_handle = int(self.library.acausal_call(_u32(operation, "operation"), payload_handle))
            if not result_handle:
                raise AcausalError(f"Rust binding call {operation} returned no result")
            result_pointer = self.library.acausal_buffer_ptr(result_handle)
            result_length = int(self.library.acausal_buffer_len(result_handle))
            if result_length and not result_pointer:
                raise AcausalError("Rust binding returned an invalid result buffer")
            response = ctypes.string_at(result_pointer, result_length)
            reader = _Reader(response)
            status = reader.u8()
            if status == 0:
                message = reader.text()
                reader.finish()
                raise AcausalError(message)
            if status != 1:
                raise AcausalError("Rust binding returned an invalid response status")
            return reader.remaining()
        finally:
            self.free(result_handle)
            self.free(payload_handle)


def _find_library(library: str | os.PathLike[str] | None) -> Path:
    if library is not None:
        path = Path(library)
        if not path.is_file():
            raise ImportError(f"ACAUSAL_LIBRARY path does not exist: {path}")
        return path
    configured = os.environ.get("ACAUSAL_LIBRARY")
    if configured:
        path = Path(configured)
        if not path.is_file():
            raise ImportError(f"ACAUSAL_LIBRARY path does not exist: {path}")
        return path
    native = Path(__file__).with_name("_native")
    names = (
        "libacausal.dylib",
        "acausal.dylib",
        "libacausal.so",
        "acausal.so",
        "acausal.dll",
        "libacausal.dll",
    )
    for name in names:
        path = native / name
        if path.is_file():
            return path
    searched = ", ".join(str(native / name) for name in names)
    raise ImportError(
        "acausal native library is unavailable; set ACAUSAL_LIBRARY to a built "
        f"library path (searched {searched})"
    )


_runtime_instance: _Runtime | None = None


def init(library: str | os.PathLike[str] | None = None) -> None:
    """Load and validate the native library once.

    Resource constructors load it lazily as well, so applications can simply
    construct ``Rng`` after setting ``ACAUSAL_LIBRARY``.
    """

    global _runtime_instance
    if _runtime_instance is None:
        _runtime_instance = _Runtime(library)


def _runtime() -> _Runtime:
    if _runtime_instance is None:
        init()
    assert _runtime_instance is not None
    return _runtime_instance


class _Resource:
    _runtime: _Runtime
    _handle: int

    def __init__(self, runtime: _Runtime, handle: int) -> None:
        self._runtime = runtime
        self._handle = handle
        self._closed = False

    def _require_open(self) -> None:
        if self._closed:
            raise RuntimeError("acausal resource is closed")

    def close(self) -> None:
        if not self._closed:
            self._closed = True
            self._runtime.free(self._handle)
            self._handle = 0

    def __enter__(self):
        self._require_open()
        return self

    def __exit__(self, exc_type: Any, exc_value: Any, traceback: Any) -> None:
        self.close()

    def __del__(self) -> None:
        try:
            self.close()
        except Exception:
            pass


def _handle(body: bytes) -> int:
    reader = _Reader(body)
    handle = reader.u32()
    reader.finish()
    if not handle:
        raise AcausalError("Rust binding returned an invalid resource handle")
    return handle


def _legacy_seed_payload(seed: int | Iterable[int], uses: int) -> bytes:
    if isinstance(seed, int) and not isinstance(seed, bool):
        return _Writer().u8(0).u32(_u32(seed, "seed")).u64(_u64(uses, "uses")).finish()
    words = list(seed)
    writer = _Writer().u8(1).u32(len(words), "seed word count")
    for word in words:
        writer.u32(_u32(word, "seed word"))
    return writer.u64(_u64(uses, "uses")).finish()


class DistributionSpec(TypedDict, total=False):
    type: Literal[
        "uniform",
        "normal",
        "clampedNormal",
        "logNormal",
        "exponential",
        "poisson",
        "binomial",
        "geometric",
        "beta",
        "gamma",
        "weibull",
        "cauchy",
        "logistic",
        "bernoulli",
    ]
    min: float
    max: float
    mean: float
    stddev: float
    rate: float
    trials: float
    probability: float
    alpha: float
    beta: float
    shape: float
    scale: float
    location: float


def _distribution(spec: DistributionSpec) -> tuple[int, list[float]]:
    kind = spec.get("type")
    fields: dict[str, tuple[int, tuple[str, ...]]] = {
        "uniform": (0, ("min", "max")),
        "normal": (1, ("mean", "stddev")),
        "clampedNormal": (2, ("mean", "stddev", "min", "max")),
        "logNormal": (3, ("mean", "stddev")),
        "exponential": (4, ("rate",)),
        "poisson": (5, ("rate",)),
        "binomial": (6, ("trials", "probability")),
        "geometric": (7, ("probability",)),
        "beta": (8, ("alpha", "beta")),
        "gamma": (9, ("shape", "scale")),
        "weibull": (10, ("shape", "scale", "location")),
        "cauchy": (11, ("location", "scale")),
        "logistic": (12, ("location", "scale")),
        "bernoulli": (13, ("probability",)),
    }
    if kind not in fields:
        raise TypeError("sample expects a typed distribution spec")
    tag, names = fields[kind]
    try:
        values = [float(spec[name]) for name in names]
    except KeyError as error:
        raise TypeError(f"{kind} distribution requires {error.args[0]}") from error
    return tag, values


class Rng(_Resource):
    def __init__(self, seed: int | Iterable[int]) -> None:
        runtime = _runtime()
        if isinstance(seed, int) and not isinstance(seed, bool):
            body = runtime.call(1, _Writer().u32(_u32(seed, "seed")).finish())
        else:
            body = runtime.call(2, _legacy_seed_payload(seed, 2_000))
        super().__init__(runtime, _handle(body))

    @classmethod
    def from_state(cls, state: bytes | bytearray | memoryview) -> Rng:
        runtime = _runtime()
        return cls._from_handle(runtime, _handle(runtime.call(4, bytes(state))))

    @classmethod
    def from_legacy(cls, seed: int | Iterable[int], uses: int) -> Rng:
        runtime = _runtime()
        return cls._from_handle(runtime, _handle(runtime.call(2, _legacy_seed_payload(seed, uses))))

    @classmethod
    def _from_handle(cls, runtime: _Runtime, handle: int) -> Rng:
        result = cls.__new__(cls)
        _Resource.__init__(result, runtime, handle)
        return result

    def int(self, minimum: int, maximum: int) -> int:
        self._require_open()
        payload = _Writer().u32(self._handle).i64(_i64(minimum, "min"), "min").i64(_i64(maximum, "max"), "max").finish()
        reader = _Reader(self._runtime.call(6, payload))
        result = reader.i64()
        reader.finish()
        return result

    def float(self, minimum: float, maximum: float) -> float:
        self._require_open()
        reader = _Reader(self._runtime.call(5, _Writer().u32(self._handle).f64(minimum).f64(maximum).finish()))
        result = reader.f64()
        reader.finish()
        return result

    def bool(self, probability: float = 0.5) -> bool:
        self._require_open()
        reader = _Reader(self._runtime.call(7, _Writer().u32(self._handle).f64(probability).finish()))
        result = reader.u8()
        reader.finish()
        if result not in (0, 1):
            raise AcausalError("Rust binding returned an invalid boolean")
        return result == 1

    def sample(self, spec: DistributionSpec) -> float:
        self._require_open()
        tag, values = _distribution(spec)
        writer = _Writer().u32(self._handle).u8(tag).u32(len(values), "parameter count")
        for value in values:
            writer.f64(value)
        reader = _Reader(self._runtime.call(8, writer.finish()))
        result = reader.f64()
        reader.finish()
        return result

    def uses(self) -> int:
        self._require_open()
        reader = _Reader(self._runtime.call(9, _Writer().u32(self._handle).finish()))
        result = reader.u64()
        reader.finish()
        return result

    def snapshot(self) -> bytes:
        self._require_open()
        return bytes(self._runtime.call(3, _Writer().u32(self._handle).finish()))

    def clone(self) -> Rng:
        self._require_open()
        return Rng._from_handle(self._runtime, _handle(self._runtime.call(10, _Writer().u32(self._handle).finish())))


# Keep these aliases as strings so importing the package remains possible on
# Python 3.9, while the published package still advertises Python 3.11+.
AssignmentInput = "Mapping[str, str] | Iterable[tuple[str, str]]"
LimitsInput = "Mapping[str, int]"


class Weighted(_Resource):
    def __init__(self, entries: Mapping[str, float] | Iterable[tuple[str, float]]) -> None:
        runtime = _runtime()
        pairs = _mapping_entries(entries)
        writer = _Writer().u32(len(pairs), "weighted entry count")
        for key, weight in pairs:
            writer.text(key).f64(weight)
        super().__init__(runtime, _handle(runtime.call(20, writer.finish())))

    @classmethod
    def _from_handle(cls, runtime: _Runtime, handle: int) -> Weighted:
        result = cls.__new__(cls)
        _Resource.__init__(result, runtime, handle)
        return result

    def entries(self) -> list[tuple[str, float]]:
        self._require_open()
        reader = _Reader(self._runtime.call(27, _Writer().u32(self._handle).finish()))
        count = reader.u32()
        result = [(reader.text(), reader.f64()) for _ in range(count)]
        reader.finish()
        return result

    def probabilities(self) -> dict[str, float]:
        self._require_open()
        reader = _Reader(self._runtime.call(21, _Writer().u32(self._handle).finish()))
        result = reader.pairs()
        reader.finish()
        return result

    def draw(self, rng: Rng, exclusions: Iterable[str] = ()) -> str:
        self._require_open()
        rng._require_open()
        reader = _Reader(self._runtime.call(22, _Writer().u32(self._handle).u32(rng._handle).strings(exclusions).finish()))
        result = reader.text()
        reader.finish()
        return result

    def draw_many(self, rng: Rng, count: int, replacement: bool = True, exclude: Iterable[str] = ()) -> list[str]:
        self._require_open()
        rng._require_open()
        writer = _Writer().u32(self._handle).u32(rng._handle).u32(_u32(count, "count")).u8(0 if replacement else 1).strings(exclude)
        reader = _Reader(self._runtime.call(23, writer.finish()))
        result = reader.strings()
        reader.finish()
        return result

    def set(self, key: str, weight: float) -> Weighted:
        self._require_open()
        self._runtime.call(24, _Writer().u32(self._handle).text(key).f64(weight).finish())
        return self

    def adjust(self, key: str, delta: float) -> Weighted:
        self._require_open()
        self._runtime.call(25, _Writer().u32(self._handle).text(key).f64(delta).finish())
        return self

    def remove(self, key: str) -> Weighted:
        self._require_open()
        self._runtime.call(26, _Writer().u32(self._handle).text(key).finish())
        return self

    def clone(self) -> Weighted:
        self._require_open()
        return Weighted._from_handle(self._runtime, _handle(self._runtime.call(10, _Writer().u32(self._handle).finish())))


class Markov(_Resource):
    def __init__(self, max_order: int) -> None:
        runtime = _runtime()
        super().__init__(runtime, _handle(runtime.call(40, _Writer().u32(_u32(max_order, "max_order")).finish())))

    @classmethod
    def _from_handle(cls, runtime: _Runtime, handle: int) -> Markov:
        result = cls.__new__(cls)
        _Resource.__init__(result, runtime, handle)
        return result

    @classmethod
    def from_state(cls, state: bytes | bytearray | memoryview) -> Markov:
        runtime = _runtime()
        return cls._from_handle(runtime, _handle(runtime.call(51, bytes(state))))

    def learn(self, sequences: Iterable[Iterable[str]]) -> Markov:
        self._require_open()
        sequences = list(sequences)
        writer = _Writer().u32(len(sequences), "sequence count")
        for sequence in sequences:
            writer.strings(sequence)
        self._runtime.call(41, _Writer().u32(self._handle).finish() + writer.finish())
        return self

    def add_transition(self, context: Iterable[str], next: str | None, weight: float = 1.0) -> Markov:
        self._require_open()
        writer = _Writer().u32(self._handle).strings(context)
        if next is None:
            writer.u8(0)
        else:
            writer.u8(1).text(next)
        writer.f64(weight)
        self._runtime.call(42, writer.finish())
        return self

    def add_end_transition(self, context: Iterable[str], weight: float = 1.0) -> Markov:
        return self.add_transition(context, None, weight)

    def step(self, context: Iterable[str], rng: Rng, direction: str = "forward") -> str | None:
        self._require_open()
        rng._require_open()
        reader = _Reader(self._runtime.call(43, _Writer().u32(self._handle).u32(rng._handle).strings(context).u8(_direction(direction)).finish()))
        has_value = reader.u8()
        result = reader.text() if has_value else None
        reader.finish()
        if has_value not in (0, 1):
            raise AcausalError("Rust binding returned an invalid Markov step")
        return result

    def generate(
        self,
        rng: Rng,
        *,
        min: int = 0,
        max: int = 64,
        max_attempts: int = 1,
        order: int = 0,
        direction: str = "forward",
        strict: bool = False,
        start: Iterable[str] = (),
        must_contain: Iterable[str] = (),
        must_not_contain: Iterable[str] = (),
    ) -> list[str]:
        self._require_open()
        rng._require_open()
        writer = (
            _Writer()
            .u32(self._handle)
            .u32(rng._handle)
            .u32(_u32(min, "min"))
            .u32(_u32(max, "max"))
            .u32(_u32(max_attempts, "max_attempts"))
            .u32(_u32(order, "order"))
            .u8(_direction(direction))
            .u8(1 if strict else 0)
            .strings(start)
            .strings(must_contain)
            .strings(must_not_contain)
        )
        reader = _Reader(self._runtime.call(44, writer.finish()))
        result = reader.strings()
        reader.finish()
        return result

    def score(self, sequence: Iterable[str]) -> dict[str, Any]:
        self._require_open()
        values = list(sequence)
        reader = _Reader(self._runtime.call(45, _Writer().u32(self._handle).strings(values).finish()))
        result: dict[str, Any] = {
            "sequence": values,
            "log_prob": reader.f64(),
            "perplexity": reader.f64(),
            "is_valid": reader.u8() == 1,
            "normalized": reader.f64(),
        }
        reader.finish()
        return result

    def stats(self) -> dict[str, Any]:
        self._require_open()
        reader = _Reader(self._runtime.call(47, _Writer().u32(self._handle).finish()))
        result: dict[str, Any] = {
            "gram_count": reader.u64(),
            "sequence_count": reader.u64(),
            "order_min": reader.u32(),
            "order_max": reader.u32(),
            "avg_degree_in": reader.f64(),
            "avg_degree_out": reader.f64(),
        }
        reader.finish()
        return result

    @classmethod
    def blend(cls, models: Iterable[tuple[Markov, float]], strategy: str = "arithmetic") -> Markov:
        models = list(models)
        if not models:
            raise ValueError("models must not be empty")
        runtime = _runtime()
        writer = _Writer().u8(_strategy(strategy)).u32(len(models), "model count")
        for model, weight in models:
            model._require_open()
            writer.u32(model._handle).f64(weight)
        return cls._from_handle(runtime, _handle(runtime.call(46, writer.finish())))

    def snapshot(self) -> bytes:
        self._require_open()
        return bytes(self._runtime.call(50, _Writer().u32(self._handle).finish()))

    def clone(self) -> Markov:
        self._require_open()
        return Markov._from_handle(self._runtime, _handle(self._runtime.call(10, _Writer().u32(self._handle).finish())))


class Variable(TypedDict):
    id: str
    domain: list[str]


class ModelRow(TypedDict):
    given: AssignmentInput
    weights: Mapping[str, float] | Iterable[tuple[str, float]]


class ModelTable(TypedDict):
    target: str
    parents: list[str]
    rows: list[ModelRow]


class ModelDescription(TypedDict, total=False):
    variables: list[Variable]
    tables: list[ModelTable]
    constraints: list[dict[str, Any]]
    id: str
    revision: str
    limits: LimitsInput


class Model(_Resource):
    def __init__(self, description: ModelDescription, limits: LimitsInput | None = None) -> None:
        runtime = _runtime()
        writer = _Writer()
        _write_limits(writer, limits if limits is not None else description.get("limits"))
        variables = description.get("variables", [])
        writer.u32(len(variables), "variable count")
        for variable in variables:
            writer.text(variable["id"]).strings(variable["domain"])
        tables = description.get("tables", [])
        writer.u32(len(tables), "table count")
        for table in tables:
            writer.text(table["target"]).strings(table["parents"])
            rows = table["rows"]
            writer.u32(len(rows), "row count")
            for row in rows:
                writer.assignment(row["given"])
                writer.pairs(_mapping_entries(row["weights"]))
        constraints = description.get("constraints", [])
        writer.u32(len(constraints), "constraint count")
        for constraint in constraints:
            if "forbid" in constraint:
                writer.u8(0).assignment(constraint["forbid"])
            elif "allow" in constraint:
                alternatives = constraint["allow"]
                writer.u8(1).u32(len(alternatives), "allowed group count")
                for alternative in alternatives:
                    writer.assignment(alternative)
            else:
                raise TypeError("constraints must contain forbid or allow")
        writer.text(description.get("id", "")).text(description.get("revision", ""))
        super().__init__(runtime, _handle(runtime.call(60, writer.finish())))

    @classmethod
    def _from_handle(cls, runtime: _Runtime, handle: int) -> Model:
        result = cls.__new__(cls)
        _Resource.__init__(result, runtime, handle)
        return result

    @classmethod
    def from_state(cls, state: bytes | bytearray | memoryview) -> Model:
        runtime = _runtime()
        return cls._from_handle(runtime, _handle(runtime.call(60, bytes(state))))

    def posterior(self, target: str, evidence: AssignmentInput | None = None, limits: LimitsInput | None = None) -> dict[str, Any]:
        self._require_open()
        writer = _Writer().u32(self._handle).text(target).assignment(evidence)
        _write_limits(writer, limits)
        reader = _Reader(self._runtime.call(61, writer.finish()))
        result = {"target": target, "probabilities": reader.pairs()}
        reader.finish()
        return result

    def sample(self, rng: Rng, evidence: AssignmentInput | None = None, limits: LimitsInput | None = None) -> dict[str, str]:
        self._require_open()
        rng._require_open()
        writer = _Writer().u32(self._handle).u32(rng._handle).assignment(evidence)
        _write_limits(writer, limits)
        reader = _Reader(self._runtime.call(62, writer.finish()))
        result = reader.assignment()
        reader.finish()
        return result

    def snapshot(self) -> bytes:
        self._require_open()
        return bytes(self._runtime.call(63, _Writer().u32(self._handle).finish()))

    def clone(self) -> Model:
        self._require_open()
        return Model._from_handle(self._runtime, _handle(self._runtime.call(10, _Writer().u32(self._handle).finish())))


__all__ = [
    "AcausalError",
    "DistributionSpec",
    "Model",
    "Markov",
    "Rng",
    "Weighted",
    "init",
]
