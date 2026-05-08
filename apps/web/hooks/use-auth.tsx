'use client';

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import apiClient from '@/lib/api-client';
import type { AuthUser } from '@/types';

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  refreshUser: () => Promise<AuthUser | null>;
  setSession: (session: { access_token: string; refresh_token?: string | null }) => Promise<AuthUser | null>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function readStoredUser() {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem('auth_user');
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

function toAuthUser(payload: any): AuthUser {
  return {
    id: payload.id,
    email: payload.email || '',
    full_name: payload.full_name || payload.profile?.business_name || payload.email || '',
    org_id: payload.org?.id || payload.org_id || '',
    org_name: payload.org?.name || payload.org_name || 'Organization',
    role: payload.org?.role || payload.role || 'staff',
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = async () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
    if (!token) {
      setUser(null);
      setLoading(false);
      return null;
    }

    try {
      const { data } = await apiClient.get('/auth/me');
      const authUser = toAuthUser(data.data);
      setUser(authUser);
      localStorage.setItem('auth_user', JSON.stringify(authUser));
      return authUser;
    } catch {
      setUser(null);
      localStorage.removeItem('auth_user');
      return null;
    } finally {
      setLoading(false);
    }
  };

  const setSession = async (session: { access_token: string; refresh_token?: string | null }) => {
    localStorage.setItem('access_token', session.access_token);
    if (session.refresh_token) localStorage.setItem('refresh_token', session.refresh_token);
    return refreshUser();
  };

  const logout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('auth_user');
    setUser(null);
    window.location.href = '/login';
  };

  useEffect(() => {
    // Hydrate from localStorage first (avoids SSR mismatch), then fetch fresh data
    const stored = readStoredUser();
    if (stored) setUser(stored);
    refreshUser();
  }, []);

  const value = useMemo(
    () => ({ user, loading, refreshUser, setSession, logout }),
    [user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
