const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {JSDOM} = require('jsdom');
const jquery = require('jquery');
const base = path.join(__dirname, '../../main/resources/resources/js');
function fixture(id) {
    return `<div class="form-cell"><div id="${id}" class="formgrid-custom" name="${id}">
    <input disabled class="formgrid-field-id" value="${id}"><input disabled class="formgrid-field-label" value="${id}">
    <input disabled class="formDefKeys" value="dept,note,parentId"><input disabled id="validateMaxRow"><input disabled class="uniqueKey">
    <div class="grid-validation-error" hidden><span class="error-content"></span></div>
    <div class="formgrid-search"><input class="formgrid-search-input"><span class="formgrid-search-empty" hidden>No matching records.</span></div>
    <table><thead><tr><th class="formgrid-row-number">No.</th><th>Department</th><th>Note</th></tr></thead><tbody>
    <tr class="grid-row-template" style="display:none"><td class="formgrid-row-number"><span class="grid-cell rowNumber"></span></td><td><span class="grid-cell" column_key="dept" column_type="options" column_format="child"></span></td>
    <td><span class="grid-cell" column_key="note" column_type="text"></span></td>
    <td style="display:none"><textarea name="${id}_jsonrow" id="${id}_jsonrow"></textarea></td></tr>
    </tbody></table><p class="pg-navigator"></p></div></div>`;
}
function setup({onLoad=false, mode='always', empty='clear', readonly=false, editable=false, initialize=true, seed}={}) {
    const dom = new JSDOM(`<form id="main"><select name="dept"><option value="IT">IT</option><option value="FIN">Finance</option><option value="">None</option></select>
    <input name="note" value="Main note">${fixture('items')}${fixture('other')}
    <div class="subform-container"><select name="sub_dept"><option value="HR">HR</option><option value="OPS">Operations</option></select>${fixture('subitems')}</div></form>
    <form id="another"><input name="dept" value="Unrelated"></form>`, {runScripts:'outside-only', url:'https://example.test/'});
    const $ = jquery(dom.window), window=dom.window;
    window.$=window.jQuery=$;window.UI={escapeHTML:value=>$('<span>').text(value==null?'':value).html()};window.JPopup={hide(){}};
    for (const file of ['jquery.formGridCustom.js','jquery.utils.js','jquery.formGridCustom.remake.js','jquery.gridPagingCustom.js','jquery.formGridEditable.js','jquery.formGridSync.js']) window.eval(fs.readFileSync(path.join(base,file),'utf8'));
    const grid=$('#items'), other=$('#other'), sub=$('#subitems'), source=$('#main > select[name=dept]');
    $('.formgrid-custom').formGridCustom({messages:{},options:{dept:{IT:'IT Department',FIN:'Finance Department',HR:'HR',OPS:'Operations',OLD:'Historical'}}});
    function add(target,data) {target.formGridCustom('addRow',{result:JSON.stringify(data)});return target.children('table').find('tr.grid-row').last();}
    for(let i=0;i<12;i++) add(grid,{id:'r'+i,dept:'OLD',note:'Row '+i,parentId:'p1',_tempRequestParamsMap:{dept:['OLD'],note:['original']},_tempFilePathMap:{file:['keep']}});
    add(other,{id:'other',dept:'OLD',note:'Other grid'});add(sub,{id:'sub',dept:'OLD',note:'Subform row'});
    if(readonly) grid.addClass('readonly');
    if(editable) grid.formGridEditable({columns:[{id:'dept',editor:'SelectBox',options:{IT:'IT Department',FIN:'Finance Department',OLD:'Historical'}},{id:'note',editor:'TextField'}]});
    grid.gridPagingCustom({customSize:2,threshold:0});
    if(seed) seed({$,grid,other,sub,add,window,source});
    const settings={syncOnLoad:onLoad,mappings:[{source:'dept',target:'dept',mode,empty}]};
    if(initialize) grid.formGridSync(settings);
    const values=target=>(target||grid).getValues();
    const change=value=>source.val(value).trigger('change');
    return {dom,window,$,grid,other,sub,source,settings,add,values,change};
}
test('combobox changes update every row and its stored payload across pages without replacing IDs or metadata',t=>{
    const s=setup({seed({grid}){grid.updateRowData(data=>{data._decryptedDataMap={dept:'Stale display',note:'Preserved'};});}});t.after(()=>s.dom.window.close());
    assert.equal(s.values()[0].dept,'OLD');
    let changes=0;s.grid.on('change.verify',()=>changes++);
    s.change('FIN');
    assert.equal(s.values().length,12);
    assert.ok(s.values().every(row=>row.dept==='FIN'&&row.parentId==='p1'));
    assert.equal(s.values(s.other)[0].dept,'OLD');assert.equal(s.values(s.sub)[0].dept,'OLD');
    assert.match(s.grid.children('table').find('tr.grid-row').last().text(),/Finance Department/);
    const raw=JSON.parse(s.grid.children('table').find('tr.grid-row textarea').first().val());
    assert.deepEqual(raw._tempRequestParamsMap,{dept:['FIN'],note:['original']});
    assert.deepEqual(raw._tempFilePathMap,{file:['keep']});assert.equal(raw.id,'r0');
    assert.deepEqual(raw._decryptedDataMap,{note:'Preserved'});
    assert.equal(s.$('#main').serializeArray().filter(field=>field.name.startsWith('items_jsonrow_')).length,12);
    assert.equal(changes,1);s.change('FIN');assert.equal(changes,1);
    s.change('IT');assert.ok(s.values().every(row=>row.dept==='IT'));assert.equal(changes,2);
});
test('row numbering survives initial sync, repeated source changes and grid edits across pages',t=>{
    for (const get of ['value','label']) {
        const s=setup({editable:true,initialize:false});t.after(()=>s.dom.window.close());
        const numbers=()=>s.grid.children('table').find('tr.grid-row .rowNumber').map(function(){return s.$(this).text();}).get();
        const expected=Array.from({length:12},(_,i)=>String(i+1));
        assert.deepEqual(numbers(),expected);
        s.grid.formGridSync({...s.settings,syncOnLoad:true,mappings:[{...s.settings.mappings[0],get}]});
        assert.deepEqual(numbers(),expected,'initial sync');
        s.change('FIN');assert.deepEqual(numbers(),expected,'main form change');
        s.grid.gridPagingCustom('showPage',2);s.change('IT');assert.deepEqual(numbers(),expected,'off-page numbers');
        s.grid.find('tr.grid-row input.formgrid-editor').first().val('Inline edit').trigger('input');
        assert.deepEqual(numbers(),expected,'inline grid change');
        const row=s.grid.children('table').find('tr.grid-row').first();
        const raw=JSON.parse(row.find('textarea:not(.formgrid-editor)').val());raw.note='Refilled grid row';
        s.$.formGridCustom.fillValue(s.grid,row,JSON.stringify(raw));
        s.grid.trigger('change');assert.deepEqual(numbers(),expected,'grid row refill');
        assert.ok(s.values().every(data=>!Object.hasOwn(data,'rowNumber')));
    }
});
test('request parameter metadata preserves scalar semicolons and emits arrays only for multi-value targets',t=>{
    const s=setup({initialize:false});t.after(()=>s.dom.window.close());
    s.settings.mappings=[{source:'note',target:'note',targetParam:'child_note',multiple:false}];s.grid.formGridSync(s.settings);
    s.$('#main > input[name=note]').val('A;B').trigger('change');
    let raw=JSON.parse(s.grid.find('tr.grid-row textarea').first().val());
    assert.deepEqual(raw._tempRequestParamsMap.note,['A;B']);assert.deepEqual(raw._tempRequestParamsMap.child_note,['A;B']);
    s.settings.mappings[0].multiple=true;s.$('#main > input[name=note]').val('B;C').trigger('change');
    raw=JSON.parse(s.grid.find('tr.grid-row textarea').first().val());assert.deepEqual(raw._tempRequestParamsMap.note,['B','C']);
});
test('one source can sync its Value and Label to separate targets, including new rows and label-only changes',t=>{
    const s=setup({initialize:false});t.after(()=>s.dom.window.close());
    s.settings.mappings.push({source:'dept',target:'note',get:'label'});s.grid.formGridSync(s.settings);
    s.change('FIN');assert.ok(s.values().every(row=>row.dept==='FIN'&&row.note==='Finance'));
    assert.match(s.grid.find('tr.grid-row').first().text(),/Finance/);
    s.add(s.grid,{id:'new',dept:'OLD',note:'Previous'});assert.equal(s.values().at(-1).note,'Finance');
    s.source.find('option[value=FIN]').text('Finance & Accounting');s.source.trigger('change');
    assert.ok(s.values().every(row=>row.dept==='FIN'&&row.note==='Finance & Accounting'));
    const raw=JSON.parse(s.grid.find('tr.grid-row textarea').first().val());assert.deepEqual(raw._tempRequestParamsMap.note,['Finance & Accounting']);
    s.change('IT');assert.equal(s.values()[0].note,'IT');
});
test('Label mode honors empty source handling instead of copying the placeholder, and text fields keep their value',t=>{
    for(const empty of ['clear','keep']) {
        const s=setup({initialize:false,empty});t.after(()=>s.dom.window.close());s.settings.mappings[0].get='label';s.grid.formGridSync(s.settings);
        s.change('FIN');s.change('');assert.equal(s.values()[0].dept,empty==='keep'?'Finance':'');
    }
    const s=setup({initialize:false});t.after(()=>s.dom.window.close());
    s.settings.mappings=[{source:'note',target:'note',get:'label'}];s.grid.formGridSync(s.settings);
    s.$('#main > input[name=note]').val('Typed text').trigger('change');assert.equal(s.values()[0].note,'Typed text');
});
test('Label mode reads multiselect and associated radio/checkbox labels as plain text',t=>{
    const s=setup({initialize:false});t.after(()=>s.dom.window.close());
    s.source.replaceWith('<select name="dept" multiple><option value="IT" selected>Information Technology</option><option value="FIN">Finance</option></select>');
    s.settings.mappings[0].get='label';s.grid.formGridSync(s.settings);
    s.$('#main > select').val(['IT','FIN']).trigger('change');assert.equal(s.values()[0].dept,'Information Technology;Finance');
    s.$('#main > select').remove();s.$('#main').prepend('<label><input type="radio" name="dept" value="IT">Information Technology</label><input id="fin" type="radio" name="dept" value="FIN" checked><label for="fin">Finance Division</label>');
    s.$('#fin').trigger('change');assert.equal(s.values()[0].dept,'Finance Division');
    s.$('#fin').remove();s.$('#main > label').remove();
    s.$('#main').prepend('<label><input type="checkbox" name="dept[]" value="IT" checked>Information Technology</label><label><input type="checkbox" name="dept[]" value="FIN" checked>Finance</label>');
    s.$('input[name="dept[]"]').first().trigger('change');assert.equal(s.values()[0].dept,'Information Technology;Finance');
    s.$('#main > label').remove();s.$('#main').prepend('<select name="dept"><option value="IT">&lt;img src=x onerror=alert(1)&gt;</option></select>');
    s.$('#main > select').trigger('change');assert.equal(s.values()[0].dept,'<img src=x onerror=alert(1)>');assert.equal(s.grid.find('img').length,0);
});
test('initial sync is opt-in and fresh Add, duplicate, setValues and popup edits follow the current value',t=>{
    const s=setup();t.after(()=>s.dom.window.close());
    const added=s.add(s.grid,{id:'new',dept:'OLD',note:'Added'});
    assert.equal(s.values().at(-1).dept,'IT');assert.equal(s.values()[0].dept,'OLD');
    added.find('.grid-action-duplicate').formGridCustom('duplicateRow');
    assert.equal(s.values().at(-1).dept,'IT');
    s.change('FIN');
    s.grid.formGridCustom('editRow',{rowId:added.attr('id'),result:JSON.stringify({id:'new',dept:'IT',note:'Stale popup'})});
    assert.equal(s.values().find(row=>row.id==='new').dept,'FIN');
    s.grid.setValues([{id:'seed',dept:'IT',note:'Replacement'}]);assert.equal(s.values()[0].dept,'FIN');
    const initial=setup({onLoad:true});t.after(()=>initial.dom.window.close());assert.ok(initial.values().every(row=>row.dept==='IT'));
});
test('only-empty mode preserves zero and nonempty manual values and updates missing or empty targets',t=>{
    const s=setup({mode:'empty',seed({grid}){grid.updateRowData((data,row)=>{if(data.id==='r0')data.dept='';if(data.id==='r1')delete data.dept;if(data.id==='r2')data.dept=0;});}});t.after(()=>s.dom.window.close());
    s.change('FIN');
    assert.equal(s.values()[0].dept,'FIN');assert.equal(s.values()[1].dept,'FIN');assert.equal(s.values()[2].dept,0);assert.equal(s.values()[3].dept,'OLD');
    s.add(s.grid,{id:'manual',dept:'IT'});assert.equal(s.values().at(-1).dept,'IT');
    s.add(s.grid,{id:'empty',dept:''});assert.equal(s.values().at(-1).dept,'FIN');
});
test('empty-source clear and keep modes behave independently per mapping and preserve unrelated fields',t=>{
    for(const empty of ['clear','keep']) {
        const s=setup({empty,initialize:false});t.after(()=>s.dom.window.close());
        s.settings.mappings.push({source:'note',target:'note',mode:'always',empty:'keep'});s.grid.formGridSync(s.settings);
        s.change('FIN');s.change('');assert.equal(s.values()[0].dept,empty==='keep'?'FIN':'');
        assert.equal(s.values()[0].note,'Row 0');
        s.$('#main > input[name=note]').val('Changed note').trigger('change');assert.equal(s.values()[0].note,'Changed note');
        assert.equal(s.values()[0].dept,empty==='keep'?'FIN':'');
    }
});
test('main field lookup stays within its form/subform and supports dynamic replacement and generated parameter names',t=>{
    const s=setup();t.after(()=>s.dom.window.close());
    s.sub.formGridSync({mappings:[{source:'dept',sourceParam:'sub_dept',target:'dept'}]});
    s.$('#another input').val('FIN').trigger('change');assert.equal(s.values()[0].dept,'OLD');
    s.$('[name=sub_dept]').val('OPS').trigger('change');assert.equal(s.values(s.sub)[0].dept,'OPS');assert.equal(s.values()[0].dept,'OLD');
    s.source.replaceWith('<select name="dept"><option value="FIN">Finance</option></select>');
    s.$('#main > select').trigger('change');assert.equal(s.values()[0].dept,'FIN');assert.equal(s.values(s.sub)[0].dept,'OPS');
});
test('multiselect, radio and checkbox sources copy stored values, including empty choices',t=>{
    const s=setup({initialize:false});t.after(()=>s.dom.window.close());
    s.source.replaceWith('<select name="dept" multiple><option value="IT" selected>Information Technology</option><option value="FIN">Finance</option></select>');
    s.grid.formGridSync(s.settings);s.$('#main > select').val(['IT','FIN']).trigger('change');assert.equal(s.values()[0].dept,'IT;FIN');
    s.$('#main > select').replaceWith('<input type="radio" name="dept" value="IT"><input type="radio" name="dept" value="FIN" checked>');
    s.$('#main > input[name=dept]').last().trigger('change');assert.equal(s.values()[0].dept,'FIN');
    s.$('#main > input[name=dept]').remove();s.$('#main').prepend('<input type="checkbox" name="dept[]" value="IT" checked><input type="checkbox" name="dept[]" value="FIN" checked>');
    s.$('#main > input[name="dept[]"]').first().trigger('change');assert.equal(s.values()[0].dept,'IT;FIN');
    s.$('#main > input[name="dept[]"]').prop('checked',false).trigger('change');assert.equal(s.values()[0].dept,'');
});
test('text input is debounced and submit flushes pending changes before serializing',async t=>{
    const s=setup({initialize:false});t.after(()=>s.dom.window.close());s.source.replaceWith('<input name="dept" value="IT">');s.grid.formGridSync(s.settings);
    const input=s.$('#main > input[name=dept]');input.val('FIN').trigger('input');assert.equal(s.values()[0].dept,'OLD');
    await new Promise(resolve=>setTimeout(resolve,240));assert.equal(s.values()[0].dept,'FIN');
    input.val('IT').trigger('input');s.$('#main').triggerHandler(s.$.Event('submit'));assert.equal(s.values()[0].dept,'IT');
});
test('editable controls, search results and raw payloads all refresh together without HTML injection',t=>{
    const s=setup({editable:true});t.after(()=>s.dom.window.close());
    s.grid.children('.formgrid-search').find('input').val('Finance Department').trigger('input');
    assert.equal(s.grid.children('table').find('.fg-search-hidden').length,12);
    s.change('FIN');assert.equal(s.grid.children('table').find('.fg-search-hidden').length,0);
    assert.ok(s.grid.find('tr.grid-row select.formgrid-editor').toArray().every(input=>input.value==='FIN'));
    s.grid.find('tr.grid-row select.formgrid-editor').first().val('IT').trigger('change');assert.equal(s.values()[0].dept,'IT');
    s.change('IT');s.change('FIN');assert.equal(s.values()[0].dept,'FIN');
    s.source.append(s.$('<option>').val('<img src=x onerror=alert(1)>').text('Literal'));s.change('<img src=x onerror=alert(1)>');
    assert.equal(s.grid.find('img').length,0);assert.equal(s.values()[0].dept,'<img src=x onerror=alert(1)>');
});
test('disabled feature, builder and readonly root/child permissions prevent synchronization',t=>{
    for(const mode of ['disabled','builder','readonly','nestedReadonly']) {
        const s=setup({initialize:false,readonly:mode==='readonly'});t.after(()=>s.dom.window.close());
        if(mode==='builder')s.grid.attr('data-builder-design','true');
        if(mode==='nestedReadonly'){s.other.addClass('readonly');s.grid.data('nestedOwner',s.other[0]);}
        s.grid.formGridSync({...s.settings,enabled:mode!=='disabled'});s.change('FIN');assert.equal(s.values()[0].dept,'OLD',mode);
        assert.equal(s.grid.children('.formgrid-sync-status').length,0,mode);
    }
});
test('invalid mappings and missing sources surface errors and block save; missing dynamic fields can recover',t=>{
    for(const mapping of [{source:'dept',target:'id'},{source:'dept',target:'__proto__'},{source:'dept',target:'dept',mode:'bogus'},{source:'dept',target:'dept',get:'bogus'},{source:'missing',target:'dept'}]) {
        const s=setup({initialize:false});t.after(()=>s.dom.window.close());s.grid.formGridSync({mappings:[mapping]});
        const event=s.$.Event('submit');s.$('#main').triggerHandler(event);assert.equal(event.isDefaultPrevented(),true);assert.equal(s.values()[0].dept,'OLD');
        assert.equal(s.grid.children('.formgrid-sync-status').prop('hidden'),false);
        if(mapping.source==='missing'){s.$('#main').prepend('<input name="missing" value="FIN">');s.$('[name=missing]').trigger('change');assert.equal(s.values()[0].dept,'FIN');assert.equal(s.grid.children('.formgrid-sync-status').prop('hidden'),true);}
    }
});
test('schema exposes opt-in mapping and safe initialization defaults',()=>{
    const schema=JSON.parse(fs.readFileSync(path.join(base,'../../properties/FormGridCustom.json'),'utf8').replace('%s','{}'));
    const section=schema.find(section=>section.title==='Field Synchronization');
    assert.equal(section.properties.find(p=>p.name==='enableFieldSync').value,'false');
    assert.equal(section.properties.find(p=>p.name==='fieldSyncOnLoad').value,'false');
    const mapping=section.properties.find(p=>p.name==='fieldSyncMappings');assert.equal(mapping.control_field,'enableFieldSync');
    assert.deepEqual(mapping.columns.map(column=>column.key),['source','target','mode','empty','get']);
    assert.equal(mapping.columns.find(column=>column.key==='get').value,'value');
});
