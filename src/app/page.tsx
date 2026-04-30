'use client';

import React, { useState } from 'react';
import {
  Search, Loader2, Cpu, Layout, Wrench, Globe, ExternalLink,
  Database, BarChart, Shield, Network, Server, CreditCard,
  ShoppingCart, Zap, Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface TechItem {
  name: string;
  cat: string;
  confidence?: string;
  version?: string;
}

interface StackReport {
  [key: string]: TechItem[];
}

const categoryConfig: Record<string, { title: string, icon: any, color: string }> = {
  frontend: { title: "Frontend", icon: Layout, color: "#ffff00" },
  backend: { title: "Backend", icon: Cpu, color: "#ccff00" },
  cms: { title: "CMS", icon: Globe, color: "#00ffff" },
  database: { title: "Database", icon: Database, color: "#ff00ff" },
  analytics: { title: "Analytics", icon: BarChart, color: "#ff9900" },
  security: { title: "Security", icon: Shield, color: "#00ff00" },
  cdn: { title: "CDN", icon: Network, color: "#ff0066" },
  hosting: { title: "Hosting", icon: Server, color: "#6600ff" },
  tools: { title: "Tools", icon: Wrench, color: "#ffffff" },
  payments: { title: "Payments", icon: CreditCard, color: "#00ff99" },
  ecommerce: { title: "E-Commerce", icon: ShoppingCart, color: "#ffcc00" },
};

const Marquee = () => (
  <div className="marquee-wrapper">
    <motion.div
      className="marquee-content"
      animate={{ x: [0, -1000] }}
      transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
    >
      {[...Array(10)].map((_, i) => (
        <div key={i} className="marquee-item">
          🚀 ANALYZE ANY SITE <span className="spacer">✦</span>
          FIND FRONTEND STACKS <span className="spacer">✦</span>
          REVEAL BACKEND TOOLS <span className="spacer">✦</span>
        </div>
      ))}
    </motion.div>
  </div>
);

const StackCard = ({ title, icon: Icon, items, color }: { title: string, icon: React.ElementType, items: TechItem[], color: string }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className="stack-card"
  >
    <div className="card-header">
      <h3 className="card-title" style={{ color }}>
        {title} <Icon size={20} />
      </h3>
    </div>
    <div className="tech-list">
      {items.length > 0 ? items.map((item, idx) => (
        <div key={idx} className="tech-item-row">
          <div className="tech-symbol" style={{ backgroundColor: color, color: '#000' }}>
            {item.name.substring(0, 2).toUpperCase()}
          </div>
          <div className="tech-details">
            <div className="tech-name-wrapper">
              <span className="tech-name-main">{item.name}</span>
              {item.confidence === 'high' && <Zap size={12} className="confidence-icon" />}
            </div>
            <span className="tech-cat-label">{item.cat}</span>
          </div>
        </div>
      )) : (
        <p className="no-data">No signatures detected</p>
      )}
    </div>
  </motion.div>
);

export default function Home() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<StackReport | null>(null);
  const [selectedModel, setSelectedModel] = useState<'chatgpt' | 'gemini' | 'claude'>('chatgpt');
  const [compareMode, setCompareMode] = useState(false);
  const [comparisonResults, setComparisonResults] = useState<Record<string, StackReport | null>>({});

  const analyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return;

    setLoading(true);
    setReport(null);
    setComparisonResults({});

    try {
      if (compareMode) {
        const models = ['chatgpt', 'gemini', 'claude'] as const;
        const results = await Promise.all(models.map(async (m) => {
          try {
            const res = await fetch('/api/analyze', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ url, model: m })
            });
            const data = await res.json();
            return { model: m, data: data.error ? null : data };
          } catch {
            return { model: m, data: null };
          }
        }));

        const newResults: Record<string, StackReport | null> = {};
        results.forEach(r => { newResults[r.model] = r.data; });
        setComparisonResults(newResults);
      } else {
        const response = await fetch('/api/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url, model: selectedModel })
        });

        const data = await response.json();
        if (data.error) throw new Error(data.error);
        setReport(data);
      }
    } catch (error: any) {
      console.error('Analysis error:', error);
      alert(error.message || 'Failed to analyze the site.');
    } finally {
      setLoading(false);
    }
  };

  const totalTechCount = report 
    ? Object.values(report).reduce((acc, items) => acc + (Array.isArray(items) ? items.length : 0), 0)
    : 0;

  return (
    <div className="app-container">
      <div className="decor-pink" />
      <div className="decor-purple" />
      <Marquee />

      <header className="hero-header">
        <div className="title-wrapper">
          <span className="sub-title">The Space Between</span>
          <div className="title-accent" />
          <h1 className="main-title">
            TECH&<br />STACKS
          </h1>
        </div>
      </header>

      <main className="main-content">
        <form onSubmit={analyze} className="search-form">
          <div className="input-group">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com"
              className="neo-input"
              required
            />
            <Globe className="input-icon" />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="neo-button"
          >
            {loading ? <Loader2 className="spin" /> : (compareMode ? "Compare All" : "Analyze")}
          </button>
        </form>

        <div className="model-controls">
          <div className="model-tabs">
            {(['chatgpt', 'gemini', 'claude'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setSelectedModel(m)}
                className={`model-tab ${selectedModel === m && !compareMode ? 'active' : ''}`}
                disabled={compareMode}
              >
                {m.toUpperCase()}
              </button>
            ))}
          </div>
          <button 
            onClick={() => setCompareMode(!compareMode)}
            className={`compare-toggle ${compareMode ? 'active' : ''}`}
          >
            {compareMode ? "SINGLE MODE" : "COMPARE MODE"}
          </button>
        </div>

        <div className="info-banner">
          <Info className="info-banner-icon" size={24} />
          <p className="info-banner-text">
            <strong>SYSTEM NOTICE:</strong> {compareMode ? "Comparison mode executes 3 simultaneous scans." : `Selected engine: ${selectedModel.toUpperCase()}.`} 
            Deep scan may fail if target server employs aggressive anti-bot shielding.
          </p>
        </div>

        <AnimatePresence>
          {loading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="loading-state"
            >
              <div className="custom-loader" />
              <h2 className="loading-title">Deep Scanning...</h2>
              <p className="loading-text">Analyzing meta tags, scripts, headers & server fingerprints</p>
            </motion.div>
          )}

          {compareMode && Object.keys(comparisonResults).length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="comparison-grid"
            >
              {(['chatgpt', 'gemini', 'claude'] as const).map((m) => (
                <div key={m} className="comparison-column">
                  <div className="column-header">
                    <span className="column-label">{m.toUpperCase()} RESULTS</span>
                  </div>
                  <div className="column-content">
                    {comparisonResults[m] ? (
                      Object.entries(comparisonResults[m]!).map(([key, items]) => {
                        const config = categoryConfig[key] || { title: key.toUpperCase(), icon: Info, color: "#fff" };
                        if (!Array.isArray(items) || items.length === 0) return null;
                        return (
                          <StackCard 
                            key={key}
                            title={config.title} 
                            icon={config.icon} 
                            items={items} 
                            color={config.color} 
                          />
                        );
                      })
                    ) : (
                      <div className="error-state" style={{ textAlign: 'center', padding: '2rem', color: '#ff4444' }}>
                        Scan Failed
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </motion.div>
          )}

          {!compareMode && report && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="results-wrapper"
            >
              <div className="results-label-container">
                <h2 className="results-label">
                  Analysis for: <span className="target-url">{url}</span>
                </h2>
              </div>

              <div className="cards-grid">
                {Object.entries(report).map(([key, items]) => {
                  const config = categoryConfig[key] || { title: key.toUpperCase(), icon: Info, color: "#fff" };
                  if (!Array.isArray(items)) return null;
                  return (
                    <StackCard 
                      key={key}
                      title={config.title} 
                      icon={config.icon} 
                      items={items} 
                      color={config.color} 
                    />
                  );
                })}
              </div>

              <div className="summary-box">
                <h3 className="summary-title">
                  Intelligence Report <ExternalLink size={20} />
                </h3>
                <p className="summary-text">
                  The {selectedModel.toUpperCase()} engine identified {totalTechCount} unique technology signatures.
                  The site architecture shows a highly optimized modern stack.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <footer className="app-footer">
        FindStacks © 2026 // Next-Gen Technology Discovery Engine
      </footer>
    </div>
  );
}
