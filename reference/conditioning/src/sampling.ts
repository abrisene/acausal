import { Random } from '@acausal/random';
import { compareCodeUnits, decodeAssignment, encodeTuple, fingerprint, hashWords } from './canonical';
import { COMPILER_REVISION, SAMPLING_REVISION } from './constants';
import { buildReceiptCore, resolveConditioningBounds } from './compiler';
import type { Assignment, CompiledConditioningModel, ConditioningQuery } from './model';
import { ConditioningRefusalSignal, refusalReceipt, signal } from './refusals';
import type { ConditioningBounds, SampleResult, SamplingDraw, SamplingReceipt, SamplingResult } from './types';

export interface SamplingOptions {
  readonly seed: string | number;
  readonly streamName: string;
  readonly bounds?: Partial<ConditioningBounds>;
}

export function sampleForward(
  compiled: CompiledConditioningModel,
  query: ConditioningQuery,
  options: SamplingOptions
): SamplingResult {
  try {
    const bounds = resolveConditioningBounds(options.bounds ?? {});
    if (query.mode !== 'forward') {
      signal({
        kind: 'ForwardSamplingUnavailable',
        reason: 'query mode must be forward',
        receipt: refusalReceipt({
          stage: 'sampling',
          bounds,
          compiled,
        }),
      });
    }
    const evidence = validateSamplingEvidence(compiled, query, bounds);
    const probabilityFactors = new Map(
      compiled.factors
        .filter(factor => factor.kind === 'probability')
        .map(factor => [
          factor.scope[factor.scope.length - 1],
          {
            ...factor,
            decodedRows: factor.rows.map(row => ({
              ...row,
              decoded: decodeAssignment(row.assignment),
            })),
          },
        ])
    );
    for (const variableId of Object.keys(evidence)) {
      const factor = probabilityFactors.get(variableId);
      if (factor && factor.scope.length > 1) {
        signal({
          kind: 'ForwardSamplingUnavailable',
          reason: `evidence on non-root variable ${variableId} requires posterior conditioning`,
          receipt: refusalReceipt({
            stage: 'sampling',
            bounds,
            compiled,
          }),
        });
      }
    }

    const queryEvidenceFingerprint = fingerprint(evidence);
    const streamKey = encodeTuple([
      String(options.seed),
      COMPILER_REVISION,
      SAMPLING_REVISION,
      compiled.modelRevision,
      compiled.modelFingerprint,
      compiled.evidenceFingerprint,
      queryEvidenceFingerprint,
      options.streamName,
    ]);
    const streamSeedWords = hashWords(streamKey);
    const random = Random.new([...streamSeedWords]);
    const rngUsesBefore = random.uses;
    const assignment: Record<string, string> = {};
    const draws: SamplingDraw[] = [];

    for (const variableId of compiled.variableOrder) {
      const fixed = evidence[variableId];
      if (fixed !== undefined) {
        assignment[variableId] = fixed;
        continue;
      }
      const factor = probabilityFactors.get(variableId);
      if (!factor) {
        signal({
          kind: 'ForwardSamplingUnavailable',
          reason: `no probability factor for ${variableId}`,
          receipt: refusalReceipt({
            stage: 'sampling',
            bounds,
            compiled,
          }),
        });
      }
      const variable = compiled.variables.find(item => item.id === variableId);
      if (!variable) throw new Error(`Missing compiled variable ${variableId}`);
      const parentScope = factor.scope.slice(0, -1);
      const matching = factor.decodedRows.filter(row =>
        parentScope.every(parentId => row.decoded[parentId] === assignment[parentId])
      );
      const candidatesConsidered = [...variable.domain].sort(compareCodeUnits);
      const candidatesDropped: Array<{ outcome: string; reason: string }> = [];
      const weighted: Array<{
        outcome: string;
        weight: number;
        rowId: string;
      }> = [];
      for (const outcome of candidatesConsidered) {
        const row = matching.find(candidate => candidate.decoded[variableId] === outcome);
        if (!row) {
          candidatesDropped.push({ outcome, reason: 'missing probability row' });
          continue;
        }
        const candidateAssignment = { ...assignment, [variableId]: outcome };
        if (!permittedByConstraints(compiled, candidateAssignment)) {
          candidatesDropped.push({ outcome, reason: 'excluded by constraint' });
          continue;
        }
        weighted.push({
          outcome,
          weight: Math.exp(row.logPotential),
          rowId: row.sourceRowIds[0] ?? factor.id,
        });
      }
      const total = weighted.reduce((sum, candidate) => sum + candidate.weight, 0);
      if (!(total > 0)) {
        signal({
          kind: 'NoSupport',
          targetId: variableId,
          scope: factor.scope,
          evidenceIds: Object.entries(evidence).map(([id, value]) => `${id}=${value}`),
          constraintFactorIds: compiled.factors.filter(item => item.kind === 'constraint').map(item => item.id),
          eliminatedAssignments: [],
          supportCount: 0,
          receipt: refusalReceipt({
            stage: 'sampling',
            bounds,
            compiled,
          }),
        });
      }
      const draw = random.float(0, total);
      let cursor = 0;
      let selected = weighted[weighted.length - 1];
      for (const candidate of weighted) {
        cursor += candidate.weight;
        if (draw < cursor) {
          selected = candidate;
          break;
        }
      }
      assignment[variableId] = selected.outcome;
      draws.push({
        index: draws.length,
        variableId,
        outcome: selected.outcome,
        rowId: selected.rowId,
        candidatesConsidered,
        candidatesDropped,
      });
    }

    const value: SampleResult = { assignment };
    const receipt: SamplingReceipt = {
      kind: 'sampling',
      core: {
        ...buildReceiptCore(compiled),
        algorithmRevision: SAMPLING_REVISION,
      },
      mode: 'forward',
      streamKey,
      streamSeedWords,
      queryEvidenceFingerprint,
      draws,
      rngUsesBefore,
      rngUsesAfter: random.uses,
      boundsInEffect: bounds,
    };
    return { ok: true, value, receipt };
  } catch (error) {
    if (error instanceof ConditioningRefusalSignal) {
      return { ok: false, error: error.refusal };
    }
    throw error;
  }
}

function validateSamplingEvidence(
  compiled: CompiledConditioningModel,
  query: ConditioningQuery,
  bounds: ConditioningBounds
): Assignment {
  const variables = new Map(compiled.variables.map(variable => [variable.id, variable]));
  const evidence: Record<string, string> = {};
  for (const item of query.evidence) {
    const variable = variables.get(item.variableId);
    if (!variable) {
      evidenceFailure(compiled, bounds, 'unknown-variable', item.variableId);
    }
    if (!variable.domain.includes(item.value)) {
      evidenceFailure(compiled, bounds, 'unknown-value', item.variableId);
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
            stage: 'sampling',
            bounds,
            compiled,
          }),
        });
      }
      evidenceFailure(compiled, bounds, 'duplicate-binding', item.variableId);
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
      stage: 'sampling',
      bounds,
      compiled,
    }),
  });
}

function permittedByConstraints(compiled: CompiledConditioningModel, assignment: Assignment): boolean {
  return compiled.factors
    .filter(factor => factor.kind === 'constraint')
    .every(factor =>
      factor.rows.some(row => {
        if (row.logPotential === Number.NEGATIVE_INFINITY) return false;
        const decoded = decodeAssignment(row.assignment);
        return Object.entries(assignment).every(
          ([variableId, value]) => decoded[variableId] === undefined || decoded[variableId] === value
        );
      })
    );
}
