export type SessionTokens = {
  accessToken: string;
  refreshToken: string;
  accessTokenExpires: number | null;
};

type TokenBridge = {
  tokens: SessionTokens | null;
  persist: (tokens: SessionTokens) => Promise<void>;
  clear: () => Promise<void>;
};

const bridge: TokenBridge = {
  tokens: null,
  persist: async () => undefined,
  clear: async () => undefined,
};

export function getTokens() {
  return bridge.tokens;
}

export function setTokens(tokens: SessionTokens | null) {
  bridge.tokens = tokens;
}

export function configureTokenBridge(handlers: Pick<TokenBridge, 'persist' | 'clear'>) {
  bridge.persist = handlers.persist;
  bridge.clear = handlers.clear;
}

export async function persistTokens(tokens: SessionTokens) {
  bridge.tokens = tokens;
  await bridge.persist(tokens);
}

export async function clearTokens() {
  bridge.tokens = null;
  await bridge.clear();
}
