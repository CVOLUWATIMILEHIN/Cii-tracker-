import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { usePlatform } from '../../context/PlatformContext';
import { getTodayDateKey } from '../../lib/validators';
import {
  PlannerTask,
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  TaskPriority,
  TaskRecurrence,
} from '../../platformTypes';
import { saveTask } from '../../services/platformService';

const inputClass =
  'w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500';
const labelClass = 'block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5';

export function TaskFormModal({
  open,
  onClose,
  initialTask,
  defaultGoalId,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  initialTask?: PlannerTask | null;
  defaultGoalId?: string;
  onSaved?: () => void;
}) {
  const { profile } = useAuth();
  const { workspaceId, goals, milestones, ensureWorkspace } = usePlatform();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [goalId, setGoalId] = useState('');
  const [milestoneId, setMilestoneId] = useState('');
  const [recurrence, setRecurrence] = useState<TaskRecurrence>('none');
  const [reminderAt, setReminderAt] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (initialTask) {
      setTitle(initialTask.title);
      setDescription(initialTask.description);
      setDueDate(initialTask.dueDate);
      setPriority(initialTask.priority);
      setGoalId(initialTask.goalId);
      setMilestoneId(initialTask.milestoneId);
      setRecurrence(initialTask.recurrence);
      setReminderAt(initialTask.reminderAt);
    } else {
      setTitle('');
      setDescription('');
      setDueDate(getTodayDateKey());
      setPriority('medium');
      setGoalId(defaultGoalId || '');
      setMilestoneId('');
      setRecurrence('none');
      setReminderAt('');
    }
  }, [open, initialTask?.id, defaultGoalId]);

  const activeGoals = useMemo(
    () => goals.filter((g) => g.status === 'active' || g.status === 'paused'),
    [goals]
  );

  const goalMilestones = useMemo(
    () => (goalId ? milestones.filter((m) => m.goalId === goalId) : []),
    [milestones, goalId]
  );

  if (!open) return null;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!profile) return;
    if (title.trim().length < 2) {
      setError('Give this task a title of at least 2 characters.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const activeWorkspaceId = workspaceId || (await ensureWorkspace())?.id || '';
      await saveTask({
        actor: profile,
        workspaceId: activeWorkspaceId,
        taskId: initialTask?.id,
        values: {
          title: title.trim(),
          description,
          dueDate,
          priority,
          goalId,
          milestoneId,
          recurrence,
          reminderAt,
        },
      });
      onSaved?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save this task.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 sm:p-6 overflow-y-auto">
      <div
        className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs"
        onClick={saving ? undefined : onClose}
        aria-hidden="true"
      />
      <form
        onSubmit={handleSubmit}
        role="dialog"
        aria-modal="true"
        aria-label={initialTask ? 'Edit task' : 'New task'}
        className="relative z-10 w-full max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl my-8"
      >
        <div className="flex items-start justify-between gap-4 px-5 sm:px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white font-display">
              {initialTask ? 'Edit task' : 'New planner task'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Tasks can stand alone or move a goal and milestone forward.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Close"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 sm:px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
          <div>
            <label htmlFor="task-title" className={labelClass}>
              Task title
            </label>
            <input
              id="task-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={140}
              placeholder="e.g. Draft the first module outline"
              className={inputClass}
              required
            />
          </div>

          <div>
            <label htmlFor="task-description" className={labelClass}>
              Description
            </label>
            <textarea
              id="task-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={1000}
              rows={2}
              className={inputClass}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="task-due" className={labelClass}>
                Due date
              </label>
              <input
                id="task-due"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="task-priority" className={labelClass}>
                Priority
              </label>
              <select
                id="task-priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className={inputClass}
              >
                {(['high', 'medium', 'low'] as TaskPriority[]).map((p) => (
                  <option key={p} value={p}>
                    {TASK_PRIORITY_LABELS[p]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="task-goal" className={labelClass}>
                Linked goal
              </label>
              <select
                id="task-goal"
                value={goalId}
                onChange={(e) => {
                  setGoalId(e.target.value);
                  setMilestoneId('');
                }}
                className={inputClass}
              >
                <option value="">No goal</option>
                {activeGoals.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.title}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="task-milestone" className={labelClass}>
                Linked milestone
              </label>
              <select
                id="task-milestone"
                value={milestoneId}
                onChange={(e) => setMilestoneId(e.target.value)}
                className={inputClass}
                disabled={!goalId || goalMilestones.length === 0}
              >
                <option value="">None</option>
                {goalMilestones.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="task-recurrence" className={labelClass}>
                Recurrence
              </label>
              <select
                id="task-recurrence"
                value={recurrence}
                onChange={(e) => setRecurrence(e.target.value as TaskRecurrence)}
                className={inputClass}
              >
                <option value="none">Does not repeat</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
            <div>
              <label htmlFor="task-reminder" className={labelClass}>
                Reminder
              </label>
              <input
                id="task-reminder"
                type="datetime-local"
                value={reminderAt}
                onChange={(e) => setReminderAt(e.target.value)}
                className={inputClass}
              />
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                Saved in-app only. Push and email reminders arrive in a later phase.
              </p>
            </div>
          </div>

          {initialTask && (
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Current status: {TASK_STATUS_LABELS[initialTask.status]}. Use the planner to change
              status so blocked or rescheduled reasons are recorded.
            </p>
          )}

          {error && (
            <p className="text-xs text-rose-600 dark:text-rose-400" role="alert">
              {error}
            </p>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 sm:px-6 py-4 border-t border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold cursor-pointer disabled:opacity-60"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {initialTask ? 'Save changes' : 'Add task'}
          </button>
        </div>
      </form>
    </div>
  );
}
