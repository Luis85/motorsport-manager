import { material, box, cylinder, mesh, instance, scene } from './recipe.mjs';
const humanRig = {
  binding: 'rigid',
  joints: [
    { id: 'hips', position: [0, 0.72, 0] },
    { id: 'spine', parent: 'hips', position: [0, 0.38, 0] },
    { id: 'head', parent: 'spine', position: [0, 0.47, 0] },
    { id: 'leftArm', parent: 'spine', position: [-0.3, 0.25, 0] },
    { id: 'rightArm', parent: 'spine', position: [0.3, 0.25, 0] },
    { id: 'leftLeg', parent: 'hips', position: [-0.13, -0.05, 0] },
    { id: 'rightLeg', parent: 'hips', position: [0.13, -0.05, 0] },
  ],
  bindings: {
    torso: 'spine',
    hip: 'hips',
    badge: 'spine',
    head: 'head',
    leftEye: 'head',
    rightEye: 'head',
    leftArm: 'leftArm',
    leftHand: 'leftArm',
    rightArm: 'rightArm',
    rightHand: 'rightArm',
    leftLeg: 'leftLeg',
    leftShoe: 'leftLeg',
    rightLeg: 'rightLeg',
    rightShoe: 'rightLeg',
  },
  pose: {},
  clips: [
    {
      id: 'wave',
      duration: 2,
      tracks: [
        {
          joint: 'rightArm',
          keyframes: [
            { time: 0, rotation: [0, 0, 0] },
            { time: 0.6, rotation: [0, 0, 130] },
            { time: 1, rotation: [0, 0, 110] },
            { time: 1.4, rotation: [0, 0, 135] },
            { time: 2, rotation: [0, 0, 0] },
          ],
        },
        {
          joint: 'head',
          keyframes: [
            { time: 0, rotation: [0, 0, 0] },
            { time: 1, rotation: [0, -20, 0] },
            { time: 2, rotation: [0, 0, 0] },
          ],
        },
      ],
    },
  ],
};
export const animationLab = {
  models: [],
  description:
    'Editable seven-joint characters with explicit part bindings, poses and a portable waving animation.',
  features: [
    'Skeleton joints',
    'Explicit mesh skinning',
    'Pose overrides',
    'Quaternion animation clips',
  ],
  scene: scene(
    'animationLab',
    'Motion Workshop / Rest, pose, animate',
    {
      ground: material('#45535b'),
      plinth: material('#738184'),
      gold: material('#ba8a52'),
      red: material('#ac7760'),
      blue: material('#709ba7'),
    },
    { ground: box(8, 0.12, 5), plinth: cylinder(0.8, 0.14, 48) },
    [
      mesh('floor', 'ground', 'ground', [0, -0.08, 0]),
      mesh('plinths', 'plinth', 'plinth', [-2.3, 0.07, 0], {
        pattern: { type: 'linear', count: 3, step: [2.3, 0, 0] },
      }),
      ...['rest', 'wave', 'walk'].map((id, i) =>
        instance(id, 'person', [(i - 1) * 2.3, 0.14, 0], {
          parameters: { leftArm: 0, rightArm: 0 },
          materialOverrides: { outfit: ['blue', 'gold', 'red'][i] },
          rig: {
            ...structuredClone(humanRig),
            pose:
              i === 1
                ? { rightArm: [0, 0, 125], head: [0, -15, 0] }
                : i === 2
                  ? {
                      leftArm: [-25, 0, 0],
                      rightArm: [25, 0, 0],
                      leftLeg: [30, 0, 0],
                      rightLeg: [-30, 0, 0],
                    }
                  : {},
          },
        }),
      ),
    ],
  ),
};
