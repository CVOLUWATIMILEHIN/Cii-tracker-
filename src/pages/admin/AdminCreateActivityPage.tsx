import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Save } from 'lucide-react';
import { AppShell } from '../../components/AppShell';
import { useAuth } from '../../context/AuthContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { saveActivity } from '../../services/ciiService';
import {
  ActivityStatus,
  AssignmentScope,
  InitiativePillar,
  normalizeRole,
  PILLARS,
} from '../../types';

export function AdminCreateActivityPage() {
  const { profile } = useAuth();
  const { cohorts, users } = useWorkspace();
  const navigate = useNavigate();

  const isProgrammeManager = profile ? normalizeRole(profile.role) === 'programme_manager' : false;

  const [code, setCode] = useState(`CII-ACT-${Math.floor(10 + Math.random() * 89)}`);
  const [title, setTitle] = useState('');
  const [pillar, setPillar] = useState<InitiativePillar>('Community');
  const [description, setDescription] = useState('');
  const [instructions, setInstructions] = useState('');
  const [deadline, setDeadline] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().slice(0, 10);
  });
  const [assignmentScope, setAssignmentScope] = useState<AssignmentScope>(
    isProgrammeManager ? 'cohort' : 'all'
  );
  const [cohortId, setCohortId] = useState('');
  const [assignedMemberIds, setAssignedMemberIds] = useState<string[]>([]);
  const [evidenceRequired, setEvidenceRequired] = useState(true);
  const [reviewRequired, setReviewRequired] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const members = useMemo(
    () =>
      users.filter((u) => {
        if (normalizeRole(u.role) !== 'member' || u.status !== 'active') return false;
        if (isProgrammeManager && cohortId) return u.cohortId === cohortId;
        return true;
      }),
    [users, isProgrammeManager, cohortId]
  );

  if (!profile) return null;

  const effectiveScope: AssignmentScope =
    isProgrammeManager && assignmentScope === 'all' ? 'cohort' : assignmentScope;

  const toggleMember = (uid: string) => {
    setAssignedMemberIds((prev) =>
      prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]
    );
  };

  const handleSave = async (status: ActivityStatus) => {
    setError(null);
    if (!code.trim() || !title.trim() || !description.trim()) {
      setError('Activity code, title, and description are required.');
      return;
    }
    if (!deadline) {
      setError('Please select a deadline date.');
      return;
    }
    if ((effectiveScope === 'cohort' || isProgrammeManager) && !cohortId) {
      setError('Please select one of your assigned cohorts.');
      return;
    }
    if (effectiveScope === 'selected' && assignedMemberIds.length === 0) {
      setError('Select at least one Corps Member for targeted assignment.');
      return;
    }

    const selectedCohort = cohorts.find((c) => c.id === cohortId);
    const shouldAttachCohort = effectiveScope === 'cohort' || isProgrammeManager;

    setSubmitting(true);
    try {
      await saveActivity({
        actor: profile,
        code,
        title,
        description,
        instructions,
        pillar,
        cohortId: shouldAttachCohort ? cohortId : '',
        cohortName:
          shouldAttachCohort && selectedCohort ? selectedCohort.name : 'All Cohorts',
        assignmentScope: effectiveScope,
        assignedMemberIds: effectiveScope === 'selected' ? assignedMemberIds : [],
        deadline,
        evidenceRequired,
        reviewRequired,
        status,
        users: status === 'published' ? users : undefined,
      });
      navigate('/admin/activities');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save activity.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppShell
      title="Create Activity"
      breadcrumb="Admin / Activities /"
      actions={
        <Link
          to="/admin/activities"
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Activities
        </Link>
      }
    >
      <div className="max-w-3xl">
        <form
          onSubmit={(e: React.FormEvent) => {
            e.preventDefault();
            void handleSave('published');
          }}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-5"
        >
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              Programme Activity Specification
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Published activities immediately appear in assigned Corps Members&apos; queues and dispatch in-app notifications.
            </p>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Activity Code
              </label>
              <input
                type="text"
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="CII-ACT-05"
                className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Impact Pillar
              </label>
              <select
                value={pillar}
                onChange={(e) => setPillar(e.target.value as InitiativePillar)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
              >
                {PILLARS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Deadline
              </label>
              <input
                type="date"
                required
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Activity Title
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Monthly PPA Impact Verification & Stakeholder Brief"
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Description &amp; Expected Outcome
            </label>
            <textarea
              required
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Summarize the activity objective and expected community or PPA impact..."
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Execution Instructions
            </label>
            <textarea
              rows={4}
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="Step-by-step instructions, deliverable formatting, and evidence guidelines..."
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
            />
          </div>

          <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Assignment Scope
              </label>
              <div className={`grid grid-cols-1 ${isProgrammeManager ? 'sm:grid-cols-2' : 'sm:grid-cols-3'} gap-2.5`}>
                {(
                  [
                    { id: 'all', label: 'All Corps Members', desc: 'Entire active roster' },
                    { id: 'cohort', label: 'Specific Cohort', desc: 'Assign by cohort group' },
                    { id: 'selected', label: 'Selected Members', desc: 'Targeted individuals' },
                  ] as Array<{ id: AssignmentScope; label: string; desc: string }>
                )
                  .filter((opt) => !isProgrammeManager || opt.id !== 'all')
                  .map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setAssignmentScope(opt.id)}
                      className={`text-left p-3 rounded-lg border transition-colors cursor-pointer ${
                        effectiveScope === opt.id
                          ? 'border-emerald-600 bg-emerald-50/70 dark:bg-emerald-950/30 dark:border-emerald-500'
                          : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                      }`}
                    >
                      <p className="text-xs font-semibold text-slate-900 dark:text-white">
                        {opt.label}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        {opt.desc}
                      </p>
                    </button>
                  ))}
              </div>
            </div>

            {(effectiveScope === 'cohort' || isProgrammeManager) && (
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {isProgrammeManager ? 'Assigned Cohort (Required)' : 'Target Cohort'}
                </label>
                <select
                  required={effectiveScope === 'cohort' || isProgrammeManager}
                  value={cohortId}
                  onChange={(e) => {
                    setCohortId(e.target.value);
                    if (isProgrammeManager) setAssignedMemberIds([]);
                  }}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                >
                  <option value="">Select a cohort...</option>
                  {cohorts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} — {c.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {effectiveScope === 'selected' && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    Select Corps Members ({assignedMemberIds.length} selected)
                  </label>
                  {members.length > 0 && (
                    <button
                      type="button"
                      onClick={() =>
                        setAssignedMemberIds(
                          assignedMemberIds.length === members.length
                            ? []
                            : members.map((m) => m.uid)
                        )
                      }
                      className="text-xs text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer"
                    >
                      {assignedMemberIds.length === members.length ? 'Clear all' : 'Select all'}
                    </button>
                  )}
                </div>
                {members.length === 0 ? (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    No active Corps Members registered yet.
                  </p>
                ) : (
                  <div className="max-h-48 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-lg divide-y divide-slate-100 dark:divide-slate-800">
                    {members.map((m) => (
                      <label
                        key={m.uid}
                        className="flex items-center justify-between px-3 py-2 text-xs hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer"
                      >
                        <span className="flex items-center gap-2.5">
                          <input
                            type="checkbox"
                            checked={assignedMemberIds.includes(m.uid)}
                            onChange={() => toggleMember(m.uid)}
                            className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-600"
                          />
                          <span className="font-medium text-slate-900 dark:text-white">
                            {m.displayName}
                          </span>
                        </span>
                        <span className="text-slate-500 dark:text-slate-400 font-mono">
                          {m.cohortName || m.stateCode || 'Unassigned'}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <label className="flex items-start gap-2.5 p-3 rounded-lg border border-slate-200 dark:border-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={evidenceRequired}
                  onChange={(e) => setEvidenceRequired(e.target.checked)}
                  className="mt-0.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-600"
                />
                <span>
                  <span className="block text-xs font-medium text-slate-900 dark:text-white">
                    Require Evidence Upload
                  </span>
                  <span className="block text-[11px] text-slate-500 dark:text-slate-400">
                    Corps Members must attach a PDF, image, or document file.
                  </span>
                </span>
              </label>

              <label className="flex items-start gap-2.5 p-3 rounded-lg border border-slate-200 dark:border-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={reviewRequired}
                  onChange={(e) => setReviewRequired(e.target.checked)}
                  className="mt-0.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-600"
                />
                <span>
                  <span className="block text-xs font-medium text-slate-900 dark:text-white">
                    Require Partner/Admin Review
                  </span>
                  <span className="block text-[11px] text-slate-500 dark:text-slate-400">
                    Route completed submissions to the review queue before approval.
                  </span>
                </span>
              </label>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2.5 pt-4 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              disabled={submitting}
              onClick={() => handleSave('draft')}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              Save as Draft
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-900 dark:bg-emerald-600 text-white text-xs font-medium hover:opacity-95 disabled:opacity-50 cursor-pointer"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              {submitting ? 'Publishing...' : 'Publish & Assign Activity'}
            </button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}
