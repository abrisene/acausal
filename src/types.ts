/*
 # main.d.ts
 # acausal Main Type Declaration
 */

/**
 # Declarations
 */

/* declare type ScalableObject = { [key: string]: number } & {
  [key: number]: number;
};
declare type ScalableCollection = number[] | ScalableObject; */

export type WeightedDistribution = { [key: string]: number };

export type RequireAtLeastOne<T, Keys extends keyof T = keyof T> = Pick<T, Exclude<keyof T, Keys>> &
  {
    [K in Keys]-?: Required<Pick<T, K>> & Partial<Pick<T, Exclude<Keys, K>>>;
  }[Keys];
