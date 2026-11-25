import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Archive,
  ArrowRight,
  CheckCircle2,
  Flag,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Search,
  Target,
} from 'lucide-react';
import { PlatformShell } from '../../components/PlatformShell';
import { GoalFormModal } from '../../components/platform/GoalFormModal';
import { usePlatform } from '../../context/PlatformContext';
import { Goal, GOAL_CATEGORIES, GOAL_STATUS_LABELS, GoalCategory, GoalStatus, progressTone } from '../../platformTypes';
import { updateGoalStatus } from '../../services/platformService';

const STATUS_TABS: { value: GoalStatus | 'all'; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
  { value: 'completed', label: 'Completed' },
  { value: 'archived', label: 'Archived' },
  { value: 'all', label: 'All' },
];

const STATUS_BADGE: Record<GoalStatus, string> = {
  active: 'bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300',
  paused: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
  completed: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
  archived: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
};

export function GoalsPage() {
  const { goals, milestones, loading, workspace, ensureWorkspace } = usePlatform();
  const [searchParams, setSearchParams] = useSearchParams();

  const [statusTab, setStatusTab] = useState<GoalStatus | 'all'>('active');
  const [category, setCategory] = useState<GoalCategory | 'all'>('all');
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(searchParams.get('new') === '1');
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [busyGoalId, setBusyGoalId] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !workspace) void ensureWorkspace();
  }, [loading, workspace, ensureWorkspace]);

  useEffect(() => {
    if (searchParams.get('new') === '1') {
      setEditingGoal(null);
      setModalOpen(true);
      const next = new URLSearchParams(searchParams);
      next.delete('new');
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return goals.filter((goal) => {
      if (statusTab !== 'all' && goal.status !== statusTab) return false;
      if (category !== 'all' && goal.category !== category) return false;
      if (term && !`${goal.title} ${goal.why} ${goal.targetOutcome}`.toLowerCase().includes(term)) {
        return false;
      }
      return true;
    });
  }, [goals, statusTab, category, search]);

  const counts = useMemo(() => {
    const map: Record<string, number> = { all: goals.length, active: 0, paused: 0, completed: 0, archived: 0 };
    goals.forEach((g) => {
      map[g.status] = (map[g.status] || 0) + 1;
    });
    return map;
  }, [goals]);

  const milestoneCountFor = (goalId: string) => {
    const list = milestones.filter((m) => m.goalId === goalId);
    return { total: list.length, done: list.filter((m) => m.status === 'completed').length };
  };

  const handleStatus = async (goal: Goal, status: GoalStatus) => {
    setBusyGoalId(goal.id);
    try {
      await updateGoalStatus(goal, status);
    } finally {
      setBusyGoalId(null);
    }
  };

  const openCreate = () => {
    setEditingGoal(null);
    setModalOpen(true);
  };

  return (
    <PlatformShell
      title="Goals"
      breadcrumb="Personal Workspace /"
      subtitle="Goals stay with you for their full horizon, regardless of billing period."
      actions={
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold cursor-pointer whitespace-nowrap"
        >
          <Plus className="w-3.5 h-3.5" />
          New goal
        </button>
      }
    >
      <div className="space-y-5">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 sm:p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => setStatusTab(tab.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  statusTab === tab.value
                    ? 'bg-violet-600 text-white'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {tab.label}
                <span className={`ml-1.5 font-mono tabular-nums text-[10px] ${statusTab === tab.value ? 'text-violet-100' : 'text-slate-400'}`}>
                  {counts[tab.value] ?? 0}
                </span>
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-[1fr_200px] gap-2">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search goals by title, why or outcome"
                aria-label="Search goals"
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 pl-9 pr-3 py-2 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500"
              />
            </div>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as GoalCategory | 'all')}
              aria-label="Filter by category"
              className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500"
            >
              <option value="all">All categories</option>
              {GOAL_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-44 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-10 text-center space-y-3">
            <Target className="w-8 h-8 text-violet-400 mx-auto" />
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                {goals.length === 0 ? 'Start with one clear goal' : 'No goals match these filters'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto leading-relaxed">
                {goals.length === 0
                  ? 'Define what success looks like, why it matters, and the horizon you are committing to. You can add milestones and tasks next.'
                  : 'Try a different status tab, category, or search term.'}
              </p>
            </div>
            {goals.length === 0 && (
              <button
                type="button"
                onClick={openCreate}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Create a goal
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filtered.map((goal) => {
              const { total, done } = milestoneCountFor(goal.id);
              return (
                <article
                  key={goal.id}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col gap-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide ${STATUS_BADGE[goal.status]}`}>
                          {GOAL_STATUS_LABELS[goal.status]}
                        </span>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">{goal.category}</span>
                      </div>
                      <Link
                        to={`/goals/${goal.id}`}
                        className="block text-sm font-semibold text-slate-900 dark:text-white hover:text-violet-600 dark:hover:text-violet-400 truncate"
                      >
                        {goal.title}
                      </Link>
                    </div>
                    <span className={`text-lg font-bold font-mono tabular-nums shrink-0 ${progressTone(goal.progress)}`}>
                      {goal.progress}%
                    </span>
                  </div>

                  <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-violet-600 dark:bg-violet-500"
                      style={{ width: `${Math.min(100, Math.max(0, goal.progress))}%` }}
                    />
                  </div>

                  <dl className="grid grid-cols-3 gap-2 text-[11px]">
                    <div>
                      <dt className="text-slate-500 dark:text-slate-400">Horizon</dt>
                      <dd className="font-medium text-slate-900 dark:text-white">
                        {goal.horizonMonths === 1 ? '1 month' : `${goal.horizonMonths} months`}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500 dark:text-slate-400">Target</dt>
                      <dd className="font-medium text-slate-900 dark:text-white">{goal.targetDate || '—'}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500 dark:text-slate-400">Milestones</dt>
                      <dd className="font-medium text-slate-900 dark:text-white inline-flex items-center gap-1">
                        <Flag className="w-3 h-3 text-slate-400" />
                        {total > 0 ? `${done}/${total}` : 'None'}
                      </dd>
                    </div>
                  </dl>

                  <div className="flex flex-wrap items-center gap-1.5 pt-1 mt-auto">
                    <Link
                      to={`/goals/${goal.id}`}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-900 dark:bg-slate-700 text-white text-[11px] font-medium hover:bg-slate-800 dark:hover:bg-slate-600"
                    >
                      Open
                      <ArrowRight className="w-3 h-3" />
                    </Link>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingGoal(goal);
                        setModalOpen(true);
                      }}
                      className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-[11px] font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                    >
                      Edit
                    </button>
                    {goal.status === 'active' && (
                      <button
                        type="button"
                        disabled={busyGoalId === goal.id}
                        onClick={() => void handleStatus(goal, 'paused')}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-[11px] font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer disabled:opacity-50"
                      >
                        <Pause className="w-3 h-3" />
                        Pause
                      </button>
                    )}
                    {(goal.status === 'paused' || goal.status === 'archived') && (
                      <button
                        type="button"
                        disabled={busyGoalId === goal.id}
                        onClick={() => void handleStatus(goal, 'active')}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-[11px] font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer disabled:opacity-50"
                      >
                        {goal.status === 'archived' ? <RotateCcw className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                        {goal.status === 'archived' ? 'Restore' : 'Resume'}
                      </button>
                    )}
                    {(goal.status === 'active' || goal.status === 'paused') && (
                      <button
                        type="button"
                        disabled={busyGoalId === goal.id}
                        onClick={() => void handleStatus(goal, 'completed')}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-emerald-200 dark:border-emerald-900/60 text-[11px] font-medium text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 cursor-pointer disabled:opacity-50"
                      >
                        <CheckCircle2 className="w-3 h-3" />
                        Complete
                      </button>
                    )}
                    {goal.status !== 'archived' && (
                      <button
                        type="button"
                        disabled={busyGoalId === goal.id}
                        onClick={() => void handleStatus(goal, 'archived')}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-[11px] font-medium text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer disabled:opacity-50"
                      >
                        <Archive className="w-3 h-3" />
                        Archive
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      <GoalFormModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingGoal(null);
        }}
        initialGoal={editingGoal}
      />
    </PlatformShell>
  );
}
