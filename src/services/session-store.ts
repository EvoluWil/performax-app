import * as SecureStore from 'expo-secure-store';

import { SessionTokens } from '@/services/token-bridge';

const ACCESS = 'performax.accessToken';
const REFRESH = 'performax.refreshToken';
const EXPIRES = 'performax.accessExpires';
const NEVER_EXPIRES = 'never';
const COMPANY = 'performax.companyId';
const USER = 'performax.userId';

async function read(key: string) {
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

async function write(key: string, value: string) {
  await SecureStore.setItemAsync(key, value);
}

async function remove(key: string) {
  try {
    await SecureStore.deleteItemAsync(key);
  } catch {
    // A chave ausente não impede o logout.
  }
}

export async function loadTokens(): Promise<SessionTokens | null> {
  const accessToken = await read(ACCESS);
  const refreshToken = await read(REFRESH);
  const expires = await read(EXPIRES);
  if (!accessToken || !refreshToken || !expires) return null;
  if (expires === NEVER_EXPIRES) {
    return { accessToken, refreshToken, accessTokenExpires: null };
  }
  const accessTokenExpires = Number(expires);
  if (!Number.isFinite(accessTokenExpires)) return null;
  return { accessToken, refreshToken, accessTokenExpires };
}

export async function saveTokens(tokens: SessionTokens) {
  await write(ACCESS, tokens.accessToken);
  await write(REFRESH, tokens.refreshToken);
  await write(
    EXPIRES,
    tokens.accessTokenExpires == null ? NEVER_EXPIRES : String(tokens.accessTokenExpires),
  );
}

export async function clearStoredTokens() {
  await Promise.all([remove(ACCESS), remove(REFRESH), remove(EXPIRES)]);
}

export async function loadCompanyId() {
  return read(COMPANY);
}

export async function saveCompanyId(companyId: string) {
  await write(COMPANY, companyId);
}

export async function clearCompanyId() {
  await remove(COMPANY);
}

export async function loadUserId() {
  return read(USER);
}

export async function saveUserId(userId: string) {
  await write(USER, userId);
}

export async function clearUserId() {
  await remove(USER);
}

function lastTaskKey(userId: string, companyId: string) {
  return `performax.last.${userId}.${companyId}`;
}

export async function loadLastTaskId(userId: string, companyId: string) {
  return read(lastTaskKey(userId, companyId));
}

export async function saveLastTaskId(userId: string, companyId: string, taskId: string) {
  await write(lastTaskKey(userId, companyId), taskId);
}

export async function clearLastTaskId(userId: string, companyId: string) {
  await remove(lastTaskKey(userId, companyId));
}
