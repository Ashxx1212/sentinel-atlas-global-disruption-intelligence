import type { SupabaseClient } from '@supabase/supabase-js';
import { ensureDefaultWatchlist } from './watchlists';
import type { Database } from '../types/supabase';

type AlertRuleRow = Database['public']['Tables']['alert_rules']['Row'];

export type AlertRuleSeverity = AlertRuleRow['minimum_severity'];

export interface PersistedAlertRule {
  id: string;
  user_id: string;
  watchlist_id: string | null;
  watchlist_location_id: string | null;
  name: string;
  hazard_type: string | null;
  minimum_severity: AlertRuleSeverity;
  maximum_distance_km: number | null;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateAlertRuleInput {
  name: string;
  hazard_type: string | null;
  minimum_severity: AlertRuleSeverity;
  maximum_distance_km: number | null;
  watchlist_location_id: string | null;
}

function mapAlertRule(row: AlertRuleRow): PersistedAlertRule {
  return {
    id: row.id,
    user_id: row.user_id,
    watchlist_id: row.watchlist_id,
    watchlist_location_id: row.watchlist_location_id,
    name: row.name,
    hazard_type: row.hazard_type,
    minimum_severity: row.minimum_severity,
    maximum_distance_km: row.maximum_distance_km,
    enabled: row.enabled,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function fetchSavedAlertRules(
  client: SupabaseClient,
  userId: string,
): Promise<PersistedAlertRule[]> {
  const watchlistId = await ensureDefaultWatchlist(client, userId);

  const { data, error } = await client
    .from('alert_rules')
    .select('*')
    .eq('user_id', userId)
    .eq('watchlist_id', watchlistId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error('Could not load saved alert rules.');
  }

  return ((data ?? []) as AlertRuleRow[]).map(mapAlertRule);
}

export async function createAlertRule(
  client: SupabaseClient,
  userId: string,
  input: CreateAlertRuleInput,
): Promise<PersistedAlertRule> {
  const name = input.name.trim();

  if (!name) {
    throw new Error('Alert rule name is required.');
  }

  if (name.length > 120) {
    throw new Error('Alert rule names must be 120 characters or fewer.');
  }

  if (
    input.maximum_distance_km !== null &&
    (!Number.isFinite(input.maximum_distance_km) || input.maximum_distance_km <= 0)
  ) {
    throw new Error('Alert rule distance must be positive.');
  }

  const watchlistId = await ensureDefaultWatchlist(client, userId);

  const { data, error } = await client
    .from('alert_rules')
    .insert({
      user_id: userId,
      watchlist_id: watchlistId,
      name,
      hazard_type: input.hazard_type,
      minimum_severity: input.minimum_severity,
      maximum_distance_km: input.maximum_distance_km,
      watchlist_location_id: input.watchlist_location_id,
      enabled: true,
    })
    .select('*')
    .single();

  if (error || !data) {
    throw new Error('Could not create alert rule.');
  }

  return mapAlertRule(data as AlertRuleRow);
}

export async function updateAlertRuleEnabled(
  client: SupabaseClient,
  userId: string,
  ruleId: string,
  enabled: boolean,
): Promise<PersistedAlertRule> {
  const { data, error } = await client
    .from('alert_rules')
    .update({ enabled })
    .eq('id', ruleId)
    .eq('user_id', userId)
    .select('*')
    .single();

  if (error || !data) {
    throw new Error('Could not update alert rule.');
  }

  return mapAlertRule(data as AlertRuleRow);
}

export async function updateAlertRuleLocationScope(
  client: SupabaseClient,
  userId: string,
  ruleId: string,
  watchlistLocationId: string | null,
): Promise<PersistedAlertRule> {
  const { data, error } = await client
    .from('alert_rules')
    .update({
      watchlist_location_id: watchlistLocationId,
    })
    .eq('id', ruleId)
    .eq('user_id', userId)
    .select('*')
    .single();

  if (error || !data) {
    throw new Error('Could not update the alert rule location scope.');
  }

  return mapAlertRule(data as AlertRuleRow);
}

export async function deleteAlertRule(
  client: SupabaseClient,
  userId: string,
  ruleId: string,
): Promise<void> {
  const { error } = await client
    .from('alert_rules')
    .delete()
    .eq('id', ruleId)
    .eq('user_id', userId);

  if (error) {
    throw new Error('Could not remove alert rule.');
  }
}
