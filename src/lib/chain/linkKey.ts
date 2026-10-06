import { privateKeyToAccount } from "viem/accounts";
import { config } from "@/lib/config";

/**
 * Ephemeral link key (ADR-013 / sketch v3): a 32-byte private key generated
 * client-side at SEND time. Its address is committed on-chain by depositTo();
 * its private half travels ONLY in the claim-link URL fragment. At claim time
 * the recipient's app signs the EIP-712 `Claim(escrowId, payee)` authorization
 * WITH THIS KEY (no gas, no wallet needed) — the relayer only ever sees the
 * signature, so it can never redirect funds. Possession of the link =
 * ownership (Linkdrop model).
 */

export interface LinkKeyPair {
  /** 64 hex chars, no 0x prefix — the ONLY place the private half ever lives */
  privateKeyHex: string;
  address: `0x${string}`;
}

export function generateLinkKey(): LinkKeyPair {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const privateKeyHex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const account = privateKeyToAccount(`0x${privateKeyHex}`);
  return { privateKeyHex, address: account.address };
}

export function linkKeyFromFragment(hexNoPrefix: string): LinkKeyPair {
  if (!/^[0-9a-f]{64}$/i.test(hexNoPrefix)) {
    throw new Error("Invalid link key in URL fragment");
  }
  const account = privateKeyToAccount(`0x${hexNoPrefix.toLowerCase()}`);
  return { privateKeyHex: hexNoPrefix.toLowerCase(), address: account.address };
}

/**
 * EIP-712 authorization signature. The digest the contract recovers is
 * keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, keccak256(
 *   abi.encode(CLAIM_TYPEHASH, escrowId, payee)
 * ))) with domain {name:"SendEscrow", version:"1", chainId, verifyingContract}
 * — identical to OZ EIP712._hashTypedDataV4 in the sketch (sketch v3).
 */
export async function signClaimAuthorization(params: {
  linkKeyPrivateKeyHex: string;
  escrowId: bigint;
  payee: `0x${string}`;
}): Promise<`0x${string}`> {
  if (!config.escrowAddress) {
    throw new Error("Escrow contract not deployed — NEXT_PUBLIC_ESCROW_ADDRESS unset");
  }
  const account = privateKeyToAccount(`0x${params.linkKeyPrivateKeyHex}`);
  return account.signTypedData({
    domain: {
      name: "SendEscrow",
      version: "1",
      chainId: config.chain.id,
      verifyingContract: config.escrowAddress,
    },
    types: {
      Claim: [
        { name: "escrowId", type: "uint256" },
        { name: "payee", type: "address" },
      ],
    },
    primaryType: "Claim",
    message: {
      escrowId: params.escrowId,
      payee: params.payee,
    },
  });
}

/** keccak256 of the link key hex — the anon-safe Supabase lookup key. */
export async function keyHashFor(privateKeyHex: string): Promise<`0x${string}`> {
  const { keccak256, toBytes } = await import("viem");
  return keccak256(toBytes(privateKeyHex));
}
