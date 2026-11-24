import { useState } from 'react';
import { ExternalLink, Info } from 'lucide-react';
import { AppShell } from '../../components/AppShell';
import { ReportStatusLabel, SubmissionStatusLabel } from '../../components/StatusText';
import { useAuth } from '../../context/AuthContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { getSafeExternalUrl } from '../../lib/validators';
import { reviewActivitySubmission, reviewWeeklyReport } from '../../services/ciiService';
import { ActivitySubmission, WeeklyReport } from '../../types';

export function PartnerReviewsPage() {
  const { profile } = useAuth();
  const { submissions, reports, settings } = useWorkspace();

  const [tab, setTab] = useState<'submissions' | 'reports'>('submissions');
  const [feedbackDrafts, setFeedbackDrafts] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canApprove = settings?.partnerCanApproveReports === true;

  if (!profile) return null;

  const pendingSubmissions = submissions.filter((s) => s.status !== 'in_progress');
  const pendingReports = reports.filter((r) => r.status !== 'draft');

  const handleReviewSub = async (
    sub: ActivitySubmission,
    status: 'under_review' | 'revision_requested' | 'approved'
  ) => {
    setBusyId(sub.id);
    setNotice(null);
    setError(null);
    try {
      await reviewActivitySubmission({
        actor: profile,
        submission: sub,
        status,
        feedbackText: feedbackDrafts[sub.id] ?? sub.feedbackText,
      });
      setNotice(`Updated "${sub.activityTitle}" for ${sub.memberName}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to submit review.');
    } finally {
      setBusyId(null);
    }
  };

  const handleReviewReport = async (
    rep: WeeklyReport,
    status: 'under_review' | 'revision_requested' | 'reviewed'
  ) => {
    setBusyId(rep.id);
    setNotice(null);
    setError(null);
    try {
      await reviewWeeklyReport({
        actor: profile,
        report: rep,
        status,
        feedbackText: feedbackDrafts[rep.id] ?? rep.feedbackText,
      });
      setNotice(`Updated ${rep.weekLabel} report for ${rep.memberName}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to submit report review.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <AppShell title="Submissions & Report Reviews" breadcrumb="Partner /">
      <div className="space-y-5">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg self-start">
            <button
              type="button"
              onClick={() => setTab('submissions')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer whitespace-nowrap ${
                tab === 'submissions'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Activity Submissions ({pendingSubmissions.length})
            </button>
            <button
              type="button"
              onClick={() => setTab('reports')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer whitespace-nowrap ${
                tab === 'reports'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Weekly Reports ({pendingReports.length})
            </button>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <Info className="w-3.5 h-3.5 shrink-0" />
            <span>
              {canApprove
                ? 'Formal approval enabled by CII policy.'
                : 'Formal approval restricted to Admins (you can mark Under Review or Request Revision).'}
            </span>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300">
            {error}
          </div>
        )}

        {notice && (
          <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-700 dark:text-emerald-300">
            {notice}
          </div>
        )}

        {tab === 'submissions' ? (
          pendingSubmissions.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-10 text-center text-xs text-slate-500">
              No submitted activities from your assigned members yet.
            </div>
          ) : (
            <div className="space-y-4">
              {pendingSubmissions.map((sub) => {
                const draft = feedbackDrafts[sub.id] ?? sub.feedbackText;
                const locked = sub.status === 'approved';
                return (
                  <article
                    key={sub.id}
                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div>
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">
                          {sub.activityTitle}
                        </p>
                        <p className="text-slate-500">
                          {sub.memberName} · Progress: <span className="font-mono">{sub.progress}%</span>
                        </p>
                      </div>
                      <SubmissionStatusLabel status={sub.status} />
                    </div>

                    <p className="text-sm text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-950 p-3 rounded-lg">
                      {sub.responseText || 'No response text provided.'}
                    </p>

                    {getSafeExternalUrl(sub.evidenceUrl) && (
                      <a
                        href={getSafeExternalUrl(sub.evidenceUrl) || '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400 hover:underline"
                      >
                        <span>Evidence: {sub.evidenceName || 'View Attachment'}</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}

                    {!locked && (
                      <div className="space-y-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                        <textarea
                          rows={2}
                          value={draft}
                          onChange={(e) =>
                            setFeedbackDrafts((prev) => ({ ...prev, [sub.id]: e.target.value }))
                          }
                          placeholder="Enter constructive review feedback..."
                          className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
                        />
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          <button
                            type="button"
                            disabled={busyId === sub.id}
                            onClick={() => handleReviewSub(sub, 'under_review')}
                            className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium cursor-pointer"
                          >
                            Mark Under Review
                          </button>
                          <button
                            type="button"
                            disabled={busyId === sub.id}
                            onClick={() => handleReviewSub(sub, 'revision_requested')}
                            className="px-3 py-1.5 rounded-lg border border-rose-300 dark:border-rose-800 text-rose-600 dark:text-rose-400 text-xs font-medium cursor-pointer"
                          >
                            Request Revision
                          </button>
                          {canApprove && (
                            <button
                              type="button"
                              disabled={busyId === sub.id}
                              onClick={() => handleReviewSub(sub, 'approved')}
                              className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-medium cursor-pointer"
                            >
                              Approve
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )
        ) : pendingReports.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-10 text-center text-xs text-slate-500">
            No weekly reports submitted by your assigned members yet.
          </div>
        ) : (
          <div className="space-y-4">
            {pendingReports.map((rep) => {
              const draft = feedbackDrafts[rep.id] ?? rep.feedbackText;
              const locked = rep.status === 'reviewed';
              return (
                <article
                  key={rep.id}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">
                        {rep.memberName} · {rep.weekLabel}
                      </p>
                      <p className="font-mono text-slate-400">{rep.weekKey}</p>
                    </div>
                    <ReportStatusLabel status={rep.status} />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-lg">
                      <p className="font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Achievements
                      </p>
                      <p className="text-slate-600 dark:text-slate-300">{rep.achievements || '—'}</p>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-lg">
                      <p className="font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Challenges
                      </p>
                      <p className="text-slate-600 dark:text-slate-300">{rep.challenges || '—'}</p>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-lg">
                      <p className="font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Learnings
                      </p>
                      <p className="text-slate-600 dark:text-slate-300">{rep.learnings || '—'}</p>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-lg">
                      <p className="font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Next Week Priorities
                      </p>
                      <p className="text-slate-600 dark:text-slate-300">
                        {rep.nextWeekPriorities || '—'}
                      </p>
                    </div>
                  </div>

                  {!locked && (
                    <div className="space-y-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                      <textarea
                        rows={2}
                        value={draft}
                        onChange={(e) =>
                          setFeedbackDrafts((prev) => ({ ...prev, [rep.id]: e.target.value }))
                        }
                        placeholder="Provide weekly accountability feedback..."
                        className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
                      />
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <button
                          type="button"
                          disabled={busyId === rep.id}
                          onClick={() => handleReviewReport(rep, 'under_review')}
                          className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium cursor-pointer"
                        >
                          Mark Under Review
                        </button>
                        <button
                          type="button"
                          disabled={busyId === rep.id}
                          onClick={() => handleReviewReport(rep, 'revision_requested')}
                          className="px-3 py-1.5 rounded-lg border border-rose-300 dark:border-rose-800 text-rose-600 dark:text-rose-400 text-xs font-medium cursor-pointer"
                        >
                          Request Revision
                        </button>
                        {canApprove && (
                          <button
                            type="button"
                            disabled={busyId === rep.id}
                            onClick={() => handleReviewReport(rep, 'reviewed')}
                            className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-medium cursor-pointer"
                          >
                            Mark Reviewed
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
