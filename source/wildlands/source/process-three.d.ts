/**
 * Typed facade of the vendored three.js (`globalThis.THREE`, vendor/three.js) for the Process Studio 3D view: exactly the classes,
 * members and constants that process-renderer-3d.ts, the process-3d-*.ts modules and the room builders (process-rooms*.ts) use, so
 * they type-check without `any`. It declares types only and no runtime value: the modules read `THREE` from the global object when
 * they build a scene (a check may wrap `THREE.WebGLRenderer` before creating a surface). Other three.js users (pet-renderer.ts,
 * asset-renderer.ts) keep their own boundaries. Add a member here only when the process renderer starts to use it.
 */
declare namespace LWThree {
 type ColorInput = string | number | Color;
 /** XYZ Euler angles in radians, as a fixed piece's optional turn. */
 type Turn = readonly [number, number, number];
 interface Vector2 {x: number; y: number; set(x: number, y: number): this;}
 interface Vector3 {
  x: number; y: number; z: number;
  set(x: number, y: number, z: number): this; setScalar(value: number): this; copy(v: Vector3): this; clone(): Vector3;
  add(v: Vector3): this; sub(v: Vector3): this; addScaledVector(v: Vector3, scale: number): this; multiplyScalar(scale: number): this;
  length(): number; normalize(): this; project(camera: Camera): this; applyQuaternion(q: Quaternion): this;
  applyMatrix4(m: Matrix4): this; applyNormalMatrix(m: Matrix3): this; fromArray(array: ArrayLike<number>, offset?: number): this;
 }
 interface Euler {x: number; y: number; z: number; set(x: number, y: number, z: number): this;}
 interface Quaternion {setFromEuler(euler: Euler): this; setFromUnitVectors(from: Vector3, to: Vector3): this;}
 interface Matrix4 {compose(position: Vector3, quaternion: Quaternion, scale: Vector3): this;}
 interface Matrix3 {getNormalMatrix(matrix: Matrix4): this;}
 interface Color {r: number; g: number; b: number; set(color: ColorInput): this; getHexString(): string;}

 interface Object3D {
  parent: Object3D | null; children: Object3D[]; position: Vector3; rotation: Euler; scale: Vector3; quaternion: Quaternion;
  visible: boolean; castShadow: boolean; receiveShadow: boolean; renderOrder: number;
  /** Free-form data for checks and the asset renderer; the process modules write it and keep their own typed records to read. */
  userData: Record<string, unknown>;
  add(...objects: Object3D[]): this; remove(...objects: Object3D[]): this; traverse(callback: (object: Object3D) => void): void;
  lookAt(target: Vector3): void;
 }
 interface Group extends Object3D {readonly isGroup: true;}
 interface Scene extends Object3D {readonly isScene: true;}
 interface Mesh extends Object3D {readonly isMesh: true; geometry: BufferGeometry; material: Material;}
 interface Sprite extends Object3D {readonly isSprite: true; geometry: BufferGeometry; material: SpriteMaterial; center: Vector2;}
 interface LineSegments extends Object3D {geometry: BufferGeometry; material: Material;}

 interface Camera extends Object3D {}
 interface PerspectiveCamera extends Camera {fov: number; aspect: number; near: number; far: number; updateProjectionMatrix(): void;}
 interface OrthographicCamera extends Camera {
  left: number; right: number; top: number; bottom: number; far: number; updateProjectionMatrix(): void;
 }
 interface HemisphereLight extends Object3D {}
 interface DirectionalLight extends Object3D {
  target: Object3D; shadow: {mapSize: Vector2; bias: number; normalBias: number; camera: OrthographicCamera}; dispose(): void;
 }

 interface BufferAttribute {readonly count: number; readonly itemSize: number; readonly array: ArrayLike<number>; needsUpdate: boolean;}
 interface BufferGeometry {
  index: BufferAttribute | null; userData: Record<string, unknown>; readonly drawRange: {start: number; count: number};
  getAttribute(name: 'position' | 'normal'): BufferAttribute; setAttribute(name: string, attribute: BufferAttribute): this;
  setIndex(index: BufferAttribute): this; setDrawRange(start: number, count: number): void;
  rotateX(angle: number): this; translate(x: number, y: number, z: number): this; computeBoundingSphere(): void; dispose(): void;
 }

 /** Options shared by the material constructors the process renderer calls. */
 interface MaterialOptions {
  color?: ColorInput; roughness?: number; emissive?: ColorInput; emissiveIntensity?: number; vertexColors?: boolean;
  transparent?: boolean; opacity?: number; depthTest?: boolean; depthWrite?: boolean; toneMapped?: boolean; map?: Texture;
 }
 interface Material {transparent: boolean; depthTest: boolean; depthWrite: boolean; dispose(): void;}
 interface MeshStandardMaterial extends Material {color: Color; emissive: Color;}
 interface MeshBasicMaterial extends Material {color: Color;}
 interface LineBasicMaterial extends Material {color: Color;}
 interface SpriteMaterial extends Material {map: Texture | null;}
 interface Texture {image: HTMLCanvasElement; needsUpdate: boolean; dispose(): void;}

 interface Raycaster {
  setFromCamera(coords: Vector2, camera: Camera): void;
  intersectObjects(objects: Object3D[], recursive?: boolean): {object: Object3D}[];
 }
 interface WebGLRenderer {
  readonly info: {memory: {geometries: number; textures: number}; programs: unknown[] | null; render: {calls: number; triangles: number}};
  shadowMap: {enabled: boolean; type: number}; toneMapping: number; toneMappingExposure: number; renderLists: {dispose(): void};
  setPixelRatio(ratio: number): void; setClearColor(color: ColorInput): void; setSize(width: number, height: number, updateStyle?: boolean): void;
  render(scene: Scene, camera: Camera): void; dispose(): void; forceContextLoss(): void;
 }
 type TypedArray = Float32Array | Uint16Array | Uint32Array;
 /** The constructors and constants of the global `THREE` namespace that the process renderer uses. */
 interface Module {
  readonly PCFShadowMap: number; readonly ACESFilmicToneMapping: number;
  WebGLRenderer: new (options: {canvas: HTMLCanvasElement; antialias: boolean; preserveDrawingBuffer: boolean}) => WebGLRenderer;
  Scene: new () => Scene; Group: new () => Group; Object3D: new () => Object3D;
  PerspectiveCamera: new (fov: number, aspect: number, near: number, far: number) => PerspectiveCamera;
  HemisphereLight: new (sky: ColorInput, ground: ColorInput, intensity: number) => HemisphereLight;
  DirectionalLight: new (color: ColorInput, intensity: number) => DirectionalLight;
  Raycaster: new () => Raycaster;
  Vector2: new (x?: number, y?: number) => Vector2; Vector3: new (x?: number, y?: number, z?: number) => Vector3;
  Euler: new () => Euler; Quaternion: new () => Quaternion; Matrix4: new () => Matrix4; Matrix3: new () => Matrix3;
  /** Without an argument the colour is white. */
  Color: new (color?: ColorInput) => Color;
  BufferGeometry: new () => BufferGeometry; BufferAttribute: new (array: TypedArray, itemSize: number) => BufferAttribute;
  BoxGeometry: new (width: number, height: number, depth: number) => BufferGeometry;
  PlaneGeometry: new (width: number, height: number) => BufferGeometry;
  ConeGeometry: new (radius: number, height: number, radialSegments: number) => BufferGeometry;
  CylinderGeometry: new (radiusTop: number, radiusBottom: number, height: number, radialSegments: number) => BufferGeometry;
  TorusGeometry: new (radius: number, tube: number, radialSegments: number, tubularSegments: number) => BufferGeometry;
  SphereGeometry: new (radius: number, widthSegments: number, heightSegments: number) => BufferGeometry;
  MeshStandardMaterial: new (options: MaterialOptions) => MeshStandardMaterial;
  MeshBasicMaterial: new (options: MaterialOptions) => MeshBasicMaterial;
  LineBasicMaterial: new (options: MaterialOptions) => LineBasicMaterial;
  SpriteMaterial: new (options: MaterialOptions) => SpriteMaterial;
  Mesh: new (geometry: BufferGeometry, material: Material) => Mesh;
  Sprite: new (material: SpriteMaterial) => Sprite;
  LineSegments: new (geometry: BufferGeometry, material: Material) => LineSegments;
  CanvasTexture: new (canvas: HTMLCanvasElement) => Texture;
 }
}
