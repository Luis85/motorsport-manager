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
    const surface = document.createElement('fieldset');
    const legend = document.createElement('legend');
    legend.textContent = 'Soft fabric & polished surfaces';
    surface.append(legend);
    form.append(surface);
    note(surface, 'Sheen softens fur and fabric edges. Clearcoat adds a polished outer surface.');
    const physical = Object.fromEntries(
      [
        ['sheen', 'Sheen amount'],
        ['sheenRoughness', 'Sheen softness'],
        ['clearcoat', 'Clearcoat amount'],
        ['clearcoatRoughness', 'Clearcoat roughness'],
      ].map(([key, label]) => [
        key,
        input(surface, label, 'number', '0', { min: '0', max: '1', step: '.05' }),
      ]),
    );
    const detail = select(surface, 'Surface detail', [
      ['none', 'Smooth'],
      ['fur', 'Short fur'],
      ['cloth', 'Woven cloth'],
      ['leather', 'Soft leather'],
    ]);
    const detailSeed = input(surface, 'Detail seed', 'number', '7', {
      min: '0',
      max: '65535',
      step: '1',
    });
    const detailScale = input(surface, 'Detail repeat', 'number', '3', {
      min: '1',
      max: '16',
      step: '.5',
    });
    const detailStrength = input(surface, 'Detail strength', 'number', '.4', {
      min: '0',
      max: '1',
      step: '.05',
    });
    note(
      surface,
      'Deterministic surface detail travels with Littlewild and GLB. It shades the form without changing its silhouette.',
    );
    const sheenColor = input(surface, 'Sheen color', 'color', '#ffffff');
    const updateShading = () => {
      surface.disabled = shading.value === 'unlit';
    };
    shading.addEventListener('change', updateShading, { signal });
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
      for (const [key, control] of Object.entries(physical))
        control.value = String(
          material[key as keyof MaterialSpec] ?? (key === 'sheenRoughness' ? 1 : 0),
        );
      detail.value = material.surface?.kind ?? 'none';
      detailSeed.value = String(material.surface?.seed ?? 7);
      detailScale.value = String(material.surface?.scale ?? 3);
      detailStrength.value = String(material.surface?.strength ?? 0.4);
      sheenColor.value = material.sheenColor ?? '#ffffff';
      updateShading();
    };
    slot.addEventListener('change', read, { signal });
    const paint = action(
      form,
      'Apply material',
      () => {
        const selected = context.selected();
        if (!selected) return;
        const { surface: previousSurface, ...baseMaterial } = definitions[slot.value];
        const hasDetail = detail.value !== 'none' && shading.value === 'standard';
        if (
          hasDetail &&
          (!Number.isInteger(detailSeed.valueAsNumber) ||
            detailSeed.valueAsNumber < 0 ||
            detailSeed.valueAsNumber > 65535 ||
            !Number.isFinite(detailScale.valueAsNumber) ||
            detailScale.valueAsNumber < 1 ||
            detailScale.valueAsNumber > 16 ||
            !Number.isFinite(detailStrength.valueAsNumber) ||
            detailStrength.valueAsNumber < 0 ||
            detailStrength.valueAsNumber > 1)
        ) {
          context.notify('Detail needs an integer seed 0–65535, repeat 1–16 and strength 0–1.');
          return;
        }
        const material = {
          ...baseMaterial,
          ...(hasDetail
            ? {
                surface: {
                  kind: detail.value as 'fur' | 'cloth' | 'leather',
                  seed: detailSeed.valueAsNumber,
                  scale: detailScale.valueAsNumber,
                  strength: detailStrength.valueAsNumber,
                },
              }
            : {}),
          color: color.value,
          shading: shading.value as 'standard' | 'unlit',
          metalness: metalness.valueAsNumber,
          roughness: roughness.valueAsNumber,
          emissive: emissive.value,
          emissiveIntensity: definitions[slot.value].emissiveIntensity ?? 1,
          ...Object.fromEntries(
            Object.entries(physical).map(([key, control]) => [key, control.valueAsNumber]),
          ),
          sheenColor: sheenColor.value,
        };
        if (
          ![
            material.metalness,
            material.roughness,
            ...Object.values(physical).map((control) => control.valueAsNumber),
          ].every((n) => Number.isFinite(n) && n >= 0 && n <= 1)
        ) {
          context.notify('Material amounts and roughness must be between 0 and 1.');
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
    const presentation = select(container, 'Light rig', [
      ['inspection', 'Neutral inspection'],
      ['portrait', 'Warm portrait studio'],
    ]);
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
            presentation: presentation.value as 'inspection' | 'portrait',
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
    const portrait = action(
      container,
      'Use portrait studio',
      () => {
        presentation.value = 'portrait';
        background.value = '#eee7d8';
        ambient.value = '1.1';
        key.value = '3.2';
        exposure.value = '1';
        look.value = 'filmic';
        apply.click();
      },
      signal,
    );
    portrait.disabled = !context.editable;
    return {
      refresh() {
        const env = context.document().environment;
        presentation.value = env.presentation ?? 'inspection';
        background.value = env.background;
        ambient.value = String(env.ambient);
        key.value = String(env.keyIntensity);
        exposure.value = String(env.exposure ?? 1);
        look.value = env.toneMapping ?? 'filmic';
      },
    };
  },
};
