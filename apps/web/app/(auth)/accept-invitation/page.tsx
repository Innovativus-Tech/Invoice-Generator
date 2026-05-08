'use client';

import React, { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowRight, Building2, Lock, Mail, ShieldCheck, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import apiClient from '@/lib/api-client';
import { useAuth } from '@/hooks/use-auth';
import { toast } from 'sonner';

interface InvitationPreview {
  email: string;
  role: 'admin' | 'staff';
  org: { id: string; name: string };
}

function AcceptInvitationContent() {
  const params = useSearchParams();
  const router = useRouter();
  const { setSession } = useAuth();
  const token = params.get('token') || '';
  const [invitation, setInvitation] = useState<InvitationPreview | null>(null);
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!token) {
      setFetching(false);
      return;
    }

    apiClient
      .get(`/auth/invitation/${encodeURIComponent(token)}`)
      .then(({ data }) => setInvitation(data.data))
      .catch(() => toast.error('Invitation is invalid or expired'))
      .finally(() => setFetching(false));
  }, [token]);

  const handleAccept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    try {
      const { data } = await apiClient.post('/auth/accept-invitation', {
        token,
        password,
        full_name: fullName,
      });
      if (data.data?.session) {
        await setSession(data.data.session);
        toast.success('Invitation accepted.');
        router.push('/dashboard');
      }
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message || 'Could not accept invitation';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface px-6 py-12 dark:bg-[#0F0E17]">
      <div className="w-full max-w-md rounded-lg border border-border bg-white p-6 dark:bg-card">
        <div className="h-11 w-11 rounded-lg bg-primary flex items-center justify-center text-white mb-5">
          <Building2 className="h-5 w-5" />
        </div>

        <h1 className="text-2xl font-bold text-text-1">Accept invitation</h1>
        {fetching ? (
          <div className="mt-6 space-y-3">
            <div className="h-12 rounded bg-border/40 animate-pulse" />
            <div className="h-12 rounded bg-border/30 animate-pulse" />
          </div>
        ) : !invitation ? (
          <div className="mt-6">
            <p className="text-sm text-text-2">This invitation link is invalid or expired.</p>
            <Link href="/login" className="mt-5 inline-flex text-sm font-medium text-primary">Back to login</Link>
          </div>
        ) : (
          <>
            <div className="mt-5 rounded-lg border border-border bg-surface p-4 dark:bg-[#0F0E17]">
              <div className="flex items-start gap-3">
                <ShieldCheck className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="font-semibold text-text-1">{invitation.org.name}</p>
                  <p className="text-sm text-text-2">{invitation.email}</p>
                  <span className="mt-2 inline-flex rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-700">
                    {invitation.role}
                  </span>
                </div>
              </div>
            </div>

            <form onSubmit={handleAccept} className="mt-6 space-y-5">
              <Input label="Full Name" value={fullName} onChange={(e) => setFullName(e.target.value)} icon={<User className="h-4 w-4" />} required />
              <Input label="Email" value={invitation.email} icon={<Mail className="h-4 w-4" />} disabled />
              <Input label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} icon={<Lock className="h-4 w-4" />} required />
              <Input label="Confirm Password" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} icon={<Lock className="h-4 w-4" />} required />
              <Button type="submit" loading={loading} className="w-full" size="lg">
                Accept Invitation & Join
                <ArrowRight className="h-4 w-4" />
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

export default function AcceptInvitationPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-surface dark:bg-[#0F0E17]" />}>
      <AcceptInvitationContent />
    </Suspense>
  );
}
