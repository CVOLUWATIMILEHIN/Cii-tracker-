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
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { clampNumber, sanitizeId, sanitizeString } from '../lib/validators';
import {
  Goal,
  GoalCategory,
  GoalHorizon,
  GoalStatus,
  Milestone,
  MilestoneStatus,
  OnboardingPath,
  PlannerTask,
  ProfileCategory,
  TaskPriority,
  TaskRecurrence,
  TaskStatus,
  Workspace,
  WorkspaceMembership,
} from '../platformTypes';
import { UserProfile } from '../types';
import { createDocId, getMillis } from './ciiService';

function workspaceName(displayName: string): string {
  const first = displayName.trim().split(/\s+/)[0];
  return sanitizeString(first ? `${first}'s Workspace` : 'My Workspace', 100);
}

export function personalWorkspaceId(uid: string): string {
  return sanitizeId(`ws-${uid}`);
}

function normalizeWorkspace(raw: Partial<Workspace>): Workspace {
  return {
    id: raw.id || '',
    type: raw.type || 'individual',
    name: raw.name || 'My Workspace',
    ownerId: raw.ownerId || '',
    status: raw.status || 'active',
    createdAt: raw.createdAt || null,
    updatedAt: raw.updatedAt || null,
  };
}

export async function ensurePersonalWorkspace(
  actor: Pick<UserProfile, 'uid' | 'displayName'>
): Promise<Workspace> {
  const uid = sanitizeId(actor.uid);
  const workspaceId = personalWorkspaceId(uid);
  const workspaceRef = doc(db, 'workspaces', workspaceId);
  const membershipId = sanitizeId(`${workspaceId}_${uid}`);
  const membershipRef = doc(db, 'workspace_members', membershipId);

  try {
    const snap = await getDoc(workspaceRef);
    if (!snap.exists()) {
      await setDoc(workspaceRef, {
        id: workspaceId,
        type: 'individual',
        name: workspaceName(actor.displayName || ''),
        ownerId: uid,
        status: 'active',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    const memberSnap = await getDoc(membershipRef);
    if (!memberSnap.exists()) {
      await setDoc(membershipRef, {
        id: membershipId,
        workspaceId,
        uid,
        role: 'owner',
        status: 'active',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    const latest = await getDoc(workspaceRef);
    return normalizeWorkspace(latest.data() as Partial<Workspace>);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `workspaces/${workspaceId}`);
  }
}

export function subscribeToWorkspaces(
  uid: string,
  onData: (items: Workspace[]) => void
): Unsubscribe {
  return onSnapshot(
    query(collection(db, 'workspaces'), where('ownerId', '==', uid)),
    (snap) => {
      onData(snap.docs.map((d) => normalizeWorkspace(d.data() as Partial<Workspace>)));
    },
    (error) => handleFirestoreError(error, OperationType.LIST, 'workspaces')
  );
}

export function subscribeToMemberships(
  uid: string,
  onData: (items: WorkspaceMembership[]) => void
): Unsubscribe {
  return onSnapshot(
    query(collection(db, 'workspace_members'), where('uid', '==', uid)),
    (snap) => {
      onData(snap.docs.map((d) => d.data() as WorkspaceMembership));
    },
    (error) => handleFirestoreError(error, OperationType.LIST, 'workspace_members')
  );
}

export function subscribeToGoals(uid: string, onData: (items: Goal[]) => void): Unsubscribe {
  return onSnapshot(
    query(collection(db, 'goals'), where('ownerId', '==', uid)),
    (snap) => {
      const items = snap.docs.map((d) => d.data() as Goal);
      items.sort((a, b) => getMillis(b.updatedAt) - getMillis(a.updatedAt));
      onData(items);
    },
    (error) => handleFirestoreError(error, OperationType.LIST, 'goals')
  );
}

export function subscribeToMilestones(
  uid: string,
  onData: (items: Milestone[]) => void
): Unsubscribe {
  return onSnapshot(
    query(collection(db, 'goal_milestones'), where('ownerId', '==', uid)),
    (snap) => {
      const items = snap.docs.map((d) => d.data() as Milestone);
      items.sort((a, b) => a.order - b.order || a.dueDate.localeCompare(b.dueDate));
      onData(items);
    },
    (error) => handleFirestoreError(error, OperationType.LIST, 'goal_milestones')
  );
}

export function subscribeToTasks(uid: string, onData: (items: PlannerTask[]) => void): Unsubscribe {
  return onSnapshot(
    query(collection(db, 'planner_tasks'), where('ownerId', '==', uid)),
    (snap) => {
      const items = snap.docs.map((d) => d.data() as PlannerTask);
      items.sort((a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999'));
      onData(items);
    },
    (error) => handleFirestoreError(error, OperationType.LIST, 'planner_tasks')
  );
}

export interface GoalInput {
  title: string;
  category: GoalCategory;
  why: string;
  baseline: string;
  targetOutcome: string;
  successCriteria: string;
  horizonMonths: GoalHorizon;
  startDate: string;
  targetDate: string;
}

function goalPayload(actor: UserProfile, workspaceId: string, values: GoalInput) {
  return {
    ownerId: sanitizeId(actor.uid),
    workspaceId: sanitizeId(workspaceId),
    title: sanitizeString(values.title, 140),
    category: values.category,
    why: sanitizeString(values.why, 1000),
    baseline: sanitizeString(values.baseline, 1000),
    targetOutcome: sanitizeString(values.targetOutcome, 1000),
    successCriteria: sanitizeString(values.successCriteria, 1000),
    horizonMonths: values.horizonMonths,
    startDate: values.startDate,
    targetDate: values.targetDate,
  };
}

export async function saveGoal(params: {
  actor: UserProfile;
  workspaceId: string;
  goalId?: string;
  values: GoalInput;
}): Promise<string> {
  if (!params.workspaceId) {
    throw new Error('Your personal workspace is still loading. Please try again.');
  }
  const payload = goalPayload(params.actor, params.workspaceId, params.values);
  try {
    if (params.goalId) {
      await updateDoc(doc(db, 'goals', params.goalId), {
        ...payload,
        updatedAt: serverTimestamp(),
      });
      return params.goalId;
    }
    const id = createDocId('goal');
    await setDoc(doc(db, 'goals', id), {
      ...payload,
      id,
      status: 'active' as GoalStatus,
      progress: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'goals');
  }
}

export async function updateGoalStatus(goal: Goal, status: GoalStatus): Promise<void> {
  try {
    await updateDoc(doc(db, 'goals', goal.id), {
      status,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `goals/${goal.id}`);
  }
}

export async function saveMilestone(params: {
  actor: UserProfile;
  goalId: string;
  milestoneId?: string;
  title: string;
  dueDate: string;
  order: number;
}): Promise<void> {
  const payload = {
    ownerId: sanitizeId(params.actor.uid),
    goalId: sanitizeId(params.goalId),
    title: sanitizeString(params.title, 120),
    dueDate: params.dueDate,
    order: clampNumber(params.order, 0, 500),
  };
  try {
    if (params.milestoneId) {
      await updateDoc(doc(db, 'goal_milestones', params.milestoneId), {
        ...payload,
        updatedAt: serverTimestamp(),
      });
      return;
    }
    const id = createDocId('ms');
    await setDoc(doc(db, 'goal_milestones', id), {
      ...payload,
      id,
      status: 'pending' as MilestoneStatus,
      completedAt: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'goal_milestones');
  }
}

export async function setMilestoneStatus(
  milestone: Milestone,
  status: MilestoneStatus
): Promise<void> {
  try {
    await updateDoc(doc(db, 'goal_milestones', milestone.id), {
      status,
      completedAt: status === 'completed' ? serverTimestamp() : null,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `goal_milestones/${milestone.id}`);
  }
}

export async function deleteMilestone(milestone: Milestone): Promise<void> {
  try {
    await deleteDoc(doc(db, 'goal_milestones', milestone.id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `goal_milestones/${milestone.id}`);
  }
}

export interface TaskInput {
  title: string;
  description: string;
  dueDate: string;
  priority: TaskPriority;
  goalId: string;
  milestoneId: string;
  recurrence: TaskRecurrence;
  reminderAt: string;
}

function taskPayload(actor: UserProfile, workspaceId: string, values: TaskInput) {
  return {
    ownerId: sanitizeId(actor.uid),
    workspaceId: sanitizeId(workspaceId),
    goalId: values.goalId ? sanitizeId(values.goalId) : '',
    milestoneId: values.milestoneId ? sanitizeId(values.milestoneId) : '',
    title: sanitizeString(values.title, 140),
    description: sanitizeString(values.description, 1000),
    dueDate: values.dueDate,
    priority: values.priority,
    recurrence: values.recurrence,
    reminderAt: sanitizeString(values.reminderAt, 25),
  };
}

export async function saveTask(params: {
  actor: UserProfile;
  workspaceId: string;
  taskId?: string;
  values: TaskInput;
}): Promise<void> {
  if (!params.workspaceId) {
    throw new Error('Your personal workspace is still loading. Please try again.');
  }
  const payload = taskPayload(params.actor, params.workspaceId, params.values);
  try {
    if (params.taskId) {
      await updateDoc(doc(db, 'planner_tasks', params.taskId), {
        ...payload,
        updatedAt: serverTimestamp(),
      });
      return;
    }
    const id = createDocId('task');
    await setDoc(doc(db, 'planner_tasks', id), {
      ...payload,
      id,
      status: 'not_started' as TaskStatus,
      blockedReason: '',
      rescheduleReason: '',
      completedAt: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'planner_tasks');
  }
}

export async function setTaskStatus(
  task: PlannerTask,
  status: TaskStatus,
  reason = ''
): Promise<void> {
  const cleanReason = sanitizeString(reason, 300);
  try {
    await updateDoc(doc(db, 'planner_tasks', task.id), {
      status,
      blockedReason: status === 'blocked' ? cleanReason : '',
      rescheduleReason: status === 'rescheduled' ? cleanReason : '',
      completedAt: status === 'completed' ? serverTimestamp() : null,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `planner_tasks/${task.id}`);
  }
}

export async function deleteTask(task: PlannerTask): Promise<void> {
  try {
    await deleteDoc(doc(db, 'planner_tasks', task.id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `planner_tasks/${task.id}`);
  }
}

export async function recalculateGoalProgress(uid: string, goalId: string): Promise<void> {
  try {
    const [milestoneSnap, taskSnap] = await Promise.all([
      getDocs(query(collection(db, 'goal_milestones'), where('ownerId', '==', uid))),
      getDocs(query(collection(db, 'planner_tasks'), where('ownerId', '==', uid))),
    ]);
    const milestones = milestoneSnap.docs.map((d) => d.data() as Milestone).filter((m) => m.goalId === goalId);
    const tasks = taskSnap.docs.map((d) => d.data() as PlannerTask).filter((t) => t.goalId === goalId);

    let progress: number | null = null;
    if (milestones.length > 0) {
      const done = milestones.filter((m) => m.status === 'completed').length;
      progress = Math.round((done / milestones.length) * 100);
    } else if (tasks.length > 0) {
      const done = tasks.filter((t) => t.status === 'completed').length;
      progress = Math.round((done / tasks.length) * 100);
    }
    if (progress === null) return;

    await updateDoc(doc(db, 'goals', goalId), {
      progress,
      updatedAt: serverTimestamp(),
    });
  } catch {
    // Progress is derived; a failed refresh must not block the user's action.
  }
}

export async function savePlatformProfile(params: {
  actor: UserProfile;
  displayName: string;
  country: string;
  profileCategory: ProfileCategory | '';
  onboardingPath: OnboardingPath;
  phone?: string;
}): Promise<void> {
  try {
    await updateDoc(doc(db, 'users', sanitizeId(params.actor.uid)), {
      displayName: sanitizeString(params.displayName, 100),
      country: sanitizeString(params.country, 56),
      profileCategory: params.profileCategory,
      onboardingPath: params.onboardingPath,
      ...(params.phone ? { phone: sanitizeString(params.phone, 32) } : {}),
      onboardingCompletedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${params.actor.uid}`);
  }
}
