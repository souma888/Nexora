self.onmessage = async ({ data }) => {
  try {
    const tf = await import('@tensorflow/tfjs');
    await tf.setBackend('cpu');
    await tf.ready();
    const points = data.filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y)).slice(0, 1024);
    if (points.length < 16)
      throw new Error('Surrogate training needs at least 16 finite points on the y trace.');
    const xmin = Math.min(...points.map((p) => p.x)),
      xmax = Math.max(...points.map((p) => p.x)),
      ymin = Math.min(...points.map((p) => p.y)),
      ymax = Math.max(...points.map((p) => p.y)),
      ys = ymax - ymin || 1;
    if (xmin === xmax) throw new Error('Training requires a varying x coordinate.');
    const train = points.filter((_, i) => i % 4 !== 0),
      test = points.filter((_, i) => i % 4 === 0),
      nx = (x) => (2 * (x - xmin)) / (xmax - xmin) - 1,
      ny = (y) => (y - ymin) / ys;
    const tensors = [],
      tensor = (rows) => {
        const value = tf.tensor2d(rows);
        tensors.push(value);
        return value;
      };
    const x = tensor(train.map((p) => [nx(p.x)])),
      y = tensor(train.map((p) => [ny(p.y)])),
      tx = tensor(test.map((p) => [nx(p.x)]));
    const model = tf.sequential({
      layers: [
        tf.layers.dense({
          inputShape: [1],
          units: 16,
          activation: 'tanh',
          kernelInitializer: tf.initializers.glorotUniform({ seed: 42 }),
        }),
        tf.layers.dense({
          units: 16,
          activation: 'tanh',
          kernelInitializer: tf.initializers.glorotUniform({ seed: 43 }),
        }),
        tf.layers.dense({
          units: 1,
          kernelInitializer: tf.initializers.glorotUniform({ seed: 44 }),
        }),
      ],
    });
    const optimizer = tf.train.adam(0.01);
    model.compile({ optimizer, loss: 'meanSquaredError' });
    try {
      await model.fit(x, y, { epochs: 120, batchSize: 32, shuffle: false, verbose: 0 });
      const prediction = model.predict(tx);
      tensors.push(prediction);
      const held = await prediction.data();
      const rmse = Math.sqrt(
        test.reduce((s, p, i) => s + (held[i] * ys + ymin - p.y) ** 2, 0) / test.length,
      );
      const grid = tensor(points.map((p) => [nx(p.x)])),
        all = model.predict(grid);
      tensors.push(all);
      const values = await all.data();
      self.postMessage({
        rmse,
        curves: [
          {
            label: 'Analytical / numerical reference',
            points: points.map((p) => ({ x: p.x, y: p.y })),
          },
          {
            label: 'Neural surrogate (1→16→16→1)',
            points: points.map((p, i) => ({ x: p.x, y: values[i] * ys + ymin })),
          },
        ],
      });
    } finally {
      tensors.forEach((t) => t.dispose());
      model.dispose();
      optimizer.dispose();
    }
  } catch (e) {
    self.postMessage({ error: e.message });
  }
};
