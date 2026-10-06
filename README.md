# Motorsport Manager — Godot

Native, local-first circuit authoring, two-car race management and a bounded Team
Principal campaign. The project uses **Godot 4.7.2 Standard**, GDScript and the
Compatibility renderer. `project.godot` currently identifies application **0.19.0**;
content, replay and save formats have their own independent versions.

Start with [the documentation index](docs/README.md) or
[the current capability map](docs/reference/current-state.md). Detailed contracts and dated
acceptance evidence have separate homes.

## Play

Download the matching Linux or Windows artifact from the **Standalone
application** workflow. Extract the artifact ZIP and its inner `.tar.gz`, keep
`Motorsport Manager.pck` beside the executable, and launch it. No editor is needed.
See [standalone build and acceptance](docs/how-to/standalone-validation.md).

For source development, import the root `project.godot` in **Godot 4.7.2 Standard**,
wait for script import, and press **F5**. No .NET, npm or browser runtime is required.

- [First weekend](docs/tutorials/getting-started.md): staged entry, measured practice,
  qualifying, physical formation, lights, race and factual results.
- [First campaign event](docs/tutorials/first-campaign.md): Director's Desk, readiness,
  existing race weekend, exactly-once settlement and the next decision.
- [Edit a circuit](docs/how-to/first-circuit.md): copied geometry, undo/redo, saved library
  document and a detached test-weekend snapshot.
- [Troubleshooting](docs/how-to/troubleshooting.md): import, rendering, saves and unavailable entries.

**Minimal** is the default race interface: timing tower, illustrated circuit, two
read-only driver cards, Send out, Box this lap, Push, Calm, engine mode, explicit
time controls and an on-demand read-only Strategy comparison. Settings can select
**Advanced**, starting in Race Director or Engineering over the same weekend.
See [Minimal](docs/reference/race-weekend/minimal.md) and [Advanced](docs/reference/race-weekend/advanced.md).

The Team Principal route is a four-event first slice. Deeper finance, personnel,
operations, engineering, commercial, recruitment, multi-season and dynasty
contracts exist, with specialist management presentation and human validation
still bounded. [Current status](docs/reference/current-state.md) records that distinction.

## Develop and verify

```sh
python3 scripts/check_docs.py
python3 -m unittest discover -s tests -p 'test_*.py'
python3 scripts/check_architecture.py
python3 scripts/verify.py --godot /path/to/pinned/godot
```

Full native verification needs a desktop display or Linux Xvfb/xauth. CI runs six
shards and requires source-bound aggregate evidence; focused or headless-only
runs are partial. [Verification](docs/how-to/verification.md) explains all checks and
[advisory quality](docs/how-to/code-quality.md) explains the separate nonblocking workflow.

Application runners own race time; UI handles submit commands and render detached
values. Campaign dated-slot time, atomic consequences and authority remain
separate from race ticks and standalone receipts. See [architecture](docs/explanation/architecture.md)
and [contributor rules](AGENTS.md) before changing these boundaries.

Shipped editable content lives in [config/](config/README.md). Use
[balancing recipes](docs/how-to/balancing.md), [content contracts](docs/reference/content/README.md),
[mechanics development](docs/how-to/developing-mechanics.md) and
[bounded toolbox experiments](docs/how-to/toolbox-recipes.md) for safe changes. Existing
saves freeze their selected rules; external packs cannot inject executable code.

Two separate Node/TypeScript projects, Wildlands and Scene Forge, live in
`source/` and ship self-contained CLIs in [bin/](bin/README.md) that need only
Node.js 22+. See [standalone CLI projects](docs/README.md#standalone-cli-projects).

## Scope and provenance

Human playtesting, controller/screen-reader completeness, wet/endurance balance,
representative-GPU profiling and a comprehensive long-horizon management UI remain
separate work. Automated checks do not certify those outcomes or universal FPS.

Seven geographic outlines derive from Tomislav Bacinger's MIT-licensed
`f1-circuits` through the supplied prototype; Pinecrest is fictional. See
[third-party notices](THIRD_PARTY_NOTICES.md). These are unofficial reconstructions
with authored estimates, not laser scans or certified circuit/vehicle models. No
official championship branding, car models or driver likenesses are used. Code
retains the [MIT license](LICENSE), copyright Luis Mendez.
