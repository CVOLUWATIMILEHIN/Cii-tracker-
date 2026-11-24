import { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AppShell } from '../../components/AppShell';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { isActivityAssignedToMember } from '../../lib/validators';
import { PILLARS } from '../../types';

export function MemberProgressPage() {
  const { profile } = useAuth();
  const { theme } = useTheme();
  const { activities, submissions, checkins, reports } = useWorkspace();

  const isDark = theme === 'dark';
  const gridColor = isDark ? '#1e293b' : '#e2e8f0';
  const axisColor = isDark ? '#94a3b8' : '#64748b';
  const tooltipBg = isDark ? '#0f172a' : '#ffffff';
  const tooltipBorder = isDark ? '#334155' : '#e2e8f0';

  const assigned = useMemo(() => {
    if (!profile) return [];
    return activities.filter((a) => isActivityAssignedToMember(a, profile.uid, profile.cohortId));
  }, [activities, profile]);

  const pillarData = useMemo(() => {
    return PILLARS.map((pillar) => {
      const items = assigned.filter((a) => a.pillar === pillar);
      const avg =
        items.length > 0
          ? Math.round(
              items.reduce((sum, act) => {
                const sub = submissions.find((s) => s.activityId === act.id);
                return sum + (sub?.progress ?? 0);
              }, 0) / items.length
            )
          : 0;
      return { pillar, avgProgress: avg, count: items.length };
    });
  }, [assigned, submissions]);

  const onTrackCount = checkins.filter((c) => c.status === 'on_track').length;
  const approvedCount = submissions.filter((s) => s.status === 'approved').length;
  const submittedReports = reports.filter((r) => r.status !== 'draft').length;

  return (
    <AppShell title="Progress Tracking" breadcrumb="Corps Member /">
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-1">
            <p className="text-xs text-slate-500 dark:text-slate-400">Approved Activities</p>
            <p className="text-3xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
              {approvedCount} / {assigned.length}
            </p>
          </div>
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-1">
            <p className="text-xs text-slate-500 dark:text-slate-400">On-Track Check-Ins</p>
            <p className="text-3xl font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
              {onTrackCount} / {checkins.length}
            </p>
          </div>
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-1">
            <p className="text-xs text-slate-500 dark:text-slate-400">Weekly Reports Submitted</p>
            <p className="text-3xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
              {submittedReports}
            </p>
          </div>
        </div>

        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              Activity Completion by Strategic Pillar
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Average progress percentage across your assigned CII deliverables
            </p>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={pillarData} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                <XAxis dataKey="pillar" tick={{ fill: axisColor, fontSize: 12 }} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fill: axisColor, fontSize: 11 }} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: tooltipBg,
                    borderColor: tooltipBorder,
                    borderRadius: '0.5rem',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="avgProgress" name="Avg Progress (%)" fill="#059669" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
