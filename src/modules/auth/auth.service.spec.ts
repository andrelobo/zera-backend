import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { hashInviteToken } from './invite-token';
import { AuthService } from './auth.service';

const makeUserDoc = (overrides: Record<string, unknown> = {}) => ({
  _id: { toString: () => 'user-1' },
  name: 'Andre Lobo',
  email: 'andre@zera.app',
  role: 'user',
  status: 'active',
  passwordHash: 'scrypt$invalid$hash',
  onboardingStatus: 'manual',
  ...overrides,
});

describe('AuthService', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('rejects inactive users on regular login', async () => {
    const model = {
      findOne: jest.fn().mockResolvedValue(makeUserDoc({ status: 'inactive' })),
    };
    const service = new AuthService(model as any, { signAsync: jest.fn() } as any);

    await expect(service.login('andre@zera.app', 'qualquer-senha')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('accepts valid invite, activates user and returns access token', async () => {
    const token = 'valid-invite-token'; // secret-scan: allow-test-fixture
    const invited = makeUserDoc({
      status: 'inactive',
      onboardingStatus: 'invited',
      inviteExpiresAt: new Date(Date.now() + 60_000),
    });
    const updated = makeUserDoc({
      status: 'active',
      onboardingStatus: 'accepted',
    });
    const model = {
      findOne: jest.fn().mockResolvedValue(invited),
      findByIdAndUpdate: jest.fn().mockResolvedValue(updated),
    };
    const jwt = { signAsync: jest.fn().mockResolvedValue('jwt-token') };
    const service = new AuthService(model as any, jwt as any);

    const result = await service.acceptInvite(token, 'nova-senha-forte');
    const updatePayload = model.findByIdAndUpdate.mock.calls[0][1];

    expect(model.findOne).toHaveBeenCalledWith({ inviteTokenHash: hashInviteToken(token) });
    expect(updatePayload.$set).toMatchObject({
      status: 'active',
      onboardingStatus: 'accepted',
    });
    expect(updatePayload.$set.passwordHash).toMatch(/^scrypt\$/);
    expect(updatePayload.$set.inviteAcceptedAt).toBeInstanceOf(Date);
    expect(updatePayload.$unset).toEqual({ inviteTokenHash: '' });
    expect(jwt.signAsync).toHaveBeenCalledWith({
      sub: 'user-1',
      email: 'andre@zera.app',
      role: 'user',
    });
    expect(result).toEqual({
      accessToken: 'jwt-token',
      user: {
        id: 'user-1',
        name: 'Andre Lobo',
        email: 'andre@zera.app',
        role: 'user',
        status: 'active',
        allowedCompanyCnpjs: [],
        onboardingStatus: 'accepted',
      },
    });
  });

  it('rejects expired invite token', async () => {
    const model = {
      findOne: jest.fn().mockResolvedValue(
        makeUserDoc({
          status: 'inactive',
          onboardingStatus: 'invited',
          inviteExpiresAt: new Date(Date.now() - 60_000),
        }),
      ),
      findByIdAndUpdate: jest.fn(),
    };
    const service = new AuthService(model as any, { signAsync: jest.fn() } as any);

    await expect(service.acceptInvite('expired-token', 'nova-senha-forte')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(model.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it('rejects already accepted or unknown invite token', async () => {
    const model = {
      findOne: jest.fn().mockResolvedValue(makeUserDoc({ onboardingStatus: 'accepted' })),
      findByIdAndUpdate: jest.fn(),
    };
    const service = new AuthService(model as any, { signAsync: jest.fn() } as any);

    await expect(service.acceptInvite('used-token', 'nova-senha-forte')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(model.findByIdAndUpdate).not.toHaveBeenCalled();
  });
});
