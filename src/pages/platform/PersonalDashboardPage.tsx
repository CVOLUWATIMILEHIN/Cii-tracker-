import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  CalendarCheck,
  CalendarRange,
  CheckCircle2,
  CheckSquare,
  Circle,
  Clock,
  Compass,
  Flag,
  HeartHandshake,
  Plus,
  Sparkles,
  Target,
  Users,
} from 'lucide-react';
import { PlatformShell } from '../../components/PlatformShell';
import { GoalFormModal } from '../../components/platform/GoalFormModal';
import { TaskFormModal } from '../../components/platform/TaskFormModal';
import { useAuth } from '../../context/AuthContext';
import { usePlatform } from '../../context/PlatformContext';
import { getMillis } from '../../services/ciiService';
import { recalculateGoalProgress, setTaskStatus } from '../../services/platformService';
import { getTodayDateKey } from '../../lib/validators';
import { PlannerTask, progressTone } from '../../platformTypes';

function formatDateKey(key: string): string {
  if (!key) return 'No date';
  const parsed = new Date(`${key}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return key;
  return parsed.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

function addDaysToKey(key: string, days: number): string {
  const parsed = new Date(`${key}T00:00:00`);
  parsed.setDate(parsed.getDate() + days);
  return parsed.toISOString().slice(0, 10);
}

export function PersonalDashboardPage() {
  const { profile, role } = useAuth();
  const {
    workspace,
    goals,
    milestones,
    tasks,
    loading,
    ensureWorkspace,
  } = usePlatform();

  const [goalModalOpen, setGoalModalOpen] = useState(false);
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && profile && !workspace) {
      void ensureWorkspace();
    }
  }, [loading, profile?.uid, workspace, ensureWorkspace]);

  const todayKey = getTodayDateKey();
  const weekAheadKey = addDaysToKey(todayKey, 7);
  const twoWeeksKey = addDaysToKey(todayKey, 14);

  const activeGoals = useMemo(() => goals.filter((g) => g.status === 'active'), [goals]);

  const openTasks = useMemo(
    () => tasks.filter((t) => t.status !== 'completed' && t.status !== 'rescheduled'),
    [tasks]
  );

  const overdueTasks = useMemo(
    () => openTasks.filter((t) => t.dueDate && t.dueDate < todayKey),
    [openTasks, todayKey]
  );

  const todayTasks = useMemo(
    () => openTasks.filter((t) => t.dueDate === todayKey),
    [openTasks, todayKey]
  );

  const upcomingTasks = useMemo(
    () =>
      openTasks
        .filter((t) => t.dueDate && t.dueDate > todayKey && t.dueDate <= weekAheadKey)
        .slice(0, 6),
    [openTasks, todayKey, weekAheadKey]
  );

  const dueMilestones = useMemo(
    () =>
      milestones
        .filter(
          (m) =>
            m.status !== 'completed' && m.dueDate && m.dueDate <= twoWeeksKey
        )
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
        .slice(0, 5),
    [milestones, twoWeeksKey]
  );

  const completedLastWeek = useMemo(() => {
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return tasks.filter((t) => t.status === 'completed' && getMillis(t.completedAt) >= cutoff).length;
  }, [tasks]);

  const goalTitleById = useMemo(() => {
    const map = new Map<string, string>();
    goals.forEach((g) => map.set(g.id, g.title));
    return map;
  }, [goals]);

  const todayLabel = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  if (!profile) return null;

  const handleCompleteTask = async (task: PlannerTask) => {
    setBusyTaskId(task.id);
    try {
      await setTaskStatus(task, 'completed');
      if (task.goalId) await recalculateGoalProgress(profile.uid, task.goalId);
    } finally {
      setBusyTaskId(null);
    }
  };

  const priorities = [...overdueTasks, ...todayTasks].slice(0, 5);

  return (
    <PlatformShell
      title="Personal Dashboard"
      breadcrumb="Personal Workspace /"
      subtitle="From intention to execution — one day at a time."
      actions={
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setTaskModalOpen(true)}
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            Add task
          </button>
          <button
            type="button"
            onClick={() => setGoalModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold cursor-pointer whitespace-nowrap"
          >
            <Target className="w-3.5 h-3.5" />
            New goal
          </button>
        </div>
      }
    >
      <div className="space-y-6">
        {!profile.onboardingCompletedAt && (
          <section className="rounded-xl border border-violet-200 dark:border-violet-900/60 bg-violet-50 dark:bg-violet-950/30 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <Compass className="w-5 h-5 text-violet-600 dark:text-violet-300 shrink-0 mt-0.5" />
              <div>
                <h2 className="text-sm font-semibold text-violet-900 dark:text-violet-100">
                  Finish your quick setup
                </h2>
                <p className="text-xs text-violet-800/80 dark:text-violet-200/80">
                  Two short steps to personalise your workspace. It takes about a minute.
                </p>
              </div>
            </div>
            <Link
              to="/onboarding"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold whitespace-nowrap self-start sm:self-auto"
            >
              Continue setup
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </section>
        )}

        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 sm:p-6">
          <p className="text-xs font-medium text-violet-600 dark:text-violet-400">{todayLabel}</p>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white font-display mt-1">
            Welcome back, {profile.displayName.split(/\s+/)[0]}
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            {workspace ? (
              <>
                Workspace: <span className="font-medium text-slate-800 dark:text-slate-200">{workspace.name}</span>
                {' · '}
                {activeGoals.length} active {activeGoals.length === 1 ? 'goal' : 'goals'}
              </>
            ) : (
              'Preparing your personal workspace...'
            )}
          </p>
        </section>

        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 sm:p-5 space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
              <Target className="w-3.5 h-3.5 text-violet-500" />
              Active goals
            </div>
            <p className="text-2xl sm:text-3xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
              {activeGoals.length}
            </p>
            <Link to="/goals" className="text-[11px] text-violet-600 dark:text-violet-400 hover:underline">
              Open goals
            </Link>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 sm:p-5 space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
              <CalendarCheck className="w-3.5 h-3.5 text-amber-500" />
              Due today
            </div>
            <p className="text-2xl sm:text-3xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
              {todayTasks.length}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {todayTasks.length === 0 ? 'Nothing scheduled' : 'Still open for today'}
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 sm:p-5 space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
              Overdue
            </div>
            <p
              className={`text-2xl sm:text-3xl font-bold font-mono tabular-nums ${
                overdueTasks.length > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-white'
              }`}
            >
              {overdueTasks.length}
            </p>
            <Link to="/planner" className="text-[11px] text-violet-600 dark:text-violet-400 hover:underline">
              Review planner
            </Link>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 sm:p-5 space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              Completed this week
            </div>
            <p className="text-2xl sm:text-3xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
              {completedLastWeek}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">Last 7 days</p>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          <div className="xl:col-span-7 space-y-6">
            <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 sm:p-6 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <CheckSquare className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                  <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                    Today&rsquo;s priorities
                  </h2>
                </div>
                <Link to="/planner" className="text-xs font-medium text-violet-600 dark:text-violet-400 hover:underline">
                  Open planner
                </Link>
              </div>

              {loading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-12 rounded-lg bg-slate-100 dark:bg-slate-800 animate-pulse" />
                  ))}
                </div>
              ) : priorities.length === 0 ? (
                <div className="text-center py-6 space-y-3">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Nothing is due today. Add a task or schedule your next action.
                  </p>
                  <button
                    type="button"
                    onClick={() => setTaskModalOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add a task
                  </button>
                </div>
              ) : (
                <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                  {priorities.map((task) => {
                    const overdue = task.dueDate && task.dueDate < todayKey;
                    return (
                      <li key={task.id} className="py-3 first:pt-0 last:pb-0 flex items-start gap-3">
                        <button
                          type="button"
                          onClick={() => void handleCompleteTask(task)}
                          disabled={busyTaskId === task.id}
                          aria-label={`Mark "${task.title}" as completed`}
                          className="mt-0.5 text-slate-300 dark:text-slate-600 hover:text-emerald-600 dark:hover:text-emerald-400 cursor-pointer disabled:opacity-50"
                        >
                          {busyTaskId === task.id ? (
                            <CheckCircle2 className="w-4 h-4" />
                          ) : (
                            <Circle className="w-4 h-4" />
                          )}
                        </button>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                            {task.title}
                          </p>
                          <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                            <span className={overdue ? 'text-rose-600 dark:text-rose-400 font-medium' : ''}>
                              {overdue ? 'Overdue · ' : ''}
                              {formatDateKey(task.dueDate)}
                            </span>
                            {task.goalId && goalTitleById.get(task.goalId) && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="truncate">{goalTitleById.get(task.goalId)}</span>
                              </>
                            )}
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                task.priority === 'high'
                                  ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
                                  : task.priority === 'medium'
                                    ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                                    : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                              }`}
                            >
                              {task.priority}
                            </span>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 sm:p-6 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Target className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                  <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                    Active goals
                  </h2>
                </div>
                <Link to="/goals" className="text-xs font-medium text-violet-600 dark:text-violet-400 hover:underline">
                  View all ({goals.length})
                </Link>
              </div>

              {activeGoals.length === 0 ? (
                <div className="text-center py-6 space-y-3">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    No active goals yet. A clear goal turns intention into a plan.
                  </p>
                  <button
                    type="button"
                    onClick={() => setGoalModalOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Create your first goal
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {activeGoals.slice(0, 4).map((goal) => {
                    const goalMilestones = milestones.filter((m) => m.goalId === goal.id);
                    const done = goalMilestones.filter((m) => m.status === 'completed').length;
                    return (
                      <Link
                        key={goal.id}
                        to={`/goals/${goal.id}`}
                        className="block rounded-lg border border-slate-200 dark:border-slate-800 p-3.5 hover:border-violet-300 dark:hover:border-violet-700 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                              {goal.title}
                            </p>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                              {goal.category} · {goal.horizonMonths === 1 ? '1 month' : `${goal.horizonMonths} months`} ·{' '}
                              {goalMilestones.length > 0
                                ? `${done}/${goalMilestones.length} milestones`
                                : 'No milestones yet'}
                            </p>
                          </div>
                          <span className={`text-sm font-bold font-mono tabular-nums shrink-0 ${progressTone(goal.progress)}`}>
                            {goal.progress}%
                          </span>
                        </div>
                        <div className="mt-2.5 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-violet-600 dark:bg-violet-500 transition-all"
                            style={{ width: `${Math.min(100, Math.max(0, goal.progress))}%` }}
                          />
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </section>
          </div>

          <div className="xl:col-span-5 space-y-6">
            <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 sm:p-6 space-y-3">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                  Next 7 days
                </h2>
              </div>
              {upcomingTasks.length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-slate-400 py-2">
                  No scheduled tasks in the next week.
                </p>
              ) : (
                <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                  {upcomingTasks.map((task) => (
                    <li key={task.id} className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-slate-900 dark:text-white truncate">
                          {task.title}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          {formatDateKey(task.dueDate)}
                          {task.goalId && goalTitleById.get(task.goalId)
                            ? ` · ${goalTitleById.get(task.goalId)}`
                            : ''}
                        </p>
                      </div>
                      <span className="text-[10px] font-mono uppercase text-slate-400 shrink-0">
                        {task.priority}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <Link
                to="/planner"
                className="inline-flex items-center gap-1 text-xs font-medium text-violet-600 dark:text-violet-400 hover:underline"
              >
                Open full planner
                <ArrowRight className="w-3 h-3" />
              </Link>
            </section>

            <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 sm:p-6 space-y-3">
              <div className="flex items-center gap-2">
                <Flag className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                  Milestones due soon
                </h2>
              </div>
              {dueMilestones.length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-slate-400 py-2">
                  No milestones due in the next two weeks.
                </p>
              ) : (
                <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                  {dueMilestones.map((milestone) => (
                    <li key={milestone.id} className="py-2.5 first:pt-0 last:pb-0">
                      <Link to={`/goals/${milestone.goalId}`} className="block group">
                        <p className="text-xs font-medium text-slate-900 dark:text-white truncate group-hover:text-violet-600 dark:group-hover:text-violet-400">
                          {milestone.title}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          Due {formatDateKey(milestone.dueDate)} · {goalTitleById.get(milestone.goalId) || 'Goal'}
                        </p>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 sm:p-6 space-y-3">
              <div className="flex items-center gap-2">
                <CalendarRange className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                  Connected workspaces
                </h2>
              </div>
              <div className="space-y-2">
                {role === 'member' && (
                  <Link
                    to="/community/cii"
                    className="flex items-center justify-between gap-3 rounded-lg border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/30 px-3 py-2.5 hover:border-emerald-300"
                  >
                    <span className="flex items-center gap-2.5 min-w-0">
                      <Users className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span className="min-w-0">
                        <span className="block text-xs font-semibold text-emerald-900 dark:text-emerald-100">
                          CII Community
                        </span>
                        <span className="block text-[11px] text-emerald-700/80 dark:text-emerald-300/80">
                          Activities, check-ins and weekly reports
                        </span>
                      </span>
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  </Link>
                )}
                {role === 'partner' && (
                  <Link
                    to="/partner"
                    className="flex items-center justify-between gap-3 rounded-lg border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/30 px-3 py-2.5 hover:border-emerald-300"
                  >
                    <span className="flex items-center gap-2.5 min-w-0">
                      <HeartHandshake className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span className="min-w-0">
                        <span className="block text-xs font-semibold text-emerald-900 dark:text-emerald-100">
                          CII Partner Console
                        </span>
                        <span className="block text-[11px] text-emerald-700/80 dark:text-emerald-300/80">
                          Assigned members and reviews
                        </span>
                      </span>
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  </Link>
                )}
                {(role === 'super_admin' || role === 'admin' || role === 'programme_manager' || role === 'reviewer') && (
                  <Link
                    to="/admin"
                    className="flex items-center justify-between gap-3 rounded-lg border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/30 px-3 py-2.5 hover:border-emerald-300"
                  >
                    <span className="flex items-center gap-2.5 min-w-0">
                      <Users className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span className="min-w-0">
                        <span className="block text-xs font-semibold text-emerald-900 dark:text-emerald-100">
                          CII Admin Console
                        </span>
                        <span className="block text-[11px] text-emerald-700/80 dark:text-emerald-300/80">
                          Programme administration
                        </span>
                      </span>
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  </Link>
                )}
              </div>

              <div className="rounded-lg border border-dashed border-slate-200 dark:border-slate-700 p-3 space-y-1">
                <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-600 dark:text-slate-300">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  Arriving in later phases
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  Weekly reviews, affirmations, coach and business workspaces, and SMT – Your
                  Companion are on the roadmap. This page only shows what is actually available.
                </p>
              </div>
            </section>
          </div>
        </div>
      </div>

      <GoalFormModal open={goalModalOpen} onClose={() => setGoalModalOpen(false)} />
      <TaskFormModal open={taskModalOpen} onClose={() => setTaskModalOpen(false)} />
    </PlatformShell>
  );
}
