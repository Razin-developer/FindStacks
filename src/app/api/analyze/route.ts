import { NextResponse } from 'next/server';
import { analyzeChatGPTTechStack } from '@/lib/tech-stack/chatgpt';
import { analyzeGeminiTechStack } from '@/lib/tech-stack/gemini';
import { analyzeClaudeTechStack } from '@/lib/tech-stack/claude';
import { analyzeChatGPTPublicEnv } from '@/lib/public-env/chatgpt';
import { analyzeGeminiPublicEnv } from '@/lib/public-env/gemini';
import { analyzeClaudePublicEnv } from '@/lib/public-env/claude';
import type { AnalysisMode, AnalysisResult, ModelId } from '@/lib/analysis/types';

async function runAnalysis(model: ModelId, url: string, mode: AnalysisMode): Promise<AnalysisResult> {
  const result: AnalysisResult = {};

  if (mode === 'tech-stack' || mode === 'both') {
    switch (model) {
      case 'chatgpt':
        result.techStack = await analyzeChatGPTTechStack(url);
        break;
      case 'gemini':
        result.techStack = await analyzeGeminiTechStack(url);
        break;
      case 'claude':
        result.techStack = await analyzeClaudeTechStack(url);
        break;
    }
  }

  if (mode === 'public-env' || mode === 'both') {
    switch (model) {
      case 'chatgpt':
        result.publicEnv = await analyzeChatGPTPublicEnv(url);
        break;
      case 'gemini':
        result.publicEnv = await analyzeGeminiPublicEnv(url);
        break;
      case 'claude':
        result.publicEnv = await analyzeClaudePublicEnv(url);
        break;
    }
  }

  return result;
}

export async function POST(req: Request) {
  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid or missing JSON body" }, { status: 400 });
    }

    const { url, model, mode } = body as {
      url?: string;
      model?: ModelId;
      mode?: AnalysisMode;
    };
    if (!url) return NextResponse.json({ error: "URL is required" }, { status: 400 });

    const safeModel: ModelId = model === 'gemini' || model === 'claude' ? model : 'chatgpt';
    const safeMode: AnalysisMode =
      mode === 'public-env' || mode === 'both' ? mode : 'tech-stack';
    const result = await runAnalysis(safeModel, url, safeMode);

    return NextResponse.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unexpected analysis failure';
    console.error('API Error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
