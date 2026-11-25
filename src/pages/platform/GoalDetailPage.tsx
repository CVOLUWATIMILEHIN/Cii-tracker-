import React, { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  Flag,
  Loader2,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react';
import { PlatformShell } from '../../components/PlatformShell';
import { GoalFormModal } from '../../components/platform/GoalFormModal';
import { TaskFormModal } from '../../components/platform/TaskFormModal';
import { useAuth } from '../../context/AuthContext';
import { usePlatform } from '../../context/PlatformContext';
import { getTodayDateKey } from '../../lib/validators';
import {
  GOAL_STATUS_LABELS,
  MILESTONE_STATUS_LABELS,
  Milestone,
  PlannerTask,
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  progressTone,
} from '../../platformTypes';
import {
  deleteMilestone,
  deleteTask,
  recalculateGoalProgress,
  saveMilestone,
  setMilestoneStatus,
  setTaskStatus,
} from '../../services/platformService';

const inputClass =
  'w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500';

const STATUS_BADGE: Record<string, string> = {
  active: 'bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300',
  paused: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
  completed: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
  archived: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
};

export function GoalDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { profile } = useAuth();
  const { goals, milestones, tasks, loading, workspace } = usePlatform();

  const goal = goals.find((g) => g.id === id) || null;
  const goalMilestones = useMemo(
    () => milestones.filter((m) => m.goalId === id).sort((a, b) => a.order - b.order),
    [milestones, id]
  );
  const goalTasks = useMemo(() => tasks.filter((t) => t.goalId === id), [tasks, id]);

  const [editOpen, setEditOpen] = useState(false);
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<PlannerTask | null>(null);
  const [milestoneTitle, setMilestoneTitle] = useState('');
  const [milestoneDue, setMilestoneDue] = useState(getTodayDateKey());
  const [addingMilestone, setAddingMilestone] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!profile) return null;

  if (!goal) {
    if (loading || !workspace) {
      return (
        <PlatformShell title="Goal" breadcrumb="Personal Workspace /">
          <div className="h-64 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 animate-pulse" />
        </PlatformShell>
      );
    }
    return (
      <PlatformShell title="Goal not found" breadcrumb="Personal Workspace /">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-10 text-center space-y-3">
          <Flag className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto" />
          <h1 className="text-sm font-semibold text-slate-900 dark:text-white">
            This goal is not available
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            It may belong to another workspace or no longer exist.
          </p>
          <Link
            to="/goals"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to goals
          </Link>
        </div>
      </PlatformShell>
    );
  }

  const refreshProgress = async () => {
    await recalculateGoalProgress(profile.uid, goal.id);
  };

  const handleAddMilestone = async (event: React.FormEvent) => {
    event.preventDefault();
    if (milestoneTitle.trim().length < 2) {
      setError('Give the milestone a title of at least 2 characters.');
      return;
    }
    setAddingMilestone(true);
    setError(null);
    try {
      await saveMilestone({
        actor: profile,
        goalId: goal.id,
        title: milestoneTitle.trim(),
        dueDate: milestoneDue,
        order: goalMilestones.length,
      });
      setMilestoneTitle('');
      await refreshProgress();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add this milestone.');
    } finally {
      setAddingMilestone(false);
    }
  };

  const handleMilestoneStatus = async (milestone: Milestone, next: Milestone['status']) => {
    setBusyId(milestone.id);
    try {
      await setMilestoneStatus(milestone, next);
      await refreshProgress();
    } finally {
      setBusyId(null);
    }
  };

  const handleDeleteMilestone = async (milestone: Milestone) => {
    if (!window.confirm(`Delete milestone "${milestone.title}"? This cannot be undone.`)) return;
    setBusyId(milestone.id);
    try {
      await deleteMilestone(milestone);
      await refreshProgress();
    } finally {
      setBusyId(null);
    }
  };

  const handleTaskStatus = async (task: PlannerTask, next: PlannerTask['status']) => {
    setBusyId(task.id);
    try {
      await setTaskStatus(task, next);
      await refreshProgress();
    } finally {
      setBusyId(null);
    }
  };

  const handleDeleteTask = async (task: PlannerTask) => {
    if (!window.confirm(`Delete task "${task.title}"? This cannot be undone.`)) return;
    setBusyId(task.id);
    try {
      await deleteTask(task);
      await refreshProgress();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <PlatformShell
      title={goal.title}
      breadcrumb="Goals /"
      subtitle={`${goal.category} · ${goal.horizonMonths === 1 ? '1 month' : `${goal.horizonMonths} months`} horizon`}
      actions={
        <button
          type="button"
          onClick={() => setEditOpen(true)}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer whitespace-nowrap"
        >
          <Pencil className="w-3.5 h-3.5" />
          Edit goal
        </button>
      }
    >
      <div className="space-y-6">
        <Link
          to="/goals"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 dark:hover:text-white"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to goals
        </Link>

        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 sm:p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="space-y-2 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide ${STATUS_BADGE[goal.status]}`}>
                  {GOAL_STATUS_LABELS[goal.status]}
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">{goal.category}</span>
              </div>
              <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white font-display">
                {goal.title}
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {goal.startDate} → {goal.targetDate}
              </p>
            </div>
            <div className="sm:text-right shrink-0">
              <p className={`text-3xl font-bold font-mono tabular-nums ${progressTone(goal.progress)}`}>
                {goal.progress}%
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {goalMilestones.length > 0 ? 'From milestones' : 'From completed tasks'}
              </p>
            </div>
          </div>

          <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
            <div
              className="h-full rounded-full bg-violet-600 dark:bg-violet-500"
              style={{ width: `${Math.min(100, Math.max(0, goal.progress))}%` }}
            />
          </div>

          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Why this matters</dt>
              <dd className="text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-wrap">
                {goal.why || 'Not recorded yet.'}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Desired outcome</dt>
              <dd className="text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-wrap">
                {goal.targetOutcome || 'Not recorded yet.'}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Current baseline</dt>
              <dd className="text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-wrap">
                {goal.baseline || 'Not recorded yet.'}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Success criteria</dt>
              <dd className="text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-wrap">
                {goal.successCriteria || 'Not recorded yet.'}
              </dd>
            </div>
          </dl>
        </section>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          <section className="xl:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Flag className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">Milestones</h2>
              </div>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {goalMilestones.filter((m) => m.status === 'completed').length}/{goalMilestones.length} done
              </span>
            </div>

            {goalMilestones.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400 py-2">
                No milestones yet. Milestones break the goal into checkpoints and drive progress.
              </p>
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {goalMilestones.map((milestone) => (
                  <li key={milestone.id} className="py-3 first:pt-0 last:pb-0 flex items-start gap-3">
                    <span className="mt-0.5 text-slate-300 dark:text-slate-600">
                      {milestone.status === 'completed' ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      ) : (
                        <Circle className="w-4 h-4" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm font-medium ${milestone.status === 'completed' ? 'text-slate-500 dark:text-slate-400 line-through' : 'text-slate-900 dark:text-white'}`}>
                        {milestone.title}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Due {milestone.dueDate} · {MILESTONE_STATUS_LABELS[milestone.status]}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center justify-end gap-1.5 shrink-0">
                      {milestone.status === 'pending' && (
                        <button
                          type="button"
                          disabled={busyId === milestone.id}
                          onClick={() => void handleMilestoneStatus(milestone, 'in_progress')}
                          className="px-2 py-1 rounded border border-slate-200 dark:border-slate-700 text-[11px] font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer disabled:opacity-50"
                        >
                          Start
                        </button>
                      )}
                      {milestone.status !== 'completed' && (
                        <button
                          type="button"
                          disabled={busyId === milestone.id}
                          onClick={() => void handleMilestoneStatus(milestone, 'completed')}
                          className="px-2 py-1 rounded border border-emerald-200 dark:border-emerald-900/60 text-[11px] font-medium text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 cursor-pointer disabled:opacity-50"
                        >
                          Complete
                        </button>
                      )}
                      {milestone.status === 'completed' && (
                        <button
                          type="button"
                          disabled={busyId === milestone.id}
                          onClick={() => void handleMilestoneStatus(milestone, 'pending')}
                          className="px-2 py-1 rounded border border-slate-200 dark:border-slate-700 text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer disabled:opacity-50"
                        >
                          Reopen
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={busyId === milestone.id}
                        onClick={() => void handleDeleteMilestone(milestone)}
                        aria-label={`Delete milestone ${milestone.title}`}
                        className="p-1 rounded text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 cursor-pointer disabled:opacity-50"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <form onSubmit={handleAddMilestone} className="grid grid-cols-1 sm:grid-cols-[1fr_150px_auto] gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <input
                type="text"
                value={milestoneTitle}
                onChange={(e) => setMilestoneTitle(e.target.value)}
                maxLength={120}
                placeholder="Add a milestone"
                aria-label="Milestone title"
                className={inputClass}
              />
              <input
                type="date"
                value={milestoneDue}
                onChange={(e) => setMilestoneDue(e.target.value)}
                aria-label="Milestone due date"
                className={inputClass}
              />
              <button
                type="submit"
                disabled={addingMilestone}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-slate-900 dark:bg-slate-700 text-white text-xs font-medium hover:bg-slate-800 dark:hover:bg-slate-600 cursor-pointer disabled:opacity-60 whitespace-nowrap"
              >
                {addingMilestone ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                Add
              </button>
            </form>
            {error && (
              <p className="text-xs text-rose-600 dark:text-rose-400" role="alert">
                {error}
              </p>
            )}
          </section>

          <section className="xl:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">Linked tasks</h2>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditingTask(null);
                  setTaskModalOpen(true);
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-[11px] font-semibold cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                Add task
              </button>
            </div>

            {goalTasks.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400 py-2">
                No tasks linked to this goal. Add one to start moving it forward.
              </p>
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {goalTasks.map((task) => (
                  <li key={task.id} className="py-3 first:pt-0 last:pb-0 space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-sm font-medium ${task.status === 'completed' ? 'text-slate-500 dark:text-slate-400 line-through' : 'text-slate-900 dark:text-white'}`}>
                        {task.title}
                      </p>
                      <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 shrink-0">
                        {TASK_PRIORITY_LABELS[task.priority]}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {TASK_STATUS_LABELS[task.status]}
                      {task.dueDate ? ` · due ${task.dueDate}` : ''}
                    </p>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {task.status !== 'completed' ? (
                        <button
                          type="button"
                          disabled={busyId === task.id}
                          onClick={() => void handleTaskStatus(task, 'completed')}
                          className="px-2 py-1 rounded border border-emerald-200 dark:border-emerald-900/60 text-[11px] font-medium text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 cursor-pointer disabled:opacity-50"
                        >
                          Complete
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={busyId === task.id}
                          onClick={() => void handleTaskStatus(task, 'not_started')}
                          className="px-2 py-1 rounded border border-slate-200 dark:border-slate-700 text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer disabled:opacity-50"
                        >
                          Reopen
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setEditingTask(task);
                          setTaskModalOpen(true);
                        }}
                        className="px-2 py-1 rounded border border-slate-200 dark:border-slate-700 text-[11px] font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        disabled={busyId === task.id}
                        onClick={() => void handleDeleteTask(task)}
                        aria-label={`Delete task ${task.title}`}
                        className="p-1 rounded text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 cursor-pointer disabled:opacity-50"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      <GoalFormModal open={editOpen} onClose={() => setEditOpen(false)} initialGoal={goal} />
      <TaskFormModal
        open={taskModalOpen}
        onClose={() => {
          setTaskModalOpen(false);
          setEditingTask(null);
        }}
        initialTask={editingTask}
        defaultGoalId={goal.id}
        onSaved={() => void refreshProgress()}
      />
    </PlatformShell>
  );
}
