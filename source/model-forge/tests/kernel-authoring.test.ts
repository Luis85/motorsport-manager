import {
  auditScene,
  parse,
  SceneSchema,
  ModelSchema,
  RigSchema,
  type RigSpec,
  compileScene,
  exportScene,
  validateExport,
  bindRig,
  rigClips,
  validateRig,
} from '../src/kernel/index.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
const scene = (extra = {}) =>
  parse(SceneSchema, { schemaVersion: 1, kind: 'scene', id: 'main', name: 'Main', ...extra });
const model = parse(ModelSchema, {
  schemaVersion: 1,
  kind: 'model',
  id: 'pole',
  name: 'Pole',
  geometries: { cube: { type: 'box', size: [0.2, 1, 0.2] } },
  materials: { paint: { color: '#44aacc' } },
  nodes: [
    {
      id: 'part',
      type: 'mesh',
      geometry: 'cube',
      material: 'paint',
      transform: { position: [0, 0.5, 0] },
    },
  ],
});
const rig = (): RigSpec =>
  parse(RigSchema, {
    joints: [
      { id: 'root', position: [0, 0, 0] },
      { id: 'upper', parent: 'root', position: [0, 1, 0] },
    ],
    clips: [
      {
        id: 'wave',
        duration: 2,
        tracks: [
          {
            joint: 'upper',
            keyframes: [
              { time: 0, rotation: [0, 0, 0] },
              { time: 1, rotation: [0, 0, 60] },
              { time: 2, rotation: [0, 0, 0] },
            ],
          },
        ],
      },
    ],
  });
test('capped spline tube has UVs, nondegenerate caps and outward normals', () => {
  const doc = scene({
    geometries: {
      hose: {
        type: 'tube',
        points: [
          [0, 0, 0],
          [0, 1, 0],
          [1, 2, 0],
        ],
        radius: 0.15,
        tubularSegments: 16,
        radialSegments: 8,
      },
    },
    materials: { paint: { color: '#445566' } },
    nodes: [{ id: 'hose', type: 'mesh', geometry: 'hose', material: 'paint' }],
  });
  const built = compileScene(doc);
  try {
    const mesh = built.content.children[0] as THREE.Mesh,
      geometry = mesh.geometry;
    assert.equal(built.stats.triangles, 16 * 8 * 2 + 16);
    const positions = geometry.getAttribute('position'),
      normals = geometry.getAttribute('normal');
    assert.equal(positions.count, geometry.getAttribute('uv').count);
    const indices = geometry.index!;
    for (let i = indices.count - 48; i < indices.count; i += 3) {
      const [a, b, c] = [0, 1, 2].map((j) =>
        new THREE.Vector3().fromBufferAttribute(positions, indices.getX(i + j)),
      );
      const cross = b.sub(a).cross(c.sub(a));
      assert.ok(cross.length() > 1e-7);
      assert.ok(cross.dot(new THREE.Vector3().fromBufferAttribute(normals, indices.getX(i))) > 0);
    }
    const invalid = structuredClone(doc);
    (invalid.geometries.hose as { points: number[][] }).points[1] = [0, 0, 0];
    assert.throws(() => compileScene(invalid), /coincident/);
  } finally {
    built.dispose();
  }
});
test('path placement composes transforms and aligns local positive Z with successive points', () => {
  const built = compileScene(
    scene({
      nodes: [
        {
          id: 'row',
          type: 'model',
          model: 'pole',
          transform: { position: [4, 0, 0] },
          pattern: {
            type: 'path',
            points: [
              [0, 0, 0],
              [2, 0, 0],
              [2, 0, 3],
            ],
            orient: 'yaw',
          },
        },
      ],
    }),
    { pole: model },
  );
  try {
    const [a, b, c] = built.content.children[0].children;
    assert.deepEqual(a.getWorldPosition(new THREE.Vector3()).toArray(), [4, 0, 0]);
    assert.ok(Math.abs(a.rotation.y - Math.PI / 2) < 1e-8);
    assert.equal(b.rotation.y, 0);
    assert.equal(c.rotation.y, 0);
  } finally {
    built.dispose();
  }
});
test('integer parameters reject fractional overrides before pattern expansion', () => {
  const integerModel = {
    ...model,
    parameters: { count: { default: 3, min: 1, max: 8, integer: true } },
  };
  assert.throws(
    () =>
      compileScene(
        scene({ nodes: [{ id: 'one', type: 'model', model: 'pole', parameters: { count: 2.5 } }] }),
        { pole: integerModel },
      ),
    /integer/,
  );
});
test('authored punctual lights and unlit surfaces survive validated GLB export', async () => {
  const doc = scene({
    materials: { plain: { color: '#dd9944', shading: 'unlit' } },
    nodes: [
      { id: 'one', type: 'model', model: 'pole', materialOverrides: { paint: 'plain' } },
      { id: 'key', type: 'light', light: 'spot', transform: { rotation: [-45, 0, 0] } },
    ],
  });
  const exported = await exportScene(doc, { pole: model }, 'gltf');
  const gltf = JSON.parse(exported.data as string);
  assert.ok(gltf.extensionsUsed.includes('KHR_lights_punctual'));
  assert.ok(gltf.extensionsUsed.includes('KHR_materials_unlit'));
  assert.equal((await validateExport(exported.data, 'gltf')).numErrors, 0);
});
test('rig produces normalized weights, isolated geometry, pose bounds and portable skeleton animations', async () => {
  const spec = rig();
  spec.binding = 'smooth';
  spec.pose.upper = [0, 0, 45];
  const doc = scene({
    nodes: [
      {
        id: 'one',
        type: 'model',
        model: 'pole',
        rig: spec,
        transform: { position: [4, 1, 2], rotation: [0, 30, 0], scale: [2, 2, 2] },
      },
      { id: 'two', type: 'model', model: 'pole' },
    ],
  });
  const built = compileScene(doc, { pole: model });
  try {
    const skin = built.content.getObjectByName('main/one/part') as THREE.SkinnedMesh;
    assert.ok(skin.isSkinnedMesh);
    assert.equal(skin.skeleton.bones.length, 2);
    const weights = skin.geometry.getAttribute('skinWeight');
    for (let i = 0; i < weights.count; i++)
      assert.ok(Math.abs(weights.getX(i) + weights.getY(i) - 1) < 1e-6);
    const other = built.content.getObjectByName('main/two/part') as THREE.Mesh;
    assert.equal(other.geometry.getAttribute('skinWeight'), undefined);
    const clip = rigClips(built.scene)[0];
    assert.equal(clip.duration, 2);
    const mixer = new THREE.AnimationMixer(built.scene);
    mixer.clipAction(clip).play();
    mixer.setTime(1);
    assert.ok(Math.abs(skin.skeleton.bones[1].rotation.z - Math.PI / 3) < 1e-6);
    const data = await exportScene(doc, { pole: model }, 'glb');
    const report = await validateExport(data.data, 'glb');
    assert.equal(report.numErrors, 0, JSON.stringify(report));
    assert.equal(report.numWarnings, 0, JSON.stringify(report));
    const bytes = Buffer.from(data.data);
    const json = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString());
    assert.equal(json.skins.length, 1);
    assert.equal(json.animations.length, 1);
    assert.ok(
      json.meshes.some((mesh: { primitives: { attributes: Record<string, number> }[] }) =>
        mesh.primitives.some((primitive) => primitive.attributes.JOINTS_0 !== undefined),
      ),
    );
    const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
    const loaded = await new GLTFLoader().parseAsync(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      '',
    );
    loaded.scene.updateMatrixWorld(true);
    let imported: THREE.SkinnedMesh | undefined;
    loaded.scene.traverse((object) => {
      if (object instanceof THREE.SkinnedMesh && object.userData.forgePath === 'main/one/part')
        imported = object;
    });
    assert.ok(imported);
    // Compare exported authored pose, not the temporary mixer sample above.
    const authored = compileScene(doc, { pole: model });
    try {
      const expected = authored.content.getObjectByName('main/one/part') as THREE.SkinnedMesh;
      for (let vertex = 0; vertex < expected.geometry.getAttribute('position').count; vertex++) {
        const a = expected
          .getVertexPosition(vertex, new THREE.Vector3())
          .applyMatrix4(expected.matrixWorld);
        const b = imported
          .getVertexPosition(vertex, new THREE.Vector3())
          .applyMatrix4(imported.matrixWorld);
        assert.ok(a.distanceTo(b) < 1e-5, `Skin placement differs at vertex ${vertex}`);
      }
    } finally {
      authored.dispose();
    }
  } finally {
    built.dispose();
  }
});
test('rig validation rejects cycles, missing bindings, overlapping rigs and unordered keyframes', () => {
  const broken = rig();
  broken.joints[0].parent = 'upper';
  assert.throws(() => validateRig(broken), /root/);
  const duplicate = rig();
  duplicate.joints.push(duplicate.joints[0]);
  assert.throws(() => validateRig(duplicate), /unique/);
  const frames = rig();
  frames.clips[0].tracks[0].keyframes[1].time = 0;
  assert.throws(() => validateRig(frames), /increase/);
  const invalid = rig();
  invalid.bindings.missing = 'root';
  assert.throws(
    () =>
      compileScene(scene({ nodes: [{ id: 'one', type: 'model', model: 'pole', rig: invalid }] }), {
        pole: model,
      }),
    /mesh path/,
  );
  const root = new THREE.Group();
  root.add(new THREE.SkinnedMesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial()));
  assert.throws(() => bindRig(root, rig()), /another rig/);
});

test('capsule pole faces are clean even with zero straight-section length', () => {
  for (const length of [0, 0.42]) {
    const doc = scene({
      geometries: { body: { type: 'capsule', radius: 0.2, length, segments: 24 } },
      materials: { paint: { color: '#556677' } },
      nodes: [{ id: 'capsule', type: 'mesh', geometry: 'body', material: 'paint' }],
    });
    const report = auditScene(doc, {});
    assert.equal(report.passed, true, JSON.stringify(report.findings));
  }
});

test('compiled buffers survive ObjectLoader transport without regenerating pole faces or losing tube caps', () => {
  const doc = scene({
    geometries: {
      capsule: { type: 'capsule', radius: 0.2, length: 0.42 },
      lathe: {
        type: 'lathe',
        points: [
          [0, 0],
          [1, 0],
          [1, 1],
          [0, 1],
        ],
      },
      tube: {
        type: 'tube',
        radius: 0.1,
        points: [
          [0, 0, 0],
          [1, 1, 0],
          [2, 1, 0],
        ],
        capEnds: true,
      },
    },
    materials: { paint: { color: '#aabbcc' } },
    nodes: ['capsule', 'lathe', 'tube'].map((id) => ({
      id,
      type: 'mesh',
      geometry: id,
      material: 'paint',
    })),
  });
  const built = compileScene(doc);
  try {
    const copy = new THREE.ObjectLoader().parse(built.scene.toJSON());
    for (const id of ['capsule', 'lathe', 'tube']) {
      const original = built.content.getObjectByName(`main/${id}`) as THREE.Mesh;
      const restored = copy.getObjectByName(`main/${id}`) as THREE.Mesh;
      assert.deepEqual(
        Array.from(restored.geometry.index!.array),
        Array.from(original.geometry.index!.array),
      );
      for (const attribute of ['position', 'normal', 'uv'])
        assert.deepEqual(
          Array.from(restored.geometry.getAttribute(attribute).array),
          Array.from(original.geometry.getAttribute(attribute).array),
        );
    }
  } finally {
    built.dispose();
  }
});
