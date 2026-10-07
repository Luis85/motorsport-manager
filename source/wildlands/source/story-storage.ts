/* Local persistence adapter. Injectable storage and validation make denial/quota/corruption
 * testable. No automatic fallback: the player reviews recovery before replacing progress. */
(function(inputRoot: unknown){
    'use strict';
    interface StoragePort { getItem(key:string):string|null; setItem(key:string,value:string):void; }
    interface Keys { primary:string; backup:string; legacy:readonly string[]; oldBackups:readonly string[]; }
    type LoadResult<T> = {value:T|null;key?:string} | {error:'corrupt'|'unavailable';detail:string};
    interface NamespacedKeys extends Keys { namespace:string; }
    const detail=(error:unknown):string=>error instanceof Error?error.message:String(error);
    /* Per-game storage namespaces. Pages opened from file:// share one origin, so each
     * game artifact scopes its keys. The littlewild namespace (also used when no game
     * profile is configured) keeps the exact legacy save, backup and migration keys. */
    const LEGACY_NAMESPACE='littlewild';
    const NAMESPACE_PATTERN=/^[a-z][a-z0-9-]*(?:\.[a-z0-9][a-z0-9-]*)*$/;
    function namespaceOf(profile:unknown):string {
        const storage=profile&&typeof profile==='object'?(profile as {storage?:unknown}).storage:undefined;
        const value=storage&&typeof storage==='object'?(storage as {namespace?:unknown}).namespace:undefined;
        if(value===undefined)return LEGACY_NAMESPACE;
        if(typeof value!=='string'||value.length>64||!NAMESPACE_PATTERN.test(value))
            throw Error('Invalid game storage namespace. Use 1-64 lowercase letters, digits, hyphens and dots, for example wildlands.emberworks.');
        return value;
    }
    function keysFor(namespace:string):NamespacedKeys {
        if(namespace===LEGACY_NAMESPACE)return {namespace,primary:'littlewild.save.v5',backup:'littlewild.backup.v5',
            legacy:['littlewild.save.v4','littlewild.save.v3','littlewild.save.v2','littlewild.save.v1'],oldBackups:['littlewild.backup.v3']};
        if(!NAMESPACE_PATTERN.test(namespace))throw Error('Invalid game storage namespace: '+namespace);
        // A new game namespace never migrates or recovers another game's story.
        return {namespace,primary:namespace+'.save.v5',backup:namespace+'.backup.v5',legacy:[],oldBackups:[]};
    }
    /** Scope device preferences ('littlewild.<name>' or bare keys) to a game namespace. */
    function scopedKey(namespace:string,key:string):string {
        if(namespace===LEGACY_NAMESPACE)return key;
        return namespace+'.'+(key.startsWith(LEGACY_NAMESPACE+'.')?key.slice(LEGACY_NAMESPACE.length+1):key);
    }
    function scoped(provider:()=>StoragePort,namespace:string):()=>StoragePort {
        if(namespace===LEGACY_NAMESPACE)return provider;
        return ()=>{const storage=provider();return {getItem:key=>storage.getItem(scopedKey(namespace,key)),setItem:(key,value)=>storage.setItem(scopedKey(namespace,key),value)};};
    }
    class StoryStorage<T> {
        static readonly LEGACY_NAMESPACE=LEGACY_NAMESPACE;
        static readonly namespace=namespaceOf;
        static readonly keys=keysFor;
        static readonly scopedKey=scopedKey;
        static readonly scoped=scoped;
        lastPayload=''; blocked=false; available=true;
        constructor(readonly provider:()=>StoragePort,readonly validate:(input:unknown)=>T,readonly keys:Keys) {}
        load():LoadResult<T> {
            try {
                const storage=this.provider();
                for(const key of [this.keys.primary,...this.keys.legacy]) {
                    const raw=storage.getItem(key);
                    if(raw==null)continue;
                    try { const value=this.validate(raw);this.available=true;return {value,key}; }
                    catch(error) { this.blocked=true;return {error:'corrupt',detail:detail(error)}; }
                }
                this.available=true;return {value:null};
            } catch(error) {this.available=false;return {error:'unavailable',detail:detail(error)};}
        }
        allowReplacement():void {this.blocked=false;this.lastPayload='';}
        write(payload:Record<string,unknown>,force=false):boolean {
            if(this.blocked)throw Error('Review recovery or explicitly start/import a story before replacing the unreadable save.');
            // Validate every request, including a deduplicated snapshot's timestamp/metadata.
            this.validate(payload);
            const stable=JSON.stringify({...payload,savedAt:null});
            if(stable===this.lastPayload&&!force)return false;
            const encoded=JSON.stringify(payload);
            try {this.provider().setItem(this.keys.primary,encoded);this.available=true;}
            catch(error){this.available=false;throw error;}
            this.lastPayload=stable;return true;
        }
        backup(payload:Record<string,unknown>):boolean {
            try {this.validate(payload);this.provider().setItem(this.keys.backup,JSON.stringify(payload));return true;}
            catch(_){return false;}
        }
        recovery():T {
            let raw:string|null=null;
            try {
                const storage=this.provider();
                for(const key of [this.keys.backup,...this.keys.oldBackups]) {
                    raw=storage.getItem(key);if(raw!==null)break;
                }
                this.available=true;
            } catch(error){this.available=false;throw error;}
            if(raw!==null)return this.validate(raw);
            throw Error('There is no recovery copy yet. Import an exported story instead.');
        }
    }
    (inputRoot as {LWStoryStorage?:typeof StoryStorage}).LWStoryStorage=StoryStorage;
    if(typeof module!=='undefined'&&module.exports)module.exports=StoryStorage;
})(globalThis);
