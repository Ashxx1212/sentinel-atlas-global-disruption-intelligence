import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FileText,
  Calendar,
  Sparkles,
  Moon,
  Heart,
  AlertOctagon,
  CloudSun,
  Database,
  Info,
  ArrowRight,
  Loader2,
  Check,
  Download,
  RefreshCw,
  ArrowLeft,
  ShieldCheck,
} from 'lucide-react';
import { mockBriefingItems } from '../data/mockIncidents';
import type { BriefingSection, BriefingItem } from '../types';
import { IntegrityBadge } from '../components/StatusBadge';
import { PageHeader, PrototypeNotice, SectionHeader } from '../components/ui';

const sectionConfig: Record<
  BriefingSection,
  { label: string; icon: typeof Moon; description: string }
> = {
  'overnight-changes': {
    label: 'Overnight Changes',
    icon: Moon,
    description: 'Significant changes detected in the last 24 hours.',
  },
  'watchlist-exposure': {
    label: 'Watchlist Exposure',
    icon: Heart,
    description: 'How active incidents relate to your watched locations.',
  },
  'priority-incidents': {
    label: 'Priority Incidents',
    icon: AlertOctagon,
    description: 'Highest-severity incidents requiring attention.',
  },
  'weather-context': {
    label: 'Weather Context',
    icon: CloudSun,
    description: 'Forecast conditions influencing active incidents.',
  },
  'data-availability': {
    label: 'Data Availability Notes',
    icon: Database,
    description: 'Source health and data gaps affecting this briefing.',
  },
};

const sectionOrder: BriefingSection[] = [
  'overnight-changes',
  'watchlist-exposure',
  'priority-incidents',
  'weather-context',
  'data-availability',
];

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

const assemblyStages = [
  'Reviewing watchlist fixture locations',
  'Matching prototype incidents',
  'Classifying integrity states',
  'Building briefing narrative',
];

export function BriefingPage() {
  const today = new Date();
  const [selectedDate, setSelectedDate] = useState(today);
  const [briefingGenerated, setBriefingGenerated] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [assemblyStage, setAssemblyStage] = useState(0);

  const handleGenerate = () => {
    setGenerating(true);
    setBriefingGenerated(false);
    setAssemblyStage(0);

    const timers: ReturnType<typeof setTimeout>[] = [];
    timers.push(setTimeout(() => setAssemblyStage(1), 0));
    timers.push(setTimeout(() => setAssemblyStage(2), 350));
    timers.push(setTimeout(() => setAssemblyStage(3), 700));
    timers.push(setTimeout(() => setAssemblyStage(4), 1050));
    timers.push(
      setTimeout(() => {
        setAssemblyStage(4);
        setGenerating(false);
        setBriefingGenerated(true);
      }, 1400),
    );

    return () => timers.forEach(clearTimeout);
  };

  const shiftDate = (days: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + days);
    setSelectedDate(d);
    setBriefingGenerated(false);
  };

  const isAtMinDate =
    Math.round((today.getTime() - selectedDate.getTime()) / 86400000) >= 7;
  const isAtMaxDate =
    Math.round((selectedDate.getTime() - today.getTime()) / 86400000) >= 7;

  const itemsBySection = sectionOrder.map((section) => ({
    section,
    items: mockBriefingItems.filter((i) => i.section === section),
  }));

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 lg:px-6 lg:py-8">
      <PageHeader
        title="Daily Risk Briefing"
        subtitle="A rule-based summary of verified incident records and forecast context. Uses prototype fixture data."
      >
        <PrototypeNotice />
      </PageHeader>

      {/* Date selector + generate */}
      <div className="panel mb-6 p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="h-4 w-4 text-cyan-400" />
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Briefing Date
              </span>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => shiftDate(-1)}
                aria-label="Previous date"
                disabled={isAtMinDate}
                className="rounded-lg border border-ink-700/60 px-2.5 py-1 text-sm text-slate-400 transition-colors hover:border-cyan-500/40 hover:text-cyan-300 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-ink-700/60 disabled:hover:text-slate-400"
              >
                ←
              </button>
              <span className="text-sm font-medium text-slate-200 min-w-[200px] text-center">
                {formatDate(selectedDate)}
              </span>
              <button
                onClick={() => shiftDate(1)}
                aria-label="Next date"
                disabled={isAtMaxDate}
                className="rounded-lg border border-ink-700/60 px-2.5 py-1 text-sm text-slate-400 transition-colors hover:border-cyan-500/40 hover:text-cyan-300 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-ink-700/60 disabled:hover:text-slate-400"
              >
                →
              </button>
            </div>
          </div>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {generating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating…
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Generate Briefing
              </>
            )}
          </button>
        </div>
      </div>

      {/* Briefing content */}
      {!briefingGenerated && !generating && (
        <div className="panel p-8 text-center">
          <div className="mx-auto w-fit rounded-full border border-ink-600/60 bg-ink-800/60 p-4">
            <FileText className="h-8 w-8 text-slate-500" />
          </div>
          <h3 className="mt-4 text-sm font-semibold text-slate-300">
            No briefing generated yet
          </h3>
          <p className="mt-1 max-w-md mx-auto text-xs text-slate-500">
            Select a date and click "Generate Briefing" to assemble a rule-based
            summary of verified incident records and forecast context.
          </p>
          <span className="mt-3 inline-block chip border-ink-600/60 bg-ink-800/60 text-slate-500">
            Prototype State
          </span>
        </div>
      )}

      {generating && (
        <div className="panel p-8">
          <div className="mb-6 text-center">
            <h3 className="text-base font-semibold text-slate-100">
              Assembling local prototype briefing
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Sequencing fixture rules into a daily summary…
            </p>
          </div>
          <ol className="mx-auto max-w-md space-y-3">
            {assemblyStages.map((label, idx) => {
              const stageNum = idx + 1;
              const isComplete = assemblyStage > stageNum;
              const isInProgress = assemblyStage === stageNum;
              return (
                <li key={label} className="flex items-center gap-3">
                  <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center">
                    {isComplete ? (
                      <span className="flex h-6 w-6 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10">
                        <Check className="h-3.5 w-3.5 text-emerald-400" />
                      </span>
                    ) : isInProgress ? (
                      <Loader2 className="h-5 w-5 animate-spin text-cyan-400" />
                    ) : (
                      <span className="flex h-6 w-6 items-center justify-center rounded-full border border-ink-700/60 bg-ink-800/40">
                        <span className="h-1.5 w-1.5 rounded-full bg-slate-600" />
                      </span>
                    )}
                  </span>
                  <span
                    className={
                      isComplete
                        ? 'text-sm text-slate-500 line-through'
                        : isInProgress
                          ? 'text-sm font-medium text-cyan-300'
                          : 'text-sm text-slate-600'
                    }
                  >
                    {label}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      )}

      {briefingGenerated && (
        <div className="animate-fade-in space-y-6">
          {/* Briefing header */}
          <div className="panel p-5">
            <div className="flex items-center gap-3">
              <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/10 p-2.5">
                <FileText className="h-5 w-5 text-cyan-300" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-100">
                  Sentinel Atlas Daily Risk Briefing
                </h2>
                <p className="text-xs font-medium text-slate-400">
                  {formatDate(selectedDate)}
                </p>
                <p className="text-xs text-slate-500">
                  Prototype Fixture Summary · {mockBriefingItems.length} items across {sectionOrder.length} sections
                </p>
              </div>
            </div>
          </div>

          {/* Overall posture */}
          <div className="panel p-5">
            <div className="flex items-start gap-3">
              <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-2.5">
                <ShieldCheck className="h-5 w-5 text-amber-300" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-100">
                  Overall posture: Elevated prototype attention
                </h3>
                <p className="mt-1 text-xs text-slate-400 leading-relaxed">
                  Derived from local fixture rules — not a live risk assessment.
                </p>
              </div>
            </div>
          </div>

          {/* Sections */}
          <div className="stagger-children space-y-6">
            {itemsBySection.map(({ section, items }) => {
            const config = sectionConfig[section];
            const Icon = config.icon;
            return (
              <div key={section} className="panel p-5">
                <SectionHeader title={config.label} icon={Icon} />
                <p className="mb-3 text-xs text-slate-500">{config.description}</p>
                <div className="space-y-3">
                  {items.map((item: BriefingItem) => (
                    <div
                      key={item.id}
                      className="rounded-lg border border-ink-700/60 bg-ink-850/40 p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <h4 className="text-sm font-semibold text-slate-100">
                            {item.title}
                          </h4>
                          <p className="mt-1 text-xs text-slate-400 leading-relaxed">
                            {item.detail}
                          </p>
                          {item.relatedIncidentId && (
                            <Link
                              to={`/incidents/${item.relatedIncidentId}`}
                              className="mt-2 inline-flex items-center gap-1 text-xs text-cyan-400 transition-colors hover:text-cyan-300"
                            >
                              View in Incident Room
                              <ArrowRight className="h-3 w-3" />
                            </Link>
                          )}
                        </div>
                        <IntegrityBadge status={item.integrity} size="xs" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
          </div>

          {/* Methodology footer */}
          <div className="panel p-5">
            <div className="flex items-start gap-3">
              <Info className="h-4 w-4 flex-shrink-0 text-cyan-400 mt-0.5" />
              <div>
                <h3 className="text-sm font-semibold text-slate-200">Methodology</h3>
                <p className="mt-1.5 text-xs text-slate-400 leading-relaxed">
                  This briefing is generated from local prototype fixtures and is not an official warning or live-risk assessment.
                </p>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleGenerate}
              className="btn-primary"
            >
              <RefreshCw className="h-4 w-4" />
              Regenerate
            </button>
            <Link to="/my-world" className="btn-secondary">
              <ArrowLeft className="h-4 w-4" />
              Return to My World
            </Link>
            <Link to="/data-trust" className="btn-secondary">
              <Database className="h-4 w-4" />
              View Data Trust
            </Link>
            <button
              disabled
              title="Export becomes available when persistent briefings are added in the full platform."
              className="btn-secondary disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              Download
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default BriefingPage;
