import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Archive, CheckCircle2, Download, Plus, Search } from 'lucide-react';
import { AppShell } from '../../components/AppShell';
import { useAuth } from '../../context/AuthContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { exportActivitiesCsv } from '../../lib/exportReports';
import { recordAuditEvent, saveActivity } from '../../services/ciiService';
import { Activity, ActivityStatus } from '../../types';

export function AdminActivitiesPage() {
  const { profile } = useAuth();
  const { activities, submissions, users } = useWorkspace();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ActivityStatus | 'all'>('all');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return activities.filter((a) => {
      if (statusFilter !== 'all' && a.status !== statusFilter) return false;
      if (q && !a.title.toLowerCase().includes(q) && !a.code.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [activities, search, statusFilter]);

  if (!profile) return null;

  const setStatus = async (act: Activity, nextStatus: ActivityStatus) => {
    await saveActivity({
      actor: profile,
      existing: act,
      code: act.code,
      title: act.title,
      description: act.description,
      instructions: act.instructions,
      pillar: act.pillar,
      cohortId: act.cohortId,
      cohortName: act.cohortName,
      assignmentScope: act.assignmentScope,
      assignedMemberIds: act.assignedMemberIds,
      deadline: act.deadline,
      evidenceRequired: act.evidenceRequired,
      reviewRequired: act.reviewRequired,
      status: nextStatus,
      users: nextStatus === 'published' ? users : undefined,
    });
  };

  const handleExport = () => {
    exportActivitiesCsv(filtered, submissions);
    void recordAuditEvent({
      actorId: profile.uid,
      actorName: profile.displayName,
      actorRole: 'admin',
      action: 'EXPORT_ACTIVITIES_CSV',
      category: 'export',
      severity: 'info',
      targetType: 'report',
      targetId: 'activities',
      summary: `Exported ${filtered.length} activities to CSV.`,
    });
  };

  return (
    <AppShell
      title="Activity Management"
      breadcrumb="Admin /"
      actions={
        <Link
          to="/admin/activities/create"
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-900 dark:bg-emerald-600 text-white text-xs sm:text-sm font-medium whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          <span>Create Activity</span>
        </Link>
      }
    >
      <div className="space-y-5">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search activities by title or code..."
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as ActivityStatus | 'all')}
              className="px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
            >
              <option value="all">All Statuses</option>
              <option value="published">Published</option>
              <option value="draft">Draft</option>
              <option value="archived">Archived</option>
            </select>
            <button
              type="button"
              onClick={handleExport}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              CSV
            </button>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 text-xs font-semibold text-slate-500 dark:text-slate-400">
                  <th className="py-3 px-4">Activity</th>
                  <th className="py-3 px-4">Assignment Scope</th>
                  <th className="py-3 px-4">Deadline</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Submissions</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {filtered.map((act) => {
                  const subCount = submissions.filter((s) => s.activityId === act.id).length;
                  return (
                    <tr key={act.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                      <td className="py-3 px-4">
                        <p className="font-mono text-emerald-700 dark:text-emerald-400">
                          {act.code} · {act.pillar}
                        </p>
                        <p className="text-sm font-medium text-slate-900 dark:text-white">
                          {act.title}
                        </p>
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                        {act.assignmentScope === 'all'
                          ? 'All Corps Members'
                          : act.assignmentScope === 'cohort'
                            ? `Cohort: ${act.cohortName}`
                            : `${act.assignedMemberIds.length} Selected Members`}
                      </td>
                      <td className="py-3 px-4 font-mono tabular-nums">{act.deadline}</td>
                      <td className="py-3 px-4 capitalize font-medium">
                        <span
                          className={
                            act.status === 'published'
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : act.status === 'archived'
                                ? 'text-slate-400'
                                : 'text-amber-600 dark:text-amber-400'
                          }
                        >
                          {act.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums">{subCount}</td>
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          {act.status !== 'published' && (
                            <button
                              type="button"
                              onClick={() => setStatus(act, 'published')}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 font-medium cursor-pointer"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Publish
                            </button>
                          )}
                          {act.status !== 'archived' && (
                            <button
                              type="button"
                              onClick={() => setStatus(act, 'archived')}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-medium cursor-pointer"
                            >
                              <Archive className="w-3.5 h-3.5" />
                              Archive
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
