const $ = (selector) => document.querySelector(selector);
const STORAGE_KEY = 'facehubDemoBooks';


function getBooks() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveBooks(books) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(books));
}

function pluralBooks(count) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return count + ' книга';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return count + ' книги';
  return count + ' книг';
}

function isOwner() {
  return sessionStorage.getItem('facehubDemoRole') === 'owner';
}

function renderBooks() {
  const books = getBooks();
  const row = $('#booksRow');
  const empty = $('#emptyState');

  $('#bookCount').textContent = pluralBooks(books.length);
  row.innerHTML = '';

  empty.classList.toggle('hidden', books.length > 0);

  books.forEach((book) => {
    const item = document.createElement('article');
    item.className = 'book mist';
    item.title = book.title;

    const lock = '';

    item.innerHTML = `
      ${lock}
      <div class="book-spine">
        <strong class="book-title"></strong>
        <span class="book-year"></span>
      </div>
    `;

    item.querySelector('.book-title').textContent = book.title;
    item.querySelector('.book-year').textContent = '';

    item.addEventListener('click', () => {
      location.href = 'book.html?id=' + encodeURIComponent(book.id);
    });

    row.appendChild(item);
  });
}

function openModal() {
  if (!isOwner()) return;
  $('#bookModal').classList.add('show');
  $('#bookModal').setAttribute('aria-hidden', 'false');
  setTimeout(() => $('#bookTitle').focus(), 40);
}

function closeModal() {
  $('#bookModal').classList.remove('show');
  $('#bookModal').setAttribute('aria-hidden', 'true');
  $('#bookForm').reset();
  $('#backgroundInterval').value = '10';
  $('#coverPreview').style.backgroundImage = '';
  $('#coverPreview').textContent = '＋';
  $('#backgroundPreviewStrip').innerHTML = '<div class="background-preview-placeholder"></div>';
  $('#ebookFileName').textContent = 'EPUB, PDF, FB2, MOBI, AZW3, DOCX';
  $('#audiobookFileName').textContent = 'MP3, M4B, AAC, FLAC, ZIP';
  $('#trailerFileName').textContent = 'MP4, WEBM, MOV';
}

function toast(message) {
  const node = $('#toast');
  node.textContent = message;
  node.classList.add('show');
  clearTimeout(window.__bookToast);
  window.__bookToast = setTimeout(() => node.classList.remove('show'), 2000);
}

if (isOwner()) document.body.classList.add('is-owner');

['introAddBook', 'emptyAddBook'].forEach((id) => {
  $('#' + id).addEventListener('click', openModal);
});

$('#modalClose').addEventListener('click', closeModal);
$('#modalCancel').addEventListener('click', closeModal);
$('#bookModal').addEventListener('click', (event) => {
  if (event.target.id === 'bookModal') closeModal();
});

$('#bookForm').addEventListener('submit', (event) => {
  event.preventDefault();

  if (!isOwner()) return;

  const title = $('#bookTitle').value.trim();
  if (!title) return;

  const books = getBooks();
  books.push({
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    title,
    description: $('#bookDescription').value.trim(),
    backgroundInterval: Number($('#backgroundInterval').value || 10),
    ebookPrice: Number($('#ebookPrice').value || 0),
    audiobookPrice: Number($('#audiobookPrice').value || 0),
    coverFileName: $('#bookCover').files[0]?.name || '',
    backgroundFileNames: Array.from($('#bookBackgrounds').files || []).map(file => file.name),
    ebookFileName: $('#ebookFile').files[0]?.name || '',
    audiobookFileName: $('#audiobookFile').files[0]?.name || '',
    trailerFileName: $('#trailerFile').files[0]?.name || ''
  });

  saveBooks(books);
  closeModal();
  renderBooks();
  toast('Книга добавлена на полку');
});

renderBooks();

function bindFileName(inputId, outputId, fallback) {
  const input = $('#' + inputId);
  input.addEventListener('change', () => {
    const file = input.files && input.files[0];
    $('#' + outputId).textContent = file ? file.name : fallback;
  });
}

bindFileName('ebookFile', 'ebookFileName', 'EPUB, PDF, FB2, MOBI, AZW3, DOCX');
bindFileName('audiobookFile', 'audiobookFileName', 'MP3, M4B, AAC, FLAC, ZIP');
bindFileName('trailerFile', 'trailerFileName', 'MP4, WEBM, MOV');

$('#bookCover').addEventListener('change', () => {
  const file = $('#bookCover').files && $('#bookCover').files[0];
  if (!file) return;
  const url = URL.createObjectURL(file);
  $('#coverPreview').style.backgroundImage = `url("${url}")`;
  $('#coverPreview').textContent = '';
});

$('#bookBackgrounds').addEventListener('change', () => {
  const files = Array.from($('#bookBackgrounds').files || []).slice(0, 3);
  const strip = $('#backgroundPreviewStrip');
  strip.innerHTML = '';
  if (!files.length) {
    strip.innerHTML = '<div class="background-preview-placeholder"></div>';
    return;
  }
  files.forEach((file) => {
    const thumb = document.createElement('div');
    thumb.className = 'background-thumb';
    thumb.style.backgroundImage = `url("${URL.createObjectURL(file)}")`;
    strip.appendChild(thumb);
  });
});
