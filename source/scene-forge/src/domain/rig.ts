import type { RigSpec } from './schema.js';
import { fail } from './errors.js';

/** Environment-free validation shared by CLI compilation and editor transactions. */
export function validateRig(rig: RigSpec) {
  const joints = new Map(rig.joints.map((joint) => [joint.id, joint]));
  if (joints.size !== rig.joints.length) fail('RIG_INVALID', 'Joint IDs must be unique.');
  if (rig.joints.filter((joint) => !joint.parent).length !== 1)
    fail('RIG_INVALID', 'A rig needs exactly one root joint.');
  for (const joint of rig.joints) {
    const visited = new Set([joint.id]);
    let parent = joint.parent;
    while (parent) {
      if (!joints.has(parent)) fail('RIG_INVALID', `Unknown parent joint ${parent}.`);
      if (visited.has(parent)) fail('RIG_INVALID', `Joint cycle at ${parent}.`);
      visited.add(parent);
      parent = joints.get(parent)!.parent;
    }
    if (
      ![...joint.position, ...joint.rotation].every((n) => Number.isFinite(n) && Math.abs(n) <= 1e6)
    )
      fail('RIG_INVALID', 'Joint coordinates must be finite and within ±1,000,000.');
  }
  for (const id of [...Object.keys(rig.pose), ...Object.values(rig.bindings)])
    if (!joints.has(id)) fail('RIG_INVALID', `Unknown joint ${id}.`);
  for (const rotation of Object.values(rig.pose))
    if (!rotation.every((n) => Number.isFinite(n) && Math.abs(n) <= 1e6))
      fail('RIG_INVALID', 'Pose rotations must be finite and within ±1,000,000.');
  const clips = new Set<string>();
  for (const clip of rig.clips) {
    if (clips.has(clip.id)) fail('RIG_INVALID', `Duplicate clip ${clip.id}.`);
    clips.add(clip.id);
    const tracks = new Set<string>();
    for (const track of clip.tracks) {
      if (!joints.has(track.joint) || tracks.has(track.joint))
        fail('RIG_INVALID', `Clip ${clip.id} needs unique, existing joint tracks.`);
      tracks.add(track.joint);
      let previous = -1;
      for (const frame of track.keyframes) {
        if (!Number.isFinite(frame.time) || frame.time <= previous || frame.time > clip.duration)
          fail('RIG_INVALID', `Clip ${clip.id} keyframe times must increase within its duration.`);
        if (!frame.rotation.every((n) => Number.isFinite(n) && Math.abs(n) <= 1e6))
          fail('RIG_INVALID', `Clip ${clip.id} has an invalid rotation.`);
        previous = frame.time;
      }
    }
  }
}
