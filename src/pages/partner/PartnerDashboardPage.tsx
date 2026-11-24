import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CalendarCheck, FileCheck2, MessageSquareMore, Users } from 'lucide-react';
import { AppShell } from '../../components/AppShell';
import { CheckinStatusLabel, ReportStatusLabel, SubmissionStatusLabel } from '../../components/StatusText';
import { useWorkspace } from '../../context/WorkspaceContext';
import { getTodayDateKey } from '../../lib/validators';

export function PartnerDashboardPage() {
  const { assignedMembers, checkins, submissions, reports, followUps, settings, loading } =
    useWorkspace();

  const todayKey = getTodayDateKey();
  const inactivityDays = settings?.inactivityThresholdDays ?? 3;

  const stats = useMemo(() => {
    const todayCheckins = checkins.filter((c) => c.checkinDate === todayKey);
    const onTrackToday = todayCheckins.filter((c) => c.status === 'on_track').length;
    const missedToday = assignedMembers.filter(
      (m) => !todayCheckins.some((c) => c.memberId === m.uid)
    ).length;
    const needFollowUp = assignedMembers.filter((m) => {
      const latest = checkins.find((c) => c.memberId === m.uid);
      if (latest && (latest.status !== 'on_track' || latest.followUpRequested)) return true;
      return followUps.some((f) => f.memberId === m.uid && f.status === 'open');
    }).length;
    const pendingActivityReviews = submissions.filter(
      (s) => s.status === 'submitted' || s.status === 'under_review'
    ).length;
    const pendingReportReviews = reports.filter(
      (r) => r.status === 'submitted' || r.status === 'under_review'
    ).length;

    const cutoffMs = Date.now() - inactivityDays * 86400000;
    const inactiveMembers = assignedMembers.filter((m) => {
      const latest = checkins.find((c) => c.memberId === m.uid);
      if (!latest || !latest.createdAt) return true;
      return latest.createdAt.toMillis() < cutoffMs;
    });

    return {
      total: assignedMembers.length,
      onTrackToday,
      missedToday,
      needFollowUp,
      pendingActivityReviews,
      pendingReportReviews,
      inactiveMembers,
    };
  }, [assignedMembers, checkins, submissions, reports, followUps, todayKey, inactivityDays]);

  return (
    <AppShell title="Accountability Partner Dashboard" breadcrumb="Partner /">
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="h-28 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 animate-pulse"
            />
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-1">
              <p className="text-xs text-slate-500 dark:text-slate-400">Total Assigned Members</p>
              <p className="text-3xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
                {stats.total}
              </p>
              <Link
                to="/partner/members"
                className="text-xs text-emerald-700 dark:text-emerald-400 hover:underline inline-flex items-center gap-1"
              >
                <span>View caseload</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-1">
              <p className="text-xs text-slate-500 dark:text-slate-400">On Track Today</p>
              <p className="text-3xl font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                {stats.onTrackToday}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                <span className="font-mono tabular-nums">{stats.missedToday}</span> missed check-in today
              </p>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-1">
              <p className="text-xs text-slate-500 dark:text-slate-400">Members Requiring Follow-Up</p>
              <p className="text-3xl font-bold font-mono tabular-nums text-amber-600 dark:text-amber-400">
                {stats.needFollowUp}
              </p>
              <Link
                to="/partner/follow-ups"
                className="text-xs text-emerald-700 dark:text-emerald-400 hover:underline inline-flex items-center gap-1"
              >
                <span>Manage follow-ups</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-1">
              <p className="text-xs text-slate-500 dark:text-slate-400">Pending Activity Reviews</p>
              <p className="text-3xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
                {stats.pendingActivityReviews}
              </p>
              <Link
                to="/partner/reviews"
                className="text-xs text-emerald-700 dark:text-emerald-400 hover:underline"
              >
                Open review queue
              </Link>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-1">
              <p className="text-xs text-slate-500 dark:text-slate-400">Weekly Reports Awaiting Review</p>
              <p className="text-3xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
                {stats.pendingReportReviews}
              </p>
              <Link
                to="/partner/reviews"
                className="text-xs text-emerald-700 dark:text-emerald-400 hover:underline"
              >
                Review weekly reports
              </Link>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-1">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Inactive Members (&ge;{inactivityDays}d)
              </p>
              <p className="text-3xl font-bold font-mono tabular-nums text-rose-600 dark:text-rose-400">
                {stats.inactiveMembers.length}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                No recent daily check-in recorded
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
            <section className="xl:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CalendarCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                    Recent Member Check-Ins
                  </h2>
                </div>
                <Link
                  to="/partner/check-ins"
                  className="text-xs font-medium text-emerald-700 dark:text-emerald-400 hover:underline"
                >
                  View all
                </Link>
              </div>

              {checkins.length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-slate-400 py-8 text-center">
                  No check-ins recorded from assigned members yet.
                </p>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {checkins.slice(0, 6).map((c) => (
                    <div key={c.id} className="py-3 first:pt-0 last:pb-0 space-y-1">
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <Link
                          to={`/partner/members/${c.memberId}`}
                          className="font-semibold text-slate-900 dark:text-white hover:underline"
                        >
                          {c.memberName}
                        </Link>
                        <div className="flex items-center gap-2">
                          <CheckinStatusLabel status={c.status} />
                          <span className="font-mono text-slate-400">{c.checkinDate}</span>
                        </div>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300">
                        {c.updateText || 'No written note provided.'}
                      </p>
                      {c.followUpRequested && (
                        <p className="text-[11px] font-medium text-amber-600 dark:text-amber-400">
                          Member requested follow-up
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="xl:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileCheck2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                    Items Awaiting Review
                  </h2>
                </div>
                <Link
                  to="/partner/reviews"
                  className="text-xs font-medium text-emerald-700 dark:text-emerald-400 hover:underline"
                >
                  Review queue
                </Link>
              </div>

              {stats.pendingActivityReviews + stats.pendingReportReviews === 0 ? (
                <p className="text-xs text-slate-500 dark:text-slate-400 py-8 text-center">
                  All assigned submissions and weekly reports are up to date.
                </p>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {submissions
                    .filter((s) => s.status === 'submitted' || s.status === 'under_review')
                    .slice(0, 4)
                    .map((s) => (
                      <div key={s.id} className="py-3 first:pt-0 last:pb-0 text-xs space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-slate-900 dark:text-white truncate">
                            {s.activityTitle}
                          </span>
                          <SubmissionStatusLabel status={s.status} />
                        </div>
                        <p className="text-slate-500 dark:text-slate-400">
                          Activity · {s.memberName}
                        </p>
                      </div>
                    ))}
                  {reports
                    .filter((r) => r.status === 'submitted' || r.status === 'under_review')
                    .slice(0, 4)
                    .map((r) => (
                      <div key={r.id} className="py-3 first:pt-0 last:pb-0 text-xs space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-slate-900 dark:text-white">
                            Weekly Report ({r.weekLabel})
                          </span>
                          <ReportStatusLabel status={r.status} />
                        </div>
                        <p className="text-slate-500 dark:text-slate-400">Report · {r.memberName}</p>
                      </div>
                    ))}
                </div>
              )}

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
                <span className="inline-flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5" />
                  Caseload scoped strictly to your assigned members
                </span>
                <Link to="/partner/follow-ups" className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                  <MessageSquareMore className="w-3.5 h-3.5" />
                  <span>{followUps.filter((f) => f.status === 'open').length} open</span>
                </Link>
              </div>
            </section>
          </div>
        </div>
      )}
    </AppShell>
  );
}
