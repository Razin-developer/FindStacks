'use client';

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  BarChart,
  Brain,
  Cable,
  Cpu,
  CreditCard,
  Database,
  ExternalLink,
  Globe,
  Info,
  KeyRound,
  Layout,
  Loader2,
  Network,
  Search,
  Server,
  Shield,
  ShoppingCart,
  Sparkles,
  Terminal,
  WandSparkles,
  Wrench,
  Zap,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import type {
  AnalysisMode,
  AnalysisResult,
  ModelId,
  PublicEnvItem,
  PublicEnvReport,
  StackReport,
  TechItem,
} from '@/lib/analysis/types';

function SearchParamsHandler({ setUrl }: { setUrl: (url: string) => void }) {
  const searchParams = useSearchParams();

  useEffect(() => {
    const urlParam = searchParams.get('url');
    if (!urlParam) {
      return;
    }

    const sanitized = urlParam.replace(/[<>]/g, '').trim();
    if (sanitized) {
      setUrl(sanitized);
    }
  }, [searchParams, setUrl]);

  return null;
}

const MODEL_ORDER: ModelId[] = ['chatgpt', 'gemini', 'claude'];

const MODE_CONFIG: Array<{
  id: AnalysisMode;
  label: string;
  shortLabel: string;
  description: string;
  accentClass: string;
  icon: React.ElementType;
}> = [
  {
    id: 'tech-stack',
    label: 'Tech Stack',
    shortLabel: 'Stack',
    description: 'Frontend, backend, infra, and service signatures.',
    accentClass: 'stack',
    icon: Cpu,
  },
  {
    id: 'public-env',
    label: 'Public ENV',
    shortLabel: 'ENV',
    description: 'Client-safe env vars, public endpoints, and build clues.',
    accentClass: 'env',
    icon: KeyRound,
  },
  {
    id: 'both',
    label: 'Both',
    shortLabel: 'Both',
    description: 'Run stack fingerprinting and public runtime config together.',
    accentClass: 'both',
    icon: WandSparkles,
  },
];

const MODEL_CONFIG: Record<ModelId, { label: string; icon: React.ElementType; tint: string }> = {
  chatgpt: { label: 'ChatGPT', icon: Sparkles, tint: '#ff7ab6' },
  gemini: { label: 'Gemini', icon: Search, tint: '#ffd84d' },
  claude: { label: 'Claude', icon: Brain, tint: '#99f25d' },
};

const TECH_CATEGORY_CONFIG: Record<string, { title: string; icon: React.ElementType; color: string }> = {
  frontend: { title: 'Frontend', icon: Layout, color: '#ffff00' },
  backend: { title: 'Backend', icon: Cpu, color: '#ccff00' },
  cms: { title: 'CMS', icon: Globe, color: '#00ffff' },
  database: { title: 'Database', icon: Database, color: '#ff00ff' },
  analytics: { title: 'Analytics', icon: BarChart, color: '#ff9900' },
  security: { title: 'Security', icon: Shield, color: '#00ff99' },
  cdn: { title: 'CDN', icon: Network, color: '#ff4f8b' },
  hosting: { title: 'Hosting', icon: Server, color: '#7a5cff' },
  tools: { title: 'Tools', icon: Wrench, color: '#ffffff' },
  payments: { title: 'Payments', icon: CreditCard, color: '#00ffcc' },
  ecommerce: { title: 'E-Commerce', icon: ShoppingCart, color: '#ffcc00' },
};

const ENV_CATEGORY_CONFIG: Record<string, { title: string; icon: React.ElementType; color: string }> = {
  variables: { title: 'Public Variables', icon: KeyRound, color: '#ff7ab6' },
  endpoints: { title: 'Endpoints', icon: Cable, color: '#00d4ff' },
  buildClues: { title: 'Build Clues', icon: Terminal, color: '#b5ff5a' },
};

const Marquee = () => (
  <div className="marquee-wrapper">
    <motion.div
      className="marquee-content"
      animate={{ x: [0, -1200] }}
      transition={{ duration: 22, repeat: Infinity, ease: 'linear' }}
    >
      {[...Array(8)].map((_, index) => (
        <div key={index} className="marquee-item">
          ANALYZE ANY SITE <span className="spacer">+</span>
          FIND PUBLIC ENV <span className="spacer">+</span>
          COMPARE ALL ENGINES <span className="spacer">+</span>
        </div>
      ))}
    </motion.div>
  </div>
);

function StackCard({
  title,
  icon: Icon,
  items,
  color,
}: {
  title: string;
  icon: React.ElementType;
  items: TechItem[];
  color: string;
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="stack-card"
    >
      <div className="card-header">
        <h3 className="card-title" style={{ color }}>
          {title} <Icon size={18} />
        </h3>
      </div>

      <div className="tech-list">
        {items.length > 0 ? (
          items.map((item, index) => (
            <div key={`${item.name}-${index}`} className="tech-item-row">
              <div className="tech-symbol" style={{ backgroundColor: color, color: '#000' }}>
                {item.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="tech-details">
                <div className="tech-name-wrapper">
                  <span className="tech-name-main">{item.name}</span>
                  {item.confidence === 'high' && <Zap size={12} className="confidence-icon" />}
                </div>
                <span className="tech-cat-label">{item.cat}</span>
              </div>
            </div>
          ))
        ) : (
          <p className="no-data">No signatures detected</p>
        )}
      </div>
    </motion.div>
  );
}

function EnvCard({
  title,
  icon: Icon,
  color,
  items,
}: {
  title: string;
  icon: React.ElementType;
  color: string;
  items: PublicEnvItem[];
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="stack-card"
    >
      <div className="card-header">
        <h3 className="card-title" style={{ color }}>
          {title} <Icon size={18} />
        </h3>
      </div>

      <div className="env-list">
        {items.length > 0 ? (
          items.map((item, index) => (
            <div key={`${item.name}-${index}`} className="env-item-row">
              <div className="env-item-topline">
                <span className="env-item-name">{item.name}</span>
                <span className="env-item-type">{item.cat}</span>
              </div>
              <code className="env-item-value">{item.value}</code>
              <span className="env-item-source">{item.source}</span>
            </div>
          ))
        ) : (
          <p className="no-data">No public runtime clues detected</p>
        )}
      </div>
    </motion.div>
  );
}

function renderStackCards(report?: StackReport) {
  if (!report) {
    return null;
  }

  return Object.entries(report).map(([key, items]) => {
    if (!Array.isArray(items) || items.length === 0) {
      return null;
    }

    const config = TECH_CATEGORY_CONFIG[key] || {
      title: key.toUpperCase(),
      icon: Info,
      color: '#ffffff',
    };

    return (
      <StackCard
        key={key}
        title={config.title}
        icon={config.icon}
        items={items}
        color={config.color}
      />
    );
  });
}

function renderEnvCards(report?: PublicEnvReport) {
  if (!report) {
    return null;
  }

  return Object.entries(report).map(([key, items]) => {
    if (!Array.isArray(items) || items.length === 0) {
      return null;
    }

    const config = ENV_CATEGORY_CONFIG[key] || {
      title: key.toUpperCase(),
      icon: Info,
      color: '#ffffff',
    };

    return (
      <EnvCard
        key={key}
        title={config.title}
        icon={config.icon}
        color={config.color}
        items={items}
      />
    );
  });
}

function countItems(report: AnalysisResult | null, mode: AnalysisMode) {
  if (!report) {
    return 0;
  }

  const stackCount =
    mode === 'tech-stack' || mode === 'both'
      ? Object.values(report.techStack || {}).reduce((sum, items) => sum + items.length, 0)
      : 0;

  const envCount =
    mode === 'public-env' || mode === 'both'
      ? Object.values(report.publicEnv || {}).reduce((sum, items) => sum + items.length, 0)
      : 0;

  return stackCount + envCount;
}

function SectionBlock({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section className="results-section">
      <div className="results-section-header">
        <div>
          <h3 className="results-section-title">{title}</h3>
          <p className="results-section-subtitle">{subtitle}</p>
        </div>
      </div>
      <div className="cards-grid">{children}</div>
    </section>
  );
}

export default function Home() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<AnalysisResult | null>(null);
  const [selectedModel, setSelectedModel] = useState<ModelId>('chatgpt');
  const [scanMode, setScanMode] = useState<AnalysisMode>('tech-stack');
  const [compareMode, setCompareMode] = useState(false);
  const [comparisonResults, setComparisonResults] = useState<Record<ModelId, AnalysisResult | null>>({
    chatgpt: null,
    gemini: null,
    claude: null,
  });

  const activeMode = MODE_CONFIG.find((mode) => mode.id === scanMode)!;
  const currentTotal = useMemo(() => countItems(report, scanMode), [report, scanMode]);

  const analyze = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!url) {
      return;
    }

    setLoading(true);
    setReport(null);
    setComparisonResults({
      chatgpt: null,
      gemini: null,
      claude: null,
    });

    try {
      if (compareMode) {
        const results = await Promise.all(
          MODEL_ORDER.map(async (model) => {
            try {
              const response = await fetch('/api/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url, model, mode: scanMode }),
              });
              const data = await response.json();
              return { model, data: data.error ? null : (data as AnalysisResult) };
            } catch {
              return { model, data: null };
            }
          }),
        );

        const nextResults = {
          chatgpt: null,
          gemini: null,
          claude: null,
        } as Record<ModelId, AnalysisResult | null>;

        results.forEach(({ model, data }) => {
          nextResults[model] = data;
        });
        setComparisonResults(nextResults);
      } else {
        const response = await fetch('/api/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url, model: selectedModel, mode: scanMode }),
        });

        const data = await response.json();
        if (data.error) {
          throw new Error(data.error);
        }

        setReport(data);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to analyze the site.';
      console.error('Analysis error:', error);
      alert(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Suspense fallback={<div className="loading-state">Initializing discovery engine...</div>}>
      <SearchParamsHandler setUrl={setUrl} />

      <div className="app-container">
        <div className="decor-pink" />
        <div className="decor-purple" />
        <div className="decor-grid" />
        <Marquee />

        <header className="hero-header">
          <div className="title-wrapper">
            <span className="sub-title">The Space Between</span>
            <div className={`title-accent ${activeMode.accentClass}`} />
            <h1 className="main-title">
              TECH&
              <br />
              STACKS
            </h1>
          </div>
          <p className="hero-copy">
            Switch between hidden stack discovery, exposed public runtime config, or both in one scan.
          </p>
        </header>

        <main className="main-content">
          <form onSubmit={analyze} className="search-form">
            <div className="input-group">
              <input
                type="url"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder="https://example.com"
                className="neo-input"
                required
              />
              <Globe className="input-icon" />
            </div>
            <button type="submit" disabled={loading} className="neo-button">
              {loading ? <Loader2 className="spin" /> : compareMode ? 'Compare All' : 'Analyze'}
            </button>
          </form>

          <div className="control-deck">
            <div className="mode-panel">
              <div className="panel-label">Scan Mode</div>
              <div className="mode-switcher">
                {MODE_CONFIG.map((mode) => {
                  const Icon = mode.icon;
                  const isActive = mode.id === scanMode;
                  return (
                    <button
                      key={mode.id}
                      type="button"
                      className={`mode-switch ${isActive ? 'active' : ''} ${mode.accentClass}`}
                      onClick={() => setScanMode(mode.id)}
                    >
                      {isActive && <motion.span layoutId="mode-pill" className="mode-switch-pill" />}
                      <span className="mode-switch-content">
                        <Icon size={16} />
                        <span>{mode.label}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="panel-copy">{activeMode.description}</p>
            </div>

            <div className="model-controls">
              <div className="model-panel">
                <div className="panel-label">Engine</div>
                <div className="model-tabs">
                  {MODEL_ORDER.map((model) => {
                    const isActive = model === selectedModel && !compareMode;
                    const Icon = MODEL_CONFIG[model].icon;
                    return (
                      <button
                        key={model}
                        type="button"
                        onClick={() => setSelectedModel(model)}
                        className={`model-tab ${isActive ? 'active' : ''}`}
                        disabled={compareMode}
                      >
                        {isActive && <motion.span layoutId="model-pill" className="model-tab-pill" />}
                        <span className="model-tab-content">
                          <Icon size={14} />
                          <span>{MODEL_CONFIG[model].label}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setCompareMode((value) => !value)}
                className={`compare-toggle ${compareMode ? 'active' : ''}`}
              >
                {compareMode ? 'Single Mode' : 'Compare Mode'}
              </button>
            </div>
          </div>

          <div className="info-banner">
            <Info className="info-banner-icon" size={24} />
            <p className="info-banner-text">
              <strong>SYSTEM NOTICE:</strong>{' '}
              {compareMode
                ? `Comparison mode runs ${scanMode.toUpperCase()} across all 3 engines.`
                : `${MODEL_CONFIG[selectedModel].label} is armed for ${activeMode.label.toUpperCase()}.`}{' '}
              Public ENV mode only reports browser-visible config and build clues, not private secrets.
            </p>
          </div>

          <AnimatePresence mode="wait">
            {loading && (
              <motion.div
                key="loading"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="loading-state"
              >
                <div className="custom-loader" />
                <h2 className="loading-title">Deep Scanning...</h2>
                <p className="loading-text">
                  {scanMode === 'tech-stack'
                    ? 'Tracing frameworks, services, and infrastructure.'
                    : scanMode === 'public-env'
                      ? 'Parsing browser-safe env variables, routes, and client bundle clues.'
                      : 'Running full stack and public runtime discovery in parallel.'}
                </p>
              </motion.div>
            )}

            {!loading && compareMode && MODEL_ORDER.some((model) => comparisonResults[model]) && (
              <motion.div
                key="compare"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="comparison-grid"
              >
                {MODEL_ORDER.map((model) => {
                  const result = comparisonResults[model];
                  const modelConfig = MODEL_CONFIG[model];
                  const Icon = modelConfig.icon;

                  return (
                    <div key={model} className="comparison-column">
                      <div className="column-header" style={{ borderColor: modelConfig.tint }}>
                        <span className="column-label">
                          <Icon size={14} /> {modelConfig.label}
                        </span>
                        <span className="column-count">
                          {countItems(result, scanMode)} findings
                        </span>
                      </div>

                      <div className="column-content">
                        {result ? (
                          <>
                            {(scanMode === 'tech-stack' || scanMode === 'both') && (
                              <SectionBlock
                                title="Tech Stack"
                                subtitle="Frameworks, infra, and service fingerprints."
                              >
                                {renderStackCards(result.techStack)}
                              </SectionBlock>
                            )}

                            {(scanMode === 'public-env' || scanMode === 'both') && (
                              <SectionBlock
                                title="Public ENV"
                                subtitle="Browser-visible config and build-time clues."
                              >
                                {renderEnvCards(result.publicEnv)}
                              </SectionBlock>
                            )}
                          </>
                        ) : (
                          <div className="error-state">Scan failed for this engine.</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </motion.div>
            )}

            {!loading && !compareMode && report && (
              <motion.div
                key="single"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="results-wrapper"
              >
                <div className="results-label-container">
                  <h2 className="results-label">
                    Analysis for: <span className="target-url">{url}</span>
                  </h2>
                </div>

                {(scanMode === 'tech-stack' || scanMode === 'both') && (
                  <SectionBlock
                    title="Tech Stack"
                    subtitle="Hidden frameworks, services, and platform fingerprints."
                  >
                    {renderStackCards(report.techStack)}
                  </SectionBlock>
                )}

                {(scanMode === 'public-env' || scanMode === 'both') && (
                  <SectionBlock
                    title="Public ENV"
                    subtitle="Client-visible variables, endpoints, and build assumptions."
                  >
                    {renderEnvCards(report.publicEnv)}
                  </SectionBlock>
                )}

                <div className="summary-box">
                  <h3 className="summary-title">
                    Intelligence Report <ExternalLink size={18} />
                  </h3>
                  <p className="summary-text">
                    {MODEL_CONFIG[selectedModel].label} surfaced {currentTotal} total findings in{' '}
                    {activeMode.label}. Use compare mode to line up all three engines against the same
                    target and scan profile.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        <footer className="app-footer">FindStacks © 2026 // Next-Gen Technology Discovery Engine</footer>
      </div>
    </Suspense>
  );
}
