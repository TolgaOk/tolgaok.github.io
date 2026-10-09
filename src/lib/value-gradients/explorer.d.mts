export const DEFAULT_FIELD: "inertial";
export const DEFAULT_SAMPLE_COUNT: 64;

export interface ExplorerInstance {
  redraw: () => void;
  configure: (field: string, samples: number) => void;
  dispose: () => void;
}
export function mountExplorer(
  element: HTMLDivElement,
  id: string,
  onReset?: () => void,
): ExplorerInstance;
