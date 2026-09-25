const $ = (selector) => document.querySelector(selector);
const BOOKS_KEY = 'facehubDemoBooks';

const params = new URLSearchParams(location.search);
const requestedId = params.get('id');

function getBooks() {
  try { return JSON.parse(localStorage.getItem(BOOKS_KEY) || '[]'); }
  catch { return []; }
}

const demoBook = {
  id: 'demo',
  title: 'Тихая линия',
  description: 'История о памяти, дороге и тех разговорах, которые случаются слишком поздно. Неспешный текст о выборе, возвращении и попытке сохранить то, что обычно исчезает первым.',
  backgroundInterval: 10,
  ebookFileName: 'tihaya-liniya.epub',
  audiobookFileName: 'tihaya-liniya.m4b',
  trailerFileName: 'trailer.mp4',
  ebookPrice: 390,
  audiobookPrice: 690
};

const storedBooks = getBooks();
const book = storedBooks.find(item => item.id === requestedId) || demoBook;

const isOwner = sessionStorage.getItem('facehubDemoRole') === 'owner';
let purchasedIds = [];
try { purchasedIds = JSON.parse(localStorage.getItem('facehubDemoPurchasedBooks') || '[]'); } catch {}
const purchased = isOwner || book.id === 'demo' || purchasedIds.includes(book.id) || params.get('purchased') === '1';

function fileExt(name, fallback) {
  if (!name) return fallback;
  const ext = name.split('.').pop();
  return ext ? ext.toUpperCase() : fallback;
}

function populateBook() {
  document.title = book.title + ' — Дим Саныч';
  $('#bookTitleView').textContent = book.title;
  $('#bookDescriptionView').textContent = book.description || 'Описание книги появится здесь.';
  $('#readerBookTitle').textContent = book.title;
  $('#readerHeading').textContent = book.title;
  $('#audioBookTitle').textContent = book.title;
  $('#audioHeading').textContent = book.title;
  $('#trailerTitle').textContent = book.title;
  $('#bookCoverView').dataset.title = book.title;
  $('#audioCover').dataset.title = book.title;

  const interval = Math.max(1, Number(book.backgroundInterval || 10));
  document.documentElement.style.setProperty('--background-interval', interval + 's');

  const hasTrailer = Boolean(book.trailerFileName) || book.id === 'demo';
  $('#trailerButton').style.display = hasTrailer ? 'inline-flex' : 'none';

  if (!purchased) {
    $('#bookKicker').textContent = 'Книга';
    $('#accessBlock').innerHTML = '<div class="access-head"><span class="access-title">Материалы</span></div><p class="description" style="margin:0">После покупки здесь появятся доступные форматы электронной книги и аудиокниги.</p>';
    return;
  }

  $('#bookKicker').textContent = 'Книга · куплено';

  const items = [];
  if (book.ebookFileName || book.id === 'demo') {
    const ext = fileExt(book.ebookFileName, 'EPUB');
    items.push(`
      <div class="download">
        <div class="download-icon">⇩</div>
        <div class="download-copy"><strong>Электронная книга</strong><span>${ext}</span></div>
        <div class="download-actions">
          <button class="mini main" type="button" data-action="reader">Читать онлайн</button>
          <button class="mini" type="button" data-action="download-ebook">Скачать</button>
        </div>
      </div>
    `);
    $('#readerFormat').textContent = ext;
  }

  if (book.audiobookFileName || book.id === 'demo') {
    const ext = fileExt(book.audiobookFileName, 'M4B');
    items.push(`
      <div class="download">
        <div class="download-icon">♪</div>
        <div class="download-copy"><strong>Аудиокнига</strong><span>${ext}</span></div>
        <div class="download-actions">
          <button class="mini main" type="button" data-action="audio">Слушать онлайн</button>
          <button class="mini" type="button" data-action="download-audio">Скачать</button>
        </div>
      </div>
    `);
  }

  $('#downloads').innerHTML = items.join('') || '<p class="description">Для этой книги пока не загружены файлы.</p>';
}

function openOverlay(id) {
  $('#' + id).classList.add('show');
  $('#' + id).setAttribute('aria-hidden', 'false');
}

function closeOverlay(id) {
  $('#' + id).classList.remove('show');
  $('#' + id).setAttribute('aria-hidden', 'true');
}

document.addEventListener('click', (event) => {
  const action = event.target.closest('[data-action]')?.dataset.action;
  if (action === 'reader') openOverlay('readerOverlay');
  if (action === 'audio') openOverlay('audioOverlay');
  if (action === 'download-ebook') alert('В рабочей версии здесь начнётся скачивание электронной книги.');
  if (action === 'download-audio') alert('В рабочей версии здесь начнётся скачивание аудиокниги.');
});

document.querySelectorAll('[data-close]').forEach((button) => {
  button.addEventListener('click', () => closeOverlay(button.dataset.close));
});

$('#trailerButton').addEventListener('click', () => openOverlay('trailerOverlay'));

const layers = [...document.querySelectorAll('.bg-layer')];
const dots = [...document.querySelectorAll('.background-progress i')];
let currentBackground = 0;
const intervalMs = Math.max(1, Number(book.backgroundInterval || 10)) * 1000;

function activateBackground(index) {
  layers.forEach((layer, i) => layer.classList.toggle('active', i === index));
  dots.forEach((dot, i) => {
    dot.classList.remove('active');
    if (i === index) {
      void dot.offsetWidth;
      dot.classList.add('active');
    }
  });
}

setInterval(() => {
  currentBackground = (currentBackground + 1) % layers.length;
  activateBackground(currentBackground);
}, intervalMs);

let readerFont = 17;
$('#fontPlus').addEventListener('click', () => {
  readerFont = Math.min(24, readerFont + 1);
  document.querySelectorAll('.reader-page p').forEach(p => p.style.fontSize = readerFont + 'px');
});
$('#fontMinus').addEventListener('click', () => {
  readerFont = Math.max(13, readerFont - 1);
  document.querySelectorAll('.reader-page p').forEach(p => p.style.fontSize = readerFont + 'px');
});

$('#readerTheme').addEventListener('click', () => {
  $('#readerPage').classList.toggle('dark');
  $('#readerTheme').textContent = $('#readerPage').classList.contains('dark') ? 'Тёмная тема' : 'Светлая тема';
});

let pageNumber = 42;
function updatePage() { $('#readerPageNumber').textContent = pageNumber + ' / 318'; }
$('#readerPrev').addEventListener('click', () => { pageNumber = Math.max(1, pageNumber - 1); updatePage(); });
$('#readerNext').addEventListener('click', () => { pageNumber = Math.min(318, pageNumber + 1); updatePage(); });

let playing = true;
$('#playButton').addEventListener('click', () => {
  playing = !playing;
  $('#playButton').textContent = playing ? 'Ⅱ' : '▶';
});

const speeds = [1, 1.25, 1.5, 1.75, 2];
let speedIndex = 0;
$('#speedButton').addEventListener('click', () => {
  speedIndex = (speedIndex + 1) % speeds.length;
  $('#speedButton').textContent = speeds[speedIndex] + '× скорость';
});

document.querySelectorAll('.chapter').forEach((button) => {
  button.addEventListener('click', () => {
    document.querySelectorAll('.chapter').forEach(item => item.classList.remove('active'));
    button.classList.add('active');
    $('.audio-kicker').textContent = 'Сейчас играет · ' + button.textContent;
  });
});

populateBook();
