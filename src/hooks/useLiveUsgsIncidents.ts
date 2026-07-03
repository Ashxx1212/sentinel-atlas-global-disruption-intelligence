import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchLiveUsgsIntelligence } from '../lib/liveUsgsIncidents';
import type { LiveUsgsFetchResult } from '../types/liveIntelligence';

const initialState: LiveUsgsFetchResult = {
  state: 'loading',
  records: [],
  source: null,
  sources: [],
  recordCount: 0,
  errorMessage: null,
};

export function useLiveUsgsIncidents() {
  const [result, setResult] = useState<LiveUsgsFetchResult>(initialState);
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
      const next = await fetchLiveUsgsIntelligence({ forceRefresh });
      if (mountedRef.current && requestId === requestIdRef.current) {
        setResult(next);
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
