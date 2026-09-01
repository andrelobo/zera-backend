import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { PassportStrategy } from '@nestjs/passport';
import type { Model } from 'mongoose';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { normalizeAllowedCompanyCnpjs } from './company-access';
import { User, type UserDocument } from './schemas/user.schema';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {
    const secret = config.get<string>('JWT_SECRET');
    if (!secret?.trim()) {
      throw new Error('JWT_SECRET not set');
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: { sub: string }) {
    const user = await this.userModel.findById(payload.sub).exec();
    if (!user || user.status !== 'active') {
      throw new UnauthorizedException('User is inactive or no longer exists');
    }
    return {
      id: user._id.toString(),
      email: user.email,
      role: user.role,
      allowedCompanyCnpjs: normalizeAllowedCompanyCnpjs(user.allowedCompanyCnpjs),
    };
  }
}
