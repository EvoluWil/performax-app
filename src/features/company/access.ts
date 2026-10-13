import {
  Company,
  CompanyModuleRow,
  MeUser,
  PermissionLevel,
} from '@/types/auth';

const RANK: Record<PermissionLevel, number> = {
  FILTER: 1,
  READ: 2,
  WRITE: 3,
  ADMIN: 4,
};

export function listUserCompanies(user: MeUser): Company[] {
  const map = new Map<string, Company>();
  const memberCompanies = (user.companyUser ?? [])
    .map((item) => item.company)
    .filter((company): company is Company => Boolean(company?.id));

  for (const company of [...memberCompanies, ...(user.companies ?? [])]) {
    if (!company?.id) continue;
    map.set(company.id, { ...map.get(company.id), ...company });
  }

  return [...map.values()].sort((left, right) =>
    left.name.localeCompare(right.name, 'pt-BR'),
  );
}

export function companyHasTaskModule(modules: CompanyModuleRow[]) {
  return modules.some((row) => row.module?.code?.toLowerCase() === 'task');
}

export function taskAccess(user: MeUser, company: Company): 'none' | 'read' | 'write' {
  if (user.role === 'SYSTEM_ADMIN' || company.ownerId === user.id) return 'write';

  const membership = user.companyUser?.find(
    (item) => item.companyId === company.id || item.company?.id === company.id,
  );
  if (membership?.role?.isAdmin) return 'write';

  const permission = membership?.role?.permissions?.find(
    (item) => item.module?.code?.toLowerCase() === 'task',
  );
  const rank = permission ? RANK[permission.permission] : 0;
  if (rank >= RANK.WRITE) return 'write';
  if (rank >= RANK.READ) return 'read';
  return 'none';
}

export function isEligibleCompany(
  user: MeUser,
  company: Company,
  modules: CompanyModuleRow[],
) {
  return companyHasTaskModule(modules) && taskAccess(user, company) !== 'none';
}
