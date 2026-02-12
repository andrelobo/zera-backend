import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import { User, UserDocument } from './schemas/user.schema'
import { hashPassword, verifyPassword } from './password'

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly jwt: JwtService,
  ) {}

  async login(email: string, password: string) {
    const normalized = email.trim().toLowerCase()
    const user = await this.userModel.findOne({ email: normalized })

    if (!user) {
      throw new UnauthorizedException('Invalid credentials')
    }

    if (user.status === 'inactive') {
      throw new UnauthorizedException('User is inactive')
    }

    const ok = await verifyPassword(password, user.passwordHash)
    if (!ok) {
      throw new UnauthorizedException('Invalid credentials')
    }

    const accessToken = await this.jwt.signAsync({
      sub: user._id.toString(),
      email: user.email,
      role: user.role,
    })

    return { accessToken }
  }

  async bootstrapAdmin(name: string, email: string, password: string) {
    const existingAdmins = await this.userModel.countDocuments({ role: 'admin' })
    if (existingAdmins > 0) {
      throw new BadRequestException('Admin already exists')
    }

    const normalized = email.trim().toLowerCase()
    const passwordHash = await hashPassword(password)

    try {
      const user = await this.userModel.create({
        name: name.trim(),
        email: normalized,
        passwordHash,
        role: 'admin',
        status: 'active',
      })

      return {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
      }
    } catch (e) {
      throw new BadRequestException('Unable to create admin')
    }
  }

  async resetAdminPassword(email: string, password: string) {
    const normalized = email.trim().toLowerCase()
    const passwordHash = await hashPassword(password)

    const updated = await this.userModel.findOneAndUpdate(
      { email: normalized, role: 'admin' },
      { passwordHash },
      { new: true },
    )

    if (!updated) {
      throw new BadRequestException('Admin not found')
    }

    return { id: updated._id.toString(), email: updated.email, role: updated.role }
  }

  async me(userId: string) {
    const user = await this.userModel.findById(userId).exec()
    if (!user) {
      throw new UnauthorizedException('User not found')
    }

    if (user.status === 'inactive') {
      throw new UnauthorizedException('User is inactive')
    }

    return {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      createdAt: (user as any).createdAt ?? null,
      updatedAt: (user as any).updatedAt ?? null,
    }
  }
}
