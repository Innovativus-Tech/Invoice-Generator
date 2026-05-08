'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Building2, Lock, Mail, ShieldCheck, UserRound, UserPlus, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import apiClient from '@/lib/api-client';
import { extractInvitationToken } from '@/lib/invitations';
import { useAuth } from '@/hooks/use-auth';
import { toast } from 'sonner';

type LoginTab = 'owner-admin' | 'staff' | 'invite';

export default function LoginPage() {
  const router = useRouter();
  const { setSession } = useAuth();
  const [activeTab, setActiveTab] = useState<LoginTab>('owner-admin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [inviteValue, setInviteValue] = useState('');
  const [loading, setLoading] = useState(false);

  const tabs = [
    { id: 'owner-admin' as const, label: 'Owner / Admin', icon: ShieldCheck },
    { id: 'staff' as const, label: 'Staff', icon: UserRound },
    { id: 'invite' as const, label: 'Join via Invite', icon: UserPlus },
  ];

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await apiClient.post('/auth/login', { email, password });
      if (data.data?.session) {
        await setSession(data.data.session);
        await apiClient.get('/org/me');
        toast.success('Welcome back!');
        router.push('/dashboard');
      }
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message || 'Login failed';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleInviteContinue = (e: React.FormEvent) => {
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
          <h1 className="text-4xl font-semibold leading-tight">Shared invoices, clear access.</h1>
          <p className="mt-4 text-white/70 max-w-md">
            Owners, admins, and staff work from the same organization workspace with access matched to each role.
          </p>
        </div>
        <div className="text-sm text-white/50">Organization-first billing workspace</div>
      </div>

      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center">
              <Building2 className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold text-text-1">QuickInvoice</span>
          </div>

          <h2 className="text-2xl font-bold text-text-1">Sign in</h2>
          <p className="text-text-2 mt-1 mb-6">Choose how you access your organization.</p>

          <div className="grid grid-cols-3 gap-1 rounded-lg border border-border bg-white p-1 dark:bg-card">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`min-h-11 rounded-md px-2 text-xs font-medium transition-colors flex items-center justify-center gap-1.5 ${
                    activeTab === tab.id ? 'bg-primary text-white' : 'text-text-2 hover:bg-surface hover:text-text-1'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {activeTab === 'invite' ? (
            <form onSubmit={handleInviteContinue} className="mt-6 space-y-5">
              <Input
                label="Invitation Token"
                value={inviteValue}
                onChange={(e) => setInviteValue(e.target.value)}
                placeholder="Paste token or invite link"
                icon={<UserPlus className="h-4 w-4" />}
                required
              />
              <Button type="submit" className="w-full" size="lg">
                Continue with Invite
                <ArrowRight className="h-4 w-4" />
              </Button>
            </form>
          ) : (
            <form onSubmit={handleLogin} className="mt-6 space-y-5">
              <Input
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                icon={<Mail className="h-4 w-4" />}
                required
              />
              <Input
                label="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                icon={<Lock className="h-4 w-4" />}
                required
              />
              <Button type="submit" loading={loading} className="w-full" size="lg">
                Sign In
                <ArrowRight className="h-4 w-4" />
              </Button>
            </form>
          )}

          <p className="mt-6 text-center text-sm text-text-2">
            Don&apos;t have access yet?{' '}
            <Link href="/register" className="text-primary font-medium hover:text-primary/80">
              Register
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
