import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Save } from 'lucide-react';
import { AppShell } from '../../components/AppShell';
import {
  CheckinStatusLabel,
  ReportStatusLabel,
  SubmissionStatusLabel,
} from '../../components/StatusText';
import { useAuth } from '../../context/AuthContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { adminUpdateUser } from '../../services/ciiService';
import { CanonicalRole, isAdminPortalRole, normalizeRole, UserStatus } from '../../types';

export function AdminParticipantDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { profile, role } = useAuth();
  const { users, cohorts, submissions, checkins, reports } = useWorkspace();

  const target = users.find((u) => u.uid === id) || null;
  const partners = users.filter((u) => normalizeRole(u.role) === 'partner' && u.uid !== id);
  const isProgrammeManager = role === 'programme_manager';

  const [roleVal, setRoleVal] = useState<CanonicalRole>('member');
  const [statusVal, setStatusVal] = useState<UserStatus>('active');
  const [cohortId, setCohortId] = useState('');
  const [partnerId, setPartnerId] = useState('');
  const [stateCode, setStateCode] = useState('');
  const [ppa, setPpa] = useState('');
  const [department, setDepartment] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (target) {
      setRoleVal(normalizeRole(target.role));
      setStatusVal(target.status);
      setCohortId(target.cohortId);
      setPartnerId(target.partnerId);
      setStateCode(target.stateCode);
      setPpa(target.ppa);
      setDepartment(target.department);
    }
  }, [target]);

  if (!profile) return null;

  if (!target) {
    return (
      <AppShell title="Participant Not Found" breadcrumb="Admin / Participants /">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-8 text-center space-y-3">
          <p className="text-sm font-medium">User record not found.</p>
          <Link
            to="/admin/participants"
            className="inline-block px-4 py-2 rounded-lg bg-slate-900 dark:bg-emerald-600 text-white text-xs font-medium"
          >
            Back to Participants
          </Link>
        </div>
      </AppShell>
    );
  }

  const isSelf = target.uid === profile.uid;
  const targetIsAdmin = isAdminPortalRole(target.role);
  const memberSubs = submissions.filter((s) => s.memberId === target.uid);
  const memberCheckins = checkins.filter((c) => c.memberId === target.uid);
  const memberReports = reports.filter((r) => r.memberId === target.uid);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (targetIsAdmin) {
      setError('Administrative accounts must be managed by a Super Admin in Admin Users.');
      return;
    }
    if (isProgrammeManager && !cohortId) {
      setError('Programme Managers must keep participants assigned to an authorized cohort.');
      return;
    }
    setSaving(true);
    setSavedMsg(null);
    setError(null);
    try {
      const cohortObj = cohorts.find((c) => c.id === cohortId);
      const partnerObj = partners.find((p) => p.uid === partnerId);
      await adminUpdateUser({
        actor: profile,
        target,
        role: roleVal === 'partner' ? 'partner' : 'member',
        status: isSelf ? 'active' : statusVal,
        cohortId: cohortObj?.id || '',
        cohortName: cohortObj?.name || '',
        partnerId: partnerObj?.uid || '',
        partnerName: partnerObj?.displayName || '',
        stateCode,
        ppa,
        department,
      });
      setSavedMsg('Participant assignments and permissions updated.');
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to save participant assignments. Please try again.'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell title={target.displayName} breadcrumb="Admin / Participants /">
      <div className="space-y-6">
        <Link
          to="/admin/participants"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 dark:hover:text-white"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Participants
        </Link>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          <form
            onSubmit={handleSave}
            className="xl:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4 self-start"
          >
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              Account, Role & Cohort Assignments
            </h2>
            {savedMsg && (
              <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                {savedMsg}
              </p>
            )}
            {error && (
              <p className="text-xs font-medium text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            {targetIsAdmin && (
              <p className="text-xs font-medium text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
                Administrative accounts are managed exclusively under Admin Users by a Super Admin.
              </p>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1">Role</label>
                <select
                  value={roleVal === 'partner' ? 'partner' : 'member'}
                  disabled={isSelf || targetIsAdmin}
                  onChange={(e) => setRoleVal(e.target.value as CanonicalRole)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 disabled:opacity-60"
                >
                  <option value="member">Corps Member</option>
                  <option value="partner">Accountability Partner</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Account Status</label>
                <select
                  value={statusVal}
                  disabled={isSelf || targetIsAdmin}
                  onChange={(e) => setStatusVal(e.target.value as UserStatus)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 disabled:opacity-60"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="suspended">Suspended</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium mb-1">Assigned Cohort</label>
              <select
                value={cohortId}
                disabled={targetIsAdmin}
                required={isProgrammeManager}
                onChange={(e) => setCohortId(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 disabled:opacity-60"
              >
                {!isProgrammeManager && <option value="">Unassigned</option>}
                {cohorts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium mb-1">Accountability Partner</label>
              <select
                value={partnerId}
                onChange={(e) => setPartnerId(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
              >
                <option value="">Unassigned</option>
                {partners.map((p) => (
                  <option key={p.uid} value={p.uid}>
                    {p.displayName}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1">State Code</label>
                <input
                  type="text"
                  value={stateCode}
                  onChange={(e) => setStateCode(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Department</label>
                <input
                  type="text"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium mb-1">PPA</label>
              <input
                type="text"
                value={ppa}
                onChange={(e) => setPpa(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-slate-900 dark:bg-emerald-600 text-white text-sm font-medium disabled:opacity-60 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save Assignments'}
            </button>
          </form>

          <div className="xl:col-span-7 space-y-6">
            <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-3">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                Activity History ({memberSubs.length})
              </h3>
              {memberSubs.length === 0 ? (
                <p className="text-xs text-slate-500">No submissions recorded.</p>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                  {memberSubs.map((s) => (
                    <div key={s.id} className="py-2.5 flex items-center justify-between gap-2">
                      <span className="font-medium text-slate-800 dark:text-slate-200">
                        {s.activityTitle}
                      </span>
                      <SubmissionStatusLabel status={s.status} />
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-3">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                Recent Check-Ins ({memberCheckins.length})
              </h3>
              {memberCheckins.length === 0 ? (
                <p className="text-xs text-slate-500">No check-ins recorded.</p>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                  {memberCheckins.slice(0, 6).map((c) => (
                    <div key={c.id} className="py-2.5 flex items-center justify-between gap-2">
                      <span className="font-mono">{c.checkinDate}</span>
                      <span className="text-slate-600 dark:text-slate-300 truncate flex-1 px-3">
                        {c.updateText || '—'}
                      </span>
                      <CheckinStatusLabel status={c.status} />
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-3">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                Weekly Reports ({memberReports.length})
              </h3>
              {memberReports.length === 0 ? (
                <p className="text-xs text-slate-500">No weekly reports recorded.</p>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                  {memberReports.map((r) => (
                    <div key={r.id} className="py-2.5 flex items-center justify-between gap-2">
                      <span className="font-mono font-medium">{r.weekLabel}</span>
                      <ReportStatusLabel status={r.status} />
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
