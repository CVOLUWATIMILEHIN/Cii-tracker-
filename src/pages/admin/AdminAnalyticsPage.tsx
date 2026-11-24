import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Download, FileDown } from 'lucide-react';
import { AppShell } from '../../components/AppShell';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import {
  exportParticipantsCsv,
  exportWeeklyReportsPdf,
} from '../../lib/exportReports';
import { recordAuditEvent } from '../../services/ciiService';
import { normalizeRole, PILLARS } from '../../types';

export function AdminAnalyticsPage() {
  const { profile } = useAuth();
  const { theme } = useTheme();
  const { users, cohorts, activities, submissions, checkins, reports, settings } = useWorkspace();

  const members = useMemo(
    () => users.filter((u) => normalizeRole(u.role) === 'member'),
    [users]
  );

  const cohortEngagement = useMemo(() => {
    return cohorts.map((c) => {
      const cohortMembers = members.filter((m) => m.cohortId === c.id);
      const cohortSubs = submissions.filter((s) => s.cohortId === c.id);
      const approved = cohortSubs.filter((s) => s.status === 'approved').length;
      const cohortCheckins = checkins.filter((ci) => ci.cohortId === c.id).length;
      const cohortReports = reports.filter(
        (r) => r.cohortId === c.id && r.status !== 'draft'
      ).length;
      return {
        code: c.code,
        name: c.name,
        members: cohortMembers.length,
        checkins: cohortCheckins,
        reports: cohortReports,
        approvedSubmissions: approved,
      };
    });
  }, [cohorts, members, submissions, checkins, reports]);

  const pillarMetrics = useMemo(() => {
    return PILLARS.map((pillar) => {
      const pillarActivities = activities.filter((a) => a.pillar === pillar);
      const actIds = new Set(pillarActivities.map((a) => a.id));
      const pillarSubs = submissions.filter((s) => actIds.has(s.activityId));
      const approved = pillarSubs.filter((s) => s.status === 'approved').length;
      const submitted = pillarSubs.filter((s) => s.status !== 'in_progress').length;
      return {
        pillar,
        activities: pillarActivities.length,
        submitted,
        approved,
      };
    });
  }, [activities, submissions]);

  const checkinDistribution = useMemo(() => {
    const counts = { on_track: 0, need_support: 0, blocked: 0 };
    checkins.forEach((c) => {
      counts[c.status] += 1;
    });
    return [
      { name: 'On Track', value: counts.on_track, color: '#059669' },
      { name: 'Need Support', value: counts.need_support, color: '#d97706' },
      { name: 'Blocked', value: counts.blocked, color: '#e11d48' },
    ];
  }, [checkins]);

  const inactivityDays = settings?.inactivityThresholdDays || 3;

  const participantEngagement = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - inactivityDays);
    const cutoffKey = cutoff.toISOString().slice(0, 10);

    return members.map((m) => {
      const mCheckins = checkins.filter((c) => c.memberId === m.uid);
      const mReports = reports.filter((r) => r.memberId === m.uid && r.status !== 'draft');
      const mSubs = submissions.filter((s) => s.memberId === m.uid);
      const approvedCount = mSubs.filter((s) => s.status === 'approved').length;
      const lastCheckinDate = mCheckins[0]?.checkinDate || '';
      const isInactive = !lastCheckinDate || lastCheckinDate < cutoffKey;
      return {
        member: m,
        checkinsCount: mCheckins.length,
        reportsCount: mReports.length,
        approvedCount,
        lastCheckinDate,
        isInactive,
      };
    });
  }, [members, checkins, reports, submissions, inactivityDays]);

  const inactiveParticipants = useMemo(
    () => participantEngagement.filter((p) => p.isInactive && p.member.status === 'active'),
    [participantEngagement]
  );

  if (!profile) return null;

  const isDark = theme === 'dark';
  const gridColor = isDark ? '#1e293b' : '#e2e8f0';
  const axisColor = isDark ? '#94a3b8' : '#64748b';
  const tooltipStyle = {
    backgroundColor: isDark ? '#0f172a' : '#ffffff',
    borderColor: isDark ? '#334155' : '#e2e8f0',
    borderRadius: '8px',
    fontSize: '12px',
  };

  const handleExportParticipants = () => {
    exportParticipantsCsv(members);
    void recordAuditEvent({
      actorId: profile.uid,
      actorName: profile.displayName,
      actorRole: 'admin',
      action: 'EXPORT_ANALYTICS_PARTICIPANTS_CSV',
      category: 'export',
      severity: 'info',
      targetType: 'analytics',
      targetId: 'participants',
      summary: `Exported ${members.length} participant analytics records to CSV.`,
    });
  };

  const handleExportReportsPdf = () => {
    exportWeeklyReportsPdf(reports, profile.displayName, 'admin');
    void recordAuditEvent({
      actorId: profile.uid,
      actorName: profile.displayName,
      actorRole: 'admin',
      action: 'EXPORT_ANALYTICS_REPORTS_PDF',
      category: 'export',
      severity: 'info',
      targetType: 'analytics',
      targetId: 'weekly_reports',
      summary: `Exported ${reports.length} weekly reports from Analytics to PDF.`,
    });
  };

  return (
    <AppShell
      title="Programme Analytics"
      breadcrumb="Admin /"
      actions={
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportParticipants}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            Participants CSV
          </button>
          <button
            type="button"
            onClick={handleExportReportsPdf}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-900 dark:bg-emerald-600 text-white text-xs font-medium cursor-pointer"
          >
            <FileDown className="w-3.5 h-3.5" />
            Reports PDF
          </button>
        </div>
      }
    >
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
            <p className="text-xs text-slate-500 dark:text-slate-400">Corps Members</p>
            <p className="text-2xl font-semibold font-mono tabular-nums text-slate-900 dark:text-white mt-1">
              {members.length}
            </p>
          </div>
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
            <p className="text-xs text-slate-500 dark:text-slate-400">Total Daily Check-Ins</p>
            <p className="text-2xl font-semibold font-mono tabular-nums text-slate-900 dark:text-white mt-1">
              {checkins.length}
            </p>
          </div>
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
            <p className="text-xs text-slate-500 dark:text-slate-400">Submitted Weekly Reports</p>
            <p className="text-2xl font-semibold font-mono tabular-nums text-slate-900 dark:text-white mt-1">
              {reports.filter((r) => r.status !== 'draft').length}
            </p>
          </div>
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Inactive (&gt;{inactivityDays}d)
            </p>
            <p className="text-2xl font-semibold font-mono tabular-nums text-rose-600 dark:text-rose-400 mt-1">
              {inactiveParticipants.length}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              Cohort Engagement Overview
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Daily check-ins, weekly reports, and approved submissions by cohort.
            </p>
            <div className="h-64">
              {cohortEngagement.length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-slate-400">
                  Create cohorts to view comparative engagement.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={cohortEngagement}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                    <XAxis dataKey="code" tick={{ fill: axisColor, fontSize: 11 }} />
                    <YAxis tick={{ fill: axisColor, fontSize: 11 }} allowDecimals={false} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="checkins" name="Check-Ins" fill="#059669" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="reports" name="Weekly Reports" fill="#0284c7" radius={[4, 4, 0, 0]} />
                    <Bar
                      dataKey="approvedSubmissions"
                      name="Approved Activities"
                      fill="#6366f1"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              Check-In Health Distribution
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Breakdown of participant daily check-in statuses.
            </p>
            <div className="h-48">
              {checkins.length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-slate-400">
                  No check-ins logged yet.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={checkinDistribution}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={45}
                      outerRadius={74}
                      paddingAngle={2}
                    >
                      {checkinDistribution.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
            <div className="space-y-1.5 mt-2">
              {checkinDistribution.map((item) => (
                <div key={item.name} className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                    {item.name}
                  </span>
                  <span className="font-mono tabular-nums font-medium text-slate-900 dark:text-white">
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
            Activity Completion by Impact Pillar
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
            Submitted versus approved activity deliverables across CII programme pillars.
          </p>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={pillarMetrics}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                <XAxis dataKey="pillar" tick={{ fill: axisColor, fontSize: 11 }} />
                <YAxis tick={{ fill: axisColor, fontSize: 11 }} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="submitted" name="Submitted" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                <Bar dataKey="approved" name="Approved" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                Reporting Consistency
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Individual Corps Member check-in, weekly report, and approval metrics.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 text-slate-500 dark:text-slate-400">
                    <th className="py-2.5 px-4">Participant</th>
                    <th className="py-2.5 px-4 text-right">Check-Ins</th>
                    <th className="py-2.5 px-4 text-right">Reports</th>
                    <th className="py-2.5 px-4 text-right">Approved</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {participantEngagement.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-slate-400">
                        No Corps Members registered yet.
                      </td>
                    </tr>
                  ) : (
                    participantEngagement.map((row) => (
                      <tr key={row.member.uid} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                        <td className="py-2.5 px-4">
                          <Link
                            to={`/admin/participants/${row.member.uid}`}
                            className="font-medium text-slate-900 dark:text-white hover:underline"
                          >
                            {row.member.displayName}
                          </Link>
                          <p className="text-[11px] text-slate-400">
                            {row.member.cohortName || 'No cohort'}
                          </p>
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono tabular-nums">
                          {row.checkinsCount}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono tabular-nums">
                          {row.reportsCount}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                          {row.approvedCount}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                Inactive Participants (&gt;{inactivityDays} Days)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Active Corps Members requiring Accountability Partner outreach.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 text-slate-500 dark:text-slate-400">
                    <th className="py-2.5 px-4">Participant</th>
                    <th className="py-2.5 px-4">Assigned Partner</th>
                    <th className="py-2.5 px-4 text-right">Last Check-In</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {inactiveParticipants.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="py-6 text-center text-emerald-600 dark:text-emerald-400">
                        All active Corps Members have checked in within {inactivityDays} days.
                      </td>
                    </tr>
                  ) : (
                    inactiveParticipants.map((row) => (
                      <tr key={row.member.uid} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                        <td className="py-2.5 px-4">
                          <Link
                            to={`/admin/participants/${row.member.uid}`}
                            className="font-medium text-slate-900 dark:text-white hover:underline"
                          >
                            {row.member.displayName}
                          </Link>
                        </td>
                        <td className="py-2.5 px-4 text-slate-600 dark:text-slate-300">
                          {row.member.partnerName || 'Unassigned'}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono tabular-nums text-rose-600 dark:text-rose-400">
                          {row.lastCheckinDate || 'Never'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
