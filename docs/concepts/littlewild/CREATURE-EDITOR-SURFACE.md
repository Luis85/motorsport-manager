# Creature editor surface

Mode: **Operate**. Extend Littlewild's existing paper, woodland ink, Georgia
headings and native Arial form controls. This is a developer authoring workspace
inside Worlds & scenarios. Player navigation remains unchanged.

The first viewport shows the actual Three.js creature and its selected name,
package identity, archetype/current-companion selectors, undo/redo, package
exchange and scenario review. Desktop uses three unequal columns: preview,
gameplay sections, and appearance/body tools. At narrow widths the same
functional controls reflow vertically without shrinking text or the character.
The preview is an actual runtime geometry projection, never an image substitute.

Each gameplay section names whether its fields edit archetype tuning, future
creation defaults or current companion values. Folded advanced JSON handles
complete definitions, rigs and components while the common values remain
labelled inputs. Save buttons identify the field being accepted; errors state
that the edit was not applied. Import preserves the existing draft on failure.
The live story remains untouched until the existing Cancel-focused scenario
review is explicitly committed. Closing and reopening within the same story
retains the draft; story replacement resets it.

The canvas supports pointer orbit/zoom and visible keyboard focus. Arrow keys
orbit, +/− zoom and Home resets. Native selects operate appearance, pose, model
and body-part choice. Mobile controls retain 44px targets. Appearance color,
primitive transforms and model changes update the canonical draft and rebuild
its preview. This editor uses the existing application RAF, never a separate
simulation, animation timer or preview runner.

The visual evidence must show a visible creature on both desktop and mobile,
including an edited palette/body pose. Raw console, page and network errors
accompany the artifact verification. Node regressions separately prove native
work preservation, exact import/export, new archetype admission, detached clone
isolation, bounded history and atomic rejection. Automated captures establish
layout and actual rendering, not human usability or screen-reader coverage.
