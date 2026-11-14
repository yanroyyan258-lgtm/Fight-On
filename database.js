/* IndexedDB wrapper: all personal records remain on this device. */
window.FightDB = (() => {
  const DB_NAME = "fight-on-local";
  const DB_VERSION = 1;
  let dbPromise;
  function open(){
    if(dbPromise) return dbPromise;
    dbPromise = new Promise((resolve,reject)=>{
      const req=indexedDB.open(DB_NAME,DB_VERSION);
      req.onupgradeneeded=()=>{
        const db=req.result;
        if(!db.objectStoreNames.contains("state")) db.createObjectStore("state");
        if(!db.objectStoreNames.contains("events")) db.createObjectStore("events",{keyPath:"id",autoIncrement:true});
        if(!db.objectStoreNames.contains("journals")) db.createObjectStore("journals",{keyPath:"id",autoIncrement:true});
      };
      req.onsuccess=()=>resolve(req.result);
      req.onerror=()=>reject(req.error);
    });
    return dbPromise;
  }
  async function stateGet(key){const db=await open();return new Promise((res,rej)=>{const r=db.transaction("state").objectStore("state").get(key);r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);});}
  async function stateSet(key,value){const db=await open();return new Promise((res,rej)=>{const r=db.transaction("state","readwrite").objectStore("state").put(value,key);r.onsuccess=()=>res();r.onerror=()=>rej(r.error);});}
  async function all(store){const db=await open();return new Promise((res,rej)=>{const r=db.transaction(store).objectStore(store).getAll();r.onsuccess=()=>res(r.result||[]);r.onerror=()=>rej(r.error);});}
  async function add(store,value){const db=await open();return new Promise((res,rej)=>{const r=db.transaction(store,"readwrite").objectStore(store).add(value);r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);});}
  async function clear(){const db=await open();return new Promise((res,rej)=>{const tx=db.transaction(["state","events","journals"],"readwrite");tx.objectStore("state").clear();tx.objectStore("events").clear();tx.objectStore("journals").clear();tx.oncomplete=()=>res();tx.onerror=()=>rej(tx.error);});}
  async function dump(){return {state:{startAt:await stateGet("startAt"),goalDays:await stateGet("goalDays"),theme:await stateGet("theme"),pin:await stateGet("pin"),notify:await stateGet("notify"),promise:await stateGet("promise")},events:await all("events"),journals:await all("journals")};}
  async function restore(data){await clear();for(const [k,v] of Object.entries(data.state||{})) if(v!==undefined) await stateSet(k,v);for(const e of data.events||[]) await add("events",e);for(const j of data.journals||[]) await add("journals",j);}
  return {open,stateGet,stateSet,all,add,clear,dump,restore};
})();