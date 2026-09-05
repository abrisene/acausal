import { assignments, encodeAssignment, logSumExp } from './canonical';
import { ALGORITHM_REVISION, POSTERIOR_METRIC } from './constants';
import { buildReceiptCore, resolveConditioningBounds } from './compiler';
import {
  multiplyFactors,
  planEliminationOrder,
  restrictFactor,
  sumOut,
  toRuntimeFactor,
  type OperationBudget,
} from './factor';
import type { Assignment, CompiledConditioningModel, ConditioningQuery } from './model';
import { ConditioningRefusalSignal, refusalReceipt, signal } from './refusals';
import type { ConditioningBounds, InferenceReceipt, InferenceResult, PosteriorResult } from './types';

export function inferPosterior(
  compiled: CompiledConditioningModel,
  query: ConditioningQuery,
  boundsOverride: Partial<ConditioningBounds> = {}
): InferenceResult {
  try {
    const bounds = resolveConditioningBounds(boundsOverride);
    const evidence = validateQuery(compiled, query, bounds);
    const domains = new Map(compiled.variables.map(variable => [variable.id, variable.domain] as const));
    let factors = compiled.factors.map(toRuntimeFactor).map(factor => restrictFactor(factor, evidence));
    const active = compiled.variableOrder.filter(variableId => evidence[variableId] === undefined);
    const eliminable = active.filter(variableId => variableId !== query.targetId);
    const plan = planEliminationOrder(factors, active, eliminable);
    if (plan.inducedWidth > bounds.maxEliminationWidth) {
      signal({
        kind: 'InferenceBudgetExceeded',
        reason: 'treewidth',
        limit: bounds.maxEliminationWidth,
        observed: plan.inducedWidth,
        receipt: refusalReceipt({
          stage: 'plan-construction',
          bounds,
          compiled,
          limit: bounds.maxEliminationWidth,
          observed: plan.inducedWidth,
        }),
      });
    }
    const budget: OperationBudget = {
      operations: 0,
      maximumJointSupport: 0,
    };
    let eliminationSteps = 0;
    for (const variableId of plan.order) {
      const selected = factors.filter(factor => factor.scope.includes(variableId));
      const retained = factors.filter(factor => !factor.scope.includes(variableId));
      if (selected.length > 0) {
        const product = multiplyFactors(selected, domains, bounds, budget);
        retained.push(sumOut(product, variableId, domains, bounds, budget));
      }
      factors = retained;
      eliminationSteps += 1;
    }
    let resultFactor = multiplyFactors(factors, domains, bounds, budget);
    for (const variableId of resultFactor.scope) {
      if (variableId !== query.targetId) {
        resultFactor = sumOut(resultFactor, variableId, domains, bounds, budget);
      }
    }
    const targetDomain = domains.get(query.targetId);
    if (!targetDomain) {
      return evidenceFailure(compiled, bounds, 'unknown-variable', query.targetId);
    }
    const logByOutcome = new Map(resultFactor.rows.map(row => [row.assignment[query.targetId], row.logPotential]));
    const logPartition = logSumExp(targetDomain.map(outcome => logByOutcome.get(outcome) ?? Number.NEGATIVE_INFINITY));
    if (logPartition === Number.NEGATIVE_INFINITY) {
      signal({
        kind: 'NoSupport',
        targetId: query.targetId,
        scope: resultFactor.scope,
        evidenceIds: query.evidence.map(item => `${item.variableId}=${item.value}`),
        constraintFactorIds: compiled.factors.filter(factor => factor.kind === 'constraint').map(factor => factor.id),
        eliminatedAssignments: [],
        supportCount: 0,
        receipt: refusalReceipt({
          stage: 'inference',
          bounds,
          compiled,
          eliminationSteps,
        }),
      });
    }
    const posterior = Object.fromEntries(
      targetDomain.map(outcome => [
        outcome,
        Math.exp((logByOutcome.get(outcome) ?? Number.NEGATIVE_INFINITY) - logPartition),
      ])
    );
    const value: PosteriorResult = { targetId: query.targetId, posterior };
    const core = {
      ...buildReceiptCore(compiled),
      algorithmRevision: ALGORITHM_REVISION,
    };
    const receipt: InferenceReceipt = {
      kind: 'inference',
      core,
      query,
      posterior: targetDomain.map(outcome => ({
        outcome,
        probability: posterior[outcome],
      })),
      posteriorMetric: POSTERIOR_METRIC,
      eliminationOrder: plan.order,
      inducedWidth: plan.inducedWidth,
      factorsUsed: compiled.factors.map(factor => factor.id),
      constraintFactorsApplied: compiled.factors
        .filter(factor => factor.kind === 'constraint')
        .map(factor => factor.id),
      modifierOrder: compiled.modifierOrder,
      boundsInEffect: bounds,
      budgetObserved: {
        jointSupport: budget.maximumJointSupport,
        operations: budget.operations,
      },
      logPartition,
    };
    return { ok: true, value, receipt };
  } catch (error) {
    if (error instanceof ConditioningRefusalSignal) {
      return { ok: false, error: error.refusal };
    }
    throw error;
  }
}

export function inferByEnumeration(
  compiled: CompiledConditioningModel,
  query: ConditioningQuery
): Readonly<Record<string, number>> {
  const domains = new Map(compiled.variables.map(variable => [variable.id, variable.domain] as const));
  const evidence = Object.fromEntries(query.evidence.map(item => [item.variableId, item.value]));
  const runtimeFactors = compiled.factors.map(toRuntimeFactor);
  const domain = domains.get(query.targetId) ?? [];
  const logTotals = new Map(domain.map(outcome => [outcome, [] as number[]]));
  for (const assignment of assignments(compiled.variableOrder, domains)) {
    if (Object.entries(evidence).some(([variableId, value]) => assignment[variableId] !== value)) {
      continue;
    }
    let logPotential = 0;
    for (const factor of runtimeFactors) {
      const row = factor.rows.find(
        candidate => encodeAssignment(factor.scope, candidate.assignment) === encodeAssignment(factor.scope, assignment)
      );
      logPotential += row?.logPotential ?? Number.NEGATIVE_INFINITY;
    }
    logTotals.get(assignment[query.targetId])?.push(logPotential);
  }
  const outcomeLogs = domain.map(outcome => logSumExp(logTotals.get(outcome) ?? []));
  const partition = logSumExp(outcomeLogs);
  return Object.fromEntries(domain.map((outcome, index) => [outcome, Math.exp(outcomeLogs[index] - partition)]));
}

function validateQuery(
  compiled: CompiledConditioningModel,
  query: ConditioningQuery,
  bounds: ConditioningBounds
): Assignment {
  const variableById = new Map(compiled.variables.map(variable => [variable.id, variable]));
  if (!variableById.has(query.targetId)) {
    return evidenceFailure(compiled, bounds, 'unknown-variable', query.targetId);
  }
  const evidence: Record<string, string> = {};
  for (const item of query.evidence) {
    const variable = variableById.get(item.variableId);
    if (!variable) {
      return evidenceFailure(compiled, bounds, 'unknown-variable', item.variableId);
    }
    if (!variable.domain.includes(item.value)) {
      return evidenceFailure(compiled, bounds, 'unknown-value', item.variableId);
    }
    if (evidence[item.variableId] !== undefined) {
      if (evidence[item.variableId] !== item.value) {
        signal({
          kind: 'InconsistentEvidence',
          scope: [item.variableId],
          conflictingEvidenceIds: [
            `${item.variableId}=${evidence[item.variableId]}`,
            `${item.variableId}=${item.value}`,
          ],
          witnessAssignments: [],
          supportCount: 0,
          receipt: refusalReceipt({
            stage: 'inference',
            bounds,
            compiled,
          }),
        });
      }
      return evidenceFailure(compiled, bounds, 'duplicate-binding', item.variableId);
    }
    evidence[item.variableId] = item.value;
  }
  return evidence;
}

function evidenceFailure(
  compiled: CompiledConditioningModel,
  bounds: ConditioningBounds,
  detail: 'unknown-variable' | 'unknown-value' | 'duplicate-binding',
  evidenceId: string
): never {
  signal({
    kind: 'EvidenceShapeInvalid',
    detail,
    evidenceId,
    receipt: refusalReceipt({
      stage: 'inference',
      bounds,
      compiled,
    }),
  });
}
