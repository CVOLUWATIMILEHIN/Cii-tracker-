import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Save, Send } from 'lucide-react';
import { AppShell } from '../../components/AppShell';
import { ReportStatusLabel } from '../../components/StatusText';
import { useAuth } from '../../context/AuthContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { formatTimestamp } from '../../lib/exportReports';
import { saveWeeklyReport } from '../../services/ciiService';

export function MemberWeeklyReportDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { profile } = useAuth();
  const { reports } = useWorkspace();

  const report = reports.find((r) => r.id === id) || null;
  const canEdit =
    report && (report.status === 'draft' || report.status === 'revision_requested');

  const [achievements, setAchievements] = useState('');
  const [challenges, setChallenges] = useState('');
  const [learnings, setLearnings] = useState('');
  const [nextWeekPriorities, setNextWeekPriorities] = useState('');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (report) {
      setAchievements(report.achievements);
      setChallenges(report.challenges);
      setLearnings(report.learnings);
      setNextWeekPriorities(report.nextWeekPriorities);
    }
  }, [report]);

  if (!profile) return null;

  if (!report) {
    return (
      <AppShell title="Report Not Found" breadcrumb="Weekly Reports /">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-8 text-center space-y-3">
          <p className="text-sm font-medium">Weekly report not found.</p>
          <Link
            to="/community/cii/weekly-reports"
            className="inline-block px-4 py-2 rounded-lg bg-slate-900 dark:bg-emerald-600 text-white text-xs font-medium"
          >
            Back to Weekly Reports
          </Link>
        </div>
      </AppShell>
    );
  }

  const handleSave = async (submitNow: boolean) => {
    setError(null);
    setNotice(null);
    if (submitNow && (!achievements.trim() || !nextWeekPriorities.trim())) {
      setError('Please complete Achievements and Next Week Priorities before submitting.');
      return;
    }
    setSaving(true);
    try {
      await saveWeeklyReport({
        actor: profile,
        existing: report,
        achievements,
        challenges,
        learnings,
        nextWeekPriorities,
        submitNow,
      });
      setNotice(submitNow ? 'Report submitted.' : 'Draft updated.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save weekly report.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell title={`Weekly Report · ${report.weekLabel}`} breadcrumb="Weekly Reports /">
      <div className="max-w-3xl mx-auto space-y-5">
        <Link
          to="/community/cii/weekly-reports"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 dark:hover:text-white"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Weekly Reports
        </Link>

        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span className="font-mono font-semibold text-slate-900 dark:text-white">
              {report.weekLabel} ({report.weekKey})
            </span>
            <div className="flex items-center gap-3">
              <ReportStatusLabel status={report.status} />
              <span className="font-mono">{formatTimestamp(report.updatedAt)}</span>
            </div>
          </div>

          {report.feedbackText && (
            <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs space-y-1">
              <p className="font-semibold text-amber-800 dark:text-amber-300">
                Reviewer Feedback · {report.reviewedByName || 'Reviewer'}
              </p>
              <p className="text-amber-900 dark:text-amber-100">{report.feedbackText}</p>
            </div>
          )}

          {error && (
            <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300">
              {error}
            </div>
          )}

          {notice && (
            <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">{notice}</p>
          )}

          <div className="space-y-4">
            {[
              { label: 'Achievements', value: achievements, setter: setAchievements },
              { label: 'Challenges', value: challenges, setter: setChallenges },
              { label: 'Learnings', value: learnings, setter: setLearnings },
              { label: 'Next Week Priorities', value: nextWeekPriorities, setter: setNextWeekPriorities },
            ].map((field) => (
              <div key={field.label}>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {field.label}
                </label>
                <textarea
                  rows={3}
                  disabled={!canEdit}
                  maxLength={1500}
                  value={field.value}
                  onChange={(e) => field.setter(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 disabled:opacity-70"
                />
              </div>
            ))}
          </div>

          {canEdit && (
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                disabled={saving}
                onClick={() => handleSave(false)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                Save Draft
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => handleSave(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-900 dark:bg-emerald-600 text-white text-xs font-medium cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                Submit Report
              </button>
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
