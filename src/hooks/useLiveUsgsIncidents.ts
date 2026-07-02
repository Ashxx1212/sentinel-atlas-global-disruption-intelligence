import { useCallback, useEffect, useState } from 'react';
import { fetchLiveUsgsIntelligence } from '../lib/liveUsgsIncidents';
import type { LiveUsgsFetchResult } from '../types/liveIntelligence';

const initialState: LiveUsgsFetchResult = {
  state: 'loading',
  records: [],
  source: null,
  recordCount: 0,
  errorMessage: null,
};

export function useLiveUsgsIncidents() {
  const [result, setResult] = useState<LiveUsgsFetchResult>(initialState);

  const refresh = useCallback(async () => {
    setResult((current) => ({ ...current, state: 'loading', errorMessage: null }));
    const next = await fetchLiveUsgsIntelligence();
    setResult(next);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    ...result,
    refresh,
  };
}
