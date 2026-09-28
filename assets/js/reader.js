import '../vendor/foliate/view.js';

const $ = s => document.querySelector(s);
const params = new URLSearchParams(location.search);
const id = params.get('id');
const miniPlatform = ['telegram','max'].includes(params.get('mini')) ? params.get('mini') : '';
const miniMode = Boolean(miniPlatform);

if (miniMode) {
  document.body.classList.add('mini-reader');
  document.body.dataset.platform = miniPlatform;
}

async function api(action,data={}){
  const response=await fetch('api.php',{
    method:'POST',
    headers:{'Content-Type':'application/x-www-form-urlencoded'},
    credentials:'same-origin',
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
function configureBack(bookId){
  const back=$('#readerBack');
  if(!miniMode){
    back.href='book.html?id='+encodeURIComponent(bookId);
    return;
  }

  back.textContent='← В приложение';
  back.href=miniPlatform==='max'?'max/':'telegram/';
  back.addEventListener('click',event=>{
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
async function start(){
  if(!id) throw new Error('Книга не указана');
  const data=await api('get_book_details',{book_id:id});
  if(!data.success||!data.book) throw new Error('Книга недоступна');
  const book=data.book;
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

  const metaTitle=formatTitle(view.book?.metadata?.title);
  if(metaTitle) $('#readerTitle').textContent=metaTitle;

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
  for(const item of view.book?.toc||[]){
    const button=document.createElement('button');
    button.type='button';
    button.textContent=item.label||item.title||'Раздел';
    button.addEventListener('click',()=>{view.goTo(item.href);closeToc();});
    toc.appendChild(button);
  }

  view.addEventListener('relocate',e=>{
    const detail=e.detail||{};
    const fraction=Number(detail.fraction||0);
    $('#progressRange').value=String(fraction);
    $('#progressText').textContent=Math.round(fraction*100)+'%';
    $('#readerChapter').textContent=detail.tocItem?.label||'';
  });
  view.addEventListener('load',e=>{
    const doc=e.detail?.doc;
    if(!doc)return;
    doc.addEventListener('keydown',ev=>{
      if(ev.key==='ArrowLeft')view.goLeft();
      if(ev.key==='ArrowRight')view.goRight();
    });
    if(miniMode)addSwipeNavigation(doc,view);
  });

  $('#prevPage').onclick=()=>view.goLeft();
  $('#nextPage').onclick=()=>view.goRight();
  $('#progressRange').oninput=e=>view.goToFraction(Number(e.target.value));
  document.addEventListener('keydown',e=>{
    if(e.key==='ArrowLeft')view.goLeft();
    if(e.key==='ArrowRight')view.goRight();
  });
  if(miniMode)addSwipeNavigation($('#readerStage'),view);

  view.renderer.next();
}
$('#tocButton').onclick=()=>{ $('#readerToc').classList.add('show'); $('#readerToc').setAttribute('aria-hidden','false'); };
$('#tocClose').onclick=closeToc;
start().catch(error=>{
  const box=document.createElement('div');
  box.className='reader-error';
  box.innerHTML='<div><strong>Не удалось открыть книгу</strong><span>'+String(error.message||'Ошибка чтения').replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]))+'</span></div>';
  $('#readerStage').replaceChildren(box);
});
