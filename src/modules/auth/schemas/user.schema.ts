import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import type { HydratedDocument } from 'mongoose'

export type UserRole = 'admin' | 'manager' | 'user'
export type UserStatus = 'active' | 'inactive'

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, unique: true, index: true })
  email: string

  @Prop({ required: true })
  name: string

  @Prop({ required: true })
  passwordHash: string

  @Prop({ required: true, type: String, enum: ['admin', 'manager', 'user'] })
  role: UserRole

  @Prop({ required: true, type: String, enum: ['active', 'inactive'], default: 'active' })
  status: UserStatus
}

export type UserDocument = HydratedDocument<User>

export const UserSchema = SchemaFactory.createForClass(User)
