import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { collection, doc, getDoc } from 'firebase/firestore';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Eye,
  GitCompareArrows,
  Search,
  Sparkles,
  UserCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { AppShell } from '../../components/AppShell';
import { useAuth } from '../../context/AuthContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { db } from '../../lib/firebase';
import {
  adminUpdateUser,
  batchAssignMembersToPartners,
  recordAuditEvent,
} from '../../services/ciiService';
import {
  DEFAULT_PARTNER_MAX_CASELOAD,
  normalizeRole,
  UserPrivateInfo,
  UserProfile,
} from '../../types';

function AssignmentStatusTag({
  tone,
  label,
}: {
  tone: 'emerald' | 'amber' | 'rose' | 'slate';
  label: string;
}) {
  const styles =
    tone === 'emerald'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800/60'
      : tone === 'amber'
      ? 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800/60'
      : tone === 'rose'
      ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800/60'
      : 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[11px] font-semibold whitespace-nowrap ${styles}`}
    >
      {label}
    </span>
  );
}

interface ProposedAssignmentItem {
  memberId: string;
  memberName: string;
  memberStateCode: string;
  memberCohortName: string;
  partnerId: string;
  partnerName: string;
  partnerCurrentLoadBefore: number;
  partnerCurrentLoadAfter: number;
  partnerMaxCaseload: number;
}

export function AdminAssignmentsPage() {
  const { profile } = useAuth();
  const { users, cohorts } = useWorkspace();

  const [privateDirectory, setPrivateDirectory] = useState<Record<string, UserPrivateInfo>>({});
  const [selectedPartnerId, setSelectedPartnerId] = useState('');
  const [memberSearch, setMemberSearch] = useState('');
  const [memberCohortFilter, setMemberCohortFilter] = useState('all');
  const [memberAssignmentFilter, setMemberAssignmentFilter] = useState<'unassigned' | 'all'>('unassigned');
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);

  const [partnerTableSearch, setPartnerTableSearch] = useState('');
  const [partnerTableStatus, setPartnerTableStatus] = useState<'all' | 'available' | 'full' | 'inactive'>('all');

  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'emerald' | 'rose' | 'amber'; text: string } | null>(null);

  // Auto-Assign Preview Modal
  const [autoPreviewOpen, setAutoPreviewOpen] = useState(false);
  const [proposedAutoAssignments, setProposedAutoAssignments] = useState<ProposedAssignmentItem[]>([]);
  const [unassignedOverflowCount, setUnassignedOverflowCount] = useState(0);

  // Partner Profile & Caseload Modal
  const [viewingPartner, setViewingPartner] = useState<UserProfile | null>(null);
  const [reassignTargets, setReassignTargets] = useState<Record<string, string>>({});

  const partners = useMemo(
    () =>
      users
        .filter((u) => u.role === 'partner')
        .sort((a, b) => a.displayName.localeCompare(b.displayName)),
    [users]
  );

  const members = useMemo(
    () =>
      users
        .filter((u) => u.role === 'member')
        .sort((a, b) => a.displayName.localeCompare(b.displayName)),
    [users]
  );

  useEffect(() => {
    if (profile?.role !== 'super_admin' && profile?.role !== 'admin') return;
    let cancelled = false;
    async function loadPrivateEmails() {
      const entries = await Promise.all(
        partners.map(async (p) => {
          try {
            const snap = await getDoc(doc(collection(db, 'users', p.uid, 'private'), 'info'));
            if (!snap.exists()) return null;
            return [p.uid, snap.data() as UserPrivateInfo] as const;
          } catch {
            return null;
          }
        })
      );
      if (cancelled) return;
      const map: Record<string, UserPrivateInfo> = {};
      for (const entry of entries) {
        if (entry) map[entry[0]] = entry[1];
      }
      setPrivateDirectory(map);
    }
    loadPrivateEmails();
    return () => {
      cancelled = true;
    };
  }, [partners, profile?.role]);

  // Caseload metrics per partner
  const partnerMetrics = useMemo(() => {
    const map: Record<
      string,
      {
        partner: UserProfile;
        assignedMembers: UserProfile[];
        assignedCount: number;
        maxCaseload: number;
        availableCapacity: number;
        utilizationRatio: number;
        isFull: boolean;
      }
    > = {};

    for (const p of partners) {
      const assignedMembers = members.filter((m) => m.partnerId === p.uid);
      const maxCaseload =
        typeof p.maxCaseload === 'number' && p.maxCaseload > 0
          ? p.maxCaseload
          : DEFAULT_PARTNER_MAX_CASELOAD;
      const assignedCount = assignedMembers.length;
      const availableCapacity = Math.max(0, maxCaseload - assignedCount);
      const utilizationRatio = maxCaseload > 0 ? assignedCount / maxCaseload : 1;

      map[p.uid] = {
        partner: p,
        assignedMembers,
        assignedCount,
        maxCaseload,
        availableCapacity,
        utilizationRatio,
        isFull: assignedCount >= maxCaseload,
      };
    }
    return map;
  }, [partners, members]);

  // Part 7: 8-KPI Assignment Monitoring Summary
  const monitoringStats = useMemo(() => {
    const totalPartners = partners.length;
    const activePartners = partners.filter((p) => p.status === 'active');
    const inactivePartners = partners.filter((p) => p.status !== 'active');

    const totalMembers = members.length;
    const assignedMembers = members.filter((m) => Boolean(m.partnerId));
    const unassignedMembers = members.filter((m) => !m.partnerId);

    const activeWithCapacity = activePartners.filter(
      (p) => (partnerMetrics[p.uid]?.availableCapacity ?? 0) > 0
    );
    const activeAtFullCapacity = activePartners.filter(
      (p) => (partnerMetrics[p.uid]?.availableCapacity ?? 0) === 0
    );

    return {
      totalPartners,
      activePartnersCount: activePartners.length,
      inactivePartnersCount: inactivePartners.length,
      totalMembers,
      assignedMembersCount: assignedMembers.length,
      unassignedMembersCount: unassignedMembers.length,
      partnersWithCapacityCount: activeWithCapacity.length,
      partnersAtFullCapacityCount: activeAtFullCapacity.length,
    };
  }, [partners, members, partnerMetrics]);

  const activePartnersList = useMemo(
    () => partners.filter((p) => p.status === 'active'),
    [partners]
  );

  // Default selected partner for manual assignment
  useEffect(() => {
    if (!selectedPartnerId && activePartnersList.length > 0) {
      const firstAvailable =
        activePartnersList.find((p) => (partnerMetrics[p.uid]?.availableCapacity ?? 0) > 0) ||
        activePartnersList[0];
      if (firstAvailable) {
        setSelectedPartnerId(firstAvailable.uid);
      }
    }
  }, [activePartnersList, partnerMetrics, selectedPartnerId]);

  const selectedPartnerMetric = selectedPartnerId ? partnerMetrics[selectedPartnerId] : undefined;

  // Filtered Corps Members for Manual Assignment
  const filteredMembersForManual = useMemo(() => {
    return members.filter((m) => {
      if (m.status !== 'active') return false;
      if (selectedPartnerId && m.partnerId === selectedPartnerId) return false;
      if (memberAssignmentFilter === 'unassigned' && m.partnerId) return false;
      if (memberCohortFilter !== 'all' && m.cohortId !== memberCohortFilter) return false;

      if (memberSearch.trim()) {
        const q = memberSearch.toLowerCase();
        const matchesName = m.displayName.toLowerCase().includes(q);
        const matchesCode = (m.stateCode || '').toLowerCase().includes(q);
        const matchesCohort = (m.cohortName || '').toLowerCase().includes(q);
        const matchesPartner = (m.partnerName || '').toLowerCase().includes(q);
        if (!matchesName && !matchesCode && !matchesCohort && !matchesPartner) return false;
      }
      return true;
    });
  }, [members, selectedPartnerId, memberAssignmentFilter, memberCohortFilter, memberSearch]);

  const remainingCapacityAfterSelection = useMemo(() => {
    if (!selectedPartnerMetric) return 0;
    return Math.max(0, selectedPartnerMetric.availableCapacity - selectedMemberIds.length);
  }, [selectedPartnerMetric, selectedMemberIds.length]);

  function toggleMemberSelection(memberId: string) {
    setSelectedMemberIds((prev) => {
      if (prev.includes(memberId)) {
        return prev.filter((id) => id !== memberId);
      }
      if (!selectedPartnerMetric) return prev;
      if (prev.length >= selectedPartnerMetric.availableCapacity) {
        setNotice({
          tone: 'amber',
          text: `${selectedPartnerMetric.partner.displayName} only has ${selectedPartnerMetric.availableCapacity} available slot(s) remaining.`,
        });
        return prev;
      }
      return [...prev, memberId];
    });
  }

  function handleSelectUpToCapacity() {
    if (!selectedPartnerMetric) return;
    const cap = selectedPartnerMetric.availableCapacity;
    if (cap <= 0) {
      setNotice({
        tone: 'amber',
        text: `${selectedPartnerMetric.partner.displayName} is already at full capacity (${selectedPartnerMetric.maxCaseload}).`,
      });
      return;
    }
    const ids = filteredMembersForManual.slice(0, cap).map((m) => m.uid);
    setSelectedMemberIds(ids);
  }

  async function handleManualAssign() {
    if (!profile || !selectedPartnerMetric || selectedMemberIds.length === 0) return;

    if (selectedMemberIds.length > selectedPartnerMetric.availableCapacity) {
      setNotice({
        tone: 'rose',
        text: `Cannot assign ${selectedMemberIds.length} member(s). ${selectedPartnerMetric.partner.displayName} only has ${selectedPartnerMetric.availableCapacity} available slot(s).`,
      });
      return;
    }

    setBusy(true);
    setNotice(null);
    try {
      const targetPartner = selectedPartnerMetric.partner;
      const items = selectedMemberIds
        .map((memberId) => {
          const member = members.find((m) => m.uid === memberId);
          if (!member) return null;
          return {
            member,
            partner: targetPartner,
          };
        })
        .filter((item): item is NonNullable<typeof item> => Boolean(item));

      const count = await batchAssignMembersToPartners({
        actor: profile,
        assignments: items,
        mode: 'manual',
      });

      setSelectedMemberIds([]);
      setNotice({
        tone: 'emerald',
        text: `Assigned ${count} Corps Member(s) to ${targetPartner.displayName} and synchronized historical check-ins, weekly reports, and activity submissions.`,
      });
    } catch (err) {
      setNotice({
        tone: 'rose',
        text: err instanceof Error ? err.message : 'Failed to assign selected Corps Members.',
      });
    } finally {
      setBusy(false);
    }
  }

  // Part 6B: Automatic Assignment Algorithm (lowest caseload utilization ratio)
  function handleComputeAutoAssignmentPreview() {
    setNotice(null);

    const unassignedActiveMembers = members.filter(
      (m) => m.status === 'active' && !m.partnerId
    );

    if (unassignedActiveMembers.length === 0) {
      setNotice({
        tone: 'amber',
        text: 'All active Corps Members are already assigned to an Accountability Partner.',
      });
      return;
    }

    // Build mutable pool of active partners with available capacity > 0
    const partnerPool = activePartnersList
      .map((p) => {
        const m = partnerMetrics[p.uid];
        const maxCaseload = m?.maxCaseload ?? DEFAULT_PARTNER_MAX_CASELOAD;
        const assignedCount = m?.assignedCount ?? 0;
        return {
          partner: p,
          currentAssigned: assignedCount,
          maxCaseload,
        };
      })
      .filter((slot) => slot.currentAssigned < slot.maxCaseload);

    if (partnerPool.length === 0) {
      setNotice({
        tone: 'rose',
        text: 'No active Accountability Partners currently have available caseload capacity. Increase partner caseload limits or activate additional partners first.',
      });
      return;
    }

    const proposals: ProposedAssignmentItem[] = [];
    let overflow = 0;

    for (const member of unassignedActiveMembers) {
      const availableSlots = partnerPool.filter((s) => s.currentAssigned < s.maxCaseload);
      if (availableSlots.length === 0) {
        overflow += 1;
        continue;
      }

      // Sort by lowest utilization ratio (currentAssigned / maxCaseload),
      // tie-break by lowest absolute currentAssigned, then alphabetical displayName
      availableSlots.sort((a, b) => {
        const ratioA = a.currentAssigned / a.maxCaseload;
        const ratioB = b.currentAssigned / b.maxCaseload;
        if (Math.abs(ratioA - ratioB) > 1e-9) return ratioA - ratioB;
        if (a.currentAssigned !== b.currentAssigned) return a.currentAssigned - b.currentAssigned;
        return a.partner.displayName.localeCompare(b.partner.displayName);
      });

      const chosen = availableSlots[0];
      const before = chosen.currentAssigned;
      chosen.currentAssigned += 1;

      proposals.push({
        memberId: member.uid,
        memberName: member.displayName,
        memberStateCode: member.stateCode || 'No State Code',
        memberCohortName: member.cohortName || 'Unassigned Cohort',
        partnerId: chosen.partner.uid,
        partnerName: chosen.partner.displayName,
        partnerCurrentLoadBefore: before,
        partnerCurrentLoadAfter: chosen.currentAssigned,
        partnerMaxCaseload: chosen.maxCaseload,
      });
    }

    setProposedAutoAssignments(proposals);
    setUnassignedOverflowCount(overflow);
    setAutoPreviewOpen(true);
  }

  async function handleConfirmAutoAssign() {
    if (!profile || proposedAutoAssignments.length === 0) return;
    setBusy(true);
    setNotice(null);
    try {
      const items = proposedAutoAssignments
        .map((prop) => {
          const member = members.find((m) => m.uid === prop.memberId);
          const partner = partners.find((p) => p.uid === prop.partnerId);
          if (!member || !partner) return null;
          return {
            member,
            partner,
          };
        })
        .filter((item): item is NonNullable<typeof item> => Boolean(item));

      const count = await batchAssignMembersToPartners({
        actor: profile,
        assignments: items,
        mode: 'auto',
      });

      setAutoPreviewOpen(false);
      setProposedAutoAssignments([]);
      setNotice({
        tone: 'emerald',
        text: `Auto-assigned ${count} Corps Member(s) across active Accountability Partners.${
          unassignedOverflowCount > 0
            ? ` ${unassignedOverflowCount} member(s) remained unassigned due to maximum partner caseload limits.`
            : ''
        }`,
      });
    } catch (err) {
      setNotice({
        tone: 'rose',
        text: err instanceof Error ? err.message : 'Failed to complete auto-assignment.',
      });
    } finally {
      setBusy(false);
    }
  }

  // Group proposed auto-assignments by partner for the confirmation summary
  const autoPreviewByPartner = useMemo(() => {
    const grouped: Record<
      string,
      {
        partnerId: string;
        partnerName: string;
        beforeCount: number;
        afterCount: number;
        maxCaseload: number;
        addedCount: number;
      }
    > = {};

    for (const item of proposedAutoAssignments) {
      if (!grouped[item.partnerId]) {
        const currentMetric = partnerMetrics[item.partnerId];
        grouped[item.partnerId] = {
          partnerId: item.partnerId,
          partnerName: item.partnerName,
          beforeCount: currentMetric?.assignedCount ?? item.partnerCurrentLoadBefore,
          afterCount: item.partnerCurrentLoadAfter,
          maxCaseload: item.partnerMaxCaseload,
          addedCount: 1,
        };
      } else {
        grouped[item.partnerId].afterCount = item.partnerCurrentLoadAfter;
        grouped[item.partnerId].addedCount += 1;
      }
    }
    return Object.values(grouped).sort((a, b) => a.partnerName.localeCompare(b.partnerName));
  }, [proposedAutoAssignments, partnerMetrics]);

  // Partner Caseload Monitoring Table filtering
  const filteredPartnersForMonitoring = useMemo(() => {
    return partners.filter((p) => {
      const m = partnerMetrics[p.uid];
      const priv = privateDirectory[p.uid];
      const email = priv?.email || '';
      const phone = p.phone || priv?.phone || '';

      if (partnerTableStatus === 'available') {
        if (p.status !== 'active' || (m?.availableCapacity ?? 0) === 0) return false;
      } else if (partnerTableStatus === 'full') {
        if (p.status !== 'active' || (m?.availableCapacity ?? 0) > 0) return false;
      } else if (partnerTableStatus === 'inactive') {
        if (p.status === 'active') return false;
      }

      if (partnerTableSearch.trim()) {
        const q = partnerTableSearch.toLowerCase();
        const matchesName = p.displayName.toLowerCase().includes(q);
        const matchesEmail = email.toLowerCase().includes(q);
        const matchesPhone = phone.toLowerCase().includes(q);
        const matchesOrg = (p.organisation || '').toLowerCase().includes(q);
        const matchesState = (p.state || '').toLowerCase().includes(q);
        if (!matchesName && !matchesEmail && !matchesPhone && !matchesOrg && !matchesState) {
          return false;
        }
      }
      return true;
    });
  }, [partners, partnerMetrics, privateDirectory, partnerTableStatus, partnerTableSearch]);

  async function handleQuickReassignFromModal(member: UserProfile) {
    if (!profile) return;
    const targetPartnerId = reassignTargets[member.uid] ?? '';
    const targetPartner = partners.find((p) => p.uid === targetPartnerId);

    if (targetPartner) {
      const targetMetric = partnerMetrics[targetPartner.uid];
      if (targetPartner.status !== 'active') {
        setNotice({
          tone: 'rose',
          text: `Cannot assign to ${targetPartner.displayName} because their account is inactive.`,
        });
        return;
      }
      if (targetMetric && targetMetric.availableCapacity <= 0) {
        setNotice({
          tone: 'rose',
          text: `${targetPartner.displayName} is already at maximum caseload (${targetMetric.maxCaseload}).`,
        });
        return;
      }
    }

    setBusy(true);
    setNotice(null);
    try {
      if (targetPartner) {
        await batchAssignMembersToPartners({
          actor: profile,
          assignments: [{ member, partner: targetPartner }],
          mode: 'manual',
        });
      } else {
        await adminUpdateUser({
          actor: profile,
          target: member,
          role: 'member',
          status: member.status,
          cohortId: member.cohortId,
          cohortName: member.cohortName,
          partnerId: '',
          partnerName: '',
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
          summary: `Unassigned Corps Member ${member.displayName} from Accountability Partner ${viewingPartner?.displayName || member.partnerName || 'previous partner'}.`,
        });
      }
      setNotice({
        tone: 'emerald',
        text: targetPartner
          ? `Reassigned ${member.displayName} to ${targetPartner.displayName}.`
          : `Unassigned ${member.displayName} from ${viewingPartner?.displayName || 'partner'}.`,
      });
    } catch (err) {
      setNotice({
        tone: 'rose',
        text: err instanceof Error ? err.message : 'Failed to reassign Corps Member.',
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell
      title="Corps Member Assignment & Caseload Monitoring"
      breadcrumb="Administration / Assignments /"
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/admin/partners"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/70 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-colors whitespace-nowrap"
          >
            <UserCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Manage Partners</span>
          </Link>
          <button
            type="button"
            disabled={busy}
            onClick={handleComputeAutoAssignmentPreview}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shadow-xs"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Auto-Assign Corps Members</span>
          </button>
        </div>
      }
    >
      <div className="space-y-6">
        {notice && (
          <div
            className={`p-3.5 rounded-xl border text-xs font-medium flex items-center justify-between gap-3 ${
              notice.tone === 'emerald'
                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300'
                : notice.tone === 'amber'
                ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/60 text-amber-800 dark:text-amber-300'
                : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800/60 text-rose-800 dark:text-rose-300'
            }`}
          >
            <span>{notice.text}</span>
            <button
              type="button"
              onClick={() => setNotice(null)}
              className="text-xs underline cursor-pointer shrink-0"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Part 7: 8-KPI Assignment Monitoring Grid */}
        <section aria-label="Assignment monitoring metrics">
          <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-3">
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 p-3.5">
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                Total Partners
              </p>
              <p className="text-xl font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-1">
                {monitoringStats.totalPartners}
              </p>
            </div>
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 p-3.5">
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                Active Partners
              </p>
              <p className="text-xl font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400 mt-1">
                {monitoringStats.activePartnersCount}
              </p>
            </div>
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 p-3.5">
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                Inactive Partners
              </p>
              <p className="text-xl font-bold font-mono tabular-nums text-slate-600 dark:text-slate-300 mt-1">
                {monitoringStats.inactivePartnersCount}
              </p>
            </div>
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 p-3.5">
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                Total Corps Members
              </p>
              <p className="text-xl font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-1">
                {monitoringStats.totalMembers}
              </p>
            </div>
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 p-3.5">
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                Assigned Members
              </p>
              <p className="text-xl font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400 mt-1">
                {monitoringStats.assignedMembersCount}
              </p>
            </div>
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 p-3.5">
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                Unassigned Members
              </p>
              <p
                className={`text-xl font-bold font-mono tabular-nums mt-1 ${
                  monitoringStats.unassignedMembersCount > 0
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-slate-900 dark:text-white'
                }`}
              >
                {monitoringStats.unassignedMembersCount}
              </p>
            </div>
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 p-3.5">
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                Available Capacity
              </p>
              <p className="text-xl font-bold font-mono tabular-nums text-sky-600 dark:text-sky-400 mt-1">
                {monitoringStats.partnersWithCapacityCount}
              </p>
            </div>
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 p-3.5">
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                At Full Capacity
              </p>
              <p className="text-xl font-bold font-mono tabular-nums text-rose-600 dark:text-rose-400 mt-1">
                {monitoringStats.partnersAtFullCapacityCount}
              </p>
            </div>
          </div>
        </section>

        {/* Part 6A: Manual Assignment Workspace */}
        <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white font-display flex items-center gap-2">
                <GitCompareArrows className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Manual Corps Member Assignment & Reassignment</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Select an active Accountability Partner, inspect available caseload slots, and assign or reassign one or more Corps Members.
              </p>
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={handleComputeAutoAssignmentPreview}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-300 dark:border-emerald-700/80 bg-emerald-50/70 dark:bg-emerald-950/30 hover:bg-emerald-100/70 dark:hover:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Auto-Assign Unassigned ({monitoringStats.unassignedMembersCount})</span>
            </button>
          </div>

          <div className="p-5 grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Step 1: Partner Selector & Capacity Card */}
            <div className="lg:col-span-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                  1. Select Active Accountability Partner
                </label>
                <select
                  value={selectedPartnerId}
                  onChange={(e) => {
                    setSelectedPartnerId(e.target.value);
                    setSelectedMemberIds([]);
                  }}
                  aria-label="Select Active Accountability Partner"
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                >
                  <option value="">Choose an active partner...</option>
                  {activePartnersList.map((p) => {
                    const m = partnerMetrics[p.uid];
                    const assigned = m?.assignedCount ?? 0;
                    const max = m?.maxCaseload ?? DEFAULT_PARTNER_MAX_CASELOAD;
                    const avail = m?.availableCapacity ?? 0;
                    return (
                      <option key={p.uid} value={p.uid}>
                        {p.displayName} — {assigned}/{max} assigned ({avail} slots available)
                      </option>
                    );
                  })}
                </select>
              </div>

              {selectedPartnerMetric ? (
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">
                        {selectedPartnerMetric.partner.displayName}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {privateDirectory[selectedPartnerMetric.partner.uid]?.email ||
                          selectedPartnerMetric.partner.organisation ||
                          'Active Accountability Partner'}
                      </p>
                    </div>
                    <AssignmentStatusTag
                      tone={selectedPartnerMetric.availableCapacity > 0 ? 'emerald' : 'rose'}
                      label={
                        selectedPartnerMetric.availableCapacity > 0
                          ? `${selectedPartnerMetric.availableCapacity} Slots Open`
                          : 'Full Capacity'
                      }
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-1">
                    <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200/80 dark:border-slate-800 p-2.5">
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">Assigned</p>
                      <p className="text-base font-bold font-mono tabular-nums text-slate-900 dark:text-white">
                        {selectedPartnerMetric.assignedCount}
                      </p>
                    </div>
                    <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200/80 dark:border-slate-800 p-2.5">
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">Max Caseload</p>
                      <p className="text-base font-bold font-mono tabular-nums text-slate-900 dark:text-white">
                        {selectedPartnerMetric.maxCaseload}
                      </p>
                    </div>
                    <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200/80 dark:border-slate-800 p-2.5">
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">Available</p>
                      <p className="text-base font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                        {selectedPartnerMetric.availableCapacity}
                      </p>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-300 mb-1">
                      <span>Caseload Utilization</span>
                      <span className="font-mono tabular-nums font-semibold">
                        {Math.round(selectedPartnerMetric.utilizationRatio * 100)}%
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          selectedPartnerMetric.isFull
                            ? 'bg-rose-500'
                            : selectedPartnerMetric.utilizationRatio >= 0.75
                            ? 'bg-amber-500'
                            : 'bg-emerald-500'
                        }`}
                        style={{
                          width: `${Math.min(
                            100,
                            Math.round(selectedPartnerMetric.utilizationRatio * 100)
                          )}%`,
                        }}
                      />
                    </div>
                  </div>

                  <div className="pt-1 flex items-center justify-between gap-2">
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      Selected to assign:{' '}
                      <strong className="font-mono text-slate-900 dark:text-white">
                        {selectedMemberIds.length}
                      </strong>{' '}
                      ({remainingCapacityAfterSelection} slot(s) left after selection)
                    </span>
                    <button
                      type="button"
                      onClick={() => setViewingPartner(selectedPartnerMetric.partner)}
                      className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer whitespace-nowrap"
                    >
                      View Current Caseload
                    </button>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-5 text-center text-xs text-slate-500 dark:text-slate-400">
                  Select an active Accountability Partner above to inspect capacity and assign Corps Members.
                </div>
              )}
            </div>

            {/* Step 2: Corps Member Selection List */}
            <div className="lg:col-span-7 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  2. Select Corps Members to Assign
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={!selectedPartnerMetric || selectedPartnerMetric.availableCapacity === 0}
                    onClick={handleSelectUpToCapacity}
                    className="px-2.5 py-1 rounded-md border border-slate-300 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
                  >
                    Select Up to Capacity
                  </button>
                  {selectedMemberIds.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectedMemberIds([])}
                      className="px-2.5 py-1 rounded-md border border-slate-300 dark:border-slate-700 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                    >
                      Clear ({selectedMemberIds.length})
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div className="relative sm:col-span-1">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="search"
                    value={memberSearch}
                    onChange={(e) => setMemberSearch(e.target.value)}
                    placeholder="Search member or state code..."
                    className="w-full pl-8 pr-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
                  />
                </div>
                <select
                  value={memberAssignmentFilter}
                  onChange={(e) => {
                    setMemberAssignmentFilter(e.target.value as 'unassigned' | 'all');
                    setSelectedMemberIds([]);
                  }}
                  aria-label="Filter members by current assignment"
                  className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
                >
                  <option value="unassigned">Unassigned Members Only</option>
                  <option value="all">All Members (Include Reassignment)</option>
                </select>
                <select
                  value={memberCohortFilter}
                  onChange={(e) => {
                    setMemberCohortFilter(e.target.value);
                    setSelectedMemberIds([]);
                  }}
                  aria-label="Filter members by cohort"
                  className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
                >
                  <option value="all">All Cohorts</option>
                  {cohorts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden max-h-72 overflow-y-auto divide-y divide-slate-200 dark:divide-slate-800">
                {filteredMembersForManual.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-500 dark:text-slate-400">
                    No matching Corps Members found for the selected filters.
                  </div>
                ) : (
                  filteredMembersForManual.map((member) => {
                    const checked = selectedMemberIds.includes(member.uid);
                    const disabled =
                      !checked &&
                      (!selectedPartnerMetric ||
                        selectedMemberIds.length >= selectedPartnerMetric.availableCapacity);

                    return (
                      <label
                        key={member.uid}
                        className={`flex items-center justify-between gap-3 px-4 py-2.5 text-xs transition-colors cursor-pointer ${
                          checked
                            ? 'bg-emerald-50/70 dark:bg-emerald-950/30'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={disabled}
                            onChange={() => toggleMemberSelection(member.uid)}
                            className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                          />
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-900 dark:text-white truncate">
                              {member.displayName}
                            </p>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                              {member.stateCode || 'No State Code'} ·{' '}
                              {member.cohortName || 'Unassigned Cohort'}
                            </p>
                          </div>
                        </div>

                        <div className="shrink-0 text-right">
                          {member.partnerId ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 text-[11px] font-medium">
                              Current: {member.partnerName || 'Assigned'}
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[11px] font-medium">
                              Unassigned
                            </span>
                          )}
                        </div>
                      </label>
                    );
                  })
                )}
              </div>

              <div className="flex items-center justify-between gap-3 pt-1">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Showing {filteredMembersForManual.length} eligible Corps Member(s)
                </p>
                <button
                  type="button"
                  disabled={
                    busy ||
                    !selectedPartnerMetric ||
                    selectedMemberIds.length === 0 ||
                    selectedMemberIds.length > selectedPartnerMetric.availableCapacity
                  }
                  onClick={handleManualAssign}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-semibold transition-colors cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>
                    {busy
                      ? 'Assigning...'
                      : `Assign ${selectedMemberIds.length || ''} Selected Member${
                          selectedMemberIds.length === 1 ? '' : 's'
                        }${
                          selectedPartnerMetric
                            ? ` to ${selectedPartnerMetric.partner.displayName}`
                            : ''
                        }`}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Part 7: Partner Caseload Monitoring Table */}
        <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white font-display">
                Accountability Partner Caseload Directory
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Live caseload utilization, remaining capacity, and assigned Corps Members for every Accountability Partner.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="search"
                  value={partnerTableSearch}
                  onChange={(e) => setPartnerTableSearch(e.target.value)}
                  placeholder="Search partner, email, phone..."
                  className="pl-8 pr-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs w-56"
                />
              </div>
              <select
                value={partnerTableStatus}
                onChange={(e) =>
                  setPartnerTableStatus(
                    e.target.value as 'all' | 'available' | 'full' | 'inactive'
                  )
                }
                aria-label="Filter partner caseload table"
                className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
              >
                <option value="all">All Partners ({partners.length})</option>
                <option value="available">
                  Available Capacity ({monitoringStats.partnersWithCapacityCount})
                </option>
                <option value="full">
                  At Full Capacity ({monitoringStats.partnersAtFullCapacityCount})
                </option>
                <option value="inactive">
                  Inactive Partners ({monitoringStats.inactivePartnersCount})
                </option>
              </select>
            </div>
          </div>

          {filteredPartnersForMonitoring.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                No Accountability Partners Match Filters
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Adjust your search query or capacity filter, or add/import partners on the Partners page.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold uppercase tracking-wider text-slate-400 bg-slate-50/50 dark:bg-slate-900/50">
                    <th className="py-3 px-4">Partner Name</th>
                    <th className="py-3 px-4">Email</th>
                    <th className="py-3 px-4">Phone Number</th>
                    <th className="py-3 px-4">Assigned Corps Members</th>
                    <th className="py-3 px-4">Maximum Caseload</th>
                    <th className="py-3 px-4">Available Capacity</th>
                    <th className="py-3 px-4">Assignment Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800/70 text-sm">
                  {filteredPartnersForMonitoring.map((partner) => {
                    const metric = partnerMetrics[partner.uid];
                    const priv = privateDirectory[partner.uid];
                    const email = priv?.email || 'Protected';
                    const phone = partner.phone || priv?.phone || '—';
                    const assignedCount = metric?.assignedCount ?? 0;
                    const maxCaseload = metric?.maxCaseload ?? DEFAULT_PARTNER_MAX_CASELOAD;
                    const availableCapacity = metric?.availableCapacity ?? 0;
                    const isInactive = partner.status !== 'active';
                    const isFull = availableCapacity <= 0;

                    return (
                      <tr
                        key={partner.uid}
                        className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        <td className="py-3 px-4">
                          <button
                            type="button"
                            onClick={() => setViewingPartner(partner)}
                            className="font-semibold text-slate-900 dark:text-white hover:text-emerald-600 dark:hover:text-emerald-400 text-left cursor-pointer"
                          >
                            {partner.displayName}
                          </button>
                          {(partner.organisation || partner.state) && (
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              {[partner.organisation, partner.state].filter(Boolean).join(' · ')}
                            </p>
                          )}
                        </td>
                        <td className="py-3 px-4 text-xs font-mono text-slate-600 dark:text-slate-300">
                          {email}
                        </td>
                        <td className="py-3 px-4 text-xs font-mono text-slate-600 dark:text-slate-300">
                          {phone}
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-mono font-semibold tabular-nums text-slate-900 dark:text-white">
                            {assignedCount}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-mono tabular-nums text-slate-700 dark:text-slate-300">
                            {maxCaseload}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`font-mono font-semibold tabular-nums ${
                              isInactive
                                ? 'text-slate-400'
                                : isFull
                                ? 'text-rose-600 dark:text-rose-400'
                                : 'text-emerald-600 dark:text-emerald-400'
                            }`}
                          >
                            {isInactive ? 0 : availableCapacity}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          {isInactive ? (
                            <AssignmentStatusTag tone="slate" label="Inactive" />
                          ) : isFull ? (
                            <AssignmentStatusTag tone="rose" label="At Full Capacity" />
                          ) : (
                            <AssignmentStatusTag
                              tone="emerald"
                              label={`Available (${availableCapacity} open)`}
                            />
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => setViewingPartner(partner)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer whitespace-nowrap"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>View Caseload ({assignedCount})</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {/* Part 6B: Auto-Assign Confirmation Preview Modal */}
      {autoPreviewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 max-w-3xl w-full p-6 space-y-5 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white font-display flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Confirm Automatic Corps Member Assignment</span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Balanced distribution across active Accountability Partners prioritized by lowest caseload utilization ratio.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAutoPreviewOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3.5 bg-slate-50/70 dark:bg-slate-800/40">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Members to Auto-Assign
                </p>
                <p className="text-xl font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400 mt-1">
                  {proposedAutoAssignments.length}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3.5 bg-slate-50/70 dark:bg-slate-800/40">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Receiving Active Partners
                </p>
                <p className="text-xl font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-1">
                  {autoPreviewByPartner.length}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3.5 bg-slate-50/70 dark:bg-slate-800/40">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Remaining Unassigned (Overflow)
                </p>
                <p
                  className={`text-xl font-bold font-mono tabular-nums mt-1 ${
                    unassignedOverflowCount > 0
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-slate-900 dark:text-white'
                  }`}
                >
                  {unassignedOverflowCount}
                </p>
              </div>
            </div>

            {unassignedOverflowCount > 0 && (
              <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  All active Accountability Partners will reach 100% of their maximum caseload after assigning{' '}
                  <strong>{proposedAutoAssignments.length}</strong> member(s). The remaining{' '}
                  <strong>{unassignedOverflowCount}</strong> member(s) will stay unassigned so no partner exceeds their caseload cap.
                </span>
              </div>
            )}

            {/* Partner Load Impact Summary */}
            <div className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Proposed Partner Caseload Distribution
              </h3>
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold uppercase text-slate-500">
                      <th className="py-2.5 px-3">Accountability Partner</th>
                      <th className="py-2.5 px-3">Current Load</th>
                      <th className="py-2.5 px-3">New Assignments</th>
                      <th className="py-2.5 px-3">Projected Load</th>
                      <th className="py-2.5 px-3">Projected Utilization</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {autoPreviewByPartner.map((row) => (
                      <tr key={row.partnerId}>
                        <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-white">
                          {row.partnerName}
                        </td>
                        <td className="py-2.5 px-3 font-mono">
                          {row.beforeCount} / {row.maxCaseload}
                        </td>
                        <td className="py-2.5 px-3 font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                          +{row.addedCount}
                        </td>
                        <td className="py-2.5 px-3 font-mono font-semibold text-slate-900 dark:text-white">
                          {row.afterCount} / {row.maxCaseload}
                        </td>
                        <td className="py-2.5 px-3 font-mono">
                          {Math.round((row.afterCount / row.maxCaseload) * 100)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Detailed Member-to-Partner Mapping */}
            <div className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Individual Member Assignments ({proposedAutoAssignments.length})
              </h3>
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden max-h-56 overflow-y-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold uppercase text-slate-500">
                      <th className="py-2 px-3">Corps Member</th>
                      <th className="py-2 px-3">State Code / Cohort</th>
                      <th className="py-2 px-3">Assigned Accountability Partner</th>
                      <th className="py-2 px-3 text-right">Slot</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {proposedAutoAssignments.map((item) => (
                      <tr key={item.memberId}>
                        <td className="py-2 px-3 font-semibold text-slate-900 dark:text-white">
                          {item.memberName}
                        </td>
                        <td className="py-2 px-3 text-slate-500 dark:text-slate-400">
                          {item.memberStateCode} · {item.memberCohortName}
                        </td>
                        <td className="py-2 px-3 font-medium text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                          <ArrowRight className="w-3.5 h-3.5 shrink-0" />
                          <span>{item.partnerName}</span>
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-slate-500">
                          {item.partnerCurrentLoadAfter}/{item.partnerMaxCaseload}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                disabled={busy}
                onClick={() => setAutoPreviewOpen(false)}
                className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy || proposedAutoAssignments.length === 0}
                onClick={handleConfirmAutoAssign}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold cursor-pointer"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>
                  {busy
                    ? 'Committing Assignments...'
                    : `Confirm Auto-Assignment (${proposedAutoAssignments.length})`}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Partner Profile & Assigned Corps Members Modal */}
      {viewingPartner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 max-w-2xl w-full p-6 space-y-5 shadow-xl max-h-[90vh] overflow-y-auto">
            {(() => {
              const metric = partnerMetrics[viewingPartner.uid];
              const priv = privateDirectory[viewingPartner.uid];
              const assignedList = metric?.assignedMembers || [];
              const maxCaseload = metric?.maxCaseload ?? DEFAULT_PARTNER_MAX_CASELOAD;
              const availableCapacity = metric?.availableCapacity ?? 0;

              return (
                <>
                  <div className="flex items-start justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-base font-bold text-slate-900 dark:text-white font-display">
                          {viewingPartner.displayName}
                        </h2>
                        <AssignmentStatusTag
                          tone={viewingPartner.status === 'active' ? 'emerald' : 'slate'}
                          label={viewingPartner.status === 'active' ? 'Active' : 'Inactive'}
                        />
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {priv?.email || 'Protected email'} ·{' '}
                        {viewingPartner.phone || priv?.phone || 'No phone recorded'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setViewingPartner(null)}
                      className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3 bg-slate-50/70 dark:bg-slate-800/40">
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Assigned Members
                      </p>
                      <p className="text-lg font-bold font-mono text-slate-900 dark:text-white mt-0.5">
                        {assignedList.length}
                      </p>
                    </div>
                    <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3 bg-slate-50/70 dark:bg-slate-800/40">
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Maximum Caseload
                      </p>
                      <p className="text-lg font-bold font-mono text-slate-900 dark:text-white mt-0.5">
                        {maxCaseload}
                      </p>
                    </div>
                    <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3 bg-slate-50/70 dark:bg-slate-800/40">
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Available Capacity
                      </p>
                      <p className="text-lg font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-0.5">
                        {availableCapacity}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2.5">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5" />
                      <span>Assigned Corps Members ({assignedList.length})</span>
                    </h3>

                    {assignedList.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-6 text-center text-xs text-slate-500 dark:text-slate-400">
                        No Corps Members are currently assigned to {viewingPartner.displayName}.
                      </div>
                    ) : (
                      <div className="border border-slate-200 dark:border-slate-800 rounded-xl divide-y divide-slate-200 dark:divide-slate-800 max-h-72 overflow-y-auto">
                        {assignedList.map((member) => (
                          <div
                            key={member.uid}
                            className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs"
                          >
                            <div>
                              <Link
                                to={`/admin/participants/${member.uid}`}
                                className="font-semibold text-slate-900 dark:text-white hover:text-emerald-600 dark:hover:text-emerald-400"
                              >
                                {member.displayName}
                              </Link>
                              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                {member.stateCode || 'No State Code'} ·{' '}
                                {member.cohortName || 'Unassigned Cohort'}
                              </p>
                            </div>

                            <div className="flex items-center gap-2">
                              <select
                                value={reassignTargets[member.uid] ?? ''}
                                onChange={(e) =>
                                  setReassignTargets((prev) => ({
                                    ...prev,
                                    [member.uid]: e.target.value,
                                  }))
                                }
                                aria-label={`Reassign ${member.displayName}`}
                                className="px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
                              >
                                <option value="">Unassign from Partner</option>
                                {activePartnersList
                                  .filter((p) => p.uid !== viewingPartner.uid)
                                  .map((p) => {
                                    const pm = partnerMetrics[p.uid];
                                    const avail = pm?.availableCapacity ?? 0;
                                    return (
                                      <option key={p.uid} value={p.uid} disabled={avail <= 0}>
                                        {p.displayName} ({pm?.assignedCount ?? 0}/
                                        {pm?.maxCaseload ?? DEFAULT_PARTNER_MAX_CASELOAD})
                                      </option>
                                    );
                                  })}
                              </select>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => handleQuickReassignFromModal(member)}
                                className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white font-semibold cursor-pointer whitespace-nowrap"
                              >
                                Apply
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end pt-2 border-t border-slate-200 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => setViewingPartner(null)}
                      className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer"
                    >
                      Close
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </AppShell>
  );
}
