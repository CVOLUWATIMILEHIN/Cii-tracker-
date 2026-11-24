import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Copy, Download, Search, UserPlus, X } from 'lucide-react';
import { AppShell } from '../../components/AppShell';
import { useAuth } from '../../context/AuthContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { exportParticipantsCsv } from '../../lib/exportReports';
import {
  createInvitation,
  recordAuditEvent,
  revokeInvitation,
} from '../../services/ciiService';
import {
  canManageParticipants,
  CanonicalRole,
  isAdminPortalRole,
  normalizeRole,
  ROLE_LABELS,
  UserStatus,
} from '../../types';

export function AdminParticipantsPage() {
  const { profile, role } = useAuth();
  const { users, cohorts, invitations } = useWorkspace();
  const canEdit = canManageParticipants(role);
  const isProgrammeManager = role === 'programme_manager';

  const [search, setSearch] = useState('');
  const [cohortFilter, setCohortFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<UserStatus | 'all'>('all');
  const [showInviteModal, setShowInviteModal] = useState(false);

  // Invite form state
  const [invEmail, setInvEmail] = useState('');
  const [invName, setInvName] = useState('');
  const [invRole, setInvRole] = useState<CanonicalRole>('member');
  const [invCohortId, setInvCohortId] = useState('');
  const [invPartnerId, setInvPartnerId] = useState('');
  const [invStateCode, setInvStateCode] = useState('');
  const [invPpa, setInvPpa] = useState('');
  const [creatingInvite, setCreatingInvite] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);

  const partners = useMemo(
    () => users.filter((u) => normalizeRole(u.role) === 'partner' && u.status === 'active'),
    [users]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      if (cohortFilter !== 'all' && u.cohortId !== cohortFilter) return false;
      if (statusFilter !== 'all' && u.status !== statusFilter) return false;
      if (
        q &&
        !u.displayName.toLowerCase().includes(q) &&
        !u.stateCode.toLowerCase().includes(q) &&
        !u.ppa.toLowerCase().includes(q) &&
        !u.cohortName.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [users, search, cohortFilter, statusFilter]);

  if (!profile) return null;

  const handleCreateInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteError(null);
    if (isProgrammeManager && !invCohortId) {
      setInviteError('Please select one of your assigned cohorts for this invitation.');
      return;
    }
    setCreatingInvite(true);
    try {
      const cohortObj = cohorts.find((c) => c.id === invCohortId);
      const partnerObj = partners.find((p) => p.uid === invPartnerId);
      await createInvitation({
        actor: profile,
        email: invEmail,
        displayName: invName,
        role: invRole === 'partner' ? 'partner' : 'member',
        cohortId: cohortObj?.id || '',
        cohortName: cohortObj?.name || '',
        partnerId: partnerObj?.uid || '',
        partnerName: partnerObj?.displayName || '',
        stateCode: invStateCode,
        ppa: invPpa,
      });
      setInvEmail('');
      setInvName('');
      setInvStateCode('');
      setInvPpa('');
      setShowInviteModal(false);
    } catch (err) {
      setInviteError(
        err instanceof Error ? err.message : 'Unable to generate invitation. Please try again.'
      );
    } finally {
      setCreatingInvite(false);
    }
  };

  const handleRevokeInvite = async (inv: (typeof invitations)[number]) => {
    setPageError(null);
    try {
      await revokeInvitation(inv, profile);
    } catch (err) {
      setPageError(
        err instanceof Error ? err.message : 'Unable to revoke invitation. Please try again.'
      );
    }
  };

  const copyActivationUrl = (inviteId: string, email: string) => {
    const url = `${window.location.origin}/activate-account?code=${encodeURIComponent(
      inviteId
    )}&email=${encodeURIComponent(email)}`;
    void navigator.clipboard?.writeText(url);
    setCopiedId(inviteId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleExport = () => {
    exportParticipantsCsv(filtered);
    void recordAuditEvent({
      actorId: profile.uid,
      actorName: profile.displayName,
      actorRole: role,
      action: 'EXPORT_PARTICIPANTS_CSV',
      category: 'export',
      severity: 'info',
      targetType: 'report',
      targetId: 'participants',
      summary: `Exported ${filtered.length} participants to CSV.`,
    });
  };

  return (
    <AppShell
      title={canEdit ? 'Participant & Invitation Management' : 'Assigned Participants'}
      breadcrumb={`${ROLE_LABELS[role]} /`}
      actions={
        canEdit ? (
          <button
            type="button"
            onClick={() => setShowInviteModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-900 dark:bg-emerald-600 text-white text-xs sm:text-sm font-medium cursor-pointer whitespace-nowrap"
          >
            <UserPlus className="w-4 h-4" />
            <span>Invite Participant</span>
          </button>
        ) : undefined
      }
    >
      <div className="space-y-6">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, state code, cohort, or PPA..."
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={cohortFilter}
              onChange={(e) => setCohortFilter(e.target.value)}
              className="px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
            >
              <option value="all">All Cohorts</option>
              {cohorts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as UserStatus | 'all')}
              className="px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="suspended">Suspended</option>
            </select>

            <button
              type="button"
              onClick={handleExport}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              CSV
            </button>
          </div>
        </div>

        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 text-xs font-semibold text-slate-500 dark:text-slate-400">
                  <th className="py-3 px-4">User</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Cohort</th>
                  <th className="py-3 px-4">Accountability Partner</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Manage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {filtered.map((u) => (
                  <tr key={u.uid} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                    <td className="py-3 px-4">
                      <p className="text-sm font-medium text-slate-900 dark:text-white">
                        {u.displayName}
                      </p>
                      <p className="font-mono text-slate-400">{u.stateCode || u.department}</p>
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-700 dark:text-slate-300">
                      {ROLE_LABELS[normalizeRole(u.role)]}
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                      {u.cohortName || 'Unassigned'}
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                      {u.partnerName || 'Unassigned'}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`font-medium capitalize ${
                          u.status === 'active'
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {u.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      {!canEdit ? (
                        <span className="text-slate-400">View only</span>
                      ) : isAdminPortalRole(u.role) ? (
                        role === 'super_admin' ? (
                          <Link
                            to="/admin/users"
                            className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 font-medium text-emerald-700 dark:text-emerald-400 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap"
                          >
                            Admin Users
                          </Link>
                        ) : (
                          <span className="text-slate-400">Admin account</span>
                        )
                      ) : (
                        <Link
                          to={`/admin/participants/${u.uid}`}
                          className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap"
                        >
                          Details
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Account Activation Invitations */}
        {canEdit && (
          <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                  Participant &amp; Partner Invitations (
                  {invitations.filter((i) => !isAdminPortalRole(i.role)).length})
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Copy the generated activation link to share with verified CII registrants. Administrative invitations are managed under Admin Users.
                </p>
              </div>
            </div>

            {pageError && (
              <p className="text-xs font-medium text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-lg px-3 py-2">
                {pageError}
              </p>
            )}

            {invitations.filter((i) => !isAdminPortalRole(i.role)).length === 0 ? (
              <p className="text-xs text-slate-500 py-4">
                No participant invitations issued yet. Click &ldquo;Invite Participant&rdquo; to pre-assign a cohort and partner.
              </p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {invitations
                  .filter((i) => !isAdminPortalRole(i.role))
                  .map((inv) => (
                    <div
                      key={inv.id}
                      className="py-3 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                    >
                      <div className="space-y-0.5">
                        <p className="font-semibold text-slate-900 dark:text-white">
                          {inv.displayName} ({inv.email})
                        </p>
                        <p className="text-slate-500 dark:text-slate-400 font-mono">
                          Code: {inv.id} · Role: {ROLE_LABELS[normalizeRole(inv.role)]} · Status:{' '}
                          {inv.status}
                        </p>
                      </div>
                      {inv.status === 'pending' && (
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => copyActivationUrl(inv.id, inv.email)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 font-medium cursor-pointer"
                          >
                            <Copy className="w-3.5 h-3.5" />
                            <span>{copiedId === inv.id ? 'Copied!' : 'Copy Activation Link'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRevokeInvite(inv)}
                            className="px-2.5 py-1.5 rounded-lg border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 font-medium cursor-pointer"
                          >
                            Revoke
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            )}
          </section>
        )}
      </div>

      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                Issue Account Activation Invitation
              </h2>
              <button
                type="button"
                onClick={() => setShowInviteModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateInvite} className="p-6 space-y-3.5">
              {inviteError && (
                <p className="text-xs font-medium text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-lg px-3 py-2">
                  {inviteError}
                </p>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={invName}
                    onChange={(e) => setInvName(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Verified Email</label>
                  <input
                    type="email"
                    required
                    value={invEmail}
                    onChange={(e) => setInvEmail(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1">Role</label>
                  <select
                    value={invRole === 'partner' ? 'partner' : 'member'}
                    onChange={(e) => setInvRole(e.target.value as CanonicalRole)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
                  >
                    <option value="member">Corps Member</option>
                    <option value="partner">Accountability Partner</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">
                    Assign Cohort {isProgrammeManager ? '(Required)' : ''}
                  </label>
                  <select
                    required={isProgrammeManager}
                    value={invCohortId}
                    onChange={(e) => setInvCohortId(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
                  >
                    <option value="">{isProgrammeManager ? 'Select assigned cohort...' : 'None'}</option>
                    {cohorts.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1">Accountability Partner</label>
                  <select
                    value={invPartnerId}
                    onChange={(e) => setInvPartnerId(e.target.value)}
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
                <div>
                  <label className="block text-xs font-medium mb-1">NYSC State Code</label>
                  <input
                    type="text"
                    value={invStateCode}
                    onChange={(e) => setInvStateCode(e.target.value.toUpperCase())}
                    placeholder="e.g., FC/26A/0192"
                    className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">PPA (Optional)</label>
                <input
                  type="text"
                  value={invPpa}
                  onChange={(e) => setInvPpa(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingInvite}
                  className="px-4 py-2 rounded-lg bg-slate-900 dark:bg-emerald-600 text-white text-xs font-medium disabled:opacity-60 cursor-pointer"
                >
                  {creatingInvite ? 'Generating...' : 'Generate Invitation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
