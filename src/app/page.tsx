"use client";

import Link from "next/link";
import { Send } from "lucide-react";
import AuthPanel from "@/features/auth/AuthPanel";
import BalanceCard from "@/features/balance/BalanceCard";
import FaucetButton from "@/features/balance/FaucetButton";
import { useAuth } from "@/features/auth/AuthProvider";
import { config } from "@/lib/config";

/** Home (DESIGN.md §Screens): balance hero + one green CTA + transfers link. */
function HomeInner() {
  const { address, status } = useAuth();
  const authed = status === "ready" && address !== null;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-1 flex-col px-6 pb-10 pt-16">
      <p className="font-display text-4xl font-extrabold tracking-tight text-ink">senda</p>
      <p className="mt-2 text-lg text-muted">Send a dollar home in a second.</p>

      {authed && address !== null ? (
        <>
          <div className="mt-8">
            <BalanceCard address={address} />
          </div>
          <Link
            href="/send"
            className="mt-5 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-full bg-primary text-base font-semibold text-white active:opacity-80"
          >
            <Send size={18} /> Send money
          </Link>
          <Link
            href="/history"
            className="mt-3 flex min-h-[48px] w-full items-center justify-center rounded-full border border-stone-300 bg-white text-sm font-semibold text-ink active:opacity-80"
          >
            Your transfers
          </Link>
          {config.isTestnet && (
            <div className="mt-6">
              <FaucetButton address={address} onFunded={() => window.location.reload()} />
            </div>
          )}
        </>
      ) : (
        <div className="mt-8">
          <AuthPanel />
        </div>
      )}

      <p className="mt-auto pt-10 text-center text-xs text-muted">
        Secure sign-in — your fingerprint never leaves your device.
      </p>
    </main>
  );
}

export default function Home() {
  return <HomeInner />;
}
