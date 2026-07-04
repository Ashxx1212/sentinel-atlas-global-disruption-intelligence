import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  ArrowRight,
  Globe2,
  ShieldCheck,
  Activity,
  Satellite,
  Radio,
  AlertTriangle,
} from 'lucide-react';
import { mockIncidents } from '../data/mockIncidents';
import { MockMapWorkspace } from '../components/MockMapWorkspace';
import { buildHybridIncidentFromFixture } from '../lib/hybridIncidents';

const trustSources = [
  { name: 'USGS', role: 'Seismic events' },
  { name: 'NASA EONET', role: 'Natural events' },
  { name: 'GDACS', role: 'Disaster alerts' },
  { name: 'Open-Meteo', role: 'Weather forecasts' },
];

export function LandingPage() {
  const { isAuthenticated } = useAuth();
  const mapIncidents = mockIncidents.map(buildHybridIncidentFromFixture);
  const workspaceRoute = isAuthenticated ? '/command-centre' : '/auth?next=/command-centre';
  const workspaceLabel = isAuthenticated ? 'Open workspace' : 'Sign in';

  return (
    <div className="relative min-h-screen overflow-hidden bg-ink-950">
      {/* Background grid */}
      <div className="pointer-events-none absolute inset-0 grid-texture opacity-40" />
      {/* Scan line */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-400/20 to-transparent animate-scan-line" />
      </div>
      {/* Radial glow */}
      <div className="pointer-events-none absolute left-1/2 top-0 h-[600px] w-[800px] -translate-x-1/2 rounded-full bg-cyan-500/5 blur-[120px]" />

      {/* Top bar */}
      <header className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-3">
          <div className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-cyan-500/40 bg-ink-850">
            <svg viewBox="0 0 24 24" className="h-5 w-5 text-cyan-400" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="12" cy="12" r="9" opacity="0.4" />
              <circle cx="12" cy="12" r="4" />
              <circle cx="12" cy="12" r="1" fill="currentColor" />
              <line x1="12" y1="2" x2="12" y2="5" />
              <line x1="12" y1="19" x2="12" y2="22" />
              <line x1="2" y1="12" x2="5" y2="12" />
              <line x1="19" y1="12" x2="22" y2="12" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-bold tracking-tight text-slate-100">SENTINEL ATLAS</p>
            <p className="text-[10px] font-medium uppercase tracking-wider text-cyan-500/60">
              Global Disruption Intelligence
            </p>
          </div>
        </div>
        <Link
          to={workspaceRoute}
          className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-ink-600 px-4 py-2 text-sm font-medium text-slate-300 transition-all hover:border-cyan-500/40 hover:text-cyan-300"
        >
          {workspaceLabel}
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </header>

      {/* Hero */}
      <section className="relative z-10 mx-auto max-w-7xl px-6 pt-12 pb-20 lg:pt-20">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          {/* Left: copy */}
          <div className="animate-fade-in">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/5 px-3 py-1">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse-dot" />
              <span className="text-xs font-medium text-cyan-300">
                Intelligence Platform · Prototype
              </span>
            </div>

            <h1 className="mt-6 text-4xl font-bold leading-[1.1] tracking-tight text-slate-50 sm:text-5xl lg:text-6xl text-balance">
              Understand disruption.
              <br />
              <span className="text-cyan-300 text-glow-cyan">Before it reaches</span> your world.
            </h1>

            <p className="mt-6 max-w-lg text-base leading-relaxed text-slate-400 sm:text-lg">
              Sentinel Atlas transforms verified public hazard signals into
              location-aware intelligence — so you can monitor global incidents,
              open detailed Incident Rooms, and receive personalised alerts
              before disruption arrives at your doorstep.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link to="/command-centre" className="btn-primary">
                Enter Command Centre
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/global-map" className="btn-secondary">
                <Globe2 className="h-4 w-4" />
                Explore Global Map
              </Link>
            </div>

            <div className="mt-6 flex items-start gap-2 rounded-lg border border-warning-500/20 bg-warning-500/5 px-4 py-3">
              <AlertTriangle className="h-4 w-4 flex-shrink-0 text-warning-400 mt-0.5" />
              <p className="text-xs text-slate-400">
                Informational intelligence platform — not an operational warning service.
              </p>
            </div>
          </div>

          {/* Right: animated map visual */}
          <div className="relative animate-fade-in" style={{ animationDelay: '200ms' }}>
            <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-ink-700/60 bg-ink-900 shadow-panel">
              <MockMapWorkspace
                incidents={mapIncidents}
                interactive={false}
                showLabels={false}
                className="h-full"
              />
              {/* Overlay info */}
              <div className="pointer-events-none absolute left-4 top-4">
                <div className="flex items-center gap-2">
                  <Activity className="h-3.5 w-3.5 text-cyan-400" />
                  <span className="text-xs font-medium text-slate-300">
                    Live Global Overview
                  </span>
                </div>
                <p className="mt-1 font-mono text-[10px] text-slate-600">
                  {mockIncidents.length} active incidents tracked
                </p>
              </div>
              <div className="pointer-events-none absolute bottom-4 right-4 flex gap-2">
                {['critical', 'high', 'elevated', 'advisory'].map((s) => (
                  <div key={s} className="flex items-center gap-1">
                    <span
                      className={`h-2 w-2 rounded-full ${
                        s === 'critical' ? 'bg-error-500' :
                        s === 'high' ? 'bg-orange-500' :
                        s === 'elevated' ? 'bg-yellow-500' : 'bg-slate-500'
                      }`}
                    />
                    <span className="text-[10px] text-slate-500 capitalize">{s}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trust strip */}
      <section className="relative z-10 border-t border-ink-700/60 bg-ink-900/40">
        <div className="mx-auto max-w-7xl px-6 py-8">
          <p className="text-center text-xs font-medium uppercase tracking-wider text-slate-600">
            Built on verified public hazard data sources
          </p>
          <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {trustSources.map((src) => (
              <div
                key={src.name}
                className="flex items-center gap-3 rounded-lg border border-ink-700/60 bg-ink-850/40 px-4 py-3 transition-colors hover:border-cyan-500/20"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-ink-600/60 bg-ink-800/60">
                  {src.name === 'USGS' && <Activity className="h-4 w-4 text-cyan-400" />}
                  {src.name === 'NASA EONET' && <Satellite className="h-4 w-4 text-cyan-400" />}
                  {src.name === 'GDACS' && <Radio className="h-4 w-4 text-cyan-400" />}
                  {src.name === 'Open-Meteo' && <Globe2 className="h-4 w-4 text-cyan-400" />}
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-200">{src.name}</p>
                  <p className="text-[10px] text-slate-500">{src.role}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-5 text-center text-[11px] text-slate-600">
            Source labels are shown for clarity; authenticated app views separate source-backed records from prototype fixtures.
          </p>
        </div>
      </section>

      {/* Feature strip */}
      <section className="relative z-10 mx-auto max-w-7xl px-6 py-16">
        <div className="grid gap-6 sm:grid-cols-3">
          {[
            {
              icon: Globe2,
              title: 'Global Map Workspace',
              desc: 'Monitor every active hazard on a single command-centre map with severity filtering and incident drawers.',
            },
            {
              icon: ShieldCheck,
              title: 'Incident Rooms',
              desc: 'Open detailed rooms with timelines, evidence records, and context — each data point labelled by integrity.',
            },
            {
              icon: Radio,
              title: 'Personalised Alerts',
              desc: 'Watch your locations and receive alerts when disruption enters your radius or matches your rules.',
            },
          ].map((f) => {
            const Icon = f.icon;
            return (
              <div
                key={f.title}
                className="panel panel-hover group p-6 transition-all duration-300"
              >
                <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/10 p-3 inline-block">
                  <Icon className="h-6 w-6 text-cyan-300" />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-slate-100">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">{f.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-ink-700/60 bg-ink-900/40">
        <div className="mx-auto max-w-7xl px-6 py-8">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <p className="text-xs text-slate-600">
              SENTINEL ATLAS // Global Disruption Intelligence — Prototype Build
            </p>
            <p className="text-xs text-slate-600">
              Authenticated views separate source-backed records from local prototype fixtures.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default LandingPage;
