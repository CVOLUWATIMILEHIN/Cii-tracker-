import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search } from 'lucide-react';
import { AppShell } from '../../components/AppShell';
import { CheckinStatusLabel } from '../../components/StatusText';
import { useWorkspace } from '../../context/WorkspaceContext';

export function PartnerMembersPage() {
  const { assignedMembers, checkins, submissions, reports, settings } = useWorkspace();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive' | 'attention'>('all');

  const inactivityMs = (settings?.inactivityThresholdDays ?? 3) * 86400000;

  const enriched = useMemo(() => {
    const q = search.trim().toLowerCase();
    return assignedMembers
      .map((member) => {
        const latestCheckin = checkins.find((c) => c.memberId === member.uid) || null;
        const memberSubs = submissions.filter((s) => s.memberId === member.uid);
        const approvedCount = memberSubs.filter((s) => s.status === 'approved').length;
        const memberReports = reports.filter((r) => r.memberId === member.uid);
        const isInactive =
          !latestCheckin ||
          !latestCheckin.createdAt ||
          Date.now() - latestCheckin.createdAt.toMillis() > inactivityMs;
        const needsAttention =
          isInactive ||
          (latestCheckin &&
            (latestCheckin.status !== 'on_track' || latestCheckin.followUpRequested));

        return {
          member,
          latestCheckin,
          approvedCount,
          totalSubs: memberSubs.length,
          reportCount: memberReports.length,
          isInactive,
          needsAttention,
        };
      })
      .filter((row) => {
        if (filter === 'inactive' && !row.isInactive) return false;
        if (filter === 'active' && row.isInactive) return false;
        if (filter === 'attention' && !row.needsAttention) return false;
        if (
          q &&
          !row.member.displayName.toLowerCase().includes(q) &&
          !row.member.cohortName.toLowerCase().includes(q) &&
          !row.member.stateCode.toLowerCase().includes(q)
        ) {
          return false;
        }
        return true;
      });
  }, [assignedMembers, checkins, submissions, reports, search, filter, inactivityMs]);

  return (
    <AppShell title="Assigned Corps Members" breadcrumb="Partner /">
      <div className="space-y-5">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search assigned members by name, cohort, or state code..."
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
            />
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg self-start sm:self-auto">
            {(
              [
                { id: 'all', label: 'All' },
                { id: 'attention', label: 'Needs Follow-Up' },
                { id: 'inactive', label: 'Inactive' },
                { id: 'active', label: 'Active' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilter(tab.id)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md cursor-pointer whitespace-nowrap ${
                  filter === tab.id
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {enriched.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-10 text-center text-xs text-slate-500 dark:text-slate-400">
            No assigned Corps Members match your criteria. Administrators can assign members to your caseload under Participant Management.
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 text-xs font-semibold text-slate-500 dark:text-slate-400">
                    <th className="py-3 px-4">Corps Member</th>
                    <th className="py-3 px-4">Cohort / PPA</th>
                    <th className="py-3 px-4">Latest Check-In</th>
                    <th className="py-3 px-4 text-right">Submissions</th>
                    <th className="py-3 px-4 text-right">Weekly Reports</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                  {enriched.map(({ member, latestCheckin, approvedCount, totalSubs, reportCount, isInactive }) => (
                    <tr key={member.uid} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                      <td className="py-3 px-4">
                        <p className="text-sm font-medium text-slate-900 dark:text-white">
                          {member.displayName}
                        </p>
                        <p className="font-mono text-slate-400">
                          {member.stateCode || 'No state code'}
                          {isInactive ? ' · Inactive' : ''}
                        </p>
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                        <p>{member.cohortName || 'Unassigned'}</p>
                        <p className="text-slate-400 truncate max-w-xs">{member.ppa || '—'}</p>
                      </td>
                      <td className="py-3 px-4">
                        {latestCheckin ? (
                          <div>
                            <CheckinStatusLabel status={latestCheckin.status} />
                            <p className="font-mono text-[11px] text-slate-400">
                              {latestCheckin.checkinDate}
                            </p>
                          </div>
                        ) : (
                          <span className="text-rose-600 dark:text-rose-400">No Check-In</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums">
                        {approvedCount} / {totalSubs}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums">{reportCount}</td>
                      <td className="py-3 px-4 text-right">
                        <Link
                          to={`/partner/members/${member.uid}`}
                          className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap"
                        >
                          Inspect
                        </Link>
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
