<#assign showCheckbox = element.properties.disabledDelete! != 'true' && element.properties.readonly! != 'true' && element.properties.checkboxDisable! != 'true'>
<#assign showRowNumber = element.properties.showRowNumber! == 'true'>
<#assign importText = importLabels!{}>

<div class="form-cell full_width_field" ${elementMetaData!}>
    <#if !(request.getAttribute("com.monarch.shadow.lib.FormGridCustom")??) >
        <link rel="stylesheet" type="text/css" href="${request.contextPath}/plugin/com.monarch.shadow.lib.FormGridCustom/css/formGridStyle.css?v=${pluginVersion!'2.11.0'}" />
        <script type="text/javascript" src="${request.contextPath}/plugin/com.monarch.shadow.lib.FormGridCustom/js/jquery.formGridCustom.js?v=${pluginVersion!'2.11.0'}"></script>
        <script type="text/javascript" src="${request.contextPath}/plugin/com.monarch.shadow.lib.FormGridCustom/js/jquery.gridPagingCustom.js?v=${pluginVersion!'2.11.0'}"></script>
        <script type="text/javascript" src="${request.contextPath}/plugin/com.monarch.shadow.lib.FormGridCustom/js/jquery.formGridCustom.remake.js?v=${pluginVersion!'2.11.0'}"></script>
        <script type="text/javascript" src="${request.contextPath}/plugin/com.monarch.shadow.lib.FormGridCustom/js/jquery.formGridEditable.js?v=${pluginVersion!'2.11.0'}"></script>
        <script type="text/javascript" src="${request.contextPath}/plugin/com.monarch.shadow.lib.FormGridCustom/js/jquery.formGridNested.js?v=${pluginVersion!'2.11.0'}"></script>
        <script type="text/javascript" src="${request.contextPath}/plugin/com.monarch.shadow.lib.FormGridCustom/js/jquery.utils.js?v=${pluginVersion!'2.11.0'}"></script>
        <script type="text/javascript" src="${request.contextPath}/plugin/com.monarch.shadow.lib.FormGridCustom/js/formGridImport.js?v=${pluginVersion!'2.11.0'}"></script>
        <script type="text/javascript" src="${request.contextPath}/plugin/com.monarch.shadow.lib.FormGridCustom/js/jquery.formGridImport.js?v=${pluginVersion!'2.11.0'}"></script>
    </#if>
    <script type="text/javascript">
        $(document).ready(function() {
            var messages = {
                "form.formgrid.duplicateRow": "${(duplicateRowLabel!'Duplicate Row')?js_string}",
                "form.listgrid.addRows": "@@form.listgrid.addRows@@",
                "form.formgrid.addLabel": "${(addLabelMessage!'<i class="fas fa-plus"></i> Add')?js_string}",
                "form.formgrid.editRow": "@@form.formgrid.editRow@@",
                "form.formgrid.deleteRow": "@@form.formgrid.deleteRow@@",
                "form.formgrid.moveUp": "@@form.formgrid.moveUp@@",
                "form.formgrid.moveDown": "@@form.formgrid.moveDown@@",
                "form.formgrid.deleteMessage.value": "@@form.formgrid.deleteMessage.value@@",
                "form.formgrid.bulkDeleteMessage": "@@form.formgrid.bulkDeleteMessage@@"
            };

            var grid = $("#formgrid_${elementParamName!}_${element.properties.elementUniqueKey!}");
            grid.formGridCustom({messages: messages, options: ${optionsJson!}});
            grid.formGridCustom("initPopupDialog", {contextPath: '${request.contextPath}', title: '@@form.formgrid.addEntry@@' <#if requestParams??>, requestParams: ${requestParams}</#if>});

            grid.gridPagingCustom({customSize: '${element.properties.pageSize!}' <#if element.properties.enableSorting! == 'true'>, dataSorting: true</#if>});
            <#if nestedEnabled!false>
                setTimeout(function() {
                    grid.formGridNested({relations: JSON.parse(grid.children('.formgrid-nested-config').val()), readonly: ${(nestedReadonly!false)?c}});
                }, 0);
            </#if>
            <#if editableEnabled!false>
                grid.formGridEditable({columns: JSON.parse(grid.children('.formgrid-editable-columns').val())});
            </#if>
            <#if importEnabled!false>
                grid.formGridImport({
                    columns: JSON.parse(grid.children('.formgrid-import-columns').val()),
                    sortField: '<#if element.properties.enableSorting! == "true">${element.properties.sortField!?js_string}</#if>',
                    libraryUrl: '${request.contextPath}/plugin/com.monarch.shadow.lib.FormGridCustom/js/vendor/xlsx.full.min.js?v=${pluginVersion!"2.11.0"}'
                });
            </#if>
        });

        function formgrid_${elementParamName!}_${element.properties.elementUniqueKey!}_add(args){
            $("#formgrid_${elementParamName!}_${element.properties.elementUniqueKey!}").formGridCustom("addRow", args);
        }

        function formgrid_${elementParamName!}_${element.properties.elementUniqueKey!}_edit(args){
            $("#formgrid_${elementParamName!}_${element.properties.elementUniqueKey!}").formGridCustom("editRow", args);
        }
    </script>
    <label field-tooltip="${elementParamName!}" class="label">${element.properties.label!} <span class="form-cell-validator">${decoration}${customDecorator!}</span><#if error??> <span class="form-error-message">${error}</span></#if></label>
    <div class="form-clear"></div>
    <div id="formgrid_${elementParamName!}_${element.properties.elementUniqueKey!}" name="${elementParamName!}" class="grid formgrid formgrid-custom form-element <#if element.properties.readonly! == 'true'>readonly</#if> <#if element.properties.enableSorting! == 'true'>enableSorting</#if> <#if element.properties.disabledAdd! == 'true'>disabledAdd</#if> <#if element.properties.disabledDelete! == 'true'>disabledDelete</#if> <#if element.properties.disabledDuplicate! == 'true'>disabled-duplicate</#if>">
        <#if nestedEnabled!false>
            <input type="hidden" disabled="disabled" class="formgrid-nested-config" value="${nestedRelationsJson!?html}">
        </#if>
        <input type="hidden" disabled="disabled" class="formgrid-field-id" value="${element.properties.id!?html}">
        <input type="hidden" disabled="disabled" class="formgrid-form-id" value="${(effectiveFormDefId!element.properties.formDefId!'')?html}">
        <input type="hidden" disabled="disabled" class="formgrid-sort-field" value="${element.properties.sortField!?html}">
        <input type="hidden" disabled="disabled" id="formUrl" value="${request.contextPath}/web/app/${appId}/${appVersion}/form/embed?_submitButtonLabel=${buttonLabel!?html}">
        <input type="hidden" disabled="disabled" id="json" value="${json!}">
        <input type="hidden" disabled="disabled" id="appId" value="${appId!}">
        <input type="hidden" disabled="disabled" id="appVersion" value="${appVersion!}">
        <input type="hidden" disabled="disabled" id="contextPath" value="${request.contextPath}">
        <input type="hidden" disabled="disabled" id="height" value="${element.properties.height!}">
        <input type="hidden" disabled="disabled" id="width" value="${element.properties.width!}">
        <input type="hidden" disabled="disabled" class="uniqueKey" value="${element.properties.uniqueKey!}">
        <#if editableEnabled!false>
            <input type="hidden" disabled="disabled" class="formgrid-editable-columns" value="${editableColumnsJson!?html}">
        </#if>
        <input type="hidden" disabled="disabled" class="uniqueKeyMessage" value="${element.properties.uniqueKeyMessage!?html}">
        <input type="hidden" disabled="disabled" id="validateMaxRow" value="${element.properties.validateMaxRow!}">
        <input type="hidden" disabled="disabled" id="deleteMessage" value="${element.properties.deleteMessage!?html}">
        <input type="hidden" disabled="disabled" id="nonce" value="${nonceForm!?html}">
        <input type="hidden" disabled="disabled" class="formDefKeys" value="${formDefKeys!}">
        <input type="hidden" disabled="disabled" id="popupDuplicate" class="popupDuplicate" value="${element.properties.showPopupDuplicate!}">
        <#if importEnabled!false>
            <input type="hidden" disabled="disabled" class="formgrid-import-columns" value="${importColumnsJson!?html}">
        </#if>
        <#if showCheckbox>
            <button type="button" class="btn-icon delete_btn formgrid-custom-delete" id="${elementParamName!}_${element.properties.elementUniqueKey!}_delete" title="${(deleteSelectedRowsLabel!'Delete Selected Rows')?html}" aria-label="${(deleteSelectedRowsLabel!'Delete Selected Rows')?html}" style="display:none;"><i class="fas fa-trash" aria-hidden="true"></i></button>
        </#if>
        <div class="grid-validation-error form-error-message" role="alert" style="display:none;">
            <span class="error-content"></span>
        </div>
        <table cellspacing="0" class="tablesaw tablesaw-stack" data-tablesaw-mode="stack">
            <thead>
                <tr>
                    <#if showCheckbox>
                        <th class="grid-checkbox-header">
                            <input type="checkbox" id="${elementParamName!}_grid-checkbox-parent" class="grid-checkbox-parent" aria-label="@@form.formgrid.selectAllRows@@">
                        </th>
                    </#if>
                    <#if showRowNumber>
                        <th></th>
                    </#if>
                    <#list headers?keys as header>
                        <#assign visible = headers[header].visibility! != "no">
                        <#assign width = "">
                        <#if headers[header]['width']?? && headers[header]['width'] != "">
                            <#assign width = "width:" + headers[header]['width'] >
                        </#if>
                        <th id="${elementParamName!}_${header?html}" style="${width} <#if !visible>display:none;</#if>">${headers[header]['label']!}</th>
                    </#list>
                    <th class="grid-action-header"></th>
                </tr>
            </thead>
            <tbody>
                <tr id="grid-row-template" class="grid-row-template" style="display:none;">
                    <#if showCheckbox>
                        <td class="td-checkbox">
                            <input type="checkbox" class="grid-checkbox-children" aria-label="@@form.formgrid.selectRow@@">
                        </td>
                    </#if>
                    <#if showRowNumber>
                        <td><span class="grid-cell rowNumber"></span></td>
                    </#if>
                    <#list headers?keys as header>
                        <#assign visible = headers[header].visibility! != "no">
                        <td style="<#if !visible>display:none;</#if>"><span id="${elementParamName!}_${header?html}" name="${elementParamName!}_${header?html}" column_key="${header?html}" column_type="${headers[header]['formatType']!?html}" column_format="${headers[header]['format']!?html}" class="grid-cell"></span></td>
                    </#list>
                    <td style="display:none;"><textarea id="${elementParamName!}_jsonrow" name="${elementParamName!}_jsonrow"></textarea></td>
                </tr>
                <#list rows as row>
                    <tr class="grid-row" id="formgrid_${elementParamName!}_${element.properties.elementUniqueKey!}_row_${row_index}">
                        <#if showCheckbox>
                            <td class="td-checkbox">
                                <input type="checkbox" class="grid-checkbox-children" aria-label="@@form.formgrid.selectRow@@">
                            </td>
                        </#if>
                        <#if showRowNumber>
                            <td><span class="grid-cell rowNumber">${row_index + 1}</span></td>
                        </#if>
                        <#list headers?keys as header>
                            <#assign visible = headers[header].visibility! != "no">
                            <td style="<#if !visible>display:none;</#if>">
                                <span id="${elementParamName!}_${header?html}" name="${elementParamName!}_${header?html}" column_key="${header?html}" column_type="${headers[header]['formatType']!?html}" column_format="${headers[header]['format']!?html}" class="grid-cell">
                                    <#attempt>
                                        ${element.formatColumn(header, headers[header], row["id"], row[header], appId, appVersion, request.contextPath)}
                                    <#recover>
                                        ${row[header]!?html}
                                    </#attempt>
                                </span>
                            </td>
                        </#list>
                        <td style="display:none;">
                            <textarea id="${elementParamName!}_jsonrow" name="${elementParamName!}_jsonrow_${row_index}">${row['jsonrow']!?html}</textarea>
                        </td>
                    </tr>
                </#list>
            </tbody>
        </table>
        <p class="pg-navigator"></p>
        <#if element.properties.readonly! != 'true' && element.properties.disabledAdd! != 'true'>
            <button type="button" class="btn btn-primary grid-action-add text-decoration-none formgrid-custom-add" style="position:relative;bottom:0px;padding:6px 12px;height:fit-content;width:fit-content;opacity:1;">${addLabelMessage!'<i class="fas fa-plus"></i> Add'}</button>
        </#if>
        <#if importEnabled!false>
            <button type="button" class="btn btn-secondary formgrid-import-open" aria-expanded="false" aria-controls="${elementParamName!}_${element.properties.elementUniqueKey!}_import_panel"><i class="fas fa-file-import" aria-hidden="true"></i> ${(importText.open!'Import Excel / CSV')?html}</button>
            <div class="formgrid-import-panel" id="${elementParamName!}_${element.properties.elementUniqueKey!}_import_panel" role="region" aria-labelledby="${elementParamName!}_${element.properties.elementUniqueKey!}_import_title" hidden>
                <div class="formgrid-import-heading">
                    <div>
                        <h4 id="${elementParamName!}_${element.properties.elementUniqueKey!}_import_title">${(importText.settings!'Import Data')?html}</h4>
                        <p>${(importText.intro!'Choose a file, then review the rows before importing.')?html}</p>
                    </div>
                    <button type="button" class="btn btn-secondary formgrid-import-template"><i class="fas fa-download" aria-hidden="true"></i> ${(importText.template!'Download Excel Template')?html}</button>
                </div>
                <div class="formgrid-import-fields">
                    <label class="formgrid-import-file-label">
                        <span>${(importText.file!'Excel / CSV file')?html}</span>
                        <input type="file" class="formgrid-import-file" accept=".xlsx,.xls,.csv">
                        <small>${(importText.formats!'.xlsx, .xls or .csv. Maximum 10 MB.')?html}</small>
                    </label>
                    <label class="formgrid-import-sheet-label" hidden>
                        <span>${(importText.sheet!'Worksheet')?html}</span>
                        <select class="formgrid-import-sheet"></select>
                    </label>
                </div>
                <details class="formgrid-import-guidelines">
                    <summary>${(importText.guidelines!'File format and columns')?html}</summary>
                    <p>${(importText.help!'Use configured Field IDs or labels as headers. Leave File/Image cells empty. Imported rows are appended; save the form to persist them.')?html}</p>
                </details>
                <p class="formgrid-import-status" role="status" aria-live="polite"></p>
                <div class="formgrid-import-preview"></div>
                <div class="formgrid-import-pagination" role="group" aria-label="${(importText.pagination!'Import preview pagination')?html}" hidden>
                    <label class="formgrid-import-page-size-label">
                        <span>${(importText.rowsPerPage!'Rows per page')?html}</span>
                        <select class="formgrid-import-page-size">
                            <#list [10,20,30,40,50,60,70,80,90,100] as pageSize>
                                <option value="${pageSize?c}">${pageSize?c}</option>
                            </#list>
                        </select>
                    </label>
                    <span class="formgrid-import-page-info" role="status" aria-live="polite"></span>
                    <div class="formgrid-import-page-actions">
                        <button type="button" class="btn btn-secondary formgrid-import-previous" disabled>${(importText.previous!'Previous')?html}</button>
                        <button type="button" class="btn btn-secondary formgrid-import-next" disabled>${(importText.next!'Next')?html}</button>
                    </div>
                </div>
                <div class="formgrid-import-footer">
                    <button type="button" class="btn btn-secondary formgrid-import-cancel">${(importText.cancel!'Cancel')?html}</button>
                    <button type="button" class="btn btn-primary formgrid-import-confirm" disabled><i class="fas fa-file-import" aria-hidden="true"></i> ${(importText.confirm!'Import Rows')?html}</button>
                </div>
            </div>
        </#if>
    </div>
</div>
