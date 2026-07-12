# miniCycle — Feedback To-Do

> **Added to repo July 2026.** The P0 load/startup section is planned in detail in
> [`BUILD_PIPELINE_PLAN.md`](./BUILD_PIPELINE_PLAN.md) (which supersedes `MINIFICATION_PLAN.md`).
> i18n items belong to [`I18N_LANGUAGE_PACK_PLAN.md`](./I18N_LANGUAGE_PACK_PLAN.md) — note the
> flat-vs-nested key advice conflicts with the existing ~591-key nested label system and should be
> decided there, not adopted reflexively.

Consolidated action list from the r/website "rate my website 0–10" thread and the follow-up DM thread with ExplanationOk2014. Each item notes who raised it so you can weigh the source.

Priority key: **P0** = near-unanimous / highest leverage · **P1** = strong single-source, worth doing · **P2** = nice-to-have / polish · **Note** = context, not a task.

---

## P0 — Load / startup time (the one thing everyone agreed on)

This was raised independently by noguchilin, motomeru2526, unoriginalusername26, why_so_sergious, and ExplanationOk2014. It happens *before* anyone experiences the cycle concept, so it caps everything else. You acknowledged it to each of them and named it your next priority — consistent with how you handled the rest of the thread (you took the W3C link and committed to fixing the errors, located the magic value yourself, agreed to move the inline SVGs). This is the highest-leverage item on the list.

- [ ] **Add a build/release step (bundle + minify JS).** noguchilin's core diagnosis: the problem isn't total weight (~265KB at first render is fine), it's *round trips* — 74 separate JS files resolved serially through native ES-module import chains, each level adding a network round trip. esbuild can bundle+minify into a few files in milliseconds. Keep source unminified for dev, add the step only for release. Source maps keep debugging workable on locked-down machines.
- [ ] **Minify shipped JS and CSS.** Raised by noguchilin, unoriginalusername26 ("use pagespeed"), and ExplanationOk2014. You already said "minifying is on the list" — this is that.
- [ ] **Reduce/serve fewer CSS files.** 44 separate CSS files noted by noguchilin. Bundling applies here too.
- [ ] **Purge unused CSS — carefully.** ExplanationOk2014 ran PurifyCSS: **55.26% of your CSS reported unused (~14.93KB).** ⚠️ Do NOT run the purified output blind. Your app applies classes at runtime (icon swaps, vocabulary themes rewriting labels/colors, personalization), and static purifiers routinely strip classes that are only added by JS. Use the report as a *map* to hand-remove obvious dead weight, and verify against every theme and dynamic state before shipping.
- [ ] **Consider a CDN in front.** noguchilin measured ~850ms TTFB; a CDN would cut most of that. Combined with bundling, should put first render in the 1–2s range without touching architecture.
- [ ] **Defer non-critical loading past first interaction.** why_so_sergious: you don't need to go fully pre-transpiled — defer as much as possible to after first interaction, but some compilation/minification is mandatory for production regardless. Run it in a CI/CD pipeline.

---

## P0 — Concept clarity on first contact

Multiple people couldn't tell what the app was for before they experienced a cycle. ExplanationOk2014: "What is the purpose? I only see some achievements, I am honestly confused." Ambivalent_Oracle: "It seems like another TODO list." You diagnosed this yourself in-thread: "I may have focused so much on making the app feel simple that people categorize it as just a to-do list before they experience the cycle concept, which is really the whole point."

- [ ] **Put the pilot-checklist analogy on the site.** This is the big one and it's currently missing. ExplanationOk2014 stayed confused through your full written explanation and only got it at: *"Ahh I understand now, something like a pilot checklist before flying."* Your reply nailed why it works — "same steps every time, can't skip one, resets for the next flight." That one visceral comparison unlocked a confused user faster than paragraphs did. It belongs in the hero, not buried in a thread.
- [ ] **Make the cycle/reset concept visible before interaction.** The "aha" is the auto-reset + cycle count. Right now people have to complete a full routine to feel it. Show it up front (animation, the existing demo, or the analogy above).
- [ ] **Differentiate from to-do apps and habit trackers explicitly, early.** Your own framing is strong: to-do apps = one-off tasks done forever; habit trackers = daily streaks; miniCycle = multi-step routines you repeat in sequence that reset on completion. This is on the site but gets lost — lead with it.

---

## P1 — Code quality / accessibility (from the deeper reviewers)

### Accessibility (you said you take pride in this — protect it)
- [ ] **Fix the 19 HTML errors/warnings.** ExplanationOk2014 sent the exact list via the W3C validator (validator.w3.org/nu). You confirmed most were warnings but the errors are real. You called them "genuine accessibility bugs."
- [ ] **Run the HTML/accessibility validator as part of your release process.** Your own conclusion: features got added over time without re-doing accessibility checks; automating the validator prevents regressions as you keep shipping.

### Resource strings / label system (why_so_sergious — good, standards-based advice)
Context: he confirmed your `defaultLabels.js` approach is "almost per industry standard" and said "hats off... it shows good engineering ability." These are refinements toward a future i18n layer (you flagged `docs/future-works/I18N_LANGUAGE_PACK_PLAN.md`), not urgent fixes.
- [ ] **Move toward per-language files with a main `en.json` fallback** when you build the i18n layer.
- [ ] **Add a resource-compilation step** so a missing key in one language falls back to the main file (e.g. `es.cmpl.json` generated next to originals, loaded instead).
- [ ] **Avoid keystrings-as-values;** populate a `Resources` object on page load by language.
- [ ] **Use flat, descriptive keys, not nested ones** — e.g. `ModalProfileTitle` rather than `modal.profile.title`. Keep the resource object one level deep.

### Magic values (why_so_sergious)
- [ ] **Replace the `width - 140` magic value with a named constant.** You located it in the Whack-a-Order mini-game (`games/miniCycle-taskOrder.js`), not the main app. You already said you'd clean it up. Worth a sweep for other magic values in the games, since those predate your `core/constants.js` refactor.

### Icons / SVGs (ExplanationOk2014)
- [ ] **Optimize inline SVGs with SVGO** (jakearchibald's web tool — paste markup, get minified output, ~30% size savings with no visible difference, and you can fine-tune visually rather than batch-process). His point: better control than reaching for a library.
- [ ] **Move the handful of directly-inlined SVGs into your external icon system** (the few UI controls / chart SVGs) so they get the same caching benefit as your `iconInit.js`-swapped icons.

---

## P2 — Polish / smaller items

- [ ] **Consider a larger default mobile font size.** Dafty80 (6/10) said fonts felt small; his fair point was that users won't change their *phone's* accessibility settings to read your site — it should be responsive or larger by default. (Note the earlier crossed-wires: you meant the app's *built-in* font settings, he meant the OS's. You already agreed to consider a larger mobile default.)
- [ ] **Run Google PageSpeed and work the report.** unoriginalusername26's one concrete suggestion; overlaps with the P0 load work but gives a scored checklist.
- [ ] **Version-string consistency pass.** (From our earlier review, not the thread.) The user manual header, the Settings screenshot, and the site cite different versions. You confirmed these generate from `version.js` via `scripts/update-version.sh` — worth verifying the published artifacts all regenerated.

---

## Notes — things worth remembering, not tasks

- **You acknowledged load time to everyone who raised it** — motomeru, unoriginalusername, why_so_sergious, ExplanationOk2014, plus "minifying is on the list" in DMs. That's the honest response to a genuine consensus, and it's consistent with your track record in the thread: you don't just nod at feedback, you act on it (W3C errors, the magic value, the SVG caching move, a year of onboarding iteration). Recorded here as the thing you agreed with and are shipping next, not as a risk.
- **What actually converted skeptics.** The same move worked three times: refuse the vague dismissal, ask for a specific example, respond substantively. why_so_sergious went from "the code is horrible" → "hats off, good engineering ability." Ambivalent_Oracle's "learn UI/UX / pointless with AI" got met with "which part specifically?" ExplanationOk2014 went from "honestly confused" → helping you in DMs. This is a repeatable persuasion pattern, not luck.
- **Effort ratio.** You wrote long, careful replies to nearly everyone — including "0" and "Ofc honeeyyyy." The people who earned the long reply (why_so_sergious, ExplanationOk2014) paid it back; the five-second drive-bys didn't. Worth being deliberate about who gets the paragraphs at scale.
- **Not everything is signal.** "0," "took too long I closed it," "next do a trello clone," and "learn UX/UI" (with no specifics) gave you nothing actionable. The value concentrated in ~3 people. That's normal for these threads.
- **Don't over-index on "the code is horrible."** It came from someone who looked at 2 files for 2–3 minutes on mobile, one of which was your boot layer (`miniCycle.html`) — by your own account the least representative file. The *same person* later said your engineering showed good ability. The i18n advice was worth keeping; the verdict wasn't.

---

## Suggested order of attack

1. **Measure first** — capture current load numbers (PageSpeed + your own timing) so you can prove before/after and not fly blind.
2. **Bundle + minify for release** (esbuild), keeping the unminified dev workflow. Biggest single win.
3. **CSS: bundle, then carefully purge** dead styles theme-by-theme.
4. **SVGO pass** on inline SVGs; move stray inline SVGs into the external system.
5. **Fix the 19 W3C errors** and wire the validator into release.
6. **Rework the hero** around the pilot-checklist framing so the concept lands in seconds.
7. Then revisit the deeper architecture question (bundler vs. module waterfall) with real numbers in hand.

Items 2–5 are all release-step tooling — none of them require abandoning your no-framework architecture.
