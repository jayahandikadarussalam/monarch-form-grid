(function($) {
    // Tambahkan method langsung ke jQuery
    $.fn.countData = function({ checkedOnly = false, visibleOnly = false } = {}) {
        let count = 0;
        this.each(function() {
            let elements;

            if (checkedOnly) {
                // Ambil semua yang dicentang dulu
                elements = $(this).find(".grid-checkbox-children:checked");

                // Filter manual agar PASTI membuang yang disabled
                elements = elements.filter(function() {
                    // Return false (buang) jika disabled property true
                    if ($(this).prop('disabled') === true) return false;

                    // Cek juga parent row-nya, jangan hitung jika row disembunyikan filter
                    if ($(this).closest('tr').is('.fg-hidden,.fg-search-hidden')) return false;

                    return true;
                });
            } else {
                // Ambil row biasa, buang template
                elements = $(this).find("tr.grid-row:not(.grid-row-template)");
            }

            // Opsi tambahan: hanya hitung yang terlihat di layar (page aktif)
            if (visibleOnly) {
                elements = elements.filter(":visible");
            }

            count += elements.length;
        });
        return count;
    };

    // Ambil array JSON dari semua row yang dicentang
    $.fn.getValuesChecked = function(...keysToInclude) {
        let result = [];

        $(this).find('.grid-checkbox-children:checked:not(:disabled)').each(function() {
            const row = $(this).closest('tr.grid-row');

            if (row.is('.fg-hidden,.fg-search-hidden')) {
                return; // Skip jika row disembunyikan oleh logic filter
            }

            const json = row.find('textarea:not(.formgrid-editor)').val();

            try {
                const parsed = JSON.parse(json);
                let cleaned;

                if (keysToInclude.length > 0) {
                    cleaned = {};
                    keysToInclude.forEach(k => {
                        if (parsed.hasOwnProperty(k)) {
                            cleaned[k] = parsed[k];
                        }
                    });
                } else {
                    cleaned = Object.fromEntries(
                        Object.entries(parsed).filter(([key]) =>
                            key.trim() !== "" && !key.startsWith("_temp")
                        )
                    );
                }

                result.push(cleaned);
            } catch (e) {
                console.warn('Data JSON not valid:', e);
            }
        });

        return result;
    };

    $.fn.getValues = function(...keysToInclude) {
        let result = [];

        this.each(function() {
            $(this).find('tr.grid-row').each(function() {
                const json = $(this).find('textarea:not(.formgrid-editor)').val();

                try {
                    const parsed = JSON.parse(json);
                    let cleaned;

                    if (keysToInclude.length > 0) {
                        // Hanya ambil key yang disebutkan
                        cleaned = {};
                        keysToInclude.forEach(k => {
                            if (parsed.hasOwnProperty(k)) {
                                cleaned[k] = parsed[k];
                            }
                        });
                    } else {
                        // Ambil semua key KECUALI yang kosong atau diawali _temp
                        cleaned = Object.fromEntries(
                            Object.entries(parsed).filter(([key]) =>
                                key.trim() !== "" && !key.startsWith("_temp")
                            )
                        );
                    }

                    result.push(cleaned);
                } catch (e) {
                    console.warn('Data JSON not valid:', e);
                }
            });
        });

        return result;
    };

    $.fn.setValues = function(dataArray, { triggerChange = true } = {}) {
        return this.each(function() {
            const container = $(this);

            const formDefKeys = container.find('.formDefKeys').val()?.split(',') || [];
            const uniqueKey = container.find('.uniqueKey').val();

            const table = container.find("> table");
            const template = table.find(".grid-row-template");

            // Bersihkan baris yang bukan template
            table.find(".grid-row").not(".grid-row-template").remove();

            const seenValues = new Set(); // dedup dalam batch

            dataArray.forEach((dataObj, index) => {
                if (!dataObj.id || !monarchUtils.isValidUUID(dataObj.id)) {
                    dataObj.id = monarchUtils.generateUUID();
                }

                const rowData = { id: dataObj.id };
                formDefKeys.forEach(key => {
                    if (dataObj.hasOwnProperty(key)) {
                        rowData[key] = dataObj[key];
                    }
                });

                // 🚨 Dedup dalam batch
                if (uniqueKey && rowData[uniqueKey] !== undefined) {
                    const keyVal = String(rowData[uniqueKey]).trim();

                    if (seenValues.has(keyVal)) {
                        console.warn(`Duplicate ${uniqueKey} in batch: ${keyVal}`);
                        return; // skip duplikat dalam dataArray
                    }
                    seenValues.add(keyVal);
                }

                // 🚨 Cek duplicate dengan data yang sudah ada (panggil plugin original)
                const args = { result: JSON.stringify(rowData) };
                if (typeof container.formGridCustom === "function") {
                    const ok = container.formGridCustom("checkDuplicate", args);
                    if (!ok) {
                        console.warn(`Duplicate ${uniqueKey} in grid: ${rowData[uniqueKey]}`);
                        return; // skip duplikat terhadap row existing
                    }
                }

                // Tambah row baru
                const newRow = template.clone()
                    .removeClass("grid-row-template")
                    .addClass("grid-row")
                    .show();

                newRow.find(".grid-checkbox-children").prop("checked", false);

                $.formGridCustom.decorateRow(newRow);
                $.formGridCustom.fillValue(container, newRow, JSON.stringify(rowData));
                table.append(newRow);

                $.formGridCustom.updateRowIndex(newRow, index);
            });

            $.formGridCustom.disabledMoveAction(table);
            $.formGridCustom.showHidePlusIcon(container);

            if (triggerChange) {
                container.trigger("change");
            }
        });
    };

    $.fn.updateRowData = function(updateFn) {
        return this.each(function() {
            const container = $(this);
            const table = container.find("> table");

            container.find("tr.grid-row").each(function(rowIndex) {
                const $textarea = $(this).find("textarea:not(.formgrid-editor)");
                try {
                    let data = JSON.parse($textarea.val());

                    // Jalankan callback untuk update
                    updateFn(data, $(this));

                    // Simpan kembali ke textarea
                    const newJson = JSON.stringify(data);
                    $textarea.val(newJson);

                    // Refresh tampilan cell sesuai JSON
                    $.formGridCustom.fillValue(container, $(this), newJson);

                    // Update index dan styling row
                    $.formGridCustom.updateRowIndex($(this), rowIndex);
                } catch (e) {
                    console.warn("Failed to process JSON on line: ", e);
                }
            });

            // Pastikan tombol move dan plus icon sinkron
            $.formGridCustom.disabledMoveAction(table);
            $.formGridCustom.showHidePlusIcon(container);
        });
    };

    $.fn.hideAllRows = function() {
        return this.each(function() {
            $(this).find("tr.grid-row").hide();
        });
    };

    $.fn.showAllRows = function() {
        return this.each(function() {
            $(this).find("tr.grid-row").show();
        });
    };

    $.fn.hideRowsByCondition = function(conditionFn) {
        return this.each(function() {
            const container = $(this);
            container.find("tr.grid-row").each(function() {
                const $row = $(this);
                const $checkbox = $row.find('.grid-checkbox-children');
                const json = $row.find("textarea:not(.formgrid-editor)").val();

                try {
                    const data = JSON.parse(json);
                    if (conditionFn(data)) {
                        $row.show().removeClass("fg-hidden pg-tr-hide").addClass("pg-tr-show");
                        $checkbox.prop('disabled', false);
                    } else {
                        $row.hide().addClass("fg-hidden").removeClass("pg-tr-show").addClass("pg-tr-hide");
                        $checkbox.prop('disabled', true);
                    }
                } catch (e) {
                    console.warn("JSON error:", e);
                    // fallback -> hidden
                    $row.hide().removeClass("pg-tr-show").addClass("pg-tr-hide");
                    $checkbox.prop('disabled', true);
                }
            });

            // refresh paging setelah filter
            container.trigger("change");
            container.gridPagingCustom("refresh");
        });
    };

    $.fn.clearAllRows = function() {
        return this.each(function() {
            const container = $(this);
            const table = container.find("> table");

            // Hapus semua row yang bukan template
            table.find("tr.grid-row").not(".grid-row-template").remove();

            // Update tampilan & kontrol
            $.formGridCustom.disabledMoveAction(table);
            $.formGridCustom.showHidePlusIcon(container);

            // Trigger change supaya event listener tahu ada perubahan
            container.trigger("change");
        });
    };

    $.fn.clearRowsByCondition = function(conditionFn) {
        return this.each(function() {
            const container = $(this);
            const table = container.find("> table");

            table.find("tr.grid-row").not(".grid-row-template").each(function() {
                const $row = $(this);
                const json = $row.find("textarea:not(.formgrid-editor)").val();

                try {
                    const data = JSON.parse(json);

                    if (conditionFn(data)) {
                        $row.remove();
                    }
                } catch (e) {
                    console.warn("JSON error while clearing row:", e);
                    // Jika JSON invalid, hapus row supaya tidak mengganggu
                    $row.remove();
                }
            });

            // Refresh tampilan & kontrol grid
            $.formGridCustom.disabledMoveAction(table);
            $.formGridCustom.showHidePlusIcon(container);

            // Trigger event change supaya listener grid tahu ada update
            container.trigger("change");
        });
    };
})(jQuery);
