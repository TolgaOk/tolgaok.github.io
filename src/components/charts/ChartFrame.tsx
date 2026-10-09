import type { CSSProperties, ReactNode } from "react";
import "./ScientificChart.css";

export default function ChartFrame({
  children,
  fontScale = 1.2,
  caption,
}: {
  children: ReactNode;
  fontScale?: number;
  caption?: ReactNode;
}) {
  return (
    <figure
      className="scientific-chart not-prose"
      style={{ "--figure-font-scale": fontScale } as CSSProperties}
    >
      {children}
      {caption && <figcaption className="chart-caption">{caption}</figcaption>}
    </figure>
  );
}
