import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';

export type UserRole = 'admin' | 'manager' | 'user' | 'readonly';
export type UserStatus = 'active' | 'inactive';
export type UserOnboardingStatus = 'manual' | 'invited' | 'accepted';

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, unique: true, index: true })
  email: string;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  passwordHash: string;

  @Prop({ required: true, type: String, enum: ['admin', 'manager', 'user', 'readonly'] })
  role: UserRole;

  @Prop({ required: true, type: String, enum: ['active', 'inactive'], default: 'active' })
  status: UserStatus;

  @Prop({ type: String, enum: ['manual', 'invited', 'accepted'], default: 'manual' })
  onboardingStatus?: UserOnboardingStatus;

  @Prop()
  invitedAt?: Date;

  @Prop()
  inviteExpiresAt?: Date;

  @Prop()
  inviteAcceptedAt?: Date;

  @Prop()
  welcomeEmailSentAt?: Date;

  @Prop()
  lastLoginAt?: Date;

  @Prop({ select: false })
  inviteTokenHash?: string;
}

export type UserDocument = HydratedDocument<User>;

export const UserSchema = SchemaFactory.createForClass(User);
