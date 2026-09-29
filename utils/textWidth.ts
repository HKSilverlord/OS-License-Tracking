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
