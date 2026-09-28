/** "This month": a small pill on top of a hairline, rather than a band that washes out a column. */
export const CurrentMonthBadge = ({ viewBox, label, color }: {
  viewBox?: { x?: number; y?: number };
  label: string;
  color: string;
}) => {
  const x = viewBox?.x ?? 0;
  const y = viewBox?.y ?? 0;
  const height = 18;
  const width = Math.max(52, label.length * 7.5 + 16);
  return (
    <g transform={`translate(${x - width / 2}, ${y - height - 6})`}>
      <rect width={width} height={height} rx={height / 2} fill={color} />
      <text x={width / 2} y={height / 2} textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight="bold" fill="#ffffff">
        {label}
      </text>
    </g>
  );
};
