import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { mockAlerts } from '../data/mockIncidents';
import type { AlertEntry } from '../types';

const STORAGE_KEY = 'sentinel-atlas.prototype-alerts.v1';

type AlertContextValue = {
  alerts: AlertEntry[];
  unreadCount: number;
  markAlertRead: (id: string) => void;
  markAllAlertsRead: () => void;
  resetPrototypeAlerts: () => void;
};

const AlertContext = createContext<AlertContextValue | undefined>(undefined);

function createDefaultAlerts(): AlertEntry[] {
  return mockAlerts.map((alert) => ({ ...alert }));
}

function readPersistedAlerts(): AlertEntry[] {
  const defaults = createDefaultAlerts();

  if (typeof window === 'undefined') {
    return defaults;
  }

  try {
    const storedValue = window.localStorage.getItem(STORAGE_KEY);
    if (!storedValue) {
      return defaults;
    }

    const storedAlerts = JSON.parse(storedValue) as unknown;
    if (!Array.isArray(storedAlerts)) {
      return defaults;
    }

    const readStateById = new Map<string, boolean>();
    storedAlerts.forEach((alert) => {
      if (
        alert &&
        typeof alert === 'object' &&
        typeof (alert as { id?: unknown }).id === 'string' &&
        typeof (alert as { read?: unknown }).read === 'boolean'
      ) {
        readStateById.set(
          (alert as { id: string }).id,
          (alert as { read: boolean }).read,
        );
      }
    });

    return defaults.map((alert) => ({
      ...alert,
      read: readStateById.get(alert.id) ?? alert.read,
    }));
  } catch {
    return defaults;
  }
}

export function AlertProvider({ children }: { children: React.ReactNode }) {
  const [alerts, setAlerts] = useState<AlertEntry[]>(readPersistedAlerts);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(alerts));
    } catch {
      // Local demo alert state should never prevent the workspace from rendering.
    }
  }, [alerts]);

  const markAlertRead = useCallback((id: string) => {
    setAlerts((currentAlerts) =>
      currentAlerts.map((alert) =>
        alert.id === id ? { ...alert, read: true } : alert,
      ),
    );
  }, []);

  const markAllAlertsRead = useCallback(() => {
    setAlerts((currentAlerts) =>
      currentAlerts.map((alert) => ({ ...alert, read: true })),
    );
  }, []);

  const resetPrototypeAlerts = useCallback(() => {
    setAlerts(createDefaultAlerts());
  }, []);

  const value = useMemo<AlertContextValue>(
    () => ({
      alerts,
      unreadCount: alerts.filter((alert) => !alert.read).length,
      markAlertRead,
      markAllAlertsRead,
      resetPrototypeAlerts,
    }),
    [alerts, markAlertRead, markAllAlertsRead, resetPrototypeAlerts],
  );

  return <AlertContext.Provider value={value}>{children}</AlertContext.Provider>;
}

export function usePrototypeAlerts(): AlertContextValue {
  const context = useContext(AlertContext);

  if (!context) {
    throw new Error('usePrototypeAlerts must be used within an AlertProvider.');
  }

  return context;
}
