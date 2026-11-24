import React, { useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, KeyRound } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getDashboardPathForRole } from '../../types';

export function ActivateAccountPage() {
  const {
    firebaseUser,
    profile,
    role,
    needsEmailVerification,
    authError,
    activateWithEmail,
    signInWithGoogle,
    resendVerificationEmail,
    refreshVerification,
  } = useAuth();
  const [searchParams] = useSearchParams();

  const [email, setEmail] = useState(searchParams.get('email') || '');
  const [inviteCode, setInviteCode] = useState(searchParams.get('code') || '');
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  if (firebaseUser && profile && !needsEmailVerification) {
    return <Navigate to={getDashboardPathForRole(role)} replace />;
  }

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      await activateWithEmail({
        email,
        password,
        displayName: displayName || email.split('@')[0],
        phone,
        inviteCode: inviteCode.trim() || undefined,
      });
      setInfo('Verification email sent. Please verify your email address to complete activation.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Activation failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-6">
      <div className="max-w-md w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 sm:p-8 space-y-5">
        <Link
          to="/login"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 dark:hover:text-white"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Sign In
        </Link>

        <div className="space-y-1">
          <div className="w-10 h-10 rounded-lg bg-emerald-600 text-white flex items-center justify-center">
            <KeyRound className="w-5 h-5" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white pt-2">
            Activate Your CII Account
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Enter your invitation code (if provided by CII Admin) and set your password to activate access.
          </p>
        </div>

        {(error || authError) && (
          <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300">
            {error || authError}
          </div>
        )}

        {needsEmailVerification ? (
          <div className="p-4 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-emerald-800 dark:text-emerald-300">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Verification Email Sent</span>
            </div>
            <p className="text-xs text-emerald-700 dark:text-emerald-300">
              Click the verification link sent to <span className="font-medium">{firebaseUser?.email}</span>, then click below to enter your dashboard.
            </p>
            {info && <p className="text-xs text-slate-600 dark:text-slate-300">{info}</p>}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={async () => {
                  const ok = await refreshVerification();
                  if (!ok) setInfo('Still waiting for email verification confirmation.');
                }}
                className="px-3.5 py-2 rounded-lg bg-emerald-600 text-white text-xs font-medium cursor-pointer"
              >
                I Verified My Email
              </button>
              <button
                type="button"
                onClick={async () => {
                  await resendVerificationEmail();
                  setInfo('Verification email resent.');
                }}
                className="px-3.5 py-2 rounded-lg border border-emerald-300 dark:border-emerald-700 text-xs font-medium text-emerald-800 dark:text-emerald-200 cursor-pointer"
              >
                Resend
              </button>
            </div>
          </div>
        ) : (
          <>
            <form onSubmit={handleActivate} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Invitation Code
                </label>
                <input
                  type="text"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                  placeholder="e.g., CII-AB12-CD34"
                  className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your full name"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Phone (Optional)
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+234..."
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Create Password
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Confirm Password
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 px-4 rounded-lg bg-slate-900 dark:bg-emerald-600 text-white text-sm font-medium hover:bg-slate-800 dark:hover:bg-emerald-500 disabled:opacity-60 cursor-pointer"
              >
                {submitting ? 'Activating Account...' : 'Activate with Email & Password'}
              </button>
            </form>

            <button
              type="button"
              onClick={() => signInWithGoogle(inviteCode.trim() || undefined)}
              className="w-full py-2.5 px-4 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
            >
              Or Activate Instantly with Google (Matches Invite Email)
            </button>
          </>
        )}
      </div>
    </div>
  );
}
