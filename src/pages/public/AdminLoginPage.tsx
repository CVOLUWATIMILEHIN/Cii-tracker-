import React, { useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ShieldCheck, ShieldOff } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getSafeInternalRedirect } from '../../lib/validators';
import { getDashboardPathForRole, isAdminPortalRole } from '../../types';

export function AdminLoginPage() {
  const {
    firebaseUser,
    profile,
    role,
    loading,
    needsEmailVerification,
    authError,
    signInWithEmail,
    signInWithGoogle,
    logout,
  } = useAuth();
  const [searchParams] = useSearchParams();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const candidateRedirect = getSafeInternalRedirect(
    searchParams.get('redirect'),
    '/admin',
    '/admin'
  );
  const safeAdminRedirect =
    candidateRedirect === '/admin/login' ? '/admin' : candidateRedirect;

  if (!loading && firebaseUser && needsEmailVerification) {
    return <Navigate to="/admin" replace />;
  }

  if (!loading && firebaseUser && profile && !needsEmailVerification) {
    if (profile.status !== 'active') {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-6">
          <div className="max-w-md w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4 text-center">
            <ShieldOff className="w-8 h-8 text-rose-600 dark:text-rose-400 mx-auto" />
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              Account {profile.status === 'suspended' ? 'Suspended' : 'Deactivated'}
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Your administrative account is currently {profile.status}. Contact a Super Admin to restore access.
            </p>
            <button
              type="button"
              onClick={logout}
              className="px-4 py-2 rounded-lg bg-slate-900 dark:bg-emerald-600 text-white text-sm font-medium cursor-pointer"
            >
              Sign Out
            </button>
          </div>
        </div>
      );
    }

    if (isAdminPortalRole(role)) {
      return <Navigate to={safeAdminRedirect} replace />;
    }

    return <Navigate to={getDashboardPathForRole(role)} replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    setSubmitting(true);
    try {
      await signInWithEmail(email, password);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Sign-in failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-6">
      <div className="max-w-md w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 sm:p-8 space-y-5">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 dark:hover:text-white"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to CII Tracker
        </Link>

        <div className="space-y-1.5">
          <div className="w-10 h-10 rounded-lg bg-slate-900 dark:bg-emerald-600 text-white flex items-center justify-center">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white pt-2">
            Administrator Portal Sign-In
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Restricted to authorized CII Programme Administrators. Destination:{' '}
            <span className="font-mono">{safeAdminRedirect}</span>
          </p>
        </div>

        {(localError || authError) && (
          <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300">
            {localError || authError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Administrator Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 px-4 rounded-lg bg-slate-900 dark:bg-emerald-600 text-white text-sm font-medium hover:bg-slate-800 dark:hover:bg-emerald-500 disabled:opacity-60 cursor-pointer"
          >
            {submitting ? 'Authenticating...' : 'Sign In as Administrator'}
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
          className="w-full py-2.5 px-4 rounded-lg border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
        >
          Sign In with Verified Google Account
        </button>
      </div>
    </div>
  );
}
