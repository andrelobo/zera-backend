import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import type { Model } from 'mongoose'
import { hashPassword } from '../auth/password'
import { User, UserDocument } from '../auth/schemas/user.schema'

type PublicUser = {
  id: string
  name: string
  email: string
  role: string
  status: string
  createdAt?: Date
  updatedAt?: Date
}

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private readonly userModel: Model<UserDocument>) {}

  async list(): Promise<PublicUser[]> {
    const users = await this.userModel
      .find({}, { name: 1, email: 1, role: 1, status: 1, createdAt: 1, updatedAt: 1 })
      .sort({ createdAt: -1 })
    return users.map((user) => this.toPublic(user))
  }

  async getById(id: string): Promise<PublicUser> {
    const user = await this.userModel.findById(id, {
      name: 1,
      email: 1,
      role: 1,
      status: 1,
      createdAt: 1,
      updatedAt: 1,
    })
    if (!user) throw new NotFoundException('User not found')
    return this.toPublic(user)
  }

  async create(
    name: string,
    email: string,
    password: string,
    role = 'user',
    status: 'active' | 'inactive' = 'active',
  ): Promise<PublicUser> {
    const normalized = email.trim().toLowerCase()
    const passwordHash = await hashPassword(password)

    try {
      const user = await this.userModel.create({
        name: name.trim(),
        email: normalized,
        passwordHash,
        role,
        status,
      })

      return this.toPublic(user)
    } catch (e: any) {
      if (e?.code === 11000) {
        throw new BadRequestException('Email already exists')
      }
      throw new BadRequestException('Unable to create user')
    }
  }

  async update(
    id: string,
    payload: { name?: string; email?: string; password?: string; role?: string; status?: string },
  ): Promise<PublicUser> {
    const update: { name?: string; email?: string; passwordHash?: string; role?: string; status?: string } = {}
    if (payload.name) update.name = payload.name.trim()
    if (payload.email) update.email = payload.email.trim().toLowerCase()
    if (payload.password) update.passwordHash = await hashPassword(payload.password)
    if (payload.role) update.role = payload.role
    if (payload.status) update.status = payload.status

    try {
      const user = await this.userModel.findByIdAndUpdate(id, update, {
        new: true,
        fields: { name: 1, email: 1, role: 1, status: 1, createdAt: 1, updatedAt: 1 },
      })
      if (!user) throw new NotFoundException('User not found')
      return this.toPublic(user)
    } catch (e: any) {
      if (e?.code === 11000) {
        throw new BadRequestException('Email already exists')
      }
      if (e?.status === 404) throw e
      throw new BadRequestException('Unable to update user')
    }
  }

  async remove(id: string) {
    const user = await this.userModel.findByIdAndDelete(id)
    if (!user) throw new NotFoundException('User not found')
    return { deleted: true }
  }

  private toPublic(user: UserDocument): PublicUser {
    return {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      createdAt: (user as any).createdAt,
      updatedAt: (user as any).updatedAt,
    }
  }
}
