let measuring: { context: CanvasRenderingContext2D | null; family: string } | null = null;

/**
 * A chart figure's width, measured in the page's font on a canvas: a chart has
 * no layout to measure before it draws. A per-character guess ran a third wide,
 * which moved figures that had room where they were.
 */
export const textWidth = (text: string, fontSize: number, bold: boolean): number => {
  measuring ??= {
    context: document.createElement('canvas').getContext('2d'),
    family: getComputedStyle(document.body).fontFamily,
  };
  const { context, family } = measuring;
  if (!context) return text.length * fontSize * (bold ? 0.62 : 0.56);
  context.font = `${bold ? 'bold' : 'normal'} ${fontSize}px ${family}`;
  return context.measureText(text).width;
};

/**
 * The first of `sizes` at which every label fits in `room` px and keeps `gap`
 * px from the next; the last size if none does.
 */
export const fittingFontSize = (labels: string[], room: number, sizes: readonly number[], bold: boolean, gap = 8): number =>
  sizes.find(size => labels.every(label => textWidth(label, size, bold) + gap <= room)) ?? sizes[sizes.length - 1];
