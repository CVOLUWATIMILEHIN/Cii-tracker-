import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Copy,
  Download,
  Edit3,
  Eye,
  FileSpreadsheet,
  Power,
  Search,
  Upload,
  UserCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { AppShell } from '../../components/AppShell';
import { useAuth } from '../../context/AuthContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { formatTimestamp } from '../../lib/exportReports';
import {
  downloadPartnerImportTemplate,
  downloadRejectedPartnerRowsReport,
   parseAndValidatePartnerSpreadsheet,
  PartnerImportAnalysis,
} from '../../lib/partnerImport';
import {
  adminUpdatePartnerProfile,
  adminUpdateUser,
  bulkImportPartnerInvitations,
  createInvitation,
  fetchUserPrivateInfoMap,
  recordAuditEvent,
  revokeInvitation,
} from '../../services/ciiService';
import {
  DEFAULT_PARTNER_MAX_CASELOAD,
  isFullAdminRole,
  normalizeRole,
  UserPrivateInfo,
  UserProfile,
  UserStatus,
} from '../../types';

export function AdminPartnersPage() {
  const { profile } = useAuth();
  const { users, cohorts, invitations, followUps } = useWorkspace();

  const [privateInfoMap, setPrivateInfoMap] = useState<Record<string, UserPrivateInfo>>({});
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<UserStatus | 'all'>('all');
  const [capacityFilter, setCapacityFilter] = useState<'all' | 'available' | 'full'>('all');
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Add Individual Partner Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [addFullName, setAddFullName] = useState('');
  const [addEmail, setAddEmail] = useState('');
  const [addPhone, setAddPhone] = useState('');
  const [addGender, setAddGender] = useState('');
  const [addState, setAddState] = useState('');
  const [addOrganisation, setAddOrganisation] = useState('Corper Impact Initiative');
  const [addMaxCaseload, setAddMaxCaseload] = useState<number>(DEFAULT_PARTNER_MAX_CASELOAD);
  const [addNotes, setAddNotes] = useState('');
  const [addCohortId, setAddCohortId] = useState('');
  const [addingPartner, setAddingPartner] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [createdPartnerInvite, setCreatedPartnerInvite] = useState<{
    code: string;
    email: string;
    url: string;
  } | null>(null);

  // Edit Partner Modal
  const [editingPartner, setEditingPartner] = useState<UserProfile | null>(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editGender, setEditGender] = useState('');
  const [editState, setEditState] = useState('');
  const [editOrganisation, setEditOrganisation] = useState('');
  const [editMaxCaseload, setEditMaxCaseload] = useState<number>(DEFAULT_PARTNER_MAX_CASELOAD);
  const [editNotes, setEditNotes] = useState('');
  const [editStatus, setEditStatus] = useState<UserStatus>('active');
  const [editCohortId, setEditCohortId] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // View Partner Details & Reassign Modal
  const [viewingPartner, setViewingPartner] = useState<UserProfile | null>(null);
  const [reassignTargetMap, setReassignTargetMap] = useState<Record<string, string>>({});
  const [reassigningMemberId, setReassigningMemberId] = useState<string | null>(null);

  // Bulk Partner Import Modal
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFileName, setImportFileName] = useState('');
  const [importAnalysis, setImportAnalysis] = useState<PartnerImportAnalysis | null>(null);
  const [importCohortId, setImportCohortId] = useState('');
  const [parsingFile, setParsingFile] = useState(false);
  const [importingBatch, setImportingBatch] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importedResults, setImportedResults] = useState<
    Array<{ inviteCode: string; email: string; displayName: string; maxCaseload: number }>
  >([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const partners = useMemo(
    () => users.filter((u) => normalizeRole(u.role) === 'partner'),
    [users]
  );

  const members = useMemo(
    () => users.filter((u) => normalizeRole(u.role) === 'member'),
    [users]
  );

  const partnerInvitations = useMemo(
    () => invitations.filter((inv) => normalizeRole(inv.role) === 'partner'),
    [invitations]
  );

  const allUidKey = useMemo(
    () => users.map((u) => u.uid).sort().join(','),
    [users]
  );

  useEffect(() => {
    const uids = allUidKey ? allUidKey.split(',') : [];
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
  }, [allUidKey]);

  const existingSystemEmails = useMemo(() => {
    const set = new Set<string>();
    Object.values(privateInfoMap).forEach((info) => {
      if (info?.email) set.add(info.email.trim().toLowerCase());
    });
    invitations.forEach((inv) => {
      if (inv.status !== 'revoked' && inv.email) {
        set.add(inv.email.trim().toLowerCase());
      }
    });
    return set;
  }, [privateInfoMap, invitations]);

  const caseloadCountByPartner = useMemo(() => {
    const map: Record<string, number> = {};
    for (const m of members) {
      if (m.partnerId) {
        map[m.partnerId] = (map[m.partnerId] || 0) + 1;
      }
    }
    return map;
  }, [members]);

  const getPartnerMaxCaseload = (p: UserProfile): number =>
    typeof p.maxCaseload === 'number' && p.maxCaseload > 0
      ? p.maxCaseload
      : DEFAULT_PARTNER_MAX_CASELOAD;

  const getPartnerAvailableCapacity = (p: UserProfile): number => {
    const assigned = caseloadCountByPartner[p.uid] || 0;
    return Math.max(0, getPartnerMaxCaseload(p) - assigned);
  };

  const filteredPartners = useMemo(() => {
    const q = search.trim().toLowerCase();
    return partners.filter((p) => {
      if (statusFilter !== 'all' && p.status !== statusFilter) return false;
      const available = getPartnerAvailableCapacity(p);
      if (capacityFilter === 'available' && (p.status !== 'active' || available <= 0)) {
        return false;
      }
      if (capacityFilter === 'full' && available > 0) {
        return false;
      }
      if (q) {
        const email = (privateInfoMap[p.uid]?.email || '').toLowerCase();
        const phone = (p.phone || privateInfoMap[p.uid]?.phone || '').toLowerCase();
        const org = (p.organisation || p.department || '').toLowerCase();
        const state = (p.state || '').toLowerCase();
        const matches =
          p.displayName.toLowerCase().includes(q) ||
          email.includes(q) ||
          phone.includes(q) ||
          org.includes(q) ||
          state.includes(q);
        if (!matches) return false;
      }
      return true;
    });
  }, [partners, statusFilter, capacityFilter, search, privateInfoMap, caseloadCountByPartner]);

  const summaryMetrics = useMemo(() => {
    const activePartners = partners.filter((p) => p.status === 'active');
    const inactivePartners = partners.filter((p) => p.status !== 'active');
    const assignedMembers = members.filter((m) => Boolean(m.partnerId)).length;
    const unassignedMembers = members.length - assignedMembers;
    const partnersWithCapacity = activePartners.filter(
      (p) => getPartnerAvailableCapacity(p) > 0
    ).length;
    const partnersAtFullCapacity = activePartners.filter(
      (p) => getPartnerAvailableCapacity(p) === 0
    ).length;
    const totalCapacity = activePartners.reduce((sum, p) => sum + getPartnerMaxCaseload(p), 0);
    const totalAvailableCapacity = activePartners.reduce(
      (sum, p) => sum + getPartnerAvailableCapacity(p),
      0
    );

    return {
      totalPartners: partners.length,
      activePartners: activePartners.length,
      inactivePartners: inactivePartners.length,
      totalMembers: members.length,
      assignedMembers,
      unassignedMembers,
      partnersWithCapacity,
      partnersAtFullCapacity,
      totalCapacity,
      totalAvailableCapacity,
    };
  }, [partners, members, caseloadCountByPartner]);

  if (!profile) return null;

  const isFullAdmin = isFullAdminRole(profile.role);

  const handleDownloadTemplate = () => {
    downloadPartnerImportTemplate();
    void recordAuditEvent({
      actorId: profile.uid,
      actorName: profile.displayName,
      actorRole: normalizeRole(profile.role),
      action: 'PARTNER_TEMPLATE_DOWNLOADED',
      category: 'export',
      severity: 'info',
      targetType: 'partner_template',
      targetId: 'xlsx',
      summary: 'Downloaded CII_Accountability_Partner_Import_Template.xlsx.',
    });
  };

  const openAddPartnerModal = () => {
    setAddError(null);
    setCreatedPartnerInvite(null);
    setAddFullName('');
    setAddEmail('');
    setAddPhone('');
    setAddGender('');
    setAddState('');
    setAddOrganisation('Corper Impact Initiative');
    setAddMaxCaseload(DEFAULT_PARTNER_MAX_CASELOAD);
    setAddNotes('');
    setAddCohortId(cohorts[0]?.id || '');
    setShowAddModal(true);
  };

  const handleAddPartnerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError(null);
    setNotice(null);

    const cleanEmail = addEmail.trim().toLowerCase();
    if (!addFullName.trim() || !cleanEmail || !addPhone.trim()) {
      setAddError('Full Name, Email Address, and Phone Number are required.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(cleanEmail)) {
      setAddError('Please enter a valid email address.');
      return;
    }
    if (!/^\+?[0-9]{7,15}$/.test(addPhone.replace(/[\s\-().]/g, ''))) {
      setAddError('Please enter a valid phone number (7–15 digits).');
      return;
    }
    if (!Number.isInteger(Number(addMaxCaseload)) || Number(addMaxCaseload) <= 0) {
      setAddError('Maximum Caseload must be a positive whole number.');
      return;
    }
    if (existingSystemEmails.has(cleanEmail)) {
      setAddError('This email address is already registered or invited in the system.');
      return;
    }
    if (!isFullAdmin && !addCohortId) {
      setAddError('Programme Managers must select one of their assigned cohorts.');
      return;
    }

    const selectedCohort = cohorts.find((c) => c.id === addCohortId);
    setAddingPartner(true);
    try {
      const code = await createInvitation({
        actor: profile,
        email: cleanEmail,
        displayName: addFullName.trim(),
        role: 'partner',
        cohortId: selectedCohort?.id || '',
        cohortName: selectedCohort?.name || '',
        partnerId: '',
        partnerName: '',
        stateCode: '',
        ppa: '',
        department: addOrganisation.trim() || 'Accountability Partnership',
        phone: addPhone.trim(),
        gender: addGender.trim(),
        state: addState.trim(),
        organisation: addOrganisation.trim(),
        maxCaseload: Number(addMaxCaseload),
        notes: addNotes.trim(),
      });
      const url = `${window.location.origin}/activate-account?code=${encodeURIComponent(
        code
      )}&email=${encodeURIComponent(cleanEmail)}`;
      setCreatedPartnerInvite({ code, email: cleanEmail, url });
      setNotice(
        `Created Accountability Partner invitation (${code}) for ${addFullName.trim()}.`
      );
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Unable to create partner invitation.');
    } finally {
      setAddingPartner(false);
    }
  };

  const openEditPartnerModal = (partner: UserProfile) => {
    setEditError(null);
    setEditingPartner(partner);
    setEditName(partner.displayName);
    setEditPhone(partner.phone || privateInfoMap[partner.uid]?.phone || '');
    setEditGender(partner.gender || '');
    setEditState(partner.state || '');
    setEditOrganisation(partner.organisation || partner.department || '');
    setEditMaxCaseload(getPartnerMaxCaseload(partner));
    setEditNotes(partner.notes || '');
    setEditStatus(partner.status);
    setEditCohortId(partner.cohortId || '');
  };

  const handleSavePartnerEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPartner) return;
    setEditError(null);
    setNotice(null);

    if (!editName.trim()) {
      setEditError('Full Name is required.');
      return;
    }
    if (!Number.isInteger(Number(editMaxCaseload)) || Number(editMaxCaseload) <= 0) {
      setEditError('Maximum Caseload must be a positive whole number.');
      return;
    }
    const selectedCohort = cohorts.find((c) => c.id === editCohortId);
    setSavingEdit(true);
    try {
      await adminUpdatePartnerProfile({
        actor: profile,
        target: editingPartner,
        displayName: editName.trim(),
        phone: editPhone.trim(),
        gender: editGender.trim(),
        state: editState.trim(),
        organisation: editOrganisation.trim() || 'Accountability Partnership',
        maxCaseload: Number(editMaxCaseload),
        notes: editNotes.trim(),
        status: editStatus,
        cohortId: selectedCohort ? selectedCohort.id : editingPartner.cohortId,
        cohortName: selectedCohort ? selectedCohort.name : editingPartner.cohortName,
      });
      setNotice(`Updated Accountability Partner profile for ${editName.trim()}.`);
      setEditingPartner(null);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Unable to update partner.');
    } finally {
      setSavingEdit(false);
    }
  };

  const togglePartnerStatus = async (partner: UserProfile) => {
    setError(null);
    setNotice(null);
    const nextStatus: UserStatus = partner.status === 'active' ? 'inactive' : 'active';
    try {
      await adminUpdatePartnerProfile({
        actor: profile,
        target: partner,
        displayName: partner.displayName,
        phone: partner.phone || privateInfoMap[partner.uid]?.phone || '',
        gender: partner.gender || '',
        state: partner.state || '',
        organisation: partner.organisation || partner.department || 'Accountability Partnership',
        maxCaseload: getPartnerMaxCaseload(partner),
        notes: partner.notes || '',
        status: nextStatus,
      });
      setNotice(
        `${partner.displayName} is now ${nextStatus === 'active' ? 'active' : 'deactivated'}.`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to change partner status.');
    }
  };

  const handleReassignMember = async (member: UserProfile, newPartnerId: string) => {
    const targetPartner = partners.find((p) => p.uid === newPartnerId);
    if (!targetPartner) return;
    if (getPartnerAvailableCapacity(targetPartner) <= 0) {
      setError(`${targetPartner.displayName} is already at maximum caseload.`);
      return;
    }
    setReassigningMemberId(member.uid);
    setError(null);
    try {
      await adminUpdateUser({
        actor: profile,
        target: member,
        role: 'member',
        status: member.status,
        cohortId: member.cohortId,
        cohortName: member.cohortName,
        partnerId: targetPartner.uid,
        partnerName: targetPartner.displayName,
        stateCode: member.stateCode,
        ppa: member.ppa,
        department: member.department,
        skipDefaultAuditLog: true,
      });
      await recordAuditEvent({
        actorId: profile.uid,
        actorName: profile.displayName,
        actorRole: normalizeRole(profile.role),
        action: 'MEMBER_REASSIGNED_TO_PARTNER',
        category: 'rbac',
        severity: 'info',
        targetType: 'member_assignment',
        targetId: member.uid,
        summary: `Reassigned Corps Member ${member.displayName} from ${member.partnerName || 'Unassigned'} to ${targetPartner.displayName}.`,
      });
      setNotice(`Reassigned ${member.displayName} to ${targetPartner.displayName}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to reassign Corps Member.');
    } finally {
      setReassigningMemberId(null);
    }
  };

  const openImportModal = () => {
    setImportError(null);
    setImportFileName('');
    setImportAnalysis(null);
    setImportedResults([]);
    setImportCohortId(cohorts[0]?.id || '');
    setShowImportModal(true);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError(null);
    setImportedResults([]);
    setImportFileName(file.name);
    setParsingFile(true);
    try {
      const analysis = await parseAndValidatePartnerSpreadsheet(file, existingSystemEmails);
      setImportAnalysis(analysis);
    } catch (err) {
      setImportError(
        err instanceof Error
          ? err.message
          : 'Unable to parse spreadsheet. Please upload a valid .xlsx or .csv file.'
      );
      setImportAnalysis(null);
    } finally {
      setParsingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleConfirmBulkImport = async () => {
    if (!importAnalysis || importAnalysis.validRows.length === 0) return;
    if (!isFullAdmin && !importCohortId) {
      setImportError('Programme Managers must select an assigned cohort for imported partners.');
      return;
    }
    setImportError(null);
    setImportingBatch(true);
    const selectedCohort = cohorts.find((c) => c.id === importCohortId);
    try {
      const results = await bulkImportPartnerInvitations({
        actor: profile,
        cohortId: selectedCohort?.id || '',
        cohortName: selectedCohort?.name || '',
        rows: importAnalysis.validRows.map((r) => ({
          fullName: r.fullName,
          email: r.email,
          phone: r.phone,
          gender: r.gender,
          state: r.state,
          organisation: r.organisation,
          maxCaseload: r.maxCaseload,
          notes: r.notes,
        })),
      });
      setImportedResults(results);
      setImportAnalysis(null);
      setNotice(
        `Successfully imported ${results.length} Accountability Partner invitation(s).`
      );
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Bulk partner import failed.');
    } finally {
      setImportingBatch(false);
    }
  };

  const copyActivationUrl = (code: string, email: string) => {
    const url = `${window.location.origin}/activate-account?code=${encodeURIComponent(
      code
    )}&email=${encodeURIComponent(email)}`;
    void navigator.clipboard?.writeText(url);
    setCopiedId(code);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const rejectedImportRows = useMemo(() => {
    if (!importAnalysis) return [];
    return [
      ...importAnalysis.invalidRows,
      ...importAnalysis.duplicateRows,
      ...importAnalysis.existingRows,
    ];
  }, [importAnalysis]);

  return (
    <AppShell
      title="Accountability Partner Management"
      breadcrumb="Admin /"
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleDownloadTemplate}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-medium cursor-pointer whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download Partner Import Template</span>
          </button>
          <button
            type="button"
            onClick={openImportModal}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-emerald-600/30 bg-emerald-50/80 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-950/70 text-xs font-medium cursor-pointer whitespace-nowrap"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Import Partners</span>
          </button>
          <button
            type="button"
            onClick={openAddPartnerModal}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-900 dark:bg-emerald-600 text-white text-xs font-medium cursor-pointer whitespace-nowrap"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Add Partner</span>
          </button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Partner & Caseload Monitoring KPI Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-1">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Accountability Partners (Active / Total)
            </p>
            <p className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
              {summaryMetrics.activePartners}{' '}
              <span className="text-sm font-normal text-slate-400">
                / {summaryMetrics.totalPartners}
              </span>
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {summaryMetrics.inactivePartners} inactive ·{' '}
              {partnerInvitations.filter((i) => i.status === 'pending').length} pending invites
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-1">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Total Caseload Capacity (Available / Max)
            </p>
            <p className="text-2xl font-bold font-mono tabular-nums text-emerald-700 dark:text-emerald-400">
              {summaryMetrics.totalAvailableCapacity}{' '}
              <span className="text-sm font-normal text-slate-400">
                / {summaryMetrics.totalCapacity} slots
              </span>
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {summaryMetrics.partnersWithCapacity} with capacity ·{' '}
              {summaryMetrics.partnersAtFullCapacity} at full capacity
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-1">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Corps Members Assigned / Total
            </p>
            <p className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
              {summaryMetrics.assignedMembers}{' '}
              <span className="text-sm font-normal text-slate-400">
                / {summaryMetrics.totalMembers}
              </span>
            </p>
            <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
              {summaryMetrics.unassignedMembers} unassigned Corps Member(s)
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col justify-between">
            <div className="space-y-1">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Caseload Distribution &amp; Auto-Assign
              </p>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                Assign or auto-distribute Corps Members across active partners based on available caseload capacity.
              </p>
            </div>
            <Link
              to="/admin/assignments"
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:underline"
            >
              <span>Open Caseload Assignments</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {notice && (
          <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{notice}</span>
          </div>
        )}

        {error && (
          <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Search & Filter Toolbar */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search partner name, email, phone, state, or organisation..."
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as UserStatus | 'all')}
              className="px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active Partners</option>
              <option value="inactive">Inactive Partners</option>
              <option value="suspended">Suspended Partners</option>
            </select>

            <select
              value={capacityFilter}
              onChange={(e) =>
                setCapacityFilter(e.target.value as 'all' | 'available' | 'full')
              }
              className="px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
            >
              <option value="all">All Caseload Capacities</option>
              <option value="available">Available Capacity (&gt; 0 slots)</option>
              <option value="full">At Full Capacity (0 slots)</option>
            </select>
          </div>
        </div>

        {/* Partners Directory Table */}
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 text-xs font-semibold text-slate-500 dark:text-slate-400">
                  <th className="py-3 px-4">Accountability Partner</th>
                  <th className="py-3 px-4">Contact (Email &amp; Phone)</th>
                  <th className="py-3 px-4">Organisation / State</th>
                  <th className="py-3 px-4">Assigned / Max Caseload</th>
                  <th className="py-3 px-4">Available Capacity</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {filteredPartners.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-slate-500">
                      <UserCheck className="w-6 h-6 text-slate-400 mx-auto mb-2" />
                      <p className="font-medium text-slate-800 dark:text-slate-200">
                        No Accountability Partners match the current filters
                      </p>
                      <p className="text-slate-500 mt-0.5">
                        Click &ldquo;Add Partner&rdquo; or &ldquo;Import Partners&rdquo; to onboard mentors.
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredPartners.map((partner) => {
                    const priv = privateInfoMap[partner.uid];
                    const assignedCount = caseloadCountByPartner[partner.uid] || 0;
                    const maxCaseload = getPartnerMaxCaseload(partner);
                    const available = getPartnerAvailableCapacity(partner);
                    const pct = Math.min(100, Math.round((assignedCount / maxCaseload) * 100));
                    const loggedFollowUps = followUps.filter(
                      (f) => f.partnerId === partner.uid
                    ).length;

                    return (
                      <tr
                        key={partner.uid}
                        className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                      >
                        <td className="py-3 px-4">
                          <button
                            type="button"
                            onClick={() => setViewingPartner(partner)}
                            className="text-sm font-semibold text-slate-900 dark:text-white hover:text-emerald-600 dark:hover:text-emerald-400 text-left cursor-pointer"
                          >
                            {partner.displayName}
                          </button>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            {partner.gender ? `${partner.gender} · ` : ''}
                            {loggedFollowUps} follow-up(s) logged
                          </p>
                        </td>
                        <td className="py-3 px-4">
                          <p className="font-mono text-slate-800 dark:text-slate-200">
                            {priv?.email || 'Verified Partner'}
                          </p>
                          <p className="font-mono text-slate-500 dark:text-slate-400">
                            {partner.phone || priv?.phone || 'No phone recorded'}
                          </p>
                        </td>
                        <td className="py-3 px-4">
                          <p className="text-slate-800 dark:text-slate-200">
                            {partner.organisation || partner.department || 'CII'}
                          </p>
                          <p className="text-slate-500 dark:text-slate-400">
                            {partner.state || partner.cohortName || 'National'}
                          </p>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-sm tabular-nums text-slate-900 dark:text-white">
                              {assignedCount} / {maxCaseload}
                            </span>
                            <span className="text-[11px] font-mono text-slate-400">
                              ({pct}%)
                            </span>
                          </div>
                          <div className="w-28 h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden mt-1">
                            <div
                              className={`h-full rounded-full ${
                                available === 0
                                  ? 'bg-amber-500'
                                  : 'bg-emerald-600 dark:bg-emerald-500'
                              }`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </td>
                        <td className="py-3 px-4 font-mono tabular-nums">
                          {partner.status !== 'active' ? (
                            <span className="text-slate-400">0 (Inactive)</span>
                          ) : available > 0 ? (
                            <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
                              {available} slot{available === 1 ? '' : 's'} free
                            </span>
                          ) : (
                            <span className="text-amber-600 dark:text-amber-400 font-semibold">
                              Full capacity
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`font-medium capitalize ${
                              partner.status === 'active'
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-rose-600 dark:text-rose-400'
                            }`}
                          >
                            {partner.status}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => setViewingPartner(partner)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>Caseload ({assignedCount})</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => openEditPartnerModal(partner)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              <span>Edit</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => togglePartnerStatus(partner)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                            >
                              <Power className="w-3.5 h-3.5" />
                              <span>
                                {partner.status === 'active' ? 'Deactivate' : 'Activate'}
                              </span>
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

        {/* Pending Partner Invitations (From Manual Creation & Bulk Spreadsheet Imports) */}
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                Partner Activation Invitations ({partnerInvitations.length})
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Partners created manually or via Excel/CSV bulk import appear here until they activate their account via <span className="font-mono">/activate-account</span>.
              </p>
            </div>
          </div>

          {partnerInvitations.length === 0 ? (
            <p className="text-xs text-slate-500 py-3">
              No Accountability Partner invitations issued yet.
            </p>
          ) : (
            <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-lg">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 font-semibold text-slate-500 dark:text-slate-400">
                    <th className="py-2.5 px-3">Partner Name</th>
                    <th className="py-2.5 px-3">Email &amp; Phone</th>
                    <th className="py-2.5 px-3">Organisation / State</th>
                    <th className="py-2.5 px-3">Max Caseload</th>
                    <th className="py-2.5 px-3">Invite Code</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-right">Activation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {partnerInvitations.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                      <td className="py-2.5 px-3 font-medium text-slate-900 dark:text-white">
                        {inv.displayName}
                      </td>
                      <td className="py-2.5 px-3 font-mono">
                        <p className="text-slate-800 dark:text-slate-200">{inv.email}</p>
                        {inv.phone && <p className="text-slate-500">{inv.phone}</p>}
                      </td>
                      <td className="py-2.5 px-3">
                        <p>{inv.organisation || inv.department || 'CII'}</p>
                        {inv.state && <p className="text-slate-500">{inv.state}</p>}
                      </td>
                      <td className="py-2.5 px-3 font-mono tabular-nums">
                        {inv.maxCaseload || DEFAULT_PARTNER_MAX_CASELOAD}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-emerald-700 dark:text-emerald-400">
                        {inv.id}
                      </td>
                      <td className="py-2.5 px-3 capitalize font-medium">
                        {inv.status}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        {inv.status === 'pending' ? (
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => copyActivationUrl(inv.id, inv.email)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-slate-200 dark:border-slate-700 font-medium cursor-pointer"
                            >
                              <Copy className="w-3 h-3" />
                              <span>{copiedId === inv.id ? 'Copied!' : 'Copy Link'}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => revokeInvitation(inv, profile)}
                              className="px-2 py-1 rounded border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 cursor-pointer"
                            >
                              Revoke
                            </button>
                          </div>
                        ) : (
                          <span className="text-slate-400">
                            {formatTimestamp(inv.updatedAt)}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {/* Add Individual Partner Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                Add Accountability Partner
              </h2>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddPartnerSubmit} className="p-6 space-y-4 overflow-y-auto">
              {addError && (
                <p className="text-xs font-medium text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-lg px-3 py-2">
                  {addError}
                </p>
              )}

              {createdPartnerInvite ? (
                <div className="space-y-3 p-4 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs">
                  <p className="font-semibold text-emerald-800 dark:text-emerald-300">
                    Partner Activation Invitation Created ({createdPartnerInvite.code})
                  </p>
                  <p className="text-emerald-700 dark:text-emerald-300 leading-relaxed">
                    Share this activation link with <span className="font-medium">{createdPartnerInvite.email}</span>. When they activate their account, Firestore Security Rules automatically provision their <span className="font-semibold">Accountability Partner</span> role and maximum caseload ({addMaxCaseload}) and direct them to <span className="font-mono">/partner</span>.
                  </p>
                  <div className="p-2 rounded bg-white dark:bg-slate-950 border border-emerald-200 dark:border-emerald-900 font-mono text-[11px] break-all">
                    {createdPartnerInvite.url}
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() =>
                        copyActivationUrl(createdPartnerInvite.code, createdPartnerInvite.email)
                      }
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-medium cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>
                        {copiedId === createdPartnerInvite.code ? 'Copied!' : 'Copy Activation Link'}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowAddModal(false)}
                      className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 font-medium cursor-pointer"
                    >
                      Done
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium mb-1">
                        Full Name <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        maxLength={100}
                        value={addFullName}
                        onChange={(e) => setAddFullName(e.target.value)}
                        placeholder="e.g., Dr. Chinwe Okafor"
                        className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">
                        Email Address <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="email"
                        required
                        maxLength={160}
                        value={addEmail}
                        onChange={(e) => setAddEmail(e.target.value)}
                        placeholder="partner@domain.org"
                        className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium mb-1">
                        Phone Number <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="tel"
                        required
                        maxLength={32}
                        value={addPhone}
                        onChange={(e) => setAddPhone(e.target.value)}
                        placeholder="+2348031234567"
                        className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">
                        Maximum Caseload <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="number"
                        required
                        min={1}
                        max={200}
                        value={addMaxCaseload}
                        onChange={(e) => setAddMaxCaseload(Number(e.target.value))}
                        className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium mb-1">Gender (Optional)</label>
                      <select
                        value={addGender}
                        onChange={(e) => setAddGender(e.target.value)}
                        className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
                      >
                        <option value="">Not specified</option>
                        <option value="Female">Female</option>
                        <option value="Male">Male</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">State (Optional)</label>
                      <input
                        type="text"
                        maxLength={48}
                        value={addState}
                        onChange={(e) => setAddState(e.target.value)}
                        placeholder="e.g., Lagos"
                        className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">
                        Cohort {isFullAdmin ? '(Optional)' : '*'}
                      </label>
                      <select
                        required={!isFullAdmin}
                        value={addCohortId}
                        onChange={(e) => setAddCohortId(e.target.value)}
                        className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
                      >
                        {isFullAdmin && <option value="">All Cohorts</option>}
                        {cohorts.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.code}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium mb-1">
                      Organisation (Optional)
                    </label>
                    <input
                      type="text"
                      maxLength={120}
                      value={addOrganisation}
                      onChange={(e) => setAddOrganisation(e.target.value)}
                      placeholder="Corper Impact Initiative"
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium mb-1">Notes (Optional)</label>
                    <textarea
                      rows={2}
                      maxLength={500}
                      value={addNotes}
                      onChange={(e) => setAddNotes(e.target.value)}
                      placeholder="Mentor background, specialization, or notes..."
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
                    />
                  </div>

                  <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowAddModal(false)}
                      className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={addingPartner}
                      className="px-4 py-2 rounded-lg bg-slate-900 dark:bg-emerald-600 text-white text-xs font-medium disabled:opacity-60 cursor-pointer"
                    >
                      {addingPartner ? 'Creating...' : 'Create Partner Invitation'}
                    </button>
                  </div>
                </>
              )}
            </form>
          </div>
        </div>
      )}

      {/* Edit Partner Modal */}
      {editingPartner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                Edit Accountability Partner · {editingPartner.displayName}
              </h2>
              <button
                type="button"
                onClick={() => setEditingPartner(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSavePartnerEdit} className="p-6 space-y-4 overflow-y-auto">
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
                  <label className="block text-xs font-medium mb-1">Phone Number</label>
                  <input
                    type="tel"
                    maxLength={32}
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1">Maximum Caseload</label>
                  <input
                    type="number"
                    required
                    min={1}
                    max={200}
                    value={editMaxCaseload}
                    onChange={(e) => setEditMaxCaseload(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Status</label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as UserStatus)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="suspended">Suspended</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Gender</label>
                  <select
                    value={editGender}
                    onChange={(e) => setEditGender(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
                  >
                    <option value="">Not specified</option>
                    <option value="Female">Female</option>
                    <option value="Male">Male</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1">Organisation</label>
                  <input
                    type="text"
                    maxLength={120}
                    value={editOrganisation}
                    onChange={(e) => setEditOrganisation(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">State</label>
                  <input
                    type="text"
                    maxLength={48}
                    value={editState}
                    onChange={(e) => setEditState(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">Notes</label>
                <textarea
                  rows={2}
                  maxLength={500}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingPartner(null)}
                  className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="px-4 py-2 rounded-lg bg-slate-900 dark:bg-emerald-600 text-white text-xs font-medium disabled:opacity-60 cursor-pointer"
                >
                  {savingEdit ? 'Saving...' : 'Save Partner Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Partner Profile & Assigned Caseload Modal */}
      {viewingPartner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                  {viewingPartner.displayName} · Partner Caseload Profile
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {privateInfoMap[viewingPartner.uid]?.email || 'Verified Partner'} ·{' '}
                  {viewingPartner.phone ||
                    privateInfoMap[viewingPartner.uid]?.phone ||
                    'No phone'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setViewingPartner(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-5 overflow-y-auto text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 dark:bg-slate-950 p-3.5 rounded-lg border border-slate-200 dark:border-slate-800">
                <div>
                  <p className="text-slate-400">Status</p>
                  <p className="font-semibold capitalize text-slate-900 dark:text-white mt-0.5">
                    {viewingPartner.status}
                  </p>
                </div>
                <div>
                  <p className="text-slate-400">Assigned / Max</p>
                  <p className="font-mono font-bold text-slate-900 dark:text-white mt-0.5">
                    {caseloadCountByPartner[viewingPartner.uid] || 0} /{' '}
                    {getPartnerMaxCaseload(viewingPartner)}
                  </p>
                </div>
                <div>
                  <p className="text-slate-400">Available Capacity</p>
                  <p className="font-mono font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                    {getPartnerAvailableCapacity(viewingPartner)} slots
                  </p>
                </div>
                <div>
                  <p className="text-slate-400">Organisation / State</p>
                  <p className="font-medium text-slate-900 dark:text-white mt-0.5 truncate">
                    {viewingPartner.organisation || viewingPartner.department} ·{' '}
                    {viewingPartner.state || 'National'}
                  </p>
                </div>
              </div>

              {viewingPartner.notes && (
                <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800">
                  <p className="text-slate-400 mb-0.5">Notes</p>
                  <p className="text-slate-700 dark:text-slate-300">{viewingPartner.notes}</p>
                </div>
              )}

              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-emerald-600" />
                    <span>
                      Assigned Corps Members (
                      {members.filter((m) => m.partnerId === viewingPartner.uid).length})
                    </span>
                  </h3>
                  <Link
                    to="/admin/assignments"
                    className="text-emerald-700 dark:text-emerald-400 font-medium hover:underline"
                  >
                    Assign more members →
                  </Link>
                </div>

                {members.filter((m) => m.partnerId === viewingPartner.uid).length === 0 ? (
                  <p className="text-slate-500 py-4 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-lg">
                    No Corps Members currently assigned to this partner.
                  </p>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg">
                    {members
                      .filter((m) => m.partnerId === viewingPartner.uid)
                      .map((m) => (
                        <div
                          key={m.uid}
                          className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                        >
                          <div>
                            <Link
                              to={`/admin/participants/${m.uid}`}
                              className="font-semibold text-slate-900 dark:text-white hover:text-emerald-600 hover:underline"
                            >
                              {m.displayName}
                            </Link>
                            <p className="text-slate-500">
                              {m.cohortName || 'Unassigned Cohort'} ·{' '}
                              {m.stateCode || 'No State Code'}
                            </p>
                          </div>

                          <div className="flex items-center gap-2">
                            <select
                              value={reassignTargetMap[m.uid] || ''}
                              onChange={(e) =>
                                setReassignTargetMap((prev) => ({
                                  ...prev,
                                  [m.uid]: e.target.value,
                                }))
                              }
                              className="px-2.5 py-1.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs"
                            >
                              <option value="">Reassign to partner...</option>
                              {partners
                                .filter(
                                  (p) =>
                                    p.uid !== viewingPartner.uid &&
                                    p.status === 'active' &&
                                    getPartnerAvailableCapacity(p) > 0
                                )
                                .map((p) => (
                                  <option key={p.uid} value={p.uid}>
                                    {p.displayName} ({getPartnerAvailableCapacity(p)} free)
                                  </option>
                                ))}
                            </select>
                            <button
                              type="button"
                              disabled={
                                !reassignTargetMap[m.uid] || reassigningMemberId === m.uid
                              }
                              onClick={() =>
                                handleReassignMember(m, reassignTargetMap[m.uid])
                              }
                              className="px-2.5 py-1.5 rounded bg-slate-900 dark:bg-emerald-600 text-white font-medium disabled:opacity-40 cursor-pointer"
                            >
                              {reassigningMemberId === m.uid ? 'Moving...' : 'Reassign'}
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Partner Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="w-full max-w-4xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl overflow-hidden max-h-[92vh] flex flex-col">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                  Bulk Import Accountability Partners (Excel .xlsx or .csv)
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-5 overflow-y-auto text-xs">
              {/* Step 1 & Step 2 Controls */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 space-y-2.5">
                  <p className="font-semibold text-slate-900 dark:text-white">
                    1. Download Official Excel Template
                  </p>
                  <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
                    Includes the <span className="font-mono">Partners</span> sheet (Full Name, Email Address, Phone Number, Gender, State, Organisation, Maximum Caseload, Notes) and an <span className="font-mono">Instructions</span> worksheet. Sample rows are automatically ignored.
                  </p>
                  <button
                    type="button"
                    onClick={handleDownloadTemplate}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-medium text-slate-800 dark:text-slate-100 hover:bg-slate-100 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download Partner Import Template</span>
                  </button>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 space-y-2.5">
                  <p className="font-semibold text-slate-900 dark:text-white">
                    2. Upload Completed Excel (.xlsx) or CSV (.csv)
                  </p>
                  <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
                    All rows are validated for required fields, email format, duplicate emails, existing accounts, phone format, and positive maximum caseload before confirmation.
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      onChange={handleFileChange}
                      className="hidden"
                      id="partner-bulk-file-input"
                    />
                    <label
                      htmlFor="partner-bulk-file-input"
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-900 dark:bg-emerald-600 text-white font-medium cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>{parsingFile ? 'Validating...' : 'Select Excel or CSV File'}</span>
                    </label>
                    {importFileName && (
                      <span className="font-mono text-slate-600 dark:text-slate-300 truncate max-w-[200px]">
                        {importFileName}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {importError && (
                <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300">
                  {importError}
                </div>
              )}

              {/* Imported Results Confirmation View */}
              {importedResults.length > 0 && (
                <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-200">
                      Imported {importedResults.length} Accountability Partner Invitation(s)
                    </p>
                    <button
                      type="button"
                      onClick={() => setShowImportModal(false)}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-medium cursor-pointer"
                    >
                      Done
                    </button>
                  </div>
                  <p className="text-emerald-800 dark:text-emerald-300">
                    Each imported partner has an email-bound invitation with role <span className="font-mono">partner</span>. Copy any activation link below or from the Partner Activation Invitations table.
                  </p>
                  <div className="max-h-56 overflow-y-auto divide-y divide-emerald-200/60 dark:divide-emerald-800/60 border border-emerald-200 dark:border-emerald-800 rounded-lg bg-white dark:bg-slate-950">
                    {importedResults.map((res) => (
                      <div
                        key={res.inviteCode}
                        className="p-2.5 flex items-center justify-between gap-2"
                      >
                        <div>
                          <span className="font-semibold text-slate-900 dark:text-white">
                            {res.displayName}
                          </span>{' '}
                          <span className="font-mono text-slate-500">({res.email})</span> ·{' '}
                          <span className="font-mono text-emerald-700 dark:text-emerald-400">
                            {res.inviteCode}
                          </span>{' '}
                          · Max Caseload: {res.maxCaseload}
                        </div>
                        <button
                          type="button"
                          onClick={() => copyActivationUrl(res.inviteCode, res.email)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-slate-200 dark:border-slate-700 font-medium cursor-pointer shrink-0"
                        >
                          <Copy className="w-3 h-3" />
                          <span>{copiedId === res.inviteCode ? 'Copied!' : 'Copy Link'}</span>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Validation Summary & Row-by-Row Preview */}
              {importAnalysis && (
                <div className="space-y-4">
                  {importAnalysis.missingColumns.length > 0 && (
                    <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300">
                      <p className="font-semibold">
                        Missing Required Spreadsheet Column(s):{' '}
                        {importAnalysis.missingColumns.join(', ')}
                      </p>
                      <p className="mt-0.5">
                        Please use the official template columns: Full Name, Email Address, Phone Number, Gender, State, Organisation, Maximum Caseload, Notes.
                      </p>
                    </div>
                  )}

                  {importAnalysis.unrecognizedColumns.length > 0 && (
                    <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300">
                      Unrecognized column name(s) ignored:{' '}
                      <span className="font-mono">
                        {importAnalysis.unrecognizedColumns.join(', ')}
                      </span>
                    </div>
                  )}

                  {/* 5-Metric Import Summary Banner */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                    <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
                      <p className="text-slate-500">Total Rows Found</p>
                      <p className="text-lg font-bold font-mono text-slate-900 dark:text-white">
                        {importAnalysis.totalRowsFound}
                      </p>
                    </div>
                    <div className="p-3 rounded-lg border border-emerald-200 dark:border-emerald-900 bg-emerald-50/60 dark:bg-emerald-950/30">
                      <p className="text-emerald-700 dark:text-emerald-400">Valid Records</p>
                      <p className="text-lg font-bold font-mono text-emerald-700 dark:text-emerald-400">
                        {importAnalysis.validRows.length}
                      </p>
                    </div>
                    <div className="p-3 rounded-lg border border-rose-200 dark:border-rose-900 bg-rose-50/60 dark:bg-rose-950/30">
                      <p className="text-rose-700 dark:text-rose-400">Invalid Records</p>
                      <p className="text-lg font-bold font-mono text-rose-700 dark:text-rose-400">
                        {importAnalysis.invalidRows.length}
                      </p>
                    </div>
                    <div className="p-3 rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50/60 dark:bg-amber-950/30">
                      <p className="text-amber-700 dark:text-amber-400">Duplicate in Sheet</p>
                      <p className="text-lg font-bold font-mono text-amber-700 dark:text-amber-400">
                        {importAnalysis.duplicateRows.length}
                      </p>
                    </div>
                    <div className="p-3 rounded-lg border border-indigo-200 dark:border-indigo-900 bg-indigo-50/60 dark:bg-indigo-950/30">
                      <p className="text-indigo-700 dark:text-indigo-400">Already Exist</p>
                      <p className="text-lg font-bold font-mono text-indigo-700 dark:text-indigo-400">
                        {importAnalysis.existingRows.length}
                      </p>
                    </div>
                  </div>

                  {rejectedImportRows.length > 0 && (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-lg bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                      <p className="text-amber-900 dark:text-amber-200">
                        {rejectedImportRows.length} row(s) contain validation issues, duplicates, or already exist and will not be imported. You can download the rejected rows report or proceed with importing the {importAnalysis.validRows.length} valid record(s).
                      </p>
                      <button
                        type="button"
                        onClick={() => downloadRejectedPartnerRowsReport(rejectedImportRows)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-900 font-medium text-amber-900 dark:text-amber-200 shrink-0 cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download Rejected Rows Report (.xlsx)</span>
                      </button>
                    </div>
                  )}

                  {/* Preview Table */}
                  <div className="max-h-64 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-lg">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-semibold text-slate-500">
                          <th className="py-2 px-3">Row #</th>
                          <th className="py-2 px-3">Status</th>
                          <th className="py-2 px-3">Full Name</th>
                          <th className="py-2 px-3">Email Address</th>
                          <th className="py-2 px-3">Phone</th>
                          <th className="py-2 px-3">Max Caseload</th>
                          <th className="py-2 px-3">Validation Details</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {importAnalysis.allRows.map((row) => (
                          <tr
                            key={`${row.rowNumber}-${row.email}`}
                            className={
                              row.status === 'valid'
                                ? ''
                                : 'bg-rose-50/40 dark:bg-rose-950/20'
                            }
                          >
                            <td className="py-2 px-3 font-mono">{row.rowNumber}</td>
                            <td className="py-2 px-3 font-semibold uppercase">
                              <span
                                className={
                                  row.status === 'valid'
                                    ? 'text-emerald-600 dark:text-emerald-400'
                                    : row.status === 'duplicate' || row.status === 'existing'
                                      ? 'text-amber-600 dark:text-amber-400'
                                      : 'text-rose-600 dark:text-rose-400'
                                }
                              >
                                {row.status}
                              </span>
                            </td>
                            <td className="py-2 px-3 font-medium text-slate-900 dark:text-white">
                              {row.fullName || '—'}
                            </td>
                            <td className="py-2 px-3 font-mono">{row.email || '—'}</td>
                            <td className="py-2 px-3 font-mono">{row.phone || '—'}</td>
                            <td className="py-2 px-3 font-mono">{row.maxCaseloadRaw || '—'}</td>
                            <td className="py-2 px-3">
                              {row.errors.length === 0 ? (
                                <span className="text-emerald-600 dark:text-emerald-400">
                                  Ready to import
                                </span>
                              ) : (
                                <span className="text-rose-600 dark:text-rose-400">
                                  {row.errors.join(' ')}
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Confirm Import Footer */}
                  <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <label className="font-medium text-slate-700 dark:text-slate-300">
                        Cohort Tag {isFullAdmin ? '(Optional)' : '(Required)'}:
                      </label>
                      <select
                        value={importCohortId}
                        onChange={(e) => setImportCohortId(e.target.value)}
                        className="px-2.5 py-1.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
                      >
                        {isFullAdmin && <option value="">All Cohorts</option>}
                        {cohorts.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.code} — {c.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex items-center gap-2 justify-end">
                      <button
                        type="button"
                        onClick={() => setShowImportModal(false)}
                        className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 font-medium cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={
                          importingBatch || importAnalysis.validRows.length === 0
                        }
                        onClick={handleConfirmBulkImport}
                        className="px-4 py-2 rounded-lg bg-slate-900 dark:bg-emerald-600 text-white font-medium disabled:opacity-40 cursor-pointer"
                      >
                        {importingBatch
                          ? 'Importing Partners...'
                          : `Confirm Import (${importAnalysis.validRows.length} Valid Partner${
                              importAnalysis.validRows.length === 1 ? '' : 's'
                            })`}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
