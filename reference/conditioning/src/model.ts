export type VariableId = string;
export type CanonicalAssignmentKey = string;
export type Assignment = Readonly<Record<VariableId, string>>;

export type VariableKind = 'discrete' | 'categorical' | 'eligibility' | 'derived';

export interface TypedVariable {
  readonly id: VariableId;
  readonly kind: VariableKind;
  readonly domain: readonly string[];
  readonly description?: string;
  readonly sourceRefs: readonly string[];
}

export type Predicate =
  | { readonly op: 'all'; readonly args: readonly Predicate[] }
  | { readonly op: 'any'; readonly args: readonly Predicate[] }
  | { readonly op: 'not'; readonly arg: Predicate }
  | { readonly op: 'eq'; readonly left: string; readonly right: string }
  | {
      readonly op: 'in';
      readonly value: string;
      readonly set: readonly string[];
    }
  | {
      readonly op: 'evidence';
      readonly key: string;
      readonly expected: unknown;
    }
  | {
      readonly op: 'derived';
      readonly key: string;
      readonly expected: unknown;
    };

export interface OutcomeWeight {
  readonly outcome: string;
  readonly baseWeight: number;
}

export interface MultiplicativeModifier {
  readonly id: string;
  readonly outcome: string;
  readonly when: Predicate;
  readonly multiplyBy: number;
}

export interface ConditionalWeightRow {
  readonly id: string;
  readonly targetId: VariableId;
  readonly parentScope: readonly VariableId[];
  readonly parentAssignment: Assignment;
  readonly outcomeWeights: readonly OutcomeWeight[];
  readonly modifiers: readonly MultiplicativeModifier[];
  readonly sourceRefs: readonly string[];
}

export interface ConditionalTable {
  readonly id: string;
  readonly targetId: VariableId;
  readonly parentScope: readonly VariableId[];
  readonly rows: readonly ConditionalWeightRow[];
}

export interface OntologyEdge {
  readonly parentId: string;
  readonly childId: string;
}

export interface OverlayRowReplacement {
  readonly tableId: string;
  readonly row: ConditionalWeightRow;
}

export interface OverlayModifierAddition {
  readonly tableId: string;
  readonly rowId: string;
  readonly modifier: MultiplicativeModifier;
}

export interface EligibilityRule {
  readonly id: string;
  readonly scope: readonly VariableId[];
  readonly assignment: Assignment;
  readonly when: Predicate;
  readonly mode: 'hard-exclude' | 'hard-include';
}

export interface OverlayLayer {
  readonly id: string;
  readonly precedence: number;
  readonly sourceSnapshotId: string;
  readonly appliesTo: readonly string[];
  readonly rowReplacements: readonly OverlayRowReplacement[];
  readonly modifierAdditions: readonly OverlayModifierAddition[];
  readonly eligibilityRules: readonly EligibilityRule[];
}

export interface EvidenceRecord {
  readonly id: string;
  readonly source: 'admitted' | 'fixture' | 'user-authored' | 'feasibility';
  readonly refs: readonly string[];
  readonly payload: unknown;
}

export interface FeasibilityDecision {
  readonly status: 'feasible' | 'infeasible' | 'unknown';
  readonly invocationId: string;
  readonly resolverRevision: string;
  readonly requestFingerprint: string;
  readonly assignment: Assignment;
  readonly conflictOrigins: readonly string[];
  readonly explanation?: string;
}

export interface ConditioningModel {
  readonly id: string;
  readonly revision: string;
  readonly sourceSnapshotId: string;
  readonly variables: readonly TypedVariable[];
  readonly tables: readonly ConditionalTable[];
  readonly ontologyEdges?: readonly OntologyEdge[];
  readonly overlays?: readonly OverlayLayer[];
  readonly eligibilityRules?: readonly EligibilityRule[];
  readonly evidence?: readonly EvidenceRecord[];
  readonly feasibilityDecisions?: readonly FeasibilityDecision[];
}

export interface ConditioningQuery {
  readonly targetId: VariableId;
  readonly evidence: readonly {
    readonly variableId: VariableId;
    readonly value: string;
  }[];
  readonly mode: 'posterior' | 'forward';
}

export interface CompiledFactorRow {
  readonly assignment: CanonicalAssignmentKey;
  readonly logPotential: number;
  readonly sourceRowIds: readonly string[];
}

export interface CompiledFactor {
  readonly id: string;
  readonly scope: readonly VariableId[];
  readonly rows: readonly CompiledFactorRow[];
  readonly kind: 'probability' | 'constraint';
}

export interface CompiledConditioningModel {
  readonly modelId: string;
  readonly modelRevision: string;
  readonly sourceSnapshotId: string;
  readonly modelFingerprint: string;
  readonly compiledArtifactFingerprint: string;
  readonly evidenceFingerprint: string;
  readonly variables: readonly TypedVariable[];
  readonly variableOrder: readonly VariableId[];
  readonly factors: readonly CompiledFactor[];
  readonly probabilityFactorByTarget: Readonly<Record<VariableId, string>>;
  readonly evidence: readonly EvidenceRecord[];
  readonly feasibilityDecisions: readonly FeasibilityDecision[];
  readonly overlayResolutionPath: readonly string[];
  readonly ancestryPath: readonly string[];
  readonly appliedRules: readonly string[];
  readonly rejectedRules: readonly {
    readonly id: string;
    readonly reason: string;
  }[];
  readonly modifierOrder: readonly string[];
  readonly factorBindings: readonly {
    readonly ruleId: string;
    readonly factorId: string;
    readonly scope: readonly string[];
  }[];
}
