import "server-only";

import type { ScrapedPage } from "@/lib/analysis/scrape-page";
import { scrapePage } from "@/lib/analysis/scrape-page";
import { addTech, buildPageSignals, createEmptyStackReport } from "@/lib/analysis/tech-stack-shared";

const DETECTION_RULES = [
  {
    name: "Next.js",
    category: "frontend",
    type: "Framework",
    match: (signals: ReturnType<typeof buildPageSignals>, page: ScrapedPage) =>
      page.$("#__NEXT_DATA__").length > 0 ||
      signals.scriptStr.includes("/_next/") ||
      signals.poweredBy.includes("next.js"),
  },
  {
    name: "Nuxt.js",
    category: "frontend",
    type: "Framework",
    match: (signals: ReturnType<typeof buildPageSignals>, page: ScrapedPage) =>
      page.$("#__nuxt").length > 0 || signals.combined.includes("/_nuxt/"),
  },
  {
    name: "React",
    category: "frontend",
    type: "Library",
    match: (signals: ReturnType<typeof buildPageSignals>, page: ScrapedPage) =>
      page.$("[data-reactroot]").length > 0 ||
      signals.scriptStr.includes("react") ||
      signals.combined.includes("react-dom"),
  },
  {
    name: "Vue.js",
    category: "frontend",
    type: "Framework",
    match: (signals: ReturnType<typeof buildPageSignals>) =>
      signals.scriptStr.includes("vue") || signals.combined.includes("data-v-"),
  },
  {
    name: "Svelte",
    category: "frontend",
    type: "Framework",
    match: (signals: ReturnType<typeof buildPageSignals>) =>
      signals.combined.includes("svelte-") || signals.combined.includes("__svelte"),
  },
  {
    name: "Angular",
    category: "frontend",
    type: "Framework",
    match: (_signals: ReturnType<typeof buildPageSignals>, page: ScrapedPage) =>
      page.$("[ng-app], [ng-model], [ng-version], [_nghost-]").length > 0,
  },
  {
    name: "WordPress",
    category: "cms",
    type: "CMS",
    match: (signals: ReturnType<typeof buildPageSignals>, page: ScrapedPage) =>
      signals.generator.includes("wordpress") ||
      signals.combined.includes("wp-content") ||
      (page.headers.link || "").includes("wp-json"),
  },
  {
    name: "Shopify",
    category: "ecommerce",
    type: "E-Commerce",
    match: (signals: ReturnType<typeof buildPageSignals>, page: ScrapedPage) =>
      Boolean(page.headers["x-shopid"]) ||
      signals.combined.includes("cdn.shopify.com") ||
      signals.scriptStr.includes("shopify"),
  },
  {
    name: "Webflow",
    category: "cms",
    type: "Website Builder",
    match: (signals: ReturnType<typeof buildPageSignals>) =>
      signals.generator.includes("webflow") || signals.combined.includes("w-webflow"),
  },
  {
    name: "PHP",
    category: "backend",
    type: "Runtime",
    match: (signals: ReturnType<typeof buildPageSignals>) =>
      signals.poweredBy.includes("php") || signals.server.includes("php"),
  },
  {
    name: "Express",
    category: "backend",
    type: "Framework",
    match: (signals: ReturnType<typeof buildPageSignals>) => signals.poweredBy.includes("express"),
  },
  {
    name: "Cloudflare",
    category: "cdn",
    type: "CDN/Security",
    match: (signals: ReturnType<typeof buildPageSignals>, page: ScrapedPage) =>
      signals.server.includes("cloudflare") || Boolean(page.headers["cf-ray"]),
  },
  {
    name: "Vercel",
    category: "hosting",
    type: "Hosting",
    match: (signals: ReturnType<typeof buildPageSignals>, page: ScrapedPage) =>
      Boolean(page.headers["x-vercel-id"]) || signals.server.includes("vercel"),
  },
  {
    name: "Tailwind CSS",
    category: "frontend",
    type: "Styling",
    match: (signals: ReturnType<typeof buildPageSignals>) =>
      /class="[^"]*(p-\d|m-\d|flex|grid|bg-[a-z]+-\d{3})/.test(signals.combined),
  },
  {
    name: "Bootstrap",
    category: "frontend",
    type: "Styling",
    match: (signals: ReturnType<typeof buildPageSignals>) =>
      signals.combined.includes("bootstrap") || signals.combined.includes("btn-primary"),
  },
  {
    name: "Google Analytics",
    category: "analytics",
    type: "Analytics",
    match: (signals: ReturnType<typeof buildPageSignals>) =>
      signals.scriptStr.includes("googletagmanager.com") ||
      signals.scriptStr.includes("google-analytics.com") ||
      signals.combined.includes("ua-") ||
      signals.combined.includes("g-"),
  },
  {
    name: "Stripe",
    category: "payments",
    type: "Payments",
    match: (signals: ReturnType<typeof buildPageSignals>) => signals.scriptStr.includes("js.stripe.com"),
  },
  {
    name: "Sentry",
    category: "tools",
    type: "Error Tracking",
    match: (signals: ReturnType<typeof buildPageSignals>) =>
      signals.scriptStr.includes("sentry.io") || signals.combined.includes("sentry"),
  },
  {
    name: "Framer Motion",
    category: "frontend",
    type: "Animation",
    match: (signals: ReturnType<typeof buildPageSignals>) =>
      signals.scriptStr.includes("framer-motion") || signals.combined.includes("data-framer-appear"),
  },
  {
    name: "Lucide Icons",
    category: "frontend",
    type: "Icons",
    match: (signals: ReturnType<typeof buildPageSignals>, page: ScrapedPage) =>
      signals.combined.includes("lucide") || page.$("i.lucide").length > 0,
  },
];

export async function analyzeGeminiTechStack(url: string) {
  const page = await scrapePage(url);
  const signals = buildPageSignals(page);
  const report = createEmptyStackReport();
  const seen = new Set<string>();

  for (const rule of DETECTION_RULES) {
    if (rule.match(signals, page)) {
      addTech(report, seen, rule.category, {
        name: rule.name,
        cat: rule.type,
        confidence: "medium",
      });
    }
  }

  return report;
}
