package com.monarch.shadow.lib;

import org.joget.apps.form.lib.DefaultValidator;
import org.joget.apps.form.lib.TextField;
import org.joget.apps.form.model.*;
import org.json.JSONArray;
import org.junit.Test;

import java.util.*;
import static org.junit.Assert.*;

public class FormGridEditableTest {
    private static class Grid extends FormGridCustom {
        Grid() {
            setProperty("id", "items");
            form = new Form();
            form.setProperty("id", "child");
            TextField name = new TextField();
            name.setProperty("id", "name");
            name.setProperty("value", "Default must not mask an empty submitted field");
            name.setParent(form);
            DefaultValidator validator = new DefaultValidator();
            validator.setProperty("mandatory", "true");
            validator.setProperty("message", "Name is required");
            name.setValidator(validator);
            TextField locked = new TextField();
            locked.setProperty("id", "locked");
            locked.setProperty("readonly", "true");
            locked.setParent(form);
            form.setChildren(Arrays.asList(name, locked));
        }
        @Override protected Form getForm() { return form; }
        @Override protected Map<String, Map<String, Object>> getHeaderMap(FormData data) {
            Map<String, Map<String, Object>> headers = new LinkedHashMap<>();
            for (String id : Arrays.asList("name", "locked", "id")) {
                Map<String, Object> header = new HashMap<>();
                header.put("label", id); header.put("formatType", "text");
                headers.put(id, header);
            }
            return headers;
        }
    }
    @Test public void onlyWritableNonSystemFieldsReceiveEditors() {
        Grid grid = new Grid();
        FormData data = new FormData();
        JSONArray columns = new JSONArray(grid.getEditableColumnsJson(grid.getHeaderMap(data), data));
        assertEquals(1, columns.length());
        assertEquals("name", columns.getJSONObject(0).getString("id"));
    }
    @Test public void serverRunsFieldValidatorsAndIdentifiesTheInvalidRow() {
        Grid grid = new Grid();
        FormRowSet rows = new FormRowSet();
        FormRow good = new FormRow(); good.setId("first"); good.setProperty("name", "Andi"); rows.add(good);
        FormRow bad = new FormRow(); bad.setId("second"); rows.add(bad);
        FormData data = new FormData();
        assertFalse(grid.validateEditableRows(rows, data));
        assertTrue(data.getFormErrors().values().toString().contains("Row 2"));
        bad.setProperty("name", "Budi");
        assertTrue(grid.validateEditableRows(rows, new FormData()));
    }
}
