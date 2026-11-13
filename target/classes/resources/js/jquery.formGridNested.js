(function($) {
    'use strict';
    var nextId = 0;
    function text(value) { return value == null ? '' : String(value); }
    function rows(grid) { return grid.children('table').find('tr.grid-row'); }
    function read(row) {
        var value = JSON.parse(row.find('textarea:not(.formgrid-editor)').first().val());
        if (!value || Array.isArray(value) || typeof value !== 'object') throw new Error('Invalid grid row data.');
        return value;
    }
    function button(label, className, action) {
        return $('<button type="button">').addClass(className).text(label).attr('aria-label', label)
            .on('click.formGridNested', function(event) { event.preventDefault(); event.stopPropagation(); action(); });
    }

    $.fn.formGridNested = function(settings) {
        return this.each(function() {
            var root = $(this);
            if (root.attr('data-builder-design') === 'true' || root.data('formGridNested')) return;
            var scope = root.closest('div.subform-container, form');
            if (!scope.length) scope = root.parent();
            var rootId = root.children('.formgrid-field-id').val() || root.attr('name');
            var nodes = new Map(), children = new Map(), expanded = new Set(), detailId = ++nextId;
            var pagination = new WeakMap();
            var importers = new WeakMap();
            var paginationThreshold = settings.paginationThreshold === undefined ? 10 : settings.paginationThreshold;
            var bulkExpanded = false;
            var status = $('<div class="formgrid-nested-status form-error-message" role="alert" hidden>').prependTo(root);
            function error(message) { status.text(message).prop('hidden', !message); }
            function direct(id) { return children.get(id) || []; }
            function canWrite(grid) { return !settings.readonly && !root.hasClass('readonly') && !grid.hasClass('readonly'); }
            function findGrid(id) {
                return scope.find('.formgrid-custom').filter(function() {
                    return $(this).children('.formgrid-field-id').val() === id &&
                        $(this).closest('div.subform-container, form')[0] === root.closest('div.subform-container, form')[0];
                });
            }
            try {
                nodes.set(rootId, {grid: root, gridId: rootId});
                var relations = settings.relations || [];
                if (!relations.length) throw new Error('Add at least one child grid in Child Tables / Subgrids.');
                relations.forEach(function(config) {
                    var node = {
                        gridId: text(config.gridId).trim(), formDefId: text(config.formDefId).trim(),
                        parentGridId: text(config.parentGridId).trim() || rootId,
                        parentKey: text(config.parentKey).trim() || 'id', foreignKey: text(config.foreignKey).trim(),
                        sortWithButtons: text(config.sortWithButtons).trim() || 'false',
                        sortField: text(config.sortField).trim() || 'sort',
                        enableDuplicate: text(config.enableDuplicate).trim() || 'false',
                        disabledDuplicate: text(config.disabledDuplicate).trim() || 'false'
                    };
                    ['sortWithButtons', 'enableDuplicate', 'disabledDuplicate'].forEach(function(key) {
                        if (['true', 'false'].indexOf(node[key]) === -1) throw new Error('Invalid ' + key + ' for child grid: ' + node.gridId);
                    });
                    if (node.sortWithButtons === 'true' && (!/^[a-zA-Z0-9_]+$/.test(node.sortField) || node.sortField === 'id' || node.sortField === node.foreignKey))
                        throw new Error('Invalid Sort Field for child grid: ' + node.gridId);
                    ['gridId', 'parentGridId', 'parentKey', 'foreignKey'].forEach(function(key) {
                        if (!/^[a-zA-Z0-9_]+$/.test(node[key])) throw new Error('Invalid ' + key + ' in nested subgrid configuration.');
                    });
                    if (nodes.has(node.gridId)) throw new Error('Duplicate or self-referencing child grid: ' + node.gridId);
                    node.grid = findGrid(node.gridId);
                    if (node.grid.length !== 1) throw new Error('Child Grid ID must identify one Shadow Form Grid in the same form: ' + node.gridId +
                        '. Add a Shadow Form Grid element with this ID; select its Form separately using Child Form ID.');
                    node.label = text(node.grid.children('.formgrid-field-label').val()).trim() || node.gridId;
                    if (node.formDefId && node.grid.children('.formgrid-form-id').val() !== node.formDefId)
                        throw new Error('Child Form ID mismatch for ' + node.gridId + ': expected ' + node.formDefId +
                            '. Save the nested mapping and reload the containing form.');
                    if (node.grid.data('nestedOwner') || node.grid.children('.formgrid-nested-config').length)
                        throw new Error('Configure nesting only on the root grid. Child grid is already nested: ' + node.gridId);
                    node.loader = node.grid.children('.formgrid-nested-load');
                    node.loads = new Map();
                    node.baselineCounts = new Map();
                    nodes.set(node.gridId, node);
                    if (!children.has(node.parentGridId)) children.set(node.parentGridId, []);
                    children.get(node.parentGridId).push(node);
                });
                nodes.forEach(function(node, id) {
                    var visited = new Set([id]), current = node;
                    while (current.parentGridId) {
                        if (visited.has(current.parentGridId)) throw new Error('Circular nested grid relationship: ' + id);
                        visited.add(current.parentGridId);
                        current = nodes.get(current.parentGridId);
                        if (!current) throw new Error('Unknown Parent Grid ID for ' + id);
                    }
                });
            } catch (problem) { error(problem.message); return; }

            function loadState(node, key) {
                return !node.loader || !node.loader.length || !key ? 'loaded' : node.loads.get(key);
            }
            function loadChildren(node, key) {
                if (loadState(node, key) === 'loaded' || loadState(node, key) === 'loading') return;
                node.loads.set(key, 'loading');
                $.ajax({url: node.loader.attr('data-url'), method: 'POST', dataType: 'json',
                    data: {token: node.loader.val(), parentKey: key}}).done(function(result) {
                    try {
                        if (!result || !Array.isArray(result.rows)) throw new Error('Invalid child data');
                        var table = node.grid.children('table'), existing = new Set();
                        rows(node.grid).each(function() { existing.add(text(read($(this)).id)); });
                        result.rows.forEach(function(data) {
                            if (!data || text(data[node.foreignKey]) !== key || !data.id) throw new Error('Invalid child row');
                        });
                        // Populate the canonical source without invoking Add or its popup/readonly checks.
                        result.rows.forEach(function(data) {
                            if (existing.has(text(data.id))) return;
                            var row = table.find('tr.grid-row-template').first().clone().removeAttr('id')
                                .removeClass('grid-row-template').addClass('grid-row').show();
                            $.formGridCustom.decorateRow(row);
                            $.formGridCustom.fillValue(node.grid, row, JSON.stringify(data));
                            table.children('tbody').first().append(row);
                            existing.add(text(data.id));
                        });
                        node.loads.set(key, 'loaded');
                        if (typeof result.total === 'number' && isFinite(result.total)) node.baselineTotal = result.total;
                        node.baselineCounts.set(key, result.rows.length);
                        node.grid.children('.formgrid-nested-loaded').val(JSON.stringify(Array.from(node.loads.keys()).filter(function(parent) {
                            return node.loads.get(parent) === 'loaded';
                        })));
                        node.grid.formGridCustom('refreshIndex');
                        if (bulkExpanded && direct(node.gridId).length) rows(node.grid).each(function() { expanded.add(this); });
                        node.grid.trigger('change');
                    } catch (problem) { node.loads.set(key, 'error'); refresh(); }
                }).fail(function(xhr) { node.loadExpired = xhr && xhr.status === 410; node.loads.set(key, 'error'); refresh(); });
            }
            function matching(node, parentRow) {
                var key = text(read(parentRow)[node.parentKey]);
                if (!key) return $();
                return rows(node.grid).filter(function() { return text(read($(this))[node.foreignKey]) === key; });
            }
            function hasChildren(id, row) {
                return direct(id).some(function(node) { return matching(node, row).length > 0; });
            }
            function validateData() {
                var problems = [];
                nodes.forEach(function(node, id) {
                    if (node.loads && Array.from(node.loads.values()).indexOf('loading') !== -1)
                        problems.push('Wait for child rows to finish loading before saving.');
                    direct(id).forEach(function(child) {
                        var keys = new Set();
                        rows(node.grid).each(function() {
                            var key = text(read($(this))[child.parentKey]);
                            if (!key) problems.push(id + ': Parent Key Field "' + child.parentKey + '" is empty.');
                            else if (keys.has(key)) problems.push(id + ': Parent Key Field "' + child.parentKey + '" must be unique.');
                            else keys.add(key);
                        });
                        rows(child.grid).each(function(index) {
                            var key = text(read($(this))[child.foreignKey]);
                            if (!key || !keys.has(key)) problems.push(child.gridId + ', row ' + (index + 1) + ': Foreign key "' + child.foreignKey + '" has no matching parent.');
                        });
                    });
                    var sourceError = node.grid.children('.grid-validation-error');
                    if (id !== rootId && sourceError.css('display') !== 'none' && sourceError.text().trim())
                        problems.push(id + ': ' + sourceError.text().trim());
                    if (id !== rootId) node.grid.closest('.form-cell').children('label').find('.form-error-message').each(function() {
                        if ($(this).text().trim()) problems.push(id + ': ' + $(this).text().trim());
                    });
                });
                return Array.from(new Set(problems)).join(' ');
            }
            function canAdd(node) {
                $.formGridCustom.showHidePlusIcon(node.grid);
                return canWrite(node.grid) && !node.grid.hasClass('disabledAdd') &&
                    !node.grid.children('.formgrid-custom-add').prop('disabled');
            }
            function canSort(node) {
                return node.sortWithButtons === 'true';
            }
            function pageState(node, parentRow) {
                var states = pagination.get(parentRow[0]);
                if (!states) { states = new Map(); pagination.set(parentRow[0], states); }
                if (!states.has(node.gridId)) {
                    var options = node.grid.children('table').data('pagingOptions') || {};
                    var size = Number(options.size);
                    states.set(node.gridId, {page: 1, size: isFinite(size) && size >= 1 ? Math.floor(size) : 20});
                }
                return states.get(node.gridId);
            }
            function preserveImports(container) {
                container.find('.formgrid-nested-import').each(function() {
                    var host = $(this), session = host.data('nestedImportSession');
                    if (session) session.open.detach();
                    host.detach();
                });
            }
            function importSession(node, parentRow) {
                var options = node.grid.data('shadow-import-options');
                if (!options || !$.fn.formGridImport) return null;
                var sessions = importers.get(parentRow[0]);
                if (!sessions) { sessions = new Map(); importers.set(parentRow[0], sessions); }
                if (sessions.has(node.gridId)) return sessions.get(node.gridId);
                var key = text(read(parentRow)[node.parentKey]);
                var token = 'nested_import_' + detailId + '_' + (++nextId);
                var panel = node.grid.children('.formgrid-import-panel').clone(false, false);
                if (!panel.length) return null;
                panel.find('[id]').removeAttr('id');
                panel.attr({id: token + '_panel', 'aria-labelledby': token + '_title'}).prop('hidden', true);
                panel.find('.formgrid-import-heading h4').attr('id', token + '_title');
                var open = node.grid.children('.formgrid-import-open').clone(false, false)
                    .removeAttr('id').addClass('formgrid-nested-import-open')
                    .attr({'aria-controls': token + '_panel', 'aria-expanded': 'false'});
                var host = $('<div class="formgrid-nested-import">').append(panel);
                var session = {host: host, open: open};
                host.data('nestedImportSession', session);
                host.formGridImport($.extend({}, options, {
                    targetGrid: node.grid, panel: panel, openButton: open,
                    // The immediate parent FK is supplied by the nested view, never by the file.
                    columns: options.columns.filter(function(column) { return column.id !== node.foreignKey; }),
                    sortField: canSort(node) ? node.sortField : options.sortField,
                    checkContext: function() {
                        if (!canWrite(node.grid) || node.grid.hasClass('disabledAdd')) throw new Error('Adding rows is disabled for this grid.');
                        if (!$.contains(scope[0], parentRow[0]) || !key || text(read(parentRow)[node.parentKey]) !== key)
                            throw new Error('The parent row has changed or is unavailable. Reopen the form before importing.');
                        if (loadState(node, key) !== 'loaded') throw new Error('Wait for child rows to finish loading before importing.');
                    },
                    fixedValues: function() { var values = {}; values[node.foreignKey] = key; return values; },
                    existingCount: function() {
                        var count = rows(node.grid).length;
                        if (node.baselineTotal === undefined) return count;
                        node.baselineCounts.forEach(function(loaded) { count -= loaded; });
                        return Math.max(0, node.baselineTotal + count);
                    },
                    beforeCommit: function(batch) {
                        var state = pageState(node, parentRow);
                        state.page = Math.ceil((matching(node, parentRow).not('.fg-hidden').length + batch.rows.length) / state.size);
                    }
                }));
                sessions.set(node.gridId, session);
                return session;
            }
            function addCallback(node, parentRow) {
                var grid = node.grid;
                var callback = grid.attr('id') + '_nested_add_' + detailId;
                // The closure belongs to this popup, so cancelling cannot affect a later regular Add/import.
                window[callback] = function(args) {
                    if (!canAdd(node) || !$.contains(root.closest('form')[0] || scope[0], parentRow[0])) return;
                    var result = JSON.parse(args.result);
                    result[node.foreignKey] = text(read(parentRow)[node.parentKey]);
                    if (result._tempRequestParamsMap) result._tempRequestParamsMap[node.foreignKey] = [result[node.foreignKey]];
                    var callbackArgs = $.extend({}, args, {result: JSON.stringify(result)});
                    $.formGridCustom.showHidePlusIcon(grid);
                    if (grid.children('.formgrid-custom-add').prop('disabled')) return;
                    var state = pageState(node, parentRow);
                    state.page = Math.ceil((matching(node, parentRow).not('.fg-hidden').length + 1) / state.size);
                    grid.formGridCustom('addRow', callbackArgs);
                };
                return callback;
            }
            function addChild(node, parentRow) {
                var grid = node.grid, key = text(read(parentRow)[node.parentKey]);
                if (!key || !canAdd(node)) return;
                var values = {}; values[node.foreignKey] = key;
                grid.formGridCustom('popupForm', grid.attr('id'), grid.children('#formUrl').val(), grid.children('#json').val(),
                    grid.children('#nonce').val(), addCallback(node, parentRow), '{}', JSON.stringify(values), grid.children('#height').val(), grid.children('#width').val());
            }
            function moveChild(node, parentRow, source, direction) {
                if (!canWrite(node.grid) || !canSort(node)) return;
                var siblings = matching(node, parentRow).not('.fg-hidden'), index = siblings.index(source);
                var target = index + direction;
                if (index < 0 || target < 0 || target >= siblings.length) return;
                var state = pageState(node, parentRow);
                state.page = Math.floor(target / state.size) + 1;
                if (direction < 0) source.insertBefore(siblings.eq(target)); else source.insertAfter(siblings.eq(target));
                node.grid.formGridCustom('refreshIndex');
                node.grid.trigger('change');
            }
            function rowActions(node, parentRow, source, index, count) {
                var toolbar = $('<div class="grid-row-actions">'), edit = $('<div class="grid-edit-buttons">');
                function action(kind, icon, label, handler) {
                    return $.formGridCustom.createAction('grid-action-' + kind + ' formgrid-nested-' + kind, icon, label, handler)
                        .on('click.formGridNested', function(event) { event.stopPropagation(); });
                }
                if (!canWrite(node.grid)) return toolbar;
                if (canSort(node)) {
                    toolbar.append($('<div class="grid-reorder-buttons">')
                        .append(action('moveup', 'fa-arrow-up', 'Move Up', function() { moveChild(node, parentRow, source, -1); }).prop('disabled', index === 0))
                        .append(action('movedown', 'fa-arrow-down', 'Move Down', function() { moveChild(node, parentRow, source, 1); }).prop('disabled', index === count - 1)));
                }
                edit.append(action('edit', 'fa-pen', 'Edit Row', function() { source.find('.grid-action-edit').trigger('click'); }));
                if (node.disabledDuplicate !== 'true') edit.append(action('duplicate', 'fa-copy', 'Duplicate Row', function() {
                    if (!canAdd(node) || node.disabledDuplicate === 'true') return;
                    source.find('.grid-action-duplicate').formGridCustom('duplicateRow', {
                        callback: addCallback(node, parentRow), forcePopup: node.enableDuplicate === 'true'
                    });
                }).prop('disabled', !canAdd(node)));
                if (!node.grid.hasClass('disabledDelete')) edit.append(action('delete', 'fa-trash', 'Delete Row', function() {
                    source.find('.grid-action-delete').trigger('click');
                }));
                return toolbar.append(edit);
            }
            function toggle(id, sourceRow, viewRow) {
                var open = expanded.has(sourceRow[0]);
                var control = button(open ? '−' : '+', 'formgrid-nested-toggle', function() {
                    if (expanded.has(sourceRow[0])) expanded.delete(sourceRow[0]); else expanded.add(sourceRow[0]);
                    refresh();
                    root.find('.formgrid-nested-toggle').filter(function() {
                        return $(this).data('nestedSourceRow') === sourceRow[0];
                    }).first().trigger('focus');
                }).data('nestedSourceRow', sourceRow[0]).attr({'aria-expanded': String(open), 'aria-label': open ? 'Collapse subgrids' : 'Expand subgrids'});
                viewRow.children('.formgrid-nested-togglecell').remove();
                viewRow.prepend($('<td class="formgrid-nested-togglecell">').append(control));
            }
            function displayCell(source) {
                var cell = $('<td>'), editor = source.find('.formgrid-editor').first();
                if (editor.length) {
                    cell.text(editor.is('select') ? editor.find('option:selected').map(function() { return $(this).text(); }).get().join(', ') :
                        editor.is('[type=file]') ? source.find('.formgrid-editable-filenames').text() : editor.val());
                } else {
                    var content = source.clone();
                    content.find('input,textarea,select,button,script').remove();
                    content.find('[id],[name]').removeAttr('id name');
                    content.find('.grid-cell').removeClass('grid-cell');
                    cell.append(content.contents());
                }
                return cell;
            }
            function build(id, parentRow, lookup) {
                var content = $('<div class="formgrid-nested-content">');
                direct(id).forEach(function(node) {
                    var section = $('<section class="formgrid-nested-section">').attr('data-child-grid', node.gridId);
                    var heading = $('<div class="formgrid-nested-heading">').append($('<strong>').text(node.label || node.gridId));
                    var headingActions = $('<div class="formgrid-nested-heading-actions">').appendTo(heading);
                    var key = text(read(parentRow)[node.parentKey]);
                    $.formGridCustom.showHidePlusIcon(node.grid);
                    if (canWrite(node.grid) && !node.grid.hasClass('disabledAdd')) {
                        headingActions.append(button('Add', 'btn btn-primary formgrid-nested-add', function() { addChild(node, parentRow); })
                            .prepend('<i class="fas fa-plus" aria-hidden="true"></i> ')
                            .prop('disabled', !key || node.grid.children('.formgrid-custom-add').prop('disabled')));
                    }
                    section.append(heading);
                    if (loadState(node, key) !== 'loaded') {
                        var failed = loadState(node, key) === 'error';
                        heading.find('.formgrid-nested-add').prop('disabled', true);
                        section.append($('<p role="status">').text(failed ?
                            (node.loadExpired ? 'Child data session expired after a plugin update or timeout. Reload the form to continue.' : 'Unable to load child rows.') : 'Loading child rows…'));
                        if (failed) {
                            if (!node.loadExpired) section.append(button('Retry', 'formgrid-nested-retry', function() { loadChildren(node, key); refresh(); }));
                        } else loadChildren(node, key);
                        content.append(section);
                        return;
                    }
                    if (!key) section.append($('<p>').text('Set the parent key before adding child rows.'));
                    if (canWrite(node.grid) && !node.grid.hasClass('disabledAdd') && key) {
                        var importer = importSession(node, parentRow);
                        if (importer) { headingActions.append(importer.open); section.append(importer.host); }
                    }
                    var table = $('<table class="formgrid-nested-table" cellspacing="0">'), header = $('<tr>'), body = $('<tbody>');
                    var fields = [], template = node.grid.children('table').find('tr.grid-row-template').first();
                    var showNumber = canSort(node) || template.find('span.grid-cell.rowNumber').length > 0;
                    if (showNumber) header.append('<th class="formgrid-nested-row-number">No.</th>');
                    template.children('td').each(function(index) {
                        var field = $(this).find('span.grid-cell[column_key]').first();
                        if (field.length && this.style.display !== 'none') {
                            fields.push({key: field.attr('column_key'), index: index});
                            var sourceHeader = node.grid.children('table').find('thead > tr > th').eq(index);
                            header.append($('<th>').text(sourceHeader.text()).css('width', sourceHeader[0] ? sourceHeader[0].style.width : ''));
                        }
                    });
                    if (direct(node.gridId).length) header.prepend('<th class="formgrid-nested-togglecell"></th>');
                    header.append('<th class="formgrid-nested-actions-header" aria-label="Actions"></th>');
                    table.append($('<thead>').append(header), body);
                    var matched = (lookup ? lookup(node, key) : matching(node, parentRow)).not('.fg-hidden');
                    var candidates = matched;
                    var state = pageState(node, parentRow);
                    var search = node.grid.children('.formgrid-search').clone();
                    if (search.length && $.formGridSearch) {
                        search.find('.formgrid-search-input').val(state.query || '')
                            .on('input.formGridNested search.formGridNested change.formGridNested', function(event) {
                                event.stopPropagation();
                                state.query = $(this).val();
                                state.page = 1;
                                renderPage();
                            }).on('keydown.formGridNested', function(event) {
                                if (event.key === 'Enter') event.preventDefault();
                            });
                        section.append(search);
                    }
                    var pager = $('<div class="formgrid-nested-pagination" role="group">').attr('aria-label', (node.label || node.gridId) + ' pagination');
                    var sizeSelect = $('<select class="formgrid-nested-page-size" aria-label="Rows per page">');
                    [10, 20, 50, 100].concat([state.size]).filter(function(value, index, sizes) {
                        return sizes.indexOf(value) === index;
                    }).sort(function(a, b) { return a - b; }).forEach(function(size) {
                        sizeSelect.append($('<option>').val(size).text(size));
                    });
                    sizeSelect.val(String(state.size)).on('change.formGridNested', function(event) {
                        event.stopPropagation();
                        var size = Number($(this).val());
                        if (!isFinite(size) || size < 1) return;
                        state.page = Math.floor(((state.page - 1) * state.size) / size) + 1;
                        state.size = Math.floor(size);
                        renderPage();
                    });
                    var info = $('<span class="formgrid-nested-page-info" role="status" aria-live="polite">');
                    var compactInfo = $('<span class="formgrid-nested-page-summary" aria-hidden="true">');
                    function navigate(page) { state.page = page; renderPage(); }
                    var first = button('«', 'formgrid-nested-page-first', function() { navigate(1); }).attr('aria-label', 'First page');
                    var previous = button('‹', 'formgrid-nested-page-prev', function() { navigate(state.page - 1); }).attr('aria-label', 'Previous page');
                    var next = button('›', 'formgrid-nested-page-next', function() { navigate(state.page + 1); }).attr('aria-label', 'Next page');
                    var last = button('»', 'formgrid-nested-page-last', function() { navigate(Math.ceil(matched.length / state.size)); }).attr('aria-label', 'Last page');
                    pager.append($('<label class="formgrid-nested-page-size-label">').append($('<span>').text('Rows per page'), sizeSelect), info, compactInfo,
                        $('<div class="formgrid-nested-page-actions">').append(first, previous, next, last));
                    function renderPage() {
                        if (search.length && $.formGridSearch) {
                            matched = candidates.filter(function() { return $.formGridSearch.matches($(this), state.query); });
                            // The table already supplies an empty-state row for related records.
                            search.find('.formgrid-search-empty').prop('hidden', true);
                        }
                        var pageSize = matched.length <= paginationThreshold ? Math.max(paginationThreshold, matched.length, 1) : state.size;
                        var pages = Math.max(1, Math.ceil(matched.length / pageSize));
                        state.page = Math.max(1, Math.min(state.page, pages));
                        var start = (state.page - 1) * pageSize, end = Math.min(start + pageSize, matched.length);
                        preserveImports(body);
                        body.empty();
                        // Build only the active page, including expanded descendants.
                        matched.slice(start, end).each(function(offset) {
                            var index = start + offset;
                            var source = $(this), view = $('<tr class="formgrid-nested-row">');
                            if (showNumber) view.append($('<td class="formgrid-nested-row-number">').text(index + 1));
                            var editable = canWrite(node.grid) && node.grid.data('formGridEditableApi');
                            fields.forEach(function(field) {
                                var cell = displayCell(source.children('td').eq(field.index));
                                if (editable) cell.wrapInner($('<span>').attr('data-editable-field', field.key));
                                view.append(cell);
                            });
                            var actions = $('<td class="formgrid-nested-actions">').append(rowActions(node, parentRow, source, index, matched.length));
                            view.append(actions); body.append(view);
                            if (editable) editable.renderRow(source, view);
                            if (direct(node.gridId).length) {
                                toggle(node.gridId, source, view);
                                if (expanded.has(source[0])) body.append($('<tr class="formgrid-nested-detail">')
                                    .append($('<td>').attr('colspan', header.children().length).append(build(node.gridId, source, lookup))));
                            }
                        });
                        if (!matched.length) body.append($('<tr>').append($('<td class="formgrid-nested-empty">')
                            .attr('colspan', header.children().length).text(state.query && search.length ?
                                search.find('.formgrid-search-empty').text() : 'No related records.')));
                        info.text('Showing ' + (matched.length ? start + 1 : 0) + '–' + end + ' of ' + matched.length + ' rows. Page ' + state.page + ' of ' + pages + '.');
                        compactInfo.text((matched.length ? start + 1 : 0) + '–' + end + ' / ' + matched.length);
                        first.add(previous).prop('disabled', state.page === 1);
                        next.add(last).prop('disabled', state.page === pages);
                        pager.prop('hidden', matched.length <= paginationThreshold);
                    }
                    renderPage();
                    section.append($('<div class="formgrid-nested-scroll">').append(table), pager); content.append(section);
                });
                return content;
            }
            function syncVisibility() {
                var indexes = new Map();
                function lookup(node, key) {
                    if (!indexes.has(node.gridId)) {
                        var index = new Map();
                        rows(node.grid).each(function() {
                            var value = text(read($(this))[node.foreignKey]);
                            if (!index.has(value)) index.set(value, []);
                            index.get(value).push(this);
                        });
                        indexes.set(node.gridId, index);
                    }
                    return $(indexes.get(node.gridId).get(key) || []);
                }
                root.children('table').find('tr.formgrid-nested-root-detail').each(function() {
                    var source = $(this).data('parentRow');
                    var visible = !source.hasClass('fg-hidden') && !source.hasClass('pg-tr-hide') && source.css('display') !== 'none';
                    var cell = $(this).children('td');
                    // Keep expansion state across pages without rendering off-page subtrees.
                    if (!visible) { preserveImports(cell); cell.empty(); }
                    else if (!cell.children().length) cell.append(build(rootId, source, lookup));
                    $(this).toggle(visible);
                });
            }
            function expandableRows() {
                var result = [];
                nodes.forEach(function(node, id) {
                    if (direct(id).length) rows(node.grid).not('.fg-hidden').each(function() { result.push(this); });
                });
                return result;
            }
            function refresh() {
                try {
                    var candidates = expandableRows(), current = new Set(candidates);
                    expanded.forEach(function(row) { if (!current.has(row)) expanded.delete(row); });
                    var details = root.children('table').find('tr.formgrid-nested-root-detail');
                    preserveImports(details);
                    details.remove();
                    rows(root).each(function() {
                        var row = $(this); toggle(rootId, row, row);
                        if (expanded.has(this)) row.after($('<tr class="formgrid-nested-root-detail">').data('parentRow', row)
                            .append($('<td>').attr('colspan', row.children().length)));
                    });
                    collapseAll.prop('disabled', expanded.size === 0);
                    expandAll.prop('disabled', candidates.length === 0 || candidates.every(function(row) { return expanded.has(row); }));
                    syncVisibility(); error(validateData());
                } catch (problem) { error(problem.message); }
            }
            var collapseAll = button('Collapse all', 'formgrid-nested-bulk-action formgrid-nested-collapse-all', function() {
                bulkExpanded = false;
                expanded.clear(); refresh();
            });
            var expandAll = button('Expand all', 'formgrid-nested-bulk-action formgrid-nested-expand-all', function() {
                bulkExpanded = true;
                expandableRows().forEach(function(row) { expanded.add(row); });
                refresh();
            });
            $('<div class="formgrid-nested-bulk-actions" role="group" aria-label="Nested subgrid controls">')
                .append(collapseAll, expandAll).insertBefore(root.children('table'));
            root.data('formGridNested', {refresh: refresh}).addClass('formgrid-nested');
            root.children('table').find('thead > tr').prepend('<th class="formgrid-nested-togglecell"></th>');
            root.children('table').find('tr.grid-row-template').prepend('<td class="formgrid-nested-togglecell"></td>');
            var refreshTimer;
            nodes.forEach(function(node, id) {
                if (id !== rootId) {
                    node.grid.data('nestedOwner', root[0]);
                    node.grid.closest('.form-cell').addClass('formgrid-nested-source');
                    // A read-only root must also lock child popups even when child properties are writable.
                    if (settings.readonly || root.hasClass('readonly')) node.grid.addClass('readonly');
                }
                node.grid.on('change.formGridNested', function(event, change) {
                    if (event.target !== node.grid[0]) return;
                    if (id !== rootId) node.grid.closest('.form-cell').children('label').find('.form-error-message').remove();
                    // Rebuilding on every keystroke would remove the focused nested editor.
                    if (id !== rootId && change && change.editableRow && !change.editableFile) { error(validateData()); return; }
                    refresh();
                });
                node.grid.on('formgrid:validationerror.formGridNested', function() { error(validateData()); });
                node.grid.on('formgrid:rowupdated.formGridNested', function() {
                    clearTimeout(refreshTimer);
                    refreshTimer = setTimeout(refresh, 0);
                });
                node.grid.on('formgrid:beforedelete.formGridNested', function(event, row) {
                    if (direct(id).some(function(child) { return loadState(child, text(read(row)[child.parentKey])) !== 'loaded'; })) {
                        event.preventDefault(); error('Expand this row to check its child records before deleting.'); return;
                    }
                    if (hasChildren(id, $(row))) {
                        event.preventDefault(); error('Delete related child rows before deleting this parent row.');
                    }
                });
            });
            root.on('formgrid:pagechanged.formGridNested', function() {
                try { syncVisibility(); } catch (problem) { error(problem.message); }
            });
            root.on('formgrid:sorted.formGridNested', refresh);
            root.closest('form').on('submit.formGridNested' + detailId, function(event) {
                var message;
                try { message = validateData(); } catch (problem) { message = problem.message; }
                if (message) { error(message); event.preventDefault(); }
            });
            refresh();
        });
    };
})(jQuery);
