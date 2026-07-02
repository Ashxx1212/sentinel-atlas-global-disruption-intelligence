import { useCallback, useEffect, useRef, useState } from 'react';
import { getHybridIncidents } from '../lib/hybridIncidents';
import type { HybridIncident } from '../types/hybridIntelligence';

export type HybridIncidentsState = 'loading' | 'success' | 'empty' | 'error';

interface HybridIncidentsResult {
  state: HybridIncidentsState;
  incidents: HybridIncident[];
  errorMessage: string | null;
  refresh: (forceRefresh?: boolean) => Promise<void>;
}

const initialState: HybridIncidentsResult = {
  state: 'loading',
  incidents: [],
  errorMessage: null,
  refresh: async () => undefined,
};

let cachedHybridIncidents: HybridIncident[] | null = null;
let inFlightHybridRequest: Promise<HybridIncident[]> | null = null;

async function loadHybridIncidents(forceRefresh = false): Promise<HybridIncident[]> {
  if (!forceRefresh && cachedHybridIncidents) {
    return cachedHybridIncidents;
  }

  if (inFlightHybridRequest) {
    return inFlightHybridRequest;
  }

  inFlightHybridRequest = getHybridIncidents(forceRefresh)
    .then((incidents) => {
      cachedHybridIncidents = incidents;
      return incidents;
    })
    .finally(() => {
      inFlightHybridRequest = null;
    });

  return inFlightHybridRequest;
}

export function useHybridIncidents(): HybridIncidentsResult {
  const [result, setResult] = useState<HybridIncidentsResult>(initialState);
  const mountedRef = useRef(false);
  const requestPendingRef = useRef(false);
  const requestIdRef = useRef(0);

  const refresh = useCallback(async (forceRefresh = false) => {
    if (requestPendingRef.current) {
      return;
    }

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    requestPendingRef.current = true;
    setResult((current) => ({ ...current, state: 'loading', errorMessage: null }));

    try {
      const incidents = await loadHybridIncidents(forceRefresh);
      if (mountedRef.current && requestId === requestIdRef.current) {
        setResult((current) => ({
          ...current,
          state: incidents.length > 0 ? 'success' : 'empty',
          incidents,
          errorMessage: null,
        }));
      }
    } catch {
      if (mountedRef.current && requestId === requestIdRef.current) {
        setResult((current) => ({
          ...current,
          state: 'error',
          incidents: [],
          errorMessage: 'Hybrid incident view is temporarily unavailable.',
        }));
      }
    } finally {
      if (requestId === requestIdRef.current) {
        requestPendingRef.current = false;
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    void refresh();
    return () => {
      mountedRef.current = false;
    };
  }, [refresh]);

  return {
    ...result,
    refresh,
  };
}
