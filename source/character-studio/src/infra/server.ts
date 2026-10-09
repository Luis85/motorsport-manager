import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { resolve } from 'node:path';
import { createHash, randomBytes } from 'node:crypto';
import { httpContract } from './api-contract.js';
import { renderHtml } from './html.js';
import * as store from './store.js';
import { StudioError } from './files.js';
import { discovery, operationSchema } from '../commands/discovery.js';
import { characterSchema } from '../domain/schema.js';
import { applyOperations } from '../application/transactions.js';
import { catalog } from '../domain/catalog.js';
import { validateCharacter } from '../domain/character.js';
import { compilePackage, compileDefinition, compileVisual } from '../application/compiler.js';

async function body(request: IncomingMessage): Promise<any> {
  if (!request.headers['content-type']?.startsWith('application/json')) throw new StudioError('CONTENT_TYPE', 'Send application/json.');
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 2 * 1024 * 1024) throw new StudioError('SIZE_LIMIT', 'Request exceeds 2 MiB.');
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString()); }
  catch { throw new StudioError('INVALID_JSON', 'Request body must be valid JSON.'); }
}
function json(response: ServerResponse, status: number, value: unknown) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
  response.end(JSON.stringify(value));
}
/** Local-only server. Every mutation needs the per-launch token and guarded document identity. */
export async function serve(project: string, options: {port?: number} = {}) {
  const token = randomBytes(24).toString('hex');
  const storageKey = 'project-' + createHash('sha256').update(resolve(project)).digest('hex').slice(0,24);
  const port = options.port ?? 4317;
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new StudioError('INVALID_PORT', 'Port must be an integer from 0 to 65535.');
  let origin = '';
  const server = createServer(async (request, response) => {
    try {
      if (`http://${request.headers.host}` !== origin) throw new StudioError('FORBIDDEN', 'Only the announced loopback host is allowed.');
      if (request.headers.origin && request.headers.origin !== origin) throw new StudioError('FORBIDDEN', 'Cross-origin requests are not allowed.');
      const url = new URL(request.url ?? '/', origin);
      const method = request.method ?? 'GET';
      if (method === 'GET' && url.pathname === '/') {
        response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store',
          'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer',
          'content-security-policy': "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; connect-src 'self'; font-src data:; frame-ancestors 'none'; base-uri 'none'; form-action 'none'" });
        response.end(renderHtml({ server: true, token, storageKey }));
        return;
      }
      if (method === 'GET' && url.pathname === '/api/discover') return json(response,200,{...discovery(),http:httpContract});
      if (method === 'GET' && url.pathname === '/api/schema') {
        const kind = url.searchParams.get('kind') ?? 'character';
        if (!['character','batch'].includes(kind)) throw new StudioError('INVALID_FORMAT','Choose character or batch schema.');
        return json(response,200,{ok:true,kind,schema:kind === 'batch' ? operationSchema : characterSchema});
      }
      if (method === 'GET' && url.pathname === '/api/lock') return json(response,200,{ok:true,...await store.lockStatus(project)});
      if (method === 'GET' && url.pathname === '/api/catalog') return json(response, 200, { ok: true, catalog });
      if (method === 'GET' && url.pathname === '/api/characters') return json(response, 200, { ok: true, characters: await store.list(project) });
      const match = /^\/api\/characters\/([a-z][a-z0-9_-]{0,60})(?:\/(history|undo|redo|export|apply))?$/.exec(url.pathname);
      if (match) {
        const [, id, action] = match;
        if (method === 'GET' && !action) return json(response, 200, await store.read(project, id));
        if (method === 'GET' && action === 'history') return json(response, 200, await store.history(project, id));
        if (method === 'GET' && action === 'export') {
          const { character } = await store.read(project, id);
          const kind = url.searchParams.get('kind') ?? 'recipe';
          const exports: Record<string, () => unknown> = { recipe: () => character, look: () => ({format:'littlewild-look',schemaVersion:1,appearance:character.appearance,outfits:character.outfits}), package: () => compilePackage(character), definition: () => compileDefinition(character), visual: () => compileVisual(character) };
          if (!Object.hasOwn(exports, kind)) throw new StudioError('INVALID_FORMAT', 'Choose recipe, look, package, definition or visual.');
          return json(response, 200, { ok: true, kind, data: exports[kind]() });
        }
        if ((method === 'PUT' && !action) || method === 'POST' && ['undo', 'redo', 'apply'].includes(action)) {
          if (request.headers['x-studio-token'] !== token) throw new StudioError('FORBIDDEN', 'Supply the current x-studio-token from serve.');
          const input = await body(request);
          if (!input || typeof input !== 'object' || Array.isArray(input)) throw new StudioError('INVALID_REQUEST', 'Request must be an object.');
          const allowed = ['expectedRevision','expectedState','dryRun',...(action === 'apply' ? ['operations'] : action ? [] : ['character'])];
          if (Object.keys(input).some(key => !allowed.includes(key))) throw new StudioError('INVALID_REQUEST','Request contains unknown fields.');
          if (!Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 0 || !Object.hasOwn(input,'expectedState') || input.expectedState !== null && typeof input.expectedState !== 'string') throw new StudioError('GUARDS_REQUIRED','Supply integer expectedRevision and observed expectedState (0 and null only for creation).');
          if (input.dryRun !== undefined && typeof input.dryRun !== 'boolean') throw new StudioError('INVALID_REQUEST','dryRun must be a boolean.');
          if (action === 'undo' || action === 'redo') return json(response, 200, await store[action](project, id, input));
          if (action === 'apply') {
            const current = await store.read(project, id);
            if (input.expectedRevision !== current.revision || input.expectedState !== current.stateHash) throw new StudioError('CONFLICT','Character changed. Inspect it again before preparing an edit.',{revision:current.revision,stateHash:current.stateHash});
            const character = applyOperations(current.character,input.operations);
            return json(response,200,await store.write(project,character,input));
          }
          if (input.character?.id !== id) throw new StudioError('INVALID_ID', 'URL and character IDs must match.');
          return json(response, 200, await store.write(project, input.character, input));
        }
      }
      if (method === 'POST' && url.pathname === '/api/validate') {
        if (request.headers['x-studio-token'] !== token) throw new StudioError('FORBIDDEN', 'Supply x-studio-token.');
        const input = await body(request);
        if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(key => !['character','commit'].includes(key)) || input.commit !== undefined && typeof input.commit !== 'boolean') throw new StudioError('INVALID_REQUEST','Use character and optional boolean commit.');
        return json(response, 200, validateCharacter(input.character, { commit: input.commit === true }));
      }
      json(response, 404, { ok: false, error: { code: 'NOT_FOUND', message: 'Unknown route or method.' } });
    } catch (error: any) {
      const code = error.code ?? 'VALIDATION';
      const status = code === 'CONFLICT' ? 409 : code === 'BUSY' ? 423 : code === 'FORBIDDEN' ? 403 : code === 'ENOENT' ? 404 : 400;
      json(response, status, { ok: false, error: { code, message: error.message, details: error.details ?? error.errors } });
    }
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => resolve());
  });
  const address = server.address();
  origin = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : port}`;
  return { url: origin, token, close: () => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())) };
}
