const $ = (selector) => document.querySelector(selector);

let owner = false;
let books = [];
let editingBook = null;
let pendingBackgrounds = [];

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

function renderBooks() {
  const row = $('#booksRow');
  const empty = $('#emptyState');
  row.replaceChildren();
  $('#bookCount').textContent = pluralBooks(books.length);
  empty.classList.toggle('hidden', books.length > 0);

  books.forEach((book) => {
    const item = document.createElement('article');
    item.className = 'book mist';
    item.title = book.title;

    if (book.cover) {
      const art = document.createElement('div');
      art.className = 'book-art';
      art.style.backgroundImage = 'url("' + mediaUrl(book.cover) + '")';
      item.appendChild(art);
    }

    const spine = document.createElement('div');
    spine.className = 'book-spine';
    const title = document.createElement('strong');
    title.className = 'book-title';
    title.textContent = book.title;
    const year = document.createElement('span');
    year.className = 'book-year';
    spine.append(title, year);
    item.appendChild(spine);

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
  $('#coverPreview').style.backgroundImage = '';
  $('#coverPreview').textContent = '＋';
  $('#backgroundPreviewStrip').replaceChildren();
  $('#backgroundPreviewStrip').appendChild(Object.assign(document.createElement('div'), { className: 'background-preview-placeholder' }));
  $('#ebookFileName').textContent = 'EPUB, PDF, FB2';
  $('#audiobookFileName').textContent = 'MP3, M4B, AAC, FLAC';
  $('#trailerFileName').textContent = 'MP4, WEBM, MOV';
  pendingBackgrounds = [];
  editingBook = null;
}

function renderBackgrounds() {
  const strip = $('#backgroundPreviewStrip');
  strip.replaceChildren();

  if (!pendingBackgrounds.length) {
    strip.appendChild(Object.assign(document.createElement('div'), { className: 'background-preview-placeholder' }));
    return;
  }

  pendingBackgrounds.forEach((bg) => {
    const thumb = document.createElement('div');
    thumb.className = 'background-thumb editable';
    thumb.style.backgroundImage = 'url("' + bg.preview + '")';

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'background-remove';
    remove.textContent = '×';
    remove.title = 'Убрать изображение';
    remove.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      pendingBackgrounds = pendingBackgrounds.filter((item) => item.id !== bg.id);
      renderBackgrounds();
    });

    thumb.appendChild(remove);
    strip.appendChild(thumb);
  });
}

function currentFileLabel(book, keys, fallback) {
  const value = keys.map((key) => book?.[key]).find(Boolean);
  return value ? 'Сейчас: ' + decodeURIComponent(value.split('/').pop()) : fallback;
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
    $('#bookDescription').value = data.book.annotation || '';
    $('#backgroundInterval').value = data.book.background_interval || 10;
    $('#ebookPrice').value = data.book.price_ebook || 0;
    $('#audiobookPrice').value = data.book.price_audio || 0;

    if (data.book.cover) {
      $('#coverPreview').style.backgroundImage = 'url("' + mediaUrl(data.book.cover) + '")';
      $('#coverPreview').textContent = '';
    }

    pendingBackgrounds = (data.backgrounds || []).map((path, index) => ({
      id: 'old-' + index,
      type: 'old',
      path,
      preview: mediaUrl(path)
    }));
    renderBackgrounds();

    $('#ebookFileName').textContent = currentFileLabel(data.book, ['file_epub', 'file_pdf', 'file_fb2'], 'EPUB, PDF, FB2');
    $('#audiobookFileName').textContent = currentFileLabel(data.book, ['file_audio', 'file_m4b'], 'MP3, M4B, AAC, FLAC');
    $('#trailerFileName').textContent = currentFileLabel(data.book, ['trailer_file'], 'MP4, WEBM, MOV');
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

function appendBookFile(formData, input, kind) {
  const file = input.files?.[0];
  if (!file) return;
  const ext = file.name.split('.').pop().toLowerCase();

  if (kind === 'ebook') {
    const field = ext === 'pdf' ? 'file_pdf' : ext === 'fb2' ? 'file_fb2' : 'file_epub';
    formData.append(field, file);
  } else if (kind === 'audio') {
    formData.append(ext === 'm4b' ? 'file_m4b' : 'file_audio', file);
  } else {
    formData.append('file_trailer', file);
  }
}

$('#bookForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!owner) return;

  const title = $('#bookTitle').value.trim();
  if (!title) return;

  const button = $('#bookForm button[type="submit"]');
  button.disabled = true;

  try {
    const form = new FormData();
    form.append('action', editingBook ? 'edit_book' : 'add_book');
    if (editingBook) form.append('book_id', editingBook.id);

    form.append('title', title);
    form.append('annotation', $('#bookDescription').value.trim());
    form.append('price_ebook', String(Number($('#ebookPrice').value || 0)));
    form.append('price_audio', String(Number($('#audiobookPrice').value || 0)));
    form.append('background_interval', String(Math.max(1, Number($('#backgroundInterval').value || 10))));
    form.append('litres_link', editingBook?.litres_link || '');
    form.append('bookmate_link', editingBook?.bookmate_link || '');
    form.append('stroki_link', editingBook?.stroki_link || '');
    form.append('trailer_link', editingBook?.trailer_link || '');

    ['pdf', 'fb2', 'epub', 'audio', 'm4b', 'trailer'].forEach((ext) => form.append('del_' + ext, '0'));

    if ($('#bookCover').files?.[0]) form.append('cover', $('#bookCover').files[0]);
    appendBookFile(form, $('#ebookFile'), 'ebook');
    appendBookFile(form, $('#audiobookFile'), 'audio');
    appendBookFile(form, $('#trailerFile'), 'trailer');

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

function bindFileName(inputId, outputId, fallback) {
  const input = $('#' + inputId);
  input.addEventListener('change', () => {
    const file = input.files?.[0];
    $('#' + outputId).textContent = file ? file.name : fallback;
  });
}

bindFileName('ebookFile', 'ebookFileName', 'EPUB, PDF, FB2');
bindFileName('audiobookFile', 'audiobookFileName', 'MP3, M4B, AAC, FLAC');
bindFileName('trailerFile', 'trailerFileName', 'MP4, WEBM, MOV');

$('#bookCover').addEventListener('change', () => {
  const file = $('#bookCover').files?.[0];
  if (!file) return;
  $('#coverPreview').style.backgroundImage = 'url("' + URL.createObjectURL(file) + '")';
  $('#coverPreview').textContent = '';
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

  const editId = new URLSearchParams(location.search).get('edit');
  if (owner && editId) openModal('edit', editId);
}

init();
