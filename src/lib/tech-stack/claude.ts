import "server-only";

import { scrapePage } from "@/lib/analysis/scrape-page";
import { addTech, buildPageSignals, createEmptyStackReport } from "@/lib/analysis/tech-stack-shared";

function matchAny(haystack: string, needles: Array<string | RegExp>) {
  return needles.some((needle) =>
    typeof needle === "string" ? haystack.includes(needle) : needle.test(haystack),
  );
}

export async function analyzeClaudeTechStack(url: string) {
  const page = await scrapePage(url);
  const signals = buildPageSignals(page);
  const report = createEmptyStackReport();
  const seen = new Set<string>();

  if (page.headers["x-vercel-id"] || page.headers["x-vercel-cache"]) {
    addTech(report, seen, "hosting", { name: "Vercel", cat: "Hosting/Edge", confidence: "high" });
  }
  if (page.headers["x-netlify"] || signals.server.includes("netlify")) {
    addTech(report, seen, "hosting", { name: "Netlify", cat: "Hosting", confidence: "high" });
  }
  if (signals.server.includes("cloudflare") || page.headers["cf-ray"]) {
    addTech(report, seen, "cdn", { name: "Cloudflare", cat: "CDN", confidence: "high" });
  }
  if (signals.server.includes("awselb") || signals.server.includes("amazons3") || page.headers["x-amz-cf-id"]) {
    addTech(report, seen, "hosting", { name: "AWS", cat: "Cloud", confidence: "medium" });
  }
  if (page.headers["x-goog-generation"] || signals.server.includes("gws")) {
    addTech(report, seen, "hosting", { name: "Google Cloud", cat: "Cloud", confidence: "medium" });
  }
  if (signals.server.includes("nginx")) {
    addTech(report, seen, "backend", { name: "Nginx", cat: "Web Server", confidence: "high" });
  }
  if (signals.server.includes("apache")) {
    addTech(report, seen, "backend", { name: "Apache", cat: "Web Server", confidence: "high" });
  }
  if (signals.server.includes("iis")) {
    addTech(report, seen, "backend", { name: "IIS", cat: "Web Server", confidence: "high" });
  }
  if (signals.server.includes("caddy")) {
    addTech(report, seen, "backend", { name: "Caddy", cat: "Web Server", confidence: "high" });
  }
  if (signals.server.includes("litespeed")) {
    addTech(report, seen, "backend", { name: "LiteSpeed", cat: "Web Server", confidence: "high" });
  }

  if (signals.poweredBy.includes("php")) {
    addTech(report, seen, "backend", { name: "PHP", cat: "Runtime", confidence: "medium" });
  }
  if (signals.poweredBy.includes("express")) {
    addTech(report, seen, "backend", { name: "Express.js", cat: "Framework", confidence: "high" });
  }
  if (signals.poweredBy.includes("next")) {
    addTech(report, seen, "backend", { name: "Next.js", cat: "Framework", confidence: "medium" });
  }

  if (signals.generator.includes("wordpress")) {
    addTech(report, seen, "cms", { name: "WordPress", cat: "CMS", confidence: "high" });
  }
  if (signals.generator.includes("ghost")) {
    addTech(report, seen, "cms", { name: "Ghost", cat: "CMS", confidence: "medium" });
  }
  if (signals.generator.includes("wix")) {
    addTech(report, seen, "cms", { name: "Wix", cat: "Website Builder", confidence: "medium" });
  }
  if (signals.generator.includes("webflow")) {
    addTech(report, seen, "cms", { name: "Webflow", cat: "Website Builder", confidence: "medium" });
  }

  if (page.$("script#__NEXT_DATA__").length || signals.scriptStr.includes("/_next/")) {
    addTech(report, seen, "frontend", { name: "Next.js", cat: "Framework", confidence: "high" });
  }
  if (matchAny(signals.combined, ["react-dom", "data-reactroot", "/react."])) {
    addTech(report, seen, "frontend", { name: "React", cat: "Library", confidence: "medium" });
  }
  if (matchAny(signals.combined, ["/vue.", "vue.min.js", "__vue__"])) {
    addTech(report, seen, "frontend", { name: "Vue.js", cat: "Framework", confidence: "medium" });
  }

  const tailwindPattern = /\b(p|m|px|py|mx|my|pt|pb|pl|pr|mt|mb|ml|mr)-\d+\b/;
  if (
    signals.linkStr.includes("tailwind") ||
    signals.inlineStr.includes("tailwind") ||
    tailwindPattern.test(signals.classStr)
  ) {
    addTech(report, seen, "frontend", { name: "Tailwind CSS", cat: "Styling", confidence: "medium" });
  }
  if (matchAny(signals.combined, ["bootstrap"]) || signals.classStr.includes("btn-primary")) {
    addTech(report, seen, "frontend", { name: "Bootstrap", cat: "Styling", confidence: "medium" });
  }

  if (matchAny(signals.combined, ["googletagmanager.com", "google-analytics.com", "gtag("])) {
    addTech(report, seen, "analytics", { name: "Google Analytics", cat: "Analytics", confidence: "high" });
  }
  if (matchAny(signals.combined, ["js.stripe.com", "stripe-js"])) {
    addTech(report, seen, "payments", { name: "Stripe", cat: "Payments", confidence: "high" });
  }

  return Object.fromEntries(
    Object.entries(report).filter(([, items]) => items.length > 0),
  );
}
