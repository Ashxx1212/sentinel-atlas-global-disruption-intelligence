import { Info } from 'lucide-react';

export function PrototypeNotice({
  text = 'This interface uses local prototype fixtures. No live public-source data is ingested in this build.',
  className = '',
}: {
  text?: string;
  className?: string;
}) {
  return (
    <div
      className={`flex items-center gap-2 rounded-lg border border-warning-500/20 bg-warning-500/5 px-3 py-2 ${className}`}
    >
      <Info className="h-3.5 w-3.5 flex-shrink-0 text-warning-400" />
      <p className="text-xs text-slate-400">
        <span className="font-medium text-warning-400">Prototype Fixture ·</span> {text}
      </p>
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0 max-w-2xl">
          <h1 className="text-2xl font-bold tracking-tight text-slate-100 sm:text-3xl">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-1.5 text-sm text-slate-400 leading-relaxed">{subtitle}</p>
          )}
        </div>
        {children && (
          <div className="flex-shrink-0 w-full lg:w-auto">
            {children}
          </div>
        )}
      </div>
    </div>
  );
}

export function SectionHeader({
  title,
  icon: Icon,
  action,
}: {
  title: string;
  icon?: React.ComponentType<{ className?: string }>;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <div className="flex items-center gap-2">
        {Icon && <Icon className="h-4 w-4 text-cyan-400" />}
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-300">
          {title}
        </h2>
      </div>
      {action}
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  message,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  message: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-ink-600/60 bg-ink-850/40 p-8 text-center">
      <div className="rounded-full border border-ink-600/60 bg-ink-800/60 p-3">
        <Icon className="h-6 w-6 text-slate-500" />
      </div>
      <h3 className="mt-3 text-sm font-semibold text-slate-300">{title}</h3>
      <p className="mt-1 max-w-sm text-xs text-slate-500">{message}</p>
      <span className="mt-3 chip border-ink-600/60 bg-ink-800/60 text-slate-500">
        Prototype State
      </span>
    </div>
  );
}

export function LoadingState({ label = 'Loading intelligence data…' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-ink-700/60 bg-ink-850/40 p-8 text-center">
      <div className="relative h-10 w-10">
        <div className="absolute inset-0 rounded-full border-2 border-ink-700" />
        <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-cyan-400 animate-spin" />
      </div>
      <p className="mt-3 text-sm text-slate-400">{label}</p>
      <span className="mt-2 chip border-ink-600/60 bg-ink-800/60 text-slate-500">
        Prototype State
      </span>
    </div>
  );
}
