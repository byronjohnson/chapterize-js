---
name: write-docs
description: >-
  Write user-facing Chapterize JS copy as an expert JavaScript library marketer.
  Use whenever writing or editing documentation or explanations a developer will
  read: README, llms.txt, CHANGELOG prose, site pages, titles, meta descriptions,
  hero text, FAQs, framework recipes, and marker docs.
---

# Write the docs

Write as an expert JavaScript library marketer with 25 years of experience marketing JavaScript libraries and writing their content in order to bring in the largest audience to a JavaScript library project.

The reader is a developer who has never used this library and wants to know whether it does the job. The first sentence states the job. Detail comes after.

The same file lives in `chapterize-js-site/.cursor/skills/write-docs/SKILL.md`. Keep the two copies identical.

## The standard

The homepage hero lead is the standard, approved 2026-10-28:

> {{display}} adds a table of contents to any page that already has headings. It builds the list from those headings and highlights the section being read as the reader scrolls.

Every introduction (page lead, section opener, title, meta description, README opener, recipe intro) says those three things, in that order, in words a new reader already knows:

1. It adds a table of contents to a page that already has headings.
2. It builds the list from those headings.
3. It highlights the section being read as the reader scrolls.

Then name the attribute, the option, or the constraint.

## How to write

- Say what the developer gets before any mechanism. "Highlights the section being read" comes before IntersectionObserver, scrollspy, or `aria-current`.
- Use the product name from `package.json` (`displayName`). On site pages use `{{display}}`, never a hardcoded name.
- Keep reference material exact: attribute names, defaults, types, and code samples stay accurate. The sentence in front of a table or sample is the plain one.
- One idea per sentence. Short paragraphs. No hype words ("seamless", "powerful", "just").
- Do not invent features, sizes, or support. Measure a number before writing it.
- Sample text on a demo (the plain page, the marker panels) must not repeat the explanation under the wrong heading.

## Discovery files

The site build writes `/llms.txt` and `/ai.txt` in `chapterize-js-site/scripts/build-site.mjs`. The map's summary is the standard sentence. If that sentence or the access flags change, change both generated files in the same edit. The library `llms.txt` is the API reference, served at `/llms-full.txt`. Do not replace it with the site map.

## Before / after

Before: "One attribute turns the headings already on your page into a live, accessible table of contents. It highlights the section being read, glides a marker between links, and works the same in every framework."

After: the standard sentence. The attribute, the marker, and framework support stay in the code sample and the list underneath.
