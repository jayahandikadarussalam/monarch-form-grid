const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {JSDOM} = require('jsdom');
const jquery = require('jquery');
const root = path.join(__dirname, '../../main/resources');
const schema = JSON.parse(fs.readFileSync(path.join(root,'properties/FormGridCustom.json'),'utf8').replace('%s','{}'));
const properties = schema.flatMap(page=>page.properties);
const definition = properties.find(p=>p.name==='nestedChildren');
const script = fs.readFileSync(path.join(root,'resources/js/formGridNestedProperties.js'),'utf8');
const escape = value => String(value ?? '').replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;');
const first = {gridId:'areasGrid',formDefId:'areass',label:'Areas',parentGridId:'',parentKey:'id',foreignKey:'parentid',sortWithButtons:'true',sortField:'sort',enableDuplicate:'false'};
function row(value={},model=false) {
    return `<tr${model?' class="grid_model" style="display:none"':''}>${definition.columns.map(column=>{
        const raw = value[column.key] || '';
        let control;
        if(column.type==='truefalse') control=`<input type="checkbox" name="${column.key}" value="true"${raw==='true'?' checked':''}>`;
        else if(column.type==='selectbox' && column.options) control=`<select name="${column.key}">${column.options.map(o=>`<option value="${o.value}"${(raw||column.value)===o.value?' selected':''}>${o.label}</option>`).join('')}</select>`;
        else if(column.options_ajax) control=`<select name="${column.key}"><option value=""></option><option value="areass"${raw==='areass'?' selected':''}>Area</option></select>`;
        else control=`<input name="${column.key}" value="${escape(raw)}">`;
        return `<td><span>${control}</span></td>`;
    }).join('')}<td class="property-type-grid-action-column"><a class="property-type-grid-action-delete">Delete</a></td></tr>`;
}
function setup({suggestions=false}={}) {
    const dom = new JSDOM(`<div id="editor"><input id="editor_id" value="plants"><input id="editor_formDefId" value="plantForm"><div property-name="nestedChildren" class="property-editor-property property-type-grid">
        <div id="editor_nestedChildren_input"><table id="editor_nestedChildren"><tbody>
        <tr class="grid_header">${definition.columns.map(c=>`<th>${c.label}</th>`).join('')}<th></th></tr>${row({},true)}${row(first)}</tbody></table>
        <a class="property-type-grid-action-add">Add</a></div></div>
        <div class="property-editor-property"><div id="editor_nestedPropertiesLayout_input"></div></div></div>
        <div id="unrelated"><div property-name="nestedChildren" class="property-editor-property"><table><tr><td>Unrelated</td></tr></table></div></div>`,{runScripts:'outside-only'});
    const window=dom.window,$=jquery(window);window.$=window.jQuery=$;
    const requests=[];
    if(suggestions) {
        $.getJSON=(url,params)=>{const deferred=$.Deferred();requests.push({url,params,deferred});return deferred.promise();};
        $.fn.autocomplete=function(command,arg) {
            if(typeof command==='object') return this.each(function(){$(this).data('autocompleteTest',command);});
            if(command==='widget') return $('<ul>');
            if(command==='search') this.each(function(){const input=$(this);input.data('autocompleteTest').source({term:arg},result=>input.data('lastSuggestions',result));});
            return this;
        };
    }
    const helper=window.eval(script);
    const helperProperties={name:'nestedPropertiesLayout'};
    if(suggestions) helperProperties.field_options_url=properties.find(p=>p.name==='nestedPropertiesLayout').field_options_url;
    Object.assign(helper,{id:'editor_nestedPropertiesLayout',properties:helperProperties,options:{contextPath:'/jw',appPath:'/demo/1'},editor:$('#editor'),editorObject:{fields:{nestedChildren:{properties:definition,value:[first]}}}});
    $('#editor_nestedPropertiesLayout_input').html(helper.renderField());
    helper.initScripting();
    function close(){helper.nestedPropertiesObserver.disconnect();window.close();}
    return {dom,window,$,helper,close,requests,table:$('#editor_nestedChildren')};
}
function values(row) {
    const result={};
    row.find('input[name],select[name]').each(function(){result[this.name]=this.type==='checkbox'?(this.checked?'true':'false'):this.value;});
    return result;
}
test('the native grid is laid out in two rows, with labeled fields and no changes to stored values',t=>{
    const s=setup();t.after(s.close);
    const data=s.table.find('tr').not('.grid_header,.grid_model').first();
    assert.deepEqual(values(data),first);
    assert.equal(data.children('td').length,10);
    assert.equal(data.find('.monarch-nested-field-label').length,9);
    assert.equal(s.table.closest('.property-editor-property').hasClass('monarch-nested-properties'),true);
    assert.equal(s.$('#unrelated .monarch-nested-properties').length,0);
    assert.match(s.helper.renderField(),/grid-template-columns:repeat\(5,minmax\(0,1fr\)\)/);
    assert.match(s.helper.renderField(),/\.grid_model\{display:none!important\}/);
    assert.deepEqual(Object.keys(s.helper.getData()),[]);
    assert.equal(s.$('#editor_nestedPropertiesLayout_input').closest('.property-editor-property').css('display'),'none');
    for(const column of definition.columns) assert.equal(data.find(`[name="${column.key}"]`).attr('aria-label'),column.label);
});
test('sort checkbox and duplicate modes serialize as the existing true/false strings',t=>{
    const s=setup();t.after(s.close);const data=s.table.find('tr').not('.grid_header,.grid_model').first();
    assert.equal(data.find('[name="sortWithButtons"]').prop('checked'),true);
    assert.equal(data.find('[name="enableDuplicate"]').val(),'false');
    assert.deepEqual(data.find('[name="enableDuplicate"] option').map(function(){return this.text;}).get(),['Default','Pop Up Dialog']);
    data.find('[name="sortWithButtons"]').prop('checked',false).trigger('change');
    data.find('[name="enableDuplicate"]').val('true').trigger('change');
    assert.equal(values(data).sortWithButtons,'false');assert.equal(values(data).enableDuplicate,'true');
    const model=s.table.find('tr.grid_model');
    assert.equal(model.find('[name="enableDuplicate"]').val(),'false');
    assert.equal(model.find('[name="sortWithButtons"]').prop('checked'),false);
});
test('adding a native model row and loading Form options retain one label per control and checkbox defaults',async t=>{
    const s=setup();t.after(s.close);
    const added=s.$('<tr>').html(s.table.find('tr.grid_model').html()).appendTo(s.table.children('tbody'));
    const control=added.find('[name="formDefId"]')[0];
    added.find('[name="formDefId"]').append('<option value="other">Other Form</option>');
    await new Promise(resolve=>setTimeout(resolve,0));
    assert.equal(added.find('.monarch-nested-field-label').length,9);
    assert.equal(added.find('[name="enableDuplicate"]').val(),'false');
    assert.equal(added.find('[name="sortWithButtons"]').prop('checked'),false);
    assert.equal(added.find('[name="formDefId"]')[0],control);
    assert.equal(added.find('[name="formDefId"] option').last().text(),'Other Form');
});
test('the layout also applies after a native CSV switch recreates the table',async t=>{
    const s=setup();t.after(s.close);
    const input=s.$('#editor_nestedChildren_input');s.table.remove();
    const replacement=s.$(`<table id="editor_nestedChildren"><tbody><tr class="grid_header">${definition.columns.map(c=>`<th>${c.label}</th>`).join('')}<th></th></tr>${row(first)}</tbody></table>`).prependTo(input);
    await new Promise(resolve=>setTimeout(resolve,0));
    const restored=replacement.find('tr').not('.grid_header').first();
    assert.equal(restored.find('.monarch-nested-field-label').length,9);assert.deepEqual(values(restored),first);
});
test('the presentation helper is versioned and leaves native grid, Form AJAX, and CSV column order intact',()=>{
    assert.equal(definition.type,'grid');
    const helper=properties.find(p=>p.name==='nestedPropertiesLayout');
    assert.equal(helper.type,'custom');assert.match(helper.script_url,/formGridNestedProperties\.js\?v=2\.9\.0$/);
    assert.equal(definition.columns.find(c=>c.key==='formDefId').type,'selectbox');
    assert.equal(definition.columns.map(c=>first[c.key]).join(';'),'areasGrid;areass;Areas;;id;parentid;true;sort;false');
});
function search(input,term) {
    let result;
    input.data('autocompleteTest').source({term},value=>{result=Array.from(value,o=>o.value);});
    return ()=>result;
}
function savedRow(s){return s.table.find('tr').not('.grid_header,.grid_model').first();}
test('FK and Sort Field suggestions share one request for their selected child Form and filter typed text',t=>{
    const s=setup({suggestions:true});t.after(s.close);const data=savedRow(s);
    const fk=search(data.find('[name="foreignKey"]'),'na');
    const sort=search(data.find('[name="sortField"]'),'so');
    assert.equal(s.requests.length,1);assert.equal(s.requests[0].params.formDefId,'areass');
    assert.equal(s.requests[0].url,'/jw/web/json/console/app/demo/1/form/columns/options');
    s.requests[0].deferred.resolve([{value:'',label:''},{value:'name',label:'name'},{value:'createdByName',label:'createdByName'},{value:'parentid',label:'parentid'},{value:'sort',label:'sort'},{value:'sort',label:'duplicate'}]);
    assert.deepEqual(fk(),['name','createdByName']);assert.deepEqual(sort(),['sort']);
    assert.equal(data.find('[name="foreignKey"]').val(),'parentid');assert.equal(data.find('[name="sortField"]').attr('aria-busy'),undefined);
    search(data.find('[name="sortField"]'),'s');assert.equal(s.requests.length,1);
});
test('changing Child Form ID ignores stale suggestions and keeps manually entered Field IDs',t=>{
    const s=setup({suggestions:true});t.after(s.close);const data=savedRow(s),input=data.find('[name="foreignKey"]');
    const old=search(input,'');
    data.find('[name="formDefId"]').append('<option value="secondForm">Second</option>').val('secondForm').trigger('change');
    const current=search(input,'');assert.equal(s.requests.length,2);assert.equal(s.requests[1].params.formDefId,'secondForm');
    s.requests[1].deferred.resolve([{value:'secondField'}]);s.requests[0].deferred.resolve([{value:'parentid'}]);
    assert.deepEqual(current(),['secondField']);assert.deepEqual(old(),[]);assert.equal(input.val(),'parentid');
});
test('Parent Key suggestions use the root Form or the selected parent relation Form',async t=>{
    const s=setup({suggestions:true});t.after(s.close);
    const root=search(savedRow(s).find('[name="parentKey"]'),'id');
    assert.equal(s.requests[0].params.formDefId,'plantForm');s.requests[0].deferred.resolve([{value:'id'}]);assert.deepEqual(root(),['id']);
    const added=s.$(row({...first,gridId:'groupsGrid',parentGridId:'areasGrid'})).appendTo(s.table.children('tbody'));
    added.find('[name="formDefId"]').append('<option value="groupForm">Groups</option>').val('groupForm');
    await new Promise(resolve=>setTimeout(resolve,0));
    search(added.find('[name="parentKey"]'),'');assert.equal(s.requests[1].params.formDefId,'areass');
    search(added.find('[name="sortField"]'),'');assert.equal(s.requests[2].params.formDefId,'groupForm');
    s.requests[1].deferred.resolve([{value:'areaKey'}]);s.requests[2].deferred.resolve([{value:'groupOrder'}]);
    s.$('#editor_formDefId').val('newRootForm').trigger('change');search(savedRow(s).find('[name="parentKey"]'),'');
    assert.equal(s.requests[3].params.formDefId,'newRootForm');
});
test('failed field requests can be retried and missing Form selections do not query another table',t=>{
    const s=setup({suggestions:true});t.after(s.close);const data=savedRow(s),input=data.find('[name="sortField"]');
    const failed=search(input,'sort');s.requests[0].deferred.reject();assert.deepEqual(failed(),[]);
    assert.match(input.attr('title'),/retry/);assert.equal(input.val(),'sort');
    const retry=search(input,'sort');assert.equal(s.requests.length,2);s.requests[1].deferred.resolve([{value:'sort'}]);
    assert.deepEqual(retry(),['sort']);assert.equal(input.attr('title'),undefined);
    data.find('[name="formDefId"]').val('').trigger('change');
    const noForm=search(input,'');assert.deepEqual(noForm(),[]);assert.equal(s.requests.length,2);
});

test('Sort Field visibility follows only its own row checkbox and retains the saved field',async t=>{
    const s=setup();t.after(s.close);const data=savedRow(s),input=data.find('[name="sortField"]');
    const other=s.$(row({...first,gridId:'groupsGrid',sortWithButtons:'false',sortField:'groupOrder'})).appendTo(s.table.children('tbody'));
    await new Promise(resolve=>setTimeout(resolve,0));
    assert.notEqual(input.closest('td').css('display'),'none');
    assert.equal(other.find('[name="sortField"]').closest('td').css('display'),'none');
    data.find('[name="sortWithButtons"]').prop('checked',false).trigger('change');
    assert.equal(input.closest('td').css('display'),'none');assert.equal(values(data).sortField,'sort');assert.equal(input.prop('disabled'),false);
    other.find('[name="sortWithButtons"]').prop('checked',true).trigger('change');
    assert.notEqual(other.find('[name="sortField"]').closest('td').css('display'),'none');
    assert.equal(input.closest('td').css('display'),'none');
    data.find('[name="sortWithButtons"]').prop('checked',true).trigger('change');
    assert.notEqual(input.closest('td').css('display'),'none');assert.equal(input.val(),'sort');
    const added=s.$('<tr>').html(s.table.find('tr.grid_model').html()).appendTo(s.table.children('tbody'));
    await new Promise(resolve=>setTimeout(resolve,0));
    assert.equal(added.find('[name="sortField"]').closest('td').css('display'),'none');
    added.find('[name="sortWithButtons"]').prop('checked',true).trigger('change');
    assert.notEqual(added.find('[name="sortField"]').closest('td').css('display'),'none');
});
