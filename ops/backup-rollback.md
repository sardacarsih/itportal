# Backup dan rollback

Semua perintah dijalankan operator setelah memastikan DATABASE_URL menunjuk database khusus itportal. Jangan gunakan kredensial atau backup aplikasi lain. Password diberikan lewat environment/file aman, bukan argumen command atau log.

1. Aktifkan maintenance pada proxy dan hentikan unit itportal agar tidak ada penulisan baru.
2. Jalankan pg_dump format custom untuk itportal ke storage backup privat. Contoh: `pg_dump --format=custom --file=/backup/itportal.dump itportal` dengan PGHOST/PGPORT/PGUSER/PGPASSFILE yang benar.
3. Backup UPLOAD_DIR, termasuk metadata permission. Catat checksum, versi aplikasi, migrasi terpasang, dan Bun version. Enkripsi backup dan batasi akses.
4. Jalankan kembali service dan periksa /healthz. Jadwalkan retensi serta uji restore berkala.

Restore: buat database khusus baru (misalnya itportal_restore), restore melalui pg_restore, salin snapshot upload ke direktori privat baru, dan gunakan environment khusus restore. Verifikasi jumlah record, file lampiran, login, unduhan, dan riwayat sebelum mengganti service utama. Role runtime tidak boleh menjadi superuser; role migrasi memiliki hak DDL/extension. Jangan menyalin cluster development atau kredensial fiktif ke produksi.

Rollback aplikasi: simpan artifact rilis sebelumnya dan bun.lock. Hentikan service, arahkan symlink current ke rilis kompatibel, lalu restart. Migrasi v1 bersifat additive; jangan membalik migrasi dengan DROP TABLE. Jika rollback skema dibutuhkan, restore snapshot database+upload ke lokasi baru dan tinjau konsekuensi data yang masuk sesudah backup bersama pemilik layanan.

Disk vs transaksi: upload orphan dapat tertinggal setelah crash. `bun scripts/reconcile-uploads.ts` hanya melaporkan metadata/file tidak cocok; karantina berkas orphan setelah backup dan setelah memastikan tidak ada transaksi upload berjalan. Jangan otomatis menghapus missing metadata/file tanpa audit.

Pemeliharaan rutin: hapus sesi kedaluwarsa dan login_attempts yang reset_at sudah lama berlalu menggunakan query terparameter oleh job operator. Riwayat tiket tidak dihapus. Pantau kapasitas disk, PostgreSQL, error log, dan response /healthz tanpa merekam token atau password.
