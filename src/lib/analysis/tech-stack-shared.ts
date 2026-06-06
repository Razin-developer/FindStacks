import "server-only";

import type { ScrapedPage } from "@/lib/analysis/scrape-page";
import type { StackReport, TechItem } from "@/lib/analysis/types";

export function createEmptyStackReport(): StackReport {
  return {
    frontend: [],
    backend: [],
    cms: [],
    database: [],
    analytics: [],
    security: [],
    cdn: [],
    hosting: [],
    tools: [],
    payments: [],
    ecommerce: [],
  };
}

export function addTech(
  report: StackReport,
  seen: Set<string>,
  category: string,
  item: TechItem,
) {
  const key = `${category}:${item.name}`;
  if (seen.has(key)) {
    return;
  }

  seen.add(key);
  if (!report[category]) {
    report[category] = [];
  }
  report[category].push(item);
}

export function buildPageSignals(page: ScrapedPage) {
  const scriptStr = page.scripts.join(" ");
  const inlineStr = page.scriptText.join(" ").toLowerCase();
  const linkStr = page.links.join(" ");
  const classStr = page.classes.join(" ");
  const metaStr = Object.entries(page.metaTags)
    .map(([name, content]) => `${name}=${content}`)
    .join(" ");
  const combined = [
    page.htmlLower,
    scriptStr,
    inlineStr,
    linkStr,
    classStr,
    metaStr,
    page.textContent.toLowerCase(),
  ].join(" ");

  return {
    scriptStr,
    inlineStr,
    linkStr,
    classStr,
    metaStr,
    combined,
    server: page.headers.server || "",
    poweredBy: page.headers["x-powered-by"] || "",
    generator: page.metaTags.generator || "",
  };
}
