import { ALGORITHM_REVISION, COMPILER_REVISION, DEFAULT_BOUNDS, NUMERIC_RUNTIME_REVISION } from './constants';
import type { CompiledConditioningModel } from './model';
import type { ConditioningBounds, ConditioningRefusal, RefusalReceipt, RefusalStage } from './types';

let runCounter = 0;

export function nextRunId(): string {
  runCounter += 1;
  return `conditioning-run-${runCounter}`;
}

export function refusalReceipt(options: {
  stage: RefusalStage;
  bounds?: ConditioningBounds;
  compiled?: CompiledConditioningModel;
  limit?: number;
  observed?: number;
  factorsCompiled?: number;
  eliminationSteps?: number;
}): RefusalReceipt {
  return {
    kind: 'refusal',
    runId: nextRunId(),
    refusedAt: options.stage,
    compilerRevision: COMPILER_REVISION,
    algorithmRevision: ALGORITHM_REVISION,
    numericRuntimeRevision: NUMERIC_RUNTIME_REVISION,
    modelFingerprint: options.compiled?.modelFingerprint,
    evidenceFingerprint: options.compiled?.evidenceFingerprint,
    boundsInEffect: options.bounds ?? DEFAULT_BOUNDS,
    limit: options.limit,
    observed: options.observed,
    partialWork: {
      factorsCompiled: options.factorsCompiled ?? 0,
      eliminationSteps: options.eliminationSteps ?? 0,
    },
  };
}

export class ConditioningRefusalSignal {
  constructor(readonly refusal: ConditioningRefusal) {}
}

export function signal(refusal: ConditioningRefusal): never {
  throw new ConditioningRefusalSignal(refusal);
}
