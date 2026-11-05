<#assign showCheckbox = element.properties.disabledDelete! != 'true' && element.properties.readonly! != 'true' && element.properties.checkboxDisable! != 'true'>
<#assign showRowNumber = element.properties.showRowNumber! == 'true'>

<div class="form-cell full_width_field" ${elementMetaData!}>
    <#if !(request.getAttribute("com.monarch.shadow.lib.FormGridCustom")??) >
        <link rel="stylesheet" type="text/css" href="${request.contextPath}/plugin/com.monarch.shadow.lib.FormGridCustom/css/formGridStyle.css?v=${pluginVersion!'2.0.9'}" />
        <script type="text/javascript" src="${request.contextPath}/plugin/com.monarch.shadow.lib.FormGridCustom/js/jquery.formGridCustom.js?v=${pluginVersion!'2.0.9'}"></script>
        <script type="text/javascript" src="${request.contextPath}/plugin/com.monarch.shadow.lib.FormGridCustom/js/jquery.gridPagingCustom.js?v=${pluginVersion!'2.0.9'}"></script>
        <script type="text/javascript" src="${request.contextPath}/plugin/com.monarch.shadow.lib.FormGridCustom/js/jquery.formGridCustom.remake.js?v=${pluginVersion!'2.0.9'}"></script>
        <script type="text/javascript" src="${request.contextPath}/plugin/com.monarch.shadow.lib.FormGridCustom/js/jquery.utils.js?v=${pluginVersion!'2.0.9'}"></script>
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
        <input type="hidden" disabled="disabled" id="formUrl" value="${request.contextPath}/web/app/${appId}/${appVersion}/form/embed?_submitButtonLabel=${buttonLabel!?html}">
        <input type="hidden" disabled="disabled" id="json" value="${json!}">
        <input type="hidden" disabled="disabled" id="appId" value="${appId!}">
        <input type="hidden" disabled="disabled" id="appVersion" value="${appVersion!}">
        <input type="hidden" disabled="disabled" id="contextPath" value="${request.contextPath}">
        <input type="hidden" disabled="disabled" id="height" value="${element.properties.height!}">
        <input type="hidden" disabled="disabled" id="width" value="${element.properties.width!}">
        <input type="hidden" disabled="disabled" class="uniqueKey" value="${element.properties.uniqueKey!}">
        <input type="hidden" disabled="disabled" class="uniqueKeyMessage" value="${element.properties.uniqueKeyMessage!?html}">
        <input type="hidden" disabled="disabled" id="validateMaxRow" value="${element.properties.validateMaxRow!}">
        <input type="hidden" disabled="disabled" id="deleteMessage" value="${element.properties.deleteMessage!?html}">
        <input type="hidden" disabled="disabled" id="nonce" value="${nonceForm!?html}">
        <input type="hidden" disabled="disabled" class="formDefKeys" value="${formDefKeys!}">
        <input type="hidden" disabled="disabled" id="popupDuplicate" class="popupDuplicate" value="${element.properties.showPopupDuplicate!}">
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
    </div>
</div>
