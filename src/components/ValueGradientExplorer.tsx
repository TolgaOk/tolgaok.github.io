import { useEffect, useId, useRef, useState } from "react";
import ChartFrame from "./charts/ChartFrame";
import ChartSelect from "./charts/ChartSelect";
import useChartLayout from "./charts/useChartLayout";
import {
  DEFAULT_FIELD,
  DEFAULT_SAMPLE_COUNT,
  mountExplorer,
} from "../lib/value-gradients/explorer.mjs";
import type { ExplorerInstance } from "../lib/value-gradients/explorer.mjs";

const FIELDS = [
  { value: "coupled", label: "Coupled wells" },
  { value: "three", label: "Three wells" },
  { value: "inertial", label: "Inertial well" },
];
const SAMPLES = [4, 16, 64, 256, 1024, 4096, 8192].map((count) => ({
  value: String(count),
  label: String(count),
}));
const METHODS = [
  { value: "reinforce", label: "REINFORCE" },
  { value: "pathwise", label: "Value gradient" },
];

export default function ValueGradientExplorer() {
  const rootRef = useRef<HTMLDivElement>(null);
  const plotRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<ExplorerInstance | null>(null);
  const [field, setField] = useState<string>(DEFAULT_FIELD);
  const [samples, setSamples] = useState(String(DEFAULT_SAMPLE_COUNT));
  const { revision } = useChartLayout(plotRef);
  const id = `value-gradients-${useId().replaceAll(":", "")}`;

  useEffect(() => {
    if (!rootRef.current) return;
    const explorer = mountExplorer(rootRef.current, id, () => {
      setField(DEFAULT_FIELD);
      setSamples(String(DEFAULT_SAMPLE_COUNT));
    });
    instanceRef.current = explorer;
    return () => {
      explorer.dispose();
      instanceRef.current = null;
    };
  }, [id]);

  useEffect(() => {
    instanceRef.current?.configure(field, Number(samples));
  }, [field, samples]);

  useEffect(() => {
    instanceRef.current?.redraw();
  }, [revision]);

  return (
    <ChartFrame
      caption={
        <>
          <strong>Figure 1.</strong> Initial-state ascent in a stochastic field.
          Gray streamlines show the drift, with arrows indicating its direction.
          Thick dashed red and solid blue curves update the initial state using
          REINFORCE and value gradients, respectively, with shared sampled innovations.
          Thin curves preview {Math.min(256, Number(samples)).toLocaleString()}{" "}
          sampled process trajectories, colored by terminal reward. The neutral
          dark trajectory is a zero-noise rollout, not an average. Background
          colors mark terminal reward regions, not attraction basins. Drag the
          ring or use the arrow keys to change the starting state.
        </>
      }
    >
      <div
        ref={rootRef}
        className="chart-simulation"
        data-field={field}
        data-sample-count={samples}
      >
        <div className="chart-control-panel">
          <div className="chart-simulation-controls">
            <div data-control="field-selector">
              <ChartSelect
                id={`${id}-field`}
                label="Field"
                value={field}
                options={FIELDS}
                onChange={setField}
              />
            </div>
            <div data-control="samples-selector">
              <ChartSelect
                id={`${id}-samples`}
                label="Samples"
                value={samples}
                options={SAMPLES}
                onChange={setSamples}
              />
            </div>
            <label
              className="chart-range-control"
              htmlFor={`${id}-step-size`}
              title="Ascent step size; displacement capped at 0.10"
            >
              <span>
                Step size{" "}
                <output
                  data-control="step-size-value"
                  htmlFor={`${id}-step-size`}
                >
                  0.020
                </output>
              </span>
              <input
                id={`${id}-step-size`}
                data-control="step-size"
                type="range"
                min="0.001"
                max="0.2"
                step="0.001"
                defaultValue="0.02"
              />
            </label>
            <label className="chart-range-control" htmlFor={`${id}-steps`}>
              <span>
                Steps{" "}
                <output data-control="path-steps-value" htmlFor={`${id}-steps`}>
                  40
                </output>
              </span>
              <input
                id={`${id}-steps`}
                data-control="path-steps"
                type="range"
                min="1"
                max="1000"
                step="1"
                defaultValue="40"
              />
            </label>
          </div>
          <div className="chart-layer-controls">
            <fieldset>
              <legend className="sr-only">Gradient estimators</legend>
              {METHODS.map((method) => (
                <label key={method.value} data-method={method.value}>
                  <input
                    data-control={`show-${method.value}`}
                    type="checkbox"
                    role="switch"
                    defaultChecked
                  />
                  {method.label}
                </label>
              ))}
            </fieldset>
            <div className="chart-action-buttons">
              <button data-control="resample" type="button">
                Resample
              </button>
              <button data-control="reset" type="button">
                Reset
              </button>
            </div>
          </div>
        </div>
        <p data-control="error" className="chart-error" role="alert" hidden />
        <span data-control="status" className="sr-only" role="status" />
        <div ref={plotRef} className="chart-plot chart-phase-plane">
          <svg
            role="group"
            aria-label="Interactive initial-state gradient comparison"
            viewBox="0 0 900 630"
          />
        </div>
      </div>
    </ChartFrame>
  );
}
