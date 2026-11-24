import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, CheckCircle2, Clock, Download, FileDown, RotateCcw, Search } from 'lucide-react';
import { AppShell } from '../../components/AppShell';
import { ReportStatusLabel } from '../../components/StatusText';
import { useAuth } from '../../context/AuthContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import {
  exportWeeklyReportsCsv,
  exportWeeklyReportsPdf,
  formatTimestamp,
} from '../../lib/exportReports';
import { getIsoWeekInfo } from '../../lib/validators';
import { recordAuditEvent, reviewWeeklyReport } from '../../services/ciiService';
import { normalizeRole, WeeklyReport, WeeklyReportStatus } from '../../types';

export function AdminReportsPage() {
  const { profile } = useAuth();
  const { reports, users, cohorts } = useWorkspace();

  const [search, setSearch] = useState('');
  const [cohortFilter, setCohortFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<WeeklyReportStatus | 'all'>('all');
  const [feedbackDrafts, setFeedbackDrafts] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const currentWeek = useMemo(() => getIsoWeekInfo(), []);

  const missingThisWeek = useMemo(() => {
    const activeMembers = users.filter(
      (u) => normalizeRole(u.role) === 'member' && u.status === 'active'
    );
    const submittedSet = new Set(
      reports
        .filter((r) => r.weekKey === currentWeek.weekKey && r.status !== 'draft')
        .map((r) => r.memberId)
    );
    return activeMembers.filter((m) => !submittedSet.has(m.uid));
  }, [users, reports, currentWeek.weekKey]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return reports.filter((r) => {
      if (cohortFilter !== 'all' && r.cohortId !== cohortFilter) return false;
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (
        q &&
        !r.memberName.toLowerCase().includes(q) &&
        !r.weekLabel.toLowerCase().includes(q) &&
        !r.achievements.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [reports, cohortFilter, statusFilter, search]);

  if (!profile) return null;

  const handleReview = async (
    rep: WeeklyReport,
    nextStatus: 'under_review' | 'revision_requested' | 'reviewed'
  ) => {
    setBusyId(rep.id);
    try {
      const feedbackText =
        feedbackDrafts[rep.id] !== undefined ? feedbackDrafts[rep.id] : rep.feedbackText;
      await reviewWeeklyReport({
        actor: profile,
        report: rep,
        status: nextStatus,
        feedbackText,
      });
    } finally {
      setBusyId(null);
    }
  };

  const handleExportCsv = () => {
    exportWeeklyReportsCsv(filtered);
    void recordAuditEvent({
      actorId: profile.uid,
      actorName: profile.displayName,
      actorRole: 'admin',
      action: 'EXPORT_WEEKLY_REPORTS_CSV',
      category: 'export',
      severity: 'info',
      targetType: 'report',
      targetId: 'weekly_reports',
      summary: `Exported ${filtered.length} weekly accountability reports to CSV.`,
    });
  };

  const handleExportPdf = () => {
    exportWeeklyReportsPdf(filtered, profile.displayName, 'admin');
    void recordAuditEvent({
      actorId: profile.uid,
      actorName: profile.displayName,
      actorRole: 'admin',
      action: 'EXPORT_WEEKLY_REPORTS_PDF',
      category: 'export',
      severity: 'info',
      targetType: 'report',
      targetId: 'weekly_reports',
      summary: `Exported ${filtered.length} weekly accountability reports to PDF.`,
    });
  };

  return (
    <AppShell
      title="Weekly Reports"
      breadcrumb="Admin /"
      actions={
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            CSV
          </button>
          <button
            type="button"
            onClick={handleExportPdf}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-900 dark:bg-emerald-600 text-white text-xs font-medium cursor-pointer"
          >
            <FileDown className="w-3.5 h-3.5" />
            PDF
          </button>
        </div>
      }
    >
      <div className="space-y-5">
        {missingThisWeek.length > 0 && (
          <div className="bg-amber-50/70 dark:bg-amber-950/25 border border-amber-200 dark:border-amber-900/60 rounded-xl p-4 space-y-2.5">
            <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <p className="text-xs font-semibold">
                Pending Weekly Reports ({currentWeek.weekLabel}) — {missingThisWeek.length} active Corps Members
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {missingThisWeek.slice(0, 12).map((m) => (
                <Link
                  key={m.uid}
                  to={`/admin/participants/${m.uid}`}
                  className="text-xs px-2.5 py-1 rounded-md bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-800/60 text-slate-800 dark:text-slate-200 hover:border-amber-400"
                >
                  {m.displayName}
                </Link>
              ))}
              {missingThisWeek.length > 12 && (
                <span className="text-xs text-amber-700 dark:text-amber-400 self-center">
                  +{missingThisWeek.length - 12} more
                </span>
              )}
            </div>
          </div>
        )}

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search reports by member, week, or achievements..."
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={cohortFilter}
              onChange={(e) => setCohortFilter(e.target.value)}
              className="px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
            >
              <option value="all">All Cohorts</option>
              {cohorts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} — {c.name}
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as WeeklyReportStatus | 'all')}
              className="px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
            >
              <option value="all">All Statuses</option>
              <option value="submitted">Submitted</option>
              <option value="under_review">Under Review</option>
              <option value="revision_requested">Revision Requested</option>
              <option value="reviewed">Reviewed</option>
              <option value="draft">Draft</option>
            </select>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-10 text-center text-sm text-slate-500 dark:text-slate-400">
            No weekly accountability reports found for these filters.
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((rep) => {
              const draftFeedback =
                feedbackDrafts[rep.id] !== undefined ? feedbackDrafts[rep.id] : rep.feedbackText;
              const isBusy = busyId === rep.id;

              return (
                <div
                  key={rep.id}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                    <div>
                      <p className="font-mono text-xs text-emerald-700 dark:text-emerald-400">
                        {rep.weekLabel}
                      </p>
                      <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                        <Link
                          to={`/admin/participants/${rep.memberId}`}
                          className="hover:underline"
                        >
                          {rep.memberName}
                        </Link>
                      </h3>
                      <p className="text-[11px] text-slate-400">
                        Updated {formatTimestamp(rep.updatedAt)}
                      </p>
                    </div>
                    <ReportStatusLabel status={rep.status} />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200/70 dark:border-slate-800">
                      <p className="font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Key Achievements
                      </p>
                      <p className="text-slate-600 dark:text-slate-300 whitespace-pre-wrap">
                        {rep.achievements || '—'}
                      </p>
                    </div>
                    <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200/70 dark:border-slate-800">
                      <p className="font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Challenges Encountered
                      </p>
                      <p className="text-slate-600 dark:text-slate-300 whitespace-pre-wrap">
                        {rep.challenges || '—'}
                      </p>
                    </div>
                    <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200/70 dark:border-slate-800">
                      <p className="font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Learnings &amp; Reflections
                      </p>
                      <p className="text-slate-600 dark:text-slate-300 whitespace-pre-wrap">
                        {rep.learnings || '—'}
                      </p>
                    </div>
                    <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200/70 dark:border-slate-800">
                      <p className="font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Next Week Priorities
                      </p>
                      <p className="text-slate-600 dark:text-slate-300 whitespace-pre-wrap">
                        {rep.nextWeekPriorities || '—'}
                      </p>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                        Review Feedback
                      </label>
                      {rep.reviewedByName && (
                        <span className="text-[11px] text-slate-400">
                          Reviewed by {rep.reviewedByName}
                        </span>
                      )}
                    </div>
                    <textarea
                      rows={2}
                      value={draftFeedback}
                      onChange={(e) =>
                        setFeedbackDrafts((prev) => ({ ...prev, [rep.id]: e.target.value }))
                      }
                      placeholder="Write feedback or request clarifications..."
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                    />
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleReview(rep, 'under_review')}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 cursor-pointer disabled:opacity-50"
                      >
                        <Clock className="w-3.5 h-3.5" />
                        Under Review
                      </button>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleReview(rep, 'revision_requested')}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-400 text-xs font-medium cursor-pointer disabled:opacity-50"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Request Revision
                      </button>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleReview(rep, 'reviewed')}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-medium cursor-pointer disabled:opacity-50"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Mark Reviewed
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
