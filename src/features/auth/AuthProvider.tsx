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
import {
  clearStoredCredential,
  createAccount,
  lockAccount,
  login,
  readCachedAccount,
  type EvmAddress,
  type MeraAccount,
} from "@/lib/chain/mera";
import { ACCOUNT_MISMATCH_MESSAGE, meraErrorMessage } from "./errors";

export type AuthStatus = "loading" | "locked" | "ready";
export type BusyOp = "create" | "login" | null;

interface AuthContextValue {
  status: AuthStatus;
  /** Live address when ready; cached address when locked; null on a fresh device. */
  address: EvmAddress | null;
  hasCachedCredential: boolean;
  busyOp: BusyOp;
  error: string | null;
  create: () => Promise<void>;
  login: () => Promise<void>;
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
  const [hasCachedCredential, setHasCachedCredential] = useState(false);
  const [busyOp, setBusyOp] = useState<BusyOp>(null);
  const [error, setError] = useState<string | null>(null);

  /* eslint-disable react-hooks/set-state-in-effect -- mount-time hydration from localStorage (external system), runs once */
  useEffect(() => {
    const cached = readCachedAccount();
    setAddress(cached?.address ?? null);
    setHasCachedCredential(cached !== null);
    setStatus("locked");
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  const create = useCallback(async () => {
    if (busyOp !== null) return;
    setBusyOp("create");
    setError(null);
    try {
      const account = await createAccount();
      sessionRef.current = account;
      setAddress(account.address);
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

  const lock = useCallback(() => {
    const account = sessionRef.current;
    sessionRef.current = null;
    if (account !== null) {
      try {
        lockAccount(account);
      } catch {
        // Session already ended — still move to the locked UI.
      }
      setStatus("locked");
    }
  }, []);

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
      hasCachedCredential,
      busyOp,
      error,
      create,
      login: doLogin,
      lock,
      forgetDevice,
      clearError,
    }),
    [status, address, hasCachedCredential, busyOp, error, create, doLogin, lock, forgetDevice, clearError],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (ctx === null) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
