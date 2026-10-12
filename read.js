// READ. Supabase stores the library; this browser only displays it.
(function(){
'use strict';
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const WORDS={1:'Awful',2:'Poor',3:'Weak',4:'Meh',5:'Okay',6:'Decent',7:'Good',8:'Great',9:'Superb',10:'Perfect'};
const STATUS={finished:'Finished',reading:'Reading',want:'Want to read'};
const PAGE=1000;
const isoDay=d=>{ const x=new Date(d); return new Date(x.getTime()-x.getTimezoneOffset()*60000).toISOString().slice(0,10); };
const today=()=>isoDay(new Date());
const parseDay=s=>{ const [y,m,d]=s.split('-').map(Number); return new Date(y,m-1,d); };
const medDate=s=>parseDay(s).toLocaleDateString([], {month:'short',day:'numeric',year:'numeric'});
const r1=n=>{ const v=Math.round(n*10)/10; return Number.isInteger(v)?String(v):v.toFixed(1); };
const initials=t=>t.trim().split(/\s+/).slice(0,2).map(w=>w[0]||'').join('').toUpperCase();

let client=null,user=null,busy=false,authSub=null,connecting=null,storageCleanup=null;
let books=[],filter='all',query='',rating=0,loadId=0;

function message(id,text,kind=''){ $(id).textContent=text; $(id).className='message'+(kind?' '+kind:''); }

// ---- connection: the two public Supabase settings come from /api/config ----
function projectConfig(v){ const url=typeof v?.url==='string'?v.url.trim().replace(/\/$/,''):'', key=typeof v?.key==='string'?v.key.trim():''; if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url)||!/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)) throw new Error('This page needs its Supabase connection set up in Vercel.'); return {url,key}; }
async function connect(){
  if(client)return client; if(connecting)return connecting;
  connecting=(async()=>{ let r; try{ r=await fetch('/api/config',{cache:'no-store'}); }catch{ throw new Error('Could not connect. Check your internet connection and try again.'); }
    if(!r.ok) throw new Error('This page needs its Supabase connection set up in Vercel.'); return makeClient(projectConfig(await r.json())); })();
  try{ return await connecting; } finally{ connecting=null; }
}
function makeClient(config){
  if(!window.supabase) throw new Error('The connection library could not load. Reload the page.');
  const storageKey='read.auth.'+new URL(config.url).hostname, storage=window.localStorage;
  authSub?.unsubscribe(); client?.auth.stopAutoRefresh(); storageCleanup?.();
  client=supabase.createClient(config.url,config.key,{auth:{storage,storageKey,persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
  const mine=client;
  authSub=client.auth.onAuthStateChange((_e,session)=>{ setTimeout(()=>{ if(client!==mine)return; setUser(session&&storage.getItem(storageKey)?session.user:null); },0); }).data.subscription;
  const changed=e=>{ if(client===mine&&e.storageArea===storage&&(e.key===storageKey||e.key===null)&&e.newValue===null)setUser(null); };
  window.addEventListener('storage',changed); storageCleanup=()=>window.removeEventListener('storage',changed);
  return client;
}
function setUser(next){
  if(next?.id===user?.id)return;
  user=next; loadId++;
  $('connect-open').hidden=!!user; $('sign-out').hidden=!user; $('add-open').hidden=!user; $('book-fields').disabled=!user;
  $('connection-status').textContent=user?'Connected':'Your record'; $('connection-status').classList.toggle('connected',!!user);
  if(!user){ books=[]; render(); $('library-list').innerHTML='<p class="row-empty">Sign in to see your books.</p>'; $('book-dialog').close(); }
  else load();
  window.coachUser?.(user?.id);
}
$('connect-open').onclick=()=>{ $('connection-dialog').showModal(); $('email').focus(); };
$('connect-close').onclick=()=>{ if(!busy)$('connection-dialog').close(); };
$('connect-form').addEventListener('submit',async e=>{
  e.preventDefault(); if(busy)return; busy=true; $('connect-submit').disabled=true; message('connect-message','Signing in…');
  try{ const db=await connect(); const {data,error}=await db.auth.signInWithPassword({email:$('email').value.trim(),password:$('password').value}); if(error)throw error; $('password').value=''; setUser(data.user); $('connection-dialog').close(); message('connect-message',''); }
  catch(err){ message('connect-message',err.message||'Could not sign in.','error'); }
  finally{ busy=false; $('connect-submit').disabled=false; }
});
$('sign-out').onclick=async()=>{ if(!client||busy)return; busy=true; try{ const {error}=await client.auth.signOut({scope:'local'}); if(error)throw error; setUser(null); }catch(err){ message('history-message',err.message,'error'); } finally{ busy=false; } };

// ---- reading all of it, and never some of it ----
async function readAll(make){ const all=[]; let from=0; for(;;){ const {data,error,count}=await make().range(from,from+PAGE-1); if(error)throw error; all.push(...data); from+=data.length; if(from>=count||!data.length)return all; } }
async function load(){
  const id=++loadId; message('history-message','');
  try{
    const db=await connect();
    const rows=await readAll(()=>db.from('books').select('*',{count:'exact'}).order('updated_at',{ascending:false}));
    if(id!==loadId)return;
    books=rows.map(b=>({...b,rating:b.rating==null?null:Number(b.rating),takeaways:(b.takeaways||[]).filter(Boolean)}));
    render();
  }catch(err){ if(id!==loadId)return; const missing=/relation .* does not exist|schema cache/i.test(err.message||''); message('history-message',missing?'Run setup.sql in your Supabase SQL editor once, then reload.':(err.message||'Could not load your books.'),'error'); }
}

// ---- derived ----
const finished=()=>books.filter(b=>b.status==='finished');
function render(){
  const y=today().slice(0,4), fin=finished(), thisYear=fin.filter(b=>(b.finished_on||'').startsWith(y));
  const reading=books.filter(b=>b.status==='reading'), want=books.filter(b=>b.status==='want');
  const rated=fin.filter(b=>b.rating); const avg=rated.length?rated.reduce((a,b)=>a+b.rating,0)/rated.length:0;
  $('year-count').textContent=books.length?String(thisYear.length):'—'; $('year-unit').textContent=thisYear.length===1?'book':'books';
  $('year-note').textContent=books.length?`${fin.length} finished all time · ${books.length} in your library`:'Your first book starts here.';
  $('side-year').textContent=books.length?String(thisYear.length):'—'; $('side-reading').textContent=books.length?String(reading.length):'—';
  $('tile-reading').textContent=books.length?String(reading.length):'—'; $('tile-reading-note').textContent=reading[0]?reading.map(b=>b.title).slice(0,2).join(', '):'nothing open';
  $('tile-finished').textContent=books.length?String(fin.length):'—';
  $('tile-avg').textContent=rated.length?r1(avg):'—';
  $('tile-want').textContent=books.length?String(want.length):'—';
  drawBars(); drawDist(); renderLibrary();
}

// ---- bars: finished per month, last twelve months ----
function drawBars(){
  const now=new Date(); const months=[]; for(let i=11;i>=0;i--){ const d=new Date(now.getFullYear(),now.getMonth()-i,1); months.push({key:d.toISOString().slice(0,7),label:d.toLocaleDateString([], {month:'short'}),count:0}); }
  for(const b of finished()) if(b.finished_on){ const m=months.find(x=>x.key===b.finished_on.slice(0,7)); if(m) m.count++; }
  const max=Math.max(...months.map(m=>m.count)); const has=max>0; $('bars-empty').hidden=has; $('bars').hidden=!has;
  $('bars-sub').textContent=`Last twelve months · ${months.reduce((a,m)=>a+m.count,0)} finished`; if(!has){ $('bars').innerHTML=''; return; }
  $('bars').innerHTML=months.map(m=>`<div><b>${m.count||''}</b><i class="${m.count?'':'zero'}" style="height:${m.count?Math.max(6,Math.round(m.count/max*120)):3}px" title="${m.count} finished in ${m.label}"></i><span>${m.label}</span></div>`).join('');
}
// ---- spread: how often each rating comes up ----
function drawDist(){
  const rated=finished().filter(b=>b.rating); const counts=Array.from({length:10},(_,i)=>rated.filter(b=>b.rating===i+1).length); const max=Math.max(...counts); const has=max>0;
  $('dist-empty').hidden=has; $('dist').hidden=!has; if(!has){ $('dist').innerHTML=''; return; }
  $('dist').innerHTML=counts.map((c,i)=>`<div><b>${c||''}</b><i class="${c?'':'zero'}" style="height:${c?Math.max(6,Math.round(c/max*110)):3}px" title="${c} book${c===1?'':'s'} rated ${i+1}"></i><span>${i+1}</span></div>`).join('');
}

// ---- library ----
function renderLibrary(){
  const q=query.trim().toLowerCase();
  let list=books.filter(b=>filter==='all'||b.status===filter);
  if(q) list=list.filter(b=>(b.title+' '+b.author+' '+b.takeaways.join(' ')).toLowerCase().includes(q));
  list.sort((a,b)=>{ const order={reading:0,finished:1,want:2}; if(order[a.status]!==order[b.status]) return order[a.status]-order[b.status]; return (b.finished_on||b.updated_at||'')<(a.finished_on||a.updated_at||'')?-1:1; });
  $('lib-count').textContent=books.length?(q||filter!=='all'?`${list.length} of ${books.length}`:`${books.length} book${books.length===1?'':'s'}`):'';
  if(!books.length){ $('library-list').innerHTML='<p class="row-empty">No books yet. Add one you finished recently, with the three things worth keeping from it.</p>'; return; }
  if(!list.length){ $('library-list').innerHTML='<p class="row-empty">Nothing matches.</p>'; return; }
  $('library-list').innerHTML=list.map(b=>{ const stars=b.rating?'★'.repeat(b.rating)+'<i>'+'★'.repeat(10-b.rating)+'</i>':'';
    return `<article class="book"><div class="cover" aria-hidden="true">${esc(initials(b.title))}</div><div class="book-main"><h3 class="book-title">${esc(b.title)}</h3>${b.author?`<p class="book-author">${esc(b.author)}</p>`:''}<div class="book-meta"><span class="badge ${b.status}">${STATUS[b.status]}</span>${stars?`<span class="stars-small" aria-label="${b.rating} out of 10">${stars}</span><span>${b.rating}/10 · ${WORDS[b.rating]}</span>`:''}${b.finished_on?`<span>${esc(medDate(b.finished_on))}</span>`:''}</div>${b.takeaways.length?`<ol class="takeaways">${b.takeaways.map(t=>`<li>${esc(t)}</li>`).join('')}</ol>`:''}</div><div class="ops"><button class="text-button" data-edit="${b.id}" type="button">Edit</button><button class="text-button" data-del="${b.id}" type="button">Delete</button></div></article>`; }).join('');
}
$('search').addEventListener('input',()=>{ query=$('search').value; renderLibrary(); });
document.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{ filter=b.dataset.filter; document.querySelectorAll('[data-filter]').forEach(x=>x.setAttribute('aria-pressed',String(x===b))); renderLibrary(); });

// ---- add / edit ----
$('b-stars').innerHTML=Array.from({length:10},(_,i)=>`<button type="button" class="star" data-star="${i+1}" role="radio" aria-checked="false" aria-label="${i+1} out of 10">★</button>`).join('');
function paintStars(n,hover){ const lit=hover!=null?hover:n; $('b-stars').querySelectorAll('.star').forEach(b=>{ const v=+b.dataset.star; b.classList.toggle('on',v<=lit); b.setAttribute('aria-checked',String(v===n)); }); $('b-rating-word').innerHTML=n?`<b>${n}/10</b> · ${WORDS[n]}`:'Tap a star.'; }
$('b-stars').addEventListener('click',e=>{ const b=e.target.closest('.star'); if(!b)return; rating=+b.dataset.star===rating?0:+b.dataset.star; paintStars(rating); });
$('b-stars').addEventListener('pointerover',e=>{ const b=e.target.closest('.star'); if(b) paintStars(rating,+b.dataset.star); });
$('b-stars').addEventListener('pointerleave',()=>paintStars(rating));
function syncStatus(){ const s=$('b-status').value; $('b-date-field').hidden=s!=='finished'; $('b-rating-field').hidden=s==='want'; }
$('b-status').onchange=syncStatus;
function openBook(b){
  if(!user){ $('connection-dialog').showModal(); return; }
  $('b-id').value=b?.id||''; $('book-title').textContent=b?'Edit book.':'Add book.'; $('b-save').textContent=b?'Save changes ↗':'Save book ↗';
  $('b-title').value=b?.title||''; $('b-author').value=b?.author||''; $('b-status').value=b?.status||'finished'; $('b-date').value=b?.finished_on||(b?'':today());
  rating=b?.rating||0; paintStars(rating); const t=b?.takeaways||[]; $('b-t1').value=t[0]||''; $('b-t2').value=t[1]||''; $('b-t3').value=t[2]||'';
  syncStatus(); message('book-message',''); $('book-dialog').showModal(); $('b-title').focus();
}
$('add-open').onclick=()=>openBook(); $('book-close').onclick=()=>{ if(!busy)$('book-dialog').close(); };
for(const id of ['book-dialog','connection-dialog']) $(id).addEventListener('cancel',e=>{ if(busy)e.preventDefault(); });
$('book-form').addEventListener('submit',async e=>{
  e.preventDefault(); if(busy||!user)return; busy=true; $('b-save').disabled=true;
  try{
    const status=$('b-status').value; const row={title:$('b-title').value.trim(),author:$('b-author').value.trim(),status,rating:status==='want'?null:(rating||null),finished_on:status==='finished'?($('b-date').value||today()):null,takeaways:[$('b-t1').value,$('b-t2').value,$('b-t3').value].map(s=>s.trim()).filter(Boolean),updated_at:new Date().toISOString()};
    if(!row.title) throw new Error('Give it a title.'); if(status==='finished'&&!row.rating) throw new Error('Rate it, even roughly. One star is fine.');
    const db=await connect(); const id=$('b-id').value; const q=id?db.from('books').update(row).eq('id',id):db.from('books').insert(row); const {error}=await q; if(error)throw error;
    $('book-dialog').close(); await load();
  }catch(err){ message('book-message',err.message||'Could not save.','error'); }
  finally{ busy=false; $('b-save').disabled=false; }
});
document.addEventListener('click',async e=>{
  const b=e.target.closest('button[data-edit],button[data-del]'); if(!b||busy)return;
  if(b.dataset.edit) return openBook(books.find(x=>x.id===b.dataset.edit));
  const book=books.find(x=>x.id===b.dataset.del); if(!book||!confirm(`Delete "${book.title}" and its notes?`))return;
  busy=true; try{ const db=await connect(); const {error}=await db.from('books').delete().eq('id',book.id); if(error)throw error; await load(); } catch(err){ message('history-message',err.message||'Could not delete.','error'); } finally{ busy=false; }
});

// What the coach reads: every book with its status, rating, dates and takeaways, plus pace.
function coachSummary(){
  const y=today().slice(0,4); const fin=finished(); const L=[];
  L.push(`Library: ${books.length} books. Finished ${fin.length} all time, ${fin.filter(b=>(b.finished_on||'').startsWith(y)).length} in ${y}. Reading now: ${books.filter(b=>b.status==='reading').length}. Want to read: ${books.filter(b=>b.status==='want').length}.`);
  const byMonth={}; for(const b of fin) if(b.finished_on){ const k=b.finished_on.slice(0,7); byMonth[k]=(byMonth[k]||0)+1; } L.push('Finished per month: '+Object.entries(byMonth).sort().slice(-12).map(([k,v])=>`${k} ${v}`).join(', ')+'.');
  for(const b of books.slice().sort((a,c)=>(c.finished_on||c.updated_at)<(a.finished_on||a.updated_at)?-1:1).slice(0,40)) L.push(`\n${b.title}${b.author?' by '+b.author:''} — ${STATUS[b.status]}${b.rating?`, rated ${b.rating}/10`:''}${b.finished_on?`, finished ${b.finished_on}`:''}${b.takeaways.length?'\n  takeaways: '+b.takeaways.map((t,i)=>`(${i+1}) ${t}`).join(' '):'\n  (no takeaways recorded)'}`);
  return L.join('\n');
}
window.coach={app:'read',note:'The coach reads your titles, ratings and takeaways.',userId:async()=>user?.id||null,session:async()=>{ try{ const db=await connect(); const {data:{session}}=await db.auth.getSession(); return session?.access_token||null; }catch{ return null; } },summary:coachSummary};

// Reconnect a saved session, if any.
render();
connect().catch(()=>{});
})();
