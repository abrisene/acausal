# Internal binding protocol, ABI 1

Rust owns every algorithm. Both host bindings use the private `rust/bridge.rs` transport.

Exports: `acausal_abi_version() -> u32`, `acausal_alloc(length:u32) -> buffer_handle:u32`, `acausal_buffer_ptr(handle) -> pointer`, `acausal_buffer_len(handle) -> u32`, `acausal_free(handle)`, `acausal_call(operation:u32,payload_buffer_handle:u32) -> result_buffer_handle:u32`.

Write payload into the allocated buffer, call, copy response bytes, then free both buffers. Resource handles persist until explicitly closed. Allocation failure is handle zero. Reacquire wasm memory views after every call.

Numbers are little endian. Strings are UTF-8 preceded by byte length u32. A string list is count u32 then strings. Responses start with byte 1 for success, followed by operation payload, or byte 0 plus a string error.

## Stable operations

| op | input after operation number | success output |
|---|---|---|
| 1 | seed u32 | RNG handle u32 |
| 2 | seed kind byte (0 scalar + u32, 1 words + count u32 + u32 words), legacy uses u64 | RNG handle |
| 3 | RNG handle u32 | raw full-state bytes (no prefix) |
| 4 | raw full-state bytes | RNG handle u32 |
| 5 | RNG handle, min f64, max f64 | f64 |
| 6 | RNG handle, min i64, max i64 | i64 |
| 7 | RNG handle, probability f64 | bool byte |
| 8 | RNG handle, distribution tag u8, parameters f64 list (count u32 then values) | f64 |
| 9 | RNG handle | uses u64 |
| 10 | resource handle | cloned resource handle |
| 20 | entry count u32, repeated (string, weight f64) | weighted handle |
| 21 | weighted handle | count u32, repeated (string, probability f64) |
| 22 | weighted handle, RNG handle, excluded string list | chosen string |
| 23 | weighted handle, RNG handle, count u32, replacement u8 (0 with, 1 without), excluded string list | chosen string list |
| 24 | weighted handle, key string, weight f64 | empty |
| 25 | weighted handle, key string, delta f64 | empty |
| 26 | weighted handle, key string | empty |

Distribution tags and parameters: 0 uniform(min,max), 1 normal(mean,stddev), 2 clampedNormal(mean,stddev,min,max), 3 logNormal(mean,stddev), 4 exponential(rate), 5 poisson(rate), 6 binomial(trials,p), 7 geometric(p), 8 beta(alpha,beta), 9 gamma(shape,scale), 10 weibull(shape,scale,location), 11 cauchy(location,scale), 12 logistic(location,scale), 13 bernoulli(p).

## Markov

| op | input | output |
|---|---|---|
| 40 | max_order u32 | Markov handle |
| 41 | Markov handle, sequence count u32, repeated string lists | empty |
| 42 | Markov handle, context string list, has-next byte, optional next string, weight f64 | empty |
| 43 | Markov handle, RNG handle, context string list, direction byte (0 forward, 1 backward) | has-value byte, optional string |
| 44 | Markov handle, RNG handle, min u32, max u32, max_attempts u32, order u32 (0 model default), direction byte, strict byte, start string list, must_contain string list, must_not_contain string list | generated string list |
| 45 | Markov handle, sequence string list | log_prob f64, perplexity f64, is_valid byte, normalized f64 |
| 46 | strategy byte (0 arithmetic, 1 geometric, 2 harmonic, 3 max, 4 min), count u32, repeated (Markov handle u32, weight f64) | blended Markov handle |
| 47 | Markov handle | gram_count u64, sequence_count u64, order_min u32, order_max u32, avg_degree_in f64, avg_degree_out f64 |
| 50 | Markov handle | raw portable snapshot bytes |
| 51 | raw portable snapshot bytes | restored Markov handle |

## Conditioning

Assignment = pair count u32 then repeated (variable string, value string). Duplicate keys are errors.

Limits = byte 0 for default, or byte 1 then six u32 in order: max_domain_size, max_variables, max_factors, max_elimination_width, max_joint_support, max_operations. Host field names are camelCase JS, snake_case Python.

Model spec = limits, variable count u32 + repeated (id string, domain string list), table count u32 + repeated table, constraint count u32 + repeated constraint, id string, revision string. Empty id/revision mean absent.

Table = target string, parents string list, row count u32 + repeated row.

Row = parent assignment, outcome count u32 + repeated (outcome string, weight f64).

Constraint = kind byte: 0 forbidden + Assignment; 1 allowed group + count u32 + repeated Assignment. Alternatives within a group are OR, separate constraints are AND.

Host model description is `{variables:[{id,domain}],tables:[{target,parents,rows:[{given:{...},weights:{outcome:weight}}]}],constraints:[{forbid:{...}}|{allow:[{...}]}],id?,revision?}`. Python same names for model fields.

| op | input | output |
|---|---|---|
| 60 | model spec | Model handle |
| 61 | Model handle, target string, evidence Assignment, limits | pair count u32 + repeated (outcome string, probability f64) |
| 62 | Model handle, RNG handle, evidence Assignment, limits | Assignment |
| 63 | Model handle | original model-spec bytes (including compile limits) |

Model.fromState uses op60 with saved bytes. Resource clone op10 covers models and weighted tables too. Weighted entries op27 returns raw count+(key,weight) pairs for serialization. Parent owns protocol and Rust bridge.
