import { characterSchema } from '../domain/schema.js';
import { operationSchema } from '../commands/discovery.js';
const guardProperties = {
  expectedRevision: {type:'integer',minimum:0,description:'Revision observed by GET; 0 for creation.'},
  expectedState: {type:['string','null'],description:'Observed SHA-256 stateHash; null only for creation.'},
  dryRun: {type:'boolean',default:false,description:'Return a proposal without persistence.'},
};
const request = (properties: Record<string,unknown>, required: string[]) => ({type:'object',additionalProperties:false,properties,required});
const guards = request(guardProperties,['expectedRevision','expectedState']);
const envelope = {ok:true,id:'stable character ID',revision:'monotonically increasing integer',stateHash:'SHA-256 of canonical character JSON',character:'character schema'};
export const httpContract = {
  protocolVersion:1,
  baseUrl:'The loopback URL returned by serve. No external hosts or cross-origin access.',
  authentication:{header:'x-studio-token',source:'token returned by serve',requiredFor:['PUT','POST']},
  contentType:'application/json',
  maxBodyBytes:2*1024*1024,
  guards:{create:{expectedRevision:0,expectedState:null},update:'Copy revision and stateHash from GET into expectedRevision and expectedState. On conflict inspect again; do not retry blindly.'},
  response:envelope,
  dryRunResponse:{...envelope,dryRun:true,revision:'current revision',stateHash:'current hash',character:'proposed character',proposedRevision:'next revision',proposedStateHash:'proposed hash'},
  error:{ok:false,error:{code:'stable error code',message:'human-readable recovery hint',details:'optional field diagnostics or current revision/stateHash'}},
  statusCodes:{200:'success',400:'validation, malformed request or unsupported format',403:'invalid token, origin or host',404:'unknown record/route',409:'stale revision/hash',423:'writer lock held'},
  endpoints:[
    {method:'GET',path:'/api/discover',response:'This command and HTTP contract.'},
    {method:'GET',path:'/api/catalog',response:{ok:true,catalog:'presets, skills, outfits, personalities, shapes'}},
    {method:'GET',path:'/api/schema',query:{kind:{enum:['character','batch'],default:'character'}},response:{ok:true,kind:'requested kind',schema:'JSON Schema draft 2020-12'}},
    {method:'GET',path:'/api/lock',response:{ok:true,locked:'boolean',state:'active | stale | unknown | unlocked',owner:'optional process/host/time',path:'lock directory'}},
    {method:'GET',path:'/api/characters',response:{ok:true,characters:[envelope]}},
    {method:'GET',path:'/api/characters/:id',response:envelope},
    {method:'GET',path:'/api/characters/:id/history',response:{...envelope,undo:'entry count',redo:'entry count'}},
    {method:'GET',path:'/api/characters/:id/export',query:{kind:{enum:['recipe','look','package','definition','visual'],default:'recipe'}},response:{ok:true,kind:'requested kind',data:'exported document'}},
    {method:'PUT',path:'/api/characters/:id',request:request({...guardProperties,character:characterSchema},['expectedRevision','expectedState','character']),response:envelope},
    {method:'POST',path:'/api/characters/:id/apply',request:request({...guardProperties,operations:operationSchema.properties.operations},['expectedRevision','expectedState','operations']),response:envelope},
    {method:'POST',path:'/api/characters/:id/undo',request:guards,response:envelope},
    {method:'POST',path:'/api/characters/:id/redo',request:guards,response:envelope},
    {method:'POST',path:'/api/validate',request:request({character:characterSchema,commit:{type:'boolean',default:false}},['character']),response:{ok:'boolean',errors:'field path/message array',warnings:'string array'}},
  ],
};
