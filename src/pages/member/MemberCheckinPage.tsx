import React, { useEffect, useState } from 'react';
import { CalendarCheck, CheckCircle2 } from 'lucide-react';
import { AppShell } from '../../components/AppShell';
import { CheckinStatusLabel } from '../../components/StatusText';
import { useAuth } from '../../context/AuthContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { formatTimestamp } from '../../lib/exportReports';
import { getTodayDateKey } from '../../lib/validators';
import { submitDailyCheckin } from '../../services/ciiService';
import { CHECKIN_STATUS_LABELS, CheckinStatus } from '../../types';

export function MemberCheckinPage() {
  const { profile } = useAuth();
  const { checkins } = useWorkspace();
  const todayKey = getTodayDateKey();
  const todayExisting = checkins.find((c) => c.checkinDate === todayKey) || null;

  const [status, setStatus] = useState<CheckinStatus>('on_track');
  const [updateText, setUpdateText] = useState('');
  const [followUpRequested, setFollowUpRequested] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (todayExisting) {
      setStatus(todayExisting.status);
      setUpdateText(todayExisting.updateText);
      setFollowUpRequested(todayExisting.followUpRequested);
    }
  }, [todayExisting]);

  if (!profile) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setFeedback(null);
    setSaving(true);
    try {
      await submitDailyCheckin({
        actor: profile,
        existing: todayExisting,
        status,
        updateText,
        followUpRequested,
      });
      setFeedback(
        todayExisting
          ? `Updated your check-in for ${todayKey}.`
          : `Daily check-in recorded for ${todayKey}.`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save daily check-in.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell title="Daily Check-In" breadcrumb="Corps Member /">
      <div className="max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6">
        <section className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-mono text-emerald-700 dark:text-emerald-400">
                Period: {todayKey}
              </p>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                {todayExisting ? 'Update Today\u2019s Check-In' : 'Submit Daily Check-In'}
              </h2>
            </div>
            {todayExisting && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-4 h-4" />
                Logged Today
              </span>
            )}
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400">
            One check-in is stored per day ({todayKey}) to prevent duplicate entries. You can edit today&rsquo;s status below if your situation changes.
          </p>

          {error && (
            <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300">
              {error}
            </div>
          )}

          {feedback && (
            <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-700 dark:text-emerald-300">
              {feedback}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Current Status
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['on_track', 'need_support', 'blocked'] as CheckinStatus[]).map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setStatus(option)}
                    className={`py-2.5 px-3 rounded-lg border text-xs font-semibold transition-colors cursor-pointer ${
                      status === option
                        ? option === 'on_track'
                          ? 'bg-emerald-600 border-emerald-600 text-white'
                          : option === 'need_support'
                            ? 'bg-amber-600 border-amber-600 text-white'
                            : 'bg-rose-600 border-rose-600 text-white'
                        : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    {CHECKIN_STATUS_LABELS[option]}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Short Written Update
              </label>
              <textarea
                rows={4}
                maxLength={600}
                value={updateText}
                onChange={(e) => setUpdateText(e.target.value)}
                placeholder="Share what you worked on today, wins, or any blockers..."
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
              />
            </div>

            <label className="flex items-center gap-2.5 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={followUpRequested}
                onChange={(e) => setFollowUpRequested(e.target.checked)}
                className="rounded border-slate-300 accent-emerald-600"
              />
              <span>Request a follow-up from my Accountability Partner</span>
            </label>

            <button
              type="submit"
              disabled={saving}
              className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-slate-900 dark:bg-emerald-600 hover:bg-slate-800 dark:hover:bg-emerald-500 text-white text-sm font-medium disabled:opacity-60 cursor-pointer"
            >
              <CalendarCheck className="w-4 h-4" />
              {saving
                ? 'Saving Check-In...'
                : todayExisting
                  ? 'Update Today\u2019s Check-In'
                  : 'Submit Daily Check-In'}
            </button>
          </form>
        </section>

        <section className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">
              Check-In History
            </h3>
            <span className="text-xs font-mono tabular-nums text-slate-400">
              {checkins.length} days
            </span>
          </div>

          {checkins.length === 0 ? (
            <p className="text-xs text-slate-500 dark:text-slate-400 py-8 text-center">
              No daily check-ins submitted yet.
            </p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[460px] overflow-y-auto pr-1">
              {checkins.map((c) => (
                <div key={c.id} className="py-3 first:pt-0 last:pb-0 space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono tabular-nums font-medium text-slate-800 dark:text-slate-200">
                      {c.checkinDate}
                    </span>
                    <CheckinStatusLabel status={c.status} />
                  </div>
                  {c.updateText && (
                    <p className="text-xs text-slate-600 dark:text-slate-300">{c.updateText}</p>
                  )}
                  <p className="text-[11px] text-slate-400">
                    {c.followUpRequested ? 'Follow-up requested · ' : ''}
                    {formatTimestamp(c.updatedAt)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
