import "server-only";

import {
  addPublicEnv,
  buildSharedEnvSignals,
  createEmptyPublicEnvReport,
  findVariableValue,
} from "@/lib/analysis/public-env-shared";
import { scrapePage } from "@/lib/analysis/scrape-page";

export async function analyzeGeminiPublicEnv(url: string) {
  const page = await scrapePage(url);
  const signals = buildSharedEnvSignals(page);
  const report = createEmptyPublicEnvReport();
  const seen = new Set<string>();

  for (const variable of signals.variables) {
    const framework = variable.startsWith("NEXT_PUBLIC_")
      ? "Next.js"
      : variable.startsWith("VITE_")
        ? "Vite"
        : variable.startsWith("REACT_APP_")
          ? "CRA"
          : variable.startsWith("NUXT_PUBLIC_")
            ? "Nuxt"
            : variable.startsWith("ASTRO_PUBLIC_")
              ? "Astro"
              : "Public Runtime";

    addPublicEnv(report, seen, "variables", {
      name: variable,
      value: findVariableValue(signals.blob, variable),
      cat: `${framework} Public Variable`,
      source: "Page source or client bundle",
      confidence: "high",
    });
  }

  for (const endpoint of signals.endpoints.slice(0, 16)) {
    const isInternal = endpoint.startsWith("/api/");
    addPublicEnv(report, seen, "endpoints", {
      name: isInternal ? "Internal API" : "External Service",
      value: endpoint,
      cat: isInternal ? "API Dependency" : "Third-Party Dependency",
      source: "Script or link reference",
      confidence: "medium",
    });
  }

  const buildClues = [
    { match: "/_next/static/", name: "Next.js asset graph", value: "Detected the Next.js build output path." },
    { match: "/assets/index-", name: "Bundled SPA assets", value: "Has fingerprinted bundle assets that likely depend on public env injection." },
    { match: "import.meta.env", name: "import.meta.env", value: "Detected Vite-style public env access in the bundle." },
  ];

  for (const clue of buildClues) {
    if (signals.lowerBlob.includes(clue.match)) {
      addPublicEnv(report, seen, "buildClues", {
        name: clue.name,
        value: clue.value,
        cat: "Build Clue",
        source: "Bundled asset references",
        confidence: "medium",
      });
    }
  }

  return report;
}
