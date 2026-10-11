import type {Data} from './compiler.js';
import {combine, piping, roundedBox, sample, shaped, shell, type Point} from './wardrobe-meshes.js';
import type {TexturedMesh} from './companion-uvs.js';

const meshNode = (id: string, mesh: string, material: string, position = [0, 0, 0], scale = [1, 1, 1]): Data =>
  ({id, primitive: 'mesh', mesh, position, scale, material});
const oval = (x: number, y: number, z: number, rx: number, rz: number): Point[] =>
  sample(32, t => [x + Math.sin(t * Math.PI * 2) * rx, y, z + Math.cos(t * Math.PI * 2) * rz]);
const curve = (a: Point, b: Point, c: Point, count = 16): Point[] => sample(count, t =>
  a.map((value, axis) => value * (1 - t) ** 2 + 2 * b[axis] * t * (1 - t) + c[axis] * t * t) as Point);

// Fixed authored templates are immutable; each export owns detached numeric arrays.
// This cache never contains characters, recipes, transforms or material choices.
const templates = new Map<string, TexturedMesh>();
function detachedTemplate(id: string, build: () => TexturedMesh): TexturedMesh {
  let template = templates.get(id);
  if (!template) {
    template = build();
    for (const values of Object.values(template)) Object.freeze(values);
    Object.freeze(template);
    if (templates.size >= 64) templates.delete(templates.keys().next().value!);
    templates.set(id, template);
  }
  return {positions: template.positions.slice(), normals: template.normals.slice(),
    uvs: template.uvs.slice(), indices: template.indices.slice()};
}

/** Revision 4 clothing is a collection of shaped, closed surfaces, not scaled balls. */
export function refineArtboardOutfit(item: string, nodes: Data[], visual: Data): void {
  const register = (name: string, build: () => TexturedMesh): string => {
    const id = `outfit-${name}`;
    visual.meshes ??= {};
    visual.meshes[id] ??= detachedTemplate(id, build);
    return id;
  };
  const box = () => register('rounded-box', roundedBox);
  const pipe = (name: string, points: Point[], radius = .002): string => register(name, () => piping(points, radius));
  const soft = (id: string, position: number[], scale: number[], material: string) =>
    meshNode(id, 'studio-soft', material, position, scale);
  const buckle = (name: string, center: Point, width: number, height: number): string => {
    const [x, y, z] = center;
    const points: Point[] = [[x-width,y-height,z],[x-width,y+height,z],[x+width,y+height,z],
      [x+width,y-height,z],[x-width,y-height,z]];
    return register(name, () => combine([piping(points,.0025), piping([[x,y-height,z],[x,y+height,z]],.0018)]));
  };
  if (item === 'trail_cap') {
    const crown = register('cap-crown', () => shaped((x, y, z) => {
      const gather = 1 + .018 * Math.cos(Math.atan2(z, x) * 6) * (1 - Math.abs(y));
      return [x * gather, y >= 0 ? y : y * .065, z * gather];
    }, 36, 18));
    const billPoint = (u: number, v: number): Point => {
      const x = u * 2 - 1;
      return [x * .194, .020 + .019 * x * x - .043 * v * v, .072 + v * (.194 - .073 * x * x)];
    };
    const bill = register('cap-curved-bill', () => shell(24, 8, billPoint, .009));
    const seams = register('cap-panel-seams', () => combine(Array.from({length: 6}, (_, index) => {
      const angle = index * Math.PI / 3;
      return piping(sample(14, t => {
        const latitude = .08 + t * (Math.PI / 2 - .08);
        return [.210 * Math.sin(latitude) * Math.cos(angle), .031 + .117 * Math.cos(latitude),
          -.026 + .180 * Math.sin(latitude) * Math.sin(angle)];
      }), .00145);
    })));
    const leaf = register('cap-leaf', () => shaped((x, y, z) => [x * (.68 - .38 * y), y, z * .6], 16, 10));
    nodes.splice(0, nodes.length,
      meshNode('crown', crown, 'primary', [0,.030,-.026], [.205,.116,.175]),
      meshNode('brim', bill, 'primary'),
      meshNode('cap-panel-seams', seams, 'dark'),
      meshNode('cap-band', pipe('cap-band', oval(0,.023,-.026,.205,.175),.004), 'dark'),
      meshNode('brim-piping', pipe('cap-brim-piping', sample(24,t => billPoint(t,1)),.0025), 'light'),
      soft('cap-button', [0,.149,-.026], [.012,.006,.012], 'primary'),
      {...meshNode('leaf-left',leaf,'light',[-.014,.071,.139],[.017,.027,.006]),rotation:[-.18,0,-.65]},
      {...meshNode('leaf-right',leaf,'light',[.016,.080,.139],[.017,.031,.006]),rotation:[-.18,0,.58]},
      meshNode('leaf-stem',pipe('cap-leaf-stem',[[-.002,.042,.143],[0,.072,.146],[.001,.108,.128]],.0018),'light'),
    );
  }
  if (item === 'woodland_vest' || item === 'rain_cape') {
    const cape = item === 'rain_cape';
    const clothPoint = (u: number, v: number): Point => {
      const opening = cape ? .22 + v * .65 : .64;
      const angle = opening + u * (Math.PI * 2 - opening * 2);
      const radius = cape ? .145 + .165 * Math.sin(v * Math.PI / 2) ** .42 : .214 - v * .023;
      const fold = (cape ? .012 : .004) * Math.sin(angle * 9 + .25) * v * v;
      // A short shoulder cape releases the lifting forearm below its side hem.
      // The rear panel keeps its longer drape; no animation or body part is hidden.
      const armClearance = cape ? .16 * Math.abs(Math.sin(angle)) ** .65 * v : 0;
      return [Math.sin(angle) * (radius + fold),
        (cape ? .180 - .220 * v : .125 - .278 * v) + armClearance + (cape ? .016 * Math.cos(angle * 5) * v : 0),
        Math.cos(angle) * (radius * (cape ? .88 : .91) + fold) - (cape ? .012 : 0)];
    };
    if (cape) {
      const drape = register('cape-drape', () => shell(48, 12, clothPoint, .006));
      const collar = register('cape-folded-collar', () => shell(40, 5, (u, v) => {
        const angle = .23 + u * (Math.PI * 2 - .46), radius = .145 + .055 * v;
        return [Math.sin(angle) * radius, .180 - .048 * v + .007 * Math.sin(angle * 5), Math.cos(angle) * radius * .93];
      }, .007));
      nodes.splice(0, nodes.length,
        meshNode('cape',drape,'primary'), meshNode('collar',collar,'primary'),
        meshNode('cape-hem',pipe('cape-hem',sample(48,t=>clothPoint(t,1)),.0025),'light'),
        meshNode('cape-opening-left',pipe('cape-opening-left',sample(12,t=>clothPoint(0,t)),.0025),'light'),
        meshNode('cape-opening-right',pipe('cape-opening-right',sample(12,t=>clothPoint(1,t)),.0025),'light'),
      );
    } else {
      const left = register('vest-left',()=>shell(24,10,(u,v)=>clothPoint(u*.5,v),.005));
      const right = register('vest-right',()=>shell(24,10,(u,v)=>clothPoint(.5+u*.5,v),.005));
      nodes.splice(0,nodes.length,
        meshNode('vest-left',left,'primary'),meshNode('vest-right',right,'primary'),
        meshNode('vest-left-binding',pipe('vest-left-binding',sample(14,t=>clothPoint(0,t)),.004),'dark'),
        meshNode('vest-right-binding',pipe('vest-right-binding',sample(14,t=>clothPoint(1,t)),.004),'dark'),
        meshNode('vest-hem',pipe('vest-hem',sample(40,t=>clothPoint(t,1)),.003),'dark'),
      );
      for (const side of [-1,1]) nodes.push({...meshNode(`vest-pocket-${side}`,box(),'dark',[side*.142,-.078,.158],[.035,.036,.008]),rotation:[0,side*.45,0]});
    }
    nodes.push(
      meshNode('clasp-loop',pipe(`${item}-clasp-loop`,sample(20,t=>[Math.sin(t*Math.PI*2)*.017,.120+Math.cos(t*Math.PI*2)*.021,.199]),.003),'metal'),
      soft('clasp-center',[0,.120,.199],[.011,.014,.006],'metal'),
      meshNode('clasp-tie-left',pipe(`${item}-tie-left`,curve([-.084,.140,.198],[-.044,.095,.209],[-.004,.131,.198]),.003),'dark'),
      meshNode('clasp-tie-right',pipe(`${item}-tie-right`,curve([.084,.140,.198],[.044,.095,.209],[.004,.131,.198]),.003),'dark'),
    );
  }
  if (item === 'field_satchel') {
    const flap = register('satchel-flap',()=>shell(12,10,(u,v)=>{
      const x = u*2-1;
      return [-.225+x*.087,
        .020*(1-v)**3+3*.044*v*(1-v)**2-3*.012*v*v*(1-v)-.083*v**3+.008*x*x,
        .370*(1-v)**3+3*.470*v*(1-v)**2+3*.480*v*v*(1-v)+.466*v**3];
    },.006));
    const strapPath = [
      ...curve([-.225,-.025,.445],[-.040,.077,.477],[.150,.110,.350],16),
      ...curve([.150,.110,.350],[.200,.110,.180],[.105,.090,.062],12).slice(1),
      ...curve([.105,.090,.062],[-.090,.040,.035],[-.225,-.025,.370],16).slice(1),
    ];
    const strap = register('satchel-strap',()=>shell(4,strapPath.length-1,(u,v)=>{
      const index = Math.min(strapPath.length-2,Math.floor(v*(strapPath.length-1)));
      const progress = v*(strapPath.length-1)-index, a = strapPath[index], b = strapPath[index+1];
      const dx = b[0]-a[0], dy = b[1]-a[1], length = Math.hypot(dx,dy) || 1;
      const point = a.map((value,axis)=>value+(b[axis]-value)*progress) as Point;
      return [point[0]+(u-.5)*.025*dy/length,point[1]-(u-.5)*.025*dx/length,point[2]];
    },.005));
    const seam = register('satchel-seams',()=>combine([
      piping([[-.303,-.028,.450],[-.303,-.149,.450],[-.281,-.173,.450],[-.169,-.173,.450],[-.148,-.148,.450],[-.148,-.028,.450]],.0015),
      piping(sample(16,t=>[-.308+t*.166,-.078+.010*(t*2-1)**2,.466]),.0014),
    ]));
    nodes.splice(0,nodes.length,
      meshNode('pack',box(),'primary',[-.225,-.087,.407],[.092,.100,.049]),
      meshNode('flap',flap,'dark'), meshNode('bag-seams',seam,'light'),
      meshNode('strap',strap,'dark'),
      meshNode('buckle',buckle('satchel-buckle',[-.225,-.074,.483],.013,.017),'metal'),
      meshNode('buckle-tab',box(),'primary',[-.225,-.092,.478],[.008,.036,.003]),
      meshNode('front-pocket',box(),'primary',[-.264,-.112,.460],[.027,.032,.011]),
      meshNode('side-gusset',box(),'dark',[-.314,-.092,.407],[.008,.078,.037]),
      meshNode('strap-fastener',buckle('satchel-strap-fastener',[-.168,-.008,.451],.008,.012),'metal'),
    );
  }
  if (item === 'walking_boots' || item === 'swift_shoes') {
    const walking = item === 'walking_boots';
    const upper = register('boot-upper',()=>shaped((x,y,z)=>[
      Math.sign(x)*Math.abs(x)**.66*(1+.06*z), Math.sign(y)*Math.abs(y)**.66 * (y > 0 ? .84 - .28*z : 1),
      Math.sign(z)*Math.abs(z)**.66 + .06*(1-y),
    ],28,16));
    const sole = register('boot-sole',()=>shaped((x,y,z)=>[
      Math.sign(x)*Math.abs(x)**.48, Math.sign(y)*Math.abs(y)**.48, Math.sign(z)*Math.abs(z)**.48,
    ],28,12));
    const cuffHeight = walking ? .050 : .030;
    const collar = register(`boot-cuff-${walking?'high':'low'}`,()=>shell(32,4,(u,v)=>{
      const angle = u*Math.PI*2;
      return [Math.sin(angle)*(.069+v*.004),cuffHeight+v*.027,-.025+Math.cos(angle)*(.061+v*.003)];
    },.009));
    nodes.splice(0,nodes.length,
      meshNode('boot',upper,'primary',[0,.002,.020],[.095,.078,.139]),
      meshNode('sole',sole,'dark',[0,-.074,.027],[.100,.011,.148]),
      meshNode('cuff',collar,'dark'),
      meshNode('welt',pipe('boot-welt',oval(0,-.062,.027,.098,.146),.002),'light'),
      meshNode('toe-seam',pipe('boot-toe-seam',sample(18,t=>{
        const angle = -.94+t*1.88;
        return [Math.sin(angle)*.094,-.004+Math.cos(angle)*.020,.050+Math.cos(angle)*.092];
      }),.0015),'light'),
      meshNode('boot-buckle',buckle('boot-buckle',[.038,.050,.124],.014,.010),'metal'),
      meshNode('boot-strap',box(),'dark',[.014,.050,.119],[.071,.008,.005]),
    );
  }
}

/** Wardrobe colors and tactile fields are portable material data, including exports. */
export function artboardOutfitMaterial(item: string, role: string, material: Data | string): Data | string {
  const revised = ['trail_cap','woodland_vest','rain_cape','field_satchel','walking_boots','swift_shoes'].includes(item);
  if (!revised) return material;
  const leather = ['field_satchel','walking_boots','swift_shoes'].includes(item);
  const colors: Record<string, Record<string,string>> = {
    trail_cap:{primary:'#536448',dark:'#344833',light:'#ceb366'},
    woodland_vest:{primary:'#647450',dark:'#445339',light:'#9a9b6c'},
    rain_cape:{primary:'#617149',dark:'#3e4e32',light:'#99a275'},
    field_satchel:{primary:'#825b3c',dark:'#644731',light:'#bd9764'},
    walking_boots:{primary:'#77513a',dark:'#44352a',light:'#b49c77'},
    swift_shoes:{primary:'#607887',dark:'#3b4d59',light:'#a6b3ad'},
  };
  if (role === 'metal') return {color:'#bd9149',metalness:.55,roughness:.38,flatShading:false};
  if (!['primary','light','dark'].includes(role)) return material;
  return {...(typeof material === 'string'?{color:material}:material),color:colors[item][role],
    roughness:leather ? .82 : .96,flatShading:false,
    ...(leather?{}:{sheen:.28,sheenColor:'#d6d1ab',sheenRoughness:1}),
    surface:{kind:leather?'leather':'cloth',seed:leather?23:19,scale:leather?2:3,strength:leather ? .16 : .2}};
}
