import type {
  Assignment,
  CanonicalAssignmentKey,
  CompiledConditioningModel,
  ConditioningQuery,
  FeasibilityDecision,
  VariableId,
} from './model';

export type NumericBound =
  | { readonly kind: 'inclusive'; readonly value: number }
  | { readonly kind: 'exclusive'; readonly value: number }
  | { readonly kind: 'unbounded' };

export interface NumericRange {
  readonly lower: NumericBound;
  readonly upper: NumericBound;
  readonly space?: 'linear' | 'log';
}

export interface NumericMetric {
  readonly metricId: string;
  readonly dimension: string;
  readonly range: NumericRange;
  readonly revision: string;
  readonly owner: string;
}

export interface ConditioningBounds {
  readonly maxDomainSize: number;
  readonly maxVariables: number;
  readonly maxFactors: number;
  readonly maxEliminationWidth: number;
  readonly maxJointSupport: number;
  readonly maxOperations: number;
}

export interface FactorBinding {
  readonly ruleId: string;
  readonly factorId: string;
  readonly scope: readonly string[];
}

export interface ReceiptCore {
  readonly runId: string;
  readonly compilerRevision: string;
  readonly algorithmRevision: string;
  readonly numericRuntimeRevision: string;
  readonly modelFingerprint: string;
  readonly evidenceFingerprint: string;
  readonly sourceSnapshotId: string;
  readonly overlayResolutionPath: readonly string[];
  readonly ancestryPath: readonly string[];
  readonly appliedRules: readonly string[];
  readonly rejectedRules: readonly { readonly id: string; readonly reason: string }[];
  readonly selectedEvidenceIds: readonly string[];
  readonly feasibilityDecisions: readonly {
    readonly invocationId: string;
    readonly resolverRevision: string;
    readonly requestFingerprint: string;
    readonly status: FeasibilityDecision['status'];
    readonly conflictOrigins: readonly string[];
  }[];
  readonly overlaysApplied: readonly string[];
  readonly factorBindings: readonly FactorBinding[];
}

export interface CompilationReceipt {
  readonly kind: 'compilation';
  readonly core: ReceiptCore;
  readonly compiledArtifactFingerprint: string;
  readonly variableOrder: readonly VariableId[];
  readonly factorIds: readonly string[];
  readonly constraintFactorIds: readonly string[];
  readonly boundsInEffect: ConditioningBounds;
  readonly maximumSourceFactorSupport: number;
}

export interface InferenceReceipt {
  readonly kind: 'inference';
  readonly core: ReceiptCore;
  readonly query: ConditioningQuery;
  readonly posterior: readonly {
    readonly outcome: string;
    readonly probability: number;
  }[];
  readonly posteriorMetric: NumericMetric;
  readonly eliminationOrder: readonly VariableId[];
  readonly inducedWidth: number;
  readonly factorsUsed: readonly string[];
  readonly constraintFactorsApplied: readonly string[];
  readonly modifierOrder: readonly string[];
  readonly boundsInEffect: ConditioningBounds;
  readonly budgetObserved: {
    readonly jointSupport: number;
    readonly operations: number;
  };
  readonly logPartition: number;
}

export interface SamplingDraw {
  readonly index: number;
  readonly variableId: VariableId;
  readonly outcome: string;
  readonly rowId: string;
  readonly candidatesConsidered: readonly string[];
  readonly candidatesDropped: readonly {
    readonly outcome: string;
    readonly reason: string;
  }[];
}

export interface SamplingReceipt {
  readonly kind: 'sampling';
  readonly core: ReceiptCore;
  readonly mode: 'forward';
  readonly streamKey: string;
  readonly streamSeedWords: readonly number[];
  readonly queryEvidenceFingerprint: string;
  readonly draws: readonly SamplingDraw[];
  readonly rngUsesBefore: number;
  readonly rngUsesAfter: number;
  readonly boundsInEffect: ConditioningBounds;
}

export type RefusalStage =
  | 'model-validation'
  | 'compilation'
  | 'plan-construction'
  | 'inference'
  | 'sampling'
  | 'configuration';

export interface RefusalReceipt {
  readonly kind: 'refusal';
  readonly runId: string;
  readonly refusedAt: RefusalStage;
  readonly compilerRevision: string;
  readonly algorithmRevision: string;
  readonly numericRuntimeRevision: string;
  readonly modelFingerprint?: string;
  readonly evidenceFingerprint?: string;
  readonly boundsInEffect: ConditioningBounds;
  readonly limit?: number;
  readonly observed?: number;
  readonly partialWork: {
    readonly factorsCompiled: number;
    readonly eliminationSteps: number;
  };
}

export type InvalidModelDetail =
  | 'incomplete-table'
  | 'duplicate-outcome'
  | 'empty-domain'
  | 'duplicate-domain-value'
  | 'non-positive-weight'
  | 'non-positive-modifier'
  | 'unknown-variable'
  | 'unknown-outcome'
  | 'duplicate-variable-id'
  | 'duplicate-table-id'
  | 'duplicate-row-id'
  | 'duplicate-rule-id'
  | 'parent-assignment-mismatch'
  | 'constraint-assignment-mismatch'
  | 'modifier-inspects-target-or-descendant';

export type EvidenceShapeDetail = 'unknown-variable' | 'unknown-value' | 'duplicate-binding' | 'contradictory-binding';

export type ConditioningRefusal =
  | {
      readonly kind: 'InferenceBudgetExceeded';
      readonly reason: 'state-space' | 'treewidth' | 'step-budget';
      readonly limit: number;
      readonly observed: number;
      readonly receipt: RefusalReceipt;
    }
  | {
      readonly kind: 'NoSupport';
      readonly targetId: VariableId;
      readonly scope: readonly VariableId[];
      readonly evidenceIds: readonly string[];
      readonly constraintFactorIds: readonly string[];
      readonly eliminatedAssignments: readonly CanonicalAssignmentKey[];
      readonly supportCount: 0;
      readonly receipt: RefusalReceipt;
    }
  | {
      readonly kind: 'InconsistentEvidence';
      readonly scope: readonly VariableId[];
      readonly conflictingEvidenceIds: readonly string[];
      readonly witnessAssignments: readonly CanonicalAssignmentKey[];
      readonly supportCount: 0;
      readonly receipt: RefusalReceipt;
    }
  | {
      readonly kind: 'OntologyCycle';
      readonly cycle: readonly string[];
      readonly receipt: RefusalReceipt;
    }
  | {
      readonly kind: 'AuthoredModelCycle';
      readonly cycle: readonly VariableId[];
      readonly receipt: RefusalReceipt;
    }
  | {
      readonly kind: 'FeasibilityUndetermined';
      readonly invocationId: string;
      readonly receipt: RefusalReceipt;
    }
  | {
      readonly kind: 'ForwardSamplingUnavailable';
      readonly reason: string;
      readonly receipt: RefusalReceipt;
    }
  | {
      readonly kind: 'UnsupportedApproximation';
      readonly reason: string;
      readonly receipt: RefusalReceipt;
    }
  | {
      readonly kind: 'DomainSizeExceeded';
      readonly variableId: VariableId;
      readonly limit: number;
      readonly observed: number;
      readonly receipt: RefusalReceipt;
    }
  | {
      readonly kind: 'VariableCountExceeded';
      readonly limit: number;
      readonly observed: number;
      readonly receipt: RefusalReceipt;
    }
  | {
      readonly kind: 'FactorCountExceeded';
      readonly limit: number;
      readonly observed: number;
      readonly receipt: RefusalReceipt;
    }
  | {
      readonly kind: 'BoundsConfigurationInvalid';
      readonly bound: keyof ConditioningBounds;
      readonly requested: number;
      readonly hardCap: number;
      readonly receipt: RefusalReceipt;
    }
  | {
      readonly kind: 'InvalidModel';
      readonly detail: InvalidModelDetail;
      readonly path?: string;
      readonly receipt: RefusalReceipt;
    }
  | {
      readonly kind: 'EvidenceShapeInvalid';
      readonly detail: EvidenceShapeDetail;
      readonly evidenceId?: string;
      readonly receipt: RefusalReceipt;
    }
  | {
      readonly kind: 'ContinuousDomainUnsupported';
      readonly variableId: VariableId;
      readonly receipt: RefusalReceipt;
    };

export type ConditioningResult<T, TReceipt> =
  | { readonly ok: true; readonly value: T; readonly receipt: TReceipt }
  | { readonly ok: false; readonly error: ConditioningRefusal };

export type CompilationResult = ConditioningResult<CompiledConditioningModel, CompilationReceipt>;

export interface PosteriorResult {
  readonly targetId: VariableId;
  readonly posterior: Readonly<Record<string, number>>;
}

export type InferenceResult = ConditioningResult<PosteriorResult, InferenceReceipt>;

export interface SampleResult {
  readonly assignment: Assignment;
}

export type SamplingResult = ConditioningResult<SampleResult, SamplingReceipt>;
