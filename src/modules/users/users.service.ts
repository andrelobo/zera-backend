import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { hashPassword } from '../auth/password';
import { User, UserDocument, UserRole } from '../auth/schemas/user.schema';
import {
  buildInviteUrl,
  generateInviteToken,
  getInviteTtlMs,
  hashInviteToken,
} from '../auth/invite-token';

type PublicUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  onboardingStatus?: string;
  invitedAt?: Date;
  inviteExpiresAt?: Date;
  inviteAcceptedAt?: Date;
  welcomeEmailSentAt?: Date;
  lastLoginAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
};

type InviteUserResult = {
  user: PublicUser;
  inviteToken: string;
  inviteUrl: string | null;
};

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private readonly userModel: Model<UserDocument>) {}

  async list(): Promise<PublicUser[]> {
    const users = await this.userModel
      .find(
        {},
        {
          name: 1,
          email: 1,
          role: 1,
          status: 1,
          onboardingStatus: 1,
          invitedAt: 1,
          inviteExpiresAt: 1,
          inviteAcceptedAt: 1,
          welcomeEmailSentAt: 1,
          lastLoginAt: 1,
          createdAt: 1,
          updatedAt: 1,
        },
      )
      .sort({ createdAt: -1 });
    return users.map((user) => this.toPublic(user));
  }

  async getById(id: string): Promise<PublicUser> {
    const user = await this.userModel.findById(id, {
      name: 1,
      email: 1,
      role: 1,
      status: 1,
      onboardingStatus: 1,
      invitedAt: 1,
      inviteExpiresAt: 1,
      inviteAcceptedAt: 1,
      welcomeEmailSentAt: 1,
      lastLoginAt: 1,
      createdAt: 1,
      updatedAt: 1,
    });
    if (!user) throw new NotFoundException('User not found');
    return this.toPublic(user);
  }

  async create(
    name: string,
    email: string,
    password: string,
    role: UserRole = 'user',
    status: 'active' | 'inactive' = 'active',
  ): Promise<PublicUser> {
    const normalized = email.trim().toLowerCase();
    const passwordHash = await hashPassword(password);

    try {
      const user = await this.userModel.create({
        name: name.trim(),
        email: normalized,
        passwordHash,
        role,
        status,
        onboardingStatus: 'manual',
      });

      return this.toPublic(user);
    } catch (e: any) {
      if (e?.code === 11000) {
        throw new BadRequestException('Email already exists');
      }
      throw new BadRequestException('Unable to create user');
    }
  }

  async invite(name: string, email: string, role: UserRole = 'user'): Promise<InviteUserResult> {
    const normalized = email.trim().toLowerCase();
    const inviteToken = generateInviteToken();
    const now = new Date();
    const inviteExpiresAt = new Date(now.getTime() + getInviteTtlMs());
    const passwordHash = await hashPassword(generateInviteToken());

    try {
      const user = await this.userModel.create({
        name: name.trim(),
        email: normalized,
        passwordHash,
        role,
        status: 'inactive',
        onboardingStatus: 'invited',
        invitedAt: now,
        inviteExpiresAt,
        inviteTokenHash: hashInviteToken(inviteToken),
      });

      return {
        user: this.toPublic(user),
        inviteToken,
        inviteUrl: buildInviteUrl(inviteToken),
      };
    } catch (e: any) {
      if (e?.code === 11000) {
        throw new BadRequestException('Email already exists');
      }
      throw new BadRequestException('Unable to invite user');
    }
  }

  async update(
    id: string,
    payload: { name?: string; email?: string; password?: string; role?: string; status?: string },
  ): Promise<PublicUser> {
    const update: {
      name?: string;
      email?: string;
      passwordHash?: string;
      role?: string;
      status?: string;
    } = {};
    if (payload.name) update.name = payload.name.trim();
    if (payload.email) update.email = payload.email.trim().toLowerCase();
    if (payload.password) update.passwordHash = await hashPassword(payload.password);
    if (payload.role) update.role = payload.role;
    if (payload.status) update.status = payload.status;

    try {
      const user = await this.userModel.findByIdAndUpdate(id, update, {
        new: true,
        fields: {
          name: 1,
          email: 1,
          role: 1,
          status: 1,
          onboardingStatus: 1,
          invitedAt: 1,
          inviteExpiresAt: 1,
          inviteAcceptedAt: 1,
          welcomeEmailSentAt: 1,
          lastLoginAt: 1,
          createdAt: 1,
          updatedAt: 1,
        },
      });
      if (!user) throw new NotFoundException('User not found');
      return this.toPublic(user);
    } catch (e: any) {
      if (e?.code === 11000) {
        throw new BadRequestException('Email already exists');
      }
      if (e?.status === 404) throw e;
      throw new BadRequestException('Unable to update user');
    }
  }

  async remove(id: string) {
    const user = await this.userModel.findByIdAndDelete(id);
    if (!user) throw new NotFoundException('User not found');
    return { deleted: true };
  }

  private toPublic(user: UserDocument): PublicUser {
    return {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      onboardingStatus: (user as any).onboardingStatus,
      invitedAt: (user as any).invitedAt,
      inviteExpiresAt: (user as any).inviteExpiresAt,
      inviteAcceptedAt: (user as any).inviteAcceptedAt,
      welcomeEmailSentAt: (user as any).welcomeEmailSentAt,
      lastLoginAt: (user as any).lastLoginAt,
      createdAt: (user as any).createdAt,
      updatedAt: (user as any).updatedAt,
    };
  }
}
