/** Original exterior fittings and reproducible native PBR finish for the two tank studies. */
export function armoredDetailOperations(german) {
  const operations = [];
  const put = (id, geometry) => operations.push({ op: 'putGeometry', id, geometry });
  const box = (id, size) => put(id, { type: 'box', size });
  const mesh = (id, geometry, material, parent, position, rotation = [0, 0, 0]) =>
    operations.push({
      op: 'putNode',
      node: { id, type: 'mesh', geometry, material, parent, transform: { position, rotation } },
    });
  const finish = (kind, seed, scale, wear, palette) => ({
    version: 1,
    kind,
    seed,
    scale,
    wear,
    ...(palette ? { palette } : {}),
  });
  const paint = finish(
    'painted-metal',
    german ? 1944 : 1945,
    1,
    0.055,
    german ? ['#8b815b', '#667052', '#716047'] : undefined,
  );
  for (const [id, material] of Object.entries({
    armor: {
      color: german ? '#ffffff' : '#697b53',
      roughness: 0.83,
      metalness: 0.82,
      finish: paint,
    },
    raised: {
      color: german ? '#e9e4d6' : '#84916b',
      roughness: 0.8,
      metalness: 0.82,
      finish: paint,
    },
    track: {
      color: '#505044',
      roughness: 0.88,
      metalness: 0.6,
      finish: finish('bare-metal', german ? 210 : 110, 5, 0.55),
    },
    steel: {
      color: '#777b70',
      roughness: 0.57,
      metalness: 0.8,
      finish: finish('bare-metal', german ? 211 : 111, 4, 0.28),
    },
    rubber: {
      color: '#34372e',
      roughness: 0.98,
      metalness: 0,
      finish: finish('rubber', german ? 212 : 112, 3, 0.32),
    },
  }))
    operations.push({ op: 'putMaterial', id, material });

  // Improve the rounded Sherman silhouette without changing its authored extents or pivot.
  if (!german) {
    put('turretShell', { type: 'sphere', radius: 1, segments: 32 });
    put('detailTransmissionCover', {
      type: 'organic',
      size: [2.12, 0.72, 0.66],
      roundness: 1,
      segments: 24,
    });
    mesh('frontTransmissionCover', 'detailTransmissionCover', 'armor', 'chassis', [0, 0.8, 2.03]);
  }
  box('detailDriverHatch', [0.56, 0.09, 0.6]);
  box('detailPeriscope', [0.26, 0.13, 0.12]);
  box('detailWeldLong', [0.028, 0.025, 3.65]);
  box('detailWeldCross', [2.4, 0.025, 0.028]);
  box('detailFenderBrace', [0.045, 0.25, 0.045]);
  box('detailHinge', [0.2, 0.08, 0.1]);
  box('detailVentFrame', [1.82, 0.055, 0.05]);
  box('detailToolClamp', [0.17, 0.045, 0.06]);
  box('detailLampGuard', [0.035, 0.23, 0.22]);
  put('detailHandle', {
    type: 'tube',
    points: [
      [-0.1, 0, 0],
      [-0.1, 0.075, 0],
      [0.1, 0.075, 0],
      [0.1, 0, 0],
    ],
    radius: 0.018,
    tubularSegments: 8,
    radialSegments: 5,
  });
  put('detailTowRing', { type: 'torus', radius: 0.09, tube: 0.025, segments: 10 });
  put('detailLamp', {
    type: 'cylinder',
    radiusTop: 0.075,
    radiusBottom: 0.075,
    height: 0.1,
    segments: 12,
  });
  put('detailExhaust', {
    type: 'cylinder',
    radiusTop: 0.1,
    radiusBottom: 0.1,
    height: 0.42,
    segments: 12,
  });
  put('detailExhaustBore', {
    type: 'cylinder',
    radiusTop: 0.07,
    radiusBottom: 0.07,
    height: 0.006,
    segments: 12,
  });

  for (const side of [-1, 1]) {
    const prefix = side < 0 ? 'left' : 'right';
    mesh(`${prefix}DriverHatch`, 'detailDriverHatch', 'raised', 'chassis', [
      side * 0.61,
      1.56,
      1.19,
    ]);
    mesh(`${prefix}DriverPeriscope`, 'detailPeriscope', 'dark', 'chassis', [
      side * 0.61,
      1.65,
      1.36,
    ]);
    mesh(`${prefix}DriverHatchHandle`, 'detailHandle', 'steel', 'chassis', [
      side * 0.61,
      1.615,
      1.05,
    ]);
    mesh(`${prefix}DriverHinge`, 'detailHinge', 'steel', 'chassis', [side * 0.61, 1.61, 0.91]);
    mesh(`${prefix}DeckWeld`, 'detailWeldLong', 'raised', 'chassis', [side * 1.24, 1.525, -0.07]);
    mesh(
      `${prefix}Headlamp`,
      'detailLamp',
      'glass',
      'chassis',
      [side * 1.05, 1.58, 2.23],
      [90, 0, 0],
    );
    mesh(`${prefix}HeadlampGuard`, 'detailLampGuard', 'armor', 'chassis', [
      side * 1.17,
      1.59,
      2.18,
    ]);
    mesh(`${prefix}FrontTowRing`, 'detailTowRing', 'steel', 'chassis', [side * 0.86, 0.85, 2.3]);
    mesh(`${prefix}RearTowRing`, 'detailTowRing', 'steel', 'chassis', [side * 0.86, 0.81, -2.5]);
    mesh(`${prefix}ExhaustPipe`, 'detailExhaust', 'steel', 'chassis', [side * 0.75, 1.01, -2.44]);
    mesh(`${prefix}ExhaustBore`, 'detailExhaustBore', 'dark', 'chassis', [
      side * 0.75,
      1.223,
      -2.44,
    ]);
    mesh(
      `${prefix}TurretLift`,
      'detailTowRing',
      'raised',
      'turretPivot',
      [side * 0.69, 0.73, -0.21],
      [0, 90, 0],
    );
    for (const [index, z] of [-1.9, -0.65, 0.65, 1.9].entries())
      mesh(
        `${prefix}FenderBrace${index}`,
        'detailFenderBrace',
        'dark',
        'chassis',
        [side * 1.48, 1.16, z],
        [0, 0, side * 28],
      );
    for (const [index, z] of [-1.75, -0.67].entries())
      mesh(`${prefix}ToolClamp${index}`, 'detailToolClamp', 'armor', 'chassis', [
        side * 1.0,
        1.59,
        z,
      ]);
  }
  mesh('frontDeckWeld', 'detailWeldCross', 'raised', 'chassis', [0, 1.525, 1.88]);
  mesh('rearDeckWeld', 'detailWeldCross', 'raised', 'chassis', [0, 1.525, -2.22]);
  mesh('frontVentFrame', 'detailVentFrame', 'raised', 'chassis', [0, 1.57, -0.97]);
  mesh('rearVentFrame', 'detailVentFrame', 'raised', 'chassis', [0, 1.57, -2.14]);
  mesh('commanderHatchHandle', 'detailHandle', 'steel', 'turretPivot', [
    german ? 0 : -0.34,
    1.025,
    -0.42,
  ]);
  mesh('loaderHatchHandle', 'detailHandle', 'steel', 'turretPivot', [0.4, 0.845, 0.25]);
  return operations;
}
