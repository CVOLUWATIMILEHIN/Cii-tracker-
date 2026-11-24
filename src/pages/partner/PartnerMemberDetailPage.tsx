import React, { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Flag, Send } from 'lucide-react';
import { AppShell } from '../../components/AppShell';
import {
  CheckinStatusLabel,
  ReportStatusLabel,
  SubmissionStatusLabel,
} from '../../components/StatusText';
import { useAuth } from '../../context/AuthContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { createFollowUp } from '../../services/ciiService';

export function PartnerMemberDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { profile } = useAuth();
  const { assignedMembers, checkins, submissions, reports, followUps } = useWorkspace();

  const member = assignedMembers.find((m) => m.uid === id) || null;
  const memberCheckins = checkins.filter((c) => c.memberId === id);
  const memberSubs = submissions.filter((s) => s.memberId === id);
  const memberReports = reports.filter((r) => r.memberId === id);
  const memberFollowUps = followUps.filter((f) => f.memberId === id);

  const [note, setNote] = useState('');
  const [actionTaken, setActionTaken] = useState('');
  const [flaggedForAdmin, setFlaggedForAdmin] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  if (!profile) return null;

  if (!member) {
    return (
      <AppShell title="Member Not in Caseload" breadcrumb="Partner / Members /">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-8 text-center space-y-3">
          <p className="text-sm font-medium text-slate-900 dark:text-white">
            This member is not assigned to your Accountability Partner caseload.
          </p>
          <Link
            to="/partner/members"
            className="inline-block px-4 py-2 rounded-lg bg-slate-900 dark:bg-emerald-600 text-white text-xs font-medium"
          >
            Back to Assigned Members
          </Link>
        </div>
      </AppShell>
    );
  }

  const handleLogFollowUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!note.trim()) return;
    setSaving(true);
    setSavedNotice(null);
    try {
      await createFollowUp({
        actor: profile,
        member,
        sourceType: 'manual',
        sourceId: member.uid,
        note,
        actionTaken,
        flaggedForAdmin,
      });
      setNote('');
      setActionTaken('');
      setFlaggedForAdmin(false);
      setSavedNotice('Follow-up logged and member notified.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell title={member.displayName} breadcrumb="Partner / Assigned Members /">
      <div className="space-y-6">
        <Link
          to="/partner/members"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 dark:hover:text-white"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Assigned Members
        </Link>

        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
          <div>
            <p className="text-slate-400">Corps Member</p>
            <p className="text-base font-semibold text-slate-900 dark:text-white mt-0.5">
              {member.displayName}
            </p>
            <p className="font-mono text-slate-500">{member.stateCode || 'No state code'}</p>
          </div>
          <div>
            <p className="text-slate-400">Cohort</p>
            <p className="text-sm font-medium text-slate-800 dark:text-slate-200 mt-0.5">
              {member.cohortName || 'Unassigned'}
            </p>
          </div>
          <div>
            <p className="text-slate-400">PPA</p>
            <p className="text-sm font-medium text-slate-800 dark:text-slate-200 mt-0.5">
              {member.ppa || 'Not specified'}
            </p>
          </div>
          <div>
            <p className="text-slate-400">Caseload Stats</p>
            <p className="text-sm font-mono tabular-nums text-slate-800 dark:text-slate-200 mt-0.5">
              {memberCheckins.length} check-ins · {memberReports.length} reports
            </p>
          </div>
        </section>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          <div className="xl:col-span-7 space-y-6">
            <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                Activity Submissions ({memberSubs.length})
              </h3>
              {memberSubs.length === 0 ? (
                <p className="text-xs text-slate-500">No activity submissions recorded yet.</p>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {memberSubs.map((s) => (
                    <div key={s.id} className="py-3 first:pt-0 last:pb-0 text-xs space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-slate-900 dark:text-white">
                          {s.activityTitle}
                        </span>
                        <SubmissionStatusLabel status={s.status} />
                      </div>
                      <p className="text-slate-600 dark:text-slate-300">
                        Progress: <span className="font-mono">{s.progress}%</span> · {s.responseText || 'In progress'}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                Daily Check-Ins ({memberCheckins.length})
              </h3>
              {memberCheckins.length === 0 ? (
                <p className="text-xs text-slate-500">No check-ins submitted yet.</p>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {memberCheckins.slice(0, 8).map((c) => (
                    <div key={c.id} className="py-3 first:pt-0 last:pb-0 text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-medium">{c.checkinDate}</span>
                        <CheckinStatusLabel status={c.status} />
                      </div>
                      <p className="text-slate-600 dark:text-slate-300">
                        {c.updateText || 'No update note.'}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                Weekly Reports ({memberReports.length})
              </h3>
              {memberReports.length === 0 ? (
                <p className="text-xs text-slate-500">No weekly reports submitted yet.</p>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {memberReports.map((r) => (
                    <div key={r.id} className="py-3 first:pt-0 last:pb-0 text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-semibold">{r.weekLabel}</span>
                        <ReportStatusLabel status={r.status} />
                      </div>
                      <p className="text-slate-600 dark:text-slate-300">{r.achievements}</p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          <div className="xl:col-span-5 space-y-6">
            <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                Record Follow-Up Action
              </h3>
              {savedNotice && (
                <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                  {savedNotice}
                </p>
              )}
              <form onSubmit={handleLogFollowUp} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Observation / Reason for Follow-Up
                  </label>
                  <textarea
                    rows={3}
                    required
                    maxLength={800}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Summarize support need, missed check-in, or coaching point..."
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Action Taken
                  </label>
                  <input
                    type="text"
                    maxLength={800}
                    value={actionTaken}
                    onChange={(e) => setActionTaken(e.target.value)}
                    placeholder="e.g., Called member, scheduled check-in call..."
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
                  />
                </div>
                <label className="flex items-center gap-2 text-xs text-rose-700 dark:text-rose-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={flaggedForAdmin}
                    onChange={(e) => setFlaggedForAdmin(e.target.checked)}
                    className="accent-rose-600"
                  />
                  <Flag className="w-3.5 h-3.5" />
                  <span>Flag this member for Administrator attention</span>
                </label>
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-slate-900 dark:bg-emerald-600 text-white text-sm font-medium disabled:opacity-60 cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                  {saving ? 'Logging...' : 'Save Follow-Up'}
                </button>
              </form>
            </section>

            <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-3">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                Follow-Up History ({memberFollowUps.length})
              </h3>
              {memberFollowUps.length === 0 ? (
                <p className="text-xs text-slate-500">No follow-ups logged yet.</p>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {memberFollowUps.map((fu) => (
                    <div key={fu.id} className="py-2.5 first:pt-0 last:pb-0 text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-medium capitalize">{fu.status}</span>
                        {fu.flaggedForAdmin && (
                          <span className="text-rose-600 dark:text-rose-400 font-medium">
                            Escalated to Admin
                          </span>
                        )}
                      </div>
                      <p className="text-slate-700 dark:text-slate-300">{fu.note}</p>
                      {fu.actionTaken && (
                        <p className="text-slate-500">Action: {fu.actionTaken}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
