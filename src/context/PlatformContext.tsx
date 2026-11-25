import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useAuth } from './AuthContext';
import {
  ensurePersonalWorkspace,
  subscribeToGoals,
  subscribeToMemberships,
  subscribeToMilestones,
  subscribeToTasks,
  subscribeToWorkspaces,
} from '../services/platformService';
import {
  Goal,
  Milestone,
  PlannerTask,
  Workspace,
  WorkspaceMembership,
} from '../platformTypes';

interface PlatformContextValue {
  workspaces: Workspace[];
  memberships: WorkspaceMembership[];
  workspace: Workspace | null;
  workspaceId: string;
  goals: Goal[];
  milestones: Milestone[];
  tasks: PlannerTask[];
  loading: boolean;
  ensureWorkspace: () => Promise<Workspace | null>;
}

const PlatformContext = createContext<PlatformContextValue | undefined>(undefined);

export function PlatformProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();

  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [memberships, setMemberships] = useState<WorkspaceMembership[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [tasks, setTasks] = useState<PlannerTask[]>([]);
  const [loading, setLoading] = useState(true);
  const ensureRef = useRef<Promise<Workspace | null> | null>(null);

  useEffect(() => {
    if (!profile || profile.status !== 'active') {
      setWorkspaces([]);
      setMemberships([]);
      setGoals([]);
      setMilestones([]);
      setTasks([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    let ready = 0;
    const markReady = () => {
      ready += 1;
      if (ready >= 4) setLoading(false);
    };

    const unsubs = [
      subscribeToWorkspaces(profile.uid, (items) => {
        setWorkspaces(items);
        markReady();
      }),
      subscribeToMemberships(profile.uid, setMemberships),
      subscribeToGoals(profile.uid, (items) => {
        setGoals(items);
        markReady();
      }),
      subscribeToMilestones(profile.uid, (items) => {
        setMilestones(items);
        markReady();
      }),
      subscribeToTasks(profile.uid, (items) => {
        setTasks(items);
        markReady();
      }),
    ];

    return () => unsubs.forEach((fn) => fn());
  }, [profile?.uid, profile?.status]);

  const ensureWorkspace = useCallback(async (): Promise<Workspace | null> => {
    if (!profile) return null;
    if (ensureRef.current) return ensureRef.current;
    const promise = ensurePersonalWorkspace(profile)
      .catch(() => null)
      .finally(() => {
        ensureRef.current = null;
      });
    ensureRef.current = promise;
    return promise;
  }, [profile?.uid, profile?.displayName]);

  const workspace =
    workspaces.find((w) => w.type === 'individual' && w.ownerId === profile?.uid) || null;

  return (
    <PlatformContext.Provider
      value={{
        workspaces,
        memberships,
        workspace,
        workspaceId: workspace?.id || '',
        goals,
        milestones,
        tasks,
        loading,
        ensureWorkspace,
      }}
    >
      {children}
    </PlatformContext.Provider>
  );
}

export function usePlatform(): PlatformContextValue {
  const ctx = useContext(PlatformContext);
  if (!ctx) throw new Error('usePlatform must be used inside PlatformProvider');
  return ctx;
}
