# Portal PBD & UASA SKSA — Supabase Koku (baca) + Neon Free (tulis)

## STATUS
Neon Free project `pbd-uasa-sksa` (ID `lingering-bread-73300577`) telah diwujudkan dan jadual PBD siap dimigrasi. Portal Koku kekal sumber **baca sahaja** bagi jadual `teachers`, `students`, `classes`, `academic_sessions`, dan `student_enrolments`. Semua `pbd_*` kini disimpan hanya ke database Neon baharu, **bukan Supabase Koku**.

## Deploy Vercel
Sediakan empat Environment Variables **server-only** dalam Vercel > projek `pbd-uasa-sksa` > Settings > Environment Variables:

- `SUPABASE_URL`: URL Supabase Koku (rujuk .env.example)
- `SUPABASE_SECRET_KEY`: Kunci server Supabase Koku untuk pembacaan
- `PBD_DATABASE_URL`: Neon PostgreSQL connection URL dari projek `lingering-bread-73300577`
- `SESSION_SECRET`: secret rawak 32 aksara atau lebih

Jangan letak password/secret dalam GitHub atau mesej chat. Selepas simpan, **Redeploy** dan buka `https://DOMAIN-PORTAL/api/health`. Status `ok:true` menandakan kedua-dua database boleh dibaca. Uji login admin, agihan subjek, dan simpan menggunakan rekod ujian dahulu.

**Amaran keselamatan:** Login IC sahaja tidak memberikan pengesahan identiti yang kuat; jangan gunakan aplikasi ini dengan data murid sebenar tanpa faktor pengesahan kedua.

## Katalog
PBD Tahun 1–6, UASA Tahun 4–6, 17 mata pelajaran permulaan. Pemetaan JSON penuh IDMe Bahasa Inggeris masih belum lengkap. Data asal Koku tidak diubah.
