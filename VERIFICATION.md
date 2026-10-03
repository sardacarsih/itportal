# Verifikasi portal

Dilakukan pada 3 Oktober 2026 (Asia/Jakarta), Windows, Bun 1.4.2, PostgreSQL 18, dan Chromium headless melalui Playwright 1.63.0. Semua data pengujian bersifat fiktif. Deployment publik aktif di https://itportal.kskgroup.web.id dan diverifikasi terpisah (lihat bagian Deployment publik).

| Pemeriksaan | Hasil |
| --- | --- |
| Bun type check / Svelte check | 0 error, 0 warning |
| Unit + PostgreSQL integration | 40 lulus, 0 gagal; 133 assertions |
| Browser workflow | 18 pemeriksaan lulus; 0 page errors |
| User screens | 8 layar × 4 viewport = 32 audit; tanpa overflow atau pelanggaran axe WCAG A/AA |
| Admin sections | 4 bagian × 4 viewport = 16 audit; tanpa overflow, pelanggaran axe, atau page errors |
| Touch targets | Kontrol pengguna dan label checkbox memenuhi ukuran minimal 44 px pada 4 viewport |
| Build | SvelteKit SSR + svelte-adapter-bun, berhasil memakai Bun |
| Actual production bundle smoke | Login, secure cookies, SSR, multipart, private download, duplicate retry, CSRF, logout, shutdown drain lulus |
| Private upload reconciliation | Tidak ada berkas hilang, orphan, atau staged tertinggal |

Viewport: 360, 768, 1024, 1440 px. Layar pengguna: dashboard, tiket, katalog, pembuatan tiket, pengetahuan, detail tiket, profil, notifikasi. Bagian Admin: pengguna/tim, layanan, pengetahuan, target/prioritas.

Workflow browser mencakup login, creation dengan ringkasan, lampiran privat, penugasan, catatan internal, balasan publik, pause/resume menunggu pemohon, resolve/reopen/close, terminal state, guessed-ID isolation, CSRF, URL filters, mobile navigation/Escape, keyboard focus, reduced motion, upload failure, logout; juga user creation/deactivation/session revocation, empty state, team creation/rename, catalog creation/deactivation, dan draft/publication artikel.

Integration tests memeriksa otorisasi role/tim dan cross-user, privasi pesan/event/notifikasi internal, atomic creation dan duplicate retry bersamaan, stale concurrent updates, mandatory resolution, clock pause/resume tanpa memindahkan respons pertama, assignment scope, cleanup upload setelah kegagalan, trigger append-only, session rotation/expiry/revocation, deactivation, last-active-admin protection, login/rate limits, sequence melebar melewati enam digit. Unit tests juga memverifikasi PNG/JPEG/PDF pasif diterima dan isi aktif/file rusak/limit/path traversal ditolak.

## Lighthouse mobile aktual

| Layar | Performance | Accessibility | LCP | CLS |
| --- | ---: | ---: | ---: | ---: |
| Dashboard | 97 | 100 | 2,22 s | 0,0026 |
| Tiket | 100 | 100 | 1,11 s | 0,0195 |
| Buat tiket | 100 | 100 | 1,12 s | 0,0015 |

Lighthouse 13.5.0 memakai konfigurasi mobile default dengan simulated throttling, Chromium headless, cookie autentikasi pemohon, bundle Bun lokal, dan data tersimpan PostgreSQL. Skor bukan jaminan pada deployment atau perangkat lain. Raw reports: artifacts/lighthouse-*.json. Browser hasil: artifacts/browser-results.json dan artifacts/admin-accessibility.json. Screenshot: artifacts/dashboard-{360,768,1024,1440}.png.

## Batas verifikasi dan penggunaan

Shutdown diverifikasi melalui handler SIGTERM bundle yang dipanggil programmatically pada Windows, dengan form nyata ditahan oleh row lock PostgreSQL, lalu diselesaikan sebelum pool database ditutup. Pengiriman POSIX signal oleh systemd di Linux belum diuji. Template systemd, reverse proxy, backup/restore, failover, dan pemakaian beban produksi belum diuji pada server tujuan.

Audit otomatis dan keyboard checks tidak menggantikan audit pembaca layar manual menyeluruh. Tidak ada klaim pengiriman email/WhatsApp/SSO/monitoring. Storage bukan antivirus universal; PDF kompleks/terenkripsi/aktif ditolak. Crash antara filesystem dan database memerlukan rekonsiliasi manual; skrip laporan read-only disertakan.

Lingkungan lokal lengkap: database itportal pada port 55439, database test itportal_test terpisah, upload privat, seed fiktif, dan preview Bun pada http://localhost:5174. Untuk pemakaian nyata, siapkan kredensial/database/upload produksi, HTTPS/origin, bootstrap Admin, backup, dan tinjau katalog serta target contoh. Companion landing page tidak diubah.

## Deployment publik — 3 Oktober 2026

Portal aktif di https://itportal.kskgroup.web.id (rincian server: `ops/production-deployment.md`). Verifikasi black-box dari sisi publik setelah deployment; satu-satunya mutasi data produksi adalah sesi login/logout Admin untuk pemeriksaan autentikasi.

| Pemeriksaan | Hasil |
| --- | --- |
| `/healthz` | 200 `{"status":"ready"}` |
| `/` dan 7 rute terproteksi tanpa sesi | 303 ke `/login` |
| Header keamanan `/login` | `private, no-store`, `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy` |
| 26 chunk preload + CSS + favicon | 200, `cache: immutable, max-age=31536000` |
| POST dengan Origin asing | 403 (CSRF) |
| Render browser nyata (halaman login) | Hidrasi normal, 0 error konsol, pesan salah-password tampil via UI |
| Login Admin | Cookie sesi `HttpOnly; Secure; SameSite=Lax; Max-Age=604800` |
| SSR autentikasi (`/`, `/admin`, `/notifikasi`) | 200, identitas Admin tampil pada dashboard |
| Logout | 303 ke `/login`; penggunaan ulang cookie lama ditolak (sesi dicabut) |

Header HSTS belum aktif pada respons; pengaktifan dilakukan di pengaturan Cloudflare untuk hostname tersebut. Password Admin bootstrap telah diganti setelah deployment; kredensial terkini disimpan privat di `.local/production-access.txt`, bukan dalam source.
