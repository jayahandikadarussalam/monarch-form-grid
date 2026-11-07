(function( $ ){
    var contextPath;
    var messages;

    var methods = {

        init: function(args) {
            messages = args.messages;

            return this.each(function(){
                var thisObj = $(this);
                $(this).children("table").data("options", args.options);

                if (jQuery.browser && jQuery.browser.msie && jQuery.browser.version === '9.0'){
                    var table = $(this).children("table");
                    var expr = new RegExp('>[ \t\r\n\v\f]*<', 'g');
                    var response_html_fixed = table.html().replace(expr, '><'); //A disgusting hack for ie9. Removes space between open and close <td> tags
                    $(table).html(response_html_fixed.trim());
                }

                $(this).find(".grid-row").each(function(rowIndex, row) {
                    methods.decorateRow(row);
                    methods.updateRowIndex(row, rowIndex);
                });
                methods.disabledMoveAction($(this).children("table"));

                // Bind the server-rendered button, including builder previews.
                var addButton = thisObj.children(".formgrid-custom-add");
                if (!addButton.length && !thisObj.hasClass("readonly") && !thisObj.hasClass("disabledAdd")) {
                    addButton = $('<button type="button" class="btn btn-primary grid-action-add text-decoration-none formgrid-custom-add" style="position:relative;bottom:0px;padding:6px 12px;height:fit-content;width:fit-content;opacity:1;"></button>');
                    addButton.html(messages['form.formgrid.addLabel'] || '<i class="fas fa-plus"></i> Add');
                    thisObj.append(addButton);
                }
                addButton.off("click.formGridCustom").on("click.formGridCustom", function() {
                    methods.add.call(thisObj);
                });
                methods.showHidePlusIcon(this);

                methods.bindDeleteEvents(this);
            });
        },

        getFrameId: function(id) {
            return "formGridFrame_" + id;
        },

        initPopupDialog: function(args){
            contextPath = args.contextPath;

            var frameId = methods.getFrameId($(this).attr("id"));

            var width = $(this).find('#width').val();
            var height = $(this).find('#height').val();
            $(this).data('requestParams', args.requestParams);

            JPopup.create(frameId, "", width, height);
        },

        add: function() {
            return this.each(function(){
                methods.showHidePlusIcon(this);
                var addButton = $(this).children(".formgrid-custom-add");
                if (!addButton.length || addButton.prop("disabled")) {
                    return;
                }
                methods.popupForm.call(this, $(this).attr('id'), $(this).find('#formUrl').val(), $(this).find('#json').val(), $(this).find('#nonce').val(), $(this).attr('id')+"_add", "{}", "", $(this).find('#height').val(), $(this).find('#width').val());
            });
        },

        edit: function(){
            var row = $(this).closest("tr");
            var container = $(row).closest("table").parent();

            methods.popupForm.call(this, $(container).attr('id'), $(container).find('#formUrl').val(), $(container).find('#json').val(), $(container).find('#nonce').val(), $(container).attr('id')+"_edit", "{rowId:'"+$(row).attr('id')+"'}", $(row).find('textarea:not(.formgrid-editor)').val(), $(container).find('#height').val(), $(container).find('#width').val());
        },

        duplicate: function() {
            var row = $(this).closest("tr");
            var container = $(row).closest("table").parent();

            var funcName = $(container).attr('id')+"_duplicate";

            // Cek jika fungsi ada di global scope (window)
            if (typeof window[funcName] === 'function') {
                window[funcName].call(this); // panggil fungsi dengan konteks elemen
            } else {
                console.warn('Function', funcName, 'not found.');
            }
        },

        popupForm: function(id, url, json, nonce, callback, setting, value, height, width){
            if (value != undefined && value != '') {
                var datas = eval("(" + value + ")");
                if (datas.id) {
                    if (url.indexOf("?") != -1) {
                        url += "&";
                    } else {
                        url += "?";
                    }
                    url += "id=" + datas.id;
                }
            }

            if (url.indexOf("?") === -1) {
                url += "?";
            }
            url += UI.userviewThemeParams();
            if ($(this).data('requestParams') != undefined) {
                var params = FormUtil.getFieldsAsUrlQueryString($(this).data('requestParams'), $(this).closest("div.subform-container"));

                if (params !== "") {
                    url += "&" + params;
                }
            }

            var params = {
                _json : json,
                _callback : callback,
                _setting : setting,
                _jsonFormData : value,
                _nonce : nonce
            };

            var frameId = methods.getFrameId(id);
            JPopup.show(frameId, url, params, "", width, height);
        },

        duplicateRow: function(args){
            return $(this).each(function() {
                var row = $(this).closest("tr");
                var container = $(row).closest("table").parent();
                methods.showHidePlusIcon(container);
                if ($(container).hasClass('readonly') || $(container).hasClass('disabledAdd') ||
                        $(container).children('.formgrid-custom-add').prop('disabled')) return;

                // 1. AMBIL VALUE DARI ID YANG ADA DI FTL
                var showPopup = $(container).find('.popupDuplicate').val();
                var uniqueKey = $(container).find('.uniqueKey').val();

                // Ambil isi JSON dari textarea dalam row
                var json = $(row).find("textarea:not(.formgrid-editor)").val();
                if (!json) {
                    return;
                }

                var parsed;
                try {
                    parsed = JSON.parse(json);
                    parsed.id = monarchUtils.generateUUID(); // Generate ID baru
                } catch (e) {
                    console.error("JSON not valid:", e);
                    return;
                }

                // Bersihkan temp params
                if (parsed._tempRequestParamsMap && parsed._tempRequestParamsMap.id) {
                    delete parsed._tempRequestParamsMap.id;
                }

                // Handle unique key (tambah suffix agar tidak bentrok sementara)
                if (uniqueKey && parsed[uniqueKey]) {
                    parsed[uniqueKey] += "_copy_" + Math.floor(Math.random() * 1000);
                }

                var resultJson = JSON.stringify(parsed);

                // Nested relations choose their own mode. Ordinary grids retain their popup/unique-key settings.
                var usePopup = args && typeof args.forcePopup === 'boolean' ? args.forcePopup :
                    showPopup === 'true' || (uniqueKey && uniqueKey !== '');
                if (usePopup) {
                    // === MODE PAKAI POPUP ===
                    methods.popupForm.call(this,
                        $(container).attr('id'),
                        $(container).find('#formUrl').val(),
                        $(container).find('#json').val(),
                        $(container).find('#nonce').val(),
                        (args && args.callback) || $(container).attr('id') + "_add",
                        "{}",
                        resultJson,                        // data row lama sebagai pre-filled value
                        $(container).find('#height').val(),
                        $(container).find('#width').val()
                    );
                } else {
                    // === MODE LANGSUNG DUPLIKAT (TANPA POPUP) ===
                    var duplicateArgs = { result: resultJson };

                    // Cek duplikat di client side dulu
                    if (!methods.checkDuplicate(container, duplicateArgs)) {
                        return;
                    }

                    var table = $(container).find("> table");
                    var template = $(table).find(".grid-row-template");
                    var newRow = $(template).clone();

                    newRow.removeClass("grid-row-template");
                    newRow.css("display", "");
                    newRow.addClass("grid-row");

                    // Uncheck checkbox row baru
                    newRow.find(".grid-checkbox-children").prop("checked", false);

                    // Isi value & Decorate
                    methods.decorateRow(newRow);
                    methods.fillValue(container, newRow, resultJson);

                    // Insert setelah row yang diduplikasi
                    $(row).after(newRow);

                    // Update Index
                    methods.updateAllRowIndex(table);
                    methods.disabledMoveAction($(newRow).closest("table"));

                    // Trigger Change
                    $(container).trigger("change");
                    methods.showHidePlusIcon(container);
                }
            });
        },

        addRow: function(args){
            return $(this).each(function(){
                var frameId = methods.getFrameId($(this).attr('id'));

                if (methods.checkDuplicate(this, args) && !$(this).hasClass("readonly")) {
                    // get table
                    var table = $(this).find("> table");

                    // clone template
                    var template = $(table).find(".grid-row-template");
                    var newRow = $(template).clone();
                    newRow.removeClass("grid-row-template");
                    newRow.css('display','');
                    newRow.addClass("grid-row");

                    //Uncheck new row
                    newRow.find(".grid-checkbox-children").prop("checked", false);

                    methods.decorateRow(newRow);
                    methods.fillValue(this, newRow, args.result);

                    // append row
                    table.append(newRow);

                    // set input names and values
                    var rowIndex = $(table).find("tr.grid-row").length-1;
                    methods.updateRowIndex(newRow, rowIndex);
                    methods.disabledMoveAction($(newRow).closest("table"));

                    JPopup.hide(frameId);

                    // trigger change
                    $(this).trigger("change");
                    methods.showHidePlusIcon(this);
                } else {
                    JPopup.hide(frameId);
                }
            });
        },

        editRow: function(args){
            return $(this).each(function(){
                var frameId = methods.getFrameId($(this).attr('id'));

                if (methods.checkDuplicate(this, args) && !$(this).hasClass("readonly")) {
                    // get table
                    var table = $(this).children("table");
                    var row = $(table).find("#"+args.rowId);

                    methods.fillValue(this, row, args.result);
                    methods.updateAllRowIndex(table);
                    methods.disabledMoveAction(table);
                    JPopup.hide(frameId);

                    // trigger change
                    $(this).trigger("change");
                } else {
                    JPopup.hide(frameId);
                }
            });
        },

        checkDuplicate : function (container, args) {
            var okToInsert = true;

            // 1. Ambil Konfigurasi
            var uniqueKey = $(container).find('.uniqueKey').val();
            var customMsgTemplate = $(container).find('.uniqueKeyMessage').val();

            // Setup UI Error
            var $errorBox = $(container).find(".grid-validation-error");
            var $errorContent = $errorBox.find(".error-content");
            $errorBox.hide();

            if (uniqueKey && uniqueKey != null && args.result) {
                // Parse Data Baru
                var obj;
                try { obj = JSON.parse(args.result); } catch(e){ return false; }

                var uniqueVal = $.isArray(obj) ? obj[0][uniqueKey] : obj[uniqueKey];

                if (uniqueVal) {
                    // Loop Cek Data Existing
                    $(container).find(".grid-cell[column_key='" + uniqueKey + "']").each(function() {

                        // Skip row diri sendiri saat edit
                        if (args.rowId && $(this).closest("tr").attr("id") == args.rowId) return true;

                        // Cek Kesamaan (Case Insensitive)
                        var storedValue = $(this).text();
                        try {
                            storedValue = JSON.parse($(this).closest("tr").find("textarea:not(.formgrid-editor)").first().val())[uniqueKey];
                        } catch (e) {}
                        if ($.trim(String(storedValue == null ? "" : storedValue)).toLowerCase() == String(uniqueVal).toLowerCase()) {
                            okToInsert = false;

                            // === LOGIC GANTI MESSAGE {column} ===
                            var finalMsg = "";

                            // Cari Label Kolom dari Header Tabel (TH)
                            // Biasanya ID header formatnya: namaGrid_namaKolom
                            // Kita cari TH yang ID-nya berakhiran nama kolom
                            var colLabel = uniqueKey; // Default pake ID kalo label ga ketemu
                            var $header = $(container).find("th[id$='_" + uniqueKey + "']");

                            if ($header.length > 0) {
                                // Ambil teks header tapi buang spasi aneh2
                                colLabel = $.trim($header.text());
                            }

                            if (customMsgTemplate) {
                                // Replace {column} dengan Label (misal: "Nomor KTP")
                                finalMsg = customMsgTemplate.replace(/{column}/g, colLabel);
                                // Bonus: Replace {value} dengan Nilai (misal: "320123...")
                                finalMsg = finalMsg.replace(/{value}/g, uniqueVal);
                            } else {
                                // Default Message jika user kosongin properti
                                finalMsg = colLabel + " column must have a unique value: " + uniqueVal;
                            }

                            // Tampilkan Error
                            $errorContent.text(finalMsg);
                            $errorBox.slideDown();

                            $('html, body').animate({
                                scrollTop: $errorBox.offset().top - 100
                            }, 500);

                            return false; // Break loop
                        }
                    })
                }
            }
            if (!okToInsert) $(container).triggerHandler('formgrid:validationerror');
            return okToInsert;
        },

        showHidePlusIcon : function (container) {
            var grid = $(container);
            var maxRows = parseInt(grid.find('#validateMaxRow').val(), 10);
            var rowCount = grid.find("tr.grid-row:not(.grid-row-template)").length;
            var canAdd = !grid.hasClass("readonly") && !grid.hasClass("disabledAdd")
                && (isNaN(maxRows) || rowCount < maxRows);

            grid.children(".formgrid-custom-add").prop("disabled", !canAdd).toggle(canAdd);
        },
        deleteRow: function(args) {
            var row = $(this).closest("tr");
            var table = $(row).closest("table");
            var container = $(table).parent();
            var deleteMessage = $(container).find('#deleteMessage').val();

            var beforeDelete = $.Event('formgrid:beforedelete');
            container.triggerHandler(beforeDelete, [row]);
            if (beforeDelete.isDefaultPrevented()) return;

            if (deleteMessage == "") {
                deleteMessage = messages['form.formgrid.deleteMessage.value'];
            }

            //If args is true, it means the function is fired due to bulk deletion
            if (args === true || confirm(deleteMessage)) {
                row.remove();

                // reset input names
                methods.updateAllRowIndex(table);
                methods.disabledMoveAction(table);

                // trigger change
                var el = table.parent();
                $(el).trigger("change");
                methods.showHidePlusIcon(el);
            }
        },

        moveRowUp: function() {
            var currentRow = $(this).closest("tr.grid-row");
            var container = currentRow.closest(".formgrid-custom");
            var previousRow = currentRow.prevAll("tr.grid-row").first();
            if ($(this).prop("disabled") || !container.hasClass("enableSorting") || container.hasClass("readonly") || !previousRow.length) {
                return;
            }
            currentRow.insertBefore(previousRow);
            methods.refreshIndex.call(container);
            container.trigger("change");
        },

        moveRowDown: function() {
            var currentRow = $(this).closest("tr.grid-row");
            var container = currentRow.closest(".formgrid-custom");
            var nextRow = currentRow.nextAll("tr.grid-row").first();
            if ($(this).prop("disabled") || !container.hasClass("enableSorting") || container.hasClass("readonly") || !nextRow.length) {
                return;
            }
            currentRow.insertAfter(nextRow);
            methods.refreshIndex.call(container);
            container.trigger("change");
        },

        disabledMoveAction: function(table) {
            var container = $(table).closest(".formgrid-custom");
            var canSort = container.hasClass("enableSorting") && !container.hasClass("readonly");
            var rows = $(table).find("tr.grid-row");
            rows.each(function(index) {
                $(this).find(".grid-action-moveup")
                    .prop("disabled", !canSort || index === 0)
                    .toggleClass("disabled", !canSort || index === 0);
                $(this).find(".grid-action-movedown")
                    .prop("disabled", !canSort || index === rows.length - 1)
                    .toggleClass("disabled", !canSort || index === rows.length - 1);
            });
        },

        createAction: function(className, icon, label, handler) {
            return $('<button type="button" class="btn-icon grid-row-action"></button>')
                .addClass(className)
                .attr({title: label, "aria-label": label})
                .append($('<i aria-hidden="true"></i>').addClass("fas " + icon))
                .on("click.formGridCustom", function() {
                    if (!this.disabled) {
                        handler.call(this);
                    }
                });
        },

        decorateRow: function(row) {
            // The same action factory is used by nested subgrids.
            var action = methods.createAction;

            var reorder = $('<div class="grid-reorder-buttons"></div>')
                .append(action("grid-action-moveup", "fa-arrow-up", messages['form.formgrid.moveUp'], methods.moveRowUp))
                .append(action("grid-action-movedown", "fa-arrow-down", messages['form.formgrid.moveDown'], methods.moveRowDown));
            var editActions = $('<div class="grid-edit-buttons"></div>')
                .append(action("grid-action-edit", "fa-pen", messages['form.formgrid.editRow'], methods.edit))
                .append(action("grid-action-duplicate", "fa-copy", messages['form.formgrid.duplicateRow'], methods.duplicateRow))
                .append(action("grid-action-delete", "fa-trash", messages['form.formgrid.deleteRow'], methods.deleteRow));
            var toolbar = $('<div class="grid-row-actions"></div>').append(reorder, editActions);

            $(row).children(".grid-action-cell").remove();
            $(row).append($('<td class="grid-action-cell"></td>').append(toolbar));
        },

        fillValue: function(element, row, json) {
            var obj = eval("["+json+"]");
            $(row).find('span.grid-cell').each(function(){
                var column = $(this).attr("column_key");
                var type = $(this).attr("column_type");
                var format = $(this).attr("column_format");
                if (type != undefined && type == "html") {
                    $(this).html(obj[0][column]);
                } else if (type != undefined && type == "nl2br") {
                    $(this).html(UI.escapeHTML(obj[0][column]).replace(/(?:\r\n|\r|\n)/g, '<br />'));
                } else if (type != undefined && (type == "file" || type == "image") && format != undefined && format != "" && value != "") {
                    try{
                        var formDefId = format;
                        var recordId = obj[0]["id"];
                        var displayValue = "";
                        var values = obj[0][column].split(";");
                        var temp = [];
                        if (obj[0]["_tempFilePathMap"] !== undefined && obj[0]["_tempFilePathMap"] !== null && obj[0]["_tempFilePathMap"][column] !== undefined) {
                            temp = obj[0]["_tempFilePathMap"][column];
                        }
                        for (var v in values) {
                            var tempValue = values[v];
                            var tempFile = false;
                            if (temp.length > 0) {
                                for (var tf in temp) {
                                    if (temp[tf].indexOf("/" + tempValue, this.length - tempValue.length - 1) !== -1 || temp[tf].indexOf("\\" + tempValue, this.length - tempValue.length - 1) !== -1) {
                                        tempFile = true;
                                        break;
                                    }
                                }
                            }

                            if (recordId != undefined && recordId != "" && !tempFile && tempValue !== "") {
                                var appId = $(element).find('#appId').val();
                                var appVersion = $(element).find('#appVersion').val();
                                var contextPath = $(element).find('#contextPath').val();
                                var filePath = contextPath + "/web/client/app/" + appId + "/" + appVersion + "/form/download/" + formDefId + "/" + recordId + "/" + tempValue;
                                if (type == "image") {
                                    var imgfilePath = filePath + ".thumb.jpg.";
                                    filePath += ".";
                                    displayValue += "<a href=\""+filePath+"\" target=\"_blank\" ><img src=\""+imgfilePath+"\"/></a> ";
                                } else {
                                    filePath += ".?attachment=true";
                                    displayValue += "<a href=\""+filePath+"\" target=\"_blank\" >"+tempValue+"</a> ";
                                }
                            } else {
                                displayValue += tempValue + " ";
                            }
                        }
                        $(this).html(displayValue);
                    }catch(e){
                        $(this).text(value);
                    }
                } else {
                    var value = obj[0][column];
                    if (obj[0]["_decryptedDataMap"] !== undefined && obj[0]["_decryptedDataMap"][column] !== undefined) {
                        value = obj[0]["_decryptedDataMap"][column];
                    }
                    if (value === undefined) {
                        value = "";
                    }
                    if (type != undefined && type == "decimal" && format != undefined && format != ""  && (!isNaN(value) || value == "")) {
                        try{
                            if (value == "") {
                                value = "0";
                            }
                            value = parseFloat(value);
                            value = value.toFixed(parseInt(format));
                        }catch(e){}
                    } else if (type != undefined && type === "currency" && value !== "") {
                          try {
                              var pattern = format || "#,###.##"; // default pattern
                              var num = parseFloat(String(value).replace(/[^\d\.\-]/g, "")) || 0;

                              // deteksi prefix dan suffix
                              var prefix = "";
                              var suffix = "";
                              var numberPattern = pattern;

                              if (pattern.includes("|")) {
                                  var parts = pattern.split("|");
                                  if (pattern.indexOf("|") === 0) {
                                      // contoh: "|#.###,##USD" → suffix
                                      numberPattern = parts[1];
                                      suffix = parts[0].replace("|", "");
                                  } else if (pattern.endsWith("|")) {
                                      // contoh: "Rp|" → prefix saja
                                      prefix = parts[0];
                                  } else {
                                      // contoh: "Rp|#.###,##" atau "#.###,##|USD"
                                      if (parts[0].match(/[#0.,]/)) {
                                          numberPattern = parts[0];
                                          suffix = parts[1];
                                      } else {
                                          prefix = parts[0];
                                          numberPattern = parts[1];
                                      }
                                  }
                              }

                              // === deteksi pemisah ribuan & desimal (lebih akurat) ===
                              var useEuropeanFormat = numberPattern.indexOf('.') < numberPattern.indexOf(',') && numberPattern.indexOf(',') !== -1;
                              var thousandSep = useEuropeanFormat ? '.' : ',';
                              var decimalSep = useEuropeanFormat ? ',' : '.';

                              // === hitung jumlah digit desimal dengan benar ===
                              var decimalIndex = Math.max(numberPattern.lastIndexOf('.'), numberPattern.lastIndexOf(','));
                              var decimalPlaces = 0;
                              if (decimalIndex !== -1 && decimalIndex < numberPattern.length - 1) {
                                  var decimalPart = numberPattern.substring(decimalIndex + 1);
                                  decimalPlaces = decimalPart.replace(/[^#0]/g, '').length;
                              }

                              // pembulatan angka sesuai decimalPlaces
                              var fixed = num.toFixed(decimalPlaces);
                              var parts = fixed.split('.');
                              var intPart = parts[0];
                              var decPart = parts[1] || "";

                              // tambahkan thousand separator
                              var rgx = /(\d+)(\d{3})/;
                              while (rgx.test(intPart)) {
                                  intPart = intPart.replace(rgx, '$1' + thousandSep + '$2');
                              }

                              // gabungkan integer dan decimal
                              var formatted = intPart;
                              if (decimalPlaces > 0 && decPart !== "") {
                                  formatted += decimalSep + decPart;
                              }

                              // gabungkan prefix & suffix
                              value = (prefix ? prefix + " " : "") + formatted + (suffix ? " " + suffix : "");

                          } catch (e) {
                              console.error("Format currency error:", e, value);
                          }
                    } else if (type != undefined && type == "date" && format != undefined && format != "" && value != "") {
                        try{
                            if (format.indexOf("UTC") === 0) {
                                var dateFormat = format.split('|');
                                if (dateFormat.length === 4) {
                                    var d=new Date(value + " UTC");
                                    if (column === "dateCreated" || column === "dateModified") {
                                        d = new Date(d.getTime() + (d.getTimezoneOffset() * 60000) + (dateFormat[2] * 1) - (dateFormat[3] * 1));
                                    } else {
                                        d = new Date(d.getTime() + (d.getTimezoneOffset() * 60000) + (dateFormat[2] * 1));
                                    }
                                    value = formatDate(d ,methods.getDateFormat(dateFormat[1]));
                                }
                            } else {
                                var dateFormat = format.split('|');
                                if (dateFormat.length === 2) {
                                    var d = new Date(getDateFromFormat(value, methods.getDateFormat(dateFormat[0])));
                                    value = formatDate(d ,methods.getDateFormat(dateFormat[1]));
                                }
                            }
                        }catch(e){}
                    } else if (type != undefined && type == "options" && format != undefined && format != "" && value != "") {
                        try {
                            var options = $(element).children("table").data("options");
                            var values = value.split(";");
                            var temp = [];
                            if (options[column]['OPTIONS_AJAX_BINDER_DATA'] !== undefined) {
                                var co = options[column];
                                var ajaxOptions = co['OPTIONS'];
                                if ($.type(ajaxOptions) === "string") {
                                    ajaxOptions = {};
                                    var tempOpts = eval(co['OPTIONS']);
                                    for (var t in tempOpts) {
                                        ajaxOptions[tempOpts[t].value] = tempOpts[t].label;
                                    }
                                }
                                if (ajaxOptions[values[0]] !== undefined) {
                                    for (var v in values) {
                                        if (ajaxOptions[values[v]] !== undefined) {
                                            temp.push(ajaxOptions[values[v]]);
                                        } else {
                                            temp.push(values[v]);
                                        }
                                    }
                                } else {
                                    var elCell = this;
                                    var contextPath = $(element).find("#contextPath").val();
                                    var cv = obj[0][co['OPTIONS_AJAX_CONTROL_FIELD']];

                                    $.getJSON(contextPath + "/web/json/app/"+co['OPTIONS_AJAX_APP_ID']+"/"+co['OPTIONS_AJAX_APP_VERSION']+"/form/options",
                                        {
                                            _dv: cv,
                                            _n: co['OPTIONS_AJAX_NONCE'],
                                            _bd: co['OPTIONS_AJAX_BINDER_DATA']
                                        },
                                        function(data){
                                            for (var i=0, len=data.length; i < len; i++) {
                                                ajaxOptions[data[i].value] = data[i].label.trim();
                                            }

                                            for (var v in values) {
                                                if (ajaxOptions[values[v]] !== undefined) {
                                                    temp.push(ajaxOptions[values[v]]);
                                                } else {
                                                    temp.push(values[v]);
                                                }
                                            }

                                            $(element).children("table").data("options", options);

                                            value = temp.join(", ");

                                            $(elCell).text(value);
                                        }
                                    );
                                }
                            } else {
                                for (var v in values) {
                                    if (options[column] !== undefined && options[column][values[v]] !== undefined) {
                                        temp.push(options[column][values[v]]);
                                    } else {
                                        temp.push(values[v]);
                                    }
                                }
                            }
                            value = temp.join(", ");
                        } catch (e) {
                        }
                    }

                    //prevent unicode character double escaped
                    value = UI.escapeHTML(value);
                    value = value.replace(/&amp;([#0-9a-zA-Z]+;)/g, "&$1");

                    $(this).html(value);
                }
            });
            $(row).find('textarea:not(.formgrid-editor)').each(function(){
                $(this).val(json);
            });
            $(element).triggerHandler('formgrid:rowupdated', [row]);
        },

        getDateFormat: function(format) {
            if (format.indexOf("MMMMM") !== -1) {
                format = format.replace("MMMMM", "MMM");
            } else if (format.indexOf("MMM") !== -1) {
                format = format.replace("MMM", "NNN");
            }
            return format;
        },

        updateRowIndex: function(row, rowIndex){
            var id = $(row).closest("table").parent().attr('id');

            $(row).attr("id", id+"_row_"+rowIndex);
            $(row).find("textarea:not(.formgrid-editor)").each(function(){
                $(this).attr("name", $(this).attr("id")+"_"+rowIndex);
            });

            $(row).find("span.grid-cell.rowNumber").text(rowIndex + 1);

            //update row even/odd css class
            $(row).removeClass("odd");
            $(row).removeClass("even");
            if(rowIndex % 2 === 0){
                $(row).addClass("even");
            }else{
                $(row).addClass("odd");
            }
        },

        updateAllRowIndex: function(table) {
            $(table).find(".grid-row").each(function(rowIndex, row) {
                methods.updateRowIndex(row, rowIndex);
            });
        },

        refreshIndex: function() {
            return this.each(function(){
                var thisObj = $(this);
                var table = thisObj.children("table");

                methods.updateAllRowIndex(table);
                methods.disabledMoveAction(table);
            });
        },

        bindDeleteEvents : function (container) {
            if ($(container).hasClass("readonly") || $(container).hasClass("disabledDelete")) {
                return;
            }

            //initialize the selected rows
            $(container).data("selected_rows", []);

            //handle toggle all rows (parent checkbox)
            $(container).find(".grid-checkbox-parent").off('change').on('change', function(){
                var isChecked = $(this).is(":checked");

                var checkboxes = $(container).find(".grid-row .grid-checkbox-children").filter(function() {
                    // 1. Cek Native Property 'disabled'
                    if (this.disabled) return false;

                    // 2. Cek apakah ini row template? (Jangan diambil)
                    var row = $(this).closest("tr.grid-row");
                    if (row.hasClass("grid-row-template")) return false;

                    // 3. Cek apakah row ini sedang di-hide oleh filter logic? (Jangan diambil)
                    if (row.hasClass("fg-hidden")) return false;

                    // Jika lolos semua filter, kembalikan true (elemen ini akan dicentang)
                    return true;
                });

                // set checked tanpa trigger event
                checkboxes.prop('checked', isChecked);

                // update selected_rows secara langsung
                var arr = [];
                if (isChecked) {
                    checkboxes.each(function(){
                        arr.push($(this).closest("td")[0]);
                    });
                }
                $(container).data("selected_rows", arr);

                // tampilkan/hilangkan delete button sekali saja
                if (arr.length > 0) {
                    $(container).find(".delete_btn").show();
                } else {
                    $(container).find(".delete_btn").hide();
                }
            });

            //handle bulk delete button clicked
            $(container).find(".delete_btn").off('click').on('click',function(){
                var deleteMessage = messages['form.formgrid.bulkDeleteMessage'];

                if (confirm(deleteMessage)) {
                    var arr = $(container).data("selected_rows");

                    arr.forEach(element => {
                        $(element).formGridCustom("deleteRow", true);
                    });

                    $(container).find(".grid-checkbox-parent").prop('checked', false);
                    //Resets array
                    $(container).data("selected_rows", []);
                }

                //Change delete button display to none
                if($(container).data("selected_rows").length === 0 && $(container).find(".delete_btn").is(':visible')){
                    $(container).find(".delete_btn").hide();
                }
                return false;
            });

            //handle checkboxes of each row (children)
            $(container).off('change.grid-row', ".grid-row .grid-checkbox-children")
                .on('change.grid-row', ".grid-row .grid-checkbox-children", function(){
                    if ($(this).is(":disabled")) return; // abaikan child yg disable

                    var td = $(this).closest("td")[0];
                    var arr = $(container).data("selected_rows");
                    var index = arr.indexOf(td);

                    if ($(td).closest("tr").hasClass("grid-row") && index === -1 && $(this).is(":checked")) {
                        arr.push(td);  //element is checked but not exist in selected rows
                    } else if (!$(this).is(":checked") && index !== -1){
                        arr.splice(index, 1); //element is not checked but exist in selected rows
                    }

                    if (arr.length > 0 && !$(container).find(".delete_btn").is(':visible')){
                        $(container).find(".delete_btn").show();
                    } else if(arr.length === 0 && $(container).find(".delete_btn").is(':visible')){
                        $(container).find(".delete_btn").hide();
                    }

                    // === update parent state otomatis ===
                    var total = $(container).find(".grid-row .grid-checkbox-children:not(:disabled)").length;
                    var checked = $(container).find(".grid-row .grid-checkbox-children:not(:disabled):checked").length;

                    if (checked === total && total > 0) {
                        $(container).find(".grid-checkbox-parent").prop('checked', true);
                    } else {
                        $(container).find(".grid-checkbox-parent").prop('checked', false);
                    }
                });
        }
    };

    $.formGridCustom = {
        createAction: methods.createAction,
        fillValue: methods.fillValue,
        updateRowIndex: methods.updateRowIndex,
        disabledMoveAction: methods.disabledMoveAction,
        showHidePlusIcon: methods.showHidePlusIcon,
        decorateRow: methods.decorateRow
    };

    $.fn.formGridCustom = function( method ) {
        if ( methods[method] ) {
            return methods[method].apply( this, Array.prototype.slice.call( arguments, 1 ));
        } else if ( typeof method === 'object' || ! method ) {
            return methods.init.apply( this, arguments );
        } else {
            $.error( 'Method ' +  method + ' does not exist on jQuery.formgrid' );
        }

    };

})( jQuery );
