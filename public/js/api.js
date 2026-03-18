/* ═══════════════════════════════════════════════════════
   VAULT — File Storage
   api.js — Semua komunikasi ke backend server
═══════════════════════════════════════════════════════ */

// ── Format helpers ───────────────────────────────────────

/** Ubah bytes ke string yang mudah dibaca (KB / MB) */
function formatSize(bytes) {
  if (bytes < 1024)       return bytes + 'B';
  if (bytes < 1048576)    return (bytes / 1024).toFixed(1) + 'KB';
  return (bytes / 1048576).toFixed(2) + 'MB';
}

/** Format tanggal ISO ke format lokal Indonesia */
function formatDate(isoString) {
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric'
  }).format(new Date(isoString));
}

/** Deteksi tipe file di sisi client (sebelum upload) */
function detectTypeClient(mime, name) {
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  const ext = name.split('.').pop().toLowerCase();
  if (['pdf','doc','docx','xls','xlsx','ppt','pptx','txt','csv'].includes(ext)) return 'doc';
  if (['zip','rar','7z','tar','gz'].includes(ext)) return 'archive';
  return 'other';
}

// ── API: Load semua file & stats ─────────────────────────
async function loadFiles() {
  document.getElementById('fc').innerHTML = '<div class="spinner"></div>';
  try {
    const [rFiles, rStats] = await Promise.all([
      fetch(`${API}/files`),
      fetch(`${API}/stats`),
    ]);
    const dFiles = await rFiles.json();
    const dStats = await rStats.json();
    files = dFiles.files || [];
    if (dStats.storage) updateStatsFromServer(dStats.storage);
    updateStats();
    render();
  } catch {
    toast('Gagal terhubung ke server. Pastikan server berjalan di port 3000.', 'err');
    document.getElementById('fc').innerHTML =
      '<div class="empty">// SERVER TIDAK DITEMUKAN — jalankan: npm start</div>';
  }
}

// ── API: Upload file ─────────────────────────────────────
async function handleFiles(fileList) {
  // Cek kapasitas di sisi client sebelum kirim
  if (storageData && storageData.isFull) {
    toast('Kapasitas penuh! Hapus beberapa file terlebih dahulu.', 'err');
    return;
  }

  const q = document.getElementById('upq');
  q.style.display = 'block';

  for (let i = 0; i < fileList.length; i++) {
    const f = fileList[i];

    // Cek ukuran file sebelum kirim
    if (storageData && f.size > storageData.remaining) {
      toast(`${f.name} ditolak — melebihi sisa kapasitas (${formatSize(storageData.remaining)})`, 'err');
      continue;
    }

    const tmpId = 'tmp-' + Date.now() + i;
    const icon  = ICONS[detectTypeClient(f.type, f.name)];

    // Buat item progress bar
    const div = document.createElement('div');
    div.className = 'up-item';
    div.id = 'up-' + tmpId;
    div.innerHTML =
      `<span class="up-ico">${icon}</span>` +
      `<div class="up-info">` +
        `<div class="up-name">${f.name}</div>` +
        `<div class="up-st" id="us-${tmpId}">UPLOADING...</div>` +
        `<div class="up-bar"><div class="up-fill" id="pf-${tmpId}" style="width:0%"></div></div>` +
      `</div>`;
    q.appendChild(div);

    // Animasi progress simulasi
    let pct = 0;
    const iv = setInterval(() => {
      pct = Math.min(pct + Math.random() * 20 + 8, 90);
      const el = document.getElementById('pf-' + tmpId);
      if (el) el.style.width = Math.round(pct) + '%';
    }, 80);

    // Kirim ke server
    const formData = new FormData();
    formData.append('files', f);
    try {
      const r = await fetch(`${API}/upload`, { method: 'POST', body: formData });
      const d = await r.json();
      clearInterval(iv);

      const pfEl = document.getElementById('pf-' + tmpId);
      const usEl = document.getElementById('us-' + tmpId);

      // Update info kapasitas dari response server
      if (d.storage) updateStatsFromServer(d.storage);

      if (d.success && d.files.length > 0) {
        files.push(...d.files);
        if (pfEl) pfEl.style.width = '100%';
        if (usEl) usEl.textContent = 'COMPLETE';
        updateStats();
        render();
        toast(`${f.name} berhasil diunggah`, 'ok');
      } else if (d.skipped && d.skipped.length > 0) {
        if (pfEl) pfEl.style.width = '100%';
        if (usEl) { usEl.textContent = 'DITOLAK'; usEl.style.color = '#ff3366'; }
        toast(`${f.name} ditolak: ${d.skipped[0].reason}`, 'err');
      } else {
        if (usEl) { usEl.textContent = 'GAGAL'; usEl.style.color = '#ff3366'; }
        toast(`Gagal upload: ${d.message || f.name}`, 'err');
      }
    } catch {
      clearInterval(iv);
      toast(`Error upload: ${f.name}`, 'err');
    }

    // Hapus item progress setelah selesai
    setTimeout(() => {
      const el = document.getElementById('up-' + tmpId);
      if (el) el.remove();
      if (!q.children.length) q.style.display = 'none';
    }, 800);
  }

  document.getElementById('fi').value = '';
}

// ── API: Download file ───────────────────────────────────
function downloadFile(id) {
  window.open(`${API}/download/${id}`, '_blank');
}

/** Download semua file yang dipilih */
async function dlSel() {
  sel.forEach(id => downloadFile(id));
  toast(`Mengunduh ${sel.size} file...`, 'inf');
}

// ── API: Hapus file ──────────────────────────────────────
async function delSel() {
  if (!confirm(`Hapus ${sel.size} file? Tindakan ini tidak bisa dibatalkan.`)) return;
  try {
    const r = await fetch(`${API}/files`, {
      method:  'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ ids: [...sel] }),
    });
    const d = await r.json();
    if (d.success) {
      files = files.filter(f => !sel.has(f.id));
      if (d.storage) updateStatsFromServer(d.storage);
      toast(`${d.deleted} file dihapus.`, 'ok');
      sel.clear();
      updateStats();
      render();
    }
  } catch {
    toast('Gagal menghapus file.', 'err');
  }
}
