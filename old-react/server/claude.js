import express from "express";
import axios from "axios";
import * as cheerio from "cheerio";
import cors from "cors";

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  })
);

// ─── Helper ────────────────────────────────────────────────────────────────
function matchAny(haystack, needles) {
  return needles.some((n) =>
    typeof n === "string" ? haystack.includes(n) : n.test(haystack)
  );
}

// ─── Core Analyzer ─────────────────────────────────────────────────────────
async function analyzeStack(url) {
  try {
    const response = await axios.get(url, {
      timeout: 12000,
      maxRedirects: 5,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });

    const html = response.data;
    const headers = response.headers;
    const $ = cheerio.load(html);

    // ── Collect raw signal strings ──────────────────────────────────────
    const scriptSrcs = [];
    $("script[src]").each((_, el) => scriptSrcs.push($(el).attr("src")));

    const inlineScripts = [];
    $("script:not([src])").each((_, el) => inlineScripts.push($(el).html() || ""));

    const linkHrefs = [];
    $("link[href]").each((_, el) => linkHrefs.push($(el).attr("href")));

    const metaContents = [];
    $("meta").each((_, el) => {
      const name = $(el).attr("name") || $(el).attr("property") || "";
      const content = $(el).attr("content") || "";
      metaContents.push(`${name}=${content}`);
    });

    const allClasses = [];
    $("[class]").each((_, el) => allClasses.push($(el).attr("class") || ""));
    const classStr = allClasses.join(" ");

    const allAttrs = [];
    $("*").each((_, el) => {
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

    // ── Report structure ────────────────────────────────────────────────
    const report = {
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

    const seen = {};
    function add(category, name, cat, confidence = "high") {
      if (!seen[name]) {
        seen[name] = true;
        report[category].push({ name, cat, confidence });
      }
    }

    // ────────────────────────────────────────────────────────────────────
    // 1. HTTP HEADERS
    // ────────────────────────────────────────────────────────────────────
    const server = String(headers["server"] || "").toLowerCase();
    const poweredBy = String(headers["x-powered-by"] || "").toLowerCase();
    const via = String(headers["via"] || "").toLowerCase();
    const setCookie = String(headers["set-cookie"] || "").toLowerCase();

    // Hosting / CDN from headers
    if (headers["x-vercel-id"] || headers["x-vercel-cache"])
      add("hosting", "Vercel", "Hosting/Edge");
    if (headers["x-netlify"] || server.includes("netlify"))
      add("hosting", "Netlify", "Hosting");
    if (server.includes("cloudflare") || headers["cf-ray"])
      add("cdn", "Cloudflare", "CDN");
    if (server.includes("awselb") || server.includes("amazons3") || headers["x-amz-cf-id"])
      add("hosting", "AWS", "Cloud");
    if (headers["x-goog-generation"] || server.includes("gws"))
      add("hosting", "Google Cloud", "Cloud");
    if (server.includes("nginx")) add("backend", "Nginx", "Web Server");
    if (server.includes("apache")) add("backend", "Apache", "Web Server");
    if (server.includes("iis")) add("backend", "IIS", "Web Server");
    if (server.includes("caddy")) add("backend", "Caddy", "Web Server");
    if (server.includes("litespeed")) add("backend", "LiteSpeed", "Web Server");
    if (server.includes("openresty")) add("backend", "OpenResty", "Web Server");
    if (via.includes("varnish")) add("cdn", "Varnish", "Cache");
    if (headers["x-cache"]?.toLowerCase().includes("cloudfront") || headers["x-amz-cf-pop"])
      add("cdn", "AWS CloudFront", "CDN");
    if (headers["x-fastly-request-id"]) add("cdn", "Fastly", "CDN");
    if (headers["x-bunnycdn-cache"] || server.includes("bunny"))
      add("cdn", "BunnyCDN", "CDN");

    // Backend runtimes from headers
    if (poweredBy.includes("php")) add("backend", "PHP", "Runtime");
    if (poweredBy.includes("express")) add("backend", "Express.js", "Framework");
    if (poweredBy.includes("next")) add("backend", "Next.js", "Framework");
    if (poweredBy.includes("asp.net")) add("backend", "ASP.NET", "Framework");
    if (poweredBy.includes("django")) add("backend", "Django", "Framework");
    if (poweredBy.includes("rails")) add("backend", "Ruby on Rails", "Framework");

    // Sessions / cookies
    if (setCookie.includes("laravel")) add("backend", "Laravel", "Framework");
    if (setCookie.includes("django")) add("backend", "Django", "Framework");
    if (setCookie.includes("rails") || setCookie.includes("_session_id"))
      add("backend", "Ruby on Rails", "Framework");
    if (setCookie.includes("asp.net")) add("backend", "ASP.NET", "Framework");
    if (setCookie.includes("phpsessid")) add("backend", "PHP", "Runtime");

    // ────────────────────────────────────────────────────────────────────
    // 2. META TAGS
    // ────────────────────────────────────────────────────────────────────
    const generator = $('meta[name="generator"]').attr("content") || "";
    const generatorLow = generator.toLowerCase();

    if (generatorLow.includes("wordpress")) add("cms", "WordPress", "CMS");
    if (generatorLow.includes("joomla")) add("cms", "Joomla", "CMS");
    if (generatorLow.includes("drupal")) add("cms", "Drupal", "CMS");
    if (generatorLow.includes("ghost")) add("cms", "Ghost", "CMS");
    if (generatorLow.includes("wix")) add("cms", "Wix", "Website Builder");
    if (generatorLow.includes("squarespace")) add("cms", "Squarespace", "Website Builder");
    if (generatorLow.includes("webflow")) add("cms", "Webflow", "Website Builder");
    if (generatorLow.includes("gatsby")) add("frontend", "Gatsby", "Framework");
    if (generatorLow.includes("hugo")) add("frontend", "Hugo", "Static Site");
    if (generatorLow.includes("jekyll")) add("frontend", "Jekyll", "Static Site");
    if (generatorLow.includes("next.js")) add("frontend", "Next.js", "Framework");
    if (generatorLow.includes("nuxt")) add("frontend", "Nuxt.js", "Framework");
    if (generatorLow.includes("eleventy") || generatorLow.includes("11ty"))
      add("frontend", "Eleventy", "Static Site");

    // ────────────────────────────────────────────────────────────────────
    // 3. SCRIPT & LINK SRC PATTERNS
    // ────────────────────────────────────────────────────────────────────

    // JS Frameworks
    if ($("script#__NEXT_DATA__").length || scriptStr.includes("/_next/"))
      add("frontend", "Next.js", "Framework");
    if (scriptStr.includes("/nuxt/") || inlineStr.includes("__nuxt"))
      add("frontend", "Nuxt.js", "Framework");
    if (matchAny(combinedLow, ["react-dom", "data-reactroot", "/react."]))
      add("frontend", "React", "Library");
    if (matchAny(combinedLow, ["/vue.", "vue.min.js", "__vue__"]))
      add("frontend", "Vue.js", "Framework");
    if (matchAny(combinedLow, ["angular", "ng-version", "ng-app"]))
      add("frontend", "Angular", "Framework");
    if (matchAny(scriptSrcs.join(" ").toLowerCase(), ["svelte"]) || /svelte-[a-z0-9]+/.test(classStr))
      add("frontend", "Svelte", "Framework");
    if (matchAny(combinedLow, ["astro-island", "astro-root", "/_astro/"]))
      add("frontend", "Astro", "Framework");
    if (matchAny(combinedLow, ["/remix/", "remix-run"]))
      add("frontend", "Remix", "Framework");
    if (matchAny(combinedLow, ["solid-js", "solidjs"]))
      add("frontend", "SolidJS", "Framework");
    if (matchAny(combinedLow, ["qwik"]))
      add("frontend", "Qwik", "Framework");
    if (matchAny(combinedLow, ["alpinejs", "x-data", "x-bind"]) || attrStr.includes("x-data"))
      add("frontend", "Alpine.js", "Library");
    if (matchAny(combinedLow, ["htmx"]))
      add("frontend", "HTMX", "Library");
    if (matchAny(combinedLow, ["ember.", "emberjs"]))
      add("frontend", "Ember.js", "Framework");
    if (matchAny(combinedLow, ["backbone.js", "backbone.min"]))
      add("frontend", "Backbone.js", "Library");
    if (matchAny(combinedLow, ["jquery"]))
      add("frontend", "jQuery", "Library");
    if (matchAny(combinedLow, ["mootools"]))
      add("frontend", "MooTools", "Library");
    if (matchAny(combinedLow, ["prototype.js"]))
      add("frontend", "Prototype.js", "Library");

    // CSS Frameworks
    const tailwindPattern = /\b(p|m|px|py|mx|my|pt|pb|pl|pr|mt|mb|ml|mr)-\d+\b/;
    if (
      linkStr.includes("tailwind") ||
      inlineStr.includes("tailwind") ||
      tailwindPattern.test(classStr)
    )
      add("frontend", "Tailwind CSS", "Styling");
    if (matchAny(combinedLow, ["bootstrap"]) || classStr.includes("btn-primary"))
      add("frontend", "Bootstrap", "Styling");
    if (matchAny(combinedLow, ["bulma"]) || classStr.includes("is-primary"))
      add("frontend", "Bulma", "Styling");
    if (matchAny(combinedLow, ["foundation.css", "zurb-foundation"]))
      add("frontend", "Foundation", "Styling");
    if (matchAny(combinedLow, ["material-ui", "@mui", "MuiButton"]))
      add("frontend", "Material UI", "UI Library");
    if (matchAny(combinedLow, ["chakra-ui", "chakra"]))
      add("frontend", "Chakra UI", "UI Library");
    if (matchAny(combinedLow, ["shadcn", "radix-ui", "@radix"]))
      add("frontend", "shadcn/Radix", "UI Library");
    if (matchAny(combinedLow, ["ant-design", "antd"]))
      add("frontend", "Ant Design", "UI Library");
    if (matchAny(combinedLow, ["daisyui"]))
      add("frontend", "DaisyUI", "UI Library");
    if (matchAny(combinedLow, ["headlessui"]))
      add("frontend", "Headless UI", "UI Library");
    if (matchAny(combinedLow, ["primereact", "primevue", "primefaces"]))
      add("frontend", "PrimeUI", "UI Library");
    if (matchAny(combinedLow, ["semantic-ui", "semantic.min"]))
      add("frontend", "Semantic UI", "Styling");

    // Icons
    if (matchAny(combinedLow, ["lucide"])) add("frontend", "Lucide Icons", "Icons");
    if (matchAny(combinedLow, ["font-awesome", "fontawesome"]))
      add("frontend", "Font Awesome", "Icons");
    if (matchAny(combinedLow, ["heroicons"])) add("frontend", "Heroicons", "Icons");
    if (matchAny(combinedLow, ["feathericons", "feather.min"]))
      add("frontend", "Feather Icons", "Icons");
    if (linkStr.includes("material-icons") || combinedLow.includes("material-icons"))
      add("frontend", "Material Icons", "Icons");
    if (linkStr.includes("phosphoricons") || combinedLow.includes("phosphor"))
      add("frontend", "Phosphor Icons", "Icons");

    // Animation
    if (matchAny(combinedLow, ["framer-motion", "data-framer-appear"]))
      add("frontend", "Framer Motion", "Animation");
    if (matchAny(combinedLow, ["gsap", "greensock"]))
      add("frontend", "GSAP", "Animation");
    if (matchAny(combinedLow, ["animejs", "anime.min"]))
      add("frontend", "Anime.js", "Animation");
    if (matchAny(combinedLow, ["aos-animate", "data-aos"]) || attrStr.includes("data-aos"))
      add("frontend", "AOS", "Animation");
    if (matchAny(combinedLow, ["motion.dev", "motion.js"]))
      add("frontend", "Motion One", "Animation");
    if (matchAny(combinedLow, ["lottie"]))
      add("frontend", "Lottie", "Animation");
    if (matchAny(combinedLow, ["three.js", "three.min"]))
      add("frontend", "Three.js", "3D/WebGL");

    // Fonts
    if (linkStr.includes("fonts.googleapis.com"))
      add("frontend", "Google Fonts", "Typography");
    if (linkStr.includes("use.typekit.net") || scriptStr.includes("use.typekit.net"))
      add("frontend", "Adobe Fonts (Typekit)", "Typography");
    if (linkStr.includes("fonts.bunny.net"))
      add("frontend", "Bunny Fonts", "Typography");

    // State management
    if (matchAny(combinedLow, ["redux", "@reduxjs"]))
      add("frontend", "Redux", "State Management");
    if (matchAny(combinedLow, ["zustand"]))
      add("frontend", "Zustand", "State Management");
    if (matchAny(combinedLow, ["mobx"]))
      add("frontend", "MobX", "State Management");
    if (matchAny(combinedLow, ["recoil"]))
      add("frontend", "Recoil", "State Management");
    if (matchAny(combinedLow, ["jotai"]))
      add("frontend", "Jotai", "State Management");

    // Data fetching
    if (matchAny(combinedLow, ["react-query", "@tanstack/query"]))
      add("frontend", "TanStack Query", "Data Fetching");
    if (matchAny(combinedLow, ["swr"]))
      add("frontend", "SWR", "Data Fetching");
    if (matchAny(combinedLow, ["apollo-client", "@apollo/client"]))
      add("frontend", "Apollo Client", "GraphQL");
    if (matchAny(combinedLow, ["urql"]))
      add("frontend", "URQL", "GraphQL");

    // ────────────────────────────────────────────────────────────────────
    // 4. CMS / E-COMMERCE
    // ────────────────────────────────────────────────────────────────────
    if (htmlLow.includes("wp-content") || htmlLow.includes("wp-includes"))
      add("cms", "WordPress", "CMS");
    if (htmlLow.includes("/sites/default/files") || htmlLow.includes("drupal"))
      add("cms", "Drupal", "CMS");
    if (htmlLow.includes("joomla")) add("cms", "Joomla", "CMS");
    if (matchAny(combinedLow, ["ghost-url", "ghost.io"]))
      add("cms", "Ghost", "CMS");
    if (matchAny(combinedLow, ["contentful"]))
      add("cms", "Contentful", "Headless CMS");
    if (matchAny(combinedLow, ["sanity.io", "sanity-studio"]))
      add("cms", "Sanity", "Headless CMS");
    if (matchAny(combinedLow, ["storyblok"]))
      add("cms", "Storyblok", "Headless CMS");
    if (matchAny(combinedLow, ["prismic.io"]))
      add("cms", "Prismic", "Headless CMS");
    if (matchAny(combinedLow, ["dato-cms", "datocms"]))
      add("cms", "DatoCMS", "Headless CMS");
    if (matchAny(combinedLow, ["strapi"]))
      add("cms", "Strapi", "Headless CMS");
    if (matchAny(combinedLow, ["webflow"]) || htmlLow.includes("wf-form"))
      add("cms", "Webflow", "Website Builder");
    if (htmlLow.includes("wix.com") || htmlLow.includes("wixsite"))
      add("cms", "Wix", "Website Builder");
    if (htmlLow.includes("squarespace"))
      add("cms", "Squarespace", "Website Builder");
    if (htmlLow.includes("shopify") || htmlLow.includes("cdn.shopify"))
      add("ecommerce", "Shopify", "E-Commerce");
    if (matchAny(combinedLow, ["woocommerce", "wc-"]))
      add("ecommerce", "WooCommerce", "E-Commerce");
    if (matchAny(combinedLow, ["magento"]))
      add("ecommerce", "Magento", "E-Commerce");
    if (matchAny(combinedLow, ["bigcommerce"]))
      add("ecommerce", "BigCommerce", "E-Commerce");
    if (matchAny(combinedLow, ["prestashop"]))
      add("ecommerce", "PrestaShop", "E-Commerce");
    if (matchAny(combinedLow, ["medusajs", "medusa-js"]))
      add("ecommerce", "Medusa", "E-Commerce");

    // ────────────────────────────────────────────────────────────────────
    // 5. BACKEND FRAMEWORKS (inline / HTML signals)
    // ────────────────────────────────────────────────────────────────────
    if (matchAny(combinedLow, ["laravel", "__laravel_session"]))
      add("backend", "Laravel", "Framework");
    if (matchAny(combinedLow, ["/rails/", "csrf-token"]) && setCookie.includes("_session"))
      add("backend", "Ruby on Rails", "Framework");
    if (matchAny(combinedLow, ["django-csrf", "csrfmiddlewaretoken"]))
      add("backend", "Django", "Framework");
    if (matchAny(combinedLow, ["fastapi", "pydantic"]))
      add("backend", "FastAPI", "Framework");
    if (matchAny(combinedLow, ["flask"]))
      add("backend", "Flask", "Framework");
    if (matchAny(combinedLow, [".spring.", "springboot"]))
      add("backend", "Spring Boot", "Framework");
    if (matchAny(combinedLow, ["nestjs", "@nestjs"]))
      add("backend", "NestJS", "Framework");
    if (matchAny(combinedLow, ["hono", "honojs"]))
      add("backend", "Hono", "Framework");

    // ────────────────────────────────────────────────────────────────────
    // 6. DATABASE / INFRA SIGNALS
    // ────────────────────────────────────────────────────────────────────
    if (matchAny(combinedLow, ["supabase"]))
      add("database", "Supabase", "Database/Auth");
    if (matchAny(combinedLow, ["firebase", "firebaseapp"]))
      add("database", "Firebase", "Database/Auth");
    if (matchAny(combinedLow, ["planetscale"]))
      add("database", "PlanetScale", "Database");
    if (matchAny(combinedLow, ["neon.tech", "neondb"]))
      add("database", "Neon", "Database");
    if (matchAny(combinedLow, ["turso"]))
      add("database", "Turso", "Database");
    if (matchAny(combinedLow, ["convex.dev", "convexdev"]))
      add("database", "Convex", "Database");
    if (matchAny(combinedLow, ["mongodb", "mongoose"]))
      add("database", "MongoDB", "Database");
    if (matchAny(combinedLow, ["fauna"]))
      add("database", "FaunaDB", "Database");

    // ────────────────────────────────────────────────────────────────────
    // 7. ANALYTICS & TRACKING
    // ────────────────────────────────────────────────────────────────────
    if (matchAny(combinedLow, ["googletagmanager.com", "google-analytics.com", "gtag("]))
      add("analytics", "Google Analytics / GTM", "Analytics");
    if (matchAny(combinedLow, ["plausible.io"]))
      add("analytics", "Plausible", "Privacy Analytics");
    if (matchAny(combinedLow, ["fathom"]))
      add("analytics", "Fathom", "Privacy Analytics");
    if (matchAny(combinedLow, ["umami"]))
      add("analytics", "Umami", "Privacy Analytics");
    if (matchAny(combinedLow, ["mixpanel"]))
      add("analytics", "Mixpanel", "Analytics");
    if (matchAny(combinedLow, ["segment.com", "segment.io", "analytics.js"]))
      add("analytics", "Segment", "Analytics");
    if (matchAny(combinedLow, ["amplitude"]))
      add("analytics", "Amplitude", "Analytics");
    if (matchAny(combinedLow, ["hotjar"]))
      add("analytics", "Hotjar", "Heatmaps");
    if (matchAny(combinedLow, ["fullstory"]))
      add("analytics", "FullStory", "Session Recording");
    if (matchAny(combinedLow, ["heap.io", "heapanalytics"]))
      add("analytics", "Heap", "Analytics");
    if (matchAny(combinedLow, ["clarity.ms", "microsoft clarity"]))
      add("analytics", "Microsoft Clarity", "Analytics");
    if (matchAny(combinedLow, ["posthog"]))
      add("analytics", "PostHog", "Analytics");
    if (matchAny(combinedLow, ["logrocket"]))
      add("analytics", "LogRocket", "Session Recording");

    // ────────────────────────────────────────────────────────────────────
    // 8. PAYMENTS
    // ────────────────────────────────────────────────────────────────────
    if (matchAny(combinedLow, ["js.stripe.com", "stripe-js"]))
      add("payments", "Stripe", "Payments");
    if (matchAny(combinedLow, ["paypal.com", "paypalobjects"]))
      add("payments", "PayPal", "Payments");
    if (matchAny(combinedLow, ["lemon.squeezy", "lemonsqueezy"]))
      add("payments", "Lemon Squeezy", "Payments");
    if (matchAny(combinedLow, ["paddle.com"]))
      add("payments", "Paddle", "Payments");
    if (matchAny(combinedLow, ["braintree"]))
      add("payments", "Braintree", "Payments");
    if (matchAny(combinedLow, ["square.com", "squareup"]))
      add("payments", "Square", "Payments");

    // ────────────────────────────────────────────────────────────────────
    // 9. CUSTOMER SUPPORT / ENGAGEMENT
    // ────────────────────────────────────────────────────────────────────
    if (matchAny(combinedLow, ["intercom"]))
      add("tools", "Intercom", "Customer Support");
    if (matchAny(combinedLow, ["crisp.chat", "crisp-client"]))
      add("tools", "Crisp", "Customer Support");
    if (matchAny(combinedLow, ["zendesk"]))
      add("tools", "Zendesk", "Customer Support");
    if (matchAny(combinedLow, ["freshdesk", "freshchat"]))
      add("tools", "Freshdesk", "Customer Support");
    if (matchAny(combinedLow, ["tawk.to"]))
      add("tools", "Tawk.to", "Customer Support");
    if (matchAny(combinedLow, ["drift.com", "driftt"]))
      add("tools", "Drift", "Customer Support");
    if (matchAny(combinedLow, ["hubspot"]))
      add("tools", "HubSpot", "CRM");
    if (matchAny(combinedLow, ["salesforce"]))
      add("tools", "Salesforce", "CRM");

    // ────────────────────────────────────────────────────────────────────
    // 10. ERROR TRACKING / MONITORING
    // ────────────────────────────────────────────────────────────────────
    if (matchAny(combinedLow, ["sentry.io", "@sentry"]))
      add("tools", "Sentry", "Error Tracking");
    if (matchAny(combinedLow, ["bugsnag"]))
      add("tools", "Bugsnag", "Error Tracking");
    if (matchAny(combinedLow, ["rollbar"]))
      add("tools", "Rollbar", "Error Tracking");
    if (matchAny(combinedLow, ["datadog-rum", "datadoghq"]))
      add("tools", "Datadog RUM", "Monitoring");
    if (matchAny(combinedLow, ["newrelic"]))
      add("tools", "New Relic", "Monitoring");

    // ────────────────────────────────────────────────────────────────────
    // 11. AUTH / IDENTITY
    // ────────────────────────────────────────────────────────────────────
    if (matchAny(combinedLow, ["auth0.com"]))
      add("tools", "Auth0", "Authentication");
    if (matchAny(combinedLow, ["clerk.dev", "clerk.com"]))
      add("tools", "Clerk", "Authentication");
    if (matchAny(combinedLow, ["next-auth", "nextauth"]))
      add("tools", "NextAuth.js", "Authentication");
    if (matchAny(combinedLow, ["supabase"]) && report.tools.find((t) => !t))
      add("tools", "Supabase Auth", "Authentication");
    if (matchAny(combinedLow, ["okta"]))
      add("tools", "Okta", "Authentication");
    if (matchAny(combinedLow, ["workos"]))
      add("tools", "WorkOS", "Authentication");

    // ────────────────────────────────────────────────────────────────────
    // 12. SECURITY HEADERS
    // ────────────────────────────────────────────────────────────────────
    if (headers["content-security-policy"])
      add("security", "CSP Header", "Security");
    if (headers["strict-transport-security"])
      add("security", "HSTS", "Security");
    if (headers["x-frame-options"])
      add("security", "X-Frame-Options", "Security");
    if (headers["x-xss-protection"])
      add("security", "XSS Protection Header", "Security");
    if (headers["permissions-policy"])
      add("security", "Permissions Policy", "Security");

    // ────────────────────────────────────────────────────────────────────
    // 13. MISC TOOLS
    // ────────────────────────────────────────────────────────────────────
    if (matchAny(combinedLow, ["recaptcha", "hcaptcha"]))
      add("tools", "CAPTCHA", "Security");
    if (matchAny(combinedLow, ["cloudinary"]))
      add("tools", "Cloudinary", "Media");
    if (matchAny(combinedLow, ["imgix"]))
      add("tools", "imgix", "Media");
    if (matchAny(combinedLow, ["mapbox"]))
      add("tools", "Mapbox", "Maps");
    if (matchAny(combinedLow, ["maps.googleapis"]))
      add("tools", "Google Maps", "Maps");
    if (matchAny(combinedLow, ["leafletjs", "leaflet.min"]))
      add("frontend", "Leaflet.js", "Maps");
    if (matchAny(combinedLow, ["chart.js", "chartjs"]))
      add("frontend", "Chart.js", "Charts");
    if (matchAny(combinedLow, ["d3.js", "d3.min", "/d3/"]))
      add("frontend", "D3.js", "Data Viz");
    if (matchAny(combinedLow, ["recharts"]))
      add("frontend", "Recharts", "Charts");
    if (matchAny(combinedLow, ["echarts"]))
      add("frontend", "ECharts", "Charts");
    if (matchAny(combinedLow, ["typewriter", "typed.js"]))
      add("frontend", "Typed.js", "UI Effect");
    if (matchAny(combinedLow, ["swiper"]))
      add("frontend", "Swiper", "Carousel");
    if (matchAny(combinedLow, ["splide"]))
      add("frontend", "Splide", "Carousel");
    if (matchAny(combinedLow, ["embla-carousel"]))
      add("frontend", "Embla Carousel", "Carousel");

    // ────────────────────────────────────────────────────────────────────
    // 14. CLEAN EMPTY CATEGORIES
    // ────────────────────────────────────────────────────────────────────
    for (const key of Object.keys(report)) {
      if (report[key].length === 0) delete report[key];
    }

    return report;
  } catch (error) {
    return { error: error.message };
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
    console.log(`Claude Engine running on http://localhost:${PORT}`);
  });
}