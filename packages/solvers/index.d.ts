export type Quantity = { value: number; unit: string };
export type Inputs = Record<string, number | string | Quantity>;
export type Point = { x: number; [key: string]: number | null };
export interface SolverReport {
  summary: Record<string, number | null>;
  series?: Point[];
  [key: string]: unknown;
}
export function listLabs(): { id: string; engine: string; version: string; title: string }[];
export function solveLab(id: string, input: Inputs): SolverReport;
export function solveLinear(matrix: number[][], rhs: number[]): number[];
export function solveBeam(input: {
  case: 'point' | 'uniform' | 'cantilever';
  span: number;
  load: number;
  modulus: number;
  inertia: number;
}): SolverReport;
export function solveTruss(
  source: string,
  loadScale?: number,
): SolverReport & {
  nodes: number[][];
  bars: number[][];
  displacement: number[];
  reactions: number[];
  members: { a: number; b: number; force: number; stress: number }[];
  residual: number;
};
export function solveCircuit(source: string): {
  nodes: number[];
  voltage: (node: number) => number;
  branches: {
    kind: string;
    name: string;
    a: number;
    b: number;
    value: number;
    drop: number;
    current: number;
    power: number;
  }[];
  matrix: number[][];
  rhs: number[];
  solution: number[];
  residual: number;
};
export function convert(value: number, from: string, to: string): number;
export function describeUnit(
  unit: string,
): { dimension: string; scale: number; offset?: number } | null;
export function compatibleUnits(unit: string): string[];
export function parseData(csv: string, columns?: string[]): Record<string, number>[];
export function fitParameters(
  evaluate: (input: Inputs) => SolverReport,
  data: { x: number; y: number }[],
  initial: Inputs,
  bounds: Record<string, [number, number]>,
  trace?: string,
  iterations?: number,
): {
  input: Inputs;
  rmse: number;
  r2: number | null;
  converged: boolean;
  iterations: number;
  residuals: Point[];
  series?: Point[];
  warning: string;
};
export function analyzeParameters(
  evaluate: (input: Inputs) => SolverReport,
  input: Inputs,
  bounds: Record<string, [number, number]>,
  metric: string,
  options?: {
    mode?: 'sweep' | 'sensitivity' | 'montecarlo';
    samples?: number;
    seed?: number;
    distribution?: 'uniform' | 'normal';
    integerKeys?: string[];
  },
): {
  baseline: number;
  series?: Point[];
  tornado?: { key: string; low: number; high: number; span: number; derivative: number }[];
  accepted?: number;
  rejected?: number;
  mean?: number;
  standardDeviation?: number;
  p05?: number;
  p50?: number;
  p95?: number;
  note?: string;
};
