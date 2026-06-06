export type ModelId = "chatgpt" | "gemini" | "claude";

export type AnalysisMode = "tech-stack" | "public-env" | "both";

export interface TechItem {
  name: string;
  cat: string;
  confidence?: string;
  version?: string;
  evidence?: string;
}

export interface PublicEnvItem {
  name: string;
  value: string;
  cat: string;
  source: string;
  confidence?: string;
}

export interface StackReport {
  [key: string]: TechItem[];
}

export interface PublicEnvReport {
  [key: string]: PublicEnvItem[];
}

export interface AnalysisResult {
  techStack?: StackReport;
  publicEnv?: PublicEnvReport;
}
