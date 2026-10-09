import {
  clippedUpdate,
  moments,
  noisePool,
  sample,
  validateConfig,
} from "./simulation.mjs";

const METHODS = ["reinforce", "pathwise"];

/** Match the simulator's paired estimates with a preview of at most 256 paths. */
export function createExplorerEvaluator() {
  let key = "";
  let innovations;
  return (initial, cfg, methods = METHODS) => {
    validateConfig(cfg);
    if (initial.length !== 2 || !initial.every(Number.isFinite))
      throw new Error("Initial state must be a finite pair");
    if (methods.some((method) => !METHODS.includes(method)))
      throw new Error("Unknown explorer method");
    const nextKey = `${cfg.seed}:${cfg.horizon}:${cfg.samples}`;
    if (key !== nextKey) {
      innovations = noisePool(cfg.samples, cfg.horizon, cfg.seed);
      key = nextKey;
    }
    const accumulators = Object.fromEntries(
      [...new Set(methods)].map((method) => [method, moments(2)]),
    );
    const paths = [];
    const stride = 2 * cfg.horizon;
    for (let i = 0; i < cfg.samples; i++) {
      const result = sample(
        initial,
        cfg,
        innovations.subarray(i * stride, (i + 1) * stride),
        i < 256,
      );
      for (const [method, accumulator] of Object.entries(accumulators))
        accumulator.add(result[method]);
      if (result.path)
        paths.push({ points: result.path, reward: result.reward });
    }
    const estimates = Object.fromEntries(
      Object.entries(accumulators).map(([method, accumulator]) => {
        const estimate = accumulator.result();
        estimate.update = clippedUpdate(estimate.mean, cfg);
        return [method, estimate];
      }),
    );
    return { initial: [...initial], cfg: { ...cfg }, estimates, paths };
  };
}
