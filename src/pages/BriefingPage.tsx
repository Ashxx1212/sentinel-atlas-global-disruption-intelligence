import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FileText,
  Calendar,
  Sparkles,
  Moon,
  Heart,
  AlertOctagon,
  Database,
  Info,
  ArrowRight,
  Loader2,
  Check,
  Download,
  RefreshCw,
  ArrowLeft,
  ShieldCheck,
  Bell,
  Server,
  MapPin,
  Ruler,
} from 'lucide-react';
import { hazardTypeLabels } from '../data/mockIncidents';
import type { HazardType } from '../types';
import type { HybridIncident } from '../types/hybridIntelligence';
import type { NotificationRecord } from '../lib/notifications';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';
import { useHybridIncidents } from '../hooks/useHybridIncidents';
import { useLiveUsgsIncidents } from '../hooks/useLiveUsgsIncidents';
import { supabase } from '../lib/supabase';
import { fetchSavedWatchlistLocations, type PersistedWatchlistLocation } from '../lib/watchlists';
import { fetchSavedAlertRules, type PersistedAlertRule } from '../lib/alertRules';
import { IntegrityBadge } from '../components/StatusBadge';
import { SeverityBadge } from '../components/SeverityBadge';
import { PageHeader, SectionHeader, EmptyState } from '../components/ui';

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatTimestamp(value: string | null | undefined): string {
  if (!value) {
    return '—';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: false,
  });
}

function timeAgo(iso: string): string {
  const timestamp = new Date(iso).getTime();

  if (Number.isNaN(timestamp)) {
    return 'Time unavailable';
  }

  const diff = Math.max(0, Date.now() - timestamp);
  const minutes = Math.floor(diff / 60_000);

  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  return `${Math.floor(hours / 24)}d ago`;
}

function formatHazard(hazardType: string | null): string {
  if (!hazardType) {
    return 'Any hazard';
  }

  return hazardTypeLabels[hazardType as HazardType] ?? hazardType;
}

function formatSeverity(value: PersistedAlertRule['minimum_severity']): string {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)} or higher`;
}

function sourceModeLabel(dataMode: HybridIncident['dataMode']): string {
  return dataMode === 'live_source' ? 'Live source record' : 'Prototype fixture';
}

function buildOverallPosture(priorityCount: number, unreadCount: number, degradedCount: number): {
  title: string;
  detail: string;
  tone: 'cyan' | 'amber' | 'error';
} {
  if (unreadCount > 0 || priorityCount > 0) {
    return {
      title: 'Overall posture: Attention required',
      detail: `${priorityCount} priority incident${priorityCount === 1 ? '' : 's'} and ${unreadCount} unread private alert${unreadCount === 1 ? '' : 's'} are visible in this workspace.`,
      tone: 'amber',
    };
  }

  if (degradedCount > 0) {
    return {
      title: 'Overall posture: Source watch',
      detail: `${degradedCount} live source${degradedCount === 1 ? '' : 's'} currently report degraded status. Review Data Trust before relying on coverage.`,
      tone: 'amber',
    };
  }

  return {
    title: 'Overall posture: Routine monitoring',
    detail: 'No unread private alerts or elevated-priority incident records are currently visible.',
    tone: 'cyan',
  };
}

function BriefingItemCard({
  title,
  detail,
  to,
  children,
}: {
  title: string;
  detail: string;
  to?: string;
  children?: React.ReactNode;
}) {
  const body = (
    <div className="rounded-lg border border-ink-700/60 bg-ink-850/40 p-3 transition-colors hover:border-cyan-500/20 hover:bg-ink-800/40">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h4 className="text-sm font-semibold text-slate-100">{title}</h4>
          <p className="mt-1 text-xs leading-relaxed text-slate-400">{detail}</p>
          {children ? <div className="mt-2 flex flex-wrap gap-2">{children}</div> : null}
        </div>
        {to ? <ArrowRight className="h-4 w-4 flex-shrink-0 text-slate-600" /> : null}
      </div>
    </div>
  );

  return to ? <Link to={to}>{body}</Link> : body;
}

const assemblyStages = [
  'Checking live source registry',
  'Reviewing hybrid incident layer',
  'Summarising private alerts',
  'Compiling watchlist and rule context',
];

export function BriefingPage() {
  const today = new Date();
  const { isAuthenticated, user } = useAuth();
  const [selectedDate, setSelectedDate] = useState(today);
  const [briefingGenerated, setBriefingGenerated] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [assemblyStage, setAssemblyStage] = useState(0);
  const [savedLocations, setSavedLocations] = useState<PersistedWatchlistLocation[]>([]);
  const [savedRules, setSavedRules] = useState<PersistedAlertRule[]>([]);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const generationTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const mountedRef = useRef(false);

  const {
    incidents,
    state: hybridState,
    refresh: refreshHybridIncidents,
  } = useHybridIncidents();
  const {
    state: sourceState,
    sources,
    recordCount,
    errorMessage: sourceErrorMessage,
    refresh: refreshSourceRegistry,
  } = useLiveUsgsIncidents();
  const {
    notifications,
    unreadCount,
    state: notificationState,
    refreshNotifications,
  } = useNotifications();

  const loadWorkspace = useCallback(async () => {
    if (!isAuthenticated || !user || !supabase) {
      setSavedLocations([]);
      setSavedRules([]);
      setWorkspaceError(null);
      return;
    }

    try {
      setWorkspaceError(null);
      const [locations, rules] = await Promise.all([
        fetchSavedWatchlistLocations(supabase, user.id),
        fetchSavedAlertRules(supabase, user.id),
      ]);

      if (!mountedRef.current) return;

      setSavedLocations(locations);
      setSavedRules(rules);
    } catch {
      if (!mountedRef.current) return;
      setWorkspaceError('Watchlist and alert rule context could not be loaded.');
    }
  }, [isAuthenticated, user]);

  useEffect(() => {
    mountedRef.current = true;
    void loadWorkspace();

    return () => {
      mountedRef.current = false;
    };
  }, [loadWorkspace]);

  const clearGenerationTimers = () => {
    generationTimersRef.current.forEach(clearTimeout);
    generationTimersRef.current = [];
  };

  const refreshBriefingData = () => {
    void Promise.all([
      refreshHybridIncidents(true),
      refreshSourceRegistry(true),
      refreshNotifications(),
      loadWorkspace(),
    ]);
  };

  const handleGenerate = () => {
    clearGenerationTimers();
    refreshBriefingData();
    setGenerating(true);
    setBriefingGenerated(false);
    setAssemblyStage(0);

    generationTimersRef.current = [
      setTimeout(() => setAssemblyStage(1), 0),
      setTimeout(() => setAssemblyStage(2), 350),
      setTimeout(() => setAssemblyStage(3), 700),
      setTimeout(() => setAssemblyStage(4), 1050),
      setTimeout(() => {
        setAssemblyStage(4);
        setGenerating(false);
        setBriefingGenerated(true);
      }, 1400),
    ];
  };

  const shiftDate = (days: number) => {
    clearGenerationTimers();
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + days);
    setSelectedDate(d);
    setGenerating(false);
    setBriefingGenerated(false);
  };

  useEffect(() => () => {
    clearGenerationTimers();
  }, []);

  const isAtMinDate =
    Math.round((today.getTime() - selectedDate.getTime()) / 86400000) >= 7;
  const isAtMaxDate =
    Math.round((selectedDate.getTime() - today.getTime()) / 86400000) >= 7;

  const liveIncidentCount = useMemo(
    () => incidents.filter((incident) => incident.dataMode === 'live_source').length,
    [incidents],
  );

  const fixtureIncidentCount = useMemo(
    () => incidents.filter((incident) => incident.dataMode === 'prototype_fixture').length,
    [incidents],
  );

  const priorityIncidents = useMemo(
    () =>
      incidents
        .filter((incident) =>
          incident.severity === 'critical' ||
          incident.severity === 'high' ||
          incident.severity === 'elevated',
        )
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
    [incidents],
  );

  const recentPriorityIncidents = priorityIncidents.slice(0, 5);

  const recentNotifications = useMemo<NotificationRecord[]>(
    () =>
      [...notifications]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 5),
    [notifications],
  );

  const latestLiveSourceSuccess = useMemo(() => {
    const timestamps = sources
      .map((source) => source.last_success_at)
      .filter((value): value is string => Boolean(value))
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

    return timestamps[0] ?? null;
  }, [sources]);

  const degradedLiveSourceCount = useMemo(
    () =>
      sources.filter(
        (source) => source.source_mode === 'live_source' && source.ingestion_status === 'degraded',
      ).length,
    [sources],
  );

  const enabledRules = useMemo(
    () => savedRules.filter((rule) => rule.enabled),
    [savedRules],
  );

  const overallPosture = buildOverallPosture(
    priorityIncidents.length,
    unreadCount,
    degradedLiveSourceCount,
  );

  const postureStyles = {
    cyan: 'border-cyan-500/20 bg-cyan-500/10 text-cyan-300',
    amber: 'border-warning-500/20 bg-warning-500/10 text-warning-300',
    error: 'border-error-500/20 bg-error-500/10 text-error-300',
  }[overallPosture.tone];

  const dataIsLoading =
    hybridState === 'loading' ||
    sourceState === 'loading' ||
    notificationState === 'loading';

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 lg:px-6 lg:py-8">
      <PageHeader
        title="Daily Risk Briefing"
        subtitle="A rule-based briefing assembled from hybrid incident records, source health, private alerts, and saved watchlist context."
      >
        <span className="rounded-full border border-cyan-500/25 bg-cyan-500/10 px-3 py-1 text-xs font-medium text-cyan-300">
          Hybrid briefing
        </span>
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

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={refreshBriefingData}
              disabled={dataIsLoading}
              className="btn-secondary disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${dataIsLoading ? 'animate-spin' : ''}`} />
              Refresh data
            </button>
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
            Generate a briefing to assemble the current live-source, alert, watchlist,
            and source-health context into one readable summary.
          </p>
          <span className="mt-3 inline-block chip border-cyan-500/20 bg-cyan-500/5 text-cyan-300">
            Hybrid source state
          </span>
        </div>
      )}

      {generating && (
        <div className="panel p-8">
          <div className="mb-6 text-center">
            <h3 className="text-base font-semibold text-slate-100">
              Assembling hybrid briefing
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Pulling together source registry, incident, alert, and watchlist context…
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
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
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
                    {liveIncidentCount} live source record{liveIncidentCount === 1 ? '' : 's'} · {fixtureIncidentCount} prototype fixture{fixtureIncidentCount === 1 ? '' : 's'} · {notifications.length} private alert{notifications.length === 1 ? '' : 's'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg border border-ink-700/60 bg-ink-850/40 px-3 py-2">
                  <p className="font-mono text-lg font-bold text-cyan-300">{priorityIncidents.length}</p>
                  <p className="text-[10px] text-slate-500">Priority</p>
                </div>
                <div className="rounded-lg border border-ink-700/60 bg-ink-850/40 px-3 py-2">
                  <p className="font-mono text-lg font-bold text-cyan-300">{unreadCount}</p>
                  <p className="text-[10px] text-slate-500">Unread</p>
                </div>
                <div className="rounded-lg border border-ink-700/60 bg-ink-850/40 px-3 py-2">
                  <p className="font-mono text-lg font-bold text-cyan-300">{enabledRules.length}</p>
                  <p className="text-[10px] text-slate-500">Rules</p>
                </div>
              </div>
            </div>
          </div>

          {/* Overall posture */}
          <div className={`rounded-xl border p-5 ${postureStyles}`}>
            <div className="flex items-start gap-3">
              <ShieldCheck className="h-5 w-5 flex-shrink-0" />
              <div>
                <h3 className="text-sm font-semibold text-slate-100">
                  {overallPosture.title}
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-slate-400">
                  {overallPosture.detail}
                </p>
              </div>
            </div>
          </div>

          {/* Sections */}
          <div className="stagger-children space-y-6">
            <div className="panel p-5">
              <SectionHeader title="Overnight Changes" icon={Moon} />
              <p className="mb-3 text-xs text-slate-500">
                Recent source-backed records and private alerts visible to this account.
              </p>
              <div className="space-y-3">
                {recentNotifications.length > 0 ? (
                  recentNotifications.map((notification) => (
                    <BriefingItemCard
                      key={notification.id}
                      title={notification.title}
                      detail={notification.matchingReason ?? notification.body ?? 'Private server-created alert.'}
                      to={`/incidents/${notification.incidentId}`}
                    >
                      <SeverityBadge severity={notification.severity} size="xs" />
                      <span className="chip border-cyan-500/20 bg-cyan-500/5 text-cyan-300">
                        <Bell className="h-3 w-3" />
                        {notification.readAt ? 'Read' : 'Unread'} · {timeAgo(notification.createdAt)}
                      </span>
                    </BriefingItemCard>
                  ))
                ) : (
                  <EmptyState
                    icon={Bell}
                    title="No private alert changes"
                    message="No private notifications are currently stored for this account."
                  />
                )}
              </div>
            </div>

            <div className="panel p-5">
              <SectionHeader title="Watchlist Exposure" icon={Heart} />
              <p className="mb-3 text-xs text-slate-500">
                Saved locations and enabled rules used by the private alert evaluator.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <BriefingItemCard
                  title={`${savedLocations.length} watched location${savedLocations.length === 1 ? '' : 's'}`}
                  detail={
                    workspaceError ??
                    (savedLocations.length > 0
                      ? savedLocations.map((location) => location.label).join(' · ')
                      : 'No saved locations are currently available.')
                  }
                  to="/my-world"
                >
                  <span className="chip border-cyan-500/20 bg-cyan-500/5 text-cyan-300">
                    <MapPin className="h-3 w-3" />
                    Saved watchlist
                  </span>
                </BriefingItemCard>

                <BriefingItemCard
                  title={`${enabledRules.length} enabled alert rule${enabledRules.length === 1 ? '' : 's'}`}
                  detail={
                    enabledRules.length > 0
                      ? enabledRules
                        .slice(0, 3)
                        .map((rule) => `${rule.name}: ${formatHazard(rule.hazard_type)} · ${formatSeverity(rule.minimum_severity)}`)
                        .join(' | ')
                      : 'No enabled alert rules are currently configured.'
                  }
                  to="/settings"
                >
                  <span className="chip border-cyan-500/20 bg-cyan-500/5 text-cyan-300">
                    <Ruler className="h-3 w-3" />
                    Rule scope
                  </span>
                </BriefingItemCard>
              </div>
            </div>

            <div className="panel p-5">
              <SectionHeader title="Priority Incidents" icon={AlertOctagon} />
              <p className="mb-3 text-xs text-slate-500">
                Elevated, high, and critical hybrid records ordered by latest stored update.
              </p>
              <div className="space-y-3">
                {recentPriorityIncidents.length > 0 ? (
                  recentPriorityIncidents.map((incident) => (
                    <BriefingItemCard
                      key={incident.id}
                      title={incident.title}
                      detail={`${hazardTypeLabels[incident.hazardType]} · ${incident.location} · Updated ${timeAgo(incident.updatedAt)}.`}
                      to={`/incidents/${incident.id}`}
                    >
                      <SeverityBadge severity={incident.severity} size="xs" />
                      <span className="chip border-ink-600/60 bg-ink-800/60 text-slate-400">
                        {sourceModeLabel(incident.dataMode)}
                      </span>
                      <IntegrityBadge status={incident.integrity} size="xs" />
                    </BriefingItemCard>
                  ))
                ) : (
                  <EmptyState
                    icon={AlertOctagon}
                    title="No priority incidents"
                    message="No elevated, high, or critical incidents are currently visible in the hybrid layer."
                  />
                )}
              </div>
            </div>

            <div className="panel p-5">
              <SectionHeader title="Data Availability Notes" icon={Database} />
              <p className="mb-3 text-xs text-slate-500">
                Source registry and ingestion-health context affecting this briefing.
              </p>
              <div className="space-y-3">
                <BriefingItemCard
                  title="Live source registry"
                  detail={
                    sourceState === 'success'
                      ? `Latest successful ingestion snapshot: ${formatTimestamp(latestLiveSourceSuccess)}.`
                      : sourceState === 'empty'
                        ? 'No active stored live source records are currently available.'
                        : sourceState === 'unconfigured'
                          ? 'Supabase is not configured in this browser session.'
                          : sourceState === 'error'
                            ? sourceErrorMessage ?? 'Live source registry could not be loaded.'
                            : 'Live source registry is loading.'
                  }
                  to="/data-trust"
                >
                  <span className="chip border-cyan-500/20 bg-cyan-500/5 text-cyan-300">
                    <Server className="h-3 w-3" />
                    {recordCount} active source-backed record{recordCount === 1 ? '' : 's'}
                  </span>
                </BriefingItemCard>

                {sources.map((source) => (
                  <BriefingItemCard
                    key={source.id}
                    title={source.display_name}
                    detail={`Code ${source.code.toUpperCase()} · ${source.ingestion_status ?? 'status unavailable'} · last success ${formatTimestamp(source.last_success_at)}.`}
                    to="/data-trust"
                  >
                    <span className="chip border-ink-600/60 bg-ink-800/60 text-slate-400">
                      {source.source_mode ?? 'source'} 
                    </span>
                  </BriefingItemCard>
                ))}
              </div>
            </div>
          </div>

          {/* Methodology footer */}
          <div className="panel p-5">
            <div className="flex items-start gap-3">
              <Info className="h-4 w-4 flex-shrink-0 text-cyan-400 mt-0.5" />
              <div>
                <h3 className="text-sm font-semibold text-slate-200">Methodology</h3>
                <p className="mt-1.5 text-xs text-slate-400 leading-relaxed">
                  This briefing is assembled client-side from stored source-backed records,
                  private notification rows, saved watchlist locations, enabled alert rules,
                  and clearly labeled prototype fixtures. It is not an official warning or
                  live emergency-risk assessment.
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
            <Link to="/alerts" className="btn-secondary">
              <Bell className="h-4 w-4" />
              View Alerts
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
