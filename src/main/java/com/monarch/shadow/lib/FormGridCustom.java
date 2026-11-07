package com.monarch.shadow.lib;

import com.monarch.shadow.utils.Utils;
import org.apache.commons.lang3.StringEscapeUtils;
import org.joget.apps.app.dao.DatalistDefinitionDao;
import org.joget.apps.app.dao.FormDefinitionDao;
import org.joget.apps.app.model.AppDefinition;
import org.joget.apps.app.service.AppService;
import org.joget.apps.form.service.FileUtil;
import org.joget.apps.app.model.DatalistDefinition;
import org.joget.apps.app.model.FormDefinition;
import org.joget.apps.app.service.AppPluginUtil;
import org.joget.apps.app.service.AppUtil;
import org.joget.apps.datalist.model.DataList;
import org.joget.apps.datalist.model.DataListBinder;
import org.joget.apps.datalist.model.DataListCollection;
import org.joget.apps.datalist.model.DataListFilterQueryObject;
import org.joget.apps.datalist.service.DataListService;
import org.joget.apps.form.lib.Grid;
import org.joget.apps.form.model.*;
import org.joget.apps.form.service.FormService;
import org.joget.apps.form.service.FormUtil;
import org.joget.apps.userview.model.PwaOfflineReadonly;
import org.joget.apps.userview.model.PwaOfflineResources;
import org.joget.commons.util.*;
import org.joget.workflow.model.WorkflowAssignment;
import org.joget.workflow.model.service.WorkflowManager;
import org.joget.workflow.util.WorkflowUtil;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.File;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.text.DateFormat;
import java.text.DecimalFormat;
import java.text.NumberFormat;
import java.text.SimpleDateFormat;
import java.util.*;

public class FormGridCustom extends Element implements FormBuilderPaletteElement, FormContainer, GridInnerDataRetriever, PwaOfflineResources, PwaOfflineReadonly {
    private static final String MESSAGE_PATH = "messages/FormGridCustom";
    private static final String VERSION = "2.3.0";

    protected Map<FormData, FormRowSet> cachedRowSet = new HashMap<>();
    protected Map<String, FormData> formDatas = new HashMap<>();
    protected Map<String, String> optionFormsJson = new HashMap<>();

    protected Map<String, Map<String, Object>> headerMap;
    protected Map<String, Map<String, String>> optionsMap;

    protected Form form;
    protected FormData formData;
    protected String formDefKeys;

    private final Utils utils = new Utils();

    @Override
    public String renderTemplate(FormData formData, Map dataModel) {
        this.formData = formData;
        dataModel.put("pluginVersion", getVersion());

        // Template Form Grid
        String template = "FormGridCustom.ftl";

        String decoration = FormUtil.getElementValidatorDecoration(this, formData);
        dataModel.put("decoration", decoration);

        Map<String, Map<String, Object>> headers = getHeaderMap(formData);
        dataModel.put("headers", headers);

        String optionsJson = this.getOptionsJson(headers, formData);
        dataModel.put("optionsJson", optionsJson);

        dataModel.put("rows", getRows(formData));

        String buttonLabel = "";
        if ("true".equals(getPropertyString("readonly"))) {
            buttonLabel = getPropertyString("submit-label-readonly");
            if (buttonLabel.isEmpty())
                buttonLabel = "Close";
        } else {
            buttonLabel = getPropertyString("submit-label-normal");
            if (buttonLabel.isEmpty())
                buttonLabel = "Submit";
        }
        dataModel.put("buttonLabel", buttonLabel);
        dataModel.put("addLabelMessage", getAddLabelMessage());
        dataModel.put("deleteSelectedRowsLabel", AppPluginUtil.getMessage("form.formgrid.deleteSelectedRows", getClassName(), MESSAGE_PATH));
        dataModel.put("duplicateRowLabel", AppPluginUtil.getMessage("form.formgrid.duplicateRow", getClassName(), MESSAGE_PATH));

        String json = getSelectedFormJson();
        dataModel.put("json", json);
        boolean editable = "true".equals(getPropertyString("editable")) && !FormUtil.isReadonly(this, formData);
        dataModel.put("editableEnabled", editable);
        if (editable) {
            dataModel.put("editableColumnsJson", getEditableColumnsJson(headers, formData));
        }
        boolean importEnabled = "true".equals(getPropertyString("enableImport"))
                && !FormUtil.isReadonly(this, formData)
                && !"true".equals(getPropertyString("disabledAdd"));
        dataModel.put("importEnabled", importEnabled);
        if (importEnabled) {
            dataModel.put("importColumnsJson", getImportColumnsJson(headers, formData));
            dataModel.put("importLabels", getImportLabels());
        }

        if (!FormUtil.isReadonly(this, formData)) {
            dataModel.put("customDecorator", getDecorator());
        }

        AppDefinition appDef = AppUtil.getCurrentAppDefinition();
        dataModel.put("appId", appDef.getAppId());
        dataModel.put("appVersion", appDef.getVersion());

        Object requestParamsProperty = getProperty("requestParams");
        if (requestParamsProperty instanceof Object[]) {
            StringBuilder requestJson = new StringBuilder("[");

            for (Object param : (Object[]) requestParamsProperty) {
                @SuppressWarnings("unchecked")
                Map<String, Object> paramMap = (Map<String, Object>) param;

                if (requestJson.length() > 1)
                    requestJson.append(",");

                requestJson.append("{");
                requestJson.append("\"param\":\"").append(utils.escapeJson(paramMap.get("param"))).append("\",");
                requestJson.append("\"field\":\"").append(utils.escapeJson(paramMap.get("field"))).append("\",");
                requestJson.append("\"defaultValue\":\"").append(utils.escapeJson(paramMap.get("defaultValue"))).append("\"");
                requestJson.append("}");
            }
            requestJson.append("]");

            if (requestJson.length() > 2)
                dataModel.put("requestParams", requestJson.toString());
        }

        String nonceForm = SecurityUtil.generateNonce(new String[] { "EmbedForm", appDef.getAppId(), appDef.getVersion().toString(), json }, 1);
        dataModel.put("nonceForm", nonceForm);

        dataModel.put("formDefKeys", formDefKeys);

        return FormUtil.generateElementHtml(this, formData, template, dataModel);
    }

    public FormRowSet formatData(FormData formData) {
        this.formData = formData;
        FormRowSet rowSet = getRows(formData);
        rowSet.setMultiRow(true);
        try {
            rowSet = convertJsonToFormRowSet(rowSet);
        } catch (JSONException ex) {
            LogUtil.error(Grid.class.getName(), (Throwable)ex, "");
        }
        this.cachedRowSet.put(formData, rowSet);
        return rowSet;
    }

    protected Map<String, String> getImportLabels() {
        Map<String, String> labels = new LinkedHashMap<>();
        String[][] defaults = {
            {"settings", "Import Data"},
            {"intro", "Choose a file, then review the rows before importing."},
            {"open", "Import Excel / CSV"},
            {"template", "Download Excel Template"},
            {"rowsPerPage", "Rows per page"},
            {"previous", "Previous"},
            {"next", "Next"},
            {"pagination", "Import preview pagination"},
            {"file", "Excel / CSV file"},
            {"formats", ".xlsx, .xls or .csv. Maximum 10 MB."},
            {"sheet", "Worksheet"},
            {"confirm", "Import Rows"},
            {"cancel", "Cancel"},
            {"guidelines", "File format and columns"},
            {"help", "Use configured Field IDs or labels as headers. Leave File/Image cells empty. Imported rows are appended; save the form to persist them."}
        };
        for (String[] entry : defaults) {
            String key = "form.formgrid.import." + entry[0];
            String label = AppPluginUtil.getMessage(key, getClassName(), MESSAGE_PATH);
            if (label == null || label.trim().isEmpty() || key.equals(label) || label.contains("@@")) {
                label = entry[1];
            }
            labels.put(entry[0], label);
        }
        return labels;
    }

    // Use configured field IDs, never database column names or uploaded record IDs.
    protected String getImportColumnsJson(Map<String, Map<String, Object>> headers, FormData formData) {
        JSONArray columns = new JSONArray();
        Form innerForm = getForm();
        for (Map.Entry<String, Map<String, Object>> entry : headers.entrySet()) {
            Map<String, Object> header = entry.getValue();
            JSONObject column = new JSONObject();
            column.put("id", entry.getKey());
            column.put("label", header.get("label"));
            column.put("type", header.get("formatType"));
            Element field = innerForm == null ? null : FormUtil.findElement(entry.getKey(), innerForm, formData);
            if (field != null && "date".equals(header.get("formatType"))) {
                String dateFormat = field.getPropertyString("dataFormat");
                dateFormat = dateFormat.isEmpty() ? "yyyy-MM-dd" : dateFormat;
                String pickerType = field.getPropertyString("datePickerType");
                String timeFormat = "true".equals(field.getPropertyString("format24hr")) ? "HH:mm" : "hh:mm a";
                if ("dateTime".equals(pickerType)) dateFormat += " " + timeFormat;
                if ("timeOnly".equals(pickerType)) dateFormat = timeFormat;
                if ("utcdateTime".equals(pickerType)) dateFormat = "yyyy-MM-dd HH:mm";
                column.put("dateFormat", dateFormat);
            }
            columns.put(column);
        }
        return columns.toString();
    }

    // Only expose editors for known field implementations. Custom plugins retain their popup editor.
    protected String getEditableColumnsJson(Map<String, Map<String, Object>> headers, FormData data) {
        JSONArray columns = new JSONArray();
        Form innerForm = getForm();
        for (Map.Entry<String, Map<String, Object>> entry : headers.entrySet()) {
            String id = entry.getKey();
            if (Arrays.asList("id", "dateCreated", "dateModified", "createdBy", "createdByName", "modifiedBy", "modifiedByName").contains(id)
                    || "no".equals(entry.getValue().get("visibility"))) continue;
            Element field = innerForm == null ? null : FormUtil.findElement(id, innerForm, data);
            if (field == null || FormUtil.isReadonly(field, data)) continue;
            String type = field.getClass().getName();
            if (!type.startsWith("org.joget.apps.form.lib.")) continue;
            type = type.substring(type.lastIndexOf('.') + 1);
            if (!Arrays.asList("TextField", "TextArea", "SelectBox", "Radio", "CheckBox", "DatePicker", "FileUpload").contains(type)) continue;
            JSONObject column = new JSONObject();
            column.put("id", id);
            column.put("label", entry.getValue().get("label"));
            column.put("editor", type);
            column.put("multiple", "true".equals(field.getPropertyString("multiple")) || "CheckBox".equals(type));
            column.put("maxlength", field.getPropertyString("maxlength"));
            if (Arrays.asList("SelectBox", "Radio", "CheckBox").contains(type)) {
                if (this.optionsMap == null) this.optionsMap = new HashMap<>();
                column.put("options", getFormOptions(getPropertyString("formDefId"), id, true, data));
            }
            if ("DatePicker".equals(type)) {
                String pickerType = field.getPropertyString("datePickerType");
                // Date/time and UTC fields retain the native popup to preserve timezone semantics.
                if (!pickerType.isEmpty() && !"date".equals(pickerType)) continue;
                String pattern = field.getPropertyString("dataFormat");
                column.put("dateFormat", pattern.isEmpty() ? "yyyy-MM-dd" : pattern);
            }
            if ("FileUpload".equals(type)) {
                column.put("uploadUrl", ((org.joget.apps.form.lib.FileUpload) field).getServiceUrl());
                column.put("paramName", FormUtil.getElementParameterName(field));
                column.put("fileType", field.getPropertyString("fileType"));
                column.put("maxSize", field.getPropertyString("maxSize"));
                column.put("maxSizeMsg", field.getPropertyString("maxSizeMsg"));
            }
            columns.put(column);
        }
        return columns.toString();
    }

    public String formatColumn(String name, Map header, String recordId, String value, String appId, Long appVersion, String contextPath) {
        String formatType = header != null ? (String) header.get("formatType") : null;
        String format = header != null ? (String) header.get("format") : null;
        StringBuilder result = new StringBuilder();

        if (value == null) value = "";

        try {
            if (formatType != null && !formatType.isEmpty()) {
                // Decrypt jika perlu
                if (SecurityUtil.hasSecurityEnvelope(value)) {
                    value = SecurityUtil.decrypt(value);
                }

                switch (formatType) {
                    case "html":
                        result.append(value);
                        break;

                    case "nl2br":
                        result.append(StringUtil.escapeString(value, "html;nl2br", null));
                        break;

                    case "decimal":
                        try {
                            if (format != null && !format.isEmpty()) {
                                int decimal = Integer.parseInt(format);
                                if (value.isEmpty()) value = "0";
                                double number = Double.parseDouble(value);

                                String pattern = value.equals("0") ? "0" : "#";
                                if (decimal > 0) pattern += "." + "0".repeat(decimal);

                                DecimalFormat myFormatter = new DecimalFormat(pattern);
                                result.append(myFormatter.format(number));
                            }
                        } catch (Exception e) {
                            LogUtil.error(getClass().getName(), e, "Decimal formatting error");
                        }
                        break;
                    case "currency":
                        try {
                            if (value == null || value.isEmpty()) {
                                value = "0";
                            }

                            double num = Double.parseDouble(value);

                            // =============================
                            // 1. PARSE PREFIX | PATTERN | SUFFIX
                            // =============================
                            String prefix = "";
                            String numberPattern = format;
                            String suffix = "";

                            if (format.contains("|")) {
                                String[] parts = format.split("\\|");

                                if (format.startsWith("|")) {
                                    suffix = parts.length > 1 ? parts[1] : "";
                                    numberPattern = parts.length > 1 ? parts[1] : "#,###.##";

                                } else if (format.endsWith("|")) {
                                    prefix = parts[0];
                                    numberPattern = "#,###.##";

                                } else if (parts.length == 2) {
                                    if (parts[0].matches(".*[#0.,].*")) {
                                        numberPattern = parts[0];
                                        suffix = parts[1];
                                    } else {
                                        prefix = parts[0];
                                        numberPattern = parts[1];
                                    }
                                } else if (parts.length == 3) {
                                    prefix = parts[0];
                                    numberPattern = parts[1];
                                    suffix = parts[2];
                                }
                            }

                            // =============================
                            // 2. DETECT THOUSAND & DECIMAL SEPARATOR
                            // =============================
                            boolean european =
                                    numberPattern.indexOf('.') < numberPattern.indexOf(',') &&
                                            numberPattern.indexOf(',') != -1;

                            String thousandSep = european ? "." : ",";
                            String decimalSep  = european ? "," : ".";

                            // =============================
                            // 3. DETECT DECIMAL PLACES FROM PATTERN
                            // =============================
                            int decimalPlaces = 0;
                            int decimalIdx = Math.max(numberPattern.lastIndexOf("."), numberPattern.lastIndexOf(","));

                            if (decimalIdx != -1 && decimalIdx < numberPattern.length() - 1) {
                                String decimalPart = numberPattern.substring(decimalIdx + 1);
                                decimalPlaces = decimalPart.replaceAll("[^#0]", "").length();
                            }

                            // =============================
                            // 4. FORMAT NUMBER
                            // =============================
                            String fixed = String.format("%." + decimalPlaces + "f", num);
                            String[] partsNum = fixed.split("\\.");

                            String intPart = partsNum[0];
                            String decPart = partsNum.length > 1 ? partsNum[1] : "";

                            // tambahkan thousand separator
                            StringBuilder sb = new StringBuilder(intPart);
                            for (int i = sb.length() - 3; i > 0; i -= 3) {
                                sb.insert(i, thousandSep);
                            }
                            intPart = sb.toString();

                            // gabungkan integer + decimal
                            StringBuilder formatted = new StringBuilder(intPart);
                            if (decimalPlaces > 0) {
                                formatted.append(decimalSep).append(decPart);
                            }

                            // =============================
                            // 5. PREFIX + SUFFIX
                            // =============================
                            String output =
                                    (prefix.isEmpty() ? "" : prefix + " ") +
                                            formatted +
                                            (suffix.isEmpty() ? "" : " " + suffix);

                            // hasil akhir
                            result.append(StringEscapeUtils.escapeHtml4(output));

                        } catch (Exception e) {
                            LogUtil.error(getClass().getName(), e, "Currency formatting error");
                            result.append(StringEscapeUtils.escapeHtml4(value));
                        }
                        break;
                    case "date":
                        try {
                            if (format != null && !format.isEmpty()) {
                                String[] dateFormat = format.split("\\|");
                                if (dateFormat.length == 2) {
                                    SimpleDateFormat inputFormat;
                                    if (format.startsWith("UTC")) {
                                        inputFormat = new SimpleDateFormat("yyyy-MM-dd HH:mm");
                                        String fieldValue = header.get("value") != null ? header.get("value").toString() : "";
                                        inputFormat.setTimeZone(fieldValue.equals("dateCreated") || fieldValue.equals("dateModified")
                                                ? TimeZone.getDefault() : TimeZone.getTimeZone("UTC"));
                                    } else {
                                        inputFormat = new SimpleDateFormat(dateFormat[0]);
                                    }

                                    Date date = inputFormat.parse(value);
                                    SimpleDateFormat outputFormat = new SimpleDateFormat(dateFormat[1]);
                                    outputFormat.setTimeZone(TimeZone.getDefault());
                                    result.append(outputFormat.format(date));
                                }
                            }
                        } catch (Exception e) {
                            LogUtil.error(getClass().getName(), e, "Date formatting error");
                        }
                        break;

                    case "file":
                    case "image":
                        try {
                            if (format != null && !format.isEmpty() && !value.isEmpty()) {
                                String tableName = (String) header.get("tableName");
                                String[] values = value.split(";");
                                for (String v : values) {
                                    if (recordId != null && !recordId.isEmpty()) {
                                        File file = FileUtil.getFile(v, tableName, recordId);
                                        if (file.exists()) {
                                            String encodedFileName = URLEncoder.encode(v, StandardCharsets.UTF_8).replace("+", "%20");
                                            String filePath = contextPath + "/web/client/app/" + appId + "/" + appVersion + "/form/download/" + format + "/" + recordId + "/" + encodedFileName;

                                            if (formatType.equals("image")) {
                                                String imgPath = filePath + ".thumb.jpg.";
                                                filePath += ".";
                                                result.append("<a href=\"").append(filePath).append("\" target=\"_blank\"><img src=\"")
                                                        .append(imgPath).append("\"/></a> ");
                                            } else {
                                                filePath += ".?attachment=true";
                                                result.append("<a href=\"").append(filePath).append("\" target=\"_blank\">")
                                                        .append(StringEscapeUtils.escapeHtml4(v)).append("</a> ");
                                            }
                                        } else {
                                            result.append(StringEscapeUtils.escapeHtml4(v)).append(" ");
                                        }
                                    }
                                }
                            }
                        } catch (Exception e) {
                            LogUtil.error(getClass().getName(), e, "File/Image rendering error");
                        }
                        break;

                    case "options":
                        try {
                            String fieldId = (String) header.get("value");
                            String formDefId = format;
                            String optionsKey = formDefId + "." + fieldId;
                            Map<String, String> options = this.optionsMap.get(optionsKey);

                            if (options != null && options.containsKey("OPTIONS_AJAX_BINDER_DATA")) {
                                String optionsStr = options.get("OPTIONS");
                                options = new HashMap<>();
                                if (!optionsStr.isEmpty()) {
                                    JSONArray arr = new JSONArray(optionsStr);
                                    for (int i = 0; i < arr.length(); i++) {
                                        options.put(arr.getJSONObject(i).getString("value"), arr.getJSONObject(i).getString("label"));
                                    }
                                }
                            }

                            String[] values = value.split(";");
                            List<String> labels = new ArrayList<>();
                            for (String v : values) {
                                labels.add(options != null && options.containsKey(v) ? options.get(v) : v);
                            }
                            result.append(StringEscapeUtils.escapeHtml4(String.join(", ", labels)));
                        } catch (Exception e) {
                            LogUtil.error(getClass().getName(), e, "Options formatting error");
                        }
                        break;

                    default:
                        result.append(StringEscapeUtils.escapeHtml4(value));
                        break;
                }
            }
        } catch (Exception e) {
            LogUtil.error(getClass().getName(), e, "Unhandled error in formatColumn");
            result = new StringBuilder(StringEscapeUtils.escapeHtml4(value));
        }

        // Safety fallback
        if (result.length() == 0) {
            result.append(StringEscapeUtils.escapeHtml4(value));
        }

        // Fix &amp;#xx; -> &#xx;
        String finalResult = result.toString().replaceAll("&amp;([#0-9a-zA-Z]+;)", "&$1");

        return finalResult;
    }

    protected Map<String, Map<String, Object>> getHeaderMap(FormData formData) {
        this.formData = formData;

        if (this.headerMap == null) {
            this.headerMap = new LinkedHashMap<>();
            Object optionProperty = getProperty("options");

            if (optionProperty instanceof Collection) {
                for (Object opt : (Collection<?>) optionProperty) {
                    Map<String, Object> optMap = (Map<String, Object>) opt;
                    Object value = optMap.get("value");
                    Object label = optMap.get("label");

                    if (value != null) {
                        if (label != null) {
                            optMap.put("label", StringUtil.stripHtmlRelaxed(label.toString()));
                        }
                        this.headerMap.put(value.toString(), optMap);
                    }

                    String formatType = (String) optMap.get("formatType");
                    String format = (String) optMap.get("format");

                    if ("date".equalsIgnoreCase(formatType) && "UTC".equalsIgnoreCase(format)) {
                        Locale locale = Locale.getDefault();  // Replaced LocaleContextHolder.getLocale()

                        if (locale != null && locale.toString().startsWith("zh")) {
                            WorkflowUtil.getHttpServletRequest().setAttribute("currentLocale", locale);
                            format = "yyyy-MM-dd";
                        } else {
                            SetupManager setupManager = (SetupManager) AppUtil.getApplicationContext().getBean("setupManager");
                            if ("true".equalsIgnoreCase(setupManager.getSettingValue("dateFormatFollowLocale"))) {
                                DateFormat dateInstance = DateFormat.getDateInstance(DateFormat.SHORT, locale);
                                if (dateInstance instanceof SimpleDateFormat) {
                                    format = ((SimpleDateFormat) dateInstance).toPattern();
                                    format = format.replaceAll("MM", "M");
                                    format = format.replaceAll("M", "MM");
                                    format = format.replaceAll("dd", "d");
                                    format = format.replaceAll("d", "dd");
                                }
                            } else {
                                format = setupManager.getSettingValue("systemDateFormat");
                            }
                        }

                        if (format == null || format.isEmpty()) {
                            format = "MM/dd/yyyy";
                        }

                        if (!format.contains(":mm")) {
                            format = format + " HH:mm";
                        }

                        TimeZone tz = TimeZone.getDefault(); // Replaced LocaleContextHolder.getTimeZone()
                        optMap.put("format", "UTC|" + format + "|" + tz.getRawOffset() + "|" + tz.getRawOffset());
                    }

                    if (("file".equals(formatType) || "image".equals(formatType)) && format != null && !format.isEmpty()) {
                        AppService appService = (AppService) AppUtil.getApplicationContext().getBean("appService");
                        optMap.put("tableName", appService.getFormTableName(AppUtil.getCurrentAppDefinition(), format));
                    }
                }
            }
        }

        return this.headerMap;
    }

    protected String getOptionsJson(Map<String, Map<String, Object>> headers) {
        return getOptionsJson(headers, null);
    }

    protected String getOptionsJson(Map<String, Map<String, Object>> headers, FormData formdata) {
        this.loadOptionsMap(headers, formdata);
        JSONObject jsonObject = new JSONObject();

        try {
            if (this.optionsMap != null && !this.optionsMap.isEmpty()) {
                for(String key : this.optionsMap.keySet()) {
                    Map<String, String> options = this.optionsMap.get(key);
                    key = key.substring(key.indexOf(".") + 1);
                    jsonObject.accumulate(key, options);
                }
            }
        } catch (Exception e) {
        }

        return jsonObject.toString();
    }

    public Boolean selfValidate(FormData formData) {
        this.formData = formData;
        boolean valid = true;

        FormRowSet rowSet = getRows(formData);
        if (rowSet == null) {
            rowSet = new FormRowSet();
        }

        String id = FormUtil.getElementParameterName(this);
        String errorMsg = getPropertyString("errorMessage");

        String min = getPropertyString("validateMinRow");
        if (min != null && !min.isEmpty()) {
            try {
                int minNumber = Integer.parseInt(min);
                if (rowSet.size() < minNumber) {
                    valid = false;
                }
            } catch (NumberFormatException ignored) {}
        }

        String max = getPropertyString("validateMaxRow");
        if (max != null && !max.isEmpty()) {
            try {
                int maxNumber = Integer.parseInt(max);
                if (rowSet.size() > maxNumber) {
                    valid = false;
                }
            } catch (NumberFormatException ignored) {}
        }

        if (!valid) {
            formData.addFormError(id, errorMsg);
        }

        String uniqueKey = getPropertyString("uniqueKey");
        if (uniqueKey != null && !uniqueKey.isEmpty()) {
            Set<String> values = new HashSet<>();
            for (FormRow row : rowSet) {
                String value = row.getProperty(uniqueKey);
                if (value != null && !value.isEmpty()) {
                    if (!values.add(value)) {
                        valid = false;
                        Map<String, Object> header = getHeaderMap(formData).get(uniqueKey);
                        String label = header != null ? String.valueOf(header.get("label")) : uniqueKey;
                        formData.addFormError(id, ResourceBundleUtil.getMessage(
                                "form.formgrid.uniqueKey.error",
                                new String[]{ label }
                        ));
                    }
                }
            }
        }

        if ("true".equals(getPropertyString("editable")) && !FormUtil.isReadonly(this, formData)) {
            valid = validateEditableRows(rowSet, formData) && valid;
        }
        return valid;
    }

    protected boolean validateEditableRows(FormRowSet rows, FormData parentData) {
        JSONArray columns = new JSONArray(getEditableColumnsJson(getHeaderMap(parentData), parentData));
        List<String> errors = new ArrayList<>();
        int index = 0;
        for (FormRow row : rows) {
            index++;
            FormData rowData = new FormData();
            rowData.setPrimaryKeyValue(row.getId());
            rowData.setAssignment(parentData.getAssignment());
            rowData.setProcessId(parentData.getProcessId());
            rowData.setActivityId(parentData.getActivityId());
            for (Object key : row.keySet()) {
                String id = String.valueOf(key);
                Element field = FormUtil.findElement(id, getForm(), rowData);
                if (field != null) {
                    String value = row.getProperty(id);
                    boolean multi = field instanceof org.joget.apps.form.lib.SelectBox || field instanceof org.joget.apps.form.lib.CheckBox;
                    String[] values = value == null ? new String[0] : multi ? value.split(";", -1) : new String[]{value};
                    if (field instanceof org.joget.apps.form.lib.FileUpload && row.getTempFilePathMap() != null
                            && row.getTempFilePathMap().containsKey(id)) {
                        List<String> fileValues = new ArrayList<>(Arrays.asList(value == null ? new String[0] : value.split(";")));
                        fileValues.addAll(Arrays.asList(row.getTempFilePathMap().get(id)));
                        values = fileValues.toArray(new String[0]);
                    }
                    rowData.addRequestParameterValues(FormUtil.getElementParameterName(field), values);
                }
            }
            for (int c = 0; c < columns.length(); c++) {
                JSONObject column = columns.getJSONObject(c);
                Element field = FormUtil.findElement(column.getString("id"), getForm(), rowData);
                if (field != null && rowData.getRequestParameterValues(FormUtil.getElementParameterName(field)) == null) {
                    rowData.addRequestParameterValues(FormUtil.getElementParameterName(field), new String[]{""});
                }
                if (field != null && !FormUtil.executeValidators(field, rowData)) {
                    String message = rowData.getFormError(FormUtil.getElementParameterName(field));
                    errors.add("Row " + index + " — " + column.optString("label", column.getString("id")) + ": "
                            + (message == null || message.isEmpty() ? "Invalid value" : message));
                }
            }
        }
        if (!errors.isEmpty()) {
            String id = FormUtil.getElementParameterName(this);
            String previous = parentData.getFormError(id);
            parentData.addFormError(id, (previous == null ? "" : previous + " ") + String.join("; ", errors));
        }
        return errors.isEmpty();
    }

    protected String getDecorator() {
        String decorator = "";
        try {
            String min = getPropertyString("validateMinRow");
            if (min != null && !min.isEmpty()) {
                int minNumber = Integer.parseInt(min);
                if (minNumber > 0)
                    decorator = "*";
            }
        } catch (Exception exception) {}
        return decorator;
    }

    protected void loadOptionsMap(Map<String, Map<String, Object>> headers) {
        loadOptionsMap(headers, null);
    }

    protected void loadOptionsMap(Map<String, Map<String, Object>> headers, FormData formData) {
        if (this.optionsMap == null) {
            this.optionsMap = new HashMap<>();

            for (Map.Entry<String, Map<String, Object>> entry : headers.entrySet()) {
                Map<String, Object> header = entry.getValue();
                String formatType = (String) header.get("formatType");
                String formDefId = (String) header.get("format");

                if ("options".equals(formatType) && formDefId != null && !formDefId.isEmpty()) {
                    String fieldId = (String) header.get("value");
                    getFormOptions(formDefId, fieldId, true, formData);
                }
            }
        }
    }

    protected Map<String, String> getFormOptions(String formDefId, String fieldId) {
        return getFormOptions(formDefId, fieldId, false, (FormData)null);
    }

    protected Map<String, String> getFormOptions(String formDefId, String fieldId, boolean useAjax, FormData gridFormData) {
        FormDefinitionDao formDefinitionDao = (FormDefinitionDao) AppUtil.getApplicationContext().getBean("formDefinitionDao");
        FormService formService = (FormService) AppUtil.getApplicationContext().getBean("formService");

        String optionsKey = formDefId + "." + fieldId;
        Map<String, String> options = this.optionsMap.get(optionsKey);
        if (options != null) {
            return options;
        }

        options = new LinkedHashMap<>();
        String formJson = this.optionFormsJson.get(formDefId);

        if (formJson == null) {
            AppDefinition appDef = AppUtil.getCurrentAppDefinition();
            if (appDef != null) {
                FormDefinition formDef = formDefinitionDao.loadById(formDefId, appDef);
                if (formDef != null) {
                    String json = formDef.getJson();
                    formJson = AppUtil.processHashVariable(json, null, "json", null);
                    formJson = formJson.replaceAll("\\\"\\{\\}\\\"", "{}");
                    this.optionFormsJson.put(formDefId, formJson);
                }
            }
        }

        if (formJson != null) {
            FormData formData = new FormData();
            Element element = FormUtil.findAndParseElement(formJson, fieldId);

            if (element != null) {
                boolean isAjaxSupported = useAjax && FormUtil.isAjaxOptionsSupported(element, formData);

                if (isAjaxSupported) {
                    FormUtil.setAjaxOptionsElementProperties(element, formData);
                    options.put("OPTIONS_USE_AJAX", "true");
                    options.put("OPTIONS_AJAX_CONTROL_FIELD", element.getPropertyString("controlField"));
                    options.put("OPTIONS_AJAX_APP_ID", element.getPropertyString("appId"));
                    options.put("OPTIONS_AJAX_APP_VERSION", String.valueOf(element.getProperty("appVersion")));
                    options.put("OPTIONS_AJAX_NONCE", element.getPropertyString("nonce"));
                    options.put("OPTIONS_AJAX_BINDER_DATA", element.getPropertyString("binderData"));

                    if (gridFormData != null) {
                        String[] fields = element.getPropertyString("controlField").split(";");
                        Set<String> values = new HashSet<>();
                        FormRowSet rows = getRows(gridFormData);

                        for (FormRow r : rows) {
                            List<String> v = new ArrayList<>();
                            for (String f : fields) {
                                String field = f.trim();
                                if (r.containsKey(field)) {
                                    v.add(r.getProperty(field));
                                }
                            }
                            values.add(String.join(";", v));
                        }

                        Set<String> uniqueValues = new HashSet<>();
                        try {
                            FormAjaxOptionsBinder ab = (FormAjaxOptionsBinder) element.getOptionsBinder();
                            JSONArray jsonOptions = new JSONArray();

                            for (String v : values) {
                                FormRowSet optionsSet = ab.loadAjaxOptions(v.split(";"));
                                for (FormRow o : optionsSet) {
                                    String ov = o.getProperty("value");
                                    if (uniqueValues.add(ov)) {
                                        Map<String, String> data = new HashMap<>();
                                        data.put("value", ov);
                                        data.put("label", o.getProperty("label"));
                                        jsonOptions.put(data);
                                    }
                                }
                            }

                            options.put("OPTIONS", jsonOptions.toString());
                        } catch (Exception ex) {
                            LogUtil.error(FormService.class.getName(), ex, "Error retrieving AJAX options for " + optionsKey);
                        }
                    } else {
                        element.setProperty("controlField", "");
                        try {
                            formData = formService.executeFormOptionsBinders(element, formData);
                            Collection<Map> list = FormUtil.getElementPropertyOptionsMap(element, formData);
                            JSONArray jsonOptions = new JSONArray();
                            for (Map o : list) {
                                Map<String, Object> data = new HashMap<>();
                                data.put("value", o.get("value"));
                                data.put("label", o.get("label"));
                                jsonOptions.put(data);
                            }
                            options.put("OPTIONS", jsonOptions.toString());
                        } catch (Exception ex) {
                            LogUtil.error(FormService.class.getName(), ex, "Error retrieving binder options for " + optionsKey);
                        }
                    }

                    this.optionsMap.put(optionsKey, options);
                } else if (
                        element instanceof org.joget.apps.form.lib.SelectBox &&
                                element.getProperties().containsKey("listId") &&
                                !element.getProperties().containsKey("options")
                ) {
                    FormRowSet rows = getRows(formData);
                    Collection<String> values = new ArrayList<>();
                    if (rows != null && !rows.isEmpty()) {
                        for (FormRow row : rows) {
                            String value = row.getProperty(fieldId);
                            if (value != null && !value.isEmpty()) {
                                values.add(value);
                            }
                        }
                    }

                    retrieveDatalistOptions(values, element, options, formData);
                    this.optionsMap.put(optionsKey, options);
                } else {
                    element.setProperty("controlField", "");
                    try {
                        formData = formService.executeFormOptionsBinders(element, formData);
                        Collection<Map> optionMap = FormUtil.getElementPropertyOptionsMap(element, formData);
                        for (Map o : optionMap) {
                            options.put((String) o.get("value"), (String) o.get("label"));
                        }
                        this.optionsMap.put(optionsKey, options);
                    } catch (Exception ex) {
                        LogUtil.error(FormService.class.getName(), ex, "Error retrieving binder options for " + optionsKey);
                    }
                }
            }
        }

        return this.optionsMap.get(optionsKey);
    }

    protected void retrieveDatalistOptions(Collection<String> values, Element element, Map<String, String> options, FormData formData) {
        DataListCollection rows = null;
        AppDefinition appDef = AppUtil.getCurrentAppDefinition();

        DatalistDefinitionDao datalistDefinitionDao = (DatalistDefinitionDao) AppUtil.getApplicationContext().getBean("datalistDefinitionDao");
        DatalistDefinition datalistDefinition = (DatalistDefinition) datalistDefinitionDao.loadById(element.getPropertyString("listId"), appDef);

        if (datalistDefinition != null) {
            String json = datalistDefinition.getJson();
            Object requestParamsProperty = element.getProperty("requestParams");

            // Replace #requestParam.*# in datalist JSON
            if (formData != null && requestParamsProperty instanceof Object[]) {
                Form form = FormUtil.findRootForm(element);
                for (Object param : (Object[]) requestParamsProperty) {
                    Map paramMap = (Map) param;
                    String parameter = (String) paramMap.get("param");
                    String fieldId = (String) paramMap.get("field");
                    String defaultValue = (String) paramMap.get("defaultValue");

                    String[] paramValues = null;
                    if (fieldId != null && !fieldId.isEmpty()) {
                        Element field = FormUtil.findElement(fieldId, (Element) form, formData);
                        paramValues = FormUtil.getElementPropertyValues(field, formData);
                    }

                    if (paramValues == null || paramValues.length == 0) {
                        paramValues = new String[]{defaultValue};
                    }

                    String paramValue = FormUtil.generateElementPropertyValues(paramValues);
                    json = json.replaceAll(
                            StringUtil.escapeRegex("#requestParam." + parameter + "#"),
                            StringUtil.escapeRegex(paramValue)
                    );
                }
            }

            DataListService dataListService =
                    (DataListService) AppUtil.getApplicationContext().getBean("dataListService");
            DataList dataList = dataListService.fromJson(json);
            DataListBinder binder = dataList.getBinder();

            String idField = element.getPropertyString("idField");
            if (idField == null || idField.isEmpty()) {
                idField = binder.getPrimaryKeyColumnName();
            }

            if (binder != null) {
                Collection<DataListFilterQueryObject> queries = new ArrayList<>();
                queries.addAll(Arrays.asList(dataList.getFilterQueryObjects()));

                // Add filter for selected values
                if (values != null && !values.isEmpty()) {
                    DataListFilterQueryObject queryObject = new DataListFilterQueryObject();
                    StringBuilder query = new StringBuilder(binder.getColumnName(idField)).append(" in (");
                    for (String v : values) {
                        query.append("?,");
                    }
                    query.replace(query.length() - 1, query.length(), ")");
                    queryObject.setOperator("AND");
                    queryObject.setQuery(query.toString());
                    queryObject.setValues(values.toArray(new String[0]));
                    queries.add(queryObject);
                }

                rows = binder.getData(
                        dataList,
                        binder.getProperties(),
                        queries.toArray(new DataListFilterQueryObject[0]),
                        null, null, null,
                        100000
                );
            }

            // Fill options
            if (rows != null && !rows.isEmpty()) {
                String displayField = element.getPropertyString("displayField");
                if (idField != null && displayField != null) {
                    for (Object r : rows) {
                        String key = (String) DataListService.evaluateColumnValueFromRow(r, idField);
                        String label = (String) DataListService.evaluateColumnValueFromRow(r, displayField);
                        options.put(key, label);
                    }
                }
            }
        }
    }


    protected FormRowSet getRows(FormData formData) {
        this.formData = formData;

        if (!this.cachedRowSet.containsKey(formData)) {
            String id = this.getPropertyString("id");
            String param = FormUtil.getElementParameterName(this);

            FormRowSet rowSet = new FormRowSet();
            String json = this.getPropertyString("value");

            // Load value dari properti jika ada
            if (json != null && !json.isEmpty()) {
                try {
                    rowSet = FormUtil.jsonToFormRowSet(json);
                } catch (Exception ex) {
                    LogUtil.error(Grid.class.getName(), ex, "Error parsing grid JSON");
                }
            }

            boolean hasSubmittedData = false;
            boolean continueLoop = true;
            int i = 0;

            // Ambil data dari request parameter (input user)
            while (continueLoop) {
                FormRow row = new FormRow();
                String paramName = param + "_jsonrow_" + i;
                String paramValue = formData.getRequestParameter(paramName);

                if (paramValue != null) {
                    row.setProperty("jsonrow", paramValue);

                    try {
                        row.putAll(this.convertJsonToFormRow(paramValue));
                    } catch (Exception ex) {
                        LogUtil.error(Grid.class.getName(), ex, "Error parsing jsonrow data into row properties");
                    }
                }

                if (!row.isEmpty()) {
                    rowSet.add(row);
                    hasSubmittedData = true;
                } else {
                    continueLoop = false;
                }

                i++;
            }

            // Check jika ada data dari binder saat readonly/form tidak disubmit
            if (!hasSubmittedData && formData.getRequestParameter(param + "_jsonrow") != null) {
                hasSubmittedData = true;
            }

            if (!FormUtil.isFormSubmitted(this, formData) || FormUtil.isReadonly(this, formData) || !hasSubmittedData) {
                FormRowSet binderRowSet = formData.getLoadBinderData(this);

                if (binderRowSet != null) {
                    if (!binderRowSet.isMultiRow()) {
                        if (!binderRowSet.isEmpty()) {
                            FormRow row = binderRowSet.get(0);
                            String jsonValue = row.getProperty(id);

                            try {
                                rowSet = FormUtil.jsonToFormRowSet(jsonValue);
                            } catch (Exception ex) {
                                LogUtil.error(Grid.class.getName(), ex, "Error parsing grid JSON");
                            }
                        }
                    } else {
                        try {
                            rowSet = this.convertFormRowToJson(binderRowSet);
                        } catch (Exception ex) {
                            LogUtil.error(Grid.class.getName(), ex, "Error parsing grid JSON");
                        }
                    }

                    if (rowSet != null && this.getPropertyString("enableSorting") != null && this.getPropertyString("enableSorting").equals("true") && this.getPropertyString("sortField") != null && !this.getPropertyString("sortField").isEmpty()) {
                        final String sortField = this.getPropertyString("sortField");

                        rowSet.sort((row1, row2) -> {
                            String number1 = row1.getProperty(sortField);
                            String number2 = row2.getProperty(sortField);

                            if (number1 == null) return 1;
                            if (number2 == null) return -1;

                            try {
                                return Integer.compare(Integer.parseInt(number1), Integer.parseInt(number2));
                            } catch (Exception ex) {
                                LogUtil.error(Grid.class.getName(), ex, "Error parsing sortField value");
                                return 0;
                            }
                        });
                    }
                }
            }

            this.cachedRowSet.put(formData, rowSet);
        }

        this.prepareUiJsonData(formData, this.cachedRowSet.get(formData));
        return this.cachedRowSet.get(formData);
    }

    protected void prepareUiJsonData(FormData formData, FormRowSet oriRows) {
        if (oriRows != null && !oriRows.isEmpty()) {
            FormRow row = oriRows.get(0);
            if (!row.containsKey("jsonrow")) {
                FormRowSet rowSet = this.convertFormRowToJson(oriRows);
                this.cachedRowSet.put(formData, rowSet);
            }
        }

    }

    protected FormRowSet parseFormRowSetFromJson(String json) {
        return FormUtil.jsonToFormRowSet(json);
    }

    protected FormRowSet convertFormRowToJson(FormRowSet oriRowSet) throws JSONException {
        FormRowSet rowSet = new FormRowSet();
        rowSet.setMultiRow(true);

        for (FormRow row : oriRowSet) {
            JSONObject jsonObject = new JSONObject();
            FormRow newRow = new FormRow();

            for (Map.Entry<Object, Object> entry : row.entrySet()) {
                String key = entry.getKey().toString();
                String value = entry.getValue().toString();
                jsonObject.put(key, value);
                newRow.setProperty(key, value);
            }

            newRow.setProperty("jsonrow", jsonObject.toString());

            if (row.getDeleteFilePathMap() != null && !row.getDeleteFilePathMap().isEmpty()) {
                newRow.setDeleteFilePathMap(row.getDeleteFilePathMap());
            }

            if (row.getTempFilePathMap() != null && !row.getTempFilePathMap().isEmpty()) {
                newRow.setTempFilePathMap(row.getTempFilePathMap());
            }

            rowSet.add(newRow);
        }

        return rowSet;
    }

    protected FormRowSet convertJsonToFormRowSet(FormRowSet oriRowSet) throws JSONException {
        FormRowSet rowSet = new FormRowSet();
        rowSet.setMultiRow(true);

        int index = 0;
        String enableSorting = getPropertyString("enableSorting");
        String sortField = getPropertyString("sortField");
        boolean isSortingEnabled = "true".equalsIgnoreCase(enableSorting) && sortField != null && !sortField.isEmpty();

        for (FormRow row : oriRowSet) {
            String jsonRow = row.getProperty("jsonrow");
            if (jsonRow == null || jsonRow.isEmpty()) {
                continue;
            }

            FormRow newRow = convertJsonToFormRow(jsonRow);

            if (isSortingEnabled) {
                newRow.put(sortField, Integer.toString(index));
            }

            if (row.getDeleteFilePathMap() != null && !row.getDeleteFilePathMap().isEmpty()) {
                newRow.setDeleteFilePathMap(row.getDeleteFilePathMap());
            }

            if (row.getTempFilePathMap() != null && !row.getTempFilePathMap().isEmpty()) {
                newRow.setTempFilePathMap(row.getTempFilePathMap());
            }

            rowSet.add(newRow);
            index++;
        }

        return rowSet;
    }


    protected FormRow convertJsonToFormRow(String json) throws JSONException {
        JSONObject jsonObject = new JSONObject(json);
        FormRow newRow = new FormRow();
        JSONArray fields = jsonObject.names();

        if (fields != null && !fields.isEmpty()) {
            for (int k = 0; k < fields.length(); k++) {
                String fieldName = fields.getString(k);

                switch (fieldName) {
                    case "_tempFilePathMap":
                        JSONObject tempFilePathMap = jsonObject.getJSONObject("_tempFilePathMap");
                        JSONArray tempFilePaths = tempFilePathMap.names();

                        if (tempFilePaths != null && !tempFilePaths.isEmpty()) {
                            for (int l = 0; l < tempFilePaths.length(); l++) {
                                String tempFilePathFieldId = tempFilePaths.getString(l);
                                JSONArray paths = tempFilePathMap.getJSONArray(tempFilePathFieldId);
                                List<String> pathValues = new ArrayList<>();

                                for (int m = 0; m < paths.length(); m++) {
                                    pathValues.add(paths.getString(m));
                                }

                                newRow.putTempFilePath(tempFilePathFieldId, pathValues.toArray(new String[0]));
                            }
                        }
                        break;

                    case "_deleteFilePathMap":
                        JSONObject deleteFilePathMap = jsonObject.getJSONObject("_deleteFilePathMap");
                        JSONArray deleteFilePaths = deleteFilePathMap.names();

                        if (deleteFilePaths != null && !deleteFilePaths.isEmpty()) {
                            for (int l = 0; l < deleteFilePaths.length(); l++) {
                                String deleteFilePathFieldId = deleteFilePaths.getString(l);
                                JSONArray paths = deleteFilePathMap.getJSONArray(deleteFilePathFieldId);
                                List<String> pathValues = new ArrayList<>();

                                for (int m = 0; m < paths.length(); m++) {
                                    pathValues.add(paths.getString(m));
                                }

                                newRow.putDeleteFilePath(deleteFilePathFieldId, pathValues.toArray(new String[0]));
                            }
                        }
                        break;

                    case "_tempRequestParamsMap":
                        FormData tempFormData = new FormData();
                        JSONObject tempRequestParamMap = jsonObject.getJSONObject("_tempRequestParamsMap");
                        JSONArray tempRequestParams = tempRequestParamMap.names();

                        if (tempRequestParams != null && !tempRequestParams.isEmpty()) {
                            for (int l = 0; l < tempRequestParams.length(); l++) {
                                String rpKey = tempRequestParams.getString(l);
                                JSONArray tempValues = tempRequestParamMap.getJSONArray(rpKey);
                                List<String> rpValues = new ArrayList<>();

                                for (int m = 0; m < tempValues.length(); m++) {
                                    rpValues.add(tempValues.getString(m));
                                }

                                tempFormData.addRequestParameterValues(rpKey, rpValues.toArray(new String[0]));
                            }
                        }

                        String uniqueKey = UuidGenerator.getInstance().getUuid();
                        newRow.put("__UNIQUEKEY__", uniqueKey);
                        this.formDatas.put(uniqueKey, tempFormData);
                        break;

                    default:
                        String value = jsonObject.get(fieldName).toString();
                        newRow.setProperty(fieldName, value);
                        break;
                }
            }
        }

        return newRow;
    }

    protected Form getForm() {
        if (this.form == null) {
            String formDefId = getPropertyString("formDefId");

            if (formDefId.isEmpty()) {
                if (getStoreBinder() instanceof FormBinder) {
                    formDefId = ((FormBinder) getStoreBinder()).getPropertyString("formDefId");
                }
                if (formDefId.isEmpty() && getLoadBinder() instanceof FormBinder) {
                    formDefId = ((FormBinder) getLoadBinder()).getPropertyString("formDefId");
                }
            }

            if (!formDefId.isEmpty()) {
                AppDefinition appDef = AppUtil.getCurrentAppDefinition();

                if (appDef != null) {
                    FormDefinitionDao formDefinitionDao = (FormDefinitionDao) AppUtil.getApplicationContext().getBean("formDefinitionDao");
                    FormService formService = (FormService) AppUtil.getApplicationContext().getBean("formService");

                    FormDefinition formDef = formDefinitionDao.loadById(formDefId, appDef);

                    if (formDef != null) {
                        String json = formDef.getJson();

                        try {
                            formDefKeys = Utils.extractFieldIds(json);
                        } catch (Exception e) {}

                        if (this.formData != null && this.formData.getProcessId() != null && !this.formData.getProcessId().isEmpty()) {
                            WorkflowManager wm = (WorkflowManager) AppUtil.getApplicationContext().getBean("workflowManager");
                            WorkflowAssignment wfAssignment = this.formData.getAssignment();

                            if (wfAssignment == null) {
                                wfAssignment = wm.getAssignmentByProcess(this.formData.getProcessId());
                            }

                            json = AppUtil.processHashVariable(json, wfAssignment, "json", null);
                        }

                        this.form = (Form) formService.createElementFromJson(json);

                        boolean readonly = "true".equalsIgnoreCase(getPropertyString("readonly"));
                        boolean readonlyLabel = "true".equalsIgnoreCase(getPropertyString("readonlyLabel"));

                        if (readonly || readonlyLabel) {
                            FormUtil.setReadOnlyProperty(this.form, readonly, readonlyLabel);
                        }
                    }
                }
            }
        }

        return this.form;
    }


    protected String getSelectedFormJson() {
        Form form = getForm();
        if (form != null) {
            try {
                FormService formService = (FormService) AppUtil.getApplicationContext().getBean("formService");

                String json = formService.generateElementJson(form);

                try {
                    JSONObject temp = new JSONObject(json);
                    JSONObject jsonProps = temp.getJSONObject("properties");

                    JSONObject jsonLoadBinder = new JSONObject();
                    jsonLoadBinder.put("className", "org.joget.plugin.enterprise.JsonFormBinder");
                    jsonLoadBinder.put("properties", new JSONObject());

                    jsonProps.put("loadBinder", jsonLoadBinder);
                    jsonProps.put("storeBinder", jsonLoadBinder);

                    json = temp.toString();
                } catch (Exception e) {
                    LogUtil.warn(getClass().getName(), "Error modifying JSON structure: " + e.getMessage());
                }

                return SecurityUtil.encrypt(json);

            } catch (Exception e) {
                LogUtil.error(getClass().getName(), e, "Failed to generate selected form JSON.");
            }
        }

        setProperty("readonly", "true");
        return "";
    }


    public Collection<String> getDynamicFieldNames() {
        Collection<String> fieldNames = new ArrayList<>();
        if (getStoreBinder() == null)
            fieldNames.add(getPropertyString("id"));
        return fieldNames;
    }

    public void setStoreBinder(FormStoreBinder storeBinder) {
        if (storeBinder != null) {
            GridInnerDataStoreBinderWrapper binder = new GridInnerDataStoreBinderWrapper(this, storeBinder);

            binder.setDeleteGridData("true".equals(getPropertyString("deleteGridData")));
            binder.setDeleteSubformData("true".equals(getPropertyString("deleteSubformData")));
            binder.setDeleteFiles("true".equals(getPropertyString("deleteFiles")));
            binder.setAbortProcess("true".equals(getPropertyString("abortRelatedRunningProcesses")));
            super.setStoreBinder(binder);
        } else {
            super.setStoreBinder(null);
        }
    }

    @Override
    public String getFormBuilderCategory() {
        return "<span><i class=\"fas fa-crown\"></i> Monarch </span>";
    }

    @Override
    public int getFormBuilderPosition() {
        return 100;
    }

    @Override
    public String getFormBuilderIcon() {
        return "<i class=\"fas fa-list-ol\"></i>";
    }

    @Override
    public String getFormBuilderTemplate() {
        return "<label class='label'>Form Grid</label>"
                + "<div class='grid formgrid formgrid-custom form-element'>"
                + "<table cellspacing='0'><tr><th>Header</th><th>Header</th></tr>"
                + "<tr><td>Cell</td><td>Cell</td></tr></table>"
                + "<p class='pg-navigator'></p>"
                + "<button type='button' class='btn btn-primary grid-action-add text-decoration-none formgrid-custom-add' "
                + "style='position:relative;bottom:0px;padding:6px 12px;height:fit-content;width:fit-content;opacity:1;'>"
                + getAddLabelMessage() + "</button></div>";
    }

    protected String getAddLabelMessage() {
        String label = AppPluginUtil.getMessage("form.formgrid.addLabel", getClassName(), MESSAGE_PATH);
        if (label == null || label.isEmpty() || "form.formgrid.addLabel".equals(label)) {
            return "<i class=\"fas fa-plus\"></i> Add";
        }
        return label;
    }

    @Override
    public String getName() {
        return AppPluginUtil.getMessage("com.monarch.shadow.fromgridcustom.element.pluginLabel", getClassName(),  MESSAGE_PATH);
    }

    @Override
    public String getVersion() {
        return VERSION;
    }

    @Override
    public String getDescription() {
        return "Form Grid Element Custom - Monarch Shadow";
    }

    @Override
    public String getLabel() {
        return AppPluginUtil.getMessage("com.monarch.shadow.fromgridcustom.element.pluginLabel", getClassName(),  MESSAGE_PATH);
    }

    @Override
    public String getClassName() {
        return this.getClass().getName();
    }

    @Override
    public String getPropertyOptions() {
        String formDefField = null;
        AppDefinition appDef = AppUtil.getCurrentAppDefinition();

        if (appDef != null) {
            String formJsonUrl = "[CONTEXT_PATH]/web/json/console/app/" + appDef.getId() + "/" + appDef.getVersion() + "/forms/options";
            formDefField = "{name:'formDefId',label:'@@form.formgrid.formId@@',type:'selectbox',options_ajax:'" + formJsonUrl + "',required : 'True'}";
        } else {
            formDefField = "{name:'formDefId',label:'@@form.formgrid.formId@@',type:'textfield',required : 'True'}";
        }

        Object[] arguments = { formDefField };
        return AppUtil.readPluginResource(this.getClassName(), "/properties/FormGridCustom.json", arguments, true, MESSAGE_PATH);
    }

    @Override
    public Form getInnerForm() {
        return getForm();
    }

    @Override
    public FormData getFormData(FormRow formRow) {
        if (formRow.containsKey("__UNIQUEKEY__")) {
            String key = formRow.getProperty("__UNIQUEKEY__");
            formRow.remove("__UNIQUEKEY__");

            return this.formDatas.get(key);
        }
        return null;
    }

    @Override
    public Set<String> getOfflineStaticResources() {
        Set<String> urls = new HashSet<>();
        String contextPath = AppUtil.getRequestContextPath();

        urls.add(contextPath + "/plugin/com.monarch.shadow.lib.FormGridCustom/js/jquery.formGridCustom.js?v=" + getVersion());
        urls.add(contextPath + "/plugin/com.monarch.shadow.lib.FormGridCustom/js/jquery.gridPagingCustom.js?v=" + getVersion());
        urls.add(contextPath + "/plugin/com.monarch.shadow.lib.FormGridCustom/js/jquery.formGridCustom.remake.js?v=" + getVersion());
        urls.add(contextPath + "/plugin/com.monarch.shadow.lib.FormGridCustom/js/jquery.formGridEditable.js?v=" + getVersion());
        urls.add(contextPath + "/plugin/com.monarch.shadow.lib.FormGridCustom/js/jquery.utils.js?v=" + getVersion());
        urls.add(contextPath + "/plugin/com.monarch.shadow.lib.FormGridCustom/js/formGridImport.js?v=" + getVersion());
        urls.add(contextPath + "/plugin/com.monarch.shadow.lib.FormGridCustom/js/jquery.formGridImport.js?v=" + getVersion());
        urls.add(contextPath + "/plugin/com.monarch.shadow.lib.FormGridCustom/js/vendor/xlsx.full.min.js?v=" + getVersion());
        urls.add(contextPath + "/plugin/com.monarch.shadow.lib.FormGridCustom/css/formGridStyle.css?v=" + getVersion());

        return urls;
    }
}
