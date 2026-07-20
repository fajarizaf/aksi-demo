# Aksi Demo - Peta Sebaran Unjuk Rasa Indonesia

Aplikasi monitoring dan visualisasi data unjuk rasa (demonstrasi) di seluruh provinsi Indonesia. Aplikasi ini menyediakan peta interaktif, dashboard statistik, dan panel admin untuk mengelola data aksi massa.

## Fitur Utama

- **Peta Interaktif** - Peta Indonesia berbasis Leaflet.js dengan penanda berwarna berdasarkan status aksi (Rencana/Berlangsung/Selesai)
- **Clustering Marker** - Pengelompokan otomatis marker pada provinsi dengan banyak aksi
- **Panel Admin** - CRUD data aksi, impor Excel/CSV, input manual
- **Dashboard Grafik** - Visualisasi nilai tukar USD/IDR, harga BBM, dan harga bahan pokok
- **Autentikasi** - Sistem login admin berbasis session cookie
- **Deduplikasi Data** - Pencocokan otomatis saat impor untuk menghindari data ganda

## Tech Stack

| Komponen | Teknologi |
|----------|-----------|
| Backend | Node.js + Express.js v4 |
| Database | Flat-file JSON (`aksi-db.json`) |
| Frontend | Vanilla JavaScript (ES Modules) |
| Peta | Leaflet.js v1.9 + MarkerCluster |
| Grafik | Apache ECharts v5 |
| Impor Data | SheetJS (xlsx) |
| Upload | Multer v2 |

## Struktur Project

```
aksi-demo/
├── server.js              # Server Express utama (API + static files)
├── app.js                 # Frontend peta (public & internal)
├── admin.js               # Frontend panel admin
├── login.js               # Frontend halaman login
├── data-grafik.js         # Frontend dashboard grafik
├── protected-map.js       # Auth guard untuk peta internal
├── index.html             # Halaman peta publik
├── admin.html             # Halaman panel admin
├── login.html             # Halaman login
├── peta-internal.html     # Peta internal (membutuhkan auth)
├── data-grafik.html       # Dashboard grafik & statistik
├── styles.css             # Stylesheet utama
├── aksi-db.json           # Database JSON
├── .env                   # Konfigurasi kredensial admin
└── package.json
```

## Instalasi & Menjalankan

### Prasyarat

- Node.js v18 atau lebih baru
- npm

### Setup

```bash
# Clone repository
git clone <repository-url>
cd aksi-demo

# Install dependencies
npm install

# Konfigurasi environment (opsional, sudah ada default)
cp .env.example .env
# Edit .env sesuai kebutuhan
```

### Menjalankan

```bash
# Development
npm run dev

# Production
npm start
```

Aplikasi akan berjalan di `http://localhost:5174` (atau port yang ditentukan di variabel `PORT`).

## Konfigurasi Environment

Buat file `.env` di root project:

```env
PORT=5174
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
```

## API Endpoints

### Publik (Tanpa Autentikasi)

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| `GET` | `/api/health` | Health check |
| `GET` | `/api/active` | Metadata dataset aktif |
| `GET` | `/api/active/records` | Semua record dataset aktif |
| `GET` | `/api/exchange-rate` | Kurs USD/IDR |
| `GET` | `/api/fuel-prices` | Harga BBM Indonesia |
| `GET` | `/api/sembako-prices` | Harga bahan pokok (PIHPS) |

### Autentikasi Admin

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| `GET` | `/api/admin/auth/session` | Cek status session |
| `POST` | `/api/admin/auth/login` | Login admin |
| `POST` | `/api/admin/auth/logout` | Logout admin |

### Manajemen Data (Membutuhkan Autentikasi)

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| `GET` | `/api/datasets` | Daftar semua dataset |
| `POST` | `/api/datasets/import` | Impor file Excel/CSV |
| `POST` | `/api/datasets/:id/activate` | Aktifkan dataset |
| `PUT` | `/api/datasets/:id` | Rename dataset |
| `DELETE` | `/api/datasets/:id` | Hapus dataset |
| `GET` | `/api/datasets/:id/records` | Record dalam dataset |
| `POST` | `/api/records` | Buat record baru |
| `PUT` | `/api/records/:id` | Update record |
| `DELETE` | `/api/records/:id` | Hapus record |

## Model Data

### Record (Data Aksi)

```json
{
  "id": "uuid",
  "datasetId": "uuid",
  "NO": "1",
  "TANGGAL": "6/17/26",
  "WAKTU MULAI": "09:00",
  "WAKTU SELESAI": "12:00",
  "STATUS": "Selesai",
  "WILAYAH": "DKI JAKARTA",
  "JUMLAH MASSA": 150,
  "LOKASI": "Depan gedung DPR",
  "KELOMPOK AKSI": "Aliansi Mahasiswa",
  "KATEGORI DEMO": "Kontra",
  "TUNTUTAN": "Tolak kenaikan BBM",
  "RINGKASAN": "Aksi damai berlangsung...",
  "HAL MENONJOL": "Tidak ada insiden",
  "GOOGLE MAPS": "https://maps.app.goo.gl/...",
  "LAT": -6.178,
  "LNG": 106.823,
  "createdAt": "2026-06-17T...",
  "updatedAt": "2026-06-17T..."
}
```

### Dataset

```json
{
  "id": "uuid",
  "name": "Data Juni 2026",
  "type": "csv" | "xlsx" | "manual",
  "createdAt": "ISO timestamp",
  "updatedAt": "ISO timestamp",
  "sheetName": "Sheet1",
  "rowCount": 321
}
```

### Status Aksi

| Status | Keterangan | Warna Marker |
|--------|------------|--------------|
| `Rencana` | Aksi yang direncanakan | Kuning |
| `Yang Berlangsung` | Aksi yang sedang berlangsung | Merah |
| `Selesai` | Aksi yang sudah selesai | Hijau |

### Kategori Demo

| Kategori | Keterangan |
|----------|------------|
| `Pro` | Mendukung pemerintah |
| `Kontra` | Menentang pemerintah |

## Sumber Data Eksternal

- **ExchangeRate-API** - Kurs USD/IDR
- **bensin-api** (GitHub) - Harga BBM Pertamina
- **Bank Indonesia PIHPS** - Harga bahan pokok nasional

## Catatan Teknis

- Database menggunakan file JSON flat-file dengan mekanisme atomic rename untuk keamanan crash
- Validasi provinsi menggunakan daftar 38 provinsi Indonesia dengan normalisasi alias
- Link Google Maps pendek (maps.app.goo.gl) akan di-follow redirect untuk mengekstrak koordinat
- Session admin berlaku selama 12 jam
- Import data mendukung deduplikasi berdasarkan kunci (tanggal + wilayah + lokasi + kelompok)
