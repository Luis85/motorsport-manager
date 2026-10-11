// Inspector form bindings for the selected node: name, visibility and the
// position/rotation/scale fields commit through the viewer's transactional `change`
// port. Filling the form from the selection belongs to the panels module.
import type { NodeSpec } from '../domain/schema.js';
import { $, field } from './dom.js';

export function bindInspectorFields({
  currentNode,
  change,
}: {
  currentNode(): NodeSpec | undefined;
  change(action: () => void): boolean;
}) {
  field('node-name').addEventListener('change', () =>
    change(() => {
      const node = currentNode();
      if (node) node.name = field('node-name').value;
    }),
  );
  field('node-visible').addEventListener('change', () =>
    change(() => {
      const node = currentNode();
      if (node) node.visible = field('node-visible').checked;
    }),
  );
  for (const key of ['position', 'rotation', 'scale'] as const)
    for (const axis of ['x', 'y', 'z'])
      field(`${key}-${axis}`).addEventListener('change', () => {
        const values = ['x', 'y', 'z'].map((a) => field(`${key}-${a}`).valueAsNumber) as [
          number,
          number,
          number,
        ];
        change(() => {
          const node = currentNode();
          if (node) node.transform = { ...node.transform, [key]: values };
        });
      });
  $('transform-form').addEventListener('submit', (event) => event.preventDefault());
}
