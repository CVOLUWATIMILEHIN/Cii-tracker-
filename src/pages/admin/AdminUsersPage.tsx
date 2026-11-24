import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Copy,
  Download,
  Edit3,
  Power,
  Search,
  ShieldAlert,
  ShieldCheck,
  UserMinus,
  UserPlus,
  X,
} from 'lucide-react';
import { AppShell } from '../../components/AppShell';
import { useAuth } from '../../context/AuthContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { exportAdminUsersCsv, formatTimestamp } from '../../lib/exportReports';
import {
  createInvitation,
  fetchUserPrivateInfoMap,
  recordAuditEvent,
  revokeInvitation,
  superAdminRevokeAdminAccess,
  superAdminUpdateAdminAccount,
} from '../../services/ciiService';
import {
  ADMIN_ROLE_DESCRIPTIONS,
  ADMIN_ROLES,
  AdminRole,
  isAdminPortalRole,
  normalizeRole,
  ROLE_LABELS,
  UserPrivateInfo,
  UserProfile,
  UserStatus,
} from '../../types';

export function AdminUsersPage() {
  const { profile } = useAuth();
  const { users, cohorts, invitations } = useWorkspace();

  const [privateInfoMap, setPrivateInfoMap] = useState<Record<string, UserPrivateInfo>>({});
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<AdminRole | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<UserStatus | 'all'>('all');
  const [pageError, setPageError] = useState<string | null>(null);
  const [pageSuccess, setPageSuccess] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [busyUid, setBusyUid] = useState<string | null>(null);
  const [selectedUids, setSelectedUids] = useState<string[]>([]);
  const [bulkBusy, setBulkBusy] = useState(false);

  // Create administrator modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createMode, setCreateMode] = useState<'invite' | 'promote'>('invite');
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<AdminRole>('admin');
  const [newDepartment, setNewDepartment] = useState('Programme Administration');
  const [newCohortIds, setNewCohortIds] = useState<string[]>([]);
  const [selectedExistingUid, setSelectedExistingUid] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createdActivationUrl, setCreatedActivationUrl] = useState<string | null>(null);

  // Edit administrator modal
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [editName, setEditName] = useState('');
  const [editDepartment, setEditDepartment] = useState('');
  const [editRole, setEditRole] = useState<AdminRole>('admin');
  const [editStatus, setEditStatus] = useState<UserStatus>('active');
  const [editCohortIds, setEditCohortIds] = useState<string[]>([]);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Revoke confirmation modal
  const [revokingUser, setRevokingUser] = useState<UserProfile | null>(null);
  const [revokeDeactivate, setRevokeDeactivate] = useState(false);
  const [revoking, setRevoking] = useState(false);

  const adminUsers = useMemo(
    () => users.filter((u) => isAdminPortalRole(u.role)),
    [users]
  );

  const nonAdminUsers = useMemo(
    () => users.filter((u) => !isAdminPortalRole(u.role) && u.status === 'active'),
    [users]
  );

  const adminInvitations = useMemo(
    () => invitations.filter((inv) => isAdminPortalRole(inv.role)),
    [invitations]
  );

  const activeSuperAdminCount = useMemo(
    () =>
      adminUsers.filter(
        (u) => normalizeRole(u.role) === 'super_admin' && u.status === 'active'
      ).length,
    [adminUsers]
  );

  const adminUidKey = useMemo(
    () => adminUsers.map((u) => u.uid).sort().join(','),
    [adminUsers]
  );

  useEffect(() => {
    const uids = adminUidKey ? adminUidKey.split(',') : [];
    if (uids.length === 0) {
      setPrivateInfoMap({});
      return;
    }
    let cancelled = false;
    void fetchUserPrivateInfoMap(uids).then((map) => {
      if (!cancelled) setPrivateInfoMap(map);
    });
    return () => {
      cancelled = true;
    };
  }, [adminUidKey]);

  const filteredAdmins = useMemo(() => {
    const q = search.trim().toLowerCase();
    return adminUsers.filter((u) => {
      const normalized = normalizeRole(u.role) as AdminRole;
      if (roleFilter !== 'all' && normalized !== roleFilter) return false;
      if (statusFilter !== 'all' && u.status !== statusFilter) return false;
      if (q) {
        const email = (privateInfoMap[u.uid]?.email || '').toLowerCase();
        const matchesName = u.displayName.toLowerCase().includes(q);
        const matchesDept = u.department.toLowerCase().includes(q);
        const matchesEmail = email.includes(q);
        const matchesRole = ROLE_LABELS[normalized].toLowerCase().includes(q);
        if (!matchesName && !matchesDept && !matchesEmail && !matchesRole) return false;
      }
      return true;
    });
  }, [adminUsers, roleFilter, statusFilter, search, privateInfoMap]);

  if (!profile) return null;

  const toggleCohortInList = (
    cohortId: string,
    list: string[],
    setter: React.Dispatch<React.SetStateAction<string[]>>
  ) => {
    setter(list.includes(cohortId) ? list.filter((id) => id !== cohortId) : [...list, cohortId]);
  };

  const openCreateModal = () => {
    setCreateError(null);
    setCreatedActivationUrl(null);
    setCreateMode('invite');
    setNewName('');
    setNewEmail('');
    setNewRole('admin');
    setNewDepartment('Programme Administration');
    setNewCohortIds([]);
    setSelectedExistingUid(nonAdminUsers[0]?.uid || '');
    setShowCreateModal(true);
  };

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    setCreatedActivationUrl(null);
    setPageSuccess(null);

    const requiresScope = newRole === 'programme_manager' || newRole === 'reviewer';
    if (requiresScope && newCohortIds.length === 0) {
      setCreateError(
        `Select at least one assigned cohort for a ${ROLE_LABELS[newRole]}.`
      );
      return;
    }

    setCreating(true);
    try {
      if (createMode === 'invite') {
        if (!newName.trim() || !newEmail.trim()) {
          setCreateError('Full name and email address are required.');
          return;
        }
        const inviteCode = await createInvitation({
          actor: profile,
          email: newEmail.trim(),
          displayName: newName.trim(),
          role: newRole,
          cohortId: requiresScope ? newCohortIds[0] || '' : '',
          cohortName: requiresScope
            ? cohorts.find((c) => c.id === newCohortIds[0])?.name || ''
            : '',
          assignedCohortIds: requiresScope ? newCohortIds : [],
          partnerId: '',
          partnerName: '',
          stateCode: '',
          ppa: '',
          department: newDepartment.trim() || ROLE_LABELS[newRole],
        });
        const url = `${window.location.origin}/activate-account?code=${encodeURIComponent(
          inviteCode
        )}&email=${encodeURIComponent(newEmail.trim().toLowerCase())}`;
        setCreatedActivationUrl(url);
        setPageSuccess(
          `Issued ${ROLE_LABELS[newRole]} activation invite (${inviteCode}) for ${newEmail.trim().toLowerCase()}.`
        );
      } else {
        const target = nonAdminUsers.find((u) => u.uid === selectedExistingUid);
        if (!target) {
          setCreateError('Select an existing verified user to promote.');
          return;
        }
        await superAdminUpdateAdminAccount({
          actor: profile,
          target,
          displayName: target.displayName,
          department: newDepartment.trim() || ROLE_LABELS[newRole],
          role: newRole,
          status: 'active',
          assignedCohortIds: requiresScope ? newCohortIds : [],
          activeSuperAdminCount,
        });
        setShowCreateModal(false);
        setPageSuccess(
          `Assigned ${ROLE_LABELS[newRole]} role to ${target.displayName}.`
        );
      }
    } catch (err) {
      setCreateError(
        err instanceof Error ? err.message : 'Unable to create administrator.'
      );
    } finally {
      setCreating(false);
    }
  };

  const openEditModal = (u: UserProfile) => {
    setEditError(null);
    setEditingUser(u);
    setEditName(u.displayName);
    setEditDepartment(u.department);
    setEditRole(normalizeRole(u.role) as AdminRole);
    setEditStatus(u.status);
    setEditCohortIds(u.assignedCohortIds || []);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setEditError(null);
    setPageSuccess(null);

    const requiresScope = editRole === 'programme_manager' || editRole === 'reviewer';
    if (requiresScope && editCohortIds.length === 0) {
      setEditError(
        `Select at least one assigned cohort for a ${ROLE_LABELS[editRole]}.`
      );
      return;
    }

    setSavingEdit(true);
    try {
      await superAdminUpdateAdminAccount({
        actor: profile,
        target: editingUser,
        displayName: editName,
        department: editDepartment,
        role: editRole,
        status: editStatus,
        assignedCohortIds: requiresScope ? editCohortIds : [],
        activeSuperAdminCount,
      });
      setEditingUser(null);
      setPageSuccess(`Updated administrator account for ${editName}.`);
    } catch (err) {
      setEditError(
        err instanceof Error ? err.message : 'Unable to update administrator.'
      );
    } finally {
      setSavingEdit(false);
    }
  };

  const handleToggleActive = async (target: UserProfile) => {
    setPageError(null);
    setPageSuccess(null);
    setBusyUid(target.uid);
    const nextStatus: UserStatus = target.status === 'active' ? 'inactive' : 'active';
    try {
      await superAdminUpdateAdminAccount({
        actor: profile,
        target,
        displayName: target.displayName,
        department: target.department,
        role: normalizeRole(target.role) as AdminRole,
        status: nextStatus,
        assignedCohortIds: target.assignedCohortIds || [],
        activeSuperAdminCount,
      });
      setPageSuccess(
        `${target.displayName} is now ${nextStatus === 'active' ? 'active' : 'deactivated'}.`
      );
    } catch (err) {
      setPageError(
        err instanceof Error ? err.message : 'Unable to change account status.'
      );
    } finally {
      setBusyUid(null);
    }
  };

  const handleConfirmRevoke = async () => {
    if (!revokingUser) return;
    setPageError(null);
    setPageSuccess(null);
    setRevoking(true);
    try {
      await superAdminRevokeAdminAccess({
        actor: profile,
        target: revokingUser,
        deactivateAccount: revokeDeactivate,
        activeSuperAdminCount,
      });
      setPageSuccess(`Revoked administrative access for ${revokingUser.displayName}.`);
      setRevokingUser(null);
      setRevokeDeactivate(false);
    } catch (err) {
      setPageError(
        err instanceof Error ? err.message : 'Unable to revoke administrative access.'
      );
      setRevokingUser(null);
    } finally {
      setRevoking(false);
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

  const handleRevokeInvite = async (inv: (typeof adminInvitations)[number]) => {
    setPageError(null);
    try {
      await revokeInvitation(inv, profile);
      setPageSuccess(`Revoked pending admin invitation ${inv.id}.`);
    } catch (err) {
      setPageError(err instanceof Error ? err.message : 'Unable to revoke invitation.');
    }
  };

  const isProtectedSelfOrLastSuperAdmin = (u: UserProfile) => {
    const isSelf = u.uid === profile.uid;
    const isLastSuper =
      normalizeRole(u.role) === 'super_admin' &&
      u.status === 'active' &&
      activeSuperAdminCount <= 1;
    return isSelf || isLastSuper;
  };

  const allFilteredSelected =
    filteredAdmins.length > 0 && filteredAdmins.every((u) => selectedUids.includes(u.uid));

  const toggleSelectAllFiltered = () => {
    if (allFilteredSelected) {
      const visibleIds = new Set(filteredAdmins.map((u) => u.uid));
      setSelectedUids((prev) => prev.filter((id) => !visibleIds.has(id)));
    } else {
      const merged = new Set([...selectedUids, ...filteredAdmins.map((u) => u.uid)]);
      setSelectedUids(Array.from(merged));
    }
  };

  const toggleSelectOne = (uid: string) => {
    setSelectedUids((prev) =>
      prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]
    );
  };

  const selectedAdmins = adminUsers.filter((u) => selectedUids.includes(u.uid));
  const deactivatableSelectedAdmins = selectedAdmins.filter(
    (u) => u.status === 'active' && !isProtectedSelfOrLastSuperAdmin(u)
  );
  const activatableSelectedAdmins = selectedAdmins.filter((u) => u.status !== 'active');

  const handleBulkDeactivateSelected = async () => {
    setPageError(null);
    setPageSuccess(null);

    if (selectedAdmins.length === 0) {
      setPageError('Select at least one administrator account first.');
      return;
    }

    const targets = selectedAdmins.filter(
      (u) => u.status === 'active' && !isProtectedSelfOrLastSuperAdmin(u)
    );
    const skippedProtected = selectedAdmins.filter((u) =>
      isProtectedSelfOrLastSuperAdmin(u)
    ).length;

    if (targets.length === 0) {
      setPageError(
        skippedProtected > 0
          ? 'Your own account and the last active Super Admin cannot be deactivated.'
          : 'All selected administrator accounts are already inactive.'
      );
      return;
    }

    setBulkBusy(true);
    let currentSuperCount = activeSuperAdminCount;
    let updatedCount = 0;

    try {
      for (const target of targets) {
        const isSuper =
          normalizeRole(target.role) === 'super_admin' && target.status === 'active';
        if (isSuper && currentSuperCount <= 1) {
          continue;
        }
        await superAdminUpdateAdminAccount({
          actor: profile,
          target,
          displayName: target.displayName,
          department: target.department,
          role: normalizeRole(target.role) as AdminRole,
          status: 'inactive',
          assignedCohortIds: target.assignedCohortIds || [],
          activeSuperAdminCount: currentSuperCount,
        });
        if (isSuper) currentSuperCount -= 1;
        updatedCount += 1;
      }

      setSelectedUids([]);
      setPageSuccess(
        `Deactivated ${updatedCount} selected administrator account(s)${
          skippedProtected > 0
            ? ` (${skippedProtected} protected Super Admin account skipped)`
            : ''
        }.`
      );
    } catch (err) {
      setPageError(
        err instanceof Error ? err.message : 'Unable to complete batch deactivation.'
      );
    } finally {
      setBulkBusy(false);
    }
  };

  const handleBulkActivateSelected = async () => {
    setPageError(null);
    setPageSuccess(null);
    const targets = selectedAdmins.filter((u) => u.status !== 'active');
    if (targets.length === 0) return;

    setBulkBusy(true);
    let updatedCount = 0;
    try {
      for (const target of targets) {
        await superAdminUpdateAdminAccount({
          actor: profile,
          target,
          displayName: target.displayName,
          department: target.department,
          role: normalizeRole(target.role) as AdminRole,
          status: 'active',
          assignedCohortIds: target.assignedCohortIds || [],
          activeSuperAdminCount,
        });
        updatedCount += 1;
      }
      setSelectedUids([]);
      setPageSuccess(`Activated ${updatedCount} selected administrator account(s).`);
    } catch (err) {
      setPageError(
        err instanceof Error ? err.message : 'Unable to complete batch activation.'
      );
    } finally {
      setBulkBusy(false);
    }
  };

  const handleExportAdminUsersCsv = (onlySelected = false) => {
    const listToExport =
      onlySelected && selectedAdmins.length > 0 ? selectedAdmins : filteredAdmins;
    exportAdminUsersCsv(listToExport, privateInfoMap, cohorts);
    void recordAuditEvent({
      actorId: profile.uid,
      actorName: profile.displayName,
      actorRole: normalizeRole(profile.role),
      action: 'EXPORT_ADMIN_USERS_CSV',
      category: 'export',
      severity: 'info',
      targetType: 'admin_users',
      targetId: onlySelected ? 'selected' : 'filtered',
      summary: `Exported ${listToExport.length} administrator account(s) to CSV.`,
    });
    setPageSuccess(`Exported ${listToExport.length} administrator account(s) to CSV.`);
  };

  return (
    <AppShell
      title="Admin Users"
      breadcrumb="Admin /"
      actions={
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleExportAdminUsersCsv(false)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs sm:text-sm font-medium cursor-pointer whitespace-nowrap"
          >
            <Download className="w-4 h-4" />
            <span>Export User List</span>
          </button>
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-900 dark:bg-emerald-600 text-white text-xs sm:text-sm font-medium cursor-pointer whitespace-nowrap"
          >
            <UserPlus className="w-4 h-4" />
            <span>Create Administrator</span>
          </button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Role Governance Overview */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-1">
            <p className="text-xs text-slate-500 dark:text-slate-400">Total Administrators</p>
            <p className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
              {adminUsers.length}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {adminUsers.filter((u) => u.status === 'active').length} active accounts
            </p>
          </div>
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-1">
            <p className="text-xs text-slate-500 dark:text-slate-400">Active Super Admins</p>
            <p className="text-2xl font-bold font-mono tabular-nums text-emerald-700 dark:text-emerald-400">
              {activeSuperAdminCount}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Minimum 1 enforced by backend rules
            </p>
          </div>
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-1">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Programme Managers &amp; Reviewers
            </p>
            <p className="text-2xl font-bold font-mono tabular-nums text-indigo-600 dark:text-indigo-400">
              {
                adminUsers.filter((u) => {
                  const r = normalizeRole(u.role);
                  return r === 'programme_manager' || r === 'reviewer';
                }).length
              }
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Cohort-scoped access control
            </p>
          </div>
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-1">
            <p className="text-xs text-slate-500 dark:text-slate-400">Pending Admin Invites</p>
            <p className="text-2xl font-bold font-mono tabular-nums text-amber-600 dark:text-amber-400">
              {adminInvitations.filter((i) => i.status === 'pending').length}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Email-bound activation links
            </p>
          </div>
        </div>

        {pageError && (
          <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>{pageError}</span>
          </div>
        )}

        {pageSuccess && (
          <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{pageSuccess}</span>
          </div>
        )}

        {/* Search & Filter Bar */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search admin name, email, role, or department..."
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as AdminRole | 'all')}
              className="px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
            >
              <option value="all">All Admin Roles</option>
              {ADMIN_ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
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
          </div>
        </div>

        {/* Batch Action Toolbar */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 text-xs">
            <label className="inline-flex items-center gap-2 font-medium text-slate-700 dark:text-slate-200 cursor-pointer">
              <input
                type="checkbox"
                checked={allFilteredSelected}
                onChange={toggleSelectAllFiltered}
                aria-label="Select all filtered administrators"
                className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-600 cursor-pointer"
              />
              <span>
                {selectedUids.length > 0
                  ? `${selectedUids.length} administrator(s) selected`
                  : 'Select administrators for batch actions'}
              </span>
            </label>
            {selectedUids.length > 0 && (
              <button
                type="button"
                onClick={() => setSelectedUids([])}
                className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 underline cursor-pointer"
              >
                Clear selection
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={bulkBusy || deactivatableSelectedAdmins.length === 0}
              onClick={handleBulkDeactivateSelected}
              title={
                selectedUids.length === 0
                  ? 'Select one or more active administrators to deactivate'
                  : deactivatableSelectedAdmins.length === 0
                    ? 'Selected accounts are either already inactive or protected Super Admin accounts'
                    : 'Deactivate selected administrator accounts'
              }
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-200 dark:border-rose-800 bg-rose-50/70 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-950/60 text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <Power className="w-3.5 h-3.5" />
              <span>
                {bulkBusy
                  ? 'Processing...'
                  : `Deactivate Selected${
                      deactivatableSelectedAdmins.length > 0
                        ? ` (${deactivatableSelectedAdmins.length})`
                        : ''
                    }`}
              </span>
            </button>

            {activatableSelectedAdmins.length > 0 && (
              <button
                type="button"
                disabled={bulkBusy}
                onClick={handleBulkActivateSelected}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-950/60 text-xs font-medium disabled:opacity-40 cursor-pointer"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Activate Selected ({activatableSelectedAdmins.length})</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => handleExportAdminUsersCsv(selectedUids.length > 0)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-medium cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>
                {selectedUids.length > 0
                  ? `Export Selected (${selectedUids.length}) as CSV`
                  : 'Export User List (CSV)'}
              </span>
            </button>
          </div>
        </div>

        {/* Administrator Directory Table */}
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 text-xs font-semibold text-slate-500 dark:text-slate-400">
                  <th className="py-3 pl-4 pr-2 w-10">
                    <input
                      type="checkbox"
                      checked={allFilteredSelected}
                      onChange={toggleSelectAllFiltered}
                      aria-label="Select all administrators in table"
                      className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-600 cursor-pointer"
                    />
                  </th>
                  <th className="py-3 px-4">Administrator</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Programme Scope</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Created</th>
                  <th className="py-3 px-4">Last Login</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {filteredAdmins.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-500">
                      No administrator accounts match the current filters.
                    </td>
                  </tr>
                ) : (
                  filteredAdmins.map((u) => {
                    const normalized = normalizeRole(u.role) as AdminRole;
                    const priv = privateInfoMap[u.uid];
                    const isSelf = u.uid === profile.uid;
                    const locked = isProtectedSelfOrLastSuperAdmin(u);
                    const isSelected = selectedUids.includes(u.uid);
                    const assignedCohortNames = (u.assignedCohortIds || [])
                      .map((cid) => cohorts.find((c) => c.id === cid)?.code || cid)
                      .join(', ');

                    return (
                      <tr
                        key={u.uid}
                        className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/40 ${
                          isSelected ? 'bg-emerald-50/40 dark:bg-emerald-950/20' : ''
                        }`}
                      >
                        <td className="py-3 pl-4 pr-2">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectOne(u.uid)}
                            aria-label={`Select ${u.displayName}`}
                            className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-600 cursor-pointer"
                          />
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-slate-900 dark:text-white">
                              {u.displayName}
                            </span>
                            {isSelf && (
                              <span className="text-[11px] font-mono text-emerald-700 dark:text-emerald-400">
                                (You)
                              </span>
                            )}
                          </div>
                          <p className="text-slate-500 dark:text-slate-400">
                            {priv?.email || 'Verified Firebase User'} · {u.department}
                          </p>
                        </td>
                        <td className="py-3 px-4 font-medium text-slate-800 dark:text-slate-200 whitespace-nowrap">
                          {ROLE_LABELS[normalized]}
                        </td>
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-300 max-w-[200px]">
                          {normalized === 'super_admin' || normalized === 'admin' ? (
                            <span className="text-slate-500 dark:text-slate-400">All Cohorts</span>
                          ) : assignedCohortNames ? (
                            <span className="font-mono">{assignedCohortNames}</span>
                          ) : (
                            <span className="text-amber-600 dark:text-amber-400">
                              No cohorts assigned
                            </span>
                          )}
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
                        <td className="py-3 px-4 font-mono tabular-nums text-slate-500 dark:text-slate-400 whitespace-nowrap">
                          {formatTimestamp(u.createdAt)}
                        </td>
                        <td className="py-3 px-4 font-mono tabular-nums text-slate-500 dark:text-slate-400 whitespace-nowrap">
                          {formatTimestamp(u.lastLoginAt || priv?.lastActiveAt)}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => openEditModal(u)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              <span>Edit</span>
                            </button>
                            <button
                              type="button"
                              disabled={locked || busyUid === u.uid}
                              onClick={() => handleToggleActive(u)}
                              title={
                                locked
                                  ? 'Cannot deactivate your own account or the last active Super Admin'
                                  : u.status === 'active'
                                    ? 'Deactivate account'
                                    : 'Activate account'
                              }
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                            >
                              <Power className="w-3.5 h-3.5" />
                              <span>{u.status === 'active' ? 'Deactivate' : 'Activate'}</span>
                            </button>
                            <button
                              type="button"
                              disabled={locked}
                              onClick={() => {
                                setRevokeDeactivate(false);
                                setRevokingUser(u);
                              }}
                              title={
                                locked
                                  ? 'Cannot revoke your own account or the last active Super Admin'
                                  : 'Revoke administrative privileges'
                              }
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-rose-200 dark:border-rose-900 font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                            >
                              <UserMinus className="w-3.5 h-3.5" />
                              <span>Revoke</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Pending Administrative Invitations */}
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              Administrative Invitations ({adminInvitations.length})
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Email-bound invitations enforced by Firestore Security Rules. Share the activation link or dispatch via your configured email provider.
            </p>
          </div>

          {adminInvitations.length === 0 ? (
            <p className="text-xs text-slate-500 py-3">
              No administrative invitations issued yet.
            </p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {adminInvitations.map((inv) => (
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

        {/* Role Permissions Reference */}
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              Administrative Role Matrix (Backend Enforced)
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 text-xs">
            {ADMIN_ROLES.map((r) => (
              <div
                key={r}
                className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 space-y-1.5"
              >
                <p className="font-semibold text-slate-900 dark:text-white">{ROLE_LABELS[r]}</p>
                <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                  {ADMIN_ROLE_DESCRIPTIONS[r]}
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Create Administrator Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                Create Administrator Account
              </h2>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateAdmin} className="p-6 space-y-4 overflow-y-auto">
              <div className="grid grid-cols-2 gap-2 p-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setCreateMode('invite');
                    setCreateError(null);
                    setCreatedActivationUrl(null);
                  }}
                  className={`py-1.5 rounded-md font-medium cursor-pointer ${
                    createMode === 'invite'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  Invite New Admin
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCreateMode('promote');
                    setCreateError(null);
                    setCreatedActivationUrl(null);
                  }}
                  className={`py-1.5 rounded-md font-medium cursor-pointer ${
                    createMode === 'promote'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  Promote Existing User
                </button>
              </div>

              {createError && (
                <p className="text-xs font-medium text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-lg px-3 py-2">
                  {createError}
                </p>
              )}

              {createdActivationUrl ? (
                <div className="space-y-3 p-4 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs">
                  <p className="font-semibold text-emerald-800 dark:text-emerald-300">
                    Secure Activation Invitation Created
                  </p>
                  <p className="text-emerald-700 dark:text-emerald-300 leading-relaxed">
                    Share this one-time activation link with <span className="font-medium">{newEmail}</span>. Firestore Security Rules bind this invitation strictly to their verified email and assigned role ({ROLE_LABELS[newRole]}).
                  </p>
                  <div className="p-2 rounded bg-white dark:bg-slate-950 border border-emerald-200 dark:border-emerald-900 font-mono text-[11px] break-all text-slate-700 dark:text-slate-200">
                    {createdActivationUrl}
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        void navigator.clipboard?.writeText(createdActivationUrl);
                        setCopiedId('modal-url');
                        setTimeout(() => setCopiedId(null), 2000);
                      }}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-medium cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>{copiedId === 'modal-url' ? 'Copied!' : 'Copy Activation Link'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowCreateModal(false)}
                      className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-medium cursor-pointer"
                    >
                      Done
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {createMode === 'invite' ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium mb-1">Full Name</label>
                        <input
                          type="text"
                          required
                          maxLength={100}
                          value={newName}
                          onChange={(e) => setNewName(e.target.value)}
                          placeholder="e.g., Adaobi Okafor"
                          className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1">Verified Email</label>
                        <input
                          type="email"
                          required
                          maxLength={160}
                          value={newEmail}
                          onChange={(e) => setNewEmail(e.target.value)}
                          placeholder="admin@cii.org"
                          className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
                        />
                      </div>
                    </div>
                  ) : (
                    <div>
                      <label className="block text-xs font-medium mb-1">
                        Select Existing Verified Account
                      </label>
                      {nonAdminUsers.length === 0 ? (
                        <p className="text-xs text-slate-500">
                          No active non-admin accounts available. Use &ldquo;Invite New Admin&rdquo; instead.
                        </p>
                      ) : (
                        <select
                          value={selectedExistingUid}
                          onChange={(e) => setSelectedExistingUid(e.target.value)}
                          className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
                        >
                          {nonAdminUsers.map((u) => (
                            <option key={u.uid} value={u.uid}>
                              {u.displayName} ({ROLE_LABELS[normalizeRole(u.role)]})
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium mb-1">Administrative Role</label>
                      <select
                        value={newRole}
                        onChange={(e) => setNewRole(e.target.value as AdminRole)}
                        className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
                      >
                        {ADMIN_ROLES.map((r) => (
                          <option key={r} value={r}>
                            {ROLE_LABELS[r]}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">Department / Unit</label>
                      <input
                        type="text"
                        required
                        maxLength={64}
                        value={newDepartment}
                        onChange={(e) => setNewDepartment(e.target.value)}
                        className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
                      />
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {ADMIN_ROLE_DESCRIPTIONS[newRole]}
                  </p>

                  {(newRole === 'programme_manager' || newRole === 'reviewer') && (
                    <div className="space-y-1.5">
                      <label className="block text-xs font-medium">
                        Assigned Cohorts (Required for {ROLE_LABELS[newRole]})
                      </label>
                      {cohorts.length === 0 ? (
                        <p className="text-xs text-amber-600 dark:text-amber-400">
                          Create at least one cohort first under Cohorts before assigning scoped access.
                        </p>
                      ) : (
                        <div className="max-h-40 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-lg divide-y divide-slate-100 dark:divide-slate-800">
                          {cohorts.map((c) => (
                            <label
                              key={c.id}
                              className="flex items-center gap-2.5 px-3 py-2 text-xs cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50"
                            >
                              <input
                                type="checkbox"
                                checked={newCohortIds.includes(c.id)}
                                onChange={() => toggleCohortInList(c.id, newCohortIds, setNewCohortIds)}
                                className="rounded border-slate-300 text-emerald-600"
                              />
                              <span className="font-mono text-slate-500">{c.code}</span>
                              <span className="text-slate-900 dark:text-white truncate">
                                {c.name}
                              </span>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowCreateModal(false)}
                      className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={creating || (createMode === 'promote' && nonAdminUsers.length === 0)}
                      className="px-4 py-2 rounded-lg bg-slate-900 dark:bg-emerald-600 text-white text-xs font-medium disabled:opacity-60 cursor-pointer"
                    >
                      {creating
                        ? 'Provisioning...'
                        : createMode === 'invite'
                          ? 'Generate Admin Invite'
                          : 'Assign Admin Role'}
                    </button>
                  </div>
                </>
              )}
            </form>
          </div>
        </div>
      )}

      {/* Edit Administrator Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                Edit Administrator · {editingUser.displayName}
              </h2>
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-6 space-y-4 overflow-y-auto">
              {editError && (
                <p className="text-xs font-medium text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-lg px-3 py-2">
                  {editError}
                </p>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    maxLength={100}
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Department / Unit</label>
                  <input
                    type="text"
                    required
                    maxLength={64}
                    value={editDepartment}
                    onChange={(e) => setEditDepartment(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1">Administrative Role</label>
                  <select
                    value={editRole}
                    disabled={isProtectedSelfOrLastSuperAdmin(editingUser)}
                    onChange={(e) => setEditRole(e.target.value as AdminRole)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 disabled:opacity-60"
                  >
                    {ADMIN_ROLES.map((r) => (
                      <option key={r} value={r}>
                        {ROLE_LABELS[r]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Account Status</label>
                  <select
                    value={editStatus}
                    disabled={isProtectedSelfOrLastSuperAdmin(editingUser)}
                    onChange={(e) => setEditStatus(e.target.value as UserStatus)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 disabled:opacity-60"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="suspended">Suspended</option>
                  </select>
                </div>
              </div>

              {isProtectedSelfOrLastSuperAdmin(editingUser) && (
                <p className="text-[11px] text-amber-700 dark:text-amber-400">
                  Role and status changes are locked on your own Super Admin account to guarantee at least one active Super Admin always retains access.
                </p>
              )}

              {(editRole === 'programme_manager' || editRole === 'reviewer') && (
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium">
                    Assigned Cohorts ({editCohortIds.length} selected)
                  </label>
                  <div className="max-h-40 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-lg divide-y divide-slate-100 dark:divide-slate-800">
                    {cohorts.map((c) => (
                      <label
                        key={c.id}
                        className="flex items-center gap-2.5 px-3 py-2 text-xs cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50"
                      >
                        <input
                          type="checkbox"
                          checked={editCohortIds.includes(c.id)}
                          onChange={() =>
                            toggleCohortInList(c.id, editCohortIds, setEditCohortIds)
                          }
                          className="rounded border-slate-300 text-emerald-600"
                        />
                        <span className="font-mono text-slate-500">{c.code}</span>
                        <span className="text-slate-900 dark:text-white truncate">{c.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="px-4 py-2 rounded-lg bg-slate-900 dark:bg-emerald-600 text-white text-xs font-medium disabled:opacity-60 cursor-pointer"
                >
                  {savingEdit ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Revoke Access Confirmation Modal */}
      {revokingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl p-6 space-y-4">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              Revoke Administrative Access?
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              This removes <span className="font-semibold">{revokingUser.displayName}</span> from{' '}
              <span className="font-semibold">
                {ROLE_LABELS[normalizeRole(revokingUser.role)]}
              </span>{' '}
              and immediately strips all Admin Portal permissions in Firestore Security Rules.
            </p>
            <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={revokeDeactivate}
                onChange={(e) => setRevokeDeactivate(e.target.checked)}
                className="rounded border-slate-300 text-rose-600"
              />
              <span>Also deactivate account (blocks all portal sign-in)</span>
            </label>
            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRevokingUser(null)}
                className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={revoking}
                onClick={handleConfirmRevoke}
                className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-medium disabled:opacity-60 cursor-pointer"
              >
                {revoking ? 'Revoking...' : 'Confirm Revoke'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
