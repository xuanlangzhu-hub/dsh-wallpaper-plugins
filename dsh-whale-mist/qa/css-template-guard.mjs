// Static guard for the CSS template literal in src/client.js.
//
// Twice during the visual rework a backtick written inside the `css`/`backdropCss` template
// literals terminated the template early and produced a syntax error that only showed up when
// the file was loaded. Both cases were comment text, so the intent was harmless but the file
// was broken. This check fails with the exact line instead of leaving it to the next load.
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = await readFile(join(root, 'src/client.js'), 'utf8');
const lines = source.split('\n');

// The template literals that hold CSS: they start at `const <name> = ` + backtick and end at a
// backtick followed by a semicolon on its own line.
const OPENERS = [/^const css = `/, /^const backdropCss = `/, /^const paletteCss/];
const findings = [];
let open = null;
lines.forEach((line, index) => {
  const number = index + 1;
  if (!open) {
    if (OPENERS.some(pattern => pattern.test(line.trim()))) open = { from: number };
    return;
  }
  // Inside a CSS template only the closing backtick-semicolon is allowed, and only as the
  // template's own end: any other backtick is a stray one.
  const backticks = (line.match(/`/g) ?? []).length;
  if (backticks === 0) return;
  const isClose = /^\s*`;\s*$/.test(line);
  if (isClose) { open = null; return; }
  findings.push(`${number}: ${line.trim().slice(0, 100)}`);
});

assert.equal(findings.length, 0,
  'a backtick inside a CSS template literal terminates it early; use a different character in comments:\n'
  + findings.join('\n'));

// The same trap in another form: ES escape sequences inside these templates silently lose their
// backslash, so `\s` reaches the browser as `s`. Regexes that need one belong in a page script
// or a separate file, not inline here with a single backslash.
const templateRanges = [];
let current = null;
lines.forEach((line, index) => {
  const number = index + 1;
  if (!current) {
    if (OPENERS.some(pattern => pattern.test(line.trim()))) current = { from: number, to: number };
    return;
  }
  current.to = number;
  if (/^\s*`;\s*$/.test(line)) { templateRanges.push(current); current = null; }
});
const escaped = [];
for (const range of templateRanges) {
  for (let number = range.from; number <= range.to; number += 1) {
    const line = lines[number - 1];
    if (/\\[sSdDwWbBnrt]/.test(line) && !/\\\\[sSdDwWbBnrt]/.test(line)) {
      escaped.push(`${number}: ${line.trim().slice(0, 100)}`);
    }
  }
}
assert.equal(escaped.length, 0,
  'a single backslash in these templates is dropped before the browser sees it; double it or move the regex into a page script:\n'
  + escaped.join('\n'));

console.log(`css template checks passed: ${templateRanges.length} template literal(s), no stray backticks, no single-backslash escapes`);
