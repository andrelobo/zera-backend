import { ForbiddenException } from '@nestjs/common';
import type { UserRole } from './schemas/user.schema';

export type AuthenticatedUser = {
  id: string;
  email: string;
  role: UserRole;
  allowedCompanyCnpjs: string[];
};

export function normalizeCompanyCnpj(value?: string): string {
  return String(value ?? '').replace(/\D+/g, '');
}

export function normalizeAllowedCompanyCnpjs(values?: string[]): string[] {
  if (!Array.isArray(values)) return [];
  return Array.from(
    new Set(values.map(normalizeCompanyCnpj).filter((value) => value.length === 14)),
  );
}

export function assertCompanyAccess(user: AuthenticatedUser, companyCnpj?: string): void {
  if (!user) {
    throw new ForbiddenException({
      code: 'COMPANY_ACCESS_CONTEXT_MISSING',
      message: 'Contexto de autorização da empresa não está disponível',
    });
  }
  if (user.role === 'admin') return;

  const normalized = normalizeCompanyCnpj(companyCnpj);
  const allowed = normalizeAllowedCompanyCnpjs(user.allowedCompanyCnpjs);
  if (!normalized || !allowed.includes(normalized)) {
    throw new ForbiddenException({
      code: 'COMPANY_ACCESS_DENIED',
      message: 'Usuário não possui acesso à empresa solicitada',
    });
  }
}

export function resolveCompanyScope(
  user: AuthenticatedUser,
  requestedCompanyCnpj?: string,
): string[] | undefined {
  if (!user) {
    throw new ForbiddenException({
      code: 'COMPANY_ACCESS_CONTEXT_MISSING',
      message: 'Contexto de autorização da empresa não está disponível',
    });
  }
  const requested = normalizeCompanyCnpj(requestedCompanyCnpj);
  if (user.role === 'admin') return requested ? [requested] : undefined;

  const allowed = normalizeAllowedCompanyCnpjs(user.allowedCompanyCnpjs);
  if (requested) {
    assertCompanyAccess(user, requested);
    return [requested];
  }
  if (!allowed.length) {
    throw new ForbiddenException({
      code: 'COMPANY_ACCESS_DENIED',
      message: 'Usuário não possui empresa vinculada',
    });
  }
  return allowed;
}
