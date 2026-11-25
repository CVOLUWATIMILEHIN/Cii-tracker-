import { Timestamp } from 'firebase/firestore';
import type { OnboardingPath, ProfileCategory } from './platformTypes';

export type AdminRole = 'super_admin' | 'admin' | 'programme_manager' | 'reviewer';
export type CanonicalRole = AdminRole | 'partner' | 'member';
export type StoredRole = CanonicalRole | 'editor' | 'user';
export type UserStatus = 'active' | 'inactive' | 'suspended' | 'pending';

export type InitiativePillar =
  | 'Governance'
  | 'Infrastructure'
  | 'Sustainability'
  | 'Community'
  | 'Security';

export type ActivityStatus = 'draft' | 'published' | 'archived';
export type AssignmentScope = 'all' | 'cohort' | 'selected';
export type SubmissionStatus =
  | 'in_progress'
  | 'submitted'
  | 'under_review'
  | 'revision_requested'
  | 'approved';

export type CheckinStatus = 'on_track' | 'need_support' | 'blocked';
export type WeeklyReportStatus =
  | 'draft'
  | 'submitted'
  | 'under_review'
  | 'revision_requested'
  | 'reviewed';

export type FollowUpStatus = 'open' | 'resolved';
export type FollowUpSource = 'checkin' | 'report' | 'manual';

export type AnnouncementTarget = 'all' | 'member' | 'partner';
export type NotificationType =
  | 'activation'
  | 'activity'
  | 'deadline'
  | 'checkin'
  | 'report'
  | 'feedback'
  | 'revision'
  | 'announcement'
  | 'partner';

export type AuditCategory =
  | 'auth'
  | 'activity'
  | 'checkin'
  | 'report'
  | 'rbac'
  | 'cohort'
  | 'announcement'
  | 'export'
  | 'settings';

export type AuditSeverity = 'info' | 'warning' | 'critical';

export const DEFAULT_PARTNER_MAX_CASELOAD = 10;

export interface UserProfile {
  uid: string;
  displayName: string;
  role: StoredRole;
  status: UserStatus;
  cohortId: string;
  cohortName: string;
  assignedCohortIds: string[];
  partnerId: string;
  partnerName: string;
  stateCode: string;
  ppa: string;
  department: string;
  inviteCode: string;
  phone?: string;
  gender?: string;
  state?: string;
  organisation?: string;
  maxCaseload?: number;
  notes?: string;
  country?: string;
  profileCategory?: ProfileCategory | '';
  onboardingPath?: OnboardingPath | '';
  onboardingCompletedAt?: Timestamp | null;
  lastLoginAt: Timestamp | null;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface UserPrivateInfo {
  uid: string;
  email: string;
  phone: string;
  lastActiveAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface Invitation {
  id: string;
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
  status: 'pending' | 'claimed' | 'revoked';
  claimedBy: string;
  createdBy: string;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface Cohort {
  id: string;
  code: string;
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  status: 'active' | 'archived';
  createdBy: string;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface Activity {
  id: string;
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
  createdBy: string;
  createdByName: string;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface ActivitySubmission {
  id: string;
  activityId: string;
  activityTitle: string;
  memberId: string;
  memberName: string;
  cohortId: string;
  partnerId: string;
  progress: number;
  responseText: string;
  evidenceUrl: string;
  evidenceName: string;
  status: SubmissionStatus;
  feedbackText: string;
  reviewedBy: string;
  reviewedByName: string;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface DailyCheckin {
  id: string;
  memberId: string;
  memberName: string;
  cohortId: string;
  partnerId: string;
  checkinDate: string;
  status: CheckinStatus;
  updateText: string;
  followUpRequested: boolean;
  flaggedForAdmin: boolean;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface WeeklyReport {
  id: string;
  memberId: string;
  memberName: string;
  cohortId: string;
  partnerId: string;
  weekKey: string;
  weekLabel: string;
  achievements: string;
  challenges: string;
  learnings: string;
  nextWeekPriorities: string;
  status: WeeklyReportStatus;
  feedbackText: string;
  reviewedBy: string;
  reviewedByName: string;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface FollowUp {
  id: string;
  partnerId: string;
  partnerName: string;
  memberId: string;
  memberName: string;
  sourceType: FollowUpSource;
  sourceId: string;
  note: string;
  actionTaken: string;
  status: FollowUpStatus;
  flaggedForAdmin: boolean;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface Announcement {
  id: string;
  title: string;
  body: string;
  targetRole: AnnouncementTarget;
  cohortId: string;
  priority: 'normal' | 'important';
  createdBy: string;
  createdByName: string;
  createdAt: Timestamp | null;
}

export interface NotificationItem {
  id: string;
  recipientId: string;
  title: string;
  message: string;
  type: NotificationType;
  linkPath: string;
  read: boolean;
  createdAt: Timestamp | null;
}

export interface ProgrammeSettings {
  id: string;
  partnerCanApproveReports: boolean;
  weeklyReportDueDay: string;
  inactivityThresholdDays: number;
  emailProviderNote: string;
  updatedBy: string;
  updatedAt: Timestamp | null;
}

export interface AuditLog {
  id: string;
  actorId: string;
  actorName: string;
  actorRole: StoredRole;
  action: string;
  category: AuditCategory;
  severity: AuditSeverity;
  targetType: string;
  targetId: string;
  summary: string;
  createdAt: Timestamp | null;
}

export const ADMIN_ROLES: AdminRole[] = [
  'super_admin',
  'admin',
  'programme_manager',
  'reviewer',
];

export function normalizeRole(role?: string | null): CanonicalRole {
  if (role === 'super_admin') return 'super_admin';
  if (role === 'admin') return 'admin';
  if (role === 'programme_manager') return 'programme_manager';
  if (role === 'reviewer') return 'reviewer';
  if (role === 'partner' || role === 'editor') return 'partner';
  return 'member';
}

export function isAdminPortalRole(role?: string | null): boolean {
  const normalized = normalizeRole(role);
  return ADMIN_ROLES.includes(normalized as AdminRole);
}

export function isSuperAdminRole(role?: string | null): boolean {
  return normalizeRole(role) === 'super_admin';
}

export function isFullAdminRole(role?: string | null): boolean {
  const normalized = normalizeRole(role);
  return normalized === 'super_admin' || normalized === 'admin';
}

export function isScopedAdminRole(role?: string | null): boolean {
  const normalized = normalizeRole(role);
  return normalized === 'programme_manager' || normalized === 'reviewer';
}

export function canManageParticipants(role?: string | null): boolean {
  const normalized = normalizeRole(role);
  return (
    normalized === 'super_admin' ||
    normalized === 'admin' ||
    normalized === 'programme_manager'
  );
}

export function canManageCohorts(role?: string | null): boolean {
  const normalized = normalizeRole(role);
  return (
    normalized === 'super_admin' ||
    normalized === 'admin' ||
    normalized === 'programme_manager'
  );
}

export function canManageActivities(role?: string | null): boolean {
  const normalized = normalizeRole(role);
  return (
    normalized === 'super_admin' ||
    normalized === 'admin' ||
    normalized === 'programme_manager'
  );
}

export function canManageAdminUsers(role?: string | null): boolean {
  return normalizeRole(role) === 'super_admin';
}

export function canManageProgrammeSettings(role?: string | null): boolean {
  return normalizeRole(role) === 'super_admin';
}

export function getDashboardPathForRole(role: CanonicalRole): string {
  if (isAdminPortalRole(role)) return '/admin';
  if (role === 'partner') return '/partner';
  return '/dashboard';
}

export const PILLARS: InitiativePillar[] = [
  'Governance',
  'Infrastructure',
  'Sustainability',
  'Community',
  'Security',
];

export const ROLE_LABELS: Record<CanonicalRole, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  programme_manager: 'Programme Manager',
  reviewer: 'Reviewer',
  partner: 'Accountability Partner',
  member: 'Corps Member',
};

export const ADMIN_ROLE_DESCRIPTIONS: Record<AdminRole, string> = {
  super_admin:
    'Full system access, administrator provisioning, role revocation, and programme governance settings.',
  admin:
    'Manages Corps Members, Accountability Partners, cohorts, activities, reviews, and programme analytics.',
  programme_manager:
    'Manages assigned cohorts, participants, partners, and activities strictly within assigned programme scope.',
  reviewer:
    'Views assigned participants and reviews activity submissions and weekly reports with feedback only.',
};

export const SUBMISSION_STATUS_LABELS: Record<SubmissionStatus, string> = {
  in_progress: 'In Progress',
  submitted: 'Submitted',
  under_review: 'Under Review',
  revision_requested: 'Revision Requested',
  approved: 'Approved',
};

export const REPORT_STATUS_LABELS: Record<WeeklyReportStatus, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  under_review: 'Under Review',
  revision_requested: 'Revision Requested',
  reviewed: 'Reviewed',
};

export const CHECKIN_STATUS_LABELS: Record<CheckinStatus, string> = {
  on_track: 'On Track',
  need_support: 'Need Support',
  blocked: 'Blocked',
};
