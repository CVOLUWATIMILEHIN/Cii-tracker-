/**
 * Security Rule Verification Harness for CII Accountability Tracker
 * Verifies the "Dirty Dozen" adversarial payloads against DRAFT_firestore.rules / firestore.rules.
 */

export interface DirtyDozenScenario {
  id: number;
  name: string;
  collection: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  expectedOutcome: 'PERMISSION_DENIED';
  rationale: string;
}

export const DIRTY_DOZEN_SCENARIOS: DirtyDozenScenario[] = [
  {
    id: 1,
    name: 'Unauthenticated Access',
    collection: 'initiatives',
    operation: 'get',
    expectedOutcome: 'PERMISSION_DENIED',
    rationale: 'Global safety net and isSignedIn() reject null auth.',
  },
  {
    id: 2,
    name: 'Unverified Email Admin Spoof',
    collection: 'users',
    operation: 'update',
    expectedOutcome: 'PERMISSION_DENIED',
    rationale: 'isVerified() mandates request.auth.token.email_verified == true.',
  },
  {
    id: 3,
    name: 'Self-Assigned Admin Role on Registration',
    collection: 'users',
    operation: 'create',
    expectedOutcome: 'PERMISSION_DENIED',
    rationale: 'Self-registration forces role == "user" unless bootstrapped admin.',
  },
  {
    id: 4,
    name: 'Role Escalation via Profile Update',
    collection: 'users',
    operation: 'update',
    expectedOutcome: 'PERMISSION_DENIED',
    rationale: 'Tier 2 owner update restricts affectedKeys to displayName, department, updatedAt.',
  },
  {
    id: 5,
    name: 'Shadow Field Injection',
    collection: 'initiatives',
    operation: 'create',
    expectedOutcome: 'PERMISSION_DENIED',
    rationale: 'isValidInitiative() enforces keys().hasOnly(...) rejecting undeclared fields.',
  },
  {
    id: 6,
    name: 'PII Private Info Snooping',
    collection: 'users/{userId}/private',
    operation: 'get',
    expectedOutcome: 'PERMISSION_DENIED',
    rationale: 'Isolated PII subcollection allows get only for owner or verified admin.',
  },
  {
    id: 7,
    name: 'Cross-User Initiative Modification',
    collection: 'initiatives',
    operation: 'update',
    expectedOutcome: 'PERMISSION_DENIED',
    rationale: 'Standard users cannot update initiatives where they are neither owner nor assignee.',
  },
  {
    id: 8,
    name: 'Terminal State Modification (Completed)',
    collection: 'initiatives',
    operation: 'update',
    expectedOutcome: 'PERMISSION_DENIED',
    rationale: 'Non-admin updates require existing().status != "completed".',
  },
  {
    id: 9,
    name: 'Value Poisoning & Oversized Payloads',
    collection: 'initiatives',
    operation: 'create',
    expectedOutcome: 'PERMISSION_DENIED',
    rationale: 'Strict size bounds, numeric range [0..100], and regex ID guards reject oversized inputs.',
  },
  {
    id: 10,
    name: 'Audit Log Tampering / Forgery',
    collection: 'audit_logs',
    operation: 'delete',
    expectedOutcome: 'PERMISSION_DENIED',
    rationale: 'Audit logs enforce allow update, delete: if false and actorId == request.auth.uid.',
  },
  {
    id: 11,
    name: 'Orphaned Engagement Event',
    collection: 'engagement_events',
    operation: 'create',
    expectedOutcome: 'PERMISSION_DENIED',
    rationale: 'Global consistency check requires exists() on the referenced initiativeId.',
  },
  {
    id: 12,
    name: 'Client Timestamp Forgery',
    collection: 'audit_logs',
    operation: 'create',
    expectedOutcome: 'PERMISSION_DENIED',
    rationale: 'Temporal integrity mandates createdAt == request.time (serverTimestamp).',
  },
];
