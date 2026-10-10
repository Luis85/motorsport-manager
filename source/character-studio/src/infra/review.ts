import {createHash} from 'node:crypto';
import {dirname, resolve} from 'node:path';
import {mkdir, rm, writeFile} from 'node:fs/promises';
import {assertCharacter, type Character} from '../domain/character.js';
import {compileVisual} from '../application/compiler.js';
import {stateHash} from './store.js';
import {StudioError} from './files.js';
import {captureOptions, captureSession, type CaptureOptions} from './capture.js';

type View = Required<CaptureOptions> & {id: string};
export interface ReviewPlan { format: 'character-studio-review-plan'; schemaVersion: 1; views: View[] }
const choices = {mode:['studio','world','portrait'],light:['studio','daylight','night'],pose:['idle','walk','work','celebrate'],camera:['front','side','back']};
export const reviewPlanSchema = {
  $schema:'https://json-schema.org/draft/2020-12/schema', title:'Character Studio reproducible review plan',
  type:'object',additionalProperties:false,required:['format','schemaVersion','views'],properties:{
    format:{const:'character-studio-review-plan'},schemaVersion:{const:1},views:{type:'array',minItems:1,maxItems:12,items:{
      type:'object',additionalProperties:false,required:['id'],properties:{
        id:{type:'string',pattern:'^[a-z][a-z0-9-]{0,39}$'},
        ...Object.fromEntries(Object.entries(choices).map(([key,values])=>[key,{enum:values,default:values[0]}])),
        width:{type:'integer',minimum:256,maximum:2048,default:768},height:{type:'integer',minimum:256,maximum:2048,default:768},
      },
    }},
  },
};
function object(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
}
export function reviewPlan(input?: unknown): ReviewPlan {
  const defaults = [
    {id:'front',camera:'front'}, {id:'side',camera:'side'}, {id:'back',camera:'back'},
    {id:'portrait',mode:'portrait'}, {id:'world',mode:'world',light:'daylight'}, {id:'night',mode:'world',light:'night'},
  ];
  const value = input === undefined ? {format:'character-studio-review-plan',schemaVersion:1,views:defaults} : input;
  if (!object(value) || value.format !== 'character-studio-review-plan' || value.schemaVersion !== 1 ||
    Object.keys(value).some(key=>!['format','schemaVersion','views'].includes(key)) || !Array.isArray(value.views) ||
    !value.views.length || value.views.length > 12) throw new StudioError('INVALID_REVIEW_PLAN','Use schema --kind review for a plan with 1–12 named views.');
  const ids = new Set<string>();
  let pixels = 0;
  const views = value.views.map((view: unknown, index: number) => {
    if (!object(view) || typeof view.id !== 'string' || !/^[a-z][a-z0-9-]{0,39}$/.test(view.id) || ids.has(view.id))
      throw new StudioError('INVALID_REVIEW_PLAN','Every review view needs a unique safe id.',{viewIndex:index});
    ids.add(view.id);
    const {id,...options} = view;
    let config: Required<CaptureOptions>;
    try { config = captureOptions({width:768,height:768,...options} as CaptureOptions); }
    catch (error) { throw new StudioError('INVALID_REVIEW_PLAN',(error as Error).message,{viewIndex:index}); }
    if (config.width > 2048 || config.height > 2048) throw new StudioError('INVALID_REVIEW_PLAN','Review views are bounded to 2048 pixels per dimension.',{viewIndex:index});
    pixels += config.width * config.height;
    return {id,...config};
  });
  if (pixels > 16_777_216) throw new StudioError('SIZE_LIMIT','Review views exceed 16,777,216 total pixels.');
  return {format:'character-studio-review-plan',schemaVersion:1,views};
}
const hash = (bytes: string | Buffer) => createHash('sha256').update(bytes).digest('hex');

/** A manifest is published last. A failed review removes only the directory it created. */
export async function reviewCharacter(input: Character, destination: string, inputPlan?: unknown) {
  const character = assertCharacter(input), plan = reviewPlan(inputPlan), output = resolve(destination);
  await mkdir(dirname(output),{recursive:true});
  try { await mkdir(output); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') throw new StudioError('OUTPUT_EXISTS',`Review output already exists: ${output}. Choose a new directory.`);
    throw error;
  }
  try {
    await mkdir(resolve(output,'frames'));
    const session = await captureSession(character);
    try {
      const frames: {id:string;file:string;sha256:string;bytes:number;preview:Required<CaptureOptions>;data:string}[] = [];
      for (const {id,...preview} of plan.views) {
        const bytes = await session.capture(preview), file = `frames/${id}.png`;
        await writeFile(resolve(output,file),bytes,{flag:'wx',mode:0o600});
        frames.push({id,file,sha256:hash(bytes),bytes:bytes.length,preview,data:`data:image/png;base64,${bytes.toString('base64')}`});
      }
      const sheetData = await session.page.evaluate(async images => {
        const columns = Math.min(3,images.length), tile = 384, caption = 48;
        const canvas = document.createElement('canvas');
        canvas.width = columns * tile; canvas.height = Math.ceil(images.length / columns) * (tile + caption);
        const ctx = canvas.getContext('2d')!;
        ctx.fillStyle = '#f7f4eb'; ctx.fillRect(0,0,canvas.width,canvas.height);
        for (const [index,frame] of images.entries()) {
          const picture = new Image(); picture.src = frame.data; await picture.decode();
          const x = index % columns * tile, y = Math.floor(index / columns) * (tile + caption);
          const scale = Math.min(tile/picture.width,tile/picture.height);
          const w = picture.width * scale, h = picture.height * scale;
          ctx.drawImage(picture,x+(tile-w)/2,y+(tile-h)/2,w,h);
          ctx.fillStyle = '#202d23'; ctx.font = '16px sans-serif';
          ctx.fillText(frame.id,x+12,y+tile+20);
          ctx.font = '12px sans-serif'; ctx.fillText(`${frame.preview.mode} · ${frame.preview.light} · ${frame.preview.camera}`,x+12,y+tile+38);
        }
        return canvas.toDataURL('image/png');
      },frames);
      const sheet = Buffer.from(sheetData.split(',')[1],'base64');
      await writeFile(resolve(output,'contact-sheet.png'),sheet,{flag:'wx',mode:0o600});
      await writeFile(resolve(output,'replay-plan.json'),JSON.stringify(plan,null,2)+'\n',{flag:'wx',mode:0o600});
      const visual = compileVisual(character);
      const manifest = {
        format:'character-studio-review',schemaVersion:1,characterId:character.id,recipeHash:stateHash(character),
        visualHash:hash(JSON.stringify(visual)),compilerRevision:visual.metadata?.characterStudio?.compilerRevision ?? 1,
        renderer:'wildlands-three',paused:true,time:0,plan:'replay-plan.json',
        contactSheet:{file:'contact-sheet.png',sha256:hash(sheet)},
        frames:frames.map(({data,...frame})=>frame),
        limits:['Presentation stage is not gameplay state.','Compare using the same replay plan, tool build and browser for reproducible visual review.'],
      };
      await writeFile(resolve(output,'manifest.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx',mode:0o600});
      return {output,manifest:resolve(output,'manifest.json'),contactSheet:resolve(output,'contact-sheet.png'),review:manifest};
    } finally { await session.close(); }
  } catch (error) { await rm(output,{recursive:true,force:true}); throw error; }
}
