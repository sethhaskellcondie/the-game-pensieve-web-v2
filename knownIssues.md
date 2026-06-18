# Known Issues

## Default sort options do not import from a backup

When importing from a backup, the default sort options will not import. The backend will only import new keys or keys with empty bodies. However, when the default sort options are created, they are created with values for each entity. Because those keys already exist with non-empty values, the import will not overwrite them, so the backed-up default sort options are effectively ignored.

## Saved filter categories have trouble importing

When importing from a backup, the saved filter categories may not import correctly because the category ids may not persist. The filters themselves will still be imported, so the worst-case outcome is having to reorganize the categories after the import.
