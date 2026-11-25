import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Activity,
  BarChart3,
  Bell,
  CalendarCheck,
  ClipboardCheck,
  ClipboardList,
  Compass,
  FileCheck2,
  FileText,
  FolderKanban,
  GitCompareArrows,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Menu,
  MessageSquareMore,
  Moon,
  Settings,
  ShieldCheck,
  Sun,
  TrendingUp,
  UserCheck,
  UserCircle,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useWorkspace } from '../context/WorkspaceContext';
import {
  CanonicalRole,
  getDashboardPathForRole,
  isAdminPortalRole,
  ROLE_LABELS,
} from '../types';

interface NavLinkItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  badge?: number;
}

export function AppShell({
  title,
  breadcrumb,
  actions,
  children,
}: {
  title: string;
  breadcrumb?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { profile, privateInfo, firebaseUser, role, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { notifications } = useWorkspace();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const navByRole: Record<CanonicalRole, NavLinkItem[]> = {
    member: [
      { to: '/dashboard', label: 'Personal Workspace', icon: Compass },
      { to: '/community/cii', label: 'CII Dashboard', icon: LayoutDashboard },
      { to: '/community/cii/activities', label: 'Activities', icon: ClipboardList },
      { to: '/community/cii/check-in', label: 'Daily Check-In', icon: CalendarCheck },
      { to: '/community/cii/weekly-reports', label: 'Weekly Reports', icon: FileText },
      { to: '/community/cii/progress', label: 'Progress', icon: TrendingUp },
      { to: '/notifications', label: 'Notifications', icon: Bell, badge: unreadCount || undefined },
      { to: '/profile', label: 'Profile', icon: UserCircle },
    ],
    partner: [
      { to: '/dashboard', label: 'Personal Workspace', icon: Compass },
      { to: '/partner', label: 'Partner Overview', icon: LayoutDashboard },
      { to: '/partner/members', label: 'Assigned Members', icon: Users },
      { to: '/partner/check-ins', label: 'Member Check-Ins', icon: CalendarCheck },
      { to: '/partner/reviews', label: 'Pending Reviews', icon: FileCheck2 },
      { to: '/partner/follow-ups', label: 'Follow-Ups', icon: MessageSquareMore },
      { to: '/notifications', label: 'Notifications', icon: Bell, badge: unreadCount || undefined },
      { to: '/profile', label: 'Profile', icon: UserCircle },
    ],
    super_admin: [
      { to: '/admin', label: 'Admin Overview', icon: LayoutDashboard },
      { to: '/admin/users', label: 'Admin Users', icon: ShieldCheck },
      { to: '/admin/participants', label: 'Participants', icon: Users },
      { to: '/admin/partners', label: 'Partners', icon: UserCheck },
      { to: '/admin/assignments', label: 'Assignments', icon: GitCompareArrows },
      { to: '/admin/cohorts', label: 'Cohorts', icon: FolderKanban },
      { to: '/admin/activities', label: 'Activities', icon: ClipboardList },
      { to: '/admin/submissions', label: 'Submissions', icon: ClipboardCheck },
      { to: '/admin/reports', label: 'Weekly Reports', icon: FileText },
      { to: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
      { to: '/admin/announcements', label: 'Announcements', icon: Megaphone },
      { to: '/admin/settings', label: 'Settings & Audit', icon: Settings },
      { to: '/profile', label: 'Profile', icon: UserCircle },
    ],
    admin: [
      { to: '/admin', label: 'Admin Overview', icon: LayoutDashboard },
      { to: '/admin/participants', label: 'Participants', icon: Users },
      { to: '/admin/partners', label: 'Partners', icon: UserCheck },
      { to: '/admin/assignments', label: 'Assignments', icon: GitCompareArrows },
      { to: '/admin/cohorts', label: 'Cohorts', icon: FolderKanban },
      { to: '/admin/activities', label: 'Activities', icon: ClipboardList },
      { to: '/admin/submissions', label: 'Submissions', icon: ClipboardCheck },
      { to: '/admin/reports', label: 'Weekly Reports', icon: FileText },
      { to: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
      { to: '/admin/announcements', label: 'Announcements', icon: Megaphone },
      { to: '/admin/settings', label: 'Audit & Policy', icon: Settings },
      { to: '/profile', label: 'Profile', icon: UserCircle },
    ],
    programme_manager: [
      { to: '/admin', label: 'Programme Overview', icon: LayoutDashboard },
      { to: '/admin/participants', label: 'Assigned Participants', icon: Users },
      { to: '/admin/partners', label: 'Partners', icon: UserCheck },
      { to: '/admin/assignments', label: 'Assignments', icon: GitCompareArrows },
      { to: '/admin/cohorts', label: 'Assigned Cohorts', icon: FolderKanban },
      { to: '/admin/activities', label: 'Activities', icon: ClipboardList },
      { to: '/admin/submissions', label: 'Submissions', icon: ClipboardCheck },
      { to: '/admin/reports', label: 'Weekly Reports', icon: FileText },
      { to: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
      { to: '/admin/announcements', label: 'Announcements', icon: Megaphone },
      { to: '/profile', label: 'Profile', icon: UserCircle },
    ],
    reviewer: [
      { to: '/admin', label: 'Review Overview', icon: LayoutDashboard },
      { to: '/admin/participants', label: 'Assigned Participants', icon: Users },
      { to: '/admin/submissions', label: 'Submissions', icon: ClipboardCheck },
      { to: '/admin/reports', label: 'Weekly Reports', icon: FileText },
      { to: '/profile', label: 'Profile', icon: UserCircle },
    ],
  };

  const baseLinks = navByRole[role];
  const links = isAdminPortalRole(role)
    ? [{ to: '/dashboard', label: 'Personal Workspace', icon: Compass }, ...baseLinks]
    : baseLinks;
  const email = privateInfo?.email || firebaseUser?.email || '';

  const isLinkActive = (to: string) => {
    if (
      to === '/dashboard' ||
      to === '/partner' ||
      to === '/admin' ||
      to === '/community/cii'
    ) {
      return location.pathname === to;
    }
    return location.pathname === to || location.pathname.startsWith(`${to}/`);
  };

  const sidebarContent = (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 w-64">
      <div className="h-16 px-5 flex items-center justify-between border-b border-slate-200 dark:border-slate-800 shrink-0">
        <Link
          to={role === 'member' ? '/community/cii' : getDashboardPathForRole(role)}
          onClick={() => setMobileOpen(false)}
          className="flex items-center gap-2 text-sm font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap font-display"
        >
          <Activity className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>CII Tracker</span>
        </Link>
        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          aria-label="Close navigation menu"
          className="lg:hidden p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto" aria-label="Primary navigation">
        {links.map((item) => {
          const Icon = item.icon;
          const active = isLinkActive(item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                active
                  ? 'bg-slate-900 text-white dark:bg-emerald-600 dark:text-white'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/80 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <span className="flex items-center gap-3 min-w-0">
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </span>
              {typeof item.badge === 'number' && item.badge > 0 && (
                <span
                  className={`text-xs font-mono tabular-nums ${
                    active ? 'text-slate-200 dark:text-emerald-100' : 'text-emerald-600 dark:text-emerald-400'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-200 dark:border-slate-800 space-y-3 shrink-0">
        <div className="space-y-0.5">
          <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
            {profile?.displayName}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{email}</p>
          <p className="text-xs text-emerald-700 dark:text-emerald-400 font-medium pt-0.5 truncate">
            {ROLE_LABELS[role]}
            {profile?.cohortName ? ` · ${profile.cohortName}` : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={logout}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer whitespace-nowrap"
        >
          <LogOut className="w-3.5 h-3.5 shrink-0" />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <aside className="hidden lg:block shrink-0 h-screen sticky top-0">{sidebarContent}</aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <div className="relative z-10 h-full">{sidebarContent}</div>
        </div>
      )}

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-30 h-14 sm:h-16 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation menu"
              className="lg:hidden p-2 -ml-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer shrink-0"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="min-w-0 flex items-center gap-2 text-sm">
              <span className="hidden sm:inline text-slate-400 dark:text-slate-500 whitespace-nowrap">
                {breadcrumb || `${ROLE_LABELS[role]} /`}
              </span>
              <h1 className="text-sm sm:text-base font-semibold text-slate-900 dark:text-white truncate font-display">
                {title}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <Link
              to="/notifications"
              aria-label="Notifications"
              className="relative p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 px-1 min-w-[16px] h-4 rounded-full bg-rose-600 text-white text-[10px] font-mono tabular-nums flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </Link>

            <button
              type="button"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            {actions}
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1440px] w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
