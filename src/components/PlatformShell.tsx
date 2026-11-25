import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Bell,
  BookOpen,
  BriefcaseBusiness,
  CalendarRange,
  Compass,
  GraduationCap,
  HeartHandshake,
  LayoutDashboard,
  Lock,
  LogOut,
  Menu,
  Settings,
  ShieldCheck,
  Sparkles,
  Target,
  UserCircle,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useWorkspace } from '../context/WorkspaceContext';
import { ROLE_LABELS } from '../types';

interface PlatformNavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  badge?: number;
}

interface PlannedItem {
  label: string;
  phase: string;
  icon: typeof LayoutDashboard;
}

const PLANNED_ITEMS: PlannedItem[] = [
  { label: 'Personal Daily Check-In', phase: 'Phase 2', icon: HeartHandshake },
  { label: 'Weekly & Monthly Reviews', phase: 'Phase 2', icon: BookOpen },
  { label: 'Affirmations & Journal', phase: 'Phase 2', icon: Sparkles },
  { label: 'Coach Workspace', phase: 'Phase 3', icon: GraduationCap },
  { label: 'Business Workspace', phase: 'Phase 3', icon: BriefcaseBusiness },
  { label: 'SMT – Your Companion', phase: 'Phase 4', icon: Compass },
];

export function PlatformShell({
  title,
  subtitle,
  breadcrumb = 'Personal Workspace /',
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  breadcrumb?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { profile, privateInfo, firebaseUser, role, logout } = useAuth();
  const { notifications } = useWorkspace();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const unreadCount = notifications.filter((n) => !n.read).length;
  const email = privateInfo?.email || firebaseUser?.email || '';

  const platformLinks: PlatformNavItem[] = [
    { to: '/dashboard', label: 'Personal Dashboard', icon: LayoutDashboard },
    { to: '/goals', label: 'Goals', icon: Target },
    { to: '/planner', label: 'Planner', icon: CalendarRange },
    { to: '/settings', label: 'Settings', icon: Settings },
    { to: '/notifications', label: 'Notifications', icon: Bell, badge: unreadCount || undefined },
    { to: '/profile', label: 'Account Profile', icon: UserCircle },
  ];

  const connectionLinks: PlatformNavItem[] = [];
  if (role === 'member') {
    connectionLinks.push({ to: '/community/cii', label: 'CII Community', icon: Users });
  }
  if (role === 'partner') {
    connectionLinks.push({ to: '/partner', label: 'CII Partner Console', icon: HeartHandshake });
  }
  if (role === 'super_admin' || role === 'admin' || role === 'programme_manager' || role === 'reviewer') {
    connectionLinks.push({ to: '/admin', label: 'CII Admin Console', icon: ShieldCheck });
  }

  const isLinkActive = (to: string) => {
    if (to === '/dashboard' || to === '/community/cii' || to === '/partner' || to === '/admin') {
      return location.pathname === to;
    }
    return location.pathname === to || location.pathname.startsWith(`${to}/`);
  };

  const renderLink = (item: PlatformNavItem) => {
    const Icon = item.icon;
    const active = isLinkActive(item.to);
    return (
      <Link
        key={item.to}
        to={item.to}
        onClick={() => setMobileOpen(false)}
        aria-current={active ? 'page' : undefined}
        className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
          active
            ? 'bg-amber-400 text-[#241244] shadow-sm'
            : 'text-violet-100/90 hover:bg-white/10 hover:text-white'
        }`}
      >
        <span className="flex items-center gap-3 min-w-0">
          <Icon className="w-4 h-4 shrink-0" />
          <span className="truncate">{item.label}</span>
        </span>
        {typeof item.badge === 'number' && item.badge > 0 && (
          <span
            className={`text-xs font-mono tabular-nums rounded-full px-1.5 min-w-[20px] text-center ${
              active ? 'bg-[#241244]/15 text-[#241244]' : 'bg-amber-400/20 text-amber-200'
            }`}
          >
            {item.badge}
          </span>
        )}
      </Link>
    );
  };

  const sidebarContent = (
    <div className="flex flex-col h-full bg-[#241244] w-64 border-r border-[#2f1a56]">
      <div className="h-16 px-4 flex items-center justify-between border-b border-white/10 shrink-0">
        <Link
          to="/dashboard"
          onClick={() => setMobileOpen(false)}
          className="flex items-center gap-2.5 min-w-0"
        >
          <span className="w-8 h-8 rounded-lg bg-amber-400 text-[#241244] flex items-center justify-center shrink-0">
            <Compass className="w-5 h-5" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-bold tracking-tight text-white font-display leading-tight">
              From Intention
            </span>
            <span className="block text-[11px] font-medium text-amber-300 leading-tight">
              to Execution
            </span>
          </span>
        </Link>
        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          aria-label="Close navigation menu"
          className="lg:hidden p-1.5 rounded-lg text-violet-200 hover:bg-white/10 cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="px-3 pt-4 pb-2">
        <p className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-violet-300/80">
          Workspace
        </p>
        <div className="rounded-lg bg-white/10 px-3 py-2.5">
          <p className="text-sm font-semibold text-white truncate">
            {profile?.displayName ? `${profile.displayName.split(/\s+/)[0]}'s Workspace` : 'Personal Workspace'}
          </p>
          <p className="text-[11px] text-violet-200/80">Individual · Private by default</p>
        </div>
      </div>

      <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto" aria-label="Personal workspace navigation">
        {platformLinks.map(renderLink)}

        {connectionLinks.length > 0 && (
          <>
            <p className="px-2 pt-4 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-violet-300/80">
              Connected Workspaces
            </p>
            {connectionLinks.map(renderLink)}
          </>
        )}

        <p className="px-2 pt-4 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-violet-300/80">
          On the Roadmap
        </p>
        {PLANNED_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.label}
              aria-disabled="true"
              title={`${item.label} arrives in ${item.phase}. Not available yet.`}
              className="flex items-center justify-between px-3 py-2 rounded-lg text-sm text-violet-200/50 cursor-not-allowed select-none"
            >
              <span className="flex items-center gap-3 min-w-0">
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </span>
              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-violet-200/60 shrink-0">
                <Lock className="w-3 h-3" />
                {item.phase}
              </span>
            </div>
          );
        })}
      </nav>

      <div className="p-4 border-t border-white/10 space-y-3 shrink-0">
        <div className="space-y-0.5">
          <p className="text-sm font-semibold text-white truncate">{profile?.displayName}</p>
          <p className="text-xs text-violet-200/80 truncate">{email}</p>
          <p className="text-[11px] text-amber-300 font-medium pt-0.5 truncate">
            {ROLE_LABELS[role]}
            {profile?.cohortName ? ` · ${profile.cohortName}` : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={logout}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-white/20 text-xs font-medium text-violet-100 hover:bg-white/10 transition-colors cursor-pointer whitespace-nowrap"
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
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs">
                <span className="hidden sm:inline text-violet-600 dark:text-violet-400 font-medium whitespace-nowrap">
                  {breadcrumb}
                </span>
                <span className="hidden sm:inline text-slate-300 dark:text-slate-600" aria-hidden="true">
                  ·
                </span>
                <h1 className="text-sm sm:text-base font-semibold text-slate-900 dark:text-white truncate font-display">
                  {title}
                </h1>
              </div>
              {subtitle && (
                <p className="hidden sm:block text-[11px] text-slate-500 dark:text-slate-400 truncate">
                  {subtitle}
                </p>
              )}
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
