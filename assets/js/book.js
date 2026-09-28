const $ = (selector) => document.querySelector(selector);
const params = new URLSearchParams(location.search);
const requestedId = params.get('id');

let auth = { logged_in: false, role: 'guest' };
let book = null;
let backgrounds = [];
let hasAccess = false;
let backgroundTimer = null;
let backgroundLayers = [];
let backgroundDots = [];
let currentBackground = 0;
let nativeAudio = null;

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

function toast(message) {
  const node = $('#toast');
  if (!node) return;
  node.textContent = message;
  node.classList.add('show');
  clearTimeout(window.__bookPageToast);
  window.__bookPageToast = setTimeout(() => node.classList.remove('show'), 2200);
}

function extension(path) {
  if (!path) return '';
  const clean = path.split('?')[0];
  const ext = clean.split('.').pop();
  return ext ? ext.toUpperCase() : '';
}

function activateBackground(index) {
  if (!backgroundLayers.length) return;
  currentBackground = (index + backgroundLayers.length) % backgroundLayers.length;

  backgroundLayers.forEach((layer, i) => layer.classList.toggle('active', i === currentBackground));
  backgroundDots.forEach((dot, i) => {
    dot.classList.remove('active');
    if (i === currentBackground) {
      void dot.offsetWidth;
      dot.classList.add('active');
    }
  });
}

function restartBackgroundTimer() {
  clearInterval(backgroundTimer);
  const seconds = Math.max(1, Number(book.background_interval || 10));
  document.documentElement.style.setProperty('--background-interval', seconds + 's');
  if (backgroundLayers.length <= 1) return;
  backgroundTimer = setInterval(() => activateBackground(currentBackground + 1), seconds * 1000);
}

function configureBackgrounds() {
  const container = $('#bookBackgroundsView');
  const progress = $('#backgroundProgress');
  container.replaceChildren();
  progress.replaceChildren();

  const images = backgrounds.length ? backgrounds : [book.cover].filter(Boolean);
  $('#viewBackgroundsButton').style.display = images.length ? 'inline-flex' : 'none';
  if (!images.length) return;

  backgroundLayers = images.map((path, index) => {
    const layer = document.createElement('div');
    layer.className = 'bg-layer' + (index === 0 ? ' active' : '');
    layer.style.backgroundImage = 'url("' + mediaUrl(path) + '")';
    container.appendChild(layer);

    const dot = document.createElement('i');
    if (index === 0) dot.classList.add('active');
    progress.appendChild(dot);
    return layer;
  });

  backgroundDots = [...progress.querySelectorAll('i')];
  currentBackground = 0;
  $('#backgroundPrev').disabled = backgroundLayers.length <= 1;
  $('#backgroundNext').disabled = backgroundLayers.length <= 1;
  restartBackgroundTimer();
}

function isMacOS() {
  const ua = navigator.userAgent || '';
  const platform = navigator.platform || '';
  return (/Macintosh/i.test(ua) || /Mac/i.test(platform)) && (navigator.maxTouchPoints || 0) < 2;
}

function openInAppleBooks(epubUrl) {
  if (!epubUrl) return;
  const link = document.createElement('a');
  link.href = mediaUrl(epubUrl);
  link.download = '';
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  link.remove();

  window.setTimeout(() => {
    const frame = document.createElement('iframe');
    frame.style.display = 'none';
    frame.src = 'ibooks://';
    document.body.appendChild(frame);
    window.setTimeout(() => frame.remove(), 1600);
  }, 450);

  toast('EPUB загружается, Apple Books открывается. Если импорт не начался автоматически, откройте загруженный файл.');
}

function createDownloadRow(label, files, access, type) {
  const row = document.createElement('div');
  row.className = 'download';

  const icon = document.createElement('div');
  icon.className = 'download-icon';
  icon.textContent = type === 'audio' ? '♪' : 'Aa';

  const copy = document.createElement('div');
  copy.className = 'download-copy';
  const strong = document.createElement('strong');
  strong.textContent = label;
  const formats = document.createElement('span');
  formats.textContent = files.length ? files.map((item) => item.label || extension(item.path)).join(' · ') : 'Материал доступен по аккаунту';
  copy.append(strong, formats);

  const actions = document.createElement('div');
  actions.className = 'download-actions';

  if (access) {
    if (type === 'audio') {
      const listen = document.createElement('button');
      listen.className = 'mini main';
      listen.type = 'button';
      listen.textContent = 'Слушать';
      listen.addEventListener('click', () => openAudio(files[0].path));
      actions.appendChild(listen);
    } else {
      const browser = document.createElement('a');
      browser.className = 'mini main';
      const pdf = files.find((item) => item.label === 'PDF');
      const readable = files.find((item) => item.label === 'EPUB') || files.find((item) => item.label === 'FB2');
      browser.href = readable ? 'reader.html?id=' + encodeURIComponent(book.id) : mediaUrl(pdf?.path || '');
      if (!readable) {
        browser.target = '_blank';
        browser.rel = 'noopener';
      }
      browser.textContent = 'Читать в браузере';
      actions.appendChild(browser);

      const epub = files.find((item) => item.label === 'EPUB');
      if (isMacOS() && epub) {
        const apple = document.createElement('button');
        apple.className = 'mini apple-books';
        apple.type = 'button';
        apple.textContent = 'Apple Books';
        apple.addEventListener('click', () => openInAppleBooks(epub.path));
        actions.appendChild(apple);
      }
    }
  } else {
    const locked = document.createElement('button');
    locked.className = 'mini';
    locked.type = 'button';
    locked.textContent = 'Требуется доступ';
    locked.addEventListener('click', () => toast(auth.logged_in ? 'Для этого материала требуется доступ.' : 'Сначала войдите в аккаунт.'));
    actions.appendChild(locked);
  }

  row.append(icon, copy, actions);
  return row;
}

function configureMaterials() {
  const downloads = $('#downloads');
  downloads.replaceChildren();

  const ebooks = [
    { path: book.file_epub, label: 'EPUB' },
    { path: book.file_pdf, label: 'PDF' },
    { path: book.file_fb2, label: 'FB2' }
  ].filter((item) => item.path);

  const audio = [
    { path: book.file_audio, label: 'Аудио' },
    { path: book.file_m4b, label: 'M4B' }
  ].filter((item) => item.path);

  const ebookAvailable = Boolean(book.ebook_available) || ebooks.length > 0;
  const audioAvailable = Boolean(book.audio_available) || audio.length > 0;

  const isAdmin = auth.logged_in && auth.role === 'admin';
  const ebookAccess = isAdmin || (auth.logged_in && (Number(book.price_ebook || 0) === 0 || hasAccess));
  const audioAccess = isAdmin || (auth.logged_in && (Number(book.price_audio || 0) === 0 || hasAccess));

  if (ebookAvailable) downloads.appendChild(createDownloadRow('Электронная книга', ebooks, ebookAccess, 'ebook'));
  if (audioAvailable) downloads.appendChild(createDownloadRow('Аудиокнига', audio, audioAccess, 'audio'));

  const external = [
    { label: 'Букмейт', url: book.bookmate_link },
    { label: 'Строки', url: book.stroki_link }
  ].filter((item) => item.url);

  if (book.litres_link) {
    const litres = document.createElement('a');
    litres.className = 'litres-link';
    litres.href = book.litres_link;
    litres.target = '_blank';
    litres.rel = 'noopener';
    const logo = document.createElement('img');
    logo.src = 'assets/brand/litres.svg';
    logo.alt = 'ЛитРес';
    const copy = document.createElement('span');
    copy.innerHTML = '<b>Открыть в ЛитРес</b>в приложении или на сайте';
    const arrow = document.createElement('i');
    arrow.textContent = '›';
    litres.append(logo, copy, arrow);
    downloads.appendChild(litres);
  }

  if (external.length) {
    const row = document.createElement('div');
    row.className = 'download external-platforms';
    const icon = document.createElement('div');
    icon.className = 'download-icon';
    icon.textContent = '↗';
    const copy = document.createElement('div');
    copy.className = 'download-copy';
    const strong = document.createElement('strong');
    strong.textContent = 'Другие площадки';
    const caption = document.createElement('span');
    caption.textContent = external.map((item) => item.label).join(' · ');
    copy.append(strong, caption);
    const actions = document.createElement('div');
    actions.className = 'download-actions';
    external.forEach((item) => {
      const link = document.createElement('a');
      link.className = 'mini';
      link.href = item.url;
      link.target = '_blank';
      link.rel = 'noopener';
      link.textContent = item.label;
      actions.appendChild(link);
    });
    row.append(icon, copy, actions);
    downloads.appendChild(row);
  }

  if (!ebookAvailable && !audioAvailable && !book.litres_link && !external.length) {
    const message = document.createElement('p');
    message.className = 'description';
    message.textContent = 'Для этой книги пока не загружены материалы.';
    downloads.appendChild(message);
  }

  $('#bookKicker').textContent = isAdmin ? 'Книга · владелец' : 'Книга';
}

function configureTrailer() {
  const button = $('#trailerButton');
  const video = $('#trailerVideo');
  const placeholder = $('#trailerPlaceholder');

  if (book.trailer_file) {
    button.style.display = 'inline-flex';
    video.src = mediaUrl(book.trailer_file);
    video.poster = book.cover ? mediaUrl(book.cover) : '';
    video.classList.add('show');
    placeholder.style.display = 'none';
    button.onclick = () => openOverlay('trailerOverlay');
    return;
  }

  if (book.trailer_link) {
    button.style.display = 'inline-flex';
    video.classList.remove('show');
    placeholder.style.display = '';
    button.onclick = () => window.open(book.trailer_link, '_blank', 'noopener');
    return;
  }

  button.style.display = 'none';
}

function enterBackgroundView() {
  if (!backgroundLayers.length) return;
  document.body.classList.add('background-view-mode');
  $('#backgroundViewerControls').setAttribute('aria-hidden', 'false');
  $('#viewBackgroundsButton').setAttribute('aria-pressed', 'true');
  $('#viewBackgroundsButton').textContent = '×';
}

function exitBackgroundView() {
  document.body.classList.remove('background-view-mode');
  $('#backgroundViewerControls').setAttribute('aria-hidden', 'true');
  $('#viewBackgroundsButton').setAttribute('aria-pressed', 'false');
  $('#viewBackgroundsButton').textContent = '◫';
}

$('#viewBackgroundsButton').addEventListener('click', () => {
  if (document.body.classList.contains('background-view-mode')) exitBackgroundView();
  else enterBackgroundView();
});
function stepBackground(delta) {
  activateBackground(currentBackground + delta);
  restartBackgroundTimer();
}

$('#backgroundPrev').addEventListener('click', () => stepBackground(-1));
$('#backgroundNext').addEventListener('click', () => stepBackground(1));
document.addEventListener('keydown', (event) => {
  if (!document.body.classList.contains('background-view-mode')) return;
  if (event.key === 'Escape') exitBackgroundView();
  if (event.key === 'ArrowLeft') stepBackground(-1);
  if (event.key === 'ArrowRight') stepBackground(1);
});

function configureAdmin() {
  const isAdmin = auth.logged_in && auth.role === 'admin';
  $('#editBookButton').hidden = !isAdmin;
  $('#deleteBookButton').hidden = !isAdmin;
  if (!isAdmin) return;

  $('#editBookButton').addEventListener('click', () => {
    location.href = 'books.html?edit=' + encodeURIComponent(book.id);
  });

  let deleteArmed = false;
  let deleteTimer = null;
  $('#deleteBookButton').addEventListener('click', async () => {
    if (!deleteArmed) {
      deleteArmed = true;
      $('#deleteBookButton').textContent = 'Подтвердить удаление';
      toast('Нажмите кнопку ещё раз, чтобы удалить книгу полностью');
      clearTimeout(deleteTimer);
      deleteTimer = setTimeout(() => {
        deleteArmed = false;
        $('#deleteBookButton').textContent = 'Удалить';
      }, 3500);
      return;
    }

    clearTimeout(deleteTimer);
    try {
      const result = await api('delete_book', { book_id: book.id });
      if (!result.success) throw new Error('Удаление не выполнено');
      location.href = 'books.html';
    } catch {
      toast('Не удалось удалить книгу');
    }
  });
}

function populateBook() {
  document.title = book.title + ' — facehub';
  $('#bookTitleView').textContent = book.title;
  $('#bookDescriptionView').textContent = book.annotation || 'Описание книги появится здесь.';
  $('#readerBookTitle').textContent = book.title;
  $('#readerHeading').textContent = book.title;
  $('#audioBookTitle').textContent = book.title;
  $('#audioHeading').textContent = book.title;
  $('#trailerTitle').textContent = book.title;
  $('#audioCover').dataset.title = book.title;

  if (book.cover) {
    const cover = mediaUrl(book.cover);
    $('#audioCover').style.backgroundImage = 'url("' + cover + '")';
  }

  configureBackgrounds();
  configureMaterials();
  configureTrailer();
  configureAdmin();
}

function openOverlay(id) {
  $('#' + id).classList.add('show');
  $('#' + id).setAttribute('aria-hidden', 'false');
  if (id === 'trailerOverlay' && book.trailer_file) $('#trailerVideo').play().catch(() => {});
}

function closeOverlay(id) {
  $('#' + id).classList.remove('show');
  $('#' + id).setAttribute('aria-hidden', 'true');
  if (id === 'trailerOverlay') $('#trailerVideo').pause();
  if (id === 'audioOverlay' && nativeAudio) nativeAudio.pause();
}

function openAudio(path) {
  if (!nativeAudio) {
    nativeAudio = document.createElement('audio');
    nativeAudio.controls = true;
    nativeAudio.style.width = '100%';
    nativeAudio.style.marginTop = '16px';
    $('.audio-main').appendChild(nativeAudio);
  }
  nativeAudio.src = mediaUrl(path);
  openOverlay('audioOverlay');
  nativeAudio.play().catch(() => {});
}

document.querySelectorAll('[data-close]').forEach((button) => {
  button.addEventListener('click', () => closeOverlay(button.dataset.close));
});

$('#trailerOverlay').addEventListener('click', (event) => {
  if (event.target.closest('.trailer-frame')) return;
  closeOverlay('trailerOverlay');
});

let readerFont = 17;
$('#fontPlus').addEventListener('click', () => {
  readerFont = Math.min(24, readerFont + 1);
  document.querySelectorAll('.reader-page p').forEach((p) => p.style.fontSize = readerFont + 'px');
});
$('#fontMinus').addEventListener('click', () => {
  readerFont = Math.max(13, readerFont - 1);
  document.querySelectorAll('.reader-page p').forEach((p) => p.style.fontSize = readerFont + 'px');
});
$('#readerTheme').addEventListener('click', () => {
  $('#readerPage').classList.toggle('dark');
  $('#readerTheme').textContent = $('#readerPage').classList.contains('dark') ? 'Тёмная тема' : 'Светлая тема';
});

async function init() {
  if (!requestedId) {
    location.replace('books.html');
    return;
  }

  try {
    const [authData, details] = await Promise.all([
      api('check_auth').catch(() => ({ logged_in: false, role: 'guest' })),
      api('get_book_details', { book_id: requestedId })
    ]);

    auth = authData;
    if (!details.success || !details.book) throw new Error('Книга не найдена');
    book = details.book;
    backgrounds = Array.isArray(details.backgrounds) ? details.backgrounds : [];
    hasAccess = Boolean(details.has_access);
    populateBook();
  } catch (error) {
    toast(error.message || 'Не удалось загрузить книгу');
    setTimeout(() => location.replace('books.html'), 1200);
  }
}

init();
