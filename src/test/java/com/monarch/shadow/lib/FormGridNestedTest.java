package com.monarch.shadow.lib;

import org.joget.apps.form.model.FormData;
import org.joget.apps.form.model.Form;
import org.joget.apps.form.model.Element;
import org.joget.apps.form.model.FormRow;
import org.joget.apps.form.model.FormRowSet;
import org.joget.apps.form.model.FormBinder;
import org.joget.apps.form.lib.WorkflowFormBinder;
import org.json.JSONArray;
import org.junit.Test;
import java.util.*;
import static org.junit.Assert.*;

public class FormGridNestedTest {
    private static class Grid extends FormGridCustom {
        final FormRowSet rows = new FormRowSet();
        final Map<String, Grid> grids = new HashMap<>();
        final Set<String> fields = new HashSet<>(Arrays.asList("name", "parentId"));
        final Set<String> forms = new HashSet<>(Arrays.asList("areass", "areaForm"));
        Grid(String id) { setProperty("id", id); }
        @Override protected FormRowSet getRows(FormData data) { return rows; }
        @Override protected FormGridCustom findNestedGrid(String id, FormData data) { return grids.get(id); }
        @Override protected boolean hasNestedField(String id, FormData data) { return fields.contains(id); }
        @Override protected boolean nestedFormExists(String id) { return forms.contains(id); }
        void row(String id, String parent) {
            FormRow row = new FormRow(); row.setId(id); row.setProperty("name", id);
            if (parent != null) row.setProperty("parentId", parent);
            rows.add(row);
        }
    }
    private static Map<String, String> relation(String child, String parent) {
        Map<String, String> result = new HashMap<>();
        result.put("gridId", child); result.put("parentGridId", parent); result.put("foreignKey", "parentId");
        return result;
    }
    private Grid hierarchy() {
        Grid root = new Grid("plants"); root.row("p1", null); root.row("p2", null);
        Grid areas = new Grid("areas"); areas.row("a1", "p1"); areas.row("a2", "p2");
        Grid groups = new Grid("groups"); groups.row("g1", "a1");
        Grid types = new Grid("types"); types.row("t1", "g1");
        Grid tags = new Grid("tags"); tags.row("tag1", "t1");
        Grid parameters = new Grid("parameters"); parameters.row("param1", "tag1");
        for (Grid grid : Arrays.asList(areas, groups, types, tags, parameters)) root.grids.put(grid.getPropertyString("id"), grid);
        root.setProperty("nestedChildren", new Object[]{relation("parameters", "tags"), relation("types", "groups"),
                relation("areas", ""), relation("groups", "areas"), relation("tags", "types")});
        return root;
    }
    @Test public void sixLevelsUseConfigurationAndCanExtendWithoutPluginChanges() {
        Grid root = hierarchy();
        assertTrue(root.validateNestedRows(new FormData()));
        Grid readings = new Grid("readings"); readings.row("r1", "param1"); root.grids.put("readings", readings);
        Object[] old = (Object[]) root.getProperty("nestedChildren");
        Object[] extended = Arrays.copyOf(old, old.length + 1); extended[old.length] = relation("readings", "parameters");
        root.setProperty("nestedChildren", extended);
        assertTrue(root.validateNestedRows(new FormData()));
    }
    @Test public void orphanForeignKeysAndDeletedParentsAreRejectedOnServer() {
        Grid root = hierarchy(); root.grids.get("parameters").rows.get(0).setProperty("parentId", "missing");
        FormData data = new FormData(); assertFalse(root.validateNestedRows(data));
        assertTrue(data.getFormErrors().values().toString().contains("no matching parent"));
        root = hierarchy(); root.grids.get("areas").rows.remove(0);
        assertFalse(root.validateNestedRows(new FormData()));
    }
    @Test public void parentKeysMustBeNonemptyAndUniqueAndMayUseBusinessFields() {
        Grid root = hierarchy(); root.rows.get(1).setId("p1");
        assertFalse(root.validateNestedRows(new FormData()));
        root = hierarchy(); root.rows.get(0).remove("id");
        assertFalse(root.validateNestedRows(new FormData()));
        root = hierarchy();
        for (Object item : (Object[]) root.getProperty("nestedChildren")) {
            Map<String, String> config = (Map<String, String>) item;
            if ("areas".equals(config.get("gridId"))) config.put("parentKey", "name");
        }
        assertTrue(root.validateNestedRows(new FormData()));
    }
    @Test public void cyclesUnknownParentsDuplicateAndMissingChildrenAreRejected() {
        for (Object[] configs : new Object[][]{
                {}, {relation("missing", "")}, {relation("areas", "missing")},
                {relation("areas", "groups"), relation("groups", "areas")},
                {relation("areas", ""), relation("areas", "")}, {relation("plants", "")} }) {
            Grid root = hierarchy(); root.setProperty("nestedChildren", configs);
            assertFalse(root.validateNestedRows(new FormData()));
        }
    }
    @Test public void missingForeignKeyFieldsAndNestedChildRootsAreConfigurationErrors() {
        Grid root = hierarchy(); root.grids.get("areas").fields.remove("parentId");
        assertFalse(root.validateNestedRows(new FormData()));
        root = hierarchy(); root.grids.get("areas").setProperty("enableNested", "true");
        assertFalse(root.validateNestedRows(new FormData()));
    }
    @Test public void schemaIsWhitelistedAndDefaultsAreSerializedWithoutJavascriptInterpolation() {
        Grid root = hierarchy(); Map<String, String> config = relation("areas", "");
        config.put("label", "Areas <script> & \"quotes\""); config.put("sql", "must not be exposed");
        config.put("sortWithButtons", "true"); config.put("enableDuplicate", "false");
        config.put("formDefId", "areass");
        root.setProperty("nestedChildren", new Object[]{config});
        JSONArray schema = new JSONArray(root.getNestedRelationsJson());
        assertEquals("Areas <script> & \"quotes\"", schema.getJSONObject(0).getString("label"));
        assertFalse(schema.getJSONObject(0).has("sql"));
        assertEquals("", schema.getJSONObject(0).getString("parentKey"));
        assertEquals("true", schema.getJSONObject(0).getString("sortWithButtons"));
        assertEquals("false", schema.getJSONObject(0).getString("enableDuplicate"));
        assertEquals("sort", schema.getJSONObject(0).getString("sortField"));
        assertEquals("areass", schema.getJSONObject(0).getString("formDefId"));
    }

    @Test public void nestedSortFieldIsIndependentOfChildSortingAndActionSettingsAreValidated() {
        Grid root = hierarchy(); Map<String, String> config = relation("areas", "");
        config.put("sortWithButtons", "true"); root.setProperty("nestedChildren", new Object[]{config});
        FormData data = new FormData(); assertFalse(root.validateNestedRows(data));
        assertTrue(data.getFormErrors().values().toString().contains("Nested Sort Field"));
        Grid child = root.grids.get("areas"); child.setProperty("enableSorting", "false"); child.setProperty("sortField", "unrelatedOrder");
        child.fields.add("sort"); assertTrue(root.validateNestedRows(new FormData()));
        config.put("sortField", "nestedOrder"); assertFalse(root.validateNestedRows(new FormData()));
        child.fields.add("nestedOrder"); assertTrue(root.validateNestedRows(new FormData()));
        config.put("enableDuplicate", "invalid"); assertFalse(root.validateNestedRows(new FormData()));
        config.put("enableDuplicate", "false"); config.put("sortWithButtons", "false");
        child.setProperty("enableSorting", ""); assertTrue(root.validateNestedRows(new FormData()));
    }

    @Test public void missingActionSettingsUseFixedDefaultsWithoutInheritingChildFlags() {
        Grid root = hierarchy();
        JSONArray schema = new JSONArray(root.getNestedRelationsJson());
        for (int i = 0; i < schema.length(); i++) {
            assertEquals("false", schema.getJSONObject(i).getString("sortWithButtons"));
            assertEquals("false", schema.getJSONObject(i).getString("enableDuplicate"));
            assertEquals("sort", schema.getJSONObject(i).getString("sortField"));
        }
    }

    @Test public void nestedRelationSortFieldPersistsOrderingWithSourceSortingTurnedOff() {
        Grid root = new Grid("plants"), child = new Grid("areas");
        Form containing = new Form(); containing.setProperty("id", "main");
        root.setParent(containing); child.setParent(containing); containing.setChildren(Arrays.asList(root, child));
        root.setProperty("enableNested", "true");
        Map<String, String> config = relation("areas", ""); config.put("sortWithButtons", "true"); config.put("sortField", "nestedOrder");
        root.setProperty("nestedChildren", new Object[]{config});
        child.setProperty("enableSorting", "false"); child.setProperty("sortField", "sourceOrder");
        assertEquals("nestedOrder", child.getEffectiveSortField());
        FormRowSet submitted = new FormRowSet();
        for (String id : Arrays.asList("a3", "a1")) {
            FormRow row = new FormRow(); row.setProperty("jsonrow", "{\"id\":\"" + id + "\",\"parentId\":\"p1\",\"sourceOrder\":\"77\"}");
            submitted.add(row);
        }
        FormRowSet stored = child.convertJsonToFormRowSet(submitted);
        assertEquals("a3", stored.get(0).getId()); assertEquals("0", stored.get(0).getProperty("nestedOrder"));
        assertEquals("a1", stored.get(1).getId()); assertEquals("1", stored.get(1).getProperty("nestedOrder"));
        assertEquals("77", stored.get(0).getProperty("sourceOrder"));
        config.put("sortWithButtons", "false"); assertEquals("", child.getEffectiveSortField());
    }

    @Test public void loadingNestedRowsRestoresTheRelationSortOrderWithSourceSortingTurnedOff() {
        Grid root = new Grid("plants"); FormGridCustom child = new FormGridCustom(); child.setProperty("id", "areas");
        Form containing = new Form(); containing.setProperty("id", "main");
        root.setParent(containing); child.setParent(containing); containing.setChildren(Arrays.asList(root, child));
        root.setProperty("enableNested", "true");
        Map<String, String> config = relation("areas", ""); config.put("sortWithButtons", "true"); config.put("sortField", "nestedOrder");
        root.setProperty("nestedChildren", new Object[]{config}); child.setProperty("enableSorting", "false");
        final FormRowSet loaded = new FormRowSet(); loaded.setMultiRow(true);
        for (int rank : Arrays.asList(2, 0, 1)) {
            FormRow row = new FormRow(); row.setId("a" + rank); row.setProperty("nestedOrder", Integer.toString(rank)); loaded.add(row);
        }
        FormData data = new FormData() {
            @Override public FormRowSet getLoadBinderData(Element element) { return loaded; }
        };
        FormRowSet rows = child.getRows(data);
        assertEquals("a0", rows.get(0).getId()); assertEquals("a1", rows.get(1).getId()); assertEquals("a2", rows.get(2).getId());
    }

    @Test public void reorderedChildRowsPersistTheirSequenceAndForeignKeysThroughStandardFormatting() {
        Grid child = new Grid("areas"); child.setProperty("enableSorting", "true"); child.setProperty("sortField", "sort");
        FormRowSet submitted = new FormRowSet();
        String[] ids = {"a3", "a2", "a1"}; String[] parents = {"p1", "p2", "p1"};
        for (int i = 0; i < ids.length; i++) {
            FormRow row = new FormRow(); row.setProperty("jsonrow", "{\"id\":\"" + ids[i] + "\",\"parentId\":\"" + parents[i] + "\",\"sort\":\"99\"}");
            submitted.add(row);
        }
        FormRowSet stored = child.convertJsonToFormRowSet(submitted);
        for (int i = 0; i < ids.length; i++) {
            assertEquals(ids[i], stored.get(i).getId());
            assertEquals(parents[i], stored.get(i).getProperty("parentId"));
            assertEquals(Integer.toString(i), stored.get(i).getProperty("sort"));
        }
    }

    @Test public void childFormSelectionOverridesSourceFormAndSynchronizesConfiguredBinderForms() {
        Grid root = new Grid("plants"), child = new Grid("areasGrid");
        Form containing = new Form(); containing.setProperty("id", "main");
        containing.setChildren(Arrays.asList(root, child)); root.setParent(containing); child.setParent(containing);
        root.setProperty("enableNested", "true"); child.setProperty("formDefId", "oldForm");
        Map<String, String> config = relation("areasGrid", ""); config.put("formDefId", "areass");
        root.setProperty("nestedChildren", new Object[]{config});
        WorkflowFormBinder load = new WorkflowFormBinder(), store = new WorkflowFormBinder();
        for (FormBinder binder : Arrays.asList(load, store)) {
            binder.setProperty("formDefId", "oldForm"); binder.setProperty("foreignKey", "fk"); binder.setProperty("customCondition", "keep");
        }
        child.setLoadBinder(load); child.setStoreBinder(store);
        assertEquals("areass", child.getEffectiveFormDefId());
        assertSame(load, child.getLoadBinder()); assertEquals("areass", load.getPropertyString("formDefId"));
        assertEquals("areass", ((FormBinder) child.getStoreBinder()).getPropertyString("formDefId"));
        assertEquals("areass", store.getPropertyString("formDefId"));
        assertEquals("fk", store.getPropertyString("foreignKey")); assertEquals("keep", load.getPropertyString("customCondition"));
        config.put("formDefId", "areaForm"); assertEquals("areaForm", child.getEffectiveFormDefId());
        child.getLoadBinder(); child.getStoreBinder();
        assertEquals("areaForm", load.getPropertyString("formDefId")); assertEquals("areaForm", store.getPropertyString("formDefId"));
        WorkflowFormBinder custom = new WorkflowFormBinder(); custom.setProperty("foreignKey", "ownerId");
        child.setLoadBinder(custom); child.getLoadBinder();
        assertFalse(custom.getProperties().containsKey("formDefId"));
        assertEquals("ownerId", custom.getPropertyString("foreignKey"));
    }

    @Test public void unknownChildFormsAreRejectedAndLegacyMappingsKeepSourceFormSelection() {
        Grid root = hierarchy(); Map<String, String> config = relation("areas", ""); config.put("formDefId", "missing");
        root.setProperty("nestedChildren", new Object[]{config});
        FormData data = new FormData(); assertFalse(root.validateNestedRows(data));
        assertTrue(data.getFormErrors().values().toString().contains("Child Form ID not found"));
        config.put("formDefId", "areass"); assertTrue(root.validateNestedRows(new FormData()));
        Grid standalone = new Grid("standalone"); standalone.setProperty("formDefId", "original");
        assertEquals("original", standalone.getEffectiveFormDefId());
        WorkflowFormBinder custom = new WorkflowFormBinder(); custom.setProperty("foreignKey", "ownerId");
        standalone.setLoadBinder(custom); standalone.getLoadBinder();
        assertFalse(custom.getProperties().containsKey("formDefId"));
    }
}
