# Product Requirements Document

## Product
senda — "send a dollar home in a second."

## Problem
Migrants sending money home pay the world's worst consumer fees: the World Bank puts the average cost of a $200 remittance at **6.4%** — over 8% into Sub-Saharan Africa and up to **14.5% through banks**. Bank-delivered transfers take **1–5 business days**. Meanwhile stablecoin payments already move $122B+/year, and Monad settles transactions in ~1 second for fractions of a cent. The rails exist; the consumer product doesn't.

## Target Users
- **Sender:** a diaspora worker (US/EU → Nigeria, Mexico, Philippines) sending $50–$500/month to family. Owns a smartphone, uses WhatsApp, does NOT use crypto.
- **Recipient:** a family member who has never touched a wallet, an app store crypto listing, or a seed phrase.

## Goal
A cross-border money app where the sender types a phone number, hits send, and the recipient claims real dollars in seconds — with no blockchain knowledge required at any step.

## Core Features
1. **Passkey authentication** (Mera) — sign in with fingerprint; no seed phrase, no extension, no custody backend.
2. **Send to a phone number** — enter amount + recipient phone; funds lock in an escrow contract on Monad; the app opens WhatsApp or SMS with a claim link and the entered number prefilled. The sender reviews and sends the message.
3. **Claim flow** — recipient opens the link, creates a passkey in one tap, funds release instantly.
4. **Receipts that win the argument** — every transfer shows a comparison: "Western Union: 6.4%, 1–5 days. senda: $0.01, 0.8s." Local currency (NGN) shown alongside USD.

## MVP
- Passkey signup / login (Mera)
- AUSD balance display
- Send flow: amount + phone → escrow deposit → claim link (shareable via WhatsApp/SMS deep link; sender confirms delivery)
- Claim flow: link → passkey creation → AUSD withdrawal to recipient's passkey account
- Transaction history from escrow state and emitted events
- Cost & speed comparison screen

## Out of Scope (v1)
- Real fiat off-ramp (cash-out is mocked in the demo; a licensed partner integration is still required)
- KYC / AML flows
- Native mobile app (mobile-first PWA instead)
- Multi-currency display beyond USD + one demo corridor currency
- Family/shared pools (stretch idea, not MVP)
- Aurora Intents any-chain funding (stretch, bounty fields completed at submission if integrated)

## Success Criteria
A user should be able to:
1. Create an account with a passkey in under 30 seconds
2. See their AUSD balance
3. Send $200 AUSD to a phone number and get a claim link
4. Open the claim link on a second phone, create a passkey, and receive the AUSD — total elapsed time under 60 seconds
5. See total fees under $0.05 and settlement under 2 seconds on the receipt
6. See the Western Union comparison on every receipt
7. Cancel an unclaimed transfer and get the funds back

## Hackathon Alignment
- **Track:** Consumer Products & Payments — "financial products that use onchain rails as a design advantage, for users who don't identify as crypto users." senda is that sentence.
- **Agora bounty ($10K):** mobile app, AUSD, Mera passkey onboarding, cross-border, instant settlement — the MVP is the bounty spec.
- **Mera UX bounty ($2.5K):** Mera is the entire account layer.
