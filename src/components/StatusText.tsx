import { CheckinStatus, SubmissionStatus, WeeklyReportStatus } from '../types';

export function CheckinStatusLabel({ status }: { status: CheckinStatus }) {
  const map: Record<CheckinStatus, { label: string; cls: string }> = {
    on_track: { label: 'On Track', cls: 'text-emerald-600 dark:text-emerald-400' },
    need_support: { label: 'Need Support', cls: 'text-amber-600 dark:text-amber-400' },
    blocked: { label: 'Blocked', cls: 'text-rose-600 dark:text-rose-400' },
  };
  const item = map[status];
  return <span className={`font-medium ${item.cls}`}>{item.label}</span>;
}

export function SubmissionStatusLabel({ status }: { status: SubmissionStatus }) {
  const map: Record<SubmissionStatus, { label: string; cls: string }> = {
    in_progress: { label: 'In Progress', cls: 'text-slate-600 dark:text-slate-300' },
    submitted: { label: 'Submitted', cls: 'text-indigo-600 dark:text-indigo-400' },
    under_review: { label: 'Under Review', cls: 'text-amber-600 dark:text-amber-400' },
    revision_requested: { label: 'Revision Requested', cls: 'text-rose-600 dark:text-rose-400' },
    approved: { label: 'Approved', cls: 'text-emerald-600 dark:text-emerald-400' },
  };
  const item = map[status];
  return <span className={`font-medium ${item.cls}`}>{item.label}</span>;
}

export function ReportStatusLabel({ status }: { status: WeeklyReportStatus }) {
  const map: Record<WeeklyReportStatus, { label: string; cls: string }> = {
    draft: { label: 'Draft', cls: 'text-slate-500 dark:text-slate-400' },
    submitted: { label: 'Submitted', cls: 'text-indigo-600 dark:text-indigo-400' },
    under_review: { label: 'Under Review', cls: 'text-amber-600 dark:text-amber-400' },
    revision_requested: { label: 'Revision Requested', cls: 'text-rose-600 dark:text-rose-400' },
    reviewed: { label: 'Reviewed', cls: 'text-emerald-600 dark:text-emerald-400' },
  };
  const item = map[status];
  return <span className={`font-medium ${item.cls}`}>{item.label}</span>;
}
