import type { EditorTool } from '../tool-host.js';
import type { RigSpec } from '../../domain/schema.js';
import { input, select, action, note } from './controls.js';

/** A starter chain is deliberately small; joint positions and mesh bindings remain explicit data. */
export const riggingTool: EditorTool = {
  id: 'rigging',
  label: 'Rig & animation',
  mount(container, context, signal) {
    const hint = note(
      container,
      'Select a model instance. Create joints in its local space, bind its meshes, then pose or keyframe them.',
    );
    const create = action(
      container,
      'Create starter rig',
      () => {
        const node = context.selected();
        if (node?.type !== 'model' || node.rig) return;
        const height = context.inspect()?.bounds.max[1] ?? 1;
        const rig: RigSpec = {
          binding: 'rigid',
          bindings: {},
          pose: {},
          clips: [],
          joints: [
            { id: 'root', position: [0, 0, 0], rotation: [0, 0, 0] },
            {
              id: 'upper',
              parent: 'root',
              position: [0, Math.max(0.1, height / 2), 0],
              rotation: [0, 0, 0],
            },
          ],
        };
        context.edit((draft) => {
          const target = draft.nodes.find((n) => n.id === node.id);
          if (target?.type === 'model') target.rig = rig;
        });
      },
      signal,
    );
    const form = document.createElement('div');
    container.append(form);
    const showJoints = input(form, 'Show joints', 'checkbox');
    showJoints.addEventListener('change', () => context.showJoints(showJoints.checked), { signal });
    const binding = select(form, 'Automatic skinning', [
      ['rigid', 'Nearest joint'],
      ['smooth', 'Two-joint blend'],
    ]);
    const joint = select(form, 'Joint', []);
    const parent = select(form, 'Parent joint', []);
    const positionRow = document.createElement('div');
    positionRow.className = 'vector';
    form.append(positionRow);
    const positions = ['X', 'Y', 'Z'].map((axis) =>
      input(positionRow, `Rest ${axis}`, 'number', '0', { step: '.1' }),
    );
    const poseRow = document.createElement('div');
    poseRow.className = 'vector';
    form.append(poseRow);
    const rotations = ['X', 'Y', 'Z'].map((axis) =>
      input(poseRow, `Pose ${axis}°`, 'number', '0', { step: '5' }),
    );
    const updateRig = (action: (rig: RigSpec) => void) => {
      const node = context.selected();
      if (node?.type !== 'model') return false;
      return context.edit((draft) => {
        const target = draft.nodes.find((n) => n.id === node.id);
        if (target?.type === 'model' && target.rig) action(target.rig);
      });
    };
    const readJoint = () => {
      const node = context.selected();
      if (node?.type !== 'model' || !node.rig) return;
      const rig = node.rig,
        definition = rig.joints.find((j) => j.id === joint.value);
      if (!definition) return;
      parent.replaceChildren(new Option('Root (no parent)', ''));
      rig.joints
        .filter((j) => j.id !== joint.value)
        .forEach((j) => parent.add(new Option(j.id, j.id)));
      parent.value = definition.parent ?? '';
      positions.forEach((control, i) => (control.value = String(definition.position[i])));
      rotations.forEach(
        (control, i) => (control.value = String((rig.pose[joint.value] ?? definition.rotation)[i])),
      );
    };
    joint.addEventListener('change', readJoint, { signal });
    const bind = action(
      form,
      'Apply joint & bind',
      () =>
        updateRig((rig) => {
          const definition = rig.joints.find((j) => j.id === joint.value)!;
          definition.position = positions.map((p) => p.valueAsNumber) as [number, number, number];
          definition.parent = parent.value || undefined;
          rig.pose[joint.value] = rotations.map((p) => p.valueAsNumber) as [number, number, number];
          rig.binding = binding.value as RigSpec['binding'];
        }),
      signal,
    );
    const newName = input(form, 'New joint ID', 'text', '', {
      maxlength: '64',
      placeholder: 'leftHand',
    });
    const add = action(
      form,
      'Add child joint',
      () => {
        if (!/^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/.test(newName.value)) {
          context.notify('Use a letter first, then letters, digits, underscores or hyphens.');
          return;
        }
        const id = newName.value;
        if (
          updateRig((rig) => {
            if (rig.joints.length >= 64) throw new Error('A rig supports up to 64 joints.');
            rig.joints.push({
              id,
              parent: joint.value,
              position: [0, 0.25, 0],
              rotation: [0, 0, 0],
            });
          })
        ) {
          joint.value = id;
          readJoint();
        }
      },
      signal,
    );
    const mesh = select(form, 'Mesh binding', []);
    const assign = action(
      form,
      'Bind mesh to selected joint',
      () =>
        updateRig((rig) => {
          if (mesh.value) rig.bindings[mesh.value] = joint.value;
        }),
      signal,
    );
    const auto = action(
      form,
      'Use automatic mesh binding',
      () =>
        updateRig((rig) => {
          delete rig.bindings[mesh.value];
        }),
      signal,
    );
    note(
      form,
      'Explicit mesh bindings use one joint. Automatic binding uses nearest joint origins; refine the rest joints or assign individual parts.',
    );
    const clip = input(form, 'Clip ID', 'text', 'motion');
    const duration = input(form, 'Clip duration · s', 'number', '2', {
      min: '.1',
      max: '600',
      step: '.1',
    });
    const time = input(form, 'Animation time · s', 'number', '1', {
      min: '0',
      max: '600',
      step: '.1',
    });
    const key = action(
      form,
      'Keyframe selected joint',
      () => {
        if (
          !/^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/.test(clip.value) ||
          !Number.isFinite(duration.valueAsNumber) ||
          duration.valueAsNumber <= 0 ||
          duration.valueAsNumber > 600 ||
          !Number.isFinite(time.valueAsNumber) ||
          time.valueAsNumber < 0 ||
          time.valueAsNumber > duration.valueAsNumber
        ) {
          context.notify('Use a valid clip ID, duration up to 600 s, and time within the clip.');
          return;
        }
        updateRig((rig) => {
          let target = rig.clips.find((c) => c.id === clip.value);
          if (!target) {
            if (rig.clips.length >= 16) throw new Error('Use at most 16 clips.');
            target = { id: clip.value, duration: duration.valueAsNumber, tracks: [] };
            rig.clips.push(target);
          }
          target.duration = duration.valueAsNumber;
          let track = target.tracks.find((t) => t.joint === joint.value);
          const rest = rig.joints.find((j) => j.id === joint.value)!.rotation;
          if (!track) {
            track = {
              joint: joint.value,
              keyframes: [
                { time: 0, rotation: [...rest] },
                { time: target.duration, rotation: [...rest] },
              ],
            };
            target.tracks.push(track);
          }
          const frame = {
            time: time.valueAsNumber,
            rotation: rotations.map((p) => p.valueAsNumber) as [number, number, number],
          };
          track.keyframes = [...track.keyframes.filter((f) => f.time !== frame.time), frame].sort(
            (a, b) => a.time - b.time,
          );
          if (track.keyframes.length > 256) throw new Error('Use at most 256 keyframes per joint.');
        });
      },
      signal,
    );
    const preview = action(
      form,
      'Preview at time',
      () => {
        const node = context.selected();
        if (node) context.previewAnimation(node.id, clip.value, time.valueAsNumber);
      },
      signal,
    );
    let frame = 0;
    const stop = () => {
      cancelAnimationFrame(frame);
      frame = 0;
    };
    const play = action(
      form,
      'Play clip',
      () => {
        if (frame) {
          stop();
          play.textContent = 'Play clip';
          return;
        }
        const node = context.selected();
        const animation =
          node?.type === 'model' ? node.rig?.clips.find((c) => c.id === clip.value) : undefined;
        if (!node || !animation) {
          context.notify('Create or choose an existing clip first.');
          return;
        }
        const started = performance.now();
        play.textContent = 'Stop playback';
        const tick = (now: number) => {
          context.previewAnimation(
            node.id,
            animation.id,
            ((now - started) / 1000) % animation.duration,
          );
          frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
      },
      signal,
    );
    clip.addEventListener(
      'input',
      () => {
        const node = context.selected();
        const found =
          node?.type === 'model' ? node.rig?.clips.find((c) => c.id === clip.value) : undefined;
        preview.disabled = !found;
        if (found) duration.value = String(found.duration);
      },
      { signal },
    );
    const reset = action(
      form,
      'Reset pose',
      () =>
        updateRig((rig) => {
          rig.pose = {};
        }),
      signal,
    );
    const remove = action(
      form,
      'Remove rig',
      () => {
        const node = context.selected();
        context.edit((draft) => {
          const target = draft.nodes.find((n) => n.id === node?.id);
          if (target?.type === 'model') delete target.rig;
        });
      },
      signal,
    );
    const status = note(form, '');
    for (const button of [bind, add, assign, auto, key, reset, remove])
      button.disabled = !context.editable;
    return {
      dispose: stop,
      refresh() {
        stop();
        play.textContent = 'Play clip';
        const node = context.selected(),
          rig = node?.type === 'model' ? node.rig : undefined;
        hint.hidden = !!rig && !node?.pattern;
        hint.textContent = node?.pattern
          ? 'Edit rigs on patterned instances through the CLI, or use an unpatterned model in the editor.'
          : 'Select a model instance. Create joints in its local space, bind its meshes, then pose or keyframe them.';
        form.hidden = !rig || !!node?.pattern;
        create.hidden = !!rig;
        create.disabled = !context.editable || node?.type !== 'model' || !!node.pattern;
        context.showJoints(!!rig && showJoints.checked);
        if (!rig) return;
        const previous = joint.value;
        joint.replaceChildren();
        rig.joints.forEach((j) => joint.add(new Option(j.id, j.id)));
        if (rig.joints.some((j) => j.id === previous)) joint.value = previous;
        binding.value = rig.binding;
        readJoint();
        const selectedMesh = mesh.value;
        mesh.replaceChildren();
        context.inspect()?.meshes.forEach((m) => mesh.add(new Option(m.path, m.path)));
        if (Array.from(mesh.options).some((o) => o.value === selectedMesh))
          mesh.value = selectedMesh;
        status.textContent = `${rig.joints.length} joints · ${rig.clips.length} clips${rig.clips.length ? ': ' + rig.clips.map((c) => c.id).join(', ') : ''}. Rotation keys interpolate as quaternions.`;
        preview.disabled = !rig.clips.some((c) => c.id === clip.value);
      },
    };
  },
};
