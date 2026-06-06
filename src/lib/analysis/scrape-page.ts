import "server-only";

import axios from "axios";
import * as cheerio from "cheerio";
import { lookup } from "node:dns/promises";
import net from "node:net";

const http = axios.create({
  timeout: 12000,
  maxRedirects: 5,
  maxContentLength: 5_000_000,
  validateStatus: () => true,
  headers: {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36",
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
  },
});

function isPrivateIp(ip: string) {
  const family = net.isIP(ip);
  if (family === 4) {
    const parts = ip.split(".").map(Number);
    return (
      parts[0] === 10 ||
      (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
      (parts[0] === 192 && parts[1] === 168) ||
      parts[0] === 127
    );
  }

  return ip.startsWith("fe80:") || ip === "::1" || ip === "::";
}

export async function assertSafeTarget(rawUrl: string) {
  const parsed = new URL(rawUrl);
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Invalid protocol");
  }

  const hostname = parsed.hostname.toLowerCase();
  if (["localhost", "127.0.0.1", "::1"].includes(hostname)) {
    throw new Error("Local targets forbidden");
  }

  try {
    const addresses = await lookup(hostname, { all: true });
    for (const address of addresses) {
      if (isPrivateIp(address.address)) {
        throw new Error("Private IP target forbidden");
      }
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes("forbidden")) {
      throw error;
    }
  }
}

export interface ScrapedPage {
  url: string;
  finalUrl: string;
  html: string;
  htmlLower: string;
  $: cheerio.CheerioAPI;
  headers: Record<string, string>;
  scripts: string[];
  scriptText: string[];
  links: string[];
  metaTags: Record<string, string>;
  classes: string[];
  textContent: string;
}

export async function scrapePage(url: string): Promise<ScrapedPage> {
  await assertSafeTarget(url);

  const response = await http.get<string>(url);
  const html = typeof response.data === "string" ? response.data : String(response.data);
  const $ = cheerio.load(html);
  const headers = Object.fromEntries(
    Object.entries(response.headers).map(([key, value]) => [
      key.toLowerCase(),
      Array.isArray(value) ? value.join(", ") : String(value ?? "").toLowerCase(),
    ]),
  );

  const scripts: string[] = [];
  $("script[src]").each((_, element) => {
    const src = $(element).attr("src");
    if (src) {
      scripts.push(src.toLowerCase());
    }
  });

  const scriptText: string[] = [];
  $("script").each((_, element) => {
    const content = $(element).html();
    if (content) {
      scriptText.push(content);
    }
  });

  const links: string[] = [];
  $("link[href], a[href]").each((_, element) => {
    const href = $(element).attr("href");
    if (href) {
      links.push(href.toLowerCase());
    }
  });

  const metaTags: Record<string, string> = {};
  $("meta").each((_, element) => {
    const name = $(element).attr("name") || $(element).attr("property");
    const content = $(element).attr("content");
    if (name && content) {
      metaTags[name.toLowerCase()] = content.toLowerCase();
    }
  });

  const classes: string[] = [];
  $("[class]").each((_, element) => {
    const className = $(element).attr("class");
    if (className) {
      classes.push(className);
    }
  });

  return {
    url,
    finalUrl: response.request?.res?.responseUrl || url,
    html,
    htmlLower: html.toLowerCase(),
    $,
    headers,
    scripts,
    scriptText,
    links,
    metaTags,
    classes,
    textContent: $.text(),
  };
}
