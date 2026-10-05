import type { EditorTool } from '../tool-host.js';
import { input, select, action, note } from './controls.js';
export const lightingTool: EditorTool = {
  id: 'lights',
  label: 'Authored lights',
  mount(container, context, signal) {
    note(
      container,
      'Point, spot and directional lights export with GLB. Spot and directional lights aim along local −Z; rotate them with the transform controls.',
    );
    const kind = select(container, 'New light type', [
      ['point', 'Point'],
      ['spot', 'Spot'],
      ['directional', 'Directional'],
    ]);
    const add = action(
      container,
      'Add light',
      () => {
        const id = context.availableId(`${kind.value}Light`);
        if (
          context.edit((draft) =>
            draft.nodes.push({
              id,
              type: 'light',
              light: kind.value as 'point' | 'spot' | 'directional',
              name: `${kind.value[0].toUpperCase()}${kind.value.slice(1)} light`,
              color: '#ffffff',
              intensity: kind.value === 'directional' ? 3 : 50,
              distance: 0,
              angle: 35,
              penumbra: 0.25,
              castShadow: false,
              tags: [],
              visible: true,
              transform: { position: [0, 3, 2], rotation: [-45, 0, 0] },
            }),
          )
        )
          context.select(id);
      },
      signal,
    );
    add.disabled = !context.editable;
    const form = document.createElement('div');
    container.append(form);
    const color = input(form, 'Light color', 'color');
    const intensity = input(form, 'Light intensity', 'number', '', {
      min: '0',
      max: '10000',
      step: '1',
    });
    const distance = input(form, 'Light range · m (0 = unlimited)', 'number', '', {
      min: '0',
      max: '100000',
    });
    const angle = input(form, 'Spot cone half-angle · °', 'number', '', { min: '1', max: '89' });
    const shadow = input(form, 'Cast shadows', 'checkbox');
    const apply = action(
      form,
      'Apply light',
      () => {
        const selected = context.selected();
        if (
          ![
            [intensity, 0, 10000],
            [distance, 0, 100000],
            [angle, 1, 89],
          ].every(([control, min, max]) => {
            const n = (control as HTMLInputElement).valueAsNumber;
            return Number.isFinite(n) && n >= Number(min) && n <= Number(max);
          })
        ) {
          context.notify('Use finite values within the displayed light ranges.');
          return;
        }
        context.edit((draft) => {
          const node = draft.nodes.find((n) => n.id === selected?.id);
          if (node?.type === 'light')
            Object.assign(node, {
              color: color.value,
              intensity: intensity.valueAsNumber,
              distance: distance.valueAsNumber,
              angle: angle.valueAsNumber,
              castShadow: shadow.checked,
            });
        });
      },
      signal,
    );
    apply.disabled = !context.editable;
    return {
      refresh() {
        const node = context.selected();
        form.hidden = node?.type !== 'light';
        if (node?.type !== 'light') return;
        color.value = node.color;
        intensity.value = String(node.intensity);
        distance.value = String(node.distance);
        angle.value = String(node.angle);
        shadow.checked = node.castShadow;
        angle.parentElement!.hidden = node.light !== 'spot';
        distance.parentElement!.hidden = node.light === 'directional';
      },
    };
  },
};
