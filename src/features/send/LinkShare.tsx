"use client";

import { useState } from "react";
import { Check, Copy, MessageCircle, Share2, Smartphone } from "lucide-react";
import { explorerTxUrl } from "@/lib/config";

/**
 * Claim-link share (TASK-404). The link fragment carries the link key's
 * PRIVATE half and is the only copy — shown with a "don't forward" note.
 * Channels: native share sheet first (skips all encoding quirks), then
 * WhatsApp / SMS anchors, then copy.
 */

export function LinkShare(params: { claimUrl: string; txHash: string | null; recipientPhone: string }) {
  const [copied, setCopied] = useState(false);
  const message = `You've been sent money via senda — claim it here (don't share this link, it's yours only): ${params.claimUrl}`;
  const waUrl = `https://wa.me/${params.recipientPhone}?text=${encodeURIComponent(message)}`;
  const smsUrl = `sms:${params.recipientPhone}?body=${encodeURIComponent(message)}`;

  async function nativeShare() {
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await navigator.share({ title: "senda", text: message, url: params.claimUrl });
        return;
      } catch {
        // user dismissed — fall through to anchors
      }
    }
    await navigator.clipboard.writeText(params.claimUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl bg-card p-5 shadow-sm">
        <p className="text-sm font-semibold text-ink">Send the link to your recipient</p>
        <p className="mt-1 text-xs leading-relaxed text-muted">
          We&apos;ve filled in the number you entered. Your messaging app will open with this link ready;
          review and send it yourself. Anyone with the link can claim the money.
        </p>
        <div className="mt-3 break-all rounded-xl bg-surface p-3 font-mono text-[11px] leading-relaxed text-muted">
          {params.claimUrl}
        </div>
      </div>

      <a
        href={waUrl}
        target="_blank"
        rel="noreferrer"
        className="flex min-h-[52px] items-center justify-center gap-2 rounded-full bg-primary text-base font-semibold text-white active:opacity-80"
      >
        <MessageCircle size={20} /> Open WhatsApp
      </a>
      <a
        href={smsUrl}
        className="flex min-h-[52px] items-center justify-center gap-2 rounded-full border border-line bg-card text-base font-semibold text-ink active:opacity-80"
      >
        <Smartphone size={18} /> Open SMS
      </a>
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={nativeShare}
          className="flex min-h-[48px] items-center justify-center gap-2 rounded-full border border-line bg-card text-sm font-semibold text-ink active:opacity-80"
        >
          <Share2 size={16} /> More
        </button>
        <button
          type="button"
          onClick={async () => {
            await navigator.clipboard.writeText(params.claimUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
          className="flex min-h-[48px] items-center justify-center gap-2 rounded-full border border-line bg-card text-sm font-semibold text-ink active:opacity-80"
        >
          {copied ? <Check size={16} /> : <Copy size={16} />} {copied ? "Copied" : "Copy link"}
        </button>
      </div>

      {params.txHash !== null && (
        <a
          href={explorerTxUrl(params.txHash)}
          target="_blank"
          rel="noreferrer"
          className="text-center text-xs font-medium text-primary underline underline-offset-4"
        >
          View the deposit on-chain ↗
        </a>
      )}
    </div>
  );
}
