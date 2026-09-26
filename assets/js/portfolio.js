const $ = (selector) => document.querySelector(selector);
let currentUser = null;
let fullAvatarUrl = '';

async function api(action, data = {}) {
  const response = await fetch('api.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    credentials: 'same-origin',
    body: new URLSearchParams({ action, ...data }).toString()
  });
  if (!response.ok) throw new Error('Сервер профиля недоступен');
  return response.json();
}

async function apiForm(formData) {
  const response = await fetch('api.php', {
    method: 'POST',
    credentials: 'same-origin',
    body: formData
  });
  if (!response.ok) throw new Error('Не удалось загрузить фотографию');
  return response.json();
}

function mediaUrl(path) {
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;
  return new URL(path.replace(/^\//, ''), location.origin + '/').href;
}

function toast(message) {
  const node = $('#toast');
  node.textContent = message;
  node.classList.add('show');
  clearTimeout(window.__portfolioToast);
  window.__portfolioToast = setTimeout(() => node.classList.remove('show'), 1900);
}

function roleLabel(role) {
  return role === 'admin' ? 'Владелец' : 'Читатель';
}

function formatCreated(value) {
  if (!value) return '—';
  const date = String(value).slice(0, 10).split('-');
  if (date.length !== 3) return value;
  return [date[2], date[1], date[0]].join('.');
}

function getInitials(user) {
  const parts = [user.first_name, user.last_name].filter(Boolean);
  if (!parts.length && user.email) return user.email.slice(0, 2).toUpperCase();
  return parts.map((part) => part.trim()[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || 'ДС';
}

function setAvatar(path) {
  const img = $('#profileAvatar');
  const url = mediaUrl(path);
  if (!url) {
    img.classList.remove('loaded');
    img.removeAttribute('src');
    return;
  }
  img.onload = () => img.classList.add('loaded');
  img.onerror = () => img.classList.remove('loaded');
  img.src = url + (url.includes('?') ? '&' : '?') + 't=' + Date.now();
}function renderProfile(user) {
  currentUser = user;
  const fullName = [user.first_name, user.patronymic, user.last_name].filter(Boolean).join(' ').trim();
  const displayName = fullName || user.email || 'Профиль';

  $('#displayName').textContent = displayName;
  $('#displayEmail').textContent = user.email || '—';
  $('#roleLabel').textContent = roleLabel(user.role);
  $('#avatarFallback').textContent = getInitials(user);

  $('#firstName').value = user.first_name || '';
  $('#lastName').value = user.last_name || '';
  $('#patronymic').value = user.patronymic || '';
  $('#dob').value = user.dob || '';
  $('#city').value = user.city || '';

  $('#accountEmail').textContent = user.email || '—';
  $('#accountId').textContent = user.id ?? '—';
  $('#accountRole').textContent = roleLabel(user.role);
  $('#createdAt').textContent = formatCreated(user.created_at);
  $('#userCode').textContent = user.user_code || '--------';

  setAvatar(user.avatar_thumb);
  fullAvatarUrl = mediaUrl(user.avatar_full || user.avatar_thumb);
  $('#profileState').textContent = 'Профиль загружен';
}

async function loadProfile() {
  try {
    const auth = await api('check_auth');
    if (!auth.logged_in) {
      location.replace('auth.html');
      return;
    }

    sessionStorage.setItem('facehubDemoRole', auth.role === 'admin' ? 'owner' : 'user');
    sessionStorage.setItem('facehubDemoEmail', auth.email || '');

    const data = await api('get_profile');
    if (!data.success || !data.user) throw new Error('Профиль не найден');
    renderProfile(data.user);
  } catch {
    $('#profileState').textContent = 'Не удалось загрузить профиль';
    toast('Не удалось загрузить данные профиля');
  }
}function formatDob(input) {
  const digits = input.value.replace(/\D/g, '').slice(0, 8);
  if (digits.length >= 5) input.value = digits.slice(0, 2) + '.' + digits.slice(2, 4) + '.' + digits.slice(4);
  else if (digits.length >= 3) input.value = digits.slice(0, 2) + '.' + digits.slice(2);
  else input.value = digits;
}

$('#dob').addEventListener('input', (event) => formatDob(event.target));

$('#profileForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = $('#profileForm button[type="submit"]');
  const message = $('#formMessage');
  button.disabled = true;
  message.className = 'form-message';
  message.textContent = 'Сохраняю…';

  try {
    const result = await api('update_profile', {
      first_name: $('#firstName').value.trim(),
      last_name: $('#lastName').value.trim(),
      patronymic: $('#patronymic').value.trim(),
      dob: $('#dob').value.trim(),
      city: $('#city').value.trim()
    });
    if (!result.success) throw new Error(result.message || 'Не удалось сохранить');

    const refreshed = await api('get_profile');
    if (refreshed.success && refreshed.user) renderProfile(refreshed.user);
    message.className = 'form-message success';
    message.textContent = 'Изменения сохранены';
  } catch (error) {
    message.className = 'form-message error';
    message.textContent = error.message || 'Ошибка сохранения';
  } finally {
    button.disabled = false;
  }
});$('#copyUserCode').addEventListener('click', async () => {
  const code = currentUser?.user_code;
  if (!code) return;
  try {
    await navigator.clipboard.writeText(code);
    toast('ID скопирован');
  } catch {
    toast('Не удалось скопировать ID');
  }
});

function createSquareThumb(file) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);

    image.onload = () => {
      const size = Math.min(image.naturalWidth, image.naturalHeight);
      const sx = (image.naturalWidth - size) / 2;
      const sy = (image.naturalHeight - size) / 2;
      const canvas = document.createElement('canvas');
      canvas.width = 400;
      canvas.height = 400;
      canvas.getContext('2d').drawImage(image, sx, sy, size, size, 0, 0, 400, 400);
      URL.revokeObjectURL(objectUrl);
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Не удалось обработать фото')), 'image/png', .92);
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Не удалось открыть изображение'));
    };
    image.src = objectUrl;
  });
}$('#avatarInput').addEventListener('change', async (event) => {
  const file = event.target.files?.[0];
  event.target.value = '';
  if (!file) return;

  if (!/^image\/(jpeg|png|webp)$/i.test(file.type)) {
    toast('Поддерживаются JPG, PNG и WebP');
    return;
  }
  if (file.size > 10 * 1024 * 1024) {
    toast('Файл должен быть меньше 10 МБ');
    return;
  }

  $('#profileState').textContent = 'Загружаю фотографию…';
  try {
    const thumb = await createSquareThumb(file);
    const formData = new FormData();
    formData.append('action', 'upload_avatar');
    formData.append('original', file);
    formData.append('thumb', thumb, 'thumb.png');

    const result = await apiForm(formData);
    if (!result.success) throw new Error(result.message || 'Ошибка загрузки');

    currentUser.avatar_thumb = result.avatar_thumb;
    currentUser.avatar_full = result.avatar_full;
    setAvatar(result.avatar_thumb);
    fullAvatarUrl = mediaUrl(result.avatar_full);
    $('#profileState').textContent = 'Фотография обновлена';
    toast('Фотография обновлена');
  } catch (error) {
    $('#profileState').textContent = 'Не удалось обновить фотографию';
    toast(error.message || 'Ошибка загрузки фото');
  }
});$('#avatarOpen').addEventListener('click', () => {
  if (!fullAvatarUrl) return;
  $('#fullAvatar').src = fullAvatarUrl + (fullAvatarUrl.includes('?') ? '&' : '?') + 't=' + Date.now();
  $('#imageModal').classList.add('show');
  $('#imageModal').setAttribute('aria-hidden', 'false');
});

function closeImageModal() {
  $('#imageModal').classList.remove('show');
  $('#imageModal').setAttribute('aria-hidden', 'true');
}

$('#imageModalClose').addEventListener('click', closeImageModal);
$('#imageModal').addEventListener('click', (event) => {
  if (event.target.id === 'imageModal') closeImageModal();
});

$('#logoutButton').addEventListener('click', async () => {
  try {
    await api('logout');
  } finally {
    sessionStorage.removeItem('facehubDemoRole');
    sessionStorage.removeItem('facehubDemoEmail');
    location.replace('auth.html');
  }
});

loadProfile();
