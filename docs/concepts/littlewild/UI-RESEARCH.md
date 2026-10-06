# UI research and implementation rationale

**29 September 2026 · Littlewild v15.** This is desk research plus a source/UI inspection and automated execution checks, not player interviews or proof of enjoyment. The supplied v14 build is the observed baseline; new scenario numbers are authored examples, not calibrated balance findings.

## Observed problem

In the captured 1440×900 v14 baseline, Build used an 850×651 modal and Tutorial a 1020×846 modal. In both cases the application behind it was inert. This interrupts the intended choose/inspect/place loop even when the panel itself does not cover every pixel. The new Build catalog is a narrow non-modal side panel and the guide is a small single-step companion. Their small-screen forms leave the world visible above them. Actual captures and geometry checks are included; no generated concept image is used as implementation evidence.

## Evidence → decision → check

| Primary source | What the source supports | Our implementation decision and evidence |
|---|---|---|
| [Carbon spacing](https://carbondesignsystem.com/elements/spacing/overview/) | A scale of spacing tokens supports coherent relationships, density and hierarchy. | Use a small shared rhythm and aligned header/body/footer insets. Inspect desktop/mobile rather than shrink text to fit. |
| [Factorio FFF405](https://www.factorio.com/blog/post/fff-405) | The developer replaced a blocking logistics screen with a remote-view panel that retained normal map actions. | Build and Tutorial are world-facing non-modal panels; browser tests pan the exposed world and verify background is not inert. |
| [Factorio FFF278](https://www.factorio.com/blog/post/fff-278) | Its quickbar redesign separates shortcuts from inventory and avoids unwanted item-slot movement. | Keep toolbar destinations stable and separate construction drafts from actual resource possession. |
| [Microsoft XAG112](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/112) | Consistent navigation, predictable focus and alternative routes reduce interaction barriers. | Search/category routes, explicit close, F6 world/panel focus, normal Tab navigation and retained drafts. Actual keyboard checks; no full accessibility certification. |
| [W3C modal dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/) | Modal dialogs make underlying content inert and contain interaction. | Do not falsely label a world-interactive aside as modal. Keep genuinely destructive scene-replacement reviews modal with cancel/review. |
| [Godot resources](https://docs.godotengine.org/en/stable/tutorials/scripting/resources.html) | Resources separate reusable data from the behavior that consumes it; scene data can be instantiated. | A JSON pack supplies setting/scene data to the existing runtime. This is an architectural analogy, not a Godot port. |
| [JSON Schema objects](https://json-schema.org/understanding-json-schema/reference/object) | Required and additional-property constraints must be specified explicitly. | Trusted schema for pack shape plus native semantic checks; invalid data cannot silently install a partial experience. |
| [OWASP input validation](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html) | Structural validity and context-dependent semantic validity are distinct. | Validate bounds, references, world connectivity and native saved state; escape display text and keep JSON non-executable. Not a security audit. |

## Why not one universal full-screen catalog?

Research, saved-story replacement and external pack maintenance can require concentrated comparisons. Building and guidance target a live spatial situation. Treating both categories as the same modal pattern imposes unnecessary context switching. This is our product inference from the user's task and the precedents above; it is not a universal rule that management games should never use full-screen panels.

## Product-perspective review

**Player agency:** Opening a menu, selecting a blueprint or choosing a builder does not gather materials. **World legibility:** exposed scene retains camera navigation and existing selectable names. **Learning:** the guide introduces one real action at a time, but it is not an automatic skill-completion checklist. **Information hierarchy:** list first, selected requirements second, actual placement last. **Economy/logistics:** no remote warehouse consumption or free building completion is added. **Error recovery:** input and import cancellation preserve the live scene. **Accessibility:** explicit labels, keyboard routes and reflow were exercised, while screen-reader and physical-device testing remain outstanding. **Performance:** no new independent animation loop or FPS claim; expanded pack validation runs only at load/review/commit. **Maintainability:** separate panel and pack boundaries, without disguising remaining legacy coupling. **Authoring:** schema/CLI/capture provide a practical external workflow; stable mechanic roles and native state conventions remain constraints.

## Human validation still needed

Observe whether newcomers can choose a builder, place a useful plan and return to the guide without explanation; whether the pause preference is understood; whether small-screen scrolling obscures the next action; and whether external authors can modify a captured scene without reading engine code. Automated tests establish contract behavior, not comprehension, pacing or enjoyment.
