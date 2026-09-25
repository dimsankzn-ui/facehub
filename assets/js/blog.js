const $ = (selector) => document.querySelector(selector);
const POSTS_KEY = 'facehubDemoBlogPosts';
const TAGS_KEY = 'facehubDemoBlogTags';

let activeTag = 'Все';
let searchQuery = '';
let editingPostId = null;
let currentViewerPostId = null;

const runtimeCoverUrls = new Map();
const runtimeBlockUrls = new Map();

function isOwner(){ return sessionStorage.getItem('facehubDemoRole') === 'owner'; }
function uid(){ return crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2); }
function read(key,fallback){ try{return JSON.parse(localStorage.getItem(key)||JSON.stringify(fallback));}catch{return fallback;} }
function write(key,value){ localStorage.setItem(key,JSON.stringify(value)); }

function getTags(){
  const tags=read(TAGS_KEY,[]);
  if(tags.length)return tags;
  const defaults=[
    {id:'thoughts',name:'Мысли',description:''},
    {id:'projects',name:'Проекты',description:''},
    {id:'personal',name:'Личное',description:''},
    {id:'notes',name:'Заметки',description:''}
  ];
  write(TAGS_KEY,defaults);return defaults;
}
function getPosts(){ return read(POSTS_KEY,[]); }
function savePosts(v){ write(POSTS_KEY,v); }
function saveTags(v){ write(TAGS_KEY,v); }

if(isOwner()) document.body.classList.add('is-owner');

function toast(message){
  const node=$('#toast');node.textContent=message;node.classList.add('show');
  clearTimeout(window.__blogToast);window.__blogToast=setTimeout(()=>node.classList.remove('show'),1800);
}
function formatDate(value){
  if(!value)return 'Без даты';
  const d=new Date(value+'T00:00:00');
  return new Intl.DateTimeFormat('ru-RU',{day:'numeric',month:'long',year:'numeric'}).format(d);
}
function tagName(id){ return getTags().find(t=>t.id===id)?.name || 'Без тега'; }

function visiblePosts(){
  const q=searchQuery.toLowerCase();
  return [...getPosts()].sort((a,b)=>(b.date||'').localeCompare(a.date||'')).filter(post=>{
    const tagOk=activeTag==='Все'||tagName(post.tagId)===activeTag;
    const hay=[post.title,post.excerpt,...(post.blocks||[]).map(b=>b.type==='text'?b.text:'')].join(' ').toLowerCase();
    return tagOk&&(!q||hay.includes(q));
  });
}

function renderTags(){
  const tags=getTags();
  const filters=$('#tagFilters');filters.innerHTML='';
  ['Все',...tags.map(t=>t.name)].forEach(name=>{
    const btn=document.createElement('button');btn.className='filter'+(name===activeTag?' active':'');btn.textContent=name;
    btn.addEventListener('click',()=>{activeTag=name;render();});filters.appendChild(btn);
  });

  const select=$('#postTag');const current=select.value;select.innerHTML='';
  tags.forEach(tag=>{const o=document.createElement('option');o.value=tag.id;o.textContent=tag.name;select.appendChild(o);});
  if([...select.options].some(o=>o.value===current))select.value=current;

  const manager=$('#tagManagerList');manager.innerHTML='';
  tags.forEach(tag=>{
    const row=document.createElement('div');row.className='tag-row';
    row.innerHTML='<span></span><button type="button" class="rename">✎</button><button type="button" class="delete">×</button>';
    row.querySelector('span').textContent=tag.name;
    row.querySelector('.rename').addEventListener('click',()=>{
      const next=prompt('Новое название тега',tag.name);if(!next?.trim())return;
      const items=getTags();const item=items.find(t=>t.id===tag.id);item.name=next.trim();saveTags(items);if(activeTag===tag.name)activeTag=item.name;render();
    });
    row.querySelector('.delete').addEventListener('click',()=>{
      const posts=getPosts();if(posts.some(p=>p.tagId===tag.id)){toast('Сначала смените тег у публикаций');return;}
      saveTags(getTags().filter(t=>t.id!==tag.id));if(activeTag===tag.name)activeTag='Все';render();
    });
    manager.appendChild(row);
  });

  $('#tagPreview').innerHTML=tags.map(t=>'<span></span>').join('');
  [...$('#tagPreview').children].forEach((node,i)=>node.textContent=tags[i].name);
}

function render(){
  renderTags();
  const posts=visiblePosts();
  $('#postCount').textContent=posts.length+' пост'+(posts.length===1?'':'ов');
  $('#feedEmpty').classList.toggle('show',posts.length===0);

  const featured=posts[0]||null;
  $('#readFeatured').disabled=!featured;
  $('#editFeatured').disabled=!featured;
  if(featured){
    $('#featuredTag').textContent=tagName(featured.tagId);
    $('#featuredDate').textContent=formatDate(featured.date);
    $('#featuredTitle').textContent=featured.title;
    $('#featuredExcerpt').textContent=featured.excerpt||'';
    const cover=runtimeCoverUrls.get(featured.id);
    $('#featuredCover').style.backgroundImage=cover?`linear-gradient(180deg,rgba(14,22,32,.04),rgba(14,22,32,.58)),url("${cover}")`:'';
  } else {
    $('#featuredTag').textContent='—';$('#featuredDate').textContent='—';$('#featuredTitle').textContent=searchQuery?'Ничего не найдено':'Публикаций пока нет';
    $('#featuredExcerpt').textContent=searchQuery?'Попробуйте изменить запрос.':'Когда появится первая публикация, она будет показана здесь.';$('#featuredCover').style.backgroundImage='';
  }

  const list=$('#postList');list.innerHTML='';
  posts.slice(1,6).forEach(post=>{
    const item=document.createElement('article');item.className='post';
    item.innerHTML='<time></time><strong></strong><p></p><span class="topic"></span><button class="post-edit" type="button">✎</button>';
    item.querySelector('time').textContent=formatDate(post.date);
    item.querySelector('strong').textContent=post.title;
    item.querySelector('p').textContent=post.excerpt||'';
    item.querySelector('.topic').textContent=tagName(post.tagId);
    item.addEventListener('click',(e)=>{if(e.target.classList.contains('post-edit'))return;openViewer(post.id);});
    item.querySelector('.post-edit').addEventListener('click',()=>openEditor(post.id));
    list.appendChild(item);
  });
}

function openOverlay(id){ $('#'+id).classList.add('show');$('#'+id).setAttribute('aria-hidden','false'); }
function closeOverlay(id){ $('#'+id).classList.remove('show');$('#'+id).setAttribute('aria-hidden','true'); }
document.querySelectorAll('[data-close]').forEach(btn=>btn.addEventListener('click',()=>closeOverlay(btn.dataset.close)));

$('#blogSearch').addEventListener('input',e=>{searchQuery=e.target.value.trim();render();});
$('#openTagManager').addEventListener('click',()=>{if(isOwner())openOverlay('tagsOverlay');});
$('#addTagButton').addEventListener('click',()=>{
  if(!isOwner())return;const name=$('#newTagName').value.trim();if(!name)return;
  const tags=getTags();if(tags.some(t=>t.name.toLowerCase()===name.toLowerCase())){toast('Такой тег уже есть');return;}
  tags.push({id:uid(),name,description:$('#newTagDescription').value.trim()});saveTags(tags);$('#newTagName').value='';$('#newTagDescription').value='';render();
});

function defaultTextBlock(){ return {id:uid(),type:'text',text:''}; }
function resetEditor(){
  editingPostId=null;$('#postForm').reset();$('#postDate').value=new Date().toISOString().slice(0,10);
  $('#editorKicker').textContent='Новая публикация';$('#editorTitle').textContent='Добавить пост';$('#savePostButton').textContent='Опубликовать';
  $('#postCoverPreview').style.backgroundImage='';$('#postCoverPreview').textContent='＋';$('#postCoverName').textContent='JPG, PNG, WEBP';
  $('#blocksList').innerHTML='';appendBlock(defaultTextBlock());renderTags();
}
function openEditor(id=null){
  if(!isOwner())return;resetEditor();
  if(id){
    const post=getPosts().find(p=>p.id===id);if(!post)return;editingPostId=id;
    $('#editorKicker').textContent='Редактирование';$('#editorTitle').textContent='Редактировать пост';$('#savePostButton').textContent='Сохранить';
    $('#postTitle').value=post.title||'';$('#postTag').value=post.tagId||'';$('#postDate').value=post.date||'';$('#postExcerpt').value=post.excerpt||'';
    $('#blocksList').innerHTML='';(post.blocks?.length?post.blocks:[defaultTextBlock()]).forEach(appendBlock);
  }
  openOverlay('editorOverlay');
}
$('#openPostEditor').addEventListener('click',()=>openEditor());
$('#editFeatured').addEventListener('click',()=>{const p=visiblePosts()[0];if(p)openEditor(p.id);});

$('#postCover').addEventListener('change',()=>{
  const f=$('#postCover').files[0];if(!f)return;const url=URL.createObjectURL(f);
  $('#postCoverPreview').style.backgroundImage=`url("${url}")`;$('#postCoverPreview').textContent='';$('#postCoverName').textContent=f.name;
});

function blockMarkup(block){
  if(block.type==='text'){
    return `<article class="block" draggable="true" data-block-id="${block.id}" data-type="text">
      <div class="drag-handle">⋮⋮</div>
      <div class="block-main"><strong>Текстовый блок</strong><textarea class="block-text" placeholder="Введите текст"></textarea></div>
      <div class="block-actions"><button class="remove" type="button">×</button></div>
    </article>`;
  }
  const photo=block.type==='photo';const label=photo?'Фотоблок':'Видеоблок';const icon=photo?'▧':'▶';const formats=photo?'JPG, PNG, WEBP':'MP4, WEBM, MOV';
  return `<article class="block" draggable="true" data-block-id="${block.id}" data-type="${block.type}">
    <div class="drag-handle">⋮⋮</div>
    <div class="block-main"><strong>${label}</strong>
      <label class="media-box drop-zone">
        <input class="block-file" type="file" accept="${photo?'image/jpeg,image/png,image/webp':'video/mp4,video/webm,video/quicktime'}" hidden>
        <div class="media-icon">${icon}</div>
        <div class="media-copy"><strong class="media-name">Загрузить ${photo?'изображение':'видео'}</strong><span>${formats}</span></div>
      </label>
    </div>
    <div class="block-actions"><button class="remove" type="button">×</button></div>
  </article>`;
}
function appendBlock(block){
  $('#blocksList').insertAdjacentHTML('beforeend',blockMarkup(block));
  const node=$('#blocksList').lastElementChild;
  if(block.type==='text')node.querySelector('.block-text').value=block.text||'';
  else{
    node.dataset.fileName=block.fileName||'';
    if(block.fileName)node.querySelector('.media-name').textContent=block.fileName;
    const url=runtimeBlockUrls.get(block.id);
    if(url&&block.type==='photo')node.querySelector('.media-icon').style.backgroundImage=`url("${url}")`;
  }
  bindBlock(node);
}
function bindBlock(node){
  node.querySelector('.remove').addEventListener('click',()=>node.remove());
  const input=node.querySelector('.block-file');
  if(input)input.addEventListener('change',()=>{
    const f=input.files[0];if(!f)return;node.dataset.fileName=f.name;runtimeBlockUrls.set(node.dataset.blockId,URL.createObjectURL(f));node.querySelector('.media-name').textContent=f.name;
    if(node.dataset.type==='photo'){node.querySelector('.media-icon').style.backgroundImage=`url("${runtimeBlockUrls.get(node.dataset.blockId)}")`;node.querySelector('.media-icon').textContent='';}
  });
}
function collectBlocks(){
  return [...document.querySelectorAll('#blocksList .block')].map(node=>{
    const base={id:node.dataset.blockId,type:node.dataset.type};
    if(base.type==='text')base.text=node.querySelector('.block-text').value;
    else base.fileName=node.dataset.fileName||'';
    return base;
  });
}

$('#openAddBlockMenu').addEventListener('click',()=>$('#addBlockMenu').classList.toggle('show'));
document.querySelectorAll('[data-add-block]').forEach(btn=>btn.addEventListener('click',()=>{
  appendBlock({id:uid(),type:btn.dataset.addBlock,text:''});$('#addBlockMenu').classList.remove('show');
}));

let dragged=null,marker=null,ghost=null;
function interactiveTarget(target){return Boolean(target.closest('textarea,input,select,button,.drop-zone,[contenteditable="true"]'));}
function makeMarker(){const m=document.createElement('div');m.className='drop-marker';m.textContent='Блок будет перемещён сюда';return m;}
function makeGhost(block){
  const g=document.createElement('div');g.className='drag-ghost';
  const title=block.dataset.type==='text'?'Текстовый блок':block.dataset.type==='photo'?'Фотоблок':'Видеоблок';
  const detail=block.dataset.type==='text'?(block.querySelector('.block-text')?.value.trim()||'Пустой текстовый блок'):(block.dataset.fileName||'Медиаблок');
  g.innerHTML='<strong>'+title+'</strong><p></p>';g.querySelector('p').textContent=detail;document.body.appendChild(g);return g;
}
$('#blocksList').addEventListener('dragstart',e=>{
  const block=e.target.closest('.block');if(!block||interactiveTarget(e.target)){e.preventDefault();return;}
  dragged=block;block.classList.add('dragging');marker=makeMarker();ghost=makeGhost(block);setTimeout(()=>block.after(marker),0);
  if(e.dataTransfer){e.dataTransfer.effectAllowed='move';const img=new Image();img.src='data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';e.dataTransfer.setDragImage(img,0,0);}
});
document.addEventListener('dragover',e=>{
  if(!dragged)return;e.preventDefault();
  if(ghost){ghost.style.left=Math.min(innerWidth-590,e.clientX+18)+'px';ghost.style.top=Math.min(innerHeight-100,e.clientY+14)+'px';}
  const blocks=[...document.querySelectorAll('#blocksList .block:not(.dragging)')];let inserted=false;
  for(const block of blocks){const r=block.getBoundingClientRect();if(e.clientY<r.top+r.height/2){$('#blocksList').insertBefore(marker,block);inserted=true;break;}}
  if(!inserted)$('#blocksList').appendChild(marker);
});
$('#blocksList').addEventListener('drop',e=>{if(!dragged)return;e.preventDefault();$('#blocksList').insertBefore(dragged,marker);});
document.addEventListener('dragend',()=>{
  if(!dragged)return;dragged.classList.remove('dragging');marker?.remove();ghost?.remove();dragged=null;marker=null;ghost=null;
});

$('#postForm').addEventListener('submit',e=>{
  e.preventDefault();if(!isOwner())return;
  const title=$('#postTitle').value.trim();if(!title)return;
  const posts=getPosts();let post=posts.find(p=>p.id===editingPostId);const existing=Boolean(post);if(!post){post={id:uid()};posts.push(post);}
  post.title=title;post.tagId=$('#postTag').value;post.date=$('#postDate').value;post.excerpt=$('#postExcerpt').value.trim();post.blocks=collectBlocks();
  post.coverFileName=$('#postCover').files[0]?.name||post.coverFileName||'';
  const cover=$('#postCover').files[0];if(cover)runtimeCoverUrls.set(post.id,URL.createObjectURL(cover));
  savePosts(posts);closeOverlay('editorOverlay');render();toast(existing?'Публикация обновлена':'Публикация опубликована');
});

function openViewer(id){
  const post=getPosts().find(p=>p.id===id);if(!post)return;currentViewerPostId=id;
  $('#viewerTitleMini').textContent=post.title;$('#viewerTitle').textContent=post.title;$('#viewerMeta').textContent=tagName(post.tagId)+' · '+formatDate(post.date);
  const cover=runtimeCoverUrls.get(id);$('#viewerHero').style.backgroundImage=cover?`linear-gradient(180deg,rgba(15,23,32,.03),rgba(15,23,32,.48)),url("${cover}")`:'';
  const host=$('#viewerBlocks');host.innerHTML='';
  (post.blocks||[]).forEach(block=>{
    const section=document.createElement('section');section.className='content-block';
    if(block.type==='text'){
      section.classList.add('text-block');section.textContent=block.text||'';
    }else if(block.type==='photo'){
      const img=document.createElement('div');img.className='image-block';const url=runtimeBlockUrls.get(block.id);if(url)img.style.backgroundImage=`url("${url}")`;section.appendChild(img);
      if(block.fileName){const cap=document.createElement('div');cap.className='media-caption';cap.textContent=block.fileName;section.appendChild(cap);}
    }else{
      const box=document.createElement('div');box.className='video-block';const url=runtimeBlockUrls.get(block.id);
      if(url){const video=document.createElement('video');video.src=url;video.controls=true;video.preload='metadata';box.appendChild(video);}
      else{box.innerHTML='<div class="video-placeholder">▶</div>';}
      section.appendChild(box);if(block.fileName){const cap=document.createElement('div');cap.className='media-caption';cap.textContent=block.fileName;section.appendChild(cap);}
    }
    host.appendChild(section);
  });
  $('#viewerScroll').scrollTop=0;openOverlay('viewerOverlay');
}
$('#readFeatured').addEventListener('click',()=>{const p=visiblePosts()[0];if(p)openViewer(p.id);});
$('#sharePost').addEventListener('click',async()=>{
  const post=getPosts().find(p=>p.id===currentViewerPostId);if(!post)return;
  const text=post.title+'\n\n'+(post.excerpt||'');
  try{if(navigator.share)await navigator.share({title:post.title,text});else{await navigator.clipboard.writeText(text);toast('Ссылка на публикацию скопирована');}}catch{}
});

render();
