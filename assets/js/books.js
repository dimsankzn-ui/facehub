const $ = (selector) => document.querySelector(selector);

let owner = false;
let books = [];
let editingBook = null;
let pendingBackgrounds = [];
let deletedFiles = new Set();
let coverDeleted = false;
let draggedBackgroundId = null;

function mediaUrl(path) {
  if (!path) return '';
  return new URL(path.replace(/^\//, ''), location.origin + '/').href;
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

function pluralBooks(count) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return count + ' книга';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return count + ' книги';
  return count + ' книг';
}

function toast(message) {
  const node = $('#toast');
  node.textContent = message;
  node.classList.add('show');
  clearTimeout(window.__bookToast);
  window.__bookToast = setTimeout(() => node.classList.remove('show'), 2200);
}

function bookSpineWidth(pageCount) {
  const pages = Math.max(1, Number(pageCount) || 240);
  return Math.round(Math.min(88, Math.max(34, 28 + pages * 0.11)));
}

function readableTextColor(hex) {
  const value = String(hex || '#50657c').replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(value)) return '#ffffff';
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminance > 0.7 ? '#172535' : '#ffffff';
}

function renderBooks() {
  const row = $('#booksRow');
  const empty = $('#emptyState');
  row.replaceChildren();
  $('#bookCount').textContent = pluralBooks(books.length);
  empty.classList.toggle('hidden', books.length > 0);

  books.forEach((book) => {
    const color = /^#[0-9a-fA-F]{6}$/.test(book.shelf_color || '') ? book.shelf_color : '#50657c';
    const spineWidth = bookSpineWidth(book.page_count);
    const textColor = readableTextColor(color);

    const item = document.createElement('article');
    item.className = 'book';
    item.title = book.title;
    item.style.setProperty('--spine-w', spineWidth + 'px');
    item.style.setProperty('--book-color', color);
    item.style.setProperty('--book-text', textColor);

    const volume = document.createElement('div');
    volume.className = 'book-volume';

    const spine = document.createElement('div');
    spine.className = 'book-spine';

    const title = document.createElement('strong');
    title.className = 'book-title';
    title.textContent = book.title;
    spine.appendChild(title);

    const cover = document.createElement('div');
    cover.className = 'book-cover-face';
    if (book.cover) {
      const image = document.createElement('img');
      image.src = mediaUrl(book.cover);
      image.alt = 'Обложка книги «' + book.title + '»';
      image.loading = 'lazy';
      cover.appendChild(image);
    } else {
      const fallback = document.createElement('span');
      fallback.textContent = book.title;
      cover.appendChild(fallback);
    }

    const pages = document.createElement('div');
    pages.className = 'book-page-edge';

    volume.append(spine, cover, pages);
    item.appendChild(volume);

    if (owner) {
      const controls = document.createElement('div');
      controls.className = 'book-admin-actions';

      const edit = document.createElement('button');
      edit.type = 'button';
      edit.textContent = '✎';
      edit.title = 'Редактировать';
      edit.addEventListener('click', (event) => {
        event.stopPropagation();
        openModal('edit', book.id);
      });

      const remove = document.createElement('button');
      remove.type = 'button';
      remove.textContent = '×';
      remove.title = 'Удалить';
      remove.className = 'danger';
      remove.addEventListener('click', (event) => {
        event.stopPropagation();
        deleteBook(book.id, book.title);
      });

      controls.append(edit, remove);
      item.appendChild(controls);
    }

    item.addEventListener('click', () => {
      location.href = 'book.html?id=' + encodeURIComponent(book.id);
    });

    row.appendChild(item);
  });
}

async function loadBooks() {
  try {
    const data = await api('get_books');
    books = data.success && Array.isArray(data.books) ? data.books : [];
    renderBooks();
  } catch {
    books = [];
    renderBooks();
    toast('Не удалось загрузить книги');
  }
}

function resetModal() {
  $('#bookForm').reset();
  $('#backgroundInterval').value = '10';
  $('#bookPages').value = '';
  $('#bookColor').value = '#50657c';
  $('#bookColorText').value = '#50657c';
  $('#coverPreview').style.backgroundImage = '';
  $('#coverPreview').textContent = '＋';
  $('#backgroundPreviewStrip').replaceChildren();
  $('#backgroundPreviewStrip').appendChild(Object.assign(document.createElement('div'), { className: 'background-preview-placeholder' }));
  $('#ebookFileName').textContent = 'EPUB, PDF, FB2';
  $('#audiobookFileName').textContent = 'MP3, M4B, AAC, FLAC';
  $('#trailerFileName').textContent = 'MP4, WEBM, MOV';
  $('#ebookMaterials').replaceChildren();
  $('#audioMaterials').replaceChildren();
  $('#trailerMaterials').replaceChildren();
  $('#removeCoverButton').hidden = true;
  $('#removeCoverButton').textContent = 'Убрать обложку';
  pendingBackgrounds = [];
  deletedFiles = new Set();
  coverDeleted = false;
  editingBook = null;
}

function openMaterialPreview(url) {
  $('#materialPreviewImage').src = url;
  $('#materialPreview').classList.add('show');
  $('#materialPreview').setAttribute('aria-hidden', 'false');
}

function closeMaterialPreview() {
  $('#materialPreview').classList.remove('show');
  $('#materialPreview').setAttribute('aria-hidden', 'true');
  $('#materialPreviewImage').removeAttribute('src');
}

function moveBackground(id, delta) {
  const index = pendingBackgrounds.findIndex((item) => item.id === id);
  const target = index + delta;
  if (index < 0 || target < 0 || target >= pendingBackgrounds.length) return;
  const [item] = pendingBackgrounds.splice(index, 1);
  pendingBackgrounds.splice(target, 0, item);
  renderBackgrounds();
}

function renderBackgrounds() {
  const strip = $('#backgroundPreviewStrip');
  strip.replaceChildren();

  if (!pendingBackgrounds.length) {
    strip.appendChild(Object.assign(document.createElement('div'), { className: 'background-preview-placeholder' }));
    return;
  }

  pendingBackgrounds.forEach((bg, index) => {
    const thumb = document.createElement('div');
    thumb.className = 'background-thumb editable';
    thumb.style.backgroundImage = 'url("' + bg.preview + '")';
    thumb.draggable = true;
    thumb.dataset.id = bg.id;
    thumb.title = 'Нажмите для просмотра · перетащите для изменения порядка';

    thumb.addEventListener('click', (event) => {
      event.preventDefault();
      if (!event.target.closest('button')) openMaterialPreview(bg.preview);
    });
    thumb.addEventListener('dragstart', (event) => {
      draggedBackgroundId = bg.id;
      event.dataTransfer.effectAllowed = 'move';
      thumb.classList.add('dragging');
    });
    thumb.addEventListener('dragend', () => {
      draggedBackgroundId = null;
      thumb.classList.remove('dragging');
    });
    thumb.addEventListener('dragover', (event) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
    });
    thumb.addEventListener('drop', (event) => {
      event.preventDefault();
      const from = pendingBackgrounds.findIndex((item) => item.id === draggedBackgroundId);
      const to = pendingBackgrounds.findIndex((item) => item.id === bg.id);
      if (from < 0 || to < 0 || from === to) return;
      const [item] = pendingBackgrounds.splice(from, 1);
      pendingBackgrounds.splice(to, 0, item);
      renderBackgrounds();
    });

    const controls = document.createElement('div');
    controls.className = 'background-controls';

    const left = document.createElement('button');
    left.type = 'button';
    left.textContent = '←';
    left.title = 'Сдвинуть левее';
    left.disabled = index === 0;
    left.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      moveBackground(bg.id, -1);
    });

    const right = document.createElement('button');
    right.type = 'button';
    right.textContent = '→';
    right.title = 'Сдвинуть правее';
    right.disabled = index === pendingBackgrounds.length - 1;
    right.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      moveBackground(bg.id, 1);
    });

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'danger';
    remove.textContent = '×';
    remove.title = 'Убрать изображение';
    remove.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      pendingBackgrounds = pendingBackgrounds.filter((item) => item.id !== bg.id);
      renderBackgrounds();
    });

    controls.append(left, right, remove);
    thumb.appendChild(controls);
    strip.appendChild(thumb);
  });
}

const materialDefinitions = [
  { key: 'file_epub', type: 'epub', label: 'EPUB', group: 'ebook' },
  { key: 'file_fb2', type: 'fb2', label: 'FB2', group: 'ebook' },
  { key: 'file_pdf', type: 'pdf', label: 'PDF', group: 'ebook' },
  { key: 'file_audio', type: 'audio', label: 'Аудио', group: 'audio' },
  { key: 'file_m4b', type: 'm4b', label: 'M4B', group: 'audio' },
  { key: 'trailer_file', type: 'trailer', label: 'Трейлер', group: 'trailer' }
];

function fileName(path) {
  if (!path) return '';
  try { return decodeURIComponent(path.split('/').pop()); }
  catch { return path.split('/').pop(); }
}

function pendingFilesFor(group) {
  const input = group === 'ebook' ? $('#ebookFile') : group === 'audio' ? $('#audiobookFile') : $('#trailerFile');
  return Array.from(input.files || []);
}

function renderMaterialLists() {
  const containers = {
    ebook: $('#ebookMaterials'),
    audio: $('#audioMaterials'),
    trailer: $('#trailerMaterials')
  };
  Object.values(containers).forEach((container) => container.replaceChildren());

  materialDefinitions.forEach((definition) => {
    const path = editingBook?.[definition.key];
    if (!path) return;

    const row = document.createElement('div');
    row.className = 'material-row' + (deletedFiles.has(definition.type) ? ' pending-delete' : '');

    const copy = document.createElement('div');
    copy.className = 'material-row-copy';
    const format = document.createElement('strong');
    format.textContent = definition.label;
    const name = document.createElement('span');
    name.textContent = fileName(path);
    copy.append(format, name);

    const open = document.createElement('a');
    open.href = mediaUrl(path);
    open.target = '_blank';
    open.rel = 'noopener';
    open.textContent = 'Открыть';

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'material-remove';
    remove.textContent = deletedFiles.has(definition.type) ? 'Отменить' : 'Удалить';
    remove.addEventListener('click', () => {
      if (deletedFiles.has(definition.type)) deletedFiles.delete(definition.type);
      else deletedFiles.add(definition.type);
      renderMaterialLists();
    });

    row.append(copy, open, remove);
    containers[definition.group].appendChild(row);
  });

  ['ebook', 'audio', 'trailer'].forEach((group) => {
    pendingFilesFor(group).forEach((file, index) => {
      const row = document.createElement('div');
      row.className = 'material-row pending-add';
      const copy = document.createElement('div');
      copy.className = 'material-row-copy';
      const format = document.createElement('strong');
      format.textContent = file.name.split('.').pop().toUpperCase();
      const name = document.createElement('span');
      name.textContent = file.name;
      copy.append(format, name);

      const status = document.createElement('em');
      status.textContent = 'Будет добавлен';

      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'material-remove';
      remove.textContent = 'Убрать';
      remove.addEventListener('click', () => {
        const input = group === 'ebook' ? $('#ebookFile') : group === 'audio' ? $('#audiobookFile') : $('#trailerFile');
        const transfer = new DataTransfer();
        Array.from(input.files || []).forEach((item, itemIndex) => {
          if (itemIndex !== index) transfer.items.add(item);
        });
        input.files = transfer.files;
        const fallback = group === 'ebook' ? 'EPUB, PDF, FB2' : group === 'audio' ? 'MP3, M4B, AAC, FLAC' : 'MP4, WEBM, MOV';
        const output = group === 'ebook' ? $('#ebookFileName') : group === 'audio' ? $('#audiobookFileName') : $('#trailerFileName');
        output.textContent = input.files.length ? Array.from(input.files).map((item) => item.name).join(' · ') : fallback;
        renderMaterialLists();
      });

      row.append(copy, status, remove);
      containers[group].appendChild(row);
    });
  });
}

async function openModal(mode = 'add', id = null) {
  if (!owner) return;
  resetModal();

  $('#bookModal').classList.add('show');
  $('#bookModal').setAttribute('aria-hidden', 'false');
  $('.modal-kicker').textContent = mode === 'edit' ? 'Редактирование' : 'Новая книга';
  $('#bookModalTitle').textContent = mode === 'edit' ? 'Редактировать книгу' : 'Добавить книгу';
  $('#bookForm button[type="submit"]').textContent = mode === 'edit' ? 'Сохранить изменения' : 'Добавить книгу';

  if (mode === 'add') {
    setTimeout(() => $('#bookTitle').focus(), 40);
    return;
  }

  try {
    const data = await api('get_book_details', { book_id: id });
    if (!data.success || !data.book) throw new Error('Книга не найдена');

    editingBook = data.book;
    $('#bookTitle').value = data.book.title || '';
    $('#bookPages').value = data.book.page_count || '';
    $('#bookColor').value = /^#[0-9a-fA-F]{6}$/.test(data.book.shelf_color || '') ? data.book.shelf_color : '#50657c';
    $('#bookColorText').value = $('#bookColor').value;
    $('#bookDescription').value = data.book.annotation || '';
    $('#backgroundInterval').value = data.book.background_interval || 10;
    $('#ebookPrice').value = data.book.price_ebook || 0;
    $('#audiobookPrice').value = data.book.price_audio || 0;
    $('#litresLink').value = data.book.litres_link || '';
    $('#bookmateLink').value = data.book.bookmate_link || '';
    $('#strokiLink').value = data.book.stroki_link || '';
    $('#trailerLink').value = data.book.trailer_link || '';

    if (data.book.cover) {
      $('#coverPreview').style.backgroundImage = 'url("' + mediaUrl(data.book.cover) + '")';
      $('#coverPreview').textContent = '';
      $('#removeCoverButton').hidden = false;
    }

    pendingBackgrounds = (data.backgrounds || []).map((path, index) => ({
      id: 'old-' + index,
      type: 'old',
      path,
      preview: mediaUrl(path)
    }));
    renderBackgrounds();

    renderMaterialLists();
  } catch (error) {
    closeModal();
    toast(error.message || 'Не удалось открыть книгу');
  }
}

function closeModal() {
  $('#bookModal').classList.remove('show');
  $('#bookModal').setAttribute('aria-hidden', 'true');
  resetModal();
  history.replaceState({}, '', 'books.html');
}

const armedDeletes = new Set();

async function deleteBook(id, title) {
  if (!owner) return;
  if (!armedDeletes.has(id)) {
    armedDeletes.add(id);
    toast('Нажмите удалить ещё раз, чтобы полностью удалить «' + title + '»');
    setTimeout(() => armedDeletes.delete(id), 3500);
    return;
  }
  armedDeletes.delete(id);

  try {
    const result = await api('delete_book', { book_id: id });
    if (!result.success) throw new Error(result.message || 'Удаление не выполнено');
    toast('Книга удалена');
    await loadBooks();
  } catch (error) {
    toast(error.message || 'Не удалось удалить книгу');
  }
}

function appendBookFiles(formData, input, kind) {
  Array.from(input.files || []).forEach((file) => {
    const ext = file.name.split('.').pop().toLowerCase();

    if (kind === 'ebook') {
      const field = ext === 'pdf' ? 'file_pdf' : ext === 'fb2' ? 'file_fb2' : 'file_epub';
      formData.set(field, file);
    } else if (kind === 'audio') {
      formData.set(ext === 'm4b' ? 'file_m4b' : 'file_audio', file);
    } else {
      formData.set('file_trailer', file);
    }
  });
}

$('#bookForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!owner) return;

  const title = $('#bookTitle').value.trim();
  if (!title) return;

  const pageCount = Number($('#bookPages').value);
  if (!Number.isInteger(pageCount) || pageCount < 1 || pageCount > 5000) {
    showFormMessage('Укажите количество страниц от 1 до 5000.', true);
    $('#bookPages').focus();
    return;
  }

  const button = $('#bookForm button[type="submit"]');
  button.disabled = true;

  try {
    const form = new FormData();
    form.append('action', editingBook ? 'edit_book' : 'add_book');
    if (editingBook) form.append('book_id', editingBook.id);

    form.append('title', title);
    form.append('page_count', String(pageCount));
    form.append('shelf_color', /^#[0-9a-fA-F]{6}$/.test($('#bookColor').value) ? $('#bookColor').value : '#50657c');
    form.append('annotation', $('#bookDescription').value.trim());
    form.append('price_ebook', String(Number($('#ebookPrice').value || 0)));
    form.append('price_audio', String(Number($('#audiobookPrice').value || 0)));
    form.append('background_interval', String(Math.max(1, Number($('#backgroundInterval').value || 10))));
    form.append('litres_link', $('#litresLink').value.trim());
    form.append('bookmate_link', $('#bookmateLink').value.trim());
    form.append('stroki_link', $('#strokiLink').value.trim());
    form.append('trailer_link', $('#trailerLink').value.trim());

    ['pdf', 'fb2', 'epub', 'audio', 'm4b', 'trailer'].forEach((ext) => {
      form.append('del_' + ext, deletedFiles.has(ext) ? '1' : '0');
    });
    form.append('del_cover', coverDeleted ? '1' : '0');

    if ($('#bookCover').files?.[0]) form.append('cover', $('#bookCover').files[0]);
    appendBookFiles(form, $('#ebookFile'), 'ebook');
    appendBookFiles(form, $('#audiobookFile'), 'audio');
    appendBookFiles(form, $('#trailerFile'), 'trailer');

    let newIndex = 0;
    pendingBackgrounds.forEach((bg) => {
      if (bg.type === 'old') {
        form.append('bg_order[]', 'old:' + bg.path);
      } else {
        form.append('bg_order[]', 'new:' + newIndex);
        form.append('new_bgs[]', bg.file);
        newIndex += 1;
      }
    });

    const wasEditing = Boolean(editingBook);
    const result = await apiForm(form);
    if (!result.success) throw new Error(result.message || 'Не удалось сохранить книгу');

    closeModal();
    await loadBooks();
    toast(wasEditing ? 'Книга обновлена' : 'Книга добавлена');
  } catch (error) {
    toast(error.message || 'Ошибка сохранения');
  } finally {
    button.disabled = false;
  }
});

['introAddBook', 'emptyAddBook'].forEach((id) => $('#' + id).addEventListener('click', () => openModal('add')));
$('#modalClose').addEventListener('click', closeModal);
$('#modalCancel').addEventListener('click', closeModal);
$('#bookModal').addEventListener('click', (event) => {
  if (event.target.id === 'bookModal') closeModal();
});

function normalizeShelfColor(value) {
  const cleaned = String(value || '').trim();
  return /^#[0-9a-fA-F]{6}$/.test(cleaned) ? cleaned.toLowerCase() : null;
}

$('#bookColor').addEventListener('input', () => {
  $('#bookColorText').value = $('#bookColor').value;
});

$('#bookColorText').addEventListener('input', () => {
  const normalized = normalizeShelfColor($('#bookColorText').value);
  if (normalized) $('#bookColor').value = normalized;
});

$('#bookColorText').addEventListener('blur', () => {
  const normalized = normalizeShelfColor($('#bookColorText').value) || $('#bookColor').value || '#50657c';
  $('#bookColor').value = normalized;
  $('#bookColorText').value = normalized;
});

function bindFiles(inputId, outputId, fallback) {
  const input = $('#' + inputId);
  input.addEventListener('change', () => {
    const files = Array.from(input.files || []);
    $('#' + outputId).textContent = files.length ? files.map((file) => file.name).join(' · ') : fallback;
    renderMaterialLists();
  });
}

bindFiles('ebookFile', 'ebookFileName', 'EPUB, PDF, FB2');
bindFiles('audiobookFile', 'audiobookFileName', 'MP3, M4B, AAC, FLAC');
bindFiles('trailerFile', 'trailerFileName', 'MP4, WEBM, MOV');

$('#bookCover').addEventListener('change', () => {
  const file = $('#bookCover').files?.[0];
  if (!file) return;
  coverDeleted = false;
  $('#removeCoverButton').hidden = false;
  $('#removeCoverButton').textContent = 'Убрать обложку';
  $('#coverPreview').style.backgroundImage = 'url("' + URL.createObjectURL(file) + '")';
  $('#coverPreview').textContent = '';
});

$('#removeCoverButton').addEventListener('click', () => {
  if (!editingBook?.cover && !$('#bookCover').files?.[0]) return;
  if (coverDeleted) {
    coverDeleted = false;
    $('#removeCoverButton').textContent = 'Убрать обложку';
    if (editingBook?.cover) {
      $('#coverPreview').style.backgroundImage = 'url("' + mediaUrl(editingBook.cover) + '")';
      $('#coverPreview').textContent = '';
    }
    return;
  }

  coverDeleted = true;
  $('#bookCover').value = '';
  $('#coverPreview').style.backgroundImage = '';
  $('#coverPreview').textContent = '×';
  $('#removeCoverButton').textContent = 'Вернуть обложку';
});

$('#materialPreviewClose').addEventListener('click', closeMaterialPreview);
$('#materialPreview').addEventListener('click', (event) => {
  if (event.target.id === 'materialPreview') closeMaterialPreview();
});

$('#bookBackgrounds').addEventListener('change', () => {
  Array.from($('#bookBackgrounds').files || []).forEach((file) => {
    pendingBackgrounds.push({
      id: 'new-' + crypto.randomUUID(),
      type: 'new',
      file,
      preview: URL.createObjectURL(file)
    });
  });
  $('#bookBackgrounds').value = '';
  renderBackgrounds();
});

async function init() {
  try {
    const auth = await api('check_auth');
    owner = auth.logged_in && auth.role === 'admin';
  } catch {
    owner = false;
  }

  document.body.classList.toggle('is-owner', owner);
  await loadBooks();

  const params = new URLSearchParams(location.search);
  const editId = params.get('edit');
  if (owner && params.get('add') === '1') openModal('add');
  else if (owner && editId) openModal('edit', editId);
}

init();
