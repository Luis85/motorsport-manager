# Littlewild — configurable autonomous-world showcase

## Publication state

**This branch is a publication staging area, not yet a runnable checkout.**
The full v15 game and source archive have been rebuilt and tested in the attached
ChatGPT delivery. They have not yet been transferred to this branch. Keep the PR
in draft until `littlewild.html`, `source/` and `vendor/` are present.

The implementation includes compact, world-facing Build and Tutorial panels,
shared spacing, validated world/scene packs, and two independently runnable
settings: Littlewild and Emberworks. See `CONFIGURATION.md` for supported
configuration and the remaining compiled-engine boundaries.

## Finish the transfer

Download `littlewild-v15-source.zip` from the conversation. In an authenticated
checkout of `Luis85/motorsport-manager`, run:

```sh
python docs/concepts/littlewild/publication/publish_v15.py \
  /absolute/path/to/motorsport-manager \
  /absolute/path/to/littlewild-v15-source.zip --publish
```

Without `--publish`, this command performs read-only local validation. Publishing
uses a detached worktree; it does not switch your current branch, force-push,
merge a PR, or change native game files. It accepts only the pinned delivery ZIP,
rebuilds the HTML, and refuses conflicting files. The known staging README may
be replaced by the real product README; arbitrary existing files may not.

See `publication/VERIFICATION.md` for the checks executed during this resumption.
A local or historical passing result is not a GitHub CI result. The native Godot
gate, hardware WebGL and human usability were not verified here.
