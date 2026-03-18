const express = require('express');
const multer  = require('multer');
const cors    = require('cors');
const path    = require('path');
const fs      = require('fs');
const crypto  = require('crypto');

const app  = express();
const PORT = process.env.PORT || 3000;

// ─── Konfigurasi Kapasitas ─────────────────────────────────────────────────
//     Ubah nilai ini sesuai kebutuhan:
const STORAGE_LIMIT_BYTES = 1 * 1024 * 1024 * 1024; // 1 GB total
const FILE_SIZE_LIMIT     = 100 * 1024 * 1024;       // 100 MB per file
const MAX_FILES_PER_BATCH = 50;                       // maks file per upload

// ─── Direktori & file metadata ─────────────────────────────────────────────
const UPLOAD_DIR = process.env.UPLOAD_DIR
  || path.join(__dirname, 'uploads');
const META_FILE  = process.env.META_FILE
  || path.join(__dirname, 'uploads', 'metadata.json');

if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// ─── Middleware ────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// ─── Helpers metadata ─────────────────────────────────────────────────────
function readMeta() {
  if (!fs.existsSync(META_FILE)) return [];
  try { return JSON.parse(fs.readFileSync(META_FILE, 'utf8')); }
  catch { return []; }
}
function saveMeta(data) {
  fs.writeFileSync(META_FILE, JSON.stringify(data, null, 2));
}

// ─── Helpers kapasitas ─────────────────────────────────────────────────────

/** Total bytes semua file yang sudah tersimpan */
function getCurrentStorageBytes() {
  return readMeta().reduce((sum, f) => sum + f.size, 0);
}

/** Sisa ruang dalam bytes */
function getRemainingBytes() {
  return Math.max(0, STORAGE_LIMIT_BYTES - getCurrentStorageBytes());
}

/** Format bytes ke string manusia */
function formatBytes(bytes) {
  if (bytes < 1024)                return bytes + ' B';
  if (bytes < 1024 * 1024)         return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1024 * 1024 * 1024)  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
}

/** Buat objek ringkasan storage untuk dikirim ke client */
function storageSummary(usedBytes) {
  const remaining   = Math.max(0, STORAGE_LIMIT_BYTES - usedBytes);
  const percentUsed = parseFloat(((usedBytes / STORAGE_LIMIT_BYTES) * 100).toFixed(2));
  return {
    used:           usedBytes,
    remaining,
    limit:          STORAGE_LIMIT_BYTES,
    usedLabel:      formatBytes(usedBytes),
    remainingLabel: formatBytes(remaining),
    limitLabel:     formatBytes(STORAGE_LIMIT_BYTES),
    percentUsed,
    isFull:         remaining === 0,
  };
}

/**
 * Middleware: tolak request jika Content-Length melebihi sisa kapasitas.
 * Berjalan SEBELUM multer menulis file ke disk — hemat I/O & bandwidth.
 */
function checkStorageMiddleware(req, res, next) {
  const incoming  = parseInt(req.headers['content-length'] || '0', 10);
  const remaining = getRemainingBytes();

  if (incoming > 0 && incoming > remaining) {
    return res.status(507).json({
      success: false,
      code:    'STORAGE_FULL',
      message: `Kapasitas tidak cukup. Tersisa ${formatBytes(remaining)}, ` +
               `file membutuhkan sekitar ${formatBytes(incoming)}.`,
      storage: storageSummary(getCurrentStorageBytes()),
    });
  }
  next();
}

// ─── Konfigurasi Multer ───────────────────────────────────────────────────
const diskStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename:    (req, file, cb) => {
    const ext    = path.extname(file.originalname);
    const unique = crypto.randomUUID() + ext;
    cb(null, unique);
  },
});

const upload = multer({
  storage: diskStorage,
  limits:  { fileSize: FILE_SIZE_LIMIT },
});

// ─── ROUTES ───────────────────────────────────────────────────────────────

// GET /api/files — daftar semua file
app.get('/api/files', (req, res) => {
  const files = readMeta();
  res.json({ success: true, files });
});

// GET /api/stats — statistik lengkap termasuk kapasitas
app.get('/api/stats', (req, res) => {
  const meta = readMeta();
  const used = meta.reduce((a, f) => a + f.size, 0);
  res.json({
    success:    true,
    totalFiles: meta.length,
    images:     meta.filter(f => f.type === 'image').length,
    docs:       meta.filter(f => f.type === 'doc').length,
    videos:     meta.filter(f => f.type === 'video').length,
    archives:   meta.filter(f => f.type === 'archive').length,
    others:     meta.filter(f => !['image','doc','video','archive'].includes(f.type)).length,
    storage:    storageSummary(used),
  });
});

// POST /api/upload — upload file dengan pengecekan kapasitas berlapis
// Layer 1: checkStorageMiddleware  — blok SEBELUM multer (cepat, hemat I/O)
// Layer 2: cek per-file di dalam handler — tepat, tangani upload batch
app.post('/api/upload', checkStorageMiddleware, upload.array('files', MAX_FILES_PER_BATCH), (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ success: false, message: 'Tidak ada file yang dikirim.' });
  }

  const meta    = readMeta();
  const added   = [];
  const skipped = [];
  let   used    = getCurrentStorageBytes();

  req.files.forEach(file => {
    // Layer 2: cek per-file (penting saat upload batch banyak file)
    if (used + file.size > STORAGE_LIMIT_BYTES) {
      // Hapus file yang sudah terlanjur ditulis multer ke disk
      const fp = path.join(UPLOAD_DIR, file.filename);
      if (fs.existsSync(fp)) fs.unlinkSync(fp);
      skipped.push({
        name:   file.originalname,
        size:   file.size,
        reason: `Kapasitas tidak cukup (tersisa ${formatBytes(STORAGE_LIMIT_BYTES - used)})`,
      });
      return;
    }

    const entry = {
      id:         crypto.randomUUID(),
      name:       file.originalname,
      storedName: file.filename,
      size:       file.size,
      mimetype:   file.mimetype,
      type:       detectType(file.mimetype, file.originalname),
      uploadedAt: new Date().toISOString(),
    };
    meta.push(entry);
    added.push(entry);
    used += file.size;
  });

  saveMeta(meta);

  res.json({
    success: true,
    files:   added,
    skipped,                       // file yang ditolak karena kapasitas penuh
    storage: storageSummary(used),
  });
});

// GET /api/download/:id — unduh file
app.get('/api/download/:id', (req, res) => {
  const meta = readMeta();
  const file = meta.find(f => f.id === req.params.id);
  if (!file) return res.status(404).json({ success: false, message: 'File tidak ditemukan.' });

  const filePath = path.join(UPLOAD_DIR, file.storedName);
  if (!fs.existsSync(filePath)) return res.status(404).json({ success: false, message: 'File hilang di server.' });

  res.download(filePath, file.name);
});

// GET /api/preview/:id — preview inline
app.get('/api/preview/:id', (req, res) => {
  const meta = readMeta();
  const file = meta.find(f => f.id === req.params.id);
  if (!file) return res.status(404).json({ success: false, message: 'File tidak ditemukan.' });

  const filePath = path.join(UPLOAD_DIR, file.storedName);
  if (!fs.existsSync(filePath)) return res.status(404).json({ success: false, message: 'File hilang di server.' });

  res.setHeader('Content-Type', file.mimetype);
  res.setHeader('Content-Disposition', `inline; filename="${file.name}"`);
  fs.createReadStream(filePath).pipe(res);
});

// DELETE /api/files/:id — hapus satu file
app.delete('/api/files/:id', (req, res) => {
  let meta = readMeta();
  const file = meta.find(f => f.id === req.params.id);
  if (!file) return res.status(404).json({ success: false, message: 'File tidak ditemukan.' });

  const filePath = path.join(UPLOAD_DIR, file.storedName);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  meta = meta.filter(f => f.id !== req.params.id);
  saveMeta(meta);

  const used = meta.reduce((a, f) => a + f.size, 0);
  res.json({ success: true, message: 'File dihapus.', storage: storageSummary(used) });
});

// DELETE /api/files — hapus banyak file sekaligus
app.delete('/api/files', (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ success: false, message: 'IDs tidak valid.' });
  }

  let meta    = readMeta();
  let deleted = 0;

  ids.forEach(id => {
    const file = meta.find(f => f.id === id);
    if (file) {
      const fp = path.join(UPLOAD_DIR, file.storedName);
      if (fs.existsSync(fp)) fs.unlinkSync(fp);
      deleted++;
    }
  });

  meta = meta.filter(f => !ids.includes(f.id));
  saveMeta(meta);

  const used = meta.reduce((a, f) => a + f.size, 0);
  res.json({ success: true, deleted, storage: storageSummary(used) });
});

// ─── Helper: deteksi tipe file ─────────────────────────────────────────────
function detectType(mime, name) {
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  const ext = path.extname(name).toLowerCase().replace('.', '');
  if (['pdf','doc','docx','xls','xlsx','ppt','pptx','txt','csv','odt','rtf'].includes(ext)) return 'doc';
  if (['zip','rar','7z','tar','gz','bz2'].includes(ext)) return 'archive';
  return 'other';
}

// ─── Error handler global (tangkap error Multer) ───────────────────────────
app.use((err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      success: false,
      code:    'FILE_TOO_LARGE',
      message: `Ukuran file melebihi batas ${formatBytes(FILE_SIZE_LIMIT)} per file.`,
    });
  }
  console.error(err);
  res.status(500).json({ success: false, message: 'Terjadi kesalahan server.' });
});

// ─── Start server ──────────────────────────────────────────────────────────
app.listen(PORT, () => {
  const used = getCurrentStorageBytes();
  console.log(`\n  ██╗   ██╗ █████╗ ██╗   ██╗██╗  ████████╗`);
  console.log(`  ██║   ██║██╔══██╗██║   ██║██║  ╚══██╔══╝`);
  console.log(`  ██║   ██║███████║██║   ██║██║     ██║   `);
  console.log(`  ╚██╗ ██╔╝██╔══██║██║   ██║██║     ██║   `);
  console.log(`   ╚████╔╝ ██║  ██║╚██████╔╝███████╗██║   `);
  console.log(`    ╚═══╝  ╚═╝  ╚═╝ ╚═════╝ ╚══════╝╚═╝   `);
  console.log(`\n  Server      → http://localhost:${PORT}`);
  console.log(`  Upload dir  → ${UPLOAD_DIR}`);
  console.log(`  Kapasitas   → ${formatBytes(STORAGE_LIMIT_BYTES)} total`);
  console.log(`  Terpakai    → ${formatBytes(used)}`);
  console.log(`  Tersisa     → ${formatBytes(getRemainingBytes())}\n`);
});
