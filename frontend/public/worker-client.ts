export function solverClient() {
  let worker: Worker | undefined,
    token = 0;
  const pending = new Map<
    number,
    { resolve: (value: unknown) => void; reject: (error: Error) => void }
  >();
  function cancel() {
    worker?.terminate();
    worker = undefined;
    for (const promise of pending.values()) promise.reject(new Error('Calculation cancelled.'));
    pending.clear();
  }
  function start() {
    if (worker) return worker;
    worker = new Worker(new URL('./solver-worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = ({ data }) => {
      const promise = pending.get(data.token);
      if (!promise) return;
      pending.delete(data.token);
      if (data.error) promise.reject(new Error(data.error));
      else promise.resolve(data.result);
    };
    worker.onerror = () => {
      for (const promise of pending.values())
        promise.reject(new Error('Worker failed to load. Reload or check offline availability.'));
      pending.clear();
      worker?.terminate();
      worker = undefined;
    };
    return worker;
  }
  return {
    cancel,
    run<T>(
      model: string,
      input: Record<string, number | string>,
      task = 'solve',
      options: unknown = {},
    ): Promise<T> {
      const id = ++token;
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve: (value) => resolve(value as T), reject });
        start().postMessage({ token: id, model, input, task, options });
      });
    },
  };
}
