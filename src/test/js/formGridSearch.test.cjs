const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {JSDOM} = require('jsdom');
const jquery = require('jquery');
const base = path.join(__dirname, '../../main/resources/resources/js');
function setup({enabled = true, editable = false, readonly = false} = {}) {
    const toolbar = '<div class="formgrid-search"><label>Search<input type="search" class="formgrid-search-input"></label><span class="formgrid-search-empty" hidden>No matching records.</span></div>';
    function fixture(id) {
        return `<div id="${id}" class="formgrid-custom">
        ${enabled ? toolbar : ''}<button type="button" class="delete_btn">Delete</button>
        <table><thead><tr><th><input type="checkbox" class="grid-checkbox-parent"></th><th id="${id}_name">Name</th><th id="${id}_role">Role</th></tr></thead><tbody>
        <tr class="grid-row-template" style="display:none"><td><input type="checkbox" class="grid-checkbox-children"></td>
        <td><span class="grid-cell" column_key="name" column_type="text"></span></td>
        <td><span class="grid-cell" column_key="role" column_type="text"></span></td>
        <td style="display:none"><span class="grid-cell" column_key="secret"></span><textarea id="${id}_jsonrow" name="${id}_jsonrow"></textarea></td></tr>
        </tbody></table><p class="pg-navigator"></p></div>`;
    }
    const dom = new JSDOM(`<form>${fixture('one')}${fixture('two')}</form>`, {runScripts: 'outside-only'});
    const $ = jquery(dom.window);
    dom.window.$ = dom.window.jQuery = $;
    dom.window.UI = {escapeHTML: value => $('<div>').text(value == null ? '' : value).html()};
    dom.window.JPopup = {hide() {}};
    dom.window.confirm = () => true;
    for (const file of ['jquery.formGridCustom.js', 'jquery.formGridCustom.remake.js', 'jquery.gridPagingCustom.js', 'jquery.formGridEditable.js']) {
        dom.window.eval(fs.readFileSync(path.join(base, file), 'utf8'));
    }
    const grid = $('#one'), other = $('#two');
    grid.add(other).formGridCustom({messages: {}, options: {}});
    function add(name, role = 'Staff', target = grid) {
        target.formGridCustom('addRow', {result: JSON.stringify({id: name, name, role, secret: 'private-token'})});
        return target.children('table').find('tr.grid-row').last();
    }
    const rows = ['Andi', 'Budi', 'Citra', 'Dewi', 'Eka', 'Fajar'].map(name => add(name));
    add('Other', 'Other role', other);
    if (readonly) grid.add(other).addClass('readonly');
    if (editable) grid.formGridEditable({columns: [{id: 'name', editor: 'TextField'}, {id: 'role', editor: 'SelectBox', options: {Staff: 'Staff Member', admin: 'Administrator'}}]});
    grid.add(other).gridPagingCustom({customSize: 2, threshold: 2, dataSorting: true});
    const input = grid.children('.formgrid-search').find('input');
    const search = value => input.val(value).trigger('input');
    const visible = () => grid.children('table').find('tr.grid-row.pg-tr-show').map(function() { return $(this).find('[column_key="name"]').text() || $(this).find('.formgrid-editor').first().val(); }).get();
    return {dom, $, grid, other, rows, add, input, search, visible};
}
test('search covers all pages, ignores case and whitespace, resets page and preserves submitted rows', t => {
    const s = setup(); t.after(() => s.dom.window.close());
    s.grid.find('.pg-last').trigger('click');
    assert.deepEqual(s.visible(), ['Eka', 'Fajar']);
    let changes = 0; s.grid.on('change.test', () => changes++);
    s.search('  cItRa  ');
    assert.deepEqual(s.visible(), ['Citra']);
    assert.equal(s.grid.children('table').data('pagingPage'), 1);
    assert.equal(s.grid.getValues().length, 6);
    assert.equal(s.$('form').serializeArray().filter(field => field.name.startsWith('one_jsonrow_')).length, 6);
    assert.equal(s.other.find('.fg-search-hidden').length, 0);
    assert.equal(changes, 0);
    s.search('');
    assert.deepEqual(s.visible(), ['Andi', 'Budi']);
    assert.equal(s.grid.find('.fg-search-hidden').length, 0);
});
test('hidden values, row metadata and actions do not match; literals and empty results are safe', t => {
    const s = setup(); t.after(() => s.dom.window.close());
    for (const query of ['private-token', 'Delete', '[a-z]+', '<script>']) {
        s.search(query);
        assert.deepEqual(s.visible(), []);
        assert.equal(s.grid.find('.formgrid-search-empty').prop('hidden'), false);
    }
    s.search('staff'); assert.equal(s.grid.find('.fg-search-hidden').length, 0);
    s.search(''); assert.equal(s.grid.find('.formgrid-search-empty').prop('hidden'), true);
    const event = s.$.Event('keydown', {key: 'Enter'}); s.input.trigger(event);
    assert.equal(event.isDefaultPrevented(), true);
});
test('search composes with existing filters and follows add, popup, programmatic edits and sorting', t => {
    const s = setup(); t.after(() => s.dom.window.close());
    s.rows[2].addClass('fg-hidden');
    s.search('Citra'); assert.deepEqual(s.visible(), []);
    s.search(''); assert.equal(s.rows[2].hasClass('fg-hidden'), true);
    assert.equal(s.rows[2].hasClass('pg-tr-hide'), true);
    s.search('Updated');
    const row = s.add('New'); assert.equal(row.hasClass('fg-search-hidden'), true);
    s.grid.formGridCustom('editRow', {rowId: row.attr('id'), result: JSON.stringify({id: 'New', name: 'Updated popup'})});
    assert.deepEqual(s.visible(), ['Updated popup']);
    s.grid.updateRowData(data => { if (data.name === 'Budi') data.name = 'Updated programmatic'; });
    assert.equal(s.rows[1].hasClass('fg-search-hidden'), false);
    s.grid.find('#one_name').trigger('click');
    assert.deepEqual(s.visible(), ['Updated popup', 'Updated programmatic']);
});
test('search removes hidden selections and select-all and bulk delete affect only matching rows', t => {
    const s = setup(); t.after(() => s.dom.window.close());
    s.grid.find('.grid-checkbox-parent').prop('checked', true).trigger('change');
    assert.equal(s.grid.data('selected_rows').length, 6);
    s.search('Andi');
    assert.equal(s.grid.getValuesChecked().length, 1);
    assert.equal(s.grid.countData({checkedOnly: true}), 1);
    assert.equal(s.grid.data('selected_rows').length, 1);
    s.grid.find('.grid-checkbox-parent').prop('checked', true).trigger('change');
    assert.equal(s.grid.data('selected_rows').length, 1);
    s.grid.find('.delete_btn').trigger('click');
    assert.equal(s.grid.getValues().length, 5);
    s.search(''); assert.equal(s.grid.find('.grid-checkbox-children:checked').length, 0);
});
test('editable search uses current input values and selected option labels', t => {
    const s = setup({editable: true}); t.after(() => s.dom.window.close());
    s.search('Administrator'); assert.deepEqual(s.visible(), []);
    const row = s.rows[0];
    row.find('select.formgrid-editor').val('admin').trigger('change');
    assert.equal(row.hasClass('fg-search-hidden'), false);
    row.find('input.formgrid-editor').val('Renamed').trigger('input');
    s.search('renamed'); assert.equal(row.hasClass('fg-search-hidden'), false);
    s.search('Andi'); assert.equal(row.hasClass('fg-search-hidden'), true);
});
test('search is opt-in and also works in readonly grids', t => {
    const disabled = setup({enabled: false}); t.after(() => disabled.dom.window.close());
    assert.equal(disabled.grid.find('.formgrid-search-input').length, 0);
    assert.deepEqual(disabled.visible(), ['Andi', 'Budi']);
    const locked = setup({readonly: true}); t.after(() => locked.dom.window.close());
    locked.search('Fajar'); assert.deepEqual(locked.visible(), ['Fajar']);
});
