# Known Issues

## Default sort options do not import from a backup

When importing from a backup, the default sort options will not import. The backend will only import new keys or keys with empty bodies. However, when the default sort options are created, they are created with values for each entity. Because those keys already exist with non-empty values, the import will not overwrite them, so the backed-up default sort options are effectively ignored.

## A saved filter's sort level breaks if its field is deleted

A saved filter snapshots the fields it sorts by, and the search endpoint rejects
a sort on a field the entity no longer has (`ExceptionInvalidFilter` → 400), so
deleting a custom field that a saved filter sorts by makes that card's page fail
to load until the level is edited out. Saved *conditions* have the same exposure,
so this is existing behavior rather than something sorting introduced; the fix,
if it becomes a real problem, is to resolve seeded levels against the live field
list in each collection manager (the way `resolveDefaultSorts` already does for
the stored per-entity defaults) and drop the unknown ones.

## Saved filter categories have trouble importing

When importing from a backup, the saved filter categories may not import correctly because the category ids may not persist. The filters themselves will still be imported, so the worst-case outcome is having to reorganize the categories after the import.
