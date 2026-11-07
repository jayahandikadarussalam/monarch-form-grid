package com.monarch.shadow.lib;

import freemarker.template.Configuration;
import freemarker.template.Template;
import freemarker.template.TemplateExceptionHandler;
import org.junit.Test;

import java.io.InputStreamReader;
import java.io.StringWriter;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.HashMap;
import java.util.Map;

import static org.junit.Assert.*;

public class FormGridImportTemplateTest {
    public static class Request {
        public String getContextPath() { return "/jw"; }
        public Object getAttribute(String name) { return null; }
    }

    private String render(boolean enabled, boolean readonly) throws Exception {
        return render(enabled, readonly, null);
    }

    private String render(boolean enabled, boolean readonly, String previewPageSize) throws Exception {
        return render(enabled, readonly, previewPageSize, false);
    }

    private String render(boolean enabled, boolean readonly, String previewPageSize, boolean editable) throws Exception {
        return render(enabled, readonly, previewPageSize, editable, false);
    }

    private String render(boolean enabled, boolean readonly, String previewPageSize, boolean editable, boolean nested) throws Exception {
        Configuration config = new Configuration();
        config.setTemplateExceptionHandler(TemplateExceptionHandler.RETHROW_HANDLER);
        Template template = new Template("FormGridCustom.ftl", new InputStreamReader(
                getClass().getResourceAsStream("/templates/FormGridCustom.ftl"), StandardCharsets.UTF_8), config);
        Map<String, Object> props = new HashMap<>();
        props.put("elementUniqueKey", "test");
        props.put("id", "items");
        props.put("label", "Example Grid");
        props.put("readonly", readonly ? "true" : "");
        props.put("enableSorting", "true");
        props.put("sortField", "sort");
        if (previewPageSize != null) props.put("importPreviewPageSize", previewPageSize);
        Map<String, Object> model = new HashMap<>();
        model.put("element", Collections.singletonMap("properties", props));
        model.put("request", new Request());
        model.put("elementParamName", "items");
        model.put("appId", "testApp");
        model.put("appVersion", 1);
        model.put("effectiveFormDefId", "areass");
        model.put("decoration", "");
        model.put("headers", Collections.emptyMap());
        model.put("rows", Collections.emptyList());
        model.put("optionsJson", "{}");
        model.put("importEnabled", enabled);
        model.put("editableEnabled", editable);
        model.put("nestedEnabled", nested);
        model.put("nestedReadonly", readonly);
        model.put("nestedRelationsJson", "[{\"gridId\":\"areas\",\"label\":\"Areas <script> & \\\"quoted\\\"\",\"foreignKey\":\"plantId\"}]");
        model.put("editableColumnsJson", "[{\"id\":\"name\",\"label\":\"Name & <Label>\",\"editor\":\"TextField\"}]");
        model.put("importLabels", new FormGridCustom().getImportLabels());
        model.put("importColumnsJson", "[{\"id\":\"name\",\"label\":\"Name & <Label>\",\"type\":\"text\"}]");
        StringWriter out = new StringWriter();
        template.process(model, out);
        return out.toString();
    }

    @Test
    public void nestedConfigurationIsOptInEscapedAndReceivesReadonlyState() throws Exception {
        String html = render(false, true, null, false, true);
        assertTrue(html.contains("grid.formGridNested({relations: JSON.parse("));
        assertTrue(html.contains("readonly: true"));
        assertTrue(html.contains("class=\"formgrid-nested-config\""));
        assertTrue(html.contains("Areas &lt;script&gt; &amp;"));
        assertTrue(html.contains("class=\"formgrid-field-id\" value=\"items\""));
        assertTrue(html.contains("class=\"formgrid-form-id\" value=\"areass\""));
        String plain = render(false, false);
        assertFalse(plain.contains("grid.formGridNested({"));
        assertFalse(plain.contains("class=\"formgrid-nested-config\""));
    }

    @Test
    public void enabledImportRendersEscapedSchemaAndInitializer() throws Exception {
        String html = render(true, false);
        assertTrue(html.contains("grid.formGridImport({"));
        assertTrue(html.contains("sortField: 'sort'"));
        assertTrue(html.contains("Name &amp; &lt;Label&gt;"));
        assertTrue(html.contains("accept=\".xlsx,.xls,.csv\""));
        assertTrue(html.contains("formgrid-import-confirm\" disabled"));
        assertTrue(html.contains("vendor/xlsx.full.min.js?v=2.9.0"));
        assertTrue(html.contains("Download Excel Template"));
        assertFalse(html.contains("previewPageSize:"));
        assertTrue(html.contains("class=\"formgrid-import-pagination\""));
        assertTrue(html.contains("value=\"100\""));
        assertTrue(html.contains("Excel / CSV file"));
        assertTrue(html.contains("Import Rows"));
        assertFalse(html.contains("@@form.formgrid.import."));
        assertTrue(html.contains("aria-expanded=\"false\""));
        assertTrue(html.contains("formgrid-import-footer"));
    }

    @Test
    public void editableSchemaIsEscapedAndOptIn() throws Exception {
        String enabled = render(false, false, null, true);
        assertTrue(enabled.contains("grid.formGridEditable({"));
        assertTrue(enabled.contains("class=\"formgrid-editable-columns\""));
        assertTrue(enabled.contains("Name &amp; &lt;Label&gt;"));
        String disabled = render(false, false);
        assertFalse(disabled.contains("grid.formGridEditable({"));
        assertFalse(disabled.contains("class=\"formgrid-editable-columns\""));
    }

    @Test
    public void legacyPreviewPageSizeIsNotPassedToImporter() throws Exception {
        String html = render(true, false, "50");
        assertFalse(html.contains("previewPageSize:"));
        assertTrue(html.contains("class=\"formgrid-import-page-size\""));
    }

    @Test
    public void disabledImportDoesNotRenderControlsOrInitializer() throws Exception {
        String html = render(false, false);
        assertFalse(html.contains("grid.formGridImport({"));
        assertFalse(html.contains("class=\"formgrid-import-panel\""));
        assertFalse(html.contains("vendor/xlsx.full.min.js"));
    }

    @Test
    public void readonlyRenderWithoutImportKeepsControlsHidden() throws Exception {
        String html = render(false, true);
        assertFalse(html.contains("class=\"formgrid-import-panel\""));
        assertFalse(html.contains("class=\"btn btn-primary grid-action-add"));
    }
}
