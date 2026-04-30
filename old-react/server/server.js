import express from "express";
import cors from "cors";
import { analyzeStack as analyzeChatGPT } from "./chatgpt.js";
import { analyzeStack as analyzeGemini } from "./gemini.js";
import { analyzeStack as analyzeClaude } from "./claude.js";

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  })
);

app.post("/analyze", async (req, res) => {
  const { url, model } = req.body;
  if (!url) return res.status(400).json({ error: "URL is required" });

  try {
    let result;
    console.log(`Analyzing with model: ${model || 'default'} for URL: ${url}`);
    
    switch (model) {
      case 'chatgpt':
        result = await analyzeChatGPT(url);
        break;
      case 'gemini':
        result = await analyzeGemini(url);
        break;
      case 'claude':
        result = await analyzeClaude(url);
        break;
      default:
        result = await analyzeChatGPT(url); // Fallback to ChatGPT
    }
    
    res.json(result);
  } catch (error) {
    console.error(`Analysis failed for ${model}:`, error.message);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Unified Stack Hub running on http://localhost:${PORT}`);
});