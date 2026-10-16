# Portal PBD & UASA SKSA

Webapp guna **Neon sahaja** untuk login IC, guru, senarai kelas, murid, PBD, UASA dan agihan admin. 55 guru aktif, 558 murid dan 18 kelas Tahun 1–6 (2026) telah disalin daripada Supabase Portal Koku melalui sambungan pentadbir; sumber Koku hanya dibaca, tidak diubah.

Vercel hanya perlu `PBD_DATABASE_URL` dan `SESSION_SECRET`. Neon project `lingering-bread-73300577`. Lihat `/api/health` selepas deployment.

**Penting:** Salinan data kelas dan murid tidak bersinkron automatik: perubahan dalam Portal Koku pada masa depan perlu diselaraskan lagi. Login IC sahaja berisiko dan belum sesuai untuk rekod sebenar tanpa pengesahan tambahan. Pemetaan JSON asal IDMe Bahasa Inggeris dan Chrome extension masih belum lengkap.
