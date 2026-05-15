// ==== Types ====

export type DbStats = {
  storage: { usedBytes: number; limitBytes: number };
  transfer: { usedBytes: number; limitBytes: number };
  compute: { usedCuHours: number; limitCuHours: number };
  periodEnd: string;
};
