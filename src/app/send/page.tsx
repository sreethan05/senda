import Link from "next/link";
import RequireAuth from "@/features/auth/RequireAuth";

/** Guarded shell — the real send flow lands in Phase 4 (TASK-401+). */
export default function SendPage() {
  return (
    <RequireAuth>
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-1 flex-col px-6 pb-10 pt-16">
        <p className="font-display text-2xl font-bold text-ink">Send money</p>
        <div className="mt-6 rounded-2xl bg-card p-6 shadow-sm">
          <p className="text-center text-base text-muted">Coming next — amount, recipient, and confirm.</p>
        </div>
        <Link
          href="/"
          className="mt-6 flex min-h-[48px] items-center justify-center text-sm font-semibold text-muted"
        >
          Back home
        </Link>
      </main>
    </RequireAuth>
  );
}
