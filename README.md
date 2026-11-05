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
