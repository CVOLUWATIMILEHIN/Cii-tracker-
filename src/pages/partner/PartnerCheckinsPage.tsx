import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Flag } from 'lucide-react';
import { AppShell } from '../../components/AppShell';
import { CheckinStatusLabel } from '../../components/StatusText';
import { useAuth } from '../../context/AuthContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { flagCheckinForAdmin } from '../../services/ciiService';
import { CheckinStatus } from '../../types';

export function PartnerCheckinsPage() {
  const { profile } = useAuth();
  const { checkins } = useWorkspace();
  const [statusFilter, setStatusFilter] = useState<CheckinStatus | 'all'>('all');
  const [onlyFollowUp, setOnlyFollowUp] = useState(false);

  const filtered = useMemo(() => {
    return checkins.filter((c) => {
      if (statusFilter !== 'all' && c.status !== statusFilter) return false;
      if (onlyFollowUp && !c.followUpRequested) return false;
      return true;
    });
  }, [checkins, statusFilter, onlyFollowUp]);

  if (!profile) return null;

  return (
    <AppShell title="Assigned Member Check-Ins" breadcrumb="Partner /">
      <div className="space-y-5">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
            {(['all', 'on_track', 'need_support', 'blocked'] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md cursor-pointer whitespace-nowrap ${
                  statusFilter === st
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                {st === 'all'
                  ? 'All'
                  : st === 'on_track'
                    ? 'On Track'
                    : st === 'need_support'
                      ? 'Need Support'
                      : 'Blocked'}
              </button>
            ))}
          </div>

          <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={onlyFollowUp}
              onChange={(e) => setOnlyFollowUp(e.target.checked)}
              className="accent-emerald-600"
            />
            <span>Follow-up requested only</span>
          </label>
        </div>

        {filtered.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-10 text-center text-xs text-slate-500">
            No member check-ins match your filters.
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 text-xs font-semibold text-slate-500 dark:text-slate-400">
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Member</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Update</th>
                    <th className="py-3 px-4 text-right">Escalation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                  {filtered.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                      <td className="py-3 px-4 font-mono tabular-nums whitespace-nowrap">
                        {c.checkinDate}
                      </td>
                      <td className="py-3 px-4">
                        <Link
                          to={`/partner/members/${c.memberId}`}
                          className="font-semibold text-slate-900 dark:text-white hover:underline"
                        >
                          {c.memberName}
                        </Link>
                        {c.followUpRequested && (
                          <p className="text-[11px] text-amber-600 dark:text-amber-400">
                            Follow-up requested
                          </p>
                        )}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <CheckinStatusLabel status={c.status} />
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-300 max-w-md">
                        {c.updateText || '—'}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => flagCheckinForAdmin(c, !c.flaggedForAdmin, profile)}
                          className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-medium cursor-pointer ${
                            c.flaggedForAdmin
                              ? 'border-rose-300 dark:border-rose-800 text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40'
                              : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                          }`}
                        >
                          <Flag className="w-3 h-3" />
                          <span>{c.flaggedForAdmin ? 'Flagged' : 'Flag Admin'}</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
