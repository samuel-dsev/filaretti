import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// WCAG relative luminance and contrast on the semantic color combinations used
// by the shared components. The browser review separately checks rendered text,
// focus/keyboard behavior, imagery, and states; this is not a WCAG certification.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourcePath = 'packages/ui/src/styles.css';
const asJson = process.argv.includes('--json');
const pairs = [];
const text = (foreground, backgrounds, usage) => {
  for (const background of backgrounds) pairs.push({ foreground, background, minimum: 4.5, usage });
};
const control = (foreground, backgrounds, usage) => {
  for (const background of backgrounds) pairs.push({ foreground, background, minimum: 3, usage });
};

text('ink', ['surface', 'offwhite', 'pale'], 'body text and field values');
text('muted', ['surface', 'offwhite', 'pale'], 'secondary text and help');
text('navy', ['surface', 'offwhite', 'pale'], 'headings and labels');
text('primary', ['surface', 'offwhite', 'pale'], 'links and information states');
text('surface', ['navy', 'primary', 'action', 'danger'], 'inverse text and solid action labels');
text('pale', ['navy', 'primary', 'action'], 'inverse supporting text and navigation');
text('success', ['success-soft', 'surface', 'offwhite'], 'success status and feedback');
text('warning', ['warning-soft', 'surface', 'offwhite'], 'warning status and feedback');
text('danger', ['danger-soft', 'surface', 'offwhite'], 'error status and feedback');
control('border', ['surface', 'offwhite', 'pale'], 'field and outlined control boundaries');
control('primary', ['surface', 'offwhite', 'pale'], 'primary control boundary');
control('action', ['surface', 'offwhite'], 'action control boundary');
control('danger', ['surface', 'offwhite'], 'invalid field boundary');
control('focus', ['surface', 'offwhite', 'pale'], 'focus indicator on light surfaces');
control('focus-inverse', ['navy', 'primary', 'action'], 'focus indicator on dark surfaces');

function parseHex(value) {
  const match = value.trim().match(/^#([a-f\d]{3}|[a-f\d]{6})$/i);
  if (!match) throw new Error(`Unsupported opaque color: ${value}`);
  const hex =
    match[1].length === 3
      ? [...match[1]].map((character) => character + character).join('')
      : match[1];
  return [0, 2, 4].map((offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255);
}

function luminance(rgb) {
  const linear = rgb.map((channel) =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
  );
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
}

function ratio(foreground, background) {
  const values = [luminance(parseHex(foreground)), luminance(parseHex(background))].sort(
    (a, b) => b - a,
  );
  return (values[0] + 0.05) / (values[1] + 0.05);
}

const report = {
  source: sourcePath,
  standard: 'WCAG 2.2 AA: normal text >= 4.5:1; component boundaries and focus >= 3:1',
  checks: [],
  errors: [],
  limitations: [
    'Opaque semantic color pairs only. Disabled controls, decorative borders, imagery, dynamic backgrounds and complete WCAG conformance require browser/manual review.',
  ],
};

try {
  const css = readFileSync(resolve(root, sourcePath), 'utf8');
  const tokens = new Map();
  for (const match of css.matchAll(/(--f-color-[a-z\d-]+)\s*:\s*([^;{}]+);/gi)) {
    const value = match[2].trim();
    if (tokens.has(match[1]) && tokens.get(match[1]) !== value)
      throw new Error(`Color token changes by context: ${match[1]}`);
    tokens.set(match[1], value);
  }
  const resolveToken = (name, seen = new Set()) => {
    if (seen.has(name)) throw new Error(`Cyclic token: ${name}`);
    const value = tokens.get(name);
    if (!value) throw new Error(`Missing color token: ${name}`);
    const alias = value.match(/^var\((--f-color-[a-z\d-]+)\)$/i);
    return alias ? resolveToken(alias[1], new Set([...seen, name])) : value;
  };
  for (const match of css.matchAll(/var\((--f-color-[a-z\d-]+)/gi)) resolveToken(match[1]);
  for (const pair of pairs) {
    const foregroundToken = `--f-color-${pair.foreground}`;
    const backgroundToken = `--f-color-${pair.background}`;
    const foreground = resolveToken(foregroundToken);
    const background = resolveToken(backgroundToken);
    const contrast = ratio(foreground, background);
    report.checks.push({
      foregroundToken,
      backgroundToken,
      foreground,
      background,
      ratio: Number(contrast.toFixed(3)),
      minimum: pair.minimum,
      usage: pair.usage,
      passed: contrast >= pair.minimum,
    });
  }
} catch (error) {
  report.errors.push(error.message);
}

report.passed =
  report.errors.length === 0 &&
  report.checks.length === pairs.length &&
  report.checks.every((check) => check.passed);
if (asJson) console.log(JSON.stringify(report, null, 2));
else {
  for (const check of report.checks)
    console.log(
      `${check.passed ? 'PASS' : 'FAIL'} ${check.foregroundToken} / ${check.backgroundToken}: ${check.ratio}:1 (>= ${check.minimum}:1)`,
    );
  for (const error of report.errors) console.error(error);
  console.log(
    `${report.passed ? 'PASS' : 'FAIL'}: ${report.checks.length} semantic contrast combinations; see browser/manual limitations with --json.`,
  );
}
if (!report.passed) process.exitCode = 1;
