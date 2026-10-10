import type {PreviewConfiguration} from '../application/preview-configuration.js';
import { createCharacter, validateCharacter, type Character } from '../domain/character.js';
import { EditorSession } from '../application/transactions.js';

declare global { interface Window { __STUDIO__?: { server?: boolean; token?: string; storageKey?: string; initial?: Character; preview?: PreviewConfiguration }; characterStudio: unknown } }
type Saved = { character: Character; revision: number; stateHash: string };
type Working = { character: Character; committed: boolean; thumbnail?: string; revision?: number; stateHash?: string; dirty?: boolean };
export class StudioState {
  session: EditorSession;
  records = new Map<string, Working>();
  remote = new Map<string, Saved>();
  savedStatus = 'Not saved yet';
  storageAvailable = true;
  apiAvailable = false;
  committed = false;
  changed = false;
  recoverySource: string | null = null;
  readonly storageKey = `littlewild.character-studio.v1.${window.__STUDIO__?.storageKey || 'offline'}`;
  constructor() {
    this.session = new EditorSession(window.__STUDIO__?.initial || createCharacter(this.id(), 'Pip', 'pip'));
    this.committed = this.character.status === 'ready';
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(this.storageKey);
      const saved = JSON.parse(raw || '[]');
      if (!Array.isArray(saved)) throw new Error('The browser library is not a list.');
      for (const item of saved) {
        if (!validateCharacter(item.character).ok) throw new Error('A browser draft needs recovery.');
        this.records.set(item.character.id, item);
      }
    } catch {
      this.storageAvailable = false;
      this.recoverySource = raw;
      this.savedStatus = 'Browser recovery unavailable · export a copy';
    }
  }
  id(): string { return `companion-${crypto.randomUUID().slice(0, 12)}`; }
  get character(): Character { return this.session.inspect(); }
  async load(): Promise<void> {
    if (!window.__STUDIO__?.server) return;
    try {
      const response = await fetch('/api/characters');
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error?.message || 'Library could not be loaded.');
      this.apiAvailable = true;
      for (const entry of result.characters as Saved[]) {
        const local = this.records.get(entry.character.id);
        // A recovered working draft retains its observed revision, so another
        // process's newer write can never be silently overwritten on reconnect.
        if (local?.dirty) {
          if (local.revision && local.stateHash) this.remote.set(entry.character.id, { character: local.character, revision: local.revision, stateHash: local.stateHash });
        } else {
          this.remote.set(entry.character.id, entry);
          this.records.set(entry.character.id, { character: entry.character, committed: entry.character.status === 'ready', revision: entry.revision, stateHash: entry.stateHash });
        }
      }
    } catch (error) {
      this.savedStatus = `Disk library unavailable: ${(error as Error).message}`;
    }
  }
  open(id: string): void {
    const record = this.records.get(id);
    if (!record) return;
    this.session = new EditorSession(record.character);
    this.committed = record.committed;
    this.changed = record.dirty || false;
    this.savedStatus = this.remote.has(id) ? 'Opened companion · edits stay in a working draft' : 'Recovered from this browser';
  }
  newCharacter(preset: string): void {
    const name = preset[0].toUpperCase() + preset.slice(1);
    this.session = new EditorSession(createCharacter(this.id(), name, preset as any));
    this.committed = false;
    this.changed = true;
    this.recover();
  }
  importCharacter(character: Character): void {
    this.session = new EditorSession({ ...structuredClone(character), id: this.id(), status: 'draft' });
    this.committed = false;
    this.changed = true;
    this.recover();
  }
  apply(operations: any[]): Character {
    const character = this.session.apply(operations);
    this.changed = true;
    this.recover();
    return character;
  }
  recover(): void {
    const previous = this.records.get(this.character.id);
    const remote = this.remote.get(this.character.id);
    this.records.set(this.character.id, { character: this.character, committed: this.committed, thumbnail: previous?.thumbnail, revision: remote?.revision, stateHash: remote?.stateHash, dirty: this.changed || this.session.dirty });
    try {
      if (this.recoverySource !== null) throw new Error('Preserve the original browser recovery data.');
      localStorage.setItem(this.storageKey, JSON.stringify([...this.records.values()]));
      this.storageAvailable = true;
      this.savedStatus = 'Draft saved in this browser';
    } catch {
      this.storageAvailable = false;
      this.savedStatus = 'Session only · export JSON to keep your work';
    }
  }
  thumbnail(data: string): void {
    this.recover();
    this.records.get(this.character.id)!.thumbnail = data;
    this.recover();
  }
  async save(commit = false): Promise<void> {
    const startingSession = this.session;
    const startingSnapshot = JSON.stringify(this.character);
    const character = this.character;
    character.status = commit ? 'ready' : 'draft';
    const validation = validateCharacter(character, { commit });
    if (!validation.ok) throw new Error(validation.errors.map(e => `${e.path}: ${e.message}`).join('\n'));
    this.recover();
    if (!commit && this.committed) {
      this.savedStatus = this.storageAvailable ? 'Working draft saved in this browser · review to apply' : 'Working draft is session only · export to keep it';
      return;
    }
    if (window.__STUDIO__?.server) {
      const previous = this.remote.get(character.id);
      const response = await fetch(`/api/characters/${encodeURIComponent(character.id)}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json', 'x-studio-token': window.__STUDIO__.token || '' },
        body: JSON.stringify({ character, expectedRevision: previous?.revision || 0, expectedState: previous?.stateHash || null }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(response.status === 409
        ? 'This companion changed on disk. Your draft is safe here. Open the disk version to continue; your draft will be kept as a separate recovery copy.'
        : result.error?.message || 'Saving failed. Your working draft is preserved; export a copy or retry.');
      this.remote.set(character.id, result);
      this.apiAvailable = true;
    }
    const unchanged = this.session === startingSession && JSON.stringify(this.character) === startingSnapshot;
    const record = this.records.get(character.id)!;
    const remote = this.remote.get(character.id);
    this.records.set(character.id, { ...record, character: JSON.stringify(record.character) === startingSnapshot ? character : record.character, committed: commit, dirty: JSON.stringify(record.character) !== startingSnapshot, revision: remote?.revision, stateHash: remote?.stateHash });
    if (this.character.id === character.id) this.committed = commit;
    if (unchanged) {
      this.session = new EditorSession(character);
      this.changed = false;
    }
    this.recover();
    this.savedStatus = window.__STUDIO__?.server ? unchanged ? 'Saved to disk' : 'Earlier snapshot saved to disk · current draft preserved' : this.storageAvailable
      ? 'Saved in this browser only' : 'Created for this session only · export to keep it';
  }
  async reloadDisk(): Promise<void> {
    const id = this.character.id;
    const response = await fetch(`/api/characters/${encodeURIComponent(id)}`);
    const result = await response.json();
    if (!response.ok || !result.ok) throw new Error(result.error?.message || 'Could not open the disk version.');
    if (id !== this.character.id) throw new Error('The active companion changed. Try opening the disk version again.');
    const copy = { ...this.character, id: this.id(), status: 'draft' as const };
    this.records.set(copy.id, { character: copy, committed: false, dirty: true });
    this.remote.set(id, result);
    this.session = new EditorSession(result.character);
    this.committed = result.character.status === 'ready';
    this.changed = false;
    this.recover();
    this.savedStatus = 'Opened disk version · previous draft kept as a separate recovery copy';
  }
}
