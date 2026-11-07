const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {JSDOM} = require('jsdom');
const jquery = require('jquery');
const base = path.join(__dirname, '../../main/resources/resources/js');
const columns = [
    {id:'name',label:'Name',editor:'TextField'},
    {id:'note',label:'Note',editor:'TextArea'},
    {id:'role',label:'Role',editor:'SelectBox',options:{admin:'Administrator',user:'User'}},
    {id:'tags',label:'Tags',editor:'CheckBox',multiple:true,options:{a:'Alpha',b:'Beta'}},
    {id:'date',label:'Date',editor:'DatePicker',dateFormat:'dd/MM/yyyy'},
    {id:'file',label:'File',editor:'FileUpload',uploadUrl:'/upload?nonce=signed',paramName:'file',maxSize:'10'}
];
function fixture(id) {
    return `<div id="${id}" class="formgrid-custom">
        <input class="uniqueKey" value="name"><input class="uniqueKeyMessage" value="Duplicate {column}: {value}">
        <input id="appId" value="test"><input id="appVersion" value="1"><input id="contextPath" value="/jw">
        <div class="grid-validation-error"><span class="error-content"></span></div>
        <table><thead><tr>${columns.map(c=>`<th id="items_${c.id}">${c.label}</th>`).join('')}</tr></thead><tbody>
        <tr class="grid-row-template" style="display:none">${columns.map(c=>`<td><span class="grid-cell" column_key="${c.id}" column_type="text"></span></td>`).join('')}
        <td style="display:none"><textarea id="items_jsonrow" name="items_jsonrow"></textarea></td></tr>
        </tbody></table><p class="pg-navigator"></p><button type="button" class="formgrid-custom-add">Add</button>
        </div>`;
}
function setup({enabled=true,readonly=false,config=columns}={}) {
    const dom = new JSDOM(`<form>${fixture('one')}${fixture('two')}<button type="submit">Save</button></form>`,{runScripts:'outside-only',url:'https://example.test/jw'});
    const window = dom.window, $ = jquery(window);
    window.$ = window.jQuery = $;
    window.UI = {escapeHTML:value=>$('<div>').text(value == null ? '' : value).html()};
    window.JPopup = {hide(){}};
    window.confirm=()=>true;
    for (const file of ['jquery.formGridCustom.js','jquery.formGridCustom.remake.js','jquery.utils.js','jquery.formGridEditable.js']) {
        window.eval(fs.readFileSync(path.join(base,file),'utf8'));
    }
    const grid = $('#one'), other = $('#two');
    grid.toggleClass('readonly',readonly);
    grid.add(other).formGridCustom({messages:{},options:{}});
    function add(data, target=grid) { target.formGridCustom('addRow',{result:JSON.stringify(data)}); return target.find('tr.grid-row').last(); }
    const row = add({id:'original-id',name:'Andi',note:'Original\nline',role:'admin',tags:'a',date:'06/11/2026',file:'old.pdf',hidden:'preserved',_tempRequestParamsMap:{name:['Andi']}});
    if(enabled) grid.formGridEditable({columns:config});
    function editor(id, target=row) { return target.find('.formgrid-editor').filter(function(){return $(this).data('column').id===id;}); }
    function data(target=row) { return JSON.parse(target.find('textarea:not(.formgrid-editor)').val()); }
    return {dom,window,$,grid,other,row,add,editor,data};
}
test('opt-in editors preserve row metadata and serialize text, multiline, options and storage dates',t=>{
    const s=setup(); t.after(()=>s.dom.window.close());
    assert.equal(s.editor('name').val(),'Andi');
    assert.equal(s.editor('note').val(),'Original\nline');
    assert.equal(s.editor('date').val(),'2026-11-06');
    assert.equal(s.editor('role').find('option:selected').text(),'Administrator');
    let changes=0; s.grid.on('change.test',()=>changes++);
    s.editor('name').val('Budi <img src=x>').trigger('input');
    s.editor('note').val('First\nSecond').trigger('input');
    s.editor('role').val('user').trigger('change');
    s.editor('tags').val(['a','b']).trigger('change');
    s.editor('date').val('2026-12-31').trigger('change');
    const data=s.data();
    assert.equal(data.name,'Budi <img src=x>');
    assert.equal(data.note,'First\nSecond');
    assert.equal(data.role,'user'); assert.equal(data.tags,'a;b'); assert.equal(data.date,'31/12/2026');
    assert.equal(data.id,'original-id'); assert.equal(data.hidden,'preserved');
    assert.deepEqual(data._tempRequestParamsMap.name,['Budi <img src=x>']);
    assert.equal(s.row.find('img').length,0);
    assert.equal(changes,5);
    assert.equal(s.row.find('.grid-action-edit,.grid-action-delete,.grid-action-duplicate').length,3);
    assert.equal(s.grid.getValues()[0].note,'First\nSecond');
    assert.equal(s.other.find('.formgrid-editor').length,0);
});
test('disabled and readonly grids retain the original behavior',t=>{
    const disabled=setup({enabled:false}); t.after(()=>disabled.dom.window.close());
    assert.equal(disabled.grid.find('.formgrid-editor').length,0);
    const locked=setup({enabled:false}); t.after(()=>locked.dom.window.close());
    locked.grid.addClass('readonly').formGridEditable({columns});
    assert.equal(locked.grid.find('.formgrid-editor').length,0);
});
test('new rows, popup updates and programmatic updates retain editors and textarea payloads',t=>{
    const s=setup(); t.after(()=>s.dom.window.close());
    const second=s.add({id:'second',name:'Citra',note:'Two\nlines',date:''});
    assert.equal(s.editor('note',second).val(),'Two\nlines');
    s.grid.formGridCustom('editRow',{rowId:s.row.attr('id'),result:JSON.stringify({...s.data(),name:'Edited popup',note:'Popup text'})});
    assert.equal(s.editor('name').val(),'Edited popup');
    assert.equal(s.editor('note').val(),'Popup text');
    s.grid.updateRowData(data=>{data.note='Programmatic\nupdate';});
    assert.equal(s.editor('note').val(),'Programmatic\nupdate');
    assert.equal(s.data().note,'Programmatic\nupdate');
    s.grid.formGridCustom('refreshIndex');
    assert.equal(s.editor('note').attr('name'),undefined);
    assert.equal(s.row.find('textarea:not(.formgrid-editor)').attr('name'),'items_jsonrow_0');
});
test('unique values compare raw row data for inline and popup edits',t=>{
    const s=setup(); t.after(()=>s.dom.window.close());
    s.add({id:'second',name:'Budi'});
    s.editor('name').val('budi').trigger('input');
    assert.equal(s.data().name,'Andi'); assert.equal(s.editor('name').val(),'Andi');
    assert.match(s.grid.find('.error-content').text(),/Duplicate Name: budi/);
    assert.equal(s.grid.formGridCustom('checkDuplicate',s.grid,{result:JSON.stringify({name:'ANDI'})}),false);
});
test('unsupported or invalid stored dates are preserved for popup editing',t=>{
    const s=setup({config:columns.map(c=>c.id==='date'?{...c,dateFormat:'dd MMM yyyy'}:c)}); t.after(()=>s.dom.window.close());
    assert.equal(s.editor('date').length,0); assert.equal(s.data().date,'06/11/2026');
});
test('file upload uses signed service, blocks submit while pending and stores the temp path',async t=>{
    const s=setup(); t.after(()=>s.dom.window.close());
    const request=s.$.Deferred(); let payload;
    s.$.ajax=options=>{payload=options; return request.promise();};
    Object.defineProperty(s.editor('file')[0],'files',{value:[new s.window.File(['PDF'],'new.pdf')],configurable:true});
    s.editor('file').trigger('change');
    await new Promise(resolve=>setTimeout(resolve,0));
    assert.equal(payload.url,'/upload?nonce=signed');
    assert.equal(payload.data.get('file').name,'new.pdf');
    assert.equal(s.grid.closest('form').find(':submit').prop('disabled'),true);
    const event=s.$.Event('submit'); s.grid.closest('form').triggerHandler(event);
    assert.equal(event.isDefaultPrevented(),true);
    request.resolve({newFilename:'new.pdf',path:'temp/new.pdf'});
    for(let i=0;i<10 && s.grid.data('editableUploads');i++) await new Promise(resolve=>setTimeout(resolve,5));
    assert.equal(s.data().file,'new.pdf');
    assert.deepEqual(s.data()._tempFilePathMap.file,['temp/new.pdf']);
    assert.deepEqual(s.data()._tempRequestParamsMap.file_path,['temp/new.pdf']);
    assert.equal(s.grid.data('editableUploads'),0);
    assert.equal(s.grid.closest('form').find(':submit').prop('disabled'),false);
});
test('failed and oversized uploads preserve previous file data',async t=>{
    const s=setup(); t.after(()=>s.dom.window.close());
    s.$.ajax=()=>s.$.Deferred().resolve({error:'Upload rejected'}).promise();
    Object.defineProperty(s.editor('file')[0],'files',{value:[new s.window.File(['PDF'],'bad.pdf')],configurable:true});
    s.editor('file').trigger('change');
    for(let i=0;i<10 && s.grid.data('editableUploads');i++) await new Promise(resolve=>setTimeout(resolve,5));
    assert.equal(s.data().file,'old.pdf');
    assert.match(s.grid.find('.error-content').text(),/Upload rejected/);
    Object.defineProperty(s.editor('file')[0],'files',{value:[new s.window.File(['x'.repeat(11000)],'large.pdf')],configurable:true});
    s.editor('file').trigger('change');
    assert.match(s.grid.find('.error-content').text(),/size limit/);
    assert.equal(s.data().file,'old.pdf');
});

test('AJAX selects follow their row control value and ignore stale option responses',t=>{
    const config=columns.map(c=>c.id==='role'?{...c,options:{OPTIONS_USE_AJAX:'true',OPTIONS:'[]',OPTIONS_AJAX_CONTROL_FIELD:'name',OPTIONS_AJAX_APP_ID:'app',OPTIONS_AJAX_APP_VERSION:'1',OPTIONS_AJAX_NONCE:'nonce',OPTIONS_AJAX_BINDER_DATA:'binder'}}:c);
    const s=setup({enabled:false}); t.after(()=>s.dom.window.close());
    const requests=[];
    s.$.getJSON=(url,data)=>{const result=s.$.Deferred();requests.push({url,data,result});return result.promise();};
    s.grid.formGridEditable({columns:config});
    assert.equal(requests[0].data._dv,'Andi');
    requests[0].result.resolve([{value:'admin',label:'Administrator'}]);
    s.editor('name').val('Budi').trigger('input');
    s.editor('name').val('Citra').trigger('input');
    assert.equal(requests[2].data._dv,'Citra');
    requests[2].result.resolve([{value:'user',label:'User'}]);
    requests[1].result.resolve([{value:'admin',label:'Stale option'}]);
    assert.equal(s.editor('role').find('option').last().text(),'User');
    assert.equal(s.editor('role').prop('disabled'),false);
    assert.equal(s.data().role,'');
    s.editor('role').val('user').trigger('change');
    assert.equal(s.data().role,'user');
});
