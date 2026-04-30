import { NextResponse } from 'next/server';
import { lookup } from "node:dns/promises";
import net from "node:net";
import { analyzeChatGPT } from '@/lib/chatgpt';
import { analyzeGemini } from '@/lib/gemini';
import { analyzeClaude } from '@/lib/claude';

// ==========================================
// SECURITY HELPERS
// ==========================================
function isPrivateIp(ip: string) {
  const family = net.isIP(ip);
  if (family === 4) {
    const parts = ip.split(".").map(Number);
    return parts[0] === 10 || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) || (parts[0] === 192 && parts[1] === 168) || parts[0] === 127;
  }
  return ip.startsWith("fe80:") || ip === "::1" || ip === "::";
}

async function assertSafeTarget(rawUrl: string) {
  const parsed = new URL(rawUrl);
  if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("Invalid protocol");
  const hostname = parsed.hostname.toLowerCase();
  if (["localhost", "127.0.0.1", "::1"].includes(hostname)) throw new Error("Local targets forbidden");
  
  try {
    const addresses = await lookup(hostname, { all: true });
    for (const addr of addresses) {
      if (isPrivateIp(addr.address)) throw new Error("Private IP target forbidden");
    }
  } catch (e: any) {
    if (e.message.includes("forbidden")) throw e;
  }
}

export async function POST(req: Request) {
  try {
    const { url, model } = await req.json();
    if (!url) return NextResponse.json({ error: "URL is required" }, { status: 400 });

    await assertSafeTarget(url);

    let result;
    switch (model) {
      case 'chatgpt': result = await analyzeChatGPT(url); break;
      case 'gemini': result = await analyzeGemini(url); break;
      case 'claude': result = await analyzeClaude(url); break;
      default: result = await analyzeChatGPT(url);
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
