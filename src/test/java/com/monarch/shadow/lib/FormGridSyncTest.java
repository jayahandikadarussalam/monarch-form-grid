package com.monarch.shadow.lib;

import org.joget.apps.form.lib.HiddenField;
import org.joget.apps.form.lib.SelectBox;
import org.joget.apps.form.lib.TextField;
import org.joget.apps.form.model.*;
import org.json.JSONObject;
import org.junit.Test;
import java.util.*;
import static org.junit.Assert.*;

public class FormGridSyncTest {
    private static class Grid extends FormGridCustom {
        final Form outer = new Form();
        final TextField target = new TextField();
        Grid() {
            setProperty("id", "items");
            setParent(outer);
            outer.setProperty("id", "main");
            SelectBox source = new SelectBox(); source.setProperty("id", "dept"); source.setParent(outer);
            outer.setChildren(new ArrayList<>(Arrays.asList(source, this)));
            form = new Form(); form.setProperty("id", "child");
            target.setProperty("id", "department"); target.setParent(form);
            HiddenField fk = new HiddenField(); fk.setProperty("id", "parentId"); fk.setParent(form);
            form.setChildren(Arrays.asList(target, fk));
            mapping("dept", "department", "", "");
        }
        @Override protected Form getForm() { return form; }
        void mapping(String source, String target, String mode, String empty) {
            Map<String, String> mapping = new HashMap<>();
            mapping.put("source", source); mapping.put("target", target); mapping.put("mode", mode); mapping.put("empty", empty);
            setProperty("fieldSyncMappings", new Object[]{mapping});
        }
        JSONObject config() { return new JSONObject(getFieldSyncConfigJson(new FormData())); }
    }
    @Test public void serializesDefaultsAndResolvedFieldNamesWithoutEnablingInitialSync() {
        JSONObject config = new Grid().config();
        assertFalse(config.has("error")); assertFalse(config.getBoolean("syncOnLoad"));
        JSONObject mapping = config.getJSONArray("mappings").getJSONObject(0);
        assertEquals("dept", mapping.getString("sourceParam"));
        assertEquals("department", mapping.getString("targetParam"));
        assertEquals("always", mapping.getString("mode")); assertEquals("clear", mapping.getString("empty"));
        assertEquals("value", mapping.getString("get"));
    }
    @Test public void preservesSelectedModesAndExplicitInitialSync() {
        Grid grid = new Grid(); grid.mapping("dept", "department", "empty", "keep"); grid.setProperty("fieldSyncOnLoad", "true");
        JSONObject config = grid.config(); assertTrue(config.getBoolean("syncOnLoad"));
        assertEquals("empty", config.getJSONArray("mappings").getJSONObject(0).getString("mode"));
        assertEquals("keep", config.getJSONArray("mappings").getJSONObject(0).getString("empty"));
    }
    @Test public void serializesLabelModeAndRejectsUnknownGetOptions() {
        Grid grid = new Grid();
        Map<String,String> mapping = new HashMap<>(); mapping.put("source", "dept"); mapping.put("target", "department"); mapping.put("get", "label");
        grid.setProperty("fieldSyncMappings", new Object[]{mapping});
        assertEquals("label", grid.config().getJSONArray("mappings").getJSONObject(0).getString("get"));
        mapping.put("get", "invalid"); assertTrue(grid.config().getString("error").contains("Get option"));
    }
    @Test public void rejectsUnknownFieldsSystemFieldsDuplicateTargetsAndInvalidModes() {
        for (String[] fields : new String[][]{{"missing","department"},{"dept","missing"},{"dept","id"},{"dept","_tempRequestParamsMap"},{"dept","constructor"}}) {
            Grid grid = new Grid(); grid.mapping(fields[0], fields[1], "always", "clear"); assertTrue(grid.config().has("error"));
        }
        Grid grid = new Grid(); grid.mapping("dept", "department", "invalid", "clear"); assertTrue(grid.config().has("error"));
        grid.mapping("dept", "department", "always", "invalid"); assertTrue(grid.config().has("error"));
        grid.mapping("dept", "department", "always", "clear"); Object entry = ((Object[]) grid.getProperty("fieldSyncMappings"))[0];
        grid.setProperty("fieldSyncMappings", new Object[]{entry, entry}); assertTrue(grid.config().getString("error").contains("Duplicate"));
        grid.setProperty("fieldSyncMappings", new Object[]{}); assertTrue(grid.config().has("error"));
    }
    @Test public void readonlyEncryptedAndManagedSortFieldsAreNotTargets() {
        Grid grid = new Grid(); grid.target.setProperty("readonly", "true"); assertTrue(grid.config().has("error"));
        grid.target.setProperty("readonly", "false"); grid.target.setProperty("encryption", "true"); assertTrue(grid.config().has("error"));
        grid.target.setProperty("encryption", "false"); grid.setProperty("enableSorting", "true"); grid.setProperty("sortField", "department");
        assertTrue(grid.config().getString("error").contains("Managed field"));
    }
    @Test public void nestedForeignKeysAndCustomParentKeysAreProtected() {
        Grid grid = new Grid(); FormGridCustom root = new FormGridCustom();
        root.setProperty("id", "plants"); root.setProperty("enableNested", "true"); root.setParent(grid.outer);
        Map<String,String> relation = new HashMap<>(); relation.put("gridId", "items"); relation.put("foreignKey", "parentId"); relation.put("parentKey", "department");
        root.setProperty("nestedChildren", new Object[]{relation}); grid.outer.getChildren().add(root);
        grid.mapping("dept", "parentId", "always", "clear"); assertTrue(grid.config().getString("error").contains("Managed field"));
        grid.mapping("dept", "department", "always", "clear"); assertFalse(grid.config().has("error"));
        grid.setProperty("enableNested", "true");
        Map<String,String> child = new HashMap<>(); child.put("gridId", "types"); child.put("parentKey", "department"); child.put("foreignKey", "areaId");
        grid.setProperty("nestedChildren", new Object[]{child}); assertTrue(grid.config().getString("error").contains("Managed field"));
    }
}
