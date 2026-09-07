import { useEffect, useState } from "react";
import type { RefObject } from "react";

export default function useChartLayout(ref: RefObject<HTMLDivElement | null>) {
  const [layout, setLayout] = useState({ width: 0, revision: 0 });

  useEffect(() => {
    const plot = ref.current;
    if (!plot) return;
    let disposed = false;
    const refresh = () => {
      if (!disposed) {
        setLayout((current) => ({
          width: plot.clientWidth,
          revision: current.revision + 1,
        }));
      }
    };
    const resize = new ResizeObserver(refresh);
    resize.observe(plot);
    const theme = new MutationObserver(refresh);
    theme.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    const deviceTheme = matchMedia("(prefers-color-scheme: dark)");
    deviceTheme.addEventListener("change", refresh);
    void document.fonts.ready.then(refresh);

    return () => {
      disposed = true;
      resize.disconnect();
      theme.disconnect();
      deviceTheme.removeEventListener("change", refresh);
    };
  }, [ref]);

  return layout;
}
