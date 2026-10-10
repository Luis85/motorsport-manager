import type { Data } from './compiler.js';

const soft = (id: string, position: number[], scale: number[], material: string): Data =>
  ({ id, primitive: 'mesh', mesh: 'studio-soft', position, scale, material });

/** Preserve the equipment socket contract while replacing blocky presentation pieces. */
export function refineCompanionOutfit(item: string, nodes: Data[]): void {
  if (item === 'trail_cap') {
    nodes.splice(0, nodes.length,
      soft('crown', [0, .014, -.016], [.229, .020, .186], 'primary'),
      soft('cap', [0, .059, -.030], [.213, .088, .169], 'primary'),
      soft('brim', [0, .011, .153], [.169, .018, .103], 'primary'),
      soft('cap-button', [0, .145, -.030], [.013, .006, .013], 'dark'),
      { ...soft('leaf-left', [-.017, .086, .137], [.011, .024, .004], 'light'), rotation: [0, 0, -.65] },
      { ...soft('leaf-right', [.010, .094, .137], [.011, .026, .004], 'light'), rotation: [0, 0, .5] },
    );
  }
  if (item === 'walking_boots' || item === 'swift_shoes') {
    const sole = nodes.find(node => node.id === 'sole');
    if (sole) Object.assign(sole, soft('sole', [0, -.070, .044], [.113, .014, .155], 'dark'));
  }
  if (item === 'field_satchel') {
    nodes.splice(0, nodes.length,
      soft('pack', [-.205, -.070, .380], [.100, .115, .041], 'primary'),
      soft('flap', [-.205, -.016, .426], [.099, .052, .011], 'primary'),
      soft('buckle', [-.205, -.024, .439], [.016, .022, .006], 'metal'),
      { ...soft('strap', [-.064, .065, .432], [.014, .190, .008], 'dark'), rotation: [0, 0, -.6] },
    );
  }
  if (item === 'woodland_vest') {
    // Open front and soft shoulders keep the companion's cream bib readable.
    nodes.splice(0, nodes.length,
      soft('vest-back', [0, .009, -.127], [.228, .163, .082], 'primary'),
      { ...soft('vest-left', [-.144, .015, .114], [.077, .152, .071], 'primary'), rotation: [0, -.35, -.1] },
      { ...soft('vest-right', [.144, .015, .114], [.077, .152, .071], 'primary'), rotation: [0, .35, .1] },
      soft('button-a', [-.081, .065, .175], [.012, .012, .007], 'metal'),
      soft('button-b', [-.083, -.012, .174], [.012, .012, .007], 'metal'),
    );
  }
}

/** Surface recipes remain data and follow each exported material into the other tools. */
export function companionOutfitMaterial(item: string, role: string, material: Data | string): Data | string {
  if (!['primary', 'light', 'dark'].includes(role)) return material;
  const kind = ['walking_boots', 'swift_shoes', 'field_satchel'].includes(item) ? 'leather'
    : ['trail_cap', 'stargazer_hat', 'woodland_vest', 'rain_cape'].includes(item) ? 'cloth' : null;
  if (!kind) return material;
  return {
    ...(typeof material === 'string' ? {color: material} : material),
    roughness: kind === 'cloth' ? .94 : .78, flatShading: false,
    surface: {kind, seed: kind === 'cloth' ? 19 : 23, scale: kind === 'cloth' ? 5 : 4, strength: .2},
  };
}
