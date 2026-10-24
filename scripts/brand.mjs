// The project's name lives in ONE place: package.json ("name", "displayName", "globalName").
// Every script here reads it from this file; the sibling site repo (chapterize-js-site) reads the same package.json.
// The library source and the site templates never hard-code it.
// Renaming the project: see "Renaming" in AGENTS.md.
import { readFileSync } from 'node:fs';

export const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
export const NAME = pkg.name; // npm package name, import specifier
export const DISPLAY = pkg.displayName; // human-readable name in titles and prose
export const GLOBAL = pkg.globalName; // window global of the script-tag build
export const VERSION = pkg.version;
export const REPO = pkg.repository.url.replace(/^git\+|\.git$/g, '');
