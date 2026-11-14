import type { XY } from './analysis-plot.ts';
let active: Worker | undefined;
let rejectActive: ((error: Error) => void) | undefined;
export function cancelSurrogate() {
  active?.terminate();
  active = undefined;
  rejectActive?.(new Error('Training cancelled.'));
  rejectActive = undefined;
}
export function trainSurrogate(
  points: Record<string, unknown>[],
): Promise<{ rmse: number; curves: { label: string; points: XY[] }[] }> {
  cancelSurrogate();
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./surrogate-worker.js', import.meta.url), {
      type: 'module',
    });
    active = worker;
    rejectActive = reject;
    const finish = () => {
      worker.terminate();
      if (active === worker) {
        active = undefined;
        rejectActive = undefined;
      }
    };
    worker.onmessage = ({ data }) => {
      finish();
      if (data.error) reject(new Error(data.error));
      else resolve(data);
    };
    worker.onerror = () => {
      finish();
      reject(new Error('Surrogate worker failed to load.'));
    };
    worker.postMessage(points);
  });
}
