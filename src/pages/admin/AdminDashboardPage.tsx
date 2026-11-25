import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Database,
  Download,
  Flag,
  Plus,
  Search,
  ShieldCheck,
} from 'lucide-react';
import {
  Area,
  AreaChart,
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
import { exportAuditLogsCsv, formatTimestamp } from '../../lib/exportReports';
import { getIsoWeekInfo, getTodayDateKey } from '../../lib/validators';
import {
  bootstrapOwnerSuperAdmin,
  recordAuditEvent,
  seedCiiProgrammeData,
} from '../../services/ciiService';
import {
  AuditCategory,
  AuditSeverity,
  canManageActivities,
  isFullAdminRole,
  isScopedAdminRole,
  isSuperAdminRole,
  normalizeRole,
  ROLE_LABELS,
} from '../../types';

export function AdminDashboardPage() {
  const { profile, role } = useAuth();
  const { theme } = useTheme();
  const {
    users,
    cohorts,
    activities,
    submissions,
    checkins,
    reports,
    followUps,
    settings,
    auditLogs,
    loading,
  } = useWorkspace();

  const [seeding, setSeeding] = useState(false);
  const [seedError, setSeedError] = useState<string | null>(null);
  const [bootstrapping, setBootstrapping] = useState(false);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'audit'>('overview');
  const [auditSearch, setAuditSearch] = useState('');
  const [auditCategory, setAuditCategory] = useState<AuditCategory | 'all'>('all');
  const [auditSeverity, setAuditSeverity] = useState<AuditSeverity | 'all'>('all');
  const [auditResourceFilter, setAuditResourceFilter] = useState<string>('all');

  const hasAnySuperAdmin = useMemo(
    () =>
      users.some((u) => normalizeRole(u.role) === 'super_admin' && u.status === 'active'),
    [users]
  );

  const todayKey = getTodayDateKey();
  const { weekKey } = getIsoWeekInfo();
  const inactivityDays = settings?.inactivityThresholdDays ?? 3;

  const isDark = theme === 'dark';
  const gridColor = isDark ? '#1e293b' : '#e2e8f0';
  const axisColor = isDark ? '#94a3b8' : '#64748b';
  const tooltipBg = isDark ? '#0f172a' : '#ffffff';
  const tooltipBorder = isDark ? '#334155' : '#e2e8f0';

  const metrics = useMemo(() => {
    const members = users.filter((u) => normalizeRole(u.role) === 'member');
    const activeMembers = members.filter((u) => u.status === 'active');
    const partners = users.filter((u) => normalizeRole(u.role) === 'partner');

    const cutoffMs = Date.now() - inactivityDays * 86400000;
    const inactiveMembers = activeMembers.filter((m) => {
      const latest = checkins.find((c) => c.memberId === m.uid);
      if (!latest || !latest.createdAt) return true;
      return latest.createdAt.toMillis() < cutoffMs;
    });

    const todayCheckins = checkins.filter((c) => c.checkinDate === todayKey);
    const thisWeekReports = reports.filter((r) => r.weekKey === weekKey && r.status !== 'draft');
    const completedSubmissions = submissions.filter((s) => s.status === 'approved').length;
    const pendingReviews =
      submissions.filter((s) => s.status === 'submitted' || s.status === 'under_review').length +
      reports.filter((r) => r.status === 'submitted' || r.status === 'under_review').length;

    const flaggedFollowUps = followUps.filter((f) => f.flaggedForAdmin && f.status === 'open').length;
    const needSupportCheckins = todayCheckins.filter(
      (c) => c.status !== 'on_track' || c.followUpRequested || c.flaggedForAdmin
    ).length;

    const publishedActivities = activities.filter((a) => a.status === 'published').length;
    const expectedTotalSubmissions = activeMembers.length * publishedActivities;
    const outstandingActivities = Math.max(0, expectedTotalSubmissions - completedSubmissions);

    return {
      totalParticipants: members.length,
      activeParticipants: activeMembers.length,
      totalPartners: partners.length,
      totalCohorts: cohorts.length,
      activitiesCreated: activities.length,
      activitiesCompleted: completedSubmissions,
      outstandingActivities,
      todayCheckinsCount: todayCheckins.length,
      totalCheckins: checkins.length,
      thisWeekReportsCount: thisWeekReports.length,
      totalReports: reports.length,
      inactiveParticipants: inactiveMembers.length,
      needFollowUp: flaggedFollowUps + needSupportCheckins,
      pendingReviews,
    };
  }, [users, cohorts, activities, submissions, checkins, reports, followUps, todayKey, weekKey, inactivityDays]);

  const checkinTrend = useMemo(() => {
    const days: Array<{ date: string; onTrack: number; needsAttention: number }> = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
        d.getDate()
      ).padStart(2, '0')}`;
      const dayItems = checkins.filter((c) => c.checkinDate === key);
      days.push({
        date: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        onTrack: dayItems.filter((c) => c.status === 'on_track').length,
        needsAttention: dayItems.filter((c) => c.status !== 'on_track').length,
      });
    }
    return days;
  }, [checkins]);

  const auditResourceTypes = useMemo(() => {
    const types = new Set<string>();
    for (const log of auditLogs) {
      if (log.targetType) types.add(log.targetType);
    }
    return Array.from(types).sort();
  }, [auditLogs]);

  const filteredAuditLogs = useMemo(() => {
    const q = auditSearch.trim().toLowerCase();
    return auditLogs.filter((log) => {
      if (auditCategory !== 'all' && log.category !== auditCategory) return false;
      if (auditSeverity !== 'all' && log.severity !== auditSeverity) return false;
      if (auditResourceFilter !== 'all' && log.targetType !== auditResourceFilter) return false;
      if (q) {
        const hay = `${log.actorName} ${log.actorRole} ${log.action} ${log.category} ${log.targetType} ${log.targetId} ${log.summary}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [auditLogs, auditSearch, auditCategory, auditSeverity, auditResourceFilter]);

  if (!profile) return null;

  const handleExportFilteredAuditCsv = () => {
    exportAuditLogsCsv(filteredAuditLogs);
    void recordAuditEvent({
      actorId: profile.uid,
      actorName: profile.displayName,
      actorRole: role,
      action: 'EXPORT_AUDIT_LOGS_CSV',
      category: 'export',
      severity: 'info',
      targetType: 'audit_logs',
      targetId: 'admin_dashboard',
      summary: `Exported ${filteredAuditLogs.length} filtered immutable audit log entries to CSV from Admin Dashboard.`,
    });
  };

  const handleSeed = async () => {
    setSeeding(true);
    setSeedError(null);
    try {
      await seedCiiProgrammeData(profile);
    } catch (err) {
      setSeedError(
        err instanceof Error ? err.message : 'Unable to initialize the programme baseline.'
      );
    } finally {
      setSeeding(false);
    }
  };

  const handleBootstrapSuperAdmin = async () => {
    setBootstrapError(null);
    setBootstrapping(true);
    try {
      await bootstrapOwnerSuperAdmin(profile);
    } catch (err) {
      setBootstrapError(
        err instanceof Error
          ? err.message
          : 'Only the verified Firebase project owner can initialize the first Super Admin.'
      );
    } finally {
      setBootstrapping(false);
    }
  };

  return (
    <AppShell
      title={
        role === 'reviewer'
          ? 'Review Control Centre'
          : role === 'programme_manager'
            ? 'Programme Manager Control Centre'
            : 'Administrator Control Centre'
      }
      breadcrumb={`${ROLE_LABELS[role]} /`}
      actions={
        canManageActivities(role) ? (
          <Link
            to="/admin/activities/create"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-900 dark:bg-emerald-600 hover:bg-slate-800 dark:hover:bg-emerald-500 text-white text-xs sm:text-sm font-medium whitespace-nowrap"
          >
            <Plus className="w-4 h-4 shrink-0" />
            <span>Create Activity</span>
          </Link>
        ) : undefined
      }
    >
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div
              key={i}
              className="h-24 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 animate-pulse"
            />
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {role === 'admin' && !hasAnySuperAdmin && (
            <div className="bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                  Activate Initial Super Admin Access
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  No Super Admin is configured yet. The verified project owner can activate Super Admin privileges (enforced by Firestore Security Rules) to unlock Admin User Management (<span className="font-mono">/admin/users</span>) and Programme Settings.
                </p>
                {bootstrapError && (
                  <p className="text-xs text-rose-600 dark:text-rose-400 pt-1">
                    {bootstrapError}
                  </p>
                )}
              </div>
              <button
                type="button"
                disabled={bootstrapping}
                onClick={handleBootstrapSuperAdmin}
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium shrink-0 disabled:opacity-60 cursor-pointer"
              >
                {bootstrapping ? 'Activating...' : 'Activate Super Admin'}
              </button>
            </div>
          )}

          {isScopedAdminRole(role) && (profile.assignedCohortIds || []).length === 0 && (
            <div className="bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-800 rounded-xl p-5 text-xs text-amber-800 dark:text-amber-300">
              Your {ROLE_LABELS[role]} account has no cohorts assigned yet. Contact a Super Admin to assign your programme scope in <span className="font-mono">/admin/users</span>.
            </div>
          )}

          {isFullAdminRole(role) && cohorts.length === 0 && activities.length === 0 && (
            <div className="bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                  Initialize Baseline CII Programme Structure
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {isSuperAdminRole(role)
                    ? 'Create 2 starter cohorts, 4 published CII activities, an opening announcement, and default governance settings in Firestore.'
                    : 'No programme structure exists yet. A Super Admin must initialize the baseline cohorts, activities, announcement, and governance settings.'}
                </p>
                {seedError && (
                  <p className="text-xs text-rose-600 dark:text-rose-400 pt-1">{seedError}</p>
                )}
              </div>
              {isSuperAdminRole(role) && (
                <button
                  type="button"
                  disabled={seeding}
                  onClick={handleSeed}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium shrink-0 disabled:opacity-60 cursor-pointer"
                >
                  <Database className="w-4 h-4" />
                  {seeding ? 'Initializing...' : 'Initialize Baseline Data'}
                </button>
              )}
            </div>
          )}

          {/* Admin Dashboard View Switcher */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
            <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 self-start">
              <button
                type="button"
                onClick={() => setActiveTab('overview')}
                className={`px-3.5 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                  activeTab === 'overview'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Programme Overview
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('audit')}
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                  activeTab === 'audit'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Immutable Audit Logs ({auditLogs.length})</span>
              </button>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Append-only governance log · Modifications &amp; deletions disabled by Firestore Security Rules
            </p>
          </div>

          {activeTab === 'overview' && (
            <>
              {/* 8 Real-Time Programme KPI Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-1">
              <p className="text-xs text-slate-500 dark:text-slate-400">Participants (Active / Total)</p>
              <p className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
                {metrics.activeParticipants}{' '}
                <span className="text-sm font-normal text-slate-400">/ {metrics.totalParticipants}</span>
              </p>
              <Link
                to="/admin/participants"
                className="text-xs text-emerald-700 dark:text-emerald-400 hover:underline inline-flex items-center gap-1"
              >
                Manage participants <ArrowRight className="w-3 h-3" />
              </Link>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-1">
              <p className="text-xs text-slate-500 dark:text-slate-400">Partners & Cohorts</p>
              <p className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
                {metrics.totalPartners}{' '}
                <span className="text-sm font-normal text-slate-400">
                  partners · {metrics.totalCohorts} cohorts
                </span>
              </p>
              <Link
                to="/admin/partners"
                className="text-xs text-emerald-700 dark:text-emerald-400 hover:underline"
              >
                View partners & cohorts
              </Link>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-1">
              <p className="text-xs text-slate-500 dark:text-slate-400">Activities Created / Approved</p>
              <p className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
                {metrics.activitiesCreated}{' '}
                <span className="text-sm font-normal text-emerald-600 dark:text-emerald-400">
                  ({metrics.activitiesCompleted} approved)
                </span>
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                <span className="font-mono tabular-nums">{metrics.outstandingActivities}</span> outstanding deliverables
              </p>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-1">
              <p className="text-xs text-slate-500 dark:text-slate-400">Daily Check-Ins (Today / Total)</p>
              <p className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
                {metrics.todayCheckinsCount}{' '}
                <span className="text-sm font-normal text-slate-400">/ {metrics.totalCheckins}</span>
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Period: {todayKey}</p>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-1">
              <p className="text-xs text-slate-500 dark:text-slate-400">Weekly Reports ({weekKey})</p>
              <p className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
                {metrics.thisWeekReportsCount}{' '}
                <span className="text-sm font-normal text-slate-400">({metrics.totalReports} total)</span>
              </p>
              <Link
                to="/admin/reports"
                className="text-xs text-emerald-700 dark:text-emerald-400 hover:underline"
              >
                Inspect reports
              </Link>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-1">
              <p className="text-xs text-slate-500 dark:text-slate-400">Pending Reviews</p>
              <p className="text-2xl font-bold font-mono tabular-nums text-indigo-600 dark:text-indigo-400">
                {metrics.pendingReviews}
              </p>
              <Link
                to="/admin/submissions"
                className="text-xs text-emerald-700 dark:text-emerald-400 hover:underline"
              >
                Review submissions
              </Link>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-1">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Inactive Participants (&ge;{inactivityDays}d)
              </p>
              <p className="text-2xl font-bold font-mono tabular-nums text-rose-600 dark:text-rose-400">
                {metrics.inactiveParticipants}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">No check-in within threshold</p>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-1">
              <p className="text-xs text-slate-500 dark:text-slate-400">Follow-Ups / Escalations</p>
              <p className="text-2xl font-bold font-mono tabular-nums text-amber-600 dark:text-amber-400">
                {metrics.needFollowUp}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Support alerts & admin flags
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
            <section className="xl:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                    7-Day Daily Check-In Engagement
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Real-time check-in count by status across all cohorts
                  </p>
                </div>
                <Link
                  to="/admin/analytics"
                  className="text-xs font-medium text-emerald-700 dark:text-emerald-400 hover:underline"
                >
                  Full analytics
                </Link>
              </div>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={checkinTrend} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                    <XAxis dataKey="date" tick={{ fill: axisColor, fontSize: 11 }} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fill: axisColor, fontSize: 11 }} tickLine={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: tooltipBg,
                        borderColor: tooltipBorder,
                        borderRadius: '0.5rem',
                        fontSize: '12px',
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="onTrack"
                      name="On Track"
                      stroke="#059669"
                      fill="#059669"
                      fillOpacity={0.2}
                    />
                    <Area
                      type="monotone"
                      dataKey="needsAttention"
                      name="Need Support / Blocked"
                      stroke="#d97706"
                      fill="#d97706"
                      fillOpacity={0.2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </section>

            <section className="xl:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Flag className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                  <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                    Recent System Audit Activity
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('audit')}
                  className="text-xs font-medium text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer"
                >
                  Inspect filtered audit log
                </button>
              </div>

              {auditLogs.length === 0 ? (
                <p className="text-xs text-slate-500 py-8 text-center">No audit events recorded yet.</p>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {auditLogs.slice(0, 6).map((log) => (
                    <div key={log.id} className="py-2.5 first:pt-0 last:pb-0 text-xs space-y-0.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-indigo-600 dark:text-indigo-400">
                          {log.action}
                        </span>
                        <span className="font-mono text-[11px] text-slate-400">
                          {formatTimestamp(log.createdAt)}
                        </span>
                      </div>
                      <p className="text-slate-700 dark:text-slate-300 line-clamp-2">{log.summary}</p>
                      <p className="text-[11px] text-slate-400 font-mono">
                        Actor: {log.actorName} ({ROLE_LABELS[normalizeRole(log.actorRole)]}) · Resource: {log.targetType}/{log.targetId}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
            </>
          )}

          {/* Immutable Administrative Audit Logs Section (Visible in Audit tab and below overview) */}
          <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                    Immutable Administrative Audit Trail
                  </h2>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Tracks who performed each administrative action, when it occurred, and the affected resource. Records are write-once (<span className="font-mono">allow update, delete: if false</span>).
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleExportFilteredAuditCsv}
                  disabled={filteredAuditLogs.length === 0}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export Filtered Audit CSV ({filteredAuditLogs.length})</span>
                </button>
                {isFullAdminRole(role) && (
                  <Link
                    to="/admin/settings"
                    className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    Governance Settings
                  </Link>
                )}
              </div>
            </div>

            {/* Audit Log Filters */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="search"
                  value={auditSearch}
                  onChange={(e) => setAuditSearch(e.target.value)}
                  placeholder="Filter by actor, action, resource ID..."
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                />
              </div>

              <select
                value={auditCategory}
                onChange={(e) => setAuditCategory(e.target.value as AuditCategory | 'all')}
                className="px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
              >
                <option value="all">All Action Categories</option>
                <option value="rbac">RBAC &amp; Admin Users</option>
                <option value="auth">Authentication</option>
                <option value="activity">Activities &amp; Submissions</option>
                <option value="cohort">Cohorts</option>
                <option value="report">Weekly Reports</option>
                <option value="checkin">Daily Check-Ins</option>
                <option value="announcement">Announcements</option>
                <option value="settings">Programme Settings</option>
                <option value="export">Data Exports</option>
              </select>

              <select
                value={auditResourceFilter}
                onChange={(e) => setAuditResourceFilter(e.target.value)}
                className="px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
              >
                <option value="all">All Affected Resources</option>
                {auditResourceTypes.map((rt) => (
                  <option key={rt} value={rt}>
                    Resource: {rt}
                  </option>
                ))}
              </select>

              <select
                value={auditSeverity}
                onChange={(e) => setAuditSeverity(e.target.value as AuditSeverity | 'all')}
                className="px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
              >
                <option value="all">All Severities</option>
                <option value="critical">Critical</option>
                <option value="warning">Warning</option>
                <option value="info">Info</option>
              </select>
            </div>

            {/* Filtered Immutable Audit Log Table */}
            <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-lg">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 text-xs font-semibold text-slate-500 dark:text-slate-400">
                    <th className="py-2.5 px-3">When (Timestamp)</th>
                    <th className="py-2.5 px-3">Who (Actor &amp; Role)</th>
                    <th className="py-2.5 px-3">Administrative Action</th>
                    <th className="py-2.5 px-3">Affected Resource</th>
                    <th className="py-2.5 px-3">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                  {filteredAuditLogs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-500">
                        No immutable audit log entries match the selected filters.
                      </td>
                    </tr>
                  ) : (
                    filteredAuditLogs.slice(0, activeTab === 'audit' ? 100 : 15).map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                        <td className="py-2.5 px-3 font-mono tabular-nums text-slate-500 dark:text-slate-400 whitespace-nowrap">
                          {formatTimestamp(log.createdAt)}
                        </td>
                        <td className="py-2.5 px-3">
                          <p className="font-medium text-slate-900 dark:text-white">
                            {log.actorName}
                          </p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            {ROLE_LABELS[normalizeRole(log.actorRole)]}
                          </p>
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span className="font-mono font-medium text-indigo-600 dark:text-indigo-400">
                            {log.action}
                          </span>
                          <span
                            className={`ml-2 text-[10px] font-mono uppercase ${
                              log.severity === 'critical'
                                ? 'text-rose-600 dark:text-rose-400 font-semibold'
                                : log.severity === 'warning'
                                  ? 'text-amber-600 dark:text-amber-400'
                                  : 'text-slate-400'
                            }`}
                          >
                            {log.severity}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600 dark:text-slate-300 whitespace-nowrap">
                          <span className="text-slate-400">{log.targetType}:</span> {log.targetId}
                        </td>
                        <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300 max-w-md">
                          {log.summary}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </AppShell>
  );
}
