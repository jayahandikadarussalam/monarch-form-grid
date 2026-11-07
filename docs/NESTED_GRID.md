# Dynamic nested subgrids

Version 2.12.0 provides optional expandable parent/child views. Nesting is disabled by default. Configure the complete hierarchy on one root Shadow Form Grid; additional tables and levels require Form Builder configuration, without rebuilding the plugin.

## Form Builder setup

1. Create the Joget Forms backing your tables: Plant, Area, Equipment Group, Equipment Type, Tag, and Parameter. Include a foreign key field in each child Form (`plantId`, `areaId`, `equipmentGroupId`, `equipmentTypeId`, `tagId`). Hidden Fields are supported. These fields hold the immediate parent row's `id`.
2. Place six Shadow Form Grid elements in the **same containing form / subform scope**, with IDs `plants`, `areas`, `equipmentGroups`, `equipmentTypes`, `tags`, and `parameters`. Configure Columns and load/store binders on each grid. Select its corresponding Child Form ID in the root grid's nested relation row. Field IDs must be unique within that scope. Keep **Enable Nested Subgrids** off on every child grid.
3. On `plants`, open **Nested Subgrids**, check **Enable Nested Subgrids**, and fill **Child Tables / Subgrids**:

| Child Grid ID | Child Form ID | Subgrid Label | Parent Grid ID | Parent Key Field | Child Foreign Key Field |
| --- | --- | --- | --- | --- | --- |
| areas | areaForm | Areas | *(empty)* | id | plantId |
| equipmentGroups | equipmentGroupForm | Equipment Groups | areas | id | areaId |
| equipmentTypes | equipmentTypeForm | Equipment Types | equipmentGroups | id | equipmentGroupId |
| tags | tagForm | Tags | equipmentTypes | id | equipmentTypeId |
| parameters | parameterForm | Parameters | tags | id | tagId |

The root grid is the default parent when Parent Grid ID is empty. Parent Key Field defaults to `id`. You can instead use a stable, non-empty, unique field from the parent Form. Use Form Field IDs, without the database `c_` prefix. Definition order does not matter. Multiple children can reference the same parent grid to create branches.

The child Form's configured table determines the database table. Child Grid ID identifies a **Form Grid element**, not a Form Definition ID or SQL table name. Configure the foreign key field in the child Form even if it is omitted from visible Columns. Display columns can be configured directly in **Nested Columns** on the root grid.

## Configure nested display columns

Open **Nested Subgrids → Nested Columns**, below Child Tables / Subgrids. This uses the same native property grid as the main Columns setting, with an additional **Child Grid ID** dropdown to identify the subgrid:

Each column configuration is displayed in two rows on a wide panel: Child Grid ID, Field ID, Label, and Format Type on top; Format, Width, Visibility, and native Move/Delete controls below. Narrow panels wrap into fewer columns. Native CSV input and stored column order are preserved.

| Child Grid ID | Field ID | Label | Format Type | Format | Width | Visibility |
| --- | --- | --- | --- | --- | --- | --- |
| areasGrid | name | Area Name | Text | | 35% | Yes |
| areasGrid | inspectionDate | Inspection Date | Date | yyyy-MM-dd | 180px | Yes |
| areasGrid | parentid | Parent | Text | | | No |

The dropdown lists the Child Grid IDs configured above. Field ID autocomplete uses the selected child's **Child Form ID**, so adding a field to the Area Form makes it discoverable here after reloading Form Builder. Select or type the Field ID without `c_`, then choose its label, format, width, and visibility. The example `inspectionDate` must exist in that child Form before it can be used.

Rows determine the display order within each child; use the native Move Up/Move Down controls to reorder them. All native format choices are available: Text, HTML, newline to BR, Decimal, Currency, Date, File, Image, and Options. Formatting uses the child grid's existing server/client formatter, popup Form, and option/file metadata. **Visibility = No** hides the column while preserving its row data.

When a child has at least one Nested Columns entry, those entries define its complete column list and override that source grid's Columns. A child with no entries uses its existing source Columns. Other children and the root grid's Columns are unaffected. Removing all entries for a child restores its source Columns after saving the configuration and reloading the form. The source grid and its binders must still exist; Nested Columns configures display fields and does not create Form fields or database columns.

The separate Nested Columns CSV order is:

```text
Child Grid ID;Field ID;Label;Format Type;Format;Width;Visibility
areasGrid;name;Area Name;text;;35%;yes
```

Its stored property is `nestedColumns`; Child Tables / Subgrids keeps its original nine CSV columns and appends Disable Duplicate as the tenth column. Unknown child mappings, fields missing from the selected Form, duplicate Field IDs within a child, and invalid format/visibility values produce configuration errors. If a child is removed or renamed, its previous selection remains visible as “not configured” until corrected.

## Select the child Form directly in nested properties

**Child Form ID** is a required dropdown next to **Child Grid ID**. It lists Forms in the current app. Choose the Form in Form Builder; editing JSON definitions is not necessary.

| Property | Meaning | Area example |
| --- | --- | --- |
| Child Grid ID | ID of an existing Shadow Form Grid element in the containing form; this grid supplies Columns and binders. | `areasGrid` |
| Child Form ID | Actual Form Definition ID selected from the Form list. This Form supplies the popup and its configured table. | `areass` (display name: Area) |
| Child Foreign Key Field | A field in the selected Form that holds the immediate parent row's key. | `parentid` |

The mapping `areasGrid → areass → j_sc_grid2_area` is now explicit in nested properties. At runtime, the selected Child Form ID determines the child Form used by Add, Edit, Duplicate, field metadata, and validation. Configured load/store binders that expose a `formDefId` property are synchronized to the selected Form before they execute; their FK/filter/other properties are preserved. Custom binders without a `formDefId` property retain their own configuration, so configure their data source to match the selected Form.

The referenced child grid must still exist in the same containing form. Selecting a Form does not create another grid or database table. Unknown Form IDs are rejected server-side; stale rendered mappings produce a visible reload message. Legacy mappings without Child Form ID continue using the source grid's configured Form; choose the dropdown when updating those properties.

**Field suggestions** use Joget's native Form columns endpoint and autocomplete widget. Focus or type in **Child Foreign Key Field** or **Sort Field** to choose fields from that row's selected Child Form ID. **Parent Key Field** suggests fields from the root grid's Form when Parent Grid ID is empty, or from the selected parent's Child Form ID for deeper levels. Results include the Form/table fields and system fields returned by Joget. Changing a Form or parent updates the suggestion source; delayed responses from the previous selection are ignored. You can still enter a Field ID manually. If suggestions cannot load, refocus to retry. Field suggestions do not create missing fields or change saved field values.

For the supplied Area example, the CSV column order is:

```text
Child Grid ID;Child Form ID;Subgrid Label;Parent Grid ID;Parent Key Field;Child Foreign Key Field;Sort with Buttons;Sort Field;Duplicate;Disable Duplicate
```

Paste this row into the property grid's CSV input:

```text
areasGrid;areass;Areas;;id;parentid;true;sort;true;false
```

## Independent nested properties and duplication popups

Configure actions separately for every relation in **Nested Subgrids → Child Tables / Subgrids**:

| Setting | Options/default | Behavior |
| --- | --- | --- |
| Sort with Buttons | Checkbox; default unchecked | Shows up/down icons for rows with the same parent. |
| Sort Field | Form Field ID; default `sort` | Visible only while Sort with Buttons is checked. Persists this nested grid's row order. Add a corresponding field, normally a Hidden Field, to its child Form. |
| Disable Duplicate | Checkbox; default unchecked | Hides the Duplicate mode selector and removes the copy icon for this relation. The selected mode is retained. |
| Duplicate | Dropdown: Default or Popup Dialog; default Default | Default duplicates immediately; Popup Dialog opens the child Form before inserting the copy. |

Each child configuration is displayed as two rows on a wide properties panel:

- Top: Child Grid ID, Child Form ID, Subgrid Label, Parent Grid ID, Parent Key Field.
- Bottom: Child Foreign Key Field, Sort with Buttons checkbox, conditional Sort Field, Disable Duplicate checkbox, and conditional Duplicate dropdown. Native move/delete controls sit in the right gutter.

The fields wrap further when the properties panel is narrow. The native Form dropdown, required-field validation, Add/Move/Delete controls and CSV input remain available. Unchecking Sort with Buttons hides Sort Field without clearing its value. Each row controls its own visibility, including rows added or loaded through CSV.

These are independent nested properties. They do not inherit the root or source child grid's Enable Sorting, Disable Duplicate, or Duplicate Mode. There is no “Use Child Grid Settings” option. Legacy blank action values use the defaults above. The original CSV column order and property keys are retained; `disabledDuplicate` is appended with default `false` for legacy mappings: the existing `enableDuplicate` key now selects the mode, with `false` = Default and `true` = Popup Dialog. Previously checked configurations retain popup behavior; previously unchecked configurations now duplicate directly. Both dropdown choices offer duplication while Disable Duplicate is unchecked, subject to Read Only, Disable Add, and maximum rows.

For persisted ordering, add a hidden field such as `sort` to the child Form and select it as **Sort Field in the nested relation row**. You do not need to enable sorting on the source child grid. On submit, the child grid uses the relation's Sort Field to store the ordering; on load it restores that ordering. The first child's Up button and last child's Down button are disabled separately for each parent. Sorting one parent's children preserves the order of other parents' children. The Sort Field must be separate from `id` and the child FK.

Enabling **Sort with Buttons** also displays a **No.** column in the nested view. Numbers start at 1 for each parent and refresh after moving, adding, or deleting rows. The source child grid's **Show Row Number** option also displays this column when sort buttons are off. These display numbers do not become Form fields or enter the submitted row JSON. A parent with one child shows number 1 and both move buttons disabled.

With **Duplicate = Default**, clicking the copy icon immediately inserts a copy beside its source, with a new ID and the same parent FK. With **Duplicate = Popup Dialog**, the configured child Form opens with the original row's values and a new ID. **No new row is added until that popup is submitted successfully.** Canceling adds nothing. The submitted copy is assigned back to the same parent FK, including temporary binder request parameters. The selected nested mode takes precedence over the source grid's popup setting; Default also bypasses the source grid's automatic popup for unique fields, retaining its unique-value suffix and validation. Duplicating a row copies its values without copying its descendants. Read Only, Disable Add, maximum rows, and Unique Column validation remain enforced.

Example for the supplied Area setup: relation `areasGrid` → **Sort with Buttons = checked**, **Sort Field = sort**, **Duplicate = Popup Dialog**; Area Form `areass` → Hidden Field **sort**. The source child grid's own sorting and popup-duplicate settings may remain off. The example JSON files in `outputs/nested-grid-config/` include this independent configuration. The ninth CSV value selects the mode (`false` for Default, `true` for Popup Dialog); the tenth value disables duplication when `true`. Existing nine-column mappings default to Disable Duplicate unchecked.

The main grid uses **UI → Duplicate → Duplicate Mode** with the same choices: **Default** (`false`) copies immediately, and **Popup Dialog** (`true`) opens its Form first. Existing checkbox values retain these meanings; blank values default to immediate copying. Unique Column still receives a copy suffix and is validated in Default mode. **Disable Duplicate** remains a separate main-grid checkbox; checking it hides Duplicate Mode, and unchecking it shows the mode selector again. Each nested relation keeps its own selected mode.

## Load and store binders

Every grid remains the owner of its submitted rows. Nested views do not run SQL, replace binder classes, or create database tables/constraints. The explicit Child Form ID synchronizes the Form selection on binders that have a `formDefId` setting. The source child grids are hidden automatically, but their named JSON inputs remain enabled and submit normally. Configure the binders on all six grids before testing save/reload.

**Separate the containing record's ownership key from the nested relationship key.** For example, give all child tables a `recordId` field for the enclosing form record. Configure each grid's usual multirow load/store binder to load and save records for that `recordId`. Keep `plantId`, `areaId`, etc. as ordinary persisted child Form fields; they identify the immediate nested parent. A store binder configured to overwrite `plantId` with the enclosing record ID would destroy the Plant → Area relationship.

Each child load binder must return **all relevant descendant records for the current containing record**, including children of parents on other grid pages. Restrict these binders to the current user's authorized records using your application's existing binder configuration. Expansion renders the matching child rows in the browser; database data is loaded by the ordinary binders when the form loads. It is not a separate database request per expansion.

Example stored rows:

```text
plants:          id=p1,   recordId=main1, name=Plant A
areas:           id=a1,   recordId=main1, plantId=p1
                 id=a2,   recordId=main1, plantId=p1
equipmentGroups: id=g1,   recordId=main1, areaId=a1
equipmentTypes:  id=t1,   recordId=main1, equipmentGroupId=g1
tags:            id=tag1, recordId=main1, equipmentTypeId=t1
parameters:      id=pr1,  recordId=main1, tagId=tag1
```

If you use JSON storage without store binders, each grid continues to save its own JSON field on the enclosing record; the same nesting configuration applies.

## Runtime behavior

- Each nested table has independent pagination per parent and level, starting with the source child grid's **Page Size** (default 20). **Rows per page** offers 10, 20, 50, 100 and any configured custom size, with first/previous/next/last buttons and a row/page summary. These controls also work in Read Only mode. Page and size selections survive collapse/expand, root paging, and data refreshes while the form stays open.
- Only the active nested page and its expanded descendants are rendered. Row numbers continue across pages; move buttons reorder all siblings and follow the moved row across page boundaries. Add and popup Duplicate open the page containing the new row. Deleting/filtering rows clamps the current page to the remaining pages. Pagination preserves every source row for validation and submission; the ordinary binders still load all relevant records, so it reduces nested rendering work, not database loading or the source grid's data footprint.
- **Collapse all** and **Expand all**, above the root table, close or open every configured level and branch for the currently loaded rows. These controls also work in Read Only mode and affect only their own root grid. They do not submit the Form or change row data.
- Bulk expansion includes parent rows on other grid pages. Off-page detail content is rendered when its page is opened and released when hidden, preserving expansion state. Child lookup is indexed by FK during each render. A later added parent starts collapsed; click Expand all again to include it. Collapse all clears descendant expansion state too.
- Click **+** / **−** to expand or collapse a row. Each row remembers its expanded descendants while paging or refreshing. Empty subgrids show **No related records.**
- **Add** opens the child grid's configured Form. The FK is prefilled and enforced in the callback, including temporary binder request parameters. A new row immediately belongs to the selected parent. Add honors Read Only, Disable Add, and the source grid's maximum row limit.
- The toolbar uses the same icon buttons as the root grid: Move Up, Move Down, Edit, Duplicate, and Delete, with tooltips and accessible labels.
- **Edit** and **Delete** operate on the original child grid rows using its existing popup and delete behavior. Child values are displayed in the nested view; child editing uses the popup, including when the source grid has Editable Form Grid enabled. The root grid retains inline editing.
- Read-only roots/children display child values without mutation actions. File/image download links retain their normal Form permissions.
- Parent deletion is blocked while related child rows remain. Delete leaves first. Duplicating a parent duplicates that row only; children remain attached to the original parent.
- Browser and server validation reject cycles, unknown/duplicate grid IDs, invalid field configuration, empty/duplicate parent keys, and child rows with no matching parent. The server also verifies that FK and custom parent key fields exist in the selected Forms. Invalid configuration leaves the ordinary child grids visible so the setup can be corrected.
- Changes persist when the enclosing form is saved through the configured binders. If a parent business key changes, update the children's FKs to match before saving.

To add another level, create its Form/table and grid, configure its binders, then add one relation row pointing to its parent. To return to ordinary independent grids, uncheck **Enable Nested Subgrids** and reload the form.

## Verification

Automated tests cover recursive rendering, FK isolation, Add callback enforcement, canceled popups, serialization, readonly/max-row behavior, parent deletion, paging, branching/custom keys, malformed graphs, and server relation validation through six levels plus a newly configured seventh level. Before release to an existing Joget app, test save/reload against that app's chosen binders and forms, since these are application configuration.
