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
            if (root.data('formGridNested')) return;
            var scope = root.closest('div.subform-container, form');
            if (!scope.length) scope = root.parent();
            var rootId = root.children('.formgrid-field-id').val() || root.attr('name');
            var nodes = new Map(), children = new Map(), expanded = new Set(), detailId = ++nextId;
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
                        gridId: text(config.gridId).trim(), formDefId: text(config.formDefId).trim(), label: text(config.label).trim(),
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
                    if (node.formDefId && node.grid.children('.formgrid-form-id').val() !== node.formDefId)
                        throw new Error('Child Form ID mismatch for ' + node.gridId + ': expected ' + node.formDefId +
                            '. Save the nested mapping and reload the containing form.');
                    if (node.grid.data('nestedOwner') || node.grid.children('.formgrid-nested-config').length)
                        throw new Error('Configure nesting only on the root grid. Child grid is already nested: ' + node.gridId);
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
            function build(id, parentRow) {
                var content = $('<div class="formgrid-nested-content">');
                direct(id).forEach(function(node) {
                    var section = $('<section class="formgrid-nested-section">').attr('data-child-grid', node.gridId);
                    var heading = $('<div class="formgrid-nested-heading">').append($('<strong>').text(node.label || node.gridId));
                    var key = text(read(parentRow)[node.parentKey]);
                    $.formGridCustom.showHidePlusIcon(node.grid);
                    if (canWrite(node.grid) && !node.grid.hasClass('disabledAdd')) {
                        heading.append(button('Add', 'btn btn-primary formgrid-nested-add', function() { addChild(node, parentRow); })
                            .prepend('<i class="fas fa-plus" aria-hidden="true"></i> ')
                            .prop('disabled', !key || node.grid.children('.formgrid-custom-add').prop('disabled')));
                    }
                    section.append(heading);
                    if (!key) section.append($('<p>').text('Set the parent key before adding child rows.'));
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
                    var matched = matching(node, parentRow).not('.fg-hidden');
                    matched.each(function(index) {
                        var source = $(this), view = $('<tr class="formgrid-nested-row">');
                        if (showNumber) view.append($('<td class="formgrid-nested-row-number">').text(index + 1));
                        fields.forEach(function(field) { view.append(displayCell(source.children('td').eq(field.index))); });
                        var actions = $('<td class="formgrid-nested-actions">').append(rowActions(node, parentRow, source, index, matched.length));
                        view.append(actions); body.append(view);
                        if (direct(node.gridId).length) {
                            toggle(node.gridId, source, view);
                            if (expanded.has(source[0])) body.append($('<tr class="formgrid-nested-detail">')
                                .append($('<td>').attr('colspan', header.children().length).append(build(node.gridId, source))));
                        }
                    });
                    if (!matched.length) body.append($('<tr>').append($('<td class="formgrid-nested-empty">')
                        .attr('colspan', header.children().length).text('No related records.')));
                    section.append($('<div class="formgrid-nested-scroll">').append(table)); content.append(section);
                });
                return content;
            }
            function syncVisibility() {
                root.children('table').find('tr.formgrid-nested-root-detail').each(function() {
                    var source = $(this).data('parentRow');
                    $(this).toggle(!source.hasClass('fg-hidden') && !source.hasClass('pg-tr-hide') && source.css('display') !== 'none');
                });
            }
            function refresh() {
                try {
                    root.children('table').find('tr.formgrid-nested-root-detail').remove();
                    rows(root).each(function() {
                        var row = $(this); toggle(rootId, row, row);
                        if (expanded.has(this)) row.after($('<tr class="formgrid-nested-root-detail">').data('parentRow', row)
                            .append($('<td>').attr('colspan', row.children().length).append(build(rootId, row))));
                    });
                    syncVisibility(); error(validateData());
                } catch (problem) { error(problem.message); }
            }
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
                node.grid.on('change.formGridNested', function(event) {
                    if (event.target !== node.grid[0]) return;
                    if (id !== rootId) node.grid.closest('.form-cell').children('label').find('.form-error-message').remove();
                    refresh();
                });
                node.grid.on('formgrid:validationerror.formGridNested', refresh);
                node.grid.on('formgrid:rowupdated.formGridNested', function() {
                    clearTimeout(refreshTimer);
                    refreshTimer = setTimeout(refresh, 0);
                });
                node.grid.on('formgrid:beforedelete.formGridNested', function(event, row) {
                    if (hasChildren(id, $(row))) {
                        event.preventDefault(); error('Delete related child rows before deleting this parent row.');
                    }
                });
            });
            root.on('formgrid:pagechanged.formGridNested', syncVisibility);
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
