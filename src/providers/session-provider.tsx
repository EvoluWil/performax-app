import { useQuery } from '@tanstack/react-query';
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  isEligibleCompany,
  listUserCompanies,
  taskAccess,
} from '@/features/company/access';
import { unregisterPushToken } from '@/features/notification/push';
import { apiFetch } from '@/services/api';
import { clearCompanyQueries, queryClient } from '@/services/query-client';
import {
  clearCompanyId,
  clearStoredTokens,
  clearUserId,
  loadCompanyId,
  loadTokens,
  loadUserId,
  saveCompanyId,
  saveTokens,
  saveUserId,
} from '@/services/session-store';
import {
  clearTokens,
  configureTokenBridge,
  persistTokens,
  setTokens,
  SessionTokens,
} from '@/services/token-bridge';
import { Company, CompanyModuleRow, MeUser, SignInResult } from '@/types/auth';

type SessionContextValue = {
  ready: boolean;
  tokens: SessionTokens | null;
  userId: string;
  user?: MeUser;
  userLoading: boolean;
  userError: Error | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [tokens, setTokenState] = useState<SessionTokens | null>(null);
  const [userId, setUserId] = useState('');

  const applyTokens = useCallback(async (next: SessionTokens | null) => {
    setTokens(next);
    setTokenState(next);
    if (!next) setUserId('');
  }, []);

  useEffect(() => {
    configureTokenBridge({
      persist: async (next) => {
        await saveTokens(next);
        setTokenState(next);
      },
      clear: async () => {
        await clearStoredTokens();
        setTokenState(null);
        setUserId('');
      },
    });

    let active = true;
    Promise.all([loadTokens(), loadUserId()])
      .then(([stored, storedUserId]) => {
        if (!active) return;
        setTokens(stored);
        setTokenState(stored);
        setUserId(storedUserId ?? '');
      })
      .finally(() => {
        if (active) setReady(true);
      });

    return () => {
      active = false;
    };
  }, []);

  const meQuery = useQuery({
    queryKey: ['me', tokens?.accessToken],
    enabled: ready && Boolean(tokens),
    queryFn: ({ signal }) => apiFetch<MeUser>('/auth/me', { signal }),
  });

  useEffect(() => {
    if (meQuery.data?.id) {
      setUserId(meQuery.data.id);
      void saveUserId(meQuery.data.id);
    }
  }, [meQuery.data?.id]);

  const signIn = useCallback(async (email: string, password: string) => {
    const result = await apiFetch<SignInResult>('/auth/sign-in', {
      method: 'POST',
      auth: false,
      body: { email: email.trim(), password, persistent: true },
    });
    const next = {
      accessToken: result.session.accessToken,
      refreshToken: result.session.refreshToken,
      accessTokenExpires:
        result.session.accessTokenExpires == null
          ? null
          : Number(result.session.accessTokenExpires),
    };
    await persistTokens(next);
    await saveUserId(result.user.id);
    setUserId(result.user.id);
    setTokenState(next);
  }, []);

  const signOut = useCallback(async () => {
    await unregisterPushToken();
    try {
      await apiFetch('/auth/sign-out', { method: 'POST' });
    } catch {
      // A sessão local é encerrada mesmo se a API não responder.
    }
    await clearTokens();
    await clearUserId();
    await clearCompanyId();
    queryClient.clear();
    setUserId('');
    setTokenState(null);
  }, []);

  const value = useMemo<SessionContextValue>(
    () => ({
      ready,
      tokens,
      userId,
      user: meQuery.data,
      userLoading: Boolean(tokens) && meQuery.isLoading,
      userError: meQuery.error instanceof Error ? meQuery.error : null,
      signIn,
      signOut,
    }),
    [meQuery.data, meQuery.error, meQuery.isLoading, ready, signIn, signOut, tokens, userId],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error('Sessão indisponível');
  return value;
}

type CompanyContextValue = {
  ready: boolean;
  companies: Company[];
  company: Company | null;
  loading: boolean;
  error: Error | null;
  canWrite: boolean;
  selectCompany: (companyId: string) => Promise<void>;
};

const CompanyContext = createContext<CompanyContextValue | null>(null);

export function CompanyProvider({ children }: { children: ReactNode }) {
  const { user, userId, tokens } = useSession();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [storedReady, setStoredReady] = useState(false);

  useEffect(() => {
    let active = true;
    if (!tokens) {
      setCompanyId(null);
      setStoredReady(true);
      return;
    }
    setStoredReady(false);
    loadCompanyId().then((stored) => {
      if (!active) return;
      setCompanyId(stored);
      setStoredReady(true);
    });
    return () => {
      active = false;
    };
  }, [tokens, userId]);

  const companiesQuery = useQuery({
    queryKey: ['eligible-companies', user?.id],
    enabled: Boolean(user),
    queryFn: async ({ signal }) => {
      const listed = listUserCompanies(user as MeUser);
      const modules = await Promise.all(
        listed.map((item) =>
          apiFetch<CompanyModuleRow[]>(`/companies/${item.id}/modules`, { signal }).catch(
            () => [] as CompanyModuleRow[],
          ),
        ),
      );
      return listed.filter((item, index) =>
        isEligibleCompany(user as MeUser, item, modules[index] ?? []),
      );
    },
  });

  const companies = companiesQuery.data ?? [];
  const company = companies.find((item) => item.id === companyId) ?? null;

  useEffect(() => {
    if (!companiesQuery.isSuccess || !storedReady) return;
    if (companies.length === 1 && companies[0].id !== companyId) {
      void saveCompanyId(companies[0].id).then(() => setCompanyId(companies[0].id));
    }
  }, [companies, companiesQuery.isSuccess, companyId, storedReady]);

  const selectCompany = useCallback(
    async (nextId: string) => {
      const changed = nextId !== companyId;
      await saveCompanyId(nextId);
      setCompanyId(nextId);
      if (changed) await clearCompanyQueries();
    },
    [companyId],
  );

  const canWrite = useMemo(() => {
    if (!user || !company) return false;
    return taskAccess(user, company) === 'write';
  }, [company, user]);

  const value = useMemo<CompanyContextValue>(
    () => ({
      ready: storedReady && (!user || companiesQuery.isSuccess || companiesQuery.isError),
      companies,
      company,
      loading: Boolean(user) && (companiesQuery.isLoading || !storedReady),
      error: companiesQuery.error instanceof Error ? companiesQuery.error : null,
      canWrite,
      selectCompany,
    }),
    [
      canWrite,
      companies,
      companiesQuery.error,
      companiesQuery.isError,
      companiesQuery.isLoading,
      companiesQuery.isSuccess,
      company,
      selectCompany,
      storedReady,
      user,
    ],
  );

  return <CompanyContext.Provider value={value}>{children}</CompanyContext.Provider>;
}

export function useCompany() {
  const value = useContext(CompanyContext);
  if (!value) throw new Error('Empresa indisponível');
  return value;
}
