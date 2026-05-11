'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Building, Mail, Phone, MapPin, FileText, Bell, Upload, Save, Globe, CreditCard, Landmark, Users, UserPlus, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/dropdown-menu';
import SignatureCanvas from 'react-signature-canvas';
import { useSettings, useUpdateSettings, useUploadLogo, useUploadSignature } from '@/hooks/use-settings';
import { useNotificationPreferences, useUpdateNotificationPreferences } from '@/hooks/use-notifications';
import { useAuth } from '@/hooks/use-auth';
import { usePermissions } from '@/hooks/use-permissions';
import apiClient from '@/lib/api-client';
import type { ApiResponse, OrganizationInvitation, OrganizationMember, SettingsFormValues } from '@/types';
import { toast } from 'sonner';

export default function SettingsPage() {
  const { user } = useAuth();
  const { can, isOwner, isAdmin, role } = usePermissions();
  const canUpdateSettings = can('settings', 'update');
  const canInvite = can('team', 'invite');
  const canRemove = can('team', 'remove');
  const canChangeRole = can('team', 'change_role');
  const [activeTab, setActiveTab] = useState<'profile' | 'defaults' | 'notifications' | 'team'>('profile');
  const { data: settings, isLoading } = useSettings();
  const updateSettings = useUpdateSettings();
  const uploadLogo = useUploadLogo();
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [invitations, setInvitations] = useState<OrganizationInvitation[]>([]);
  const [teamLoading, setTeamLoading] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'staff'>('staff');

  const { data: notifPrefs, isLoading: isLoadingPrefs } = useNotificationPreferences();
  const updateNotifPrefs = useUpdateNotificationPreferences();

  const [form, setForm] = useState<SettingsFormValues>({
    business_name: '',
    business_email: '',
    business_address: '',
    business_phone: '',
    currency: 'INR',
    payment_terms: 'Net 30',
    invoice_prefix: 'INV',
    next_invoice_number: 1001,
    signatory_name: '',
    gstin: '',
    website: '',
    bank_name: '',
    bank_account_number: '',
    bank_ifsc: '',
    bank_branch: '',
  });

  const sigCanvasRef = React.useRef<SignatureCanvas>(null);
  const [sigTab, setSigTab] = useState<'upload' | 'draw'>('upload');
  const uploadSignature = useUploadSignature();

  useEffect(() => {
    if (settings) {
      setForm({
        business_name: settings.business_name || '',
        business_email: settings.business_email || '',
        business_address: settings.business_address || '',
        business_phone: settings.business_phone || '',
        currency: settings.currency || 'INR',
        payment_terms: settings.payment_terms || 'Net 30',
        invoice_prefix: settings.invoice_prefix || 'INV',
        next_invoice_number: settings.next_invoice_number || 1001,
        signatory_name: settings.signatory_name || '',
        gstin: settings.gstin || '',
        website: settings.website || '',
        bank_name: settings.bank_name || '',
        bank_account_number: settings.bank_account_number || '',
        bank_ifsc: settings.bank_ifsc || '',
        bank_branch: settings.bank_branch || '',
      });
    }
  }, [settings]);

  useEffect(() => {
    if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('tab') === 'team' && (isOwner || isAdmin)) {
      setActiveTab('team');
    }
  }, [isOwner, isAdmin]);

  const fetchTeam = React.useCallback(async () => {
    if (!(isOwner || isAdmin)) return;
    setTeamLoading(true);
    try {
      const [membersRes, invitesRes] = await Promise.all([
        apiClient.get<ApiResponse<OrganizationMember[]>>('/org/members'),
        canInvite ? apiClient.get<ApiResponse<OrganizationInvitation[]>>('/org/invitations') : Promise.resolve({ data: { data: [] } }),
      ]);
      setMembers(membersRes.data.data || []);
      setInvitations(invitesRes.data.data || []);
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message || 'Could not load team';
      toast.error(message);
    } finally {
      setTeamLoading(false);
    }
  }, [canInvite, isAdmin, isOwner]);

  useEffect(() => {
    if (activeTab === 'team') fetchTeam();
  }, [activeTab, fetchTeam]);

  const handleSave = () => {
    if (!canUpdateSettings) return;
    updateSettings.mutate(form);
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && canUpdateSettings) uploadLogo.mutate(file);
  };

  const handleUploadSignature = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && canUpdateSettings) uploadSignature.mutate(file);
  };

  const handleSaveSignature = () => {
    if (canUpdateSettings && sigCanvasRef.current && !sigCanvasRef.current.isEmpty()) {
      sigCanvasRef.current.getTrimmedCanvas().toBlob((blob: Blob | null) => {
        if (blob) uploadSignature.mutate(blob);
      });
    }
  };

  const handleClearSignature = () => {
    if (sigCanvasRef.current) sigCanvasRef.current.clear();
  };

  const handleRemoveSignature = () => {
    if (canUpdateSettings) updateSettings.mutate({ signature_url: null });
  };

  const tabs = [
    { id: 'profile' as const, label: 'Business Profile', icon: Building },
    { id: 'defaults' as const, label: 'Invoice Defaults', icon: FileText },
    { id: 'notifications' as const, label: 'Notifications', icon: Bell },
    ...(isOwner || isAdmin ? [{ id: 'team' as const, label: 'Team', icon: Users }] : []),
  ];

  const roleBadgeClass = (memberRole: string) => {
    if (memberRole === 'owner') return 'bg-purple-100 text-purple-700';
    if (memberRole === 'admin') return 'bg-blue-100 text-blue-700';
    return 'bg-gray-100 text-gray-600';
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiClient.post<{ data: { invite_link?: string; email_sent?: boolean } }>('/org/invite', { email: inviteEmail, role: inviteRole });
      const { invite_link, email_sent } = res.data.data || {};
      if (email_sent) {
        toast.success('Invitation email sent.');
      } else if (invite_link) {
        navigator.clipboard.writeText(invite_link).catch(() => {});
        toast.success(
          `No email provider configured — invite link copied to clipboard:\n${invite_link}`,
          { duration: 10000 }
        );
      } else {
        toast.success('Invitation created.');
      }
      setInviteEmail('');
      setInviteRole('staff');
      fetchTeam();
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message || 'Could not send invitation';
      toast.error(message);
    }
  };

  const handleRemove = async (member: OrganizationMember) => {
    if (!confirm(`Remove ${member.email} from this organization?`)) return;
    try {
      await apiClient.delete(`/org/members/${member.user_id}`);
      toast.success('Member removed.');
      fetchTeam();
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message || 'Could not remove member';
      toast.error(message);
    }
  };

  const handleRoleChange = async (member: OrganizationMember, nextRole: 'admin' | 'staff') => {
    try {
      await apiClient.patch(`/org/members/${member.user_id}/role`, { role: nextRole });
      toast.success('Role updated.');
      fetchTeam();
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message || 'Could not update role';
      toast.error(message);
    }
  };

  const handleRevoke = async (invitation: OrganizationInvitation) => {
    try {
      await apiClient.delete(`/org/invitations/${invitation.id}`);
      toast.success('Invitation revoked.');
      fetchTeam();
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message || 'Could not revoke invitation';
      toast.error(message);
    }
  };

  const currencyOptions = [
    { value: 'INR', label: 'INR (₹)' },
    { value: 'USD', label: 'USD ($)' },
    { value: 'EUR', label: 'EUR (€)' },
    { value: 'GBP', label: 'GBP (£)' },
    { value: 'CAD', label: 'CAD (C$)' },
    { value: 'AUD', label: 'AUD (A$)' },
    { value: 'JPY', label: 'JPY (¥)' },
  ];

  const termsOptions = [
    { value: 'Due on Receipt', label: 'Due on Receipt' },
    { value: 'Net 15', label: 'Net 15' },
    { value: 'Net 30', label: 'Net 30' },
    { value: 'Net 60', label: 'Net 60' },
  ];

  if (isLoading || isLoadingPrefs) {
    return (
      <div className="space-y-6">
        <div className="h-10 w-48 bg-border/40 animate-pulse rounded-lg" />
        <div className="h-[400px] bg-border/40 animate-pulse rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Manage your business profile and preferences" />

      {/* Tabs */}
      <div className="flex gap-1 bg-white dark:bg-card border border-border rounded-xl p-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                activeTab === tab.id
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-text-2 hover:text-text-1 hover:bg-surface dark:hover:bg-border/30'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          );
        })}
      </div>

      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        {activeTab === 'profile' && (
          <Card>
            <h3 className="text-lg font-semibold text-text-1 mb-6">Business Profile</h3>

            {/* Logo upload */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-text-1 mb-2">Business Logo</label>
              <div className="flex items-center gap-4">
                <div className="h-20 w-20 rounded-xl bg-surface dark:bg-[#0F0E17] border-2 border-dashed border-border flex items-center justify-center overflow-hidden">
                  {settings?.logo_url ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={settings.logo_url} alt="Business Logo" className="h-full w-full object-cover" />
                  ) : (
                    <Upload className="h-6 w-6 text-text-2" />
                  )}
                </div>
                <div>
                  {canUpdateSettings && (
                    <>
                      <label className="cursor-pointer">
                        <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                        <span className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm font-medium text-text-1 hover:bg-surface transition-colors cursor-pointer">
                          <Upload className="h-4 w-4" />
                          Upload Logo
                        </span>
                      </label>
                      <p className="text-xs text-text-2 mt-1">PNG, JPG up to 5MB</p>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Basic info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Business Name"
                value={form.business_name}
                onChange={(e) => setForm({ ...form, business_name: e.target.value })}
                icon={<Building className="h-4 w-4" />}
              />
              <Input
                label="Business Email"
                type="email"
                value={form.business_email}
                onChange={(e) => setForm({ ...form, business_email: e.target.value })}
                icon={<Mail className="h-4 w-4" />}
              />
              <Input
                label="Phone"
                value={form.business_phone}
                onChange={(e) => setForm({ ...form, business_phone: e.target.value })}
                icon={<Phone className="h-4 w-4" />}
              />
              <Input
                label="Website"
                value={form.website}
                onChange={(e) => setForm({ ...form, website: e.target.value })}
                placeholder="https://yourcompany.in"
                icon={<Globe className="h-4 w-4" />}
              />
              <div className="sm:col-span-2">
                <Input
                  label="Address"
                  value={form.business_address}
                  onChange={(e) => setForm({ ...form, business_address: e.target.value })}
                  icon={<MapPin className="h-4 w-4" />}
                />
              </div>
              <div className="sm:col-span-2">
                <Input
                  label="GSTIN"
                  value={form.gstin}
                  onChange={(e) => setForm({ ...form, gstin: e.target.value.toUpperCase() })}
                  placeholder="e.g. 07AAHCI8450O1ZU"
                  className="font-mono"
                />
              </div>
            </div>

            {/* Bank Details */}
            <div className="mt-8 border-t border-border pt-6">
              <h4 className="text-base font-semibold text-text-1 mb-4 flex items-center gap-2">
                <Landmark className="h-4 w-4 text-primary" />
                Bank Details
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Bank Name"
                  value={form.bank_name}
                  onChange={(e) => setForm({ ...form, bank_name: e.target.value })}
                  icon={<Landmark className="h-4 w-4" />}
                />
                <Input
                  label="Account Number"
                  value={form.bank_account_number}
                  onChange={(e) => setForm({ ...form, bank_account_number: e.target.value })}
                  icon={<CreditCard className="h-4 w-4" />}
                  className="font-mono"
                />
                <Input
                  label="IFSC Code"
                  value={form.bank_ifsc}
                  onChange={(e) => setForm({ ...form, bank_ifsc: e.target.value.toUpperCase() })}
                  placeholder="e.g. HDFC0001234"
                  className="font-mono"
                />
                <Input
                  label="Branch"
                  value={form.bank_branch}
                  onChange={(e) => setForm({ ...form, bank_branch: e.target.value })}
                />
              </div>
            </div>

            {/* Authorized Signatory Section */}
            <div className="mt-8 border-t border-border pt-8">
              <h3 className="text-lg font-semibold text-text-1 mb-6">Authorized Signatory</h3>

              <div className="mb-6">
                <Input
                  label="Signatory Name"
                  placeholder="Name and designation (e.g., John Smith, Director)"
                  value={form.signatory_name}
                  onChange={(e) => setForm({ ...form, signatory_name: e.target.value })}
                  icon={<Building className="h-4 w-4" />}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-1 mb-2">Signature</label>

                {settings?.signature_url ? (
                  <div className="border border-border rounded-xl p-4 flex flex-col items-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={settings.signature_url}
                      alt="Authorized Signature"
                      className="h-20 object-contain mb-4"
                    />
                    {canUpdateSettings && (
                      <Button
                        variant="ghost"
                        onClick={handleRemoveSignature}
                        className="text-danger hover:bg-red-50 dark:hover:bg-red-900/20"
                      >
                        Remove signature
                      </Button>
                    )}
                  </div>
                ) : canUpdateSettings ? (
                  <div className="border-dashed border-2 border-border rounded-xl overflow-hidden p-6">
                    <div className="flex gap-2 mb-4 justify-center">
                      <button
                        onClick={() => setSigTab('upload')}
                        className={`text-sm px-4 py-1.5 rounded-full ${sigTab === 'upload' ? 'bg-primary text-white' : 'bg-surface text-text-2 hover:text-text-1'}`}
                      >
                        Upload image
                      </button>
                      <button
                        onClick={() => setSigTab('draw')}
                        className={`text-sm px-4 py-1.5 rounded-full ${sigTab === 'draw' ? 'bg-primary text-white' : 'bg-surface text-text-2 hover:text-text-1'}`}
                      >
                        Draw signature
                      </button>
                    </div>

                    {sigTab === 'upload' && (
                      <div className="flex flex-col items-center justify-center py-6">
                        <label className="cursor-pointer flex flex-col items-center">
                          <input type="file" accept="image/png, image/jpeg, image/svg+xml" onChange={handleUploadSignature} className="hidden" />
                          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                            <Upload className="h-6 w-6 text-primary" />
                          </div>
                          <span className="text-sm font-medium text-primary hover:underline">Click to upload</span>
                          <span className="text-xs text-text-2 mt-1">PNG, JPG, SVG up to 5MB</span>
                        </label>
                      </div>
                    )}

                    {sigTab === 'draw' && (
                      <div className="flex flex-col items-center">
                        <div className="border border-border rounded bg-white w-full max-w-[400px]">
                          <SignatureCanvas
                            ref={sigCanvasRef}
                            canvasProps={{ className: 'w-full h-32' }}
                            minWidth={1.5}
                            maxWidth={3}
                          />
                        </div>
                        <div className="flex gap-3 mt-4">
                          <Button variant="secondary" size="sm" onClick={handleClearSignature}>Clear</Button>
                          <Button size="sm" onClick={handleSaveSignature} loading={uploadSignature.isPending}>
                            Save Signature
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="border border-border rounded-xl p-6 text-sm text-text-2">
                    No signature configured.
                  </div>
                )}
              </div>
            </div>
          </Card>
        )}

        {activeTab === 'defaults' && (
          <Card>
            <h3 className="text-lg font-semibold text-text-1 mb-6">Invoice Defaults</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Select
                label="Currency"
                options={currencyOptions}
                value={form.currency}
                onChange={(val) => setForm({ ...form, currency: val })}
              />
              <Select
                label="Payment Terms"
                options={termsOptions}
                value={form.payment_terms}
                onChange={(val) => setForm({ ...form, payment_terms: val })}
              />
              <Input
                label="Invoice Prefix"
                value={form.invoice_prefix}
                onChange={(e) => setForm({ ...form, invoice_prefix: e.target.value })}
                className="font-mono"
              />
              <Input
                label="Next Invoice Number"
                type="number"
                value={String(form.next_invoice_number)}
                onChange={(e) => setForm({ ...form, next_invoice_number: parseInt(e.target.value) || 1001 })}
                className="font-mono"
              />
            </div>
          </Card>
        )}

        {activeTab === 'notifications' && (
          <Card>
            <h3 className="text-lg font-semibold text-text-1 mb-6">Notification Preferences</h3>
            <div className="space-y-4">
              {[
                { 
                  id: 'invoice_viewed',
                  label: 'Invoice viewed', 
                  desc: 'Get notified when a client views your invoice',
                  checked: notifPrefs?.invoice_viewed ?? true
                },
                { 
                  id: 'payment_received',
                  label: 'Payment received', 
                  desc: 'Get notified when a payment is recorded',
                  checked: notifPrefs?.payment_received ?? true
                },
                { 
                  id: 'invoice_overdue',
                  label: 'Invoice overdue', 
                  desc: 'Get notified when an invoice becomes overdue',
                  checked: notifPrefs?.invoice_overdue ?? true
                },
              ].map((item, i) => (
                <div key={i} className="flex items-center justify-between py-3 border-b border-border last:border-0">
                  <div>
                    <p className="text-sm font-medium text-text-1">{item.label}</p>
                    <p className="text-xs text-text-2 mt-0.5">{item.desc}</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={item.checked}
                      onChange={(e) => {
                        if (!canUpdateSettings) return;
                        updateNotifPrefs.mutate({
                          invoice_viewed: notifPrefs?.invoice_viewed ?? true,
                          payment_received: notifPrefs?.payment_received ?? true,
                          invoice_overdue: notifPrefs?.invoice_overdue ?? true,
                          [item.id]: e.target.checked
                        });
                      }}
                      disabled={!canUpdateSettings}
                      className="sr-only peer" 
                    />
                    <div className="w-9 h-5 bg-border rounded-full peer peer-checked:bg-primary transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full" />
                  </label>
                </div>
              ))}
            </div>
          </Card>
        )}

        {activeTab === 'team' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold text-text-1">Team Members</h2>
              <p className="text-sm text-text-2 mt-1">Manage who has access to your organization</p>
            </div>

            <Card padding={false}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="px-6 py-3 text-left text-xs font-medium text-text-2 uppercase">Avatar</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-text-2 uppercase">Name</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-text-2 uppercase">Email</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-text-2 uppercase">Role</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-text-2 uppercase">Joined</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-text-2 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {teamLoading ? (
                      <tr><td colSpan={6} className="px-6 py-8 text-center text-text-2">Loading team...</td></tr>
                    ) : members.map((member) => {
                      const isSelf = member.user_id === user?.id;
                      const canRemoveMember = canRemove && !isSelf && member.role !== 'owner';
                      const canChangeMemberRole = canChangeRole && member.role !== 'owner';
                      return (
                        <tr key={member.id}>
                          <td className="px-6 py-4">
                            <div className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold">
                              {(member.name || member.email || '?').slice(0, 1).toUpperCase()}
                            </div>
                          </td>
                          <td className="px-6 py-4 font-medium text-text-1">{member.name || '-'}</td>
                          <td className="px-6 py-4 text-text-2">{member.email}</td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${roleBadgeClass(member.role)}`}>
                              {member.role}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-text-2">{new Date(member.joined_at).toLocaleDateString()}</td>
                          <td className="px-6 py-4">
                            <div className="flex items-center justify-end gap-2">
                              {canChangeMemberRole && (
                                <Select
                                  options={[
                                    { value: 'admin', label: 'Admin' },
                                    { value: 'staff', label: 'Staff' },
                                  ]}
                                  value={member.role}
                                  onChange={(nextRole) => handleRoleChange(member, nextRole as 'admin' | 'staff')}
                                  className="w-28"
                                />
                              )}
                              {canRemoveMember && (
                                <Button variant="ghost" size="sm" onClick={() => handleRemove(member)} icon={<Trash2 className="h-4 w-4 text-danger" />}>
                                  Remove
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>

            {canInvite && (
              <Card>
                <h3 className="text-lg font-semibold text-text-1 mb-4">Invite a team member</h3>
                <form onSubmit={handleInvite} className="grid grid-cols-1 md:grid-cols-[1fr_160px_auto] gap-3 items-end">
                  <Input label="Email" type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} icon={<Mail className="h-4 w-4" />} required />
                  <Select
                    label="Role"
                    options={isOwner ? [
                      { value: 'admin', label: 'Admin' },
                      { value: 'staff', label: 'Staff' },
                    ] : [{ value: 'staff', label: 'Staff' }]}
                    value={isOwner ? inviteRole : 'staff'}
                    onChange={(value) => setInviteRole(value as 'admin' | 'staff')}
                  />
                  <Button type="submit" icon={<UserPlus className="h-4 w-4" />}>Send Invitation</Button>
                </form>

                {invitations.length > 0 && (
                  <div className="mt-6 border-t border-border pt-4 space-y-3">
                    {invitations.map((invitation) => (
                      <div key={invitation.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg bg-surface p-3 dark:bg-[#0F0E17]">
                        <div>
                          <p className="text-sm font-medium text-text-1">{invitation.email}</p>
                          <p className="text-xs text-text-2">
                            {invitation.role} - sent {new Date(invitation.created_at).toLocaleDateString()} - expires {new Date(invitation.expires_at).toLocaleDateString()}
                          </p>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => handleRevoke(invitation)}>
                          Revoke
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            )}

            <Card>
              <h3 className="text-lg font-semibold text-text-1 mb-4">Organization Info</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between gap-4">
                  <span className="text-text-2">Organization name</span>
                  <span className="font-medium text-text-1">{user?.org_name}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-text-2">Organization ID</span>
                  <span className="font-mono text-xs text-text-1">{user?.org_id}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-text-2">Your role</span>
                  <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${roleBadgeClass(role)}`}>
                    {role}
                  </span>
                </div>
              </div>
            </Card>
          </div>
        )}
      </motion.div>

      {/* Floating save button */}
      {canUpdateSettings && activeTab !== 'team' && (
      <div className="fixed bottom-6 right-6 z-30">
        <Button
          onClick={handleSave}
          loading={updateSettings.isPending}
          icon={<Save className="h-4 w-4" />}
          className="shadow-lg shadow-primary/25"
          size="lg"
        >
          Save Changes
        </Button>
      </div>
      )}
    </div>
  );
}
