import { defineChain, type Chain } from "viem";

/**
 * Chain + contract constants. Addresses come from env when present so testnet
 * and mainnet builds differ only by configuration (ADR-011: testnet-first).
 * Values verified Oct 4-5 2026 — see docs/RESEARCH_TECH.md before changing.
 */

export const monadTestnet: Chain = defineChain({
  id: 10143,
  name: "Monad Testnet",
  nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
  rpcUrls: { default: { http: ["https://testnet-rpc.monad.xyz"] } },
  blockExplorers: { default: { name: "MonadScan", url: "https://testnet.monadscan.com" } },
});

export const monad: Chain = defineChain({
  id: 143,
  name: "Monad",
  nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.monad.xyz"] } },
  blockExplorers: { default: { name: "MonadScan", url: "https://monadscan.com" } },
});

export const AUSD_ADDRESSES = {
  143: "0x00000000eFE302BEAA2b3e6e1b18d08D69a9012a",
  10143: "0xa9012a055bd4e0eDfF8Ce09f960291C09D5322dC",
} as const;

export const AUSD_DECIMALS = 6;

function chainById(id: number): Chain {
  if (id === monad.id) return monad;
  if (id === monadTestnet.id) return monadTestnet;
  throw new Error(`Unsupported chain id ${id} — set NEXT_PUBLIC_CHAIN_ID to 143 or 10143`);
}

const chainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? monadTestnet.id);

const activeChain = chainById(chainId);
const escrowDeploymentBlockRaw = process.env.NEXT_PUBLIC_ESCROW_DEPLOYMENT_BLOCK;

export const config = {
  chain: activeChain,
  rpcUrl:
    process.env.NEXT_PUBLIC_RPC_URL ??
    activeChain.rpcUrls.default.http[0] ??
    "https://testnet-rpc.monad.xyz",
  explorerUrl:
    process.env.NEXT_PUBLIC_EXPLORER_URL ??
    activeChain.blockExplorers?.default.url ??
    "https://testnet.monadscan.com",
  ausdAddress: (process.env.NEXT_PUBLIC_AUSD_ADDRESS ??
    AUSD_ADDRESSES[activeChain.id as 143 | 10143]) as `0x${string}`,
  escrowAddress: (process.env.NEXT_PUBLIC_ESCROW_ADDRESS || undefined) as
    | `0x${string}`
    | undefined,
  escrowDeploymentBlock: escrowDeploymentBlockRaw && /^\d+$/.test(escrowDeploymentBlockRaw)
    ? BigInt(escrowDeploymentBlockRaw)
    : null,
  isTestnet: chainId === monadTestnet.id,
};

export function explorerTxUrl(txHash: string): string {
  return `${config.explorerUrl}/tx/${txHash}`;
}

export function explorerAddressUrl(address: string): string {
  return `${config.explorerUrl}/address/${address}`;
}

/** Short address for UI chips: 0x1234…abcd */
export function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}
