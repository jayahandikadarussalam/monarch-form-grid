(function($) {
    'use strict';
    var nextId = 0;
    function text(value) { return value == null ? '' : Array.isArray(value) ? value.join(';') : String(value); }
    function same(left, right) { return left && right && left.value === right.value && left.output === right.output; }

    $.fn.formGridSync = function(settings) {
        return this.each(function() {
            var grid = $(this), scope = grid.closest('div.subform-container, form');
            function writable() { return !grid.hasClass('readonly') && !$(grid.data('nestedOwner')).hasClass('readonly'); }
            if (settings.enabled === false || grid.attr('data-builder-design') === 'true' || !writable() || grid.data('formGridSync')) return;
            var rules = settings.mappings || [], previous = new Map(), active = new Set(), applying = false, timer;
            var namespace = '.formGridSync' + (++nextId);
            var status = $('<div class="formgrid-sync-status form-error-message" role="alert" hidden>').prependTo(grid);
            var configurationError = settings.error || '';
            var targets = new Set();
            rules.forEach(function(rule) {
                if (!/^[a-zA-Z0-9_]+$/.test(rule.source || '') || !/^[a-zA-Z0-9_]+$/.test(rule.target || '') ||
                        /^_/.test(rule.target) || ['id', 'dateCreated', 'dateModified', 'createdBy', 'createdByName', 'modifiedBy', 'modifiedByName', 'constructor', 'prototype'].indexOf(rule.target) !== -1 ||
                        targets.has(rule.target) || ['always', 'empty'].indexOf(rule.mode || 'always') === -1 ||
                        ['clear', 'keep'].indexOf(rule.empty || 'clear') === -1 ||
                        ['value', 'label'].indexOf(rule.get || 'value') === -1) configurationError = 'Field Synchronization: Invalid or duplicate Field Mapping.';
                targets.add(rule.target);
            });
            if (!rules.length || !scope.length) configurationError = configurationError || 'Field Synchronization: Add at least one Field Mapping in a containing form.';
            function error(message) {
                var changed = status.text() !== message;
                status.text(message).prop('hidden', !message);
                if (changed) grid.triggerHandler('formgrid:validationerror');
            }
            function sourceName(rule) { return rule.sourceParam || rule.source; }
            function key(rule) { return JSON.stringify([sourceName(rule), rule.get || 'value']); }
            function sourceFields(rule) {
                var name = sourceName(rule);
                return scope.find('input,select,textarea').filter(function() {
                    return $(this).closest('div.subform-container, form')[0] === scope[0] && !$(this).closest('.formgrid-custom').length &&
                        (this.name === name || this.name === name + '[]' || (!this.name && this.id === name));
                });
            }
            function snapshot() {
                if (configurationError) throw new Error(configurationError);
                var values = new Map();
                rules.forEach(function(rule) {
                    var fields = sourceFields(rule);
                    if (!fields.length) throw new Error('Field Synchronization: Main Form Field not found: ' + rule.source);
                    var choices = fields.filter(':checkbox,:radio');
                    var selected = choices.filter(':checked');
                    var value = choices.length ? selected.map(function() { return this.value; }).get().join(';') : text(fields.first().val());
                    var output = value;
                    if (rule.get === 'label' && value !== '') {
                        if (fields.first().is('select')) output = fields.first().find('option:selected').map(function() { return $(this).text().trim(); }).get().join(';');
                        else if (choices.length) output = selected.map(function() {
                            var labels = Array.from(this.labels || []);
                            return labels.length ? $(labels[0]).text().trim() : this.value;
                        }).get().join(';');
                    }
                    values.set(key(rule), {value: value, output: output});
                });
                return values;
            }
            function update(data, values, include) {
                var changed = false;
                rules.forEach(function(rule) {
                    if (!include(rule)) return;
                    var source = values.get(key(rule)), value = source.output;
                    if ((rule.empty === 'keep' && source.value === '') || (rule.mode === 'empty' && text(data[rule.target]) !== '')) return;
                    if (text(data[rule.target]) === value) return;
                    data[rule.target] = value;
                    if (data._decryptedDataMap) delete data._decryptedDataMap[rule.target];
                    if (data._tempRequestParamsMap) {
                        data._tempRequestParamsMap[rule.target] = rule.multiple ? (value ? value.split(';') : []) : [value];
                        if (rule.targetParam && rule.targetParam !== rule.target)
                            data._tempRequestParamsMap[rule.targetParam] = data._tempRequestParamsMap[rule.target].slice();
                    }
                    changed = true;
                });
                return changed;
            }
            function synchronize(onLoad) {
                clearTimeout(timer);
                if (!writable() || applying) return;
                try {
                    var values = snapshot(), changedSources = new Set();
                    values.forEach(function(value, source) {
                        if (onLoad || !same(value, previous.get(source))) { changedSources.add(source); active.add(source); }
                    });
                    var updates = [];
                    if (changedSources.size) grid.children('table').find('tr.grid-row').each(function() {
                        var row = $(this), json = row.find('textarea:not(.formgrid-editor)').first().val(), data = JSON.parse(json);
                        if (!data || Array.isArray(data) || typeof data !== 'object') throw new Error('Field Synchronization: Invalid grid row data.');
                        if (update(data, values, function(rule) { return changedSources.has(key(rule)); })) updates.push({row: row, data: data});
                    });
                    previous = values;
                    error('');
                    applying = true;
                    try {
                        updates.forEach(function(item) { $.formGridCustom.fillValue(grid, item.row, JSON.stringify(item.data), {batch: true}); });
                    } finally { applying = false; }
                    if (updates.length) grid.trigger('change', [{fieldSync: true}]);
                } catch (problem) { error(problem.message); }
            }
            grid.data('formGridSync', {sync: function() { synchronize(false); }});
            grid.on('formgrid:beforefill' + namespace, function(event, row, filling) {
                if (!writable() || applying) return;
                try {
                    var values = snapshot();
                    filling.changed = update(filling.data, values, function(rule) {
                        return !filling.existing || settings.syncOnLoad || active.has(key(rule)) || !same(values.get(key(rule)), previous.get(key(rule)));
                    }) || filling.changed;
                } catch (problem) { error(problem.message); }
            });
            scope.on('input' + namespace + ' change' + namespace, 'input,select,textarea', function(event) {
                var field = this;
                if (!rules.some(function(rule) { return sourceFields(rule).toArray().indexOf(field) !== -1; })) return;
                clearTimeout(timer);
                if (event.type === 'input' && !$(field).is('select,:checkbox,:radio')) timer = setTimeout(function() { synchronize(false); }, 200);
                else synchronize(false);
            });
            grid.closest('form').on('submit' + namespace, function(event) {
                if (!writable()) return;
                synchronize(false);
                if (!status.prop('hidden')) event.preventDefault();
            });
            try { previous = snapshot(); error(''); } catch (problem) { error(problem.message); }
            if (settings.syncOnLoad) synchronize(true);
        });
    };
})(jQuery);
