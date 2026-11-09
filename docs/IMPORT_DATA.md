# Import Excel / CSV ke Shadow Form Grid

Tersedia mulai versi **2.1.0** untuk class `com.monarch.shadow.lib.FormGridCustom`.

## Mengaktifkan dan memakai

1. Unggah `target/monarch-shadow-form-grid-2.15.0.jar` ke Manage Plugins.
2. Buka properti **Shadow Form Grid**, lalu tab **Import Data** dan centang **Enable Excel / CSV Import**.
3. Pastikan **Form** dan **Columns** sudah dikonfigurasi. Simpan form dan buka ulang halaman form. Preview dimulai dengan 10 baris per halaman; pengguna dapat mengubahnya langsung melalui **Rows per page** (10, 20, 50, atau 100).
4. Klik **Import Excel / CSV**. **Download Excel Template** menghasilkan file `.xlsx` dengan sheet `Import_Data` dan header sesuai Field ID serta urutan Columns grid tersebut. Setelah developer mengubah Columns dan menyimpan form, buka ulang halaman form untuk mengunduh template terbaru. File dibuat di browser menggunakan library yang disertakan dalam plugin.
5. Pilih `.xlsx`, `.xls`, atau `.csv` UTF-8. Untuk workbook dengan beberapa sheet, pilih worksheet yang berisi data.
6. Periksa pratinjau menggunakan **Previous/Next** dan **Rows per page** (10, 20, 50, atau 100). Klik **Import Rows** untuk menambahkan **seluruh batch** ke data yang sudah ada, termasuk baris pada halaman pratinjau lain.
7. Submit/simpan form induk untuk menyimpan hasil melalui store binder grid yang dikonfigurasi.

Mulai **2.15.0**, import juga tersedia di nested subgrid. Aktifkan opsi import pada elemen **child grid** masing-masing, lalu expand parent pada form runtime. Tombol **Import Excel / CSV** muncul di header child di samping Add. Template mengikuti Columns child dan tidak menyertakan FK parent maupun sort; hubungan ke parent diisi otomatis saat konfirmasi. Setiap parent memiliki preview terpisah. Lihat [pengaturan nested import](NESTED_GRID.md#import-into-a-nested-subgrid).

Untuk Columns pada contoh (`name`, `select`, `date`, `file`), template Excel berisi header `name`, `select`, dan `date` pada baris pertama. Isi mulai baris kedua, misalnya:

| name | select | date |
| --- | --- | --- |
| Andi | option_a | 2026-11-05 |
| Budi | option_b | 2026-11-06 |

`option_a` / `option_b` harus diganti dengan **value** pilihan yang tersimpan di field Select, bukan label tampilannya. Teks tanggal mengikuti **Data Format** field tanggal form anak. Sel tanggal numerik Excel dikonversi ke format penyimpanan field tersebut; teks CSV dipertahankan seperti yang ditulis.

Kolom **No.** pada preview adalah nomor urut data mulai 1 dan berlanjut antarhalaman. Arahkan kursor ke nomor tersebut untuk melihat nomor baris asal file. Pesan validasi memakai nomor baris asli file, yang memperhitungkan header pada baris 1.

## Pemetaan dinamis

- Baris pertama berisi header. Urutan kolom bebas dan pencocokan header mengabaikan kapitalisasi serta spasi di awal/akhir.
- Header dapat berupa Field ID (`name`), label (`Name`), atau nama kolom database (`c_name`). Field ID diprioritaskan jika ada label yang sama dengan ID lain.
- Header yang tidak dikenal, header ganda ke field yang sama, atau label ambigu menolak import. Gunakan Field ID untuk label ambigu.
- Kolom dengan Visibility **No** tetap mengikuti konfigurasi Columns dan dapat diimpor.
- Kolom konfigurasi yang tidak ada dalam file diisi kosong. Field di luar Columns tidak diimpor dan default popup tidak dijalankan.
- Kolom File/Image tidak dimasukkan ke template. Jika header-nya ada dalam file, semua selnya harus kosong. Upload berkas dari Add/Edit Row setelah import.
- Kolom HTML diperlakukan sebagai teks dan di-escape sebelum disimpan.
- Kolom sistem `id`, `dateCreated`, `dateModified`, `createdBy`, `createdByName`, `modifiedBy`, `modifiedByName`, serta Sort Field aktif diabaikan jika ada di file. Setiap baris memperoleh UUID baru.

Untuk struktur tabel contoh, `name`, `select`, dan `date` menjadi properti row yang disimpan ke `c_name`, `c_select`, dan `c_date` oleh binder normal Joget. `c_file` berasal dari upload berkas, `c_fk` ditangani konfigurasi foreign key pada binder, dan `c_sort` diisi jika Enable Sorting dan Sort Field `sort` dikonfigurasi. Import tidak menjalankan SQL atau mengubah struktur tabel.

Jika ingin menyimpan sebagai record di tabel anak, konfigurasikan store binder grid yang sesuai beserta foreign key-nya. Tanpa konfigurasi itu, hasil mengikuti perilaku penyimpanan grid yang sudah digunakan form.

## Validasi dan batas

Seluruh batch diperiksa sebelum penambahan baris. Nilai Unique Column wajib terisi dan tidak boleh duplikat terhadap baris grid yang ada maupun antarbaris import. Max Number of Row Validation diperiksa saat pratinjau dan diperiksa ulang saat konfirmasi. Jika gagal, tidak ada baris dari batch yang dimasukkan.

Import tidak tersedia pada grid readonly atau Disable Add. Batas per import adalah **10 MB**, **5000 baris data**, dan **256 kolom worksheet**. Workbook yang melebihi rentang tersebut ditolak. Pratinjau memakai pagination terpisah dari paging Form Grid. Jumlah baris per halaman dimulai dari 10 dan diatur pengguna langsung melalui **Rows per page**, tanpa properti pagination preview pada pengaturan developer; semua baris tetap diperiksa sebelum siap diimpor. Saat berganti file atau worksheet, pratinjau kembali ke halaman pertama. Formula menggunakan nilai cache Excel; formula tanpa nilai cache dan sel error ditolak. Formula tidak dihitung oleh importer.

Validasi popup form anak, default field, AJAX dependent options, dan validator kustom field **tidak dijalankan oleh import**. Import memasukkan nilai row seperti API pengisian grid; validasi grid/form induk yang sudah ada tetap berjalan saat submit. Validasi bisnis tambahan sebaiknya ditempatkan pada validator form/grid di server. Format tanggal Excel yang didukung adalah pola numerik Java (`yyyy`, `yy`, `MM`, `M`, `dd`, `d`, `HH`, `H`, `hh`, `h`, `mm`, `m`, `ss`, `s`, `a`, dan literal bertanda petik). Untuk pola bulan berbentuk teks, masukkan tanggal sebagai teks dalam format penyimpanannya.

## Dependensi dan pengujian

Parser **SheetJS CE 0.20.3** disertakan di `src/main/resources/resources/js/vendor/`, diunduh sesuai [dokumentasi standalone resmi](https://docs.sheetjs.com/docs/getting-started/installation/standalone/). Library dimuat dari URL resource plugin ketika pengguna memilih file atau mengunduh template Excel, tanpa akses CDN saat form digunakan. File diproses di browser. Lisensi disertakan dalam `SheetJS-LICENSE.txt`.

```sh
npm ci
npm test
mvn -o package
```

Tes Node mencakup XLS/XLSX/CSV, pemetaan, tanggal, keamanan header/HTML, duplikat, batas, pratinjau, konfirmasi, pembatalan, isolasi beberapa grid, serta paging. Tes Maven memeriksa render FreeMarker ketika fitur aktif, nonaktif, dan readonly. Verifikasi penyimpanan akhir dengan store binder aplikasi dilakukan di Joget setelah JAR diunggah.
