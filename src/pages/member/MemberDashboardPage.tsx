import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Bell,
  CalendarCheck,
  CheckCircle2,
  ClipboardList,
  Clock,
  FileText,
  Megaphone,
  UserCheck,
} from 'lucide-react';
import { AppShell } from '../../components/AppShell';
import {
  CheckinStatusLabel,
  ReportStatusLabel,
  SubmissionStatusLabel,
} from '../../components/StatusText';
import { useAuth } from '../../context/AuthContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { formatTimestamp } from '../../lib/exportReports';
import {
  getIsoWeekInfo,
  getTodayDateKey,
  isActivityAssignedToMember,
} from '../../lib/validators';

export function MemberDashboardPage() {
  const { profile } = useAuth();
  const {
    activities,
    submissions,
    checkins,
    reports,
    announcements,
    notifications,
    assignedPartner,
    loading,
  } = useWorkspace();

  const todayKey = getTodayDateKey();
  const { weekKey, weekLabel } = getIsoWeekInfo();

  const assignedActivities = useMemo(() => {
    if (!profile) return [];
    return activities.filter((a) =>
      isActivityAssignedToMember(a, profile.uid, profile.cohortId)
    );
  }, [activities, profile]);

  const submissionMap = useMemo(() => {
    const map = new Map<string, (typeof submissions)[number]>();
    submissions.forEach((s) => map.set(s.activityId, s));
    return map;
  }, [submissions]);

  const completedActivities = assignedActivities.filter((a) => {
    const sub = submissionMap.get(a.id);
    return sub && (sub.status === 'approved' || sub.status === 'submitted');
  });

  const outstandingActivities = assignedActivities.filter((a) => {
    const sub = submissionMap.get(a.id);
    return !sub || (sub.status !== 'approved' && sub.status !== 'submitted');
  });

  const overallProgress = useMemo(() => {
    if (assignedActivities.length === 0) return 0;
    const total = assignedActivities.reduce((sum, a) => {
      const sub = submissionMap.get(a.id);
      return sum + (sub ? sub.progress : 0);
    }, 0);
    return Math.round(total / assignedActivities.length);
  }, [assignedActivities, submissionMap]);

  const todayCheckin = checkins.find((c) => c.checkinDate === todayKey) || null;
  const currentWeekReport = reports.find((r) => r.weekKey === weekKey) || null;

  const recentFeedback = useMemo(() => {
    const subFeedback = submissions
      .filter((s) => s.feedbackText)
      .map((s) => ({
        id: `sub-${s.id}`,
        title: s.activityTitle,
        reviewer: s.reviewedByName || 'Reviewer',
        text: s.feedbackText,
        link: `/activities/${s.activityId}`,
        updatedAt: s.updatedAt,
      }));
    const repFeedback = reports
      .filter((r) => r.feedbackText)
      .map((r) => ({
        id: `rep-${r.id}`,
        title: `Weekly Report (${r.weekLabel})`,
        reviewer: r.reviewedByName || 'Reviewer',
        text: r.feedbackText,
        link: `/weekly-reports/${r.id}`,
        updatedAt: r.updatedAt,
      }));
    return [...subFeedback, ...repFeedback].slice(0, 4);
  }, [submissions, reports]);

  const visibleAnnouncements = useMemo(() => {
    return announcements
      .filter(
        (a) =>
          (a.targetRole === 'all' || a.targetRole === 'member') &&
          (!a.cohortId || a.cohortId === profile?.cohortId)
      )
      .slice(0, 3);
  }, [announcements, profile?.cohortId]);

  if (!profile) return null;

  return (
    <AppShell
      title="Member Dashboard"
      breadcrumb="Corps Member /"
      actions={
        <Link
          to="/check-in"
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-900 dark:bg-emerald-600 hover:bg-slate-800 dark:hover:bg-emerald-500 text-white text-xs sm:text-sm font-medium whitespace-nowrap"
        >
          <CalendarCheck className="w-4 h-4 shrink-0" />
          <span>{todayCheckin ? 'Update Check-In' : 'Daily Check-In'}</span>
        </Link>
      }
    >
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-28 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 animate-pulse"
            />
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Welcome & Context Strip */}
          <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                Corper Impact Initiative · {profile.cohortName || 'Unassigned Cohort'}
                {profile.stateCode ? ` · ${profile.stateCode}` : ''}
              </p>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
                Welcome back, {profile.displayName}
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                {profile.ppa ? `PPA: ${profile.ppa}` : 'Complete your PPA details in Profile'} ·{' '}
                Accountability Partner:{' '}
                <span className="font-medium text-slate-800 dark:text-slate-200">
                  {assignedPartner?.displayName || profile.partnerName || 'Pending Assignment'}
                </span>
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <Link
                to="/weekly-reports"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>{currentWeekReport ? 'View Weekly Report' : 'Start Weekly Report'}</span>
              </Link>
              <Link
                to="/progress"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap"
              >
                <span>View Progress</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </section>

          {/* 4 KPI Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-1.5">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Overall Activity Progress
              </p>
              <p className="text-3xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
                {overallProgress}%
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                <span className="font-mono tabular-nums text-emerald-600 dark:text-emerald-400 font-semibold">
                  {completedActivities.length}
                </span>{' '}
                completed ·{' '}
                <span className="font-mono tabular-nums">{outstandingActivities.length}</span>{' '}
                outstanding
              </p>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-1.5">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Today&rsquo;s Check-In ({todayKey})
              </p>
              <p className="text-xl font-semibold text-slate-900 dark:text-white pt-1">
                {todayCheckin ? (
                  <CheckinStatusLabel status={todayCheckin.status} />
                ) : (
                  <span className="text-amber-600 dark:text-amber-400">Not Logged</span>
                )}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                <span className="font-mono tabular-nums">{checkins.length}</span> total check-ins recorded
              </p>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-1.5">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Weekly Report ({weekLabel})
              </p>
              <p className="text-xl font-semibold text-slate-900 dark:text-white pt-1">
                {currentWeekReport ? (
                  <ReportStatusLabel status={currentWeekReport.status} />
                ) : (
                  <span className="text-amber-600 dark:text-amber-400">Pending</span>
                )}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                <span className="font-mono tabular-nums">{reports.length}</span> reports in history
              </p>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-1.5">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Unread Notifications
              </p>
              <p className="text-3xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
                {notifications.filter((n) => !n.read).length}
              </p>
              <Link
                to="/notifications"
                className="text-xs text-emerald-700 dark:text-emerald-400 hover:underline inline-block"
              >
                Open notification center
              </Link>
            </div>
          </div>

          {/* Main 2-column grid */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
            <section className="xl:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 sm:p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ClipboardList className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                    Upcoming Deadlines & Assigned Activities
                  </h3>
                </div>
                <Link
                  to="/activities"
                  className="text-xs font-medium text-emerald-700 dark:text-emerald-400 hover:underline"
                >
                  View all ({assignedActivities.length})
                </Link>
              </div>

              {assignedActivities.length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-slate-400 py-6 text-center">
                  No published activities are assigned to your cohort yet.
                </p>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {assignedActivities.slice(0, 5).map((act) => {
                    const sub = submissionMap.get(act.id);
                    return (
                      <div
                        key={act.id}
                        className="py-3.5 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                            <span className="font-mono text-emerald-700 dark:text-emerald-400 font-medium">
                              {act.code}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span>{act.pillar}</span>
                            <span aria-hidden="true">·</span>
                            <span className="inline-flex items-center gap-1 font-mono tabular-nums">
                              <Clock className="w-3 h-3" />
                              Due {act.deadline}
                            </span>
                          </div>
                          <Link
                            to={`/activities/${act.id}`}
                            className="text-sm font-semibold text-slate-900 dark:text-white hover:text-emerald-700 dark:hover:text-emerald-400 block truncate"
                          >
                            {act.title}
                          </Link>
                        </div>

                        <div className="flex items-center gap-3 shrink-0 text-xs">
                          {sub ? (
                            <SubmissionStatusLabel status={sub.status} />
                          ) : (
                            <span className="text-slate-400">Not Started</span>
                          )}
                          <Link
                            to={`/activities/${act.id}`}
                            className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap"
                          >
                            {sub ? 'Continue' : 'Start'}
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            <div className="xl:col-span-5 space-y-6">
              <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 sm:p-6 space-y-4">
                <div className="flex items-center gap-2">
                  <Megaphone className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                    Programme Announcements
                  </h3>
                </div>
                {visibleAnnouncements.length === 0 ? (
                  <p className="text-xs text-slate-500 dark:text-slate-400 py-4">
                    No active announcements at this time.
                  </p>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {visibleAnnouncements.map((ann) => (
                      <div key={ann.id} className="py-3 first:pt-0 last:pb-0 space-y-1">
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <span className="font-semibold text-slate-900 dark:text-white">
                            {ann.title}
                          </span>
                          {ann.priority === 'important' && (
                            <span className="text-rose-600 dark:text-rose-400 font-medium shrink-0">
                              Important
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                          {ann.body}
                        </p>
                        <p className="text-[11px] font-mono text-slate-400">
                          {ann.createdByName} · {formatTimestamp(ann.createdAt)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 sm:p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                      Recent Reviewer Feedback
                    </h3>
                  </div>
                  <CheckCircle2 className="w-4 h-4 text-slate-300 dark:text-slate-600" />
                </div>

                {recentFeedback.length === 0 ? (
                  <p className="text-xs text-slate-500 dark:text-slate-400 py-4">
                    Feedback from your Accountability Partner or Administrators will appear here once submissions or weekly reports are reviewed.
                  </p>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {recentFeedback.map((fb) => (
                      <Link
                        key={fb.id}
                        to={fb.link}
                        className="block py-3 first:pt-0 last:pb-0 space-y-1 hover:opacity-80"
                      >
                        <p className="text-xs font-semibold text-slate-900 dark:text-white">
                          {fb.title}
                        </p>
                        <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2">
                          {fb.text}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          {fb.reviewer} · {formatTimestamp(fb.updatedAt)}
                        </p>
                      </Link>
                    ))}
                  </div>
                )}
              </section>

              {notifications.length > 0 && (
                <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 sm:p-6 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Bell className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                        Latest Alerts
                      </h3>
                    </div>
                    <Link
                      to="/notifications"
                      className="text-xs text-emerald-700 dark:text-emerald-400 hover:underline"
                    >
                      All alerts
                    </Link>
                  </div>
                  <div className="space-y-2">
                    {notifications.slice(0, 3).map((n) => (
                      <Link
                        key={n.id}
                        to={n.linkPath || '/notifications'}
                        className="block text-xs text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white truncate"
                      >
                        <span className="font-medium text-slate-900 dark:text-slate-100">
                          {n.title}:
                        </span>{' '}
                        {n.message}
                      </Link>
                    ))}
                  </div>
                </section>
              )}
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
