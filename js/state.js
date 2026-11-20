const PREFIX='tensorium:v1:';
const memory=new Map();
let disk=true;
try {localStorage.setItem(PREFIX+'_probe','1'); localStorage.removeItem(PREFIX+'_probe');} catch {disk=false;}
export const persistent=()=>disk;

export function read(group,id,fallback=null){
  const key=PREFIX+group+'/'+id;
  if(memory.has(key))return memory.get(key).value;
  try {const raw=disk&&localStorage.getItem(key);return raw?JSON.parse(raw).value:fallback;}catch{return fallback;}
}
export function write(group,id,value,time=Date.now()){
  const key=PREFIX+group+'/'+id;
  const entry={value,time};
  if(disk){
    try {localStorage.setItem(key,JSON.stringify(entry));memory.delete(key);return true;}
    catch {/* Continue in memory and let the UI offer export. */}
  }
  memory.set(key,entry);return false;
}
export function mark(id){write('done',id,true);}
export const done=id=>read('done',id,false)===true;
export function download(name,data,type='text/plain;charset=utf-8'){
  const url=URL.createObjectURL(new Blob([data],{type}));
  const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1500);
}
export function backup(){
  const entries={};
  if(disk)for(let i=0;i<localStorage.length;i++){
    const key=localStorage.key(i);
    if(key?.startsWith(PREFIX) && key.includes('/'))try{entries[key.slice(PREFIX.length)]=JSON.parse(localStorage.getItem(key));}catch{/* skip corrupt records */}
  }
  for(const [key,entry] of memory)entries[key.slice(PREFIX.length)]=entry;
  return {application:'Tensorium',schema:1,entries};
}
export function restore(input){
  if(input?.application!=='Tensorium'||input.schema!==1||!input.entries||typeof input.entries!=='object'||Array.isArray(input.entries))throw Error('Выберите JSON-экспорт Tensorium версии 1.');
  const entries=Object.entries(input.entries);if(entries.length>4000)throw Error('Слишком много записей.');
  const candidates=entries.map(([key,item])=>{
    const match=/^(done|draft|project|pref|attempt|visited)\/([a-z0-9_-]{1,90})$/.exec(key);
    if(!match||!item||typeof item!=='object'||!Object.hasOwn(item,'value'))throw Error('Некорректная структура сохранения.');
    const [group,id]=match.slice(1),val=item.value;
    if(group==='done' && val!==true)throw Error('Некорректная отметка выполнения.');
    if(group==='draft' && (typeof val!=='string'||val.length>131072))throw Error('Некорректный черновик.');
    if(group==='attempt'){
      if(!val||typeof val!=='object'||Array.isArray(val))throw Error('Некорректный результат.');
      if(val.history&&(!Array.isArray(val.history)||val.history.length>10||val.history.some(a=>!a||typeof a.code!=='string'||typeof a.passed!=='boolean'||!Number.isFinite(a.at))))throw Error('Некорректная история проверок.');
    }
    if(group==='project'&&(!val||typeof val!=='object'||Array.isArray(val)))throw Error('Некорректный отчёт.');
    if(group==='pref'&&typeof val!=='string')throw Error('Некорректная настройка.');
    if(JSON.stringify(val).length>400000)throw Error('Слишком большая запись.');
    return [group,id,val,Number(item.time)||0];
  });
  for(const [group,id,val,t] of candidates){
    const key=PREFIX+group+'/'+id;
    let current=memory.get(key);
    if(!current&&disk)try{current=JSON.parse(localStorage.getItem(key));}catch{}
    if(!current||current.time<=t)write(group,id,val,t);
  }
  return candidates.length;
}
export function escapeText(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
