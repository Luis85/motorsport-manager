---
name: Littlewild Character Studio
description: Cream paper, forest controls and a live authored companion model.
colors:
  paper: "#f7f4eb"
  panel: "#fffdf7"
  forest: "#294a38"
  forest-light: "#e8eedf"
  ink: "#202d23"
  muted: "#626955"
  line: "#dedecf"
  gold: "#936629"
  error: "#913e2e"
  focus: "#946223"
  field: "#fffef9"
  selected-text: "#fffdf4"
typography:
  display:
    fontFamily: "Georgia, 'Times New Roman', serif"
    fontSize: "clamp(1.9rem, 3vw, 2.8rem)"
    fontWeight: 600
    lineHeight: 1.07
    letterSpacing: "-.035em"
  headline:
    fontFamily: "Georgia, 'Times New Roman', serif"
    fontSize: "2.35rem"
    fontWeight: 600
    lineHeight: 1.07
    letterSpacing: "-.035em"
  body:
    fontFamily: "'Trebuchet MS', 'Segoe UI', sans-serif"
    fontSize: "15px"
    lineHeight: 1.5
  label:
    fontFamily: "'Trebuchet MS', 'Segoe UI', sans-serif"
    fontWeight: 600
rounded:
  field: "7px"
  button: "8px"
  collection: "10px"
  segmented: "11px"
  workspace: "14px"
  dialog: "15px"
spacing:
  control-gap: "9px"
  workspace-gap: "18px"
  panel-inline: "23px"
  dialog-padding: "28px"
components:
  button-primary:
    backgroundColor: "{colors.gold}"
    textColor: "#fff"
    rounded: "{rounded.button}"
    padding: "14px 25px"
  button-secondary:
    backgroundColor: "{colors.forest-light}"
    textColor: "{colors.forest}"
    rounded: "{rounded.button}"
    padding: "9px 14px"
  navigation-selected:
    backgroundColor: "{colors.forest}"
    textColor: "{colors.selected-text}"
    rounded: "{rounded.button}"
  input:
    backgroundColor: "{colors.field}"
    textColor: "{colors.ink}"
    rounded: "{rounded.field}"
    padding: "10px 12px"
  editor-panel:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink}"
    rounded: "{rounded.workspace}"
---
# Design System: Littlewild Character Studio

## Overview

**Creative North Star: "Littlewild Character Studio"**

The supplied Littlewild Character Studio mockups and walkthrough establish the
visual direction: cream paper, forest controls, restrained gold actions and serif
headings. The interface places readable controls beside the real authored model.
The rendered companion supplies the expressive detail; chrome stays quiet and
legible through repeated editing.

This is an operational editor. Selected states, field labels, persistence feedback
and keyboard focus remain visible. A portrait or world backdrop is another view
of the compiled model, not a replacement illustration.

**Key Characteristics:**
- Warm paper surfaces with dark forest selections.
- Serif headings paired with familiar system controls.
- A large live model beside a compact chapter panel.
- Explicit save feedback, full labels and visible focus.

## Colors

Cream neutrals support a forest selection palette and a restrained ochre-gold
primary action. Frontmatter values are extracted from `src/ui/styles.css` and
are the normative snapshot; refresh this document when those styles change.

### Primary

- **Forest**: active chapters, selected view controls, locks and form accents.
- **Forest wash**: secondary actions and skill-point summaries.

### Secondary

- **Gold**: review and commit actions with white text.
- **Focus ochre**: the keyboard outline; keep it distinct from selection fill.

### Neutral

- **Paper**: the page background.
- **Panel**: editor, dialogs and control surfaces.
- **Ink**: body text and headings.
- **Muted**: supporting instructions and noncritical status.
- **Line**: panel borders, dividers and control grouping.
- **Field** and **selected text**: editable interiors and selected labels.

Errors use the dedicated red-brown color and readable text.

**The Selection Rule.** Forest fill indicates the active choice; gold identifies
the main review or commit action.

## Typography

Georgia with Times New Roman and serif fallbacks supplies headings. Trebuchet MS
with Segoe UI and sans-serif fallbacks supplies controls and body copy. No remote
font request is required. The pairing keeps the illustrated world present while
forms remain familiar.

The page heading uses the responsive display role; panel headings use the
headline role. Labels are semibold. Supporting text varies with its component,
usually around four fifths of the body size. Numeric fields and point steppers use
tabular numerals. The large-text preference raises body text to (1.2rem).

## Layout

The desktop shell has a brand header, save status, five chapter buttons, a
left-hand control panel and a flexible viewport. The default workspace uses a
(minmax(355px, 390px)) desktop control column and an (18px) gap. Above (1600px), the shell
is bounded at (1800px) with the same bounded control column.

At (1250px) and below the chapter navigation occupies its own row. At (900px)
and below the two-column layout tightens and preview controls reflow. At (680px)
and below the viewport moves above the form, the panel loses its internal scroll,
and history/save controls wrap. The mobile viewport is (480px) tall. The canvas fills the panel continuously; camera framing reserves space above
and below the model for controls. At
(390px) and below header type and gaps tighten while zoom remains available.

Desktop panel scrolling is bounded by the viewport and chapter navigation resets
the panel to its start. The next-chapter action stays at the panel foot on desktop
and returns to normal flow on phones.

## Elevation & Depth

Most surfaces use tonal layering and thin borders rather than shadows. The
companion's actual lighting and ground shadow provide depth within the viewport.
Only modal dialogs receive a broad ambient shadow and a dark translucent backdrop.
The sidecar records exact shadow and backdrop values.

## Shapes

Forms have gently rounded corners. Fields, buttons, collection rows, segmented
groups and large surfaces use the separate rounded tokens. Circular color swatches
show their own hue; a selected swatch adds an outline and a checkmark. Avoid
changing all surfaces to one radius, which would flatten the existing hierarchy.

## Components

### Buttons

Primary actions use gold fill, white semibold text and generous padding. Secondary
actions use forest wash with forest text and a subtle border. Icon buttons have
panel fill and a border. Standard buttons have a minimum height of (43px); some
compact viewport and stepper controls are smaller. Hover and active states change
fill. Disabled controls reduce opacity and use a not-allowed cursor.

All focusable controls use a visible (3px) ochre outline offset by (3px). Do not
replace focus with the selected state or discard focus when redrawing controls.

### Inputs / Fields

Fields have a light interior, thin border, rounded corners and a minimum height
of (44px). Hover strengthens the border. Appearance sliders retain numeric input
alternatives and independent lock buttons. Labels stay visible above the field;
validation uses written diagnostics, not a border alone.

### Navigation

Five chapters remain directly accessible. Selected chapters and segmented preview
choices use forest fill and light text. Mobile navigation wraps its full labels.
Preview camera, pose and light choices are presentation state outside character
undo history.

### Cards / Containers

The editor panel and viewport share the workspace radius. Collection entries use
a smaller radius, thumbnail or symbol, name and supporting copy. Skill summaries
use a forest wash. Dialogs have bounded height with internal scrolling, wrap their
actions, and restore focus to the invoking control when closed.

### Live preview

Studio, in-world and portrait modes share the compiled companion. Front, side and
back views, lighting, zoom, reset and pose controls remain independent of recipe
edits. The canvas supports pointer rotation and keyboard rotation/zoom. Animation
can be paused; reduced-motion preferences suppress decorative motion and smooth
scrolling. A rendering failure is visible in the viewport without blocking recipe
editing.

## Do's and Don'ts

### Do:

- Do use gold for the review or commit action and forest for selected controls.
- Do keep editable numeric values beside appearance sliders.
- Do reserve room around the model for camera, lighting and pose controls.
- Do preserve visible focus and respect reduced motion and larger text.

### Don't:

- Don't use mockup artwork in place of the live authored companion model.
- Don't rely on color alone for a selected swatch or a field error.
- Don't hide save failures or imply that a browser save reached project disk.


## Authored preview surfaces

Compiler revision 3 uses smooth portable meshes with explicit UVs and deterministic
fur, cloth and leather surface recipes. Eye whites remain visible around a warm
iris, the small pupil carries one restrained catchlight, and the face uses a
shallow muzzle patch with a compact smile. Soft cap, open vest and rounded boots
retain the engine socket contract. Revision 1 and 2 exports keep exact import
verification. Surface detail is an authored material effect, not hair geometry.
Preset and ear choices show cached renders of actual recipes instead of colored
placeholders. Collection, review and import use the same portrait renderer. The
cache holds at most 24 images and releases temporary GPU geometry and materials.

The presentation garden uses deterministic batched plants, stones, lanterns and a
fogged woodland backdrop. Warm directional light, restrained ambient fill and a
soft contact shadow keep coat colors readable. The backdrop follows the inspection
camera to preserve an unobstructed rear view. World and night modes change context
and illumination without editing the character. Renderer budgets and current
presentation state are inspectable by browser agents.
