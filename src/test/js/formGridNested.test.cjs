const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {JSDOM} = require('jsdom');
const jquery = require('jquery');
const base = path.join(__dirname, '../../main/resources/resources/js');
function fixture(id) {
    return `<div class="form-cell"><div id="grid_${id}" name="${id}" class="formgrid-custom">
      <input disabled class="formgrid-field-id" value="${id}"><input disabled id="formUrl" value="/form?embed=true">
      <input disabled id="height" value="500"><input disabled id="width" value="900"><input disabled id="json" value="signed"><input disabled id="nonce" value="nonce">
      <input disabled id="validateMaxRow"><input disabled id="deleteMessage" value="Delete row?">
      <div class="grid-validation-error" style="display:none"><span class="error-content"></span></div>
      <table><thead><tr><th>Name</th><th style="display:none">Parent</th><th></th></tr></thead><tbody>
      <tr class="grid-row-template" style="display:none"><td><span class="grid-cell" column_key="name" column_type="text"></span></td>
      <td style="display:none"><span class="grid-cell" column_key="parentId" column_type="text"></span></td>
      <td style="display:none"><textarea id="${id}_jsonrow" name="${id}_jsonrow"></textarea></td></tr>
      </tbody></table><button type="button" class="formgrid-custom-add">Add</button></div></div>`;
}
function setup(relations = [{gridId:'areas',foreignKey:'parentId'},{gridId:'types',parentGridId:'areas',foreignKey:'parentId'}], {readonly=false, count=2, extraIds=[], seed} = {}) {
    const dom = new JSDOM(`<form>${['plants','areas','types','other',...extraIds].map(fixture).join('')}<button type="submit">Save</button></form>`, {runScripts:'outside-only',url:'https://example.test/'});
    const window = dom.window, $ = jquery(window), popups = [];
    window.$ = window.jQuery = $;
    window.UI = {escapeHTML:value=>$('<span>').text(value == null ? '' : value).html(),userviewThemeParams:()=>''};
    window.JPopup = {hide(){},show(...args){popups.push(args);}};
    window.confirm = ()=>true;
    for (const file of ['jquery.formGridCustom.js','jquery.utils.js','jquery.formGridCustom.remake.js','jquery.gridPagingCustom.js','jquery.formGridEditable.js','jquery.formGridNested.js']) window.eval(fs.readFileSync(path.join(base,file),'utf8'));
    const grid=id=>$('#grid_'+id);
    $('.formgrid-custom').formGridCustom({messages:{},options:{}});
    function add(id,data) {grid(id).formGridCustom('addRow',{result:JSON.stringify(data)}); return grid(id).children('table').find('tr.grid-row').last();}
    const first=add('plants',{id:'p1',name:'Plant One'});
    const second=add('plants',{id:'p2',name:'Plant Two'});
    const area=add('areas',{id:'a1',name:'Area One',parentId:'p1'});
    add('areas',{id:'a2',name:'Area Two',parentId:'p2'});
    add('types',{id:'t1',name:'Type One',parentId:'a1'});
    if (seed) seed({grid,add});
    grid('plants').gridPagingCustom({customSize:count});
    if (readonly) grid('plants').addClass('readonly');
    grid('plants').formGridNested({relations});
    const expand=row=>row.children('.formgrid-nested-togglecell').find('button').trigger('click');
    const data=row=>JSON.parse(row.find('textarea:not(.formgrid-editor)').first().val());
    return {dom,window,$,grid,add,first,second,area,popups,expand,data};
}
test('recursive views match foreign keys and keep canonical submitted data isolated', t=>{
    const s=setup(); t.after(()=>s.dom.window.close());
    s.expand(s.first);
    let detail=s.first.next();
    assert.match(detail.text(),/Area One/); assert.doesNotMatch(detail.text(),/Area Two/);
    assert.equal(detail.find('[name],textarea,.grid-row,.grid-cell').length,0);
    assert.equal(s.grid('plants').getValues().length,2);
    assert.equal(s.grid('areas').getValues().length,2);
    assert.equal(s.grid('areas').closest('.form-cell').hasClass('formgrid-nested-source'),true);
    detail.find('.formgrid-nested-toggle').trigger('click');
    assert.match(s.first.next().text(),/Type One/);
    s.expand(s.second);
    assert.match(s.second.next().text(),/Area Two/); assert.doesNotMatch(s.second.next().text(),/Area One|Type One/);
    s.expand(s.first); assert.equal(s.first.next().hasClass('formgrid-nested-root-detail'),false);
});
test('Add pre-fills and enforces the FK in the canonical child JSON and binder request parameters',t=>{
    const s=setup();t.after(()=>s.dom.window.close());s.expand(s.first);
    s.first.next().find('.formgrid-nested-add').first().trigger('click');
    const params=s.popups.at(-1)[2];
    assert.equal(JSON.parse(params._jsonFormData).parentId,'p1');
    s.window[params._callback]({result:JSON.stringify({id:'new',name:'New Area',parentId:'wrong',_tempRequestParamsMap:{parentId:['wrong']}})});
    const added=s.grid('areas').children('table').find('tr.grid-row').last();
    assert.equal(s.data(added).parentId,'p1'); assert.deepEqual(s.data(added)._tempRequestParamsMap.parentId,['p1']);
    assert.match(s.first.next().text(),/New Area/); assert.equal(s.grid('plants').getValues().length,2);
    assert.equal(s.$('form').serializeArray().filter(pair=>pair.name.startsWith('areas_jsonrow_')).length,3);
});
test('cancelled nested Add does not leak defaults into ordinary Add or programmatic inserts',t=>{
    const s=setup();t.after(()=>s.dom.window.close());s.expand(s.first);
    s.first.next().find('.formgrid-nested-add').trigger('click');
    s.add('areas',{id:'outside',name:'Explicit Parent',parentId:'p2'});
    assert.equal(s.data(s.grid('areas').children('table').find('tr.grid-row').last()).parentId,'p2');
    assert.doesNotMatch(s.first.next().text(),/Explicit Parent/);
});
test('parent deletion is restricted, leaf deletion synchronizes views and indexing',t=>{
    const s=setup();t.after(()=>s.dom.window.close());s.expand(s.first);
    s.first.find('.grid-action-delete').trigger('click');
    assert.equal(s.grid('plants').getValues().length,2);
    assert.match(s.grid('plants').children('.formgrid-nested-status').text(),/Delete related child/);
    s.first.next().find('.formgrid-nested-toggle').trigger('click');
    s.first.next().find('[data-child-grid="types"] .formgrid-nested-delete').trigger('click');
    assert.equal(s.grid('types').getValues().length,0);
    s.first.next().find('[data-child-grid="areas"] > .formgrid-nested-scroll > table > tbody > tr > .formgrid-nested-actions .formgrid-nested-delete').trigger('click');
    assert.equal(s.grid('areas').getValues().length,1);
    s.first.find('.grid-action-delete').trigger('click');
    assert.equal(s.grid('plants').getValues().length,1);
    assert.equal(s.grid('plants').children('table').find('tr.formgrid-nested-root-detail').length,0);
});
test('readonly and disabled Add/Delete and max rows are respected',t=>{
    const s=setup(undefined,{readonly:true});t.after(()=>s.dom.window.close());s.expand(s.first);
    assert.equal(s.first.next().find('.formgrid-nested-add,.formgrid-nested-delete').length,0);
    assert.equal(s.first.next().find('.formgrid-nested-edit').length,0);
    const other=setup();t.after(()=>other.dom.window.close());
    other.grid('areas').children('#validateMaxRow').val('2');other.expand(other.first);
    assert.equal(other.first.next().find('.formgrid-nested-add').prop('disabled'),true);
    other.first.next().find('.formgrid-nested-add').trigger('click');assert.equal(other.popups.length,0);
});
test('paging hides and restores expanded details with their parent',t=>{
    const s=setup(undefined,{count:1});t.after(()=>s.dom.window.close());s.expand(s.first);
    assert.notEqual(s.first.next().css('display'),'none');
    s.grid('plants').gridPagingCustom('showPage',2);
    assert.equal(s.first.next().css('display'),'none');
    s.grid('plants').gridPagingCustom('showPage',1);
    assert.notEqual(s.first.next().css('display'),'none');
});
test('invalid graphs fail visibly without hiding child grids',t=>{
    for(const relations of [[],[{gridId:'missing',foreignKey:'parentId'}],[{gridId:'areas',foreignKey:'parentId',parentGridId:'types'},{gridId:'types',foreignKey:'parentId',parentGridId:'areas'}],[{gridId:'areas',foreignKey:'parentId'},{gridId:'areas',foreignKey:'parentId'}]]) {
        const s=setup(relations);t.after(()=>s.dom.window.close());
        assert.equal(s.grid('plants').children('.formgrid-nested-status').prop('hidden'),false);
        assert.equal(s.grid('areas').closest('.form-cell').hasClass('formgrid-nested-source'),false);
    }
});
test('orphan FKs, empty/duplicate parent keys block submission instead of silently losing data',t=>{
    const s=setup();t.after(()=>s.dom.window.close());
    s.add('areas',{id:'orphan',name:'Orphan',parentId:'absent'});
    let event=s.$.Event('submit');s.$('form').triggerHandler(event);
    assert.equal(event.isDefaultPrevented(),true);assert.match(s.grid('plants').children('.formgrid-nested-status').text(),/no matching parent/);
    s.add('plants',{id:'p1',name:'Duplicate'});
    event=s.$.Event('submit');s.$('form').triggerHandler(event);
    assert.equal(event.isDefaultPrevented(),true);assert.match(s.grid('plants').children('.formgrid-nested-status').text(),/must be unique/);
});
test('branches and out-of-order definitions can use custom parent keys',t=>{
    const s=setup([{gridId:'types',foreignKey:'parentId',parentGridId:'areas'},{gridId:'areas',foreignKey:'parentId',parentKey:'name'}]);t.after(()=>s.dom.window.close());
    s.grid('areas').updateRowData(data=>{data.parentId=data.id==='a1'?'Plant One':'Plant Two';});
    s.grid('plants').data('formGridNested').refresh();s.expand(s.first);
    assert.match(s.first.next().text(),/Area One/);assert.doesNotMatch(s.first.next().text(),/Area Two/);
});

test('six configured levels render recursively and a second branch remains isolated',t=>{
    const relations=[
        {gridId:'areas',foreignKey:'parentId'},
        {gridId:'groups',parentGridId:'areas',foreignKey:'parentId'},
        {gridId:'types',parentGridId:'groups',foreignKey:'parentId'},
        {gridId:'tags',parentGridId:'types',foreignKey:'parentId'},
        {gridId:'parameters',parentGridId:'tags',foreignKey:'parentId'},
        {gridId:'other',foreignKey:'parentId',label:'Sibling branch'}
    ];
    const s=setup(relations,{extraIds:['groups','tags','parameters'],seed({grid,add}){
        grid('types').updateRowData(data=>{data.parentId='g1';});
        add('groups',{id:'g1',parentId:'a1',name:'Pump Group'});
        add('tags',{id:'tag1',parentId:'t1',name:'Pump Tag'});
        add('parameters',{id:'param1',parentId:'tag1',name:'Pressure'});
        add('other',{id:'branch1',parentId:'p2',name:'Second plant only'});
    }}); t.after(()=>s.dom.window.close());
    s.expand(s.first);
    for(let depth=0;depth<4;depth++) s.first.next().find('.formgrid-nested-toggle[aria-expanded="false"]').first().trigger('click');
    assert.match(s.first.next().text(),/Pressure/);
    assert.doesNotMatch(s.first.next().text(),/Second plant only/);
    s.expand(s.second);assert.match(s.second.next().text(),/Second plant only/);
    assert.equal(s.first.next().find('[name],.grid-row').length,0);
});
test('sorting keeps expanded details adjacent to their parent and source updates refresh the view',async t=>{
    const s=setup();t.after(()=>s.dom.window.close());s.expand(s.first);
    s.grid('plants').children('table').find('thead th').eq(1).attr('id','sort_name');
    s.grid('plants').addClass('enableSorting').gridPagingCustom('enableSorting');
    s.grid('plants').children('table').find('#sort_name').trigger('click').trigger('click');
    assert.equal(s.first.prev()[0],s.second[0]);
    assert.match(s.first.next().text(),/Area One/);
    s.grid('areas').updateRowData(data=>{if(data.id==='a1')data.name='Updated programmatically';});
    await new Promise(resolve=>setTimeout(resolve,5));
    assert.match(s.first.next().text(),/Updated programmatically/);
});
test('child popup edits update only the canonical row and invalid FK edits block save',t=>{
    const s=setup();t.after(()=>s.dom.window.close());s.expand(s.first);
    s.first.next().find('.formgrid-nested-edit').trigger('click');
    assert.equal(JSON.parse(s.popups.at(-1)[2]._jsonFormData).id,'a1');
    s.grid('areas').formGridCustom('editRow',{rowId:s.area.attr('id'),result:JSON.stringify({...s.data(s.area),name:'Edited Area'})});
    assert.match(s.first.next().text(),/Edited Area/); assert.doesNotMatch(s.first.next().text(),/Area Two/);
    s.grid('areas').formGridCustom('editRow',{rowId:s.area.attr('id'),result:JSON.stringify({...s.data(s.area),parentId:'unknown'})});
    const event=s.$.Event('submit');s.$('form').triggerHandler(event);
    assert.equal(event.isDefaultPrevented(),true);
});
test('hidden source validation errors are surfaced and expansion keeps keyboard focus',t=>{
    const s=setup();t.after(()=>s.dom.window.close());s.expand(s.first);
    assert.equal(s.window.document.activeElement,s.first.find('.formgrid-nested-toggle')[0]);
    s.grid('areas').prepend('<input disabled class="uniqueKey" value="name">');
    s.first.next().find('.formgrid-nested-add').trigger('click');
    const params=s.popups.at(-1)[2];
    s.window[params._callback]({result:JSON.stringify({id:'duplicate',name:'Area One'})});
    assert.equal(s.grid('areas').getValues().length,2);
    assert.match(s.grid('plants').children('.formgrid-nested-status').text(),/unique value/);
    s.grid('areas').children('.grid-validation-error').hide();
    s.grid('areas').closest('.form-cell').prepend('<label><span class="form-error-message">Row 1: Name is required</span></label>');
    s.grid('plants').data('formGridNested').refresh();
    assert.match(s.grid('plants').children('.formgrid-nested-status').text(),/Name is required/);
    s.grid('areas').trigger('change');
    assert.equal(s.grid('areas').closest('.form-cell').children('label').find('.form-error-message').length,0);
});

function sortableSeed({grid,add}) {
    grid('areas').addClass('enableSorting').prepend('<input disabled class="formgrid-sort-field" value="sort">');
    add('areas',{id:'a3',name:'Third Area',parentId:'p1'});
    add('areas',{id:'a4',name:'Fourth Area',parentId:'p2'});
    add('areas',{id:'a5',name:'Fifth Area',parentId:'p1'});
}
function sectionRows(s,parent=s.first) {
    return parent.next().find('[data-child-grid="areas"] > .formgrid-nested-scroll > table > tbody > tr.formgrid-nested-row');
}
test('nested toolbar uses the same icon factory, tooltips and button spacing classes as the main grid',t=>{
    const s=setup([{gridId:'areas',foreignKey:'parentId',sortWithButtons:'true',enableDuplicate:'true'}],{seed:sortableSeed});
    t.after(()=>s.dom.window.close());s.expand(s.first);
    const view=sectionRows(s).first(), toolbar=view.find('.grid-row-actions');
    assert.equal(toolbar.find('.grid-reorder-buttons').length,1);assert.equal(toolbar.find('.grid-edit-buttons').length,1);
    for(const [kind,icon,label] of [['moveup','fa-arrow-up','Move Up'],['movedown','fa-arrow-down','Move Down'],['edit','fa-pen','Edit Row'],['duplicate','fa-copy','Duplicate Row'],['delete','fa-trash','Delete Row']]) {
        const action=toolbar.find('.formgrid-nested-'+kind);
        assert.equal(action.attr('title'),label);assert.equal(action.attr('aria-label'),label);
        assert.equal(action.hasClass('btn-icon'),true);assert.equal(action.hasClass('grid-row-action'),true);
        assert.equal(action.find('i.fas.'+icon).attr('aria-hidden'),'true');assert.equal(action.text(),'');
        assert.equal(s.area.find('.grid-action-'+kind+' i').hasClass(icon),true);
    }
    assert.equal(s.first.next().find('.formgrid-nested-add i.fa-plus').length,1);
});
test('sort buttons reorder sibling JSON rows, maintain FK links and contiguous submission names',t=>{
    const s=setup([{gridId:'areas',foreignKey:'parentId',sortWithButtons:'true'}],{seed:sortableSeed});
    t.after(()=>s.dom.window.close());s.expand(s.first);s.expand(s.second);
    assert.equal(sectionRows(s).first().find('.formgrid-nested-moveup').prop('disabled'),true);
    assert.equal(sectionRows(s).last().find('.formgrid-nested-movedown').prop('disabled'),true);
    const otherBefore=Array.from(s.grid('areas').getValues()).filter(v=>v.parentId==='p2').map(v=>v.id);
    sectionRows(s).first().find('.formgrid-nested-movedown').trigger('click');
    assert.deepEqual(Array.from(s.grid('areas').getValues()).filter(v=>v.parentId==='p1').map(v=>v.id),['a3','a1','a5']);
    assert.deepEqual(Array.from(s.grid('areas').getValues()).filter(v=>v.parentId==='p2').map(v=>v.id),otherBefore);
    assert.match(sectionRows(s).eq(1).text(),/Area One/);
    assert.deepEqual(s.grid('areas').children('table').find('tr.grid-row textarea').map(function(){return this.name;}).get(),
        ['areas_jsonrow_0','areas_jsonrow_1','areas_jsonrow_2','areas_jsonrow_3','areas_jsonrow_4']);
    sectionRows(s).eq(1).find('.formgrid-nested-moveup').trigger('click');
    assert.deepEqual(Array.from(s.grid('areas').getValues()).filter(v=>v.parentId==='p1').map(v=>v.id),['a1','a3','a5']);
});
test('first and last are calculated per parent, independently from source rows for other parents',t=>{
    const s=setup([{gridId:'areas',foreignKey:'parentId',sortWithButtons:'true'}],{seed({grid}){
        grid('areas').addClass('enableSorting').prepend('<input disabled class="formgrid-sort-field" value="sort">');
    }});t.after(()=>s.dom.window.close());s.expand(s.first);s.expand(s.second);
    for(const parent of [s.first,s.second]) for(const direction of ['moveup','movedown'])
        assert.equal(sectionRows(s,parent).find('.formgrid-nested-'+direction).prop('disabled'),true);
});
test('nested action properties are independent of the child grid flags and use fixed defaults',t=>{
    const disabled=setup([{gridId:'areas',foreignKey:'parentId',sortWithButtons:'false',enableDuplicate:'false'}],{seed:sortableSeed});
    t.after(()=>disabled.dom.window.close());disabled.expand(disabled.first);
    assert.equal(disabled.first.next().find('.formgrid-nested-moveup').length,0);
    assert.equal(disabled.first.next().find('.formgrid-nested-duplicate').length,3);
    const defaults=setup([{gridId:'areas',foreignKey:'parentId',sortWithButtons:'',enableDuplicate:''}],{seed(s){sortableSeed(s);s.grid('areas').addClass('disabled-duplicate');}});
    t.after(()=>defaults.dom.window.close());defaults.expand(defaults.first);
    assert.equal(defaults.first.next().find('.formgrid-nested-moveup').length,0);
    assert.equal(defaults.first.next().find('.formgrid-nested-duplicate').length,3);
    const enabled=setup([{gridId:'areas',foreignKey:'parentId',sortWithButtons:'true',enableDuplicate:'true'}],{seed({grid}){
        grid('areas').addClass('disabled-duplicate').removeClass('enableSorting');
        grid('plants').addClass('disabled-duplicate');
    }});
    t.after(()=>enabled.dom.window.close());enabled.expand(enabled.first);
    assert.equal(enabled.first.next().find('.formgrid-nested-duplicate').length,1);
    assert.equal(enabled.first.next().find('.formgrid-nested-moveup').length,1);
});
test('Pop Up Dialog duplicate opens before adding data, with a new ID and the same parent metadata',t=>{
    const s=setup([{gridId:'areas',foreignKey:'parentId',enableDuplicate:'true'},{gridId:'types',parentGridId:'areas',foreignKey:'parentId',enableDuplicate:'true'}],{seed({grid}){
        grid('areas').prepend('<input disabled class="popupDuplicate" value="false">');
        grid('areas').updateRowData(data=>{
            if(data.id==='a1'){data.note='Keep this';data._tempRequestParamsMap={id:['a1'],parentId:['p1']};}
        });
    }});t.after(()=>s.dom.window.close());s.expand(s.first);
    const before=JSON.stringify(s.grid('areas').getValues());
    sectionRows(s).first().find('.formgrid-nested-duplicate').trigger('click');
    assert.equal(s.popups.length,1);assert.equal(s.grid('areas').getValues().length,2);
    assert.equal(JSON.stringify(s.grid('areas').getValues()),before);
    const params=s.popups[0][2], duplicate=JSON.parse(params._jsonFormData);
    assert.notEqual(duplicate.id,'a1');assert.match(duplicate.id,/^[0-9a-f-]{36}$/i);
    assert.equal(duplicate.parentId,'p1');assert.equal(duplicate.name,'Area One');assert.equal(duplicate.note,'Keep this');
    assert.equal(duplicate._tempRequestParamsMap.id,undefined);assert.deepEqual(duplicate._tempRequestParamsMap.parentId,['p1']);
    s.window[params._callback]({result:JSON.stringify({...duplicate,name:'Edited in duplicate popup'})});
    const added=s.grid('areas').children('table').find('tr.grid-row').last();
    assert.equal(s.data(added).id,duplicate.id);assert.equal(s.data(added).name,'Edited in duplicate popup');
    assert.equal(s.data(s.area).name,'Area One');assert.equal(s.grid('types').getValues().length,1);assert.equal(sectionRows(s).length,2);
});
test('cancelling a duplicate adds no row and a later duplicate belongs to its own parent',t=>{
    const s=setup([{gridId:'areas',foreignKey:'parentId',enableDuplicate:'true'}]);t.after(()=>s.dom.window.close());s.expand(s.first);s.expand(s.second);
    sectionRows(s).first().find('.formgrid-nested-duplicate').trigger('click');
    assert.equal(s.grid('areas').getValues().length,2);
    // Cancel by leaving the first popup callback unused.
    sectionRows(s,s.second).first().find('.formgrid-nested-duplicate').trigger('click');
    const params=s.popups.at(-1)[2],clone=JSON.parse(params._jsonFormData);
    assert.equal(clone.parentId,'p2');s.window[params._callback]({result:JSON.stringify(clone)});
    assert.equal(s.grid('areas').getValues().length,3);assert.equal(sectionRows(s).length,1);assert.equal(sectionRows(s,s.second).length,2);
});
test('popup duplicate uses the child form, enforces FK and rechecks capacity when the callback arrives',t=>{
    const s=setup([{gridId:'areas',foreignKey:'parentId',enableDuplicate:'true'}],{seed({grid}){grid('areas').prepend('<input disabled class="popupDuplicate" value="true">');}});
    t.after(()=>s.dom.window.close());s.expand(s.first);
    sectionRows(s).first().find('.formgrid-nested-duplicate').trigger('click');
    const params=s.popups.at(-1)[2],prefilled=JSON.parse(params._jsonFormData);
    assert.equal(prefilled.parentId,'p1');assert.notEqual(prefilled.id,'a1');assert.match(params._callback,/_nested_add_/);
    s.window[params._callback]({result:JSON.stringify({...prefilled,parentId:'p2',_tempRequestParamsMap:{parentId:['p2']}})});
    const added=s.grid('areas').children('table').find('tr.grid-row').last();
    assert.equal(s.data(added).parentId,'p1');assert.deepEqual(s.data(added)._tempRequestParamsMap.parentId,['p1']);
    sectionRows(s).first().find('.formgrid-nested-duplicate').trigger('click');
    const second=s.popups.at(-1)[2];s.grid('areas').children('#validateMaxRow').val('3');
    s.window[second._callback]({result:JSON.stringify({...prefilled,id:'cannot-add'})});
    assert.equal(s.grid('areas').getValues().length,3);
});
test('duplicate and sorting honor readonly, disabled Add and global maximum rows',t=>{
    const locked=setup([{gridId:'areas',foreignKey:'parentId',sortWithButtons:'true',enableDuplicate:'true'}],{readonly:true,seed:sortableSeed});
    t.after(()=>locked.dom.window.close());locked.expand(locked.first);
    assert.equal(locked.first.next().find('.grid-row-action').length,0);
    const max=setup(undefined,{seed({grid}){grid('areas').children('#validateMaxRow').val('2');}});
    t.after(()=>max.dom.window.close());max.expand(max.first);
    assert.equal(sectionRows(max).find('.formgrid-nested-duplicate').prop('disabled'),true);
    max.area.find('.grid-action-duplicate').formGridCustom('duplicateRow');
    assert.equal(max.grid('areas').getValues().length,2);
    const noAdd=setup(undefined,{seed({grid}){grid('areas').addClass('disabledAdd');}});
    t.after(()=>noAdd.dom.window.close());noAdd.expand(noAdd.first);
    assert.equal(sectionRows(noAdd).find('.formgrid-nested-duplicate').prop('disabled'),true);
});
test('nested sorting uses its own setting and sort field even when source sorting is disabled',t=>{
    const s=setup([{gridId:'areas',foreignKey:'parentId',sortWithButtons:'true',sortField:'nestedOrder'}],{seed({add,grid}){
        grid('areas').removeClass('enableSorting').prepend('<input disabled class="formgrid-sort-field" value="unrelatedOrder">');
        add('areas',{id:'a3',name:'Third Area',parentId:'p1'});
    }});t.after(()=>s.dom.window.close());s.expand(s.first);
    assert.equal(s.grid('plants').children('.formgrid-nested-status').prop('hidden'),true);
    sectionRows(s).first().find('.formgrid-nested-movedown').trigger('click');
    assert.deepEqual(Array.from(s.grid('areas').getValues()).filter(v=>v.parentId==='p1').map(v=>v.id),['a3','a1']);
});
test('nested properties expose the sort checkbox and two duplicate modes',()=>{
    const config=JSON.parse(fs.readFileSync(path.join(base,'../../properties/FormGridCustom.json'),'utf8').replace('%s','{}'));
    const property=config.flatMap(page=>page.properties).find(p=>p.name==='nestedChildren');
    for(const key of ['sortWithButtons']) {
        const column=property.columns.find(c=>c.key===key);
        assert.equal(column.type,'truefalse');
        assert.equal(column.true_value,'true');assert.equal(column.false_value,'false');
        assert.equal(column.options,undefined);
    }
    assert.equal(property.columns.find(c=>c.key==='sortWithButtons').value,'false');
    const duplicate=property.columns.find(c=>c.key==='enableDuplicate');
    assert.equal(duplicate.type,'selectbox');assert.equal(duplicate.value,'false');
    const main=config.flatMap(page=>page.properties).find(p=>p.name==='showPopupDuplicate');
    assert.equal(main.type,'selectbox');assert.equal(main.value,'false');assert.deepEqual(main.options,duplicate.options);
    assert.deepEqual(duplicate.options,[{value:'false',label:'Default'},{value:'true',label:'Popup Dialog'}]);
    assert.equal(property.columns.find(c=>c.key==='sortField').value,'sort');
});
test('duplicate opens the correct popup at deeper nested levels before any new row is inserted',t=>{
    const s=setup([{gridId:'areas',foreignKey:'parentId'},{gridId:'types',parentGridId:'areas',foreignKey:'parentId',enableDuplicate:'true'}]);t.after(()=>s.dom.window.close());s.expand(s.first);
    s.first.next().find('.formgrid-nested-toggle').trigger('click');
    s.first.next().find('[data-child-grid="types"] .formgrid-nested-duplicate').trigger('click');
    assert.equal(s.grid('types').getValues().length,1);
    const params=s.popups.at(-1)[2],clone=JSON.parse(params._jsonFormData);
    assert.equal(clone.parentId,'a1');assert.match(params._callback,/grid_types_nested_add_/);
    s.window[params._callback]({result:JSON.stringify({...clone,name:'Copied Type'})});
    assert.equal(s.grid('types').getValues().length,2);assert.match(s.first.next().text(),/Copied Type/);
});
test('Child Form ID is a required app Form dropdown beside Child Grid ID',()=>{
    const config=JSON.parse(fs.readFileSync(path.join(base,'../../properties/FormGridCustom.json'),'utf8').replace('%s','{}'));
    const columns=config.flatMap(page=>page.properties).find(p=>p.name==='nestedChildren').columns;
    assert.equal(columns[0].key,'gridId');assert.equal(columns[1].key,'formDefId');
    assert.equal(columns[1].label,'Child Form ID');assert.equal(columns[1].type,'selectbox');assert.equal(columns[1].required,'True');
    assert.equal(columns[1].options_ajax,'[CONTEXT_PATH]/web/json/console/app[APP_PATH]/forms/options');
    const mapping={gridId:'areasGrid',formDefId:'areass',label:'Areas',parentGridId:'',parentKey:'id',foreignKey:'parentid',sortWithButtons:'true',sortField:'sort',enableDuplicate:'true',disabledDuplicate:'false'};
    assert.equal(columns.map(c=>mapping[c.key]).join(';'),'areasGrid;areass;Areas;;id;parentid;true;sort;true;false');
});
test('explicit child Form mappings use the matching rendered popup and preserve normal nested callbacks',t=>{
    const s=setup([{gridId:'areas',formDefId:'areass',foreignKey:'parentId'}],{seed({grid}){
        grid('areas').prepend('<input disabled class="formgrid-form-id" value="areass">');
        grid('areas').children('#json').val('encrypted-areass');
    }});t.after(()=>s.dom.window.close());s.expand(s.first);
    s.first.next().find('.formgrid-nested-add').trigger('click');
    const popup=s.popups.at(-1)[2];assert.equal(popup._json,'encrypted-areass');
    s.window[popup._callback]({result:JSON.stringify({id:'new-area',name:'Selected Area Form'})});
    assert.match(s.first.next().text(),/Selected Area Form/);assert.equal(s.data(s.grid('areas').children('table').find('tr.grid-row').last()).parentId,'p1');
});
test('stale or mismatched child Form mappings show an actionable error without hiding source grids',t=>{
    const s=setup([{gridId:'areas',formDefId:'areass',foreignKey:'parentId'}],{seed({grid}){
        grid('areas').prepend('<input disabled class="formgrid-form-id" value="wrongForm">');
    }});t.after(()=>s.dom.window.close());
    assert.match(s.grid('plants').children('.formgrid-nested-status').text(),/Child Form ID mismatch.*areas.*areass/);
    assert.equal(s.grid('areas').closest('.form-cell').hasClass('formgrid-nested-source'),false);
});
test('nested row numbers start at one per parent and follow button sorting without entering row JSON',t=>{
    const s=setup([{gridId:'areas',foreignKey:'parentId',sortWithButtons:'true'}],{seed:sortableSeed});t.after(()=>s.dom.window.close());
    s.expand(s.first);s.expand(s.second);
    function numbers(parent){return sectionRows(s,parent).children('.formgrid-nested-row-number').map(function(){return s.$(this).text();}).get();}
    assert.deepEqual(numbers(s.first),['1','2','3']);assert.deepEqual(numbers(s.second),['1','2']);
    sectionRows(s).first().find('.formgrid-nested-movedown').trigger('click');
    assert.deepEqual(numbers(s.first),['1','2','3']);assert.match(sectionRows(s).first().text(),/Third Area/);
    s.add('areas',{id:'new',name:'New Area',parentId:'p1'});assert.deepEqual(numbers(s.first),['1','2','3','4']);
    sectionRows(s).last().find('.formgrid-nested-delete').trigger('click');assert.deepEqual(numbers(s.first),['1','2','3']);
    assert.equal(s.grid('plants').getValues().length,2);assert.equal(s.grid('areas').getValues().some(data=>'rowNumber' in data || 'No.' in data),false);
});
test('the child grid Show Row Number setting also works when nested sort buttons are off',t=>{
    const s=setup([{gridId:'areas',foreignKey:'parentId',sortWithButtons:'false'}],{seed({grid}){
        grid('areas').children('table').find('tbody tr').prepend('<td><span class="grid-cell rowNumber"></span></td>');
        grid('areas').children('table').find('thead tr').prepend('<th></th>');
    }});t.after(()=>s.dom.window.close());s.expand(s.first);
    assert.equal(sectionRows(s).first().children('.formgrid-nested-row-number').text(),'1');
    assert.equal(s.first.next().find('.formgrid-nested-moveup').length,0);assert.match(sectionRows(s).first().text(),/Area One/);
});

test('Default nested duplicate inserts immediately beside its source with a fresh ID and the same parent',t=>{
    for(const mode of ['false','']) {
        const s=setup([{gridId:'areas',foreignKey:'parentId',enableDuplicate:mode},{gridId:'types',parentGridId:'areas',foreignKey:'parentId'}],{seed({grid}){
            grid('areas').prepend('<input disabled class="popupDuplicate" value="true"><input disabled class="uniqueKey" value="name">');
            grid('areas').updateRowData(data=>{if(data.id==='a1') data._tempRequestParamsMap={id:['a1'],parentId:['p1']};});
        }});t.after(()=>s.dom.window.close());s.expand(s.first);s.expand(s.second);
        sectionRows(s).first().find('.formgrid-nested-duplicate').trigger('click');
        assert.equal(s.popups.length,0);assert.equal(s.grid('areas').getValues().length,3);
        const copy=s.area.next(),data=s.data(copy);
        assert.notEqual(data.id,'a1');assert.match(data.id,/^[0-9a-f-]{36}$/i);assert.equal(data.parentId,'p1');
        assert.match(data.name,/^Area One_copy_/);assert.equal(data._tempRequestParamsMap.id,undefined);
        assert.deepEqual(data._tempRequestParamsMap.parentId,['p1']);
        assert.equal(s.data(s.area).name,'Area One');assert.equal(s.grid('types').getValues().length,1);
        assert.equal(sectionRows(s).length,2);assert.equal(sectionRows(s,s.second).length,1);
        sectionRows(s,s.second).first().find('.formgrid-nested-duplicate').trigger('click');
        assert.equal(s.popups.length,0);assert.equal(s.grid('areas').getValues().length,4);
        assert.equal(sectionRows(s).length,2);assert.equal(sectionRows(s,s.second).length,2);
        assert.deepEqual(s.grid('areas').children('table').find('tr.grid-row textarea').map(function(){return this.name;}).get(),
            ['areas_jsonrow_0','areas_jsonrow_1','areas_jsonrow_2','areas_jsonrow_3']);
    }
});

test('ordinary grid duplicate still follows its popup setting when no nested mode is supplied',t=>{
    const s=setup();t.after(()=>s.dom.window.close());
    s.grid('other').prepend('<input disabled class="popupDuplicate" value="true">');
    const original=s.add('other',{id:'o1',name:'Ordinary row'});
    original.find('.grid-action-duplicate').formGridCustom('duplicateRow');
    assert.equal(s.popups.length,1);assert.equal(s.grid('other').getValues().length,1);
    s.grid('other').children('.popupDuplicate').val('false');
    s.grid('other').prepend('<input disabled class="uniqueKey" value="name">');
    original.find('.grid-action-duplicate').formGridCustom('duplicateRow');
    assert.equal(s.popups.length,1);assert.equal(s.grid('other').getValues().length,2);
    assert.match(s.grid('other').getValues()[1].name,/^Ordinary row_copy_/);
});

test('nested views preserve configured column order, labels, widths and visibility for existing and added rows',t=>{
    const s=setup([{gridId:'areas',foreignKey:'parentId'}],{seed({grid}){
        const area=grid('areas');
        // Represents the source grid rendered by Java with its effective Nested Columns.
        area.children('table').find('thead tr').prepend('<th style="width:140px">Area Code</th>');
        area.children('table').find('tbody tr').each(function(){
            const row=grid('areas').find(this);
            row.prepend('<td><span class="grid-cell" column_key="code" column_type="text"></span></td>');
        });
        area.updateRowData(data=>{data.code='CODE-'+data.id;});
        area.children('table').find('thead th').eq(1).text('Area Name').css('width','35%');
    }});t.after(()=>s.dom.window.close());s.expand(s.first);
    const headers=s.first.next().find('[data-child-grid="areas"] thead th');
    assert.deepEqual(headers.map(function(){return s.$(this).text();}).get(),['Area Code','Area Name','']);
    assert.equal(headers[0].style.width,'140px');assert.equal(headers[1].style.width,'35%');
    const cells=sectionRows(s).first().children('td');
    assert.equal(cells.eq(0).text(),'CODE-a1');assert.equal(cells.eq(1).text(),'Area One');
    assert.equal(sectionRows(s).first().text().includes('p1'),false);
    s.add('areas',{id:'new',name:'New Area',parentId:'p1',code:'NEW-CODE'});
    assert.equal(sectionRows(s).last().children('td').eq(0).text(),'NEW-CODE');
    assert.equal(sectionRows(s).last().children('td').eq(1).text(),'New Area');
    assert.equal(s.grid('areas').getValues().at(-1).parentId,'p1');
});

test('nested Disable Duplicate removes copy actions per relation while other relations keep their modes',t=>{
    for(const mode of ['false','true']) {
        const s=setup([{gridId:'areas',foreignKey:'parentId',enableDuplicate:mode,disabledDuplicate:'true'},
            {gridId:'types',parentGridId:'areas',foreignKey:'parentId',enableDuplicate:'false',disabledDuplicate:'false'}]);
        t.after(()=>s.dom.window.close());s.expand(s.first);
        assert.equal(sectionRows(s).find('.formgrid-nested-duplicate').length,0);
        assert.equal(sectionRows(s).find('.formgrid-nested-edit,.formgrid-nested-delete').length,2);
        s.first.next().find('.formgrid-nested-toggle').first().trigger('click');
        const nested=s.first.next().find('[data-child-grid="types"] .formgrid-nested-duplicate');
        assert.equal(nested.length,1);nested.trigger('click');
        assert.equal(s.popups.length,0);assert.equal(s.grid('types').getValues().length,2);
        assert.equal(s.grid('areas').getValues().length,2);
    }
});
