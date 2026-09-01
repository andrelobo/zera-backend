import { ForbiddenException } from '@nestjs/common';
import {
  assertCompanyAccess,
  normalizeAllowedCompanyCnpjs,
  resolveCompanyScope,
  type AuthenticatedUser,
} from './company-access';

const scopedUser: AuthenticatedUser = {
  id: 'user-1',
  email: 'user@jupati.local',
  role: 'user',
  allowedCompanyCnpjs: ['43521115000134', '11222333000181'],
};

describe('company access', () => {
  it('normalizes and deduplicates allowed companies', () => {
    expect(
      normalizeAllowedCompanyCnpjs(['43.521.115/0001-34', '43521115000134', 'invalid']),
    ).toEqual(['43521115000134']);
  });

  it('allows a linked company and blocks cross-company access', () => {
    expect(() => assertCompanyAccess(scopedUser, '43.521.115/0001-34')).not.toThrow();
    expect(() => assertCompanyAccess(scopedUser, '99888777000166')).toThrow(ForbiddenException);
  });

  it('returns all linked companies when a non-admin does not request one', () => {
    expect(resolveCompanyScope(scopedUser)).toEqual(['43521115000134', '11222333000181']);
  });

  it('allows admins to use global scope', () => {
    expect(resolveCompanyScope({ ...scopedUser, role: 'admin', allowedCompanyCnpjs: [] })).toBe(
      undefined,
    );
  });

  it('fails closed when authorization context is missing', () => {
    expect(() => assertCompanyAccess(undefined as any, '43521115000134')).toThrow(
      ForbiddenException,
    );
  });
});
