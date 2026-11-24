import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Clock, Paperclip, Search } from 'lucide-react';
import { AppShell } from '../../components/AppShell';
import { SubmissionStatusLabel } from '../../components/StatusText';
import { useAuth } from '../../context/AuthContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { isActivityAssignedToMember } from '../../lib/validators';
import { InitiativePillar, PILLARS } from '../../types';

export function MemberActivitiesPage() {
  const { profile } = useAuth();
  const { activities, submissions } = useWorkspace();
  const [search, setSearch] = useState('');
  const [pillar, setPillar] = useState<InitiativePillar | 'all'>('all');
  const [stateFilter, setStateFilter] = useState<'all' | 'pending' | 'completed' | 'revision'>('all');

  const submissionMap = useMemo(() => {
    const map = new Map<string, (typeof submissions)[number]>();
    submissions.forEach((s) => map.set(s.activityId, s));
    return map;
  }, [submissions]);

  const filtered = useMemo(() => {
    if (!profile) return [];
    const q = search.trim().toLowerCase();
    return activities
      .filter((a) => isActivityAssignedToMember(a, profile.uid, profile.cohortId))
      .filter((a) => {
        if (pillar !== 'all' && a.pillar !== pillar) return false;
        const sub = submissionMap.get(a.id);
        if (stateFilter === 'pending' && sub && (sub.status === 'approved' || sub.status === 'submitted')) {
          return false;
        }
        if (stateFilter === 'completed' && (!sub || (sub.status !== 'approved' && sub.status !== 'submitted'))) {
          return false;
        }
        if (stateFilter === 'revision' && (!sub || sub.status !== 'revision_requested')) {
          return false;
        }
        if (
          q &&
          !a.title.toLowerCase().includes(q) &&
          !a.code.toLowerCase().includes(q) &&
          !a.description.toLowerCase().includes(q)
        ) {
          return false;
        }
        return true;
      });
  }, [activities, profile, search, pillar, stateFilter, submissionMap]);

  return (
    <AppShell title="Assigned Activities" breadcrumb="Corps Member /">
      <div className="space-y-5">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
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

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={pillar}
              onChange={(e) => setPillar(e.target.value as InitiativePillar | 'all')}
              className="px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
            >
              <option value="all">All Pillars</option>
              {PILLARS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>

            <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
              {(
                [
                  { id: 'all', label: 'All' },
                  { id: 'pending', label: 'Outstanding' },
                  { id: 'revision', label: 'Revision' },
                  { id: 'completed', label: 'Submitted' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStateFilter(tab.id)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md cursor-pointer whitespace-nowrap ${
                    stateFilter === tab.id
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-10 text-center text-xs text-slate-500 dark:text-slate-400">
            No assigned activities match your current filters.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filtered.map((act) => {
              const sub = submissionMap.get(act.id);
              return (
                <article
                  key={act.id}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col justify-between gap-4"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <span className="font-mono font-medium text-emerald-700 dark:text-emerald-400">
                        {act.code} · {act.pillar}
                      </span>
                      {sub ? (
                        <SubmissionStatusLabel status={sub.status} />
                      ) : (
                        <span>Not Started</span>
                      )}
                    </div>
                    <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                      {act.title}
                    </h2>
                    <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed">
                      {act.description}
                    </p>
                  </div>

                  <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                      <span className="inline-flex items-center gap-1 font-mono tabular-nums">
                        <Clock className="w-3.5 h-3.5" />
                        Due {act.deadline}
                      </span>
                      <span className="inline-flex items-center gap-2">
                        {act.evidenceRequired && (
                          <span className="inline-flex items-center gap-1">
                            <Paperclip className="w-3 h-3" /> Evidence required
                          </span>
                        )}
                        <span className="font-mono tabular-nums font-medium text-slate-800 dark:text-slate-200">
                          {sub?.progress ?? 0}%
                        </span>
                      </span>
                    </div>

                    <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div
                        className="h-full bg-emerald-600 rounded-full"
                        style={{ width: `${sub?.progress ?? 0}%` }}
                      />
                    </div>

                    <div className="flex justify-end">
                      <Link
                        to={`/activities/${act.id}`}
                        className="px-3.5 py-2 rounded-lg bg-slate-900 dark:bg-emerald-600 hover:bg-slate-800 dark:hover:bg-emerald-500 text-white text-xs font-medium whitespace-nowrap"
                      >
                        {sub?.status === 'revision_requested'
                          ? 'Address Revision'
                          : sub
                            ? 'Open Submission'
                            : 'Start Activity'}
                      </Link>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
