import "server-only";

import {
  addPublicEnv,
  buildSharedEnvSignals,
  createEmptyPublicEnvReport,
  findVariableValue,
} from "@/lib/analysis/public-env-shared";
import { scrapePage } from "@/lib/analysis/scrape-page";

export async function analyzeChatGPTPublicEnv(url: string) {
  const page = await scrapePage(url);
  const signals = buildSharedEnvSignals(page);
  const report = createEmptyPublicEnvReport();
  const seen = new Set<string>();

  for (const variable of signals.variables) {
    addPublicEnv(report, seen, "variables", {
      name: variable,
      value: findVariableValue(signals.blob, variable),
      cat: "Public Build Variable",
      source: "HTML or bundled script",
      confidence: "high",
    });
  }

  for (const endpoint of signals.endpoints.slice(0, 12)) {
    addPublicEnv(report, seen, "endpoints", {
      name: endpoint.startsWith("/api/") ? endpoint : new URL(endpoint, page.finalUrl).hostname,
      value: endpoint,
      cat: endpoint.startsWith("/api/") ? "Internal API Route" : "Public Endpoint",
      source: "Linked script or markup",
      confidence: "medium",
    });
  }

  if (signals.lowerBlob.includes("vercel_env") || signals.lowerBlob.includes("next_public")) {
    addPublicEnv(report, seen, "buildClues", {
      name: "Next.js Public Build",
      value: "Public Next.js variables are exposed in the rendered bundle.",
      cat: "Build Clue",
      source: "Client payload",
      confidence: "high",
    });
  }

  if (signals.lowerBlob.includes("import.meta.env")) {
    addPublicEnv(report, seen, "buildClues", {
      name: "Vite Import Meta",
      value: "Client bundle references import.meta.env public variables.",
      cat: "Build Clue",
      source: "Bundled script",
      confidence: "high",
    });
  }

  return report;
}
