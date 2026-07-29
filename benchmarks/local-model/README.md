# Local model benchmark

These benchmark cases are permanent regression fixtures:

- Amazon: <https://www.linkedin.com/jobs/view/4443282293/>
- Remmert: <https://www.linkedin.com/jobs/view/4444117074/>

The Amazon case verifies that `Java, C++, or C#` is treated as an alternative
requirement and that no language requirement is invented. The Remmert case
verifies an exact C#/.NET/Blazor match alongside an explicit German-language
penalty and a satisfied English requirement.

## 30-second experiment — 2026-07-29

Hardware path: local Ollama, 100% CPU. Each duration excludes model download.

The existing full extension contract did not finish its English case within a
45-second cutoff for Qwen 2.5 1.5B, Llama 3.2 1B, Gemma 3 1B, or Qwen 3.5
0.8B. The separate German translator added roughly 125–140 seconds for the
Remmert case. Those paths cannot meet a 30-second total on this machine.

A compact prototype reduced the request to roughly 278–293 prompt tokens,
disabled hidden reasoning, selected only decision-bearing job evidence, and
requested four small fields. Results:

| Model | Amazon | Remmert | Correctness |
|---|---:|---:|---|
| Qwen 2.5 1.5B | 5.8s | 1.9s | Failed German conflict |
| Llama 3.2 1B | 8.1s | 4.6s | Failed German conflict |
| Gemma 3 1B | 6.6s | 4.7s | Failed German conflict |
| Qwen 3.5 2B Q4_K_M | 4.9s | 5.2s | Passed both cases |

Qwen 3.5 2B was the only tested model that met the timing target and correctly
classified both benchmark cases. It returned:

- Amazon: skills match, no explicit language requirement.
- Remmert: skills match, German conflict.

These results validate a possible production direction; the prototype is not
yet the extension's production analysis path. Production adoption must
generalize evidence selection beyond these two fixtures and retain the raw job
description as a fallback so speed does not silently reduce result quality.

## Commands

Run the existing production-shaped benchmark:

```sh
node benchmarks/local-model/run.mjs
```

Run the compact experimental contract:

```sh
node benchmarks/local-model/run-fast-prototype.mjs qwen3.5:2b-q4_K_M
```
