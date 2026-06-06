import "server-only";

import type { PublicEnvItem, PublicEnvReport } from "@/lib/analysis/types";
import type { ScrapedPage } from "@/lib/analysis/scrape-page";

const ENV_KEY_PATTERN =
  /\b(NEXT_PUBLIC_[A-Z0-9_]+|VITE_[A-Z0-9_]+|REACT_APP_[A-Z0-9_]+|NUXT_PUBLIC_[A-Z0-9_]+|PUBLIC_[A-Z0-9_]+|ASTRO_PUBLIC_[A-Z0-9_]+)\b/g;

const ENDPOINT_PATTERN =
  /\b(https?:\/\/[^\s"'`<>]+|\/api\/[a-z0-9/_-]+)\b/gi;

export function createEmptyPublicEnvReport(): PublicEnvReport {
  return {
    variables: [],
    endpoints: [],
    buildClues: [],
  };
}

export function addPublicEnv(
  report: PublicEnvReport,
  seen: Set<string>,
  category: string,
  item: PublicEnvItem,
) {
  const key = `${category}:${item.name}:${item.value}`;
  if (seen.has(key)) {
    return;
  }

  seen.add(key);
  if (!report[category]) {
    report[category] = [];
  }
  report[category].push(item);
}

function truncateValue(value: string, maxLength = 120) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 3)}...`;
}

export function extractPublicEnvCandidates(page: ScrapedPage) {
  const blob = [page.html, ...page.scriptText, ...page.scripts, ...page.links].join("\n");
  const variables = new Set<string>();
  const endpoints = new Set<string>();

  for (const match of blob.matchAll(ENV_KEY_PATTERN)) {
    if (match[0]) {
      variables.add(match[0]);
    }
  }

  for (const match of blob.matchAll(ENDPOINT_PATTERN)) {
    if (!match[0]) {
      continue;
    }

    const value = match[0];
    if (
      value.includes("schema.org") ||
      value.includes("w3.org") ||
      value.includes("googleapis.com/css") ||
      value.endsWith(".svg")
    ) {
      continue;
    }
    endpoints.add(value);
  }

  return {
    variables: [...variables],
    endpoints: [...endpoints].slice(0, 24),
  };
}

export function findVariableValue(blob: string, variableName: string) {
  const escaped = variableName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(`${escaped}"?\\s*[:=]\\s*"([^"\\n]+)"`, "i"),
    new RegExp(`${escaped}'?\\s*[:=]\\s*'([^'\\n]+)'`, "i"),
    new RegExp(`${escaped}\\s*[:=]\\s*\\\`([^\\\`\\n]+)\\\``, "i"),
  ];

  for (const pattern of patterns) {
    const match = blob.match(pattern);
    if (match?.[1]) {
      return truncateValue(match[1]);
    }
  }

  return "Referenced publicly";
}

export function buildSharedEnvSignals(page: ScrapedPage) {
  const blob = [page.html, ...page.scriptText, ...page.scripts, ...page.links].join("\n");
  const lowerBlob = blob.toLowerCase();

  return {
    blob,
    lowerBlob,
    generator: page.metaTags.generator || "",
    headers: page.headers,
    ...extractPublicEnvCandidates(page),
  };
}
