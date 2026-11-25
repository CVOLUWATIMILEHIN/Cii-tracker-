import { Timestamp } from 'firebase/firestore';

export type ProfileCategory =
  | 'student'
  | 'employed'
  | 'self_employed'
  | 'coach'
  | 'organisation'
  | 'other';

export type OnboardingPath =
  | 'know_goal'
  | 'need_clarity'
  | 'join_community'
  | 'coach'
  | 'business'
  | 'skipped';

export type WorkspaceType = 'individual' | 'community' | 'coach' | 'business';
export type WorkspaceRole =
  | 'owner'
  | 'member'
  | 'coach'
  | 'client'
  | 'collaborator'
  | 'accountability_partner';

export type GoalCategory =
  | 'Personal Development'
  | 'Career'
  | 'Business'
  | 'Finance'
  | 'Education'
  | 'Health and Lifestyle'
  | 'Relationships'
  | 'Spiritual Growth'
  | 'Custom';

export type GoalHorizon = 1 | 3 | 6 | 12;
export type GoalStatus = 'active' | 'paused' | 'completed' | 'archived';
export type MilestoneStatus = 'pending' | 'in_progress' | 'completed';
export type TaskStatus = 'not_started' | 'in_progress' | 'completed' | 'blocked' | 'rescheduled';
export type TaskPriority = 'low' | 'medium' | 'high';
export type TaskRecurrence = 'none' | 'daily' | 'weekly' | 'monthly';

export interface Workspace {
  id: string;
  type: WorkspaceType;
  name: string;
  ownerId: string;
  status: 'active' | 'archived';
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface WorkspaceMembership {
  id: string;
  workspaceId: string;
  uid: string;
  role: WorkspaceRole;
  status: 'active' | 'removed';
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface Goal {
  id: string;
  ownerId: string;
  workspaceId: string;
  title: string;
  category: GoalCategory;
  why: string;
  baseline: string;
  targetOutcome: string;
  successCriteria: string;
  horizonMonths: GoalHorizon;
  startDate: string;
  targetDate: string;
  status: GoalStatus;
  progress: number;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface Milestone {
  id: string;
  goalId: string;
  ownerId: string;
  title: string;
  dueDate: string;
  status: MilestoneStatus;
  order: number;
  completedAt: Timestamp | null;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface PlannerTask {
  id: string;
  ownerId: string;
  workspaceId: string;
  goalId: string;
  milestoneId: string;
  title: string;
  description: string;
  dueDate: string;
  priority: TaskPriority;
  status: TaskStatus;
  blockedReason: string;
  rescheduleReason: string;
  recurrence: TaskRecurrence;
  reminderAt: string;
  completedAt: Timestamp | null;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export const GOAL_CATEGORIES: GoalCategory[] = [
  'Personal Development',
  'Career',
  'Business',
  'Finance',
  'Education',
  'Health and Lifestyle',
  'Relationships',
  'Spiritual Growth',
  'Custom',
];

export const GOAL_HORIZONS: GoalHorizon[] = [1, 3, 6, 12];

export const PROFILE_CATEGORY_LABELS: Record<ProfileCategory, string> = {
  student: 'Student',
  employed: 'Employed',
  self_employed: 'Self-employed / Business Owner',
  coach: 'Coach / Mentor',
  organisation: 'Organisation Representative',
  other: 'Other',
};

export const ONBOARDING_PATH_LABELS: Record<OnboardingPath, string> = {
  know_goal: 'I know what I want to achieve',
  need_clarity: 'I need help finding clarity',
  join_community: 'I am joining a community or programme',
  coach: 'I am a coach or mentor',
  business: 'I am a business owner',
  skipped: 'Skipped for now',
};

export const GOAL_STATUS_LABELS: Record<GoalStatus, string> = {
  active: 'Active',
  paused: 'Paused',
  completed: 'Completed',
  archived: 'Archived',
};

export const MILESTONE_STATUS_LABELS: Record<MilestoneStatus, string> = {
  pending: 'Pending',
  in_progress: 'In Progress',
  completed: 'Completed',
};

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  not_started: 'Not Started',
  in_progress: 'In Progress',
  completed: 'Completed',
  blocked: 'Blocked',
  rescheduled: 'Rescheduled',
};

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
};

export function addMonthsToDateKey(startDate: string, months: number): string {
  const [y, m, d] = startDate.split('-').map(Number);
  if (!y || !m || !d) return startDate;
  const base = new Date(Date.UTC(y, m - 1, d));
  base.setUTCMonth(base.getUTCMonth() + months);
  return base.toISOString().slice(0, 10);
}

export function progressTone(value: number): string {
  if (value >= 75) return 'text-emerald-600 dark:text-emerald-400';
  if (value >= 40) return 'text-amber-600 dark:text-amber-400';
  return 'text-rose-600 dark:text-rose-400';
}
