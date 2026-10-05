import AuthPanel from "@/features/auth/AuthPanel";

/** Placeholder Home (TASK-103 shell + TASK-202 auth) — balance + send flow land in Phase 4. */
export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-1 flex-col px-6 pb-10 pt-16">
      <p className="font-display text-4xl font-extrabold tracking-tight text-ink">senda</p>
      <p className="mt-2 text-lg text-muted">Send a dollar home in a second.</p>
      <div className="mt-8">
        <AuthPanel />
      </div>
      <p className="mt-auto pt-10 text-center text-xs text-muted">
        Secure sign-in — your fingerprint never leaves your device.
      </p>
    </main>
  );
}
