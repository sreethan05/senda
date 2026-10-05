import { createPublicClient, http, type PublicClient } from "viem";
import { config } from "@/lib/config";

/**
 * ALL chain access goes through src/lib/chain/ (RULES.md) — components never
 * construct clients. Monad charges the DECLARED gas limit, not gas used, so
 * every write path must pass a tight explicit `gas` value (RESEARCH_TECH §1).
 */

export function getPublicClient(): PublicClient {
  return createPublicClient({
    chain: config.chain,
    transport: http(config.rpcUrl),
  });
}

// Note: wallet clients are created where signing happens (mera.ts / devWallet.ts
// in Phase 2) because the account object carries the signing session.
