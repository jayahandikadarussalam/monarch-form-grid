# Changelog

## [2.9.0] - 2026-11-07

### Diubah
- Sort Field hanya tampil jika Sort with Buttons dicentang pada baris nested yang sama; nilai field tetap tersimpan saat disembunyikan.
- Duplicate nested menggunakan dropdown dua pilihan: Default untuk langsung menyalin baris, dan Pop Up Dialog untuk membuka Form dahulu. Default konfigurasi baru adalah Default.
- Pilihan mode nested mengesampingkan setting popup child grid; readonly, Disable Add, batas baris, ID baru, serta FK tetap dipertahankan.
- Urutan CSV dan key konfigurasi dipertahankan: `enableDuplicate=false` berarti Default dan `true` berarti Pop Up Dialog.

## [2.8.0] - 2026-11-07

### Ditambahkan
- Autocomplete native Joget untuk Child Foreign Key Field dan Sort Field mengikuti Child Form ID pada tiap baris nested; Parent Key Field mengikuti Form parent yang dipilih.
- Saran field memakai endpoint kolom Form Joget, memperbarui sumber saat Form berubah, dan mengabaikan respons lama tanpa menghapus nilai yang diketik.
- Kolom No. pada nested tampil saat Sort with Buttons aktif atau Show Row Number pada source child aktif. Nomor dimulai dari 1 per parent dan mengikuti Add/Delete/Move.

## [2.7.2] - 2026-11-07

### Diperbaiki
- Ukuran dan margin paksa pada checkbox nested dihapus agar centang mengikuti styling native Joget tanpa lapisan biru tambahan.
- Border konfigurasi nested memakai abu-abu netral; layout dua baris dipertahankan.

## [2.7.1] - 2026-11-07

### Diubah
- **Sort with Buttons** dan **Duplicate** pada Nested Subgrids memakai checkbox native Joget, dengan nilai tersimpan tetap string `true`/`false`.
- Konfigurasi tiap child ditata menjadi dua baris berlabel agar input lebih lebar; panel sempit menyesuaikan jumlah kolom.
- Dropdown Form, required fields, CSV, dan kontrol Add/Move/Delete tetap menggunakan grid properties native.

## [2.7.0] - 2026-11-07

### Ditambahkan
- Dropdown **Child Form ID** langsung di samping Child Grid ID pada konfigurasi nested, menggunakan daftar Form aplikasi aktif.
- Form popup, metadata field, dan validasi child memakai Child Form ID yang dipilih. Binder yang menyediakan properti `formDefId` diselaraskan sebelum load/store.
- Validasi Form ID yang tidak ditemukan serta pesan untuk mapping browser yang belum dimuat ulang.
- Contoh JSON/CSV Area dan dokumentasi yang membedakan ID grid, ID Form, serta field FK. Mapping lama tanpa Child Form ID tetap memakai Form child grid.

## [2.6.0] - 2026-11-07

### Diubah
- Nested memiliki properti mandiri **Duplicate** dan **Sort with Buttons**, masing-masing Enabled/Disabled tanpa opsi mengikuti child grid.
- **Sort Field** ditentukan di relasi nested; penyimpanan dan pemuatan urutan mengikuti field ini tanpa mengaktifkan sorting pada child grid.
- Duplikasi nested selalu membuka Form popup dahulu, termasuk saat Show Popup on Duplicate child grid nonaktif. Baris baru ditambahkan setelah popup disubmit; Cancel tidak menambah data.
- Default nested: Sort with Buttons Disabled, Duplicate Enabled, Sort Field `sort`.

## [2.5.0] - 2026-11-07

### Ditambahkan
- Toolbar nested memakai ikon, ukuran, warna, dan jarak yang sama dengan grid utama: naik/turun, edit, duplikat, dan hapus.
- Pilihan **Sort with Buttons** dan **Duplicate** per relasi child: mengikuti child grid, Enabled, atau Disabled.
- Pengurutan dibatasi pada sibling dengan parent yang sama dan disimpan melalui Sort Field child grid.
- Duplikat child memakai ID baru, mempertahankan FK, mendukung popup duplicate, dan mematuhi readonly/Disable Add/batas baris.

### Diperbaiki
- Setting toolbar grid utama tidak lagi menyembunyikan tombol nested milik child secara tidak sengaja.
- Duplikat grid utama juga mematuhi readonly/Disable Add/batas baris.

## [2.4.0] - 2026-11-07

### Ditambahkan
- Pengaturan berbahasa Inggris **Nested Subgrids**, **Enable Nested Subgrids**, dan **Child Tables / Subgrids**.
- Relasi dinamis Child Grid ID, Parent Grid ID, Parent Key Field, dan Child Foreign Key Field, termasuk cabang dan level tambahan tanpa rebuild plugin.
- Expand/collapse subgrid, Add dengan FK otomatis, serta Edit/Delete melalui Form dan binder child grid yang sudah dikonfigurasi.
- Validasi graph dan FK di browser serta server; penghapusan parent yang masih memiliki child ditahan.
- Dokumentasi konfigurasi table/Form/binder dan contoh Plant → Area → Equipment Group → Equipment Type → Tags → Parameter di `docs/NESTED_GRID.md`.

## [2.3.0] - 2026-11-06

### Ditambahkan
- Checkbox **Editable Form Grid** pada UI > Grid untuk mengaktifkan edit langsung di sel. Default nonaktif; tombol CRUD tetap tersedia.
- Editor teks, textarea, pilihan tunggal/multi, tanggal biasa, dan File Upload bawaan Joget dengan sinkronisasi JSON serta validasi field saat submit.
- Upload menggunakan nonce layanan Joget dan menunggu upload selesai sebelum tombol submit dapat dipakai.
- Field read-only, sistem, tersembunyi, plugin khusus, dan date/time tingkat lanjut tetap memakai perilaku sebelumnya.

## [2.2.2] - 2026-11-06

### Diperbaiki
- Kolom No. pada preview import menampilkan nomor urut data mulai 1 dan berlanjut antarhalaman. Nomor baris asli file tersedia pada tooltip dan tetap digunakan dalam pesan validasi.

## [2.2.1] - 2026-11-06

### Diubah
- Properti Import Preview Page Size dihapus dari pengaturan developer. Preview dimulai dengan 10 baris; pengguna mengaturnya langsung melalui Rows per page (10–100) dan navigasi Previous/Next.

## [2.2.0] - 2026-11-06

### Ditambahkan
- Properti Import Preview Page Size pada tab Import Data, dengan pilihan 10, 20, 30, 40, 50, 60, 70, 80, 90, dan 100 baris.
- Navigasi Previous/Next, informasi halaman, dan pilihan Rows per page pada pratinjau import. Import Rows tetap memasukkan seluruh batch.

### Diubah
- Download template menggunakan workbook Excel `.xlsx` dengan header sesuai Field ID dan urutan Columns. Download tetap diisolasi dari navigasi userview.
- Validasi dilakukan pada seluruh batch, termasuk baris yang tidak tampil di halaman pratinjau aktif.

## [2.1.2] - 2026-11-05

### Diperbaiki
- Download CSV Template menghentikan propagasi klik link unduhan agar URL `blob:` tidak diarahkan ke router userview dan menyebabkan HTTP 400.
- Pengujian download memastikan header mengikuti Field ID dan urutan Columns pada setiap grid, termasuk kolom tersembunyi yang dapat diimpor; File/Image dan field sistem tetap dikecualikan.

## [2.1.1] - 2026-11-05

### Diperbaiki
- Label import diterjemahkan melalui Java sebelum render FreeMarker, dengan fallback teks agar token `@@...@@` tidak terlihat pada form.
- Panel import ditata dengan judul, tombol template, field file/sheet terpisah, panduan yang dapat dibuka, dan tombol aksi di footer.
- Ukuran tombol, input file, jarak, serta tata letak responsif disesuaikan dengan form; status dan pratinjau kosong disembunyikan.

## [2.1.0] - 2026-11-05

### Ditambahkan
- Import XLSX, XLS, dan CSV opsional melalui tab Import Data pada properti Shadow Form Grid.
- Pemetaan header dinamis ke Columns melalui Field ID, label, atau awalan database `c_`; pilihan worksheet, pratinjau, dan template CSV.
- Import menambah baris dengan UUID baru, pemeriksaan Unique Column dan batas baris untuk seluruh batch sebelum konfirmasi.
- Konversi tanggal Excel mengikuti Data Format field tanggal form anak; file/image diunggah melalui Add/Edit Row.
- Parser SheetJS CE 0.20.3 dibundel untuk pemrosesan lokal di browser; pengujian parser, UI, dan template.

### Diperbaiki
- Selector tabel utama pada grid dan paging diisolasi agar tidak menangani tabel pratinjau import.

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

