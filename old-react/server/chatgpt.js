import express from "express";
import axios from "axios";
import * as cheerio from "cheerio";
import cors from "cors";
import { lookup } from "node:dns/promises";
import net from "node:net";

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "32kb" }));
app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  })
);

const http = axios.create({
  timeout: 12000,
  maxRedirects: 5,
  decompress: true,
  responseType: "text",
  validateStatus: () => true,
  headers: {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36",
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
  },
});

function uniq(values) {
  return [...new Set(values.filter(Boolean))];
}

function normalizeWhitespace(value = "") {
  return String(value).replace(/\s+/g, " ").trim();
}

function safeLower(value) {
  return String(value || "").toLowerCase();
}

function safeUrl(input) {
  try {
    return new URL(input);
  } catch {
    return null;
  }
}

function absolutize(baseUrl, maybeRelative) {
  if (!maybeRelative) return null;
  try {
    return new URL(maybeRelative, baseUrl).toString();
  } catch {
    return null;
  }
}

function isPrivateIPv4(ip) {
  const parts = ip.split(".").map((n) => Number(n));
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return false;
  const [a, b] = parts;
  return (
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a === 0
  );
}

function isPrivateIPv6(ip) {
  const v = ip.toLowerCase();
  return (
    v === "::1" ||
    v === "::" ||
    v.startsWith("fc") ||
    v.startsWith("fd") ||
    v.startsWith("fe80:") ||
    v.startsWith("::ffff:127.") ||
    v.startsWith("::ffff:10.") ||
    v.startsWith("::ffff:192.168.") ||
    /^::ffff:172\.(1[6-9]|2\d|3[0-1])\./.test(v)
  );
}

function isPrivateIp(ip) {
  const family = net.isIP(ip);
  if (family === 4) return isPrivateIPv4(ip);
  if (family === 6) return isPrivateIPv6(ip);
  return false;
}

async function assertSafeTarget(rawUrl) {
  const parsed = new URL(rawUrl);

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Only http:// and https:// URLs are allowed");
  }

  const hostname = parsed.hostname.toLowerCase();

  if (["localhost", "127.0.0.1", "::1", "0.0.0.0"].includes(hostname)) {
    throw new Error("Local and loopback targets are not allowed");
  }

  if (net.isIP(hostname) && isPrivateIp(hostname)) {
    throw new Error("Private network targets are not allowed");
  }

  const addresses = await lookup(hostname, { all: true, verbatim: true });
  if (!addresses.length) {
    throw new Error("Could not resolve target host");
  }

  for (const address of addresses) {
    if (isPrivateIp(address.address)) {
      throw new Error("Resolved host points to a private network address");
    }
  }
}

function evidenceFromMatches(label, values, predicate) {
  const hits = values.filter((value) => predicate(safeLower(value)));
  return hits.slice(0, 5).map((value) => `${label}: ${value}`);
}

async function fetchCssBodies(cssUrls, pageOrigin) {
  const sameOriginUrls = uniq(
    cssUrls.filter((href) => {
      const url = safeUrl(href);
      return url && url.origin === pageOrigin;
    })
  ).slice(0, 4);

  const chunks = [];

  await Promise.all(
    sameOriginUrls.map(async (href) => {
      try {
        const response = await http.get(href, {
          timeout: 8000,
          maxContentLength: 250_000,
        });

        const contentType = safeLower(response.headers["content-type"]);
        if (
          response.status >= 200 &&
          response.status < 400 &&
          (contentType.includes("text/css") || href.endsWith(".css"))
        ) {
          chunks.push(String(response.data || ""));
        }
      } catch {
        // CSS enrichment is best effort.
      }
    })
  );

  return chunks.join("\n");
}

function buildContext({ url, finalUrl, response, html, cssText }) {
  const headers = Object.fromEntries(
    Object.entries(response.headers || {}).map(([key, value]) => [
      key.toLowerCase(),
      Array.isArray(value) ? value.join("; ") : String(value ?? ""),
    ])
  );

  const $ = cheerio.load(html || "");
  const metaTags = {};
  const metaDebug = [];

  $("meta").each((_, el) => {
    const name =
      $(el).attr("name") || $(el).attr("property") || $(el).attr("http-equiv");
    const content = $(el).attr("content");
    if (name && content) {
      metaTags[safeLower(name)] = String(content);
      metaDebug.push(`${name}=${content}`);
    }
  });

  const scripts = [];
  const inlineScripts = [];
  $("script").each((_, el) => {
    const src = $(el).attr("src");
    if (src) scripts.push(absolutize(finalUrl, src));

    const code = normalizeWhitespace($(el).html() || "");
    if (code) inlineScripts.push(code.slice(0, 4000));
  });

  const links = [];
  const stylesheets = [];
  $("link[href]").each((_, el) => {
    const href = absolutize(finalUrl, $(el).attr("href"));
    if (!href) return;
    links.push(href);

    if (safeLower($(el).attr("rel")).includes("stylesheet")) {
      stylesheets.push(href);
    }
  });

  const styles = [];
  $("style").each((_, el) => {
    const text = normalizeWhitespace($(el).html() || "");
    if (text) styles.push(text.slice(0, 4000));
  });

  const classNames = [];
  const customElements = new Set();
  const allAttributes = [];
  const dataAttributes = [];

  $("*").each((_, el) => {
    const tagName = safeLower(el.tagName || el.name || "");
    if (tagName.includes("-")) customElements.add(tagName);

    const classAttr = $(el).attr("class");
    if (classAttr) {
      classNames.push(
        ...classAttr
          .split(/\s+/)
          .map((v) => v.trim())
          .filter(Boolean)
      );
    }

    const attrs = el.attribs || {};
    for (const [name, value] of Object.entries(attrs)) {
      const lowerName = safeLower(name);
      allAttributes.push(lowerName);

      if (lowerName.startsWith("data-")) {
        dataAttributes.push(`${lowerName}=${String(value)}`);
      }
    }
  });

  const cookiesRaw = response.headers["set-cookie"];
  const cookies = Array.isArray(cookiesRaw)
    ? cookiesRaw.map((cookie) => String(cookie))
    : cookiesRaw
      ? [String(cookiesRaw)]
      : [];

  const htmlLower = safeLower(html);
  const inlineLower = safeLower(inlineScripts.join("\n"));
  const scriptSrcLower = safeLower(scripts.join("\n"));
  const linksLower = safeLower(links.join("\n"));
  const cssLower = safeLower([cssText, styles.join("\n")].join("\n"));
  const attrsLower = safeLower(allAttributes.join("\n"));
  const dataLower = safeLower(dataAttributes.join("\n"));
  const cookiesLower = safeLower(cookies.join("\n"));

  return {
    url,
    finalUrl,
    origin: new URL(finalUrl).origin,
    status: response.status,
    headers,
    html,
    htmlLower,
    $,
    title: normalizeWhitespace($("title").first().text()),
    metaTags,
    metaDebug,
    scripts: uniq(scripts),
    links: uniq(links),
    stylesheets: uniq(stylesheets),
    inlineScripts,
    styles,
    classNames: uniq(classNames),
    customElements: Array.from(customElements),
    allAttributes: uniq(allAttributes),
    dataAttributes,
    cookies,
    cookiesLower,
    cssText,
    scriptSrcLower,
    linksLower,
    inlineLower,
    cssLower,
    attrsLower,
    dataLower,
  };
}

function detectTechnologies(ctx) {
  const report = {
    frontend: [],
    backend: [],
    tools: [],
  };

  const seen = new Map();

  const push = (group, name, cat, confidence, evidence = []) => {
    const key = `${group}::${name}`;
    const existing = seen.get(key);
    const cleanedEvidence = uniq(evidence).slice(0, 6);

    if (existing) {
      existing.confidence = Math.max(existing.confidence, confidence);
      existing.evidence = uniq([...existing.evidence, ...cleanedEvidence]).slice(
        0,
        6
      );
      return;
    }

    const item = { name, cat, confidence, evidence: cleanedEvidence };
    report[group].push(item);
    seen.set(key, item);
  };

  const server = safeLower(ctx.headers.server);
  const poweredBy = safeLower(ctx.headers["x-powered-by"]);
  const generator = safeLower(ctx.metaTags.generator || "");

  if (
    server.includes("cloudflare") ||
    ctx.headers["cf-ray"] ||
    ctx.headers["cf-cache-status"]
  ) {
    push("backend", "Cloudflare", "CDN/Hosting", 95, [
      server.includes("cloudflare") ? `header server=${ctx.headers.server}` : null,
      ctx.headers["cf-ray"] ? `header cf-ray=${ctx.headers["cf-ray"]}` : null,
      ctx.headers["cf-cache-status"]
        ? `header cf-cache-status=${ctx.headers["cf-cache-status"]}`
        : null,
    ]);
  }

  if (
    server.includes("vercel") ||
    ctx.headers["x-vercel-id"] ||
    ctx.headers["x-vercel-cache"]
  ) {
    push("backend", "Vercel", "Hosting/Edge", 95, [
      server.includes("vercel") ? `header server=${ctx.headers.server}` : null,
      ctx.headers["x-vercel-id"]
        ? `header x-vercel-id=${ctx.headers["x-vercel-id"]}`
        : null,
      ctx.headers["x-vercel-cache"]
        ? `header x-vercel-cache=${ctx.headers["x-vercel-cache"]}`
        : null,
    ]);
  }

  if (poweredBy.includes("express")) {
    push("backend", "Express", "Framework", 95, [
      `header x-powered-by=${ctx.headers["x-powered-by"]}`,
    ]);
  }

  if (poweredBy.includes("php")) {
    push("backend", "PHP", "Runtime", 90, [
      `header x-powered-by=${ctx.headers["x-powered-by"]}`,
    ]);
  }

  if (
    generator.includes("wordpress") ||
    ctx.htmlLower.includes("wp-content") ||
    ctx.htmlLower.includes("wp-includes") ||
    /wordpress|wp-/.test(ctx.cookiesLower)
  ) {
    push("backend", "WordPress", "CMS", 95, [
      generator.includes("wordpress")
        ? `meta generator=${ctx.metaTags.generator}`
        : null,
      ctx.htmlLower.includes("wp-content") ? "html contains wp-content" : null,
      ctx.htmlLower.includes("wp-includes") ? "html contains wp-includes" : null,
      /wordpress|wp-/.test(ctx.cookiesLower)
        ? "cookie name mentions wordpress/wp-"
        : null,
    ]);
    push("backend", "PHP", "Runtime", 65, ["implied by WordPress"]);
  }

  if (
    ctx.inlineLower.includes("window.shopify") ||
    ctx.inlineLower.includes("shopify.shop") ||
    ctx.inlineLower.includes("shopify-checkout-api-token") ||
    ctx.scriptSrcLower.includes("cdn.shopify.com") ||
    ctx.linksLower.includes("cdn.shopify.com") ||
    ctx.cookiesLower.includes("_shopify")
  ) {
    push("backend", "Shopify", "Ecommerce", 90, [
      ctx.inlineLower.includes("window.shopify")
        ? "inline script contains window.Shopify"
        : null,
      ctx.inlineLower.includes("shopify.shop")
        ? "inline script contains Shopify.shop"
        : null,
      ctx.inlineLower.includes("shopify-checkout-api-token")
        ? "inline script contains shopify-checkout-api-token"
        : null,
      ctx.scriptSrcLower.includes("cdn.shopify.com") ||
      ctx.linksLower.includes("cdn.shopify.com")
        ? "asset url uses cdn.shopify.com"
        : null,
      ctx.cookiesLower.includes("_shopify")
        ? "cookie name starts with _shopify"
        : null,
    ]);
  }

  if (
    ctx.$("script#__NEXT_DATA__").length > 0 ||
    ctx.scriptSrcLower.includes("/_next/") ||
    ctx.htmlLower.includes("/_next/") ||
    ctx.inlineLower.includes("self.__next_f.push")
  ) {
    push("frontend", "Next.js", "Framework", 95, [
      ctx.$("script#__NEXT_DATA__").length > 0
        ? "script#__NEXT_DATA__ present"
        : null,
      ctx.scriptSrcLower.includes("/_next/") || ctx.htmlLower.includes("/_next/")
        ? "asset path contains /_next/"
        : null,
      ctx.inlineLower.includes("self.__next_f.push")
        ? "inline script contains self.__next_f.push"
        : null,
    ]);
    push("frontend", "React", "Library", 80, ["implied by Next.js"]);
  }

  if (
    ctx.inlineLower.includes("__nuxt") ||
    ctx.htmlLower.includes("/__nuxt") ||
    ctx.scriptSrcLower.includes("/_nuxt/") ||
    ctx.linksLower.includes("/_nuxt/")
  ) {
    push("frontend", "Nuxt", "Framework", 95, [
      ctx.inlineLower.includes("__nuxt")
        ? "inline script contains __NUXT__"
        : null,
      ctx.scriptSrcLower.includes("/_nuxt/") ||
      ctx.linksLower.includes("/_nuxt/")
        ? "asset path contains /_nuxt/"
        : null,
    ]);
    push("frontend", "Vue.js", "Framework", 80, ["implied by Nuxt"]);
  }

  let hasVueDirective = false;
  ctx.$("*")
    .slice(0, 250)
    .each((_, el) => {
      const attrs = el.attribs || {};
      if (
        Object.keys(attrs).some(
          (attr) =>
            attr.startsWith("v-") ||
            attr.startsWith(":") ||
            attr.startsWith("@")
        )
      ) {
        hasVueDirective = true;
      }
    });

  if (
    hasVueDirective ||
    ctx.scriptSrcLower.includes("vue") ||
    ctx.attrsLower.includes("data-v-") ||
    ctx.dataLower.includes("data-v-")
  ) {
    push("frontend", "Vue.js", "Framework", hasVueDirective ? 90 : 70, [
      hasVueDirective ? "vue-style directive attributes detected" : null,
      ctx.scriptSrcLower.includes("vue") ? "script src mentions vue" : null,
      ctx.attrsLower.includes("data-v-") || ctx.dataLower.includes("data-v-")
        ? "attribute contains data-v-*"
        : null,
    ]);
  }

  if (
    /\bsvelte-[a-z0-9]+\b/i.test(ctx.classNames.join(" ")) ||
    ctx.scriptSrcLower.includes("svelte") ||
    ctx.htmlLower.includes("svelte-")
  ) {
    push("frontend", "Svelte", "Framework", 90, [
      /\bsvelte-[a-z0-9]+\b/i.test(ctx.classNames.join(" "))
        ? "class name matches svelte-*"
        : null,
      ctx.scriptSrcLower.includes("svelte")
        ? "script src mentions svelte"
        : null,
    ]);
  }

  if (
    ctx.htmlLower.includes("/_app/immutable/") ||
    ctx.scriptSrcLower.includes("/_app/immutable/") ||
    ctx.linksLower.includes("/_app/immutable/")
  ) {
    push("frontend", "SvelteKit", "Framework", 90, [
      "asset path contains /_app/immutable/",
    ]);
    push("frontend", "Svelte", "Framework", 75, ["implied by SvelteKit"]);
  }

  if (
    ctx.customElements.includes("astro-island") ||
    ctx.htmlLower.includes("/_astro/") ||
    ctx.scriptSrcLower.includes("/_astro/") ||
    ctx.linksLower.includes("/_astro/")
  ) {
    push("frontend", "Astro", "Framework", 95, [
      ctx.customElements.includes("astro-island")
        ? "custom element astro-island present"
        : null,
      ctx.htmlLower.includes("/_astro/") ||
      ctx.scriptSrcLower.includes("/_astro/") ||
      ctx.linksLower.includes("/_astro/")
        ? "asset path contains /_astro/"
        : null,
    ]);
  }

  if (
    ctx.$("#___gatsby").length > 0 ||
    ctx.htmlLower.includes("___gatsby") ||
    ctx.htmlLower.includes("/page-data/") ||
    ctx.inlineLower.includes("__path_prefix__")
  ) {
    push("frontend", "Gatsby", "Framework", 90, [
      ctx.$("#___gatsby").length > 0 ? "#___gatsby present" : null,
      ctx.htmlLower.includes("/page-data/") ? "html contains /page-data/" : null,
      ctx.inlineLower.includes("__path_prefix__")
        ? "inline script contains __PATH_PREFIX__"
        : null,
    ]);
    push("frontend", "React", "Library", 75, ["implied by Gatsby"]);
  }

  if (
    ctx.inlineLower.includes("__remixcontext") ||
    ctx.scriptSrcLower.includes("entry.client")
  ) {
    push("frontend", "Remix", "Framework", 85, [
      ctx.inlineLower.includes("__remixcontext")
        ? "inline script contains __remixContext"
        : null,
      ctx.scriptSrcLower.includes("entry.client")
        ? "script src mentions entry.client"
        : null,
    ]);
    push("frontend", "React", "Library", 70, ["implied by Remix"]);
  }

  if (ctx.$("[data-reactroot]").length > 0 || ctx.scriptSrcLower.includes("react")) {
    push("frontend", "React", "Library", ctx.$("[data-reactroot]").length > 0 ? 85 : 60, [
      ctx.$("[data-reactroot]").length > 0 ? "[data-reactroot] present" : null,
      ctx.scriptSrcLower.includes("react") ? "script src mentions react" : null,
    ]);
  }

  if (ctx.$("[ng-version], [ng-app]").length > 0 || ctx.attrsLower.includes("ng-version")) {
    push("frontend", "Angular", "Framework", 95, [
      ctx.$("[ng-version]").length > 0 ? "[ng-version] present" : null,
      ctx.$("[ng-app]").length > 0 ? "[ng-app] present" : null,
    ]);
  }

  if (
    ctx.$("[x-data], [x-show], [x-bind], [x-on\\:click]").length > 0 ||
    ctx.attrsLower.includes("x-data") ||
    ctx.attrsLower.includes("x-show")
  ) {
    push("frontend", "Alpine.js", "Framework", 90, [
      ctx.$("[x-data]").length > 0 ? "[x-data] present" : null,
      ctx.$("[x-show]").length > 0 ? "[x-show] present" : null,
      ctx.attrsLower.includes("x-bind") ? "attribute x-bind present" : null,
      ctx.attrsLower.includes("x-on:click")
        ? "attribute x-on:click present"
        : null,
    ]);
  }

  const tailwindUtilityMatches = ctx.classNames.filter(
    (name) =>
      /^(?:sm:|md:|lg:|xl:|2xl:|hover:|focus:|dark:)?(?:p[trblxy]?|m[trblxy]?|bg|text|font|rounded|grid|col|row|gap|items|justify|w|h|max-w|min-h|flex(?:-[a-z0-9]+)?|shadow|ring|border)-(?:\[.*\]|[a-z0-9/-]+)$/i.test(
        name
      ) || /^(flex|grid|container|sr-only)$/i.test(name)
  );

  if (
    ctx.cssLower.includes("--tw-") ||
    tailwindUtilityMatches.length >= 8 ||
    ctx.linksLower.includes("tailwind")
  ) {
    push("frontend", "Tailwind CSS", "Styling", ctx.cssLower.includes("--tw-") ? 95 : 75, [
      ctx.cssLower.includes("--tw-") ? "css contains --tw-* variables" : null,
      tailwindUtilityMatches.length >= 8
        ? `${tailwindUtilityMatches.length} utility-like class names detected`
        : null,
      ctx.linksLower.includes("tailwind")
        ? "stylesheet url mentions tailwind"
        : null,
    ]);
  }

  if (
    ctx.linksLower.includes("bootstrap") ||
    ctx.scriptSrcLower.includes("bootstrap") ||
    (ctx.classNames.includes("btn") &&
      ctx.classNames.some((name) => name.startsWith("btn-")))
  ) {
    push("frontend", "Bootstrap", "Styling", 90, [
      ctx.linksLower.includes("bootstrap") || ctx.scriptSrcLower.includes("bootstrap")
        ? "asset url mentions bootstrap"
        : null,
      ctx.classNames.includes("btn") &&
      ctx.classNames.some((name) => name.startsWith("btn-"))
        ? "class combination btn + btn-* detected"
        : null,
    ]);
  }

  if (ctx.scriptSrcLower.includes("jquery")) {
    push(
      "frontend",
      "jQuery",
      "Library",
      95,
      evidenceFromMatches("script", ctx.scripts, (s) => s.includes("jquery"))
    );
  }

  if (
    ctx.htmlLower.includes("lucide") ||
    ctx.scriptSrcLower.includes("lucide") ||
    ctx.classNames.includes("lucide")
  ) {
    push("frontend", "Lucide Icons", "Icons", 80, [
      ctx.htmlLower.includes("lucide") ? "html mentions lucide" : null,
      ctx.scriptSrcLower.includes("lucide")
        ? "script src mentions lucide"
        : null,
      ctx.classNames.includes("lucide") ? "class lucide detected" : null,
    ]);
  }

  if (
    ctx.scriptSrcLower.includes("framer-motion") ||
    ctx.scriptSrcLower.includes("motion.dev") ||
    ctx.htmlLower.includes("data-framer")
  ) {
    push("frontend", "Framer Motion", "Animation", 75, [
      ctx.scriptSrcLower.includes("framer-motion")
        ? "script src mentions framer-motion"
        : null,
      ctx.scriptSrcLower.includes("motion.dev")
        ? "script src uses motion.dev"
        : null,
      ctx.htmlLower.includes("data-framer")
        ? "html contains data-framer*"
        : null,
    ]);
  }

  if (
    ctx.scriptSrcLower.includes("googletagmanager.com/gtm.js") ||
    ctx.inlineLower.includes("event:'gtm.js'") ||
    ctx.inlineLower.includes('event:"gtm.js"') ||
    /gtm-[a-z0-9]+/.test(ctx.htmlLower)
  ) {
    push("tools", "Google Tag Manager", "Tag Manager", 95, [
      ctx.scriptSrcLower.includes("googletagmanager.com/gtm.js")
        ? "script src uses googletagmanager.com/gtm.js"
        : null,
      ctx.inlineLower.includes("event:'gtm.js'") ||
      ctx.inlineLower.includes('event:"gtm.js"')
        ? "inline script contains gtm.js bootstrap"
        : null,
      /gtm-[a-z0-9]+/.test(ctx.htmlLower) ? "html contains GTM-* id" : null,
    ]);
  }

  if (
    ctx.scriptSrcLower.includes("googletagmanager.com/gtag/js") ||
    ctx.scriptSrcLower.includes("google-analytics.com") ||
    ctx.inlineLower.includes("gtag(") ||
    ctx.inlineLower.includes("window.datalayer")
  ) {
    push("tools", "Google Analytics", "Analytics", 90, [
      ctx.scriptSrcLower.includes("googletagmanager.com/gtag/js")
        ? "script src uses googletagmanager.com/gtag/js"
        : null,
      ctx.scriptSrcLower.includes("google-analytics.com")
        ? "script src uses google-analytics.com"
        : null,
      ctx.inlineLower.includes("gtag(")
        ? "inline script contains gtag()"
        : null,
      ctx.inlineLower.includes("window.datalayer")
        ? "inline script contains window.dataLayer"
        : null,
    ]);
  }

  if (
    ctx.scriptSrcLower.includes("js.stripe.com") ||
    ctx.linksLower.includes("checkout.stripe.com")
  ) {
    push("tools", "Stripe", "Payments", 95, [
      ctx.scriptSrcLower.includes("js.stripe.com")
        ? "script src uses js.stripe.com"
        : null,
      ctx.linksLower.includes("checkout.stripe.com")
        ? "link href uses checkout.stripe.com"
        : null,
    ]);
  }

  if (
    ctx.scriptSrcLower.includes("intercom") ||
    ctx.inlineLower.includes("intercomsettings") ||
    ctx.cookiesLower.includes("intercom")
  ) {
    push("tools", "Intercom", "Customer Data", 90, [
      ctx.scriptSrcLower.includes("intercom")
        ? "script src mentions intercom"
        : null,
      ctx.inlineLower.includes("intercomsettings")
        ? "inline script contains intercomSettings"
        : null,
      ctx.cookiesLower.includes("intercom")
        ? "cookie mentions intercom"
        : null,
    ]);
  }

  if (
    ctx.scriptSrcLower.includes("hotjar") ||
    ctx.inlineLower.includes("hj(") ||
    ctx.inlineLower.includes("_hjsettings")
  ) {
    push("tools", "Hotjar", "User Behavior", 90, [
      ctx.scriptSrcLower.includes("hotjar")
        ? "script src mentions hotjar"
        : null,
      ctx.inlineLower.includes("hj(") ? "inline script contains hj()" : null,
      ctx.inlineLower.includes("_hjsettings")
        ? "inline script contains _hjSettings"
        : null,
    ]);
  }

  if (
    ctx.scriptSrcLower.includes("sentry") ||
    ctx.inlineLower.includes("sentry.init") ||
    ctx.inlineLower.includes("ingest.sentry.io")
  ) {
    push("tools", "Sentry", "Error Tracking", 90, [
      ctx.scriptSrcLower.includes("sentry")
        ? "script src mentions sentry"
        : null,
      ctx.inlineLower.includes("sentry.init")
        ? "inline script contains Sentry.init"
        : null,
      ctx.inlineLower.includes("ingest.sentry.io")
        ? "inline script mentions ingest.sentry.io"
        : null,
    ]);
  }

  for (const group of Object.keys(report)) {
    report[group].sort(
      (a, b) => b.confidence - a.confidence || a.name.localeCompare(b.name)
    );
  }

  return report;
}

async function analyzeStack(rawUrl) {
  try {
    await assertSafeTarget(rawUrl);

    const response = await http.get(rawUrl, {
      maxContentLength: 2_000_000,
    });

    const finalUrl = response.request?.res?.responseUrl || rawUrl;

    const contentType = safeLower(response.headers["content-type"] || "");
    const isHtmlLike =
      !contentType ||
      contentType.includes("text/html") ||
      contentType.includes("application/xhtml+xml");

    const html = isHtmlLike ? String(response.data || "") : "";
    const parsedFinal = new URL(finalUrl);

    const preliminaryCtx = buildContext({
      url: rawUrl,
      finalUrl,
      response,
      html,
      cssText: "",
    });

    const cssText = await fetchCssBodies(
      preliminaryCtx.stylesheets,
      parsedFinal.origin
    );

    const ctx = buildContext({
      url: rawUrl,
      finalUrl,
      response,
      html,
      cssText,
    });

    const detected = detectTechnologies(ctx);

    return {
      ok: true,
      inputUrl: rawUrl,
      finalUrl,
      status: response.status,
      title: ctx.title || null,
      contentType: response.headers["content-type"] || null,
      meta: {
        generator: ctx.metaTags.generator || null,
        technologiesInspected: {
          scripts: ctx.scripts.length,
          stylesheets: ctx.stylesheets.length,
          inlineScripts: ctx.inlineScripts.length,
          cookies: ctx.cookies.length,
          customElements: ctx.customElements.length,
        },
      },
      ...detected,
    };
  } catch (error) {
    return {
      ok: false,
      error: error.message,
    };
  }
}

app.get("/", (req, res) => {
  res.json({
    message: "Stack Analyzer API is running",
    usage: 'POST /analyze with { "url": "https://example.com" }',
  });
});

app.post("/analyze", async (req, res) => {
  try {
    const { url } = req.body || {};

    if (!url || typeof url !== "string") {
      return res.status(400).json({ error: "URL is required" });
    }

    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      return res.status(400).json({ error: "URL must be a valid absolute URL" });
    }

    if (!["http:", "https:"].includes(parsed.protocol)) {
      return res
        .status(400)
        .json({ error: "URL must start with http:// or https://" });
    }

    const result = await analyzeStack(parsed.toString());
    const status = result.ok ? 200 : 400;
    return res.status(status).json(result);
  } catch (error) {
    return res
      .status(500)
      .json({ error: error.message || "Internal server error" });
  }
});

export { analyzeStack };

if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}`) {
  app.listen(PORT, () => {
    console.log(`ChatGPT Engine running on http://localhost:${PORT}`);
  });
}
