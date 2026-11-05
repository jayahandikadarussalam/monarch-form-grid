# Changelog

Semua perubahan penting pada plugin ini akan didokumentasikan di sini.

Format berdasarkan [Semantic Versioning](https://semver.org/).

---

## [2.0.9] - 2026-11-05
### Diperbaiki
- Area navigator tetap dirender pada grid kosong atau satu halaman, sehingga jarak tombol Add dari tabel mengikuti Form Grid bawaan Joget.

## [2.0.8] - 2026-11-05
### Diperbaiki
- URL seluruh JS/CSS dan cache offline menyertakan versi rilis agar update plugin tidak memakai resource dari cache browser sebelumnya.
- Versi bundle Maven/OSGi disamakan dengan versi plugin, dan nama JAR menggunakan nomor rilis yang berbeda.

## [2.0.7] - 2026-11-05
### Diperbaiki
- Tombol naik/turun, edit, duplikat, dan hapus ditata dalam toolbar satu baris dengan jarak dan ukuran 32 px mengikuti repeater Monarch.
- Ikon hapus menggunakan tempat sampah merah; tombol urutan pertama/terakhir benar-benar dinonaktifkan dan tampil pudar.
- Perubahan urutan memperbarui indeks serta paging; tombol hapus pilihan memakai gaya ikon yang sama.

## [2.0.6] - 2026-11-05
### Diperbaiki
- Tombol Add memakai markup, kelas tema grid, dan ukuran yang sama dengan Form Grid bawaan Joget 9.1.2.
- Label Add diterjemahkan di Java melalui `AppPluginUtil` sebelum render, sehingga token terjemahan tidak muncul pada tombol.
- Label grid kembali mengikuti tata letak field grid bawaan Joget.

## [2.0.5] - 2026-11-05
### Diperbaiki
- Tombol Add dirender langsung pada template form dan preview builder, menggunakan tombol Joget tanpa kelas ikon lama.
- Tombol Add membuka popup, menghormati readonly/Disable Add/batas baris, dan muncul kembali setelah jumlah baris berkurang.

### Diubah
- Package plugin menjadi `com.monarch.shadow`, termasuk activator, URL resource, message key, dan helper `monarchUtils`.
- Nama JAR menjadi `monarch-shadow-form-grid-8.0-SNAPSHOT.jar`.
- Identitas class berubah; pilih ulang Form Grid Custom pada form yang memakai plugin lama, lalu simpan konfigurasi dan pemetaan kolomnya.

## [1.1.0] - 2025-07-24
### Ditambahkan
- Menambahkan fungsi getTotalChecked() untuk mendapatkan total yang di ceklis.
- Menambahkan fungsi getCheckedJsonData() untuk mendapatkan data yang di ceklis berupa json.
- Menambahkan fungsi getAllJsonData() untuk mendapatkan seluruh data yang ada pada tabel.
- Menambahkan fungsi setData() untuk set data json ke tabel.

### Diperbaiki
- Generate UUID ketika duplicate data dan setData dari fungsi setData()

