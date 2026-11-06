function lum(hex) {
  hex = hex.replace('#', '');
  if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
  const rgb = [0, 1, 2].map(i => parseInt(hex.substr(i * 2, 2), 16) / 255);
  const a = rgb.map(v => v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
}

function contrast(h1, h2) {
  const l1 = lum(h1), l2 = lum(h2);
  return ((Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05));
}

const tokens = {
  // Tonal neutrals
  'neutral-0': '#ffffff',
  'neutral-50': '#f7faf6',
  'neutral-100': '#f0f5ee',
  'neutral-200': '#e2ece0',
  'neutral-300': '#c8d7c4',
  'neutral-400': '#8fa48c',
  'neutral-500': '#5f7062',
  'neutral-600': '#425268',
  'neutral-700': '#25344d',
  'neutral-800': '#14213d',
  'neutral-900': '#0b1323',

  // Semantics
  text: '#14213d',
  textMuted: '#425268',
  textSubtle: '#4d5c50',
  paper: '#f0f5ee',
  surface: '#ffffff',
  accent: '#f24822',
  accentText: '#b8300f',
  focus: '#2f6fed',
  success: '#0f8a5f',
  successBg: '#e3f5ec',
  successText: '#0b6a48',
  mapVeil: '#eef5eb',
  mapGreen: '#d2f5e0'
};

const checks = [
  { name: 'Primary text on paper', fg: tokens.text, bg: tokens.paper, req: 4.5, type: 'Normal text' },
  { name: 'Primary text on surface (white)', fg: tokens.text, bg: tokens.surface, req: 4.5, type: 'Normal text' },
  { name: 'Muted text on paper', fg: tokens.textMuted, bg: tokens.paper, req: 4.5, type: 'Normal text' },
  { name: 'Muted text on surface (white)', fg: tokens.textMuted, bg: tokens.surface, req: 4.5, type: 'Normal text' },
  { name: 'Accent text (small coral) on paper', fg: tokens.accentText, bg: tokens.paper, req: 4.5, type: 'Normal text' },
  { name: 'Accent text (small coral) on white', fg: tokens.accentText, bg: tokens.surface, req: 4.5, type: 'Normal text' },
  { name: 'Success text on success background', fg: tokens.successText, bg: tokens.successBg, req: 4.5, type: 'Normal text' },
  { name: 'White text on dark ink footer', fg: '#ffffff', bg: tokens['neutral-800'], req: 4.5, type: 'Normal text' },
  { name: 'Footer muted text on dark ink', fg: '#dbe3f2', bg: tokens['neutral-800'], req: 4.5, type: 'Normal text' },

  // UI Components (3:1 required)
  { name: 'Coral route line on veiled map', fg: tokens.accent, bg: tokens.mapVeil, req: 3.0, type: 'UI graphic' },
  { name: 'Coral route line on map green', fg: tokens.accent, bg: tokens.mapGreen, req: 3.0, type: 'UI graphic' },
  { name: 'Coral route line against white route-halo', fg: tokens.accent, bg: tokens.surface, req: 3.0, type: 'UI graphic' },
  { name: 'Focus ring on white surface', fg: tokens.focus, bg: tokens.surface, req: 3.0, type: 'UI component' },
  { name: 'Focus ring on paper background', fg: tokens.focus, bg: tokens.paper, req: 3.0, type: 'UI component' }
];

console.log('=== WCAG 2.1 AA Contrast Verification ===');
let allPass = true;
checks.forEach(c => {
  const ratio = contrast(c.fg, c.bg);
  const pass = ratio >= c.req;
  if (!pass) allPass = false;
  console.log(`${pass ? '✓ PASS' : '❌ FAIL'}: ${c.name} (${c.fg} on ${c.bg}) = ${ratio.toFixed(2)}:1 (Required: ${c.req}:1)`);
});

if (allPass) console.log('\n✓ ALL COLOR PAIRS PASS WCAG 2.1 AA REQUIREMENTS!');
else console.error('\n❌ SOME COLOR PAIRS FAILED!');
