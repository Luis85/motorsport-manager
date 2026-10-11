import test from 'node:test';
import assert from 'node:assert/strict';
import {refineArtboardOutfit, artboardOutfitMaterial} from '../src/application/artboard-outfits.ts';
import {piping, shell} from '../src/application/wardrobe-meshes.ts';
import type {TexturedMesh} from '../src/application/companion-uvs.ts';
import {compileVisual, type Data} from '../src/application/compiler.ts';
import {createCharacter} from '../src/domain/character.ts';
import * as THREE from 'three';

const volume = (mesh: TexturedMesh): number => {
  let sum = 0;
  for (let i=0;i<mesh.indices.length;i+=3) {
    const [a,b,c] = mesh.indices.slice(i,i+3).map(index=>mesh.positions.slice(index*3,index*3+3));
    sum += (a[0]*(b[1]*c[2]-b[2]*c[1])+a[1]*(b[2]*c[0]-b[0]*c[2])+a[2]*(b[0]*c[1]-b[1]*c[0]))/6;
  }
  return sum;
};
function integrity(mesh: TexturedMesh, label: string): void {
  assert.equal(mesh.positions.length,mesh.normals.length,label);
  assert.equal(mesh.uvs.length,mesh.positions.length/3*2,label);
  assert.ok([...mesh.positions,...mesh.normals,...mesh.uvs].every(Number.isFinite),label);
  for(let i=0;i<mesh.normals.length;i+=3) assert.ok(Math.abs(Math.hypot(...mesh.normals.slice(i,i+3))-1)<.00001,`${label}: unit normal`);
  for(let i=0;i<mesh.indices.length;i+=3) {
    const [a,b,c]=mesh.indices.slice(i,i+3).map(index=>mesh.positions.slice(index*3,index*3+3));
    const ab=b.map((value,axis)=>value-a[axis]),ac=c.map((value,axis)=>value-a[axis]);
    const area=Math.hypot(ab[1]*ac[2]-ab[2]*ac[1],ab[2]*ac[0]-ab[0]*ac[2],ab[0]*ac[1]-ab[1]*ac[0]);
    assert.ok(area>1e-12,`${label}: nondegenerate triangle ${i/3}`);
  }
}
const bounds = (mesh: TexturedMesh, axis:number) => {
  const values=mesh.positions.filter((_,index)=>index%3===axis); return [Math.min(...values),Math.max(...values)];
};

test('wardrobe shells and piping have outward closed geometry and continuous UV seam normals',()=>{
  const patch=shell(8,6,(u,v)=>[u,v,Math.sin(u*3)*.1],.02);
  const reversed=shell(8,6,(u,v)=>[1-u,v,Math.sin(u*3)*.1],.02);
  for(const mesh of [patch,reversed]) { integrity(mesh,'shell'); assert.ok(volume(mesh)>0); }
  const ring=shell(24,4,(u,v)=>[Math.cos(u*Math.PI*2),v,Math.sin(u*Math.PI*2)],.02);
  integrity(ring,'closed ring'); assert.ok(volume(ring)>0);
  const tube=piping([[0,0,0],[.1,.2,0],[.2,.3,.1]],.01);
  integrity(tube,'tube'); assert.ok(volume(tube)>0);
  for(let row=0;row<3;row++) {
    assert.deepEqual(tube.normals.slice(row*21,row*21+3),tube.normals.slice(row*21+18,row*21+21));
  }
});

test('tailored wardrobe meshes carry finite explicit UVs with bounded reusable geometry',()=>{
  const visual:Data={meshes:{}};
  for(const item of ['trail_cap','woodland_vest','rain_cape','field_satchel','walking_boots','swift_shoes']) {
    const nodes:Data[]=[];
    refineArtboardOutfit(item,nodes,visual);
    assert.ok(nodes.length>=5,item);
    assert.ok(nodes.every(node=>node.primitive==='mesh'),item);
    const before=JSON.stringify(visual.meshes);
    refineArtboardOutfit(item,[],visual);
    assert.equal(JSON.stringify(visual.meshes),before,'Reusing sockets must not duplicate mesh definitions');
  }
  let vertices=0;
  for(const [id,mesh] of Object.entries(visual.meshes)) {
    integrity(mesh as TexturedMesh,id);
    vertices+=(mesh as TexturedMesh).positions.length/3;
  }
  assert.ok(vertices<18000,`Wardrobe library remains bounded: ${vertices} vertices`);
  assert.ok(JSON.stringify(visual).length<1800000);
  const cape = visual.meshes['outfit-cape-drape'] as TexturedMesh;
  const shoulder: number[][] = [];
  for (let index=0;index<cape.positions.length;index+=3) {
    const vertex=cape.positions.slice(index,index+3);
    if(vertex[1]>=.073 && vertex[1]<=.113) shoulder.push(vertex);
  }
  assert.ok(Math.max(...shoulder.map(vertex=>Math.abs(vertex[0])))>.26,
    'Shoulder cloth must sit outside the arm envelope, not intersect the torso');
  assert.ok(Math.min(...shoulder.map(vertex=>vertex[2]))<-.19,
    'The back drape must clear the torso below the shoulders');
  const bill=visual.meshes['outfit-cap-curved-bill'];
  assert.ok(bounds(bill,1)[1]-bounds(bill,1)[0]>.04,'Visor must curve down, not remain a flat disc');
  assert.ok(bounds(visual.meshes['outfit-satchel-flap'],2)[1]-bounds(visual.meshes['outfit-satchel-flap'],2)[0]>.009,'Leather flap has thickness and a curved fold');
});

test('tailored footwear meets its outsole and the satchel strap reaches both bag attachments',()=>{
  const visual:Data={meshes:{}};
  const boots:Data[]=[]; refineArtboardOutfit('walking_boots',boots,visual);
  const boot=boots.find(node=>node.id==='boot')!,sole=boots.find(node=>node.id==='sole')!;
  const transformed=(node:Data,axis:number)=>bounds(visual.meshes[node.mesh],axis).map(value=>value*node.scale[axis]+node.position[axis]);
  const [bottom]=transformed(boot,1),[soleBottom,soleTop]=transformed(sole,1);
  assert.ok(soleBottom<bottom && soleTop>bottom);
  for(const axis of [0,2]) {
    const [min,max]=transformed(boot,axis),[soleMin,soleMax]=transformed(sole,axis);
    assert.ok(soleMin<=min && soleMax>=max,`Sole supports complete leather footprint on axis ${axis}`);
  }
  const bag:Data[]=[];refineArtboardOutfit('field_satchel',bag,visual);
  const strap=visual.meshes['outfit-satchel-strap'] as TexturedMesh;
  for(const endpoint of [[-.225,-.025,.445],[-.225,-.025,.370]]) {
    let nearest=Infinity;
    for(let i=0;i<strap.positions.length;i+=3) nearest=Math.min(nearest,Math.hypot(...strap.positions.slice(i,i+3).map((value,axis)=>value-endpoint[axis])));
    assert.ok(nearest<.004,'A stitched shoulder strap must meet the bag, not float above it');
  }
  assert.equal((artboardOutfitMaterial('rain_cape','primary','#c9a953') as Data).color,'#617149');
  assert.equal((artboardOutfitMaterial('field_satchel','primary','#b07848') as Data).surface.kind,'leather');
});


test('cached wardrobe templates remain detached from every consumer export', () => {
  const first: Data = {meshes: {}}, second: Data = {meshes: {}}, untouched: Data = {meshes: {}};
  refineArtboardOutfit('rain_cape', [], first);
  refineArtboardOutfit('rain_cape', [], untouched);
  const key = 'outfit-cape-drape';
  first.meshes[key].positions[0] = 999;
  first.meshes[key].normals[0] = -999;
  first.meshes[key].uvs[0] = 999;
  first.meshes[key].indices[0] = 999;
  refineArtboardOutfit('rain_cape', [], second);
  assert.deepEqual(second, untouched, 'An edited export must never poison a later generated cape');
  for (const field of ['positions', 'normals', 'uvs', 'indices'])
    assert.notEqual(second.meshes[key][field], untouched.meshes[key][field]);
});


test('short cape clears both lifted work arms through the full work swing', () => {
  const character = createCharacter();
  character.outfits.body = 'rain_cape';
  const visual = compileVisual(character);
  for (const swing of [.65, .77]) {
    const transformed = new Map<string, {node: Data; matrix: THREE.Matrix4}>();
    const walk = (nodes: Data[], parent: THREE.Matrix4) => {
      for (const node of nodes) {
        const rotation = [...(node.rotation || [0, 0, 0])];
        if (visual.rig.arms.includes(node.id)) rotation[0] -= swing;
        const local = new THREE.Matrix4().compose(
          new THREE.Vector3().fromArray(node.position || [0, 0, 0]),
          new THREE.Quaternion().setFromEuler(new THREE.Euler(rotation[0], rotation[1], rotation[2])),
          new THREE.Vector3().fromArray(node.scale || [1, 1, 1]));
        const matrix = parent.clone().multiply(local);
        transformed.set(node.id, {node, matrix});
        walk(node.children || [], matrix);
      }
    };
    walk(visual.models['world-round'].nodes, new THREE.Matrix4());
    const cape = transformed.get('outfit-body-body-gear-socket-cape')!;
    const mesh = visual.meshes[cape.node.mesh] as TexturedMesh;
    for (const side of ['left', 'right']) for (const part of ['upper', 'paw']) {
      const arm = transformed.get(`arm-${side}-${part}`)!;
      const armMesh = visual.meshes[arm.node.mesh] as TexturedMesh;
      let envelope = 0;
      for (let index = 0; index < armMesh.positions.length; index += 3)
        envelope = Math.max(envelope, Math.hypot(...armMesh.positions.slice(index, index + 3)));
      const intoArm = arm.matrix.clone().invert().multiply(cape.matrix);
      for (let index = 0; index < mesh.indices.length; index += 3) {
        const corners = mesh.indices.slice(index, index + 3).map(vertex =>
          new THREE.Vector3().fromArray(mesh.positions, vertex * 3).applyMatrix4(intoArm));
        const distance = new THREE.Triangle(corners[0], corners[1], corners[2])
          .closestPointToPoint(new THREE.Vector3(), new THREE.Vector3()).length();
        assert.ok(distance > envelope, `${side} ${part}: cape triangle ${index / 3} intersects work swing ${swing}`);
      }
    }
  }
});
