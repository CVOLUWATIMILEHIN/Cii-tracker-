import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ErrorBoundary } from './components/ErrorBoundary';
import { RequireRole } from './components/RouteGuards';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { WorkspaceProvider } from './context/WorkspaceContext';

// Public pages
import { LandingAndLoginPage } from './pages/public/LandingAndLoginPage';
import { AdminLoginPage } from './pages/public/AdminLoginPage';
import { ActivateAccountPage } from './pages/public/ActivateAccountPage';
import { ForgotPasswordPage } from './pages/public/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/public/ResetPasswordPage';

// Shared pages
import { NotificationsPage } from './pages/shared/NotificationsPage';
import { ProfilePage } from './pages/shared/ProfilePage';

// Corps Member pages
import { MemberDashboardPage } from './pages/member/MemberDashboardPage';
import { MemberActivitiesPage } from './pages/member/MemberActivitiesPage';
import { MemberActivityDetailPage } from './pages/member/MemberActivityDetailPage';
import { MemberCheckinPage } from './pages/member/MemberCheckinPage';
import { MemberWeeklyReportsPage } from './pages/member/MemberWeeklyReportsPage';
import { MemberWeeklyReportDetailPage } from './pages/member/MemberWeeklyReportDetailPage';
import { MemberProgressPage } from './pages/member/MemberProgressPage';

// Accountability Partner pages
import { PartnerDashboardPage } from './pages/partner/PartnerDashboardPage';
import { PartnerMembersPage } from './pages/partner/PartnerMembersPage';
import { PartnerMemberDetailPage } from './pages/partner/PartnerMemberDetailPage';
import { PartnerCheckinsPage } from './pages/partner/PartnerCheckinsPage';
import { PartnerReviewsPage } from './pages/partner/PartnerReviewsPage';
import { PartnerFollowUpsPage } from './pages/partner/PartnerFollowUpsPage';

// Administrator pages
import { AdminDashboardPage } from './pages/admin/AdminDashboardPage';
import { AdminUsersPage } from './pages/admin/AdminUsersPage';
import { AdminParticipantsPage } from './pages/admin/AdminParticipantsPage';
import { AdminParticipantDetailPage } from './pages/admin/AdminParticipantDetailPage';
import { AdminPartnersPage } from './pages/admin/AdminPartnersPage';
import { AdminAssignmentsPage } from './pages/admin/AdminAssignmentsPage';
import { AdminCohortsPage } from './pages/admin/AdminCohortsPage';
import { AdminActivitiesPage } from './pages/admin/AdminActivitiesPage';
import { AdminCreateActivityPage } from './pages/admin/AdminCreateActivityPage';
import { AdminSubmissionsPage } from './pages/admin/AdminSubmissionsPage';
import { AdminReportsPage } from './pages/admin/AdminReportsPage';
import { AdminAnalyticsPage } from './pages/admin/AdminAnalyticsPage';
import { AdminAnnouncementsPage } from './pages/admin/AdminAnnouncementsPage';
import { AdminSettingsPage } from './pages/admin/AdminSettingsPage';
import { ADMIN_ROLES, CanonicalRole } from './types';

const ALL_AUTHENTICATED_ROLES: CanonicalRole[] = ['member', 'partner', ...ADMIN_ROLES];
const MANAGER_ADMIN_ROLES: CanonicalRole[] = ['super_admin', 'admin', 'programme_manager'];
const FULL_ADMIN_ROLES: CanonicalRole[] = ['super_admin', 'admin'];

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <WorkspaceProvider>
            <BrowserRouter>
              <Routes>
                {/* Public Routes */}
                <Route path="/" element={<LandingAndLoginPage />} />
                <Route path="/login" element={<LandingAndLoginPage />} />
                <Route path="/activate-account" element={<ActivateAccountPage />} />
                <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                <Route path="/reset-password" element={<ResetPasswordPage />} />
                <Route path="/admin/login" element={<AdminLoginPage />} />

                {/* Corps Member Routes */}
                <Route
                  path="/dashboard"
                  element={
                    <RequireRole allowed={['member']}>
                      <MemberDashboardPage />
                    </RequireRole>
                  }
                />
                <Route
                  path="/activities"
                  element={
                    <RequireRole allowed={['member']}>
                      <MemberActivitiesPage />
                    </RequireRole>
                  }
                />
                <Route
                  path="/activities/:id"
                  element={
                    <RequireRole allowed={['member']}>
                      <MemberActivityDetailPage />
                    </RequireRole>
                  }
                />
                <Route
                  path="/check-in"
                  element={
                    <RequireRole allowed={['member']}>
                      <MemberCheckinPage />
                    </RequireRole>
                  }
                />
                <Route
                  path="/weekly-reports"
                  element={
                    <RequireRole allowed={['member']}>
                      <MemberWeeklyReportsPage />
                    </RequireRole>
                  }
                />
                <Route
                  path="/weekly-reports/:id"
                  element={
                    <RequireRole allowed={['member']}>
                      <MemberWeeklyReportDetailPage />
                    </RequireRole>
                  }
                />
                <Route
                  path="/progress"
                  element={
                    <RequireRole allowed={['member']}>
                      <MemberProgressPage />
                    </RequireRole>
                  }
                />

                {/* Shared Authenticated Routes */}
                <Route
                  path="/notifications"
                  element={
                    <RequireRole allowed={ALL_AUTHENTICATED_ROLES}>
                      <NotificationsPage />
                    </RequireRole>
                  }
                />
                <Route
                  path="/profile"
                  element={
                    <RequireRole allowed={ALL_AUTHENTICATED_ROLES}>
                      <ProfilePage />
                    </RequireRole>
                  }
                />

                {/* Accountability Partner Routes */}
                <Route
                  path="/partner"
                  element={
                    <RequireRole allowed={['partner']}>
                      <PartnerDashboardPage />
                    </RequireRole>
                  }
                />
                <Route
                  path="/partner/members"
                  element={
                    <RequireRole allowed={['partner']}>
                      <PartnerMembersPage />
                    </RequireRole>
                  }
                />
                <Route
                  path="/partner/members/:id"
                  element={
                    <RequireRole allowed={['partner']}>
                      <PartnerMemberDetailPage />
                    </RequireRole>
                  }
                />
                <Route
                  path="/partner/check-ins"
                  element={
                    <RequireRole allowed={['partner']}>
                      <PartnerCheckinsPage />
                    </RequireRole>
                  }
                />
                <Route
                  path="/partner/reviews"
                  element={
                    <RequireRole allowed={['partner']}>
                      <PartnerReviewsPage />
                    </RequireRole>
                  }
                />
                <Route
                  path="/partner/follow-ups"
                  element={
                    <RequireRole allowed={['partner']}>
                      <PartnerFollowUpsPage />
                    </RequireRole>
                  }
                />

                {/* Administrator Routes */}
                <Route
                  path="/admin"
                  element={
                    <RequireRole allowed={ADMIN_ROLES}>
                      <AdminDashboardPage />
                    </RequireRole>
                  }
                />
                <Route
                  path="/admin/users"
                  element={
                    <RequireRole allowed={['super_admin']}>
                      <AdminUsersPage />
                    </RequireRole>
                  }
                />
                <Route
                  path="/admin/participants"
                  element={
                    <RequireRole allowed={ADMIN_ROLES}>
                      <AdminParticipantsPage />
                    </RequireRole>
                  }
                />
                <Route
                  path="/admin/participants/:id"
                  element={
                    <RequireRole allowed={MANAGER_ADMIN_ROLES}>
                      <AdminParticipantDetailPage />
                    </RequireRole>
                  }
                />
                <Route
                  path="/admin/partners"
                  element={
                    <RequireRole allowed={MANAGER_ADMIN_ROLES}>
                      <AdminPartnersPage />
                    </RequireRole>
                  }
                />
                <Route
                  path="/admin/assignments"
                  element={
                    <RequireRole allowed={MANAGER_ADMIN_ROLES}>
                      <AdminAssignmentsPage />
                    </RequireRole>
                  }
                />
                <Route
                  path="/admin/cohorts"
                  element={
                    <RequireRole allowed={MANAGER_ADMIN_ROLES}>
                      <AdminCohortsPage />
                    </RequireRole>
                  }
                />
                <Route
                  path="/admin/activities"
                  element={
                    <RequireRole allowed={MANAGER_ADMIN_ROLES}>
                      <AdminActivitiesPage />
                    </RequireRole>
                  }
                />
                <Route
                  path="/admin/activities/create"
                  element={
                    <RequireRole allowed={MANAGER_ADMIN_ROLES}>
                      <AdminCreateActivityPage />
                    </RequireRole>
                  }
                />
                <Route
                  path="/admin/submissions"
                  element={
                    <RequireRole allowed={ADMIN_ROLES}>
                      <AdminSubmissionsPage />
                    </RequireRole>
                  }
                />
                <Route
                  path="/admin/reports"
                  element={
                    <RequireRole allowed={ADMIN_ROLES}>
                      <AdminReportsPage />
                    </RequireRole>
                  }
                />
                <Route
                  path="/admin/analytics"
                  element={
                    <RequireRole allowed={MANAGER_ADMIN_ROLES}>
                      <AdminAnalyticsPage />
                    </RequireRole>
                  }
                />
                <Route
                  path="/admin/announcements"
                  element={
                    <RequireRole allowed={MANAGER_ADMIN_ROLES}>
                      <AdminAnnouncementsPage />
                    </RequireRole>
                  }
                />
                <Route
                  path="/admin/audit-logs"
                  element={
                    <RequireRole allowed={FULL_ADMIN_ROLES}>
                      <AdminSettingsPage />
                    </RequireRole>
                  }
                />
                <Route
                  path="/admin/settings"
                  element={
                    <RequireRole allowed={FULL_ADMIN_ROLES}>
                      <AdminSettingsPage />
                    </RequireRole>
                  }
                />

                {/* Catch-all Fallback */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </BrowserRouter>
          </WorkspaceProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
