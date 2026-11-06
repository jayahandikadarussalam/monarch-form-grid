const {test} = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const base = path.resolve(__dirname, '../../main/resources/resources/js');
const rules = require(path.join(base, 'formGridImport.js'));
const XLSX = require(path.join(base, 'vendor/xlsx.full.min.js'));
const columns = [
    {id: 'name', label: 'Full Name', type: 'text'},
    {id: 'select', label: 'Select', type: 'text'},
    {id: 'date', label: 'Date', type: 'date', dateFormat: 'yyyy-MM-dd'},
    {id: 'file', label: 'File', type: 'file'}
];
function csv(text) { return rules.readWorkbook(XLSX, Buffer.from(text)); }
function parse(wb, cols = columns, sheet = wb.SheetNames[0], sortField = '') {
    return rules.parseSheet(XLSX, wb, sheet, cols, sortField);
}
function excel(rows, bookType = 'xlsx', edit = () => {}) {
    const wb = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet(rows);
    edit(sheet, wb);
    XLSX.utils.book_append_sheet(wb, sheet, 'Data');
    return rules.readWorkbook(XLSX, XLSX.write(wb, {type: 'buffer', bookType}));
}
test('CSV maps reordered c_ IDs and labels; preserves zero prefixes, Unicode and quoted newlines', () => {
    const batch = parse(csv('\uFEFFc_select,"Full Name",date\r\n001,"Andi, 日本\nBaris kedua",2026-11-05\r\n'));
    assert.equal(batch.rows.length, 1);
    assert.equal(batch.rows[0].select, '001');
    assert.equal(batch.rows[0].name, 'Andi, 日本\nBaris kedua');
    assert.equal(batch.rows[0].date, '2026-11-05');
    assert.equal(batch.rows[0].file, '');
});
test('semicolon CSV and empty lines are supported', () => {
    const batch = parse(csv('name;select;date\r\nAndi;A;2026-11-05\r\n;;\r\nBudi;B;2026-11-06'));
    assert.equal(batch.rows.length, 2);
    assert.equal(batch.rows[1].name, 'Budi');
});
for (const bookType of ['xlsx', 'xls']) test(`${bookType} converts Excel dates using child storage format`, () => {
    const batch = parse(excel([['name', 'date'], ['Andi', 46331]], bookType));
    assert.equal(batch.rows[0].date, '2026-11-05');
    const custom = columns.map(c => ({...c, dateFormat: 'dd/MM/yyyy'}));
    assert.equal(parse(excel([['name', 'date'], ['Budi', 46331]], bookType), custom).rows[0].date, '05/11/2026');
});
test('Excel 1904 date system, numeric masks and decimal values', () => {
    const cols = [{id:'name',type:'text'}, {id:'amount',type:'decimal'}, {id:'date',type:'date'}];
    const wb = excel([['name','amount','date'], [123,1234.5,44869]], 'xlsx', (sheet, book) => {
        sheet.A2.z = '000000';
        sheet.B2.z = '#,##0.00';
        book.Workbook = {WBProps: {date1904: true}};
    });
    const row = parse(wb, cols).rows[0];
    assert.equal(row.name, '000123');
    assert.equal(row.amount, '1234.5');
    assert.equal(row.date, '2026-11-05');
});
test('date/time storage format and unsupported patterns', () => {
    const date = {y:2026,m:11,d:5,H:14,M:7,S:9};
    assert.equal(rules.formatDate(date, "yyyy-MM-dd'T'HH:mm:ss"), '2026-11-05T14:07:09');
    assert.equal(rules.formatDate(date, 'dd/MM/yyyy hh:mm a'), '05/11/2026 02:07 PM');
    assert.throws(() => rules.formatDate(date, 'dd MMM yyyy'), /Unsupported date storage format/);
});
test('unknown, duplicate, ambiguous and missing headers fail before import', () => {
    assert.throws(() => parse(csv('unknown\nHello')), /Unknown header/);
    assert.throws(() => parse(csv('name,c_name\nA,B')), /More than one header/);
    assert.throws(() => parse(csv('same\nA'), [{id:'one',label:'same'}, {id:'two',label:'same'}]), /Ambiguous header/);
    assert.throws(() => parse(csv('name,\nA,B')), /no header/);
    assert.throws(() => parse(csv('id\none')), /No configured columns/);
});
test('system IDs, request metadata and ordering cannot be imported', () => {
    const batch = parse(csv('id,name,dateCreated,c_sort\nexisting-id,Andi,2020-01-01,777'), columns, 'Sheet1', 'sort');
    assert.equal(batch.rows[0].id, undefined);
    assert.equal(batch.rows[0].sort, undefined);
    assert.deepEqual(batch.ignored, ['id', 'dateCreated', 'c_sort']);
    assert.throws(() => parse(csv('__proto__\nmalicious'), [{id:'__proto__'}]), /Unknown header/);
    assert.throws(() => parse(csv('_tempRequestParamsMap\nmalicious')), /Unknown header/);
});
test('unique values are checked against existing rows and the entire batch', () => {
    const batch = parse(csv('name\nAndi\nBudi'));
    assert.doesNotThrow(() => rules.validateBatch(batch, [{name:'Other'}], 'name', 3));
    assert.throws(() => rules.validateBatch(batch, [{name:'Andi'}], 'name', 3), /Row 2: duplicate/);
    assert.throws(() => rules.validateBatch(parse(csv('name\nAndi\n Andi ')), [], 'name', 10), /duplicate/);
    assert.throws(() => rules.validateBatch(parse(csv('select\n001')), [], 'name', 10), /must have a value/);
    assert.throws(() => rules.validateBatch(batch, [{name:'Other'}], '', 2), /maximum of 2 rows/);
    assert.equal(batch.rows[0].id, undefined);
});
test('file and image values must be empty; HTML is imported as text', () => {
    assert.throws(() => parse(csv('name,file\nAndi,attachment.pdf')), /Upload attachments/);
    assert.throws(() => parse(csv('picture\nphoto.jpg'), [{id:'picture',type:'image'}]), /Upload attachments/);
    assert.equal(parse(csv('name,file\nAndi,' )).rows[0].file, '');
    const html = parse(csv('html\n<img src=x onerror=alert(1)>'), [{id:'html', type:'html'}]);
    assert.equal(html.rows[0].html, '&lt;img src=x onerror=alert(1)&gt;');
});
test('spreadsheet error cells and formulas without cached results are rejected', () => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([['name'], ['placeholder']]);
    XLSX.utils.book_append_sheet(wb, ws, 'Data');
    ws.A2 = {t:'e', v:7};
    assert.throws(() => parse(wb), /Spreadsheet error/);
    ws.A2 = {t:'n', f:'1+1'};
    // sheet_to_json treats an uncached formula as blank: another cell makes the row nonblank.
    ws.B1 = {t:'s', v:'select'};
    ws.B2 = {t:'s', v:'A'};
    ws['!ref'] = 'A1:B2';
    assert.throws(() => parse(wb), /cached value/);
});
test('worksheet selection uses the selected sheet only', () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['wrong'], ['A']]), 'Instructions');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['name'], ['Andi']]), 'Import');
    assert.equal(parse(wb, columns, 'Import').rows[0].name, 'Andi');
});
test('file, row and column limits reject oversized imports', () => {
    assert.throws(() => rules.checkFile({name:'data.exe',size:10}), /Choose/);
    assert.throws(() => rules.checkFile({name:'data.csv',size:0}), /empty/);
    assert.throws(() => rules.checkFile({name:'data.xlsx',size:rules.MAX_BYTES+1}), /10 MB/);
    const wb = csv('name\nAndi');
    wb.Sheets[wb.SheetNames[0]]['!fullref'] = 'A1:A5002';
    assert.throws(() => parse(wb), /5000 row/);
    wb.Sheets[wb.SheetNames[0]]['!fullref'] = 'A1:IW2';
    assert.throws(() => parse(wb), /256 column/);
});
test('dynamic template excludes attachments and system-managed fields', () => {
    const template = rules.templateWorkbook(XLSX, [...columns, {id:'id'}, {id:'sort'}], 'sort');
    const saved = XLSX.read(XLSX.write(template, {type:'buffer',bookType:'xlsx'}));
    assert.deepEqual(saved.SheetNames, ['Import_Data']);
    assert.deepEqual(XLSX.utils.sheet_to_json(saved.Sheets.Import_Data,{header:1}), [['name','select','date']]);
    XLSX.utils.sheet_add_aoa(saved.Sheets.Import_Data, [['Andi','A','2026-11-05']], {origin:'A2'});
    assert.equal(parse(saved).rows[0].name, 'Andi');
    assert.throws(() => rules.templateWorkbook(XLSX, [{id:'file',type:'file'}], ''), /importable column/);
});
