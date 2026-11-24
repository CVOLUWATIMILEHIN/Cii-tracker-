import React, { useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { Activity, ArrowRight, CheckCircle2, ClipboardCheck, Lock, Moon, Sun, Users } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { getSafeInternalRedirect } from '../../lib/validators';
import { getDashboardPathForRole, isAdminPortalRole } from '../../types';

export function LandingAndLoginPage() {
  const {
    firebaseUser,
    profile,
    role,
    loading,
    needsEmailVerification,
    authError,
    signInWithEmail,
    signInWithGoogle,
  } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [searchParams] = useSearchParams();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  if (!loading && firebaseUser && profile && !needsEmailVerification) {
    const fallback = getDashboardPathForRole(role);
    const safeRedirect = getSafeInternalRedirect(searchParams.get('redirect'), fallback);
    const target =
      safeRedirect.startsWith('/admin') && !isAdminPortalRole(role)
        ? fallback
        : safeRedirect.startsWith('/partner') && role === 'member'
          ? fallback
          : safeRedirect;
    return <Navigate to={target} replace />;
  }

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    setSubmitting(true);
    try {
      await signInWithEmail(email, password);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Unable to sign in.');
    } finally {
      setSubmitting(false);
    }
  };

  const displayError = localError || authError;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col">
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between gap-8">
          <Link
            to="/"
            className="flex items-center gap-2 text-base font-bold tracking-tight whitespace-nowrap shrink-0 font-display"
          >
            <Activity className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <span>CII Accountability Tracker</span>
          </Link>

          <div className="flex items-center gap-4 shrink-0">
            <Link
              to="/activate-account"
              className="text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white whitespace-nowrap"
            >
              Activate Account
            </Link>
            <button
              type="button"
              onClick={toggleTheme}
              aria-label="Toggle color theme"
              className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="max-w-5xl w-full grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          <section className="lg:col-span-7 space-y-6">
            <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 tracking-wide">
              Corper Impact Initiative · Digital Programme Accountability
            </p>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 dark:text-white text-balance">
              Accountability, daily check-ins, and measurable impact across every CII cohort.
            </h1>
            <p className="text-base text-slate-600 dark:text-slate-300 leading-relaxed max-w-2xl">
              Corps Members track assigned activities, record daily check-ins, and submit weekly reflections, while Accountability Partners mentor assigned members and guide impact progress across cohorts.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-4 border-t border-slate-200 dark:border-slate-800">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>Corps Members</span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Daily status check-ins, evidence uploads, and weekly reports.
                </p>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
                  <Users className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                  <span>Accountability Partners</span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Caseload oversight, submission feedback, and follow-up tracking.
                </p>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
                  <ClipboardCheck className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                  <span>Measurable Progress</span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Real-time engagement milestones, review feedback, and cohort growth.
                </p>
              </div>
            </div>
          </section>

          <section className="lg:col-span-5">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 sm:p-8 space-y-5">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-slate-900 dark:text-white">
                  <Lock className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <h2 className="text-lg font-semibold">Sign in to CII Tracker</h2>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Access your Corps Member or Accountability Partner dashboard.
                </p>
              </div>

              {displayError && (
                <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300">
                  {displayError}
                </div>
              )}

              <form onSubmit={handleEmailLogin} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                      Password
                    </label>
                    <Link
                      to="/forgot-password"
                      className="text-xs text-emerald-700 dark:text-emerald-400 hover:underline"
                    >
                      Forgot password?
                    </Link>
                  </div>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-2.5 px-4 rounded-lg bg-slate-900 dark:bg-emerald-600 hover:bg-slate-800 dark:hover:bg-emerald-500 text-white text-sm font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-60 cursor-pointer"
                >
                  <span>{submitting ? 'Signing In...' : 'Sign In'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>

              <div className="relative py-1">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200 dark:border-slate-800" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-white dark:bg-slate-900 px-2 text-slate-400">or</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => signInWithGoogle()}
                className="w-full py-2.5 px-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-100 text-sm font-medium flex items-center justify-center gap-2.5 transition-colors cursor-pointer"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="currentColor"
                    d="M21.35 11.1h-9.17v2.73h6.51c-.33 3.81-3.5 5.44-6.5 5.44C8.36 19.27 5 16.25 5 12c0-4.1 3.2-7.27 7.2-7.27 3.09 0 4.9 1.97 4.9 1.97L19 4.72S16.56 2 12.1 2C6.42 2 2.03 6.8 2.03 12c0 5.05 4.13 10 10.22 10 5.35 0 9.25-3.67 9.25-9.09 0-1.15-.15-1.81-.15-1.81z"
                  />
                </svg>
                Continue with Google
              </button>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span>Received a CII invite?</span>
                <Link
                  to="/activate-account"
                  className="font-medium text-emerald-700 dark:text-emerald-400 hover:underline"
                >
                  Activate Account
                </Link>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
