const $ = (selector) => document.querySelector(selector);
const STORAGE_KEY = 'facehubDemoPoems';

let selectedYear = null;
let selectedPoemId = null;
let editingPoemId = null;
let searchQuery = '';

function isOwner(){ return sessionStorage.getItem('facehubDemoRole') === 'owner'; }
function uid(){ return crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2); }
function getPoems(){ try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; } }
function savePoems(poems){ localStorage.setItem(STORAGE_KEY, JSON.stringify(poems)); }

if (isOwner()) document.body.classList.add('is-owner');

function toast(message){
  const node=$('#toast');node.textContent=message;node.classList.add('show');
  clearTimeout(window.__poetryToast);window.__poetryToast=setTimeout(()=>node.classList.remove('show'),1800);
}

function formatDate(poem){
  const monthsGenitive=['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
  const monthsNominative=['январь','февраль','март','апрель','май','июнь','июль','август','сентябрь','октябрь','ноябрь','декабрь'];
  const month=Number(poem.month),day=Number(poem.day),year=poem.year;
  if(day&&month>=1&&month<=12)return day+' '+monthsGenitive[month-1]+' '+year;
  if(month>=1&&month<=12)return monthsNominative[month-1]+' '+year;
  return String(year);
}

function sortPoems(poems){
  return [...poems].sort((a,b)=>{
    const da=[Number(a.year)||0,Number(a.month)||0,Number(a.day)||0];
    const db=[Number(b.year)||0,Number(b.month)||0,Number(b.day)||0];
    return db[0]-da[0] || db[1]-da[1] || db[2]-da[2];
  });
}

function filteredPoems(){
  const poems=sortPoems(getPoems());
  if(!searchQuery)return poems;
  const q=searchQuery.toLowerCase();
  return poems.filter(p=>((p.title||'')+' '+(p.text||'')).toLowerCase().includes(q));
}

function yearsFrom(poems){ return [...new Set(poems.map(p=>String(p.year)))].sort((a,b)=>Number(b)-Number(a)); }

function render(){
  const all=filteredPoems();
  const years=yearsFrom(all);
  if(!selectedYear || !years.includes(String(selectedYear))) selectedYear=years[0] || null;

  const yearList=$('#yearList');yearList.innerHTML='';
  years.slice(0,8).forEach(year=>{
    const count=all.filter(p=>String(p.year)===year).length;
    const button=document.createElement('button');button.className='year'+(String(selectedYear)===year?' active':'');
    button.innerHTML='<span></span><small></small>';button.querySelector('span').textContent=year;button.querySelector('small').textContent=count;
    button.addEventListener('click',()=>{selectedYear=year;selectedPoemId=null;render();});
    yearList.appendChild(button);
  });

  $('#yearTotal').textContent=all.length+' текст'+(all.length===1?'':'ов')+' · '+years.length+' лет';
  const yearPoems=all.filter(p=>String(p.year)===String(selectedYear));
  if(!selectedPoemId || !yearPoems.some(p=>p.id===selectedPoemId)) selectedPoemId=yearPoems[0]?.id || null;
  const selected=yearPoems.find(p=>p.id===selectedPoemId) || null;

  $('#panelYear').textContent=selectedYear || '—';
  $('#panelCount').textContent=yearPoems.length+' стих'+(yearPoems.length===1?'':'а');
  $('#listEmpty').classList.toggle('show',yearPoems.length===0);

  const list=$('#poemList');list.innerHTML='';
  yearPoems.slice(0,7).forEach(poem=>{
    const item=document.createElement('article');item.className='poem-item'+(poem.id===selectedPoemId?' active':'');
    const preview=(poem.text||'').replace(/\s+/g,' ').trim();
    item.innerHTML='<time></time><button class="edit-badge" type="button">✎</button><strong></strong><p></p>';
    item.querySelector('time').textContent=formatDate(poem).replace(String(poem.year),'').trim() || String(poem.year);
    item.querySelector('strong').textContent=poem.title?.trim() || 'Без названия';
    item.querySelector('p').textContent=preview;
    item.addEventListener('click',(e)=>{ if(e.target.classList.contains('edit-badge')) return; selectedPoemId=poem.id;render();});
    item.querySelector('.edit-badge').addEventListener('click',()=>openEdit(poem.id));
    list.appendChild(item);
  });

  if(selected){
    $('#readerDate').textContent=formatDate(selected);
    $('#readerTitle').textContent=selected.title?.trim() || 'Без названия';
    $('#readerText').textContent=selected.text;
    const lines=selected.text.split(/\n/).filter(x=>x.trim()).length;
    $('#readerMeta').textContent=lines+' строк · '+selected.year;
  } else {
    $('#readerDate').textContent='—';$('#readerTitle').textContent=searchQuery?'Ничего не найдено':'Стихов пока нет';
    $('#readerText').textContent=searchQuery?'Попробуйте изменить запрос.':'Добавленные стихи будут отображаться здесь.';$('#readerMeta').textContent='—';
  }
  $('#editPoem').disabled=!selected;
  $('#nextPoem').disabled=yearPoems.length<2;
}

function resetForm(){
  editingPoemId=null;$('#poemForm').reset();$('#poemYearInput').value=new Date().getFullYear();
  $('#poemKicker').textContent='Новый текст';$('#poemModalTitle').textContent='Добавить стих';$('#savePoemButton').textContent='Добавить стих';
}

function openModal(){ $('#poemModal').classList.add('show');$('#poemModal').setAttribute('aria-hidden','false'); }
function closeModal(){ $('#poemModal').classList.remove('show');$('#poemModal').setAttribute('aria-hidden','true'); }

$('#openAddPoem').addEventListener('click',()=>{ if(!isOwner())return;resetForm();openModal(); });
document.querySelectorAll('[data-close]').forEach(btn=>btn.addEventListener('click',closeModal));

function openEdit(id){
  if(!isOwner())return;
  const poem=getPoems().find(p=>p.id===id);if(!poem)return;
  resetForm();editingPoemId=id;$('#poemKicker').textContent='Редактирование';$('#poemModalTitle').textContent='Редактировать стих';$('#savePoemButton').textContent='Сохранить';
  $('#poemTitleInput').value=poem.title||'';$('#poemYearInput').value=poem.year||'';$('#poemMonthInput').value=poem.month||'';$('#poemDayInput').value=poem.day||'';$('#poemTextInput').value=poem.text||'';
  openModal();
}
$('#editPoem').addEventListener('click',()=>{if(selectedPoemId)openEdit(selectedPoemId);});

$('#poemForm').addEventListener('submit',(e)=>{
  e.preventDefault();if(!isOwner())return;
  const year=Number($('#poemYearInput').value),month=Number($('#poemMonthInput').value)||null,day=Number($('#poemDayInput').value)||null,text=$('#poemTextInput').value.trim();
  if(!year||!text)return;
  const poems=getPoems();let poem=poems.find(p=>p.id===editingPoemId);const existing=Boolean(poem);
  if(!poem){poem={id:uid()};poems.push(poem);}
  poem.title=$('#poemTitleInput').value.trim();poem.year=year;poem.month=month;poem.day=day;poem.text=text;
  savePoems(poems);selectedYear=String(year);selectedPoemId=poem.id;closeModal();render();toast(existing?'Стих обновлён':'Стих добавлен');
});

$('#poetrySearch').addEventListener('input',(e)=>{searchQuery=e.target.value.trim();selectedYear=null;selectedPoemId=null;render();});

$('#nextPoem').addEventListener('click',()=>{
  const poems=filteredPoems().filter(p=>String(p.year)===String(selectedYear));if(poems.length<2)return;
  const index=poems.findIndex(p=>p.id===selectedPoemId);selectedPoemId=poems[(index+1)%poems.length].id;render();
});

$('#sharePoem').addEventListener('click',async()=>{
  const poem=getPoems().find(p=>p.id===selectedPoemId);if(!poem)return;
  const text=(poem.title?poem.title+'\n\n':'')+poem.text;
  try{
    if(navigator.share) await navigator.share({title:poem.title||'Стих',text});
    else {await navigator.clipboard.writeText(text);toast('Стих скопирован');}
  }catch{}
});

render();
