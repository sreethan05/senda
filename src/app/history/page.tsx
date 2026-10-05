import Link from "next/link";
import RequireAuth from "@/features/auth/RequireAuth";

/** Guarded shell — the history list lands in Phase 5 (TASK-505). */
export default function HistoryPage() {
  return (
    <RequireAuth>
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-1 flex-col px-6 pb-10 pt-16">
        <p className="font-display text-2xl font-bold text-ink">Activity</p>
        <div className="mt-6 rounded-2xl bg-card p-6 shadow-sm">
          <p className="text-center text-base text-muted">No transfers yet — your history will show up here.</p>
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
