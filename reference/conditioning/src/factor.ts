import {
  assignmentCardinality,
  assignments,
  compareCodeUnits,
  decodeAssignment,
  encodeAssignment,
  logSumExp,
} from './canonical';
import type { Assignment, CompiledFactor, VariableId } from './model';
import type { ConditioningBounds, ConditioningRefusal } from './types';
import { refusalReceipt, signal } from './refusals';

export interface RuntimeFactorRow {
  readonly assignment: Assignment;
  readonly logPotential: number;
}

export interface RuntimeFactor {
  readonly id: string;
  readonly scope: readonly VariableId[];
  readonly rows: readonly RuntimeFactorRow[];
  readonly sourceFactorIds: readonly string[];
}

export interface OperationBudget {
  operations: number;
  maximumJointSupport: number;
}

export function toRuntimeFactor(factor: CompiledFactor): RuntimeFactor {
  return {
    id: factor.id,
    scope: factor.scope,
    rows: factor.rows.map(row => ({
      assignment: decodeAssignment(row.assignment),
      logPotential: row.logPotential,
    })),
    sourceFactorIds: [factor.id],
  };
}

export function restrictFactor(factor: RuntimeFactor, evidence: Assignment): RuntimeFactor {
  const evidenceVariables = factor.scope.filter(variableId => evidence[variableId] !== undefined);
  if (evidenceVariables.length === 0) return factor;
  const scope = factor.scope.filter(variableId => evidence[variableId] === undefined);
  return {
    ...factor,
    scope,
    rows: factor.rows
      .filter(row => evidenceVariables.every(variableId => row.assignment[variableId] === evidence[variableId]))
      .map(row => ({
        assignment: Object.fromEntries(scope.map(variableId => [variableId, row.assignment[variableId]])),
        logPotential: row.logPotential,
      })),
  };
}

export function multiplyFactors(
  factors: readonly RuntimeFactor[],
  domains: ReadonlyMap<VariableId, readonly string[]>,
  bounds: ConditioningBounds,
  budget: OperationBudget
): RuntimeFactor {
  if (factors.length === 0) {
    return {
      id: 'identity',
      scope: [],
      rows: [{ assignment: {}, logPotential: 0 }],
      sourceFactorIds: [],
    };
  }
  const scope = [...new Set(factors.flatMap(factor => factor.scope))].sort(compareCodeUnits);
  const support = assignmentCardinality(scope, domains, bounds.maxJointSupport);
  enforceSupport(support, bounds, budget);
  const rowMaps = factors.map(
    factor => new Map(factor.rows.map(row => [encodeAssignment(factor.scope, row.assignment), row.logPotential]))
  );
  const rows: RuntimeFactorRow[] = [];
  for (const assignment of assignments(scope, domains)) {
    enforceOperation(bounds, budget);
    let logPotential = 0;
    for (let index = 0; index < factors.length; index += 1) {
      const factor = factors[index];
      const key = encodeAssignment(factor.scope, assignment);
      const value = rowMaps[index].get(key);
      if (value === undefined) {
        logPotential = Number.NEGATIVE_INFINITY;
        break;
      }
      logPotential += value;
    }
    rows.push({ assignment, logPotential });
  }
  return {
    id: `product:${factors
      .map(factor => factor.id)
      .sort()
      .join('+')}`,
    scope,
    rows,
    sourceFactorIds: [...new Set(factors.flatMap(factor => factor.sourceFactorIds))].sort(compareCodeUnits),
  };
}

export function sumOut(
  factor: RuntimeFactor,
  variableId: VariableId,
  domains: ReadonlyMap<VariableId, readonly string[]>,
  bounds: ConditioningBounds,
  budget: OperationBudget
): RuntimeFactor {
  if (!factor.scope.includes(variableId)) return factor;
  const scope = factor.scope.filter(id => id !== variableId);
  const support = assignmentCardinality(scope, domains, bounds.maxJointSupport);
  enforceSupport(support, bounds, budget);
  const grouped = new Map<string, number[]>();
  for (const row of factor.rows) {
    enforceOperation(bounds, budget);
    const key = encodeAssignment(scope, row.assignment);
    const values = grouped.get(key) ?? [];
    values.push(row.logPotential);
    grouped.set(key, values);
  }
  const rows = [...grouped.entries()]
    .sort(([left], [right]) => compareCodeUnits(left, right))
    .map(([key, values]) => ({
      assignment: decodeAssignment(key),
      logPotential: logSumExp(values),
    }));
  return {
    id: `sum:${variableId}:${factor.id}`,
    scope,
    rows,
    sourceFactorIds: factor.sourceFactorIds,
  };
}

export function planEliminationOrder(
  factors: readonly RuntimeFactor[],
  activeVariables: readonly VariableId[],
  eliminableVariables: readonly VariableId[]
): {
  order: readonly VariableId[];
  inducedWidth: number;
} {
  const neighbors = new Map(activeVariables.map(variableId => [variableId, new Set<string>()]));
  for (const factor of factors) {
    for (const variableId of factor.scope) {
      const set = neighbors.get(variableId);
      if (!set) continue;
      for (const other of factor.scope) {
        if (other !== variableId) set.add(other);
      }
    }
  }
  const active = new Set(activeVariables);
  const remaining = new Set(eliminableVariables);
  const order: string[] = [];
  let inducedWidth = 0;
  while (remaining.size > 0) {
    const candidates = [...remaining].map(variableId => {
      const activeNeighbors = [...(neighbors.get(variableId) ?? [])].filter(id => active.has(id));
      let fill = 0;
      for (let left = 0; left < activeNeighbors.length; left += 1) {
        for (let right = left + 1; right < activeNeighbors.length; right += 1) {
          if (!neighbors.get(activeNeighbors[left])?.has(activeNeighbors[right])) {
            fill += 1;
          }
        }
      }
      return { variableId, activeNeighbors, fill };
    });
    candidates.sort((left, right) => left.fill - right.fill || compareCodeUnits(left.variableId, right.variableId));
    const selected = candidates[0];
    inducedWidth = Math.max(inducedWidth, selected.activeNeighbors.length);
    for (let left = 0; left < selected.activeNeighbors.length; left += 1) {
      for (let right = left + 1; right < selected.activeNeighbors.length; right += 1) {
        neighbors.get(selected.activeNeighbors[left])?.add(selected.activeNeighbors[right]);
        neighbors.get(selected.activeNeighbors[right])?.add(selected.activeNeighbors[left]);
      }
    }
    active.delete(selected.variableId);
    remaining.delete(selected.variableId);
    order.push(selected.variableId);
  }
  return { order, inducedWidth };
}

function enforceSupport(support: number, bounds: ConditioningBounds, budget: OperationBudget): void {
  budget.maximumJointSupport = Math.max(budget.maximumJointSupport, support);
  if (support <= bounds.maxJointSupport) return;
  const refusal: ConditioningRefusal = {
    kind: 'InferenceBudgetExceeded',
    reason: 'state-space',
    limit: bounds.maxJointSupport,
    observed: support,
    receipt: refusalReceipt({
      stage: 'plan-construction',
      bounds,
      limit: bounds.maxJointSupport,
      observed: support,
    }),
  };
  signal(refusal);
}

function enforceOperation(bounds: ConditioningBounds, budget: OperationBudget): void {
  const next = budget.operations + 1;
  if (next > bounds.maxOperations) {
    signal({
      kind: 'InferenceBudgetExceeded',
      reason: 'step-budget',
      limit: bounds.maxOperations,
      observed: next,
      receipt: refusalReceipt({
        stage: 'inference',
        bounds,
        limit: bounds.maxOperations,
        observed: next,
      }),
    });
  }
  budget.operations = next;
}
