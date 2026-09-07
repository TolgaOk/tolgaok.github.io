# /// script
# requires-python = ">=3.11"
# dependencies = ["jaxdp==0.4.0"]
# ///
"""Generate the iteration traces used by the JAXDP post."""

from __future__ import annotations

import json
from collections.abc import Callable
from pathlib import Path
from typing import Any

import jax
import jax.numpy as jnp

jax.config.update("jax_enable_x64", True)

import jaxdp


GAMMA = 0.99
MAX_UPDATES = 500
REFERENCE_UPDATES = 5_000
SAMPLE_UPDATES = (
    *range(1, 21),
    *range(25, 101, 5),
    *range(120, MAX_UPDATES + 1, 20),
)
OUTPUT = Path(__file__).parents[1] / "src/assets/jaxdp/planning-comparison.json"

ENVIRONMENTS = (
    {
        "id": "frozen-lake-deterministic",
        "label": "Frozen Lake",
        "description": "A short deterministic grid",
    },
    {
        "id": "four-rooms",
        "label": "Four Rooms",
        "description": "A larger deterministic grid",
    },
    {
        "id": "forest-long",
        "label": "Long forest",
        "description": "A small continuing problem",
    },
    {
        "id": "garnet-medium",
        "label": "Garnet",
        "description": "Sparse random transitions",
    },
)

AlgorithmFactory = Callable[[], Any]
ALGORITHMS: tuple[tuple[str, str, AlgorithmFactory], ...] = (
    (
        "value-iteration",
        "Value iteration",
        lambda: jaxdp.ValueIteration(gamma=GAMMA),
    ),
    (
        "anchored-vi",
        "Anchored VI",
        lambda: jaxdp.AnchoredValueIteration(gamma=GAMMA),
    ),
    (
        "anderson-vi",
        "Anderson VI",
        lambda: jaxdp.AndersonValueIteration(gamma=GAMMA),
    ),
    (
        "safe-anderson-vi",
        "Safe Anderson VI",
        lambda: jaxdp.SafeAndersonValueIteration(gamma=GAMMA),
    ),
)


def scalar(value: jax.Array) -> float:
    """Keep enough precision for the chart without bloating its static data."""
    return float(f"{float(value):.10g}")


def reference_value(mdp: jaxdp.MDP) -> jax.Array:
    """Approximate the fixed point with a long, deterministic VI run."""
    algorithm = jaxdp.ValueIteration(gamma=GAMMA)
    state = algorithm.init(mdp)
    for _ in range(REFERENCE_UPDATES):
        state = algorithm.update(mdp, state)
    return state.v_val


def trace(
    mdp: jaxdp.MDP,
    optimum: jax.Array,
    make_algorithm: AlgorithmFactory,
) -> list[dict[str, float | int]]:
    """Record residual and fixed-point error after selected planner updates."""
    algorithm = make_algorithm()
    state = algorithm.init(mdp)
    points: list[dict[str, float | int]] = []

    for update in range(1, MAX_UPDATES + 1):
        state = algorithm.update(mdp, state)
        if update not in SAMPLE_UPDATES:
            continue

        bellman_value = jaxdp.bellman_opt_op.v(mdp, state.v_val, GAMMA)
        points.append(
            {
                "update": update,
                "residual": scalar(jnp.max(jnp.abs(bellman_value - state.v_val))),
                "error": scalar(jnp.max(jnp.abs(optimum - state.v_val))),
            }
        )

    return points


def generate() -> dict[str, Any]:
    environments: list[dict[str, Any]] = []

    for environment in ENVIRONMENTS:
        mdp = jaxdp.make(environment["id"])
        optimum = reference_value(mdp)
        series = []

        for algorithm_id, label, make_algorithm in ALGORITHMS:
            series.append(
                {
                    "algorithm": algorithm_id,
                    "label": label,
                    "points": trace(mdp, optimum, make_algorithm),
                }
            )

        environments.append(
            {
                **environment,
                "states": mdp.state_size,
                "actions": mdp.action_size,
                "series": series,
            }
        )

    return {
        "metadata": {
            "jaxdpVersion": jaxdp.__version__,
            "gamma": GAMMA,
            "maxUpdates": MAX_UPDATES,
            "referenceUpdates": REFERENCE_UPDATES,
            "sampleUpdates": list(SAMPLE_UPDATES),
        },
        "environments": environments,
    }


if __name__ == "__main__":
    data = generate()
    OUTPUT.write_text(json.dumps(data, indent=2) + "\n")
    print(f"Wrote {OUTPUT} with {len(data['environments'])} environments")
