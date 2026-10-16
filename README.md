# Portal PBD & UASA SKSA

Sistem PBD Tahun 1–6 dan UASA Tahun 4–6, menggunakan dua projek Supabase **BERASINGAN**.

**PENTING: Jangan jalankan migrasi pada Supabase Portal Kokurikulum SKSA.** Projek itu hanya SUMBER BACA untuk jadual guru, murid, kelas, enrolmen dan sesi. Semua penulisan PBD/UASA dibuat di projek Supabase PBD yang baharu. Kod akan menolak konfigurasi jika kedua-dua URL Supabase sama.

## Status
- Kod webapp di GitHub: login IC guru, papan kelas & murid, PBD, UASA, agihan admin.
- Skrip SQL untuk projek PBD baharu: `migrations/001_pbd_separate_project.sql`.
- Migrasi **belum dijalankan** di projek baharu; jangan gunakan untuk rekod murid sebenar selagi belum disiapkan dan diuji.
- Jadual `pbd_*` yang pernah dicipta dalam projek Koku **tidak digunakan** dalam kod ini; tiada perubahan/pemadaman pada jadual asal melalui release ini.
- Login IC sahaja mempunyai risiko penyamaran; langkah pengesahan tambahan disyorkan sebelum penggunaan dengan data sebenar.

## 1. Persediaan Supabase berasingan

Cipta projek Supabase `PBD-UASA-SKSA` baharu. Jalankan **hanya pada projek baharu** fail `migrations/001_pbd_separate_project.sql`. Ia menyediakan 17 subjek, akaun admin awal, jadual agihan, rekod dan had percubaan login. UUID guru/murid/kelas dari sumber disimpan sebagai rujukan luaran, bukan foreign key silang projek.

Data Koku terus dibaca dari projek asal `sxmchnwzcbsanecxnqdt`. Fungsi backend menyekat operasi tulis pada `teachers`, `students`, `classes`, `student_enrolments`, `academic_sessions`.

## 2. Tetapan Vercel Production

Dalam Vercel → projek `pbd-uasa-sksa` → Settings → Environment Variables, isi **lima** tetapan berikut:

| Nama | Penerangan |
|---|---|
| `SUPABASE_URL` | URL projek Koku sumber (lihat `.env.example`) |
| `SUPABASE_SECRET_KEY` | Server key projek Koku (digunakan oleh kod baca sahaja) |
| `PBD_SUPABASE_URL` | URL projek Supabase PBD baharu |
| `PBD_SUPABASE_SECRET_KEY` | Server key projek PBD baharu |
| `SESSION_SECRET` | Rentetan rawak minimum 32 aksara |

Jangan letak kunci rahsia dalam GitHub, chat, atau `NEXT_PUBLIC_`. Selepas simpan, **Redeploy** deployment terbaru.

## 3. Uji sambungan

Buka `https://DOMAIN-PORTAL/api/health`. Jika `ok: true`, sambungan sumber Koku dan katalog PBD sudah boleh dibaca. Jika `ok: false`, semak nama variable dalam `missing` atau ralat yang diberikan. Endpoint ini tidak mendedahkan nilai secret.

Selepas health berjaya, uji login IC guru admin dan fungsi simpan menggunakan data ujian dahulu. Guru lain perlu diaktifkan oleh admin dan diagihkan kelas/subjek.

## 4. Had versi semasa

PBD TP1–TP6 Tahun 1–6; UASA markah dan gred Tahun 4–6. Katalog subjek perlu disahkan dengan tawaran sebenar sekolah. Pemetaan penuh JSON Bahasa Inggeris dan penyegerakan IDMe menggunakan Chrome extension masih belum siap. Ini **bukan** integrasi terus ke sistem IDMe.

Untuk pembangunan tempatan: `npm install` → `npm run dev`.
