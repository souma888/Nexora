export function computerVisual(v, frame, { box, path, arrow, text }) {
  let drawing = '',
    height = 280;
  const caption = (message) => {
    const words = String(message ?? '').split(' '),
      lines = [''];
    for (const word of words) {
      if ((lines.at(-1) + ' ' + word).length > 48) lines.push(word);
      else lines[lines.length - 1] += (lines.at(-1) ? ' ' : '') + word;
    }
    return lines
      .slice(0, 2)
      .map((line, i) => text(260, 24 + i * 18, line, 'var(--muted)'))
      .join('');
  };
  if (v.type === 'word') {
    const rows = frame?.rows ?? v.rows,
      detail = frame?.detail ?? v.detail,
      max = Math.max(...rows.map((r) => r[1].length + (r[2] ?? 0))),
      size = Math.min(32, 340 / max),
      start = 130;
    height = Math.max(270, 85 + rows.length * 50);
    drawing = caption(detail);
    drawing += rows
      .map(
        ([name, bits, offset], row) =>
          text(110, 85 + row * 50, name, 'var(--muted)', 'end') +
          [...bits]
            .map((bit, i) => {
              const column = (offset ?? max - bits.length) + i,
                x = start + column * size,
                color =
                  v.active?.includes(column) || frame?.active?.includes(column)
                    ? 'var(--load)'
                    : bit === '1'
                      ? 'var(--result)'
                      : 'var(--muted)';
              return (
                box(x, 60 + row * 50, size - 3, 36, color) +
                text(x + (size - 3) / 2, 84 + row * 50, bit, color)
              );
            })
            .join(''),
      )
      .join('');
    drawing += text(300, height - 14, 'Most significant bit at left', 'var(--muted)');
  } else if (v.type === 'cpu') {
    drawing =
      caption(`Time ${frame.time} · ${frame.detail}`) +
      box(205, 70, 110, 52, 'var(--result)') +
      text(
        260,
        103,
        frame.current === null ? 'CPU ready' : `Dispatch P${frame.current}`,
        'var(--result)',
      );
    drawing += text(
      260,
      155,
      `Ready queue: ${frame.ready.length ? frame.ready.map((i) => `P${i}`).join(' → ') : 'empty'}`,
      'var(--muted)',
    );
    drawing +=
      frame.timeline
        .map((segment, i) => {
          const x = 35 + (450 * segment.start) / v.total,
            width = (450 * (segment.end - segment.start)) / v.total,
            color =
              segment.label === 'CS'
                ? 'var(--muted)'
                : i === frame.timeline.length - 1
                  ? 'var(--result)'
                  : 'var(--curve)';
          return (
            box(x, 190, Math.max(1, width - 1), 32, color) +
            (width > 25 ? text(x + width / 2, 212, segment.label, color) : '')
          );
        })
        .join('') +
      text(35, 247, 0, 'var(--muted)') +
      text(485, 247, v.total, 'var(--muted)') +
      text(260, 275, 'Gantt timeline · CS is process-switch overhead', 'var(--muted)');
  } else if (v.type === 'pages') {
    const size = 360 / frame.slots.length,
      start = 80;
    drawing =
      caption(`Reference ${frame.position} · page ${frame.page ?? '—'} · ${frame.policy}`) +
      frame.slots
        .map(
          (page, i) =>
            box(
              start + i * size,
              80,
              size - 8,
              60,
              i === frame.slot ? 'var(--load)' : 'var(--curve)',
            ) +
            text(start + (i + 0.5) * size - 4, 118, page ?? '∅') +
            text(start + (i + 0.5) * size - 4, 165, `Frame ${i}`, 'var(--muted)') +
            text(start + (i + 0.5) * size - 4, 187, `R=${frame.reference[i]}`, 'var(--muted)'),
        )
        .join('');
    if (frame.policy === 'CLOCK') {
      const x = start + (frame.hand + 0.5) * size - 4;
      drawing += arrow(x, 225, x, 198, 'var(--result)') + text(x, 245, 'hand', 'var(--result)');
    }
    drawing += text(
      260,
      275,
      frame.detail.length > 60 ? frame.detail.slice(0, 58) + '…' : frame.detail,
      'var(--muted)',
    );
  } else if (v.type === 'predictor') {
    const labels =
        v.predictor === 'one'
          ? ['Not taken', 'Taken']
          : ['Strong NT', 'Weak NT', 'Weak T', 'Strong T'],
      size = 420 / labels.length,
      start = 50;
    drawing = caption(
      `Branch ${frame.cycle} · predicted ${frame.prediction ?? '—'}, actual ${frame.outcome ?? '—'}${frame.correct === undefined ? '' : frame.correct ? ' · correct' : ' · miss'}`,
    );
    drawing += labels
      .map(
        (name, i) =>
          box(
            start + i * size,
            100,
            size - 12,
            70,
            frame.state === i
              ? 'var(--result)'
              : frame.before === i
                ? 'var(--load)'
                : 'var(--border)',
          ) +
          text(start + (i + 0.5) * size - 6, 127, `State ${i}`) +
          text(start + (i + 0.5) * size - 6, 152, name, 'var(--muted)'),
      )
      .join('');
    if (frame.outcome !== null) {
      const a = start + (frame.before + 0.5) * size - 6,
        b = start + (frame.state + 0.5) * size - 6;
      drawing +=
        a === b
          ? path(
              `M${a - 15} 95C${a - 45} 35 ${a + 45} 35 ${a + 15} 95`,
              'var(--load)',
              2,
              'marker-end="url(#model-arrow)"',
            )
          : arrow(a, 75, b, 75, 'var(--load)');
    }
    drawing += text(
      260,
      225,
      'Predict from the old state; update after resolution',
      'var(--muted)',
    );
  }
  return { drawing, height, wide: true };
}
