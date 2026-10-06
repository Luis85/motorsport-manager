import { uuid } from '../../domain/identity.js';
import type { EditorTool } from '../tool-host.js';
import type { MaterialSpec } from '../../domain/schema.js';
import { input, select, action, note } from './controls.js';

export const materialTool: EditorTool = {
  id: 'materials',
  label: 'Materials & shading',
  mount(container, context, signal) {
    const hint = note(container, 'Select a mesh or model to edit a material slot.');
    const form = document.createElement('div');
    container.append(form);
    const slot = select(form, 'Material slot', []);
    const color = input(form, 'Surface color', 'color');
    const shading = select(form, 'Shader', [
      ['standard', 'Standard PBR'],
      ['unlit', 'Unlit'],
    ]);
    const metalness = input(form, 'Metalness', 'number', '0', { min: '0', max: '1', step: '.05' });
    const roughness = input(form, 'Roughness', 'number', '.65', {
      min: '0',
      max: '1',
      step: '.05',
    });
    const emissive = input(form, 'Emission color', 'color');
    let definitions: Record<string, MaterialSpec> = {};
    const read = () => {
      const material = definitions[slot.value];
      if (!material) return;
      color.value = material.color;
      shading.value = material.shading ?? 'standard';
      metalness.value = String(material.metalness);
      roughness.value = String(material.roughness);
      emissive.value = material.emissive ?? '#000000';
    };
    slot.addEventListener('change', read, { signal });
    const paint = action(
      form,
      'Apply material',
      () => {
        const selected = context.selected();
        if (!selected) return;
        const material = {
          ...definitions[slot.value],
          color: color.value,
          shading: shading.value as 'standard' | 'unlit',
          metalness: metalness.valueAsNumber,
          roughness: roughness.valueAsNumber,
          emissive: emissive.value,
          emissiveIntensity: 1,
        };
        if (
          ![material.metalness, material.roughness].every(
            (n) => Number.isFinite(n) && n >= 0 && n <= 1,
          )
        ) {
          context.notify('Metalness and roughness must be between 0 and 1.');
          return;
        }
        context.edit((draft) => {
          const node = draft.nodes.find((n) => n.id === selected.id)!;
          // Stable per-instance slot IDs let repeated edits update rather than leak materials.
          const stem = `${node.id.slice(0, 16)}_${slot.value.slice(0, 12)}_${uuid(node.id + '/' + slot.value).slice(-12)}_paint`;
          let id =
            node.type === 'model'
              ? node.materialOverrides[slot.value]
              : node.type === 'mesh'
                ? node.material
                : undefined;
          if (!id || (id !== stem && !id.startsWith(stem + '_'))) {
            id = stem;
            let i = 2;
            while (Object.hasOwn(draft.materials, id)) id = `${stem}_${i++}`;
          }
          draft.materials[id] = material;
          if (node.type === 'model') node.materialOverrides[slot.value] = id;
          else if (node.type === 'mesh') node.material = id;
        });
      },
      signal,
    );
    paint.disabled = !context.editable;
    return {
      refresh() {
        const node = context.selected(),
          doc = context.document(),
          previous = slot.value;
        definitions =
          node?.type === 'model'
            ? { ...context.models()[node.model]?.materials }
            : node?.type === 'mesh'
              ? { [node.material]: doc.materials[node.material] }
              : {};
        if (node?.type === 'model')
          for (const [from, to] of Object.entries(node.materialOverrides))
            definitions[from] = doc.materials[to];
        slot.replaceChildren();
        Object.keys(definitions).forEach((id) => slot.add(new Option(id, id)));
        if (definitions[previous]) slot.value = previous;
        form.hidden = !slot.options.length;
        hint.hidden = !form.hidden;
        read();
      },
    };
  },
};
export const environmentTool: EditorTool = {
  id: 'environment',
  label: 'Scene lighting & preview look',
  mount(container, context, signal) {
    note(
      container,
      'Preview only: these studio lights and display filters stay in the recipe. Add an authored light to include it in GLB.',
    );
    const background = input(container, 'Background', 'color');
    const ambient = input(container, 'Ambient intensity', 'number', '', {
      min: '0',
      max: '5',
      step: '.1',
    });
    const key = input(container, 'Studio key intensity', 'number', '', {
      min: '0',
      max: '10',
      step: '.1',
    });
    const exposure = input(container, 'Exposure', 'number', '', {
      min: '.1',
      max: '4',
      step: '.1',
    });
    const look = select(container, 'Display filter', [
      ['filmic', 'Filmic'],
      ['neutral', 'Neutral'],
      ['linear', 'Linear'],
    ]);
    const apply = action(
      container,
      'Apply scene look',
      () => {
        if (
          ![
            [ambient, 0, 5],
            [key, 0, 10],
            [exposure, 0.1, 4],
          ].every(([control, min, max]) => {
            const value = (control as HTMLInputElement).valueAsNumber;
            return Number.isFinite(value) && value >= Number(min) && value <= Number(max);
          })
        ) {
          context.notify('Use values within the displayed intensity and exposure ranges.');
          return;
        }
        context.edit((draft) => {
          draft.environment = {
            ...draft.environment,
            background: background.value,
            ambient: ambient.valueAsNumber,
            keyIntensity: key.valueAsNumber,
            exposure: exposure.valueAsNumber,
            toneMapping: look.value as 'filmic' | 'neutral' | 'linear',
          };
        });
      },
      signal,
    );
    apply.disabled = !context.editable;
    return {
      refresh() {
        const env = context.document().environment;
        background.value = env.background;
        ambient.value = String(env.ambient);
        key.value = String(env.keyIntensity);
        exposure.value = String(env.exposure ?? 1);
        look.value = env.toneMapping ?? 'filmic';
      },
    };
  },
};
