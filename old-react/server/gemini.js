import express from "express";
import axios from "axios";
import * as cheerio from "cheerio";
import cors from "cors";

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(cors({
  origin: "http://localhost:5173",
  credentials: true
}));

/**
 * 🚀 DETECTION RULES
 * To make the script better, simply add new objects to this array.
 */
const DETECTION_RULES = [
  // --- FRONTEND FRAMEWORKS ---
  {
    name: "Next.js", category: "frontend", type: "Framework",
    match: ($, html, scripts, headers, meta) => 
      $('#__NEXT_DATA__').length > 0 || scripts.includes('/_next/') || headers['x-powered-by']?.includes('next.js')
  },
  {
    name: "Nuxt.js", category: "frontend", type: "Framework",
    match: ($, html) => $('#__nuxt').length > 0 || html.includes('/_nuxt/')
  },
  {
    name: "React", category: "frontend", type: "Library",
    match: ($, html, scripts) => $('[data-reactroot]').length > 0 || scripts.includes('react') || html.includes('react-dom')
  },
  {
    name: "Vue.js", category: "frontend", type: "Framework",
    match: ($, html, scripts) => scripts.includes('vue') || html.includes('data-v-')
  },
  {
    name: "Svelte", category: "frontend", type: "Framework",
    match: ($, html) => html.includes('svelte-') || html.includes('__svelte')
  },
  {
    name: "Angular", category: "frontend", type: "Framework",
    match: ($, html) => $('[ng-app], [ng-model], [ng-version], [_nghost-]').length > 0
  },

  // --- BACKEND & CMS ---
  {
    name: "WordPress", category: "backend", type: "CMS",
    match: ($, html, scripts, headers, meta) => 
      meta['generator']?.includes('wordpress') || html.includes('wp-content') || headers['link']?.includes('wp-json')
  },
  {
    name: "Shopify", category: "backend", type: "E-Commerce",
    match: ($, html, scripts, headers) => 
      headers['x-shopid'] || html.includes('cdn.shopify.com') || scripts.includes('shopify')
  },
  {
    name: "Webflow", category: "backend", type: "CMS",
    match: ($, html, scripts, headers, meta) => 
      meta['generator']?.includes('webflow') || html.includes('w-webflow')
  },
  {
    name: "PHP", category: "backend", type: "Runtime",
    match: ($, html, scripts, headers) => headers['x-powered-by']?.includes('php') || headers['server']?.includes('php')
  },
  {
    name: "Express", category: "backend", type: "Framework",
    match: ($, html, scripts, headers) => headers['x-powered-by']?.includes('express')
  },
  {
    name: "Cloudflare", category: "backend", type: "CDN/Security",
    match: ($, html, scripts, headers) => headers['server']?.includes('cloudflare') || headers['cf-ray']
  },
  {
    name: "Vercel", category: "backend", type: "Hosting",
    match: ($, html, scripts, headers) => headers['x-vercel-id'] || headers['server']?.includes('vercel')
  },

  // --- STYLING ---
  {
    name: "Tailwind CSS", category: "frontend", type: "Styling",
    match: ($, html) => /class="[^"]*(p-\d|m-\d|flex|grid|bg-[a-z]+-\d{3})/.test(html)
  },
  {
    name: "Bootstrap", category: "frontend", type: "Styling",
    match: ($, html, scripts) => html.includes('bootstrap') || html.includes('btn-primary') || scripts.includes('bootstrap')
  },

  // --- TOOLS & LIBRARIES ---
  {
    name: "Google Analytics", category: "tools", type: "Analytics",
    match: ($, html, scripts) => scripts.includes('googletagmanager.com') || scripts.includes('google-analytics.com') || html.includes('UA-') || html.includes('G-')
  },
  {
    name: "Stripe", category: "tools", type: "Payments",
    match: ($, html, scripts) => scripts.includes('js.stripe.com')
  },
  {
    name: "Sentry", category: "tools", type: "Error Tracking",
    match: ($, html, scripts) => scripts.includes('sentry.io') || html.includes('Sentry')
  },
  {
    name: "Framer Motion", category: "frontend", type: "Animation",
    match: ($, html, scripts) => scripts.includes('framer-motion') || html.includes('data-framer-appear')
  },
  {
    name: "Lucide Icons", category: "frontend", type: "Icons",
    match: ($, html) => html.includes('lucide') || $('i.lucide').length > 0
  }
];

async function analyzeStack(url) {
  try {
    const response = await axios.get(url, {
      timeout: 10000,
      maxContentLength: 5000000, // IMPORTANT: Prevent crashes by limiting response size to 5MB
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5"
      },
    });

    const html = response.data;
    const htmlLower = html.toLowerCase();
    
    // Normalize headers to lowercase to avoid case-sensitivity bugs
    const headers = Object.fromEntries(
      Object.entries(response.headers).map(([k, v]) => [k.toLowerCase(), String(v).toLowerCase()])
    );

    const $ = cheerio.load(html);

    // Build a single string of all script sources for fast searching
    const scripts = [];
    $("script").each((_, script) => {
      const src = $(script).attr("src");
      if (src) scripts.push(src.toLowerCase());
    });
    const scriptStr = scripts.join(" ");

    // Extract all meta tags into a nice dictionary
    const metaTags = {};
    $("meta").each((_, el) => {
      const name = $(el).attr("name") || $(el).attr("property");
      const content = $(el).attr("content");
      if (name && content) {
        metaTags[name.toLowerCase()] = content.toLowerCase();
      }
    });

    // The output template
    const report = {
      frontend: [],
      backend: [],
      tools: [],
    };

    // Iterate through all our defined rules
    for (const rule of DETECTION_RULES) {
      try {
        if (rule.match($, htmlLower, scriptStr, headers, metaTags)) {
          report[rule.category].push({ name: rule.name, cat: rule.type });
        }
      } catch (err) {
        console.warn(`Error evaluating rule: ${rule.name}`, err.message);
      }
    }

    return report;
  } catch (error) {
    return {
      error: error.response ? `HTTP Error: ${error.response.status}` : error.message,
    };
  }
}

// Health route
app.get("/", (req, res) => {
  res.json({
    message: "Stack Analyzer API is running",
    usage: 'POST /analyze with { "url": "https://example.com" }',
  });
});

// Analyze route
app.post("/analyze", async (req, res) => {
  const { url } = req.body;

  if (!url || typeof url !== "string") {
    return res.status(400).json({ error: "URL is required" });
  }

  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    return res.status(400).json({ error: "URL must start with http:// or https://" });
  }

  const result = await analyzeStack(url);
  res.json(result);
});

export { analyzeStack };

if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}`) {
  app.listen(PORT, () => {
    console.log(`Gemini Engine running on http://localhost:${PORT}`);
  });
}