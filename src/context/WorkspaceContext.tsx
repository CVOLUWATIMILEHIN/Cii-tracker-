import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import {
  subscribeToActivities,
  subscribeToAllUsers,
  subscribeToAnnouncements,
  subscribeToAssignedMembers,
  subscribeToAuditLogs,
  subscribeToCohorts,
  subscribeToDailyCheckins,
  subscribeToFollowUps,
  subscribeToInvitations,
  subscribeToNotifications,
  subscribeToProgrammeSettings,
  subscribeToSubmissions,
  subscribeToUserProfile,
  subscribeToWeeklyReports,
} from '../services/ciiService';
import {
  Activity,
  ActivitySubmission,
  Announcement,
  AuditLog,
  Cohort,
  DailyCheckin,
  FollowUp,
  Invitation,
  NotificationItem,
  ProgrammeSettings,
  UserProfile,
  WeeklyReport,
} from '../types';

interface WorkspaceContextValue {
  users: UserProfile[];
  assignedMembers: UserProfile[];
  assignedPartner: UserProfile | null;
  invitations: Invitation[];
  cohorts: Cohort[];
  activities: Activity[];
  submissions: ActivitySubmission[];
  checkins: DailyCheckin[];
  reports: WeeklyReport[];
  followUps: FollowUp[];
  announcements: Announcement[];
  notifications: NotificationItem[];
  settings: ProgrammeSettings | null;
  auditLogs: AuditLog[];
  loading: boolean;
}

const WorkspaceContext = createContext<WorkspaceContextValue | undefined>(undefined);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const { profile, role } = useAuth();

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [assignedMembers, setAssignedMembers] = useState<UserProfile[]>([]);
  const [assignedPartner, setAssignedPartner] = useState<UserProfile | null>(null);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [submissions, setSubmissions] = useState<ActivitySubmission[]>([]);
  const [checkins, setCheckins] = useState<DailyCheckin[]>([]);
  const [reports, setReports] = useState<WeeklyReport[]>([]);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [settings, setSettings] = useState<ProgrammeSettings | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile || profile.status !== 'active') {
      setUsers([]);
      setAssignedMembers([]);
      setAssignedPartner(null);
      setInvitations([]);
      setCohorts([]);
      setActivities([]);
      setSubmissions([]);
      setCheckins([]);
      setReports([]);
      setFollowUps([]);
      setAnnouncements([]);
      setNotifications([]);
      setSettings(null);
      setAuditLogs([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    let readyCount = 0;
    const markReady = () => {
      readyCount += 1;
      if (readyCount >= 3) setLoading(false);
    };

    const scopedCohortIds =
      role === 'programme_manager' || role === 'reviewer'
        ? profile.assignedCohortIds || []
        : undefined;

    const unsubs: Array<() => void> = [];

    unsubs.push(
      subscribeToCohorts((data) => {
        setCohorts(data);
        markReady();
      }, scopedCohortIds)
    );
    unsubs.push(
      subscribeToActivities(
        role,
        (data) => {
          setActivities(data);
          markReady();
        },
        scopedCohortIds
      )
    );
    unsubs.push(
      subscribeToSubmissions(
        role,
        profile.uid,
        (data) => {
          setSubmissions(data);
          markReady();
        },
        scopedCohortIds
      )
    );
    unsubs.push(subscribeToDailyCheckins(role, profile.uid, setCheckins, scopedCohortIds));
    unsubs.push(subscribeToWeeklyReports(role, profile.uid, setReports, scopedCohortIds));
    unsubs.push(subscribeToFollowUps(role, profile.uid, setFollowUps));
    unsubs.push(subscribeToAnnouncements(setAnnouncements));
    unsubs.push(subscribeToNotifications(profile.uid, setNotifications));
    unsubs.push(subscribeToProgrammeSettings(setSettings));
    unsubs.push(subscribeToAuditLogs(role, profile.uid, setAuditLogs));

    if (role === 'super_admin' || role === 'admin') {
      unsubs.push(subscribeToAllUsers(setUsers));
      unsubs.push(subscribeToInvitations(setInvitations));
    } else if (role === 'programme_manager') {
      unsubs.push(subscribeToAllUsers(setUsers, scopedCohortIds));
      unsubs.push(subscribeToInvitations(setInvitations, scopedCohortIds));
    } else if (role === 'reviewer') {
      unsubs.push(subscribeToAllUsers(setUsers, scopedCohortIds));
      setInvitations([]);
    } else if (role === 'partner') {
      unsubs.push(subscribeToAssignedMembers(profile.uid, setAssignedMembers));
    } else if (profile.partnerId) {
      unsubs.push(subscribeToUserProfile(profile.partnerId, setAssignedPartner));
    }

    return () => {
      unsubs.forEach((fn) => fn());
    };
  }, [
    profile?.uid,
    profile?.status,
    profile?.partnerId,
    role,
    (profile?.assignedCohortIds || []).join(','),
  ]);

  return (
    <WorkspaceContext.Provider
      value={{
        users,
        assignedMembers,
        assignedPartner,
        invitations,
        cohorts,
        activities,
        submissions,
        checkins,
        reports,
        followUps,
        announcements,
        notifications,
        settings,
        auditLogs,
        loading,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error('useWorkspace must be used inside WorkspaceProvider');
  return ctx;
}
