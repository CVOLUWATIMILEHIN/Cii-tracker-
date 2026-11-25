import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Compass, Loader2, Lock, ShieldCheck, UserCircle } from 'lucide-react';
import { PlatformShell } from '../../components/PlatformShell';
import { useAuth } from '../../context/AuthContext';
import { usePlatform } from '../../context/PlatformContext';
import {
  ONBOARDING_PATH_LABELS,
  OnboardingPath,
  PROFILE_CATEGORY_LABELS,
  ProfileCategory,
} from '../../platformTypes';
import { savePlatformProfile } from '../../services/platformService';
import { ROLE_LABELS } from '../../types';

const inputClass =
  'w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500';
const labelClass = 'block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5';

export function PlatformSettingsPage() {
  const { profile, privateInfo, firebaseUser, role } = useAuth();
  const { workspace, goals, tasks, ensureWorkspace } = usePlatform();

  const [displayName, setDisplayName] = useState('');
  const [country, setCountry] = useState('');
  const [profileCategory, setProfileCategory] = useState<ProfileCategory | ''>('');
  const [onboardingPath, setOnboardingPath] = useState<OnboardingPath>('skipped');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;
    setDisplayName(profile.displayName);
    setCountry(profile.country || '');
    setProfileCategory(profile.profileCategory || '');
    setOnboardingPath(profile.onboardingPath || 'skipped');
  }, [profile?.uid, profile?.displayName, profile?.country, profile?.profileCategory, profile?.onboardingPath]);

  useEffect(() => {
    if (profile && !workspace) void ensureWorkspace();
  }, [profile?.uid, workspace, ensureWorkspace]);

  if (!profile) return null;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!displayName.trim()) {
      setError('Your full name cannot be empty.');
      return;
    }
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await savePlatformProfile({
        actor: profile,
        displayName: displayName.trim(),
        country,
        profileCategory,
        onboardingPath,
      });
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your settings.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <PlatformShell
      title="Settings"
      breadcrumb="Personal Workspace /"
      subtitle="Your profile, workspace and privacy controls."
    >
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
        <form
          onSubmit={handleSubmit}
          className="xl:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 sm:p-6 space-y-4"
        >
          <div className="flex items-center gap-2">
            <UserCircle className="w-4 h-4 text-violet-600 dark:text-violet-400" />
            <h1 className="text-base font-semibold text-slate-900 dark:text-white">Profile details</h1>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label htmlFor="settings-name" className={labelClass}>
                Full name
              </label>
              <input
                id="settings-name"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={100}
                className={inputClass}
                required
              />
            </div>
            <div>
              <label htmlFor="settings-email" className={labelClass}>
                Email
              </label>
              <input
                id="settings-email"
                type="email"
                value={privateInfo?.email || firebaseUser?.email || ''}
                readOnly
                className={`${inputClass} opacity-70 cursor-not-allowed`}
              />
            </div>
            <div>
              <label htmlFor="settings-country" className={labelClass}>
                Country
              </label>
              <input
                id="settings-country"
                type="text"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                maxLength={56}
                placeholder="e.g. Nigeria"
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="settings-category" className={labelClass}>
                Profile category
              </label>
              <select
                id="settings-category"
                value={profileCategory}
                onChange={(e) => setProfileCategory(e.target.value as ProfileCategory | '')}
                className={inputClass}
              >
                <option value="">Not set</option>
                {(Object.keys(PROFILE_CATEGORY_LABELS) as ProfileCategory[]).map((key) => (
                  <option key={key} value={key}>
                    {PROFILE_CATEGORY_LABELS[key]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="settings-onboarding" className={labelClass}>
                Onboarding entry point
              </label>
              <select
                id="settings-onboarding"
                value={onboardingPath}
                onChange={(e) => setOnboardingPath(e.target.value as OnboardingPath)}
                className={inputClass}
              >
                {(Object.keys(ONBOARDING_PATH_LABELS) as OnboardingPath[]).map((key) => (
                  <option key={key} value={key}>
                    {ONBOARDING_PATH_LABELS[key]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Profile categories are descriptors, not exclusive roles. Your workspace access is
            managed separately.
          </p>

          {error && (
            <p className="text-xs text-rose-600 dark:text-rose-400" role="alert">
              {error}
            </p>
          )}
          {saved && (
            <p className="inline-flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Profile saved.
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold cursor-pointer disabled:opacity-60"
            >
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Save profile
            </button>
            <Link
              to="/onboarding"
              className="px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
            >
              Re-run guided setup
            </Link>
          </div>
        </form>

        <aside className="space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-2">
            <div className="flex items-center gap-2">
              <Compass className="w-4 h-4 text-violet-600 dark:text-violet-400" />
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Workspace</h2>
            </div>
            <dl className="text-xs space-y-1.5">
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500 dark:text-slate-400">Name</dt>
                <dd className="font-medium text-slate-900 dark:text-white text-right truncate">
                  {workspace?.name || 'Preparing...'}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500 dark:text-slate-400">Type</dt>
                <dd className="font-medium text-slate-900 dark:text-white">Individual</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500 dark:text-slate-400">Goals</dt>
                <dd className="font-mono tabular-nums text-slate-900 dark:text-white">{goals.length}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500 dark:text-slate-400">Tasks</dt>
                <dd className="font-mono tabular-nums text-slate-900 dark:text-white">{tasks.length}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500 dark:text-slate-400">Programme role</dt>
                <dd className="font-medium text-slate-900 dark:text-white">{ROLE_LABELS[role]}</dd>
              </div>
            </dl>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-2">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-violet-600 dark:text-violet-400" />
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Privacy</h2>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Personal goals, milestones and tasks are readable only by you. Programme
              administrators and accountability partners cannot access them through the CII
              console.
            </p>
            <Link
              to="/profile"
              className="inline-flex items-center gap-1 text-xs font-medium text-violet-600 dark:text-violet-400 hover:underline"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              Open programme account profile
            </Link>
          </div>

          <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-700 p-4">
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
              Subscription plans and entitlements are not active yet. Every Phase 1 feature is
              available without payment so the foundation can be tested honestly.
            </p>
          </div>
        </aside>
      </div>
    </PlatformShell>
  );
}
