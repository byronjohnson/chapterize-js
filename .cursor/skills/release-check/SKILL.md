---
name: release-check
description: Pre-release checklist (sizes, tests in three engines, types, package contents, docs, site, Lighthouse). Use when asked whether the project is ready to publish or before tagging a version. Never publishes.
---

# Release check (read-only; never publish)

1. Re-read `package.json`: `name` (`chapterize-js`; still free on npm? `npm view chapterize-js` should 404 until the first publish), `version`, `exports`, `files: [dist, types]`, `sideEffects`, `repository`.
2. `pkill -f "scripts/(serve|dev).mjs"; fuser -k 8080/tcp`, then `npm run test:all` and `npm run test:types`. Record pass/fail per engine.
3. `npm run size`: core `index.min.js` < 5 KB gzip soft limit; update the numbers in README, AGENTS.md, PROJECT-GOALS.md, `.cursor/rules/core.mdc` and the homepage eyebrow if they changed.
4. `npm pack --dry-run`: only `dist/`, `types/`, `package.json`, README, LICENSE (npm adds the last two). No `docs/`, `site/`, `test/`.
5. Smoke the published shapes: `node -e "require('<name>')"`, `node --input-type=module -e "import('<name>/auto')"`, `/plain` on the built site (global build).
6. Docs: README, `llms.txt`, CHANGELOG/decisions log current; `/frameworks` regenerated (it's built from README).
7. Site: `npm run build:site`, `node scripts/screens.mjs /workspace/release-` and review, Lighthouse 99–100 (see `docs/SITE.md`).
8. Report findings and stop. Publishing, tagging, pushing and deploying need Byron's explicit OK.
