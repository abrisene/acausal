import type { ConditioningModel } from '../src/model';

export const soldierModel: ConditioningModel = {
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
