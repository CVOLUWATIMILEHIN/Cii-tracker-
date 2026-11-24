import React, { useState } from 'react';
import { Megaphone, Send, Trash2 } from 'lucide-react';
import { AppShell } from '../../components/AppShell';
import { useAuth } from '../../context/AuthContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { formatTimestamp } from '../../lib/exportReports';
import { createAnnouncement, deleteAnnouncement } from '../../services/ciiService';
import { Announcement, AnnouncementTarget, isFullAdminRole } from '../../types';

export function AdminAnnouncementsPage() {
  const { profile } = useAuth();
  const { announcements, cohorts, users } = useWorkspace();

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [targetRole, setTargetRole] = useState<AnnouncementTarget>('all');
  const [cohortId, setCohortId] = useState('');
  const [priority, setPriority] = useState<'normal' | 'important'>('normal');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  if (!profile) return null;

  const isFullAdmin = isFullAdminRole(profile.role);

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!title.trim() || !body.trim()) {
      setError('Both title and announcement message are required.');
      return;
    }
    if (!isFullAdmin && !cohortId) {
      setError('Programme Managers must select one of their assigned cohorts.');
      return;
    }

    setSubmitting(true);
    try {
      await createAnnouncement({
        actor: profile,
        title,
        body,
        targetRole,
        cohortId,
        priority,
        users,
      });
      setTitle('');
      setBody('');
      setCohortId('');
      setPriority('normal');
      setSuccess('Announcement published and in-app notifications dispatched.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to publish announcement.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (item: Announcement) => {
    await deleteAnnouncement(item, profile);
  };

  return (
    <AppShell title="Announcements" breadcrumb="Admin /">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <form
            onSubmit={handlePublish}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4"
          >
            <div className="flex items-center gap-2">
              <Megaphone className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                Publish Announcement
              </h2>
            </div>

            {error && (
              <p className="text-xs text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 p-2.5 rounded-lg">
                {error}
              </p>
            )}
            {success && (
              <p className="text-xs text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 p-2.5 rounded-lg">
                {success}
              </p>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Headline
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Friday Weekly Report Submission Reminder"
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Message Body
              </label>
              <textarea
                required
                rows={4}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Enter official CII programme update or guidance..."
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Target Audience
                </label>
                <select
                  value={targetRole}
                  onChange={(e) => setTargetRole(e.target.value as AnnouncementTarget)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                >
                  <option value="all">All Roles</option>
                  <option value="member">Corps Members</option>
                  <option value="partner">Accountability Partners</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Priority
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as 'normal' | 'important')}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                >
                  <option value="normal">Normal</option>
                  <option value="important">Important</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                {isFullAdmin ? 'Cohort Filter (Optional)' : 'Target Cohort (Required)'}
              </label>
              <select
                required={!isFullAdmin}
                value={cohortId}
                onChange={(e) => setCohortId(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
              >
                <option value="">
                  {isFullAdmin ? 'All Cohorts' : 'Select an assigned cohort...'}
                </option>
                {cohorts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} — {c.name}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg bg-slate-900 dark:bg-emerald-600 text-white text-xs font-medium hover:opacity-95 disabled:opacity-50 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              {submitting ? 'Publishing...' : 'Publish Announcement'}
            </button>
          </form>
        </div>

        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              Published Broadcasts ({announcements.length})
            </h2>
          </div>

          {announcements.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-8 text-center text-xs text-slate-500 dark:text-slate-400">
              No announcements have been published yet.
            </div>
          ) : (
            announcements.map((ann) => {
              const cohortName = cohorts.find((c) => c.id === ann.cohortId)?.name;
              return (
                <div
                  key={ann.id}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-2.5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2 text-[11px]">
                        <span
                          className={
                            ann.priority === 'important'
                              ? 'font-semibold text-amber-600 dark:text-amber-400 uppercase'
                              : 'font-medium text-slate-500 dark:text-slate-400 uppercase'
                          }
                        >
                          {ann.priority}
                        </span>
                        <span className="text-slate-300 dark:text-slate-700">·</span>
                        <span className="text-slate-500 dark:text-slate-400 capitalize">
                          Audience: {ann.targetRole === 'all' ? 'All Roles' : `${ann.targetRole}s`}
                        </span>
                        {cohortName && (
                          <>
                            <span className="text-slate-300 dark:text-slate-700">·</span>
                            <span className="text-slate-500 dark:text-slate-400">{cohortName}</span>
                          </>
                        )}
                      </div>
                      <h3 className="text-sm font-semibold text-slate-900 dark:text-white mt-1">
                        {ann.title}
                      </h3>
                    </div>

                    {(isFullAdmin ||
                      (ann.cohortId !== '' &&
                        (profile.assignedCohortIds || []).includes(ann.cohortId))) && (
                      <button
                        type="button"
                        onClick={() => handleDelete(ann)}
                        aria-label="Delete announcement"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                    {ann.body}
                  </p>

                  <p className="text-[11px] text-slate-400">
                    Posted by {ann.createdByName} · {formatTimestamp(ann.createdAt)}
                  </p>
                </div>
              );
            })
          )}
        </div>
      </div>
    </AppShell>
  );
}
