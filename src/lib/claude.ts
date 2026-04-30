import axios from 'axios';
import * as cheerio from 'cheerio';

const http = axios.create({
  timeout: 12000,
  maxRedirects: 5,
  headers: {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
    "Accept-Language": "en-US,en;q=0.9",
  },
});

function matchAny(haystack: string, needles: (string | RegExp)[]) {
  return needles.some((n) =>
    typeof n === "string" ? haystack.includes(n) : n.test(haystack)
  );
}

export async function analyzeClaude(url: string) {
  const response = await http.get(url);
  const html = response.data;
  const headers = response.headers;
  const $ = cheerio.load(html);

  const scriptSrcs: string[] = [];
  $("script[src]").each((_, el) => {
    const src = $(el).attr("src");
    if (src) scriptSrcs.push(src);
  });

  const inlineScripts: string[] = [];
  $("script:not([src])").each((_, el) => {
    inlineScripts.push($(el).html() || "");
  });

  const linkHrefs: string[] = [];
  $("link[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (href) linkHrefs.push(href);
  });

  const metaContents: string[] = [];
  $("meta").each((_, el) => {
    const name = $(el).attr("name") || $(el).attr("property") || "";
    const content = $(el).attr("content") || "";
    metaContents.push(`${name}=${content}`);
  });

  const allClasses: string[] = [];
  $("[class]").each((_, el) => {
    allClasses.push($(el).attr("class") || "");
  });
  const classStr = allClasses.join(" ");

  const allAttrs: string[] = [];
  $("*").each((_, el: any) => {
    const attrs = (el.attribs && Object.keys(el.attribs)) || [];
    allAttrs.push(...attrs);
  });
  const attrStr = allAttrs.join(" ");

  const scriptStr = scriptSrcs.join(" ").toLowerCase();
  const inlineStr = inlineScripts.join(" ").toLowerCase();
  const linkStr = linkHrefs.join(" ").toLowerCase();
  const htmlLow = html.toLowerCase();
  const metaStr = metaContents.join(" ").toLowerCase();
  const combinedLow = [scriptStr, inlineStr, linkStr, htmlLow, metaStr].join(" ");

  const report: Record<string, any[]> = {
    frontend: [], backend: [], cms: [], database: [], 
    analytics: [], security: [], cdn: [], hosting: [], 
    tools: [], payments: [], ecommerce: []
  };

  const seen: Record<string, boolean> = {};
  function add(category: string, name: string, cat: string, confidence = "high") {
    if (!seen[name]) {
      seen[name] = true;
      if (!report[category]) report[category] = [];
      report[category].push({ name, cat, confidence });
    }
  }

  const server = String(headers["server"] || "").toLowerCase();
  const poweredBy = String(headers["x-powered-by"] || "").toLowerCase();
  const via = String(headers["via"] || "").toLowerCase();
  const setCookie = String(headers["set-cookie"] || "").toLowerCase();

  if (headers["x-vercel-id"] || headers["x-vercel-cache"]) add("hosting", "Vercel", "Hosting/Edge");
  if (headers["x-netlify"] || server.includes("netlify")) add("hosting", "Netlify", "Hosting");
  if (server.includes("cloudflare") || headers["cf-ray"]) add("cdn", "Cloudflare", "CDN");
  if (server.includes("awselb") || server.includes("amazons3") || headers["x-amz-cf-id"]) add("hosting", "AWS", "Cloud");
  if (headers["x-goog-generation"] || server.includes("gws")) add("hosting", "Google Cloud", "Cloud");
  if (server.includes("nginx")) add("backend", "Nginx", "Web Server");
  if (server.includes("apache")) add("backend", "Apache", "Web Server");
  if (server.includes("iis")) add("backend", "IIS", "Web Server");
  if (server.includes("caddy")) add("backend", "Caddy", "Web Server");
  if (server.includes("litespeed")) add("backend", "LiteSpeed", "Web Server");
  
  if (poweredBy.includes("php")) add("backend", "PHP", "Runtime");
  if (poweredBy.includes("express")) add("backend", "Express.js", "Framework");
  if (poweredBy.includes("next")) add("backend", "Next.js", "Framework");
  
  const generator = $('meta[name="generator"]').attr("content") || "";
  const generatorLow = generator.toLowerCase();

  if (generatorLow.includes("wordpress")) add("cms", "WordPress", "CMS");
  if (generatorLow.includes("ghost")) add("cms", "Ghost", "CMS");
  if (generatorLow.includes("wix")) add("cms", "Wix", "Website Builder");
  if (generatorLow.includes("webflow")) add("cms", "Webflow", "Website Builder");
  
  if ($("script#__NEXT_DATA__").length || scriptStr.includes("/_next/")) add("frontend", "Next.js", "Framework");
  if (matchAny(combinedLow, ["react-dom", "data-reactroot", "/react."])) add("frontend", "React", "Library");
  if (matchAny(combinedLow, ["/vue.", "vue.min.js", "__vue__"])) add("frontend", "Vue.js", "Framework");
  
  const tailwindPattern = /\b(p|m|px|py|mx|my|pt|pb|pl|pr|mt|mb|ml|mr)-\d+\b/;
  if (linkStr.includes("tailwind") || inlineStr.includes("tailwind") || tailwindPattern.test(classStr)) add("frontend", "Tailwind CSS", "Styling");
  if (matchAny(combinedLow, ["bootstrap"]) || classStr.includes("btn-primary")) add("frontend", "Bootstrap", "Styling");

  if (matchAny(combinedLow, ["googletagmanager.com", "google-analytics.com", "gtag("])) add("analytics", "Google Analytics", "Analytics");
  if (matchAny(combinedLow, ["js.stripe.com", "stripe-js"])) add("payments", "Stripe", "Payments");

  // Clean empty
  return Object.fromEntries(
    Object.entries(report).filter(([_, items]) => items.length > 0)
  );
}
