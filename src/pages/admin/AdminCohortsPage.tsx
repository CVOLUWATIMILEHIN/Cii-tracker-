import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { FolderPlus } from 'lucide-react';
import { AppShell } from '../../components/AppShell';
import { useAuth } from '../../context/AuthContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { saveCohort } from '../../services/ciiService';
import { Cohort, isFullAdminRole } from '../../types';

export function AdminCohortsPage() {
  const { profile } = useAuth();
  const { cohorts, users, checkins, reports } = useWorkspace();

  const [editing, setEditing] = useState<Cohort | null>(null);
  const [code, setCode] = useState('CII-2026-B3');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('2026-11-01');
  const [endDate, setEndDate] = useState('2027-04-30');
  const [status, setStatus] = useState<'active' | 'archived'>('active');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!profile) return null;

  const canCreateCohort = isFullAdminRole(profile.role);

  const startEdit = (c: Cohort) => {
    setError(null);
    setEditing(c);
    setCode(c.code);
    setName(c.name);
    setDescription(c.description);
    setStartDate(c.startDate);
    setEndDate(c.endDate);
    setStatus(c.status);
  };

  const resetForm = () => {
    setError(null);
    setEditing(null);
    setCode(`CII-2026-B${cohorts.length + 1}`);
    setName('');
    setDescription('');
    setStartDate('2026-11-01');
    setEndDate('2027-04-30');
    setStatus('active');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!canCreateCohort && !editing) {
      setError('Programme Managers can only edit their assigned cohorts.');
      return;
    }
    if (endDate < startDate) {
      setError('End date must be on or after the start date.');
      return;
    }
    setSaving(true);
    try {
      await saveCohort({
        actor: profile,
        existing: editing,
        code,
        name,
        description,
        startDate,
        endDate,
        status,
      });
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save cohort. Please check your inputs and try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell title="Cohort & Group Management" breadcrumb="Admin /">
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {!canCreateCohort && !editing ? (
          <div className="xl:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-2 self-start">
            <div className="flex items-center gap-2">
              <FolderPlus className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                Assigned Cohort Management
              </h2>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Your Programme Manager role is scoped to your assigned cohorts. Select <span className="font-semibold text-slate-700 dark:text-slate-200">Edit</span> on any cohort card to update its schedule or description. Creating new programme-wide cohorts requires Admin or Super Admin privileges.
            </p>
          </div>
        ) : (
        <form
          onSubmit={handleSubmit}
          className="xl:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4 self-start"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FolderPlus className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                {editing ? `Edit Cohort · ${editing.code}` : 'Create New Cohort'}
              </h2>
            </div>
            {editing && (
              <button
                type="button"
                onClick={resetForm}
                className="text-xs text-slate-500 hover:underline cursor-pointer"
              >
                Cancel
              </button>
            )}
          </div>

          {error && (
            <p className="text-xs font-medium text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">Cohort Code</label>
              <input
                type="text"
                required
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                maxLength={24}
                className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as 'active' | 'archived')}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
              >
                <option value="active">Active</option>
                <option value="archived">Archived</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1">Cohort Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
              placeholder="e.g., 2026 Batch C · Civic Leadership"
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1">Description</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">Start Date</label>
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">End Date</label>
              <input
                type="date"
                required
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full py-2.5 px-4 rounded-lg bg-slate-900 dark:bg-emerald-600 text-white text-sm font-medium disabled:opacity-60 cursor-pointer"
          >
            {saving ? 'Saving...' : editing ? 'Update Cohort' : 'Create Cohort'}
          </button>
        </form>
        )}

        <section className="xl:col-span-7 space-y-4">
          {cohorts.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-10 text-center text-xs text-slate-500">
              No cohorts created yet.
            </div>
          ) : (
            cohorts.map((cohort) => {
              const cohortMembers = users.filter((u) => u.cohortId === cohort.id);
              const cohortCheckins = checkins.filter((c) => c.cohortId === cohort.id).length;
              const cohortReports = reports.filter((r) => r.cohortId === cohort.id).length;

              return (
                <article
                  key={cohort.id}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-mono text-emerald-700 dark:text-emerald-400">
                        {cohort.code} · {cohort.startDate} to {cohort.endDate} · {cohort.status}
                      </p>
                      <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                        {cohort.name}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        {cohort.description}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => startEdit(cohort)}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium cursor-pointer shrink-0"
                    >
                      Edit
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-3 text-xs pt-2 border-t border-slate-100 dark:border-slate-800">
                    <div>
                      <span className="text-slate-400">Members: </span>
                      <span className="font-mono tabular-nums font-semibold">
                        {cohortMembers.length}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400">Check-Ins: </span>
                      <span className="font-mono tabular-nums font-semibold">
                        {cohortCheckins}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400">Reports: </span>
                      <span className="font-mono tabular-nums font-semibold">
                        {cohortReports}
                      </span>
                    </div>
                  </div>

                  {cohortMembers.length > 0 && (
                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-600 dark:text-slate-400">
                      {cohortMembers.map((m) => (
                        <Link
                          key={m.uid}
                          to={`/admin/participants/${m.uid}`}
                          className="hover:text-emerald-600 hover:underline"
                        >
                          {m.displayName}
                        </Link>
                      ))}
                    </div>
                  )}
                </article>
              );
            })
          )}
        </section>
      </div>
    </AppShell>
  );
}
