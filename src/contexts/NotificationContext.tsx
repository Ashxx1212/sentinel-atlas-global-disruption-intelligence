import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useAuth } from './AuthContext';
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationRecord,
} from '../lib/notifications';
import { supabase } from '../lib/supabase';

export type NotificationLoadState =
  | 'loading'
  | 'ready'
  | 'empty'
  | 'error'
  | 'signed_out'
  | 'unconfigured';

type NotificationContextValue = {
  notifications: NotificationRecord[];
  unreadCount: number;
  state: NotificationLoadState;
  errorMessage: string | null;
  refreshNotifications: () => Promise<void>;
  markNotificationRead: (id: string) => Promise<boolean>;
  markAllNotificationsRead: () => Promise<boolean>;
};

const NotificationContext = createContext<NotificationContextValue | undefined>(undefined);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, isConfigured, loading: authLoading, user } = useAuth();
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [state, setState] = useState<NotificationLoadState>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const refreshNotifications = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent === true;

    if (authLoading) {
      setState('loading');
      return;
    }

    if (!isConfigured) {
      setNotifications([]);
      setErrorMessage(null);
      setState('unconfigured');
      return;
    }

    if (!isAuthenticated || !user) {
      setNotifications([]);
      setErrorMessage(null);
      setState('signed_out');
      return;
    }

    if (!silent) {
      setState('loading');
    }
    setErrorMessage(null);

    try {
      const nextNotifications = await fetchNotifications(user.id);
      setNotifications(nextNotifications);
      setState(nextNotifications.length > 0 ? 'ready' : 'empty');
    } catch {
      if (!silent) {
        setNotifications([]);
      }
      setErrorMessage(
        'Private notifications could not be loaded. Try refreshing this view.',
      );
      setState('error');
    }
  }, [authLoading, isAuthenticated, isConfigured, user]);

  useEffect(() => {
    void refreshNotifications();
  }, [refreshNotifications]);

  useEffect(() => {
    const supabaseClient = supabase;

    if (authLoading || !isConfigured || !isAuthenticated || !user || !supabaseClient) {
      return;
    }

    const channel = supabaseClient
      .channel(`private-notifications:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          void refreshNotifications({ silent: true });
        },
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          void refreshNotifications({ silent: true });
        }
      });

    return () => {
      void supabaseClient.removeChannel(channel);
    };
  }, [authLoading, isAuthenticated, isConfigured, refreshNotifications, user]);

  const markOneAsRead = useCallback(
    async (id: string): Promise<boolean> => {
      if (!isAuthenticated || !user) {
        return false;
      }

      const notification = notifications.find((item) => item.id === id);

      if (!notification || notification.readAt) {
        return true;
      }

      const readAt = new Date().toISOString();

      try {
        await markNotificationRead(id, user.id, readAt);
        setNotifications((current) =>
          current.map((item) => (item.id === id ? { ...item, readAt } : item)),
        );
        return true;
      } catch {
        setErrorMessage('This notification could not be marked as read.');
        return false;
      }
    },
    [isAuthenticated, notifications, user],
  );

  const markEverythingAsRead = useCallback(async (): Promise<boolean> => {
    if (!isAuthenticated || !user) {
      return false;
    }

    const unreadExists = notifications.some((notification) => !notification.readAt);

    if (!unreadExists) {
      return true;
    }

    const readAt = new Date().toISOString();

    try {
      await markAllNotificationsRead(user.id, readAt);
      setNotifications((current) =>
        current.map((item) => (item.readAt ? item : { ...item, readAt })),
      );
      return true;
    } catch {
      setErrorMessage('Notifications could not be marked as read.');
      return false;
    }
  }, [isAuthenticated, notifications, user]);

  const value = useMemo<NotificationContextValue>(
    () => ({
      notifications,
      unreadCount: notifications.filter((notification) => !notification.readAt).length,
      state,
      errorMessage,
      refreshNotifications,
      markNotificationRead: markOneAsRead,
      markAllNotificationsRead: markEverythingAsRead,
    }),
    [
      errorMessage,
      markEverythingAsRead,
      markOneAsRead,
      notifications,
      refreshNotifications,
      state,
    ],
  );

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications(): NotificationContextValue {
  const context = useContext(NotificationContext);

  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider.');
  }

  return context;
}
