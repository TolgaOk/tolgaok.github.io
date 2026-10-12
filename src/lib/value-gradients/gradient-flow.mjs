// A visual reverse-mode schedule, not a numerical gradient calculation.
// Branch order matches the six reverse dependencies in ValueGradientGraph.
export const GRADIENT_BRANCH = Object.freeze({
  NEXT_STATE_TO_STATE: 0,
  POLICY_TO_STATE: 1,
  ACTION_TO_POLICY: 2,
  NEXT_STATE_TO_ACTION: 3,
  REWARD_TO_STATE: 4,
  REWARD_TO_ACTION: 5,
});

/** @param {number} steps Number of complete transitions shown. */
export function createGradientFlowTimeline(steps = 3) {
  const incomingDuration = 750;
  const actionDuration = 350;
  const policyDuration = 350;
  const stepPause = 250;
  const seedPause = 400;
  const stepDuration =
    incomingDuration + actionDuration + policyDuration + stepPause;
  const edges = [];
  const nodes = [{ key: `state-${steps}`, at: 0 }];
  let start = seedPause;

  for (let step = steps - 1; step >= 0; step--) {
    const actionAt = start + incomingDuration;
    const policyAt = actionAt + actionDuration;
    const stateAt = policyAt + policyDuration;
    nodes.push(
      { key: `reward-${step}`, at: start },
      { key: `action-${step}`, at: actionAt },
      { key: `policy-${step}`, at: policyAt },
      { key: `state-${step}`, at: stateAt },
    );
    for (const branch of [0, 3, 4, 5]) {
      edges.push({ step, branch, start, duration: incomingDuration });
    }
    edges.push(
      {
        step,
        branch: GRADIENT_BRANCH.ACTION_TO_POLICY,
        start: actionAt,
        duration: actionDuration,
      },
      {
        step,
        branch: GRADIENT_BRANCH.POLICY_TO_STATE,
        start: policyAt,
        duration: policyDuration,
      },
    );
    start += stepDuration;
  }
  return { edges, nodes, duration: start + 1100 };
}

/** @param {number} time @param {number} start @param {number} duration */
export function gradientFlowProgress(time, start, duration) {
  return Math.max(0, Math.min(1, (time - start) / duration));
}
