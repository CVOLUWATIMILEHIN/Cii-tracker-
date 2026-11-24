import React, { useState } from 'react';
import { CheckCircle2, Flag, Plus } from 'lucide-react';
import { AppShell } from '../../components/AppShell';
import { useAuth } from '../../context/AuthContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { formatTimestamp } from '../../lib/exportReports';
import { createFollowUp, updateFollowUpStatus } from '../../services/ciiService';

export function PartnerFollowUpsPage() {
  const { profile } = useAuth();
  const { assignedMembers, followUps } = useWorkspace();

  const [memberId, setMemberId] = useState('');
  const [note, setNote] = useState('');
  const [actionTaken, setActionTaken] = useState('');
  const [flagged, setFlagged] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!profile) return null;

  const selectedMember =
    assignedMembers.find((m) => m.uid === memberId) ?? assignedMembers[0] ?? null;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMember || !note.trim()) return;
    setError(null);
    setSaving(true);
    try {
      await createFollowUp({
        actor: profile,
        member: selectedMember,
        sourceType: 'manual',
        sourceId: selectedMember.uid,
        note,
        actionTaken,
        flaggedForAdmin: flagged,
      });
      setNote('');
      setActionTaken('');
      setFlagged(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save follow-up. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (fu: (typeof followUps)[number]) => {
    setError(null);
    try {
      await updateFollowUpStatus(
        fu,
        fu.status === 'open' ? 'resolved' : 'open',
        fu.actionTaken,
        fu.flaggedForAdmin,
        profile
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to update follow-up status. Please try again.'
      );
    }
  };

  return (
    <AppShell title="Follow-Up Management" breadcrumb="Partner /">
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <section className="xl:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4 self-start">
          <div className="flex items-center gap-2">
            <Plus className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              Log New Follow-Up
            </h2>
          </div>

          {error && (
            <p className="text-xs font-medium text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          {!selectedMember ? (
            <p className="text-xs text-slate-500">
              No Corps Members are assigned to your caseload yet.
            </p>
          ) : (
            <form onSubmit={handleCreate} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Corps Member
                </label>
                <select
                  value={selectedMember.uid}
                  onChange={(e) => setMemberId(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
                >
                  {assignedMembers.map((m) => (
                    <option key={m.uid} value={m.uid}>
                      {m.displayName} ({m.cohortName || 'No Cohort'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Follow-Up Reason / Note
                </label>
                <textarea
                  rows={3}
                  required
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  maxLength={800}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Action Taken
                </label>
                <input
                  type="text"
                  value={actionTaken}
                  onChange={(e) => setActionTaken(e.target.value)}
                  maxLength={800}
                  placeholder="e.g., Held 15-min call, reviewed milestone plan..."
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
                />
              </div>

              <label className="flex items-center gap-2 text-xs text-rose-700 dark:text-rose-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={flagged}
                  onChange={(e) => setFlagged(e.target.checked)}
                  className="accent-rose-600"
                />
                <span>Escalate / flag for Administrator attention</span>
              </label>

              <button
                type="submit"
                disabled={saving}
                className="w-full py-2.5 px-4 rounded-lg bg-slate-900 dark:bg-emerald-600 text-white text-sm font-medium disabled:opacity-60 cursor-pointer"
              >
                {saving ? 'Saving...' : 'Create Follow-Up'}
              </button>
            </form>
          )}
        </section>

        <section className="xl:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">
            Caseload Follow-Ups ({followUps.length})
          </h2>

          {followUps.length === 0 ? (
            <p className="text-xs text-slate-500 py-8 text-center">
              No follow-up records logged yet.
            </p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {followUps.map((fu) => (
                <div key={fu.id} className="py-4 first:pt-0 last:pb-0 space-y-2 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-slate-900 dark:text-white">
                      {fu.memberName}
                    </span>
                    <div className="flex items-center gap-2">
                      <span
                        className={
                          fu.status === 'resolved'
                            ? 'text-emerald-600 dark:text-emerald-400 font-medium'
                            : 'text-amber-600 dark:text-amber-400 font-medium'
                        }
                      >
                        {fu.status === 'resolved' ? 'Resolved' : 'Open'}
                      </span>
                      {fu.flaggedForAdmin && (
                        <span className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400 font-medium">
                          <Flag className="w-3 h-3" />
                          Admin Flagged
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="text-slate-700 dark:text-slate-300">{fu.note}</p>
                  {fu.actionTaken && (
                    <p className="text-slate-500">Action: {fu.actionTaken}</p>
                  )}
                  <div className="flex items-center justify-between pt-1">
                    <span className="font-mono text-[11px] text-slate-400">
                      {formatTimestamp(fu.updatedAt)}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleToggleStatus(fu)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{fu.status === 'open' ? 'Mark Resolved' : 'Reopen'}</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
