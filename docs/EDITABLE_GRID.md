# Editable Form Grid

Tersedia mulai versi **2.3.0**.

1. Upload `target/monarch-shadow-form-grid-2.3.0.jar` lewat Manage Plugins.
2. Buka properti **Shadow Form Grid → UI → Grid** dan centang **Editable Form Grid**.
3. Simpan konfigurasi form dan buka ulang form. Field pada **Columns** akan memakai editor sesuai tipe field di form anak.
4. Ubah isi sel, kemudian **Save/Submit** form induk untuk menyimpan data melalui binder grid.

Checkbox ini default **nonaktif**, sehingga konfigurasi lama mempertahankan perilakunya. Tombol **Add**, **Edit**, **Duplicate**, **Delete**, pemilihan baris, dan paging tetap mengikuti pengaturan masing-masing. Penambahan baris tetap memakai tombol Add dan popup form.

Editor langsung mendukung Text Field, Text Area, Select Box, Radio (dropdown tunggal), Check Box (select multi), Date Picker tanggal biasa, dan File Upload standar Joget. Pilihan menampilkan label dan menyimpan value; multi pilihan memakai pemisah `;`. Opsi AJAX mengikuti nilai control field pada baris yang sama.

Tanggal memakai kalender browser dan dikonversi ke Data Format form anak, misalnya `yyyy-MM-dd` atau `dd/MM/yyyy`. Format tanggal dengan nama bulan, date/time, time-only, dan UTC tetap diedit lewat popup. Format tampilan kalender mengikuti locale browser.

File diunggah lewat layanan File Upload Joget dengan nonce. Nama file dan `_tempFilePathMap` ikut disimpan dalam JSON baris. Batas ukuran serta ekstensi mengikuti konfigurasi field. Tombol submit dinonaktifkan selama upload berlangsung; upload gagal mempertahankan nilai sebelumnya. Gunakan Edit Row untuk menghapus lampiran atau menggunakan fitur upload khusus.

Field sistem, kolom tersembunyi, field read-only, dan plugin khusus tetap menggunakan tampilan serta popup sebelumnya. Script khusus, kalkulasi, dan interaksi antarfield yang hanya berjalan di popup tidak dijalankan oleh editor sel; gunakan Edit Row untuk form dengan perilaku tersebut. Validasi field yang dapat diedit dijalankan kembali di server saat submit, dan pesan menyertakan nomor baris.

Pengujian otomatis mencakup serialisasi JSON, field multiline, pemilihan opsi, format tanggal, nilai unik, perubahan lewat popup/script, upload berhasil/gagal, isolasi beberapa grid, serta perilaku default dan read-only. Verifikasi pada server Joget tetap diperlukan untuk binder, hak akses, serta layanan upload aplikasi yang digunakan.
