export type PermissionLevel = 'FILTER' | 'READ' | 'WRITE' | 'ADMIN';
export type PermissionScope = 'SELF' | 'TEAM' | 'ALL';

export type WhiteLabel = {
  name?: string | null;
  logo?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
};

export type Company = {
  id: string;
  name: string;
  ownerId?: string | null;
  whiteLabel?: WhiteLabel | null;
};

export type RolePermission = {
  permission: PermissionLevel;
  scope: PermissionScope;
  module?: { code?: string; name?: string } | null;
};

export type CompanyMembership = {
  id: string;
  userId: string;
  companyId: string;
  company?: Company | null;
  role?: {
    isAdmin?: boolean;
    permissions?: RolePermission[];
  } | null;
};

export type MeUser = {
  id: string;
  name: string;
  email: string;
  role: 'SYSTEM_ADMIN' | 'USER';
  companies?: Company[];
  companyUser?: CompanyMembership[];
};

export type SignInResult = {
  user: { id: string; name: string; email: string };
  session: {
    accessToken: string;
    refreshToken: string;
    accessTokenExpires: number | null;
  };
};

export type CompanyModuleRow = {
  module?: { code?: string; name?: string } | null;
};
