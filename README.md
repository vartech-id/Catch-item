# Catch Item Game

Game menangkap benda interaktif yang dibangun dengan Python dan FastAPI. Pemain harus menangkap item yang jatuh ke dalam keranjang untuk mendapatkan skor sebanyak-banyaknya dalam waktu tertentu.

## Daftar Isi
1. [Instalasi](#instalasi)
2. [Cara Menjalankan Aplikasi](#cara-menjalankan-aplikasi)
3. [Struktur Proyek](#struktur-proyek)
4. [Penggantian Aset](#penggantian-aset)
5. [Pengaturan Game](#pengaturan-game)
6. [Alur Game](#alur-game)

## Instalasi

Pastikan Python 3.7+ sudah terinstal di sistem Anda, lalu ikuti langkah berikut:

1. Clone atau unduh proyek ini ke komputer Anda
2. Buat lingkungan virtual:
   ```bash
   python -m venv .venv
   ```
3. Aktifkan lingkungan virtual:
   - Windows:
     ```bash
     .venv\Scripts\activate
     ```
   - Linux/Mac:
     ```bash
     source .venv/bin/activate
     ```
4. Instal dependensi yang diperlukan:
   ```bash
   pip install fastapi==0.115.4 uvicorn jinja2 python-multipart starlette==0.41.3 itsdangerous
   ```

## Cara Menjalankan Aplikasi

1. Dari direktori utama proyek, jalankan:
   ```bash
   python main.py
   ```
   Atau menggunakan uvicorn secara langsung:
   ```bash
   uvicorn main:app --reload
   ```

2. Buka browser dan kunjungi `http://127.0.0.1:8000` untuk memulai permainan

## Struktur Proyek

```
catch-item/
├── main.py                 # File utama untuk menjalankan aplikasi
├── config.json             # Konfigurasi game (aset, tema, gameplay)
├── app/                    # Modul utama aplikasi
│   ├── __init__.py         # Fungsi create_app() untuk membuat instance FastAPI
│   ├── lifespan.py         # Konfigurasi startup/shutdown aplikasi
│   ├── settings.py         # Pengaturan aplikasi
│   ├── routers/            # Route untuk halaman dan API
│   │   ├── pages.py        # Route untuk halaman web
│   │   └── api.py          # Route untuk API game
│   └── services/           # Layanan pendukung
│       ├── scores.py       # Sistem manajemen skor dan leaderboard
│       └── branding.py     # Sistem branding
├── assets/                 # File-file aset (gambar, dll.)
│   ├── backgrounds/        # Gambar latar belakang
│   ├── cart/               # Gambar keranjang
│   ├── items/              # Gambar item yang bisa ditangkap
│   └── logo/               # Gambar logo
├── templates/              # Template HTML untuk halaman web
│   ├── welcome.html        # Halaman selamat datang
│   ├── game.html           # Halaman permainan
│   ├── scoreboard.html     # Halaman papan skor
│   └── base.html           # Template dasar
├── static/                 # File statis (CSS, JS)
└── data/                   # Data aplikasi (database skor)
```

## Penggantian Aset

### Gambar Latar Belakang
- Lokasi: `assets/backgrounds/`
- File yang bisa diganti:
  - `welcome.png` - Latar halaman selamat datang
  - `game.png` - Latar halaman permainan
  - `scoreboard.png` - Latar halaman papan skor
- Timpa file yang ada dengan gambar baru menggunakan nama yang sama, atau ubah path di `config.json`

### Logo
- Lokasi: `assets/logo/`
- File default: `event-logo.png`
- Ganti dengan logo Anda dan sesuaikan path di `config.json`

### Keranjang
- Lokasi: `assets/cart/`
- File default: `cart.png`
- Ganti dengan gambar keranjang Anda dan sesuaikan path di `config.json`

### Item dan Bom
- Lokasi: `assets/items/`
- File yang bisa diganti:
  - `item1.png`, `item2.png`, `item3.png` - Item yang bisa ditangkap
  - `bomb.png` - Item bom (mengurangi skor jika tertangkap)
- Ganti dengan gambar Anda dan sesuaikan konfigurasi di `config.json`

## Pengaturan Game

Semua pengaturan dikonfigurasi melalui `config.json`. Berikut penjelasan tiap bagian:

### Branding
- `backgrounds`: Path gambar latar belakang untuk tiap halaman
- `logo`: Path gambar logo acara

### Graphics
- `cart`: Path gambar keranjang
- `items`: Array item yang bisa ditangkap
  - `src`: Path gambar item
  - `label`: Nama item yang ditampilkan
  - `score`: Skor yang didapat saat menangkap item
  - `weight`: Frekuensi kemunculan item (lebih tinggi = lebih sering)
  - `speedMul`: Pengali kecepatan item
  - `size`: Ukuran item dalam pixel
- `bombs`: Array item bom (mengurangi skor saat tertangkap, konfigurasi sama seperti item)
- `cartBoxSize`: Ukuran kotak keranjang dalam pixel
- `cartImgScale`: Skala gambar keranjang

### Theme
- `colors`:
  - `primary`: Warna utama
  - `text`: Warna teks
  - `hudBg`: Warna latar HUD
- `layout`:
  - `safeMargin`: Margin aman dalam pixel

### Gameplay
- `mode`: Mode permainan (saat ini hanya `"timer"`)
- `duration`: Durasi permainan dalam detik
- `spawnRate`: Jumlah item yang muncul per detik
- `speed`: Kecepatan dasar item

### UX
- `countdown`: Tampilkan hitung mundur sebelum mulai (`true`/`false`)
- `autoReturnSeconds`: Detik sebelum otomatis kembali ke halaman awal (`999999` = tidak otomatis)
- `sfx`: Aktifkan efek suara (`true`/`false`, saat ini belum digunakan)

## Alur Game

1. **Halaman Selamat Datang** (`/`):
   - Pemain memasukkan nama dan nomor telepon
   - Klik "Mulai Bermain" untuk memulai

2. **Halaman Permainan** (`/game`):
   - Gerakkan keranjang dengan mouse untuk menangkap item yang jatuh
   - Hindari bom agar skor tidak berkurang
   - Permainan berlangsung sesuai durasi yang ditentukan

3. **Halaman Papan Skor** (`/scoreboard`):
   - Menampilkan skor tertinggi dan posisi pemain
   - Pemain bisa kembali ke halaman awal atau bermain lagi

4. **Halaman Admin** (`/admin`):
   - Ekspor data skor seluruh pemain dalam format Excel
   - Berguna untuk keperluan laporan atau pengumpulan data peserta

## Catatan Tambahan

- Skor disimpan dalam database SQLite di `data/scores.db`
- Sesi pengguna dikelola menggunakan `SessionMiddleware` dengan secret key
- Untuk lingkungan produksi, ganti nilai `SESSION_SECRET` melalui environment variable
- Gunakan versi dependensi yang sudah teruji: `fastapi==0.115.4` dan `starlette==0.41.3`
- Aplikasi ini cocok digunakan pada acara pameran, festival, atau kegiatan promosi
