// Fails if the three locale files drift apart.
//
// LanguageContext falls back to English for a missing key, so a key added to
// en.ts but not vn.ts renders English inside a Vietnamese UI and looks like a
// translation nobody got around to, rather than a bug. This makes it a build
// failure instead.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const LOCALES = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'locales');
const LANGS = ['ja', 'en', 'vn'];
const KEY_RE = /^ {2}'([^']*)':/gm;
const ENTRY_RE = /^ {2}'([^']*)': (.*)$/gm;

// Hiragana, katakana, CJK ideographs and the fullwidth forms.
const CJK_RE = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uff00-\uff9f]/;

// Keys whose value is Japanese ON PURPOSE in every language, because it is a
// unit rather than prose: 万 is how this company writes 10,000 yen on a slide,
// in a Vietnamese report as much as a Japanese one.
const CJK_ALLOWED = new Set(['catia.manYenUnit']);

const read = (lang) => {
  const src = fs.readFileSync(path.join(LOCALES, `${lang}.ts`), 'utf8');
  return [...src.matchAll(KEY_RE)].map((m) => m[1]);
};

let failed = false;
const fail = (msg) => { console.error(`  ${msg}`); failed = true; };
const list = (arr) => arr.slice(0, 8).join(', ') + (arr.length > 8 ? ' …' : '');

const keys = Object.fromEntries(LANGS.map((l) => [l, read(l)]));

// A Japanese string left in vn.ts or en.ts renders Japanese inside a Vietnamese
// UI, which reads as a missing translation and is invisible to a key-only check:
// `nav.catiaLicense` sat in vn.ts as 'CATIAライセンス管理' until this ran.
const readEntries = (lang) => {
  const src = fs.readFileSync(path.join(LOCALES, `${lang}.ts`), 'utf8');
  return [...src.matchAll(ENTRY_RE)].map((m) => [m[1], m[2]]);
};

for (const lang of LANGS) {
  if (lang === 'ja') continue;
  const offenders = readEntries(lang)
    .filter(([k, v]) => !CJK_ALLOWED.has(k) && CJK_RE.test(v))
    .map(([k]) => k);
  if (offenders.length) {
    fail(
      `${lang}.ts has ${offenders.length} untranslated Japanese value(s): ${list(offenders)}` +
      '\n  (translate them, or add the key to CJK_ALLOWED if the value is a unit)'
    );
  }
}

for (const lang of LANGS) {
  if (keys[lang].length === 0) fail(`${lang}.ts parsed to zero keys — the key format changed?`);
  const seen = new Set();
  const dupes = new Set();
  for (const k of keys[lang]) (seen.has(k) ? dupes : seen).add(k);
  if (dupes.size) fail(`${lang}.ts has duplicate keys: ${list([...dupes].sort())}`);
}

const reference = new Set(keys.en);
for (const lang of LANGS) {
  if (lang === 'en') continue;
  const here = new Set(keys[lang]);
  const missing = [...reference].filter((k) => !here.has(k));
  const extra = [...here].filter((k) => !reference.has(k));
  if (missing.length) fail(`${lang}.ts is missing ${missing.length} key(s): ${list(missing)}`);
  if (extra.length) fail(`${lang}.ts has ${extra.length} key(s) en.ts does not: ${list(extra)}`);
}

if (failed) {
  console.error('\nlocale check FAILED');
  process.exit(1);
}
console.log(`locale check OK — ${reference.size} keys x ${LANGS.join('/')}`);
