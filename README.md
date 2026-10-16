# Portal PBD & UASA SKSA

## Status — 16 Oktober 2026

- **Supabase Koku:** Data Utama sekolah sahaja. Lima jadual `pbd_*` yang pernah diwujudkan di sini telah dipadam. Jadual asal guru, murid, kelas, enrolmen dan sesi tidak diubah.
- **Neon Free:** Project `lingering-bread-73300577` menyimpan salinan sumber guru, murid, kelas dan enrolmen untuk log masuk serta semua data pentaksiran. Salinan awal: 558 murid arus perdana Tahun 1–6, 18 kelas 2026, 55 guru aktif, 17 subjek.
- **Vercel:** GitHub `burstamarushakur/PBD-UASA-SKSA`. Webapp Next.js build telah lulus. Backend runtime hanya menggunakan Neon; **tidak memerlukan Supabase Secret Key**.
- **PBD BI 1–6:** medan berdasarkan struktur JSON pemeriksa asal: Kemahiran, Tahap Penguasaan TP1–TP6, Ulasan, Intervensi, Usaha Murid, Status.
- **UASA 4–6:** markah 0–100, Gred dan Status. Semua subjek menggunakan aliran UASA yang sama.

## Auto-sync Supabase → Neon

Satu Supabase Edge Function `pbd-neon-readonly-sync` membaca lima jadual Data Utama menggunakan identiti perkhidmatan secara dalaman. Ia tidak menulis ke Supabase. Fungsi itu dilindungi token dan dipanggil oleh endpoint Vercel `/api/sync` yang juga dilindungi `CRON_SECRET`.

Cron Vercel di `vercel.json` menjadualkan penyelarasan pada **03:00 pagi waktu Malaysia setiap hari** (`0 19 * * *` UTC). Perubahan sumber tidak dipindahkan serta-merta; ia akan diselaraskan pada larian seterusnya. Data Pentaksiran `pbd_records` dan penetapan guru **tidak ditimpa** oleh penyelarasan.

**Sahkan pelaksanaan cron melalui Vercel Runtime Logs.** Status deployment READY sahaja bukan bukti cron telah berjalan.

## Variables server-only di Vercel

- `PBD_DATABASE_URL` — sambungan Neon baharu (rahsia)
- `SESSION_SECRET` — menandatangani sesi login (rahsia)
- `KOKU_SYNC_ENDPOINT` — URL fungsi bacaan Supabase
- `KOKU_SYNC_TOKEN` — token untuk fungsi bacaan (rahsia)
- `CRON_SECRET` — token untuk jadual Vercel (rahsia)

Semua berada di Vercel, bukan GitHub. `SUPABASE_URL` lama ialah tetapan baki yang tidak digunakan oleh runtime. Jangan tambahkan `SUPABASE_SECRET_KEY` ke webapp.

## Pemetaan ke IDMe

Lihat `idme/field-map.json`, dibuat daripada dua fail asal `SPPB-PBD-20261016-092301-UTC.json` dan `SPPB-UASA-20261016-092353-UTC.json`. Pemeriksa telah menyembunyikan teks sesetengah pilihan dropdown, jadi **nama pilihan sebenar perlu disahkan semula sebelum extension Chrome boleh mengisi IDMe secara automatik**. Jangan invent atau hardcode pilihan yang belum direkodkan. ID murid IDMe disimpan dalam kolum `students.idme_student_id` Neon dan diselaraskan melalui sync.

## Penggunaan dan keselamatan

Guru log masuk menggunakan IC 12 digit yang dibandingkan dengan SHA-256 base64url hash tersimpan. Admin awal mempunyai akses, guru lain perlu diaktifkan serta diagihkan kelas/subjek. Log masuk IC sahaja berisiko disalah guna; guna pengesahan tambahan sebelum membuka sistem kepada semua guru.

`/api/health` menyemak sambungan Neon. `/api/sync` **bukan URL awam** dan memerlukan CRON_SECRET.

Sila uji sendiri login serta penyimpanan satu rekod ujian sebelum mengisi data murid sebenar. Selepas deployment READY, pastikan Vercel SSO/protection sesuai untuk pengguna sebenar.
