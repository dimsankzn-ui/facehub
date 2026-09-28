const $ = (selector) => document.querySelector(selector);

let auth = { logged_in: false, role: 'guest' };
let poems = [];
let selectedYear = null;
let selectedPoemId = null;
let editingPoemId = null;
let searchQuery = '';
let deleteArmed = false;
let deleteTimer = null;

function isOwner() {
  return auth.logged_in && auth.role === 'admin';
}

async function api(action, data = {}) {
  const response = await fetch('api.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    credentials: 'same-origin',
    body: new URLSearchParams({ action, ...data }).toString()
  });

  let payload = {};
  try { payload = await response.json(); }
  catch { payload = { success: false, message: 'Некорректный ответ сервера' }; }

  if (!response.ok) throw new Error(payload.message || 'Ошибка сервера');
  return payload;
}

function toast(message) {
  const node = $('#toast');
  node.textContent = message;
  node.classList.add('show');
  clearTimeout(window.__poetryToast);
  window.__poetryToast = setTimeout(() => node.classList.remove('show'), 1900);
}

function normalizePoem(row) {
  return {
    id: Number(row.id),
    title: row.title || '',
    year: Number(row.year),
    month: row.month === null || row.month === '' ? null : Number(row.month),
    day: row.day === null || row.day === '' ? null : Number(row.day),
    text: row.content || '',
    created_at: row.created_at || '',
    updated_at: row.updated_at || ''
  };
}

function formatDate(poem) {
  const monthsGenitive = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
  const monthsNominative = ['январь','февраль','март','апрель','май','июнь','июль','август','сентябрь','октябрь','ноябрь','декабрь'];
  const month = Number(poem.month);
  const day = Number(poem.day);
  const year = poem.year;

  if (day && month >= 1 && month <= 12) return day + ' ' + monthsGenitive[month - 1] + ' ' + year;
  if (month >= 1 && month <= 12) return monthsNominative[month - 1] + ' ' + year;
  return String(year);
}

function sortPoems(items) {
  return [...items].sort((a, b) => {
    const da = [Number(a.year) || 0, Number(a.month) || 0, Number(a.day) || 0, Number(a.id) || 0];
    const db = [Number(b.year) || 0, Number(b.month) || 0, Number(b.day) || 0, Number(b.id) || 0];
    return db[0] - da[0] || db[1] - da[1] || db[2] - da[2] || db[3] - da[3];
  });
}

function filteredPoems() {
  const list = sortPoems(poems);
  if (!searchQuery) return list;
  const query = searchQuery.toLowerCase();
  return list.filter((poem) => ((poem.title || '') + ' ' + (poem.text || '')).toLowerCase().includes(query));
}

function yearsFrom(items) {
  return [...new Set(items.map((poem) => String(poem.year)))].sort((a, b) => Number(b) - Number(a));
}

function countPoems(count) {
  const n = Math.abs(count) % 100;
  const n1 = n % 10;
  if (n > 10 && n < 20) return count + ' стихов';
  if (n1 === 1) return count + ' стих';
  if (n1 >= 2 && n1 <= 4) return count + ' стиха';
  return count + ' стихов';
}

function render() {
  const all = filteredPoems();
  const years = yearsFrom(all);

  if (!selectedYear || !years.includes(String(selectedYear))) {
    selectedYear = years[0] || null;
  }

  const yearList = $('#yearList');
  yearList.replaceChildren();

  years.slice(0, 8).forEach((year) => {
    const count = all.filter((poem) => String(poem.year) === year).length;
    const button = document.createElement('button');
    button.className = 'year' + (String(selectedYear) === year ? ' active' : '');

    const label = document.createElement('span');
    label.textContent = year;
    const total = document.createElement('small');
    total.textContent = count;
    button.append(label, total);

    button.addEventListener('click', () => {
      selectedYear = year;
      selectedPoemId = null;
      render();
    });

    yearList.appendChild(button);
  });

  $('#yearTotal').textContent = countPoems(all.length) + ' · ' + years.length + (years.length === 1 ? ' год' : ' лет');

  const yearPoems = all.filter((poem) => String(poem.year) === String(selectedYear));
  if (!selectedPoemId || !yearPoems.some((poem) => Number(poem.id) === Number(selectedPoemId))) {
    selectedPoemId = yearPoems[0]?.id || null;
  }

  const selected = yearPoems.find((poem) => Number(poem.id) === Number(selectedPoemId)) || null;
  $('#panelYear').textContent = selectedYear || '—';
  $('#panelCount').textContent = countPoems(yearPoems.length);
  $('#listEmpty').classList.toggle('show', yearPoems.length === 0);

  const list = $('#poemList');
  list.replaceChildren();

  yearPoems.slice(0, 7).forEach((poem) => {
    const item = document.createElement('article');
    item.className = 'poem-item' + (Number(poem.id) === Number(selectedPoemId) ? ' active' : '');

    const time = document.createElement('time');
    time.textContent = formatDate(poem).replace(String(poem.year), '').trim() || String(poem.year);

    const edit = document.createElement('button');
    edit.className = 'edit-badge';
    edit.type = 'button';
    edit.textContent = '✎';
    edit.title = 'Редактировать';
    edit.addEventListener('click', (event) => {
      event.stopPropagation();
      openEdit(poem.id);
    });

    const title = document.createElement('strong');
    title.textContent = poem.title?.trim() || 'Без названия';

    const preview = document.createElement('p');
    preview.textContent = (poem.text || '').replace(/\s+/g, ' ').trim();

    item.append(time, edit, title, preview);
    item.addEventListener('click', () => {
      selectedPoemId = poem.id;
      render();
    });
    list.appendChild(item);
  });

  if (selected) {
    $('#readerDate').textContent = formatDate(selected);
    $('#readerTitle').textContent = selected.title?.trim() || 'Без названия';
    $('#readerText').textContent = selected.text;
    const lines = selected.text.split(/\n/).filter((line) => line.trim()).length;
    $('#readerMeta').textContent = lines + ' строк · ' + selected.year;
  } else {
    $('#readerDate').textContent = '—';
    $('#readerTitle').textContent = searchQuery ? 'Ничего не найдено' : 'Стихов пока нет';
    $('#readerText').textContent = searchQuery
      ? 'Попробуйте изменить запрос.'
      : 'Добавленные стихи будут отображаться здесь.';
    $('#readerMeta').textContent = '—';
  }

  $('#editPoem').disabled = !selected;
  $('#nextPoem').disabled = yearPoems.length < 2;
}

function resetForm() {
  editingPoemId = null;
  deleteArmed = false;
  clearTimeout(deleteTimer);
  $('#poemForm').reset();
  $('#poemYearInput').value = new Date().getFullYear();
  $('#poemKicker').textContent = 'Новый текст';
  $('#poemModalTitle').textContent = 'Добавить стих';
  $('#savePoemButton').textContent = 'Добавить стих';
  $('#deletePoemButton').hidden = true;
  $('#deletePoemButton').textContent = 'Удалить';
}

function openModal() {
  $('#poemModal').classList.add('show');
  $('#poemModal').setAttribute('aria-hidden', 'false');
}

function closeModal() {
  $('#poemModal').classList.remove('show');
  $('#poemModal').setAttribute('aria-hidden', 'true');
}

$('#openAddPoem').addEventListener('click', () => {
  if (!isOwner()) return;
  resetForm();
  openModal();
});

document.querySelectorAll('[data-close]').forEach((button) => {
  button.addEventListener('click', closeModal);
});

$('#poemModal').addEventListener('click', (event) => {
  if (event.target.id === 'poemModal') closeModal();
});

function openEdit(id) {
  if (!isOwner()) return;
  const poem = poems.find((item) => Number(item.id) === Number(id));
  if (!poem) return;

  resetForm();
  editingPoemId = Number(id);
  $('#poemKicker').textContent = 'Редактирование';
  $('#poemModalTitle').textContent = 'Редактировать стих';
  $('#savePoemButton').textContent = 'Сохранить';
  $('#deletePoemButton').hidden = false;
  $('#poemTitleInput').value = poem.title || '';
  $('#poemYearInput').value = poem.year || '';
  $('#poemMonthInput').value = poem.month || '';
  $('#poemDayInput').value = poem.day || '';
  $('#poemTextInput').value = poem.text || '';
  openModal();
}

$('#editPoem').addEventListener('click', () => {
  if (selectedPoemId) openEdit(selectedPoemId);
});

$('#poemForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!isOwner()) return;

  const year = Number($('#poemYearInput').value);
  const month = $('#poemMonthInput').value.trim();
  const day = $('#poemDayInput').value.trim();
  const content = $('#poemTextInput').value.trim();
  if (!year || !content) return;

  const button = $('#savePoemButton');
  button.disabled = true;
  const oldText = button.textContent;
  button.textContent = 'Сохраняю…';

  try {
    const result = await api('save_poem', {
      mode: editingPoemId ? 'edit' : 'add',
      id: editingPoemId ? String(editingPoemId) : '',
      title: $('#poemTitleInput').value.trim(),
      year: String(year),
      month,
      day,
      content
    });

    if (!result.success) throw new Error(result.message || 'Не удалось сохранить стих');

    selectedYear = String(year);
    selectedPoemId = Number(result.poem_id);
    await loadPoems();
    closeModal();
    toast(editingPoemId ? 'Стих обновлён' : 'Стих добавлен');
  } catch (error) {
    toast(error.message || 'Ошибка сохранения');
  } finally {
    button.disabled = false;
    button.textContent = oldText;
  }
});

$('#deletePoemButton').addEventListener('click', async () => {
  if (!isOwner() || !editingPoemId) return;

  if (!deleteArmed) {
    deleteArmed = true;
    $('#deletePoemButton').textContent = 'Подтвердить удаление';
    deleteTimer = setTimeout(() => {
      deleteArmed = false;
      $('#deletePoemButton').textContent = 'Удалить';
    }, 3500);
    return;
  }

  const button = $('#deletePoemButton');
  button.disabled = true;

  try {
    const result = await api('delete_poem', { id: String(editingPoemId) });
    if (!result.success) throw new Error(result.message || 'Не удалось удалить стих');

    selectedPoemId = null;
    editingPoemId = null;
    await loadPoems();
    closeModal();
    toast('Стих удалён');
  } catch (error) {
    toast(error.message || 'Ошибка удаления');
  } finally {
    button.disabled = false;
    deleteArmed = false;
    clearTimeout(deleteTimer);
    button.textContent = 'Удалить';
  }
});

$('#poetrySearch').addEventListener('input', (event) => {
  searchQuery = event.target.value.trim();
  selectedYear = null;
  selectedPoemId = null;
  render();
});

$('#nextPoem').addEventListener('click', () => {
  const list = filteredPoems().filter((poem) => String(poem.year) === String(selectedYear));
  if (list.length < 2) return;
  const index = list.findIndex((poem) => Number(poem.id) === Number(selectedPoemId));
  selectedPoemId = list[(index + 1) % list.length].id;
  render();
});

$('#sharePoem').addEventListener('click', async () => {
  const poem = poems.find((item) => Number(item.id) === Number(selectedPoemId));
  if (!poem) return;

  const text = (poem.title ? poem.title + '\n\n' : '') + poem.text;
  try {
    if (navigator.share) await navigator.share({ title: poem.title || 'Стих', text });
    else {
      await navigator.clipboard.writeText(text);
      toast('Стих скопирован');
    }
  } catch {}
});

async function loadPoems() {
  const data = await api('get_poems');
  if (!data.success) throw new Error(data.message || 'Не удалось загрузить стихи');
  poems = Array.isArray(data.poems) ? data.poems.map(normalizePoem) : [];
  render();
}

async function init() {
  try {
    auth = await api('check_auth');
  } catch {
    auth = { logged_in: false, role: 'guest' };
  }

  document.body.classList.toggle('is-owner', isOwner());

  try {
    await loadPoems();
  } catch (error) {
    poems = [];
    render();
    toast(error.message || 'Не удалось загрузить стихи');
  }

  if (isOwner() && new URLSearchParams(location.search).get('new') === '1') {
    resetForm();
    openModal();
  }
}

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && $('#poemModal').classList.contains('show')) closeModal();
});

init();
