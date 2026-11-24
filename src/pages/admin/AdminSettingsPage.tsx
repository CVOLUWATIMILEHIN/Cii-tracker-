import React, { useEffect, useMemo, useState } from 'react';
import { Download, FileDown, Save, Search, ShieldCheck } from 'lucide-react';
import { AppShell } from '../../components/AppShell';
import { useAuth } from '../../context/AuthContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import {
  exportAuditLogsCsv,
  exportAuditLogsPdf,
  formatTimestamp,
} from '../../lib/exportReports';
import { recordAuditEvent, saveProgrammeSettings } from '../../services/ciiService';
import {
  AuditCategory,
  AuditSeverity,
  canManageProgrammeSettings,
  normalizeRole,
  ROLE_LABELS,
} from '../../types';

export function AdminSettingsPage() {
  const { profile, role } = useAuth();
  const { settings, auditLogs } = useWorkspace();

  const [partnerCanApproveReports, setPartnerCanApproveReports] = useState(true);
  const [weeklyReportDueDay, setWeeklyReportDueDay] = useState('Friday');
  const [inactivityThresholdDays, setInactivityThresholdDays] = useState(3);
  const [emailProviderNote, setEmailProviderNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const canEditSettings = canManageProgrammeSettings(role);

  const [logSearch, setLogSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<AuditCategory | 'all'>('all');
  const [severityFilter, setSeverityFilter] = useState<AuditSeverity | 'all'>('all');

  useEffect(() => {
    if (!settings) return;
    setPartnerCanApproveReports(settings.partnerCanApproveReports);
    setWeeklyReportDueDay(settings.weeklyReportDueDay || 'Friday');
    setInactivityThresholdDays(settings.inactivityThresholdDays || 3);
    setEmailProviderNote(settings.emailProviderNote || '');
  }, [settings]);

  const filteredLogs = useMemo(() => {
    const q = logSearch.trim().toLowerCase();
    return auditLogs.filter((log) => {
      if (categoryFilter !== 'all' && log.category !== categoryFilter) return false;
      if (severityFilter !== 'all' && log.severity !== severityFilter) return false;
      if (
        q &&
        !log.actorName.toLowerCase().includes(q) &&
        !log.action.toLowerCase().includes(q) &&
        !log.summary.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [auditLogs, logSearch, categoryFilter, severityFilter]);

  if (!profile) return null;

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEditSettings) return;
    setSaving(true);
    setSavedMsg(null);
    setErrorMsg(null);
    try {
      await saveProgrammeSettings({
        actor: profile,
        partnerCanApproveReports,
        weeklyReportDueDay,
        inactivityThresholdDays,
        emailProviderNote,
      });
      setSavedMsg('Governance settings updated and persisted to Firestore.');
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Unable to save governance settings.'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleExportLogsCsv = () => {
    exportAuditLogsCsv(filteredLogs);
    void recordAuditEvent({
      actorId: profile.uid,
      actorName: profile.displayName,
      actorRole: role,
      action: 'EXPORT_AUDIT_LOGS_CSV',
      category: 'export',
      severity: 'info',
      targetType: 'audit_logs',
      targetId: 'system',
      summary: `Exported ${filteredLogs.length} immutable audit log entries to CSV.`,
    });
  };

  const handleExportLogsPdf = () => {
    exportAuditLogsPdf(filteredLogs, profile.displayName, role);
    void recordAuditEvent({
      actorId: profile.uid,
      actorName: profile.displayName,
      actorRole: role,
      action: 'EXPORT_AUDIT_LOGS_PDF',
      category: 'export',
      severity: 'info',
      targetType: 'audit_logs',
      targetId: 'system',
      summary: `Exported ${filteredLogs.length} immutable audit log entries to PDF.`,
    });
  };

  return (
    <AppShell title="System Settings & Audit Log" breadcrumb="Admin /">
      <div className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <form
            onSubmit={handleSaveSettings}
            className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4"
          >
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                Programme Governance Policy
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Rules saved here take effect immediately across Accountability Partner workflows and inactivity alerts.
              </p>
            </div>

            {!canEditSettings && (
              <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300">
                Read-only view: Only a Super Admin can modify programme governance settings.
              </div>
            )}

            {savedMsg && (
              <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-xs text-emerald-700 dark:text-emerald-400">
                {savedMsg}
              </div>
            )}

            {errorMsg && (
              <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-xs text-rose-700 dark:text-rose-400">
                {errorMsg}
              </div>
            )}

            <label className="flex items-start gap-3 p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 cursor-pointer">
              <input
                type="checkbox"
                disabled={!canEditSettings}
                checked={partnerCanApproveReports}
                onChange={(e) => setPartnerCanApproveReports(e.target.checked)}
                className="mt-0.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-600 disabled:opacity-60"
              />
              <span>
                <span className="block text-xs font-semibold text-slate-900 dark:text-white">
                  Allow Accountability Partners to formally approve submissions &amp; weekly reports
                </span>
                <span className="block text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  When disabled, Partners can still leave feedback and request revisions, while final approval stays Admin-only (enforced in Firestore rules).
                </span>
              </span>
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Weekly Report Due Day
                </label>
                <select
                  disabled={!canEditSettings}
                  value={weeklyReportDueDay}
                  onChange={(e) => setWeeklyReportDueDay(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 disabled:opacity-60"
                >
                  {['Thursday', 'Friday', 'Saturday', 'Sunday'].map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Inactivity Alert Threshold (Days)
                </label>
                <input
                  type="number"
                  disabled={!canEditSettings}
                  min={1}
                  max={30}
                  value={inactivityThresholdDays}
                  onChange={(e) => setInactivityThresholdDays(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 disabled:opacity-60"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Email / CII Website Integration Note
              </label>
              <textarea
                rows={2}
                disabled={!canEditSettings}
                value={emailProviderNote}
                onChange={(e) => setEmailProviderNote(e.target.value)}
                placeholder="Document SMTP/Trigger Email extension or CII website onboarding webhook configuration..."
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 disabled:opacity-60"
              />
            </div>

            {canEditSettings && (
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-900 dark:bg-emerald-600 text-white text-xs font-medium cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  {saving ? 'Saving...' : 'Save Settings'}
                </button>
              </div>
            )}
          </form>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3">
            <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
              <ShieldCheck className="w-4 h-4" />
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                External Integration Readiness
              </h2>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Account activations use invitation codes stored in Firestore (<span className="font-mono">/invitations</span>). Share generated activation URLs directly with approved CII applicants.
            </p>
            <div className="text-xs text-slate-600 dark:text-slate-300 space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
              <p className="font-semibold text-slate-800 dark:text-slate-200">
                Production Checklist:
              </p>
              <ul className="list-disc pl-4 space-y-1">
                <li>Enable Email/Password sign-in in Firebase Console Authentication.</li>
                <li>Configure Firebase Storage security rules for evidence uploads.</li>
                <li>Connect Firebase Trigger Email extension or SMTP webhook for automated invite emails.</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                Immutable System Audit Log ({filteredLogs.length})
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Append-only record of authentication, RBAC changes, submissions, reviews, and exports.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleExportLogsCsv}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                CSV
              </button>
              <button
                type="button"
                onClick={handleExportLogsPdf}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium cursor-pointer"
              >
                <FileDown className="w-3.5 h-3.5" />
                PDF
              </button>
            </div>
          </div>

          <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row gap-2.5">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                value={logSearch}
                onChange={(e) => setLogSearch(e.target.value)}
                placeholder="Filter by actor, action code, or summary..."
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
              />
            </div>

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as AuditCategory | 'all')}
              className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
            >
              <option value="all">All Categories</option>
              <option value="auth">Authentication</option>
              <option value="rbac">RBAC &amp; Invites</option>
              <option value="activity">Activities</option>
              <option value="checkin">Check-Ins</option>
              <option value="report">Weekly Reports</option>
              <option value="cohort">Cohorts</option>
              <option value="announcement">Announcements</option>
              <option value="export">Exports</option>
              <option value="settings">Settings</option>
            </select>

            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value as AuditSeverity | 'all')}
              className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
            >
              <option value="all">All Severities</option>
              <option value="info">Info</option>
              <option value="warning">Warning</option>
              <option value="critical">Critical</option>
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 text-slate-500 dark:text-slate-400">
                  <th className="py-2.5 px-4">Timestamp</th>
                  <th className="py-2.5 px-4">Actor</th>
                  <th className="py-2.5 px-4">Action</th>
                  <th className="py-2.5 px-4">Severity</th>
                  <th className="py-2.5 px-4">Summary</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400">
                      No audit entries match the current filters.
                    </td>
                  </tr>
                ) : (
                  filteredLogs.slice(0, 150).map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                      <td className="py-2.5 px-4 font-mono tabular-nums whitespace-nowrap text-slate-500 dark:text-slate-400">
                        {formatTimestamp(log.createdAt)}
                      </td>
                      <td className="py-2.5 px-4 whitespace-nowrap">
                        <span className="font-medium text-slate-900 dark:text-white">
                          {log.actorName}
                        </span>
                        <span className="block text-[11px] text-slate-400">
                          {ROLE_LABELS[normalizeRole(log.actorRole)]}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 font-mono text-[11px] text-slate-700 dark:text-slate-300">
                        {log.action}
                      </td>
                      <td className="py-2.5 px-4 uppercase font-mono text-[11px]">
                        <span
                          className={
                            log.severity === 'critical'
                              ? 'text-rose-600 dark:text-rose-400 font-semibold'
                              : log.severity === 'warning'
                                ? 'text-amber-600 dark:text-amber-400 font-semibold'
                                : 'text-slate-500 dark:text-slate-400'
                          }
                        >
                          {log.severity}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-slate-700 dark:text-slate-300">
                        {log.summary}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
