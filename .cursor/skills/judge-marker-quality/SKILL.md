---
name: judge-marker-quality
description: Visually judge the gliding marker presets (line, pill, minimal) and the homepage TOC with screenshots in three engines. Use after changing src/marker.css, marker logic, or the site's TOC styling.
---

# Judge marker quality

1. `npm run build:site`, then `node scripts/screens.mjs /workspace/judge-` (and `TEST_BROWSER=firefox|webkit node scripts/screens.mjs /workspace/judge-ff-` / `/workspace/judge-wk-`).
   Shots land in `/workspace/judge-*.png`: home desktop mid-page, home mobile, mobile sheet, markers page (all three presets mid-scroll), frameworks.
   The Read tool caches images by path: use a new prefix for each round.
2. Look at each preset at rest. **Pass** when:
   - the line/pill sits exactly on the active link (no 1px offsets, aligned to the text box, nested levels indented by `--spy-indent`);
   - `line`: faint rail full height, fill up to the active link, glow subtle (not neon), soft band behind the row;
   - `pill`: rounded band hugs the link with even padding, text stays readable (contrast ≥ 4.5:1);
   - `minimal`: only the line, nothing else;
   - active text color distinct, `.is-trail` parents subtly emphasized;
   - looks right on dark (site) and light (`/plain`) backgrounds with default variables.
3. Motion (`npm run dev`, scroll and click): the marker glides with the expo-out ease, no jitter or overshoot, no flicker through
   intermediate items on click, instant under reduced motion. Long jumps shouldn't feel slow (`--spy-duration` .6s default).
4. Check 390px width and a nav that scrolls (long TOC): the marker stays in sync when the nav itself scrolls.
5. Report what you saw per preset and engine with the screenshot paths; fix, re-shoot with a new prefix, compare.
