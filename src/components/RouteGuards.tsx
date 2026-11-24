import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { ShieldOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { CanonicalRole, getDashboardPathForRole } from '../types';

export function LoadingScreen({ message = 'Verifying session...' }: { message?: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
      <div className="space-y-3 text-center">
        <div className="w-8 h-8 border-2 border-slate-300 dark:border-slate-700 border-t-indigo-600 rounded-full animate-spin mx-auto" />
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{message}</p>
      </div>
    </div>
  );
}

export function RequireRole({
  allowed,
  children,
}: {
  allowed: CanonicalRole[];
  children: React.ReactNode;
}) {
  const {
    firebaseUser,
    profile,
    role,
    loading,
    needsEmailVerification,
    resendVerificationEmail,
    refreshVerification,
    logout,
  } = useAuth();
  const location = useLocation();
  const [verifyingMsg, setVerifyingMsg] = React.useState<string | null>(null);

  if (loading) {
    return <LoadingScreen />;
  }

  const isAdminRoute = location.pathname.startsWith('/admin');

  if (!firebaseUser) {
    const loginPath = isAdminRoute ? '/admin/login' : '/login';
    const redirectTarget = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`${loginPath}?redirect=${redirectTarget}`} replace />;
  }

  if (needsEmailVerification) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-6">
        <div className="max-w-md w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            Verify Your Email Address
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            A verification email was sent to <span className="font-medium">{firebaseUser.email}</span>. Click the verification link in your inbox, then select &ldquo;Refresh Status&rdquo;.
          </p>
          {verifyingMsg && (
            <p className="text-xs text-indigo-600 dark:text-indigo-400">{verifyingMsg}</p>
          )}
          <div className="flex flex-wrap items-center gap-2 pt-2">
            <button
              type="button"
              onClick={async () => {
                const ok = await refreshVerification();
                if (!ok) {
                  setVerifyingMsg('Email is not verified yet. Please check your inbox.');
                }
              }}
              className="px-4 py-2 rounded-lg bg-slate-900 dark:bg-indigo-600 text-white text-xs font-medium cursor-pointer"
            >
              Refresh Status
            </button>
            <button
              type="button"
              onClick={async () => {
                await resendVerificationEmail();
                setVerifyingMsg('Verification link re-sent.');
              }}
              className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 cursor-pointer"
            >
              Resend Email
            </button>
            <button
              type="button"
              onClick={logout}
              className="px-3 py-2 text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return <LoadingScreen message="Loading workspace profile..." />;
  }

  if (profile.status !== 'active') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-6">
        <div className="max-w-md w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4 text-center">
          <ShieldOff className="w-8 h-8 text-rose-600 dark:text-rose-400 mx-auto" />
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            Account {profile.status === 'suspended' ? 'Suspended' : 'Inactive'}
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Your CII Accountability Tracker account is currently {profile.status}. Contact an Administrator to restore access.
          </p>
          <button
            type="button"
            onClick={logout}
            className="px-4 py-2 rounded-lg bg-slate-900 dark:bg-indigo-600 text-white text-sm font-medium cursor-pointer"
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  if (!allowed.includes(role)) {
    const targetDashboard = getDashboardPathForRole(role);
    return <Navigate to={targetDashboard} replace />;
  }

  return <>{children}</>;
}
