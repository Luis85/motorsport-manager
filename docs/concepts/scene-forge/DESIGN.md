# Preview and composer design

Mode: Operate. The 3D result owns the viewport; the interface supports composing reusable models, inspecting results and exporting them.

The user chose a focused, directly implemented Three.js preview, then requested scene composition. The interface retains the dark neutral stage and amber selection/action accent. Geometry authoring remains data driven; the browser edits instance placement and basic properties.

Tokens: background `#13181f`, panel `#1d242e`, border `#364150`, primary text `#edf2f7`, secondary text `#b1bdcd`, accent `#ffbb73`. System sans-serif for controls; monospace for recipes, IDs and measurements. Control radius 5px.

Desktop uses a navigator, central viewport and object inspector. Scene/Models tabs switch between authored hierarchy and reusable asset palette. The hierarchy hides generated implementation meshes. Groups collapse, search retains matching ancestors, and selection supports both labeled buttons and viewport picking.

Mobile places the viewport above the navigator and inspector. Toolbars wrap, panels scroll independently, and the page avoids horizontal scrolling. Controls have focus styles and labels. Tabs support arrow keys, Home and End; Q/W/E/R switch transform tools, F frames, and Ctrl/Cmd+Z controls history outside inputs.

Save edits is the primary action after changes. It downloads an explicit guarded transaction for application through the CLI. Undo/redo, numeric fields, translation/rotation/scale handles, snapping, duplication, grounding and deletion all operate on the same authored node state. Local edits are visible in the status label. Downloading preserves the work for later application; it does not imply the project was updated.

Secondary actions include current-scene GLB export, PNG, camera presets, grid, wireframe, recipe display and exact review-plan copying/downloading. Model-only previews disable edits. Invalid numeric input restores valid state and shows a recoverable message. Empty scenes direct the user to Models; an empty library explains capture/import. Loading, WebGL failures and geometry warnings remain explicit.

Review plans preserve the current camera projection, frustum and zoom. Copy review plan has a readable source-panel fallback; Save review plan works without clipboard access. These controls do not imply scene edits have been applied to the project.
