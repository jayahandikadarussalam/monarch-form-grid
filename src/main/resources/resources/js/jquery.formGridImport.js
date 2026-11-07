(function($, window) {
    "use strict";
    var rules = window.ShadowFormGridImport, parserPromise;

    // Load the bundled parser only when needed and keep it private to this plugin.
    function parser(url) {
        if (!parserPromise) {
            var previous = window.XLSX;
            parserPromise = $.ajax({url: url, dataType: "script", cache: true}).then(function() {
                var library = window.XLSX;
                window.XLSX = previous;
                if (!library || !library.read) throw new Error("The Excel parser could not be loaded.");
                return library;
            }, function() {
                parserPromise = null;
                throw new Error("The Excel parser could not be loaded. Reload the page and try again.");
            });
        }
        return parserPromise;
    }
    function existingRows(grid) {
        return grid.children("table").find("tr.grid-row:not(.grid-row-template)").map(function() {
            return JSON.parse($(this).find("textarea:not(.formgrid-editor)").first().val());
        }).get();
    }
    function validate(grid, batch) {
        if (grid.hasClass("readonly") || grid.hasClass("disabledAdd")) throw new Error("Adding rows is disabled for this grid.");
        rules.validateBatch(batch, existingRows(grid), grid.children(".uniqueKey").val(), parseInt(grid.children("#validateMaxRow").val(), 10));
    }
    function append(grid, batch) {
        validate(grid, batch); // Recheck, because rows can change after preview.
        var table = grid.children("table"), body = table.children("tbody"), newRows = [];
        var firstIndex = table.find("tr.grid-row:not(.grid-row-template)").length;
        var template = table.find("tr.grid-row-template");
        if (template.length !== 1 || !body.length) throw new Error("The grid row template is unavailable. Reload the form.");
        // Build the whole batch off the DOM; a formatting failure leaves the grid unchanged.
        batch.rows.forEach(function(data, index) {
            var values = $.extend({}, data, {id: window.monarchUtils.generateUUID()});
            var row = template.clone().removeClass("grid-row-template").addClass("grid-row").show();
            row.find(".grid-checkbox-children").prop("checked", false);
            $.formGridCustom.decorateRow(row);
            $.formGridCustom.fillValue(grid, row, JSON.stringify(values));
            // updateRowIndex reads the enclosing grid's name and ID.
            newRows.push(row);
        });
        newRows.forEach(function(row) { body.append(row); });
        newRows.forEach(function(row, index) { $.formGridCustom.updateRowIndex(row, firstIndex + index); });
        $.formGridCustom.disabledMoveAction(table);
        $.formGridCustom.showHidePlusIcon(grid);
        grid.trigger("change"); // Existing paging and form listeners see one completed import.
    }

    $.fn.formGridImport = function(options) {
        return this.each(function() {
            var grid = $(this), panel = grid.children(".formgrid-import-panel");
            if (!panel.length || grid.data("shadow-import-initialized")) return;
            grid.data("shadow-import-initialized", true);
            var fileInput = panel.find(".formgrid-import-file"), sheetSelect = panel.find(".formgrid-import-sheet");
            var status = panel.find(".formgrid-import-status"), preview = panel.find(".formgrid-import-preview");
            var confirm = panel.find(".formgrid-import-confirm"), workbook, library, batch, generation = 0;
            var pagination = panel.find(".formgrid-import-pagination"), sizeSelect = panel.find(".formgrid-import-page-size");
            var previous = panel.find(".formgrid-import-previous"), next = panel.find(".formgrid-import-next");
            var previewPage = 1, previewPageSize = 10;
            sizeSelect.val(String(previewPageSize));

            function report(message, error) {
                status.text(message).toggleClass("form-error-message", !!error).attr("role", error ? "alert" : "status");
            }
            function reset() {
                generation++;
                workbook = null;
                batch = null;
                fileInput.val("");
                sheetSelect.empty();
                panel.find(".formgrid-import-sheet-label").prop("hidden", true);
                preview.empty();
                pagination.prop("hidden", true);
                previewPage = 1;
                confirm.prop("disabled", true);
                report("");
            }
            function renderPreviewPage() {
                if (!batch) return;
                preview.empty();
                var pageCount = Math.ceil(batch.rows.length / previewPageSize);
                previewPage = Math.max(1, Math.min(previewPage, pageCount));
                var start = (previewPage - 1) * previewPageSize;
                var end = Math.min(start + previewPageSize, batch.rows.length);
                var table = $("<table class='formgrid-import-preview-table'></table>");
                var header = $("<tr></tr>").append($("<th scope='col'></th>").text("No."));
                batch.columns.forEach(function(c) { header.append($("<th scope='col'></th>").text(c.label ? c.label + " (" + c.id + ")" : c.id)); });
                table.append($("<thead></thead>").append(header));
                var body = $("<tbody></tbody>");
                batch.rows.slice(start, end).forEach(function(row, index) {
                    var tr = $("<tr></tr>").append($("<td></td>")
                        .attr("title", "File row " + batch.rowNumbers[start + index])
                        .text(start + index + 1));
                    batch.columns.forEach(function(c) { tr.append($("<td></td>").text(row[c.id])); });
                    body.append(tr);
                });
                preview.append(table.append(body));
                pagination.prop("hidden", false);
                panel.find(".formgrid-import-page-info").text("Showing " + (start + 1) + "–" + end + " of " + batch.rows.length + " rows. Page " + previewPage + " of " + pageCount + ".");
                previous.prop("disabled", previewPage === 1);
                next.prop("disabled", previewPage === pageCount);
                preview.scrollTop(0);
            }
            function showPreview() {
                batch = null;
                previewPage = 1;
                confirm.prop("disabled", true);
                preview.empty();
                pagination.prop("hidden", true);
                try {
                    batch = rules.parseSheet(library, workbook, sheetSelect.val(), options.columns, options.sortField);
                    validate(grid, batch);
                    renderPreviewPage();
                    report(batch.rows.length + " rows ready to append."
                        + (batch.ignored.length ? " Ignored system columns: " + batch.ignored.join(", ") + "." : ""));
                    confirm.prop("disabled", false);
                } catch (error) { batch = null; report(error.message, true); }
            }
            sizeSelect.on("change.shadowImport", function(event) {
                event.stopPropagation();
                var size = Number($(this).val());
                if ([10,20,50,100].indexOf(size) === -1) return;
                previewPageSize = size;
                previewPage = 1;
                renderPreviewPage();
            });
            previous.on("click.shadowImport", function(event) {
                event.preventDefault();
                event.stopPropagation();
                if (!this.disabled) { previewPage--; renderPreviewPage(); }
            });
            next.on("click.shadowImport", function(event) {
                event.preventDefault();
                event.stopPropagation();
                if (!this.disabled) { previewPage++; renderPreviewPage(); }
            });
            grid.children(".formgrid-import-open").on("click.shadowImport", function() {
                panel.prop("hidden", false);
                $(this).attr("aria-expanded", "true");
                fileInput.trigger("focus");
            });
            panel.find(".formgrid-import-cancel").on("click.shadowImport", function() {
                reset();
                panel.prop("hidden", true);
                grid.children(".formgrid-import-open").attr("aria-expanded", "false").trigger("focus");
            });
            fileInput.on("change.shadowImport", function(event) {
                event.stopPropagation();
                var file = this.files && this.files[0], current = ++generation;
                batch = null;
                workbook = null;
                preview.empty();
                previewPage = 1;
                pagination.prop("hidden", true);
                sheetSelect.empty();
                panel.find(".formgrid-import-sheet-label").prop("hidden", true);
                confirm.prop("disabled", true);
                if (!file) { report(""); return; }
                try { rules.checkFile(file); } catch (error) { report(error.message, true); return; }
                report("Reading file...");
                Promise.all([file.arrayBuffer(), parser(options.libraryUrl)]).then(function(results) {
                    if (generation !== current) return;
                    library = results[1];
                    workbook = rules.readWorkbook(library, results[0]);
                    if (!workbook.SheetNames.length) throw new Error("No worksheets were found.");
                    workbook.SheetNames.forEach(function(name) { sheetSelect.append($("<option></option>").val(name).text(name)); });
                    panel.find(".formgrid-import-sheet-label").prop("hidden", workbook.SheetNames.length < 2);
                    showPreview();
                }).catch(function(error) { if (generation === current) report(error.message || "Unable to read the file.", true); });
            });
            sheetSelect.on("change.shadowImport", function(event) { event.stopPropagation(); showPreview(); });
            confirm.on("click.shadowImport", function() {
                if (!batch) return;
                confirm.prop("disabled", true);
                try {
                    var count = batch.rows.length;
                    append(grid, batch);
                    reset();
                    report(count + " rows imported. Save the form to persist them.");
                } catch (error) { report(error.message, true); }
            });
            panel.find(".formgrid-import-template").on("click.shadowImport", function(event) {
                event.preventDefault();
                event.stopPropagation();
                var button = $(this);
                if (button.prop("disabled")) return;
                button.prop("disabled", true);
                Promise.resolve().then(function() { return parser(options.libraryUrl); }).then(function(xlsx) {
                    var template = rules.templateWorkbook(xlsx, options.columns, options.sortField);
                    var bytes = xlsx.write(template, {type: "array", bookType: "xlsx"});
                    var url = window.URL.createObjectURL(new Blob([bytes], {type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}));
                    var link = window.document.createElement("a");
                    link.href = url;
                    link.download = "form-grid-template.xlsx";
                    link.hidden = true;
                    // Userview delegates link clicks to its router. Preserve the browser's
                    // download action, but do not let the blob URL reach that router.
                    link.addEventListener("click", function(downloadEvent) {
                        downloadEvent.stopImmediatePropagation();
                    });
                    window.document.body.appendChild(link);
                    try {
                        link.click();
                    } finally {
                        link.remove();
                        window.setTimeout(function() { window.URL.revokeObjectURL(url); }, 1000);
                    }
                }).catch(function(error) { report(error.message, true); }).finally(function() { button.prop("disabled", false); });
            });
        });
    };
})(jQuery, window);
