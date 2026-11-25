import React, { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  BriefcaseBusiness,
  CheckCircle2,
  Compass,
  GraduationCap,
  Loader2,
  ShieldCheck,
  Sparkles,
  Target,
  Users,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { usePlatform } from '../../context/PlatformContext';
import {
  OnboardingPath,
  PROFILE_CATEGORY_LABELS,
  ProfileCategory,
} from '../../platformTypes';
import { savePlatformProfile } from '../../services/platformService';

const PATHS: {
  value: OnboardingPath;
  title: string;
  description: string;
  icon: typeof Target;
  note: string;
}[] = [
  {
    value: 'know_goal',
    title: 'I know what I want to achieve',
    description: 'Set up a goal with a clear horizon, milestones and daily actions.',
    icon: Target,
    note: 'Available now',
  },
  {
    value: 'need_clarity',
    title: 'I need help finding clarity',
    description: 'Start with a rough goal draft, then refine it as support tools arrive.',
    icon: Compass,
    note: 'Goal drafting now · SMT guidance in Phase 4',
  },
  {
    value: 'join_community',
    title: 'I am joining a community or programme',
    description: 'Use your programme workspace alongside your private personal workspace.',
    icon: Users,
    note: 'CII community workspace is live',
  },
  {
    value: 'coach',
    title: 'I am a coach or mentor',
    description: 'Your personal workspace is ready now; client and session tools follow.',
    icon: GraduationCap,
    note: 'Coach workspace arrives in Phase 3',
  },
  {
    value: 'business',
    title: 'I am a business owner',
    description: 'Plan personal goals first; the dedicated business workspace follows.',
    icon: BriefcaseBusiness,
    note: 'Business workspace arrives in Phase 3',
  },
];

const inputClass =
  'w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500';
const labelClass = 'block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5';

export function OnboardingPage() {
  const { firebaseUser, profile, role } = useAuth();
  const { ensureWorkspace } = usePlatform();
  const navigate = useNavigate();

  const [step, setStep] = useState<'path' | 'details'>('path');
  const [path, setPath] = useState<OnboardingPath | null>(null);
  const [displayName, setDisplayName] = useState(profile?.displayName || '');
  const [country, setCountry] = useState(profile?.country || '');
  const [profileCategory, setProfileCategory] = useState<ProfileCategory | ''>(
    profile?.profileCategory || ''
  );
  const [phone, setPhone] = useState(profile?.phone || '');
  const [consent, setConsent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!profile) return null;
  if (!firebaseUser) return <Navigate to="/login" replace />;

  const finish = async (chosenPath: OnboardingPath) => {
    if (!displayName.trim()) {
      setError('Enter your full name.');
      return;
    }
    if (chosenPath !== 'skipped' && !profileCategory) {
      setError('Select the profile category that best describes you.');
      return;
    }
    if (chosenPath !== 'skipped' && !consent) {
      setError('Please accept the data privacy terms to continue.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await savePlatformProfile({
        actor: profile,
        displayName: displayName.trim(),
        country,
        profileCategory,
        onboardingPath: chosenPath,
        phone: chosenPath === 'join_community' ? phone : undefined,
      });
      await ensureWorkspace();

      if (chosenPath === 'know_goal' || chosenPath === 'need_clarity') {
        navigate('/goals?new=1', { replace: true });
      } else if (chosenPath === 'join_community' && role === 'member') {
        navigate('/community/cii', { replace: true });
      } else {
        navigate('/dashboard', { replace: true });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your onboarding details.');
    } finally {
      setSaving(false);
    }
  };

  const handleDetailsSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (path) void finish(path);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <header className="h-16 border-b border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md">
        <div className="max-w-5xl mx-auto h-full px-4 sm:px-6 flex items-center justify-between gap-4">
          <Link to="/dashboard" className="flex items-center gap-2.5 min-w-0">
            <span className="w-8 h-8 rounded-lg bg-violet-600 text-white flex items-center justify-center shrink-0">
              <Compass className="w-5 h-5" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-bold text-slate-900 dark:text-white font-display leading-tight">
                From Intention to Execution
              </span>
              <span className="block text-[11px] text-violet-600 dark:text-violet-400 leading-tight">
                SMT – Your Companion · Setup
              </span>
            </span>
          </Link>
          <Link
            to="/dashboard"
            className="text-xs font-medium text-slate-500 hover:text-slate-900 dark:hover:text-white whitespace-nowrap"
          >
            Go to dashboard
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-8">
        <div className="space-y-2">
          <p className="text-xs font-semibold text-violet-600 dark:text-violet-400 uppercase tracking-wide">
            Step {step === 'path' ? '1 of 2' : '2 of 2'}
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold font-display">
            {step === 'path' ? 'What brings you here today?' : 'A few details to personalise your workspace'}
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-300 max-w-2xl leading-relaxed">
            {step === 'path'
              ? 'Choose the entry point that fits you best. This only shapes your starting suggestions — you can use every available part of your workspace regardless.'
              : 'Progressive onboarding: share only what you are comfortable with. You can change these details later in Settings.'}
          </p>
        </div>

        {step === 'path' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {PATHS.map((option) => {
              const Icon = option.icon;
              const selected = path === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    setPath(option.value);
                    setStep('details');
                    setError(null);
                  }}
                  className={`text-left rounded-xl border p-5 bg-white dark:bg-slate-900 transition-colors cursor-pointer ${
                    selected
                      ? 'border-violet-500 ring-2 ring-violet-500/20'
                      : 'border-slate-200 dark:border-slate-800 hover:border-violet-300 dark:hover:border-violet-700'
                  }`}
                >
                  <span className="flex items-start gap-3">
                    <span className="w-9 h-9 rounded-lg bg-violet-50 dark:bg-violet-950/50 text-violet-600 dark:text-violet-300 flex items-center justify-center shrink-0">
                      <Icon className="w-5 h-5" />
                    </span>
                    <span className="min-w-0 space-y-1">
                      <span className="block text-sm font-semibold text-slate-900 dark:text-white">
                        {option.title}
                      </span>
                      <span className="block text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                        {option.description}
                      </span>
                      <span className="inline-flex items-center gap-1 pt-1 text-[11px] font-medium text-amber-700 dark:text-amber-400">
                        <Sparkles className="w-3 h-3" />
                        {option.note}
                      </span>
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <form onSubmit={handleDetailsSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 sm:p-6 space-y-4">
              <button
                type="button"
                onClick={() => setStep('path')}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Change entry point
              </button>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label htmlFor="onboard-name" className={labelClass}>
                    Full name
                  </label>
                  <input
                    id="onboard-name"
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    maxLength={100}
                    className={inputClass}
                    required
                  />
                </div>
                <div>
                  <label htmlFor="onboard-email" className={labelClass}>
                    Email
                  </label>
                  <input
                    id="onboard-email"
                    type="email"
                    value={firebaseUser.email || ''}
                    readOnly
                    className={`${inputClass} opacity-70 cursor-not-allowed`}
                  />
                </div>
                <div>
                  <label htmlFor="onboard-country" className={labelClass}>
                    Country
                  </label>
                  <input
                    id="onboard-country"
                    type="text"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    maxLength={56}
                    placeholder="e.g. Nigeria"
                    className={inputClass}
                  />
                </div>
                <div className={path === 'join_community' ? '' : 'sm:col-span-2'}>
                  <label htmlFor="onboard-category" className={labelClass}>
                    Profile category
                  </label>
                  <select
                    id="onboard-category"
                    value={profileCategory}
                    onChange={(e) => setProfileCategory(e.target.value as ProfileCategory | '')}
                    className={inputClass}
                    required
                  >
                    <option value="">Select one</option>
                    {(Object.keys(PROFILE_CATEGORY_LABELS) as ProfileCategory[]).map((key) => (
                      <option key={key} value={key}>
                        {PROFILE_CATEGORY_LABELS[key]}
                      </option>
                    ))}
                  </select>
                </div>
                {path === 'join_community' && (
                  <div>
                    <label htmlFor="onboard-phone" className={labelClass}>
                      Phone (programme contact)
                    </label>
                    <input
                      id="onboard-phone"
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      maxLength={32}
                      className={inputClass}
                    />
                  </div>
                )}
              </div>

              <label className="flex items-start gap-2.5 rounded-lg border border-slate-200 dark:border-slate-700 p-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
                />
                <span className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  I understand that my personal workspace is private by default. Programme
                  administrators and accountability partners will not see my personal goals,
                  journals or notes unless I explicitly share them.
                </span>
              </label>

              {error && (
                <p className="text-xs text-rose-600 dark:text-rose-400" role="alert">
                  {error}
                </p>
              )}

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold cursor-pointer disabled:opacity-60"
                >
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                  Finish setup
                </button>
                <button
                  type="button"
                  onClick={() => void finish('skipped')}
                  disabled={saving}
                  className="px-3 py-2 text-xs text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer disabled:opacity-50"
                >
                  Skip for now
                </button>
              </div>
            </div>

            <aside className="space-y-4">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-2">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                  <h2 className="text-sm font-semibold">Privacy by default</h2>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  Your personal data stays separate from CII programme records. Sharing with an
                  accountability partner is opt-in and controlled by you.
                </p>
              </div>
              <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 rounded-xl p-5 space-y-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-700 dark:text-amber-400" />
                  <h2 className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                    What works today
                  </h2>
                </div>
                <ul className="text-xs text-amber-900/80 dark:text-amber-200/80 space-y-1 leading-relaxed">
                  <li>Personal goals with milestones</li>
                  <li>Execution planner tasks with due dates and priorities</li>
                  <li>CII community workspace for enrolled members</li>
                </ul>
              </div>
            </aside>
          </form>
        )}
      </main>
    </div>
  );
}
