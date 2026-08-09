# LLM Council Transcript — Jaison

**Date:** 2026-08-07 23:23
**Counciled:** Bootstrap data strategy (scrape vs seed vs hybrid) + go-to-market (naming, cold-start loop, launch channels) for Jaison, a Geojimap-style cheap-eats map for Moscow & SPB.

**Original question (user):** decide between scraper-led, seed-led, and hybrid bootstrap; and settle RU naming/framing, the contribution loop, and launch-channel sequencing.

**Advisor → letter mapping (anonymized during peer review):** A = The Executor · B = The First Principles Thinker · C = The Outsider · D = The Contrarian · E = The Expansionist

---
# Framed Question

Jaison: a cheap-eats map app for Moscow & St. Petersburg, modeled on Korea's viral "Geojimap" (beggar map: crowdsourced listings of meals under ₩10,000; ~2,500 hand-vetted venues, 1.3M visitors in month one, built by one unemployed dev).

Product: map with non-overlapping item-price tiers (≤100₽ / 101–200₽ / 201–300₽), item-level (not average check), venue-aware "primary item" rule (a 90₽ croissant at a bakery counts; a 90₽ bread side at a steakhouse doesn't). Free Yandex Maps JS API as the map layer (2.5M req/yr free). Web app first (also the visual reference), then Telegram Mini App, VK Mini App, and RuStore TWA shells around the same codebase — staged launches, simultaneous publicity. Target users: broke students and workers wanting a quick cheap bite nearby. Solo developer, no money (0₽ infra budget; only spend is a domain), has time and skills, building with Claude.

Verified constraints:
- No free Yandex API exposes menu prices. Places API is paid/prepaid-yearly; Yandex.Eats Resources API is partner-only.
- Scraping Yandex and storing/republishing menu data risks RU Civil Code Art. 1334 (database rights) + ToS violations; Yandex free-map-API terms forbid storing data off-map. Enforcement risk is asymmetric: invisible while small, dangerous exactly when viral.
- Yandex Eda covers delivery partners; many cheapest venues (столовые, шаурма stands) aren't on Eda, and mostly have no websites — restaurant sites are also the stalest price source.
- Freshness target: prices ≤14 days old; weekly update cadence; "price confirmed N days ago" badge + one-tap reconfirm planned.
- No direct competitor found: 2GIS/Yandex do venue-level "cheap" search, FoodCard maps business-lunch prices; no item-level tier map, no beggar-culture crowdsourcing. (Telegram-internal channels unverified.)
- No accounts in v1 → avoids 152-FZ personal-data localization.
- Unknown: whether the founder is physically in Moscow/SPB (affects seeding/verification).

DECISION 1 — Bootstrap data strategy, pick one:
(a) Scraper-led: quiet single-machine scraper on Yandex Eda + venue websites, weekly; crowdsourcing added later ("justify the build until crowdsourcing works").
(b) Seed-led: founder hand-seeds 150–300 quality items per city from public listicles/menus/on-foot checks; crowdsource loop live from day 1; no scraping (Geojimap's proven model).
(c) Hybrid: quiet scraper for bootstrap only, migrate weight to crowdsourcing, retire scraper.

DECISION 2 — Go-to-market:
- Naming/framing: "Jaison" (founder's name choice) vs RU-culture beggar-humor naming (the self-deprecating framing was load-bearing in Korea). What framing wins in Russian student culture?
- Cold-start contribution loop: what actually makes a broke Moscow student submit a price?
- Launch channels: Telegram/VK student communities — how to sequence publicity vs. staged platform launches?

Stakes: solo founder's months of free time; legal exposure in RU jurisdiction; the viral window (Geojimap's model is now internationally publicized — someone else could clone it for Russia first).

---

# Response A

Decision 1: (b), full stop. Don't even entertain the scraper.

Here's Monday morning under (a) or (c): you write a scraper against Yandex Eda and venue sites, which means you're now maintaining a scraper — handling anti-bot measures, site structure changes, rate limiting — for data you're not even legally allowed to store per Art. 1334 and the ToS you already flagged. You've turned a solo dev's spare time into a part-time job fighting Yandex's infrastructure, in the exact risk zone you identified as "invisible while small, dangerous exactly when viral." The worst possible failure mode is your app taking off and then getting nuked for the data practice that got you there. That's not a bootstrap strategy, that's a time bomb with a fuse tied to your own success.

(b) has an actual first step you can do today: pick 5 listicles, open Yandex Maps, walk into 10 venues near you this week, write down 150 items with prices. That's a task with an end state, not an open-ended maintenance burden. It also forces you to build the submission/verification UI on day 1 instead of bolting it on later — which is the actual product, not the scraper.

One gate before anything else: the "unknown — is founder physically in Moscow/SPB" question. If the answer is no, decision 1 doesn't matter because there's no seeding happening at all — you can't hand-verify a shawarma stand's price from another country. Answer that question before you write a single line of code. If yes: go seed Moscow first, one city, prove the loop works with real submissions before touching SPB.

---

# Response B

You're solving the wrong layer of the problem. Everyone in this brief is treating "Jaison" as a data-sourcing and legal-risk problem. It isn't. Geojimap's actual innovation wasn't the scraper or the taxonomy — it was that it converted a shared cultural feeling ("나도 거지야," we're all broke together) into 2,500 acts of unpaid labor within weeks. The database was a byproduct of a social movement, not the other way around.

So strip the assumptions:

Assumption 1: "We need a data strategy first, then virality follows." Backwards. Geojimap launched with almost nothing and the crowd built the database in real time because the *framing itself* was the product. If you seed 150-300 items quietly before opening submissions, you've already answered the question "is this mine or ours?" — and the answer is "mine," which kills the exact mechanism you're trying to copy.

Assumption 2: "Jaison" is a founder-branding decision. It's actually the single highest-leverage lever in this entire brief, and it's being treated as an afterthought under Decision 2. A generically-named map with tier pricing is a spreadsheet. A self-deprecating, shame-inverting cultural artifact is a movement. You cannot A/B test your way into that — it has to be right at launch because there's no second first-impression in virality.

Assumption 3: The legal/scraping question is decidable independent of the naming question. It isn't. If the product is community-owned from day one (seed-led, decision 1b), the Art. 1334 risk mostly evaporates *and* the crowd-labor mechanism activates simultaneously. Scraper-led (1a) solves a problem you don't need solved yet while sabotaging the actual growth engine.

Real question: not "how do we get data safely" but "what shameful, funny, true thing about being broke in Moscow/SPB in 2026 does this app let people say out loud together?" Answer that first. Everything else — including the scraper debate — resolves itself.

---

# Response C

I have no idea what a Geojimap is and I've never been to Moscow, so let me just tell you what actually confused me reading this.

You buried the naming question at the bottom of GTM, but I think it's upstream of everything. "Jaison" tells me nothing. It sounds like a fintech app or a guy's name — it does not sound like "here's where broke people eat." The entire Korean thing worked, per your own brief, because the self-deprecating "beggar map" framing was *load-bearing to virality* — it gave people a funny, shareable, identity-affirming reason to open it and post about it. You're proposing to throw that mechanism away and keep the founder's name instead. That's not a neutral choice, that's cutting the engine out of the car and hoping the chassis still drives. If the humor-framing is what makes a stranger screenshot it into a group chat, "Jaison" gives them nothing to screenshot with. Test the RU-culture name FIRST, before writing a line of code, because it changes what you're building the UI's voice around (copy, badge language, share cards).

Second confusion: you've built an elaborate legal defense for scraping (Decision 1) but the actual product bottleneck, by your own admission, is that the cheapest venues have no websites and aren't on delivery apps. So the scraper — the risky option — can't even reach the venues that matter most. That's not really a three-way decision, that's (b) with extra steps that expose you to Art. 1334 for no coverage gain.

Third: nobody outside this document knows what a "primary item rule" is, and neither will your users. Don't let that logic leak into the UI.

---

# Response D

Decision 1 is a false choice dressed up as three options — (a) and (c) both open the same fatal wound: the moment this scraper touches Yandex Eda or restaurant sites and republishes prices on a map, you're in Art. 1334 territory, and the constraints doc itself says enforcement is invisible until virality — which is exactly when the founder has the least leverage, no legal budget, and a product whose entire value proposition (the map, live) becomes the thing that gets pulled. "Justify the build until crowdsourcing works" is the tell: it's a plan to launch on the leg you intend to amputate. If crowdsourcing doesn't actually work by month 2, does the scraper quietly become permanent? Nobody answers that question in the plan, which means the answer will be decided under pressure, not now.

(b) is the only option that doesn't require a legal bet, but the plan hand-waves its own bottleneck: "founder hand-seeds 150-300 items per city... on-foot checks" — while the founder's physical presence in Moscow/SPB is listed as an unknown. If they're not there, seeding degrades to listicle-scraping (same legal exposure, worse data) or seeding never reaches critical mass and the map launches empty, which kills the cold-start loop before it starts — nobody submits a price to a map with 40 pins.

Missing entirely: what happens when the map is good enough to notice and a venue owner or Yandex legal notices it. There's no kill-switch plan, no "what do we do when we get a takedown request" contingency. A solo dev with zero legal budget needs that written down before launch, not discovered via a cease-and-desist.

---

# Response E

Pick (b), seed-led — but not because it's the safe choice. It's the choice that lets you scale past what everyone's imagining.

Here's the upside nobody in the framing is pricing in: the scraper strategy caps you at "Yandex data, slightly reorganized." The seed-led crowdsourcing loop caps you at nothing — Geojimap didn't stay a map, it became infrastructure for a culture of communal price-transparency, and it hit 1.3M visitors *because the crowd made it their own*. A scraper can't do that. A scraper produces a product. A contribution loop produces a movement, and movements compound.

Think about what "no accounts, item-level, primary-item-rule" data actually is once you have a few thousand vetted entries: it's the only structured, granular, freshness-tagged cheap-food dataset in Russia that isn't locked inside Yandex's paid API. That's not just a map feature — that's a licensable dataset, an API other apps would pay for, a foundation for a "cheapest lunch near me" widget embedded in student-life Telegram bots, a base layer for a future delivery-arbitrage tool, even a signal source for inflation-tracking journalists who'd kill for real street-level price data outside CPI baskets. None of that exists if the underlying asset is "scraped Yandex listings with legal asterisks on it." It exists only if the data is originated by users and therefore unambiguously yours.

And don't undersell the two-city constraint — Moscow/SPB is the beachhead, not the ceiling. A seed-led loop is the only version of this that's a repeatable playbook: drop the same seed-crowdsource mechanic into Kazan, Novosibirsk, Yekaterinburg, or frankly Minsk and Almaty, with zero incremental legal risk each time, because you never touch Yandex's database rights in the first place. The scraper version doesn't travel — every new city is a new legal roll of the dice. The seed version is a franchise.

Also: don't let "Jaison" be the name that ships. The self-deprecating beggar-humor framing IS the growth engine, not decoration — it's what makes a student screenshot it to a group chat unprompted. Rename before launch, or you're leaving the viral hook Geojimap already proved on the table.

---

# Peer Reviews

# Anonymization mapping (revealed for chairman)

- Response A = The Executor
- Response B = The First Principles Thinker
- Response C = The Outsider
- Response D = The Contrarian
- Response E = The Expansionist

# Peer Review 1

1. **Strongest: D.** It's the only response that names a concrete future failure mode (scraper "temporarily" becomes permanent under pressure at month 2, undecided in advance) and demands a specific missing artifact — a takedown/kill-switch contingency — rather than just re-ranking the same three options. It also correctly stress-tests (b)'s own bottleneck (founder-location unknown) instead of treating it as someone else's problem, which A raises but doesn't fully connect to (b)'s failure mode.

2. **Biggest blind spot: E.** It's the most exciting response but the least grounded — the "licensable dataset / API / journalism signal" tangent is speculative scope creep for a solo dev with zero infra budget who hasn't validated the core loop yet. It never engages with the founder-location unknown or the empty-map cold-start problem that A, C, and D all flag as gating.

3. **What all five missed:** none addressed the actual mechanics of the "primary item rule" as a moderation/dispute problem — who adjudicates "is this the primary item at this venue" at scale when submissions disagree, and how that scales without accounts (per the no-accounts/152-FZ constraint). C mentions the rule only as a UI-language risk, not a moderation-workload risk. Also nobody weighed option (c) — the actual middle path — on its own merits; all five collapsed straight to a binary (a) vs (b).

# Peer Review 2

1. **Strongest: D.** It's the only response that treats Decision 1 as a decision *under uncertainty* rather than a foregone conclusion. It exposes the (a)/(c) "justify the build" language as a plan to launch on a leg it intends to amputate, forces the unanswered question ("does the scraper quietly become permanent if crowdsourcing stalls by month 2?"), and is the only one to flag the actual missing artifact: a takedown/kill-switch contingency for when Yandex or a venue owner notices. It also correctly stress-tests (b)'s own bottleneck (founder location) instead of just picking a side.

2. **Biggest blind spot: E.** It's the most confident and the least skeptical — it pivots straight into a licensable-dataset/franchise fantasy without interrogating whether seed-led even survives contact with reality (150-300 hand-walked items per city, founder location unknown, zero accounts meaning zero anti-fraud on submissions). It treats (b) as obviously scalable to five more cities with "zero incremental legal risk" while ignoring that crowdsourcing itself might just fail to bootstrap in a culture where the load-bearing shame-framing hasn't been validated.

3. **What all five missed:** none addressed submission fraud/gaming — with no accounts and no verification, what stops a venue owner (or bored teenager) from planting fake prices, or a competitor griefing the map. That's a launch-week failure mode, not a month-two one, and nobody named it.

# Peer Review 3

1. **Strongest: D.** It's the only response that treats Decision 1 as a decision-under-uncertainty rather than a pick-one: it exposes the hidden branch ("if crowdsourcing doesn't work by month 2, does the scraper become permanent?") and names the actual missing artifact — a takedown/kill-switch contingency — that a zero-legal-budget solo dev needs written down pre-launch, not discovered via cease-and-desist. It also correctly chains the "founder location unknown" gap into (b)'s own failure mode (seeding degrades to listicle-scraping) rather than treating it as a separate footnote.

2. **Biggest blind spot: E.** It's essentially A/B's argument restated as a pitch deck (dataset licensing, franchise cities, inflation journalism) — exciting but speculative, and it never engages with D's core finding: there's no contingency for what happens when the product succeeds and someone objects. Building toward "licensable dataset" while ignoring the legal kill-switch is optimizing the upside of a plan whose downside was never priced.

3. **What all five missed:** none interrogated the freshness/verification mechanics of the crowd loop itself — "price confirmed N days ago" + one-tap reconfirm assumes sustained contributor return behavior, but nobody asked what happens when contributions dry up after initial virality (Geojimap's own long-term retention curve is unverified in the brief) or who moderates bad-faith/inflated submissions once there's no account system to rate-limit or ban abusers.

# Peer Review 4

1. **Strongest: E.** It answers both decisions, gives a real reason (not just risk-avoidance) for (b) — the dataset-as-asset and multi-city-franchise argument is the only place any response reasons past the two-city beachhead — and it lands the naming point crisply without derailing into a different question. It's the only response that's both decisive and additive.

2. **Biggest blind spot: B.** It's the most intellectually interesting but the least actionable — it reframes the whole brief as "answer a philosophical question about shame and belonging" and never converts that into anything a solo dev does Monday morning. A normal person reading B finishes with a mission statement, not a decision.

3. **What all five missed:** Nobody addresses the actual mechanics of the crowdsourcing loop's fraud/quality problem — with no accounts (per the constraints), what stops spam, joke submissions, or a venue gaming its own price tier? Geojimap's 2,500 "hand-vetted" venues implies vetting labor that scales with submissions; none of the five responses touch who does that vetting, how, or what breaks it at scale. That's a cold-start AND a scale-time gap the brief itself flagged ("hand-vetted") and every advisor skipped.

# Peer Review 5

1. **Strongest: D.** It's the only response that treats "what happens after launch succeeds" as part of the decision, not an afterthought. It correctly reframes 1a/1c as "the same fatal wound," names the actual danger of hybrid (the scraper "quietly becomes permanent" if crowdsourcing lags), and — uniquely — forces a kill-switch/takedown-response plan before launch. That's the piece a solo dev with no legal budget actually needs on a Monday morning, not just Sunday-night strategy.

2. **Biggest blind spot: B.** It's the most conceptually interesting (framing precedes data) but gives the founder nothing to do Monday morning — no answer to the physical-presence gate, no fallback if the "shameful/funny/true" framing doesn't land, no acknowledgment that a movement still needs 150 real, correct prices or it's just a manifesto. It substitutes philosophy for a first step.

3. **What all five missed:** none addresses what happens if the founder is *not* in Moscow/SPB beyond "seeding fails" — no one proposes remote-seeding alternatives (paying/bartering with local students, partnering with a campus group, Telegram bounties for the first 150 submissions). That unknown is flagged as load-bearing in the brief, and every response treats it as a binary gate rather than a solvable constraint.

---

# Chairman's Verdict

## Where the Council Agrees

**Seed-led (option b) wins, unanimously.** All five advisors — The Executor, The First Principles Thinker, The Outsider, The Contrarian, and The Expansionist — landed on seed-led crowdsourcing without coordinating. Not one defended the scraper, and several independently demolished the hybrid: The Contrarian called (a) and (c) "the same fatal wound," and The Outsider delivered the cleanest kill — the scraper can't even reach the venues that matter, because столовые and shawarma stands have no websites and aren't on Yandex Eda. The risky option doesn't even buy coverage. That's a rare five-for-five convergence and should be treated as settled.

**"Jaison" should not be the name that ships.** The Outsider, The First Principles Thinker, and The Expansionist all said, in different registers, the same thing: the self-deprecating beggar-humor framing was the growth engine in Korea, not decoration. "Jaison" sounds like a fintech app; it gives a student nothing to screenshot into a group chat. The Expansionist put it flatly: shipping without the humor-framing is "leaving the viral hook Geojimap already proved on the table."

**The founder-location unknown is load-bearing.** The Executor made it a hard gate ("answer that before you write a single line of code") and The Contrarian chained it into (b)'s failure mode: if the founder isn't in Moscow/SPB, seeding degrades into listicle-scraping — the legal exposure of (a) with worse data.

## Where the Council Clashes

**Framing-first vs. execution-first.** The First Principles Thinker argues the name/framing is the single highest-leverage decision and everything — including the legal question — resolves downstream of "what shameful, funny, true thing does this app let people say together?" The Executor argues the opposite ordering: pick 5 listicles, walk into 10 venues, write down 150 prices this week; the submission UI is the product. Peer review sided hard against pure framing-first — two reviews named The First Principles Thinker's response the biggest blind spot precisely because it "substitutes philosophy for a first step." The disagreement is real because both are right about different failure modes: a perfectly executed map with a dead name won't spread; a perfectly named movement with 40 pins won't retain. The resolution is sequencing, not choosing (see Recommendation).

**Is pre-seeding a virality killer?** The First Principles Thinker alone argued that quietly seeding 150–300 items before opening submissions answers "is this mine or ours?" with "mine" — killing the communal-labor mechanism. Every other advisor treats seeding as the obvious cold-start move, and The Contrarian's point cuts the other way: nobody submits a price to an empty map. The council majority is right here — Geojimap itself launched with ~2,500 hand-vetted venues; the seed didn't kill the movement, it made the map worth opening. But The First Principles Thinker's underlying point survives in weakened form: the seed must be *presented* as the start of a communal project, not a finished catalog.

**Is the dataset a moat or a fantasy?** The Expansionist's licensable-dataset/multi-city-franchise vision was named the biggest blind spot in three of five reviews (speculative scope creep for a solo dev with 0₽), yet one review named it the strongest response for being the only one that reasoned past the beachhead. Both are correct: the franchise logic is a genuine reason to prefer (b) over (a) — user-originated data is unambiguously yours and travels; scraped data is neither — but it is a reason, not a roadmap. Keep the argument, discard the pitch deck.

## Blind Spots the Council Caught

- **The hybrid's hidden branch.** The Contrarian exposed what no option description admits: "justify the build until crowdsourcing works" is a plan to launch on the leg you intend to amputate. If crowdsourcing stalls at month 2, does the scraper quietly become permanent? Unanswered questions get answered under pressure. Four of five peer reviews named this the strongest single insight of the round.
- **No kill-switch plan.** Only The Contrarian asked what happens when the map is good enough for Yandex legal or a venue owner to notice. A zero-legal-budget solo dev needs a written takedown-response plan *before* launch, not via cease-and-desist.
- **Fraud and moderation — missed by all five, caught by review.** With no accounts (the 152-FZ workaround), nothing stops a venue owner planting flattering prices, a competitor griefing the map, or joke submissions on launch week. Geojimap's "hand-vetted" implies vetting labor that scales with submissions; no advisor said who does that vetting for Jaison or what breaks at scale. This is a launch-week failure mode, not a month-two one.
- **Contribution decay.** "Price confirmed N days ago" assumes contributors keep coming back. Nobody asked what happens when submissions dry up after the initial spike — Geojimap's long-term retention curve is unverified.
- **Remote-seeding alternatives.** Every advisor treated founder-location as a binary gate; only peer review noted it's a solvable constraint (campus-group partnerships, Telegram bounties for the first 150 submissions, bartering with local students).

## The Recommendation

**Decision 1: Seed-led, option (b). No scraper, ever — not even as a "temporary" bootstrap.** The council was unanimous and the reasoning is overdetermined: the scraper is legally radioactive exactly when you succeed (Art. 1334 + ToS, enforcement asymmetry), it can't reach the cheapest venues anyway (no websites, not on Eda), it's an open-ended maintenance job for a solo dev, and it poisons the one asset that makes this venture defensible — a user-originated dataset that is unambiguously yours and replicable city by city. Hybrid (c) is worse than it looks because its exit ramp is undefined; you'd decide the scraper's fate under month-2 pressure. Seed Moscow only: 150–300 items, one city, prove the loop produces real stranger-submissions before touching SPB. Frame the seed publicly as "first 200 entries — now it's yours," per The First Principles Thinker's ownership point.

**Decision 2: Kill "Jaison" as the public brand. Ship a Russian self-deprecating name.** Three advisors independently identified the beggar-humor framing as the growth engine, not decoration, and there is no second first-impression in virality. The name must let a broke student say something funny and true about themselves by sharing it — that's what converts an app into 2,500 acts of unpaid labor. Keep "Jaison" as the project/company name if it matters personally; the product needs a name in the "нищемап / карта нищеброда" register (validate the exact word with actual Moscow students — нищеброд-humor is live in RU student culture, but the specific word choice is a native-speaker call, not a founder call). The contribution loop *is* the framing: submitting a price should feel like a punchline, not a chore — share cards, badge copy, and confirmation messages all in the same self-deprecating voice. Sequence: web app soft-launch seeded → Telegram Mini App + one coordinated publicity push into Telegram student-meme channels (Telegram before VK — that's where Moscow/SPB student culture lives) → VK/RuStore shells after the loop is proven. Do not spend the one publicity shot on an empty map.

Before launch, write two one-page documents the council's review process proved you're missing: (1) a takedown-response plan — what you do the day a venue owner or Yandex objects, including what you'd remove and how fast; (2) a no-accounts moderation scheme — every new price starts "unconfirmed" until N independent one-tap confirms, rate-limit by IP/device fingerprint, founder hand-vets the first weeks exactly as Geojimap's builder did. That's the honest cost of (b): you are the vetting layer until the crowd is.

## The One Thing to Do First

**Answer the location question today, because it selects the entire seeding plan.** If you are in Moscow: this week, walk into 10 venues near you and hand-record your first 50 items — it simultaneously seeds the map, validates the primary-item rule against reality, and tells you what the submission UI must capture. If you are not in Moscow: don't touch code either; instead recruit your first local seeder — post a bounty in one student Telegram chat offering co-credit for the first 50 verified prices. Everything else in this verdict is downstream of which branch you're on.
