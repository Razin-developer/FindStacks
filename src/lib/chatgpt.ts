import axios from 'axios';
import * as cheerio from 'cheerio';
import { lookup } from "node:dns/promises";
import net from "node:net";

const http = axios.create({
  timeout: 12000,
  maxRedirects: 5,
  validateStatus: () => true,
  headers: {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36",
  },
});

async function isPrivateIp(ip: string) {
  const family = net.isIP(ip);
  if (family === 4) {
    const parts = ip.split(".").map(Number);
    return parts[0] === 10 || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) || (parts[0] === 192 && parts[1] === 168) || parts[0] === 127;
  }
  return ip.startsWith("fe80:") || ip === "::1" || ip === "::";
}

async function assertSafeTarget(rawUrl: string) {
  const parsed = new URL(rawUrl);
  const hostname = parsed.hostname.toLowerCase();
  const addresses = await lookup(hostname, { all: true });
  for (const addr of addresses) {
    if (await isPrivateIp(addr.address)) throw new Error("Private IP forbidden");
  }
}

export async function analyzeChatGPT(url: string) {
  await assertSafeTarget(url);
  const response = await http.get(url);
  const html = response.data;
  const headers = response.headers;
  const $ = cheerio.load(html);
  
  const scripts: string[] = [];
  $('script[src]').each((_, el) => { 
    const src = $(el).attr('src');
    if (src) scripts.push(src.toLowerCase());
  });
  const scriptStr = scripts.join(' ');
  const htmlLow = html.toLowerCase();
  const server = String(headers['server'] || '').toLowerCase();
  const poweredBy = String(headers['x-powered-by'] || '').toLowerCase();

  const report: Record<string, any[]> = { frontend: [], backend: [], tools: [] };
  const seen = new Set();
  const add = (cat: string, name: string, type: string, confidence = "high") => {
    if (!seen.has(name)) {
      seen.add(name);
      report[cat].push({ name, cat: type, confidence });
    }
  };

  // Logic from old chatgpt.js
  if (server.includes("cloudflare") || headers["cf-ray"]) add("backend", "Cloudflare", "CDN/Hosting");
  if (server.includes("vercel") || headers["x-vercel-id"]) add("backend", "Vercel", "Hosting/Edge");
  if (poweredBy.includes("express")) add("backend", "Express", "Framework");
  if (poweredBy.includes("php")) add("backend", "PHP", "Runtime");
  
  if (htmlLow.includes("wp-content") || htmlLow.includes("wp-includes")) add("backend", "WordPress", "CMS");
  if (htmlLow.includes("cdn.shopify.com") || scriptStr.includes("shopify")) add("backend", "Shopify", "Ecommerce");
  
  if ($("script#__NEXT_DATA__").length > 0 || scriptStr.includes("/_next/")) add("frontend", "Next.js", "Framework");
  if (htmlLow.includes("react-dom") || scriptStr.includes("react")) add("frontend", "React", "Library");
  if (htmlLow.includes("vue") || scriptStr.includes("vue")) add("frontend", "Vue.js", "Framework");
  
  if (htmlLow.includes("tailwind") || scriptStr.includes("tailwind")) add("frontend", "Tailwind CSS", "Styling");
  if (htmlLow.includes("bootstrap") || scriptStr.includes("bootstrap")) add("frontend", "Bootstrap", "Styling");
  
  if (scriptStr.includes("googletagmanager.com/gtm.js")) add("tools", "Google Tag Manager", "Tag Manager");
  if (scriptStr.includes("googletagmanager.com/gtag/js") || scriptStr.includes("google-analytics.com")) add("tools", "Google Analytics", "Analytics");
  if (scriptStr.includes("js.stripe.com")) add("tools", "Stripe", "Payments");

  return report;
}
