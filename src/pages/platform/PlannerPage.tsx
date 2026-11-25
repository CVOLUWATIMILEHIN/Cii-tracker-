import React, { useEffect, useMemo, useState } from 'react';
import {
  CalendarDays,
  CalendarRange,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  Columns3,
  List,
  Loader2,
  Pencil,
  Play,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { PlatformShell } from '../../components/PlatformShell';
import { TaskFormModal } from '../../components/platform/TaskFormModal';
import { useAuth } from '../../context/AuthContext';
import { usePlatform } from '../../context/PlatformContext';
import { getTodayDateKey } from '../../lib/validators';
import {
  PlannerTask,
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  TaskStatus,
} from '../../platformTypes';
import {
  deleteTask,
  recalculateGoalProgress,
  saveTask,
  setTaskStatus,
} from '../../services/platformService';

type PlannerView = 'list' | 'daily' | 'weekly' | 'monthly' | 'calendar';
type StatusFilter = 'open' | 'all' | 'completed' | 'blocked' | 'rescheduled';

const VIEW_TABS: { value: PlannerView; label: string; icon: typeof List }[] = [
  { value: 'list', label: 'Task list', icon: List },
  { value: 'daily', label: 'Daily', icon: CalendarDays },
  { value: 'weekly', label: 'Weekly', icon: CalendarRange },
  { value: 'monthly', label: 'Monthly', icon: Columns3 },
  { value: 'calendar', label: 'Calendar', icon: CalendarRange },
];

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'all', label: 'All' },
  { value: 'completed', label: 'Completed' },
  { value: 'blocked', label: 'Blocked' },
  { value: 'rescheduled', label: 'Rescheduled' },
];

function keyFromDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y || 1970, (m || 1) - 1, d || 1);
}

function addDaysToKey(key: string, days: number): string {
  const date = parseDateKey(key);
  date.setDate(date.getDate() + days);
  return keyFromDate(date);
}

function formatDateKey(key: string): string {
  if (!key) return 'No date';
  const date = parseDateKey(key);
  return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

const PRIORITY_BADGE: Record<string, string> = {
  high: 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300',
  medium: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
  low: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
};

const STATUS_BADGE: Record<TaskStatus, string> = {
  not_started: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  in_progress: 'bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300',
  completed: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
  blocked: 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300',
  rescheduled: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
};

export function PlannerPage() {
  const { profile } = useAuth();
  const { tasks, goals, milestones, loading, workspace, ensureWorkspace } = usePlatform();

  const [view, setView] = useState<PlannerView>('list');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('open');
  const [goalFilter, setGoalFilter] = useState('');
  const [search, setSearch] = useState('');
  const [monthCursor, setMonthCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const [modalOpen, setModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<PlannerTask | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reasonTarget, setReasonTarget] = useState<{
    task: PlannerTask;
    type: 'blocked' | 'rescheduled';
  } | null>(null);
  const todayKey = getTodayDateKey();

  useEffect(() => {
    if (!loading && !workspace) void ensureWorkspace();
  }, [loading, workspace, ensureWorkspace]);

  const goalTitleById = useMemo(() => {
    const map = new Map<string, string>();
    goals.forEach((g) => map.set(g.id, g.title));
    return map;
  }, [goals]);

  const milestoneTitleById = useMemo(() => {
    const map = new Map<string, string>();
    milestones.forEach((m) => map.set(m.id, m.title));
    return map;
  }, [milestones]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return tasks
      .filter((task) => {
        if (goalFilter && task.goalId !== goalFilter) return false;
        if (statusFilter === 'open' && (task.status === 'completed' || task.status === 'rescheduled')) {
          return false;
        }
        if (statusFilter !== 'open' && statusFilter !== 'all' && task.status !== statusFilter) {
          return false;
        }
        if (term && !`${task.title} ${task.description}`.toLowerCase().includes(term)) return false;
        return true;
      })
      .sort((a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999'));
  }, [tasks, statusFilter, goalFilter, search]);

  const refreshProgress = async (task: PlannerTask) => {
    if (!profile || !task.goalId) return;
    await recalculateGoalProgress(profile.uid, task.goalId);
  };

  const handleStatus = async (task: PlannerTask, status: TaskStatus, reason = '') => {
    setBusyId(task.id);
    try {
      await setTaskStatus(task, status, reason);
      await refreshProgress(task);
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (task: PlannerTask) => {
    if (!window.confirm(`Delete task "${task.title}"? This cannot be undone.`)) return;
    setBusyId(task.id);
    try {
      await deleteTask(task);
      await refreshProgress(task);
    } finally {
      setBusyId(null);
    }
  };

  const handleReasonSubmit = async (reason: string, newDueDate?: string) => {
    if (!reasonTarget || !profile) return;
    const { task, type } = reasonTarget;
    setBusyId(task.id);
    try {
      await setTaskStatus(task, type, reason);
      if (type === 'rescheduled' && newDueDate && newDueDate !== task.dueDate) {
        await saveTask({
          actor: profile,
          workspaceId: task.workspaceId,
          taskId: task.id,
          values: {
            title: task.title,
            description: task.description,
            dueDate: newDueDate,
            priority: task.priority,
            goalId: task.goalId,
            milestoneId: task.milestoneId,
            recurrence: task.recurrence,
            reminderAt: task.reminderAt,
          },
        });
      }
      await refreshProgress(task);
      setReasonTarget(null);
    } finally {
      setBusyId(null);
    }
  };

  const renderTask = (task: PlannerTask, compact = false) => {
    const goalTitle = task.goalId ? goalTitleById.get(task.goalId) : '';
    const milestoneTitle = task.milestoneId ? milestoneTitleById.get(task.milestoneId) : '';
    const overdue = task.status !== 'completed' && task.status !== 'rescheduled' && task.dueDate && task.dueDate < todayKey;
    return (
      <div
        key={task.id}
        className={`rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 ${
          compact ? 'p-2.5' : 'p-4'
        }`}
      >
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={() =>
              void handleStatus(
                task,
                task.status === 'completed' ? 'not_started' : 'completed'
              )
            }
            disabled={busyId === task.id}
            aria-label={task.status === 'completed' ? `Reopen ${task.title}` : `Complete ${task.title}`}
            className="mt-0.5 text-slate-300 dark:text-slate-600 hover:text-emerald-600 dark:hover:text-emerald-400 cursor-pointer disabled:opacity-50 shrink-0"
          >
            {task.status === 'completed' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            ) : (
              <Circle className="w-4 h-4" />
            )}
          </button>

          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-start justify-between gap-2">
              <p
                className={`text-sm font-medium truncate ${
                  task.status === 'completed'
                    ? 'text-slate-500 dark:text-slate-400 line-through'
                    : 'text-slate-900 dark:text-white'
                }`}
              >
                {task.title}
              </p>
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0 ${PRIORITY_BADGE[task.priority]}`}>
                {TASK_PRIORITY_LABELS[task.priority]}
              </span>
            </div>

            {!compact && task.description && (
              <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2">{task.description}</p>
            )}

            <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
              <span className={overdue ? 'text-rose-600 dark:text-rose-400 font-medium' : ''}>
                {overdue ? 'Overdue · ' : ''}
                {formatDateKey(task.dueDate)}
              </span>
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${STATUS_BADGE[task.status]}`}>
                {TASK_STATUS_LABELS[task.status]}
              </span>
              {goalTitle && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="truncate">{goalTitle}</span>
                </>
              )}
              {milestoneTitle && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="truncate">{milestoneTitle}</span>
                </>
              )}
            </div>

            {(task.blockedReason || task.rescheduleReason) && (
              <p className="text-[11px] text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/60 rounded px-2 py-1">
                <span className="font-medium">
                  {task.status === 'blocked' ? 'Blocked reason' : 'Reschedule reason'}:
                </span>{' '}
                {task.blockedReason || task.rescheduleReason}
              </p>
            )}

            {!compact && (
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                {task.status === 'not_started' && (
                  <button
                    type="button"
                    disabled={busyId === task.id}
                    onClick={() => void handleStatus(task, 'in_progress')}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded border border-slate-200 dark:border-slate-700 text-[11px] font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer disabled:opacity-50"
                  >
                    <Play className="w-3 h-3" />
                    Start
                  </button>
                )}
                {task.status !== 'completed' && (
                  <>
                    <button
                      type="button"
                      onClick={() => setReasonTarget({ task, type: 'blocked' })}
                      className="px-2 py-1 rounded border border-rose-200 dark:border-rose-900/60 text-[11px] font-medium text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                    >
                      Block
                    </button>
                    <button
                      type="button"
                      onClick={() => setReasonTarget({ task, type: 'rescheduled' })}
                      className="px-2 py-1 rounded border border-amber-200 dark:border-amber-900/60 text-[11px] font-medium text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/40 cursor-pointer"
                    >
                      Reschedule
                    </button>
                  </>
                )}
                {task.status === 'completed' || task.status === 'blocked' || task.status === 'rescheduled' ? (
                  <button
                    type="button"
                    disabled={busyId === task.id}
                    onClick={() => void handleStatus(task, 'not_started')}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded border border-slate-200 dark:border-slate-700 text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer disabled:opacity-50"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Reopen
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => {
                    setEditingTask(task);
                    setModalOpen(true);
                  }}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded border border-slate-200 dark:border-slate-700 text-[11px] font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                >
                  <Pencil className="w-3 h-3" />
                  Edit
                </button>
                <button
                  type="button"
                  disabled={busyId === task.id}
                  onClick={() => void handleDelete(task)}
                  aria-label={`Delete ${task.title}`}
                  className="p-1 rounded text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 cursor-pointer disabled:opacity-50"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const openTasks = filtered.filter((t) => t.status !== 'completed' && t.status !== 'rescheduled');

  const renderDaily = () => {
    const todayTasks = filtered.filter((t) => t.dueDate === todayKey);
    const overdue = openTasks.filter((t) => t.dueDate && t.dueDate < todayKey);
    const noDate = openTasks.filter((t) => !t.dueDate);
    return (
      <div className="space-y-5">
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
            Overdue ({overdue.length})
          </h2>
          {overdue.length === 0 ? (
            <p className="text-xs text-slate-500 dark:text-slate-400">Nothing overdue.</p>
          ) : (
            <div className="space-y-2">{overdue.map((t) => renderTask(t, true))}</div>
          )}
        </section>
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
            Today · {formatDateKey(todayKey)} ({todayTasks.length})
          </h2>
          {todayTasks.length === 0 ? (
            <p className="text-xs text-slate-500 dark:text-slate-400">No tasks scheduled for today.</p>
          ) : (
            <div className="space-y-2">{todayTasks.map((t) => renderTask(t))}</div>
          )}
        </section>
        {noDate.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              No due date ({noDate.length})
            </h2>
            <div className="space-y-2">{noDate.map((t) => renderTask(t, true))}</div>
          </section>
        )}
      </div>
    );
  };

  const renderWeekly = () => {
    const days = Array.from({ length: 7 }, (_, i) => addDaysToKey(todayKey, i));
    return (
      <div className="space-y-4">
        {days.map((key) => {
          const dayTasks = filtered.filter((t) => t.dueDate === key);
          return (
            <section key={key} className="space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                  {formatDateKey(key)}
                  {key === todayKey && (
                    <span className="ml-2 text-[10px] font-medium text-violet-600 dark:text-violet-400 uppercase">
                      Today
                    </span>
                  )}
                </h2>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  {dayTasks.length} {dayTasks.length === 1 ? 'task' : 'tasks'}
                </span>
              </div>
              {dayTasks.length === 0 ? (
                <p className="text-[11px] text-slate-400 dark:text-slate-500">No tasks.</p>
              ) : (
                <div className="space-y-2">{dayTasks.map((t) => renderTask(t, true))}</div>
              )}
            </section>
          );
        })}
      </div>
    );
  };

  const renderMonthly = () => {
    const monthPrefix = `${monthCursor.getFullYear()}-${String(monthCursor.getMonth() + 1).padStart(2, '0')}`;
    const monthTasks = filtered.filter((t) => t.dueDate.startsWith(monthPrefix));
    const groups = new Map<string, PlannerTask[]>();
    monthTasks.forEach((task) => {
      const date = parseDateKey(task.dueDate);
      const day = date.getDate();
      const weekIndex = Math.floor((day - 1) / 7) + 1;
      const key = `Week ${weekIndex} (${monthPrefix}-${String((weekIndex - 1) * 7 + 1).padStart(2, '0')}–${String(
        Math.min(weekIndex * 7, new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 0).getDate())
      ).padStart(2, '0')})`;
      const bucket = groups.get(key) || [];
      bucket.push(task);
      groups.set(key, bucket);
    });
    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
            {monthCursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
          </h2>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setMonthCursor(new Date(monthCursor.getFullYear(), monthCursor.getMonth() - 1, 1))}
              aria-label="Previous month"
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setMonthCursor(new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 1))}
              aria-label="Next month"
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
        {monthTasks.length === 0 ? (
          <p className="text-xs text-slate-500 dark:text-slate-400">No tasks due this month.</p>
        ) : (
          Array.from(groups.entries()).map(([label, list]) => (
            <section key={label} className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {label}
              </h3>
              <div className="space-y-2">{list.map((t) => renderTask(t, true))}</div>
            </section>
          ))
        )}
      </div>
    );
  };

  const renderCalendar = () => {
    const year = monthCursor.getFullYear();
    const month = monthCursor.getMonth();
    const firstDay = new Date(year, month, 1);
    const startOffset = (firstDay.getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: (string | null)[] = Array.from({ length: startOffset }, () => null);
    for (let day = 1; day <= daysInMonth; day += 1) {
      cells.push(keyFromDate(new Date(year, month, day)));
    }
    while (cells.length % 7 !== 0) cells.push(null);

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
            {monthCursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
          </h2>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setMonthCursor(new Date(year, month - 1, 1))}
              aria-label="Previous month"
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setMonthCursor(new Date(year, month + 1, 1))}
              aria-label="Next month"
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-400">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
            <div key={d} className="py-1">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((key, index) => {
            if (!key) return <div key={`empty-${index}`} className="min-h-16 rounded-lg" />;
            const dayTasks = filtered.filter((t) => t.dueDate === key);
            const isToday = key === todayKey;
            return (
              <div
                key={key}
                className={`min-h-16 rounded-lg border p-1.5 space-y-1 ${
                  isToday
                    ? 'border-violet-400 dark:border-violet-600 bg-violet-50/50 dark:bg-violet-950/20'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
                }`}
              >
                <p className={`text-[11px] font-semibold ${isToday ? 'text-violet-700 dark:text-violet-300' : 'text-slate-600 dark:text-slate-300'}`}>
                  {parseDateKey(key).getDate()}
                </p>
                {dayTasks.slice(0, 2).map((task) => (
                  <p
                    key={task.id}
                    title={task.title}
                    className={`text-[10px] truncate rounded px-1 py-0.5 ${STATUS_BADGE[task.status]}`}
                  >
                    {task.title}
                  </p>
                ))}
                {dayTasks.length > 2 && (
                  <p className="text-[10px] text-slate-400">+{dayTasks.length - 2} more</p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <PlatformShell
      title="Execution Planner"
      breadcrumb="Personal Workspace /"
      subtitle="Daily, weekly, monthly and calendar views over the same task list."
      actions={
        <button
          type="button"
          onClick={() => {
            setEditingTask(null);
            setModalOpen(true);
          }}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold cursor-pointer whitespace-nowrap"
        >
          <Plus className="w-3.5 h-3.5" />
          New task
        </button>
      }
    >
      <div className="space-y-5">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 sm:p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {VIEW_TABS.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => setView(tab.value)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                    view === tab.value
                      ? 'bg-violet-600 text-white'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-[1fr_150px_170px] gap-2">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search tasks"
                aria-label="Search tasks"
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 pl-9 pr-3 py-2 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              aria-label="Filter by status"
              className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500"
            >
              {STATUS_FILTERS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
            <select
              value={goalFilter}
              onChange={(e) => setGoalFilter(e.target.value)}
              aria-label="Filter by goal"
              className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500"
            >
              <option value="">All goals</option>
              {goals.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.title}
                </option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-20 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 animate-pulse" />
            ))}
          </div>
        ) : tasks.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-10 text-center space-y-3">
            <CalendarRange className="w-8 h-8 text-violet-400 mx-auto" />
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Your planner is empty</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
              Add your first task. Link it to a goal or milestone so progress updates automatically
              when it is completed.
            </p>
            <button
              type="button"
              onClick={() => {
                setEditingTask(null);
                setModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Add a task
            </button>
          </div>
        ) : view === 'list' ? (
          filtered.length === 0 ? (
            <p className="text-xs text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 text-center">
              No tasks match these filters.
            </p>
          ) : (
            <div className="space-y-2">{filtered.map((t) => renderTask(t))}</div>
          )
        ) : view === 'daily' ? (
          renderDaily()
        ) : view === 'weekly' ? (
          renderWeekly()
        ) : view === 'monthly' ? (
          renderMonthly()
        ) : (
          renderCalendar()
        )}
      </div>

      <TaskFormModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingTask(null);
        }}
        initialTask={editingTask}
        onSaved={() => {
          if (editingTask?.goalId) void refreshProgress(editingTask);
        }}
      />

      {reasonTarget && (
        <ReasonModal
          task={reasonTarget.task}
          type={reasonTarget.type}
          busy={busyId === reasonTarget.task.id}
          onClose={() => setReasonTarget(null)}
          onSubmit={(reason, newDueDate) => void handleReasonSubmit(reason, newDueDate)}
        />
      )}
    </PlatformShell>
  );
}

function ReasonModal({
  task,
  type,
  busy,
  onClose,
  onSubmit,
}: {
  task: PlannerTask;
  type: 'blocked' | 'rescheduled';
  busy: boolean;
  onClose: () => void;
  onSubmit: (reason: string, newDueDate?: string) => void;
}) {
  const [reason, setReason] = useState('');
  const [newDueDate, setNewDueDate] = useState(task.dueDate || getTodayDateKey());
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (reason.trim().length < 3) {
      setError('Record a short reason (at least 3 characters).');
      return;
    }
    onSubmit(reason.trim(), type === 'rescheduled' ? newDueDate : undefined);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs" onClick={busy ? undefined : onClose} aria-hidden="true" />
      <form
        onSubmit={handleSubmit}
        role="dialog"
        aria-modal="true"
        aria-label={type === 'blocked' ? 'Record blocker' : 'Record reschedule'}
        className="relative z-10 w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl p-5 space-y-4"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              {type === 'blocked' ? 'What is blocking this task?' : 'Why is this task being rescheduled?'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">{task.title}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Close"
            className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          maxLength={300}
          placeholder="Be specific enough to help future you."
          aria-label="Reason"
          className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500"
        />

        {type === 'rescheduled' && (
          <div>
            <label htmlFor="reschedule-date" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              New due date
            </label>
            <input
              id="reschedule-date"
              type="date"
              value={newDueDate}
              onChange={(e) => setNewDueDate(e.target.value)}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500"
            />
          </div>
        )}

        {error && (
          <p className="text-xs text-rose-600 dark:text-rose-400" role="alert">
            {error}
          </p>
        )}

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold cursor-pointer disabled:opacity-60"
          >
            {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {type === 'blocked' ? 'Mark blocked' : 'Reschedule'}
          </button>
        </div>
      </form>
    </div>
  );
}
