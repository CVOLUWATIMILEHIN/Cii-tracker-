export const BLUEPRINT_LIMITS = {
  idPattern: /^[a-zA-Z0-9_-]+$/,
  idMaxLength: 128,
  codePattern: /^[A-Z0-9-]+$/,
  codeMinLength: 2,
  codeMaxLength: 24,
  datePattern: /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/,
  weekKeyPattern: /^[0-9]{4}-W[0-9]{2}$/,
  displayNameMaxLength: 100,
  departmentMaxLength: 64,
  emailMaxLength: 160,
  titleMinLength: 3,
  titleMaxLength: 140,
  descriptionMaxLength: 1000,
  instructionsMaxLength: 2000,
  responseMaxLength: 2000,
  reportFieldMaxLength: 1500,
  feedbackMaxLength: 1000,
  summaryMaxLength: 280,
  maxUploadBytes: 5 * 1024 * 1024, // 5 MB
} as const;

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

export function sanitizeString(value: string, maxLength: number): string {
  return value.trim().slice(0, maxLength);
}

export function sanitizeId(value: string): string {
  const cleaned = value.trim().replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, BLUEPRINT_LIMITS.idMaxLength);
  return cleaned || 'id-0';
}

export function sanitizeCode(value: string): string {
  const cleaned = value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, '-')
    .slice(0, BLUEPRINT_LIMITS.codeMaxLength);
  return cleaned.length >= 3 ? cleaned : `CII-${cleaned.padEnd(3, '0')}`;
}

export function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}

export function getTodayDateKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function getIsoWeekInfo(date = new Date()): { weekKey: string; weekLabel: string } {
  const temp = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = temp.getUTCDay() || 7;
  temp.setUTCDate(temp.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(temp.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((temp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  const weekKey = `${temp.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
  const weekLabel = `Week ${weekNo}, ${temp.getUTCFullYear()}`;
  return { weekKey, weekLabel };
}

export function validateEvidenceFile(file: File): string | null {
  if (file.size > BLUEPRINT_LIMITS.maxUploadBytes) {
    return 'File exceeds the 5 MB upload limit.';
  }
  if (file.type && !ALLOWED_MIME_TYPES.has(file.type)) {
    return 'Allowed formats: PDF, PNG, JPG, WEBP, TXT, DOC, DOCX.';
  }
  return null;
}

export function isActivityAssignedToMember(
  activity: {
    status: string;
    assignmentScope: 'all' | 'cohort' | 'selected';
    cohortId: string;
    assignedMemberIds: string[];
  },
  memberUid: string,
  memberCohortId: string
): boolean {
  if (activity.status !== 'published') return false;
  if (activity.assignmentScope === 'all') return true;
  if (activity.assignmentScope === 'cohort') {
    return Boolean(memberCohortId) && activity.cohortId === memberCohortId;
  }
  return activity.assignedMemberIds.includes(memberUid);
}

export function isSafeHttpUrl(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return true;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

export function getSafeExternalUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return parsed.toString();
    }
    return null;
  } catch {
    return null;
  }
}

export function getSafeInternalRedirect(
  raw: string | null | undefined,
  fallback: string,
  requiredPrefix?: string
): string {
  if (!raw) return fallback;
  const trimmed = raw.trim();
  if (!trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.includes('\\')) {
    return fallback;
  }
  if (requiredPrefix && !trimmed.startsWith(requiredPrefix)) {
    return fallback;
  }
  return trimmed;
}

