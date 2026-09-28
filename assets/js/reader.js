import '../vendor/foliate/view.js?v=20260928-compat2';

const $ = s => document.querySelector(s);
const params = new URLSearchParams(location.search);
const id = params.get('id');
const miniPlatform = ['telegram','max'].includes(params.get('mini')) ? params.get('mini') : '';
const miniMode = Boolean(miniPlatform);
const progressStorageKey = 'facehub:reader-progress:' + String(id || '');

let serverTracking = false;
let currentProgress = null;
let saveTimer = 0;

if (miniMode) {
  document.body.classList.add('mini-reader');
  document.body.dataset.platform = miniPlatform;
}
if (miniPlatform === 'max') {
  globalThis.FOLIATE_USE_SRCDOC = true;
}

async function api(action,data={},options={}){
  const response=await fetch('api.php',{
    method:'POST',
    headers:{'Content-Type':'application/x-www-form-urlencoded'},
    credentials:'same-origin',
    keepalive:Boolean(options.keepalive),
    body:new URLSearchParams({action,...data}).toString()
  });
  if(!response.ok) throw new Error('Ошибка сервера');
  return response.json();
}

function formatTitle(value){
  if(!value)return '';
  if(typeof value==='string')return value;
  return value.ru||value.en||Object.values(value)[0]||'';
}

function readLocalProgress(){
  try{
    const value=JSON.parse(localStorage.getItem(progressStorageKey)||'null');
    if(!value||typeof value!=='object')return null;
    const fraction=Number(value.fraction);
    if(!Number.isFinite(fraction)||fraction<0||fraction>1)return null;
    return value;
  }catch{return null}
}

function writeLocalProgress(progress){
  try{
    localStorage.setItem(progressStorageKey,JSON.stringify({...progress,saved_at:Date.now()}));
  }catch{}
}

function progressPayload(progress){
  return {
    book_id:id,
    cfi:progress.cfi||'',
    fraction:String(progress.fraction||0),
    location_current:String(progress.location_current||0),
    location_total:String(progress.location_total||0),
    page_current:String(progress.page_current||1),
    page_total:String(progress.page_total||1)
  };
}

function saveServerProgress(progress,keepalive=false){
  if(!serverTracking||!progress)return;
  api('save_reading_progress',progressPayload(progress),{keepalive}).catch(()=>{});
}

function scheduleProgressSave(progress){
  currentProgress=progress;
  writeLocalProgress(progress);
  if(!serverTracking)return;
  window.clearTimeout(saveTimer);
  saveTimer=window.setTimeout(()=>saveServerProgress(currentProgress),650);
}

function flushProgress(){
  window.clearTimeout(saveTimer);
  if(currentProgress)saveServerProgress(currentProgress,true);
}

function configureBack(bookId){
  const back=$('#readerBack');
  if(!miniMode){
    back.href='book.html?id='+encodeURIComponent(bookId);
    return;
  }

  back.textContent='← В приложение';
  back.href=miniPlatform==='max'?'max/':'telegram/';
  back.addEventListener('click',event=>{
    flushProgress();
    if(history.length>1){
      event.preventDefault();
      history.back();
    }
  });
}

function closeToc(){
  $('#readerToc').classList.remove('show');
  $('#readerToc').setAttribute('aria-hidden','true');
}

function addSwipeNavigation(target,view){
  if(!target)return;
  let startX=0,startY=0,started=false;
  target.addEventListener('touchstart',event=>{
    if(event.touches.length!==1)return;
    startX=event.touches[0].clientX;
    startY=event.touches[0].clientY;
    started=true;
  },{passive:true});
  target.addEventListener('touchend',event=>{
    if(!started||!event.changedTouches.length)return;
    started=false;
    const dx=event.changedTouches[0].clientX-startX;
    const dy=event.changedTouches[0].clientY-startY;
    if(Math.abs(dx)<48||Math.abs(dx)<=Math.abs(dy)*1.15)return;
    if(dx<0)view.goRight();
    else view.goLeft();
  },{passive:true});
}

function makeProgress(detail,pageTotal){
  const fraction=Math.max(0,Math.min(1,Number(detail.fraction)||0));
  const total=Math.max(1,Number(pageTotal)||1);
  const page=Math.min(total,Math.max(1,Math.round(fraction*(total-1))+1));
  return {
    cfi:typeof detail.cfi==='string'?detail.cfi:'',
    fraction,
    location_current:Number(detail.location?.current)||0,
    location_total:Number(detail.location?.total)||0,
    page_current:page,
    page_total:total
  };
}

function updateProgressUi(progress){
  $('#progressRange').value=String(progress.fraction);
  $('#progressText').textContent=progress.page_current+' / '+progress.page_total+' · '+Math.round(progress.fraction*100)+'%';
}

function buildToc(items,container,view,depth=0){
  for(const item of items||[]){
    const button=document.createElement('button');
    button.type='button';
    button.textContent=item.label||item.title||'Раздел';
    button.style.paddingLeft=(10+depth*14)+'px';
    button.addEventListener('click',async()=>{
      try{
        await view.goTo(item.href);
        closeToc();
      }catch{
        button.classList.add('reader-toc-error');
        window.setTimeout(()=>button.classList.remove('reader-toc-error'),1000);
      }
    });
    container.appendChild(button);
    if(item.subitems?.length)buildToc(item.subitems,container,view,depth+1);
  }
}

async function start(){
  if(!id) throw new Error('Книга не указана');

  const [data,progressData]=await Promise.all([
    api('get_book_details',{book_id:id}),
    api('get_reading_progress',{book_id:id}).catch(()=>({success:true,logged_in:false,progress:null}))
  ]);

  if(!data.success||!data.book) throw new Error('Книга недоступна');
  const book=data.book;
  serverTracking=Boolean(progressData?.logged_in);

  const savedProgress=progressData?.progress||readLocalProgress();
  configureBack(id);
  $('#readerTitle').textContent=book.title||'Книга';
  document.title=(book.title||'Книга')+' — читалка';

  const source=book.file_epub||book.file_fb2;
  if(!source){
    if(book.file_pdf){ location.replace(book.file_pdf); return; }
    throw new Error('Нет доступного формата для чтения');
  }

  const format=book.file_epub?'epub':'fb2';
  const fileResponse=await fetch(source,{credentials:'same-origin'});
  if(!fileResponse.ok) throw new Error('Не удалось получить файл книги');
  const blob=await fileResponse.blob();
  const mime=format==='epub'?'application/epub+zip':'application/x-fictionbook+xml';
  const file=new File([blob],`book-${id}.${format}`,{type:blob.type||mime});

  const view=document.createElement('foliate-view');
  $('#readerStage').replaceChildren(view);
  await view.open(file);

  view.book?.transformTarget?.addEventListener('data',({detail})=>{
    detail.data=Promise.resolve(detail.data).catch(()=> '');
  });

  const metaTitle=formatTitle(view.book?.metadata?.title);
  if(metaTitle)$('#readerTitle').textContent=metaTitle;

  view.renderer.setAttribute('flow','paginated');
  view.renderer.setStyles?.(`
    :root { color-scheme: light; }
    body {
      color:#302e2b !important;
      background:#fbf8f2 !important;
      font-family: Georgia, "Times New Roman", serif !important;
      line-height:1.65 !important;
      -webkit-text-size-adjust:100%;
    }
    p { line-height:1.65 !important; }
    a { color:#526c86 !important; }
    img { max-width:100% !important; height:auto !important; }
  `);

  const toc=$('#tocList');
  buildToc(view.book?.toc||[],toc,view);

  const pageTotal=Math.max(1,Number(book.page_count)||1);

  view.addEventListener('relocate',event=>{
    const detail=event.detail||{};
    const progress=makeProgress(detail,pageTotal);
    updateProgressUi(progress);
    $('#readerChapter').textContent=detail.tocItem?.label||'';
    scheduleProgressSave(progress);
  });

  view.addEventListener('load',event=>{
    const doc=event.detail?.doc;
    if(!doc)return;
    doc.addEventListener('keydown',ev=>{
      if(ev.key==='ArrowLeft')view.goLeft();
      if(ev.key==='ArrowRight')view.goRight();
    });
    if(miniMode)addSwipeNavigation(doc,view);
  });

  $('#prevPage').onclick=()=>view.goLeft();
  $('#nextPage').onclick=()=>view.goRight();
  $('#progressRange').onchange=event=>view.goToFraction(Number(event.target.value));
  $('#progressRange').oninput=event=>{
    const fraction=Number(event.target.value);
    const preview=makeProgress({fraction},pageTotal);
    updateProgressUi(preview);
  };
  document.addEventListener('keydown',event=>{
    if(event.key==='ArrowLeft')view.goLeft();
    if(event.key==='ArrowRight')view.goRight();
  });
  if(miniMode)addSwipeNavigation($('#readerStage'),view);

  const lastLocation=savedProgress?.cfi
    || (Number(savedProgress?.fraction)>0 ? {fraction:Number(savedProgress.fraction)} : null);

  await view.init({
    lastLocation,
    showTextStart:true
  });
}

$('#tocButton').onclick=()=>{
  $('#readerToc').classList.add('show');
  $('#readerToc').setAttribute('aria-hidden','false');
};
$('#tocClose').onclick=closeToc;
window.addEventListener('pagehide',flushProgress);
document.addEventListener('visibilitychange',()=>{
  if(document.visibilityState==='hidden')flushProgress();
});

start().catch(error=>{
  const box=document.createElement('div');
  box.className='reader-error';
  const detail=String(error.message||'Ошибка чтения').replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
  box.innerHTML='<div><strong>Не удалось открыть книгу</strong><span>'+detail+'</span></div>';
  $('#readerStage').replaceChildren(box);
});
