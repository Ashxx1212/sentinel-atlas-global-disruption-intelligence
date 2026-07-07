import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertOctagon,
  Bell,
  CheckCheck,
  CheckCircle2,
  Inbox,
  RefreshCw,
} from 'lucide-react';
import type { Severity } from '../types';
import { AuthGate } from '../components/AuthGate';
import { SeverityBadge } from '../components/SeverityBadge';
import { EmptyState, PageHeader } from '../components/ui';
import { useNotifications } from '../contexts/NotificationContext';
import type { NotificationRecord } from '../lib/notifications';

type AlertTab = 'all' | 'unread' | 'high-priority';

const tabs: { value: AlertTab; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'unread', label: 'Unread' },
  { value: 'high-priority', label: 'High Priority' },
];

const severityDot: Record<Severity, string> = {
  critical: 'bg-error-500',
  high: 'bg-orange-500',
  elevated: 'bg-yellow-500',
  advisory: 'bg-slate-500',
};

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

function humanize(value: string): string {
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function notificationModeLabel(notification: NotificationRecord): string {
  return notification.dataMode === 'live_source'
    ? 'Source-backed record'
    : 'Prototype fixture';
}

export function AlertsPage() {
  return (
    <AuthGate
      title="Notification Centre"
      description="Sign in to view your private in-app notifications and manage their read state."
    >
      <AuthenticatedAlertsPage />
    </AuthGate>
  );
}

function AuthenticatedAlertsPage() {
  const {
    notifications,
    unreadCount,
    state,
    errorMessage,
    refreshNotifications,
    markNotificationRead,
    markAllNotificationsRead,
  } = useNotifications();
  const [activeTab, setActiveTab] = useState<AlertTab>('all');
  const [toast, setToast] = useState<string | null>(null);
  const toastTimerRef = useRef<number | null>(null);

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

  useEffect(() => {
    return () => {
      if (toastTimerRef.current !== null) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  const filtered = useMemo(() => {
    switch (activeTab) {
      case 'unread':
        return notifications.filter((notification) => !notification.readAt);
      case 'high-priority':
        return notifications.filter(
          (notification) =>
            notification.severity === 'critical' || notification.severity === 'high',
        );
      default:
        return notifications;
    }
  }, [activeTab, notifications]);

  const markAsReadAndToast = async (id: string) => {
    const completed = await markNotificationRead(id);
    showToast(
      completed
        ? 'Notification marked as read'
        : 'Notification could not be marked as read',
    );
  };

  const markAllRead = async () => {
    const completed = await markAllNotificationsRead();
    showToast(
      completed
        ? 'All notifications marked as read'
        : 'Notifications could not be marked as read',
    );
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 lg:px-6 lg:py-8">
      <PageHeader
        title="Notification Centre"
        subtitle="Private in-app notifications for this account. Notification creation remains a server-side responsibility."
      >
        <button
          type="button"
          onClick={() => {
            void refreshNotifications();
          }}
          disabled={state === 'loading'}
          className="btn-secondary px-3 py-2 text-xs"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${state === 'loading' ? 'animate-spin' : ''}`} />
          {state === 'loading' ? 'Loading...' : 'Refresh inbox'}
        </button>
      </PageHeader>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
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
            <span className="font-mono">{notifications.length}</span> total
          </span>
        </div>

        {unreadCount > 0 ? (
          <button
            type="button"
            onClick={() => {
              void markAllRead();
            }}
            className="flex items-center gap-1.5 text-xs text-slate-400 transition-colors hover:text-cyan-300"
          >
            <CheckCheck className="h-3.5 w-3.5" />
            Mark all read
          </button>
        ) : null}
      </div>

      <div className="mb-4 border-b border-ink-700/60">
        <div className="flex gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setActiveTab(tab.value)}
              className={`tab-button ${activeTab === tab.value ? 'tab-button-active' : ''}`}
            >
              {tab.label}
              {tab.value === 'unread' && unreadCount > 0 ? (
                <span className="ml-1.5 rounded-full bg-cyan-500/20 px-1.5 py-0.5 text-[10px] font-mono text-cyan-300">
                  {unreadCount}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </div>

      {state === 'loading' ? (
        <div className="panel space-y-3 p-5" aria-live="polite">
          <div className="h-4 w-40 rounded-full skeleton-shimmer" />
          <div className="h-3 w-3/4 rounded-full skeleton-shimmer" />
          <div className="h-3 w-2/3 rounded-full skeleton-shimmer" />
        </div>
      ) : null}

      {state === 'error' ? (
        <div className="panel border-l-2 border-l-warning-500 p-5">
          <div className="flex items-start gap-3">
            <AlertOctagon className="mt-0.5 h-4 w-4 flex-shrink-0 text-warning-300" />
            <div>
              <h2 className="text-sm font-semibold text-slate-200">
                Private notifications are temporarily unavailable.
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-slate-400">
                {errorMessage ?? 'Try refreshing this view.'}
              </p>
              <button
                type="button"
                onClick={() => {
                  void refreshNotifications();
                }}
                className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-cyan-300 hover:text-cyan-200"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Retry inbox
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {(state === 'ready' || state === 'empty') && filtered.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title={
            notifications.length === 0
              ? 'No in-app notifications yet'
              : activeTab === 'unread'
                ? 'All caught up'
                : 'No notifications in this view'
          }
          message={
            notifications.length === 0
              ? 'No private notification records have been created for this account yet. Automated matching between incidents, watchlists, and alert rules is introduced separately on the server.'
              : activeTab === 'unread'
                ? 'No unread notifications remain.'
                : 'No private notifications match this view.'
          }
        />
      ) : null}

      {state === 'ready' && filtered.length > 0 ? (
        <NotificationList
          filtered={filtered}
          activeTab={activeTab}
          onMarkRead={markAsReadAndToast}
        />
      ) : null}

      <div className="mt-6 panel border-l-2 border-l-cyan-500/30 p-4">
        <div className="flex items-start gap-3">
          <AlertOctagon className="mt-0.5 h-4 w-4 flex-shrink-0 text-cyan-400" />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold text-slate-200">
                How this inbox works
              </h3>
              <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-mono uppercase tracking-wide text-cyan-300">
                Private notification store
              </span>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-slate-400">
              This page reads notifications belonging only to the signed-in account.
              You can mark notifications read, but browser code never creates them.
              Automated incident matching and notification creation will be added as a
              separate server-side evaluator.
            </p>
          </div>
        </div>
      </div>

      {toast ? (
        <div className="fixed bottom-6 right-6 z-50 animate-toast-in">
          <div className="panel flex items-center gap-2.5 px-4 py-3 shadow-lg shadow-black/40">
            <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-cyan-400" />
            <span className="text-sm text-slate-200">{toast}</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function NotificationList({
  filtered,
  activeTab,
  onMarkRead,
}: {
  filtered: NotificationRecord[];
  activeTab: AlertTab;
  onMarkRead: (id: string) => Promise<void>;
}) {
  const unreadNotifications = filtered.filter((notification) => !notification.readAt);
  const readNotifications = filtered.filter((notification) => notification.readAt);
  const showDivider =
    activeTab === 'all' &&
    unreadNotifications.length > 0 &&
    readNotifications.length > 0;

  return (
    <div className="space-y-3 stagger-children">
      {unreadNotifications.map((notification) => (
        <NotificationCard
          key={notification.id}
          notification={notification}
          onMarkRead={onMarkRead}
        />
      ))}

      {showDivider ? (
        <div className="flex items-center gap-3 py-1">
          <div className="h-px flex-1 bg-ink-700/60" />
          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500">
            Read
          </span>
          <div className="h-px flex-1 bg-ink-700/60" />
        </div>
      ) : null}

      {readNotifications.map((notification) => (
        <NotificationCard
          key={notification.id}
          notification={notification}
          onMarkRead={onMarkRead}
        />
      ))}
    </div>
  );
}

function NotificationCard({
  notification,
  onMarkRead,
}: {
  notification: NotificationRecord;
  onMarkRead: (id: string) => Promise<void>;
}) {
  const isRead = Boolean(notification.readAt);

  return (
    <div
      className={`panel p-4 transition-all duration-200 ${
        isRead ? 'opacity-60' : 'border-l-2 border-l-cyan-500'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="relative mt-1 flex-shrink-0">
          <span className={`h-2.5 w-2.5 rounded-full ${severityDot[notification.severity]}`} />
          {!isRead ? (
            <span
              className={`absolute inset-0 h-2.5 w-2.5 rounded-full ${severityDot[notification.severity]} animate-ping-slow`}
            />
          ) : null}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <SeverityBadge severity={notification.severity} size="xs" />
            <span className="text-xs text-slate-500">
              {humanize(notification.integrityStatus)}
            </span>
            {!isRead ? <span className="text-[10px] font-medium text-cyan-300">NEW</span> : null}
          </div>

          <Link
            to={`/incidents/${notification.incidentId}`}
            onClick={() => {
              void onMarkRead(notification.id);
            }}
            className="mt-1.5 block text-sm font-semibold text-slate-100 transition-colors hover:text-cyan-300"
          >
            {notification.title}
          </Link>

          {notification.body ? (
            <p className="mt-1 text-xs leading-relaxed text-slate-400">
              {notification.body}
            </p>
          ) : null}

          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <span className="chip border-cyan-500/20 bg-cyan-500/5 text-cyan-300">
              <Bell className="h-3 w-3" />
              {notification.matchingReason ?? 'Private in-app notification'}
            </span>
            <span className="chip border-ink-600/60 bg-ink-800/60 text-slate-400">
              {notificationModeLabel(notification)}
            </span>
            <span className="text-[10px] text-slate-500">
              {timeAgo(notification.createdAt)}
            </span>
          </div>
        </div>

        {!isRead ? (
          <button
            type="button"
            onClick={() => {
              void onMarkRead(notification.id);
            }}
            className="flex-shrink-0 rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-ink-700/40 hover:text-slate-200"
            title="Mark as read"
            aria-label="Mark notification as read"
          >
            <CheckCheck className="h-4 w-4" />
          </button>
        ) : null}
      </div>
    </div>
  );
}

export default AlertsPage;
