import { useState } from 'react';
import {
  User,
  Heart,
  Bell,
  Palette,
  Clock,
  ShieldCheck,
  MapPin,
  Plus,
  Check,
  MoreVertical,
  Pencil,
} from 'lucide-react';
import { mockWatchlist, hazardTypeLabels } from '../data/mockIncidents';
import type { HazardType } from '../types';
import { PageHeader, PrototypeNotice, SectionHeader } from '../components/ui';

const allHazardTypes: HazardType[] = [
  'earthquake',
  'wildfire',
  'flood',
  'cyclone',
  'volcano',
  'severe-weather',
];

const alertChannels = [
  { id: 'in-app', label: 'In-app notifications', enabled: true },
  { id: 'email', label: 'Email digest', enabled: true },
  { id: 'push', label: 'Push notifications', enabled: false },
];

const severityThresholds = [
  { value: 'critical', label: 'Critical', enabled: true },
  { value: 'high', label: 'High', enabled: true },
  { value: 'elevated', label: 'Elevated', enabled: true },
  { value: 'advisory', label: 'Advisory', enabled: false },
];

export function SettingsPage() {
  const [channels, setChannels] = useState(alertChannels);
  const [thresholds, setThresholds] = useState(severityThresholds);
  const [theme, setTheme] = useState('midnight');
  const [timezone, setTimezone] = useState('UTC');
  const [hazardTypes, setHazardTypes] = useState<Record<HazardType, boolean>>({
    earthquake: true,
    wildfire: true,
    flood: true,
    cyclone: true,
    volcano: true,
    'severe-weather': true,
  });
  const [savedToast, setSavedToast] = useState(false);

  const showSavedToast = () => {
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 2000);
  };

  const toggleChannel = (id: string) => {
    setChannels((prev) =>
      prev.map((c) => (c.id === id ? { ...c, enabled: !c.enabled } : c))
    );
    showSavedToast();
  };

  const toggleThreshold = (value: string) => {
    setThresholds((prev) =>
      prev.map((t) => (t.value === value ? { ...t, enabled: !t.enabled } : t))
    );
    showSavedToast();
  };

  const toggleHazard = (ht: HazardType) => {
    setHazardTypes((prev) => ({ ...prev, [ht]: !prev[ht] }));
    showSavedToast();
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 lg:px-6 lg:py-8">
      <PageHeader
        title="Settings"
        subtitle="Manage your profile, watchlist, alert preferences, and privacy. Uses prototype fixture data."
      >
        <PrototypeNotice />
      </PageHeader>

      <div className="space-y-6">
        {/* Profile card */}
        <div className="panel p-5">
          <SectionHeader title="Profile" icon={User} />
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full border border-cyan-500/30 bg-cyan-500/10">
              <User className="h-8 w-8 text-cyan-300" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-100">Analyst</h3>
              <p className="text-sm text-slate-500">Prototype User</p>
              <p className="mt-1 text-xs text-slate-600">
                analyst@sentinel-atlas.prototype
              </p>
            </div>
          </div>
        </div>

        {/* Watchlist settings */}
        <div className="panel p-5">
          <SectionHeader
            title="Watchlist"
            icon={Heart}
            action={
              <button className="btn-ghost cursor-pointer text-xs">
                <Plus className="h-3.5 w-3.5" />
                Add Location
              </button>
            }
          />
          <div className="space-y-3">
            {mockWatchlist.map((loc) => (
              <div
                key={loc.id}
                className="flex items-center justify-between rounded-lg border border-ink-700/60 bg-ink-850/40 p-3"
              >
                <div className="flex items-center gap-3">
                  <MapPin className="h-4 w-4 text-cyan-400" />
                  <div>
                    <p className="text-sm font-medium text-slate-200">{loc.name}</p>
                    <p className="text-xs text-slate-500">{loc.country}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="hidden items-center gap-1.5 sm:flex">
                    {loc.alertRules.map((rule) => (
                      <span
                        key={rule}
                        className="rounded border border-ink-600/60 bg-ink-800/60 px-2 py-0.5 text-[10px] text-slate-400"
                      >
                        {hazardTypeLabels[rule]}
                      </span>
                    ))}
                  </div>
                  <button
                    onClick={showSavedToast}
                    className="flex cursor-pointer items-center gap-1 rounded border border-ink-600/60 bg-ink-800/60 px-2 py-1 text-[10px] text-slate-300 transition-colors hover:border-cyan-500/40 hover:text-cyan-300"
                  >
                    <Pencil className="h-3 w-3" />
                    Edit
                  </button>
                  <MoreVertical className="h-4 w-4 cursor-pointer text-slate-500 transition-colors hover:text-slate-300" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Alert preferences */}
        <div className="panel p-5">
          <SectionHeader title="Alert Preferences" icon={Bell} />

          {/* Channels */}
          <div className="mb-4">
            <p className="mb-2 text-xs font-medium text-slate-400">Delivery Channels</p>
            <div className="space-y-2">
              {channels.map((channel) => (
                <button
                  key={channel.id}
                  onClick={() => toggleChannel(channel.id)}
                  className="flex w-full cursor-pointer items-center justify-between rounded-lg border border-ink-700/60 bg-ink-850/40 p-3 transition-colors hover:border-ink-600"
                >
                  <span className="text-sm text-slate-200">{channel.label}</span>
                  <span
                    className={`relative h-5 w-9 rounded-full transition-colors ${
                      channel.enabled ? 'bg-cyan-500' : 'bg-ink-600'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
                        channel.enabled ? 'translate-x-4' : 'translate-x-0.5'
                      }`}
                    />
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Severity thresholds */}
          <div>
            <p className="mb-2 text-xs font-medium text-slate-400">Severity Thresholds</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {thresholds.map((t) => (
                <button
                  key={t.value}
                  onClick={() => toggleThreshold(t.value)}
                  className={`flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border p-2.5 text-xs font-medium transition-all ${
                    t.enabled
                      ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-300'
                      : 'border-ink-700/60 bg-ink-850/40 text-slate-500'
                  }`}
                >
                  {t.enabled && <Check className="h-3 w-3" />}
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Hazard types */}
          <div className="mt-4">
            <p className="mb-2 text-xs font-medium text-slate-400">Hazard Types</p>
            <div className="flex flex-wrap gap-2">
              {allHazardTypes.map((ht) => (
                <button
                  key={ht}
                  onClick={() => toggleHazard(ht)}
                  className={`flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${
                    hazardTypes[ht]
                      ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-300'
                      : 'border-ink-700/60 bg-ink-850/40 text-slate-500'
                  }`}
                >
                  {hazardTypes[ht] && <Check className="h-3 w-3" />}
                  {hazardTypeLabels[ht]}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Theme preference */}
        <div className="panel p-5">
          <SectionHeader title="Theme Preference" icon={Palette} />
          <div className="grid grid-cols-3 gap-3">
            {[
              { id: 'midnight', label: 'Midnight', colors: ['#070a12', '#0d1320', '#22d3ee'] },
              { id: 'graphite', label: 'Graphite', colors: ['#1a1a1a', '#2a2a2a', '#3b82f6'] },
              { id: 'tactical', label: 'Tactical', colors: ['#0a0e0a', '#111811', '#10b981'] },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  setTheme(t.id);
                  showSavedToast();
                }}
                className={`cursor-pointer rounded-lg border p-3 transition-all ${
                  theme === t.id
                    ? 'border-cyan-500/40 bg-cyan-500/5'
                    : 'border-ink-700/60 bg-ink-850/40 hover:border-ink-600'
                }`}
              >
                <div className="flex gap-1.5 mb-2">
                  {t.colors.map((c) => (
                    <span
                      key={c}
                      className="h-4 w-4 rounded-full border border-ink-600/40"
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
                <p className={`text-xs font-medium ${theme === t.id ? 'text-cyan-300' : 'text-slate-400'}`}>
                  {t.label}
                </p>
              </button>
            ))}
          </div>
          <p className="mt-2 text-[10px] text-slate-600">
            Theme switching is a placeholder in this prototype.
          </p>
        </div>

        {/* Timezone */}
        <div className="panel p-5">
          <SectionHeader title="Timezone" icon={Clock} />
          <select
            value={timezone}
            onChange={(e) => {
              setTimezone(e.target.value);
              showSavedToast();
            }}
            className="w-full cursor-pointer rounded-lg border border-ink-700/60 bg-ink-850/60 px-3 py-2.5 text-sm text-slate-200 transition-colors focus:border-cyan-500/40 focus:outline-none"
          >
            <option value="UTC">UTC (Coordinated Universal Time)</option>
            <option value="IST">IST (India Standard Time)</option>
            <option value="MYT">MYT (Malaysia Time)</option>
            <option value="EST">EST (Eastern Standard Time)</option>
            <option value="PST">PST (Pacific Standard Time)</option>
            <option value="CET">CET (Central European Time)</option>
          </select>
          <p className="mt-2 text-[10px] text-slate-600">
            Timezone selection is a placeholder in this prototype.
          </p>
        </div>

        {/* Privacy and data-use */}
        <div className="panel p-5">
          <SectionHeader title="Privacy & Data Use" icon={ShieldCheck} />
          <div className="space-y-3">
            <div className="rounded-lg border border-ink-700/60 bg-ink-850/40 p-3">
              <h4 className="text-sm font-medium text-slate-200">Watchlist Privacy</h4>
              <p className="mt-1 text-xs text-slate-500">
                Your watched locations are stored locally in this prototype. In the full
                platform, they will be encrypted at rest and never shared with third parties.
              </p>
            </div>
            <div className="rounded-lg border border-ink-700/60 bg-ink-850/40 p-3">
              <h4 className="text-sm font-medium text-slate-200">Data Use</h4>
              <p className="mt-1 text-xs text-slate-500">
                Sentinel Atlas uses your watchlist and alert preferences solely to filter
                and prioritise intelligence. We do not sell or share your data.
              </p>
            </div>
            <div className="rounded-lg border border-ink-700/60 bg-ink-850/40 p-3">
              <h4 className="text-sm font-medium text-slate-200">Prototype Limitations</h4>
              <p className="mt-1 text-xs text-slate-500">
                This prototype uses mock data only. No real personal data is collected,
                stored, or transmitted. All settings are held in local state.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Saved toast */}
      {savedToast && (
        <div className="animate-toast-in fixed bottom-6 right-6 flex items-center gap-2 rounded-lg border border-cyan-500/40 bg-ink-850/90 px-4 py-3 shadow-lg backdrop-blur">
          <Check className="h-4 w-4 text-cyan-300" />
          <span className="text-sm text-slate-200">Saved locally in this prototype</span>
        </div>
      )}
    </div>
  );
}

export default SettingsPage;
