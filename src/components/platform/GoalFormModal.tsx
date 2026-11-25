import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { usePlatform } from '../../context/PlatformContext';
import { getTodayDateKey } from '../../lib/validators';
import {
  addMonthsToDateKey,
  GOAL_CATEGORIES,
  GOAL_HORIZONS,
  Goal,
  GoalCategory,
  GoalHorizon,
} from '../../platformTypes';
import { saveGoal } from '../../services/platformService';

const inputClass =
  'w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500';
const labelClass = 'block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5';

export function GoalFormModal({
  open,
  onClose,
  initialGoal,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  initialGoal?: Goal | null;
  onSaved?: (goalId: string) => void;
}) {
  const { profile } = useAuth();
  const { workspaceId, ensureWorkspace } = usePlatform();

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<GoalCategory>('Personal Development');
  const [horizon, setHorizon] = useState<GoalHorizon>(3);
  const [startDate, setStartDate] = useState(getTodayDateKey());
  const [targetDate, setTargetDate] = useState(addMonthsToDateKey(getTodayDateKey(), 3));
  const [targetTouched, setTargetTouched] = useState(false);
  const [why, setWhy] = useState('');
  const [baseline, setBaseline] = useState('');
  const [targetOutcome, setTargetOutcome] = useState('');
  const [successCriteria, setSuccessCriteria] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (initialGoal) {
      setTitle(initialGoal.title);
      setCategory(initialGoal.category);
      setHorizon(initialGoal.horizonMonths);
      setStartDate(initialGoal.startDate);
      setTargetDate(initialGoal.targetDate);
      setTargetTouched(true);
      setWhy(initialGoal.why);
      setBaseline(initialGoal.baseline);
      setTargetOutcome(initialGoal.targetOutcome);
      setSuccessCriteria(initialGoal.successCriteria);
    } else {
      const today = getTodayDateKey();
      setTitle('');
      setCategory('Personal Development');
      setHorizon(3);
      setStartDate(today);
      setTargetDate(addMonthsToDateKey(today, 3));
      setTargetTouched(false);
      setWhy('');
      setBaseline('');
      setTargetOutcome('');
      setSuccessCriteria('');
    }
  }, [open, initialGoal?.id]);

  const suggestedTarget = useMemo(
    () => addMonthsToDateKey(startDate || getTodayDateKey(), horizon),
    [startDate, horizon]
  );

  useEffect(() => {
    if (!targetTouched) setTargetDate(suggestedTarget);
  }, [suggestedTarget, targetTouched]);

  if (!open) return null;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!profile) return;
    if (title.trim().length < 3) {
      setError('Give your goal a title of at least 3 characters.');
      return;
    }
    if (!startDate || !targetDate) {
      setError('Choose a start date and a target date.');
      return;
    }
    if (targetDate < startDate) {
      setError('The target date must be on or after the start date.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const activeWorkspaceId = workspaceId || (await ensureWorkspace())?.id || '';
      const goalId = await saveGoal({
        actor: profile,
        workspaceId: activeWorkspaceId,
        goalId: initialGoal?.id,
        values: {
          title: title.trim(),
          category,
          why,
          baseline,
          targetOutcome,
          successCriteria,
          horizonMonths: horizon,
          startDate,
          targetDate,
        },
      });
      onSaved?.(goalId);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save this goal.');
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
        aria-label={initialGoal ? 'Edit goal' : 'Create goal'}
        className="relative z-10 w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl my-8"
      >
        <div className="flex items-start justify-between gap-4 px-5 sm:px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white font-display">
              {initialGoal ? 'Edit goal' : 'Create a goal'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Your planning horizon is independent of any subscription period.
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
            <label htmlFor="goal-title" className={labelClass}>
              Goal title
            </label>
            <input
              id="goal-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={140}
              placeholder="e.g. Launch my freelance design service"
              className={inputClass}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="goal-category" className={labelClass}>
                Category
              </label>
              <select
                id="goal-category"
                value={category}
                onChange={(e) => setCategory(e.target.value as GoalCategory)}
                className={inputClass}
              >
                {GOAL_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="goal-horizon" className={labelClass}>
                Planning horizon
              </label>
              <select
                id="goal-horizon"
                value={horizon}
                onChange={(e) => {
                  setHorizon(Number(e.target.value) as GoalHorizon);
                  setTargetTouched(false);
                }}
                className={inputClass}
              >
                {GOAL_HORIZONS.map((h) => (
                  <option key={h} value={h}>
                    {h === 1 ? '1 month' : h === 12 ? '12 months' : `${h} months`}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="goal-start" className={labelClass}>
                Start date
              </label>
              <input
                id="goal-start"
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setTargetTouched(false);
                }}
                className={inputClass}
                required
              />
            </div>
            <div>
              <label htmlFor="goal-target" className={labelClass}>
                Target date
              </label>
              <input
                id="goal-target"
                type="date"
                value={targetDate}
                onChange={(e) => {
                  setTargetDate(e.target.value);
                  setTargetTouched(true);
                }}
                className={inputClass}
                required
              />
            </div>
          </div>

          <div>
            <label htmlFor="goal-why" className={labelClass}>
              Why does this goal matter?
            </label>
            <textarea
              id="goal-why"
              value={why}
              onChange={(e) => setWhy(e.target.value)}
              maxLength={2000}
              rows={2}
              placeholder="The reason you will keep showing up for this goal."
              className={inputClass}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="goal-baseline" className={labelClass}>
                Current baseline
              </label>
              <textarea
                id="goal-baseline"
                value={baseline}
                onChange={(e) => setBaseline(e.target.value)}
                maxLength={2000}
                rows={2}
                placeholder="Where are you starting from today?"
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="goal-outcome" className={labelClass}>
                Desired outcome
              </label>
              <textarea
                id="goal-outcome"
                value={targetOutcome}
                onChange={(e) => setTargetOutcome(e.target.value)}
                maxLength={2000}
                rows={2}
                placeholder="What does success look like?"
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label htmlFor="goal-criteria" className={labelClass}>
              Measurable success criteria
            </label>
            <textarea
              id="goal-criteria"
              value={successCriteria}
              onChange={(e) => setSuccessCriteria(e.target.value)}
              maxLength={2000}
              rows={2}
              placeholder="How will you know this goal is complete? e.g. 5 paying clients"
              className={inputClass}
            />
          </div>

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
            {initialGoal ? 'Save changes' : 'Create goal'}
          </button>
        </div>
      </form>
    </div>
  );
}
