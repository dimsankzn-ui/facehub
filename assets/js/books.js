const $ = (selector) => document.querySelector(selector);
const STORAGE_KEY = 'facehubDemoBooks';
let selectedCover = 'mist';

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
    item.className = 'book ' + (book.cover || 'mist');
    item.title = [book.title, book.author, book.year].filter(Boolean).join(' · ');

    const lock = book.visibility === 'restricted'
      ? '<span class="book-lock" title="По персональному доступу">◌</span>'
      : '';

    item.innerHTML = `
      ${lock}
      <div class="book-spine">
        <strong class="book-title"></strong>
        <span class="book-year"></span>
      </div>
    `;

    item.querySelector('.book-title').textContent = book.title;
    item.querySelector('.book-year').textContent = book.year || '';

    item.addEventListener('click', () => {
      toast(book.title + (book.visibility === 'restricted' ? ' · закрытый доступ' : ''));
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
  $('#bookAuthor').value = 'Дим Саныч';
  selectedCover = 'mist';
  document.querySelectorAll('.cover-choice').forEach((button) => {
    button.classList.toggle('active', button.dataset.cover === selectedCover);
  });
}

function toast(message) {
  const node = $('#toast');
  node.textContent = message;
  node.classList.add('show');
  clearTimeout(window.__bookToast);
  window.__bookToast = setTimeout(() => node.classList.remove('show'), 2000);
}

if (isOwner()) document.body.classList.add('is-owner');

['headerAddBook', 'introAddBook', 'emptyAddBook'].forEach((id) => {
  $('#' + id).addEventListener('click', openModal);
});

$('#modalClose').addEventListener('click', closeModal);
$('#modalCancel').addEventListener('click', closeModal);
$('#bookModal').addEventListener('click', (event) => {
  if (event.target.id === 'bookModal') closeModal();
});

document.querySelectorAll('.cover-choice').forEach((button) => {
  button.addEventListener('click', () => {
    selectedCover = button.dataset.cover;
    document.querySelectorAll('.cover-choice').forEach((item) => {
      item.classList.toggle('active', item === button);
    });
  });
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
    author: $('#bookAuthor').value.trim(),
    year: $('#bookYear').value.trim(),
    description: $('#bookDescription').value.trim(),
    visibility: $('#bookVisibility').value,
    cover: selectedCover
  });

  saveBooks(books);
  closeModal();
  renderBooks();
  toast('Книга добавлена на полку');
});

renderBooks();
