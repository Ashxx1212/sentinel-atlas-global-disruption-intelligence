import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, AlertOctagon, Inbox, CheckCircle2 } from 'lucide-react';
import { mockAlerts, hazardTypeLabels } from '../data/mockIncidents';
import type { AlertEntry, Severity } from '../types';
import { SeverityBadge } from '../components/SeverityBadge';
import { PageHeader, PrototypeNotice, EmptyState } from '../components/ui';

type AlertTab = 'all' | 'unread' | 'high-priority';

const tabs: { value: AlertTab; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'unread', label: 'Unread' },
  { value: 'high-priority', label: 'High Priority' },
];

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const severityDot: Record<Severity, string> = {
  critical: 'bg-error-500',
  high: 'bg-orange-500',
  elevated: 'bg-yellow-500',
  advisory: 'bg-slate-500',
};

export function AlertsPage() {
  const [alerts, setAlerts] = useState<AlertEntry[]>(mockAlerts);
  const [activeTab, setActiveTab] = useState<AlertTab>('all');
  const [toast, setToast] = useState<string | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  const navigate = useNavigate();

  const showToast = (message: string) => {
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current);
    }

    setToast(message);
    toastTimerRef.current = window.setTimeout(() => {
      setToast(null);
      toastTimerRef.current = null;
    }, 2500);
  };

  useEffect(() => () => {
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current);
    }
  }, []);

  const filtered = useMemo(() => {
    switch (activeTab) {
      case 'unread':
        return alerts.filter((a) => !a.read);
      case 'high-priority':
        return alerts.filter((a) => a.severity === 'critical' || a.severity === 'high');
      default:
        return alerts;
    }
  }, [alerts, activeTab]);

  const unreadCount = alerts.filter((a) => !a.read).length;

  const markAsRead = (id: string) => {
    setAlerts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, read: true } : a))
    );
  };

  const markAsReadAndToast = (id: string) => {
    markAsRead(id);
    showToast('Alert marked as read');
  };

  const openIncident = (alert: AlertEntry) => {
    markAsRead(alert.id);
    navigate(`/incidents/${alert.incidentId}`);
  };

  const markAllRead = () => {
    setAlerts((prev) => prev.map((a) => ({ ...a, read: true })));
    showToast('All alerts marked as read');
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 lg:px-6 lg:py-8">
      <PageHeader
        title="Notification Centre"
        subtitle="Alerts linked to Incident Rooms, filtered by your watchlist and alert rules. Uses prototype fixture data."
      >
        <div className="flex items-center gap-3">
          <PrototypeNotice className="hidden sm:flex" />
        </div>
      </PageHeader>

      {/* Stats + actions */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-30 animate-ping-slow" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-cyan-400" />
            </span>
            <span className="text-sm text-slate-300">
              <span className="font-mono font-bold text-cyan-300">{unreadCount}</span> unread
            </span>
          </div>
          <span className="text-slate-600">·</span>
          <span className="text-sm text-slate-400">
            <span className="font-mono">{alerts.length}</span> total
          </span>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            className="flex items-center gap-1.5 text-xs text-slate-400 transition-colors hover:text-cyan-300"
          >
            <CheckCheck className="h-3.5 w-3.5" />
            Mark all read
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="mb-4 border-b border-ink-700/60">
        <div className="flex gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={`tab-button ${activeTab === tab.value ? 'tab-button-active' : ''}`}
            >
              {tab.label}
              {tab.value === 'unread' && unreadCount > 0 && (
                <span className="ml-1.5 rounded-full bg-cyan-500/20 px-1.5 py-0.5 text-[10px] font-mono text-cyan-300">
                  {unreadCount}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Alert list */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title={activeTab === 'unread' ? 'All caught up' : 'No alerts in this view'}
          message={
            activeTab === 'unread'
              ? 'No unread prototype alerts remain.'
              : 'No prototype alerts match this view. New alerts will appear here when incidents match your rules.'
          }
        />
      ) : (
        <AlertList
          filtered={filtered}
          activeTab={activeTab}
          onOpen={openIncident}
          onMarkRead={markAsReadAndToast}
        />
      )}

      {/* Rule explanation */}
      <div className="mt-6 panel border-l-2 border-l-cyan-500/30 p-4">
        <div className="flex items-start gap-3">
          <AlertOctagon className="h-4 w-4 flex-shrink-0 text-cyan-400 mt-0.5" />
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-slate-200">How alerts work</h3>
              <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-mono uppercase tracking-wide text-cyan-300">
                Prototype alert rules
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-400 leading-relaxed">
              Alerts are generated when an active incident matches one of your alert rules.
              Rules are based on hazard type, severity, and proximity to your watched
              locations. Each alert links directly to its Incident Room for full context.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {['Critical severity', 'Within 500 km', 'Within 800 km', 'M5.0+ earthquakes', 'Cyclone watch', 'Flood alert'].map((rule) => (
                <span key={rule} className="chip border-ink-600/60 bg-ink-800/60 text-slate-400">
                  {rule}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Toast notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 animate-toast-in">
          <div className="panel flex items-center gap-2.5 px-4 py-3 shadow-lg shadow-black/40">
            <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-cyan-400" />
            <span className="text-sm text-slate-200">{toast}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function AlertList({
  filtered,
  activeTab,
  onOpen,
  onMarkRead,
}: {
  filtered: AlertEntry[];
  activeTab: AlertTab;
  onOpen: (alert: AlertEntry) => void;
  onMarkRead: (id: string) => void;
}) {
  const unreadAlerts = filtered.filter((a) => !a.read);
  const readAlerts = filtered.filter((a) => a.read);
  const showDivider = activeTab === 'all' && unreadAlerts.length > 0 && readAlerts.length > 0;

  return (
    <div className="space-y-3 stagger-children">
      {unreadAlerts.map((alert) => (
        <AlertCard key={alert.id} alert={alert} onOpen={onOpen} onMarkRead={onMarkRead} />
      ))}
      {showDivider && (
        <div className="flex items-center gap-3 py-1">
          <div className="h-px flex-1 bg-ink-700/60" />
          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500">
            Read
          </span>
          <div className="h-px flex-1 bg-ink-700/60" />
        </div>
      )}
      {readAlerts.map((alert) => (
        <AlertCard key={alert.id} alert={alert} onOpen={onOpen} onMarkRead={onMarkRead} />
      ))}
    </div>
  );
}

function AlertCard({
  alert,
  onOpen,
  onMarkRead,
}: {
  alert: AlertEntry;
  onOpen: (alert: AlertEntry) => void;
  onMarkRead: (id: string) => void;
}) {
  return (
    <div
      className={`panel transition-all duration-200 ${
        alert.read
          ? 'opacity-60'
          : 'border-l-2 border-l-cyan-500'
      } p-4`}
    >
      <div className="flex items-start gap-3">
        <div className="relative mt-1 flex-shrink-0">
          <span className={`h-2.5 w-2.5 rounded-full ${severityDot[alert.severity]}`} />
          {!alert.read && (
            <span className={`absolute inset-0 h-2.5 w-2.5 rounded-full ${severityDot[alert.severity]} animate-ping-slow`} />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <SeverityBadge severity={alert.severity} size="xs" />
            <span className="text-xs text-slate-500">
              {hazardTypeLabels[alert.hazardType]}
            </span>
            {!alert.read && (
              <span className="text-[10px] font-medium text-cyan-300">NEW</span>
            )}
          </div>
          <Link
            to={`/incidents/${alert.incidentId}`}
            onClick={() => onOpen(alert)}
            className="mt-1.5 block text-sm font-semibold text-slate-100 transition-colors hover:text-cyan-300"
          >
            {alert.title}
          </Link>
          <p className="mt-1 text-xs text-slate-400 leading-relaxed">
            {alert.message}
          </p>
          <div className="mt-2.5 flex items-center gap-2 flex-wrap">
            <span className="chip border-cyan-500/20 bg-cyan-500/5 text-cyan-300">
              <Bell className="h-3 w-3" />
              {alert.rule}
            </span>
            <span className="chip border-ink-600/60 bg-ink-800/60 text-slate-400">
              {alert.location}
            </span>
            <span className="text-[10px] text-slate-500">{timeAgo(alert.timestamp)}</span>
          </div>
        </div>
        {!alert.read && (
          <button
            onClick={() => onMarkRead(alert.id)}
            className="flex-shrink-0 rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-ink-700/40 hover:text-slate-200"
            title="Mark as read"
          >
            <CheckCheck className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}

export default AlertsPage;
