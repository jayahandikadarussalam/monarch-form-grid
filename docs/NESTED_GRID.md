# Dynamic nested subgrids

Version 2.9.0 provides optional expandable parent/child views. Nesting is disabled by default. Configure the complete hierarchy on one root Shadow Form Grid; additional tables and levels require Form Builder configuration, without rebuilding the plugin.

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

The child Form's configured table determines the database table. Child Grid ID identifies a **Form Grid element**, not a Form Definition ID or SQL table name. Configure the foreign key field in the child Form even if it is omitted from visible Columns.

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
Child Grid ID;Child Form ID;Subgrid Label;Parent Grid ID;Parent Key Field;Child Foreign Key Field;Sort with Buttons;Sort Field;Duplicate
```

Paste this row into the property grid's CSV input:

```text
areasGrid;areass;Areas;;id;parentid;true;sort;true
```

## Independent nested properties and duplication popups

Configure actions separately for every relation in **Nested Subgrids → Child Tables / Subgrids**:

| Setting | Options/default | Behavior |
| --- | --- | --- |
| Sort with Buttons | Checkbox; default unchecked | Shows up/down icons for rows with the same parent. |
| Sort Field | Form Field ID; default `sort` | Visible only while Sort with Buttons is checked. Persists this nested grid's row order. Add a corresponding field, normally a Hidden Field, to its child Form. |
| Duplicate | Dropdown: Default or Pop Up Dialog; default Default | Default duplicates immediately; Pop Up Dialog opens the child Form before inserting the copy. |

Each child configuration is displayed as two rows on a wide properties panel:

- Top: Child Grid ID, Child Form ID, Subgrid Label, Parent Grid ID, Parent Key Field.
- Bottom: Child Foreign Key Field, Sort with Buttons checkbox, conditional Sort Field, Duplicate dropdown, and native move/delete controls.

The fields wrap further when the properties panel is narrow. The native Form dropdown, required-field validation, Add/Move/Delete controls and CSV input remain available. Unchecking Sort with Buttons hides Sort Field without clearing its value. Each row controls its own visibility, including rows added or loaded through CSV.

These are independent nested properties. They do not inherit the root or source child grid's Enable Sorting, Disable Duplicate, or Show Popup on Duplicate. There is no “Use Child Grid Settings” option. Legacy blank action values use the defaults above. CSV column order and property keys are unchanged: the existing `enableDuplicate` key now selects the mode, with `false` = Default and `true` = Pop Up Dialog. Previously checked configurations retain popup behavior; previously unchecked configurations now duplicate directly. Both dropdown choices offer duplication, subject to Read Only, Disable Add, and maximum rows.

For persisted ordering, add a hidden field such as `sort` to the child Form and select it as **Sort Field in the nested relation row**. You do not need to enable sorting on the source child grid. On submit, the child grid uses the relation's Sort Field to store the ordering; on load it restores that ordering. The first child's Up button and last child's Down button are disabled separately for each parent. Sorting one parent's children preserves the order of other parents' children. The Sort Field must be separate from `id` and the child FK.

Enabling **Sort with Buttons** also displays a **No.** column in the nested view. Numbers start at 1 for each parent and refresh after moving, adding, or deleting rows. The source child grid's **Show Row Number** option also displays this column when sort buttons are off. These display numbers do not become Form fields or enter the submitted row JSON. A parent with one child shows number 1 and both move buttons disabled.

With **Duplicate = Default**, clicking the copy icon immediately inserts a copy beside its source, with a new ID and the same parent FK. With **Duplicate = Pop Up Dialog**, the configured child Form opens with the original row's values and a new ID. **No new row is added until that popup is submitted successfully.** Canceling adds nothing. The submitted copy is assigned back to the same parent FK, including temporary binder request parameters. The selected nested mode takes precedence over the source grid's popup setting; Default also bypasses the source grid's automatic popup for unique fields, retaining its unique-value suffix and validation. Duplicating a row copies its values without copying its descendants. Read Only, Disable Add, maximum rows, and Unique Column validation remain enforced.

Example for the supplied Area setup: relation `areasGrid` → **Sort with Buttons = checked**, **Sort Field = sort**, **Duplicate = Pop Up Dialog**; Area Form `areass` → Hidden Field **sort**. The source child grid's own sorting and popup-duplicate settings may remain off. The example JSON files in `outputs/nested-grid-config/` include this independent configuration. Change the final CSV value to `false` for Default duplication.

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
