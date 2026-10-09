/** Refine method trajectories without blocking live sampled paths or gradient arrows. */
import { ascentPaths, createGradientEvaluator } from './simulation.mjs';

const evaluate = createGradientEvaluator();
let generation = 0;
self.onmessage = async ({ data }) => {
  const job = ++generation;
  if (data.cancel) return;
  try {
    for (const progress of ascentPaths(data.initial, data.cfg, data.methods, data.steps, evaluate, data.initialEstimates)) {
      if (job !== generation) return;
      if (progress.done || progress.traces.some(trace => trace.points.length > 1)) self.postMessage({ version: data.version, ...progress });
      if (progress.done) return;
      await new Promise(resolve => setTimeout(resolve, 0));
      if (job !== generation) return;
    }
  } catch (error) {
    if (job === generation) self.postMessage({ version: data.version, error: error.message });
  }
};
