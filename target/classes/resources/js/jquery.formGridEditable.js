(function($) {
    'use strict';

    function jsonField(row) { return row.find('textarea').not('.formgrid-editor').first(); }
    function read(row) { return JSON.parse(jsonField(row).val()); }
    function string(value) { return value == null ? '' : String(value); }
    function writable(grid) { return !grid.hasClass('readonly'); }

    // Native date inputs use ISO; only unambiguous date-only storage patterns are editable.
    function dateCodec(pattern) {
        var parts = pattern.match(/yyyy|MM|dd|M|d|[^a-zA-Z]+/g);
        if (!parts || parts.join('') !== pattern || parts.filter(function(p) { return p === 'yyyy'; }).length !== 1 ||
                parts.filter(function(p) { return /^M+$/.test(p); }).length !== 1 ||
                parts.filter(function(p) { return /^d+$/.test(p); }).length !== 1) return null;
        var keys = [], regex = parts.map(function(p) {
            if (/^(yyyy|MM?|dd?)$/.test(p)) { keys.push(p[0]); return p === 'yyyy' ? '(\\d{4})' : '(\\d{1,2})'; }
            return p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        }).join('');
        return {
            decode: function(value) {
                if (!value) return '';
                var match = value.match(new RegExp('^' + regex + '$')), values = {};
                if (!match) return null;
                keys.forEach(function(k, i) { values[k] = match[i + 1].padStart(k === 'y' ? 4 : 2, '0'); });
                var iso = values.y + '-' + values.M + '-' + values.d;
                var date = new Date(iso + 'T00:00:00Z');
                return !isNaN(date) && date.toISOString().slice(0, 10) === iso ? iso : null;
            },
            encode: function(value) {
                if (!value) return '';
                var values = {y: value.slice(0, 4), M: value.slice(5, 7), d: value.slice(8, 10)};
                return parts.map(function(p) { return /^(yyyy|MM?|dd?)$/.test(p) ? (p.length === 1 ? String(Number(values[p[0]])) : values[p[0]]) : p; }).join('');
            }
        };
    }

    $.fn.formGridEditable = function(settings) {
        return this.each(function() {
            var grid = $(this), columns = settings.columns || [], pending = 0;
            if (!writable(grid) || grid.data('formGridEditable')) return;
            grid.data('formGridEditable', true).addClass('formgrid-editable');

            function error(message) {
                grid.children('.grid-validation-error').show().find('.error-content').text(message);
            }
            function commit(row, column, value, paths) {
                if (!writable(grid)) return false;
                var data = read(row), uniqueKey = grid.children('.uniqueKey').val();
                if (column.id === uniqueKey && value && grid.children('table').find('tr.grid-row').toArray().some(function(other) {
                    return other !== row[0] && string(read($(other))[uniqueKey]).trim().toLowerCase() === string(value).trim().toLowerCase();
                })) {
                    var message = grid.children('.uniqueKeyMessage').val() || '{column} column must have a unique value: {value}';
                    error(message.replace(/\{column\}/g, function() { return column.label || column.id; }).replace(/\{value\}/g, function() { return value; }));
                    return false;
                }
                data[column.id] = value;
                if (paths) {
                    data._tempFilePathMap = data._tempFilePathMap || {};
                    data._tempFilePathMap[column.id] = paths;
                }
                if (data._decryptedDataMap) delete data._decryptedDataMap[column.id];
                // Popup callbacks can include request parameters used by inner binders.
                if (data._tempRequestParamsMap) {
                    data._tempRequestParamsMap[column.id] = column.multiple ? (value ? value.split(';') : []) : [value];
                    if (column.paramName) data._tempRequestParamsMap[column.paramName + '_path'] = paths || [];
                }
                var json = JSON.stringify(data);
                jsonField(row).val(json);
                row.data('editableJson', json);
                grid.children('.grid-validation-error').hide();
                grid.trigger('change');
                return true;
            }
            function optionMap(column) {
                var source = column.options || {};
                if (!source.OPTIONS_USE_AJAX) return source;
                var map = {}, list = source.OPTIONS || [];
                if (typeof list === 'string') list = JSON.parse(list);
                list.forEach(function(option) { map[option.value] = option.label; });
                return map;
            }
            function populate(input, options, value, multiple) {
                var selected = multiple ? (value ? value.split(';') : []) : [value];
                input.empty();
                if (!multiple) input.append($('<option>').val('').text(''));
                Object.keys(options).forEach(function(key) { input.append($('<option>').val(key).text(options[key])); });
                selected.forEach(function(key) {
                    if (key && !Object.prototype.hasOwnProperty.call(options, key)) input.append($('<option>').val(key).text(key));
                });
                input.val(multiple ? selected : value);
            }
            function loadOptions(row, column, input, resetInvalid) {
                var source = column.options || {};
                if (!source.OPTIONS_USE_AJAX) return;
                var data = read(row);
                var control = string(source.OPTIONS_AJAX_CONTROL_FIELD).split(';').map(function(id) { return string(data[id.trim()]); }).join(';');
                var requestId = (input.data('optionRequest') || 0) + 1;
                input.data('optionRequest', requestId);
                input.prop('disabled', true);
                var context = grid.children('#contextPath').val() || '';
                $.getJSON(context + '/web/json/app/' + encodeURIComponent(source.OPTIONS_AJAX_APP_ID) + '/' + encodeURIComponent(source.OPTIONS_AJAX_APP_VERSION) + '/form/options', {
                    _dv: control, _n: source.OPTIONS_AJAX_NONCE, _bd: source.OPTIONS_AJAX_BINDER_DATA
                }).done(function(list) {
                    if (input.data('optionRequest') !== requestId || !$.contains(row[0], input[0])) return;
                    var map = {};
                    list.forEach(function(option) { map[option.value] = option.label; });
                    var value = string(read(row)[column.id]);
                    if (resetInvalid && value) {
                        var next = value.split(';').filter(function(key) { return Object.prototype.hasOwnProperty.call(map, key); }).join(';');
                        if (next !== value && commit(row, column, next)) value = next;
                    }
                    populate(input, map, value, column.multiple);
                }).fail(function() { error('Unable to load options for ' + (column.label || column.id) + '. Please retry or use Edit Row.'); })
                    .always(function() { if (input.data('optionRequest') === requestId) input.prop('disabled', !writable(grid)); });
            }
            function upload(row, column, input, display) {
                var files = Array.from(input[0].files || []);
                if (!files.length || !writable(grid)) return;
                var limit = Number(column.maxSize) * 1024;
                if (limit > 0 && files.some(function(file) { return file.size > limit; })) {
                    error(column.maxSizeMsg || 'The selected file exceeds the configured size limit.');
                    input.val(''); return;
                }
                pending++;
                grid.data('editableUploads', pending);
                var form = grid.closest('form'), uploadState = form.data('editableUploadState');
                if (!uploadState) {
                    uploadState = {count: 0, buttons: form.find(':submit').toArray().map(function(button) { return {button: button, disabled: button.disabled}; })};
                    form.data('editableUploadState', uploadState);
                }
                uploadState.count++;
                uploadState.buttons.forEach(function(item) { item.button.disabled = true; });
                input.prop('disabled', true).attr('aria-busy', 'true');
                var uploaded = [];
                // The standard Joget FileUpload service accepts one file per request.
                var task = Promise.resolve();
                files.forEach(function(file) {
                    task = task.then(function() {
                        var body = new FormData();
                        body.append(column.paramName, file);
                        return $.ajax({url: column.uploadUrl, type: 'POST', data: body, processData: false, contentType: false, dataType: 'json'});
                    }).then(function(response) {
                        if (response.error || !response.path || !response.newFilename) throw new Error(response.error || 'File upload failed.');
                        uploaded.push(response);
                    });
                });
                task.then(function() {
                    if (!$.contains(grid[0], row[0]) || !writable(grid)) return;
                    var data = read(row);
                    var paths = column.multiple ? ((data._tempFilePathMap || {})[column.id] || []).slice() : [];
                    var names = column.multiple && data[column.id] ? string(data[column.id]).split(';') : [];
                    uploaded.forEach(function(file) { names.push(file.newFilename); paths.push(file.path); });
                    if (commit(row, column, names.join(';'), paths)) display.text(names.join(', '));
                }).catch(function(problem) { error(problem.message || 'File upload failed. Please retry.'); })
                    .finally(function() {
                        pending--;
                        grid.data('editableUploads', pending);
                        uploadState.count--;
                        if (!uploadState.count) {
                            uploadState.buttons.forEach(function(item) { item.button.disabled = item.disabled; });
                            form.removeData('editableUploadState');
                        }
                        input.val('').prop('disabled', !writable(grid)).removeAttr('aria-busy');
                    });
            }
            function render(row, force) {
                var json = jsonField(row).val();
                if (!json || (!force && row.data('editableJson') === json)) return;
                var data;
                try { data = JSON.parse(json); } catch (e) { return; }
                row.data('editableJson', json);
                columns.forEach(function(column) {
                    var cell = row.find('span.grid-cell').filter(function() { return $(this).attr('column_key') === column.id; });
                    if (!cell.length || !writable(grid)) return;
                    var value = string(data._decryptedDataMap && data._decryptedDataMap[column.id] !== undefined ? data._decryptedDataMap[column.id] : data[column.id]), input, codec;
                    if (column.editor === 'DatePicker') {
                        codec = dateCodec(column.dateFormat || 'yyyy-MM-dd');
                        if (!codec || codec.decode(value) === null) return;
                        input = $('<input type="date">').val(codec.decode(value));
                    } else if (['SelectBox', 'Radio', 'CheckBox'].indexOf(column.editor) !== -1) {
                        input = $('<select>').prop('multiple', !!column.multiple);
                        populate(input, optionMap(column), value, column.multiple);
                    } else if (column.editor === 'FileUpload') {
                        input = $('<input type="file">').prop('multiple', !!column.multiple);
                        if (column.fileType) input.attr('accept', column.fileType.replace(/;/g, ','));
                    } else {
                        input = column.editor === 'TextArea' ? $('<textarea rows="2">') : $('<input type="text">');
                        input.val(value);
                        if (Number(column.maxlength) > 0) input.attr('maxlength', column.maxlength);
                    }
                    input.addClass('formgrid-editor').attr('aria-label', column.label || column.id).data('column', column);
                    cell.empty().append(input).addClass('formgrid-editable-cell');
                    if (column.editor === 'FileUpload') {
                        var display = $('<span class="formgrid-editable-filenames">').text(value.split(';').join(', '));
                        cell.append(display);
                        input.on('change.formGridEditable', function(event) { event.stopPropagation(); upload(row, column, input, display); });
                    } else {
                        input.on((input.is('select,[type=date]') ? 'change' : 'input') + '.formGridEditable', function(event) {
                            event.stopPropagation();
                            var next = column.multiple ? (input.val() || []).join(';') : string(input.val());
                            if (codec) next = codec.encode(next);
                            if (commit(row, column, next)) {
                                columns.forEach(function(dependent) {
                                    if (string((dependent.options || {}).OPTIONS_AJAX_CONTROL_FIELD).split(';').map(function(id) { return id.trim(); }).indexOf(column.id) !== -1) {
                                        row.find('.formgrid-editor').filter(function() { return $(this).data('column').id === dependent.id; })
                                            .each(function() { loadOptions(row, dependent, $(this), true); });
                                    }
                                });
                            } else {
                                input.val(column.multiple ? value.split(';') : (codec ? codec.decode(string(read(row)[column.id])) : string(read(row)[column.id])));
                            }
                        });
                        input.on('change.formGridEditableBubble', function(event) { event.stopPropagation(); });
                        input.on('keydown.formGridEditable', function(event) {
                            if (event.key === 'Enter' && !input.is('textarea,select')) event.preventDefault();
                        });
                        if (input.is('select')) loadOptions(row, column, input);
                    }
                });
            }
            function refresh() { grid.children('table').find('tr.grid-row').each(function() { render($(this)); }); }
            grid.on('formgrid:rowupdated.formGridEditable', function(event, row) { render($(row), true); });
            grid.on('change.formGridEditable', refresh);
            grid.closest('form').on('submit.formGridEditable', function(event) {
                if (pending) { event.preventDefault(); event.stopImmediatePropagation(); error('Please wait for file uploads to finish before saving.'); }
            });
            refresh();
        });
    };
})(jQuery);
