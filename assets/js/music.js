const $ = (selector) => document.querySelector(selector);
const SONGS_KEY = 'facehubDemoSongs';
const ALBUMS_KEY = 'facehubDemoAlbums';

let editingSongId = null;
let editingAlbumId = null;
let reopenAlbumAfterSong = false;
const runtimeAudioUrls = new Map();
const runtimeCoverUrls = new Map();

function getData(key) {
  try { return JSON.parse(localStorage.getItem(key) || '[]'); }
  catch { return []; }
}
function setData(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
function getSongs(){ return getData(SONGS_KEY); }
function getAlbums(){ return getData(ALBUMS_KEY); }
function saveSongs(v){ setData(SONGS_KEY,v); }
function saveAlbums(v){ setData(ALBUMS_KEY,v); }
function isOwner(){ return sessionStorage.getItem('facehubDemoRole') === 'owner'; }
function uid(){ return crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2); }

if (isOwner()) document.body.classList.add('is-owner');

function plural(count, one, few, many) {
  const m10=count%10,m100=count%100;
  if(m10===1&&m100!==11)return count+' '+one;
  if(m10>=2&&m10<=4&&(m100<12||m100>14))return count+' '+few;
  return count+' '+many;
}

function toast(message){
  const node=$('#toast');node.textContent=message;node.classList.add('show');
  clearTimeout(window.__musicToast);window.__musicToast=setTimeout(()=>node.classList.remove('show'),1800);
}

function albumTitleById(id){
  return getAlbums().find(a=>a.id===id)?.title || 'Без альбома';
}

function render(){
  const songs=getSongs(),albums=getAlbums();
  $('#songCount').textContent=plural(songs.length,'композиция','композиции','композиций');
  $('#albumCount').textContent=plural(albums.length,'альбом','альбома','альбомов');
  $('#songCountSmall').textContent=songs.length;
  $('#albumCountSmall').textContent=albums.length;
  $('#emptySongs').classList.toggle('hidden',songs.length>0);
  $('#emptyAlbums').classList.toggle('hidden',albums.length>0);

  const albumsList=$('#albumsList');albumsList.innerHTML='';
  albums.forEach((album)=>{
    const item=document.createElement('article');item.className='album';
    const count=(album.songIds||[]).length;
    const art=runtimeCoverUrls.get('album:'+album.id);
    item.innerHTML=`
      <div class="album-art"></div>
      <div class="album-tools">
        <button class="icon-btn edit-only" type="button" data-edit-album="${album.id}" title="Редактировать">✎</button>
        <button class="icon-btn" type="button" data-play-album="${album.id}" title="Воспроизвести">▶</button>
      </div>
      <div class="album-copy">
        <small>${album.year||''} · ${plural(count,'трек','трека','треков')}</small>
        <strong></strong>
        <span>${album.description||'Альбом'}</span>
      </div>`;
    item.querySelector('.album-copy strong').textContent=album.title;
    if(art)item.querySelector('.album-art').style.backgroundImage=`linear-gradient(180deg,transparent 42%,rgba(12,19,28,.58)),url("${art}")`;
    albumsList.appendChild(item);
  });

  const songsList=$('#songsList');songsList.innerHTML='';
  songs.slice(0,7).forEach((song,index)=>{
    const item=document.createElement('article');item.className='song';
    const cover=runtimeCoverUrls.get('song:'+song.id);
    item.innerHTML=`
      <div class="song-index">${String(index+1).padStart(2,'0')}</div>
      <div class="song-copy"><strong></strong><span></span></div>
      <span class="song-album"></span><span class="song-time">${song.duration||'—'}</span>
      <div class="song-actions">
        <button class="play" type="button" data-play-song="${song.id}" title="Воспроизвести">▶</button>
        <button class="edit" type="button" data-edit-song="${song.id}" title="Редактировать">✎</button>
        <button class="download" type="button" data-download-song="${song.id}" title="Скачать">⇩</button>
      </div>`;
    item.querySelector('.song-copy strong').textContent=song.title;
    item.querySelector('.song-copy span').textContent=[song.genre,song.year,song.aiPerformer?'ИИ-исполнитель':''].filter(Boolean).join(' · ');
    item.querySelector('.song-album').textContent=albumTitleById(song.albumId);
    if(cover){item.querySelector('.song-index').style.backgroundImage=`url("${cover}")`;item.querySelector('.song-index').textContent='';}
    songsList.appendChild(item);
  });

  refreshAlbumSelector();
  refreshSongAlbumSelect();
}

function openModal(id){ $('#'+id).classList.add('show');$('#'+id).setAttribute('aria-hidden','false'); }
function closeModal(id){ $('#'+id).classList.remove('show');$('#'+id).setAttribute('aria-hidden','true'); }

function resetAlbumForm(){
  editingAlbumId=null;$('#albumForm').reset();$('#albumYear').value=new Date().getFullYear();
  $('#albumKicker').textContent='Новый альбом';$('#albumModalTitle').textContent='Добавить альбом';$('#saveAlbumButton').textContent='Добавить альбом';
  $('#albumCoverPreview').style.backgroundImage='';$('#albumCoverPreview').textContent='＋';$('#albumCoverName').textContent='Квадратное изображение · JPG, PNG, WEBP';
  refreshAlbumSelector();
}
function resetSongForm(){
  editingSongId=null;$('#songForm').reset();$('#songYear').value=new Date().getFullYear();
  $('#songKicker').textContent='Новая композиция';$('#songModalTitle').textContent='Добавить песню';$('#saveSongButton').textContent='Добавить песню';
  $('#songCoverPreview').style.backgroundImage='';$('#songCoverPreview').textContent='＋';$('#songCoverName').textContent='Квадратное изображение · JPG, PNG, WEBP';
  $('#songAudioName').textContent='MP3, WAV, FLAC, AAC, M4A';refreshSongAlbumSelect();
}
function refreshAlbumSelector(selected=[]){
  const box=$('#albumSongSelector');box.innerHTML='';
  const songs=getSongs();
  if(!songs.length){box.innerHTML='<span style="font-size:10px;color:#8c98a4">Сначала добавьте хотя бы одну песню.</span>';return;}
  songs.slice(0,8).forEach(song=>{
    const label=document.createElement('label');label.className='selector-item';
    label.innerHTML=`<input type="checkbox" value="${song.id}"><span></span>`;
    label.querySelector('span').textContent=song.title;
    label.querySelector('input').checked=selected.includes(song.id);
    box.appendChild(label);
  });
}
function refreshSongAlbumSelect(){
  const select=$('#songAlbum');const current=select.value;select.innerHTML='<option value="">Без альбома</option>';
  getAlbums().forEach(a=>{const o=document.createElement('option');o.value=a.id;o.textContent=a.title;select.appendChild(o);});
  if([...select.options].some(o=>o.value===current))select.value=current;
}

$('#openAlbum').addEventListener('click',()=>{ if(!isOwner())return; resetAlbumForm();openModal('albumModal');});
$('#openSong').addEventListener('click',()=>{ if(!isOwner())return; resetSongForm();openModal('songModal');});
$('#openSongFromAlbum').addEventListener('click',()=>{reopenAlbumAfterSong=true;closeModal('albumModal');resetSongForm();openModal('songModal');});
document.querySelectorAll('[data-close]').forEach(btn=>btn.addEventListener('click',()=>closeModal(btn.dataset.close)));

$('#albumCover').addEventListener('change',()=>{
  const f=$('#albumCover').files[0];if(!f)return;const url=URL.createObjectURL(f);$('#albumCoverPreview').style.backgroundImage=`url("${url}")`;$('#albumCoverPreview').textContent='';$('#albumCoverName').textContent=f.name;
});
$('#songCover').addEventListener('change',()=>{
  const f=$('#songCover').files[0];if(!f)return;const url=URL.createObjectURL(f);$('#songCoverPreview').style.backgroundImage=`url("${url}")`;$('#songCoverPreview').textContent='';$('#songCoverName').textContent=f.name;
});
$('#songAudio').addEventListener('change',()=>{const f=$('#songAudio').files[0];if(f)$('#songAudioName').textContent=f.name;});

$('#albumForm').addEventListener('submit',(e)=>{
  e.preventDefault();if(!isOwner())return;
  const title=$('#albumTitle').value.trim();if(!title)return;
  const albums=getAlbums();const selected=[...document.querySelectorAll('#albumSongSelector input:checked')].map(i=>i.value);
  const existing=albums.find(a=>a.id===editingAlbumId);
  const album=existing||{id:uid()};
  album.title=title;album.year=$('#albumYear').value;album.description=$('#albumDescription').value.trim();album.songIds=selected;album.coverFileName=$('#albumCover').files[0]?.name||album.coverFileName||'';
  if(!existing)albums.push(album);saveAlbums(albums);
  const cover=$('#albumCover').files[0];if(cover)runtimeCoverUrls.set('album:'+album.id,URL.createObjectURL(cover));
  const songs=getSongs();songs.forEach(s=>{if(selected.includes(s.id))s.albumId=album.id;else if(s.albumId===album.id)s.albumId='';});saveSongs(songs);
  closeModal('albumModal');render();toast(existing?'Альбом обновлён':'Альбом добавлен');
});

$('#songForm').addEventListener('submit',(e)=>{
  e.preventDefault();if(!isOwner())return;
  const title=$('#songTitle').value.trim();if(!title)return;
  const songs=getSongs();const existing=songs.find(s=>s.id===editingSongId);const song=existing||{id:uid()};
  Object.assign(song,{
    title,year:$('#songYear').value,genre:$('#songGenre').value.trim(),albumId:$('#songAlbum').value,
    lyricsAuthor:$('#songLyricsAuthor').value.trim(),musicAuthor:$('#songMusicAuthor').value.trim(),
    aiPerformer:$('#songAiPerformer').checked,lyrics:$('#songLyrics').value.trim(),
    coverFileName:$('#songCover').files[0]?.name||song.coverFileName||'',audioFileName:$('#songAudio').files[0]?.name||song.audioFileName||''
  });
  if(!existing)songs.push(song);saveSongs(songs);
  const cover=$('#songCover').files[0];if(cover)runtimeCoverUrls.set('song:'+song.id,URL.createObjectURL(cover));
  const audio=$('#songAudio').files[0];if(audio)runtimeAudioUrls.set(song.id,URL.createObjectURL(audio));
  const albums=getAlbums();albums.forEach(a=>{a.songIds=(a.songIds||[]).filter(id=>id!==song.id);if(song.albumId===a.id)a.songIds.push(song.id);});saveAlbums(albums);
  closeModal('songModal');render();toast(existing?'Песня обновлена':'Песня добавлена');
  if(reopenAlbumAfterSong){reopenAlbumAfterSong=false;resetAlbumForm();openModal('albumModal');}
});

document.addEventListener('click',(e)=>{
  const editSong=e.target.closest('[data-edit-song]')?.dataset.editSong;
  if(editSong&&isOwner()){
    const song=getSongs().find(s=>s.id===editSong);if(!song)return;resetSongForm();editingSongId=song.id;
    $('#songKicker').textContent='Редактирование';$('#songModalTitle').textContent='Редактировать песню';$('#saveSongButton').textContent='Сохранить';
    $('#songTitle').value=song.title||'';$('#songYear').value=song.year||'';$('#songGenre').value=song.genre||'';$('#songAlbum').value=song.albumId||'';
    $('#songLyricsAuthor').value=song.lyricsAuthor||'';$('#songMusicAuthor').value=song.musicAuthor||'';$('#songAiPerformer').checked=Boolean(song.aiPerformer);$('#songLyrics').value=song.lyrics||'';
    openModal('songModal');
  }

  const editAlbum=e.target.closest('[data-edit-album]')?.dataset.editAlbum;
  if(editAlbum&&isOwner()){
    const album=getAlbums().find(a=>a.id===editAlbum);if(!album)return;resetAlbumForm();editingAlbumId=album.id;
    $('#albumKicker').textContent='Редактирование';$('#albumModalTitle').textContent='Редактировать альбом';$('#saveAlbumButton').textContent='Сохранить';
    $('#albumTitle').value=album.title||'';$('#albumYear').value=album.year||'';$('#albumDescription').value=album.description||'';refreshAlbumSelector(album.songIds||[]);openModal('albumModal');
  }

  const playSong=e.target.closest('[data-play-song]')?.dataset.playSong;
  if(playSong)playSongById(playSong);

  const playAlbum=e.target.closest('[data-play-album]')?.dataset.playAlbum;
  if(playAlbum){
    const album=getAlbums().find(a=>a.id===playAlbum);const first=(album?.songIds||[])[0];
    if(first)playSongById(first,album.title);else toast('В альбоме пока нет песен');
  }

  const download=e.target.closest('[data-download-song]')?.dataset.downloadSong;
  if(download&&isOwner()){
    const song=getSongs().find(s=>s.id===download);const url=runtimeAudioUrls.get(download);
    if(url){const a=document.createElement('a');a.href=url;a.download=song?.audioFileName||song?.title||'track';a.click();}
    else toast('Файл доступен для скачивания после загрузки в текущей сессии');
  }
});

let currentPlayingId=null;let playing=true;let fakeTimer=null;let fakeProgress=0;
function playSongById(id,albumTitle){
  const song=getSongs().find(s=>s.id===id);if(!song)return;
  currentPlayingId=id;playing=true;fakeProgress=0;
  $('#playerTitle').textContent=song.title;$('#playerSubtitle').textContent=albumTitle||albumTitleById(song.albumId)||'Онлайн-воспроизведение';
  $('#playerCover').textContent='♪';const cover=runtimeCoverUrls.get('song:'+id);if(cover){$('#playerCover').style.backgroundImage=`url("${cover}")`;$('#playerCover').textContent='';}else $('#playerCover').style.backgroundImage='';
  $('#player').classList.add('show');$('#player').setAttribute('aria-hidden','false');$('#playerToggle').textContent='Ⅱ';
  clearInterval(fakeTimer);
  const audioUrl=runtimeAudioUrls.get(id);
  if(audioUrl){const audio=$('#audioElement');audio.src=audioUrl;audio.play().catch(()=>{});}
  fakeTimer=setInterval(()=>{if(!playing)return;fakeProgress=Math.min(100,fakeProgress+.4);$('#playerProgress').style.width=fakeProgress+'%';if(fakeProgress>=100)clearInterval(fakeTimer);},100);
}
$('#playerToggle').addEventListener('click',()=>{
  playing=!playing;$('#playerToggle').textContent=playing?'Ⅱ':'▶';
  const audio=$('#audioElement');if(audio.src){playing?audio.play().catch(()=>{}):audio.pause();}
});
$('#playerClose').addEventListener('click',()=>{$('#player').classList.remove('show');$('#audioElement').pause();clearInterval(fakeTimer);});

render();
