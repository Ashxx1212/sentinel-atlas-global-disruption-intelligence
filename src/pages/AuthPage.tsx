import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Mail, ShieldCheck, Sparkles } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const timezoneOptions = [
  'UTC',
  'America/New_York',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Paris',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Australia/Sydney',
];

function getDefaultTimezone(): string {
  const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return timezoneOptions.includes(browserTimezone) ? browserTimezone : timezoneOptions[0];
}

export function AuthPage() {
  const { isConfigured, isAuthenticated, needsOnboarding, pendingEmailConfirmation, authError, authMessage, loading, signIn, signUp, requestPasswordReset, completeOnboarding } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [timezone, setTimezone] = useState(getDefaultTimezone);
  const [watchlistIntent, setWatchlistIntent] = useState('critical-hazards');
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    setFormError(authError);
  }, [authError]);

  const submitLabel = useMemo(() => {
    if (mode === 'signup') return 'Create account';
    if (mode === 'forgot') return 'Send reset link';
    return 'Sign in';
  }, [mode]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);

    if (mode === 'forgot') {
      if (!email.trim()) {
        setFormError('Enter your email address to receive reset instructions.');
        return;
      }
      await requestPasswordReset(email.trim());
      return;
    }

    if (mode === 'signup') {
      if (!email.trim() || !password) {
        setFormError('Email and password are required.');
        return;
      }
      if (password !== confirmPassword) {
        setFormError('Passwords do not match.');
        return;
      }
      await signUp(email.trim(), password);
      return;
    }

    if (!email.trim() || !password) {
      setFormError('Email and password are required.');
      return;
    }

    await signIn(email.trim(), password);
  };

  const handleOnboardingSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    await completeOnboarding(displayName, timezone);
  };

  if (!isConfigured) {
    return (
      <div className="min-h-screen bg-ink-950 px-4 py-16 text-slate-300">
        <div className="mx-auto flex max-w-2xl flex-col gap-6 rounded-2xl border border-ink-700/60 bg-ink-900/90 p-8 shadow-panel">
          <div className="flex items-center gap-2 text-cyan-300">
            <ShieldCheck className="h-5 w-5" />
            <span className="text-xs font-semibold uppercase tracking-[0.28em]">Authentication unavailable</span>
          </div>
          <h1 className="text-3xl font-semibold text-slate-100">Supabase needs a browser-safe configuration first.</h1>
          <p className="text-sm leading-relaxed text-slate-400">
            Add the VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY values in your local environment, then reload this page to enable sign-in and onboarding.
          </p>
          <Link to="/" className="btn-primary inline-flex items-center justify-center">
            Return to landing page
          </Link>
        </div>
      </div>
    );
  }

  if (needsOnboarding && isAuthenticated) {
    return (
      <div className="min-h-screen bg-ink-950 px-4 py-16 text-slate-300">
        <div className="mx-auto flex max-w-3xl flex-col gap-6 rounded-2xl border border-cyan-500/20 bg-ink-900/90 p-8 shadow-panel">
          <div className="flex items-center gap-2 text-cyan-300">
            <Sparkles className="h-5 w-5" />
            <span className="text-xs font-semibold uppercase tracking-[0.28em]">Welcome to Sentinel Atlas</span>
          </div>
          <div>
            <h1 className="text-3xl font-semibold text-slate-100">A quick onboarding setup.</h1>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">This keeps your personal watchlist intention and workspace preferences aligned with the rest of the experience.</p>
          </div>

          <form onSubmit={handleOnboardingSubmit} className="space-y-4">
            <div>
              <label htmlFor="displayName" className="mb-2 block text-sm text-slate-400">Display name</label>
              <input id="displayName" value={displayName} onChange={(event) => setDisplayName(event.target.value)} className="w-full rounded-lg border border-ink-700/60 bg-ink-850/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-500/40" placeholder="Analyst Name" />
            </div>
            <div>
              <label htmlFor="timezone" className="mb-2 block text-sm text-slate-400">Timezone</label>
              <select id="timezone" value={timezone} onChange={(event) => setTimezone(event.target.value)} className="w-full rounded-lg border border-ink-700/60 bg-ink-850/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-500/40">
                {timezoneOptions.map((option) => (<option key={option} value={option}>{option}</option>))}
              </select>
            </div>
            <div>
              <p className="mb-2 text-sm text-slate-400">What would you like to track first?</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {[
                  { value: 'critical-hazards', label: 'Critical hazards' },
                  { value: 'regional-weather', label: 'Regional weather' },
                  { value: 'cross-border-events', label: 'Cross-border events' },
                  { value: 'everything', label: 'Everything' },
                ].map((option) => (
                  <label key={option.value} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${watchlistIntent === option.value ? 'border-cyan-500/30 bg-cyan-500/10 text-cyan-200' : 'border-ink-700/60 bg-ink-850/40 text-slate-400'}`}>
                    <input type="radio" name="watchlistIntent" value={option.value} checked={watchlistIntent === option.value} onChange={() => setWatchlistIntent(option.value)} className="h-3.5 w-3.5 border-cyan-500/40 bg-transparent" />
                    {option.label}
                  </label>
                ))}
              </div>
            </div>
            {(formError || authError) && <p className="text-sm text-error-400">{formError || authError}</p>}
            {authMessage && <p className="text-sm text-cyan-300">{authMessage}</p>}
            <button type="submit" className="btn-primary inline-flex items-center justify-center gap-2" disabled={loading}>
              Finish onboarding
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (pendingEmailConfirmation) {
    return (
      <div className="min-h-screen bg-ink-950 px-4 py-16 text-slate-300">
        <div className="mx-auto flex max-w-2xl flex-col gap-6 rounded-2xl border border-cyan-500/20 bg-ink-900/90 p-8 shadow-panel">
          <div className="flex items-center gap-2 text-cyan-300">
            <Mail className="h-5 w-5" />
            <span className="text-xs font-semibold uppercase tracking-[0.28em]">Email confirmation pending</span>
          </div>
          <h1 className="text-3xl font-semibold text-slate-100">Check your inbox to confirm your account.</h1>
          <p className="text-sm leading-relaxed text-slate-400">Once the email address is confirmed, return here to sign in and finish the initial onboarding experience.</p>
          <Link to="/" className="btn-secondary inline-flex items-center justify-center">
            Return to landing page
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ink-950 px-4 py-16 text-slate-300">
      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-2xl border border-ink-700/60 bg-gradient-to-br from-cyan-500/10 via-ink-900 to-ink-950 p-8 shadow-panel">
          <div className="flex items-center gap-2 text-cyan-300">
            <ShieldCheck className="h-5 w-5" />
            <span className="text-xs font-semibold uppercase tracking-[0.28em]">Sentinel Atlas auth</span>
          </div>
          <h1 className="mt-4 text-3xl font-semibold text-slate-100">Premium access to your personal intelligence workspace.</h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-400">Sign in with your email and password to keep your workspace sync, onboarding state, and personalisation profile intact. Public pages such as the map, incident rooms, and data trust stay available to everyone.</p>
          <div className="mt-6 space-y-3 rounded-xl border border-ink-700/60 bg-ink-950/60 p-4 text-sm text-slate-400">
            <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-cyan-300" /> Read-only access to public intelligence views</div>
            <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-cyan-300" /> Personalised watchlist and briefing context</div>
            <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-cyan-300" /> Secure profile and onboarding persistence</div>
          </div>
        </div>

        <div className="rounded-2xl border border-ink-700/60 bg-ink-900/90 p-8 shadow-panel">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <button type="button" onClick={() => { setMode('signin'); setFormError(null); }} className={`rounded-full px-3 py-1.5 ${mode === 'signin' ? 'bg-cyan-500/10 text-cyan-300' : 'bg-ink-800/70 text-slate-400'}`}>Sign in</button>
            <button type="button" onClick={() => { setMode('signup'); setFormError(null); }} className={`rounded-full px-3 py-1.5 ${mode === 'signup' ? 'bg-cyan-500/10 text-cyan-300' : 'bg-ink-800/70 text-slate-400'}`}>Create account</button>
            <button type="button" onClick={() => { setMode('forgot'); setFormError(null); }} className={`rounded-full px-3 py-1.5 ${mode === 'forgot' ? 'bg-cyan-500/10 text-cyan-300' : 'bg-ink-800/70 text-slate-400'}`}>Forgot password</button>
          </div>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label htmlFor="email" className="mb-2 block text-sm text-slate-400">Email</label>
              <input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="w-full rounded-lg border border-ink-700/60 bg-ink-850/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-500/40" required />
            </div>
            {mode !== 'forgot' && (
              <div>
                <label htmlFor="password" className="mb-2 block text-sm text-slate-400">Password</label>
                <input id="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="w-full rounded-lg border border-ink-700/60 bg-ink-850/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-500/40" required />
              </div>
            )}
            {mode === 'signup' && (
              <div>
                <label htmlFor="confirmPassword" className="mb-2 block text-sm text-slate-400">Confirm password</label>
                <input id="confirmPassword" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="w-full rounded-lg border border-ink-700/60 bg-ink-850/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-500/40" required />
              </div>
            )}
            {(formError || authError) && <p className="text-sm text-error-400">{formError || authError}</p>}
            {authMessage && <p className="text-sm text-cyan-300">{authMessage}</p>}
            <button type="submit" className="btn-primary inline-flex w-full items-center justify-center gap-2" disabled={loading}>
              {submitLabel}
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>

          {mode === 'signin' && (
            <p className="mt-4 text-sm text-slate-500">Need a preview-only experience? Continue to the public map and incident rooms without signing in.</p>
          )}
          <div className="mt-6 flex items-center justify-between text-sm text-slate-500">
            <Link to="/" className="hover:text-cyan-300">Return home</Link>
            <Link to="/data-trust" className="hover:text-cyan-300">Data Trust</Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AuthPage;
