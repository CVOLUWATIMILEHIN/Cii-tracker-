import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Clock, ExternalLink, Upload } from 'lucide-react';
import { AppShell } from '../../components/AppShell';
import { SubmissionStatusLabel } from '../../components/StatusText';
import { useAuth } from '../../context/AuthContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { formatTimestamp } from '../../lib/exportReports';
import {
  getSafeExternalUrl,
  isActivityAssignedToMember,
  isSafeHttpUrl,
  validateEvidenceFile,
} from '../../lib/validators';
import { saveActivitySubmission, uploadEvidenceFile } from '../../services/ciiService';

export function MemberActivityDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { profile } = useAuth();
  const { activities, submissions } = useWorkspace();

  const activity = activities.find((a) => a.id === id) || null;
  const existing = submissions.find((s) => s.activityId === id) || null;

  const [progress, setProgress] = useState(0);
  const [responseText, setResponseText] = useState('');
  const [evidenceUrl, setEvidenceUrl] = useState('');
  const [evidenceName, setEvidenceName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (existing) {
      setProgress(existing.progress);
      setResponseText(existing.responseText);
      setEvidenceUrl(existing.evidenceUrl);
      setEvidenceName(existing.evidenceName);
    }
  }, [existing]);

  if (!profile) return null;

  const isAssigned = activity
    ? isActivityAssignedToMember(activity, profile.uid, profile.cohortId)
    : false;

  if (!activity || !isAssigned) {
    return (
      <AppShell title="Activity Unavailable" breadcrumb="Corps Member / Activities /">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-8 text-center space-y-3">
          <p className="text-sm font-medium text-slate-900 dark:text-white">
            This activity is either not assigned to your cohort or is no longer published.
          </p>
          <Link
            to="/community/cii/activities"
            className="inline-block px-4 py-2 rounded-lg bg-slate-900 dark:bg-emerald-600 text-white text-xs font-medium"
          >
            Back to Activities
          </Link>
        </div>
      </AppShell>
    );
  }

  const isLocked = existing?.status === 'approved';

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    const validationErr = validateEvidenceFile(file);
    if (validationErr) {
      setError(validationErr);
      return;
    }
    setUploading(true);
    try {
      const uploaded = await uploadEvidenceFile(profile.uid, activity.id, file);
      setEvidenceUrl(uploaded.evidenceUrl);
      setEvidenceName(uploaded.evidenceName);
      setSuccess(`Uploaded evidence: ${uploaded.evidenceName}`);
    } catch (err) {
      setError(
        err instanceof Error
          ? `File upload failed (${err.message}). You may also attach an evidence link below if Firebase Storage rules are not configured yet.`
          : 'File upload failed.'
      );
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async (submitNow: boolean) => {
    setError(null);
    setSuccess(null);

    if (evidenceUrl.trim() && !isSafeHttpUrl(evidenceUrl)) {
      setError('Evidence link must be a valid https:// or http:// URL.');
      return;
    }
    if (submitNow && responseText.trim().length < 10) {
      setError('Please enter a detailed activity response (at least 10 characters) before submitting.');
      return;
    }
    if (submitNow && activity.evidenceRequired && !evidenceUrl.trim()) {
      setError('Supporting evidence is required for this activity. Upload a file before submitting.');
      return;
    }

    setSaving(true);
    try {
      await saveActivitySubmission({
        actor: profile,
        activity,
        existing,
        progress: submitNow ? 100 : progress,
        responseText,
        evidenceUrl,
        evidenceName,
        submitNow,
      });
      setSuccess(
        submitNow
          ? 'Activity response submitted for review.'
          : 'Activity progress saved.'
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save activity submission.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell title={activity.title} breadcrumb={`Activities / ${activity.code} /`}>
      <div className="max-w-4xl mx-auto space-y-6">
        <Link
          to="/community/cii/activities"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 dark:hover:text-white"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Assigned Activities
        </Link>

        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span className="font-mono font-semibold text-emerald-700 dark:text-emerald-400">
              {activity.code} · {activity.pillar}
            </span>
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1 font-mono tabular-nums">
                <Clock className="w-3.5 h-3.5" />
                Deadline: {activity.deadline}
              </span>
              {existing && <SubmissionStatusLabel status={existing.status} />}
            </div>
          </div>

          <h2 className="text-xl font-bold text-slate-900 dark:text-white">{activity.title}</h2>
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            {activity.description}
          </p>

          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
            <h3 className="text-xs font-semibold text-slate-800 dark:text-slate-200">
              Instructions & Requirements
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-line leading-relaxed">
              {activity.instructions || 'Follow standard CII activity completion guidelines.'}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 pt-1">
              Evidence Required: <span className="font-medium">{activity.evidenceRequired ? 'Yes' : 'Optional'}</span> ·{' '}
              Review Required: <span className="font-medium">{activity.reviewRequired ? 'Yes' : 'Self-verified'}</span>
            </p>
          </div>
        </section>

        {existing?.feedbackText && (
          <section className="bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl p-5 space-y-1.5">
            <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">
              Reviewer Feedback · {existing.reviewedByName || 'Reviewer'} ({formatTimestamp(existing.updatedAt)})
            </p>
            <p className="text-sm text-amber-900 dark:text-amber-100">{existing.feedbackText}</p>
          </section>
        )}

        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">
              Your Activity Submission
            </h3>
            {isLocked && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-4 h-4" />
                Approved & Locked
              </span>
            )}
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300">
              {error}
            </div>
          )}

          {success && (
            <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-700 dark:text-emerald-300">
              {success}
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                Completion Progress
              </label>
              <span className="text-xs font-mono tabular-nums font-semibold text-emerald-700 dark:text-emerald-400">
                {progress}%
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              disabled={isLocked}
              value={progress}
              onChange={(e) => setProgress(Number(e.target.value))}
              className="w-full accent-emerald-600 cursor-pointer disabled:opacity-60"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Activity Response & Impact Summary
            </label>
            <textarea
              rows={5}
              disabled={isLocked}
              maxLength={2000}
              value={responseText}
              onChange={(e) => setResponseText(e.target.value)}
              placeholder="Describe actions taken, participants reached, outcomes achieved, and next steps..."
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 disabled:opacity-60"
            />
          </div>

          <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
              Supporting Evidence {activity.evidenceRequired ? '(Required)' : '(Optional)'}
            </label>

            <div className="flex flex-wrap items-center gap-3">
              <label className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer">
                <Upload className="w-3.5 h-3.5" />
                <span>{uploading ? 'Uploading...' : 'Upload Evidence File (Max 5MB)'}</span>
                <input
                  type="file"
                  disabled={isLocked || uploading}
                  onChange={handleFileChange}
                  accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.doc,.docx"
                  className="sr-only"
                />
              </label>

              {getSafeExternalUrl(evidenceUrl) && (
                <a
                  href={getSafeExternalUrl(evidenceUrl) || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400 hover:underline"
                >
                  <span>{evidenceName || 'Attached Evidence'}</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>

            {!isLocked && (
              <input
                type="url"
                value={evidenceUrl}
                onChange={(e) => {
                  setEvidenceUrl(e.target.value);
                  if (!evidenceName) setEvidenceName('External Evidence Link');
                }}
                placeholder="Or paste verified document URL (https://...)"
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
              />
            )}
          </div>

          {!isLocked && (
            <div className="flex flex-wrap items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                disabled={saving || uploading}
                onClick={() => handleSave(false)}
                className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer disabled:opacity-50"
              >
                Save Progress
              </button>
              <button
                type="button"
                disabled={saving || uploading}
                onClick={() => handleSave(true)}
                className="px-4 py-2 rounded-lg bg-slate-900 dark:bg-emerald-600 hover:bg-slate-800 dark:hover:bg-emerald-500 text-white text-sm font-medium cursor-pointer disabled:opacity-50"
              >
                {existing?.status === 'revision_requested'
                  ? 'Resubmit for Review'
                  : 'Submit Activity'}
              </button>
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
