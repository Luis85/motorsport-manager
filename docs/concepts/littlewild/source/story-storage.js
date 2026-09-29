/* Local persistence adapter. Injectable storage and validation make denial/quota/corruption
 * testable. No automatic fallback: the player reviews recovery before replacing progress. */
(function(root){
    'use strict';
    class StoryStorage {
        constructor(provider, validate, keys) {
            this.provider=provider; this.validate=validate; this.keys=keys;
            this.lastPayload=''; this.blocked=false; this.available=true;
        }
        load() {
            try {
                const storage=this.provider();
                for(const key of [this.keys.primary,...this.keys.legacy]) {
                    const raw=storage.getItem(key);
                    if(raw==null)continue;
                    try { return {value:this.validate(raw),key}; }
                    catch(error) { this.blocked=true;return {error:'corrupt',detail:error.message}; }
                }
                return {value:null};
            } catch(error) {this.available=false;return {error:'unavailable',detail:error.message};}
        }
        allowReplacement(){this.blocked=false;this.lastPayload='';}
        write(payload,force=false){
            if(this.blocked)throw Error('Review recovery or explicitly start/import a story before replacing the unreadable save.');
            const stable=JSON.stringify({...payload,savedAt:null});
            if(stable===this.lastPayload&&!force)return false;
            // Never replace a last-known-good snapshot with state that cannot load.
            this.validate(payload);
            try {this.provider().setItem(this.keys.primary,JSON.stringify(payload));this.available=true;}
            catch(error){this.available=false;throw error;}
            this.lastPayload=stable;return true;
        }
        backup(payload){
            try {this.validate(payload);this.provider().setItem(this.keys.backup,JSON.stringify(payload));return true;}
            catch(_){return false;}
        }
        recovery(){
            const storage=this.provider();
            for(const key of [this.keys.backup,...this.keys.oldBackups]) {
                const raw=storage.getItem(key);if(raw!=null)return this.validate(raw);
            }
            throw Error('There is no recovery copy yet. Import an exported story instead.');
        }
    }
    root.LWStoryStorage=StoryStorage;
    if(typeof module!=='undefined'&&module.exports)module.exports=StoryStorage;
})(typeof globalThis!=='undefined'?globalThis:this);
