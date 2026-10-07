# Scene Forge

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

TypeScript CLI and Three.js HTML preview, as requested. Node.js runtime. The user chose direct implementation of the preview.

## Users

Primarily AI agents creating 3D models and scenes; humans review and compose instances visually.

## Product Purpose

Programmatic, data-driven authoring of reusable game assets and scenes, exportable to Blender, Three.js and Godot.

## Operating Context

Projects contain editable scene and model recipes. Agents discover schemas, capture reusable models, transfer dependency bundles, compose scenes, apply guarded edits, validate, inspect, export and capture screenshots. The offline composer returns local changes as JSON batches.

## Capabilities and Constraints

JSON source of truth; stable object IDs; Three.js HTML preview; screenshot capture. First use: game assets and scenes, confirmed by user. Working title Scene Forge is an implementation assumption, not a confirmed brand. Full Blender feature parity remains future scope.

## Product Principles

- Explicit data and actionable machine-readable errors.
- Same scene compiler for exports and previews.
- Reusable parametric models.
- Visual verification closes the authoring loop.
