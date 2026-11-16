# Dokumentasi Lengkap & Penggunaan: jQuery Grid Custom (Remake)

*Plugin* ini menambahkan *method* langsung ke dalam objek jQuery (`$.fn`) sehingga dapat dipanggil pada elemen *container grid* Anda (misalnya `$('#myGrid')`).

## 1. Ekstraksi dan Perhitungan Data

### A. `countData(options)`

Digunakan untuk menghitung jumlah baris data yang ada pada *grid*. Baris *template* bawaan (`.grid-row-template`) otomatis diabaikan.

* **Sintaks:** `$('#myGrid').countData({ checkedOnly: false, visibleOnly: false })`
* **Parameter:**
    * `checkedOnly`: Jika `true`, hanya menghitung baris yang dicentang, tidak `disabled`, dan tidak tersembunyi (tidak memiliki kelas `.fg-hidden`).
    * `visibleOnly`: Jika `true`, hanya menghitung baris yang sedang terlihat di halaman aktif (menggunakan `:visible`).

* **Contoh Penggunaan:**
```javascript
// Menghitung total data yang dicentang pengguna
let totalChecked = $('#employeeGrid').countData({ checkedOnly: true });
alert("Anda memilih " + totalChecked + " data.");

```

* **Before & After:**
    * *Before:* Terdapat 10 baris di *grid*, 3 di antaranya dicentang.
    * *After (Eksekusi):* Mengembalikan nilai angka `3`.

---

### B. `getValues(...keysToInclude)`

Mengambil seluruh data JSON dari semua baris di dalam *grid*. Properti yang nilainya kosong atau memiliki awalan `_temp` otomatis dibuang untuk menghasilkan data yang bersih.

* **Sintaks:** `$('#myGrid').getValues('kunci1', 'kunci2')`
* **Contoh Penggunaan:**
```javascript
// Mengambil nama dan departemen dari seluruh baris
let dataKaryawan = $('#employeeGrid').getValues('nama', 'departemen');
console.log(dataKaryawan); 

```

* **Before & After:**
    * *Before:* *Textarea* dalam baris menyimpan JSON kotor: `{"id":"123", "nama":"Budi", "umur":"25", "_tempPath":"/abc"}`.
    * *After (Eksekusi):* Jika dipanggil menggunakan `.getValues('nama')`, akan menghasilkan: `[{ "nama": "Budi" }]`.


### C. `getValuesChecked(...keysToInclude)`

Cara kerjanya sama dengan `getValues`, namun ini **hanya** mengambil data dari baris yang *checkbox*-nya dicentang, tidak dalam keadaan `disabled`, dan tidak tersembunyi (filter `.fg-hidden`).

* **Sintaks:** `$('#myGrid').getValuesChecked()`
* **Contoh Penggunaan:**
```javascript
// Mengambil semua properti bersih dari baris yang dipilih
let selectedData = $('#employeeGrid').getValuesChecked();

```

---

## 2. Manipulasi Baris (Tambah, Update, Hapus)

### A. `setValues(dataArray, options)`

Menghapus isi *grid* lama (kecuali *template*) dan mengisinya dengan sekumpulan data baru. Sistem otomatis mengecek konfigurasi `.uniqueKey` untuk mencegah data duplikat dan men-*generate* UUID baru jika ID tidak valid.

* **Sintaks:** `$('#myGrid').setValues(arrayOfObjects, { triggerChange: true })`
* **Contoh Penggunaan:**
```javascript
let newData = [
    { nama: "Andi", role: "Manager" },
    { nama: "Siska", role: "Staff" }
];
$('#employeeGrid').setValues(newData);

```

* **Before & After:**
    * *Before:* *Grid* kosong atau berisi data lama.
    * *After:* Data lama dihapus, 2 baris baru muncul di *grid*. Masing-masing baris langsung memiliki `id` berformat UUID acak (misal: `d3b07...`), dan *plus icon* (*add button*) disesuaikan visibilitasnya.

---

### B. `updateRowData(updateFn)`

Melakukan perulangan ke semua baris, mengizinkan Anda memodifikasi data JSON-nya secara langsung. Setelah dimodifikasi, *grid* otomatis memperbarui *interface* sel (HTML) dan nilai pada `textarea`.

* **Sintaks:** `$('#myGrid').updateRowData(function(data, rowElement) { ... })`
* **Contoh Penggunaan:**
```javascript
// Mengubah status semua data menjadi 'Verified'
$('#employeeGrid').updateRowData(function(data) {
    data.status = "Verified";
});

```

* **Before & After:**
    * *Before:* Kolom 'Status' di tabel menampilkan teks `Draft`. Data JSON berisi `{"status": "Draft"}`.
    * *After:* Kolom 'Status' di antarmuka langsung berubah menjadi `Verified` dan isi JSON ter- *update*.

---

### C. `clearAllRows()` & `clearRowsByCondition(conditionFn)`

Menghapus baris dari DOM tabel (kecuali baris *template*).

* **Sintaks:**
    * `$('#myGrid').clearAllRows()`
    * `$('#myGrid').clearRowsByCondition(function(data) { return boolean; })`

* **Contoh Penggunaan:**
```javascript
// Menghapus baris yang umurnya di bawah 18 tahun
$('#employeeGrid').clearRowsByCondition(function(data) {
    return data.umur < 18;
});

```

* **Before & After (Kondisional):**
    * *Before:* Ada 5 baris, 2 di antaranya memiliki data `umur` 17 dan 15.
    * *After:* 2 baris tersebut dihapus permanen dari HTML tabel. Kontrol pergerakan (opsi Naik/Turun) dinonaktifkan/disesuaikan ulang, dan *event* `change` dipicu.

---

## 3. Filter Visibilitas (Sembunyikan/Tampilkan Tanpa Dihapus)

### A. `hideRowsByCondition(conditionFn)`

Menyaring data tanpa menghapusnya dari sistem. Fitur ini sangat berguna untuk membuat fitur *search* atau filter tabel *client-side*. Saat baris disembunyikan, fungsi paginasi otomatis me-*refresh* halamannya.

* **Sintaks:** `$('#myGrid').hideRowsByCondition(function(data) { return boolean; })`
* **Contoh Penggunaan:**
```javascript
// Hanya tampilkan data dengan departemen IT, sisanya sembunyikan
$('#employeeGrid').hideRowsByCondition(function(data) {
    return data.departemen === 'IT';
});

```

* **Before & After:**
    * *Before:* Tabel menampilkan baris Departemen IT, HR, dan Finance secara bersamaan. *Checkbox* semua baris dapat diklik.
    * *After:*
        1. Baris HR dan Finance menghilang dari pandangan (mendapat kelas `.fg-hidden` dan `.pg-tr-hide`).
        2. *Checkbox* pada baris HR dan Finance berubah menjadi `disabled: true` agar tidak bisa tercentang tak sengaja oleh *Check All*.
        3. Baris IT tetap terlihat (mendapat kelas `.pg-tr-show`).
        4. Nomor halaman (*paging*) ditata ulang menyesuaikan jumlah baris IT yang tersisa.


## Search Form Grid

Aktifkan checkbox **Enable Search** di properties **UI > Grid** untuk menampilkan kotak pencarian. Secara default fitur ini nonaktif. Pencarian berjalan langsung saat mengetik, tanpa membedakan huruf besar/kecil, pada nilai kolom yang ditampilkan di seluruh halaman. Kosongkan pencarian untuk menampilkan kembali baris yang sesuai filter lainnya.

Pagination mengikuti hasil pencarian. Baris yang tidak cocok tidak ikut pemilihan atau hapus massal; semua data tetap dikirim ketika form disimpan. Pencarian juga tersedia pada mode readonly. Untuk nested subgrid, aktifkan Enable Search di child grid; pencarian berlaku pada record terkait dan terpisah untuk setiap parent. Data nested dimuat saat parent dibuka.

## Field Synchronization

Mulai versi 2.18.0, buka properties **Field Synchronization**, lalu aktifkan **Enable On Change Sync**. Tambahkan **Field Mapping** dari **Main Form Field** ke **Grid Field**. Contoh untuk combobox departemen:

| Main Form Field | Grid Field | Update Mode | When Source Empty | Get |
| --- | --- | --- | --- | --- |
| `dept` | `dept` | Always follow main form | Clear target | Value |

Perubahan pilihan `dept` langsung memperbarui seluruh baris grid tanpa refresh halaman, termasuk halaman lain dan baris yang tersembunyi oleh search/filter. Pilihan **Get** menentukan isi yang disalin: **Value** (default, termasuk mapping lama) mengambil stored value seperti `FIN`, sedangkan **Label** mengambil teks pilihan seperti `Finance`. Satu sumber bisa dipetakan ke field kode dan field nama melalui dua mapping berbeda. Get Label mendukung combobox, multiselect, radio dan checkbox; untuk input teks, yang disalin tetap teks yang diketik. Banyak pilihan digabung dengan `;`. Sumber kosong tetap mengikuti When Source Empty, tanpa menyalin label placeholder.

Untuk Get Value, samakan nilai opsi di kedua Form. Untuk Get Label, gunakan target teks/hidden atau target pilihan yang menerima label tersebut sebagai value. Label disimpan sebagai isi field tujuan, termasuk di JSON dan request parameter baris. Baris baru, duplikasi dan hasil import mengikuti nilai sumber terbaru. Tampilan, editor inline, dan JSON yang dikirim ikut diperbarui; **submit form** tetap diperlukan untuk menyimpan ke database. **Request Parameters** tetap dapat digunakan untuk mengisi field di popup Add/Edit.

**Always follow main form** menimpa field tujuan saat sumber berubah. **Only if target is empty** mempertahankan nilai yang sudah terisi. **When Source Empty** menentukan apakah target dikosongkan atau nilai sebelumnya dipertahankan. Default **Sync on Form Load** nonaktif: data lama tetap dipertahankan sampai sumber berubah. Aktifkan jika data lama juga perlu disamakan saat form dibuka.

Untuk nested, aktifkan dan atur mapping di masing-masing child grid. Setelah sumber berubah, child yang dimuat belakangan ikut memakai nilai terbaru. Cabang yang belum pernah dimuat tetap dipertahankan oleh binder; sinkronisasi ini tidak melakukan pembaruan massal ke record database yang belum dibuka. Sumber harus berada pada form/subform yang sama dengan grid. Gunakan Field ID tanpa awalan database `c_`; target bisa berupa field tersembunyi. Field ID, key relasi nested, sort, readonly, terenkripsi dan file tidak dapat menjadi target. Pilih tipe dan format field yang kompatibel, termasuk format penyimpanan tanggal.

Combobox memakai event `change`; input teks memakai jeda 200 ms dan langsung diselesaikan saat submit. Jika script mengubah sumber lewat `.val(...)`, panggil `.trigger('change')` agar grid ikut diperbarui saat itu juga. Fitur nonaktif pada Design canvas dan grid readonly. Kesalahan mapping ditampilkan pada form dan mencegah submit sampai diperbaiki.

## Nested Subgrids

Version 2.12.0 supports dynamic nested parent/child grids. See [Nested Grid setup and foreign keys](docs/NESTED_GRID.md) for the Plant → Area → Equipment Group → Equipment Type → Tags → Parameter example and binder configuration.
