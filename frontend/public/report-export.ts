import { labManifest } from '../../backend/lab-manifest.js';
import type { Report } from './run-tools.ts';

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob),
    a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export async function plotImage(container: ParentNode = document): Promise<HTMLCanvasElement> {
  const source = [
    ...container.querySelectorAll<SVGSVGElement>(
      '#wave-plot, #plot, #beam-diagram, #material-diagram, #algorithm-visual svg, #visual svg, #diagram, .run-comparison svg, .analysis-output svg',
    ),
  ].filter((svg) => svg.getBoundingClientRect().width > 0);
  if (!source.length)
    source.push(
      ...[...container.querySelectorAll<SVGSVGElement>('.plot svg, #plot, #beam-plot')].filter(
        (s) => s.getBoundingClientRect().width > 0,
      ),
    );
  if (!source.length) {
    const visual = container.querySelector<HTMLElement>('#visual');
    if (visual) {
      const { default: html2canvas } = await import('html2canvas');
      return html2canvas(visual, {
        scale: 2,
        backgroundColor:
          getComputedStyle(document.documentElement).getPropertyValue('--plot-bg').trim() ||
          '#0c0d10',
      });
    }
    throw new Error('No visible plot is available. Open a lab or analysis plot first.');
  }
  const canvas = document.createElement('canvas');
  canvas.width = 1400;
  const sizes = source.map((s) => {
    const box = s.viewBox.baseVal;
    return box.width ? box.height / box.width : 0.5;
  });
  canvas.height = Math.ceil(sizes.reduce((s, r) => s + 1400 * r + 32, 40));
  const context = canvas.getContext('2d')!;
  context.fillStyle =
    getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || '#0f1013';
  context.fillRect(0, 0, canvas.width, canvas.height);
  let top = 20;
  for (const [i, svg] of source.entries()) {
    const copy = svg.cloneNode(true) as SVGSVGElement,
      originals = [svg, ...svg.querySelectorAll('*')],
      copies = [copy, ...copy.querySelectorAll('*')];
    originals.forEach((node, j) => {
      const css = getComputedStyle(node);
      for (const key of [
        'fill',
        'stroke',
        'stroke-width',
        'font-family',
        'font-size',
        'font-weight',
        'color',
        'opacity',
        'stroke-dasharray',
      ])
        copies[j].setAttribute(key, css.getPropertyValue(key));
    });
    copy.querySelectorAll('script,foreignObject').forEach((n) => n.remove());
    copy.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    copy.setAttribute('width', '1400');
    copy.setAttribute('height', String(1400 * sizes[i]));
    const image = new Image();
    image.src =
      'data:image/svg+xml;charset=utf-8,' +
      encodeURIComponent(new XMLSerializer().serializeToString(copy));
    await image.decode();
    context.drawImage(image, 0, top, 1400, 1400 * sizes[i]);
    top += 1400 * sizes[i] + 32;
  }
  return canvas;
}
export async function exportPNG(name: string) {
  const canvas = await plotImage();
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Could not encode plot.'))),
      'image/png',
    ),
  );
  download(blob, `nexora-${name}.png`);
}
export async function exportPDF(
  model: string,
  version: string,
  input: Record<string, number | string>,
  data: Report,
  units: Record<string, string>,
) {
  const { jsPDF } = await import('jspdf'),
    pdf = new jsPDF();
  const font = await fetch(new URL('./fonts/report/Lato-Regular.ttf', import.meta.url));
  if (!font.ok) throw new Error('The PDF font could not be loaded.');
  const bytes = new Uint8Array(await font.arrayBuffer());
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  pdf.addFileToVFS('Lato.ttf', btoa(binary));
  pdf.addFont('Lato.ttf', 'Lato', 'normal');
  pdf.setFont('Lato');
  let y = 20;
  const write = (text: string, size = 10) => {
    pdf.setFontSize(size);
    for (const line of pdf.splitTextToSize(text, 174)) {
      if (y > 275) {
        pdf.addPage();
        y = 20;
      }
      pdf.text(line, 18, y);
      y += size * 0.45 + 2;
    }
  };
  write(document.querySelector('h1')?.textContent?.trim() ?? model, 20);
  write(`Nexora lab report · ${new Date().toISOString()}`);
  write(`Model ${model} · solver ${version}`);
  write('Inputs (canonical solver units)', 13);
  const definition = labManifest.find((entry) => entry.id === model)?.model.definition;
  const fields = (definition?.inputs ?? {}) as Record<
    string,
    { label?: string; unit?: string; unitByCase?: Record<string, string> }
  >;
  for (const [key, value] of Object.entries(input)) {
    const field = fields[key],
      label = field?.label ?? key,
      unit = field?.unitByCase?.[String(input.case)] ?? field?.unit ?? '';
    write(`${label}: ${value}${unit ? ' ' + unit : ''}`);
  }
  write('Computed results', 13);
  for (const [key, value] of Object.entries(data.summary ?? data.stats ?? {}))
    write(
      `${key}: ${typeof value === 'number' ? value.toPrecision(8) : JSON.stringify(value)} ${units[key] ?? ''}`,
    );
  try {
    const canvas = await plotImage();
    let top = 0;
    while (top < canvas.height) {
      if (y > 150) {
        pdf.addPage();
        y = 20;
      }
      const available = 270 - y,
        heightPixels = Math.min(canvas.height - top, Math.floor((available * canvas.width) / 174)),
        page = document.createElement('canvas');
      page.width = canvas.width;
      page.height = heightPixels;
      page
        .getContext('2d')!
        .drawImage(canvas, 0, top, canvas.width, heightPixels, 0, 0, canvas.width, heightPixels);
      const height = (174 * heightPixels) / canvas.width;
      pdf.addImage(page.toDataURL('image/png'), 'PNG', 18, y, 174, height);
      y += height + 10;
      top += heightPixels;
      if (top < canvas.height) {
        pdf.addPage();
        y = 20;
      }
    }
  } catch {
    write('No visible SVG chart was available for this report.');
  }
  const notes = document.querySelector('#model')?.textContent?.replace(/\s+/g, ' ').trim();
  if (notes) {
    write('Model notes and limits', 13);
    write(notes.slice(0, 10000));
  }
  write(
    'Educational model. Check assumptions and validation cases before interpreting results. Inputs and outputs are recorded here; this report is not a design certification.',
  );
  pdf.save(`nexora-${model}.pdf`);
}
