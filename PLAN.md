# BriefRoom: plan to finish top 5

Deadline: **Sat, Nov 22, 11:59 PM IST** (submit by **9 PM**). Judging runs Nov 23–27; results come out Dec 1.
Prizes: $2,000 / $1,250 / $750 / $500 / $500 for 5 winners.

## 1. How judges score (from the challenge page)

| Criterion | Weight | What they literally look for | How BriefRoom wins it |
|---|---|---|---|
| Completeness & UX | **50%** | "Works from start to end and is easy to use. Demo runs smoothly, clean UI, clear interaction" | One clear end-to-end story: reference → pins → spec → version → both approve → work order. No dead ends, no half-features |
| Innovation & scenario value | **30%** | "Solves a real communication problem or adds a new, interesting interaction" | **Chat that ends in agreement.** Region pins as chat cards, versioned briefs, approval bound to a hash. Most entries are chat clones; this is a new interaction |
| Business & growth | **20%** | "Traction (active users on Nexconn) + can it become a real product" | Clear buyer (the seller), clear pain (wrong orders), clear channel (Instagram bio link). Real bakers using it before the deadline |
| Traction bonus | "significant" | Proof real people used it | Every order brings 2 Nexconn users. 10 real orders = 20+ users with real activity |

**Rule we must not break:** real, measurable Chat SDK usage, verified with the **App Key**. BriefRoom uses group channels, Chat UI, custom messages, a custom message menu, hooks and the Server API, so it's deep usage.

## 2. Competitive position

What's already public (50–60+ ideas): Discord clones, community help chats, sports group chats, office-hours Q&A, AI purchase approvals, translated chat, support bots.

- **Almost nobody owns "Marketplace & Support" with a visual workflow.** The track's own examples (buyer-seller 1-on-1 chat, human agent dispatch, translated chat) are generic. BriefRoom is a buyer-seller chat with a *reason to exist*.
- **The demo is visual and instantly understood.** A cake photo with coloured pins and "🤝 Version 3 agreed · ₹1,850" needs no explanation.
- **It's a real business.** Indian home bakers and custom-merch sellers number in the lakhs and run entirely on WhatsApp and Instagram. Judges asking "can it become a real product?" get a clear yes.

**What would sink us:** a broken demo (50%!), a cluttered UI, or zero traction. Everything below protects against those.

## 3. Timeline (from now to submission)

### Block A: make it run with your keys (2–3 h)
1. Create the Nexconn app (Singapore). Put the App Key and Secret in `.env`. Run `npm run dev`.
2. Run the golden path on **two devices** (laptop = seller, phone = customer):
   create shop → create brief → open the customer link → upload photo → pin 3 regions (one colour pin) → fill details → seller sets price → propose v1 → customer requests changes → seller edits and proposes v2 → customer approves → **Agreed** → work order.
3. Note **every** error code or glitch and log it and fix it. Expect 1–3 small integration fixes (Chat UI layout, group visibility).

### Block B: deploy (1 h)
1. Push to a **public GitHub repo** (required).
2. Deploy on Render with `render.yaml`. Set the environment variables and `PUBLIC_URL`.
3. Run the golden path again on the live URL from your phone using mobile data, not Wi-Fi.

### Block C: real traction (the rest of the day, in parallel)
Goal: **5+ real sellers, 10+ real briefs, 20+ Nexconn users**, with proof.
1. **Warm network first.** Message 10–15 people: friends or family who bake, a college canteen or bakery, the merch/T-shirt coordinators in your college clubs, a local carpenter.
   Script: *"I built a free tool for custom orders: customers mark exactly what they want on a photo and you both approve the final design. Can I set it up for your next order? Takes 2 minutes."*
2. **Instagram home bakers in your city** (search #homebaker + city). DM 20–30 with the same script and a 20-second screen recording.
3. **Create demand yourself, honestly.** Ask friends to place a *real* order (or a real enquiry) through a baker's shop link. Every brief counts as 2 active users.
4. **Collect proof as you go:**
   - a screenshot of each agreed work order
   - the `/stats` page
   - the Nexconn console usage/MAU page
   - 2–3 quotes, e.g. *"this saved me 30 messages"*
   - a photo of the real cake next to the agreed brief, if you can get one (a killer slide)

### Block D: demo video (1.5 h)
Record it after traction so you can show real numbers. Script below.

### Block E: submit (1 h, done by 9 PM IST)
Paste the write-up from [SUBMISSION.md](SUBMISSION.md). Add the App Key, links, video, traction proof. Then check that the video and links open in an incognito window.

## 4. Demo video script (2:30, upload to YouTube unlisted or Loom)

| Time | On screen | Voice-over |
|---|---|---|
| 0:00 | A messy WhatsApp thread: screenshots, voice notes, "pink but lighter??" | "Every custom order starts with *something like this*. Forty messages later, nobody knows what was agreed." |
| 0:12 | Wrong-cake meme or photo | "Then the cake arrives, and it's wrong. Remakes, refunds, bad reviews." |
| 0:20 | Landing page → BriefRoom | "BriefRoom turns a vague reference into an approved brief, right inside the conversation." |
| 0:30 | Seller dashboard → New brief → WhatsApp invite | "The baker creates a brief room and sends the customer a link. No app, no signup." |
| 0:45 | Phone: customer uploads a Pinterest cake, drags over the flowers → 🎨 Change colour → picks pink | "The customer points at *exactly* what they mean. That pin lands in the chat as a card with that exact region." |
| 1:05 | Laptop: the pin card appears live in Chat UI; seller taps "Show on image" | "Real-time on Nexconn. The seller sees the exact flowers and the exact pink." |
| 1:15 | Seller long-presses a chat photo → "Add to brief" | "Any photo in the chat becomes a reference in one tap." |
| 1:25 | Details tab: size, flavour, message, date; seller adds ₹1,850 | "Size, flavour, message, date and price go into one checklist. Approval stays blocked until it's complete." |
| 1:40 | Propose v1 → customer "Request changes" → v2 with diff | "Every proposal is a frozen version with a diff. No more 'but I said…'." |
| 1:55 | Customer approves v2 → 🤝 Agreed card on both screens → work order with fingerprint | "When both sides approve the *same* version, it's locked into a work order with a fingerprint." |
| 2:10 | /stats + Nexconn console + real baker quote | "In 48 hours: N bakers, N briefs, N agreed orders." |
| 2:20 | Architecture slide | "Group channels, Chat UI with custom card bubbles, a custom message menu, and the Server API. All Nexconn." |

**Recording tips:** 1080p. Laptop and phone side by side (use the phone's screen recorder plus OBS). Make the browser zoom 110%. Pre-load a nice cake photo. Do a dry run. Keep it under 3 minutes.

## 5. Polish checklist (50% of the score is "it works and feels clean")
- [ ] Golden path works on the live URL, desktop and phone
- [ ] No console errors on the main flow
- [ ] Demo data looks real (real cake photos, real names, Indian rupees, realistic dates)
- [ ] The first screen a judge sees (landing) explains the product in 5 seconds
- [ ] README has the screenshots: brief room, pin card in chat, agreed work order
- [ ] `/stats` shows real numbers
- [ ] Every link in the submission opens in an incognito window

## 6. Risks and fallbacks
| Risk | Fallback |
|---|---|
| A Chat UI layout or group visibility issue | Log the exact error code and fix it. The brief flow is independent of the chat UI and still works |
| Bakers don't reply in time | Friends and family as customers through *your own* demo bakery shop with genuine orders, and college club merch orders |
| Render disk or deploy trouble | Railway or Fly.io; any Node host works |
| Running out of time | Cut nothing from the golden path. Skip the inbox polish and extra templates in the video |

## 7. Pitch in 20 seconds
> "Custom orders run on WhatsApp, and WhatsApp is terrible at agreeing. BriefRoom gives every order a room: the customer pins exactly what they mean on a reference photo, the details and price go into a checklist, and the order is only confirmed when both sides approve the same frozen version. Built on Nexconn group channels and Chat UI, already used by N real sellers."
