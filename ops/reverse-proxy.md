# Reverse proxy dan origin

Template, tidak diterapkan otomatis. Isi APP_ORIGIN dan ORIGIN dengan origin HTTPS yang nanti dikonfirmasi pengguna. Jangan pilih domain sebelum deployment diminta.

- Bun HOST=127.0.0.1, PORT=5174; hanya proxy lokal boleh mencapai listener.
- Proxy melakukan terminasi TLS dan menulis ulang Host, X-Forwarded-Proto, dan header alamat klien. Hapus nilai header forwarded yang diberikan klien.
- ORIGIN statis lebih aman daripada mempercayai PROTOCOL_HEADER/HOST_HEADER. Biarkan kedua setting tersebut kosong.
- Rate limit default menggunakan alamat koneksi proxy. Jika semua trafik masuk dari satu proxy, batas IP bersama dapat terlalu ketat. Konfigurasi ADDRESS_HEADER hanya setelah proxy terpercaya menulis ulang header tunggal seperti X-Real-IP; jangan percaya header ini pada port publik.
- client_max_body_size 55m; timeout upload sesuai kebutuhan (misalnya 60 detik). Batasi akses langsung ke Bun dengan firewall.
- Proxy tidak boleh cache halaman autentikasi, data pengguna, POST, atau lampiran. Asset fingerprint dapat cache lama.
- Cookie Secure membutuhkan HTTPS pada penggunaan nyata. SameSite=Lax dan pemeriksaan Origin tetap aktif.
- Jangan aktifkan CORS wildcard atau trustedOrigins wildcard.

Periksa /healthz (200 ready, 503 unavailable), login/logout, form multipart, dan unduhan lewat proxy sebelum menyatakan deployment selesai. Template systemd dan konfigurasi proxy belum diuji pada host Linux.
