import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import { randomBytes, scrypt as _scrypt, timingSafeEqual } from 'crypto'
import { promisify } from 'util'
import { User, UserDocument } from './schemas/user.schema'

const scrypt = promisify(_scrypt)

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

    const ok = await this.verifyPassword(password, user.passwordHash)
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

  async bootstrapAdmin(email: string, password: string) {
    const existingAdmins = await this.userModel.countDocuments({ role: 'admin' })
    if (existingAdmins > 0) {
      throw new BadRequestException('Admin already exists')
    }

    const normalized = email.trim().toLowerCase()
    const passwordHash = await this.hashPassword(password)

    try {
      const user = await this.userModel.create({
        email: normalized,
        passwordHash,
        role: 'admin',
      })

      return {
        id: user._id.toString(),
        email: user.email,
        role: user.role,
      }
    } catch (e) {
      throw new BadRequestException('Unable to create admin')
    }
  }

  private async hashPassword(password: string) {
    const salt = randomBytes(16).toString('hex')
    const derived = (await scrypt(password, salt, 64)) as Buffer
    return `scrypt$${salt}$${derived.toString('hex')}`
  }

  private async verifyPassword(password: string, stored: string) {
    const [algo, salt, hash] = stored.split('$')
    if (algo !== 'scrypt' || !salt || !hash) return false
    const derived = (await scrypt(password, salt, 64)) as Buffer
    const hashBuf = Buffer.from(hash, 'hex')
    if (hashBuf.length !== derived.length) return false
    return timingSafeEqual(hashBuf, derived)
  }
}
