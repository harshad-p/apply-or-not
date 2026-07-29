import { createRequire } from "node:module";
import {
  jobs,
  preparedUserCriteria,
  userCriteria,
} from "./jobs.mjs";

const require = createRequire(import.meta.url);
const { buildFastLocalRequest } = require(
  "../../extension/shared/analysis-contract.js",
);
const model = "qwen3.5:2b-q4_K_M";

for (const job of jobs) {
  const payload = {
    userCriteria,
    preparedUserCriteria,
    preferredLanguage: "English",
    job: {
      title: job.title,
      company: job.company,
      description: job.description,
      application: { method: "external_apply", status: "unknown" },
      languageCandidates: [],
    },
  };
  const productionRequest = buildFastLocalRequest(payload, model);
  const startedAt = performance.now();
  const response = await fetch("http://127.0.0.1:11434/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: productionRequest.messages,
      format: productionRequest.response_format.json_schema.schema,
      stream: false,
      think: false,
      keep_alive: "30m",
      options: {
        temperature: 0,
        num_ctx: 4096,
        num_predict: productionRequest.max_tokens,
      },
    }),
  });
  const body = await response.json();
  process.stdout.write(
    `${JSON.stringify({
      job: job.id,
      durationSeconds: Number(
        ((performance.now() - startedAt) / 1000).toFixed(1),
      ),
      promptTokens: body.prompt_eval_count,
      completionTokens: body.eval_count,
      output: JSON.parse(body?.message?.content || "null"),
    })}\n`,
  );
}
