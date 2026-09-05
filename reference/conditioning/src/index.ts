export {
  ALGORITHM_REVISION,
  COMPILER_REVISION,
  DEFAULT_BOUNDS,
  HARD_CAPS,
  NUMERIC_RUNTIME_REVISION,
  POSTERIOR_METRIC,
  RELATIVE_WEIGHT_METRIC,
  SAMPLING_REVISION,
} from './constants';
export { canonicalSerialize, encodeTuple, fingerprint } from './canonical';
export { buildReceiptCore, compileConditioningModel, resolveConditioningBounds } from './compiler';
export { inferByEnumeration, inferPosterior } from './inference';
export { sampleForward } from './sampling';
export type {
  Assignment,
  CanonicalAssignmentKey,
  CompiledConditioningModel,
  CompiledFactor,
  CompiledFactorRow,
  ConditionalTable,
  ConditionalWeightRow,
  ConditioningModel,
  ConditioningQuery,
  EligibilityRule,
  EvidenceRecord,
  FeasibilityDecision,
  MultiplicativeModifier,
  OntologyEdge,
  OutcomeWeight,
  OverlayLayer,
  Predicate,
  TypedVariable,
  VariableId,
  VariableKind,
} from './model';
export type {
  CompilationReceipt,
  CompilationResult,
  ConditioningBounds,
  ConditioningRefusal,
  ConditioningResult,
  EvidenceShapeDetail,
  InferenceReceipt,
  InferenceResult,
  InvalidModelDetail,
  NumericBound,
  NumericMetric,
  NumericRange,
  PosteriorResult,
  ReceiptCore,
  RefusalReceipt,
  SampleResult,
  SamplingDraw,
  SamplingReceipt,
  SamplingResult,
} from './types';
export type { SamplingOptions } from './sampling';
