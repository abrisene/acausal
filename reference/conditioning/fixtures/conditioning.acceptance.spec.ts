import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { soldierModel as soldierFixtureModel } from './soldier';
import {
  ALGORITHM_REVISION,
  NUMERIC_RUNTIME_REVISION,
  POSTERIOR_METRIC,
  RELATIVE_WEIGHT_METRIC,
  compileConditioningModel,
  encodeTuple,
  inferByEnumeration,
  inferPosterior,
  sampleForward,
  type ConditioningModel,
  type ConditioningQuery,
} from '../src/index';

const soldierModel: ConditioningModel = {
  id: 'soldier-gender',
  revision: '1',
  sourceSnapshotId: 'fixture:soldier:1',
  variables: [
    {
      id: 'gender',
      kind: 'categorical',
      domain: ['female', 'male'],
      sourceRefs: ['fixture:soldier'],
    },
    {
      id: 'profession',
      kind: 'categorical',
      domain: ['baker', 'soldier'],
      sourceRefs: ['fixture:soldier'],
    },
  ],
  tables: [
    {
      id: 'gender-prior',
      targetId: 'gender',
      parentScope: [],
      rows: [
        {
          id: 'gender-root',
          targetId: 'gender',
          parentScope: [],
          parentAssignment: {},
          outcomeWeights: [
            { outcome: 'female', baseWeight: 1 },
            { outcome: 'male', baseWeight: 1 },
          ],
          modifiers: [],
          sourceRefs: ['fixture:soldier'],
        },
      ],
    },
    {
      id: 'profession-by-gender',
      targetId: 'profession',
      parentScope: ['gender'],
      rows: [
        {
          id: 'profession-female',
          targetId: 'profession',
          parentScope: ['gender'],
          parentAssignment: { gender: 'female' },
          outcomeWeights: [
            { outcome: 'baker', baseWeight: 1 },
            { outcome: 'soldier', baseWeight: 1 },
          ],
          modifiers: [
            {
              id: 'male-soldier-boost',
              outcome: 'soldier',
              when: {
                op: 'eq',
                left: 'parent:gender',
                right: 'male',
              },
              multiplyBy: 1.5,
            },
          ],
          sourceRefs: ['fixture:soldier'],
        },
        {
          id: 'profession-male',
          targetId: 'profession',
          parentScope: ['gender'],
          parentAssignment: { gender: 'male' },
          outcomeWeights: [
            { outcome: 'baker', baseWeight: 1 },
            { outcome: 'soldier', baseWeight: 1 },
          ],
          modifiers: [
            {
              id: 'male-soldier-boost',
              outcome: 'soldier',
              when: {
                op: 'eq',
                left: 'parent:gender',
                right: 'male',
              },
              multiplyBy: 1.5,
            },
          ],
          sourceRefs: ['fixture:soldier'],
        },
      ],
    },
  ],
};

function compile(model: ConditioningModel = soldierModel) {
  const result = compileConditioningModel(model);
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.error.kind);
  return result;
}

describe('@acausal/conditioning', () => {
  it('executes the data fixture rather than a consumer-owned model', () => {
    const fixture = compile(soldierFixtureModel);
    expect(fixture.value.modelFingerprint).toBe(compile().value.modelFingerprint);
    expect(fixture.value.modelFingerprint).toBe('196c883ddcdb78bbdff677c96ffbe053');
    expect(fixture.value.compiledArtifactFingerprint).toBe('1a8f05d801b944fe6369fb9c44f9d686');
  });

  it('answers forward and reverse questions from the same compiled model', () => {
    const compiled = compile();
    const male = inferPosterior(compiled.value, {
      targetId: 'profession',
      evidence: [{ variableId: 'gender', value: 'male' }],
      mode: 'posterior',
    });
    const female = inferPosterior(compiled.value, {
      targetId: 'profession',
      evidence: [{ variableId: 'gender', value: 'female' }],
      mode: 'posterior',
    });
    const reverse = inferPosterior(compiled.value, {
      targetId: 'gender',
      evidence: [{ variableId: 'profession', value: 'soldier' }],
      mode: 'posterior',
    });
    expect(male.ok && male.value.posterior.soldier).toBeCloseTo(0.6, 14);
    expect(male.ok && male.value.posterior.baker).toBeCloseTo(0.4, 14);
    expect(female.ok && female.value.posterior.soldier).toBeCloseTo(0.5, 14);
    expect(reverse.ok && reverse.value.posterior.male).toBeCloseTo(6 / 11, 14);
    expect(male.ok && male.receipt.core.modelFingerprint).toBe(compiled.receipt.core.modelFingerprint);
    expect(reverse.ok && reverse.receipt.core.modelFingerprint).toBe(compiled.receipt.core.modelFingerprint);
  });

  it('matches brute enumeration for exact inference fixtures', () => {
    const compiled = compile();
    const query: ConditioningQuery = {
      targetId: 'gender',
      evidence: [{ variableId: 'profession', value: 'soldier' }],
      mode: 'posterior',
    };
    const exact = inferPosterior(compiled.value, query);
    expect(exact.ok).toBe(true);
    if (!exact.ok) return;
    const reference = inferByEnumeration(compiled.value, query);
    expect(exact.value.posterior.male).toBeCloseTo(reference.male, 15);
    expect(exact.value.posterior.female).toBeCloseTo(reference.female, 15);
  });

  it('declares separate relative-weight and posterior metrics', () => {
    expect(RELATIVE_WEIGHT_METRIC.range.lower.kind).toBe('exclusive');
    expect(RELATIVE_WEIGHT_METRIC.range.space).toBe('log');
    expect(POSTERIOR_METRIC.range.lower.kind).toBe('inclusive');
    expect(POSTERIOR_METRIC.range.upper.kind).toBe('inclusive');
    expect(POSTERIOR_METRIC.revision).toContain(ALGORITHM_REVISION);
    expect(POSTERIOR_METRIC.revision).toContain(NUMERIC_RUNTIME_REVISION);
  });

  it('emits disclosure-safe replay receipts', () => {
    const secret = 'private-evidence-payload-canary';
    const compiled = compile({
      ...soldierModel,
      evidence: [
        {
          id: 'safe-evidence-id',
          source: 'admitted',
          refs: ['safe-ref'],
          payload: secret,
        },
      ],
    });
    const serialized = JSON.stringify(compiled.receipt);
    expect(serialized).toContain('safe-evidence-id');
    expect(serialized).not.toContain(secret);
    expect(serialized).not.toContain('droppedEvidence');
    expect(serialized).not.toContain('visibilityGrant');
  });

  it('uses pre-resolved feasibility decisions and fails closed on unknown', () => {
    const unknown = compileConditioningModel({
      ...soldierModel,
      feasibilityDecisions: [
        {
          status: 'unknown',
          invocationId: 'feasibility-1',
          resolverRevision: 'pin-derive-0.4',
          requestFingerprint: 'request-1',
          assignment: { gender: 'male', profession: 'soldier' },
          conflictOrigins: [],
        },
      ],
    });
    expect(unknown.ok).toBe(false);
    expect(!unknown.ok && unknown.error.kind).toBe('FeasibilityUndetermined');

    const infeasible = compile({
      ...soldierModel,
      feasibilityDecisions: [
        {
          status: 'infeasible',
          invocationId: 'feasibility-2',
          resolverRevision: 'pin-derive-0.4',
          requestFingerprint: 'request-2',
          assignment: { gender: 'female', profession: 'soldier' },
          conflictOrigins: ['rule:no-female-soldiers'],
        },
      ],
    });
    const result = inferPosterior(infeasible.value, {
      targetId: 'profession',
      evidence: [{ variableId: 'gender', value: 'female' }],
      mode: 'posterior',
    });
    expect(result.ok && result.value.posterior.soldier).toBe(0);
    expect(result.ok && result.value.posterior.baker).toBe(1);
    expect(infeasible.receipt.core.feasibilityDecisions[0].conflictOrigins).toEqual(['rule:no-female-soldiers']);
  });

  it('has no consumer, constraint-engine, or scaling dependency in runtime source', () => {
    const sourceUrl = new URL('../src/', import.meta.url);
    const sourceDirectory = fileURLToPath(sourceUrl);
    const runtimeSource = readdirSync(sourceDirectory)
      .filter(name => name.endsWith('.ts') && !name.endsWith('.spec.ts'))
      .map(name => readFileSync(new URL(name, sourceUrl), 'utf8'))
      .join('\n')
      .toLowerCase();
    for (const forbidden of ['@gonk/', '@mirk/', '@acausal/scalr', 'novelty', 'pin-derive', 'sigil-game']) {
      expect(runtimeSource).not.toContain(forbidden);
    }
  });

  it('returns typed empty-support and contradictory-evidence failures', () => {
    const excluded = compile({
      ...soldierModel,
      eligibilityRules: [
        {
          id: 'exclude-female-baker',
          scope: ['gender', 'profession'],
          assignment: { gender: 'female', profession: 'baker' },
          when: { op: 'all', args: [] },
          mode: 'hard-exclude',
        },
        {
          id: 'exclude-female-soldier',
          scope: ['gender', 'profession'],
          assignment: { gender: 'female', profession: 'soldier' },
          when: { op: 'all', args: [] },
          mode: 'hard-exclude',
        },
      ],
    });
    const noSupport = inferPosterior(excluded.value, {
      targetId: 'profession',
      evidence: [{ variableId: 'gender', value: 'female' }],
      mode: 'posterior',
    });
    expect(noSupport.ok).toBe(false);
    expect(!noSupport.ok && noSupport.error.kind).toBe('NoSupport');

    const contradictory = inferPosterior(excluded.value, {
      targetId: 'profession',
      evidence: [
        { variableId: 'gender', value: 'female' },
        { variableId: 'gender', value: 'male' },
      ],
      mode: 'posterior',
    });
    expect(contradictory.ok).toBe(false);
    expect(!contradictory.ok && contradictory.error.kind).toBe('InconsistentEvidence');
  });

  it('resolves overlays canonically independent of input order', () => {
    const modifierA = {
      tableId: 'profession-by-gender',
      rowId: 'profession-male',
      modifier: {
        id: 'culture-a',
        outcome: 'soldier',
        when: { op: 'all' as const, args: [] },
        multiplyBy: 2,
      },
    };
    const modifierB = {
      tableId: 'profession-by-gender',
      rowId: 'profession-male',
      modifier: {
        id: 'culture-b',
        outcome: 'baker',
        when: { op: 'all' as const, args: [] },
        multiplyBy: 3,
      },
    };
    const overlays = [
      {
        id: 'maresci',
        precedence: 20,
        sourceSnapshotId: 'culture:maresci',
        appliesTo: ['profession'],
        rowReplacements: [],
        modifierAdditions: [modifierA],
        eligibilityRules: [],
      },
      {
        id: 'lysean',
        precedence: 10,
        sourceSnapshotId: 'culture:lysean',
        appliesTo: ['profession'],
        rowReplacements: [],
        modifierAdditions: [modifierB],
        eligibilityRules: [],
      },
    ];
    const first = compile({ ...soldierModel, overlays });
    const second = compile({
      ...soldierModel,
      tables: [...soldierModel.tables].reverse().map(table => ({
        ...table,
        rows: [...table.rows].reverse().map(row => ({
          ...row,
          outcomeWeights: [...row.outcomeWeights].reverse(),
        })),
      })),
      overlays: [...overlays].reverse(),
    });
    expect(first.value.compiledArtifactFingerprint).toBe(second.value.compiledArtifactFingerprint);
    expect(first.receipt.core.overlayResolutionPath).toEqual(['lysean', 'maresci']);
  });

  it('distinguishes ontology and authored-model cycles', () => {
    const ontology = compileConditioningModel({
      ...soldierModel,
      ontologyEdges: [
        { parentId: 'a', childId: 'b' },
        { parentId: 'b', childId: 'a' },
      ],
    });
    expect(ontology.ok).toBe(false);
    expect(!ontology.ok && ontology.error.kind).toBe('OntologyCycle');

    const authored = compileConditioningModel({
      ...soldierModel,
      tables: [
        {
          ...soldierModel.tables[0],
          parentScope: ['profession'],
          rows: [
            {
              ...soldierModel.tables[0].rows[0],
              parentScope: ['profession'],
              parentAssignment: { profession: 'baker' },
            },
            {
              ...soldierModel.tables[0].rows[0],
              id: 'gender-root-soldier',
              parentScope: ['profession'],
              parentAssignment: { profession: 'soldier' },
            },
          ],
        },
        soldierModel.tables[1],
      ],
    });
    expect(authored.ok).toBe(false);
    expect(!authored.ok && authored.error.kind).toBe('AuthoredModelCycle');
  });

  it('refuses each configured bound before unbounded work', () => {
    const domain = compileConditioningModel(soldierModel, { maxDomainSize: 1 });
    expect(!domain.ok && domain.error.kind).toBe('DomainSizeExceeded');

    const variables = compileConditioningModel(soldierModel, {
      maxVariables: 1,
    });
    expect(!variables.ok && variables.error.kind).toBe('VariableCountExceeded');

    const factors = compileConditioningModel(soldierModel, { maxFactors: 1 });
    expect(!factors.ok && factors.error.kind).toBe('FactorCountExceeded');

    const support = compileConditioningModel(soldierModel, {
      maxJointSupport: 3,
    });
    expect(!support.ok && support.error.kind).toBe('InferenceBudgetExceeded');

    const compiled = compile();
    const operations = inferPosterior(
      compiled.value,
      {
        targetId: 'gender',
        evidence: [{ variableId: 'profession', value: 'soldier' }],
        mode: 'posterior',
      },
      { ...compiled.receipt.boundsInEffect, maxOperations: 1 }
    );
    expect(!operations.ok && operations.error.kind).toBe('InferenceBudgetExceeded');

    const aboveHardCap = compileConditioningModel(soldierModel, {
      maxDomainSize: 4_097,
    });
    expect(!aboveHardCap.ok && aboveHardCap.error.kind).toBe('BoundsConfigurationInvalid');
    const inferenceAboveHardCap = inferPosterior(
      compiled.value,
      { targetId: 'gender', evidence: [], mode: 'posterior' },
      { maxOperations: 100_000_001 }
    );
    expect(!inferenceAboveHardCap.ok && inferenceAboveHardCap.error.kind).toBe('BoundsConfigurationInvalid');

    const dense: ConditioningModel = {
      ...soldierModel,
      variables: [
        ...soldierModel.variables,
        {
          id: 'rank',
          kind: 'categorical',
          domain: ['low', 'high'],
          sourceRefs: ['fixture:dense'],
        },
      ],
      tables: [
        ...soldierModel.tables,
        {
          id: 'rank-by-gender-profession',
          targetId: 'rank',
          parentScope: ['gender', 'profession'],
          rows: ['female', 'male'].flatMap(gender =>
            ['baker', 'soldier'].map(profession => ({
              id: `rank-${gender}-${profession}`,
              targetId: 'rank',
              parentScope: ['gender', 'profession'],
              parentAssignment: { gender, profession },
              outcomeWeights: [
                { outcome: 'low', baseWeight: 1 },
                { outcome: 'high', baseWeight: 1 },
              ],
              modifiers: [],
              sourceRefs: ['fixture:dense'],
            }))
          ),
        },
      ],
    };
    const denseCompiled = compile(dense);
    const width = inferPosterior(
      denseCompiled.value,
      { targetId: 'gender', evidence: [], mode: 'posterior' },
      { ...denseCompiled.receipt.boundsInEffect, maxEliminationWidth: 1 }
    );
    expect(!width.ok && width.error.kind).toBe('InferenceBudgetExceeded');
    expect(!width.ok && width.error.kind === 'InferenceBudgetExceeded' && width.error.reason).toBe('treewidth');
  });

  it('rejects duplicate evidence and target-or-descendant modifiers', () => {
    const duplicateEvidence = compileConditioningModel({
      ...soldierModel,
      evidence: [
        { id: 'same', source: 'fixture', refs: [], payload: true },
        { id: 'same', source: 'fixture', refs: [], payload: true },
      ],
    });
    expect(!duplicateEvidence.ok && duplicateEvidence.error.kind).toBe('EvidenceShapeInvalid');

    const invalidModifier = compileConditioningModel({
      ...soldierModel,
      tables: [
        {
          ...soldierModel.tables[0],
          rows: [
            {
              ...soldierModel.tables[0].rows[0],
              modifiers: [
                {
                  id: 'looks-at-descendant',
                  outcome: 'male',
                  when: {
                    op: 'eq',
                    left: 'derived:profession',
                    right: 'soldier',
                  },
                  multiplyBy: 2,
                },
              ],
            },
          ],
        },
        soldierModel.tables[1],
      ],
    });
    expect(!invalidModifier.ok && invalidModifier.error.kind).toBe('InvalidModel');
    expect(!invalidModifier.ok && invalidModifier.error.kind === 'InvalidModel' && invalidModifier.error.detail).toBe(
      'modifier-inspects-target-or-descendant'
    );
    const malformedConstraint = compileConditioningModel({
      ...soldierModel,
      eligibilityRules: [
        {
          id: 'bad-scope',
          scope: ['gender', 'profession'],
          assignment: { gender: 'male' },
          when: { op: 'all', args: [] },
          mode: 'hard-exclude',
        },
      ],
    });
    expect(
      !malformedConstraint.ok && malformedConstraint.error.kind === 'InvalidModel' && malformedConstraint.error.detail
    ).toBe('constraint-assignment-mismatch');
  });

  it('produces reproducible domain-separated streams', () => {
    const compiled = compile();
    const query: ConditioningQuery = {
      targetId: 'profession',
      evidence: [],
      mode: 'forward',
    };
    const first = sampleForward(compiled.value, query, {
      seed: 42,
      streamName: 'casting',
    });
    const replay = sampleForward(compiled.value, query, {
      seed: 42,
      streamName: 'casting',
    });
    const other = sampleForward(compiled.value, query, {
      seed: 42,
      streamName: 'portrait',
    });
    expect(first.ok && replay.ok && first.value).toEqual(replay.ok && replay.value);
    expect(first.ok && replay.ok && first.receipt.streamSeedWords).toEqual(replay.ok && replay.receipt.streamSeedWords);
    expect(first.ok && first.value.assignment).toEqual({
      gender: 'male',
      profession: 'soldier',
    });
    expect(first.ok && first.receipt.streamSeedWords).toEqual([941695557, 3296823995, 2600286745, 3311668627]);
    if (first.ok && replay.ok) {
      expect({
        ...first.receipt,
        core: { ...first.receipt.core, runId: '<run>' },
      }).toEqual({
        ...replay.receipt,
        core: { ...replay.receipt.core, runId: '<run>' },
      });
    }
    expect(first.ok && other.ok && first.receipt.streamKey).not.toBe(other.ok && other.receipt.streamKey);
    expect(first.ok && other.ok && first.receipt.streamSeedWords).not.toEqual(
      other.ok && other.receipt.streamSeedWords
    );
    const fixedRoot = sampleForward(
      compiled.value,
      {
        targetId: 'profession',
        evidence: [{ variableId: 'gender', value: 'male' }],
        mode: 'forward',
      },
      { seed: 42, streamName: 'casting' }
    );
    expect(first.ok && fixedRoot.ok && first.receipt.streamKey).not.toBe(fixedRoot.ok && fixedRoot.receipt.streamKey);
  });

  it('uses unambiguous length-prefixed stream tuples', () => {
    expect(encodeTuple(['a|b', 'c'])).not.toBe(encodeTuple(['a', 'b|c']));
  });

  it('refuses ancestral sampling when evidence requires posterior inference', () => {
    const compiled = compile();
    const result = sampleForward(
      compiled.value,
      {
        targetId: 'gender',
        evidence: [{ variableId: 'profession', value: 'soldier' }],
        mode: 'forward',
      },
      { seed: 7, streamName: 'conditioned' }
    );
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error.kind).toBe('ForwardSamplingUnavailable');
  });
});
