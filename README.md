# VAULT — File Storage App
## Panduan Setup Lengkap dari Nol

---

## Struktur Folder

```
vault-app/
├── package.json          ← konfigurasi npm
├── server/
│   └── server.js         ← backend Node.js + Express
├── public/
│   └── index.html        ← frontend (UI futuristik)
└── uploads/              ← folder otomatis dibuat saat server jalan
    └── (file-file tersimpan di sini)
```

---

## Langkah 1 — Install Node.js

Cek apakah Node.js sudah terpasang:
```bash
node -v
npm -v
```

Jika belum terinstall, unduh dari: https://nodejs.org
Pilih versi **LTS** (contoh: v20.x.x), lalu install.

---

## Langkah 2 — Install dependensi project

Buka terminal di folder `vault-app/`, lalu jalankan:
```bash
npm install
```

Ini akan mengunduh:
- **express**  — framework web server
- **multer**   — middleware untuk handle upload file
- **cors**     — izinkan request dari browser
- **nodemon**  — auto-restart server saat kode diubah (development)

---

## Langkah 3 — Jalankan server

```bash
# Mode production
npm start

# Mode development (auto-restart saat ada perubahan kode)
npm run dev
```

Server akan berjalan di: **http://localhost:3000**

---

## Langkah 4 — Buka aplikasi

Buka browser dan akses: **http://localhost:3000**

Tampilan VAULT akan muncul. Sekarang file yang diunggah akan:
- Tersimpan permanen di folder `uploads/`
- Tercatat di file `metadata.json`
- Tetap ada meskipun browser ditutup / di-refresh

---

## API Endpoint (untuk developer)

| Method | Endpoint              | Keterangan                          |
|--------|-----------------------|-------------------------------------|
| GET    | /api/files            | Ambil daftar semua file             |
| POST   | /api/upload           | Upload file (multipart/form-data)   |
| GET    | /api/download/:id     | Unduh file berdasarkan ID           |
| GET    | /api/preview/:id      | Preview file inline di browser      |
| DELETE | /api/files/:id        | Hapus satu file                     |
| DELETE | /api/files            | Hapus banyak file (body: {ids:[]})  |
| GET    | /api/stats            | Statistik storage                   |

---

## Konfigurasi

Edit `server/server.js` untuk mengubah:

```javascript
// Ubah port server (default: 3000)
const PORT = process.env.PORT || 3000;

// Ubah batas ukuran file (default: 100 MB)
limits: { fileSize: 100 * 1024 * 1024 }

// Ubah batas jumlah file per upload (default: 50)
upload.array('files', 50)
```

---

## Deploy ke Server / VPS

Jika ingin diakses dari internet (bukan hanya localhost):

### Menggunakan PM2 (process manager)
```bash
npm install -g pm2
pm2 start server/server.js --name vault
pm2 startup   # agar otomatis jalan saat server restart
pm2 save
```

### Ubah URL API di frontend
Edit baris ini di `public/index.html`:
```javascript
// Ganti dengan URL server kamu
const API = 'https://domainmu.com/api';
// atau IP server:
const API = 'http://123.456.789.0:3000/api';
```

---

## Keamanan (opsional, untuk production)

Tambahkan fitur berikut di `server.js` jika diperlukan:

```javascript
// 1. Batasi tipe file yang boleh diupload
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg','image/png','application/pdf'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Tipe file tidak diizinkan'));
  }
});

// 2. Tambah autentikasi sederhana
app.use((req, res, next) => {
  const token = req.headers['x-api-key'];
  if (token !== 'rahasia123') return res.status(401).json({ error: 'Unauthorized' });
  next();
});
```

---

## Troubleshooting

| Masalah | Solusi |
|---------|--------|
| "Cannot connect to server" | Pastikan `npm start` sudah dijalankan |
| Port 3000 sudah dipakai | Ganti `PORT = 3001` di server.js |
| File tidak tersimpan | Cek folder `uploads/` ada dan bisa ditulis |
| Upload gagal > 100MB | Naikkan `fileSize` di konfigurasi multer |
