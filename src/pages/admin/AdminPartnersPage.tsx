import { useState } from 'react';
import { Link } from 'react-router-dom';
import { UserCheck, UserPlus } from 'lucide-react';
import { AppShell } from '../../components/AppShell';
import { useAuth } from '../../context/AuthContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { adminUpdateUser } from '../../services/ciiService';
import { normalizeRole, UserProfile } from '../../types';

export function AdminPartnersPage() {
  const { profile } = useAuth();
  const { users, followUps } = useWorkspace();

  const partners = users.filter((u) => normalizeRole(u.role) === 'partner');
  const members = users.filter((u) => normalizeRole(u.role) === 'member');
  const [assignMemberId, setAssignMemberId] = useState('');
  const [assignPartnerId, setAssignPartnerId] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  if (!profile) return null;

  const handleAssign = async () => {
    const member = members.find((m) => m.uid === assignMemberId);
    const partner = partners.find((p) => p.uid === assignPartnerId);
    if (!member || !partner) return;
    setBusy(true);
    setNotice(null);
    try {
      await adminUpdateUser({
        actor: profile,
        target: member,
        role: 'member',
        status: member.status,
        cohortId: member.cohortId,
        cohortName: member.cohortName,
        partnerId: partner.uid,
        partnerName: partner.displayName,
        stateCode: member.stateCode,
        ppa: member.ppa,
        department: member.department,
      });
      setNotice(`Assigned ${member.displayName} to ${partner.displayName}.`);
      setAssignMemberId('');
    } finally {
      setBusy(false);
    }
  };

  const togglePartnerStatus = async (partner: UserProfile) => {
    await adminUpdateUser({
      actor: profile,
      target: partner,
      role: 'partner',
      status: partner.status === 'active' ? 'suspended' : 'active',
      cohortId: partner.cohortId,
      cohortName: partner.cohortName,
      partnerId: partner.partnerId,
      partnerName: partner.partnerName,
      stateCode: partner.stateCode,
      ppa: partner.ppa,
      department: partner.department,
    });
  };

  return (
    <AppShell
      title="Accountability Partner Management"
      breadcrumb="Admin /"
      actions={
        <Link
          to="/admin/participants"
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-900 dark:bg-emerald-600 text-white text-xs font-medium whitespace-nowrap"
        >
          <UserPlus className="w-4 h-4" />
          <span>Invite / Promote Partner</span>
        </Link>
      }
    >
      <div className="space-y-6">
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
            Quick Assign / Reassign Corps Member to Partner
          </h2>
          {notice && (
            <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">{notice}</p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <select
              value={assignMemberId}
              onChange={(e) => setAssignMemberId(e.target.value)}
              className="px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
            >
              <option value="">Select Corps Member...</option>
              {members.map((m) => (
                <option key={m.uid} value={m.uid}>
                  {m.displayName} (Current: {m.partnerName || 'Unassigned'})
                </option>
              ))}
            </select>
            <select
              value={assignPartnerId}
              onChange={(e) => setAssignPartnerId(e.target.value)}
              className="px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
            >
              <option value="">Select Accountability Partner...</option>
              {partners
                .filter((p) => p.status === 'active')
                .map((p) => (
                  <option key={p.uid} value={p.uid}>
                    {p.displayName}
                  </option>
                ))}
            </select>
            <button
              type="button"
              disabled={!assignMemberId || !assignPartnerId || busy}
              onClick={handleAssign}
              className="px-4 py-2 rounded-lg bg-slate-900 dark:bg-emerald-600 text-white text-xs font-medium disabled:opacity-40 cursor-pointer"
            >
              {busy ? 'Assigning...' : 'Assign Caseload'}
            </button>
          </div>
        </section>

        {partners.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-10 text-center space-y-2">
            <UserCheck className="w-6 h-6 text-slate-400 mx-auto" />
            <p className="text-sm font-medium text-slate-900 dark:text-white">
              No Accountability Partners yet
            </p>
            <p className="text-xs text-slate-500">
              Invite a new Accountability Partner or promote an existing user in Participants.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {partners.map((partner) => {
              const caseload = members.filter((m) => m.partnerId === partner.uid);
              const loggedFollowUps = followUps.filter((f) => f.partnerId === partner.uid).length;
              return (
                <article
                  key={partner.uid}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                        {partner.displayName}
                      </h3>
                      <p className="text-xs text-slate-500">
                        {partner.department} ·{' '}
                        <span
                          className={
                            partner.status === 'active'
                              ? 'text-emerald-600 dark:text-emerald-400 font-medium'
                              : 'text-rose-600 dark:text-rose-400 font-medium'
                          }
                        >
                          {partner.status}
                        </span>
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Link
                        to={`/admin/participants/${partner.uid}`}
                        className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium"
                      >
                        Edit
                      </Link>
                      <button
                        type="button"
                        onClick={() => togglePartnerStatus(partner)}
                        className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium cursor-pointer"
                      >
                        {partner.status === 'active' ? 'Deactivate' : 'Activate'}
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 dark:bg-slate-950 p-3 rounded-lg">
                    <div>
                      <p className="text-slate-400">Assigned Members</p>
                      <p className="text-lg font-bold font-mono tabular-nums text-slate-900 dark:text-white">
                        {caseload.length}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-400">Follow-Ups Logged</p>
                      <p className="text-lg font-bold font-mono tabular-nums text-slate-900 dark:text-white">
                        {loggedFollowUps}
                      </p>
                    </div>
                  </div>

                  {caseload.length > 0 && (
                    <div className="space-y-1 text-xs">
                      <p className="font-medium text-slate-700 dark:text-slate-300">Caseload:</p>
                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-slate-600 dark:text-slate-400">
                        {caseload.map((m) => (
                          <Link
                            key={m.uid}
                            to={`/admin/participants/${m.uid}`}
                            className="hover:text-emerald-600 dark:hover:text-emerald-400 underline-offset-2 hover:underline"
                          >
                            {m.displayName}
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
