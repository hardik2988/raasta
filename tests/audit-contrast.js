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

const colors = {
  ink: '#14213d',
  ink2: '#3d4a63',
  paper: '#f3f8f2',
  tint: '#e9f2e6',
  white: '#ffffff',
  accent: '#ff5a36',
  accentInk: '#b8300f',
  focus: '#2f6fed',
  ok: '#0f8a5f',
  line: '#d3dfd0',
  mapBgGreen: '#d2f5e0',
  mapVeilOverlay: '#eef5eb',
  cAcademic: '#2f6fed',
  cHostel: '#e8780f',
  cFood: '#d6336c',
  cSports: '#0f8a5f',
  cAdmin: '#7a4fd6',
  footerMuted: '#dbe3f2',
  arrivedBg: '#e3f5ec',
  arrivedText: '#0b6a48'
};

console.log('=== Text Contrast (4.5:1 required for normal, 3:1 for large) ===');
console.log('ink on paper (#f3f8f2):', contrast(colors.ink, colors.paper).toFixed(2));
console.log('ink-2 on paper (#f3f8f2):', contrast(colors.ink2, colors.paper).toFixed(2));
console.log('accent-ink on paper (#f3f8f2):', contrast(colors.accentInk, colors.paper).toFixed(2));
console.log('accent (#ff5a36) text on paper:', contrast(colors.accent, colors.paper).toFixed(2), '<- FAILS for normal text if used as text');

console.log('\n=== Text on White (#ffffff) ===');
console.log('ink on white:', contrast(colors.ink, colors.white).toFixed(2));
console.log('ink-2 on white:', contrast(colors.ink2, colors.white).toFixed(2));
console.log('accent-ink on white:', contrast(colors.accentInk, colors.white).toFixed(2));
console.log('accent on white:', contrast(colors.accent, colors.white).toFixed(2));

console.log('\n=== Text on Tint (#e9f2e6) ===');
console.log('ink on tint:', contrast(colors.ink, colors.tint).toFixed(2));
console.log('ink-2 on tint:', contrast(colors.ink2, colors.tint).toFixed(2));

console.log('\n=== Text on Dark Ink (#14213d) ===');
console.log('white on ink:', contrast(colors.white, colors.ink).toFixed(2));
console.log('footerMuted (#dbe3f2) on ink:', contrast(colors.footerMuted, colors.ink).toFixed(2));

console.log('\n=== Success state ===');
console.log('arrived text (#0b6a48) on arrivedBg (#e3f5ec):', contrast(colors.arrivedText, colors.arrivedBg).toFixed(2));

console.log('\n=== UI Components & Graphics (3:1 required) ===');
console.log('accent (#ff5a36) route on map veiled (#eef5eb):', contrast(colors.accent, colors.mapVeilOverlay).toFixed(2));
console.log('accent (#ff5a36) route on map green (#d2f5e0):', contrast(colors.accent, colors.mapBgGreen).toFixed(2));
console.log('accent (#ff5a36) against white route-halo (#ffffff):', contrast(colors.accent, colors.white).toFixed(2));
console.log('cta-band button text: ink (#14213d) on accent (#ff5a36):', contrast(colors.ink, colors.accent).toFixed(2));
console.log('focus ring (#2f6fed) against white:', contrast(colors.focus, colors.white).toFixed(2));
console.log('focus ring (#2f6fed) against paper:', contrast(colors.focus, colors.paper).toFixed(2));
console.log('line (#d3dfd0) against white:', contrast(colors.line, colors.white).toFixed(2));
console.log('line (#d3dfd0) against paper:', contrast(colors.line, colors.paper).toFixed(2));
