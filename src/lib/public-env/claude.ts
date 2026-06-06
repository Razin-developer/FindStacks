import "server-only";

import {
  addPublicEnv,
  buildSharedEnvSignals,
  createEmptyPublicEnvReport,
  findVariableValue,
} from "@/lib/analysis/public-env-shared";
import { scrapePage } from "@/lib/analysis/scrape-page";

function inferEnvPurpose(variable: string) {
  if (/(api|base|url|origin|endpoint)/i.test(variable)) {
    return "API Base URL";
  }
  if (/(key|token|id)/i.test(variable)) {
    return "Public Client Key";
  }
  if (/(site|app|project)/i.test(variable)) {
    return "Project Identifier";
  }
  return "Public Runtime Config";
}

export async function analyzeClaudePublicEnv(url: string) {
  const page = await scrapePage(url);
  const signals = buildSharedEnvSignals(page);
  const report = createEmptyPublicEnvReport();
  const seen = new Set<string>();

  for (const variable of signals.variables) {
    addPublicEnv(report, seen, "variables", {
      name: variable,
      value: findVariableValue(signals.blob, variable),
      cat: inferEnvPurpose(variable),
      source: "Inline script or hydrated payload",
      confidence: "high",
    });
  }

  for (const endpoint of signals.endpoints.slice(0, 14)) {
    addPublicEnv(report, seen, "endpoints", {
      name: endpoint.replace(/^https?:\/\//, "").split("/")[0],
      value: endpoint,
      cat: endpoint.startsWith("/api/") ? "Route Needed To Build Client" : "Resolved Public Service",
      source: "Client-consumable reference",
      confidence: "medium",
    });
  }

  if (signals.headers["x-powered-by"]?.includes("next")) {
    addPublicEnv(report, seen, "buildClues", {
      name: "Server-rendered Next.js app",
      value: "Likely hydrates browser-safe env into client bundles or payloads.",
      cat: "Build Clue",
      source: "Response headers",
      confidence: "medium",
    });
  }

  if (signals.generator.includes("webflow") || signals.generator.includes("wix")) {
    addPublicEnv(report, seen, "buildClues", {
      name: "Hosted builder pipeline",
      value: "Public config likely ships through provider-managed build settings.",
      cat: "Build Clue",
      source: "Generator metadata",
      confidence: "medium",
    });
  }

  return report;
}
