# LLM Council Transcript #2 — НищеMap improvements

**Date:** 2026-08-10 00:23
**Counciled:** website improvements toward the viral crowd-fed goal; 301–500₽ tier; mass-population strategy.
**Mapping:** A = The Outsider · B = The Executor · C = The Contrarian · D = The Expansionist · E = The First Principles Thinker

---

# Framed Question

НищеMap — a cheap-eats map of Moscow modeled on Korea's viral Geojimap. GOAL: viral, crowd-fed map where broke students find food ≤300₽, beggar-humor as growth engine. Locked strategy: seed-led, no scraping, crowdsource day 1, TG Mini App next, TG meme-channel publicity.

Current: web v1 works (coin pins gold/silver/bronze, search/category/district filters, list view, reconfirm badges, ценник design). Data: 36 real venues / 86 items / 16 of ~125 districts, all press-sourced with "не проверена" badges; press research exhausted. NO backend — submissions die in localStorage. Solo dev, 0₽, founder in Moscow.

Decide: (1) add 301–500₽ tier 4? (2) mass-populate: founder walk / OSM no-price gray pins / chain store-locator branches / TG bounties? (3) highest-leverage website improvement for the goal.

---

# Response A

Okay, reading this cold: you built a whole app and the "submit a price" button — the entire crowdsourcing point of the product — currently does nothing. It writes to the user's own browser and evaporates. That's not a minor gap, that's the product not existing yet. If I'm a student who finds this via a meme channel, tries to add my favorite 250₽ stolovaya, and it silently vanishes into my own localStorage, I never come back, and I definitely don't tell my friends. Fix that before anything else on this list — it's not "improvement #3," it's the actual app.

On the price tier: I don't know what Geojimap's ₩10,000 means and I don't care. What I do know is you're telling me "cheap food map" and then excluding shaurma, which is the single most obvious cheap food in Moscow. That's not a brutal-but-cool constraint, that's the map being wrong about its own subject. Add the tier.

On mass-populating with gray "no price" pins from OpenStreetMap: be careful — a map full of gray dots with no price looks broken, not inviting. If I open it and see 40% empty pins, my read is "this app is unfinished," not "I should help." Maybe fine as a subtle layer, but don't lead with it.

The "не проверена" badge language — as an outsider I'd just quietly wonder why the site is telling me all its own data might be wrong. That's honest, but honesty as your first impression is a weird choice for something trying to look poppin and alive at launch.

---

# Response B

1. Yes, add tier 4, but don't blend it into the main game. Keep gold/silver/bronze as the ≤300₽ core identity — that's the beggar-humor brand. Add a 4th tier (say "медь" or literally label it 301–500₽) as a visually distinct, slightly separated coin — maybe copper or a dull grey — so шаурма and other 300+ staples get on the map without diluting "cheap eats under 300" as the meme. Monday morning: change one config constant (PRICE_TIERS), add a 4th coin color, done in an hour. This isn't a strategy debate, it's a data-model tweak — ship it today.

2. Do (b) immediately, (a) in parallel, skip (c) until tier 4 proves itself, and (d) only after (b) exists. OSM import of amenity=fast_food/canteen/cafe within Moscow via Overpass API is a few hours of scripting — you get hundreds of gray "no price yet" pins on day one. That's your crowd-contribution bait: an empty map with 36 dots looks dead, a map with 400 gray pins begging "add the price" looks alive and gives new users an obvious first action. Founder's walk (a) should happen concurrently, targeting their own neighborhood specifically to seed 15-20 fully-verified gold-standard entries that anchor trust and populate before/after screenshots for the launch meme post. (c) is dead until tier 4 is confirmed and even then is low priority — chain locations don't build the "crowdsourced" story, they're wallpaper.

3. The backend is not optional, it's the whole product. A submission form writing to localStorage means the core loop — the entire reason this is "crowd-fed" — doesn't exist yet. You cannot launch in TG meme channels with a form that silently deletes user input; the first viral spike will submit prices into a void and nobody will know, but you will, and it'll kill trust permanently once discovered. Monday morning: stand up the cheapest possible backend — Supabase or Firebase free tier, one table (venue_id, price, item, submitted_at, ip_hash for spam throttling), submission form POSTs to it, admin can eyeball/approve in a spreadsheet view. This is a day of work, not a week. Ship this before OSM import, before tier 4, before any publicity — everything else is pointless without it.

---

# Response C

**The real fatal flaw you're not asking about: you have no backend.** Everything in Q1 and Q2 is optimizing a car with no engine. "Crowdsource from day 1" was the locked strategy — but right now every submission vanishes into localStorage on the user's own device. Nobody else ever sees it. The core loop that makes this Geojimap and not just a static map doesn't exist yet. A free Google Sheet + Apps Script webhook, or Supabase free tier, is an afternoon of work and should have shipped before tier debates.

On tier 4: adding 301-500₽ isn't a data correction, it's brand dilution. "≤300₽, brutal, no шаурма" is exactly the kind of extreme, self-deprecating cruelty that makes something meme-able. Soften the cap and you're just another cheap-eats app with wider price bands — Geojimap's virality came from the beggar-humor being uncomfortably real, not accommodating. If shawarma matters that much, let it live as a separate visual flag, not a cap raise that quietly makes the whole map easier and less funny.

On populate: OSM gray "no-price" pins are your biggest unrecognized risk. A map that's supposed to be about price, showing hundreds of gray "we don't know" pins, doesn't read as "has stuff" — it reads as broken and abandoned, the opposite of the ценник-out-of-the-столовой scrappy-but-alive aesthetic you built. Founder-walk (a) is slow but every pin is real and on-brand; that's worth more at launch than volume that signals emptiness. Fix the backend first — nothing else matters until submissions go somewhere visible.

---

# Response D

Tier 4 (301–500₽): yes, add it, but not as an equal fourth tier — as the volume engine. Bronze-only capped at 300₽ excludes shaurma, which is now the single most-searched cheap food item by students citywide. That's not a niche gap, that's turning away your best SEO/word-of-mouth query. Geojimap's own cap is already above your bronze ceiling in ruble terms — you're being more purist than the source you're copying. Add tier 4, but rename it something self-deprecating (not "gold" — the humor engine needs an even more broke-sounding label than gold, e.g. "почти не бомж" tier) so it doesn't dilute the beggar-humor brand.

The bigger unlock: tier 4 unblocks option (c). Chain-branch expansion via store locators is the fastest way to make the map "have stuff" everywhere, not just where the founder has walked. Chains are legally safe (public store-locator data, not scraped competitor listings), instantly cover all 125 districts on day one, and — critically — chains are exactly what students already trust as a cheap-eats floor. A map that's chain-only in outer districts and crowd-vetted in the center is a realistic, honest bootstrap, not a cheat.

On populate-the-map: don't pick one of (a)-(d), stack them in sequence — OSM gray pins first (instant density, begs for price fills), chain branches second (fills tier 4 nationwide), founder walk third (seeds the verified core near launch epicenter), TG bounties last (launch-week spike once there's something to react to). The gray "no-price" OSM pin is your best growth mechanic — it's a call-to-action baked into the map itself.

Backend gap is the one thing that could kill virality outright: fix that before any of the above, because every populate strategy assumes submissions land somewhere real.

---

# Response E

The question smuggles in a false premise: that "populating the map" and "getting the crowdsourcing loop to work" are the same problem to solve simultaneously. They're not. Solve them in the wrong order and you build a museum, not a marketplace.

Strip it down: what does Geojimap actually prove? Not that maps with pins go viral — that a *cheap, humiliating, funny act of contribution* goes viral, and the map is just the artifact left behind. The pins were never the product. The confession loop was.

Right now you have zero confession loop. Submissions vanish into localStorage. That's not "no backend yet" — that's the entire mechanism disabled. You're optimizing tier boundaries and OSM imports for a machine with no engine.

So, answers, but subordinated to that:

1. Tier 4 (301-500₽): yes, but frame it as "почти нищий" / "на грани," not a quiet cap raise — the joke is the tiers, don't dilute it into a normal price filter.

2. OSM import (b): correct instinct, wrong justification. Don't do it to "have stuff" — do it to manufacture bait. Gray no-price coins are literally a UI asking "разве ты не голодал именно тут?" They're prompts, not inventory. Founder-walk (a) alone can't seed density; OSM alone is dead pins forever without (2)'s missing piece.

3. The actual answer: before anything else, stand up the thinnest possible backend — a Google Sheet + Apps Script webhook, or Supabase free tier, one table — so a submission becomes a real pin within minutes, visibly, publicly. That visible-within-minutes feedback loop *is* the growth engine. Everything else is furniture until that exists.

---

# Peer Reviews

# Mapping (revealed): A = The Outsider · B = The Executor · C = The Contrarian · D = The Expansionist · E = The First Principles Thinker

# Review 1
Strongest: E — only one that reframes the question: pins aren't the product, the "confession loop" (submit→visible pin, fast) is; separates OSM pins as bait-generation vs inventory, which A and B muddy.
Blind spot: A — buries the backend as one fix among several; no populate sequencing; surface reaction not root cause.
All missed: retention/moderation (spam, joke prices, trolls post-spike); the 16/125 district coverage illusion.

# Review 2
Strongest: B — same diagnosis as C/D/E but concrete: schema (venue_id, price, item, ip_hash), tool names, full sequencing, real reason to deprioritize chains.
Blind spot: A — never names backend as root cause; no sequencing at all.
All missed: moderation/spam/abuse once backend exists (troll target the moment it goes viral); legal/liability of public price claims tied to real businesses in RU context.

# Review 3
Strongest: E — the confession-act reframe changes what "minimum backend" optimizes for: instant public visibility, not admin approval queues.
Blind spot: A — treats badges and pin density as isolated UX nitpicks; skips sequencing.
All missed: whether "crowdsource day 1" is viable at solo-dev scale — manual policing during a TG spike; what "approved" vs "live" means for trust once fake pins appear.

# Review 4
Strongest: B — executable steps with time estimates; solo dev can start typing from B alone.
Blind spot: A — correct diagnosis, zero next action; no populate answer.
All missed: moderation queue (viral launch + open write path + zero moderation = public trust broken by garbage data instead of vanished data); founder bandwidth as the actual constraint — backend + moderation + populate compete for one person's hours.

# Review 5
Strongest: B — answers the actual sequencing question with time-boxed actions; resolves all three sub-questions.
Blind spot: E — best essay, worst punch list; the reframe never becomes schema/hours/sequence.
All missed: spam/abuse moderation under meme-channel traffic; founder privacy exposure from the walk; Supabase free-tier limits under the exact viral spike everyone is optimizing for.

---

# Chairman's Verdict — Council #2 (2026-08-10)

## Where the Council Agrees

- **The backend is the product, and it doesn't exist.** All five advisors converged: submissions dying in localStorage means the "crowd-fed" strategy is currently fiction. The Executor and The First Principles Thinker independently sized the fix at under a day (Supabase free tier or Google Sheet + Apps Script, one table). Launching in TG meme channels before this exists would burn the one viral spike you get, permanently.
- **Tier 4 gets a yes — with a joke, not a cap raise.** Four of five say add 301–500₽; The Contrarian's dissent is really a branding objection, and the fix everyone lands on is the same: the new tier must be *more* self-deprecating, not a quiet loosening ("почти нищий", "на грани"). Excluding shaurma from a Moscow cheap-eats map is, as The Outsider put it, the map being wrong about its own subject.
- **OSM gray pins are bait, not inventory** — a call-to-action ("add the price here"), never content to be proud of.

## Where the Council Clashes

- **Gray pins: growth mechanic or abandonment signal?** Executor/Expansionist: a 400-pin gray map "looks alive". Outsider/Contrarian: 40% "we don't know" reads as broken. Resolution: sequencing — gray pins are poison *before* the submission loop works and bait *after*.
- **Chain store-locators.** Expansionist wins on coverage math, Executor wins on timing — phase-3 move, not a launch move.
- **What "minimum backend" means.** Executor designed an admin-approval queue; First Principles argued the growth engine is *submission → visible public pin within minutes* and a queue kills the dopamine loop. Reviews sided with the reframe.

## Blind Spots the Council Caught

- **Moderation under viral load** — flagged in all five reviews, missed by all five advisors. Viral launch + open write path + zero moderation = trust dies from *garbage* data instead of *vanished* data. Needs cheap tripwires: ip_hash rate limiting, price sanity bounds, one-tap community flagging.
- **Founder bandwidth as the real constraint** — backend, moderation, walk, and launch prep compete for one person's hours.
- **16/125 coverage illusion, Supabase free-tier limits under the spike, RU legal exposure of public price claims** — lower urgency, 30 minutes of thought each before launch week.

## The Recommendation

**1. Add the 301–500₽ tier — as a punchline, not a price band.** Keep gold/silver/bronze as the sacred ≤300₽ core. Add a visually distinct, separated coin (copper/dull tone) with escalated beggar-humor labeling ("почти нищий" / "на грани"), so шаурма gets on the map while ≤300₽ stays the meme. One config constant + a coin color.

**2. Population sequence: backend → founder walk → OSM gray pins → TG bounties → chains.** Backend first. Founder walk next: 15–20 fully verified, photographed entries — the trust anchor and before/after material for the launch post. Then the OSM Overpass import (fast_food/canteen/cafe) — gray pins only become bait once a filled-in pin can appear within minutes. TG bounties at launch week. Chains last, for outer-district floor coverage.

**3. Website priority: thinnest possible live backend with instant public visibility.** Supabase free tier, one table (venue_id, item, price, submitted_at, ip_hash). Submissions appear as live pins immediately — no approval queue — with three cheap guards: rate limiting, price bounds, "flag this" button feeding a daily-eyeballed sheet. The submit→visible-pin loop IS the growth engine. Everything else is furniture.

## The One Thing to Do First

Today: create the Supabase project, one `submissions` table, wire the existing form to POST to it, render rows as pins. By tonight a stranger's submission should become a pin another stranger can see. Until that round trip works, do not touch tiers, OSM, or publicity.
