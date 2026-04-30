import axios from 'axios';
import * as cheerio from 'cheerio';

const http = axios.create({
  timeout: 10000,
  maxContentLength: 5000000,
  headers: {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5"
  },
});

const DETECTION_RULES = [
  {
    name: "Next.js", category: "frontend", type: "Framework",
    match: ($: any, html: string, scripts: string, headers: any, meta: any) => 
      $('#__NEXT_DATA__').length > 0 || scripts.includes('/_next/') || headers['x-powered-by']?.includes('next.js')
  },
  {
    name: "Nuxt.js", category: "frontend", type: "Framework",
    match: ($: any, html: string) => $('#__nuxt').length > 0 || html.includes('/_nuxt/')
  },
  {
    name: "React", category: "frontend", type: "Library",
    match: ($: any, html: string, scripts: string) => $('[data-reactroot]').length > 0 || scripts.includes('react') || html.includes('react-dom')
  },
  {
    name: "Vue.js", category: "frontend", type: "Framework",
    match: ($: any, html: string, scripts: string) => scripts.includes('vue') || html.includes('data-v-')
  },
  {
    name: "Svelte", category: "frontend", type: "Framework",
    match: ($: any, html: string) => html.includes('svelte-') || html.includes('__svelte')
  },
  {
    name: "Angular", category: "frontend", type: "Framework",
    match: ($: any, html: string) => $('[ng-app], [ng-model], [ng-version], [_nghost-]').length > 0
  },
  {
    name: "WordPress", category: "backend", type: "CMS",
    match: ($: any, html: string, scripts: string, headers: any, meta: any) => 
      meta['generator']?.includes('wordpress') || html.includes('wp-content') || headers['link']?.includes('wp-json')
  },
  {
    name: "Shopify", category: "backend", type: "E-Commerce",
    match: ($: any, html: string, scripts: string, headers: any) => 
      headers['x-shopid'] || html.includes('cdn.shopify.com') || scripts.includes('shopify')
  },
  {
    name: "Webflow", category: "backend", type: "CMS",
    match: ($: any, html: string, scripts: string, headers: any, meta: any) => 
      meta['generator']?.includes('webflow') || html.includes('w-webflow')
  },
  {
    name: "PHP", category: "backend", type: "Runtime",
    match: ($: any, html: string, scripts: string, headers: any) => headers['x-powered-by']?.includes('php') || headers['server']?.includes('php')
  },
  {
    name: "Express", category: "backend", type: "Framework",
    match: ($: any, html: string, scripts: string, headers: any) => headers['x-powered-by']?.includes('express')
  },
  {
    name: "Cloudflare", category: "backend", type: "CDN/Security",
    match: ($: any, html: string, scripts: string, headers: any) => headers['server']?.includes('cloudflare') || headers['cf-ray']
  },
  {
    name: "Vercel", category: "backend", type: "Hosting",
    match: ($: any, html: string, scripts: string, headers: any) => headers['x-vercel-id'] || headers['server']?.includes('vercel')
  },
  {
    name: "Tailwind CSS", category: "frontend", type: "Styling",
    match: ($: any, html: string) => /class="[^"]*(p-\d|m-\d|flex|grid|bg-[a-z]+-\d{3})/.test(html)
  },
  {
    name: "Bootstrap", category: "frontend", type: "Styling",
    match: ($: any, html: string, scripts: string) => html.includes('bootstrap') || html.includes('btn-primary') || scripts.includes('bootstrap')
  },
  {
    name: "Google Analytics", category: "tools", type: "Analytics",
    match: ($: any, html: string, scripts: string) => scripts.includes('googletagmanager.com') || scripts.includes('google-analytics.com') || html.includes('UA-') || html.includes('G-')
  },
  {
    name: "Stripe", category: "tools", type: "Payments",
    match: ($: any, html: string, scripts: string) => scripts.includes('js.stripe.com')
  },
  {
    name: "Sentry", category: "tools", type: "Error Tracking",
    match: ($: any, html: string, scripts: string) => scripts.includes('sentry.io') || html.includes('Sentry')
  },
  {
    name: "Framer Motion", category: "frontend", type: "Animation",
    match: ($: any, html: string, scripts: string) => scripts.includes('framer-motion') || html.includes('data-framer-appear')
  },
  {
    name: "Lucide Icons", category: "frontend", type: "Icons",
    match: ($: any, html: string) => html.includes('lucide') || $('i.lucide').length > 0
  }
];

export async function analyzeGemini(url: string) {
  const response = await http.get(url);
  const html = response.data;
  const htmlLower = html.toLowerCase();
  const headers = Object.fromEntries(
    Object.entries(response.headers).map(([k, v]) => [k.toLowerCase(), String(v).toLowerCase()])
  );
  const $ = cheerio.load(html);

  const scripts: string[] = [];
  $("script").each((_, script) => {
    const src = $(script).attr("src");
    if (src) scripts.push(src.toLowerCase());
  });
  const scriptStr = scripts.join(" ");

  const metaTags: Record<string, string> = {};
  $("meta").each((_, el) => {
    const name = $(el).attr("name") || $(el).attr("property");
    const content = $(el).attr("content");
    if (name && content) {
      metaTags[name.toLowerCase()] = content.toLowerCase();
    }
  });

  const report: Record<string, any[]> = {
    frontend: [],
    backend: [],
    tools: [],
  };

  for (const rule of DETECTION_RULES) {
    if (rule.match($, htmlLower, scriptStr, headers, metaTags)) {
      report[rule.category].push({ name: rule.name, cat: rule.type });
    }
  }

  return report;
}
