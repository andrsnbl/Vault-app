/* ═══════════════════════════════════════════════════════
   VAULT — File Storage
   config.js — Konstanta & state global aplikasi
═══════════════════════════════════════════════════════ */

// ── URL backend API ──────────────────────────────────────
const API = 'http://localhost:3000/api';

// ── State aplikasi ───────────────────────────────────────
let files       = [];       // daftar file dari server
let filter      = 'all';    // filter aktif
let vm          = 'grid';   // tampilan: 'grid' | 'list'
let sel         = new Set(); // ID file yang dipilih
let storageData = null;     // data kapasitas dari server

// ── Peta ikon per tipe file ──────────────────────────────
const ICONS = {
  image:   '🖼',
  video:   '🎬',
  audio:   '🎵',
  doc:     '📄',
  archive: '🗜',
  other:   '📁',
};

// ── Kelas CSS badge per tipe file ───────────────────────
const BC = {
  image:   'bi',
  video:   'bv',
  audio:   'ba',
  doc:     'bd',
  archive: 'bz',
  other:   'bo',
};
