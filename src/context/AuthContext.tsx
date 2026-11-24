import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  confirmPasswordReset,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  User,
} from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase';
import {
  ensureUserProfile,
  subscribeToUserPrivateInfo,
  subscribeToUserProfile,
} from '../services/ciiService';
import { CanonicalRole, normalizeRole, UserPrivateInfo, UserProfile } from '../types';

interface AuthContextValue {
  firebaseUser: User | null;
  profile: UserProfile | null;
  privateInfo: UserPrivateInfo | null;
  role: CanonicalRole;
  loading: boolean;
  needsEmailVerification: boolean;
  authError: string | null;
  clearAuthError: () => void;
  signInWithGoogle: (inviteCode?: string) => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  activateWithEmail: (params: {
    email: string;
    password: string;
    displayName: string;
    phone?: string;
    inviteCode?: string;
  }) => Promise<void>;
  resendVerificationEmail: () => Promise<void>;
  refreshVerification: () => Promise<boolean>;
  requestPasswordReset: (email: string) => Promise<void>;
  confirmPasswordResetCode: (oobCode: string, newPassword: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function formatAuthError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  if (raw.includes('auth/invalid-credential') || raw.includes('auth/wrong-password')) {
    return 'Invalid email or password.';
  }
  if (raw.includes('auth/user-not-found')) {
    return 'No account found for that email address.';
  }
  if (raw.includes('auth/email-already-in-use')) {
    return 'An account with this email already exists. Please sign in instead.';
  }
  if (raw.includes('auth/operation-not-allowed')) {
    return 'Email/Password sign-in is not yet enabled in Firebase Console (Authentication > Sign-in method). You can enable it there or sign in with Google.';
  }
  if (raw.includes('auth/weak-password')) {
    return 'Password must be at least 6 characters.';
  }
  if (raw.includes('auth/invalid-action-code') || raw.includes('auth/expired-action-code')) {
    return 'This password reset link is invalid or has expired. Request a new link.';
  }
  if (raw.includes('auth/unauthorized-domain')) {
    const host = typeof window !== 'undefined' ? window.location.hostname : 'your Vercel domain';
    return `Domain "${host}" is not authorized for Firebase Authentication yet. Add "${host}" in Firebase Console → Authentication → Settings → Authorized domains (or use Email/Password sign-in while configuring your Firebase project).`;
  }
  return raw;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [privateInfo, setPrivateInfo] = useState<UserPrivateInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsEmailVerification, setNeedsEmailVerification] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [pendingInviteCode, setPendingInviteCode] = useState<string | undefined>(undefined);
  const unsubProfileRef = React.useRef<(() => void) | undefined>(undefined);
  const unsubPrivateRef = React.useRef<(() => void) | undefined>(undefined);

  const detachUserListeners = () => {
    if (unsubProfileRef.current) {
      unsubProfileRef.current();
      unsubProfileRef.current = undefined;
    }
    if (unsubPrivateRef.current) {
      unsubPrivateRef.current();
      unsubPrivateRef.current = undefined;
    }
  };

  const attachUserListeners = (uid: string) => {
    detachUserListeners();
    unsubProfileRef.current = subscribeToUserProfile(uid, (nextProfile) => {
      if (nextProfile) setProfile(nextProfile);
    });
    unsubPrivateRef.current = subscribeToUserPrivateInfo(uid, (nextPriv) => {
      setPrivateInfo(nextPriv);
    });
  };

  const syncVerifiedUser = async (user: User, inviteCode?: string, phone?: string) => {
    const synced = await ensureUserProfile(user, { inviteCode, phone });
    setProfile(synced);
    setNeedsEmailVerification(false);
    attachUserListeners(user.uid);
  };

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      detachUserListeners();
      setFirebaseUser(user);
      setAuthError(null);

      if (!user) {
        setProfile(null);
        setPrivateInfo(null);
        setNeedsEmailVerification(false);
        setLoading(false);
        return;
      }

      if (!user.emailVerified) {
        setNeedsEmailVerification(true);
        setProfile(null);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const code = pendingInviteCode || sessionStorage.getItem('cii_pending_invite') || undefined;
        const phone = sessionStorage.getItem('cii_pending_phone') || undefined;
        await syncVerifiedUser(user, code, phone);
        sessionStorage.removeItem('cii_pending_invite');
        sessionStorage.removeItem('cii_pending_phone');
        setPendingInviteCode(undefined);
      } catch (err) {
        setAuthError(formatAuthError(err));
      } finally {
        setLoading(false);
      }
    });

    return () => {
      unsubAuth();
      detachUserListeners();
    };
  }, []);

  const signInWithGoogle = async (inviteCode?: string) => {
    setAuthError(null);
    if (inviteCode) {
      sessionStorage.setItem('cii_pending_invite', inviteCode.trim());
      setPendingInviteCode(inviteCode.trim());
    }
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes('popup-closed-by-user')) {
        setAuthError(formatAuthError(err));
      }
    }
  };

  const signInWithEmail = async (email: string, password: string) => {
    setAuthError(null);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (err) {
      const formatted = formatAuthError(err);
      setAuthError(formatted);
      throw new Error(formatted);
    }
  };

  const activateWithEmail = async (params: {
    email: string;
    password: string;
    displayName: string;
    phone?: string;
    inviteCode?: string;
  }) => {
    setAuthError(null);
    if (params.inviteCode) {
      sessionStorage.setItem('cii_pending_invite', params.inviteCode.trim());
      setPendingInviteCode(params.inviteCode.trim());
    }
    if (params.phone?.trim()) {
      sessionStorage.setItem('cii_pending_phone', params.phone.trim());
    }
    try {
      const cred = await createUserWithEmailAndPassword(auth, params.email.trim(), params.password);
      await updateProfile(cred.user, { displayName: params.displayName.trim() });
      await sendEmailVerification(cred.user);
      setNeedsEmailVerification(true);
    } catch (err) {
      const formatted = formatAuthError(err);
      setAuthError(formatted);
      throw new Error(formatted);
    }
  };

  const resendVerificationEmail = async () => {
    if (!auth.currentUser) return;
    await sendEmailVerification(auth.currentUser);
  };

  const refreshVerification = async (): Promise<boolean> => {
    if (!auth.currentUser) return false;
    await auth.currentUser.reload();
    const updated = auth.currentUser;
    if (updated.emailVerified) {
      setLoading(true);
      try {
        const code = pendingInviteCode || sessionStorage.getItem('cii_pending_invite') || undefined;
        const phone = sessionStorage.getItem('cii_pending_phone') || undefined;
        await syncVerifiedUser(updated, code, phone);
        sessionStorage.removeItem('cii_pending_invite');
        sessionStorage.removeItem('cii_pending_phone');
        setPendingInviteCode(undefined);
      } finally {
        setLoading(false);
      }
      return true;
    }
    return false;
  };

  const requestPasswordReset = async (email: string) => {
    setAuthError(null);
    try {
      await sendPasswordResetEmail(auth, email.trim(), {
        url: `${window.location.origin}/login`,
      });
    } catch (err) {
      const formatted = formatAuthError(err);
      setAuthError(formatted);
      throw new Error(formatted);
    }
  };

  const confirmPasswordResetCode = async (oobCode: string, newPassword: string) => {
    setAuthError(null);
    try {
      await confirmPasswordReset(auth, oobCode, newPassword);
    } catch (err) {
      const formatted = formatAuthError(err);
      setAuthError(formatted);
      throw new Error(formatted);
    }
  };

  const logout = async () => {
    setAuthError(null);
    sessionStorage.removeItem('cii_pending_invite');
    sessionStorage.removeItem('cii_pending_phone');
    detachUserListeners();
    await signOut(auth);
  };

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        profile,
        privateInfo,
        role: normalizeRole(profile?.role),
        loading,
        needsEmailVerification,
        authError,
        clearAuthError: () => setAuthError(null),
        signInWithGoogle,
        signInWithEmail,
        activateWithEmail,
        resendVerificationEmail,
        refreshVerification,
        requestPasswordReset,
        confirmPasswordResetCode,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
