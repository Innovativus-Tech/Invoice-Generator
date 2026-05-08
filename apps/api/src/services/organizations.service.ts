import { prisma } from '../lib/prisma.js';
import { supabase } from '../lib/supabase.js';
import { sendInvitationEmail } from './email.service.js';

export type OrgRole = 'owner' | 'admin' | 'staff';

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export class OrganizationsService {
  async getCurrentOrg(orgId: string, role: OrgRole) {
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { id: true, name: true, slug: true, ownerId: true, createdAt: true, updatedAt: true },
    });
    if (!org) throw new Error('Organization not found');
    return { ...org, role };
  }

  async getMembers(orgId: string) {
    const members = await prisma.organizationMember.findMany({
      where: { orgId, status: 'active' },
      orderBy: { joinedAt: 'asc' },
      select: { id: true, userId: true, role: true, joinedAt: true },
    });

    return Promise.all(
      members.map(async (member) => {
        const { data: userData } = await supabase.auth.admin.getUserById(member.userId);
        const profile = await prisma.profile.findUnique({
          where: { id: member.userId },
          select: { businessName: true, businessEmail: true },
        });

        return {
          id: member.id,
          user_id: member.userId,
          email: userData.user?.email || profile?.businessEmail || '',
          name: (userData.user?.user_metadata?.full_name as string | undefined) || profile?.businessName || '',
          role: member.role,
          joined_at: member.joinedAt,
        };
      })
    );
  }

  async getPendingInvitations(orgId: string) {
    const invitations = await prisma.organizationInvitation.findMany({
      where: { orgId, status: 'pending' },
      orderBy: { createdAt: 'desc' },
      select: { id: true, email: true, role: true, status: true, expiresAt: true, createdAt: true },
    });
    return invitations.map((inv) => ({
      id: inv.id,
      email: inv.email,
      role: inv.role,
      status: inv.status,
      expires_at: inv.expiresAt,
      created_at: inv.createdAt,
    }));
  }

  async getInvitationByToken(token: string) {
    const invitation = await prisma.organizationInvitation.findUnique({
      where: { token },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        expiresAt: true,
        organization: { select: { id: true, name: true } },
      },
    });
    if (!invitation) throw new Error('Invitation not found');

    return {
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      status: invitation.status,
      expires_at: invitation.expiresAt,
      org: invitation.organization,
    };
  }

  async inviteMember(params: {
    orgId: string;
    orgName: string;
    inviterId: string;
    inviterRole: OrgRole;
    email: string;
    role: 'admin' | 'staff';
  }) {
    const email = normalizeEmail(params.email);

    if (!email) throw new Error('Email is required');
    if (!['admin', 'staff'].includes(params.role)) throw new Error('Role must be admin or staff');
    if (params.inviterRole === 'admin' && params.role !== 'staff') {
      throw new Error('Admins can only invite staff members');
    }

    const invitation = await prisma.organizationInvitation.create({
      data: {
        orgId: params.orgId,
        email,
        role: params.role,
        invitedBy: params.inviterId,
      },
      select: { id: true, email: true, role: true, token: true, expiresAt: true },
    });

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const inviteLink = `${frontendUrl}/accept-invitation?token=${invitation.token}`;

    let emailSent = false;
    try {
      await sendInvitationEmail({ to: email, orgName: params.orgName, role: params.role, inviteLink });
      emailSent = true;
    } catch (e: any) {
      console.warn('Invitation email could not be sent (no email provider configured):', e.message);
    }

    return {
      invitation_id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      expires_at: invitation.expiresAt,
      invite_link: inviteLink,
      email_sent: emailSent,
    };
  }

  async removeMember(orgId: string, currentUserId: string, userId: string) {
    if (currentUserId === userId) throw new Error('You cannot remove yourself');

    const member = await prisma.organizationMember.findFirst({
      where: { orgId, userId, status: 'active' },
      select: { role: true },
    });
    if (!member) throw new Error('Member not found');
    if (member.role === 'owner') throw new Error('Cannot remove the owner');

    await prisma.organizationMember.deleteMany({
      where: { orgId, userId },
    });

    return { success: true };
  }

  async changeMemberRole(orgId: string, userId: string, role: 'admin' | 'staff') {
    if (!['admin', 'staff'].includes(role)) throw new Error('Role must be admin or staff');

    const member = await prisma.organizationMember.findFirst({
      where: { orgId, userId, status: 'active' },
      select: { role: true },
    });
    if (!member) throw new Error('Member not found');
    if (member.role === 'owner') throw new Error("Cannot change owner's role");

    const updated = await prisma.organizationMember.updateMany({
      where: { orgId, userId },
      data: { role },
    });

    if (updated.count === 0) throw new Error('Update failed');

    const result = await prisma.organizationMember.findFirst({
      where: { orgId, userId },
      select: { id: true, userId: true, role: true, joinedAt: true },
    });
    return result;
  }

  async revokeInvitation(orgId: string, invitationId: string) {
    const invitation = await prisma.organizationInvitation.findFirst({
      where: { id: invitationId, orgId },
      select: { id: true, status: true },
    });

    if (!invitation) throw new Error('Invitation not found');
    if (invitation.status !== 'pending') throw new Error(`Invitation is already ${invitation.status}`);

    // Delete the row — the DB CHECK constraint doesn't include 'revoked'
    await prisma.organizationInvitation.delete({ where: { id: invitationId } });
    return { success: true };
  }
}

export const organizationsService = new OrganizationsService();
