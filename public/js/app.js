/* ═══════════════════════════════════════════════════════
   VAULT — File Storage
   app.js — UI rendering, hero, event handlers, clock
═══════════════════════════════════════════════════════ */

// ── Toast notification ───────────────────────────────────
function toast(msg, type = 'inf') {
  const t = document.createElement('div');
  t.className  = `toast-item toast-${type}`;
  t.textContent = msg;
  document.getElementById('toast').appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

// ── Storage stats UI ─────────────────────────────────────

/** Update storage bar & label dari data yang dikembalikan server */
function updateStatsFromServer(storage) {
  if (!storage) return;
  storageData = storage;

  document.getElementById('sinf').textContent =
    storage.usedLabel + ' / ' + storage.limitLabel +
    ' (' + storage.percentUsed + '%)';
  document.getElementById('barf').style.width =
    Math.min(storage.percentUsed, 100) + '%';

  // Warna bar: biru → kuning (>70%) → merah (>90%)
  const bar = document.getElementById('barf');
  if      (storage.percentUsed >= 90) bar.style.background = 'linear-gradient(90deg,#cc0000,#ff3366)';
  else if (storage.percentUsed >= 70) bar.style.background = 'linear-gradient(90deg,#cc7700,#ffb800)';
  else                                bar.style.background = 'linear-gradient(90deg,#00c4cc,#00f5ff)';

  // Blokir/unblokir area upload saat kapasitas penuh
  const btn = document.querySelector('.btn-up');
  const dze = document.getElementById('dz');
  if (storage.isFull) {
    btn.textContent      = 'KAPASITAS PENUH';
    btn.disabled         = true;
    btn.style.opacity    = '0.4';
    btn.style.cursor     = 'not-allowed';
    dze.style.opacity    = '0.5';
    dze.style.pointerEvents = 'none';
  } else {
    btn.textContent      = 'Pilih File';
    btn.disabled         = false;
    btn.style.opacity    = '';
    btn.style.cursor     = '';
    dze.style.opacity    = '';
    dze.style.pointerEvents = '';
  }
}

/** Update counter stat cards (total, images, docs, other) */
function updateStats() {
  document.getElementById('st').textContent = files.length;
  document.getElementById('si').textContent = files.filter(f => f.type === 'image').length;
  document.getElementById('sd').textContent = files.filter(f => f.type === 'doc').length;
  document.getElementById('so').textContent = files.filter(f => !['image','doc'].includes(f.type)).length;
  if (storageData) updateStatsFromServer(storageData);
}

// ── Toolbar controls ─────────────────────────────────────

/** Set filter aktif */
function sf(btn) {
  document.querySelectorAll('.flt').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  filter = btn.dataset.f;
  render();
}

/** Toggle tampilan grid / list */
function sv(v) {
  vm = v;
  document.getElementById('vtg').classList.toggle('active', v === 'grid');
  document.getElementById('vtl').classList.toggle('active', v === 'list');
  render();
}

/** Toggle pilih satu file */
function ts(id) {
  if (sel.has(id)) sel.delete(id);
  else             sel.add(id);
  render();
}

/** Batalkan semua pilihan */
function clrSel() {
  sel.clear();
  render();
}

// ── Render file list ─────────────────────────────────────
function render() {
  const query    = document.getElementById('srch').value.toLowerCase();
  const filtered = files.filter(f =>
    f.name.toLowerCase().includes(query) &&
    (filter === 'all' || f.type === filter)
  );

  // Action bar
  document.getElementById('abar').style.display = sel.size > 0 ? 'flex' : 'none';
  document.getElementById('abarc').textContent  = sel.size + ' FILES SELECTED';

  const container = document.getElementById('fc');

  if (!filtered.length) {
    container.innerHTML = `<div class="empty">${
      files.length
        ? '// TIDAK ADA FILE YANG COCOK'
        : '// BELUM ADA FILE — UNGGAH FILE PERTAMA KAMU'
    }</div>`;
    return;
  }

  if (vm === 'grid') {
    container.innerHTML = '';
    const grid = document.createElement('div');
    grid.className = 'fgrid';

    filtered.forEach((f, i) => {
      const card = document.createElement('div');
      card.className        = 'fc' + (sel.has(f.id) ? ' sel' : '');
      card.style.animationDelay = (i * 0.04) + 's';

      const preview = f.type === 'image'
        ? `<div class="fthumb"><img src="${API}/preview/${f.id}" loading="lazy"></div>`
        : `<div class="fiw">${ICONS[f.type] || '📁'}</div>`;

      card.innerHTML = preview
        + `<div class="fn">${f.name}</div>`
        + `<div class="fm">${formatSize(f.size)}</div>`
        + `<span class="ftb ${BC[f.type] || 'bo'}">${f.type}</span>`
        + `<div class="sel-ind" onclick="event.stopPropagation();ts('${f.id}')">`
        +   (sel.has(f.id) ? '✓' : '')
        + `</div>`;

      card.ondblclick = () => downloadFile(f.id);
      card.onclick    = () => ts(f.id);
      grid.appendChild(card);
    });

    container.appendChild(grid);

  } else {
    container.innerHTML = '';
    const list = document.createElement('div');
    list.className = 'flist';

    filtered.forEach((f, i) => {
      const row = document.createElement('div');
      row.className        = 'fr' + (sel.has(f.id) ? ' sel' : '');
      row.style.animationDelay = (i * 0.03) + 's';

      row.innerHTML =
        `<span class="ri">${ICONS[f.type] || '📁'}</span>` +
        `<div class="ri2">` +
          `<div class="rn">${f.name}</div>` +
          `<div class="rm">${f.type.toUpperCase()} · ${formatDate(f.uploadedAt)}</div>` +
        `</div>` +
        `<span class="rs">${formatSize(f.size)}</span>` +
        `<div class="rsel">${sel.has(f.id) ? '✓' : ''}</div>`;

      row.ondblclick = () => downloadFile(f.id);
      row.onclick    = () => ts(f.id);
      list.appendChild(row);
    });

    container.appendChild(list);
  }
}

// ── Drag & Drop ──────────────────────────────────────────
const dze = document.getElementById('dz');
dze.addEventListener('dragover',  e => { e.preventDefault(); dze.classList.add('drag'); });
dze.addEventListener('dragleave', () => dze.classList.remove('drag'));
dze.addEventListener('drop',      e => { e.preventDefault(); dze.classList.remove('drag'); handleFiles(e.dataTransfer.files); });

// ── Hero / Intro ─────────────────────────────────────────
// Muncul otomatis setiap tab baru dibuka (sessionStorage).
// Tombol "// Home" di header bisa memunculkannya kembali.

/** Masuk ke dashboard — tandai hero sudah dilihat */
function enterApp() {
  const hero    = document.getElementById('hero');
  const mainApp = document.getElementById('main-app');
  sessionStorage.setItem('vault_hero_seen', '1');
  hero.classList.remove('reshow');
  hero.classList.add('exit');
  setTimeout(() => {
    hero.style.display = 'none';
    mainApp.classList.add('visible');
  }, 820);
}

/** Tampilkan hero kembali dari tombol header */
function showHero() {
  const hero    = document.getElementById('hero');
  const mainApp = document.getElementById('main-app');
  const content = hero.querySelector('.hero-content');
  // Reset animasi konten agar bisa diputar ulang
  if (content) {
    content.style.animation = 'none';
    void content.offsetWidth; // trigger reflow
    content.style.animation = '';
  }
  mainApp.classList.remove('visible');
  hero.classList.remove('exit');
  hero.classList.add('reshow');
  hero.style.display = 'flex';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Auto-skip hero jika sudah dilihat di sesi ini
if (sessionStorage.getItem('vault_hero_seen')) {
  document.getElementById('hero').style.display = 'none';
  document.getElementById('main-app').classList.add('visible');
}

// Scroll untuk masuk ke dashboard
document.addEventListener('wheel', function onWheel() {
  const hero = document.getElementById('hero');
  if (hero.style.display !== 'none' && !hero.classList.contains('exit')) {
    enterApp();
    document.removeEventListener('wheel', onWheel);
  }
}, { passive: true });

// Tekan tombol keyboard untuk masuk ke dashboard
document.addEventListener('keydown', function onKey() {
  const hero = document.getElementById('hero');
  if (hero.style.display !== 'none' && !hero.classList.contains('exit')) {
    enterApp();
    document.removeEventListener('keydown', onKey);
  }
});

// ── Jam digital realtime ─────────────────────────────────
function tick() {
  const n = new Date();
  document.getElementById('clk').textContent =
    String(n.getHours()).padStart(2, '0')   + ':' +
    String(n.getMinutes()).padStart(2, '0') + ':' +
    String(n.getSeconds()).padStart(2, '0');
}
tick();
setInterval(tick, 1000);

// ── Init ─────────────────────────────────────────────────
loadFiles();
