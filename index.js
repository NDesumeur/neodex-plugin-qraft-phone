// Qraft : fabriquer des QR codes. Texte, lien, Wi-Fi, contact, e-mail, SMS ou position ; 4 niveaux de correction, couleurs, marge,
// export PNG et SVG. L'encodeur est écrit ici (mode octets, versions 1 à 40, Reed-Solomon, 8 masques) d'après la norme ISO 18004,
// et chaque code produit est relu par un petit décodeur pour vérifier qu'il redonne bien le texte.
const CSS = `
.qrGrid{display:grid;grid-template-columns:minmax(0,1fr) 360px;gap:14px}
@media (max-width:900px){.qrGrid{grid-template-columns:minmax(0,1fr)}.qrGrid>:last-child{order:-1}}
.qrTypes{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px}
.qrTypes .btn,.qrRow .btn{width:auto;margin:0}
.qrRow{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin:6px 0}
.qrRow .f{flex:1;min-width:0;margin:0}
.qrField{margin:6px 0}
.qrField .hint{display:block;margin-bottom:2px}
.qrField .f{width:100%;margin:0}
.qrCan{width:100%;max-width:340px;aspect-ratio:1;display:block;margin:0 auto;image-rendering:pixelated;border:2px solid var(--line)}
.qrInfo{font:12px monospace;color:var(--lilac);margin:8px 0;line-height:1.6}
.qrInfo b{color:#fff}
.qrWarn{color:#ffd34f;font-size:12px;min-height:16px}
.qrSw{width:26px;height:26px;border:2px solid #000;cursor:var(--cp,pointer);padding:0}
.qrSw.on{outline:2px solid #fff;outline-offset:1px}
.qrRecent{display:flex;flex-direction:column;gap:4px;margin-top:6px}
.qrRecent .btn{width:100%;margin:0;text-align:left;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding:4px 8px}
`;
// ---------- l'encodeur ----------
const ECL = {L: [0, 1], M: [1, 0], Q: [2, 3], H: [3, 2]};  // [indice dans les tables, bits de format]
const ECC_PER_BLOCK = [
  [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
  [-1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  [-1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30]];
const NUM_BLOCKS = [
  [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
  [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
  [-1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68],
  [-1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81]];
const rawModules = v => { let r = (16 * v + 128) * v + 64; if (v >= 2) { const n = Math.floor(v / 7) + 2; r -= (25 * n - 10) * n - 55; if (v >= 7) r -= 36; } return r; };
const dataCodewords = (v, e) => Math.floor(rawModules(v) / 8) - ECC_PER_BLOCK[e][v] * NUM_BLOCKS[e][v];
const alignPos = v => { if (v === 1) return []; const n = Math.floor(v / 7) + 2, size = v * 4 + 17, step = Math.floor((v * 8 + n * 3 + 5) / (n * 4 - 4)) * 2, r = []; for (let p = size - 7; r.length < n - 1; p -= step) r.unshift(p); return [6, ...r]; };
const gmul = (x, y) => { let z = 0; for (let i = 7; i >= 0; i--) { z = (z << 1) ^ ((z >>> 7) * 0x11d); z ^= ((y >>> i) & 1) * x; } return z & 255; };
function rsDivisor(deg) { const r = Array(deg).fill(0); r[deg - 1] = 1; let root = 1; for (let i = 0; i < deg; i++) { for (let j = 0; j < deg; j++) { r[j] = gmul(r[j], root); if (j + 1 < deg) r[j] ^= r[j + 1]; } root = gmul(root, 2); } return r; }
function rsRemainder(data, div) { const r = div.map(() => 0); for (const b of data) { const f = b ^ r.shift(); r.push(0); div.forEach((c, i) => r[i] ^= gmul(c, f)); } return r; }
const MASKS = [(x, y) => (x + y) % 2 === 0, (x, y) => y % 2 === 0, x => x % 3 === 0, (x, y) => (x + y) % 3 === 0, (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
  (x, y) => x * y % 2 + x * y % 3 === 0, (x, y) => (x * y % 2 + x * y % 3) % 2 === 0, (x, y) => ((x + y) % 2 + x * y % 3) % 2 === 0];
const formatBits = (e, mask) => { const d = ECL[e][1] << 3 | mask; let r = d; for (let i = 0; i < 10; i++) r = (r << 1) ^ ((r >>> 9) * 0x537); return (d << 10 | r) ^ 0x5412; };
// la grille des motifs fixes (repères, synchronisation, alignement, version) : renvoie [modules, estFixe]
function functionPatterns(v) {
  const size = v * 4 + 17, m = Array.from({length: size}, () => Array(size).fill(false)), fn = m.map(r => r.map(() => false));
  const set = (x, y, d) => { m[y][x] = d; fn[y][x] = true; };
  for (let i = 0; i < size; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
  for (const [cx, cy] of [[3, 3], [size - 4, 3], [3, size - 4]]) for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) { const x = cx + dx, y = cy + dy, d = Math.max(Math.abs(dx), Math.abs(dy)); if (x >= 0 && y >= 0 && x < size && y < size) set(x, y, d !== 2 && d !== 4); }
  const ap = alignPos(v), n = ap.length;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { if ((i === 0 && j === 0) || (i === 0 && j === n - 1) || (i === n - 1 && j === 0)) continue; for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(ap[i] + dx, ap[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1); }
  drawFormat(m, fn, 0, size);  // réserve la place (les vrais bits viennent avec le masque)
  if (v >= 7) { let r = v; for (let i = 0; i < 12; i++) r = (r << 1) ^ ((r >>> 11) * 0x1f25); const b = v << 12 | r; for (let i = 0; i < 18; i++) { const d = (b >>> i & 1) === 1, a = size - 11 + i % 3, c = Math.floor(i / 3); set(a, c, d); set(c, a, d); } }
  return [m, fn];
}
function drawFormat(m, fn, bits, size) {
  const set = (x, y, d) => { m[y][x] = d; fn[y][x] = true; }, bit = i => (bits >>> i & 1) === 1;
  for (let i = 0; i <= 5; i++) set(8, i, bit(i)); set(8, 7, bit(6)); set(8, 8, bit(7)); set(7, 8, bit(8)); for (let i = 9; i < 15; i++) set(14 - i, 8, bit(i));
  for (let i = 0; i < 8; i++) set(size - 1 - i, 8, bit(i)); for (let i = 8; i < 15; i++) set(8, size - 15 + i, bit(i)); set(8, size - 8, true);
}
// l'ordre de lecture en zigzag des modules libres, colonne par colonne de deux, de droite à gauche
function zigzag(fn) { const size = fn.length, out = []; for (let right = size - 1; right >= 1; right -= 2) { if (right === 6) right = 5; for (let vert = 0; vert < size; vert++) for (let j = 0; j < 2; j++) { const x = right - j, up = ((right + 1) & 2) === 0, y = up ? size - 1 - vert : vert; if (!fn[y][x]) out.push([x, y]); } } return out; }
function blocksLayout(v, e) { const nb = NUM_BLOCKS[e][v], ecc = ECC_PER_BLOCK[e][v], raw = Math.floor(rawModules(v) / 8), nShort = nb - raw % nb, shortLen = Math.floor(raw / nb); return {nb, ecc, nShort, shortLen}; }
function penalty(m) {
  const n = m.length; let p = 0, dark = 0;
  const lines = []; for (let i = 0; i < n; i++) { lines.push(m[i]); lines.push(m.map(r => r[i])); }
  for (const L of lines) { let run = 1; for (let i = 1; i <= n; i++) { if (i < n && L[i] === L[i - 1]) run++; else { if (run >= 5) p += run - 2; run = 1; } }
    for (let i = 0; i + 11 <= n; i++) { const s = L.slice(i, i + 11).map(Number).join(''); if (s === '10111010000' || s === '00001011101') p += 40; } }
  for (let y = 0; y < n - 1; y++) for (let x = 0; x < n - 1; x++) { const c = m[y][x]; if (c === m[y][x + 1] && c === m[y + 1][x] && c === m[y + 1][x + 1]) p += 3; }
  for (const r of m) for (const c of r) if (c) dark++;
  return p + (Math.ceil(Math.abs(dark * 20 - n * n * 10) / (n * n)) - 1) * 10;
}
// encode : texte -> {modules, version, mask, ecl, used, cap}
function encode(text, eclName, forceMask = -1) {
  const bytes = [...new TextEncoder().encode(text)], e = ECL[eclName][0];
  let v = 1; for (; v <= 40; v++) { const need = 4 + (v < 10 ? 8 : 16) + bytes.length * 8; if (need <= dataCodewords(v, e) * 8) break; }
  if (v > 40) return null;
  const bits = [], put = (val, len) => { for (let i = len - 1; i >= 0; i--) bits.push(val >>> i & 1); };
  put(4, 4); put(bytes.length, v < 10 ? 8 : 16); bytes.forEach(b => put(b, 8));
  const cap = dataCodewords(v, e) * 8; put(0, Math.min(4, cap - bits.length)); put(0, (8 - bits.length % 8) % 8);
  const data = []; for (let i = 0; i < bits.length; i += 8) data.push(parseInt(bits.slice(i, i + 8).join(''), 2));
  for (let pad = 0xec; data.length < cap / 8; pad ^= 0xec ^ 0x11) data.push(pad);
  const {nb, ecc, nShort, shortLen} = blocksLayout(v, e), div = rsDivisor(ecc), blocks = []; let k = 0;
  for (let i = 0; i < nb; i++) { const dat = data.slice(k, k + shortLen - ecc + (i < nShort ? 0 : 1)); k += dat.length; const r = rsRemainder(dat, div); if (i < nShort) dat.push(0); blocks.push(dat.concat(r)); }
  const all = []; for (let i = 0; i < blocks[0].length; i++) blocks.forEach((b, j) => { if (i !== shortLen - ecc || j >= nShort) all.push(b[i]); });
  const [base, fn] = functionPatterns(v), size = base.length, order = zigzag(fn);
  order.forEach(([x, y], i) => { base[y][x] = i < all.length * 8 ? (all[i >>> 3] >>> (7 - (i & 7)) & 1) === 1 : false; });
  let best = null;
  for (let mk = 0; mk < 8; mk++) { if (forceMask >= 0 && mk !== forceMask) continue;
    const m = base.map((r, y) => r.map((c, x) => fn[y][x] ? c : c !== MASKS[mk](x, y))); drawFormat(m, fn.map(r => r.slice()), formatBits(eclName, mk), size);
    const p = penalty(m); if (!best || p < best.p) best = {m, p, mask: mk}; }
  return {modules: best.m, version: v, mask: best.mask, ecl: eclName, size, used: bytes.length, cap: dataCodewords(v, e) - (v < 10 ? 2 : 3)};
}
// le petit décodeur de contrôle : relit le format, démasque, désentrelace, vérifie Reed-Solomon et redonne le texte
function decode(m) {
  const size = m.length, v = (size - 17) / 4, rd = (x, y) => m[y][x] ? 1 : 0;
  let fb = 0; const pos = []; for (let i = 0; i <= 5; i++) pos.push([8, i]); pos.push([8, 7], [8, 8], [7, 8]); for (let i = 9; i < 15; i++) pos.push([14 - i, 8]);
  pos.forEach(([x, y], i) => fb |= rd(x, y) << i);
  const found = Object.keys(ECL).flatMap(e => [0, 1, 2, 3, 4, 5, 6, 7].map(mk => [e, mk])).find(([e, mk]) => formatBits(e, mk) === fb);
  if (!found) throw new Error('format illisible');
  const [ecl, mk] = found, e = ECL[ecl][0], [, fn] = functionPatterns(v), order = zigzag(fn);
  const raw = Math.floor(rawModules(v) / 8), cw = Array(raw).fill(0);
  order.forEach(([x, y], i) => { if (i < raw * 8 && (m[y][x] !== MASKS[mk](x, y))) cw[i >>> 3] |= 1 << (7 - (i & 7)); });
  const {nb, ecc, nShort, shortLen} = blocksLayout(v, e), blocks = Array.from({length: nb}, (_, j) => []); let k = 0;
  for (let i = 0; i < shortLen + 1; i++) for (let j = 0; j < nb; j++) { if (i === shortLen - ecc && j < nShort) continue; if (k < raw) blocks[j].push(cw[k++]); }
  const div = rsDivisor(ecc), data = [];
  for (const b of blocks) { const d = b.slice(0, b.length - ecc), r = b.slice(b.length - ecc); if (rsRemainder(d, div).join() !== r.join()) throw new Error('Reed-Solomon faux'); data.push(...d); }
  const bit = i => data[i >>> 3] >>> (7 - (i & 7)) & 1, num = (at, len) => { let r = 0; for (let i = 0; i < len; i++) r = r << 1 | bit(at + i); return r; };
  if (num(0, 4) !== 4) throw new Error('mode inconnu');
  const cl = v < 10 ? 8 : 16, n = num(4, cl), out = []; for (let i = 0; i < n; i++) out.push(num(4 + cl + i * 8, 8));
  return {text: new TextDecoder().decode(new Uint8Array(out)), ecl, mask: mk};
}
// ---------- les contenus ----------
const esc = s => s.replace(/([\\;,:"])/g, '\\$1');
const TYPES = {
  text: ['Texte', [['text', 'Texte', 'area']], f => f.text],
  url: ['Lien', [['url', 'Adresse', 'https://…']], f => f.url && !/^[a-z][a-z0-9+.-]*:/i.test(f.url) ? 'https://' + f.url : f.url],
  wifi: ['Wi-Fi', [['ssid', 'Nom du réseau'], ['pass', 'Mot de passe', 'password'], ['sec', 'Sécurité', ['WPA', 'WEP', 'nopass']], ['hidden', 'Réseau caché', 'check']],
    f => `WIFI:T:${f.sec || 'WPA'};S:${esc(f.ssid || '')};${f.sec === 'nopass' ? '' : 'P:' + esc(f.pass || '') + ';'}${f.hidden ? 'H:true;' : ''};`],
  contact: ['Contact', [['name', 'Nom'], ['tel', 'Téléphone'], ['email', 'E-mail'], ['org', 'Entreprise'], ['web', 'Site']],
    f => ['BEGIN:VCARD', 'VERSION:3.0', 'FN:' + (f.name || ''), f.org && 'ORG:' + f.org, f.tel && 'TEL:' + f.tel, f.email && 'EMAIL:' + f.email, f.web && 'URL:' + f.web, 'END:VCARD'].filter(Boolean).join('\n')],
  mail: ['E-mail', [['to', 'Destinataire'], ['subject', 'Objet'], ['body', 'Message', 'area']], f => 'mailto:' + (f.to || '') + '?' + new URLSearchParams(Object.entries({subject: f.subject || '', body: f.body || ''}).filter(([, v]) => v)).toString().replace(/\+/g, '%20')],
  sms: ['SMS', [['tel', 'Numéro'], ['body', 'Message', 'area']], f => 'SMSTO:' + (f.tel || '') + ':' + (f.body || '')],
  geo: ['Position', [['lat', 'Latitude', '48.8584'], ['lon', 'Longitude', '2.2945']], f => 'geo:' + (f.lat || 0) + ',' + (f.lon || 0)],
};
const PALETTE = ['#000000', '#1a1430', '#3a2a5a', '#7a2a6a', '#ff4fb0', '#2a6a3a', '#1a4a7a', '#7a4a1a', '#ffffff', '#fff6e0', '#e8e0ff', '#d0f0e0'];
const lum = h => { const c = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255).map(v => v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4); return .2126 * c[0] + .7152 * c[1] + .0722 * c[2]; };
export default async function (ctx) {
  const view = ctx.view;
  if (!ctx.host) { view.textContent = "Ce plugin doit être approuvé par NeoDex pour s'ouvrir."; return; }
  const { el, toast } = ctx.host;
  ctx.host.addStyle(CSS);
  // vérification : les capacités connues de la norme, et l'aller-retour encode -> décode sur plusieurs tailles, niveaux et masques
  { console.assert(dataCodewords(1, 0) === 19 && dataCodewords(1, 3) === 9 && dataCodewords(10, 1) === 216 && dataCodewords(40, 0) === 2956 && dataCodewords(40, 3) === 1276 && rawModules(40) === 29648, 'qraft : capacités');
    const tests = [['Bonjour !', 'M', -1], ['https://neodex.app/é', 'L', 3], ['x'.repeat(300), 'H', -1], ['WIFI:T:WPA;S:Maison;P:abc;;', 'Q', 6], ['∑ '.repeat(500), 'L', -1]];
    console.assert(tests.every(([t, e, mk]) => { const q = encode(t, e, mk), d = decode(q.modules); return d.text === t && d.ecl === e && (mk < 0 || d.mask === mk); }), 'qraft : aller-retour'); }
  let data = null; try { data = await ctx.folder.read('qraft'); } catch {}
  const st = {type: data?.type || 'url', fields: data?.fields || {url: 'https://github.com/NDesumeur'}, ecl: data?.ecl || 'M', fg: data?.fg || '#000000', bg: data?.bg || '#ffffff', margin: data?.margin ?? 4, scale: data?.scale || 8, recent: data?.recent || []};
  let saveT = 0; const save = () => { clearTimeout(saveT); saveT = setTimeout(() => { const f = {...st.fields}; delete f.pass; ctx.folder.write('qraft', {...st, fields: f}).catch(() => {}); }, 500); };  // le mot de passe Wi-Fi n'est jamais enregistré
  // ---------- l'interface ----------
  view.innerHTML = '';
  const wrap = el('div', 'appWrap'), head = el('div', 'agHead'), lay = el('div', 'qrGrid'), left = el('div', 'sysCard px'), right = el('div', 'sysCard px');
  head.append(el('span', 'label', 'Qraft · QR codes')); lay.append(left, right); wrap.append(head, lay); view.append(wrap);
  const types = el('div', 'qrTypes'), form = el('div'), opts = el('div'), recentBox = el('div', 'qrRecent');
  left.append(el('span', 'label', 'Contenu'), types, form, el('span', 'label', 'Réglages'), opts, el('span', 'label', 'Récents'), recentBox);
  const can = el('canvas', 'qrCan'), g = can.getContext('2d'), info = el('div', 'qrInfo'), warn = el('div', 'qrWarn'), exp = el('div', 'qrRow');
  can.id = 'qr_canvas'; info.id = 'qr_info';
  const png = el('button', 'btn px main', 'PNG'), svg = el('button', 'btn px', 'SVG'), cp = el('button', 'btn px', 'Copier l\'image'), keep = el('button', 'btn px', '★ Garder');
  exp.append(png, svg, cp, keep); right.append(can, warn, info, exp);
  let cur = null, payload = '';
  function drawTypes() { types.replaceChildren(...Object.entries(TYPES).map(([k, [t]]) => { const b = el('button', 'btn px' + (st.type === k ? ' main' : ''), t); b.dataset.type = k; b.onclick = () => { st.type = k; save(); drawTypes(); drawForm(); render(); }; return b; })); }
  function drawForm() {
    form.replaceChildren();
    for (const [k, label, kind] of TYPES[st.type][1]) {
      const box = el('div', 'qrField'); box.append(el('span', 'hint', label));
      let inp;
      if (kind === 'area') { inp = el('textarea', 'f'); inp.rows = 4; }
      else if (Array.isArray(kind)) { inp = el('select', 'f'); for (const o of kind) { const op = el('option', '', o === 'nopass' ? 'Aucune' : o); op.value = o; inp.append(op); } }
      else if (kind === 'check') { inp = el('input'); inp.type = 'checkbox'; inp.checked = !!st.fields[k]; inp.onchange = () => { st.fields[k] = inp.checked; save(); render(); }; box.append(inp); form.append(box); continue; }
      else { inp = el('input', 'f'); inp.type = kind === 'password' ? 'password' : 'text'; if (kind && kind !== 'password') inp.placeholder = kind; }
      inp.value = st.fields[k] ?? (Array.isArray(kind) ? kind[0] : ''); inp.dataset.field = k; inp.translate = false;
      inp.oninput = inp.onchange = () => { st.fields[k] = inp.value; save(); render(); };
      box.append(inp); form.append(box);
    }
    if (st.type === 'wifi') form.append(el('p', 'hint', 'Le mot de passe sert au QR code mais n\'est jamais enregistré.'));
  }
  function drawOpts() {
    opts.replaceChildren();
    const r1 = el('div', 'qrRow'); r1.append(el('span', 'hint', 'Correction'));
    for (const [k, t] of [['L', 'L · 7 %'], ['M', 'M · 15 %'], ['Q', 'Q · 25 %'], ['H', 'H · 30 %']]) { const b = el('button', 'btn px' + (st.ecl === k ? ' main' : ''), t); b.dataset.ecl = k; b.title = 'Part du code qui peut être abîmée sans gêner la lecture'; b.onclick = () => { st.ecl = k; save(); drawOpts(); render(); }; r1.append(b); }
    const sw = (key, label) => { const r = el('div', 'qrRow'); r.append(el('span', 'hint', label)); for (const c of PALETTE) { const b = el('button', 'qrSw' + (st[key] === c ? ' on' : '')); b.style.background = c; b.title = c; b.onclick = () => { st[key] = c; save(); drawOpts(); render(); }; r.append(b); }
      const pick = el('input'); pick.type = 'color'; pick.value = st[key]; pick.title = 'Autre couleur'; pick.oninput = () => { st[key] = pick.value; save(); render(); }; pick.onchange = drawOpts; r.append(pick); return r; };
    const r4 = el('div', 'qrRow'), mg = el('select', 'f'), sc = el('select', 'f');
    for (const v of [0, 1, 2, 4, 6, 8]) { const o = el('option', '', String(v)); o.value = v; o.selected = v === st.margin; mg.append(o); }
    for (const v of [4, 6, 8, 10, 12, 16, 20]) { const o = el('option', '', v + ' px'); o.value = v; o.selected = v === st.scale; sc.append(o); }
    mg.onchange = () => { st.margin = +mg.value; save(); render(); }; sc.onchange = () => { st.scale = +sc.value; save(); render(); };
    r4.append(el('span', 'hint', 'Marge (modules)'), mg, el('span', 'hint', 'Taille d\'un module'), sc);
    opts.append(r1, sw('fg', 'Encre'), sw('bg', 'Fond'), r4);
  }
  function drawRecent() {
    recentBox.replaceChildren(...(st.recent.length ? st.recent.map(r => { const b = el('button', 'btn px', r.p.replace(/\n/g, ' · ')); b.translate = false; b.title = r.p; b.onclick = () => { st.type = r.type; st.fields = {...r.fields}; save(); drawTypes(); drawForm(); render(); }; return b; }) : [el('p', 'hint', '★ Garder ajoute le QR code ici (sauf le Wi-Fi, pour ne pas garder le mot de passe).')]));
  }
  function render() {
    payload = TYPES[st.type][2](st.fields) || '';
    cur = payload ? encode(payload, st.ecl) : null;
    const total = cur ? cur.size + 2 * st.margin : 21, px = cur ? total * st.scale : 210;
    can.width = px; can.height = px; g.fillStyle = st.bg; g.fillRect(0, 0, px, px);
    warn.textContent = '';
    if (!payload) { info.replaceChildren(el('span', '', 'Écris quelque chose pour fabriquer le QR code.')); return; }
    if (!cur) { info.replaceChildren(el('span', '', 'Trop long pour un QR code : 2953 octets au plus (niveau L).')); return; }
    g.fillStyle = st.fg; cur.modules.forEach((r, y) => r.forEach((c, x) => { if (c) g.fillRect((x + st.margin) * st.scale, (y + st.margin) * st.scale, st.scale, st.scale); }));
    const L1 = lum(st.fg), L2 = lum(st.bg), ratio = (Math.max(L1, L2) + .05) / (Math.min(L1, L2) + .05);
    if (L1 > L2) warn.textContent = 'Encre plus claire que le fond : beaucoup de lecteurs ne liront pas ce code.';
    else if (ratio < 4) warn.textContent = 'Peu de contraste entre l\'encre et le fond : la lecture risque d\'échouer.';
    else if (st.margin < 2) warn.textContent = 'Sans marge, le code est plus dur à lire : garde au moins 2 modules (4 conseillés).';
    const pct = Math.round(cur.used / cur.cap * 100);
    info.replaceChildren(...[['Version', cur.version + ' (' + cur.size + '×' + cur.size + ')'], ['Correction', cur.ecl], ['Masque', cur.mask], ['Contenu', cur.used + ' / ' + cur.cap + ' octets (' + pct + ' %)'], ['Image', px + '×' + px + ' px']].flatMap(([k, v]) => { const b = el('b', '', String(v)); b.translate = false; return [el('span', '', k), ' : ', b, el('br')]; }));
  }
  const fileName = () => 'qrcode-' + (payload.replace(/^[a-z]+:\/*/i, '').replace(/[^a-z0-9]+/gi, '-').slice(0, 30).replace(/^-|-$/g, '') || 'qraft');
  const download = (href, name) => { const a = el('a'); a.href = href; a.download = name; document.body.append(a); a.click(); a.remove(); };
  png.onclick = () => { if (cur) download(can.toDataURL('image/png'), fileName() + '.png'); };
  svg.onclick = () => { if (!cur) return; const n = cur.size + 2 * st.margin; let d = ''; cur.modules.forEach((r, y) => r.forEach((c, x) => { if (c) d += `M${x + st.margin} ${y + st.margin}h1v1h-1z`; }));
    const s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n}" width="${n * st.scale}" height="${n * st.scale}" shape-rendering="crispEdges"><rect width="${n}" height="${n}" fill="${st.bg}"/><path fill="${st.fg}" d="${d}"/></svg>`;
    download(URL.createObjectURL(new Blob([s], {type: 'image/svg+xml'})), fileName() + '.svg'); };
  cp.onclick = () => { if (!cur) return; can.toBlob(b => navigator.clipboard.write([new ClipboardItem({'image/png': b})]).then(() => toast('Image copiée'), () => toast('Copie impossible'))); };
  keep.onclick = () => { if (!cur) return; if (st.type === 'wifi') { toast('Le Wi-Fi n\'est pas gardé (mot de passe)'); return; } st.recent = [{type: st.type, fields: {...st.fields}, p: payload}, ...st.recent.filter(r => r.p !== payload)].slice(0, 10); save(); drawRecent(); toast('Gardé dans les récents'); };
  drawTypes(); drawForm(); drawOpts(); drawRecent(); render();
}
