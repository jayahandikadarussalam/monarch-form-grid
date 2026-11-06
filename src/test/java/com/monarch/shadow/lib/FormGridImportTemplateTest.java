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
        Configuration config = new Configuration();
        config.setTemplateExceptionHandler(TemplateExceptionHandler.RETHROW_HANDLER);
        Template template = new Template("FormGridCustom.ftl", new InputStreamReader(
                getClass().getResourceAsStream("/templates/FormGridCustom.ftl"), StandardCharsets.UTF_8), config);
        Map<String, Object> props = new HashMap<>();
        props.put("elementUniqueKey", "test");
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
        model.put("decoration", "");
        model.put("headers", Collections.emptyMap());
        model.put("rows", Collections.emptyList());
        model.put("optionsJson", "{}");
        model.put("importEnabled", enabled);
        model.put("importLabels", new FormGridCustom().getImportLabels());
        model.put("importColumnsJson", "[{\"id\":\"name\",\"label\":\"Name & <Label>\",\"type\":\"text\"}]");
        StringWriter out = new StringWriter();
        template.process(model, out);
        return out.toString();
    }

    @Test
    public void enabledImportRendersEscapedSchemaAndInitializer() throws Exception {
        String html = render(true, false);
        assertTrue(html.contains("grid.formGridImport({"));
        assertTrue(html.contains("sortField: 'sort'"));
        assertTrue(html.contains("Name &amp; &lt;Label&gt;"));
        assertTrue(html.contains("accept=\".xlsx,.xls,.csv\""));
        assertTrue(html.contains("formgrid-import-confirm\" disabled"));
        assertTrue(html.contains("vendor/xlsx.full.min.js?v=2.2.0"));
        assertTrue(html.contains("Download Excel Template"));
        assertTrue(html.contains("previewPageSize: '10'"));
        assertTrue(html.contains("class=\"formgrid-import-pagination\""));
        assertTrue(html.contains("value=\"100\""));
        assertTrue(html.contains("Excel / CSV file"));
        assertTrue(html.contains("Import Rows"));
        assertFalse(html.contains("@@form.formgrid.import."));
        assertTrue(html.contains("aria-expanded=\"false\""));
        assertTrue(html.contains("formgrid-import-footer"));
    }

    @Test
    public void configuredPreviewPageSizeIsPassedToImporter() throws Exception {
        String html = render(true, false, "50");
        assertTrue(html.contains("previewPageSize: '50'"));
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
