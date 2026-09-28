const $ = (selector) => document.querySelector(selector);

let auth = { logged_in: false, role: 'guest' };
let posts = [];
let statusFilter = 'all';
let searchQuery = '';
let editingPostId = null;
let currentViewerPostId = null;
let coverDeleted = false;
let draggedBlock = null;
let dropMarker = null;

function isOwner() {
  return auth.logged_in && auth.role === 'admin';
}

function mediaUrl(path) {
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;
  return new URL(path.replace(/^\//, ''), location.origin + '/').href;
}

function fileName(path) {
  if (!path) return '';
  try { return decodeURIComponent(path.split('/').pop()); }
  catch { return path.split('/').pop(); }
}

function isVideoPath(path) {
  return /\.(mp4|mov|webm|m4v)(?:$|[?#])/i.test(path || '');
}

function uid() {
  return crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2);
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

function toast(message) {
  const node = $('#toast');
  node.textContent = message;
  node.classList.add('show');
  clearTimeout(window.__blogToast);
  window.__blogToast = setTimeout(() => node.classList.remove('show'), 2200);
}

function formatDate(value) {
  if (!value) return 'Без даты';
  const parsed = new Date(String(value).replace(' ', 'T'));
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }).format(parsed);
}

function statusName(status) {
  return status === 'draft' ? 'Черновик' : 'Публикация';
}

function parseBlocks(content) {
  try {
    const value = JSON.parse(content || '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return content ? [{ type: 'text', value: content }] : [];
  }
}

function postText(post) {
  const pieces = [post.title || '', post.snippet || ''];
  parseBlocks(post.content).forEach((block) => {
    if (block.type === 'text') pieces.push(block.value || '');
  });
  return pieces.join(' ').toLowerCase();
}

function visiblePosts() {
  const query = searchQuery.toLowerCase();
  return posts.filter((post) => {
    const statusOk = statusFilter === 'all' || post.status === statusFilter;
    const searchOk = !query || postText(post).includes(query);
    return statusOk && searchOk;
  });
}

function createVideo(src, className = '') {
  const video = document.createElement('video');
  video.className = className;
  video.src = mediaUrl(src);
  video.muted = true;
  video.loop = true;
  video.playsInline = true;
  video.autoplay = true;
  video.preload = 'metadata';
  video.setAttribute('aria-hidden', 'true');
  video.play().catch(() => {});
  return video;
}

function renderCover(container, path, mode = 'featured') {
  container.querySelectorAll('.cover-media').forEach((node) => node.remove());
  container.style.backgroundImage = '';
  container.classList.remove('has-video');

  if (!path) return;

  if (isVideoPath(path)) {
    container.classList.add('has-video');
    container.prepend(createVideo(path, 'cover-media'));
    return;
  }

  const overlay = mode === 'viewer'
    ? 'linear-gradient(180deg,rgba(15,23,32,.03),rgba(15,23,32,.48))'
    : 'linear-gradient(180deg,rgba(14,22,32,.04),rgba(14,22,32,.58))';
  container.style.backgroundImage = overlay + ',url("' + mediaUrl(path) + '")';
}

function renderFilters() {
  const host = $('#statusFilters');
  host.replaceChildren();
  const filters = isOwner()
    ? [['all', 'Все'], ['published', 'Опубликованные'], ['draft', 'Черновики']]
    : [['all', 'Все публикации']];

  filters.forEach(([value, label]) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'filter' + (statusFilter === value ? ' active' : '');
    button.textContent = label;
    button.addEventListener('click', () => {
      statusFilter = value;
      render();
    });
    host.appendChild(button);
  });
}

function render() {
  renderFilters();
  const items = visiblePosts();

  const count = items.length;
  const countLabel = count % 10 === 1 && count % 100 !== 11
    ? 'публикация'
    : count % 10 >= 2 && count % 10 <= 4 && (count % 100 < 12 || count % 100 > 14)
      ? 'публикации'
      : 'публикаций';
  $('#postCount').textContent = count + ' ' + countLabel;
  $('#feedEmpty').textContent = 'Публикаций пока нет.';
  $('#feedEmpty').classList.toggle('show', count === 0);

  const featured = items[0] || null;
  $('#readFeatured').disabled = !featured;
  $('#editFeatured').disabled = !featured;

  if (featured) {
    $('#featuredTag').textContent = statusName(featured.status);
    $('#featuredDate').textContent = formatDate(featured.created_at);
    $('#featuredTitle').textContent = featured.title || 'Без заголовка';
    $('#featuredExcerpt').textContent = featured.snippet || '';
    renderCover($('#featuredCover'), featured.cover, 'featured');
  } else {
    $('#featuredTag').textContent = '—';
    $('#featuredDate').textContent = '—';
    $('#featuredTitle').textContent = searchQuery ? 'Ничего не найдено' : 'Публикаций пока нет';
    $('#featuredExcerpt').textContent = searchQuery
      ? 'Попробуйте изменить запрос.'
      : 'Когда появится первая публикация, она будет показана здесь.';
    renderCover($('#featuredCover'), '', 'featured');
  }

  const list = $('#postList');
  list.replaceChildren();

  items.forEach((post) => {
    const item = document.createElement('article');
    item.className = 'post';

    const time = document.createElement('time');
    time.textContent = formatDate(post.created_at);
    const title = document.createElement('strong');
    title.textContent = post.title || 'Без заголовка';
    const excerpt = document.createElement('p');
    excerpt.textContent = post.snippet || '';
    const topic = document.createElement('span');
    topic.className = 'topic';
    topic.textContent = statusName(post.status);

    item.append(time, title, excerpt, topic);

    if (isOwner()) {
      const edit = document.createElement('button');
      edit.type = 'button';
      edit.className = 'post-edit';
      edit.textContent = '✎';
      edit.title = 'Редактировать';
      edit.addEventListener('click', (event) => {
        event.stopPropagation();
        openEditor(Number(post.id));
      });
      item.appendChild(edit);
    }

    item.addEventListener('click', () => openViewer(Number(post.id)));
    list.appendChild(item);
  });
}

async function loadPosts() {
  const data = await api('get_blogs');
  if (!data.success) throw new Error('Не удалось загрузить блог');
  posts = Array.isArray(data.blogs) ? data.blogs : [];
  render();
}

function openOverlay(id) {
  $('#' + id).classList.add('show');
  $('#' + id).setAttribute('aria-hidden', 'false');
}

function closeOverlay(id) {
  $('#' + id).classList.remove('show');
  $('#' + id).setAttribute('aria-hidden', 'true');
  if (id === 'viewerOverlay') {
    $('#viewerOverlay').querySelectorAll('video').forEach((video) => video.pause());
  }
}

document.querySelectorAll('[data-close]').forEach((button) => {
  button.addEventListener('click', () => closeOverlay(button.dataset.close));
});

document.querySelectorAll('.overlay').forEach((overlay) => {
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) closeOverlay(overlay.id);
  });
});

$('#blogSearch').addEventListener('input', (event) => {
  searchQuery = event.target.value.trim();
  render();
});

async function openViewer(id) {
  try {
    const data = await api('get_blog_details', { blog_id: id });
    if (!data.success || !data.blog) throw new Error();

    const post = data.blog;
    currentViewerPostId = Number(post.id);
    $('#viewerTitleMini').textContent = post.title || 'Публикация';
    $('#viewerTitle').textContent = post.title || 'Публикация';
    $('#viewerMeta').textContent = statusName(post.status) + ' · ' + formatDate(post.created_at);
    renderCover($('#viewerHero'), post.cover, 'viewer');

    const host = $('#viewerBlocks');
    host.replaceChildren();

    parseBlocks(post.content).forEach((block) => {
      const section = document.createElement('section');
      section.className = 'content-block';

      if (block.type === 'text') {
        section.classList.add('text-block');
        section.textContent = block.value || '';
      } else if (block.type === 'image' || block.type === 'photo') {
        const box = document.createElement('div');
        box.className = 'image-block';

        if (block.value) {
          const image = document.createElement('img');
          image.src = mediaUrl(block.value);
          image.alt = 'Изображение публикации';
          image.loading = 'lazy';
          image.addEventListener('click', () => openMediaLightbox('image', block.value));
          box.appendChild(image);

          const expand = document.createElement('button');
          expand.type = 'button';
          expand.className = 'media-expand';
          expand.textContent = '⛶';
          expand.title = 'Открыть на весь экран';
          expand.setAttribute('aria-label', 'Открыть изображение на весь экран');
          expand.addEventListener('click', () => openMediaLightbox('image', block.value));
          box.appendChild(expand);
        }

        section.appendChild(box);
      } else if (block.type === 'video') {
        const box = document.createElement('div');
        box.className = 'video-block';

        if (block.value) {
          const video = document.createElement('video');
          video.src = mediaUrl(block.value);
          video.controls = true;
          video.preload = 'metadata';
          video.playsInline = true;
          fitVideoToSource(video, box);
          box.appendChild(video);

          const expand = document.createElement('button');
          expand.type = 'button';
          expand.className = 'media-expand';
          expand.textContent = '⛶';
          expand.title = 'Открыть на весь экран';
          expand.setAttribute('aria-label', 'Открыть видео на весь экран');
          expand.addEventListener('click', () => openMediaLightbox('video', block.value));
          box.appendChild(expand);
        } else {
          const placeholder = document.createElement('div');
          placeholder.className = 'video-placeholder';
          placeholder.textContent = '▶';
          box.appendChild(placeholder);
        }

        section.appendChild(box);
      }

      host.appendChild(section);
    });

    $('#viewerScroll').scrollTop = 0;
    openOverlay('viewerOverlay');
  } catch {
    toast('Не удалось открыть публикацию');
  }
}

function fitVideoToSource(video, container = null) {
  const apply = () => {
    if (!video.videoWidth || !video.videoHeight) return;
    const ratio = video.videoWidth + ' / ' + video.videoHeight;
    video.style.aspectRatio = ratio;
    if (container) container.style.aspectRatio = ratio;
  };
  video.addEventListener('loadedmetadata', apply, { once: true });
  if (video.readyState >= 1) apply();
}

function openMediaLightbox(type, path) {
  if (!path) return;

  const stage = $('#mediaLightboxStage');
  stage.replaceChildren();

  if (type === 'video') {
    $('#viewerOverlay').querySelectorAll('video').forEach((video) => video.pause());

    const video = document.createElement('video');
    video.src = mediaUrl(path);
    video.controls = true;
    video.autoplay = true;
    video.playsInline = true;
    video.preload = 'auto';
    fitVideoToSource(video);
    stage.appendChild(video);
    video.play().catch(() => {});
  } else {
    const image = document.createElement('img');
    image.src = mediaUrl(path);
    image.alt = 'Изображение публикации';
    stage.appendChild(image);
  }

  $('#mediaLightbox').classList.add('show');
  $('#mediaLightbox').setAttribute('aria-hidden', 'false');
  document.body.classList.add('media-lightbox-open');
}

function closeMediaLightbox() {
  const lightbox = $('#mediaLightbox');
  lightbox.querySelectorAll('video').forEach((video) => video.pause());
  $('#mediaLightboxStage').replaceChildren();
  lightbox.classList.remove('show');
  lightbox.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('media-lightbox-open');
}

$('#mediaLightboxClose').addEventListener('click', closeMediaLightbox);
$('#mediaLightbox').addEventListener('click', (event) => {
  if (event.target === $('#mediaLightbox') || event.target === $('#mediaLightboxStage')) {
    closeMediaLightbox();
  }
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && $('#mediaLightbox').classList.contains('show')) {
    event.preventDefault();
    closeMediaLightbox();
  }
});

$('#readFeatured').addEventListener('click', () => {
  const post = visiblePosts()[0];
  if (post) openViewer(Number(post.id));
});

$('#sharePost').addEventListener('click', async () => {
  const post = posts.find((item) => Number(item.id) === currentViewerPostId);
  if (!post) return;
  try {
    if (navigator.share) {
      await navigator.share({ title: post.title, text: post.snippet || '', url: location.href });
    } else {
      await navigator.clipboard.writeText(location.href);
      toast('Адрес страницы скопирован');
    }
  } catch {}
});

function resetCoverPreview() {
  $('#postCoverPreview').style.backgroundImage = '';
  $('#postCoverPreview').textContent = '＋';
  $('#postCoverName').textContent = 'JPG, PNG, WEBP, MOV, MP4, WEBM';
  $('#removePostCover').hidden = true;
  $('#removePostCover').textContent = 'Убрать обложку';
  coverDeleted = false;
}

function showExistingCover(path) {
  if (!path) {
    resetCoverPreview();
    return;
  }

  $('#removePostCover').hidden = false;
  $('#postCoverName').textContent = 'Сейчас: ' + fileName(path);

  if (isVideoPath(path)) {
    $('#postCoverPreview').style.backgroundImage = '';
    $('#postCoverPreview').textContent = '▶';
  } else {
    $('#postCoverPreview').style.backgroundImage = 'url("' + mediaUrl(path) + '")';
    $('#postCoverPreview').textContent = '';
  }
}

function resetEditor() {
  editingPostId = null;
  coverDeleted = false;
  $('#postForm').reset();
  $('#postStatus').value = 'published';
  $('#editorKicker').textContent = 'Новая публикация';
  $('#editorTitle').textContent = 'Добавить пост';
  $('#savePostButton').textContent = 'Сохранить';
  $('#deletePostButton').hidden = true;
  resetCoverPreview();
  $('#blocksList').replaceChildren();
  appendBlock({ type: 'text', value: '' });
}

function openEditor(id = null) {
  if (!isOwner()) return;

  resetEditor();

  if (id !== null) {
    const post = posts.find((item) => Number(item.id) === Number(id));
    if (!post) return;

    editingPostId = Number(post.id);
    $('#editorKicker').textContent = post.status === 'draft' ? 'Черновик' : 'Редактирование';
    $('#editorTitle').textContent = 'Редактировать публикацию';
    $('#postTitle').value = post.title || '';
    $('#postStatus').value = post.status === 'draft' ? 'draft' : 'published';
    $('#deletePostButton').hidden = false;
    showExistingCover(post.cover);

    const blocks = parseBlocks(post.content);
    $('#blocksList').replaceChildren();
    (blocks.length ? blocks : [{ type: 'text', value: '' }]).forEach(appendBlock);
  }

  openOverlay('editorOverlay');
}

$('#openPostEditor').addEventListener('click', () => openEditor());
$('#editFeatured').addEventListener('click', () => {
  const post = visiblePosts()[0];
  if (post) openEditor(Number(post.id));
});

$('#postCover').addEventListener('change', () => {
  const file = $('#postCover').files?.[0];
  if (!file) return;

  coverDeleted = false;
  $('#removePostCover').hidden = false;
  $('#removePostCover').textContent = 'Убрать обложку';
  $('#postCoverName').textContent = file.name;

  const preview = URL.createObjectURL(file);
  if (file.type.startsWith('video/') || isVideoPath(file.name)) {
    $('#postCoverPreview').style.backgroundImage = '';
    $('#postCoverPreview').textContent = '▶';
  } else {
    $('#postCoverPreview').style.backgroundImage = 'url("' + preview + '")';
    $('#postCoverPreview').textContent = '';
  }
});

$('#removePostCover').addEventListener('click', () => {
  const existing = posts.find((item) => Number(item.id) === editingPostId);

  if (coverDeleted) {
    coverDeleted = false;
    $('#removePostCover').textContent = 'Убрать обложку';
    if (existing?.cover) showExistingCover(existing.cover);
    return;
  }

  coverDeleted = true;
  $('#postCover').value = '';
  $('#postCoverPreview').style.backgroundImage = '';
  $('#postCoverPreview').textContent = '×';
  $('#postCoverName').textContent = 'Обложка будет удалена';
  $('#removePostCover').textContent = 'Вернуть обложку';
});

function normalizeBlockType(type) {
  return type === 'photo' ? 'image' : type;
}

function blockMarkup(block) {
  const type = normalizeBlockType(block.type);
  const id = block.id || uid();

  if (type === 'text') {
    return `<article class="block" draggable="true" data-block-id="${id}" data-type="text">
      <div class="drag-handle">⋮⋮</div>
      <div class="block-main"><strong>Текстовый блок</strong><textarea class="block-text" placeholder="Введите текст"></textarea></div>
      <div class="block-actions"><button class="remove" type="button" title="Удалить блок">×</button></div>
    </article>`;
  }

  const image = type === 'image';
  const label = image ? 'Фотоблок' : 'Видеоблок';
  const icon = image ? '▧' : '▶';
  const accept = image ? 'image/*' : 'video/*,.mov,.mp4,.webm';
  const formats = image ? 'JPG, PNG, WEBP' : 'MP4, WEBM, MOV';

  return `<article class="block" draggable="true" data-block-id="${id}" data-type="${type}">
    <div class="drag-handle">⋮⋮</div>
    <div class="block-main"><strong>${label}</strong>
      <label class="media-box drop-zone">
        <input class="block-file" type="file" accept="${accept}" hidden>
        <div class="media-icon">${icon}</div>
        <div class="media-copy"><strong class="media-name">Добавить файл</strong><span>${formats}</span></div>
      </label>
    </div>
    <div class="block-actions"><button class="remove" type="button" title="Удалить блок">×</button></div>
  </article>`;
}

function appendBlock(block) {
  const normalized = { ...block, type: normalizeBlockType(block.type) };
  $('#blocksList').insertAdjacentHTML('beforeend', blockMarkup(normalized));
  const node = $('#blocksList').lastElementChild;

  if (normalized.type === 'text') {
    node.querySelector('.block-text').value = normalized.value || '';
  } else {
    node.dataset.path = normalized.value || '';
    if (normalized.value) {
      node.querySelector('.media-name').textContent = fileName(normalized.value);
      if (normalized.type === 'image') {
        node.querySelector('.media-icon').style.backgroundImage = 'url("' + mediaUrl(normalized.value) + '")';
        node.querySelector('.media-icon').textContent = '';
      } else {
        node.querySelector('.media-icon').textContent = '▶';
      }
    }
  }

  bindBlock(node);
}

function bindBlock(node) {
  node.querySelector('.remove').addEventListener('click', () => node.remove());

  const input = node.querySelector('.block-file');
  if (!input) return;

  input.addEventListener('change', () => {
    const file = input.files?.[0];
    if (!file) return;

    node.querySelector('.media-name').textContent = file.name;

    if (node.dataset.type === 'image') {
      const preview = URL.createObjectURL(file);
      node.querySelector('.media-icon').style.backgroundImage = 'url("' + preview + '")';
      node.querySelector('.media-icon').textContent = '';
    } else {
      node.querySelector('.media-icon').style.backgroundImage = '';
      node.querySelector('.media-icon').textContent = '▶';
    }
  });
}

$('#openAddBlockMenu').addEventListener('click', () => {
  $('#addBlockMenu').classList.toggle('show');
});

document.querySelectorAll('[data-add-block]').forEach((button) => {
  button.addEventListener('click', () => {
    appendBlock({ type: normalizeBlockType(button.dataset.addBlock), value: '' });
    $('#addBlockMenu').classList.remove('show');
  });
});

function interactiveTarget(target) {
  return Boolean(target.closest('textarea,input,select,button,.drop-zone,[contenteditable="true"]'));
}

function makeDropMarker() {
  const marker = document.createElement('div');
  marker.className = 'drop-marker';
  marker.textContent = 'Блок будет перемещён сюда';
  return marker;
}

$('#blocksList').addEventListener('dragstart', (event) => {
  const block = event.target.closest('.block');
  if (!block || interactiveTarget(event.target)) {
    event.preventDefault();
    return;
  }

  draggedBlock = block;
  block.classList.add('dragging');
  dropMarker = makeDropMarker();
  setTimeout(() => block.after(dropMarker), 0);
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
});

$('#blocksList').addEventListener('dragover', (event) => {
  if (!draggedBlock) return;
  event.preventDefault();

  const blocks = [...document.querySelectorAll('#blocksList .block:not(.dragging)')];
  const before = blocks.find((block) => {
    const rect = block.getBoundingClientRect();
    return event.clientY < rect.top + rect.height / 2;
  });

  if (before) $('#blocksList').insertBefore(dropMarker, before);
  else $('#blocksList').appendChild(dropMarker);
});

$('#blocksList').addEventListener('drop', (event) => {
  if (!draggedBlock || !dropMarker) return;
  event.preventDefault();
  $('#blocksList').insertBefore(draggedBlock, dropMarker);
});

document.addEventListener('dragend', () => {
  if (!draggedBlock) return;
  draggedBlock.classList.remove('dragging');
  dropMarker?.remove();
  draggedBlock = null;
  dropMarker = null;
});

async function uploadBlockFile(file) {
  const form = new FormData();
  form.append('action', 'upload_blog_media');
  form.append('file', file);
  const result = await apiForm(form);
  if (!result.success || !result.url) {
    throw new Error(result.message || 'Не удалось загрузить медиафайл');
  }
  return result.url;
}

async function serializeBlocks() {
  const result = [];

  for (const node of document.querySelectorAll('#blocksList .block')) {
    const type = node.dataset.type;

    if (type === 'text') {
      const value = node.querySelector('.block-text').value;
      result.push({ type: 'text', value });
      continue;
    }

    let value = node.dataset.path || '';
    const file = node.querySelector('.block-file')?.files?.[0];
    if (file) value = await uploadBlockFile(file);

    if (value) result.push({ type, value });
  }

  return result;
}

$('#postForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!isOwner()) return;

  const title = $('#postTitle').value.trim();
  if (!title) return;

  const button = $('#savePostButton');
  button.disabled = true;
  const originalText = button.textContent;
  button.textContent = 'Сохранение…';

  try {
    const blocks = await serializeBlocks();

    const form = new FormData();
    form.append('action', 'save_blog');
    form.append('mode', editingPostId ? 'edit' : 'add');
    if (editingPostId) form.append('id', String(editingPostId));
    form.append('title', title);
    form.append('status', $('#postStatus').value === 'draft' ? 'draft' : 'published');
    form.append('content', JSON.stringify(blocks));
    form.append('cover_mode', 'file');
    form.append('del_cover', coverDeleted ? '1' : '0');

    const cover = $('#postCover').files?.[0];
    if (cover) form.append('cover', cover);

    const result = await apiForm(form);
    if (!result.success) throw new Error(result.message || 'Не удалось сохранить публикацию');

    closeOverlay('editorOverlay');
    await loadPosts();
    toast(editingPostId ? 'Публикация обновлена' : 'Публикация сохранена');
  } catch (error) {
    toast(error.message || 'Ошибка сохранения публикации');
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
});

let deleteArmed = false;
let deleteTimer = null;

$('#deletePostButton').addEventListener('click', async () => {
  if (!editingPostId || !isOwner()) return;

  if (!deleteArmed) {
    deleteArmed = true;
    $('#deletePostButton').textContent = 'Нажмите ещё раз для удаления';
    clearTimeout(deleteTimer);
    deleteTimer = setTimeout(() => {
      deleteArmed = false;
      $('#deletePostButton').textContent = 'Удалить публикацию';
    }, 3500);
    return;
  }

  try {
    const result = await api('delete_blog', { id: editingPostId });
    if (!result.success) throw new Error(result.message || 'Не удалось удалить публикацию');
    deleteArmed = false;
    closeOverlay('editorOverlay');
    await loadPosts();
    toast('Публикация удалена');
  } catch (error) {
    toast(error.message || 'Ошибка удаления публикации');
  }
});

async function init() {
  try {
    auth = await api('check_auth');
  } catch {
    auth = { logged_in: false, role: 'guest' };
  }

  document.body.classList.toggle('is-owner', isOwner());

  try {
    await loadPosts();
  } catch {
    posts = [];
    render();
    toast('Не удалось загрузить блог');
  }
}

init();
