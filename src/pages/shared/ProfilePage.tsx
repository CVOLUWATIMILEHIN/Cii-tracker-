import React, { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import { AppShell } from '../../components/AppShell';
import { useAuth } from '../../context/AuthContext';
import { updateOwnProfile } from '../../services/ciiService';
import { ROLE_LABELS } from '../../types';

export function ProfilePage() {
  const { profile, privateInfo, firebaseUser, role } = useAuth();
  const [displayName, setDisplayName] = useState(profile?.displayName || '');
  const [stateCode, setStateCode] = useState(profile?.stateCode || '');
  const [ppa, setPpa] = useState(profile?.ppa || '');
  const [department, setDepartment] = useState(profile?.department || '');
  const [phone, setPhone] = useState(privateInfo?.phone || '');
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.displayName);
      setStateCode(profile.stateCode);
      setPpa(profile.ppa);
      setDepartment(profile.department);
    }
    if (privateInfo) {
      setPhone(privateInfo.phone);
    }
  }, [profile, privateInfo]);

  if (!profile) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSavedMsg(null);
    setError(null);
    try {
      await updateOwnProfile({
        actor: profile,
        displayName,
        stateCode,
        ppa,
        department,
        phone,
      });
      setSavedMsg('Profile saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell title="My Profile">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-2">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">
            Account Overview
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-600 dark:text-slate-300 pt-2">
            <div>
              <span className="text-slate-400">Email:</span>{' '}
              <span className="font-medium">{privateInfo?.email || firebaseUser?.email}</span>
            </div>
            <div>
              <span className="text-slate-400">Role:</span>{' '}
              <span className="font-medium">{ROLE_LABELS[role]}</span>
            </div>
            <div>
              <span className="text-slate-400">Assigned Cohort:</span>{' '}
              <span className="font-medium">{profile.cohortName || 'Unassigned'}</span>
            </div>
            <div>
              <span className="text-slate-400">Accountability Partner:</span>{' '}
              <span className="font-medium">{profile.partnerName || 'Unassigned'}</span>
            </div>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4"
        >
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">
            Personal & Service Details
          </h2>

          {savedMsg && (
            <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
              {savedMsg}
            </p>
          )}
          {error && (
            <p className="text-xs font-medium text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Full Name
              </label>
              <input
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={100}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Phone Number
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                maxLength={32}
                placeholder="+234..."
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                NYSC State Code
              </label>
              <input
                type="text"
                value={stateCode}
                onChange={(e) => setStateCode(e.target.value.toUpperCase())}
                maxLength={32}
                placeholder="e.g., LA/26A/1024"
                className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Department / CDS Group
              </label>
              <input
                type="text"
                required
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                maxLength={64}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Place of Primary Assignment (PPA)
            </label>
            <input
              type="text"
              value={ppa}
              onChange={(e) => setPpa(e.target.value)}
              maxLength={120}
              placeholder="Organization or school name"
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
            />
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 dark:bg-emerald-600 text-white text-sm font-medium disabled:opacity-60 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save Profile'}
            </button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}
