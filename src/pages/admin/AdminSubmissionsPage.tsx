import { useMemo, useState } from 'react';
import { CheckCircle2, Clock, ExternalLink, FileDown, RotateCcw, Search } from 'lucide-react';
import { AppShell } from '../../components/AppShell';
import { SubmissionStatusLabel } from '../../components/StatusText';
import { useAuth } from '../../context/AuthContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { exportSubmissionsPdf, formatTimestamp } from '../../lib/exportReports';
import { getSafeExternalUrl } from '../../lib/validators';
import { recordAuditEvent, reviewActivitySubmission } from '../../services/ciiService';
import { ActivitySubmission, SubmissionStatus } from '../../types';

export function AdminSubmissionsPage() {
  const { profile } = useAuth();
  const { submissions, activities } = useWorkspace();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<SubmissionStatus | 'all'>('all');
  const [activityFilter, setActivityFilter] = useState<string>('all');
  const [feedbackDrafts, setFeedbackDrafts] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return submissions.filter((s) => {
      if (statusFilter !== 'all' && s.status !== statusFilter) return false;
      if (activityFilter !== 'all' && s.activityId !== activityFilter) return false;
      if (
        q &&
        !s.memberName.toLowerCase().includes(q) &&
        !s.activityTitle.toLowerCase().includes(q) &&
        !s.responseText.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [submissions, search, statusFilter, activityFilter]);

  if (!profile) return null;

  const handleReview = async (
    sub: ActivitySubmission,
    nextStatus: 'under_review' | 'revision_requested' | 'approved'
  ) => {
    setBusyId(sub.id);
    setError(null);
    try {
      const feedbackText =
        feedbackDrafts[sub.id] !== undefined ? feedbackDrafts[sub.id] : sub.feedbackText;
      await reviewActivitySubmission({
        actor: profile,
        submission: sub,
        status: nextStatus,
        feedbackText,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save submission review.');
    } finally {
      setBusyId(null);
    }
  };

  const handleExportPdf = () => {
    exportSubmissionsPdf(filtered, profile.displayName, 'admin');
    void recordAuditEvent({
      actorId: profile.uid,
      actorName: profile.displayName,
      actorRole: 'admin',
      action: 'EXPORT_SUBMISSIONS_PDF',
      category: 'export',
      severity: 'info',
      targetType: 'report',
      targetId: 'activity_submissions',
      summary: `Exported ${filtered.length} activity submissions to PDF.`,
    });
  };

  return (
    <AppShell
      title="Activity Submissions"
      breadcrumb="Admin /"
      actions={
        <button
          type="button"
          onClick={handleExportPdf}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 cursor-pointer"
        >
          <FileDown className="w-3.5 h-3.5" />
          Export PDF
        </button>
      }
    >
      <div className="space-y-5">
        {error && (
          <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300">
            {error}
          </div>
        )}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by Corps Member, activity, or response..."
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={activityFilter}
              onChange={(e) => setActivityFilter(e.target.value)}
              className="px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 max-w-xs"
            >
              <option value="all">All Activities</option>
              {activities.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.code} — {a.title}
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as SubmissionStatus | 'all')}
              className="px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
            >
              <option value="all">All Statuses</option>
              <option value="submitted">Submitted</option>
              <option value="under_review">Under Review</option>
              <option value="revision_requested">Revision Requested</option>
              <option value="approved">Approved</option>
              <option value="in_progress">In Progress</option>
            </select>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-10 text-center text-sm text-slate-500 dark:text-slate-400">
            No activity submissions match the current filters.
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((sub) => {
              const draftFeedback =
                feedbackDrafts[sub.id] !== undefined ? feedbackDrafts[sub.id] : sub.feedbackText;
              const isBusy = busyId === sub.id;

              return (
                <div
                  key={sub.id}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {sub.memberName}
                        </span>{' '}
                        · Updated {formatTimestamp(sub.updatedAt)}
                      </p>
                      <h3 className="text-sm font-semibold text-slate-900 dark:text-white mt-0.5">
                        {sub.activityTitle}
                      </h3>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="font-mono tabular-nums text-slate-500 dark:text-slate-400">
                        Progress: {sub.progress}%
                      </span>
                      <SubmissionStatusLabel status={sub.status} />
                    </div>
                  </div>

                  <div className="text-xs text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 rounded-lg p-3 whitespace-pre-wrap">
                    {sub.responseText || 'No written response provided.'}
                  </div>

                  {getSafeExternalUrl(sub.evidenceUrl) && (
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-slate-500 dark:text-slate-400">Evidence attachment:</span>
                      <a
                        href={getSafeExternalUrl(sub.evidenceUrl) || '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-medium text-emerald-700 dark:text-emerald-400 hover:underline"
                      >
                        <span>{sub.evidenceName || 'View uploaded file'}</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  )}

                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                        Reviewer Feedback
                      </label>
                      {sub.reviewedByName && (
                        <span className="text-[11px] text-slate-400">
                          Last reviewed by {sub.reviewedByName}
                        </span>
                      )}
                    </div>
                    <textarea
                      rows={2}
                      value={draftFeedback}
                      onChange={(e) =>
                        setFeedbackDrafts((prev) => ({ ...prev, [sub.id]: e.target.value }))
                      }
                      placeholder="Add constructive review feedback or revision guidance..."
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                    />
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleReview(sub, 'under_review')}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 cursor-pointer disabled:opacity-50"
                      >
                        <Clock className="w-3.5 h-3.5" />
                        Mark Under Review
                      </button>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleReview(sub, 'revision_requested')}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-400 text-xs font-medium cursor-pointer disabled:opacity-50"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Request Revision
                      </button>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleReview(sub, 'approved')}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-medium cursor-pointer disabled:opacity-50"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Approve Submission
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
