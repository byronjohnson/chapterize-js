---
name: release-check
description: Pre-release checklist (sizes, tests in three engines, types, package contents, docs, site, Lighthouse). Use when asked whether the project is ready to publish or before tagging a version. Never publishes.
---

# Release check (read-only; never publish)

1. Re-read `package.json`: `name` (`chapterize-js`, published; `npm view chapterize-js` is `0.1.0` as of 2026-10-28), `version`, `exports`, `files: [dist, types, CHANGELOG.md]`, `sideEffects`, `repository`. A new version should not already be the `latest` tag.
2. `pkill -f "scripts/(serve|dev).mjs"; fuser -k 8080/tcp`, then `npm run test:all` and `npm run test:types`. Record pass/fail per engine.
3. `npm run size`: core `index.min.js` < 5 KB gzip soft limit; update the numbers in README, AGENTS.md, PROJECT-GOALS.md, `.cursor/rules/core.mdc` and the homepage eyebrow if they changed.
4. `npm pack --dry-run`: only `dist/`, `types/`, `package.json`, README, LICENSE (npm adds the last two). No `docs/`, `site/`, `test/`.
5. Smoke the published shapes: `node -e "require('<name>')"`, `node --input-type=module -e "import('<name>/auto')"`, and the global build on the site's `/plain` (sibling repo).
6. Docs: README, `llms.txt`, CHANGELOG/decisions log current; `/frameworks` regenerated (it's built from README).
7. Site (sibling repo `../chapterize-js-site`): `npm run test:all` (re-syncs `vendor/chapterize-js/`), `node scripts/screens.mjs /workspace/release-` and review,
   Lighthouse 99–100 on `npm run preview` (see its `docs/SITE.md`). Once the package is on npm, decide whether the site switches
   from `vendor/` to a `chapterize-js` dependency (`scripts/lib-root.mjs` already prefers `node_modules` over `vendor/`).
8. Report findings and stop. Publishing, tagging, pushing and deploying need Byron's explicit OK.
