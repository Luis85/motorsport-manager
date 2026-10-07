# Process scene project

Each process step has one Scene Forge scene and editable starter model.
Existing attached assets are retained in existing-assets; import them with
`scene-forge -p PROJECT littlewild import --definition FILE` to edit the exact geometry.
The starter models are not an automatic conversion of those attachments.

Run `scene-forge -p PROJECT validate`, then
`scene-forge -p PROJECT littlewild sync --file PROJECT/littlewild.export.json`.
Attach each exported definition with `wildlands process attach` using fresh revision/fingerprint guards.
