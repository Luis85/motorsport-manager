# Portable rigs and animation

A model instance can carry a `rig` definition. This is a skeleton and vertex skinning implementation, with glTF skins and rotation animation clips. It supports up to 64 joints, 16 clips per rig, 256 keys per track, 200,000 skin vertices per rig and 32 rig instances per scene.

## Editor workflow

1. Add a model from the palette or select an existing instance.
2. Open **Rig & animation** and choose **Create starter rig**. Use **Show joints** to see the skeleton through the mesh.
3. Choose a joint, set its parent and rest position, and use **Apply joint & bind**. Add child joints with stable IDs. The single root must remain parentless; cycles are rejected and rolled back.
4. Choose nearest-joint or two-joint automatic skinning. For articulated props and characters made of separate parts, select a mesh path and **Bind mesh to selected joint**. This rigid binding overrides automatic weights for that mesh.
5. Set local Euler pose angles in degrees. For animation, choose a clip ID, duration and time, then **Keyframe selected joint**. A new track starts with rest-rotation keys at both endpoints. Matching times replace keys. Clips interpolate quaternions, avoiding linear Euler interpolation artifacts.
6. Use **Preview at time** or **Play clip** to review. Playback time is transient; **Save edits** and **Save bundle** preserve the rig, authored pose and keys. **Export GLB** includes the skeleton and clips. Saving a PNG captures the displayed frame.

Changing rest positions rebinds geometry. Pose rotations are absolute local rotations, not offsets from the rest rotation. Editing or selection changes stops playback. The motion example supplies useful complete character bindings and a waving clip; the generic two-joint starter is intentionally only a starting point.

## Agent workflow

```bash
forge3d example create animationLab my-motion
forge3d -p my-motion rig inspect wave
forge3d schema --kind rig --raw
forge3d -p my-motion rig pose wave --joint rightArm --rotation 0,0,110 --dry-run
forge3d -p my-motion rig pose wave --joint rightArm --rotation 0,0,110
forge3d -p my-motion review --node wave --out my-motion/exports/pose-review
forge3d -p my-motion export --validate --out my-motion/exports/animated.glb
```

Use `rig bind <node> --file rig.json` to replace a complete rig or `patchNode` with `rig` in a guarded transaction. `rig inspect` returns bindable mesh paths, the existing rig and concurrency guards. `rig remove` restores the model's authored geometry. The scene rig is instance-specific; capture or export its scene/model bundle to reuse it. Definition-level model changes continue through `model import --replace`.

A minimal rig document:

```json
{
  "joints": [
    { "id": "root", "position": [0, 0, 0] },
    { "id": "upper", "parent": "root", "position": [0, 1, 0] }
  ],
  "binding": "smooth",
  "bindings": {},
  "pose": { "upper": [0, 0, 30] },
  "clips": [
    {
      "id": "bend",
      "duration": 2,
      "tracks": [
        {
          "joint": "upper",
          "keyframes": [
            { "time": 0, "rotation": [0, 0, 0] },
            { "time": 1, "rotation": [0, 0, 45] },
            { "time": 2, "rotation": [0, 0, 0] }
          ]
        }
      ]
    }
  ]
}
```

Rest joint positions are parent-local meters. The root joint is model-local. Explicit binding keys are expanded mesh paths relative to the model instance, as returned by inspection. Automatic binding measures distances to joint origins. Smooth mode blends the two nearest joints with normalized weights; it is not heat diffusion or an automatic anatomical rigging solver.

Rigged instances cannot have authored scene-node children. Put those parts into the model recipe before rigging. Overlapping/nested rigs are rejected; independent rigs in separate models are supported. Pattern copies may carry independent rigs via JSON, while browser rig editing requires an unpatterned instance.

## Interchange and limits

GLB/glTF includes joints, inverse bind matrices, skin indices/weights and quaternion rotation tracks. The export adapter safely clones skeletons and places skinned mesh nodes at scene root; joint hierarchy carries placement, avoiding double transforms in importers. CPU vertex comparisons against a Three.js GLTFLoader import verify placed, rotated and scaled skin geometry. Native Blender and Godot editor imports were not run.

This release has no inverse kinematics, constraints, vertex-weight painting, retargeting, morph targets, skeletal translation/scale tracks or animation baking. OBJ/STL cannot retain rigs or clips; use GLB for animation. Arbitrary GLSL shaders are also outside the portable data contract. Materials support standard metallic/roughness PBR and unlit shading; filmic, neutral and linear display filters are preview settings.
