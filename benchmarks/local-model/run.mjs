import { analyzeWithLocalModel } from "../../local-relay/local-provider.mjs";
import {
  jobs,
  preparedUserCriteria,
  userCriteria,
} from "./jobs.mjs";

const defaultModels = [
  "qwen2.5:1.5b",
  "llama3.2:1b",
  "gemma3:1b",
];
const models = process.argv.slice(2).length
  ? process.argv.slice(2)
  : defaultModels;
const targetMs = 30_000;
const cutoffMs = Number(process.env.BENCHMARK_CUTOFF_MS || 90_000);
const results = [];

async function warmModel(model) {
  const startedAt = performance.now();
  const response = await fetch("http://127.0.0.1:11434/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      prompt: "",
      stream: false,
      keep_alive: "30m",
    }),
  });
  if (!response.ok) {
    throw new Error(`Warm-up failed (${response.status}).`);
  }
  await response.json();
  return performance.now() - startedAt;
}

function evaluate(analysis, expected) {
  const failures = [];
  if (!expected.recommendation.includes(analysis.recommendation)) {
    failures.push(`recommendation=${analysis.recommendation}`);
  }
  if (analysis.score < expected.minimumScore) {
    failures.push(`score<${expected.minimumScore}`);
  }
  if (
    Number.isFinite(expected.maximumScore) &&
    analysis.score > expected.maximumScore
  ) {
    failures.push(`score>${expected.maximumScore}`);
  }
  if (analysis.rubric.skills.outcome !== expected.skillsOutcome) {
    failures.push(`skills=${analysis.rubric.skills.outcome}`);
  }
  if (!expected.languageOutcome.includes(analysis.rubric.language.outcome)) {
    failures.push(`language=${analysis.rubric.language.outcome}`);
  }
  if (
    Number.isInteger(expected.languageRequirementCount) &&
    analysis.languageRequirements.length !== expected.languageRequirementCount
  ) {
    failures.push(
      `languageRequirements=${analysis.languageRequirements.length}`,
    );
  }
  for (const language of expected.requiredLanguages || []) {
    if (
      !analysis.languageRequirements.some(
        (requirement) =>
          requirement.language.toLocaleLowerCase() ===
          language.toLocaleLowerCase(),
      )
    ) {
      failures.push(`missing ${language}`);
    }
  }
  return failures;
}

for (const model of models) {
  const warmupMs = await warmModel(model);
  for (const job of jobs) {
    const startedAt = performance.now();
    let metrics = {};
    try {
      const analysis = await analyzeWithLocalModel(
        {
          userCriteria,
          preparedUserCriteria,
          preferredLanguage: "English",
          job: {
            title: job.title,
            company: job.company,
            description: job.description,
            application: { method: "external_apply", status: "unknown" },
          },
        },
        {
          id: "local",
          baseUrl: "http://127.0.0.1:11434/v1",
          model,
        },
        {
          timeoutMs: cutoffMs,
          ...(process.env.BENCHMARK_SKIP_TRANSLATION === "1"
            ? { translateImpl: async (text) => text }
            : {}),
          onMetrics(value) {
            metrics = value;
          },
        },
      );
      const durationMs = performance.now() - startedAt;
      const failures = evaluate(analysis, job.expected);
      results.push({
        model,
        warmupSeconds: Number((warmupMs / 1000).toFixed(1)),
        job: job.id,
        durationSeconds: Number((durationMs / 1000).toFixed(1)),
        underTarget: durationMs <= targetMs,
        correct: failures.length === 0,
        failures,
        promptTokens: metrics.promptTokens,
        completionTokens: metrics.completionTokens,
        score: analysis.score,
        recommendation: analysis.recommendation,
        summary: analysis.summary,
      });
    } catch (error) {
      results.push({
        model,
        warmupSeconds: Number((warmupMs / 1000).toFixed(1)),
        job: job.id,
        durationSeconds: Number(
          ((performance.now() - startedAt) / 1000).toFixed(1),
        ),
        underTarget: false,
        correct: false,
        failures: [error.message],
      });
    }
    process.stdout.write(`${JSON.stringify(results.at(-1))}\n`);
  }
}

const passingModels = models.filter((model) => {
  const modelResults = results.filter((result) => result.model === model);
  return (
    modelResults.length === jobs.length &&
    modelResults.every((result) => result.correct && result.underTarget)
  );
});
process.stdout.write(
  `${JSON.stringify({
    targetSeconds: targetMs / 1000,
    passingModels,
    results,
  }, null, 2)}\n`,
);
