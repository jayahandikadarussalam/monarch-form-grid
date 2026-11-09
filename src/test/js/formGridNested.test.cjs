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
function setup(relations = [{gridId:'areas',foreignKey:'parentId'},{gridId:'types',parentGridId:'areas',foreignKey:'parentId'}], {readonly=false, count=2, extraIds=[], seed, paginationThreshold=0} = {}) {
    const dom = new JSDOM(`<form>${['plants','areas','types','other',...extraIds].map(fixture).join('')}<button type="submit">Save</button></form>`, {runScripts:'outside-only',url:'https://example.test/'});
    const window = dom.window, $ = jquery(window), popups = [];
    window.$ = window.jQuery = $;
    window.UI = {escapeHTML:value=>$('<span>').text(value == null ? '' : value).html(),userviewThemeParams:()=>''};
    window.JPopup = {hide(){},show(...args){popups.push(args);}};
    window.confirm = ()=>true;
    for (const file of ['jquery.formGridCustom.js','jquery.utils.js','jquery.formGridCustom.remake.js','jquery.gridPagingCustom.js','jquery.formGridEditable.js','formGridImport.js','jquery.formGridImport.js','jquery.formGridNested.js']) window.eval(fs.readFileSync(path.join(base,file),'utf8'));
    const grid=id=>$('#grid_'+id);
    $('.formgrid-custom').formGridCustom({messages:{},options:{}});
    function add(id,data) {grid(id).formGridCustom('addRow',{result:JSON.stringify(data)}); return grid(id).children('table').find('tr.grid-row').last();}
    const first=add('plants',{id:'p1',name:'Plant One'});
    const second=add('plants',{id:'p2',name:'Plant Two'});
    const area=add('areas',{id:'a1',name:'Area One',parentId:'p1'});
    add('areas',{id:'a2',name:'Area Two',parentId:'p2'});
    add('types',{id:'t1',name:'Type One',parentId:'a1'});
    if (seed) seed({grid,add});
    grid('plants').gridPagingCustom({customSize:count,threshold:paginationThreshold});
    if (readonly) grid('plants').addClass('readonly');
    grid('plants').formGridNested({relations,paginationThreshold});
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
function nestedPager(s,parent=s.first,id='areas') {
    return parent.next().find('[data-child-grid="'+id+'"] > .formgrid-nested-pagination');
}
function pagedSeed({grid,add}) {
    sortableSeed({grid,add});
    grid('areas').gridPagingCustom({customSize:2});
    grid('types').gridPagingCustom({customSize:1});
    add('types',{id:'t2',parentId:'a1',name:'Type Two'});
}
test('nested paging renders only its active slice and submits every source row',t=>{
    const s=setup([{gridId:'areas',foreignKey:'parentId',sortWithButtons:'true'}],{seed:pagedSeed});
    t.after(()=>s.dom.window.close());s.expand(s.first);
    assert.equal(sectionRows(s).length,2);
    assert.equal(nestedPager(s).find('select').val(),'2');
    assert.match(nestedPager(s).text(),/Showing 1–2 of 3 rows. Page 1 of 2/);
    assert.equal(nestedPager(s).find('.formgrid-nested-page-prev').prop('disabled'),true);
    const before=s.$('form').serializeArray();
    nestedPager(s).find('.formgrid-nested-page-next').trigger('click');
    assert.equal(sectionRows(s).length,1);assert.match(sectionRows(s).text(),/Fifth Area/);
    assert.equal(sectionRows(s).find('.formgrid-nested-row-number').text(),'3');
    assert.equal(sectionRows(s).find('.formgrid-nested-moveup').prop('disabled'),false);
    assert.equal(sectionRows(s).find('.formgrid-nested-movedown').prop('disabled'),true);
    assert.equal(nestedPager(s).find('.formgrid-nested-page-next').prop('disabled'),true);
    assert.deepEqual(s.$('form').serializeArray(),before);
    nestedPager(s).find('.formgrid-nested-page-first').trigger('click');
    assert.equal(sectionRows(s).length,2);
});
test('nested pages are isolated by parent and level and survive root paging and collapse',t=>{
    const s=setup(undefined,{count:1,seed:pagedSeed});t.after(()=>s.dom.window.close());s.expand(s.first);
    sectionRows(s).first().find('.formgrid-nested-toggle').trigger('click');
    nestedPager(s,s.first,'types').find('.formgrid-nested-page-next').trigger('click');
    assert.match(s.first.next().find('[data-child-grid="types"] tbody').text(),/Type Two/);
    nestedPager(s).find('.formgrid-nested-page-last').trigger('click');
    assert.equal(s.first.next().find('[data-child-grid="types"]').length,0);
    s.grid('plants').gridPagingCustom('showPage',2);s.expand(s.second);
    assert.match(nestedPager(s,s.second).text(),/Page 1 of 1/);
    s.grid('plants').gridPagingCustom('showPage',1);
    assert.match(nestedPager(s).text(),/Page 2 of 2/);
    s.expand(s.first);s.expand(s.first);
    assert.match(nestedPager(s).text(),/Page 2 of 2/);
    nestedPager(s).find('.formgrid-nested-page-prev').trigger('click');
    assert.match(s.first.next().find('[data-child-grid="types"] tbody').text(),/Type Two/);
    assert.doesNotMatch(s.first.next().find('[data-child-grid="types"] tbody').text(),/Type One/);
});
test('page size changes stay local and pagination remains available in readonly mode',t=>{
    const s=setup(undefined,{readonly:true,seed:pagedSeed});t.after(()=>s.dom.window.close());
    s.expand(s.first);s.expand(s.second);
    let changes=0;s.grid('plants').on('change.pagingTest',()=>changes++);
    nestedPager(s).find('select').val('10').trigger('change');
    assert.equal(sectionRows(s).length,3);assert.equal(changes,0);
    assert.equal(nestedPager(s,s.second).find('select').val(),'2');
    s.grid('areas').trigger('change');
    assert.equal(nestedPager(s).find('select').val(),'10');
    assert.equal(s.first.next().find('.grid-row-action,.formgrid-nested-add').length,0);
});
test('nested move crosses page boundaries and edit, duplicate, delete target the visible source row',t=>{
    const s=setup([{gridId:'areas',foreignKey:'parentId',sortWithButtons:'true'}],{seed:pagedSeed});
    t.after(()=>s.dom.window.close());s.expand(s.first);
    sectionRows(s).last().find('.formgrid-nested-movedown').trigger('click');
    assert.match(nestedPager(s).text(),/Page 2 of 2/);assert.match(sectionRows(s).text(),/Third Area/);
    sectionRows(s).find('.formgrid-nested-edit').trigger('click');
    assert.equal(JSON.parse(s.popups.at(-1)[2]._jsonFormData).id,'a3');
    sectionRows(s).find('.formgrid-nested-duplicate').trigger('click');
    assert.equal(sectionRows(s).length,2);
    const values=Array.from(s.grid('areas').getValues()).filter(v=>v.parentId==='p1');
    assert.equal(values.length,4);assert.equal(values[3].name,'Third Area');assert.notEqual(values[3].id,'a3');
    sectionRows(s).last().find('.formgrid-nested-delete').trigger('click');
    sectionRows(s).find('.formgrid-nested-delete').trigger('click');
    assert.match(nestedPager(s).text(),/Page 1 of 1/);assert.equal(sectionRows(s).length,2);
    assert.deepEqual(Array.from(s.grid('areas').getValues()).filter(v=>v.parentId==='p2').map(v=>v.id),['a2','a4']);
});
test('nested Add opens its last page and filtering clamps the page without dropping submitted rows',t=>{
    const s=setup([{gridId:'areas',foreignKey:'parentId'}],{seed:pagedSeed});
    t.after(()=>s.dom.window.close());s.expand(s.first);
    s.first.next().find('.formgrid-nested-add').trigger('click');
    const params=s.popups.at(-1)[2];
    s.window[params._callback]({result:JSON.stringify({id:'new',name:'New Area'})});
    assert.match(nestedPager(s).text(),/Showing 3–4 of 4 rows/);assert.match(sectionRows(s).text(),/New Area/);
    s.grid('areas').children('table').find('tr.grid-row').filter(function(){return ['a5','new'].includes(s.data(s.$(this)).id);}).addClass('fg-hidden');
    s.grid('areas').trigger('change');
    assert.match(nestedPager(s).text(),/Showing 1–2 of 2 rows. Page 1 of 1/);
    assert.equal(s.grid('areas').getValues().length,6);
});
test('bulk expansion bounds rendered descendants and navigation controls for large child lists',t=>{
    const s=setup(undefined,{seed({add}){
        for(let i=0;i<120;i++) {
            add('areas',{id:'bulk'+i,parentId:'p1',name:'Area '+i});
            add('types',{id:'type'+i,parentId:'bulk'+i,name:'Type '+i});
        }
    }});t.after(()=>s.dom.window.close());
    s.grid('plants').find('.formgrid-nested-expand-all').trigger('click');
    assert.equal(sectionRows(s).length,20);
    assert.equal(s.first.next().find('[data-child-grid="types"]').length,20);
    assert.equal(nestedPager(s).find('button').length,4);
    nestedPager(s).find('.formgrid-nested-page-last').trigger('click');
    assert.equal(sectionRows(s).length,1);
    assert.equal(s.first.next().find('[data-child-grid="types"]').length,1);
    assert.match(nestedPager(s).text(),/Showing 121–121 of 121 rows. Page 7 of 7/);
});
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
        // Represents the source grid rendered by Java with its configured child Columns.
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

test('Expand all opens every configured level and branch; Collapse all clears descendants without changing form data',t=>{
    const relations=[{gridId:'areas',foreignKey:'parentId'},{gridId:'groups',parentGridId:'areas',foreignKey:'parentId'},
        {gridId:'types',parentGridId:'groups',foreignKey:'parentId'},{gridId:'tags',parentGridId:'types',foreignKey:'parentId'},
        {gridId:'parameters',parentGridId:'tags',foreignKey:'parentId'},{gridId:'other',foreignKey:'parentId'}];
    const s=setup(relations,{extraIds:['groups','tags','parameters'],seed({grid,add}){
        grid('types').updateRowData(data=>{data.parentId='g1';});
        add('groups',{id:'g1',parentId:'a1',name:'Pump Group'});add('tags',{id:'tag1',parentId:'t1',name:'Pump Tag'});
        add('parameters',{id:'param1',parentId:'tag1',name:'Pressure'});add('other',{id:'branch1',parentId:'p2',name:'Other Branch'});
    }});t.after(()=>s.dom.window.close());
    const root=s.grid('plants'),expand=root.children('.formgrid-nested-bulk-actions').find('.formgrid-nested-expand-all');
    const collapse=root.children('.formgrid-nested-bulk-actions').find('.formgrid-nested-collapse-all');
    const before=s.$('form').serialize();let submits=0;s.$('form').on('submit.test',()=>{submits++;});
    assert.equal(expand.attr('type'),'button');assert.equal(collapse.prop('disabled'),true);
    expand.trigger('click');
    assert.match(s.first.next().text(),/Pressure/);assert.match(s.second.next().text(),/Other Branch/);
    assert.equal(root.find('.formgrid-nested-toggle[aria-expanded="false"]').length,0);
    assert.equal(expand.prop('disabled'),true);assert.equal(collapse.prop('disabled'),false);
    assert.equal(s.popups.length,0);assert.equal(submits,0);assert.equal(s.$('form').serialize(),before);
    collapse.trigger('click');
    assert.equal(root.find('.formgrid-nested-root-detail,.formgrid-nested-detail').length,0);
    assert.equal(root.find('.formgrid-nested-toggle[aria-expanded="true"]').length,0);
    assert.equal(collapse.prop('disabled'),true);assert.equal(expand.prop('disabled'),false);
    s.expand(s.first);assert.doesNotMatch(s.first.next().text(),/Pressure/);
    assert.equal(s.first.next().find('.formgrid-nested-toggle').first().attr('aria-expanded'),'false');
    assert.equal(s.$('form').serialize(),before);
});

test('bulk expansion survives paging while off-page subtrees remain unrendered and collapse clears every page',t=>{
    const s=setup(undefined,{count:1,readonly:true});t.after(()=>s.dom.window.close());const root=s.grid('plants');
    root.find('.formgrid-nested-expand-all').trigger('click');
    assert.match(s.first.next().text(),/Type One/);
    assert.equal(s.second.next().hasClass('formgrid-nested-root-detail'),true);
    assert.equal(s.second.next().find('.formgrid-nested-content').length,0);
    assert.equal(s.second.next().css('display'),'none');
    root.gridPagingCustom('showPage',2);
    assert.equal(s.first.next().find('.formgrid-nested-content').length,0);
    assert.match(s.second.next().text(),/Area Two/);assert.equal(s.second.next().find('.formgrid-nested-toggle').attr('aria-expanded'),'true');
    assert.equal(root.find('.formgrid-nested-root-detail .grid-row-action,.formgrid-nested-add').length,0);
    root.find('.formgrid-nested-collapse-all').trigger('click');
    root.gridPagingCustom('showPage',1);assert.equal(root.find('.formgrid-nested-root-detail').length,0);
    assert.equal(s.first.find('.formgrid-nested-toggle').attr('aria-expanded'),'false');
});

test('bulk controls are scoped to their own root and handle empty grids and newly added parent rows',t=>{
    const s=setup(undefined,{extraIds:['otherAreas']});t.after(()=>s.dom.window.close());
    const other=s.grid('other');other.formGridNested({relations:[{gridId:'otherAreas',foreignKey:'parentId'}]});
    assert.equal(other.find('.formgrid-nested-expand-all').prop('disabled'),true);
    assert.equal(other.find('.formgrid-nested-collapse-all').prop('disabled'),true);
    s.add('other',{id:'o1',name:'Other Parent'});s.add('otherAreas',{id:'oa1',parentId:'o1',name:'Other Child'});
    assert.equal(other.find('.formgrid-nested-expand-all').prop('disabled'),false);
    const root=s.grid('plants');root.find('.formgrid-nested-expand-all').trigger('click');
    assert.equal(other.find('.formgrid-nested-root-detail').length,0);
    other.find('.formgrid-nested-expand-all').trigger('click');assert.match(other.text(),/Other Child/);
    root.find('.formgrid-nested-collapse-all').trigger('click');assert.match(other.text(),/Other Child/);
    root.find('.formgrid-nested-expand-all').trigger('click');
    s.add('plants',{id:'p3',name:'New Parent'});
    assert.equal(root.find('.formgrid-nested-expand-all').prop('disabled'),false);
    root.find('.formgrid-nested-expand-all').trigger('click');assert.equal(root.find('.formgrid-nested-expand-all').prop('disabled'),true);
    root.formGridNested({relations:[]});assert.equal(root.children('.formgrid-nested-bulk-actions').length,1);
});

test('default pagination hides through ten rows and returns above ten after add/delete/filter',t=>{
    const s=setup([{gridId:'areas',foreignKey:'parentId'}],{paginationThreshold:10,seed({grid,add}){
        for(let i=2;i<=10;i++) add('areas',{id:'limit'+i,parentId:'p1',name:'Area '+i});
        grid('areas').gridPagingCustom({customSize:10});
    }});t.after(()=>s.dom.window.close());s.expand(s.first);
    assert.equal(sectionRows(s).length,10);assert.equal(nestedPager(s).prop('hidden'),true);
    s.add('areas',{id:'eleventh',parentId:'p1',name:'Eleventh'});
    assert.equal(sectionRows(s).length,10);assert.equal(nestedPager(s).prop('hidden'),false);
    assert.equal(nestedPager(s).find('button').length,4);
    nestedPager(s).find('.formgrid-nested-page-next').trigger('click');
    assert.equal(sectionRows(s).length,1);assert.match(sectionRows(s).text(),/Eleventh/);
    sectionRows(s).find('.formgrid-nested-delete').trigger('click');
    assert.equal(sectionRows(s).length,10);assert.equal(nestedPager(s).prop('hidden'),true);
    s.grid('areas').children('table').find('.grid-row').addClass('fg-hidden');s.grid('areas').trigger('change');
    assert.equal(nestedPager(s).prop('hidden'),true);assert.equal(sectionRows(s).length,0);
    assert.match(s.first.next().text(),/No related records/);
});
test('small tables show all rows even when a smaller old page size was configured',t=>{
    const s=setup(undefined,{paginationThreshold:10,seed:pagedSeed});t.after(()=>s.dom.window.close());
    s.expand(s.first);assert.equal(sectionRows(s).length,3);assert.equal(nestedPager(s).prop('hidden'),true);
    assert.equal(s.grid('plants').children('.pg-navigator').length,0);
    assert.equal(s.grid('plants').find('tr.pg-tr-hide').length,0);
});
test('main grid uses bounded compact controls only above ten rows',t=>{
    const s=setup(undefined,{paginationThreshold:10,count:10});t.after(()=>s.dom.window.close());
    for(let i=3;i<=11;i++)s.add('plants',{id:'p'+i,name:'Plant '+i});
    const pager=s.grid('plants').children('.pg-navigator');
    assert.equal(pager.find('button').length,4);assert.equal(pager.find('.pg-current').text(),'1 / 2');
    pager.find('.pg-next').trigger('click');assert.equal(pager.find('.pg-current').text(),'2 / 2');
    assert.equal(s.grid('plants').children('table').find('.grid-row.pg-tr-show').length,1);
    s.grid('plants').children('table').find('.grid-row').last().remove();s.grid('plants').trigger('change');
    assert.equal(s.grid('plants').children('.pg-navigator').length,0);
    assert.equal(s.grid('plants').children('table').find('.grid-row.pg-tr-show').length,10);
});
function lazySeed(requests) {
    return function({grid}) {
        const $=grid('areas').constructor;
        $.ajax=options=>{const deferred=$.Deferred();requests.push({options,deferred});return deferred.promise();};
        for(const id of ['areas','types']) {
            grid(id).children('table').find('.grid-row').remove();
            grid(id).prepend(`<input disabled class="formgrid-nested-load" data-url="/nested/service" value="token-${id}"><input class="formgrid-nested-loaded" name="${id}_nested_loaded" value="[]">`);
        }
    };
}
test('child requests wait for expansion at each level and remain isolated per parent',t=>{
    const requests=[],s=setup(undefined,{seed:lazySeed(requests)});t.after(()=>s.dom.window.close());
    assert.equal(requests.length,0);s.expand(s.first);
    assert.equal(requests.length,1);assert.equal(requests[0].options.data.parentKey,'p1');
    assert.equal(requests[0].options.data.token,'token-areas');assert.equal(requests[0].options.method,'POST');
    let event=s.$.Event('submit');s.$('form').triggerHandler(event);assert.equal(event.isDefaultPrevented(),true);
    s.expand(s.first);assert.equal(requests.length,1);
    requests[0].deferred.resolve({rows:[{id:'lazyArea',name:'Deferred Area',parentId:'p1'}]});
    assert.equal(s.first.next().hasClass('formgrid-nested-root-detail'),false);
    s.expand(s.first);assert.match(s.first.next().text(),/Deferred Area/);assert.equal(requests.length,1);
    assert.equal(s.grid('areas').children('.formgrid-nested-loaded').val(),'["p1"]');
    sectionRows(s).first().find('.formgrid-nested-toggle').trigger('click');
    assert.equal(requests.length,2);assert.equal(requests[1].options.data.parentKey,'lazyArea');
    assert.equal(requests[1].options.data.token,'token-types');
    requests[1].deferred.resolve({rows:[{id:'lazyType',name:'Deferred Type',parentId:'lazyArea'}]});
    assert.match(s.first.next().text(),/Deferred Type/);
    s.expand(s.second);assert.equal(requests.length,3);assert.equal(requests[2].options.data.parentKey,'p2');
    requests[2].deferred.resolve({rows:[]});assert.match(s.second.next().text(),/No related records/);
    s.expand(s.second);s.expand(s.second);assert.equal(requests.length,3);
    assert.equal(s.grid('types').getValues().length,1);
});
test('failed expansion can retry; unopened parents cannot be deleted without checking children',t=>{
    const requests=[],s=setup(undefined,{seed:lazySeed(requests)});t.after(()=>s.dom.window.close());
    s.first.find('.grid-action-delete').trigger('click');assert.equal(requests.length,0);
    assert.equal(s.grid('plants').getValues().length,2);
    assert.match(s.grid('plants').children('.formgrid-nested-status').text(),/Expand this row/);
    s.expand(s.first);requests[0].deferred.reject();
    assert.match(s.first.next().text(),/Unable to load child/);
    assert.equal(s.grid('areas').children('.formgrid-nested-loaded').val(),'[]');
    s.first.next().find('.formgrid-nested-retry').trigger('click');assert.equal(requests.length,2);
    requests[1].deferred.resolve({rows:[]});assert.match(s.first.next().text(),/No related records/);
    assert.equal(s.grid('areas').children('.formgrid-nested-loaded').val(),'["p1"]');
});
test('readonly lazy rows hydrate without opening popups or allowing writes',t=>{
    const requests=[],s=setup(undefined,{readonly:true,seed:lazySeed(requests)});t.after(()=>s.dom.window.close());
    s.expand(s.first);requests[0].deferred.resolve({rows:[{id:'readArea',name:'Read Only Area',parentId:'p1'}]});
    assert.match(s.first.next().text(),/Read Only Area/);
    assert.equal(s.first.next().find('.formgrid-nested-add,.formgrid-nested-edit,.formgrid-nested-delete').length,0);
    assert.equal(s.popups.length,0);
});

test('bulk expand requests only visible parents and keeps deeper children deferred until available',t=>{
    const requests=[],s=setup(undefined,{count:1,seed:lazySeed(requests)});t.after(()=>s.dom.window.close());
    s.grid('plants').find('.formgrid-nested-expand-all').trigger('click');
    assert.equal(requests.length,1);assert.equal(requests[0].options.data.parentKey,'p1');
    requests[0].deferred.resolve({rows:[{id:'bulkArea',name:'Bulk Area',parentId:'p1'}]});
    assert.equal(requests.length,2);assert.equal(requests[1].options.data.parentKey,'bulkArea');
    requests[1].deferred.resolve({rows:[]});
    s.grid('plants').gridPagingCustom('showPage',2);
    assert.equal(requests.length,3);assert.equal(requests[2].options.data.parentKey,'p2');
    s.grid('plants').find('.formgrid-nested-collapse-all').trigger('click');
    requests[2].deferred.resolve({rows:[{id:'bulkArea2',name:'Bulk Area 2',parentId:'p2'}]});
    assert.equal(requests.length,3);assert.equal(s.grid('plants').find('.formgrid-nested-root-detail').length,0);
});

test('expired tokens after plugin updates request a form reload without retry loops or losing rows',t=>{
    const requests=[],s=setup(undefined,{seed:lazySeed(requests)});t.after(()=>s.dom.window.close());
    s.expand(s.first);requests[0].deferred.reject({status:410});
    assert.match(s.first.next().text(),/Reload the form/);
    assert.equal(s.first.next().find('.formgrid-nested-retry').length,0);
    assert.equal(requests.length,1);
    s.grid('plants').data('formGridNested').refresh();assert.equal(requests.length,1);
    assert.equal(s.grid('plants').getValues().length,2);
    assert.equal(s.grid('areas').children('.formgrid-nested-loaded').val(),'[]');
});

test('Design canvas leaves all child grids visible and avoids nested requests or runtime controls',t=>{
    const requests=[],seed=lazySeed(requests);
    const s=setup(undefined,{seed(context){
        seed(context);
        context.grid('plants').attr('data-builder-design','true');
        // Represents Joget's metadata wrapper used to select each element on the canvas.
        context.grid('areas').closest('.form-cell').attr('element-class','com.monarch.shadow.lib.FormGridCustom');
        context.grid('types').closest('.form-cell').attr('element-class','com.monarch.shadow.lib.FormGridCustom');
    }});t.after(()=>s.dom.window.close());
    assert.equal(requests.length,0);
    for(const id of ['plants','areas','types']) {
        assert.equal(s.grid(id).closest('.form-cell').hasClass('formgrid-nested-source'),false);
        assert.equal(s.grid(id).data('nestedOwner'),undefined);
    }
    assert.equal(s.grid('plants').find('.formgrid-nested-bulk-actions,.formgrid-nested-toggle,.formgrid-nested-status').length,0);
    assert.equal(s.grid('areas').closest('[element-class]').length,1);
    assert.equal(s.grid('types').closest('[element-class]').length,1);
});

function inlineFields(grid, columns) {
    const $=grid.constructor,table=grid.children('table');
    for(const column of columns) {
        if(table.find('.grid-row-template [column_key="'+column.id+'"]').length)continue;
        table.find('thead tr').append($('<th>').text(column.label||column.id));
        table.find('tbody tr').each(function(){
            $(this).append($('<td>').append($('<span class="grid-cell">').attr({column_key:column.id,column_type:'text'})));
        });
    }
    grid.formGridEditable({columns});
}
test('nested inline text edits preserve focus, sibling rows, FK and canonical submission across collapse',t=>{
    const s=setup(undefined,{seed({grid}){inlineFields(grid('areas'),[{id:'name',label:'Name',editor:'TextField'}]);
        inlineFields(grid('types'),[{id:'name',label:'Name',editor:'TextField'}]);}});
    t.after(()=>s.dom.window.close());s.expand(s.first);
    const input=sectionRows(s).first().find('.formgrid-editor');assert.equal(input.length,1);
    input[0].focus();input.val('Edited Area').trigger('input');
    assert.equal(s.window.document.activeElement,input[0]);assert.equal(sectionRows(s).first().find('.formgrid-editor')[0],input[0]);
    assert.equal(s.data(s.area).name,'Edited Area');assert.equal(s.data(s.area).parentId,'p1');
    assert.equal(s.grid('areas').getValues()[1].name,'Area Two');
    const submitted=s.$('form').serializeArray().filter(pair=>/^areas_jsonrow_\d+$/.test(pair.name));
    assert.equal(submitted.length,2);assert.equal(JSON.parse(submitted[0].value).name,'Edited Area');
    sectionRows(s).first().find('.formgrid-nested-toggle').trigger('click');
    s.first.next().find('[data-child-grid="types"] .formgrid-editor').val('Edited Type').trigger('input');
    assert.equal(s.grid('types').getValues()[0].name,'Edited Type');
    s.expand(s.first);s.expand(s.first);assert.equal(sectionRows(s).first().find('.formgrid-editor').val(),'Edited Area');
});
test('nested native option/date/multiline editors persist raw values and surface uniqueness failures',t=>{
    const columns=[{id:'name',editor:'TextField'},{id:'note',editor:'TextArea'},
        {id:'role',editor:'SelectBox',options:{admin:'Administrator',user:'User'}},
        {id:'date',editor:'DatePicker',dateFormat:'dd/MM/yyyy'}];
    const s=setup(undefined,{seed({grid}){
        grid('areas').updateRowData(data=>{data.note='Original';data.role='admin';data.date='09/11/2026';});
        grid('areas').prepend('<input disabled class="uniqueKey" value="name">');inlineFields(grid('areas'),columns);
    }});t.after(()=>s.dom.window.close());s.expand(s.first);
    const view=sectionRows(s).first(),editor=id=>view.find('.formgrid-editor').filter(function(){return s.$(this).data('column').id===id;});
    assert.equal(editor('date').val(),'2026-11-09');
    editor('role').val('user').trigger('change');editor('date').val('2026-12-10').trigger('change');
    editor('note').val('Two\nlines').trigger('input');
    assert.equal(s.data(s.area).role,'user');assert.equal(s.data(s.area).date,'10/12/2026');assert.equal(s.data(s.area).note,'Two\nlines');
    editor('name').val('Area Two').trigger('input');
    assert.equal(s.data(s.area).name,'Area One');assert.equal(editor('name').val(),'Area One');
    assert.match(s.grid('plants').children('.formgrid-nested-status').text(),/unique value/);
});
test('nested inline AJAX options follow visible control values and ignore views removed by collapse',t=>{
    const requests=[];
    const s=setup(undefined,{seed({grid}){
        const $=grid('areas').constructor;
        $.getJSON=(url,data)=>{const deferred=$.Deferred();requests.push({data,deferred});return deferred.promise();};
        inlineFields(grid('areas'),[{id:'name',editor:'TextField'},{id:'role',editor:'SelectBox',
            options:{OPTIONS_USE_AJAX:'true',OPTIONS:[],OPTIONS_AJAX_CONTROL_FIELD:'name',OPTIONS_AJAX_APP_ID:'app',OPTIONS_AJAX_APP_VERSION:'1'}}]);
    }});t.after(()=>s.dom.window.close());s.expand(s.first);
    const view=sectionRows(s).first(),name=view.find('input.formgrid-editor'),select=view.find('select.formgrid-editor');
    requests.at(-1).deferred.resolve([{value:'a',label:'Original'}]);
    name.val('Changed').trigger('input');assert.equal(requests.at(-1).data._dv,'Changed');
    requests.at(-1).deferred.resolve([{value:'b',label:'Updated'}]);assert.equal(select.find('option').last().text(),'Updated');
    name.val('Later').trigger('input');const pending=requests.at(-1);s.expand(s.first);
    pending.deferred.resolve([{value:'stale',label:'Stale'}]);
    s.expand(s.first);assert.notEqual(sectionRows(s).first().find('select option').last().text(),'Stale');
});
test('nested lazy rows receive editors after fetching while a readonly root renders display values',t=>{
    for(const readonly of [false,true]) {
        const requests=[],lazy=lazySeed(requests);
        const s=setup(undefined,{readonly,seed(context){lazy(context);inlineFields(context.grid('areas'),[{id:'name',editor:'TextField'}]);}});
        t.after(()=>s.dom.window.close());s.expand(s.first);
        requests[0].deferred.resolve({rows:[{id:'fetched',name:'Lazy Inline',parentId:'p1'}]});
        assert.equal(sectionRows(s).find('.formgrid-editor').length,readonly?0:1);
        if(!readonly){sectionRows(s).find('.formgrid-editor').val('Changed Lazy').trigger('input');assert.equal(s.grid('areas').getValues()[0].name,'Changed Lazy');}
        else assert.match(sectionRows(s).text(),/Lazy Inline/);
    }
});
test('nested inline file upload blocks submit, stores its path and keeps its parent relation',async t=>{
    const s=setup(undefined,{seed({grid}){inlineFields(grid('areas'),[{id:'name',editor:'TextField'},
        {id:'file',editor:'FileUpload',uploadUrl:'/upload',paramName:'file',maxSize:'10'}]);}});
    t.after(()=>s.dom.window.close());s.expand(s.first);
    const request=s.$.Deferred();s.$.ajax=()=>request.promise();
    const input=sectionRows(s).find('input[type=file]');
    Object.defineProperty(input[0],'files',{value:[new s.window.File(['PDF'],'nested.pdf')],configurable:true});input.trigger('change');
    await new Promise(resolve=>setTimeout(resolve,0));
    assert.equal(s.$('form :submit').prop('disabled'),true);
    request.resolve({newFilename:'nested.pdf',path:'temp/nested.pdf'});
    for(let i=0;i<10&&s.grid('areas').data('editableUploads');i++)await new Promise(resolve=>setTimeout(resolve,5));
    assert.equal(s.data(s.area).file,'nested.pdf');assert.equal(s.data(s.area).parentId,'p1');
    assert.deepEqual(s.data(s.area)._tempFilePathMap.file,['temp/nested.pdf']);
    assert.equal(s.$('form :submit').prop('disabled'),false);
    assert.match(sectionRows(s).find('.formgrid-editable-filenames').text(),/nested.pdf/);
});

const nestedXlsx=require(path.join(base,'vendor/xlsx.full.min.js'));
function nestedImportSeed(ids=['types'],columns=[{id:'name',label:'Name',type:'text'},{id:'parentId',label:'Parent',type:'text'}]) {
    return function({grid}) {
        const $=grid('plants').constructor,window=grid('plants')[0].ownerDocument.defaultView;
        $.ajax=options=>{assert.equal(options.dataType,'script');window.XLSX=nestedXlsx;return $.Deferred().resolve().promise();};
        for(const id of ids) {
            grid(id).append(`<button type="button" class="formgrid-import-open" aria-expanded="false">Import Excel / CSV</button>
                <div class="formgrid-import-panel" id="${id}_panel" aria-labelledby="${id}_title" hidden>
                    <div class="formgrid-import-heading"><h4 id="${id}_title">Import Data</h4><button type="button" class="formgrid-import-template">Download Excel Template</button></div>
                    <input type="file" class="formgrid-import-file"><label class="formgrid-import-sheet-label" hidden><select class="formgrid-import-sheet"></select></label>
                    <p class="formgrid-import-status"></p><div class="formgrid-import-preview"></div>
                    <div class="formgrid-import-pagination" hidden><select class="formgrid-import-page-size"><option>10</option><option>20</option><option>50</option><option>100</option></select>
                        <span class="formgrid-import-page-info"></span><button type="button" class="formgrid-import-previous">Previous</button><button type="button" class="formgrid-import-next">Next</button></div>
                    <button type="button" class="formgrid-import-confirm" disabled>Import Rows</button><button type="button" class="formgrid-import-cancel">Cancel</button>
                </div>`);
            grid(id).formGridImport({columns,sortField:'',libraryUrl:'/parser.js'});
        }
    };
}
function childSection(s,parent,id){return parent.next().find('[data-child-grid="'+id+'"]').first();}
async function nestedImportFile(section,content,name='rows.csv') {
    const host=section.children('.formgrid-nested-import'),input=host.find('.formgrid-import-file');
    assert.equal(input.length,1);
    const bytes=Buffer.isBuffer(content)?content:Buffer.from(content);
    Object.defineProperty(input[0],'files',{configurable:true,value:[{name,size:bytes.length,arrayBuffer:async()=>bytes}]});
    section.children('.formgrid-nested-heading').find('.formgrid-nested-import-open').trigger('click');input.trigger('change');
    for(let i=0;i<100;i++){
        if(!host.find('.formgrid-import-status').text().includes('Reading file'))return host;
        await new Promise(resolve=>setTimeout(resolve,5));
    }
    throw new Error('Nested import did not finish reading the file');
}
test('enabled nested import uses the root workflow and assigns rows to the immediate parent',async t=>{
    const s=setup(undefined,{seed:nestedImportSeed()});t.after(()=>s.dom.window.close());s.expand(s.first);
    assert.equal(childSection(s,s.first,'areas').find('.formgrid-nested-import-open').length,0);
    sectionRows(s).first().find('.formgrid-nested-toggle').trigger('click');
    const section=childSection(s,s.first,'types');assert.equal(section.find('.formgrid-nested-import-open').length,1);
    const host=await nestedImportFile(section,'name\nImported Group A\nImported Group B');
    assert.equal(s.grid('types').getValues().length,1);assert.equal(host.find('.formgrid-import-preview tbody tr').length,2);
    host.find('.formgrid-import-confirm').trigger('click');
    const values=Array.from(s.grid('types').getValues());assert.equal(values.length,3);
    for(const row of values.slice(1)){assert.equal(row.parentId,'a1');assert.match(row.id,/^[0-9a-f-]{36}$/);}
    assert.equal(s.grid('areas').getValues().length,2);assert.equal(s.grid('plants').getValues().length,2);
    const current=childSection(s,s.first,'types').children('.formgrid-nested-import');
    assert.equal(current[0],host[0]);assert.match(current.find('.formgrid-import-status').text(),/2 rows imported/);
    assert.equal(s.$('form').serializeArray().filter(p=>/^types_jsonrow_\d+$/.test(p.name)).length,3);
    assert.equal(current.find('textarea[name]').length,0);
});
test('nested import previews stay bound to their parent across collapse and sibling imports',async t=>{
    const s=setup(undefined,{seed:nestedImportSeed(['areas'])});t.after(()=>s.dom.window.close());s.expand(s.first);
    const firstHost=await nestedImportFile(childSection(s,s.first,'areas'),'name\nFirst Parent Import');
    s.expand(s.first);s.expand(s.second);
    const secondHost=await nestedImportFile(childSection(s,s.second,'areas'),'name\nSecond Parent Import');
    assert.notEqual(firstHost[0],secondHost[0]);assert.notEqual(firstHost.children('.formgrid-import-panel').attr('id'),secondHost.children('.formgrid-import-panel').attr('id'));
    secondHost.find('.formgrid-import-confirm').trigger('click');
    assert.equal(s.grid('areas').getValues().find(row=>row.name==='Second Parent Import').parentId,'p2');
    s.expand(s.first);
    assert.equal(childSection(s,s.first,'areas').children('.formgrid-nested-import')[0],firstHost[0]);
    assert.equal(firstHost.find('.formgrid-import-preview tbody tr').length,1);
    firstHost.find('.formgrid-import-confirm').trigger('click');
    assert.equal(s.grid('areas').getValues().find(row=>row.name==='First Parent Import').parentId,'p1');
});
test('nested imports reject FK columns, enforce unique/max rows and recheck limits at confirmation',async t=>{
    const s=setup(undefined,{seed:nestedImportSeed(['areas'])});t.after(()=>s.dom.window.close());s.expand(s.first);
    let section=childSection(s,s.first,'areas');
    s.grid('areas').prepend('<input disabled class="uniqueKey" value="name">');
    let host=await nestedImportFile(section,'name,parentId\nWrong Parent,p2');
    assert.match(host.find('.formgrid-import-status').text(),/Unknown header/);assert.equal(s.grid('areas').getValues().length,2);
    host=await nestedImportFile(section,'name\nArea Two');assert.match(host.find('.formgrid-import-status').text(),/duplicate/);
    s.grid('areas').children('#validateMaxRow').val('3');
    host=await nestedImportFile(section,'name\nNew A\nNew B');assert.match(host.find('.formgrid-import-status').text(),/maximum/);
    host=await nestedImportFile(section,'name\nAllowed');assert.equal(host.find('.formgrid-import-confirm').prop('disabled'),false);
    s.add('areas',{id:'concurrent',name:'Concurrent',parentId:'p2'});
    host.find('.formgrid-import-confirm').trigger('click');assert.match(host.find('.formgrid-import-status').text(),/maximum/);
    assert.equal(s.grid('areas').getValues().some(row=>row.name==='Allowed'),false);
});
test('nested import is unavailable in readonly and disabled Add grids and waits for lazy rows',t=>{
    for(const readonly of [true,false]) {
        const s=setup(undefined,{readonly,seed(context){nestedImportSeed(['areas'])(context);if(!readonly)context.grid('areas').addClass('disabledAdd');}});
        t.after(()=>s.dom.window.close());s.expand(s.first);
        assert.equal(childSection(s,s.first,'areas').find('.formgrid-nested-import-open').length,0);
    }
    const requests=[],s=setup(undefined,{seed(context){
        nestedImportSeed(['areas'])(context);lazySeed(requests)(context);
    }});t.after(()=>s.dom.window.close());s.expand(s.first);
    assert.equal(childSection(s,s.first,'areas').find('.formgrid-nested-import-open').length,0);
    requests[0].deferred.resolve({rows:[]});
    assert.equal(childSection(s,s.first,'areas').find('.formgrid-nested-import-open').length,1);
});
test('nested Excel imports open the last page, preserve editors and support cancel without adding rows',async t=>{
    const s=setup([{gridId:'areas',foreignKey:'parentId'}],{paginationThreshold:10,seed(context){
        nestedImportSeed(['areas'])(context);context.grid('areas').gridPagingCustom({customSize:10});
        inlineFields(context.grid('areas'),[{id:'name',editor:'TextField'}]);
    }});t.after(()=>s.dom.window.close());s.expand(s.first);
    const wb=nestedXlsx.utils.book_new();nestedXlsx.utils.book_append_sheet(wb,nestedXlsx.utils.aoa_to_sheet([['name'],...Array.from({length:11},(_,i)=>['Excel '+i])]),'Rows');
    const bytes=nestedXlsx.write(wb,{type:'buffer',bookType:'xlsx'});
    let host=await nestedImportFile(childSection(s,s.first,'areas'),bytes,'rows.xlsx');
    host.find('.formgrid-import-cancel').trigger('click');assert.equal(s.grid('areas').getValues().length,2);
    host=await nestedImportFile(childSection(s,s.first,'areas'),bytes,'rows.xlsx');host.find('.formgrid-import-confirm').trigger('click');
    assert.equal(s.grid('areas').getValues().length,13);assert.match(nestedPager(s).text(),/Page 2 of 2/);
    assert.equal(sectionRows(s).length,2);assert.equal(sectionRows(s).find('.formgrid-editor').length,2);
    sectionRows(s).last().find('.formgrid-editor').val('Edited Imported').trigger('input');
    assert.equal(s.grid('areas').getValues().find(row=>row.name==='Edited Imported').parentId,'p1');
});
test('nested import template excludes managed FK/sort columns and downloads without navigating',async t=>{
    const s=setup([{gridId:'areas',foreignKey:'parentId',sortWithButtons:'true',sortField:'order'}],{seed:nestedImportSeed(['areas'],[
        {id:'name',label:'Name',type:'text'},{id:'parentId',type:'text'},{id:'order',type:'text'},{id:'file',type:'file'}])});
    t.after(()=>s.dom.window.close());s.expand(s.first);
    let blob,download;
    s.window.URL.createObjectURL=value=>{blob=value;return 'blob:nested-template';};s.window.URL.revokeObjectURL=()=>{};
    s.window.HTMLAnchorElement.prototype.click=function(){download=this.download;};
    childSection(s,s.first,'areas').children('.formgrid-nested-import').find('.formgrid-import-template').trigger('click');
    for(let i=0;i<100&&!blob;i++)await new Promise(resolve=>setTimeout(resolve,5));
    assert.equal(download,'form-grid-template.xlsx');
    const headers=await new Promise((resolve,reject)=>{
        const reader=new s.window.FileReader();reader.onload=()=>{const wb=nestedXlsx.read(new Uint8Array(reader.result),{type:'array'});resolve(nestedXlsx.utils.sheet_to_json(wb.Sheets.Import_Data,{header:1}));};reader.onerror=reject;reader.readAsArrayBuffer(blob);
    });
    assert.deepEqual(headers,[['name']]);
});

test('lazy nested import includes unopened branches in its row limit and preserves load markers',async t=>{
    const requests=[];
    const s=setup([{gridId:'areas',foreignKey:'parentId'}],{seed(context){
        nestedImportSeed(['areas'])(context);const $=context.grid('areas').constructor,parserAjax=$.ajax;
        lazySeed(requests)(context);const loadAjax=$.ajax;
        $.ajax=options=>options.dataType==='script'?parserAjax(options):loadAjax(options);
        context.grid('areas').children('#validateMaxRow').val('5');
    }});t.after(()=>s.dom.window.close());s.expand(s.first);
    requests[0].deferred.resolve({rows:[{id:'loaded',name:'Existing',parentId:'p1'}],total:4});
    let host=await nestedImportFile(childSection(s,s.first,'areas'),'name\nToo Many A\nToo Many B');
    assert.match(host.find('.formgrid-import-status').text(),/maximum of 5 rows \(4 existing/);
    assert.equal(s.grid('areas').getValues().length,1);
    host=await nestedImportFile(childSection(s,s.first,'areas'),'name\nAllowed Lazy');host.find('.formgrid-import-confirm').trigger('click');
    assert.equal(s.grid('areas').getValues().length,2);
    assert.equal(s.grid('areas').getValues()[1].parentId,'p1');
    assert.equal(s.grid('areas').children('.formgrid-nested-loaded').val(),'["p1"]');
    host=await nestedImportFile(childSection(s,s.first,'areas'),'name\nOver Limit');
    assert.match(host.find('.formgrid-import-status').text(),/maximum of 5 rows \(5 existing/);
});
test('changing the parent key after preview blocks nested import instead of retargeting its rows',async t=>{
    const s=setup(undefined,{seed:nestedImportSeed(['areas'])});t.after(()=>s.dom.window.close());s.expand(s.first);
    const host=await nestedImportFile(childSection(s,s.first,'areas'),'name\nPending Row');
    s.first.find('textarea').val(JSON.stringify({...s.data(s.first),id:'changed-parent'}));
    host.find('.formgrid-import-confirm').trigger('click');
    assert.match(host.find('.formgrid-import-status').text(),/parent row has changed/);
    assert.equal(s.grid('areas').getValues().length,2);
});
