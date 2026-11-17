# Handoff: interactive lucky cat for heymaneki.github.io

> Temporary planning note. Delete this file (and the `docs/` folder) once the feature ships.

## Context
- Repo: heymaneki/heymaneki.github.io (GitHub Pages, single static `index.html`, no build step, no dependencies).
- Latest work is on branch `ccr-f40bfd4d-g0ngc8` (not yet merged to main). Build on top of it.
- Owner feedback that shaped the current design: the page felt "AI-generated / inauthentic", mainly from
  emojis, arrow glyphs, and four identical service cards. Those were removed. Please keep it that way:
  no emojis in the UI (draw icons/hearts/etc. as inline SVG instead).

## Current page (don't break these)
- Style: cream background with a soft dot grid, thick dark outlines (`2px solid var(--ink)`),
  hard offset shadows (`var(--shadow)` / `var(--shadow-sm)`), rounded corners.
- Color tokens live on `:root` and are overridden under `[data-theme="dark"]`:
  `--bg --dot --card --card-alt --text --muted --ink --accent --accent-hover --on-accent --gold --teal --pink`.
  Use only these tokens so the cat works in both themes.
- Theme is applied by a small script in `<head>` (saved choice in localStorage key `maneki-theme`,
  otherwise follows `prefers-color-scheme`). All localStorage access is wrapped in try/catch; keep that pattern.
- Primary button contrast was fixed to pass WCAG AA; keep any new text at AA contrast too.
- The hero card (`header.hero`) has the avatar, name, bio, and link buttons.

## The feature: a lucky cat that tells fortunes
A small maneki-neko character that feels alive and doubles as a live sample of the owner's
"small web tools / random generator" service. Maneki-neko = lucky cat, so the theme is luck.

### Placement & art
- Sits in the top-right corner of the hero card, peeking over its top edge. On narrow screens
  (<480px), scale it down and make sure it doesn't cover the name or buttons.
- Draw it as inline SVG matching the page: thick `var(--ink)` outlines, flat fills from the tokens
  (body `--card`, accents `--accent` / `--gold`). Separate groups for body, raised paw, eyes, eyelids,
  and tail so each can animate on its own.

### Behaviors (core version)
1. Idle life: blinks at random intervals (every 3–6s); waves its raised paw occasionally.
2. Eyes follow the cursor (clamp pupil movement to a small radius; throttle with requestAnimationFrame).
3. Petting: quick back-and-forth mouse movement over the cat → eyes squint, a few small SVG hearts
   float up, plus a visible "purr" wiggle. On touch devices, a press-and-hold does the same.
4. Click or tap → fortune slip: a paper-slip card appears just below the cat (inside or attached to the
   hero card), styled like the rest of the page. It shows:
   - a luck level, weighted: Great luck (rare), Good luck, Small luck, Uncertain luck, Bad luck (rare)
   - one short, funny line from a pool of 30+ lines (e.g. "A stranger will compliment your font choices.")
   - Bad luck gets a playful follow-up like "Click again to bribe the cat."
   Don't repeat the same line twice in a row. Close with a button, Escape, or a click outside.
5. Nap: after ~30s with no mouse/keyboard/touch input, the cat curls up / closes its eyes and a small
   "zzz" floats up. Any input wakes it with a short stretch.

### Optional extras (separate commits, after the core works)
- Easter eggs: a very rare "golden fortune" with a gold slip; a reaction after ~20 rapid clicks
  ("okay, that's enough").
- Lucky coin counter: every few fortunes the cat drops a coin; the count is saved in localStorage
  (per-visitor only; there is no backend). Guard with try/catch.
- Voice lines (later phase, needs owner's audio): the owner has an ElevenLabs Creator plan and will
  generate 10–20 short clips in a cat character voice. Plan for `/audio/*.mp3` files mapped to fortunes
  or reactions. Sound stays OFF until the visitor turns it on, with a visible mute toggle; never autoplay.

### Accessibility & quality
- The cat is a real `<button>` with an accessible label (e.g. "Lucky cat: get a fortune"); fortunes are
  announced via an `aria-live="polite"` region; the slip is reachable and closable by keyboard.
- `prefers-reduced-motion: reduce` → no waving, wiggling, floating hearts or eye tracking. Clicking
  for a fortune still works.
- No new external libraries or network requests. Keep JS and CSS inline in `index.html` (or one small
  `cat.js` if it grows large). Total addition should stay small (aim < 25 KB).
- No horizontal scrolling at 360px wide; no console errors; works in both light and dark themes.

## Acceptance checklist
- [ ] Cat renders in the hero card corner in light and dark mode, desktop and phone widths
- [ ] Blink, wave, eye-follow, petting, nap/wake all work; all motion off with reduced motion
- [ ] Click/tap/Enter gives a weighted fortune; slip closes via button, Esc, and outside click
- [ ] Keyboard and screen reader can use it
- [ ] No emojis anywhere in the UI; only existing color tokens used
- [ ] Theme toggle and "Copy email" button still work; no console errors
