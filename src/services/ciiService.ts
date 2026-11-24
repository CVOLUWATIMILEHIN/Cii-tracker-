import { User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Unsubscribe,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { db, handleFirestoreError, OperationType, storage } from '../lib/firebase';
import {
  BLUEPRINT_LIMITS,
  clampNumber,
  getIsoWeekInfo,
  getTodayDateKey,
  isSafeHttpUrl,
  sanitizeCode,
  sanitizeId,
  sanitizeString,
} from '../lib/validators';
import {
  Activity,
  ActivityStatus,
  ActivitySubmission,
  AdminRole,
  Announcement,
  AnnouncementTarget,
  AssignmentScope,
  AuditCategory,
  AuditLog,
  AuditSeverity,
  CanonicalRole,
  CheckinStatus,
  Cohort,
  DailyCheckin,
  DEFAULT_PARTNER_MAX_CASELOAD,
  FollowUp,
  FollowUpSource,
  FollowUpStatus,
  InitiativePillar,
  Invitation,
  isAdminPortalRole,
  isFullAdminRole,
  isScopedAdminRole,
  normalizeRole,
  NotificationItem,
  NotificationType,
  ProgrammeSettings,
  ROLE_LABELS,
  SubmissionStatus,
  UserPrivateInfo,
  UserProfile,
  UserStatus,
  WeeklyReport,
  WeeklyReportStatus,
} from '../types';

export function createDocId(prefix: string): string {
  const rand =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID().slice(0, 10)
      : Math.random().toString(36).slice(2, 12);
  return sanitizeId(`${prefix}-${Date.now().toString(36)}-${rand}`);
}

export function getMillis(ts: { toMillis?: () => number } | null | undefined): number {
  if (!ts || typeof ts.toMillis !== 'function') return 0;
  return ts.toMillis();
}

export async function recordAuditEvent(params: {
  actorId: string;
  actorName: string;
  actorRole: CanonicalRole;
  action: string;
  category: AuditCategory;
  severity: AuditSeverity;
  targetType: string;
  targetId: string;
  summary: string;
}): Promise<void> {
  const logId = createDocId('log');
  try {
    await setDoc(doc(db, 'audit_logs', logId), {
      id: logId,
      actorId: sanitizeId(params.actorId),
      actorName: sanitizeString(params.actorName || 'CII User', 100),
      actorRole: params.actorRole,
      action: sanitizeString(params.action, 64),
      category: params.category,
      severity: params.severity,
      targetType: sanitizeString(params.targetType, 32),
      targetId: sanitizeString(params.targetId || 'system', 128),
      summary: sanitizeString(params.summary, BLUEPRINT_LIMITS.summaryMaxLength),
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `audit_logs/${logId}`);
  }
}

export async function sendNotification(params: {
  recipientId: string;
  title: string;
  message: string;
  type: NotificationType;
  linkPath: string;
}): Promise<void> {
  if (!params.recipientId) return;
  const id = createDocId('notif');
  try {
    await setDoc(doc(db, 'notifications', id), {
      id,
      recipientId: sanitizeId(params.recipientId),
      title: sanitizeString(params.title, 140),
      message: sanitizeString(params.message, 400),
      type: params.type,
      linkPath: sanitizeString(params.linkPath, 140),
      read: false,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `notifications/${id}`);
  }
}

export async function ensureUserProfile(
  firebaseUser: User,
  options?: { inviteCode?: string; displayName?: string; phone?: string }
): Promise<UserProfile> {
  const uid = sanitizeId(firebaseUser.uid);
  const userRef = doc(db, 'users', uid);
  const privateRef = doc(db, 'users', uid, 'private', 'info');

  const fallbackName = sanitizeString(
    options?.displayName ||
      firebaseUser.displayName ||
      firebaseUser.email?.split('@')[0] ||
      'CII Member',
    100
  );
  const email = sanitizeString(firebaseUser.email || `${uid}@cii.local`, 160);
  const phone = sanitizeString(options?.phone || '', 32);

  let profile: UserProfile;

  try {
    const snap = await getDoc(userRef);
    if (!snap.exists()) {
      const inviteCode = sanitizeString(options?.inviteCode || '', 40);
      let inviteData: Invitation | null = null;

      if (inviteCode) {
        try {
          const invSnap = await getDoc(doc(db, 'invitations', inviteCode));
          if (invSnap.exists()) {
            const candidate = invSnap.data() as Invitation;
            if (
              candidate.email.toLowerCase() === email.toLowerCase() &&
              candidate.status === 'pending'
            ) {
              inviteData = candidate;
            }
          }
        } catch {
          // ignore if invitation lookup fails or unauthorized
        }
      }

      const initialRole: CanonicalRole = inviteData ? normalizeRole(inviteData.role) : 'member';
      const initialAssignedCohorts = Array.isArray(inviteData?.assignedCohortIds)
        ? inviteData.assignedCohortIds.slice(0, 20)
        : [];
      const defaultDepartment =
        inviteData?.department ||
        (initialRole === 'super_admin' || initialRole === 'admin'
          ? 'Programme Administration'
          : initialRole === 'programme_manager'
            ? 'Programme Management'
            : initialRole === 'reviewer'
              ? 'Quality & Review'
              : initialRole === 'partner'
                ? 'Accountability Partnership'
                : 'Corps Member');

      const resolvedPhone = sanitizeString(inviteData?.phone || options?.phone || '', 32);

      await setDoc(userRef, {
        uid,
        displayName: inviteData?.displayName || fallbackName,
        role: initialRole,
        status: 'active',
        cohortId: inviteData?.cohortId || '',
        cohortName: inviteData?.cohortName || '',
        assignedCohortIds: initialAssignedCohorts,
        partnerId: inviteData?.partnerId || '',
        partnerName: inviteData?.partnerName || '',
        stateCode: inviteData?.stateCode || '',
        ppa: inviteData?.ppa || '',
        department: sanitizeString(defaultDepartment, 64),
        inviteCode: inviteData ? inviteData.id : '',
        phone: resolvedPhone,
        gender: sanitizeString(inviteData?.gender || '', 24),
        state: sanitizeString(inviteData?.state || '', 48),
        organisation: sanitizeString(inviteData?.organisation || '', 120),
        maxCaseload:
          typeof inviteData?.maxCaseload === 'number' && inviteData.maxCaseload > 0
            ? clampNumber(Math.round(inviteData.maxCaseload), 1, 200)
            : initialRole === 'partner'
              ? DEFAULT_PARTNER_MAX_CASELOAD
              : 0,
        notes: sanitizeString(inviteData?.notes || '', 500),
        lastLoginAt: serverTimestamp(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      if (inviteData) {
        await updateDoc(doc(db, 'invitations', inviteData.id), {
          status: 'claimed',
          claimedBy: uid,
          updatedAt: serverTimestamp(),
        });
      }

      const createdSnap = await getDoc(userRef);
      profile = normalizeUserProfile(createdSnap.data() as Partial<UserProfile>);

      await sendNotification({
        recipientId: uid,
        title: 'Account Activated',
        message: `Welcome to the CII Accountability Tracker as ${ROLE_LABELS[normalizeRole(profile.role)]}.`,
        type: 'activation',
        linkPath: isAdminPortalRole(profile.role)
          ? '/admin'
          : normalizeRole(profile.role) === 'partner'
            ? '/partner'
            : '/dashboard',
      });
    } else {
      const raw = snap.data() as Record<string, unknown>;
      const canonicalKeys = [
        'uid',
        'displayName',
        'role',
        'status',
        'cohortId',
        'cohortName',
        'assignedCohortIds',
        'partnerId',
        'partnerName',
        'stateCode',
        'ppa',
        'department',
        'inviteCode',
        'phone',
        'gender',
        'state',
        'organisation',
        'maxCaseload',
        'notes',
        'lastLoginAt',
        'createdAt',
        'updatedAt',
      ];
      const rawKeys = Object.keys(raw);
      const hasLegacyOrMissingFields =
        rawKeys.some((k) => !canonicalKeys.includes(k)) ||
        typeof raw.status !== 'string' ||
        typeof raw.cohortId !== 'string' ||
        typeof raw.cohortName !== 'string' ||
        !Array.isArray(raw.assignedCohortIds) ||
        typeof raw.partnerId !== 'string' ||
        typeof raw.partnerName !== 'string' ||
        typeof raw.stateCode !== 'string' ||
        typeof raw.ppa !== 'string' ||
        typeof raw.inviteCode !== 'string' ||
        typeof raw.department !== 'string' ||
        !raw.department ||
        !('lastLoginAt' in raw);

      if (hasLegacyOrMissingFields) {
        const resolvedRole: CanonicalRole = normalizeRole(
          typeof raw.role === 'string' ? raw.role : 'member'
        );
        const resolvedStatus =
          typeof raw.status === 'string' &&
          ['active', 'inactive', 'suspended', 'pending'].includes(raw.status)
            ? raw.status
            : 'active';

        await setDoc(userRef, {
          uid,
          displayName: sanitizeString(
            typeof raw.displayName === 'string' && raw.displayName.trim()
              ? raw.displayName
              : fallbackName,
            100
          ),
          role: resolvedRole,
          status: resolvedStatus,
          cohortId: typeof raw.cohortId === 'string' ? sanitizeString(raw.cohortId, 128) : '',
          cohortName: typeof raw.cohortName === 'string' ? sanitizeString(raw.cohortName, 100) : '',
          assignedCohortIds: Array.isArray(raw.assignedCohortIds)
            ? (raw.assignedCohortIds as string[]).slice(0, 20)
            : [],
          partnerId: typeof raw.partnerId === 'string' ? sanitizeString(raw.partnerId, 128) : '',
          partnerName: typeof raw.partnerName === 'string' ? sanitizeString(raw.partnerName, 100) : '',
          stateCode: typeof raw.stateCode === 'string' ? sanitizeString(raw.stateCode, 32) : '',
          ppa: typeof raw.ppa === 'string' ? sanitizeString(raw.ppa, 120) : '',
          department: sanitizeString(
            typeof raw.department === 'string' && raw.department.trim()
              ? raw.department
              : isAdminPortalRole(resolvedRole)
                ? 'Programme Administration'
                : resolvedRole === 'partner'
                  ? 'Accountability Partnership'
                  : 'Corps Member',
            64
          ),
          inviteCode: typeof raw.inviteCode === 'string' ? sanitizeString(raw.inviteCode, 40) : '',
          lastLoginAt: serverTimestamp(),
          createdAt: raw.createdAt || serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        const migratedSnap = await getDoc(userRef);
        profile = normalizeUserProfile(migratedSnap.data() as Partial<UserProfile>);
      } else {
        if (raw.status === 'active') {
          try {
            await updateDoc(userRef, {
              lastLoginAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          } catch {
            // non-fatal if timestamp update is skipped
          }
        }
        const latestSnap = await getDoc(userRef);
        profile = normalizeUserProfile(latestSnap.data() as Partial<UserProfile>);
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `users/${uid}`);
  }

  try {
    const privSnap = await getDoc(privateRef);
    const existingPhone =
      privSnap.exists() && typeof privSnap.data().phone === 'string' && privSnap.data().phone
        ? sanitizeString(privSnap.data().phone, 32)
        : sanitizeString(profile.phone || phone, 32);

    await setDoc(privateRef, {
      uid,
      email,
      phone: existingPhone,
      lastActiveAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${uid}/private/info`);
  }

  if (profile.status === 'active') {
    await recordAuditEvent({
      actorId: uid,
      actorName: profile.displayName,
      actorRole: normalizeRole(profile.role),
      action: 'AUTH_LOGIN',
      category: 'auth',
      severity: 'info',
      targetType: 'user',
      targetId: uid,
      summary: `${profile.displayName} signed in (${ROLE_LABELS[normalizeRole(profile.role)]}).`,
    });
  }

  return profile;
}

function normalizeUserProfile(raw: Partial<UserProfile> & { uid?: string }): UserProfile {
  const role = raw.role || 'member';
  const normalizedRole = normalizeRole(role);
  return {
    uid: raw.uid || '',
    displayName: raw.displayName || 'CII Member',
    role,
    status: raw.status || 'active',
    cohortId: raw.cohortId || '',
    cohortName: raw.cohortName || '',
    assignedCohortIds: Array.isArray(raw.assignedCohortIds) ? raw.assignedCohortIds : [],
    partnerId: raw.partnerId || '',
    partnerName: raw.partnerName || '',
    stateCode: raw.stateCode || '',
    ppa: raw.ppa || '',
    department: raw.department || 'Corps Member',
    inviteCode: raw.inviteCode || '',
    phone: typeof raw.phone === 'string' ? raw.phone : '',
    gender: typeof raw.gender === 'string' ? raw.gender : '',
    state: typeof raw.state === 'string' ? raw.state : '',
    organisation: typeof raw.organisation === 'string' ? raw.organisation : '',
    maxCaseload:
      typeof raw.maxCaseload === 'number' && raw.maxCaseload > 0
        ? raw.maxCaseload
        : normalizedRole === 'partner'
          ? DEFAULT_PARTNER_MAX_CASELOAD
          : 0,
    notes: typeof raw.notes === 'string' ? raw.notes : '',
    lastLoginAt: raw.lastLoginAt || null,
    createdAt: raw.createdAt || null,
    updatedAt: raw.updatedAt || null,
  };
}

// Subscriptions
export function subscribeToUserProfile(
  uid: string,
  onData: (profile: UserProfile | null) => void
): Unsubscribe {
  return onSnapshot(
    doc(db, 'users', uid),
    (snap) => onData(snap.exists() ? normalizeUserProfile(snap.data() as Partial<UserProfile>) : null),
    (error) => handleFirestoreError(error, OperationType.GET, `users/${uid}`)
  );
}

export function subscribeToUserPrivateInfo(
  uid: string,
  onData: (info: UserPrivateInfo | null) => void
): Unsubscribe {
  return onSnapshot(
    doc(db, 'users', uid, 'private', 'info'),
    (snap) => onData(snap.exists() ? (snap.data() as UserPrivateInfo) : null),
    (error) => handleFirestoreError(error, OperationType.GET, `users/${uid}/private/info`)
  );
}

export function subscribeToAllUsers(
  onData: (users: UserProfile[]) => void,
  scopedCohortIds?: string[]
): Unsubscribe {
  if (scopedCohortIds) {
    if (scopedCohortIds.length === 0) {
      onData([]);
      return () => {};
    }
    return onSnapshot(
      query(collection(db, 'users'), where('cohortId', 'in', scopedCohortIds.slice(0, 20))),
      (snap) => {
        const items = snap.docs.map((d) => normalizeUserProfile(d.data() as Partial<UserProfile>));
        items.sort((a, b) => a.displayName.localeCompare(b.displayName));
        onData(items);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'users')
    );
  }
  return onSnapshot(
    collection(db, 'users'),
    (snap) => {
      const items = snap.docs.map((d) => normalizeUserProfile(d.data() as Partial<UserProfile>));
      items.sort((a, b) => a.displayName.localeCompare(b.displayName));
      onData(items);
    },
    (error) => handleFirestoreError(error, OperationType.LIST, 'users')
  );
}

export function subscribeToAssignedMembers(
  partnerUid: string,
  onData: (members: UserProfile[]) => void
): Unsubscribe {
  return onSnapshot(
    query(collection(db, 'users'), where('partnerId', '==', partnerUid)),
    (snap) => {
      const items = snap.docs.map((d) => normalizeUserProfile(d.data() as Partial<UserProfile>));
      items.sort((a, b) => a.displayName.localeCompare(b.displayName));
      onData(items);
    },
    (error) => handleFirestoreError(error, OperationType.LIST, 'users')
  );
}

export function subscribeToInvitations(
  onData: (invites: Invitation[]) => void,
  scopedCohortIds?: string[]
): Unsubscribe {
  if (scopedCohortIds) {
    if (scopedCohortIds.length === 0) {
      onData([]);
      return () => {};
    }
    return onSnapshot(
      query(collection(db, 'invitations'), where('cohortId', 'in', scopedCohortIds.slice(0, 20))),
      (snap) => {
        const items = snap.docs.map((d) => d.data() as Invitation);
        items.sort((a, b) => getMillis(b.createdAt) - getMillis(a.createdAt));
        onData(items);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'invitations')
    );
  }
  return onSnapshot(
    collection(db, 'invitations'),
    (snap) => {
      const items = snap.docs.map((d) => d.data() as Invitation);
      items.sort((a, b) => getMillis(b.createdAt) - getMillis(a.createdAt));
      onData(items);
    },
    (error) => handleFirestoreError(error, OperationType.LIST, 'invitations')
  );
}

export function subscribeToCohorts(
  onData: (cohorts: Cohort[]) => void,
  scopedCohortIds?: string[]
): Unsubscribe {
  if (scopedCohortIds) {
    if (scopedCohortIds.length === 0) {
      onData([]);
      return () => {};
    }
    return onSnapshot(
      query(collection(db, 'cohorts'), where('id', 'in', scopedCohortIds.slice(0, 20))),
      (snap) => {
        const items = snap.docs.map((d) => d.data() as Cohort);
        items.sort((a, b) => b.startDate.localeCompare(a.startDate));
        onData(items);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'cohorts')
    );
  }
  return onSnapshot(
    collection(db, 'cohorts'),
    (snap) => {
      const items = snap.docs.map((d) => d.data() as Cohort);
      items.sort((a, b) => b.startDate.localeCompare(a.startDate));
      onData(items);
    },
    (error) => handleFirestoreError(error, OperationType.LIST, 'cohorts')
  );
}

export function subscribeToActivities(
  role: CanonicalRole,
  onData: (activities: Activity[]) => void,
  scopedCohortIds?: string[]
): Unsubscribe {
  if (isScopedAdminRole(role)) {
    const ids = scopedCohortIds || [];
    if (ids.length === 0) {
      onData([]);
      return () => {};
    }
    return onSnapshot(
      query(collection(db, 'activities'), where('cohortId', 'in', ids.slice(0, 20))),
      (snap) => {
        const items = snap.docs.map((d) => d.data() as Activity);
        items.sort((a, b) => a.deadline.localeCompare(b.deadline));
        onData(items);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'activities')
    );
  }

  const q =
    isFullAdminRole(role) || role === 'partner'
      ? collection(db, 'activities')
      : query(collection(db, 'activities'), where('status', '==', 'published'));

  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs.map((d) => d.data() as Activity);
      items.sort((a, b) => a.deadline.localeCompare(b.deadline));
      onData(items);
    },
    (error) => handleFirestoreError(error, OperationType.LIST, 'activities')
  );
}

export function subscribeToSubmissions(
  role: CanonicalRole,
  uid: string,
  onData: (items: ActivitySubmission[]) => void,
  scopedCohortIds?: string[]
): Unsubscribe {
  if (isScopedAdminRole(role)) {
    const ids = scopedCohortIds || [];
    if (ids.length === 0) {
      onData([]);
      return () => {};
    }
    return onSnapshot(
      query(collection(db, 'activity_submissions'), where('cohortId', 'in', ids.slice(0, 20))),
      (snap) => {
        const items = snap.docs.map((d) => d.data() as ActivitySubmission);
        items.sort((a, b) => getMillis(b.updatedAt) - getMillis(a.updatedAt));
        onData(items);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'activity_submissions')
    );
  }

  const q = isFullAdminRole(role)
    ? collection(db, 'activity_submissions')
    : role === 'partner'
      ? query(collection(db, 'activity_submissions'), where('partnerId', '==', uid))
      : query(collection(db, 'activity_submissions'), where('memberId', '==', uid));

  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs.map((d) => d.data() as ActivitySubmission);
      items.sort((a, b) => getMillis(b.updatedAt) - getMillis(a.updatedAt));
      onData(items);
    },
    (error) => handleFirestoreError(error, OperationType.LIST, 'activity_submissions')
  );
}

export function subscribeToDailyCheckins(
  role: CanonicalRole,
  uid: string,
  onData: (items: DailyCheckin[]) => void,
  scopedCohortIds?: string[]
): Unsubscribe {
  if (isScopedAdminRole(role)) {
    const ids = scopedCohortIds || [];
    if (ids.length === 0) {
      onData([]);
      return () => {};
    }
    return onSnapshot(
      query(collection(db, 'daily_checkins'), where('cohortId', 'in', ids.slice(0, 20))),
      (snap) => {
        const items = snap.docs.map((d) => d.data() as DailyCheckin);
        items.sort((a, b) => b.checkinDate.localeCompare(a.checkinDate));
        onData(items);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'daily_checkins')
    );
  }

  const q = isFullAdminRole(role)
    ? collection(db, 'daily_checkins')
    : role === 'partner'
      ? query(collection(db, 'daily_checkins'), where('partnerId', '==', uid))
      : query(collection(db, 'daily_checkins'), where('memberId', '==', uid));

  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs.map((d) => d.data() as DailyCheckin);
      items.sort((a, b) => b.checkinDate.localeCompare(a.checkinDate));
      onData(items);
    },
    (error) => handleFirestoreError(error, OperationType.LIST, 'daily_checkins')
  );
}

export function subscribeToWeeklyReports(
  role: CanonicalRole,
  uid: string,
  onData: (items: WeeklyReport[]) => void,
  scopedCohortIds?: string[]
): Unsubscribe {
  if (isScopedAdminRole(role)) {
    const ids = scopedCohortIds || [];
    if (ids.length === 0) {
      onData([]);
      return () => {};
    }
    return onSnapshot(
      query(collection(db, 'weekly_reports'), where('cohortId', 'in', ids.slice(0, 20))),
      (snap) => {
        const items = snap.docs.map((d) => d.data() as WeeklyReport);
        items.sort((a, b) => b.weekKey.localeCompare(a.weekKey));
        onData(items);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'weekly_reports')
    );
  }

  const q = isFullAdminRole(role)
    ? collection(db, 'weekly_reports')
    : role === 'partner'
      ? query(collection(db, 'weekly_reports'), where('partnerId', '==', uid))
      : query(collection(db, 'weekly_reports'), where('memberId', '==', uid));

  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs.map((d) => d.data() as WeeklyReport);
      items.sort((a, b) => b.weekKey.localeCompare(a.weekKey));
      onData(items);
    },
    (error) => handleFirestoreError(error, OperationType.LIST, 'weekly_reports')
  );
}

export function subscribeToFollowUps(
  role: CanonicalRole,
  uid: string,
  onData: (items: FollowUp[]) => void
): Unsubscribe {
  if (isScopedAdminRole(role)) {
    onData([]);
    return () => {};
  }
  const q = isFullAdminRole(role)
    ? collection(db, 'follow_ups')
    : role === 'partner'
      ? query(collection(db, 'follow_ups'), where('partnerId', '==', uid))
      : query(collection(db, 'follow_ups'), where('memberId', '==', uid));

  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs.map((d) => d.data() as FollowUp);
      items.sort((a, b) => getMillis(b.updatedAt) - getMillis(a.updatedAt));
      onData(items);
    },
    (error) => handleFirestoreError(error, OperationType.LIST, 'follow_ups')
  );
}

export function subscribeToAnnouncements(onData: (items: Announcement[]) => void): Unsubscribe {
  return onSnapshot(
    collection(db, 'announcements'),
    (snap) => {
      const items = snap.docs.map((d) => d.data() as Announcement);
      items.sort((a, b) => getMillis(b.createdAt) - getMillis(a.createdAt));
      onData(items);
    },
    (error) => handleFirestoreError(error, OperationType.LIST, 'announcements')
  );
}

export function subscribeToNotifications(
  uid: string,
  onData: (items: NotificationItem[]) => void
): Unsubscribe {
  return onSnapshot(
    query(collection(db, 'notifications'), where('recipientId', '==', uid)),
    (snap) => {
      const items = snap.docs.map((d) => d.data() as NotificationItem);
      items.sort((a, b) => getMillis(b.createdAt) - getMillis(a.createdAt));
      onData(items);
    },
    (error) => handleFirestoreError(error, OperationType.LIST, 'notifications')
  );
}

export function subscribeToProgrammeSettings(
  onData: (settings: ProgrammeSettings | null) => void
): Unsubscribe {
  return onSnapshot(
    doc(db, 'settings', 'programme'),
    (snap) => onData(snap.exists() ? (snap.data() as ProgrammeSettings) : null),
    (error) => handleFirestoreError(error, OperationType.GET, 'settings/programme')
  );
}

export function subscribeToAuditLogs(
  role: CanonicalRole,
  uid: string,
  onData: (logs: AuditLog[]) => void
): Unsubscribe {
  const q = isFullAdminRole(role)
    ? collection(db, 'audit_logs')
    : query(collection(db, 'audit_logs'), where('actorId', '==', uid));

  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs.map((d) => d.data() as AuditLog);
      items.sort((a, b) => getMillis(b.createdAt) - getMillis(a.createdAt));
      onData(items);
    },
    (error) => handleFirestoreError(error, OperationType.LIST, 'audit_logs')
  );
}

// Mutations

export async function updateOwnProfile(params: {
  actor: UserProfile;
  displayName: string;
  stateCode: string;
  ppa: string;
  department: string;
  phone?: string;
}): Promise<void> {
  const uid = params.actor.uid;
  try {
    await updateDoc(doc(db, 'users', uid), {
      displayName: sanitizeString(params.displayName, 100),
      stateCode: sanitizeString(params.stateCode, 32),
      ppa: sanitizeString(params.ppa, 120),
      department: sanitizeString(params.department, 64),
      updatedAt: serverTimestamp(),
    });
    if (typeof params.phone === 'string') {
      await updateDoc(doc(db, 'users', uid, 'private', 'info'), {
        phone: sanitizeString(params.phone, 32),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
  }
}

export async function createInvitation(params: {
  actor: UserProfile;
  email: string;
  displayName: string;
  role: CanonicalRole;
  cohortId: string;
  cohortName: string;
  assignedCohortIds?: string[];
  partnerId: string;
  partnerName: string;
  stateCode: string;
  ppa: string;
  department?: string;
  phone?: string;
  gender?: string;
  state?: string;
  organisation?: string;
  maxCaseload?: number;
  notes?: string;
}): Promise<string> {
  const inviteCode = sanitizeId(
    `CII-${Math.random().toString(36).slice(2, 6).toUpperCase()}-${Math.random()
      .toString(36)
      .slice(2, 6)
      .toUpperCase()}`
  );
  const cleanAssignedCohortIds = Array.isArray(params.assignedCohortIds)
    ? params.assignedCohortIds.map((id) => sanitizeId(id)).filter(Boolean).slice(0, 20)
    : [];
  const cleanMaxCaseload =
    typeof params.maxCaseload === 'number' && params.maxCaseload > 0
      ? clampNumber(Math.round(params.maxCaseload), 1, 200)
      : params.role === 'partner'
        ? DEFAULT_PARTNER_MAX_CASELOAD
        : 0;

  try {
    await setDoc(doc(db, 'invitations', inviteCode), {
      id: inviteCode,
      email: sanitizeString(params.email.toLowerCase(), 160),
      displayName: sanitizeString(params.displayName, 100),
      role: params.role,
      cohortId: sanitizeString(params.cohortId, 128),
      cohortName: sanitizeString(params.cohortName, 100),
      assignedCohortIds: cleanAssignedCohortIds,
      partnerId: sanitizeString(params.partnerId, 128),
      partnerName: sanitizeString(params.partnerName, 100),
      stateCode: sanitizeString(params.stateCode, 32),
      ppa: sanitizeString(params.ppa, 120),
      department: sanitizeString(
        params.department ||
          params.organisation ||
          (params.role === 'partner' ? 'Accountability Partnership' : ''),
        64
      ),
      phone: sanitizeString(params.phone || '', 32),
      gender: sanitizeString(params.gender || '', 24),
      state: sanitizeString(params.state || '', 48),
      organisation: sanitizeString(params.organisation || '', 120),
      maxCaseload: cleanMaxCaseload,
      notes: sanitizeString(params.notes || '', 500),
      status: 'pending',
      claimedBy: '',
      createdBy: params.actor.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await recordAuditEvent({
      actorId: params.actor.uid,
      actorName: params.actor.displayName,
      actorRole: normalizeRole(params.actor.role),
      action: isAdminPortalRole(params.role)
        ? 'ADMIN_INVITATION_CREATED'
        : params.role === 'partner'
          ? 'PARTNER_INVITATION_CREATED'
          : 'INVITATION_CREATED',
      category: 'rbac',
      severity: isAdminPortalRole(params.role) ? 'critical' : 'info',
      targetType: params.role === 'partner' ? 'partner_invitation' : 'invitation',
      targetId: inviteCode,
      summary: `Issued ${ROLE_LABELS[params.role]} activation invite (${inviteCode}) for ${params.displayName} (${params.email.toLowerCase()}).`,
    });
    return inviteCode;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `invitations/${inviteCode}`);
  }
}

export async function bulkImportPartnerInvitations(params: {
  actor: UserProfile;
  cohortId?: string;
  cohortName?: string;
  rows: Array<{
    fullName: string;
    email: string;
    phone: string;
    gender: string;
    state: string;
    organisation: string;
    maxCaseload: number;
    notes: string;
  }>;
}): Promise<Array<{ inviteCode: string; email: string; displayName: string; maxCaseload: number }>> {
  const { actor, rows } = params;
  const created: Array<{
    inviteCode: string;
    email: string;
    displayName: string;
    maxCaseload: number;
  }> = [];

  try {
    const batch = writeBatch(db);
    for (const row of rows.slice(0, 200)) {
      const inviteCode = sanitizeId(
        `CII-${Math.random().toString(36).slice(2, 6).toUpperCase()}-${Math.random()
          .toString(36)
          .slice(2, 6)
          .toUpperCase()}`
      );
      const cleanEmail = sanitizeString(row.email.trim().toLowerCase(), 160);
      const cleanName = sanitizeString(row.fullName.trim(), 100);
      const cleanCaseload = clampNumber(
        Math.round(row.maxCaseload || DEFAULT_PARTNER_MAX_CASELOAD),
        1,
        200
      );

      batch.set(doc(db, 'invitations', inviteCode), {
        id: inviteCode,
        email: cleanEmail,
        displayName: cleanName,
        role: 'partner',
        cohortId: sanitizeString(params.cohortId || '', 128),
        cohortName: sanitizeString(params.cohortName || '', 100),
        assignedCohortIds: [],
        partnerId: '',
        partnerName: '',
        stateCode: '',
        ppa: '',
        department: sanitizeString(row.organisation || 'Accountability Partnership', 64),
        phone: sanitizeString(row.phone || '', 32),
        gender: sanitizeString(row.gender || '', 24),
        state: sanitizeString(row.state || '', 48),
        organisation: sanitizeString(row.organisation || '', 120),
        maxCaseload: cleanCaseload,
        notes: sanitizeString(row.notes || '', 500),
        status: 'pending',
        claimedBy: '',
        createdBy: actor.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      created.push({
        inviteCode,
        email: cleanEmail,
        displayName: cleanName,
        maxCaseload: cleanCaseload,
      });
    }

    await batch.commit();

    await recordAuditEvent({
      actorId: actor.uid,
      actorName: actor.displayName,
      actorRole: normalizeRole(actor.role),
      action: 'PARTNER_BULK_IMPORTED',
      category: 'rbac',
      severity: 'info',
      targetType: 'partner_import',
      targetId: `batch_${created.length}`,
      summary: `Bulk imported ${created.length} Accountability Partner invitation(s) via spreadsheet upload.`,
    });

    return created;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'invitations/bulk_import');
  }
}

export async function adminUpdatePartnerProfile(params: {
  actor: UserProfile;
  target: UserProfile;
  displayName: string;
  phone: string;
  gender: string;
  state: string;
  organisation: string;
  maxCaseload: number;
  notes: string;
  status: UserStatus;
  cohortId?: string;
  cohortName?: string;
}): Promise<void> {
  const { actor, target } = params;
  const cleanCaseload = clampNumber(
    Math.round(params.maxCaseload || DEFAULT_PARTNER_MAX_CASELOAD),
    1,
    200
  );
  const statusChanged = target.status !== params.status;

  try {
    await updateDoc(doc(db, 'users', target.uid), {
      displayName: sanitizeString(params.displayName, 100),
      role: 'partner',
      status: params.status,
      cohortId: sanitizeString(
        params.cohortId !== undefined ? params.cohortId : target.cohortId,
        128
      ),
      cohortName: sanitizeString(
        params.cohortName !== undefined ? params.cohortName : target.cohortName,
        100
      ),
      phone: sanitizeString(params.phone, 32),
      gender: sanitizeString(params.gender, 24),
      state: sanitizeString(params.state, 48),
      organisation: sanitizeString(params.organisation, 120),
      department: sanitizeString(
        params.organisation || target.department || 'Accountability Partnership',
        64
      ),
      maxCaseload: cleanCaseload,
      notes: sanitizeString(params.notes, 500),
      updatedAt: serverTimestamp(),
    });

    await recordAuditEvent({
      actorId: actor.uid,
      actorName: actor.displayName,
      actorRole: normalizeRole(actor.role),
      action: statusChanged
        ? params.status === 'active'
          ? 'PARTNER_ACTIVATED'
          : 'PARTNER_DEACTIVATED'
        : 'PARTNER_PROFILE_UPDATED',
      category: 'rbac',
      severity: statusChanged ? 'warning' : 'info',
      targetType: 'partner',
      targetId: target.uid,
      summary: statusChanged
        ? `${params.status === 'active' ? 'Activated' : 'Deactivated'} Accountability Partner ${params.displayName} (max caseload: ${cleanCaseload}).`
        : `Updated Accountability Partner ${params.displayName} (max caseload: ${cleanCaseload}, org: ${params.organisation || 'CII'}).`,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${target.uid}`);
  }
}

export async function batchAssignMembersToPartners(params: {
  actor: UserProfile;
  assignments: Array<{
    member: UserProfile;
    partner: UserProfile;
  }>;
  mode: 'manual' | 'auto';
}): Promise<number> {
  const { actor, assignments, mode } = params;
  if (assignments.length === 0) return 0;

  let completed = 0;
  for (const item of assignments) {
    const isReassignment =
      Boolean(item.member.partnerId) && item.member.partnerId !== item.partner.uid;

    await adminUpdateUser({
      actor,
      target: item.member,
      role: 'member',
      status: item.member.status,
      cohortId: item.member.cohortId,
      cohortName: item.member.cohortName,
      partnerId: item.partner.uid,
      partnerName: item.partner.displayName,
      stateCode: item.member.stateCode,
      ppa: item.member.ppa,
      department: item.member.department,
      skipDefaultAuditLog: true,
    });

    await recordAuditEvent({
      actorId: actor.uid,
      actorName: actor.displayName,
      actorRole: normalizeRole(actor.role),
      action:
        mode === 'auto'
          ? 'MEMBER_AUTO_ASSIGNED'
          : isReassignment
            ? 'MEMBER_REASSIGNED_TO_PARTNER'
            : 'MEMBER_ASSIGNED_TO_PARTNER',
      category: 'rbac',
      severity: 'info',
      targetType: 'member_assignment',
      targetId: item.member.uid,
      summary: `${
        mode === 'auto'
          ? 'Auto-assigned'
          : isReassignment
            ? `Reassigned (from ${item.member.partnerName || 'previous partner'})`
            : 'Assigned'
      } Corps Member ${item.member.displayName} to Accountability Partner ${item.partner.displayName}.`,
    });

    completed += 1;
  }

  if (mode === 'auto' && completed > 0) {
    await recordAuditEvent({
      actorId: actor.uid,
      actorName: actor.displayName,
      actorRole: normalizeRole(actor.role),
      action: 'AUTO_ASSIGNMENT_COMPLETED',
      category: 'rbac',
      severity: 'info',
      targetType: 'partner_assignments',
      targetId: `auto_${completed}`,
      summary: `Completed automatic caseload distribution for ${completed} unassigned Corps Member(s).`,
    });
  }

  return completed;
}

export async function fetchUserPrivateInfoMap(
  uids: string[]
): Promise<Record<string, UserPrivateInfo>> {
  const entries = await Promise.all(
    uids.map(async (uid) => {
      try {
        const snap = await getDoc(doc(db, 'users', uid, 'private', 'info'));
        if (snap.exists()) {
          return [uid, snap.data() as UserPrivateInfo] as const;
        }
      } catch {
        // ignore missing or inaccessible private info
      }
      return null;
    })
  );
  const map: Record<string, UserPrivateInfo> = {};
  for (const item of entries) {
    if (item) {
      map[item[0]] = item[1];
    }
  }
  return map;
}

export async function bootstrapOwnerSuperAdmin(actor: UserProfile): Promise<void> {
  try {
    await updateDoc(doc(db, 'users', actor.uid), {
      role: 'super_admin',
      department: 'Programme Administration',
      updatedAt: serverTimestamp(),
    });
    await recordAuditEvent({
      actorId: actor.uid,
      actorName: actor.displayName,
      actorRole: 'super_admin',
      action: 'SUPER_ADMIN_BOOTSTRAPPED',
      category: 'rbac',
      severity: 'critical',
      targetType: 'user',
      targetId: actor.uid,
      summary: `Activated initial Super Admin governance role for ${actor.displayName}.`,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${actor.uid}`);
  }
}

export async function superAdminUpdateAdminAccount(params: {
  actor: UserProfile;
  target: UserProfile;
  displayName: string;
  department: string;
  role: AdminRole;
  status: UserStatus;
  assignedCohortIds: string[];
  activeSuperAdminCount: number;
}): Promise<void> {
  const { actor, target, activeSuperAdminCount } = params;
  const targetIsSuperAdmin = normalizeRole(target.role) === 'super_admin';
  const losingSuperAdmin =
    targetIsSuperAdmin && (params.role !== 'super_admin' || params.status !== 'active');

  if (losingSuperAdmin && target.uid === actor.uid) {
    throw new Error('You cannot demote or deactivate your own Super Admin account.');
  }
  if (losingSuperAdmin && target.status === 'active' && activeSuperAdminCount <= 1) {
    throw new Error('Cannot remove or deactivate the last active Super Admin.');
  }

  const cleanAssignedCohortIds =
    params.role === 'programme_manager' || params.role === 'reviewer'
      ? params.assignedCohortIds.map((id) => sanitizeId(id)).filter(Boolean).slice(0, 20)
      : [];

  try {
    await updateDoc(doc(db, 'users', target.uid), {
      displayName: sanitizeString(params.displayName, 100),
      department: sanitizeString(params.department || 'Programme Administration', 64),
      role: params.role,
      status: params.status,
      assignedCohortIds: cleanAssignedCohortIds,
      updatedAt: serverTimestamp(),
    });

    await sendNotification({
      recipientId: target.uid,
      title: 'Administrative Permissions Updated',
      message: `Your account role is now ${ROLE_LABELS[params.role]} (status: ${params.status}).`,
      type: 'activation',
      linkPath: '/admin',
    });

    await recordAuditEvent({
      actorId: actor.uid,
      actorName: actor.displayName,
      actorRole: normalizeRole(actor.role),
      action:
        normalizeRole(target.role) !== params.role
          ? 'ADMIN_ROLE_CHANGED'
          : target.status !== params.status
            ? 'ADMIN_STATUS_CHANGED'
            : 'ADMIN_ACCOUNT_UPDATED',
      category: 'rbac',
      severity: 'critical',
      targetType: 'user',
      targetId: target.uid,
      summary: `Updated admin ${target.displayName}: role=${ROLE_LABELS[params.role]}, status=${params.status}, scopedCohorts=${cleanAssignedCohortIds.length}.`,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${target.uid}`);
  }
}

export async function superAdminRevokeAdminAccess(params: {
  actor: UserProfile;
  target: UserProfile;
  deactivateAccount: boolean;
  activeSuperAdminCount: number;
}): Promise<void> {
  const { actor, target, deactivateAccount, activeSuperAdminCount } = params;
  const targetIsSuperAdmin = normalizeRole(target.role) === 'super_admin';

  if (target.uid === actor.uid) {
    throw new Error('You cannot revoke your own administrative access.');
  }
  if (targetIsSuperAdmin && target.status === 'active' && activeSuperAdminCount <= 1) {
    throw new Error('Cannot revoke the last active Super Admin account.');
  }

  const nextStatus: UserStatus = deactivateAccount ? 'inactive' : 'active';

  try {
    await updateDoc(doc(db, 'users', target.uid), {
      role: 'member',
      status: nextStatus,
      assignedCohortIds: [],
      department: 'Corps Member',
      updatedAt: serverTimestamp(),
    });

    await sendNotification({
      recipientId: target.uid,
      title: 'Administrative Access Revoked',
      message: deactivateAccount
        ? 'Your administrative privileges have been revoked and your account was deactivated.'
        : 'Your administrative privileges have been revoked. Your account is now a standard Corps Member.',
      type: 'activation',
      linkPath: '/dashboard',
    });

    await recordAuditEvent({
      actorId: actor.uid,
      actorName: actor.displayName,
      actorRole: normalizeRole(actor.role),
      action: 'ADMIN_ACCESS_REVOKED',
      category: 'rbac',
      severity: 'critical',
      targetType: 'user',
      targetId: target.uid,
      summary: `Revoked ${ROLE_LABELS[normalizeRole(target.role)]} access for ${target.displayName} (status=${nextStatus}).`,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${target.uid}`);
  }
}

export async function revokeInvitation(invite: Invitation, actor: UserProfile): Promise<void> {
  try {
    await updateDoc(doc(db, 'invitations', invite.id), {
      status: 'revoked',
      updatedAt: serverTimestamp(),
    });
    await recordAuditEvent({
      actorId: actor.uid,
      actorName: actor.displayName,
      actorRole: normalizeRole(actor.role),
      action: 'INVITATION_REVOKED',
      category: 'rbac',
      severity: 'warning',
      targetType: 'invitation',
      targetId: invite.id,
      summary: `Revoked activation invite ${invite.id} for ${invite.email}.`,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `invitations/${invite.id}`);
  }
}

export async function adminUpdateUser(params: {
  actor: UserProfile;
  target: UserProfile;
  role: CanonicalRole;
  status: UserStatus;
  cohortId: string;
  cohortName: string;
  partnerId: string;
  partnerName: string;
  stateCode: string;
  ppa: string;
  department: string;
  skipDefaultAuditLog?: boolean;
}): Promise<void> {
  const { actor, target } = params;
  try {
    const cleanCohortId = sanitizeString(params.cohortId, 128);
    const cleanPartnerId = sanitizeString(params.partnerId, 128);

    await updateDoc(doc(db, 'users', target.uid), {
      role: params.role,
      status: params.status,
      cohortId: cleanCohortId,
      cohortName: sanitizeString(params.cohortName, 100),
      partnerId: cleanPartnerId,
      partnerName: sanitizeString(params.partnerName, 100),
      stateCode: sanitizeString(params.stateCode, 32),
      ppa: sanitizeString(params.ppa, 120),
      department: sanitizeString(params.department || 'Corps Member', 64),
      updatedAt: serverTimestamp(),
    });

    // Sync member's existing check-ins, submissions, and weekly reports when partner or cohort changes
    if (cleanPartnerId !== target.partnerId || cleanCohortId !== target.cohortId) {
      const scopedMode = isScopedAdminRole(actor.role);
      const subQuery =
        scopedMode && target.cohortId
          ? query(
              collection(db, 'activity_submissions'),
              where('memberId', '==', target.uid),
              where('cohortId', '==', target.cohortId)
            )
          : query(collection(db, 'activity_submissions'), where('memberId', '==', target.uid));
      const checkinQuery =
        scopedMode && target.cohortId
          ? query(
              collection(db, 'daily_checkins'),
              where('memberId', '==', target.uid),
              where('cohortId', '==', target.cohortId)
            )
          : query(collection(db, 'daily_checkins'), where('memberId', '==', target.uid));
      const reportQuery =
        scopedMode && target.cohortId
          ? query(
              collection(db, 'weekly_reports'),
              where('memberId', '==', target.uid),
              where('cohortId', '==', target.cohortId)
            )
          : query(collection(db, 'weekly_reports'), where('memberId', '==', target.uid));

      if (!scopedMode || target.cohortId) {
        const [subsSnap, checkinsSnap, reportsSnap] = await Promise.all([
          getDocs(subQuery),
          getDocs(checkinQuery),
          getDocs(reportQuery),
        ]);
        const docsToUpdate = [...subsSnap.docs, ...checkinsSnap.docs, ...reportsSnap.docs];
        if (docsToUpdate.length > 0) {
          const batch = writeBatch(db);
          for (const d of docsToUpdate.slice(0, 400)) {
            batch.update(d.ref, {
              partnerId: cleanPartnerId,
              cohortId: cleanCohortId,
              updatedAt: serverTimestamp(),
            });
          }
          await batch.commit();
        }
      }
    }

    if (cleanPartnerId && cleanPartnerId !== target.partnerId) {
      await Promise.all([
        sendNotification({
          recipientId: target.uid,
          title: 'Accountability Partner Assigned',
          message: `${params.partnerName} has been assigned as your Accountability Partner.`,
          type: 'partner',
          linkPath: '/dashboard',
        }),
        sendNotification({
          recipientId: cleanPartnerId,
          title: 'New Corps Member Assigned',
          message: `${target.displayName} has been assigned to your Accountability Partner caseload.`,
          type: 'partner',
          linkPath: `/partner/members/${target.uid}`,
        }),
      ]);
    }

    if (!params.skipDefaultAuditLog) {
      await recordAuditEvent({
        actorId: actor.uid,
        actorName: actor.displayName,
        actorRole: normalizeRole(actor.role),
        action: normalizeRole(target.role) !== params.role ? 'ROLE_CHANGED' : 'USER_UPDATED',
        category: 'rbac',
        severity: normalizeRole(target.role) !== params.role || target.status !== params.status ? 'critical' : 'info',
        targetType: 'user',
        targetId: target.uid,
        summary: `Updated ${target.displayName}: role=${params.role}, status=${params.status}, cohort=${params.cohortName || 'None'}, partner=${params.partnerName || 'None'}.`,
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${target.uid}`);
  }
}

export async function saveCohort(params: {
  actor: UserProfile;
  existing?: Cohort | null;
  code: string;
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  status: 'active' | 'archived';
}): Promise<void> {
  const id = params.existing?.id || createDocId('cohort');
  try {
    if (params.existing) {
      await updateDoc(doc(db, 'cohorts', id), {
        code: sanitizeCode(params.code),
        name: sanitizeString(params.name, 100),
        description: sanitizeString(params.description, 500),
        startDate: params.startDate,
        endDate: params.endDate,
        status: params.status,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(doc(db, 'cohorts', id), {
        id,
        code: sanitizeCode(params.code),
        name: sanitizeString(params.name, 100),
        description: sanitizeString(params.description, 500),
        startDate: params.startDate,
        endDate: params.endDate,
        status: params.status,
        createdBy: params.actor.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    await recordAuditEvent({
      actorId: params.actor.uid,
      actorName: params.actor.displayName,
      actorRole: normalizeRole(params.actor.role),
      action: params.existing ? 'COHORT_UPDATED' : 'COHORT_CREATED',
      category: 'cohort',
      severity: 'info',
      targetType: 'cohort',
      targetId: id,
      summary: `${params.existing ? 'Updated' : 'Created'} cohort ${params.code} (${params.name}).`,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `cohorts/${id}`);
  }
}

export async function saveActivity(params: {
  actor: UserProfile;
  existing?: Activity | null;
  code: string;
  title: string;
  description: string;
  instructions: string;
  pillar: InitiativePillar;
  cohortId: string;
  cohortName: string;
  assignmentScope: AssignmentScope;
  assignedMemberIds: string[];
  deadline: string;
  evidenceRequired: boolean;
  reviewRequired: boolean;
  status: ActivityStatus;
  users?: UserProfile[];
}): Promise<string> {
  const id = params.existing?.id || createDocId('act');
  const cleanTitle = sanitizeString(params.title, 140);
  const cleanCode = sanitizeCode(params.code);
  const memberIds = params.assignedMemberIds.slice(0, 50);

  try {
    if (params.existing) {
      await updateDoc(doc(db, 'activities', id), {
        code: cleanCode,
        title: cleanTitle,
        description: sanitizeString(params.description, 1000),
        instructions: sanitizeString(params.instructions, 2000),
        pillar: params.pillar,
        cohortId: sanitizeString(params.cohortId, 128),
        cohortName: sanitizeString(params.cohortName, 100),
        assignmentScope: params.assignmentScope,
        assignedMemberIds: memberIds,
        deadline: params.deadline,
        evidenceRequired: params.evidenceRequired,
        reviewRequired: params.reviewRequired,
        status: params.status,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(doc(db, 'activities', id), {
        id,
        code: cleanCode,
        title: cleanTitle,
        description: sanitizeString(params.description, 1000),
        instructions: sanitizeString(params.instructions, 2000),
        pillar: params.pillar,
        cohortId: sanitizeString(params.cohortId, 128),
        cohortName: sanitizeString(params.cohortName, 100),
        assignmentScope: params.assignmentScope,
        assignedMemberIds: memberIds,
        deadline: params.deadline,
        evidenceRequired: params.evidenceRequired,
        reviewRequired: params.reviewRequired,
        status: params.status,
        createdBy: params.actor.uid,
        createdByName: sanitizeString(params.actor.displayName, 100),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    if (params.status === 'published' && params.users && params.users.length > 0) {
      const targets = params.users.filter((u) => {
        if (normalizeRole(u.role) !== 'member') return false;
        if (params.assignmentScope === 'all') return true;
        if (params.assignmentScope === 'cohort') return u.cohortId === params.cohortId;
        return memberIds.includes(u.uid);
      });
      await Promise.all(
        targets.slice(0, 25).map((u) =>
          sendNotification({
            recipientId: u.uid,
            title: 'New Activity Assigned',
            message: `${cleanCode}: ${cleanTitle} (Due ${params.deadline}).`,
            type: 'activity',
            linkPath: `/activities/${id}`,
          })
        )
      );
    }

    await recordAuditEvent({
      actorId: params.actor.uid,
      actorName: params.actor.displayName,
      actorRole: normalizeRole(params.actor.role),
      action: params.existing ? 'ACTIVITY_UPDATED' : 'ACTIVITY_CREATED',
      category: 'activity',
      severity: 'info',
      targetType: 'activity',
      targetId: id,
      summary: `${params.existing ? 'Updated' : 'Created'} activity ${cleanCode}: "${cleanTitle}" (${params.status}).`,
    });

    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `activities/${id}`);
  }
}

export async function uploadEvidenceFile(
  memberId: string,
  activityId: string,
  file: File
): Promise<{ evidenceUrl: string; evidenceName: string }> {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
  const path = `submissions/${sanitizeId(memberId)}/${sanitizeId(activityId)}/${Date.now()}-${safeName}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file, { contentType: file.type || 'application/octet-stream' });
  const evidenceUrl = await getDownloadURL(storageRef);
  return { evidenceUrl, evidenceName: safeName };
}

export async function saveActivitySubmission(params: {
  actor: UserProfile;
  activity: Activity;
  existing?: ActivitySubmission | null;
  progress: number;
  responseText: string;
  evidenceUrl: string;
  evidenceName: string;
  submitNow: boolean;
}): Promise<void> {
  const subId = params.existing?.id || sanitizeId(`${params.activity.id}_${params.actor.uid}`);
  const status: SubmissionStatus = params.submitNow ? 'submitted' : 'in_progress';
  const progressVal = params.submitNow ? 100 : clampNumber(params.progress, 0, 100);

  const cleanEvidenceUrl = sanitizeString(params.evidenceUrl, 500);
  if (cleanEvidenceUrl && !isSafeHttpUrl(cleanEvidenceUrl)) {
    throw new Error('Evidence URL must start with https:// or http://.');
  }

  try {
    if (params.existing) {
      await updateDoc(doc(db, 'activity_submissions', subId), {
        progress: progressVal,
        responseText: sanitizeString(params.responseText, 2000),
        evidenceUrl: cleanEvidenceUrl,
        evidenceName: sanitizeString(params.evidenceName, 160),
        status,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(doc(db, 'activity_submissions', subId), {
        id: subId,
        activityId: params.activity.id,
        activityTitle: sanitizeString(params.activity.title, 140),
        memberId: params.actor.uid,
        memberName: sanitizeString(params.actor.displayName, 100),
        cohortId: params.actor.cohortId || '',
        partnerId: params.actor.partnerId || '',
        progress: progressVal,
        responseText: sanitizeString(params.responseText, 2000),
        evidenceUrl: cleanEvidenceUrl,
        evidenceName: sanitizeString(params.evidenceName, 160),
        status,
        feedbackText: '',
        reviewedBy: '',
        reviewedByName: '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    if (params.submitNow && params.actor.partnerId) {
      await sendNotification({
        recipientId: params.actor.partnerId,
        title: 'Activity Submission Received',
        message: `${params.actor.displayName} submitted "${params.activity.title}".`,
        type: 'activity',
        linkPath: '/partner/reviews',
      });
    }

    await recordAuditEvent({
      actorId: params.actor.uid,
      actorName: params.actor.displayName,
      actorRole: normalizeRole(params.actor.role),
      action: params.submitNow ? 'ACTIVITY_SUBMITTED' : 'ACTIVITY_PROGRESS_SAVED',
      category: 'activity',
      severity: 'info',
      targetType: 'activity_submission',
      targetId: subId,
      summary: `${params.actor.displayName} ${params.submitNow ? 'submitted' : 'saved progress on'} "${params.activity.title}" (${progressVal}%).`,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `activity_submissions/${subId}`);
  }
}

export async function reviewActivitySubmission(params: {
  actor: UserProfile;
  submission: ActivitySubmission;
  status: 'under_review' | 'revision_requested' | 'approved';
  feedbackText: string;
}): Promise<void> {
  try {
    await updateDoc(doc(db, 'activity_submissions', params.submission.id), {
      status: params.status,
      feedbackText: sanitizeString(params.feedbackText, 1000),
      reviewedBy: params.actor.uid,
      reviewedByName: sanitizeString(params.actor.displayName, 100),
      updatedAt: serverTimestamp(),
    });

    await sendNotification({
      recipientId: params.submission.memberId,
      title:
        params.status === 'revision_requested'
          ? 'Revision Requested on Activity'
          : params.status === 'approved'
            ? 'Activity Submission Approved'
            : 'Activity Submission Under Review',
      message: `${params.actor.displayName} reviewed "${params.submission.activityTitle}".`,
      type: params.status === 'revision_requested' ? 'revision' : 'feedback',
      linkPath: `/activities/${params.submission.activityId}`,
    });

    await recordAuditEvent({
      actorId: params.actor.uid,
      actorName: params.actor.displayName,
      actorRole: normalizeRole(params.actor.role),
      action: 'SUBMISSION_REVIEWED',
      category: 'activity',
      severity: params.status === 'revision_requested' ? 'warning' : 'info',
      targetType: 'activity_submission',
      targetId: params.submission.id,
      summary: `${params.actor.displayName} marked "${params.submission.activityTitle}" for ${params.submission.memberName} as ${params.status}.`,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `activity_submissions/${params.submission.id}`);
  }
}

export async function submitDailyCheckin(params: {
  actor: UserProfile;
  existing?: DailyCheckin | null;
  status: CheckinStatus;
  updateText: string;
  followUpRequested: boolean;
}): Promise<void> {
  const checkinDate = params.existing?.checkinDate || getTodayDateKey();
  const id = params.existing?.id || sanitizeId(`${params.actor.uid}_${checkinDate}`);

  try {
    if (params.existing) {
      await updateDoc(doc(db, 'daily_checkins', id), {
        status: params.status,
        updateText: sanitizeString(params.updateText, 600),
        followUpRequested: params.followUpRequested,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(doc(db, 'daily_checkins', id), {
        id,
        memberId: params.actor.uid,
        memberName: sanitizeString(params.actor.displayName, 100),
        cohortId: params.actor.cohortId || '',
        partnerId: params.actor.partnerId || '',
        checkinDate,
        status: params.status,
        updateText: sanitizeString(params.updateText, 600),
        followUpRequested: params.followUpRequested,
        flaggedForAdmin: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    if ((params.status !== 'on_track' || params.followUpRequested) && params.actor.partnerId) {
      await sendNotification({
        recipientId: params.actor.partnerId,
        title: 'Member Check-In Needs Attention',
        message: `${params.actor.displayName} checked in as "${params.status.replace('_', ' ')}"${params.followUpRequested ? ' and requested a follow-up' : ''}.`,
        type: 'checkin',
        linkPath: `/partner/members/${params.actor.uid}`,
      });
    }

    await recordAuditEvent({
      actorId: params.actor.uid,
      actorName: params.actor.displayName,
      actorRole: normalizeRole(params.actor.role),
      action: params.existing ? 'DAILY_CHECKIN_UPDATED' : 'DAILY_CHECKIN_SUBMITTED',
      category: 'checkin',
      severity: params.status === 'blocked' ? 'warning' : 'info',
      targetType: 'daily_checkin',
      targetId: id,
      summary: `${params.actor.displayName} recorded daily check-in for ${checkinDate} (${params.status}).`,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `daily_checkins/${id}`);
  }
}

export async function flagCheckinForAdmin(
  checkin: DailyCheckin,
  flagged: boolean,
  actor: UserProfile
): Promise<void> {
  try {
    await updateDoc(doc(db, 'daily_checkins', checkin.id), {
      flaggedForAdmin: flagged,
      updatedAt: serverTimestamp(),
    });
    await recordAuditEvent({
      actorId: actor.uid,
      actorName: actor.displayName,
      actorRole: normalizeRole(actor.role),
      action: 'CHECKIN_ESCALATED',
      category: 'checkin',
      severity: flagged ? 'warning' : 'info',
      targetType: 'daily_checkin',
      targetId: checkin.id,
      summary: `${actor.displayName} ${flagged ? 'flagged' : 'cleared'} ${checkin.memberName}'s check-in (${checkin.checkinDate}) for admin attention.`,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `daily_checkins/${checkin.id}`);
  }
}

export async function saveWeeklyReport(params: {
  actor: UserProfile;
  existing?: WeeklyReport | null;
  achievements: string;
  challenges: string;
  learnings: string;
  nextWeekPriorities: string;
  submitNow: boolean;
}): Promise<string> {
  const { weekKey, weekLabel } = getIsoWeekInfo();
  const id = params.existing?.id || sanitizeId(`${params.actor.uid}_${weekKey}`);
  const status: WeeklyReportStatus = params.submitNow ? 'submitted' : 'draft';

  try {
    if (params.existing) {
      await updateDoc(doc(db, 'weekly_reports', id), {
        achievements: sanitizeString(params.achievements, 1500),
        challenges: sanitizeString(params.challenges, 1500),
        learnings: sanitizeString(params.learnings, 1500),
        nextWeekPriorities: sanitizeString(params.nextWeekPriorities, 1500),
        status,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(doc(db, 'weekly_reports', id), {
        id,
        memberId: params.actor.uid,
        memberName: sanitizeString(params.actor.displayName, 100),
        cohortId: params.actor.cohortId || '',
        partnerId: params.actor.partnerId || '',
        weekKey,
        weekLabel,
        achievements: sanitizeString(params.achievements, 1500),
        challenges: sanitizeString(params.challenges, 1500),
        learnings: sanitizeString(params.learnings, 1500),
        nextWeekPriorities: sanitizeString(params.nextWeekPriorities, 1500),
        status,
        feedbackText: '',
        reviewedBy: '',
        reviewedByName: '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    if (params.submitNow && params.actor.partnerId) {
      await sendNotification({
        recipientId: params.actor.partnerId,
        title: 'Weekly Report Submitted',
        message: `${params.actor.displayName} submitted weekly report (${params.existing?.weekLabel || weekLabel}).`,
        type: 'report',
        linkPath: '/partner/reviews',
      });
    }

    await recordAuditEvent({
      actorId: params.actor.uid,
      actorName: params.actor.displayName,
      actorRole: normalizeRole(params.actor.role),
      action: params.submitNow ? 'WEEKLY_REPORT_SUBMITTED' : 'WEEKLY_REPORT_DRAFTED',
      category: 'report',
      severity: 'info',
      targetType: 'weekly_report',
      targetId: id,
      summary: `${params.actor.displayName} ${params.submitNow ? 'submitted' : 'saved draft of'} weekly report (${params.existing?.weekKey || weekKey}).`,
    });

    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `weekly_reports/${id}`);
  }
}

export async function reviewWeeklyReport(params: {
  actor: UserProfile;
  report: WeeklyReport;
  status: 'under_review' | 'revision_requested' | 'reviewed';
  feedbackText: string;
}): Promise<void> {
  try {
    await updateDoc(doc(db, 'weekly_reports', params.report.id), {
      status: params.status,
      feedbackText: sanitizeString(params.feedbackText, 1000),
      reviewedBy: params.actor.uid,
      reviewedByName: sanitizeString(params.actor.displayName, 100),
      updatedAt: serverTimestamp(),
    });

    await sendNotification({
      recipientId: params.report.memberId,
      title:
        params.status === 'revision_requested'
          ? 'Weekly Report Revision Requested'
          : 'Weekly Report Reviewed',
      message: `${params.actor.displayName} reviewed your ${params.report.weekLabel} report.`,
      type: params.status === 'revision_requested' ? 'revision' : 'feedback',
      linkPath: `/weekly-reports/${params.report.id}`,
    });

    await recordAuditEvent({
      actorId: params.actor.uid,
      actorName: params.actor.displayName,
      actorRole: normalizeRole(params.actor.role),
      action: 'WEEKLY_REPORT_REVIEWED',
      category: 'report',
      severity: params.status === 'revision_requested' ? 'warning' : 'info',
      targetType: 'weekly_report',
      targetId: params.report.id,
      summary: `${params.actor.displayName} updated ${params.report.memberName}'s ${params.report.weekKey} report to ${params.status}.`,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `weekly_reports/${params.report.id}`);
  }
}

export async function createFollowUp(params: {
  actor: UserProfile;
  member: UserProfile;
  sourceType: FollowUpSource;
  sourceId: string;
  note: string;
  actionTaken: string;
  flaggedForAdmin: boolean;
}): Promise<void> {
  const id = createDocId('fu');
  try {
    await setDoc(doc(db, 'follow_ups', id), {
      id,
      partnerId: params.actor.uid,
      partnerName: sanitizeString(params.actor.displayName, 100),
      memberId: params.member.uid,
      memberName: sanitizeString(params.member.displayName, 100),
      sourceType: params.sourceType,
      sourceId: sanitizeString(params.sourceId, 128),
      note: sanitizeString(params.note, 800),
      actionTaken: sanitizeString(params.actionTaken, 800),
      status: 'open',
      flaggedForAdmin: params.flaggedForAdmin,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await sendNotification({
      recipientId: params.member.uid,
      title: 'Accountability Follow-Up Logged',
      message: `${params.actor.displayName} logged a follow-up action for you.`,
      type: 'partner',
      linkPath: '/dashboard',
    });

    await recordAuditEvent({
      actorId: params.actor.uid,
      actorName: params.actor.displayName,
      actorRole: normalizeRole(params.actor.role),
      action: 'FOLLOW_UP_CREATED',
      category: 'checkin',
      severity: params.flaggedForAdmin ? 'warning' : 'info',
      targetType: 'follow_up',
      targetId: id,
      summary: `${params.actor.displayName} created follow-up for ${params.member.displayName}${params.flaggedForAdmin ? ' (flagged for admin)' : ''}.`,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `follow_ups/${id}`);
  }
}

export async function updateFollowUpStatus(
  followUp: FollowUp,
  status: FollowUpStatus,
  actionTaken: string,
  flaggedForAdmin: boolean,
  actor: UserProfile
): Promise<void> {
  try {
    await updateDoc(doc(db, 'follow_ups', followUp.id), {
      status,
      actionTaken: sanitizeString(actionTaken, 800),
      flaggedForAdmin,
      updatedAt: serverTimestamp(),
    });
    await recordAuditEvent({
      actorId: actor.uid,
      actorName: actor.displayName,
      actorRole: normalizeRole(actor.role),
      action: 'FOLLOW_UP_UPDATED',
      category: 'checkin',
      severity: 'info',
      targetType: 'follow_up',
      targetId: followUp.id,
      summary: `Updated follow-up for ${followUp.memberName} to ${status}.`,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `follow_ups/${followUp.id}`);
  }
}

export async function createAnnouncement(params: {
  actor: UserProfile;
  title: string;
  body: string;
  targetRole: AnnouncementTarget;
  cohortId: string;
  priority: 'normal' | 'important';
  users?: UserProfile[];
}): Promise<void> {
  const id = createDocId('ann');
  try {
    await setDoc(doc(db, 'announcements', id), {
      id,
      title: sanitizeString(params.title, 140),
      body: sanitizeString(params.body, 1500),
      targetRole: params.targetRole,
      cohortId: sanitizeString(params.cohortId, 128),
      priority: params.priority,
      createdBy: params.actor.uid,
      createdByName: sanitizeString(params.actor.displayName, 100),
      createdAt: serverTimestamp(),
    });

    if (params.users && params.users.length > 0) {
      const targets = params.users.filter((u) => {
        if (u.uid === params.actor.uid) return false;
        if (params.targetRole !== 'all' && normalizeRole(u.role) !== params.targetRole) return false;
        if (params.cohortId && u.cohortId !== params.cohortId) return false;
        return true;
      });
      await Promise.all(
        targets.slice(0, 30).map((u) =>
          sendNotification({
            recipientId: u.uid,
            title: `Announcement: ${params.title}`,
            message: params.body.slice(0, 180),
            type: 'announcement',
            linkPath:
              normalizeRole(u.role) === 'partner' ? '/partner' : '/dashboard',
          })
        )
      );
    }

    await recordAuditEvent({
      actorId: params.actor.uid,
      actorName: params.actor.displayName,
      actorRole: normalizeRole(params.actor.role),
      action: 'ANNOUNCEMENT_PUBLISHED',
      category: 'announcement',
      severity: params.priority === 'important' ? 'warning' : 'info',
      targetType: 'announcement',
      targetId: id,
      summary: `Published announcement "${params.title}" to ${params.targetRole}.`,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `announcements/${id}`);
  }
}

export async function deleteAnnouncement(item: Announcement, actor: UserProfile): Promise<void> {
  try {
    await deleteDoc(doc(db, 'announcements', item.id));
    await recordAuditEvent({
      actorId: actor.uid,
      actorName: actor.displayName,
      actorRole: normalizeRole(actor.role),
      action: 'ANNOUNCEMENT_DELETED',
      category: 'announcement',
      severity: 'warning',
      targetType: 'announcement',
      targetId: item.id,
      summary: `Removed announcement "${item.title}".`,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `announcements/${item.id}`);
  }
}

export async function markNotificationRead(id: string): Promise<void> {
  try {
    await updateDoc(doc(db, 'notifications', id), { read: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `notifications/${id}`);
  }
}

export async function markAllNotificationsRead(items: NotificationItem[]): Promise<void> {
  const unread = items.filter((n) => !n.read);
  if (unread.length === 0) return;
  const batch = writeBatch(db);
  for (const n of unread.slice(0, 50)) {
    batch.update(doc(db, 'notifications', n.id), { read: true });
  }
  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, 'notifications');
  }
}

export async function saveProgrammeSettings(params: {
  actor: UserProfile;
  partnerCanApproveReports: boolean;
  weeklyReportDueDay: string;
  inactivityThresholdDays: number;
  emailProviderNote: string;
}): Promise<void> {
  try {
    await setDoc(doc(db, 'settings', 'programme'), {
      id: 'programme',
      partnerCanApproveReports: params.partnerCanApproveReports,
      weeklyReportDueDay: sanitizeString(params.weeklyReportDueDay, 24),
      inactivityThresholdDays: clampNumber(params.inactivityThresholdDays, 1, 30),
      emailProviderNote: sanitizeString(params.emailProviderNote, 300),
      updatedBy: params.actor.uid,
      updatedAt: serverTimestamp(),
    });
    await recordAuditEvent({
      actorId: params.actor.uid,
      actorName: params.actor.displayName,
      actorRole: normalizeRole(params.actor.role),
      action: 'SETTINGS_UPDATED',
      category: 'settings',
      severity: 'warning',
      targetType: 'settings',
      targetId: 'programme',
      summary: `Updated programme governance settings (partner approval: ${params.partnerCanApproveReports ? 'enabled' : 'disabled'}).`,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'settings/programme');
  }
}

export async function seedCiiProgrammeData(actor: UserProfile): Promise<void> {
  const batch = writeBatch(db);

  const cohort1Id = 'cohort-cii-2026-b1';
  const cohort2Id = 'cohort-cii-2026-b2';

  batch.set(doc(db, 'cohorts', cohort1Id), {
    id: cohort1Id,
    code: 'CII-2026-B1',
    name: '2026 Batch A · National Impact Cohort',
    description: 'Primary Corps Members cohort focused on community development, digital literacy, and civic accountability.',
    startDate: '2026-10-01',
    endDate: '2027-03-31',
    status: 'active',
    createdBy: actor.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  batch.set(doc(db, 'cohorts', cohort2Id), {
    id: cohort2Id,
    code: 'CII-2026-B2',
    name: '2026 Batch B · Regional Sustainability Track',
    description: 'Regional sustainability and infrastructure outreach Corps Members track.',
    startDate: '2026-11-01',
    endDate: '2027-04-30',
    status: 'active',
    createdBy: actor.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  const activitiesData: Array<{
    id: string;
    code: string;
    title: string;
    description: string;
    instructions: string;
    pillar: InitiativePillar;
    cohortId: string;
    cohortName: string;
    assignmentScope: AssignmentScope;
    deadline: string;
    evidenceRequired: boolean;
    reviewRequired: boolean;
  }> = [
    {
      id: 'act-cii-orientation',
      code: 'CII-ACT-01',
      title: 'PPA Impact Baseline Assessment & Action Charter',
      description: 'Document your Place of Primary Assignment (PPA) community needs and submit a 90-day impact charter.',
      instructions: '1. Meet with your PPA supervisor. 2. Identify two measurable community needs. 3. Upload your signed baseline assessment PDF or photo evidence.',
      pillar: 'Governance',
      cohortId: '',
      cohortName: 'All Cohorts',
      assignmentScope: 'all',
      deadline: '2026-12-10',
      evidenceRequired: true,
      reviewRequired: true,
    },
    {
      id: 'act-cii-community',
      code: 'CII-ACT-02',
      title: 'Community Literacy & Civic Outreach Workshop',
      description: 'Organize or co-facilitate a local outreach workshop for secondary students or community youth.',
      instructions: 'Record attendance figures, key topics covered, and upload supporting photos or attendance sheet.',
      pillar: 'Community',
      cohortId: cohort1Id,
      cohortName: '2026 Batch A · National Impact Cohort',
      assignmentScope: 'all',
      deadline: '2026-12-20',
      evidenceRequired: true,
      reviewRequired: true,
    },
    {
      id: 'act-cii-sustainability',
      code: 'CII-ACT-03',
      title: 'Environmental Sanitation & Waste Audit Drive',
      description: 'Coordinate a local environmental sanitation exercise and document measurable waste reduction.',
      instructions: 'Submit a brief summary of volunteers engaged and key outcomes achieved.',
      pillar: 'Sustainability',
      cohortId: cohort2Id,
      cohortName: '2026 Batch B · Regional Sustainability Track',
      assignmentScope: 'all',
      deadline: '2026-12-28',
      evidenceRequired: false,
      reviewRequired: true,
    },
    {
      id: 'act-cii-security',
      code: 'CII-ACT-04',
      title: 'Mid-Quarter Safeguarding & Compliance Attestation',
      description: 'Complete CII code of conduct and safeguarding verification checklist.',
      instructions: 'Confirm adherence to CII safeguarding standards and state any operational support needed.',
      pillar: 'Security',
      cohortId: '',
      cohortName: 'All Cohorts',
      assignmentScope: 'all',
      deadline: '2026-12-15',
      evidenceRequired: false,
      reviewRequired: false,
    },
  ];

  for (const act of activitiesData) {
    batch.set(doc(db, 'activities', act.id), {
      ...act,
      assignedMemberIds: [],
      status: 'published',
      createdBy: actor.uid,
      createdByName: sanitizeString(actor.displayName, 100),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  const annId = 'ann-cii-welcome';
  batch.set(doc(db, 'announcements', annId), {
    id: annId,
    title: 'Q4 CII Accountability Cycle Now Open',
    body: 'All Corps Members should complete daily status check-ins before 6:00 PM and submit weekly accountability reports every Friday. Accountability Partners are reviewing baseline action charters this week.',
    targetRole: 'all',
    cohortId: '',
    priority: 'important',
    createdBy: actor.uid,
    createdByName: sanitizeString(actor.displayName, 100),
    createdAt: serverTimestamp(),
  });

  batch.set(doc(db, 'settings', 'programme'), {
    id: 'programme',
    partnerCanApproveReports: true,
    weeklyReportDueDay: 'Friday',
    inactivityThresholdDays: 3,
    emailProviderNote: 'Configure Firebase Extensions / SMTP webhook in production to dispatch automated invitation and deadline emails.',
    updatedBy: actor.uid,
    updatedAt: serverTimestamp(),
  });

  const logId = createDocId('log');
  batch.set(doc(db, 'audit_logs', logId), {
    id: logId,
    actorId: actor.uid,
    actorName: sanitizeString(actor.displayName, 100),
    actorRole: normalizeRole(actor.role),
    action: 'PROGRAMME_INITIALIZED',
    category: 'settings',
    severity: 'info',
    targetType: 'system',
    targetId: 'programme',
    summary: 'Initialized baseline CII cohorts, published activities, announcement, and governance settings.',
    createdAt: serverTimestamp(),
  });

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'cohorts');
  }
}
