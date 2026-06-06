import "server-only";

import { buildPageSignals, createEmptyStackReport, addTech } from "@/lib/analysis/tech-stack-shared";
import { scrapePage } from "@/lib/analysis/scrape-page";

export async function analyzeChatGPTTechStack(url: string) {
  const page = await scrapePage(url);
  const signals = buildPageSignals(page);
  const report = createEmptyStackReport();
  const seen = new Set<string>();

  if (signals.server.includes("cloudflare") || page.headers["cf-ray"]) {
    addTech(report, seen, "cdn", { name: "Cloudflare", cat: "CDN/Hosting", confidence: "high" });
  }
  if (signals.server.includes("vercel") || page.headers["x-vercel-id"]) {
    addTech(report, seen, "hosting", { name: "Vercel", cat: "Hosting/Edge", confidence: "high" });
  }
  if (signals.poweredBy.includes("express")) {
    addTech(report, seen, "backend", { name: "Express", cat: "Framework", confidence: "high" });
  }
  if (signals.poweredBy.includes("php")) {
    addTech(report, seen, "backend", { name: "PHP", cat: "Runtime", confidence: "medium" });
  }

  if (signals.combined.includes("wp-content") || signals.combined.includes("wp-includes")) {
    addTech(report, seen, "cms", { name: "WordPress", cat: "CMS", confidence: "high" });
  }
  if (signals.combined.includes("cdn.shopify.com") || signals.scriptStr.includes("shopify")) {
    addTech(report, seen, "ecommerce", { name: "Shopify", cat: "E-Commerce", confidence: "high" });
  }

  if (page.$("script#__NEXT_DATA__").length > 0 || signals.scriptStr.includes("/_next/")) {
    addTech(report, seen, "frontend", { name: "Next.js", cat: "Framework", confidence: "high" });
  }
  if (signals.combined.includes("react-dom") || signals.scriptStr.includes("react")) {
    addTech(report, seen, "frontend", { name: "React", cat: "Library", confidence: "medium" });
  }
  if (signals.combined.includes("vue") || signals.scriptStr.includes("vue")) {
    addTech(report, seen, "frontend", { name: "Vue.js", cat: "Framework", confidence: "medium" });
  }

  if (signals.combined.includes("tailwind") || signals.scriptStr.includes("tailwind")) {
    addTech(report, seen, "frontend", { name: "Tailwind CSS", cat: "Styling", confidence: "medium" });
  }
  if (signals.combined.includes("bootstrap") || signals.scriptStr.includes("bootstrap")) {
    addTech(report, seen, "frontend", { name: "Bootstrap", cat: "Styling", confidence: "medium" });
  }

  if (signals.scriptStr.includes("googletagmanager.com/gtm.js")) {
    addTech(report, seen, "tools", { name: "Google Tag Manager", cat: "Tag Manager", confidence: "high" });
  }
  if (
    signals.scriptStr.includes("googletagmanager.com/gtag/js") ||
    signals.scriptStr.includes("google-analytics.com")
  ) {
    addTech(report, seen, "analytics", { name: "Google Analytics", cat: "Analytics", confidence: "high" });
  }
  if (signals.scriptStr.includes("js.stripe.com")) {
    addTech(report, seen, "payments", { name: "Stripe", cat: "Payments", confidence: "high" });
  }

  return report;
}
