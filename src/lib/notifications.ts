import type { Database } from '../types/supabase';
import { isSupabaseConfigured, supabase } from './supabase';

type NotificationRow = Database['public']['Tables']['notifications']['Row'];

export type NotificationRecord = {
  id: string;
  incidentId: string;
  alertRuleId: string | null;
  title: string;
  body: string | null;
  severity: NotificationRow['severity'];
  dataMode: NotificationRow['data_mode'];
  integrityStatus: NotificationRow['integrity_status'];
  matchingReason: string | null;
  readAt: string | null;
  createdAt: string;
};

function mapNotification(row: NotificationRow): NotificationRecord {
  return {
    id: row.id,
    incidentId: row.incident_id,
    alertRuleId: row.alert_rule_id,
    title: row.title,
    body: row.body,
    severity: row.severity,
    dataMode: row.data_mode,
    integrityStatus: row.integrity_status,
    matchingReason: row.matching_reason,
    readAt: row.read_at,
    createdAt: row.created_at,
  };
}

function requireSupabase() {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Notifications are unavailable because Supabase is not configured.');
  }

  return supabase;
}

export async function fetchNotifications(userId: string): Promise<NotificationRecord[]> {
  const client = requireSupabase();

  const { data, error } = await client
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    throw new Error('Unable to load private notifications.');
  }

  return ((data ?? []) as NotificationRow[]).map(mapNotification);
}

export async function markNotificationRead(
  notificationId: string,
  userId: string,
  readAt: string,
): Promise<void> {
  const client = requireSupabase();

  const { error } = await client
    .from('notifications')
    .update({ read_at: readAt })
    .eq('id', notificationId)
    .eq('user_id', userId)
    .is('read_at', null);

  if (error) {
    throw new Error('Unable to mark this notification as read.');
  }
}

export async function markAllNotificationsRead(
  userId: string,
  readAt: string,
): Promise<void> {
  const client = requireSupabase();

  const { error } = await client
    .from('notifications')
    .update({ read_at: readAt })
    .eq('user_id', userId)
    .is('read_at', null);

  if (error) {
    throw new Error('Unable to mark all notifications as read.');
  }
}
