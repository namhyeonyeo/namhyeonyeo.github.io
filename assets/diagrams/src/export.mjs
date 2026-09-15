#!/usr/bin/env node
/**
 * Export diagram-design HTML sources to site SVGs.
 *
 *   node assets/diagrams/src/export.mjs
 *
 * The .html files in this directory are diagram-design plugin output: each is
 * a self-contained editorial page that renders on its own. The site needs the
 * bare <svg> node instead, inlined by build.mjs so it inherits the theme.
 *
 * Export does two things:
 *   1. lifts the <svg> element out of the page (wrappers are dropped by design)
 *   2. re-points the plugin's skin at this site's tokens, so one file renders
 *      correctly in light, dark and print instead of shipping three variants
 *
 * Every literal below is a value the plugin's own skin emits; the mapping is
 * role-for-role, not a recolour.
 */

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = dirname(fileURLToPath(import.meta.url));
const OUT = join(SRC, '..', 'tools');

// plugin skin literal -> site token (with the literal kept as fallback)
const SKIN = [
  // typography: the plugin ships Geist; this site runs Pretendard + system mono
  [/var\(--font-sans, sans-serif\)/g, "var(--sans, 'Noto Sans KR', sans-serif)"],
  [/var\(--font-mono, monospace\)/g, 'var(--mono, ui-monospace, monospace)'],
  // node fills that must not stay literal white on a dark ground
  [/fill="#FFFFFF"/g, 'fill="var(--dg-node, #FFFFFF)"'],
  // ink washes — same opacities, RGB flipped in dark (style-guide inversion rule)
  [/fill="rgba\(15,23,42,0\.02\)"/g, 'fill="var(--dg-wash-1, rgba(15,23,42,0.02))"'],
  [/fill="rgba\(15,23,42,0\.03\)"/g, 'fill="var(--dg-wash-3, rgba(15,23,42,0.03))"'],
  [/fill="rgba\(15,23,42,0\.05\)"/g, 'fill="var(--dg-wash-2, rgba(15,23,42,0.05))"'],
  [/fill="rgba\(71,85,105,0\.10\)"/g, 'fill="var(--dg-input, rgba(71,85,105,0.10))"'],
  [/stroke="rgba\(15,23,42,0\.10\)"/g, 'stroke="var(--dg-rule-wash, rgba(15,23,42,0.10))"'],
  [/stroke="rgba\(15,23,42,0\.30\)"/g, 'stroke="var(--dg-rule-strong, rgba(15,23,42,0.30))"'],
];

const files = readdirSync(SRC).filter((f) => f.endsWith('.html'));
for (const file of files) {
  const html = readFileSync(join(SRC, file), 'utf8');
  const match = html.match(/<svg[\s\S]*<\/svg>/);
  if (!match) {
    console.warn(`⚠ no <svg> found in ${file}`);
    continue;
  }
  let svg = match[0];
  for (const [from, to] of SKIN) svg = svg.replace(from, to);
  const out = join(OUT, basename(file, '.html') + '.svg');
  writeFileSync(out, svg + '\n');
  console.log(`✓ ${file} → assets/diagrams/tools/${basename(out)}`);
}
