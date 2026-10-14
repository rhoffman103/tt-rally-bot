export type Ball = {
  upperRpm: number; // 400–7500
  lowerRpm: number; // 400–7500
  height: number; // -50…100
  dropPoint: number; // -10…10, step 0.5
  frequency: number; // 0…100, step 10
  repetitions: number; // 1–200
};
export type DrillLine = { alternatives: Ball[] }; // one ball, or "one of these at random"
export type Drill = {
  id: string;
  name: string;
  lines: DrillLine[];
  randomOrder: boolean;
  duration:
    { kind: 'endless' } | { kind: 'minutes'; value: number } | { kind: 'combos'; value: number };
  pauseBetweenSetsSec?: number;
  source: 'preset' | 'custom';
  updatedAt: string; // ISO time, set by storage.save(); decides which copy is newer when drills merge
};

export type BallField = keyof Ball;
export type BallErrors = Partial<Record<BallField, string>>;
