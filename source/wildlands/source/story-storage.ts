/* Local persistence adapter. Injectable storage and validation make denial/quota/corruption
 * testable. No automatic fallback: the player reviews recovery before replacing progress. */
(function(inputRoot: unknown){
    'use strict';
    interface StoragePort { getItem(key:string):string|null; setItem(key:string,value:string):void; }
    interface Keys { primary:string; backup:string; legacy:readonly string[]; oldBackups:readonly string[]; }
    type LoadResult<T> = {value:T|null;key?:string} | {error:'corrupt'|'unavailable';detail:string};
    const detail=(error:unknown):string=>error instanceof Error?error.message:String(error);
    class StoryStorage<T> {
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
