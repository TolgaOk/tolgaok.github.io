# /// script
# requires-python = ">=3.11"
# dependencies = ["jaxdp==0.4.0"]
# ///
"""Benchmark one million vmapped JAXDP planner updates for the JAXDP post."""

from __future__ import annotations

import json
import platform
import re
import statistics
import subprocess
import time
from collections.abc import Callable
from pathlib import Path
from typing import Any

import chex
import jax
import jax.numpy as jnp

jax.config.update("jax_enable_x64", True)

import jaxdp


STEPS = 1_000
SETTINGS = 1_000
TOTAL_UPDATES = STEPS * SETTINGS
GAMMA_MIN = 0.9
GAMMA_MAX = 0.999
WARMUPS = 1
REPETITIONS = 5
OUTPUT = Path(__file__).parents[1] / "src/assets/jaxdp/million-update-benchmark.json"

ENVIRONMENTS = (
    ("frozen-lake-deterministic", "Frozen Lake"),
    ("four-rooms", "Four Rooms"),
    ("forest-long", "Long forest"),
    ("garnet-medium", "Garnet"),
)

AlgorithmFactory = Callable[[jax.Array], Any]
ALGORITHMS: tuple[tuple[str, str, AlgorithmFactory], ...] = (
    (
        "value-iteration",
        "Value iteration",
        lambda gamma: jaxdp.ValueIteration(gamma=gamma),
    ),
    (
        "anchored-vi",
        "Anchored VI",
        lambda gamma: jaxdp.AnchoredValueIteration(gamma=gamma),
    ),
    (
        "anderson-vi",
        "Anderson VI",
        lambda gamma: jaxdp.AndersonValueIteration(gamma=gamma),
    ),
    (
        "safe-anderson-vi",
        "Safe Anderson VI",
        lambda gamma: jaxdp.SafeAndersonValueIteration(gamma=gamma),
    ),
)


def hardware_label() -> str:
    """Return a useful device label without storing machine identifiers."""
    if platform.system() == "Darwin":
        result = subprocess.run(
            ["system_profiler", "SPHardwareDataType"],
            capture_output=True,
            check=False,
            text=True,
        )
        match = re.search(r"^\s*Chip:\s*(.+)$", result.stdout, re.MULTILINE)
        if match:
            return f"{match.group(1)} CPU"
    return f"{jax.devices()[0].device_kind} ({platform.machine()})"


def percentile(samples: list[float], fraction: float) -> float:
    """Linearly interpolate a percentile from a nonempty sample."""
    ordered = sorted(samples)
    position = (len(ordered) - 1) * fraction
    lower = int(position)
    upper = min(lower + 1, len(ordered) - 1)
    weight = position - lower
    return ordered[lower] * (1 - weight) + ordered[upper] * weight


def benchmark(
    mdp: jaxdp.MDP,
    make_algorithm: AlgorithmFactory,
) -> list[float]:
    """Time a compiled sweep containing exactly one million update calls."""
    gammas = jnp.linspace(GAMMA_MIN, GAMMA_MAX, SETTINGS)

    def run_one(gamma: jax.Array) -> jax.Array:
        algorithm = make_algorithm(gamma)
        state = algorithm.init(mdp)
        state = jax.lax.fori_loop(
            0,
            STEPS,
            lambda _, current: algorithm.update(mdp, current),
            state,
        )
        return state.v_val

    vmapped = chex.chexify(jax.jit(jax.vmap(run_one)), async_check=False)
    for _ in range(WARMUPS):
        values = vmapped(gammas)
        jax.block_until_ready(values)
        if not bool(jnp.isfinite(values).all()):
            raise RuntimeError("Planner returned a non-finite value during warmup")

    samples = []
    for _ in range(REPETITIONS):
        started = time.perf_counter_ns()
        values = vmapped(gammas)
        jax.block_until_ready(values)
        elapsed_seconds = (time.perf_counter_ns() - started) / 1_000_000_000
        if not bool(jnp.isfinite(values).all()):
            raise RuntimeError("Planner returned a non-finite value")
        samples.append(elapsed_seconds)
    return samples


def generate() -> dict[str, Any]:
    """Run the benchmark and return its serializable data."""
    environments: list[dict[str, Any]] = []

    for environment_id, label in ENVIRONMENTS:
        mdp = jaxdp.make(environment_id)
        timings = []

        for algorithm_id, algorithm_label, make_algorithm in ALGORITHMS:
            print(f"{label}: {algorithm_label}", flush=True)
            samples = benchmark(mdp, make_algorithm)
            timings.append(
                {
                    "algorithm": algorithm_id,
                    "label": algorithm_label,
                    "medianSeconds": statistics.median(samples),
                    "p25Seconds": percentile(samples, 0.25),
                    "p75Seconds": percentile(samples, 0.75),
                }
            )

        environments.append(
            {
                "id": environment_id,
                "label": label,
                "states": mdp.state_size,
                "actions": mdp.action_size,
                "timings": timings,
            }
        )

    chex.block_until_chexify_assertions_complete()
    return {
        "metadata": {
            "jaxdpVersion": jaxdp.__version__,
            "jaxVersion": jax.__version__,
            "backend": jax.default_backend(),
            "device": hardware_label(),
            "stepsPerSetting": STEPS,
            "settings": SETTINGS,
            "totalUpdates": TOTAL_UPDATES,
            "hyperparameter": "discount factor",
            "gammaMin": GAMMA_MIN,
            "gammaMax": GAMMA_MAX,
            "warmups": WARMUPS,
            "repetitions": REPETITIONS,
            "statistic": "median",
            "includesCompilation": False,
            "includesInitialization": True,
            "x64": True,
        },
        "environments": environments,
    }


if __name__ == "__main__":
    result = generate()
    OUTPUT.write_text(json.dumps(result, indent=2) + "\n")
    print(f"Wrote {OUTPUT}")
