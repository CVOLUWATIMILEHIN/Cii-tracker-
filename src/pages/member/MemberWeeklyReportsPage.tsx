import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Send, Save } from 'lucide-react';
import { AppShell } from '../../components/AppShell';
import { ReportStatusLabel } from '../../components/StatusText';
import { useAuth } from '../../context/AuthContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { formatTimestamp } from '../../lib/exportReports';
import { getIsoWeekInfo } from '../../lib/validators';
import { saveWeeklyReport } from '../../services/ciiService';

export function MemberWeeklyReportsPage() {
  const { profile } = useAuth();
  const { reports } = useWorkspace();
  const { weekKey, weekLabel } = getIsoWeekInfo();

  const currentReport = reports.find((r) => r.weekKey === weekKey) || null;
  const canEditCurrent =
    !currentReport ||
    currentReport.status === 'draft' ||
    currentReport.status === 'revision_requested';

  const [achievements, setAchievements] = useState('');
  const [challenges, setChallenges] = useState('');
  const [learnings, setLearnings] = useState('');
  const [nextWeekPriorities, setNextWeekPriorities] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (currentReport) {
      setAchievements(currentReport.achievements);
      setChallenges(currentReport.challenges);
      setLearnings(currentReport.learnings);
      setNextWeekPriorities(currentReport.nextWeekPriorities);
    }
  }, [currentReport]);

  if (!profile) return null;

  const handleAction = async (submitNow: boolean) => {
    setError(null);
    setMessage(null);
    if (submitNow && (!achievements.trim() || !nextWeekPriorities.trim())) {
      setError('Please complete Achievements and Next Week Priorities before submitting.');
      return;
    }
    setSaving(true);
    try {
      await saveWeeklyReport({
        actor: profile,
        existing: currentReport,
        achievements,
        challenges,
        learnings,
        nextWeekPriorities,
        submitNow,
      });
      setMessage(submitNow ? 'Weekly report submitted.' : 'Weekly report draft saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save weekly report.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell title="Weekly Accountability Reports" breadcrumb="Corps Member /">
      <div className="space-y-6">
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <p className="text-xs font-mono text-emerald-700 dark:text-emerald-400">
                Current Period: {weekLabel} ({weekKey})
              </p>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                Weekly Accountability Reflection
              </h2>
            </div>
            {currentReport && (
              <div className="text-xs">
                Status: <ReportStatusLabel status={currentReport.status} />
              </div>
            )}
          </div>

          {currentReport?.feedbackText && (
            <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs space-y-1">
              <p className="font-semibold text-amber-800 dark:text-amber-300">
                Feedback from {currentReport.reviewedByName || 'Reviewer'}
              </p>
              <p className="text-amber-900 dark:text-amber-100">{currentReport.feedbackText}</p>
            </div>
          )}

          {error && (
            <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300">
              {error}
            </div>
          )}

          {message && (
            <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-700 dark:text-emerald-300">
              {message}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Key Achievements This Week
              </label>
              <textarea
                rows={4}
                disabled={!canEditCurrent}
                maxLength={1500}
                value={achievements}
                onChange={(e) => setAchievements(e.target.value)}
                placeholder="List completed milestones, outreach outcomes, and deliverables..."
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 disabled:opacity-60"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Challenges & Blockers
              </label>
              <textarea
                rows={4}
                disabled={!canEditCurrent}
                maxLength={1500}
                value={challenges}
                onChange={(e) => setChallenges(e.target.value)}
                placeholder="Describe any obstacles or support needed from your Partner or CII..."
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 disabled:opacity-60"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Key Learnings & Insights
              </label>
              <textarea
                rows={4}
                disabled={!canEditCurrent}
                maxLength={1500}
                value={learnings}
                onChange={(e) => setLearnings(e.target.value)}
                placeholder="What lessons did you take away from your community work this week?"
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 disabled:opacity-60"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Priorities for Next Week
              </label>
              <textarea
                rows={4}
                disabled={!canEditCurrent}
                maxLength={1500}
                value={nextWeekPriorities}
                onChange={(e) => setNextWeekPriorities(e.target.value)}
                placeholder="Commit to your top 2–3 measurable priorities for next week..."
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 disabled:opacity-60"
              />
            </div>
          </div>

          {canEditCurrent && (
            <div className="flex flex-wrap items-center justify-end gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                disabled={saving}
                onClick={() => handleAction(false)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                Save Draft
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => handleAction(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-900 dark:bg-emerald-600 hover:bg-slate-800 dark:hover:bg-emerald-500 text-white text-sm font-medium cursor-pointer"
              >
                <Send className="w-4 h-4" />
                {currentReport?.status === 'revision_requested' ? 'Resubmit Report' : 'Submit Weekly Report'}
              </button>
            </div>
          )}
        </section>

        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                Report History
              </h3>
            </div>
            <span className="text-xs font-mono tabular-nums text-slate-400">
              {reports.length} reports
            </span>
          </div>

          {reports.length === 0 ? (
            <p className="p-8 text-center text-xs text-slate-500 dark:text-slate-400">
              No weekly reports saved yet.
            </p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {reports.map((rep) => (
                <div
                  key={rep.id}
                  className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-mono font-semibold text-slate-900 dark:text-white">
                        {rep.weekLabel}
                      </span>
                      <span aria-hidden="true">·</span>
                      <ReportStatusLabel status={rep.status} />
                      <span aria-hidden="true">·</span>
                      <span className="text-slate-400 font-mono">
                        {formatTimestamp(rep.updatedAt)}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300 truncate">
                      {rep.achievements || 'Draft in progress'}
                    </p>
                  </div>
                  <Link
                    to={`/community/cii/weekly-reports/${rep.id}`}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap self-start sm:self-auto"
                  >
                    Open Report
                  </Link>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
