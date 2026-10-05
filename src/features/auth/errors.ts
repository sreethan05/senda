import { isMeraError } from "@/lib/chain/mera";

/** Mera error codes → plain-language copy (DESIGN.md: zero crypto jargon). */
export function meraErrorMessage(error: unknown): string {
  if (isMeraError(error)) {
    switch (error.code) {
      case "PRF_UNAVAILABLE":
        return "This device didn't save the security key. Try again and choose “Save to Google Password Manager” or iCloud Keychain when asked.";
      case "PASSKEY_OPERATION_FAILED":
        return "Sign-in was cancelled or didn't work. Try again.";
      case "CRYPTO_UNAVAILABLE":
        return "This browser can't do secure sign-in. Use Chrome or Edge.";
      default:
        return "Something went wrong. Try again.";
    }
  }
  return "Something went wrong. Try again.";
}

export const ACCOUNT_MISMATCH_MESSAGE =
  "That security key opens a different account. Use the device you signed up with.";
