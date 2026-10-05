"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "./AuthProvider";

/**
 * Client-side route guard. Logged-out visitors bounce to / with a safe
 * `?next=` return path (server middleware can't read the in-memory session).
 */
export default function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status === "locked") {
      router.replace(`/?next=${encodeURIComponent(pathname)}`);
    }
  }, [status, router, pathname]);

  if (status !== "ready") {
    return (
      <main className="flex min-h-dvh flex-1 items-center justify-center bg-background px-6">
        <p className="text-base text-muted">Loading…</p>
      </main>
    );
  }

  return <>{children}</>;
}
