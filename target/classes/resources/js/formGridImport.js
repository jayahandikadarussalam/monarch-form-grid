/* Pure import rules shared by the browser UI and regression tests. */
(function(root, factory) {
    if (typeof module === "object" && module.exports) module.exports = factory();
    else root.ShadowFormGridImport = factory();
})(typeof window !== "undefined" ? window : this, function() {
    "use strict";
    var MAX_ROWS = 5000, MAX_BYTES = 10 * 1024 * 1024, MAX_COLUMNS = 256;
    var SYSTEM = new Set(["id", "datecreated", "datemodified", "createdby", "createdbyname", "modifiedby", "modifiedbyname"]);
    function normalized(value) { return String(value == null ? "" : value).replace(/^\uFEFF/, "").trim().toLowerCase(); }
    function reserved(id) {
        return SYSTEM.has(normalized(id)) || /^_/.test(id) || /^(constructor|prototype)$/i.test(id);
    }
    function columnsForImport(columns, sortField) {
        var seen = new Set();
        return columns.filter(function(column) {
            if (!column.id || reserved(column.id) || column.id === sortField) return false;
            var key = normalized(column.id);
            if (seen.has(key)) throw new Error("Duplicate configured Field ID: " + column.id);
            seen.add(key);
            return true;
        });
    }
    function checkFile(file) {
        if (!/\.(xlsx|xls|csv)$/i.test(file.name)) throw new Error("Choose an .xlsx, .xls or .csv file.");
        if (!file.size) throw new Error("The selected file is empty.");
        if (file.size > MAX_BYTES) throw new Error("The file exceeds the 10 MB import limit.");
    }
    function readWorkbook(XLSX, data) {
        return XLSX.read(data, {type: "array", raw: true, cellNF: true, cellDates: false, sheetRows: MAX_ROWS + 2});
    }
    function mapHeaders(headers, columns, sortField) {
        var used = new Set(), ignored = [], matched = [];
        var mapping = headers.map(function(header) {
            var name = normalized(header), candidates;
            if (!name) return null;
            // Prefer actual IDs over labels. c_name is accepted for DB-exported CSVs.
            candidates = columns.filter(function(c) { return normalized(c.id) === name; });
            if (!candidates.length) candidates = columns.filter(function(c) { return "c_" + normalized(c.id) === name; });
            if (!candidates.length) candidates = columns.filter(function(c) { return normalized(c.label) === name; });
            if (!candidates.length) {
                if (SYSTEM.has(name) || name === normalized(sortField) || name === "c_" + normalized(sortField)) {
                    ignored.push(String(header));
                    return null;
                }
                throw new Error('Unknown header "' + header + '". Use a configured Field ID, label, or c_FieldID.');
            }
            if (candidates.length > 1) throw new Error('Ambiguous header "' + header + '". Use its Field ID.');
            var column = candidates[0];
            if (used.has(column.id)) throw new Error("More than one header maps to " + column.id + ".");
            used.add(column.id);
            matched.push(column);
            return column;
        });
        if (!matched.length) throw new Error("No configured columns were found in the header row.");
        return {mapping: mapping, columns: matched, ignored: ignored};
    }
    function formatDate(parts, pattern) {
        var pad = function(n) { return String(n).padStart(2, "0"); };
        var tokens = {yyyy: String(parts.y), yy: pad(parts.y % 100), M: String(parts.m), MM: pad(parts.m),
            d: String(parts.d), dd: pad(parts.d), H: String(parts.H), HH: pad(parts.H),
            h: String(parts.H % 12 || 12), hh: pad(parts.H % 12 || 12),
            m: String(parts.M), mm: pad(parts.M), s: String(Math.floor(parts.S)), ss: pad(Math.floor(parts.S)),
            a: parts.H < 12 ? "AM" : "PM"};
        return (pattern || "yyyy-MM-dd").replace(/'([^']|'')*'|([a-zA-Z]+)/g, function(token) {
            if (token[0] === "'") return token.slice(1, -1).replace(/''/g, "'");
            return token.match(/([a-zA-Z])\1*/g).map(function(part) {
                if (tokens[part] === undefined) throw new Error("Unsupported date storage format: " + pattern + ". Import the date as text in that format.");
                return tokens[part];
            }).join("");
        });
    }
    function cellValue(XLSX, cell, column, date1904, rowNumber) {
        if (!cell) return "";
        if (cell.t === "e") throw new Error("Spreadsheet error at row " + rowNumber + ", column " + column.id + ".");
        if (cell.f && cell.v == null) throw new Error("Formula without a cached value at row " + rowNumber + ". Recalculate and save the workbook first.");
        if (cell.v == null) return "";
        var value;
        if (column.type === "date" && cell.t === "n") {
            var parts = XLSX.SSF.parse_date_code(cell.v, {date1904: date1904});
            if (!parts || parts.y < 1900 || (parts.y === 1900 && parts.m === 2 && parts.d === 29)) {
                throw new Error("Invalid Excel date at row " + rowNumber + ".");
            }
            value = formatDate(parts, column.dateFormat);
        } else if (cell.t === "n" && column.type !== "decimal" && column.type !== "currency") {
            value = XLSX.utils.format_cell(cell); // Keep numeric text masks such as 000123.
        } else value = String(cell.v);
        if ((column.type === "file" || column.type === "image") && value.trim()) {
            throw new Error("Row " + rowNumber + ": leave " + column.id + " empty. Upload attachments through Add/Edit Row.");
        }
        if (column.type === "html") {
            // Spreadsheet content is text, including in an HTML display column.
            value = value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
        }
        return value;
    }
    function parseSheet(XLSX, workbook, sheetName, configuredColumns, sortField) {
        var sheet = workbook.Sheets[sheetName];
        if (!sheet || !sheet["!ref"]) throw new Error("The worksheet is empty.");
        var range = XLSX.utils.decode_range(sheet["!fullref"] || sheet["!ref"]);
        if (range.e.r - range.s.r > MAX_ROWS) throw new Error("The worksheet exceeds the 5000 row import limit.");
        if (range.e.c - range.s.c + 1 > MAX_COLUMNS) throw new Error("The worksheet exceeds the 256 column import limit.");
        var columns = columnsForImport(configuredColumns, sortField);
        var matrix = XLSX.utils.sheet_to_json(sheet, {header: 1, raw: true, defval: "", blankrows: true});
        var start = 0;
        while (start < matrix.length && matrix[start].every(function(v) { return String(v).trim() === ""; })) start++;
        if (start === matrix.length) throw new Error("The worksheet is empty.");
        var headers = matrix[start], result = mapHeaders(headers, columns, sortField), rows = [], rowNumbers = [];
        for (var r = start + 1; r < matrix.length; r++) {
            var row = Object.create(null), nonempty = false;
            columns.forEach(function(c) { row[c.id] = ""; });
            for (var c = 0; c < Math.max(headers.length, matrix[r].length); c++) {
                if (!result.mapping[c]) {
                    if (!normalized(headers[c]) && String(matrix[r][c] == null ? "" : matrix[r][c]).trim()) {
                        throw new Error("A populated column has no header at row " + (range.s.r + r + 1) + ".");
                    }
                    continue;
                }
                var cell = sheet[XLSX.utils.encode_cell({r: range.s.r + r, c: range.s.c + c})];
                row[result.mapping[c].id] = cellValue(XLSX, cell, result.mapping[c], !!(workbook.Workbook && workbook.Workbook.WBProps && workbook.Workbook.WBProps.date1904), range.s.r + r + 1);
                if (row[result.mapping[c].id].trim()) nonempty = true;
            }
            if (nonempty) { rows.push(row); rowNumbers.push(range.s.r + r + 1); }
        }
        if (!rows.length) throw new Error("No data rows were found below the headers.");
        return {rows: rows, rowNumbers: rowNumbers, columns: result.columns, ignored: result.ignored};
    }
    function validateBatch(batch, existing, uniqueKey, maxRows) {
        if (Number.isFinite(maxRows) && existing.length + batch.rows.length > maxRows) {
            throw new Error("Import would exceed the maximum of " + maxRows + " rows (" + existing.length + " existing, " + batch.rows.length + " imported).");
        }
        if (!uniqueKey) return;
        var seen = new Set(existing.map(function(row) { return String(row[uniqueKey] == null ? "" : row[uniqueKey]).trim(); }).filter(Boolean));
        batch.rows.forEach(function(row, index) {
            var value = String(row[uniqueKey] == null ? "" : row[uniqueKey]).trim();
            if (!value) throw new Error("Row " + batch.rowNumbers[index] + ": Unique Column " + uniqueKey + " must have a value.");
            if (seen.has(value)) throw new Error("Row " + batch.rowNumbers[index] + ": duplicate " + uniqueKey + ' "' + value + '".');
            seen.add(value);
        });
    }
    function templateWorkbook(XLSX, columns, sortField) {
        var headers = columnsForImport(columns, sortField).filter(function(c) { return c.type !== "file" && c.type !== "image"; });
        if (!headers.length) throw new Error("Configure at least one importable column first.");
        var workbook = XLSX.utils.book_new();
        var sheet = XLSX.utils.aoa_to_sheet([headers.map(function(c) { return c.id; })]);
        sheet["!cols"] = headers.map(function(c) { return {wch: Math.max(20, Math.min(40, c.id.length + 4))}; });
        XLSX.utils.book_append_sheet(workbook, sheet, "Import_Data");
        return workbook;
    }
    return {MAX_ROWS: MAX_ROWS, MAX_BYTES: MAX_BYTES, checkFile: checkFile, readWorkbook: readWorkbook,
        parseSheet: parseSheet, validateBatch: validateBatch, templateWorkbook: templateWorkbook, formatDate: formatDate};
});
