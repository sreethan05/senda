"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import type { WalletClient } from "viem";
import {
  clearStoredCredential,
  createAccount,
  createWalletClientForSession,
  lockAccount,
  login,
  readCachedAccount,
  type EvmAddress,
  type MeraAccount,
} from "@/lib/chain/mera";
import {
  createDevWalletClient,
  getDevBurnerAccount,
  isDevBurnerAvailable,
} from "@/lib/chain/devWallet";
import { ACCOUNT_MISMATCH_MESSAGE, meraErrorMessage } from "./errors";

export type AuthStatus = "loading" | "locked" | "ready";
export type BusyOp = "create" | "login" | null;
export type AuthMethod = "passkey" | "burner" | null;

interface AuthContextValue {
  status: AuthStatus;
  /** Live address when ready; cached address when locked; null on a fresh device. */
  address: EvmAddress | null;
  authMethod: AuthMethod;
  /** True only in local dev with NEXT_PUBLIC_DEV_BURNER_KEY set — always false in prod. */
  devBurnerAvailable: boolean;
  hasCachedCredential: boolean;
  busyOp: BusyOp;
  error: string | null;
  create: () => Promise<void>;
  login: () => Promise<void>;
  /** DEV ONLY — sign in with the local burner key, no passkey ceremony. */
  useBurner: () => void;
  /** Signing client for the active method (passkey session or burner), or null when locked. */
  getSignerClient: () => WalletClient | null;
  /** Log out: ends the in-memory session, keeps the device credential for one-tap login. */
  lock: () => void;
  /** Forget this device: ends the session AND drops the stored credential. */
  forgetDevice: () => void;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/** Accept only same-origin paths — never external URLs. */
function safeNextPath(): string | null {
  const raw = new URLSearchParams(window.location.search).get("next");
  if (raw !== null && /^\/(?!\/)/.test(raw)) return raw;
  return null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const sessionRef = useRef<MeraAccount | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [address, setAddress] = useState<EvmAddress | null>(null);
  const [authMethod, setAuthMethod] = useState<AuthMethod>(null);
  const [hasCachedCredential, setHasCachedCredential] = useState(false);
  const [busyOp, setBusyOp] = useState<BusyOp>(null);
  const [error, setError] = useState<string | null>(null);

  const devBurnerAvailable = isDevBurnerAvailable();

  const hydrateFromCache = useCallback(() => {
    const cached = readCachedAccount();
    setAddress(cached?.address ?? null);
    setHasCachedCredential(cached !== null);
    setStatus("locked");
  }, []);

  /* eslint-disable react-hooks/set-state-in-effect -- mount-time hydration from localStorage (external system), runs once */
  useEffect(() => {
    hydrateFromCache();
  }, [hydrateFromCache]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const create = useCallback(async () => {
    if (busyOp !== null) return;
    setBusyOp("create");
    setError(null);
    try {
      const account = await createAccount();
      sessionRef.current = account;
      setAddress(account.address);
      setAuthMethod("passkey");
      setHasCachedCredential(true);
      setStatus("ready");
      const next = safeNextPath();
      if (next !== null) router.replace(next);
    } catch (e) {
      setError(meraErrorMessage(e));
    } finally {
      setBusyOp(null);
    }
  }, [busyOp, router]);

  const doLogin = useCallback(async () => {
    if (busyOp !== null) return;
    setBusyOp("login");
    setError(null);
    const cached = readCachedAccount();
    try {
      const account = await login();
      if (cached !== null && account.address !== cached.address) {
        lockAccount(account);
        setError(ACCOUNT_MISMATCH_MESSAGE);
        return;
      }
      sessionRef.current = account;
      setAddress(account.address);
      setAuthMethod("passkey");
      setHasCachedCredential(true);
      setStatus("ready");
      const next = safeNextPath();
      if (next !== null) router.replace(next);
    } catch (e) {
      setError(meraErrorMessage(e));
    } finally {
      setBusyOp(null);
    }
  }, [busyOp, router]);

  const useBurner = useCallback(() => {
    setError(null);
    if (!isDevBurnerAvailable()) {
      setError("Dev burner unavailable — local dev only.");
      return;
    }
    try {
      const burner = getDevBurnerAccount();
      sessionRef.current = null;
      setAuthMethod("burner");
      setAddress(burner.address);
      setStatus("ready");
      const next = safeNextPath();
      if (next !== null) router.replace(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Try again.");
    }
  }, [router]);

  /** Signing client for writes (TASK-402 reuses this) — null when locked. */
  const getSignerClient = useCallback((): WalletClient | null => {
    const account = sessionRef.current;
    if (account !== null) return createWalletClientForSession(account.session);
    if (authMethod === "burner" && isDevBurnerAvailable()) return createDevWalletClient();
    return null;
  }, [authMethod]);

  const lock = useCallback(() => {    const account = sessionRef.current;
    sessionRef.current = null;
    if (account !== null) {
      try {
        lockAccount(account);
      } catch {
        // Session already ended — still move to the locked UI.
      }
    }
    setAuthMethod(null);
    hydrateFromCache();
  }, [hydrateFromCache]);

  const forgetDevice = useCallback(() => {
    lock();
    clearStoredCredential();
    setAddress(null);
    setHasCachedCredential(false);
    setStatus("locked");
  }, [lock]);

  const clearError = useCallback(() => setError(null), []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      address,
      authMethod,
      devBurnerAvailable,
      hasCachedCredential,
      busyOp,
      error,
      create,
      login: doLogin,
      useBurner,
      getSignerClient,
      lock,
      forgetDevice,
      clearError,
    }),
    [status, address, authMethod, devBurnerAvailable, hasCachedCredential, busyOp, error, create, doLogin, useBurner, getSignerClient, lock, forgetDevice, clearError],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (ctx === null) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
