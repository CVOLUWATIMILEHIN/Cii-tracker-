import { Link } from 'react-router-dom';
import { Bell, CheckCheck } from 'lucide-react';
import { AppShell } from '../../components/AppShell';
import { useWorkspace } from '../../context/WorkspaceContext';
import { formatTimestamp } from '../../lib/exportReports';
import { markAllNotificationsRead, markNotificationRead } from '../../services/ciiService';

export function NotificationsPage() {
  const { notifications } = useWorkspace();
  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <AppShell
      title="Notifications"
      actions={
        unreadCount > 0 ? (
          <button
            type="button"
            onClick={() => markAllNotificationsRead(notifications)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer whitespace-nowrap"
          >
            <CheckCheck className="w-3.5 h-3.5" />
            Mark All Read
          </button>
        ) : undefined
      }
    >
      <div className="max-w-3xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        {notifications.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <Bell className="w-6 h-6 text-slate-400 mx-auto" />
            <p className="text-sm font-medium text-slate-900 dark:text-white">
              No notifications yet
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Activity assignments, submission feedback, check-in alerts, and programme announcements will appear here.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {notifications.map((item) => (
              <div
                key={item.id}
                className={`p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  !item.read ? 'bg-emerald-50/40 dark:bg-emerald-950/20' : ''
                }`}
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <span className="uppercase tracking-wider font-mono text-[11px]">
                      {item.type}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">
                      {formatTimestamp(item.createdAt)}
                    </span>
                    {!item.read && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                          Unread
                        </span>
                      </>
                    )}
                  </div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    {item.title}
                  </p>
                  <p className="text-xs text-slate-600 dark:text-slate-300">{item.message}</p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {item.linkPath && (
                    <Link
                      to={item.linkPath}
                      onClick={() => {
                        if (!item.read) void markNotificationRead(item.id);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-slate-900 dark:bg-emerald-600 text-white text-xs font-medium whitespace-nowrap"
                    >
                      Open
                    </Link>
                  )}
                  {!item.read && (
                    <button
                      type="button"
                      onClick={() => markNotificationRead(item.id)}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-600 dark:text-slate-300 cursor-pointer whitespace-nowrap"
                    >
                      Mark Read
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
