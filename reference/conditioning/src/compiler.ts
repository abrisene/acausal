import {
  assignmentCardinality,
  assignmentMatches,
  assignments,
  compareCodeUnits,
  encodeAssignment,
  fingerprint,
  logSumExp,
} from './canonical';
import {
  ALGORITHM_REVISION,
  COMPILER_REVISION,
  DEFAULT_BOUNDS,
  HARD_CAPS,
  NUMERIC_RUNTIME_REVISION,
} from './constants';
import type {
  Assignment,
  CompiledConditioningModel,
  CompiledFactor,
  ConditionalWeightRow,
  ConditioningModel,
  EvidenceRecord,
  FeasibilityDecision,
  Predicate,
  TypedVariable,
  VariableId,
} from './model';
import { ConditioningRefusalSignal, nextRunId, refusalReceipt, signal } from './refusals';
import type {
  CompilationReceipt,
  CompilationResult,
  ConditioningBounds,
  ConditioningRefusal,
  ReceiptCore,
} from './types';

interface MutableTable {
  id: string;
  targetId: VariableId;
  parentScope: VariableId[];
  rows: ConditionalWeightRow[];
}

interface CompileTrace {
  appliedRules: string[];
  rejectedRules: Array<{ id: string; reason: string }>;
  overlaysApplied: string[];
  factorBindings: Array<{
    ruleId: string;
    factorId: string;
    scope: readonly string[];
  }>;
  maximumSourceFactorSupport: number;
}

export function compileConditioningModel(
  model: ConditioningModel,
  boundsOverride: Partial<ConditioningBounds> = {}
): CompilationResult {
  try {
    const bounds = resolveConditioningBounds(boundsOverride);
    const trace: CompileTrace = {
      appliedRules: [],
      rejectedRules: [],
      overlaysApplied: [],
      factorBindings: [],
      maximumSourceFactorSupport: 0,
    };
    const variables = validateVariables(model.variables, bounds);
    const domains = new Map(variables.map(variable => [variable.id, variable.domain] as const));
    const ancestryPath = validateOntology(model.ontologyEdges ?? [], bounds);
    const { tables, eligibilityRules, overlayResolutionPath } = materializeLayers(model, trace, bounds);

    validateTables(tables, variables, domains, bounds);
    const variableOrder = topologicalOrder(variables, tables, bounds);
    validateModifierDependencies(tables, variables, bounds);

    const evidence = canonicalEvidence(model.evidence ?? [], bounds);
    const feasibilityDecisions = canonicalFeasibility(model.feasibilityDecisions ?? [], bounds);
    validateConstraintInputs(eligibilityRules, feasibilityDecisions, domains, bounds);
    for (const decision of feasibilityDecisions) {
      if (decision.status === 'unknown') {
        signal({
          kind: 'FeasibilityUndetermined',
          invocationId: decision.invocationId,
          receipt: refusalReceipt({ stage: 'compilation', bounds }),
        });
      }
    }

    const activeEligibilityRules = eligibilityRules
      .slice()
      .sort((left, right) => compareCodeUnits(left.id, right.id))
      .filter(rule => evaluatePredicate(rule.when, {}, evidenceMap(evidence), {}));
    const infeasibleDecisions = feasibilityDecisions.filter(decision => decision.status === 'infeasible');
    const prospectiveFactorCount = tables.length + activeEligibilityRules.length + infeasibleDecisions.length;
    if (prospectiveFactorCount > bounds.maxFactors) {
      signal({
        kind: 'FactorCountExceeded',
        limit: bounds.maxFactors,
        observed: prospectiveFactorCount,
        receipt: refusalReceipt({
          stage: 'plan-construction',
          bounds,
          limit: bounds.maxFactors,
          observed: prospectiveFactorCount,
        }),
      });
    }

    const probabilityFactors = tables
      .slice()
      .sort((left, right) => compareCodeUnits(left.id, right.id))
      .map(table => compileProbabilityFactor(table, evidence, domains, bounds, trace));
    const eligibilityFactors = activeEligibilityRules.map(rule =>
      compileConstraintFactor(
        `eligibility:${rule.id}`,
        rule.scope,
        domains,
        assignment =>
          rule.mode === 'hard-exclude'
            ? !assignmentMatches(assignment, rule.assignment)
            : assignmentMatches(assignment, rule.assignment),
        [rule.id],
        bounds,
        trace
      )
    );
    const feasibilityFactors = infeasibleDecisions.map(decision => {
      const scope = Object.keys(decision.assignment).sort(compareCodeUnits);
      return compileConstraintFactor(
        `feasibility:${decision.invocationId}`,
        scope,
        domains,
        assignment => !assignmentMatches(assignment, decision.assignment),
        [decision.invocationId],
        bounds,
        trace
      );
    });

    const factors = [...probabilityFactors, ...eligibilityFactors, ...feasibilityFactors];
    if (factors.length > bounds.maxFactors) {
      signal({
        kind: 'FactorCountExceeded',
        limit: bounds.maxFactors,
        observed: factors.length,
        receipt: refusalReceipt({
          stage: 'compilation',
          bounds,
          limit: bounds.maxFactors,
          observed: factors.length,
          factorsCompiled: factors.length,
        }),
      });
    }

    const modelFingerprint = fingerprint({
      id: model.id,
      revision: model.revision,
      sourceSnapshotId: model.sourceSnapshotId,
      variables,
      ontologyEdges: [...(model.ontologyEdges ?? [])].sort(
        (left, right) =>
          compareCodeUnits(left.parentId, right.parentId) || compareCodeUnits(left.childId, right.childId)
      ),
      overlayResolutionPath,
      tables: canonicalTables(tables),
      eligibilityRules: [...eligibilityRules].sort((left, right) => compareCodeUnits(left.id, right.id)),
    });
    const evidenceFingerprint = fingerprint(evidence);
    const artifactBody = {
      modelId: model.id,
      modelRevision: model.revision,
      sourceSnapshotId: model.sourceSnapshotId,
      modelFingerprint,
      evidenceFingerprint,
      variables,
      variableOrder,
      factors,
      feasibilityDecisions,
      overlayResolutionPath,
      ancestryPath,
      appliedRules: [...new Set(trace.appliedRules)].sort(compareCodeUnits),
      rejectedRules: trace.rejectedRules
        .slice()
        .sort((left, right) => compareCodeUnits(left.id, right.id) || compareCodeUnits(left.reason, right.reason)),
      modifierOrder: [
        ...new Set(tables.flatMap(table => table.rows.flatMap(row => row.modifiers.map(item => item.id)))),
      ].sort(compareCodeUnits),
      factorBindings: trace.factorBindings
        .slice()
        .sort(
          (left, right) =>
            compareCodeUnits(left.factorId, right.factorId) || compareCodeUnits(left.ruleId, right.ruleId)
        ),
    };
    const compiledArtifactFingerprint = fingerprint(artifactBody);
    const probabilityFactorByTarget = Object.fromEntries(tables.map(table => [table.targetId, `table:${table.id}`]));
    const compiled: CompiledConditioningModel = {
      ...artifactBody,
      compiledArtifactFingerprint,
      probabilityFactorByTarget,
      evidence,
    };
    const core = buildReceiptCore(compiled, trace);
    const receipt: CompilationReceipt = {
      kind: 'compilation',
      core,
      compiledArtifactFingerprint,
      variableOrder,
      factorIds: factors.map(factor => factor.id),
      constraintFactorIds: factors.filter(factor => factor.kind === 'constraint').map(factor => factor.id),
      boundsInEffect: bounds,
      maximumSourceFactorSupport: trace.maximumSourceFactorSupport,
    };
    return { ok: true, value: compiled, receipt };
  } catch (error) {
    if (error instanceof ConditioningRefusalSignal) {
      return { ok: false, error: error.refusal };
    }
    throw error;
  }
}

export function buildReceiptCore(compiled: CompiledConditioningModel, trace?: Partial<CompileTrace>): ReceiptCore {
  return {
    runId: nextRunId(),
    compilerRevision: COMPILER_REVISION,
    algorithmRevision: ALGORITHM_REVISION,
    numericRuntimeRevision: NUMERIC_RUNTIME_REVISION,
    modelFingerprint: compiled.modelFingerprint,
    evidenceFingerprint: compiled.evidenceFingerprint,
    sourceSnapshotId: compiled.sourceSnapshotId,
    overlayResolutionPath: compiled.overlayResolutionPath,
    ancestryPath: compiled.ancestryPath,
    appliedRules: trace?.appliedRules ?? compiled.appliedRules,
    rejectedRules: trace?.rejectedRules ?? compiled.rejectedRules,
    selectedEvidenceIds: compiled.evidence.map(item => item.id),
    feasibilityDecisions: compiled.feasibilityDecisions.map(decision => ({
      invocationId: decision.invocationId,
      resolverRevision: decision.resolverRevision,
      requestFingerprint: decision.requestFingerprint,
      status: decision.status,
      conflictOrigins: decision.conflictOrigins,
    })),
    overlaysApplied: trace?.overlaysApplied ?? compiled.overlayResolutionPath,
    factorBindings: trace?.factorBindings ?? compiled.factorBindings,
  };
}

export function resolveConditioningBounds(override: Partial<ConditioningBounds>): ConditioningBounds {
  const bounds = { ...DEFAULT_BOUNDS, ...override };
  for (const key of Object.keys(HARD_CAPS) as Array<keyof ConditioningBounds>) {
    const requested = bounds[key];
    const hardCap = HARD_CAPS[key];
    if (!Number.isInteger(requested) || requested <= 0 || requested > hardCap) {
      const safeBounds = { ...DEFAULT_BOUNDS };
      const refusal: ConditioningRefusal = {
        kind: 'BoundsConfigurationInvalid',
        bound: key,
        requested,
        hardCap,
        receipt: refusalReceipt({
          stage: 'configuration',
          bounds: safeBounds,
          limit: hardCap,
          observed: requested,
        }),
      };
      signal(refusal);
    }
  }
  return bounds;
}

function validateVariables(source: readonly TypedVariable[], bounds: ConditioningBounds): readonly TypedVariable[] {
  if (source.length > bounds.maxVariables) {
    signal({
      kind: 'VariableCountExceeded',
      limit: bounds.maxVariables,
      observed: source.length,
      receipt: refusalReceipt({
        stage: 'model-validation',
        bounds,
        limit: bounds.maxVariables,
        observed: source.length,
      }),
    });
  }
  const seen = new Set<string>();
  const variables = source.slice().sort((left, right) => compareCodeUnits(left.id, right.id));
  for (const variable of variables) {
    if (seen.has(variable.id)) {
      invalidModel('duplicate-variable-id', `variables.${variable.id}`, bounds);
    }
    seen.add(variable.id);
    if (variable.domain.length === 0) {
      invalidModel('empty-domain', `variables.${variable.id}.domain`, bounds);
    }
    if (new Set(variable.domain).size !== variable.domain.length) {
      invalidModel('duplicate-domain-value', `variables.${variable.id}.domain`, bounds);
    }
    if (variable.domain.length > bounds.maxDomainSize) {
      signal({
        kind: 'DomainSizeExceeded',
        variableId: variable.id,
        limit: bounds.maxDomainSize,
        observed: variable.domain.length,
        receipt: refusalReceipt({
          stage: 'model-validation',
          bounds,
          limit: bounds.maxDomainSize,
          observed: variable.domain.length,
        }),
      });
    }
  }
  return variables;
}

function validateOntology(
  edges: readonly { parentId: string; childId: string }[],
  bounds: ConditioningBounds
): readonly string[] {
  const nodes = [...new Set(edges.flatMap(edge => [edge.parentId, edge.childId]))].sort(compareCodeUnits);
  const adjacency = new Map(nodes.map(node => [node, [] as string[]]));
  for (const edge of edges) adjacency.get(edge.parentId)?.push(edge.childId);
  const cycle = findCycle(nodes, adjacency);
  if (cycle) {
    signal({
      kind: 'OntologyCycle',
      cycle,
      receipt: refusalReceipt({ stage: 'model-validation', bounds }),
    });
  }
  return nodes;
}

function materializeLayers(
  model: ConditioningModel,
  trace: CompileTrace,
  bounds: ConditioningBounds
): {
  tables: MutableTable[];
  eligibilityRules: EligibilityRuleLike[];
  overlayResolutionPath: string[];
} {
  const tables: MutableTable[] = model.tables.map(table => ({
    id: table.id,
    targetId: table.targetId,
    parentScope: [...table.parentScope],
    rows: table.rows.map(row => ({ ...row, modifiers: [...row.modifiers] })),
  }));
  const tableById = new Map(tables.map(table => [table.id, table]));
  const eligibility = [...(model.eligibilityRules ?? [])];
  const overlays = [...(model.overlays ?? [])].sort(
    (left, right) => left.precedence - right.precedence || compareCodeUnits(left.id, right.id)
  );
  const overlayIds = new Set<string>();
  for (const overlay of overlays) {
    if (overlayIds.has(overlay.id)) {
      invalidModel('duplicate-rule-id', `overlays.${overlay.id}`, bounds);
    }
    overlayIds.add(overlay.id);
    trace.overlaysApplied.push(overlay.id);
    for (const replacement of overlay.rowReplacements) {
      const table = tableById.get(replacement.tableId);
      if (!table) {
        invalidModel('unknown-variable', `overlays.${overlay.id}.rowReplacements.${replacement.tableId}`, bounds);
      }
      const index = table.rows.findIndex(row => row.id === replacement.row.id);
      if (index === -1) {
        invalidModel('duplicate-rule-id', `overlays.${overlay.id}.rowReplacements.${replacement.row.id}`, bounds);
      }
      trace.rejectedRules.push({
        id: table.rows[index].id,
        reason: `replaced-by:${overlay.id}`,
      });
      table.rows[index] = {
        ...replacement.row,
        modifiers: [...replacement.row.modifiers],
      };
      trace.appliedRules.push(replacement.row.id);
    }
    for (const addition of overlay.modifierAdditions) {
      const table = tableById.get(addition.tableId);
      if (!table) {
        invalidModel('unknown-variable', `overlays.${overlay.id}.modifierAdditions.${addition.tableId}`, bounds);
      }
      const row = table.rows.find(candidate => candidate.id === addition.rowId);
      if (!row) {
        invalidModel('duplicate-rule-id', `overlays.${overlay.id}.modifierAdditions.${addition.modifier.id}`, bounds);
      }
      if (row.modifiers.some(item => item.id === addition.modifier.id)) {
        invalidModel('duplicate-rule-id', `modifiers.${addition.modifier.id}`, bounds);
      }
      const rowIndex = table.rows.indexOf(row);
      table.rows[rowIndex] = {
        ...row,
        modifiers: [...row.modifiers, addition.modifier],
      };
      trace.appliedRules.push(addition.modifier.id);
    }
    eligibility.push(...overlay.eligibilityRules);
  }
  return {
    tables,
    eligibilityRules: eligibility,
    overlayResolutionPath: overlays.map(overlay => overlay.id),
  };
}

type EligibilityRuleLike = NonNullable<ConditioningModel['eligibilityRules']>[number];

function validateTables(
  tables: readonly MutableTable[],
  variables: readonly TypedVariable[],
  domains: ReadonlyMap<VariableId, readonly string[]>,
  bounds: ConditioningBounds
): void {
  const variableById = new Map(variables.map(variable => [variable.id, variable]));
  const tableIds = new Set<string>();
  const targets = new Set<string>();
  const rowIds = new Set<string>();
  for (const table of tables) {
    if (tableIds.has(table.id)) {
      invalidModel('duplicate-table-id', `tables.${table.id}`, bounds);
    }
    tableIds.add(table.id);
    if (targets.has(table.targetId)) {
      invalidModel('duplicate-table-id', `target.${table.targetId}`, bounds);
    }
    targets.add(table.targetId);
    const target = variableById.get(table.targetId);
    if (!target) invalidModel('unknown-variable', table.targetId, bounds);
    for (const parentId of table.parentScope) {
      if (!variableById.has(parentId)) {
        invalidModel('unknown-variable', parentId, bounds);
      }
    }
    const support = assignmentCardinality([...table.parentScope, table.targetId], domains, bounds.maxJointSupport);
    if (support > bounds.maxJointSupport) {
      inferenceBudget('state-space', bounds.maxJointSupport, support, 'model-validation', bounds);
    }
    const expectedParentAssignments = assignments(table.parentScope, domains);
    const expectedKeys = new Set(
      expectedParentAssignments.map(assignment => encodeAssignment(table.parentScope, assignment))
    );
    const actualKeys = new Set<string>();
    for (const row of table.rows) {
      if (rowIds.has(row.id)) {
        invalidModel('duplicate-row-id', `rows.${row.id}`, bounds);
      }
      rowIds.add(row.id);
      if (row.targetId !== table.targetId || !sameArray(row.parentScope, table.parentScope)) {
        invalidModel('parent-assignment-mismatch', `rows.${row.id}`, bounds);
      }
      const parentKey = encodeAssignment(table.parentScope, row.parentAssignment);
      if (!expectedKeys.has(parentKey) || actualKeys.has(parentKey)) {
        invalidModel('incomplete-table', `rows.${row.id}`, bounds);
      }
      actualKeys.add(parentKey);
      const outcomes = new Set<string>();
      for (const weight of row.outcomeWeights) {
        if (outcomes.has(weight.outcome)) {
          invalidModel('duplicate-outcome', `rows.${row.id}`, bounds);
        }
        outcomes.add(weight.outcome);
        if (!target.domain.includes(weight.outcome)) {
          invalidModel('unknown-outcome', `rows.${row.id}`, bounds);
        }
        if (!Number.isFinite(weight.baseWeight) || weight.baseWeight <= 0) {
          invalidModel('non-positive-weight', `rows.${row.id}`, bounds);
        }
      }
      if (outcomes.size !== target.domain.length) {
        invalidModel('incomplete-table', `rows.${row.id}`, bounds);
      }
      const modifierIds = new Set<string>();
      for (const modifier of row.modifiers) {
        if (modifierIds.has(modifier.id)) {
          invalidModel('duplicate-rule-id', `modifiers.${modifier.id}`, bounds);
        }
        modifierIds.add(modifier.id);
        if (!target.domain.includes(modifier.outcome)) {
          invalidModel('unknown-outcome', `modifiers.${modifier.id}`, bounds);
        }
        if (!Number.isFinite(modifier.multiplyBy) || modifier.multiplyBy <= 0) {
          invalidModel('non-positive-modifier', `modifiers.${modifier.id}`, bounds);
        }
      }
    }
    if (actualKeys.size !== expectedKeys.size) {
      invalidModel('incomplete-table', `tables.${table.id}`, bounds);
    }
  }
  for (const variable of variables) {
    if (!targets.has(variable.id) && variable.kind !== 'derived') {
      invalidModel('incomplete-table', `target.${variable.id}`, bounds);
    }
  }
}

function topologicalOrder(
  variables: readonly TypedVariable[],
  tables: readonly MutableTable[],
  bounds: ConditioningBounds
): readonly VariableId[] {
  const nodes = variables.map(variable => variable.id).sort(compareCodeUnits);
  const adjacency = new Map(nodes.map(node => [node, [] as string[]]));
  const incoming = new Map(nodes.map(node => [node, 0]));
  for (const table of tables) {
    for (const parentId of table.parentScope) {
      adjacency.get(parentId)?.push(table.targetId);
      incoming.set(table.targetId, (incoming.get(table.targetId) ?? 0) + 1);
    }
  }
  const cycle = findCycle(nodes, adjacency);
  if (cycle) {
    signal({
      kind: 'AuthoredModelCycle',
      cycle,
      receipt: refusalReceipt({ stage: 'model-validation', bounds }),
    });
  }
  const ready = nodes.filter(node => incoming.get(node) === 0).sort(compareCodeUnits);
  const order: string[] = [];
  while (ready.length > 0) {
    const node = ready.shift() as string;
    order.push(node);
    for (const child of (adjacency.get(node) ?? []).sort(compareCodeUnits)) {
      const count = (incoming.get(child) ?? 0) - 1;
      incoming.set(child, count);
      if (count === 0) {
        ready.push(child);
        ready.sort(compareCodeUnits);
      }
    }
  }
  return order;
}

function compileProbabilityFactor(
  table: MutableTable,
  evidence: readonly EvidenceRecord[],
  domains: ReadonlyMap<VariableId, readonly string[]>,
  bounds: ConditioningBounds,
  trace: CompileTrace
): CompiledFactor {
  const scope = [...table.parentScope, table.targetId];
  const support = assignmentCardinality(scope, domains, bounds.maxJointSupport);
  if (support > bounds.maxJointSupport) {
    inferenceBudget('state-space', bounds.maxJointSupport, support, 'compilation', bounds);
  }
  trace.maximumSourceFactorSupport = Math.max(trace.maximumSourceFactorSupport, support);
  const evidenceValues = evidenceMap(evidence);
  const rows = [];
  for (const row of table.rows.slice().sort((left, right) => compareCodeUnits(left.id, right.id))) {
    const logWeights = new Map<string, number>();
    for (const weight of row.outcomeWeights
      .slice()
      .sort((left, right) => compareCodeUnits(left.outcome, right.outcome))) {
      let logWeight = Math.log(weight.baseWeight);
      for (const modifier of row.modifiers
        .filter(item => item.outcome === weight.outcome)
        .sort((left, right) => compareCodeUnits(left.id, right.id))) {
        if (evaluatePredicate(modifier.when, row.parentAssignment, evidenceValues, {})) {
          logWeight += Math.log(modifier.multiplyBy);
          trace.appliedRules.push(modifier.id);
        } else {
          trace.rejectedRules.push({
            id: modifier.id,
            reason: 'predicate-false',
          });
        }
      }
      logWeights.set(weight.outcome, logWeight);
    }
    const normalizer = logSumExp([...logWeights.values()]);
    for (const outcome of [...logWeights.keys()].sort(compareCodeUnits)) {
      const assignment = {
        ...row.parentAssignment,
        [table.targetId]: outcome,
      };
      rows.push({
        assignment: encodeAssignment(scope, assignment),
        logPotential: (logWeights.get(outcome) as number) - normalizer,
        sourceRowIds: [row.id],
      });
    }
  }
  const factorId = `table:${table.id}`;
  for (const row of table.rows) {
    trace.factorBindings.push({
      ruleId: row.id,
      factorId,
      scope,
    });
  }
  return { id: factorId, scope, rows, kind: 'probability' };
}

function compileConstraintFactor(
  id: string,
  scope: readonly VariableId[],
  domains: ReadonlyMap<VariableId, readonly string[]>,
  permits: (assignment: Assignment) => boolean,
  sourceRowIds: readonly string[],
  bounds: ConditioningBounds,
  trace: CompileTrace
): CompiledFactor {
  const support = assignmentCardinality(scope, domains, bounds.maxJointSupport);
  if (support > bounds.maxJointSupport) {
    inferenceBudget('state-space', bounds.maxJointSupport, support, 'compilation', bounds);
  }
  trace.maximumSourceFactorSupport = Math.max(trace.maximumSourceFactorSupport, support);
  const rows = assignments(scope, domains).map(assignment => ({
    assignment: encodeAssignment(scope, assignment),
    logPotential: permits(assignment) ? 0 : Number.NEGATIVE_INFINITY,
    sourceRowIds,
  }));
  for (const ruleId of sourceRowIds) {
    trace.factorBindings.push({ ruleId, factorId: id, scope });
  }
  return { id, scope, rows, kind: 'constraint' };
}

function canonicalEvidence(evidence: readonly EvidenceRecord[], bounds: ConditioningBounds): readonly EvidenceRecord[] {
  const seen = new Set<string>();
  return evidence
    .slice()
    .sort((left, right) => compareCodeUnits(left.id, right.id))
    .map(item => {
      if (seen.has(item.id)) {
        signal({
          kind: 'EvidenceShapeInvalid',
          detail: 'duplicate-binding',
          evidenceId: item.id,
          receipt: refusalReceipt({ stage: 'model-validation', bounds }),
        });
      }
      seen.add(item.id);
      return {
        ...item,
        refs: [...item.refs].sort(compareCodeUnits),
      };
    });
}

function canonicalTables(tables: readonly MutableTable[]): readonly MutableTable[] {
  return tables
    .map(table => ({
      ...table,
      parentScope: [...table.parentScope],
      rows: table.rows
        .map(row => ({
          ...row,
          outcomeWeights: [...row.outcomeWeights].sort((left, right) => compareCodeUnits(left.outcome, right.outcome)),
          modifiers: [...row.modifiers].sort((left, right) => compareCodeUnits(left.id, right.id)),
          sourceRefs: [...row.sourceRefs].sort(compareCodeUnits),
        }))
        .sort((left, right) => compareCodeUnits(left.id, right.id)),
    }))
    .sort((left, right) => compareCodeUnits(left.id, right.id));
}

function validateModifierDependencies(
  tables: readonly MutableTable[],
  variables: readonly TypedVariable[],
  bounds: ConditioningBounds
): void {
  const adjacency = new Map(variables.map(variable => [variable.id, [] as string[]]));
  for (const table of tables) {
    for (const parentId of table.parentScope) {
      adjacency.get(parentId)?.push(table.targetId);
    }
  }
  for (const table of tables) {
    const forbidden = new Set<string>([table.targetId]);
    const queue = [...(adjacency.get(table.targetId) ?? [])];
    while (queue.length > 0) {
      const current = queue.shift() as string;
      if (forbidden.has(current)) continue;
      forbidden.add(current);
      queue.push(...(adjacency.get(current) ?? []));
    }
    for (const row of table.rows) {
      for (const modifier of row.modifiers) {
        const references = predicateVariableReferences(modifier.when);
        if (references.some(reference => forbidden.has(reference))) {
          invalidModel('modifier-inspects-target-or-descendant', `modifiers.${modifier.id}`, bounds);
        }
      }
    }
  }
}

function predicateVariableReferences(predicate: Predicate): readonly string[] {
  switch (predicate.op) {
    case 'all':
    case 'any':
      return predicate.args.flatMap(predicateVariableReferences);
    case 'not':
      return predicateVariableReferences(predicate.arg);
    case 'eq':
      return [predicate.left, predicate.right].flatMap(predicateTokenReference);
    case 'in':
      return predicateTokenReference(predicate.value);
    case 'evidence':
    case 'derived':
      return [];
  }
}

function predicateTokenReference(token: string): readonly string[] {
  if (token.startsWith('parent:')) return [token.slice(7)];
  if (token.startsWith('derived:')) return [token.slice(8)];
  return [];
}

function canonicalFeasibility(
  decisions: readonly FeasibilityDecision[],
  bounds: ConditioningBounds
): readonly FeasibilityDecision[] {
  const seen = new Set<string>();
  return decisions
    .slice()
    .sort((left, right) => compareCodeUnits(left.invocationId, right.invocationId))
    .map(decision => {
      if (seen.has(decision.invocationId)) {
        invalidModel('duplicate-rule-id', `feasibility.${decision.invocationId}`, bounds);
      }
      seen.add(decision.invocationId);
      return {
        ...decision,
        conflictOrigins: [...decision.conflictOrigins].sort(compareCodeUnits),
      };
    });
}

function validateConstraintInputs(
  eligibilityRules: readonly EligibilityRuleLike[],
  feasibilityDecisions: readonly FeasibilityDecision[],
  domains: ReadonlyMap<VariableId, readonly string[]>,
  bounds: ConditioningBounds
): void {
  const ruleIds = new Set<string>();
  for (const rule of eligibilityRules) {
    if (ruleIds.has(rule.id)) {
      invalidModel('duplicate-rule-id', `eligibility.${rule.id}`, bounds);
    }
    ruleIds.add(rule.id);
    validateConstraintAssignment(rule.scope, rule.assignment, domains, `eligibility.${rule.id}`, bounds);
  }
  for (const decision of feasibilityDecisions) {
    const scope = Object.keys(decision.assignment).sort(compareCodeUnits);
    validateConstraintAssignment(scope, decision.assignment, domains, `feasibility.${decision.invocationId}`, bounds);
  }
}

function validateConstraintAssignment(
  scope: readonly VariableId[],
  assignment: Assignment,
  domains: ReadonlyMap<VariableId, readonly string[]>,
  path: string,
  bounds: ConditioningBounds
): void {
  const uniqueScope = [...new Set(scope)];
  const assignmentVariables = Object.keys(assignment).sort(compareCodeUnits);
  const canonicalScope = uniqueScope.slice().sort(compareCodeUnits);
  if (uniqueScope.length !== scope.length || !sameArray(canonicalScope, assignmentVariables)) {
    invalidModel('constraint-assignment-mismatch', path, bounds);
  }
  for (const variableId of canonicalScope) {
    const domain = domains.get(variableId);
    if (!domain) {
      invalidModel('unknown-variable', `${path}.${variableId}`, bounds);
    }
    if (!domain.includes(assignment[variableId])) {
      invalidModel('unknown-outcome', `${path}.${variableId}`, bounds);
    }
  }
}

function evidenceMap(evidence: readonly EvidenceRecord[]): Readonly<Record<string, unknown>> {
  return Object.fromEntries(evidence.map(item => [item.id, item.payload]));
}

function evaluatePredicate(
  predicate: Predicate,
  parent: Assignment,
  evidence: Readonly<Record<string, unknown>>,
  derived: Readonly<Record<string, unknown>>
): boolean {
  switch (predicate.op) {
    case 'all':
      return predicate.args.every(item => evaluatePredicate(item, parent, evidence, derived));
    case 'any':
      return predicate.args.some(item => evaluatePredicate(item, parent, evidence, derived));
    case 'not':
      return !evaluatePredicate(predicate.arg, parent, evidence, derived);
    case 'eq':
      return (
        resolvePredicateValue(predicate.left, parent, evidence, derived) ===
        resolvePredicateValue(predicate.right, parent, evidence, derived)
      );
    case 'in':
      return predicate.set.includes(String(resolvePredicateValue(predicate.value, parent, evidence, derived)));
    case 'evidence':
      return Object.is(evidence[predicate.key], predicate.expected);
    case 'derived':
      return Object.is(derived[predicate.key], predicate.expected);
  }
}

function resolvePredicateValue(
  value: string,
  parent: Assignment,
  evidence: Readonly<Record<string, unknown>>,
  derived: Readonly<Record<string, unknown>>
): unknown {
  if (value.startsWith('parent:')) return parent[value.slice(7)];
  if (value.startsWith('evidence:')) return evidence[value.slice(9)];
  if (value.startsWith('derived:')) return derived[value.slice(8)];
  return value;
}

function findCycle(
  nodes: readonly string[],
  adjacency: ReadonlyMap<string, readonly string[]>
): readonly string[] | undefined {
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const path: string[] = [];
  const visit = (node: string): readonly string[] | undefined => {
    if (visiting.has(node)) {
      const start = path.indexOf(node);
      return [...path.slice(start), node];
    }
    if (visited.has(node)) return undefined;
    visiting.add(node);
    path.push(node);
    for (const child of adjacency.get(node) ?? []) {
      const cycle = visit(child);
      if (cycle) return cycle;
    }
    path.pop();
    visiting.delete(node);
    visited.add(node);
    return undefined;
  };
  for (const node of nodes) {
    const cycle = visit(node);
    if (cycle) return cycle;
  }
  return undefined;
}

function sameArray(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function invalidModel(
  detail: Extract<ConditioningRefusal, { kind: 'InvalidModel' }>['detail'],
  path: string,
  bounds: ConditioningBounds
): never {
  signal({
    kind: 'InvalidModel',
    detail,
    path,
    receipt: refusalReceipt({ stage: 'model-validation', bounds }),
  });
}

function inferenceBudget(
  reason: Extract<ConditioningRefusal, { kind: 'InferenceBudgetExceeded' }>['reason'],
  limit: number,
  observed: number,
  stage: 'model-validation' | 'compilation',
  bounds: ConditioningBounds
): never {
  signal({
    kind: 'InferenceBudgetExceeded',
    reason,
    limit,
    observed,
    receipt: refusalReceipt({ stage, bounds, limit, observed }),
  });
}
