# Security Specification — CII Accountability Tracker (Corper Impact Initiative)

## 1. Data Invariants
1. **Verified Identity**: All authenticated writes require `request.auth != null && request.auth.token.email_verified == true`.
2. **Non-Self-Escalation**: Standard self-registration creates `role == 'member'` only. `admin` and `partner` roles require either the bootstrapped administrator email (`olosundelouis@gmail.com`) or an Admin-issued invitation in `/invitations/{inviteId}` matched to the caller's verified email, or an existing Admin's update on `/users/{userId}`.
3. **Caseload Isolation (Partner)**: Accountability Partners can only read, list, review, or record follow-ups for Corps Members whose `partnerId == request.auth.uid`.
4. **Member Isolation**: Corps Members can only read/write their own submissions, daily check-ins, weekly reports, notifications, and private PII (`/users/{uid}/private/info`).
5. **Configurable Review Approval Gate**: Partners cannot set submission `status == 'approved'` or weekly report `status == 'reviewed'` unless `/settings/programme.partnerCanApproveReports == true`.
6. **Duplicate Daily Check-In Prevention**: Daily check-ins use deterministic IDs (`{memberId}_{YYYY-MM-DD}`) and immutable `checkinDate` after creation.
7. **Immutable Audit Logs**: `/audit_logs/{logId}` blocks all `update` and `delete` operations for every role, including administrators.
8. **PII Isolation**: User email and phone reside strictly in `/users/{userId}/private/info`, accessible only to the owner and administrators.
