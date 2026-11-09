const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {JSDOM} = require('jsdom');
const jquery = require('jquery');
const base = path.resolve(__dirname, '../../main/resources/resources/js');
const XLSX = require(path.join(base, 'vendor/xlsx.full.min.js'));

function fixture(id = 'gridA', name = 'items') {
    return `<div id="${id}" name="${name}" class="grid formgrid-custom enableSorting">
        <input disabled type="hidden" class="uniqueKey" value="name">
        <input disabled type="hidden" id="validateMaxRow" value="10">
        <input disabled type="hidden" id="popupDuplicate" value="">
        <input disabled type="hidden" id="deleteMessage" value="">
        <div class="grid-validation-error"><span class="error-content"></span></div>
        <table><thead><tr><th id="${name}_name">Name</th><th id="${name}_date">Date</th></tr></thead><tbody>
        <tr class="grid-row-template" style="display:none">
            <td><input type="checkbox" class="grid-checkbox-children"></td>
            <td><span class="grid-cell rowNumber"></span></td>
            <td><span class="grid-cell" column_key="name" column_type="text"></span></td>
            <td><span class="grid-cell" column_key="date" column_type="date"></span></td>
            <td><textarea id="${name}_jsonrow" name="${name}_jsonrow"></textarea></td>
        </tr></tbody></table><p class="pg-navigator"></p>
        <button type="button" class="formgrid-custom-add">Add</button>
        <button type="button" class="formgrid-import-open">Import</button>
        <div class="formgrid-import-panel" hidden>
            <button type="button" class="formgrid-import-template">Template</button>
            <input type="file" class="formgrid-import-file">
            <label class="formgrid-import-sheet-label" hidden><select class="formgrid-import-sheet"></select></label>
            <p class="formgrid-import-status"></p><div class="formgrid-import-preview"></div>
            <div class="formgrid-import-pagination" hidden>
                <select class="formgrid-import-page-size">${[10,20,50,100].map(n=>`<option value="${n}">${n}</option>`).join('')}</select>
                <span class="formgrid-import-page-info"></span>
                <button type="button" class="formgrid-import-previous" disabled>Previous</button>
                <button type="button" class="formgrid-import-next" disabled>Next</button>
            </div>
            <button type="button" class="formgrid-import-confirm" disabled>Confirm</button>
            <button type="button" class="formgrid-import-cancel">Cancel</button>
        </div></div>`;
}
function setup(columnsByGrid = {}) {
    const dom = new JSDOM(`<form>${fixture()}${fixture('gridB','other')}</form>`, {runScripts:'outside-only', url:'https://example.test/jw'});
    const window = dom.window, $ = jquery(window);
    window.jQuery = window.$ = $;
    window.UI = {escapeHTML: text => $('<div>').text(text == null ? '' : text).html()};
    window.JPopup = {hide() {}};
    const previousParser = {existingLibrary:true};
    window.XLSX = previousParser;
    $.ajax = () => {
        window.XLSX = XLSX;
        return $.Deferred().resolve().promise();
    };
    for (const file of ['jquery.formGridCustom.js', 'jquery.gridPagingCustom.js', 'jquery.utils.js', 'formGridImport.js', 'jquery.formGridImport.js']) {
        window.eval(fs.readFileSync(path.join(base,file), 'utf8'));
    }
    const grids = $('#gridA,#gridB');
    grids.formGridCustom({messages:{},options:{}}).gridPagingCustom({customSize:'1', dataSorting:true});
    grids.each(function() {
        $(this).formGridImport({columns:columnsByGrid[this.id] || [{id:'name',type:'text',label:'Name'}, {id:'date',type:'date',label:'Date'}],sortField:'sort',libraryUrl:'/parser.js'});
    });
    return {window,$,dom,grid:$('#gridA'),other:$('#gridB'),previousParser};
}
async function waitUntil(fn) {
    for (let i=0;i<100;i++) {
        if (fn()) return;
        await new Promise(resolve => setTimeout(resolve,5));
    }
    throw new Error('UI did not reach the expected state');
}
async function chooseFile(grid, content, name='data.csv') {
    const input = grid.find('.formgrid-import-file');
    const bytes = Buffer.isBuffer(content) ? content : Buffer.from(content);
    Object.defineProperty(input[0],'files',{configurable:true,value:[{name,size:bytes.length,arrayBuffer:async()=>bytes}]});
    grid.find('.formgrid-import-open').trigger('click');
    input.trigger('change');
    await waitUntil(() => !grid.find('.formgrid-import-status').text().includes('Reading file'));
}
function dataRows(grid) { return grid.children('table').find('tr.grid-row'); }
function values(grid) { return dataRows(grid).map(function() { return JSON.parse(grid.constructor(this).find('textarea').val()); }).get(); }

test('preview waits for confirmation, appends serializable rows, refreshes paging and isolates grids', async t => {
    const {grid,other,window,dom,previousParser} = setup();
    t.after(()=>dom.window.close());
    let changes = 0;
    grid.on('change.test',()=>changes++);
    await chooseFile(grid,'name,date\nAndi,2026-11-05\nBudi,2026-11-06');
    assert.equal(dataRows(grid).length,0);
    assert.equal(grid.find('.formgrid-import-preview tbody tr').length,2);
    assert.equal(grid.find('.formgrid-import-preview tbody tr').first().children().first().text(),'1');
    assert.equal(grid.find('.formgrid-import-preview tbody tr').first().children().first().attr('title'),'File row 2');
    assert.equal(grid.find('.formgrid-import-confirm').prop('disabled'),false);
    assert.equal(grid.children('.formgrid-import-open').attr('aria-expanded'),'true');
    assert.equal(window.XLSX,previousParser);
    grid.find('.formgrid-import-confirm').trigger('click');
    assert.equal(dataRows(grid).length,2);
    assert.equal(dataRows(other).length,0);
    assert.equal(changes,1);
    const rows = values(grid);
    assert.deepEqual(rows.map(row=>row.name),['Andi','Budi']);
    assert.notEqual(rows[0].id,rows[1].id);
    assert.match(rows[0].id,/^[0-9a-f-]{36}$/);
    assert.equal(dataRows(grid).eq(0).find('textarea').attr('name'),'items_jsonrow_0');
    assert.equal(dataRows(grid).eq(1).attr('id'),'gridA_row_1');
    assert.equal(grid.children('.pg-navigator').length,0);
    assert.equal(grid.find('.pg-navigator').length,0);
    assert.equal(grid.find('tr.pg-tr-show').length,2);
    assert.equal(grid.find('tr.pg-tr-hide').length,0);
    assert.equal(dataRows(grid).first().find('.grid-action-moveup').prop('disabled'),true);
    assert.match(grid.find('.formgrid-import-status').text(),/2 rows imported/);
    // A second import appends and preserves existing row identities and edited values.
    await chooseFile(grid,'name,date\nCitra,2026-11-07');
    grid.find('.formgrid-import-confirm').trigger('click');
    assert.deepEqual(values(grid).map(r=>r.name),['Andi','Budi','Citra']);
    assert.equal(values(grid)[0].id,rows[0].id);
    assert.equal(dataRows(grid).last().find('textarea').attr('name'),'items_jsonrow_2');
});
test('duplicate and max-row checks reject the whole batch and recheck at confirmation', async t => {
    const {grid,dom} = setup(); t.after(()=>dom.window.close());
    await chooseFile(grid,'name\nAndi\nAndi');
    assert.equal(grid.find('.formgrid-import-confirm').prop('disabled'),true);
    assert.match(grid.find('.formgrid-import-status').text(),/duplicate/);
    assert.equal(dataRows(grid).length,0);
    await chooseFile(grid,'name\nAndi\nBudi');
    grid.children('#validateMaxRow').val('1');
    grid.find('.formgrid-import-confirm').trigger('click');
    assert.equal(dataRows(grid).length,0);
    assert.match(grid.find('.formgrid-import-status').text(),/maximum of 1/);
});
test('cancel discards preview, readonly blocks import and errors do not inject markup', async t => {
    const {grid,window,dom} = setup(); t.after(()=>dom.window.close());
    await chooseFile(grid,'name\nAndi');
    grid.find('.formgrid-import-cancel').trigger('click');
    assert.equal(grid.find('.formgrid-import-panel').prop('hidden'),true);
    assert.equal(grid.children('.formgrid-import-open').attr('aria-expanded'),'false');
    assert.equal(dataRows(grid).length,0);
    assert.equal(grid.find('.formgrid-import-confirm').prop('disabled'),true);
    await chooseFile(grid,'name\nBudi');
    grid.addClass('readonly');
    grid.find('.formgrid-import-confirm').trigger('click');
    assert.equal(dataRows(grid).length,0);
    assert.match(grid.find('.formgrid-import-status').text(),/disabled/);
    grid.removeClass('readonly');
    await chooseFile(grid,'unknown<img src=x onerror=alert(1)>\nmalicious');
    assert.equal(grid.find('.formgrid-import-status img').length,0);
    assert.equal(window.document.querySelector('.formgrid-import-status').textContent.includes('<img'),true);
});
test('multi-sheet Excel can select a different sheet after an invalid initial sheet', async t => {
    const {grid,dom} = setup(); t.after(()=>dom.window.close());
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([['instructions'],['read this']]),'Instructions');
    XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([['name'],['Andi']]),'Data');
    await chooseFile(grid,XLSX.write(wb,{type:'buffer',bookType:'xlsx'}),'data.xlsx');
    assert.equal(grid.find('.formgrid-import-sheet-label').prop('hidden'),false);
    assert.equal(grid.find('.formgrid-import-confirm').prop('disabled'),true);
    grid.find('.formgrid-import-sheet').val('Data').trigger('change');
    assert.equal(grid.find('.formgrid-import-confirm').prop('disabled'),false);
    grid.find('.formgrid-import-confirm').trigger('click');
    assert.equal(values(grid)[0].name,'Andi');
});

test('template download preserves each grid column order without entering userview navigation', async t => {
    const {grid,other,window,$,dom} = setup({
        gridA: [{id:'date',type:'date'}, {id:'name',type:'text'}, {id:'select',type:'text'}, {id:'file',type:'file'}],
        gridB: [{id:'product_code',label:'Product',type:'text'}, {id:'quantity',type:'decimal'}, {id:'internal_note',type:'text',visibility:'no'}, {id:'sort',type:'text'}, {id:'photo',type:'image'}]
    });
    t.after(()=>dom.window.close());
    const blobs = [], downloads = [];
    let routedLinks = 0, submissions = 0;
    window.URL.createObjectURL = blob => { blobs.push(blob); return `blob:https://example.test/template-${blobs.length}`; };
    window.URL.revokeObjectURL = () => {};
    // Reproduce userview navigation intercepting a bubbled anchor click.
    $(window.document).on('click.userview', 'a', function(event) {
        routedLinks++;
        this.href = '/jw/web/userview/example/v/_/' + this.getAttribute('href');
        event.preventDefault();
    });
    $('form').on('submit', event => { submissions++; event.preventDefault(); });
    window.HTMLAnchorElement.prototype.click = function() {
        // A generic event exercises propagation without jsdom attempting a real download.
        const event = new window.Event('click', {bubbles:true,cancelable:true});
        this.dispatchEvent(event);
        downloads.push({href:this.href, filename:this.download, prevented:event.defaultPrevented});
    };
    grid.find('.formgrid-import-template')[0].click();
    other.find('.formgrid-import-template')[0].click();
    await waitUntil(()=>downloads.length === 2);
    assert.equal(routedLinks,0);
    assert.equal(submissions,0);
    assert.equal(downloads.length,2);
    assert(downloads.every(d=>d.href.startsWith('blob:') && d.filename.endsWith('.xlsx') && !d.prevented));
    assert(blobs.every(blob=>blob.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'));
    assert.equal(window.document.querySelectorAll('a[download]').length,0);
    const read = blob => new Promise((resolve,reject) => {
        const reader = new window.FileReader();
        reader.onload = () => {
            const bytes = new Uint8Array(reader.result);
            assert.equal(bytes[0],0x50); // A real XLSX ZIP file, rather than CSV renamed to .xlsx.
            assert.equal(bytes[1],0x4b);
            const wb = XLSX.read(bytes,{type:'array'});
            resolve(XLSX.utils.sheet_to_json(wb.Sheets.Import_Data,{header:1}));
        };
        reader.onerror = reject;
        reader.readAsArrayBuffer(blob);
    });
    assert.deepEqual(await read(blobs[0]), [['date','name','select']]);
    assert.deepEqual(await read(blobs[1]), [['product_code','quantity','internal_note']]);
    assert.equal(dataRows(grid).length,0);
    assert.equal(dataRows(other).length,0);
});

test('preview defaults to 10, allows 10/20/50/100 rows and imports the whole batch', async t => {
    const {grid,other,dom} = setup();
    t.after(()=>dom.window.close());
    grid.children('#validateMaxRow').val('200');
    other.children('#validateMaxRow').val('200');
    const csv = 'name\n' + Array.from({length:105},(_,i)=>'Person '+(i+1)).join('\n');
    await chooseFile(grid,csv);
    assert.equal(grid.find('.formgrid-import-preview tbody tr').length,10);
    assert.equal(grid.find('.formgrid-import-page-size').val(),'10');
    assert.equal(grid.find('.formgrid-import-pagination').prop('hidden'),false);
    assert.equal(grid.find('.formgrid-import-previous').prop('disabled'),true);
    grid.find('.formgrid-import-next').trigger('click');
    assert.equal(grid.find('.formgrid-import-preview tbody tr').first().children().first().text(),'11');
    assert.equal(grid.find('.formgrid-import-preview tbody tr').first().children().eq(1).text(),'Person 11');
    grid.find('.formgrid-import-previous').trigger('click');
    assert.equal(grid.find('.formgrid-import-preview tbody tr').first().children().eq(1).text(),'Person 1');
    for (const size of [10,20,50,100]) {
        grid.find('.formgrid-import-page-size').val(String(size)).trigger('change');
        assert.equal(grid.find('.formgrid-import-preview tbody tr').length,size);
        assert.match(grid.find('.formgrid-import-page-info').text(),new RegExp('Showing 1–'+size+' of 105'));
    }
    grid.find('.formgrid-import-next').trigger('click');
    assert.equal(grid.find('.formgrid-import-preview tbody tr').length,5);
    assert.equal(grid.find('.formgrid-import-preview tbody tr').first().children().first().text(),'101');
    assert.equal(grid.find('.formgrid-import-next').prop('disabled'),true);
    await chooseFile(other,csv);
    assert.equal(other.find('.formgrid-import-page-size').val(),'10');
    other.find('.formgrid-import-page-size').val('20').trigger('change');
    assert.equal(other.find('.formgrid-import-preview tbody tr').length,20);
    assert.equal(grid.find('.formgrid-import-preview tbody tr').length,5);
    grid.find('.formgrid-import-confirm').trigger('click');
    assert.equal(dataRows(grid).length,105);
    assert.equal(values(grid)[104].name,'Person 105');
    assert.equal(grid.find('.formgrid-import-pagination').prop('hidden'),true);
    assert.equal(dataRows(other).length,0);
});

test('preview validates hidden pages and resets to page one for a new file', async t => {
    const {grid,dom} = setup();
    t.after(()=>dom.window.close());
    grid.children('#validateMaxRow').val('200');
    const names = Array.from({length:25},(_,i)=>'Person '+(i+1));
    await chooseFile(grid,'name\n'+[...names,'Person 1'].join('\n'));
    assert.match(grid.find('.formgrid-import-status').text(),/Row 27: duplicate/);
    assert.equal(grid.find('.formgrid-import-pagination').prop('hidden'),true);
    assert.equal(grid.find('.formgrid-import-confirm').prop('disabled'),true);
    await chooseFile(grid,'name\n'+names.join('\n'));
    assert.equal(grid.find('.formgrid-import-page-size').val(),'10');
    grid.find('.formgrid-import-next').trigger('click');
    assert.match(grid.find('.formgrid-import-page-info').text(),/Page 2 of 3/);
    await chooseFile(grid,'name\nNew Person');
    assert.match(grid.find('.formgrid-import-page-info').text(),/Showing 1–1 of 1 rows. Page 1 of 1/);
    assert.equal(grid.find('.formgrid-import-previous').prop('disabled'),true);
    assert.equal(grid.find('.formgrid-import-next').prop('disabled'),true);
    grid.find('.formgrid-import-cancel').trigger('click');
    assert.equal(grid.find('.formgrid-import-pagination').prop('hidden'),true);
});
