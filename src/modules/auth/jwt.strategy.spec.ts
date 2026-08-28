import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy', () => {
  const config = { get: jest.fn().mockReturnValue('test-secret') };

  it('loads current role, status and company scope from the database', async () => {
    const user = {
      _id: { toString: () => 'user-1' },
      email: 'user@jupati.local',
      role: 'manager',
      status: 'active',
      allowedCompanyCnpjs: ['43.521.115/0001-34'],
    };
    const userModel = {
      findById: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(user) }),
    };
    const strategy = new JwtStrategy(config as any, userModel as any);

    await expect(strategy.validate({ sub: 'user-1' })).resolves.toEqual({
      id: 'user-1',
      email: 'user@jupati.local',
      role: 'manager',
      allowedCompanyCnpjs: ['43521115000134'],
    });
  });

  it('rejects a token when the current user is inactive', async () => {
    const userModel = {
      findById: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({ status: 'inactive' }),
      }),
    };
    const strategy = new JwtStrategy(config as any, userModel as any);

    await expect(strategy.validate({ sub: 'user-1' })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
