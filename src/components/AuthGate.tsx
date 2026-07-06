import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface AuthGateProps {
  children: ReactNode;
  title?: string;
  description?: string;
}

export function AuthGate({ children, title = 'Personalised workspace', description = 'Sign in to personalise your view and keep your preferences with you.' }: AuthGateProps) {
  const { loading, isAuthenticated } = useAuth();

  if (loading) {
    return (
      <div className="mx-auto flex max-w-3xl items-center justify-center px-4 py-20">
        <div className="panel w-full max-w-xl p-8 text-center text-sm text-slate-400">
          Preparing your Sentinel Atlas workspace…
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="mx-auto flex max-w-3xl items-center justify-center px-4 py-16 lg:px-6">
        <div className="panel w-full max-w-xl overflow-hidden p-0">
          <div className="border-b border-ink-700/60 bg-gradient-to-br from-cyan-500/10 via-ink-900 to-ink-950 p-6">
            <div className="flex items-center gap-2 text-cyan-300">
              <ShieldCheck className="h-4 w-4" />
              <span className="text-xs font-semibold uppercase tracking-[0.24em]">Personalisation required</span>
            </div>
            <h2 className="mt-3 text-2xl font-semibold text-slate-100">{title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">{description}</p>
          </div>
          <div className="p-6">
            <p className="text-sm text-slate-400">
              Signed-in users can keep watchlist preferences, alert context, and their own workspace profile in Sentinel Atlas. Anonymous preview mode remains available for the public screens.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link to="/auth" className="btn-primary inline-flex items-center justify-center">
                Sign in or create account
              </Link>
              <button
  type="button"
  onClick={() => {
    const publicTrust = document.getElementById('public-data-trust');

    if (publicTrust) {
      publicTrust.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
      return;
    }

    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  }}
  className="btn-secondary inline-flex items-center justify-center"
>
  Review public data trust
</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
