import '../vendor/foliate/view.js';

const $ = s => document.querySelector(s);
const params = new URLSearchParams(location.search);
const id = params.get('id');

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
async function start(){
  if(!id) throw new Error('Книга не указана');
  const data=await api('get_book_details',{book_id:id});
  if(!data.success||!data.book) throw new Error('Книга недоступна');
  const book=data.book;
  $('#readerBack').href='book.html?id='+encodeURIComponent(id);
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
    body { color:#302e2b !important; background:#fbf8f2 !important; font-family: Georgia, "Times New Roman", serif !important; line-height:1.65 !important; }
    p { line-height:1.65 !important; }
    a { color:#526c86 !important; }
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
    e.detail?.doc?.addEventListener('keydown',ev=>{
      if(ev.key==='ArrowLeft')view.goLeft();
      if(ev.key==='ArrowRight')view.goRight();
    });
  });
  $('#prevPage').onclick=()=>view.goLeft();
  $('#nextPage').onclick=()=>view.goRight();
  $('#progressRange').oninput=e=>view.goToFraction(Number(e.target.value));
  document.addEventListener('keydown',e=>{
    if(e.key==='ArrowLeft')view.goLeft();
    if(e.key==='ArrowRight')view.goRight();
  });
  view.renderer.next();
}
function closeToc(){ $('#readerToc').classList.remove('show'); $('#readerToc').setAttribute('aria-hidden','true'); }
$('#tocButton').onclick=()=>{ $('#readerToc').classList.add('show'); $('#readerToc').setAttribute('aria-hidden','false'); };
$('#tocClose').onclick=closeToc;
start().catch(error=>{
  const box=document.createElement('div'); box.className='reader-error'; box.textContent=error.message||'Не удалось открыть книгу';
  $('#readerStage').replaceChildren(box);
});
