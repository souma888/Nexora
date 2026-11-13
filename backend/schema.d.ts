export type Scalar = number | string;
export type InputValues<F extends Fields> = {
  [K in keyof F]: F[K] extends NumberField ? number : string;
};
type Visibility = { key: string; is: Scalar };
interface BaseField {
  label: string;
  unit: string;
  visibleWhen?: Visibility;
}
export interface NumberField extends BaseField {
  type: 'number';
  min: number;
  max: number;
  initial?: number;
  integer?: boolean;
  widget?: string;
}
export interface EnumField extends BaseField {
  type: 'enum';
  options: string[];
  labels?: Record<string, string>;
  initial: string;
}
export interface ListField extends BaseField {
  type: 'integer-list';
  minItem: number;
  maxItem: number;
  maxItems: number;
  initial: string;
}
export interface TextField extends BaseField {
  type: 'text';
  maxLength: number;
  initial: string;
}
export type Field = NumberField | EnumField | ListField | TextField;
export type Fields = Record<string, Field>;
export interface InputError {
  key: string;
  message: string;
}
export type Validation<T> =
  { values: T; key?: never; message?: never } | { values?: never; key: string; message: string };
export interface Rule {
  type: 'less' | 'same-length' | 'list-length';
  field: string;
  message: string;
  left?: string;
  right?: string;
  count?: number;
  when?: Visibility;
}
export interface Plot {
  title?: string;
  x?: string;
  y?: string;
  xUnit?: string;
  yUnit?: string;
  traces?: Record<string, string>;
  step?: boolean;
}
export type Point = { x: number; [trace: string]: number | null };
export interface Result {
  summary: Record<string, number | null>;
  series?: Point[];
}
export interface Definition<F extends Fields> {
  id: string;
  version: string;
  inputs: F;
  outputs: { summary: Record<string, string>; series: Record<string, string> };
  rules?: Rule[];
  validateValues?: (input: InputValues<F>) => InputError | undefined;
  presets?: Record<string, Partial<InputValues<F>>>;
  title?: string;
  discipline?: string;
  lab?: string;
  topic?: string;
  description?: string;
  predict?: string;
  example?: string;
  equation?: string;
  limits?: string;
  prediction?: [string[], number, string];
  metrics?: Record<string, string>;
  plot?: Plot;
  interaction?: string;
  initialProbe?: number | string;
  stepAction?: string;
}
export type Config<F extends Fields> = Omit<Definition<F>, 'id' | 'version'>;
export interface LabConfig<F extends Fields> extends Omit<
  Definition<F>,
  'version' | 'outputs' | 'metrics' | 'prediction'
> {
  metrics: Record<string, string[]>;
  text: [string, string, string[], string, string, string, string];
}
