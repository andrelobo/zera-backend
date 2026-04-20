import { BadRequestException } from '@nestjs/common';
import { hashInviteToken } from '../auth/invite-token';
import { UsersService } from './users.service';

const makeUserDoc = (overrides: Record<string, unknown> = {}) => ({
  _id: { toString: () => 'user-1' },
  name: 'Andre Lobo',
  email: 'andre@zera.app',
  role: 'user',
  status: 'active',
  onboardingStatus: 'manual',
  createdAt: new Date('2026-04-20T00:00:00.000Z'),
  updatedAt: new Date('2026-04-20T00:00:00.000Z'),
  ...overrides,
});

describe('UsersService', () => {
  const previousFrontendUrl = process.env.FRONTEND_APP_URL;

  afterEach(() => {
    process.env.FRONTEND_APP_URL = previousFrontendUrl;
    jest.clearAllMocks();
  });

  it('creates manual users without changing the existing active flow', async () => {
    const userDoc = makeUserDoc();
    const model = {
      create: jest.fn().mockResolvedValue(userDoc),
    };
    const service = new UsersService(model as any);

    const result = await service.create('Andre Lobo', 'ANDRE@ZERA.APP', 'vascao26', 'user', 'active');

    expect(model.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Andre Lobo',
        email: 'andre@zera.app',
        role: 'user',
        status: 'active',
        onboardingStatus: 'manual',
      }),
    );
    expect(model.create.mock.calls[0][0].passwordHash).toMatch(/^scrypt\$/);
    expect(result).toMatchObject({
      id: 'user-1',
      email: 'andre@zera.app',
      status: 'active',
      onboardingStatus: 'manual',
    });
  });

  it('invites users as inactive and returns one-time onboarding data', async () => {
    process.env.FRONTEND_APP_URL = 'https://app.zera.test';
    const invitedAt = new Date('2026-04-20T00:00:00.000Z');
    const userDoc = makeUserDoc({
      status: 'inactive',
      onboardingStatus: 'invited',
      invitedAt,
      inviteExpiresAt: new Date('2026-04-23T00:00:00.000Z'),
    });
    const model = {
      create: jest.fn().mockResolvedValue(userDoc),
    };
    const service = new UsersService(model as any);

    const result = await service.invite('Convidado ZERA', 'CONVIDADO@ZERA.APP', 'manager');
    const createPayload = model.create.mock.calls[0][0];

    expect(createPayload).toMatchObject({
      name: 'Convidado ZERA',
      email: 'convidado@zera.app',
      role: 'manager',
      status: 'inactive',
      onboardingStatus: 'invited',
    });
    expect(createPayload.passwordHash).toMatch(/^scrypt\$/);
    expect(createPayload.invitedAt).toBeInstanceOf(Date);
    expect(createPayload.inviteExpiresAt).toBeInstanceOf(Date);
    expect(createPayload.inviteTokenHash).toBe(hashInviteToken(result.inviteToken));
    expect(result.inviteUrl).toBe(`https://app.zera.test/accept-invite?token=${result.inviteToken}`);
    expect(result.user).toMatchObject({
      id: 'user-1',
      status: 'inactive',
      onboardingStatus: 'invited',
    });
    expect((result.user as any).inviteTokenHash).toBeUndefined();
  });

  it('maps duplicate invite email to business error', async () => {
    const model = {
      create: jest.fn().mockRejectedValue({ code: 11000 }),
    };
    const service = new UsersService(model as any);

    await expect(service.invite('Andre', 'andre@zera.app')).rejects.toBeInstanceOf(BadRequestException);
  });
});
