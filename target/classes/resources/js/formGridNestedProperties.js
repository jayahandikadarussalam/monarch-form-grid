(function() {
    'use strict';
    // Extend Joget's native property grid with layout and row-specific Form field suggestions.
    var css = [
        '.monarch-nested-properties{container-type:inline-size}',
        '.monarch-nested-properties table{display:block;width:100%;border-collapse:separate}',
        '.monarch-nested-properties table>tbody{display:block}',
        '.monarch-nested-properties tr.grid_header,.monarch-nested-properties tr.grid_model{display:none!important}',
        '.monarch-nested-properties tr:not(.grid_header):not(.grid_model){display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px 16px;padding:16px;margin:0 0 14px;border:1px solid #e0e0e0;border-radius:4px;background:transparent}',
        '.monarch-nested-properties tr>td{display:block;width:auto!important;min-width:0;padding:0!important;border:0!important;vertical-align:top;box-sizing:border-box}',
        '.monarch-nested-properties tr>td.monarch-nested-sort-hidden{display:none!important}',
        '.monarch-nested-properties tr>td>span{display:block;min-width:0}',
        '.monarch-nested-properties .monarch-nested-field-label{display:block;margin-bottom:7px;font-weight:600;line-height:1.4;min-height:1.4em;white-space:normal}',
        '.monarch-nested-properties input:not([type=checkbox]),.monarch-nested-properties select,.monarch-nested-properties .chosen-container{width:100%!important;min-width:0;max-width:100%;box-sizing:border-box}',
        '.monarch-nested-properties .property-type-grid-action-column{align-self:end;text-align:right;white-space:nowrap;padding-bottom:5px!important}',
        '@container (max-width:720px){.monarch-nested-properties tr:not(.grid_header):not(.grid_model){grid-template-columns:repeat(3,minmax(0,1fr))}}',
        '@container (max-width:440px){.monarch-nested-properties tr:not(.grid_header):not(.grid_model){grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}}'
    ].join('\n');

    return {
        renderField: function() { return '<style class="monarch-nested-properties-style">' + css + '</style>'; },
        renderDefault: function() { return ''; },
        getData: function() { return {}; },
        initScripting: function() {
            var helper = this;
            var ownInput = document.getElementById(helper.id + '_input');
            if (ownInput) $(ownInput).closest('.property-editor-property').hide();
            var targetId = helper.id.slice(0, -helper.properties.name.length) + 'nestedChildren';
            var editor = $(helper.editor)[0];
            if (!editor) return;
            if (helper.nestedPropertiesObserver) helper.nestedPropertiesObserver.disconnect();
            var prefix = helper.id.slice(0, -helper.properties.name.length);
            var options = helper.options || {};
            var endpoint = (helper.properties.field_options_url || '')
                .replace(/\[CONTEXT_PATH\]/g, options.contextPath || '')
                .replace(/\[APP_PATH\]/g, options.appPath || '');
            var cache = new Map();
            var eventNamespace = '.monarchNestedFields_' + helper.id.replace(/[^a-zA-Z0-9]/g, '_');
            $(editor).off(eventNamespace).on('change' + eventNamespace, function(event) {
                var target = $(event.target);
                if (target.attr('name') === 'sortWithButtons' && target.closest('table')[0] === document.getElementById(targetId)) {
                    updateSortField(target.closest('tr'));
                    return;
                }
                if (['formDefId', 'parentGridId', 'gridId'].indexOf(target.attr('name')) === -1 &&
                        event.target.id !== prefix + 'formDefId' && event.target.id !== prefix + 'id') return;
                $(document.getElementById(targetId)).find('.monarch-nested-field-input').each(function() {
                    var input = $(this);
                    input.data('monarchFieldRequest', (input.data('monarchFieldRequest') || 0) + 1).removeAttr('aria-busy');
                    input.autocomplete('close');
                });
            });

            function updateSortField(row) {
                var enabled = row.find('[name="sortWithButtons"]').prop('checked');
                var input = row.find('[name="sortField"]');
                input.closest('td').toggleClass('monarch-nested-sort-hidden', !enabled);
                if (!enabled && input.data('monarchFieldAutocomplete')) input.autocomplete('close');
            }

            function value(input) {
                var raw = input.val();
                if (raw == null) raw = input.data('value');
                return raw == null ? '' : String(raw).trim();
            }
            function rootValue(name) {
                var input = document.getElementById(prefix + name);
                if (input) return value($(input));
                var field = helper.editorObject && helper.editorObject.fields && helper.editorObject.fields[name];
                if (!field) return '';
                var raw = field.getData ? field.getData(false)[name] : field.value;
                return raw == null ? '' : String(raw).trim();
            }
            function sourceForm(row, key) {
                if (key !== 'parentKey') return value(row.find('[name="formDefId"]').first());
                var parent = value(row.find('[name="parentGridId"]').first());
                if (!parent || parent === rootValue('id')) return rootValue('formDefId');
                var parents = $(document.getElementById(targetId)).find('tr').not('.grid_header,.grid_model').filter(function() {
                    return value($(this).find('[name="gridId"]').first()) === parent;
                });
                return parents.length === 1 ? value(parents.find('[name="formDefId"]').first()) : '';
            }
            function fields(formId) {
                if (cache.has(formId)) return cache.get(formId);
                var deferred = $.Deferred();
                cache.set(formId, deferred.promise());
                $.getJSON(endpoint, {formDefId: formId}).done(function(list) {
                    var seen = new Set(), result = [];
                    if (Array.isArray(list)) list.forEach(function(option) {
                        if (!option || option.value == null || !String(option.value) || seen.has(String(option.value))) return;
                        var id = String(option.value); seen.add(id);
                        result.push({value: id, label: option.label == null || option.label === '' ? id : String(option.label)});
                    });
                    deferred.resolve(result);
                }).fail(function() { cache.delete(formId); deferred.reject(); });
                return deferred.promise();
            }
            function autocomplete(input, row) {
                var key = input.attr('name');
                if (!endpoint || !$.fn.autocomplete || ['parentKey', 'foreignKey', 'sortField'].indexOf(key) === -1 ||
                        input.data('monarchFieldAutocomplete')) return;
                input.data('monarchFieldAutocomplete', true).addClass('monarch-nested-field-input').autocomplete({
                    minLength: 0,
                    source: function(request, respond) {
                        var formId = sourceForm(row, key);
                        var serial = (input.data('monarchFieldRequest') || 0) + 1;
                        input.data('monarchFieldRequest', serial);
                        if (!formId) { input.removeAttr('aria-busy'); respond([]); return; }
                        input.attr('aria-busy', 'true');
                        function current() {
                            return $.contains(editor, input[0]) && serial === input.data('monarchFieldRequest') && sourceForm(row, key) === formId;
                        }
                        fields(formId).done(function(list) {
                            if (!current()) { respond([]); return; }
                            input.removeAttr('title');
                            var term = String(request.term || '').toLowerCase();
                            respond(list.filter(function(option) {
                                return option.value.toLowerCase().indexOf(term) !== -1 || option.label.toLowerCase().indexOf(term) !== -1;
                            }));
                        }).fail(function() {
                            if (current()) input.attr('title', 'Unable to load field suggestions. Type the Field ID or focus again to retry.');
                            respond([]);
                        }).always(function() { if (current()) input.removeAttr('aria-busy'); });
                    },
                    open: function() { input.autocomplete('widget').css('z-index', 99999); }
                }).on('focus' + eventNamespace, function() { input.autocomplete('search', input.val() || ''); });
            }

            function decorate() {
                var table = document.getElementById(targetId);
                if (!table || !$.contains(editor, table)) return;
                var container = $(table).closest('.property-editor-property').addClass('monarch-nested-properties');
                if (!container.length) return;
                var field = helper.editorObject && helper.editorObject.fields && helper.editorObject.fields.nestedChildren;
                var columns = field && field.properties.columns;
                var header = $(table).find('tr.grid_header').first().children('th');
                $(table).find('tr').not('.grid_header').each(function() {
                    var row = $(this), isModel = row.hasClass('grid_model');
                    row.children('td').not('.property-type-grid-action-column').each(function(index) {
                        var cell = $(this), input = cell.find('input[name],select[name]').first();
                        if (!input.length) return;
                        var definition = columns && columns[index];
                        var label = definition ? definition.label : header.eq(index).clone().find('i,a,button').remove().end().text().replace(/\s+/g, ' ').trim();
                        if (!cell.children('.monarch-nested-field-label').length) {
                            var caption = $('<div class="monarch-nested-field-label">').text(label);
                            if (definition && String(definition.required).toLowerCase() === 'true') caption.append(' ', $('<span class="property-required">').text('*'));
                            cell.prepend(caption);
                        }
                        input.attr('aria-label', label);
                        if (!isModel) autocomplete(input, row);
                        // The native grid clones its model HTML for new rows. Seed checkbox defaults there.
                        if (isModel && input.is('[type=checkbox]') && definition && definition.value !== undefined) {
                            input.prop('checked', definition.value === definition.true_value);
                            if (input.prop('checked')) input.attr('checked', 'checked'); else input.removeAttr('checked');
                        }
                    });
                    updateSortField(row);
                });
            }
            decorate();
            helper.nestedPropertiesObserver = new MutationObserver(decorate);
            // Covers Add Row, CSV toggles, and asynchronous Form dropdown rendering without moving controls.
            helper.nestedPropertiesObserver.observe(editor, {childList: true, subtree: true});
        }
    };
})()
