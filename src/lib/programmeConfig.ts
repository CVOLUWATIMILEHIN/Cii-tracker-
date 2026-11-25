const DEFAULT_OWNER_EMAIL = 'olosundelouis@gmail.com';

const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env || {};

// Must match the owner email in firestore.rules (isProjectOwnerBootstrap).
export const PROJECT_OWNER_EMAIL = (env.VITE_PROJECT_OWNER_EMAIL || DEFAULT_OWNER_EMAIL)
  .trim()
  .toLowerCase();

export function isProjectOwnerEmail(email: string | null | undefined): boolean {
  return Boolean(email) && email!.trim().toLowerCase() === PROJECT_OWNER_EMAIL;
}
