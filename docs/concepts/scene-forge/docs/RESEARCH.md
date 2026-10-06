# Product research and implementation decisions

Research date: 5 October 2026. Release: Scene Forge 0.4.

## Conclusion

The strongest near-term product is a **data-driven asset compiler and scene composer for agents**, with an inspect–render–revise loop and portable static outputs. The opportunity is to make an agent's authoring work verifiable and reusable. Attempting full Blender parity would spread effort across animation, sculpting, shading, simulation and desktop interaction before the core workflow is dependable.

This is a product recommendation based on the requested workflow, primary-source desk research and inspection of this codebase. It is not a market-size estimate or evidence of willingness to pay. No customer interviews, competitor performance benchmark, production workload study or paid-agent evaluation was conducted. The implementation measurements below are local fixture results.

## Coverage and method

The review covered product positioning; creator and agent jobs; competitive alternatives; command discovery and contracts; procedural modeling; composition; interoperability; rendering and feedback; performance; reliability; security and privacy; accessibility; distribution; commercial assumptions; and release quality. Official standards, project documentation and first-party engineering articles were preferred. Recommendations were compared with source code, shipped examples and executable tests. Unverified native-application behavior remains explicitly unverified.

### Users and jobs

| User                 | Job                                                 | Success evidence                                                      | Principal friction                                             |
| -------------------- | --------------------------------------------------- | --------------------------------------------------------------------- | -------------------------------------------------------------- |
| Authoring agent      | Build a reusable prop from dimensions and a brief   | Valid recipe, expected bounds, acceptable multi-view images           | Undocumented assumptions, geometric mistakes, noisy outputs    |
| Scene-building agent | Arrange reusable models into a coherent environment | Linked model instances, stable IDs, predictable placement             | Transform/pivot confusion and resource duplication             |
| Human reviewer       | Judge shape, composition and corrections            | Useful perspective and orthographic views, editable placements        | Losing a useful camera or believing a download committed edits |
| Game/web developer   | Bring outputs into an existing runtime              | GLB validation, hierarchy, normals and predictable units              | Renderer differences and unsupported native features           |
| Pipeline maintainer  | Rebuild assets and reject regressions               | Pinned inputs, source hashes, quality budgets and repeatable commands | Browser setup, dependency drift and incomplete project history |

These roles are derived from the user's requirements, not observed customer segments. Their shared critical path is: discover the contract → create or modify recipes → inspect dimensions and cost → review images → repair → export and preserve the editable recipe.

## Alternatives and positioning

| Alternative                        | Evidence-backed role                                                                                                                                            | Implication for Scene Forge                                                                                                                         |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| OpenSCAD                           | Its authors describe script-driven solid CAD, configurable parameters, CSG and profile extrusion. [S1]                                                          | Preserve explicit parametric construction; do not promise precision CAD or manufacturing certification.                                             |
| JSCAD                              | Modular JavaScript tools for parametric 2D/3D work, available in browser and CLI, with a stated emphasis on 3D printing. [S2]                                   | Programmatic geometry alone is insufficient differentiation. Focus on agent contracts, scene composition and review evidence.                       |
| Blender glTF workflow              | Blender's glTF integration covers meshes, PBR material interchange and additional asset features. Its import material system maps glTF into Blender nodes. [S3] | Treat Blender as an interoperating downstream authoring tool. Static GLB cannot preserve Scene Forge's procedural recipe as Blender geometry nodes. |
| Three.js export and glTF Transform | Three.js provides the scene exporter; glTF Transform explicitly supports deduplication of meshes, accessors and materials. [S4, S5]                             | Use proven interchange components. Reduce avoidable duplication before considering compression or a new file format.                                |
| Godot import pipeline              | Godot recommends glTF 2.0 and supports both GLB and JSON glTF. Its `.blend` workflow invokes Blender's glTF export. [S6]                                        | GLB is an appropriate primary handoff. Native `.tscn` generation is not required to satisfy the first portable scene workflow.                      |

This comparison establishes workflow boundaries, not a complete feature ranking. Scene Forge is presently best suited to static hard-surface props, modular environments and parametric variants. Organic characters, production animation, photoreal materials and engineering solids remain poor fits.

## Evidence translated into product decisions

| Perspective               | Source finding                                                                                                                               | Codebase finding                                                                                                           | Decision and status                                                                                                                                                                                   |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Agent efficiency          | Anthropic recommends purposeful workflow tools, concise relevant results, filters and realistic evaluations. [S7]                            | Discovery, selectors, batches and concise JSON already exist; visual review lacked a quality gate.                         | **Shipped:** one `audit` command with bounded findings and explicit repair hints. Keep API-level regression tests separate from future agent-success evaluations.                                     |
| Contracts                 | MCP specifies tool schemas, optional structured output schemas and paginated discovery. [S8]                                                 | The CLI exposes JSON Schemas and command descriptions; no MCP server is implemented.                                       | **Retained:** data-first CLI. **Deferred:** a thin MCP adapter after command contracts settle; do not duplicate modeling logic in an adapter.                                                         |
| CLI reliability           | CLI Guidelines emphasize composable streams, clear failures, discoverable help and dry-run behavior. [S9]                                    | File and inline JSON did not share the stdin size limit; string concatenation could split UTF-8 input.                     | **Shipped:** byte-bounded file/inline/stdin handling and a nonblocking terminal-stdin error. Existing structured stderr and exit behavior remain.                                                     |
| Asset quality             | Khronos asset guidance emphasizes orientation, scale, origin, mesh reuse and useful asset organization. [S10]                                | Dimensions and basic compile stats existed, but project budgets were not enforceable.                                      | **Shipped:** visible-output budgets, degeneracy checks, optional UV requirements and explicit transparency/double-sided policy. Limits are project choices, not universal industry limits.            |
| Interchange               | glTF defines meters, a right-handed Y-up coordinate frame and vertex attribute contracts; node matrices must be decomposable into TRS. [S11] | Custom meshes lacked normals/UV inputs. Flattening a subtree through world-matrix decomposition could lose shear.          | **Shipped:** validated per-vertex normals/UVs; normalized authored normals; transform-only ancestor preservation in subtree export.                                                                   |
| Export assurance          | Khronos Validator checks schema, references, binary values and GLB structure. [S12]                                                          | Validator use was limited to tests/release scripts.                                                                        | **Shipped:** `export --validate`, rejecting invalid glTF before writing a destination. This is format validation, not native-app certification.                                                       |
| Runtime and size          | Resource deduplication is an established glTF optimization. [S5]                                                                             | Each model scope constructed equivalent materials and geometries again.                                                    | **Shipped:** deterministic compile-wide resource pooling by resolved definition. Preserve separate nodes, placement and authored references. No geometry simplification or GPU instancing is claimed. |
| Visual iteration          | Playwright documents environment-dependent screenshot variation. [S13]                                                                       | Cameras were recorded but could not be supplied as exact review inputs; browser copying discarded orthographic projection. | **Shipped:** fixed-camera snapshots, zoom, replay plans, browser plan download and render-environment metadata. Do not equate matching hashes across different machines with correctness.             |
| Accessibility             | W3C keyboard guidance concerns operable functionality beyond pointer interactions. [S14]                                                     | Numeric transform fields and tab/shortcut support already exist; camera sharing depended on clipboard access.              | **Shipped:** an explicit native-button download path and a clipboard fallback with an accurate panel heading. Full accessibility certification remains unclaimed.                                     |
| Reproducible distribution | npm documents `npm ci` as lockfile-driven installation that does not rewrite package definitions. [S15]                                      | A lockfile, generated schemas, declarations and offline HTML already ship.                                                 | **Retained:** `npm ci` instructions. Validator moved to runtime dependencies. **Deferred:** published packages, platform installers and native-app CI.                                                |

## What changed in 0.4

### An objective acceptance gate

`audit` examines the visible deliverable, excluding hidden subtrees just as export does. Findings carry stable codes, severity, counts, up to ten example paths and repair hints. A failed gate produces `QUALITY_GATE_FAILED` on stderr and exit status 1. `--strict` also fails on warnings. Recipes remain untouched.

Policies can cap triangles, meshes, distinct materials, distinct geometries and the longest world-axis extent. They can require UVs or disallow alpha blending/double-sided materials. Empty visible output and zero-area or nearly collinear triangles are failures. Mirrored transforms and permitted transparency request review. Degeneracy is measured in local geometry with a relative edge-based tolerance, then counted across visible instances; it is not a manifold or collision test.

The new audit exposed 144 redundant zero-area triangles in barrel instances in each of the outpost and composition examples. The lathe constructor now removes exactly zero-area axis-cap faces; custom and boolean topology remains available for diagnosis. This illustrates why format validity and visible quality need separate checks.

The example policy is an illustrative budget for the supplied scenes. It is not a claim about mobile, desktop or console performance. Mesh count is not an exact draw-call count. `geometryBytes` measures unique typed attribute/index buffers, not total GPU memory.

### Smaller composed assets

The compiler now pools resources by resolved definitions across model instances. Geometry keys for booleans include operand identities and transforms, preventing unrelated local geometry IDs from colliding. Material keys include effective defaults. Model parameters still produce distinct resources when their values alter geometry. Authored node IDs and material/geometry references remain in node metadata.

Resource identity has a deliberate consequence: two equivalent compiled materials may be the same mutable Three.js object. Programmatic consumers must clone a resource before changing only one instance. Recipe changes are the normal editing path. The cache lasts for one compilation, with no hidden cross-project state.

The original logistics fixture exported a 184,544-byte GLB with 75 glTF mesh resources and 46 materials. The updated build exports 85,588 bytes, 19 mesh resources and 8 materials: a **53.6% file-size reduction**. Both retain 222 exported nodes and 1,680 rendered triangles. These are measurements on one fixture, not a general compression ratio or FPS claim. `./docs/improvement-evidence.json` records counts and hashes.

### Reusable review viewpoints

Every review writes `replay-plan.json` alongside its PNGs and manifest. Reusing it keeps projection, position, target, up vector, near/far planes, frustum and zoom fixed while the geometry changes. The plan also records dimensions, background, grid and wireframe choices. Agents should use automatic fitting to inspect an entire changed asset, and fixed views to compare a known area; a fixed camera can legitimately clip newly enlarged geometry.

The editor's Copy review plan and Save review plan actions preserve orthographic views. A downloaded plan captures the view only; unsaved scene edits must still be applied through the existing guarded batch workflow. Review manifests record tool, Three.js, Node, OS, architecture and Chromium versions plus the requested graphics backend. Lighting still follows the scene's environment and bounds, so fixed camera position alone does not freeze illumination across geometry edits.

### More complete custom geometry and safer export

Custom triangle meshes can supply one normal and one UV pair per position. Missing normals are generated; supplied nonzero normals are normalized. Vertex-count mismatches fail before compilation. Hard edges and UV seams require duplicated vertices as appropriate. This does not add image textures, automatic unwrapping or a graphical UV editor.

Subtree exports retain the necessary ancestor transforms instead of decomposing a combined world matrix. A regression fixture uses rotated children below nonuniformly scaled parents and checks preserved world placement plus glTF validity.

## Reliability, security and privacy review

The existing architecture has useful boundaries: recipes contain data rather than executable JavaScript; project-relative paths are checked; model/geometry graph cycles and expansion budgets are bounded; mutation uses a lock and revision/state guards; HTML bundles its dependencies without external requests. This pass adds uniform JSON byte limits. Those facts support predictable local operation, not a claim of sandboxing arbitrary adversarial files.

Remaining risks are concrete. Multi-file registry updates are not crash-atomic. Scene history does not version the model registry. `review --overwrite` atomically replaces individual files and writes the manifest last, but does not provide a directory transaction or remove unrelated old frames. Chromium can fail due to unavailable binaries or OS libraries. Boolean operations remain sensitive to input topology. Fixing these merits dedicated fault-injection and native-platform work.

Do not add telemetry silently. Current operation is local, and exported HTML makes no application network requests in the release checks. External package/browser downloads are installation steps. If remote rendering is added, it needs an explicit data-transfer contract and cost controls; no hosted infrastructure was introduced here.

## Product economics and distribution

The current package is private and locally installable. Pricing, an open-source license choice, package publication, branding and service hosting are owner decisions; this pass makes none of them. No paid third-party service is required for the implemented authoring loop, but local compute, browser storage and agent token usage still have costs.

A plausible initial offering is a reliable local authoring tool with example asset recipes and clearly documented downstream limits. A future hosted renderer or managed asset catalog could add operational value, but willingness to pay needs interviews and usage evidence. The immediate adoption hypothesis is that fewer invalid edits, smaller portable outputs and cheaper multi-view review matter more than a larger command count. That hypothesis remains to be tested with independent agents and developers.

## Prioritized follow-up

| Priority | Work                                            | Why it follows                                                       | Acceptance evidence                                                                                  |
| -------- | ----------------------------------------------- | -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| P0       | Native Blender and Godot import fixtures        | Standards validation cannot establish target-app behavior            | Automated import of hierarchy, transformed models, UV/normals and PBR samples in pinned app versions |
| P0       | Journaled registry updates and model history    | Project recovery is incomplete across several files                  | Kill-at-each-write tests recover a coherent project and exact old dependencies                       |
| P1       | Real agent task benchmark                       | Tool regression tests do not measure agent ergonomics                | Held-out briefs; task completion, invalid calls, retries, tool-call count, tokens and elapsed time   |
| P1       | Image textures and portable asset references    | UV input is only part of textured asset delivery                     | Packed GLB materials and missing-resource failures tested across targets                             |
| P1       | Modeling additions driven by task failures      | Sweep/curve construction and normal controls may unlock useful props | A defined family of assets completed without excessive custom-mesh data                              |
| P1       | Renderer setup diagnostic and OS CI             | Browser availability is a frequent environment constraint            | Smoke captures on supported Linux/macOS/Windows configurations                                       |
| P2       | Compression, GPU instancing, incremental builds | Additional optimization may help larger scenes                       | Measured asset-size/latency improvement with unchanged semantic and visual results                   |
| P2       | MCP facade and durable render queue             | Helpful integrations once core contracts stabilize                   | Thin adapters, structured contracts, bounded concurrency and cancellation tests                      |

Full animation, rigging, sculpting, native editor projects and a marketplace should follow demonstrated demand. They remain outside the present static-asset scope.

## Release evaluation

The added tests exercise resource reuse versus parameter variants, custom attributes, visibility-aware budgets, bounded diagnostics, fixed cameras with zoom, sheared subtree placement, byte limits, structured CLI failures, validated exports and editor plan downloads. Existing project/composition/guard/preview tests remain.

`./docs/checks.json` is generated by the actual verification command. `./docs/verification.json` records release-artifact validation and browser checks. These files establish what was run; they do not imply native application or cross-platform coverage. Screenshots and examples are regenerated from the delivered source.

## Sources

All sources accessed 5 October 2026. Versioned pages retain the version in the link. A Blender Geometry Nodes manual page could not be fetched, so no feature claim depends on it.

- **S1:** [OpenSCAD — About](https://openscad.org/about.html).
- **S2:** [JSCAD V2 documentation](https://jscad.app/docs/).
- **S3:** [Blender glTF integration documentation maintained by Khronos](https://github.com/KhronosGroup/glTF-Blender-IO/blob/main/docs/blender_docs/scene_gltf2.rst).
- **S4:** [Three.js GLTFExporter documentation](https://threejs.org/docs/pages/GLTFExporter.html).
- **S5:** [glTF Transform — dedup](https://gltf-transform.dev/modules/functions/functions/dedup).
- **S6:** [Godot — Available 3D formats](https://docs.godotengine.org/en/stable/tutorials/assets_pipeline/importing_3d_scenes/available_formats.html).
- **S7:** [Anthropic — Writing effective tools for agents](https://www.anthropic.com/engineering/writing-tools-for-agents), 11 September 2025.
- **S8:** [MCP tools specification, 2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25/server/tools).
- **S9:** [Command Line Interface Guidelines](https://clig.dev/).
- **S10:** [Khronos — Asset Creation Guidelines 2.0 introduction](https://www.khronos.org/blog/introducing-asset-creation-guidelines-2.0-siggraph-2025), 7 August 2025.
- **S11:** [Khronos glTF 2.0 specification](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html).
- **S12:** [Khronos glTF-Validator](https://github.com/KhronosGroup/glTF-Validator).
- **S13:** [Playwright — Visual comparisons](https://playwright.dev/docs/test-snapshots).
- **S14:** [W3C — Understanding Keyboard accessibility, WCAG 2.2](https://www.w3.org/WAI/WCAG22/Understanding/keyboard.html).
- **S15:** [npm CLI v11 — npm ci](https://docs.npmjs.com/cli/v11/commands/npm-ci/).
