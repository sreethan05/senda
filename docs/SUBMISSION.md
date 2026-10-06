# Submission copy — final text for hackathon.monad.xyz (written Oct 6)

> Both fields verified: Description 7,717/8,000 chars · GTM 7,935/8,000 chars. Paste as-is.

## One-line description

Cross-border payments that feel like texting: send AUSD to a phone number on Monad, claimed with a fingerprint in ~1 second. No seed phrase, no app store, every fee verifiable on-chain.

## Description (7717 / 8,000)

THE PROBLEM

Every month, millions of migrants do one of the most selfless things a person can do with money: they send part of their paycheck home. And for that, the financial system charges them some of the worst fees in existence.

The World Bank puts the average cost of sending $200 at 6.4%. Into Sub-Saharan Africa it crosses 8%, and through bank rails it can hit 15%. Delivery takes anywhere from a few minutes (if you pay cash at a Western Union counter, at the worst rates) to 1-5 business days if it goes to a bank account. On a $200 transfer, that's $8 to $30 gone — money that was meant for school fees, rent, or groceries.

The strange part is that the technology to fix this already exists and has already won. Stablecoins settle across the world in seconds for fractions of a cent. Onchain stablecoin transfer volume is now measured in the trillions annually and exceeds Visa and Mastercard combined. Bitso, an exchange most consumers have never heard of, quietly moves a double-digit percentage of the entire US-to-Mexico remittance corridor over stablecoin rails. The money is already moving this way — it just isn't moving this way for ordinary people, through an interface they'd actually use.

That's the gap senda lives in.

WHAT WE BUILT

senda makes sending money home feel like sending a text message.

The sender opens senda on their phone. They're signed in with a passkey — their fingerprint, no seed phrase, no browser extension, no account to fund with a password manager. They type an amount on a big friendly keypad ("$200"), see it instantly converted to naira ("≈ ₦266,000"), type their mother's phone number, and confirm. $200 in AUSD — a fully-reserved US dollar stablecoin — locks in an escrow contract on Monad. A claim link appears, ready to send over WhatsApp.

The mother opens that link on her phone. She sees: "You've been sent $200.00." One tap on "Claim with your fingerprint" — her passkey account creates itself right there — and the money is in her account. About one second, end to end. She paid nothing. She never saw the word "blockchain."

THE PARTS UNDER THE HOOD

Three moving pieces, kept deliberately simple.

The contract. SendEscrow, deployed on Monad testnet at 0x963e40e3cbd3a196b814afcfd4bf39ff1656dc76, source-verified on Sourcify (full match). The sender deposits AUSD against an ephemeral "link key" — a fresh keypair generated in the browser at send time. Its public address goes on-chain; its private half lives only inside the claim link's URL fragment (the part of a URL that browsers never transmit to any server). To claim, that key signs an EIP-712 message naming the destination — the recipient's own fresh passkey account. The contract checks the signature against the stored link key and pays out. A relayer (our server wallet) submits this transaction so the recipient needs zero MON and zero knowledge; and since the relayer never sees the link key — only a signature over a fixed destination — it physically cannot redirect the money. A mempool observer can't either: replaying the transaction pays the same person, and forging a new destination requires a key that was never broadcast.

The claim experience. The recipient needs nothing before the link arrives: no wallet, no app, no account. The link itself creates their passkey account at claim time. Their fingerprint becomes their bank login.

The refund paths. The sender can cancel any unclaimed transfer and get everything back. If nobody claims before expiry, a permissionless reclaim bounces the funds to the sender. If the issuer ever freezes or pauses AUSD mid-flow, the transaction reverts atomically and the escrow stays intact — annoying, recoverable, and tested. Nothing in this design can strand money.

WHY MONAD AND WHY AUSD

Monad settles transactions in about a second with finality, and fees are fractions of a cent — which is what makes a "claim link" feel instant instead of like a blockchain transaction. But the honest reason we picked Monad for this hackathon is AUSD. It's issued by Agora, this bounty's sponsor: reserves managed by VanEck, custody at State Street, a conditional OCC trust charter granted in September 2026, and $184M+ of supply on Monad alone (up 462% in 90 days). A remittance product is a trust product. Issuing against a dollar whose reserves are institutionally managed — on a chain whose sponsor actively pays for that dollar's liquidity — is the strongest trust story we can tell without holding a single license ourselves yet.

THE SECURITY WORK (INCLUDING WHAT WE GOT WRONG FIRST)

We want to be transparent here because judges will read the contract, and because we think the mistakes are the interesting part.

Our first design used a 6-digit claim code, hashed on-chain. Our own review caught that this was broken: one million codes is brute-forceable in milliseconds, and whoever brute-forced the code could claim to themselves with a perfectly valid signature. The "second factor" didn't exist.

The second design moved to a 32-byte secret with a relayer. Also broken: the relayer must put the secret into the transaction it submits, which means the relayer learns it — and could then claim to itself. And the secret becomes public the moment an honest transaction hits the mempool, so a front-runner could race the recipient.

Version three, which shipped, removes the shared secret entirely. The link carries a private key; the claim carries only that key's signature over a fixed destination. Now the relayer can censor but never steal, front-running has nothing to act on, and the whole security model fits in one sentence: whoever holds the link owns the money, exactly like cash.

We also write tests before we get sentimental about code: 28 of them — unit, fuzzing, and stateful invariants covering solvency (the contract always holds at least what active escrows account for), no double payouts, and refunds never exceeding deposits. One of our invariants initially failed, and the bug was in our test harness (it counted money a recipient legitimately received as a sender's "loss"), not the contract — we fixed the model and kept the invariant. Slither and Aderyn run clean or triaged-with-reasons, and the receipt in the app compares our cost against Western Union's, line by line, with the transaction hash one tap away on the block explorer.

WHAT EXISTS TODAY, LIVE

A working mobile-first PWA on Monad testnet: passkey onboarding, the full send flow (keypad, live NGN conversion, honest cost block shown before you confirm), the claim flow with passkey-created recipient accounts, the gasless relayer API with rate limiting and pre-gas signature verification, transfer history with cancel-and-refund, and an installable standalone PWA experience.

And the complete loop has been executed end-to-end on real testnet: $100 approved and deposited into escrow, claimed through the relayer API, and received — exactly 100000000 units — by a recipient account that was created during the claim. Every step is a real transaction visible on the block explorer.

WHAT WE DELIBERATELY DID NOT BUILD

We cut more than we kept. No multi-token support. No AI features bolted on. No Aurora cross-chain funding, Envio indexer, or Nansen analytics panels until the core loop was green (they're scoped and waiting). The off-ramp to naira is honestly mocked in the demo — production routes it through licensed Nigerian VASPs (Yellow Card, Busha, Quidax all have APIs), and we say exactly that rather than pretending. Scope discipline is the reason the core loop is real.

OPEN SOURCE
Everything: github.com/sreethan05/senda — contract, app, relayer, and the full research and decision log (including the designs we rejected and why).


## Go-to-market and user acquisition (7935 / 8,000)

WHO OUR FIRST USERS ACTUALLY ARE

Not "the diaspora" in the abstract — specific people with specific group chats.

Our wedge corridor is US to Nigeria, a ~$21.8B annual flow and Africa's largest recipient market. The first hundred senders we want are Nigerian professionals and students in the US who already send money home monthly: the nurse in Houston sending $300 to her mother in Lagos, the grad student topping up a sibling's account in Ibadan, the hometown association treasurer collecting dues. They're 22 to 45, they live on WhatsApp, they already compare rates between LemFi, Afriex and their bank, and they already know what "they'll hide it in the rate" means.

The recipients — mothers, siblings, cousins — are not a marketing channel at all. They arrive free, attached to every send: each claim link someone opens is a new account being created by the exact person the sender wanted to reach. The product recruits its own second user every single time the first user does anything. That's the quiet advantage of the claim-link model, and it shapes the whole acquisition plan.

WEEK ONE AND TWO: WHERE WE START

We're not buying ads. Remittances run on trust, and trust doesn't come from a banner.

We start with the communities that already exist. Monad's Metropolis hackathon has 50+ student and builder chapters as community supporters — including African and Nigerian student associations. Those are our first rooms. The pitch into any of them takes ninety seconds: "I'll send you a dollar right now, on your phone, no wallet. Open the link and use your fingerprint." The demo IS the acquisition funnel — one send produces a new user (the claimer) and a receipt they'll show someone else.

Alongside that, we do the unglamorous version of the same thing: Nigerian diaspora WhatsApp groups and hometown association chats (one family admin forwards a claim link and an entire household learns senda exists), a handful of Nigerian creator/finance TikTok and X accounts whose audiences already ask them "which app has the best rate," and campus blockchain clubs for the power-user early adopters who'll stress-test it and tell us what's broken.

WEEKS THREE TO EIGHT: THE LOOP WE'RE OPTIMIZING

One metric matters before any spend: completed send-to-claim loops per sender. Not signups, not downloads — actual money delivered home.

The loop is engineered to market itself. Every completed transfer produces a shareable receipt showing exactly what the sender paid and how fast it landed — line by line, with the on-chain proof attached. Nobody screenshots their Western Union fee. People will screenshot ours, because "look what it cost me: one cent" is content. Every claim link shared is a warm intro to a new recipient, and every recipient who later becomes a sender (many diaspora relationships are bidirectional) closes the loop.

We'll run small, measurable experiments: rate-comparison posts in diaspora groups ("$200 via senda vs the same send on three apps — receipts attached"), a weekly public build log on X and LinkedIn tagging Monad, Agora and Mera (this also feeds our Best Community Team Project submission honestly — we're building in public regardless), and referral asks at the moment of delight, right after a claim completes: "send your first transfer" is one tap away at the exact moment someone just felt money arrive in a second.

MONTHS TWO TO SIX: CORRIDOR DEPTH BEFORE CORRIDOR COUNT

The temptation is to add ten corridors. We're going to do the opposite: make US to Nigeria work so well that switching is embarrassing.

That means: naira off-ramp integrated in-app through licensed Nigerian VASP partners (Yellow Card, Busha and Quidax all expose APIs — recipients get naira in their bank account in minutes, at roughly 1% all-in, shown transparently next to our zero). It means USD on-ramp for senders through partners like Mercuryo so "get money into senda" stops being the demo caveat and becomes a feature. It means the CBN's new VASP regulatory sandbox (opened August 2026) and Payments System Vision 2028 — Nigeria is actively building the on-ramp for exactly this product, and we intend to enter through that door with a licensed partner rather than around it.

THE COMPLIANCE POSTURE, BECAUSE DISTRIBUTION IN THIS SPACE IS LEGAL DISTRIBUTION

We're explicit in the product itself: today's build is a demo; production runs through partners. US fiat-side licensing happens through a licensed remittance partner before we touch real user funds at scale (multi-state MTLs cost $250K+, which is precisely why the partner model wins for a startup). The stablecoin leg itself is peer-to-peer between self-custodied passkey accounts. Nigeria's side is carried by SEC-licensed VASPs doing BVN/NIN KYC. And self-directed wallet-to-wallet stablecoin transfer sits outside the US remittance excise tax — a 2026 policy that is actively pushing cash-funded, provider-mediated flows onto rails like ours. Distribution strategy and regulatory strategy point the same direction: toward senda.

THE BUSINESS THE ACQUISITION BUILDS

Every sender we acquire is worth roughly what a Remitly customer is worth — about $188 per active user per year, at 60%+ gross margin in that industry — except our cost base is radically lower: no correspondent banks, no pre-funding accounts in every country, no rate obfuscation. Revenue comes from a ~1% embedded FX spread plus float carry on held balances, shared with users. Once balances sit (and they will — dollar savings in a 70%-devaluing-currency country is its own product), the float yield compounds the margin. Later: bill pay, airtime, and opening the corridor as an API for smaller fintechs — the Nala playbook, which raised $40M on roughly 500K users across 11 corridors.

WHAT WE'D DO WITH THE PRIZE

Concretely: seed the first corridor's liquidity and off-ramp float, integrate a licensed Nigerian VASP API end-to-end, take the contract through a professional audit (the hackathon's ack3 scan is the first pass, not the last), and put the app in front of three diaspora communities for a real 90-day cohort — with every metric public on-chain, because that's the whole brand.

FIRST 90 DAYS, CONCRETE

Days 1-14: ship the testnet build to 25 hand-picked testers from three diaspora groups; instrument the funnel (link opened, passkey created, claim completed, time-to-claim); fix whatever breaks on real phones. Days 15-45: first 100 real loops through two communities; weekly receipts thread; integrate the Busha or Yellow Card API so the off-ramp stops being mocked; target 60%+ claim-completion within 1 hour of receive. Days 46-90: 500 completed loops, three hometown-association pilots, publish the corridor dashboard (volume, average send, claim time — all public), and take the licensing conversation with one US partner and one Nigerian VASP from intro to term sheet. If those five numbers land, the Series-seed story writes itself; if they don't, we'll know precisely which step of the funnel is broken instead of guessing.

WHAT WE WILL NOT DO

Buy installs. Airdrop tokens for signups. Launch five corridors at once. Spam every group chat with referral codes — remittances are trust, one spammy forward poisons the well. Growth in this category is borrowed trust: from the community admin who vouches for us, from the receipt that proves the fee, from the mother who got her money in a second and told her sister. Every acquisition decision optimizes for that borrowed trust, not against it.

RISKS WE'RE TRACKING, HONESTLY

Distribution is the graveyard of this category — Daimo had better engineering than us and died of it, which is why this entire plan is corridor-community-first rather than tech-first. Off-ramp licensing is a dependency, which is why it's a partner before it's a build. And Monad's consumer ecosystem is young, which is exactly why the lane is empty — the same bet Monad Foundation is making with its own incentives.


## GitHub repository

https://github.com/sreethan05/senda

## Repo files to reference

- Contract (Sourcify-verified): 0x963e40e3cbd3a196b814afcfd4bf39ff1656dc76
- E2E proof txs: approve 0xb990…cb6 · deposit 0x4604…3b9d · claim 0x703a…c8f5
