# Portal PBD & UASA SKSA (v1)

Aplikasi Next.js berasaskan pangkalan data asal **Perjumpaan Kokurikulum SKSA**, tanpa menukar rekod kokurikulum sedia ada. **JANGAN deploy sehingga semua langkah konfigurasi dan keselamatan disahkan.**

## Status sebenar

- Jadual `pbd_*` telah dicipta di projek Supabase `sxmchnwzcbsanecxnqdt`; guru admin tunggal awal telah diaktifkan.
- Sesi 2026 mempunyai 18 kelas Tahun 1–6 dan 558 murid berdaftar. Kelas PPKI (year_level=0) tidak dipaparkan dalam v1.
- Pengisian PBD membenarkan TP keseluruhan dan TP kemahiran bagi subjek yang ada dimensi kemahiran. UASA membenarkan markah 0–100 dan gred automatik.
- Ini **bukan** penyelarasan/penyerahan rasmi IDMe. Extension Chrome dan pemetaan JSON asal Bahasa Inggeris masih memerlukan data sumber yang tepat.

## Deploy ke Vercel

1. Cipta repository GitHub **baharu**, muat naik fail dalam ZIP ini (bukan ke repo Portal Koku).
2. Import repo baharu dalam Vercel, framework **Next.js**.
3. Set Environment Variables berdasarkan `.env.example`.
   - `SUPABASE_URL`: URL projek Koku (ditunjuk dalam contoh).
   - `SUPABASE_SECRET_KEY`: secret key **baharu** melalui Supabase → Project Settings → API Keys. **Jangan sekali-kali dedahkan atau commit ke GitHub.**
   - `SESSION_SECRET`: rentetan rawak sekurang-kurangnya 32 aksara; disyorkan 64.
4. Deploy. Guru mula-mula yang diaktifkan adalah admin; admin boleh buka akses guru lain dan agihkan kelas/subjek.
5. Semak seting SSO/IC kerana **IC sahaja tidak selamat untuk portal sebenar mengandungi data murid**. Disyorkan tambah faktor kedua sebelum penggunaan luas.

## Polisi data

Jadual `pbd_*` mengaktifkan RLS, `anon` dan `authenticated` tidak diberi akses terus, `service_role` sahaja. Backend API Next.js menggunakan secret key untuk operasi DB dengan semakan sesi dan peranan pada server. Token sesi HMAC dalam HttpOnly cookie. IC tidak disimpan oleh app; hanya di-hash SHA-256 base64url supaya padan dengan `teachers.identification_hash`. Login dihadkan percubaan, tetapi IC sahaja masih boleh diketahui pihak lain.

## Penyelarasan mata pelajaran

Katalog v1 mengandungi BM, BI, Matematik, Sains, Pendidikan Islam, Pendidikan Moral, PJPK, PSV, Muzik, Bahasa Arab, Sejarah, RBT, BCSK, BTSK, Bahasa Iban, Kadazandusun dan Semai. Subjek elektif/berdasarkan tawaran sebenar sekolah tidak sepatutnya diassign jika tidak ditawarkan. Mata pelajaran sekolah rendah boleh berubah dengan perubahan kurikulum; admin perlu menyemak katalog dengan pentadbiran sekolah dan arahan KPM terkini. UASA dibuka untuk Tahun 4–6 selepas guru memilih subjek; skema pemarkahan subjek khusus dan instrumen rasmi belum diimplementasi. PBD BI menggunakan lima domain asas Listening, Speaking, Reading, Writing, Language Arts sementara menunggu padanan penuh JSON IDMe asal.

### Gred UASA
A 82–100; B 66–81; C 50–65; D 35–49; E 20–34; F 0–19 (aplikasi turut menyokong pecahan perpuluhan, dengan sempadan bawah julat seperti di atas).

## Local

`npm install` kemudian `npm run dev`. Semua secret hanya di pelayan. Uji dengan data tanpa murid sebenar pada persekitaran staging sebelum guna di sekolah.
