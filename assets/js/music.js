const $ = (selector) => document.querySelector(selector);

let auth = { logged_in: false, role: 'guest' };
let albums = [];
let songs = [];
let editingAlbumId = null;
let editingSongId = null;
let albumSelectedIds = [];
let returnToAlbumId = null;
const armedDeletes = new Map();

const audio = $('#audioElement');
let originalQueue = [];
let playQueue = [];
let currentIndex = -1;
let repeatEnabled = false;
let shuffleEnabled = false;

function isOwner() {
  return auth.logged_in && auth.role === 'admin';
}

function mediaUrl(path) {
  if (!path) return '';
  return new URL(path.replace(/^\//, ''), location.origin + '/').href;
}

function fileName(path) {
  if (!path) return '';
  try { return decodeURIComponent(path.split('/').pop()); }
  catch { return path.split('/').pop(); }
}

async function api(action, data = {}) {
  const response = await fetch('api.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    credentials: 'same-origin',
    body: new URLSearchParams({ action, ...data }).toString()
  });
  if (!response.ok) throw new Error('Ошибка сервера');
  return response.json();
}

async function apiForm(formData) {
  const response = await fetch('api.php', {
    method: 'POST',
    credentials: 'same-origin',
    body: formData
  });
  if (!response.ok) throw new Error('Ошибка загрузки');
  return response.json();
}

function plural(count, one, few, many) {
  const m10 = count % 10;
  const m100 = count % 100;
  if (m10 === 1 && m100 !== 11) return count + ' ' + one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return count + ' ' + few;
  return count + ' ' + many;
}

function toast(message) {
  const node = $('#toast');
  node.textContent = message;
  node.classList.add('show');
  clearTimeout(window.__musicToast);
  window.__musicToast = setTimeout(() => node.classList.remove('show'), 2000);
}

function albumById(id) {
  return albums.find((album) => Number(album.id) === Number(id));
}

function songById(id) {
  return songs.find((song) => Number(song.id) === Number(id));
}

function albumTitleById(id) {
  return albumById(id)?.title || 'Без альбома';
}

function songCover(song) {
  if (song.cover) return song.cover;
  return albumById(song.album_id)?.cover || '';
}

function sortedAlbumSongs(albumId) {
  return songs
    .filter((song) => Number(song.album_id) === Number(albumId))
    .sort((a, b) => Number(a.album_order || 0) - Number(b.album_order || 0) || Number(a.id) - Number(b.id));
}

function createIconButton(text, title, className, datasetKey, datasetValue) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.textContent = text;
  button.title = title;
  if (datasetKey) button.dataset[datasetKey] = String(datasetValue);
  return button;
}

function renderAlbums() {
  const list = $('#albumsList');
  list.replaceChildren();

  albums.forEach((album) => {
    const item = document.createElement('article');
    item.className = 'album';

    const art = document.createElement('div');
    art.className = 'album-art';
    if (album.cover) {
      art.style.backgroundImage =
        'linear-gradient(180deg,transparent 42%,rgba(12,19,28,.58)),url("' + mediaUrl(album.cover) + '")';
    }

    const tools = document.createElement('div');
    tools.className = 'album-tools';

    if (album.yandex_link) {
      const yandex = document.createElement('a');
      yandex.className = 'icon-btn album-yandex';
      yandex.href = album.yandex_link;
      yandex.target = '_blank';
      yandex.rel = 'noopener';
      yandex.title = 'Яндекс Музыка';
      yandex.textContent = 'Я';
      tools.appendChild(yandex);
    }

    if (isOwner()) {
      tools.appendChild(createIconButton('✎', 'Редактировать', 'icon-btn edit-only', 'editAlbum', album.id));
      tools.appendChild(createIconButton('×', 'Удалить альбом', 'icon-btn edit-only danger', 'deleteAlbum', album.id));
    }

    tools.appendChild(createIconButton('▶', 'Воспроизвести', 'icon-btn', 'playAlbum', album.id));

    const copy = document.createElement('div');
    copy.className = 'album-copy';
    const count = sortedAlbumSongs(album.id).length;
    const small = document.createElement('small');
    small.textContent = [album.release_year || '', plural(count, 'трек', 'трека', 'треков')].filter(Boolean).join(' · ');
    const strong = document.createElement('strong');
    strong.textContent = album.title || 'Без названия';
    const comment = document.createElement('span');
    comment.textContent = album.comment || 'Альбом';
    copy.append(small, strong, comment);

    item.append(art, tools, copy);
    list.appendChild(item);
  });
}

function renderSongs() {
  const list = $('#songsList');
  list.replaceChildren();

  songs.forEach((song, index) => {
    const item = document.createElement('article');
    item.className = 'song';
    item.dataset.songId = String(song.id);
    item.tabIndex = 0;
    item.setAttribute('role', 'button');
    item.setAttribute('aria-label', 'Открыть карточку песни «' + (song.title || 'Без названия') + '»');

    const visual = document.createElement('div');
    visual.className = 'song-index';
    visual.textContent = String(index + 1).padStart(2, '0');
    const cover = songCover(song);
    if (cover) {
      visual.style.backgroundImage = 'url("' + mediaUrl(cover) + '")';
      visual.textContent = '';
    }

    const copy = document.createElement('div');
    copy.className = 'song-copy';
    const title = document.createElement('strong');
    title.textContent = song.title || 'Без названия';
    const meta = document.createElement('span');
    meta.textContent = [song.genre, song.release_year, song.music_author ? 'Музыка: ' + song.music_author : '', Number(song.is_ai) ? 'ИИ' : '']
      .filter(Boolean).join(' · ');
    copy.append(title, meta);

    const album = document.createElement('span');
    album.className = 'song-album';
    album.textContent = song.album_title || albumTitleById(song.album_id);

    const duration = document.createElement('span');
    duration.className = 'song-time';
    duration.dataset.songDuration = String(song.id);
    duration.textContent = '—';

    const actions = document.createElement('div');
    actions.className = 'song-actions';
    actions.appendChild(createIconButton('▶', 'Воспроизвести', 'play', 'playSong', song.id));

    if (isOwner()) {
      actions.appendChild(createIconButton('✎', 'Редактировать', 'edit', 'editSong', song.id));
      actions.appendChild(createIconButton('⇩', 'Скачать', 'download', 'downloadSong', song.id));
      actions.appendChild(createIconButton('×', 'Удалить', 'delete', 'deleteSong', song.id));
    }

    item.append(visual, copy, album, duration, actions);
    list.appendChild(item);
  });
}

function render() {
  $('#songCount').textContent = plural(songs.length, 'композиция', 'композиции', 'композиций');
  $('#albumCount').textContent = plural(albums.length, 'альбом', 'альбома', 'альбомов');
  $('#songCountSmall').textContent = songs.length;
  $('#albumCountSmall').textContent = albums.length;
  $('#emptySongs').classList.toggle('hidden', songs.length > 0);
  $('#emptyAlbums').classList.toggle('hidden', albums.length > 0);

  renderAlbums();
  renderSongs();
  refreshSongAlbumSelect();
  updateSongPlaybackButtons();
}

async function loadMusicData() {
  const data = await api('get_music_data');
  if (!data.success) throw new Error('Не удалось загрузить музыку');
  albums = Array.isArray(data.albums) ? data.albums : [];
  songs = Array.isArray(data.songs) ? data.songs : [];
  render();
}

function openModal(id) {
  $('#' + id).classList.add('show');
  $('#' + id).setAttribute('aria-hidden', 'false');
}

function closeModal(id) {
  $('#' + id).classList.remove('show');
  $('#' + id).setAttribute('aria-hidden', 'true');
}

document.querySelectorAll('[data-close]').forEach((button) => {
  button.addEventListener('click', () => closeModal(button.dataset.close));
});

document.querySelectorAll('.modal-backdrop').forEach((backdrop) => {
  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop) closeModal(backdrop.id);
  });
});

function resetAlbumForm() {
  editingAlbumId = null;
  albumSelectedIds = [];
  $('#albumForm').reset();
  $('#albumYear').value = new Date().getFullYear();
  $('#albumYandex').value = '';
  $('#albumKicker').textContent = 'Новый альбом';
  $('#albumModalTitle').textContent = 'Добавить альбом';
  $('#saveAlbumButton').textContent = 'Добавить альбом';
  $('#albumCoverPreview').style.backgroundImage = '';
  $('#albumCoverPreview').textContent = '＋';
  $('#albumCoverName').textContent = 'Квадратное изображение · JPG, PNG, WEBP';
  renderAlbumSelector();
}

function openAlbumEditor(id = null) {
  resetAlbumForm();

  if (id !== null) {
    const album = albumById(id);
    if (!album) return;

    editingAlbumId = Number(album.id);
    albumSelectedIds = sortedAlbumSongs(album.id).map((song) => Number(song.id));
    $('#albumKicker').textContent = 'Редактирование';
    $('#albumModalTitle').textContent = 'Редактировать альбом';
    $('#saveAlbumButton').textContent = 'Сохранить';
    $('#albumTitle').value = album.title || '';
    $('#albumYear').value = album.release_year || '';
    $('#albumDescription').value = album.comment || '';
    $('#albumYandex').value = album.yandex_link || '';

    if (album.cover) {
      $('#albumCoverPreview').style.backgroundImage = 'url("' + mediaUrl(album.cover) + '")';
      $('#albumCoverPreview').textContent = '';
      $('#albumCoverName').textContent = 'Сейчас: ' + fileName(album.cover);
    }

    renderAlbumSelector();
  }

  openModal('albumModal');
}

function moveSelectedSong(id, delta) {
  const index = albumSelectedIds.indexOf(Number(id));
  const target = index + delta;
  if (index < 0 || target < 0 || target >= albumSelectedIds.length) return;
  const [item] = albumSelectedIds.splice(index, 1);
  albumSelectedIds.splice(target, 0, item);
  renderAlbumSelector();
}

function renderAlbumSelector() {
  const box = $('#albumSongSelector');
  box.replaceChildren();
  box.classList.add('ordered-selector');

  if (!songs.length) {
    const empty = document.createElement('span');
    empty.className = 'selector-empty';
    empty.textContent = 'Сначала добавьте хотя бы одну песню.';
    box.appendChild(empty);
    return;
  }

  const selectedSet = new Set(albumSelectedIds.map(Number));
  const ordered = [
    ...albumSelectedIds.map(songById).filter(Boolean),
    ...songs.filter((song) => !selectedSet.has(Number(song.id)))
  ];

  ordered.forEach((song) => {
    const selected = selectedSet.has(Number(song.id));
    const row = document.createElement('div');
    row.className = 'selector-item' + (selected ? ' selected' : '');

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = selected;
    checkbox.addEventListener('change', () => {
      const id = Number(song.id);
      if (checkbox.checked) {
        if (!albumSelectedIds.includes(id)) albumSelectedIds.push(id);
      } else {
        albumSelectedIds = albumSelectedIds.filter((value) => value !== id);
      }
      renderAlbumSelector();
    });

    const copy = document.createElement('div');
    copy.className = 'selector-copy';
    const title = document.createElement('strong');
    title.textContent = song.title;
    const origin = document.createElement('small');
    if (selected && editingAlbumId && Number(song.album_id) === editingAlbumId) {
      origin.textContent = 'в этом альбоме';
    } else if (song.album_id) {
      origin.textContent = 'сейчас: ' + albumTitleById(song.album_id);
    } else {
      origin.textContent = 'без альбома';
    }
    copy.append(title, origin);

    row.append(checkbox, copy);

    if (selected) {
      const order = document.createElement('div');
      order.className = 'selector-order';
      const index = albumSelectedIds.indexOf(Number(song.id));
      const up = createIconButton('↑', 'Выше', 'selector-move');
      up.disabled = index === 0;
      up.addEventListener('click', () => moveSelectedSong(song.id, -1));
      const down = createIconButton('↓', 'Ниже', 'selector-move');
      down.disabled = index === albumSelectedIds.length - 1;
      down.addEventListener('click', () => moveSelectedSong(song.id, 1));
      order.append(up, down);
      row.appendChild(order);
    }

    box.appendChild(row);
  });
}

function refreshSongAlbumSelect(selected = null) {
  const select = $('#songAlbum');
  const current = selected !== null ? String(selected ?? '') : select.value;
  select.replaceChildren();

  const none = document.createElement('option');
  none.value = '';
  none.textContent = 'Без альбома';
  select.appendChild(none);

  albums.forEach((album) => {
    const option = document.createElement('option');
    option.value = String(album.id);
    option.textContent = album.title;
    select.appendChild(option);
  });

  if ([...select.options].some((option) => option.value === String(current))) {
    select.value = String(current);
  }
}

function resetSongForm() {
  editingSongId = null;
  $('#songForm').reset();
  $('#songYear').value = new Date().getFullYear();
  $('#songKicker').textContent = 'Новая композиция';
  $('#songModalTitle').textContent = 'Добавить песню';
  $('#saveSongButton').textContent = 'Добавить песню';
  $('#songCoverPreview').style.backgroundImage = '';
  $('#songCoverPreview').textContent = '＋';
  $('#songCoverName').textContent = 'Квадратное изображение · JPG, PNG, WEBP';
  $('#songAudioName').textContent = 'MP3, WAV, FLAC, AAC, M4A';
  $('#songAiPerformer').checked = false;
  $('#songAudio').required = true;
  refreshSongAlbumSelect();
}

function openSongEditor(id = null, presetAlbumId = null) {
  resetSongForm();

  if (id !== null) {
    const song = songById(id);
    if (!song) return;

    editingSongId = Number(song.id);
    $('#songAudio').required = false;
    $('#songKicker').textContent = 'Редактирование';
    $('#songModalTitle').textContent = 'Редактировать песню';
    $('#saveSongButton').textContent = 'Сохранить';
    $('#songTitle').value = song.title || '';
    $('#songYear').value = song.release_year || '';
    $('#songGenre').value = song.genre || '';
    $('#songLyricsAuthor').value = song.lyrics_author || '';
    $('#songMusicAuthor').value = song.music_author || '';
    $('#songAiPerformer').checked = Number(song.is_ai) === 1;
    $('#songLyrics').value = song.lyrics || '';
    refreshSongAlbumSelect(song.album_id ?? '');

    if (song.cover) {
      $('#songCoverPreview').style.backgroundImage = 'url("' + mediaUrl(song.cover) + '")';
      $('#songCoverPreview').textContent = '';
      $('#songCoverName').textContent = 'Сейчас: ' + fileName(song.cover);
    }
    if (song.file_path) {
      $('#songAudioName').textContent = 'Сейчас: ' + fileName(song.file_path);
    }
  } else if (presetAlbumId !== null) {
    refreshSongAlbumSelect(presetAlbumId);
  }

  openModal('songModal');
}

$('#albumCover').addEventListener('change', () => {
  const file = $('#albumCover').files?.[0];
  if (!file) return;
  const url = URL.createObjectURL(file);
  $('#albumCoverPreview').style.backgroundImage = 'url("' + url + '")';
  $('#albumCoverPreview').textContent = '';
  $('#albumCoverName').textContent = file.name;
});

$('#songCover').addEventListener('change', () => {
  const file = $('#songCover').files?.[0];
  if (!file) return;
  const url = URL.createObjectURL(file);
  $('#songCoverPreview').style.backgroundImage = 'url("' + url + '")';
  $('#songCoverPreview').textContent = '';
  $('#songCoverName').textContent = file.name;
});

$('#songAudio').addEventListener('change', () => {
  const file = $('#songAudio').files?.[0];
  $('#songAudioName').textContent = file ? file.name : 'MP3, WAV, FLAC, AAC, M4A';
});

$('#openAlbum').addEventListener('click', () => {
  if (!isOwner()) return;
  openAlbumEditor();
});

$('#openSong').addEventListener('click', () => {
  if (!isOwner()) return;
  returnToAlbumId = null;
  openSongEditor();
});

$('#openSongFromAlbum').addEventListener('click', () => {
  if (!isOwner()) return;
  if (!editingAlbumId) {
    toast('Сначала сохраните новый альбом, затем добавьте в него песню');
    return;
  }
  returnToAlbumId = editingAlbumId;
  closeModal('albumModal');
  openSongEditor(null, editingAlbumId);
});

async function saveAlbumAssignments(albumId) {
  const selectedSet = new Set(albumSelectedIds.map(Number));

  for (const song of songs) {
    const songId = Number(song.id);
    const currentAlbum = song.album_id === null ? null : Number(song.album_id);

    if (selectedSet.has(songId) && currentAlbum !== Number(albumId)) {
      const result = await api('assign_song', { song_id: songId, album_id: albumId });
      if (!result.success) throw new Error('Не удалось добавить песню в альбом');
    } else if (!selectedSet.has(songId) && currentAlbum === Number(albumId)) {
      const result = await api('remove_song_from_album', { song_id: songId });
      if (!result.success) throw new Error('Не удалось убрать песню из альбома');
    }
  }

  if (albumSelectedIds.length) {
    const form = new FormData();
    form.append('action', 'update_song_order');
    albumSelectedIds.forEach((id) => form.append('order[]', String(id)));
    const result = await apiForm(form);
    if (!result.success) throw new Error('Не удалось сохранить порядок песен');
  }
}

$('#albumForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!isOwner()) return;

  const title = $('#albumTitle').value.trim();
  if (!title) return;

  const button = $('#saveAlbumButton');
  button.disabled = true;

  try {
    const form = new FormData();
    form.append('action', 'save_album');
    form.append('mode', editingAlbumId ? 'edit' : 'add');
    if (editingAlbumId) form.append('id', String(editingAlbumId));
    form.append('title', title);
    form.append('release_year', $('#albumYear').value.trim());
    form.append('comment', $('#albumDescription').value.trim());
    form.append('yandex_link', $('#albumYandex').value.trim());
    if ($('#albumCover').files?.[0]) form.append('cover', $('#albumCover').files[0]);

    const result = await apiForm(form);
    if (!result.success) throw new Error(result.message || 'Не удалось сохранить альбом');

    const albumId = Number(result.album_id || editingAlbumId);
    if (!albumId) throw new Error('Сервер не вернул ID альбома');

    await saveAlbumAssignments(albumId);
    closeModal('albumModal');
    await loadMusicData();
    toast(editingAlbumId ? 'Альбом обновлён' : 'Альбом добавлен');
  } catch (error) {
    toast(error.message || 'Ошибка сохранения альбома');
  } finally {
    button.disabled = false;
  }
});

$('#songForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!isOwner()) return;

  const title = $('#songTitle').value.trim();
  if (!title) return;

  const button = $('#saveSongButton');
  button.disabled = true;

  try {
    const form = new FormData();
    form.append('action', 'save_song');
    form.append('mode', editingSongId ? 'edit' : 'add');
    if (editingSongId) form.append('id', String(editingSongId));
    form.append('title', title);
    form.append('release_year', $('#songYear').value.trim());
    form.append('genre', $('#songGenre').value.trim());
    form.append('album_id', $('#songAlbum').value);
    form.append('lyrics_author', $('#songLyricsAuthor').value.trim());
    form.append('music_author', $('#songMusicAuthor').value.trim());
    form.append('is_ai', $('#songAiPerformer').checked ? '1' : '0');
    form.append('lyrics', $('#songLyrics').value.trim());

    if ($('#songCover').files?.[0]) form.append('cover', $('#songCover').files[0]);
    if ($('#songAudio').files?.[0]) form.append('audio_file', $('#songAudio').files[0]);

    const result = await apiForm(form);
    if (!result.success) throw new Error(result.message || 'Не удалось сохранить песню');

    const reopen = returnToAlbumId;
    returnToAlbumId = null;
    closeModal('songModal');
    await loadMusicData();
    toast(editingSongId ? 'Песня обновлена' : 'Песня добавлена');

    if (reopen) openAlbumEditor(reopen);
  } catch (error) {
    toast(error.message || 'Ошибка сохранения песни');
  } finally {
    button.disabled = false;
  }
});

function armDelete(key, callback, message) {
  if (!armedDeletes.has(key)) {
    armedDeletes.set(key, setTimeout(() => armedDeletes.delete(key), 3500));
    toast(message);
    return;
  }
  clearTimeout(armedDeletes.get(key));
  armedDeletes.delete(key);
  callback();
}

async function deleteSong(id) {
  const song = songById(id);
  if (!song) return;
  armDelete('song:' + id, async () => {
    try {
      const result = await api('delete_song', { id });
      if (!result.success) throw new Error();
      if (Number(playQueue[currentIndex]) === Number(id)) closePlayer();
      await loadMusicData();
      toast('Песня удалена');
    } catch {
      toast('Не удалось удалить песню');
    }
  }, 'Нажмите удалить ещё раз, чтобы удалить «' + song.title + '»');
}

async function deleteAlbum(id) {
  const album = albumById(id);
  if (!album) return;
  armDelete('album:' + id, async () => {
    try {
      const result = await api('delete_album', { id });
      if (!result.success) throw new Error();
      await loadMusicData();
      toast('Альбом удалён. Песни сохранены в архиве');
    } catch {
      toast('Не удалось удалить альбом');
    }
  }, 'Нажмите удалить ещё раз, чтобы удалить альбом «' + album.title + '»');
}

function openSongDetails(id) {
  const song = songById(id);
  if (!song) return;

  const cover = songCover(song);
  $('#songDetailCover').textContent = cover ? '' : '♪';
  $('#songDetailCover').style.backgroundImage = cover ? 'url("' + mediaUrl(cover) + '")' : '';
  $('#songDetailTitle').textContent = song.title || 'Без названия';
  $('#songDetailAlbum').textContent = song.album_title || albumTitleById(song.album_id) || 'Без альбома';
  $('#songDetailLyricsAuthor').textContent = song.lyrics_author || '—';
  $('#songDetailMusicAuthor').textContent = song.music_author || '—';
  $('#songDetailGenre').textContent = song.genre || '—';
  $('#songDetailYear').textContent = song.release_year || '—';
  $('#songDetailLyrics').textContent = (song.lyrics || '').trim() || 'Текст песни пока не добавлен.';

  const badges = $('#songDetailBadges');
  badges.replaceChildren();

  if (song.album_id) {
    const albumBadge = document.createElement('span');
    albumBadge.textContent = 'Альбом · ' + albumTitleById(song.album_id);
    badges.appendChild(albumBadge);
  }

  if (Number(song.is_ai) === 1) {
    const ai = document.createElement('span');
    ai.className = 'ai';
    ai.textContent = 'ИИ';
    badges.appendChild(ai);
  }

  if (song.file_path) {
    const file = document.createElement('span');
    file.textContent = fileName(song.file_path);
    badges.appendChild(file);
  }

  $('#songDetailsPanel').classList.add('show');
  $('#songDetailsPanel').setAttribute('aria-hidden', 'false');
  $('#songDetailsScrim').classList.add('show');
  $('#songDetailsScrim').setAttribute('aria-hidden', 'false');
}

function closeSongDetails() {
  $('#songDetailsPanel').classList.remove('show');
  $('#songDetailsPanel').setAttribute('aria-hidden', 'true');
  $('#songDetailsScrim').classList.remove('show');
  $('#songDetailsScrim').setAttribute('aria-hidden', 'true');
}

$('#songDetailsClose').addEventListener('click', closeSongDetails);
$('#songDetailsScrim').addEventListener('click', closeSongDetails);
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && $('#songDetailsPanel').classList.contains('show')) closeSongDetails();
});

function currentSongId() {
  return currentIndex >= 0 && currentIndex < playQueue.length ? Number(playQueue[currentIndex]) : null;
}

function updateSongPlaybackButtons() {
  const activeId = currentSongId();
  const activelyPlaying = activeId !== null && Boolean(audio.src) && !audio.paused;

  document.querySelectorAll('[data-play-song]').forEach((button) => {
    const same = Number(button.dataset.playSong) === activeId;
    const pause = same && activelyPlaying;
    button.textContent = pause ? 'Ⅱ' : '▶';
    button.title = pause ? 'Пауза' : 'Воспроизвести';
    button.setAttribute('aria-label', pause ? 'Пауза' : 'Воспроизвести');
    button.classList.toggle('is-playing', pause);
  });

  document.querySelectorAll('.song[data-song-id]').forEach((row) => {
    row.classList.toggle('is-playing', Number(row.dataset.songId) === activeId);
  });
}

document.addEventListener('click', (event) => {
  const editSong = event.target.closest('[data-edit-song]')?.dataset.editSong;
  if (editSong && isOwner()) {
    openSongEditor(Number(editSong));
    return;
  }

  const editAlbum = event.target.closest('[data-edit-album]')?.dataset.editAlbum;
  if (editAlbum && isOwner()) {
    openAlbumEditor(Number(editAlbum));
    return;
  }

  const deleteSongId = event.target.closest('[data-delete-song]')?.dataset.deleteSong;
  if (deleteSongId && isOwner()) {
    deleteSong(Number(deleteSongId));
    return;
  }

  const deleteAlbumId = event.target.closest('[data-delete-album]')?.dataset.deleteAlbum;
  if (deleteAlbumId && isOwner()) {
    deleteAlbum(Number(deleteAlbumId));
    return;
  }

  const playSong = event.target.closest('[data-play-song]')?.dataset.playSong;
  if (playSong) {
    if (!auth.logged_in) {
      toast('Для прослушивания войдите в аккаунт');
      return;
    }

    const requestedId = Number(playSong);
    if (currentSongId() === requestedId && audio.src) {
      if (audio.paused) audio.play().catch(() => {});
      else audio.pause();
    } else {
      playSongById(requestedId, '', songs.map((song) => Number(song.id)));
    }
    return;
  }

  const playAlbum = event.target.closest('[data-play-album]')?.dataset.playAlbum;
  if (playAlbum) {
    if (!auth.logged_in) {
      toast('Для прослушивания войдите в аккаунт');
      return;
    }
    const album = albumById(playAlbum);
    const queue = sortedAlbumSongs(playAlbum).map((song) => Number(song.id));
    if (!queue.length) {
      toast('В альбоме пока нет песен');
      return;
    }
    playSongById(queue[0], album?.title || '', queue);
    return;
  }

  const download = event.target.closest('[data-download-song]')?.dataset.downloadSong;
  if (download && isOwner()) {
    const song = songById(download);
    if (!song?.file_path) {
      toast('Аудиофайл не найден');
      return;
    }
    const link = document.createElement('a');
    link.href = mediaUrl(song.file_path);
    link.download = fileName(song.file_path) || song.title;
    document.body.appendChild(link);
    link.click();
    link.remove();
    return;
  }

  const songRow = event.target.closest('.song[data-song-id]');
  if (songRow && !event.target.closest('button,a')) {
    openSongDetails(Number(songRow.dataset.songId));
  }
});

document.addEventListener('keydown', (event) => {
  const row = event.target.closest?.('.song[data-song-id]');
  if (!row || (event.key !== 'Enter' && event.key !== ' ')) return;
  event.preventDefault();
  openSongDetails(Number(row.dataset.songId));
});

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const whole = Math.floor(seconds);
  const minutes = Math.floor(whole / 60);
  const rest = String(whole % 60).padStart(2, '0');
  return minutes + ':' + rest;
}

function setPlayerPosition(current, total) {
  const duration = Math.max(1, total || 0);
  $('#playerProgress').style.width = Math.max(0, Math.min(100, current / duration * 100)) + '%';
  $('#playerTime').textContent = formatTime(current) + ' / ' + formatTime(total || 0);
}

function updateModeButtons() {
  $('#playerRepeat').classList.toggle('active', repeatEnabled);
  $('#playerRepeat').setAttribute('aria-pressed', String(repeatEnabled));
  $('#playerShuffle').classList.toggle('active', shuffleEnabled);
  $('#playerShuffle').setAttribute('aria-pressed', String(shuffleEnabled));
}

function shuffleQueue(queue, currentId) {
  const rest = queue.filter((id) => Number(id) !== Number(currentId));
  for (let i = rest.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [rest[i], rest[j]] = [rest[j], rest[i]];
  }
  return [Number(currentId), ...rest];
}

function configureQueue(queueIds, currentId, label = '') {
  originalQueue = [...new Set(queueIds.map(Number))];
  playQueue = shuffleEnabled ? shuffleQueue(originalQueue, currentId) : [...originalQueue];
  currentIndex = Math.max(0, playQueue.findIndex((id) => Number(id) === Number(currentId)));
  $('#player').dataset.queueLabel = label;
}

function loadCurrentAudio() {
  if (currentIndex < 0 || currentIndex >= playQueue.length) return;
  const song = songById(playQueue[currentIndex]);
  if (!song?.file_path) {
    toast('У песни нет аудиофайла');
    return;
  }

  const album = albumById(song.album_id);
  const cover = songCover(song);

  $('#playerTitle').textContent = song.title;
  $('#playerSubtitle').textContent =
    $('#player').dataset.queueLabel || album?.title || song.music_author || 'Онлайн-воспроизведение';
  $('#playerCover').textContent = cover ? '' : '♪';
  $('#playerCover').style.backgroundImage = cover ? 'url("' + mediaUrl(cover) + '")' : '';

  audio.src = mediaUrl(song.file_path);
  $('#player').classList.add('show');
  $('#player').setAttribute('aria-hidden', 'false');
  $('#playerToggle').textContent = 'Ⅱ';
  $('#playerToggle').setAttribute('aria-label', 'Пауза');
  updateSongPlaybackButtons();
  audio.play().catch(() => {
    $('#playerToggle').textContent = '▶';
    $('#playerToggle').setAttribute('aria-label', 'Воспроизвести');
    updateSongPlaybackButtons();
  });
}

function playSongById(id, label = '', queueIds = null) {
  const queue = Array.isArray(queueIds) && queueIds.length ? queueIds : songs.map((song) => Number(song.id));
  configureQueue(queue, id, label);
  loadCurrentAudio();
}

function nextTrack() {
  if (!playQueue.length) return;
  currentIndex = (currentIndex + 1) % playQueue.length;
  loadCurrentAudio();
}

function previousTrack() {
  if (!playQueue.length) return;
  currentIndex = (currentIndex - 1 + playQueue.length) % playQueue.length;
  loadCurrentAudio();
}

function closePlayer() {
  audio.pause();
  audio.removeAttribute('src');
  audio.load();
  originalQueue = [];
  playQueue = [];
  currentIndex = -1;
  $('#player').classList.remove('show');
  $('#player').setAttribute('aria-hidden', 'true');
  setPlayerPosition(0, 0);
  updateSongPlaybackButtons();
}

$('#playerToggle').addEventListener('click', () => {
  if (!audio.src) return;
  if (audio.paused) {
    audio.play().catch(() => {});
    $('#playerToggle').textContent = 'Ⅱ';
    $('#playerToggle').setAttribute('aria-label', 'Пауза');
  } else {
    audio.pause();
    $('#playerToggle').textContent = '▶';
    $('#playerToggle').setAttribute('aria-label', 'Воспроизвести');
  }
});

$('#playerPrevious').addEventListener('click', previousTrack);
$('#playerNext').addEventListener('click', nextTrack);

$('#playerRepeat').addEventListener('click', () => {
  repeatEnabled = !repeatEnabled;
  updateModeButtons();
});

$('#playerShuffle').addEventListener('click', () => {
  if (!originalQueue.length) return;
  const currentId = playQueue[currentIndex];
  shuffleEnabled = !shuffleEnabled;
  playQueue = shuffleEnabled ? shuffleQueue(originalQueue, currentId) : [...originalQueue];
  currentIndex = Math.max(0, playQueue.findIndex((id) => Number(id) === Number(currentId)));
  updateModeButtons();
});

$('#playerProgressTrack').addEventListener('click', (event) => {
  if (!Number.isFinite(audio.duration)) return;
  const rect = event.currentTarget.getBoundingClientRect();
  const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
  audio.currentTime = audio.duration * ratio;
});

$('#playerClose').addEventListener('click', closePlayer);

audio.addEventListener('loadedmetadata', () => setPlayerPosition(audio.currentTime, audio.duration));
audio.addEventListener('timeupdate', () => setPlayerPosition(audio.currentTime, audio.duration));
audio.addEventListener('play', () => {
  $('#playerToggle').textContent = 'Ⅱ';
  $('#playerToggle').setAttribute('aria-label', 'Пауза');
  updateSongPlaybackButtons();
});
audio.addEventListener('pause', () => {
  if (audio.ended) return;
  $('#playerToggle').textContent = '▶';
  $('#playerToggle').setAttribute('aria-label', 'Воспроизвести');
  updateSongPlaybackButtons();
});
audio.addEventListener('ended', () => {
  if (repeatEnabled) {
    audio.currentTime = 0;
    audio.play().catch(() => {});
  } else {
    nextTrack();
  }
});

updateModeButtons();

async function init() {
  try {
    auth = await api('check_auth');
  } catch {
    auth = { logged_in: false, role: 'guest' };
  }

  document.body.classList.toggle('is-owner', isOwner());

  try {
    await loadMusicData();
  } catch {
    albums = [];
    songs = [];
    render();
    toast('Не удалось загрузить музыкальный архив');
  }

  if (isOwner()) {
    const addMode = new URLSearchParams(location.search).get('add');
    if (addMode === 'song') openSongEditor();
    if (addMode === 'album') openAlbumEditor();
  }
}

init();
