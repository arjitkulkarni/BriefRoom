// WCAG 2.x relative luminance + contrast ratio for BriefRoom tokens (both themes).
// Usage: npm run check:contrast   (prints the design.md §5 table; exits 1 if any pair fails)
// Keep these values in sync with src/styles/globals.css.
const lum = (hex) => {
  const h = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const cr = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

export const T = {
  light: {
    background: '#F6F5F1', foreground: '#17161A', surface: '#FFFFFF', 'surface-secondary': '#F1EFEA', 'surface-tertiary': '#E9E6DF', 'surface-elevated': '#FFFFFF',
    primary: '#F6C343', 'primary-edge': '#9A6D06', 'primary-foreground': '#17161A', 'primary-hover': '#EEB52A', 'primary-soft': '#FCF1C7', 'primary-text': '#17161A',
    secondary: '#ECEAE4', 'secondary-foreground': '#17161A', 'secondary-hover': '#E2DFD7', accent: '#F6C343', 'accent-foreground': '#17161A',
    muted: '#EEECE6', 'muted-foreground': '#64625C', border: '#E2DFD7', 'border-strong': '#8E8A81', divider: '#EBE8E1', input: '#8E8A81', ring: '#17161A', placeholder: '#75726B',
    success: '#1D7A46', 'success-foreground': '#FFFFFF', 'success-hover': '#16663A', 'success-bg': '#E5F3EB', 'success-text': '#16663A',
    warning: '#B45309', 'warning-bg': '#FCF0DB', 'warning-text': '#8A4006',
    destructive: '#C4302B', 'destructive-foreground': '#FFFFFF', 'destructive-hover': '#A52722', 'destructive-bg': '#FCE8E7', 'destructive-text': '#A52722',
    info: '#2D5BCC', 'info-bg': '#E8EEFC', 'info-text': '#2449A8', tooltip: '#17161A', 'tooltip-foreground': '#FFFFFF',
    'bubble-own': '#FCF4D6', 'bubble-other': '#FFFFFF', activity: '#FBFAF7', canvas: '#E9E7E1',
    'ann-keep': '#1D7A46', 'ann-keep-bg': '#E5F3EB', 'ann-keep-text': '#16663A', 'ann-change': '#2D5BCC', 'ann-change-bg': '#E8EEFC', 'ann-change-text': '#2449A8',
    'ann-remove': '#C4302B', 'ann-remove-bg': '#FCE8E7', 'ann-remove-text': '#A52722', 'ann-question': '#7A3FD1', 'ann-question-bg': '#F1EAFC', 'ann-question-text': '#6331B5',
    'ann-add': '#B25A00', 'ann-add-bg': '#FCEFDF', 'ann-add-text': '#8C4700',
  },
  dark: {
    background: '#0B0A09', foreground: '#F5F2EA', surface: '#151412', 'surface-secondary': '#24221E', 'surface-tertiary': '#24221E', 'surface-elevated': '#1D1B18',
    primary: '#F6C343', 'primary-edge': '#F6C343', 'primary-foreground': '#14110A', 'primary-hover': '#F9D061', 'primary-soft': '#2B2312', 'primary-text': '#F6C343',
    secondary: '#25252B', 'secondary-foreground': '#F5F2EA', 'secondary-hover': '#2D2A25', accent: '#F6C343', 'accent-foreground': '#14110A',
    muted: '#1D1B18', 'muted-foreground': '#AAA59A', border: '#2A2722', 'border-strong': '#6E6A62', divider: '#221F1C', input: '#6E6A62', ring: '#F6C343', placeholder: '#8C8A92',
    success: '#1D7A46', 'success-foreground': '#FFFFFF', 'success-hover': '#228E52', 'success-bg': '#10261A', 'success-text': '#6CD39A',
    warning: '#B45309', 'warning-bg': '#2A1E0C', 'warning-text': '#F4B157',
    destructive: '#C4302B', 'destructive-foreground': '#FFFFFF', 'destructive-hover': '#D93B35', 'destructive-bg': '#2C1413', 'destructive-text': '#FF8F89',
    info: '#2D5BCC', 'info-bg': '#121C34', 'info-text': '#93B2FF', tooltip: '#F5F2EA', 'tooltip-foreground': '#14110A',
    'bubble-own': '#2A2416', 'bubble-other': '#1B1A17', activity: '#191815', canvas: '#090807',
    'ann-keep': '#1D7A46', 'ann-keep-bg': '#12271B', 'ann-keep-text': '#6CD39A', 'ann-change': '#2D5BCC', 'ann-change-bg': '#131D35', 'ann-change-text': '#93B2FF',
    'ann-remove': '#C4302B', 'ann-remove-bg': '#2E1515', 'ann-remove-text': '#FF8F89', 'ann-question': '#7A3FD1', 'ann-question-bg': '#231636', 'ann-question-text': '#C6A6FF',
    'ann-add': '#B25A00', 'ann-add-bg': '#2C1D0B', 'ann-add-text': '#F5AE5C',
  },
};

const pairs = [
  ['Body text', 'foreground', 'background', 4.5], ['Body text on card', 'foreground', 'surface', 4.5], ['Text on secondary surface', 'foreground', 'surface-secondary', 4.5], ['Text on elevated (dialogs, menus)', 'foreground', 'surface-elevated', 4.5],
  ['Muted text on page', 'muted-foreground', 'background', 4.5], ['Muted text on card', 'muted-foreground', 'surface', 4.5], ['Muted text on secondary', 'muted-foreground', 'surface-secondary', 4.5],
  ['Primary button label', 'primary-foreground', 'primary', 4.5], ['Primary button (hover)', 'primary-foreground', 'primary-hover', 4.5], ['Secondary button label', 'secondary-foreground', 'secondary', 4.5],
  ['Highlighter accent label', 'accent-foreground', 'accent', 4.5], ['Selected item text', 'foreground', 'primary-soft', 4.5], ['Link / primary text on card', 'primary-text', 'surface', 4.5],
  ['Destructive button', 'destructive-foreground', 'destructive', 4.5], ['Success button', 'success-foreground', 'success', 4.5],
  ['Success badge', 'success-text', 'success-bg', 4.5], ['Warning badge', 'warning-text', 'warning-bg', 4.5], ['Destructive badge', 'destructive-text', 'destructive-bg', 4.5], ['Info badge', 'info-text', 'info-bg', 4.5],
  ['Tooltip', 'tooltip-foreground', 'tooltip', 4.5], ['Placeholder in input', 'placeholder', 'surface', 4.5], ['Own chat bubble', 'foreground', 'bubble-own', 4.5], ['Other chat bubble', 'foreground', 'bubble-other', 4.5], ['Activity card', 'foreground', 'activity', 4.5],
  ['Marker number KEEP', '#FFFFFF', 'ann-keep', 4.5], ['Marker number CHANGE', '#FFFFFF', 'ann-change', 4.5], ['Marker number REMOVE', '#FFFFFF', 'ann-remove', 4.5], ['Marker number QUESTION', '#FFFFFF', 'ann-question', 4.5], ['Marker number ADD', '#FFFFFF', 'ann-add', 4.5],
  ['Chip KEEP', 'ann-keep-text', 'ann-keep-bg', 4.5], ['Chip CHANGE', 'ann-change-text', 'ann-change-bg', 4.5], ['Chip REMOVE', 'ann-remove-text', 'ann-remove-bg', 4.5], ['Chip QUESTION', 'ann-question-text', 'ann-question-bg', 4.5], ['Chip ADD', 'ann-add-text', 'ann-add-bg', 4.5],
  ['Input border vs card (WCAG 1.4.11)', 'input', 'surface', 3], ['Outline control border vs card', 'border-strong', 'surface', 3], ['Focus ring vs page', 'ring', 'background', 3], ['Focus ring vs card', 'ring', 'surface', 3], ['Primary button edge vs page', 'primary-edge', 'background', 3],
  ['Card edge (decorative, not required)', 'border', 'surface', 1],
];

const val = (t, k) => (k.startsWith('#') ? k : T[t][k]);
let fails = 0;
const rows = ['| Pair | Tokens | Light | Dark | Required |', '|---|---|---|---|---|'];
for (const [label, fg, bg, min] of pairs) {
  const L = cr(val('light', fg), val('light', bg));
  const D = cr(val('dark', fg), val('dark', bg));
  const ok = (v) => v >= min;
  if (!ok(L) || !ok(D)) fails++;
  rows.push(`| ${label} | \`${fg}\` on \`${bg}\` | ${L.toFixed(2)}:1 ${ok(L) ? '✅' : '❌'} | ${D.toFixed(2)}:1 ${ok(D) ? '✅' : '❌'} | ${min === 1 ? 'decorative' : `≥ ${min}:1`} |`);
}
console.log(rows.join('\n'));
console.log(`\nPairs checked: ${pairs.length * 2} · failing: ${fails}`);
process.exitCode = fails ? 1 : 0;
