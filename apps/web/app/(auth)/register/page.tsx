'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, Building2, Lock, Mail, User, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import apiClient from '@/lib/api-client';
import { extractInvitationToken } from '@/lib/invitations';
import { useAuth } from '@/hooks/use-auth';
import { toast } from 'sonner';

type Mode = 'choose' | 'create' | 'join';

export default function RegisterPage() {
  const router = useRouter();
  const { setSession } = useAuth();
  const [mode, setMode] = useState<Mode>('choose');
  const [orgName, setOrgName] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [inviteValue, setInviteValue] = useState('');
  const [loading, setLoading] = useState(false);

  const validatePasswords = () => {
    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return false;
    }
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return false;
    }
    return true;
  };

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validatePasswords()) return;

    setLoading(true);
    try {
      const { data } = await apiClient.post('/auth/register-org', {
        org_name: orgName,
        email,
        password,
        full_name: fullName,
      });
      if (data.data?.session) {
        await setSession(data.data.session);
        toast.success('Organization created.');
        router.push('/dashboard');
      }
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message || 'Registration failed';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    const token = extractInvitationToken(inviteValue);
    if (!token) {
      toast.error('Enter an invitation token');
      return;
    }
    router.push(`/accept-invitation?token=${encodeURIComponent(token)}`);
  };

  return (
    <div className="min-h-screen flex bg-surface dark:bg-[#0F0E17]">
      <div className="hidden lg:flex lg:w-[42%] bg-[#1A1825] text-white px-14 py-12 flex-col justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center">
            <Building2 className="h-5 w-5" />
          </div>
          <span className="text-xl font-semibold">QuickInvoice</span>
        </div>
        <div>
          <h1 className="text-4xl font-semibold leading-tight">Start with an organization.</h1>
          <p className="mt-4 text-white/70 max-w-md">
            Create a shared billing workspace as the owner, or join a team with an invitation.
          </p>
        </div>
        <div className="text-sm text-white/50">RBAC-ready from day one</div>
      </div>

      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-xl">
          <h2 className="text-2xl font-bold text-text-1">
            {mode === 'choose' ? 'Create or join' : mode === 'create' ? 'Create organization' : 'Join organization'}
          </h2>
          <p className="text-text-2 mt-1 mb-8">Set up your QuickInvoice access.</p>

          {mode === 'choose' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                onClick={() => setMode('create')}
                className="rounded-lg border border-border bg-white p-6 text-left hover:border-primary hover:shadow-md transition-all dark:bg-card"
              >
                <Building2 className="h-9 w-9 text-primary mb-5" />
                <h3 className="text-xl font-semibold text-text-1">Create Organization</h3>
                <p className="text-sm text-text-2 mt-3">Start fresh as an owner</p>
              </button>
              <button
                onClick={() => setMode('join')}
                className="rounded-lg border border-border bg-white p-6 text-left hover:border-primary hover:shadow-md transition-all dark:bg-card"
              >
                <UserPlus className="h-9 w-9 text-primary mb-5" />
                <h3 className="text-xl font-semibold text-text-1">Join an Organization</h3>
                <p className="text-sm text-text-2 mt-3">You have an invitation</p>
              </button>
            </div>
          )}

          {mode === 'create' && (
            <form onSubmit={handleCreateOrg} className="space-y-5">
              <Input label="Organization Name" value={orgName} onChange={(e) => setOrgName(e.target.value)} icon={<Building2 className="h-4 w-4" />} required />
              <Input label="Your Full Name" value={fullName} onChange={(e) => setFullName(e.target.value)} icon={<User className="h-4 w-4" />} required />
              <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} icon={<Mail className="h-4 w-4" />} required />
              <Input label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} icon={<Lock className="h-4 w-4" />} required />
              <Input label="Confirm Password" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} icon={<Lock className="h-4 w-4" />} required />
              <div className="flex gap-3">
                <Button type="button" variant="secondary" onClick={() => setMode('choose')} icon={<ArrowLeft className="h-4 w-4" />}>Back</Button>
                <Button type="submit" loading={loading} className="flex-1" size="lg">
                  Create Organization & Sign Up
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </form>
          )}

          {mode === 'join' && (
            <form onSubmit={handleJoin} className="space-y-5">
              <Input
                label="Invitation Token"
                value={inviteValue}
                onChange={(e) => setInviteValue(e.target.value)}
                placeholder="Paste token or invite URL"
                icon={<UserPlus className="h-4 w-4" />}
                required
              />
              <div className="flex gap-3">
                <Button type="button" variant="secondary" onClick={() => setMode('choose')} icon={<ArrowLeft className="h-4 w-4" />}>Back</Button>
                <Button type="submit" className="flex-1" size="lg">
                  Continue
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </form>
          )}

          <p className="mt-6 text-center text-sm text-text-2">
            Already have an account?{' '}
            <Link href="/login" className="text-primary font-medium hover:text-primary/80">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
