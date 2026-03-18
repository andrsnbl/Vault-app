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
      card.onclick    = (e) => { if (!e.target.closest('.sel-ind')) openPreview(f.id); };
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
      row.onclick    = (e) => { if (!e.target.closest('.rsel')) openPreview(f.id); };
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

// ══════════════════════════════════════════════════════
// PREVIEW MODAL
// ══════════════════════════════════════════════════════

let previewList  = [];   // file list yang sedang di-filter (untuk navigasi)
let previewIndex = 0;    // index file yang sedang dibuka

/** Buka preview modal untuk file dengan ID tertentu */
function openPreview(fileId) {
  // Ambil daftar file yang sedang tampil (sesuai filter & search)
  const query = document.getElementById('srch').value.toLowerCase();
  previewList  = files.filter(f =>
    f.name.toLowerCase().includes(query) &&
    (filter === 'all' || f.type === filter)
  );
  previewIndex = previewList.findIndex(f => f.id === fileId);
  if (previewIndex === -1) return;

  const modal = document.getElementById('preview-modal');
  modal.classList.add('open');
  document.body.style.overflow = 'hidden';
  renderPreviewContent();
}

/** Tutup modal */
function closePreview(e) {
  // Jika klik di overlay (bukan di dalam box), tutup
  if (e && e.target !== document.getElementById('preview-modal')) return;
  const modal = document.getElementById('preview-modal');
  modal.classList.remove('open');
  document.body.style.overflow = '';

  // Hentikan media yang sedang diputar
  const video = modal.querySelector('video');
  const audio = modal.querySelector('audio');
  if (video) video.pause();
  if (audio) audio.pause();
}

/** Navigasi prev/next */
function previewNav(dir) {
  const next = previewIndex + dir;
  if (next < 0 || next >= previewList.length) return;
  previewIndex = next;
  renderPreviewContent();
}

/** Render konten di dalam modal sesuai tipe file */
function renderPreviewContent() {
  const f      = previewList[previewIndex];
  const body   = document.getElementById('pm-body');
  const modal  = document.getElementById('preview-modal');

  // Header
  document.getElementById('pm-filename').textContent = f.name;
  document.getElementById('pm-filesize').textContent = formatSize(f.size);
  document.getElementById('pm-type').textContent     = f.type.toUpperCase();

  // Download button
  document.getElementById('pm-dl-btn').onclick = () => downloadFile(f.id);

  // Counter & nav
  document.getElementById('pm-counter').textContent = `${previewIndex + 1} / ${previewList.length}`;
  document.getElementById('pm-prev').disabled = previewIndex === 0;
  document.getElementById('pm-next').disabled = previewIndex === previewList.length - 1;

  // Hentikan media sebelumnya
  const prevVideo = body.querySelector('video');
  const prevAudio = body.querySelector('audio');
  if (prevVideo) prevVideo.pause();
  if (prevAudio) prevAudio.pause();

  // Tampilkan loading
  body.innerHTML = `<div class="pm-loading">
    <div class="pm-spinner"></div>
    <span>LOADING...</span>
  </div>`;

  const src = `${API}/preview/${f.id}`;
  const ext = f.name.split('.').pop().toLowerCase();

  // ── Gambar ──────────────────────────────────────────
  if (f.type === 'image') {
    const img = document.createElement('img');
    img.className = 'pm-image';
    img.alt       = f.name;
    img.onload    = () => { body.innerHTML = ''; body.appendChild(img); };
    img.onerror   = () => renderError(body, f.name);
    img.src       = src;

  // ── PDF ─────────────────────────────────────────────
  } else if (ext === 'pdf') {
    body.innerHTML = `<iframe class="pm-pdf" src="${src}" title="${f.name}"></iframe>`;

  // ── Video ────────────────────────────────────────────
  } else if (f.type === 'video') {
    body.innerHTML = `
      <video class="pm-video" controls autoplay>
        <source src="${src}">
        Browser tidak mendukung preview video.
      </video>`;

  // ── Audio ────────────────────────────────────────────
  } else if (f.type === 'audio') {
    body.innerHTML = `
      <div class="pm-audio-wrap">
        <span class="pm-audio-icon">🎵</span>
        <div class="pm-audio-name">${f.name}</div>
        <audio class="pm-audio" controls autoplay>
          <source src="${src}">
          Browser tidak mendukung preview audio.
        </audio>
      </div>`;

  // ── CSV ─────────────────────────────────────────────
  } else if (ext === 'csv') {
    fetchText(src)
      .then(text => {
        const rows = text.trim().split('\n').map(r => r.split(','));
        if (!rows.length) { renderError(body, f.name); return; }
        const header = rows[0];
        const data   = rows.slice(1);
        let table = `<div class="pm-csv-wrap"><table class="pm-csv-table"><thead><tr>`;
        header.forEach(h => { table += `<th>${escHtml(h.trim())}</th>`; });
        table += `</tr></thead><tbody>`;
        data.forEach(row => {
          table += '<tr>';
          row.forEach(cell => { table += `<td>${escHtml(cell.trim())}</td>`; });
          table += '</tr>';
        });
        table += `</tbody></table></div>`;
        body.innerHTML = table;
      })
      .catch(() => renderError(body, f.name));

  // ── Teks ─────────────────────────────────────────────
  } else if (f.type === 'doc' && ['txt','md','js','json','html','css','xml','yaml','yml','log'].includes(ext)) {
    fetchText(src)
      .then(text => {
        body.innerHTML = '';
        const pre = document.createElement('pre');
        pre.className   = 'pm-text';
        pre.textContent = text;
        body.appendChild(pre);
      })
      .catch(() => renderError(body, f.name));

  // ── Tidak didukung ────────────────────────────────────
  } else {
    body.innerHTML = `
      <div class="pm-unsupported">
        <span class="pm-unsupported-icon">${ICONS[f.type] || '📁'}</span>
        <div class="pm-unsupported-msg">Preview tidak tersedia untuk format ini</div>
        <button class="pm-btn" onclick="downloadFile('${f.id}')">
          <svg viewBox="0 0 24 24" stroke-width="1.5" fill="none">
            <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3"/>
          </svg>
          Download File
        </button>
      </div>`;
  }
}

/** Fetch teks dari URL */
async function fetchText(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error('fetch failed');
  return r.text();
}

/** Render pesan error di body modal */
function renderError(body, name) {
  body.innerHTML = `
    <div class="pm-unsupported">
      <span class="pm-unsupported-icon">⚠️</span>
      <div class="pm-unsupported-msg">Gagal memuat preview — ${escHtml(name)}</div>
    </div>`;
}

/** Escape HTML untuk mencegah XSS */
function escHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}

// Tutup modal dengan tombol Escape
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    const modal = document.getElementById('preview-modal');
    if (modal.classList.contains('open')) {
      modal.classList.remove('open');
      document.body.style.overflow = '';
      const video = modal.querySelector('video');
      const audio = modal.querySelector('audio');
      if (video) video.pause();
      if (audio) audio.pause();
    }
  }
  // Navigasi dengan arrow key saat modal terbuka
  if (document.getElementById('preview-modal').classList.contains('open')) {
    if (e.key === 'ArrowRight') previewNav(1);
    if (e.key === 'ArrowLeft')  previewNav(-1);
  }
});
