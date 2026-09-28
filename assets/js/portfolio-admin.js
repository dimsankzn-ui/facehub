(() => {
  const $ = (selector) => document.querySelector(selector);
  let users = [];
  let books = [];
  let currentUserId = null;
  let currentUserData = null;
  let currentAccess = [];
  let permanentArmed = false;
  let permanentTimer = null;
  const revokeArmed = new Map();

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

    if (!response.ok) throw new Error(payload.message || 'Сервер недоступен');
    return payload;
  }

  function mediaUrl(path) {
    if (!path) return '';
    return new URL(path.replace(/^\//, ''), location.origin + '/').href;
  }

  function toast(message) {
    const node = $('#toast');
    if (!node) return;
    node.textContent = message;
    node.classList.add('show');
    clearTimeout(window.__portfolioAdminToast);
    window.__portfolioAdminToast = setTimeout(() => node.classList.remove('show'), 2200);
  }

  function roleLabel(role) {
    return role === 'admin' ? 'Владелец' : 'Читатель';
  }

  function fullName(user) {
    return [user.first_name, user.patronymic, user.last_name].filter(Boolean).join(' ').trim() || 'Без имени';
  }

  function initials(user) {
    const parts = [user.first_name, user.last_name].filter(Boolean);
    if (parts.length) return parts.map((part) => part.trim()[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
    return '•';
  }

  function dateOnly(value) {
    if (!value) return '—';
    const source = String(value).slice(0, 10);
    const parts = source.split('-');
    if (parts.length === 3) return [parts[2], parts[1], parts[0]].join('.');
    return source;
  }

  function dateTimeUtc(value) {
    if (!value) return '—';
    const normalized = String(value).includes('T') ? String(value) : String(value).replace(' ', 'T') + 'Z';
    const date = new Date(normalized);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString('ru-RU', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }

  function countLabel(count) {
    const n = Math.abs(count) % 100;
    const n1 = n % 10;
    if (n > 10 && n < 20) return count + ' пользователей';
    if (n1 === 1) return count + ' пользователь';
    if (n1 >= 2 && n1 <= 4) return count + ' пользователя';
    return count + ' пользователей';
  }

  function bookCountLabel(count) {
    const n = Math.abs(count) % 100;
    const n1 = n % 10;
    if (n > 10 && n < 20) return count + ' книг';
    if (n1 === 1) return count + ' книга';
    if (n1 >= 2 && n1 <= 4) return count + ' книги';
    return count + ' книг';
  }

  function createAvatar(user, className) {
    const avatar = document.createElement('div');
    avatar.className = className;
    const fallback = document.createElement('span');
    fallback.textContent = initials(user);
    avatar.appendChild(fallback);

    if (user.avatar_thumb || user.avatar_full) {
      const image = document.createElement('img');
      image.alt = '';
      image.src = mediaUrl(user.avatar_thumb || user.avatar_full);
      image.addEventListener('load', () => fallback.remove());
      image.addEventListener('error', () => image.remove());
      avatar.appendChild(image);
    }

    return avatar;
  }

  function card(user) {
    const root = document.createElement('article');
    root.className = 'user-card';
    root.tabIndex = 0;
    root.setAttribute('role', 'button');
    root.setAttribute('aria-label', 'Открыть карточку пользователя ' + fullName(user));
    root.dataset.userId = String(user.id);

    const avatar = createAvatar(user, 'user-card-avatar');

    const main = document.createElement('div');
    main.className = 'user-card-main';
    const name = document.createElement('strong');
    name.textContent = fullName(user);
    const mail = document.createElement('span');
    mail.textContent = user.email || '—';
    main.append(name, mail);

    const meta = document.createElement('div');
    meta.className = 'user-card-meta';
    const code = document.createElement('strong');
    code.textContent = user.user_code || '--------';
    const role = document.createElement('span');
    role.textContent = roleLabel(user.role);
    meta.append(code, role);

    const open = document.createElement('span');
    open.className = 'user-card-open';
    open.textContent = '→';

    root.append(avatar, main, meta, open);
    root.addEventListener('click', () => openUserModal(Number(user.id)));
    root.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      openUserModal(Number(user.id));
    });

    return root;
  }

  function infoItem(label, value) {
    const item = document.createElement('div');
    const small = document.createElement('span');
    small.textContent = label;
    const strong = document.createElement('strong');
    strong.textContent = value || '—';
    item.append(small, strong);
    return item;
  }

  function statItem(value, label) {
    const item = document.createElement('div');
    const strong = document.createElement('strong');
    strong.textContent = String(value ?? 0);
    const span = document.createElement('span');
    span.textContent = label;
    item.append(strong, span);
    return item;
  }

  function accessTypeLabel(item) {
    const type = item.access_type || 'gift';
    if (type === 'purchase') return 'Куплена';
    if (type === 'admin') return 'Доступ владельца';
    if (type === 'gift_permanent') return 'Подарена навсегда';
    if (type === 'gift_temporary') return Number(item.is_active) ? 'Временный подарок' : 'Срок истёк';
    return 'До отзыва';
  }

  function accessCaption(item) {
    const type = item.access_type || 'gift';
    if (type === 'gift_temporary') {
      return item.expires_at ? 'до ' + dateTimeUtc(item.expires_at) : 'срок не указан';
    }
    if (type === 'gift_permanent') return 'бессрочно, отзыв недоступен';
    if (type === 'purchase') return 'получена через покупку';
    if (type === 'admin') return 'доступна администратору';
    return item.granted_at ? 'выдано ' + dateTimeUtc(item.granted_at) : 'действует до ручного отзыва';
  }

  function canRevoke(item) {
    const type = item.access_type || 'gift';
    return !['purchase', 'gift_permanent', 'admin'].includes(type) && Number(item.access_id) > 0;
  }

  function renderAccessList() {
    const list = $('#adminAccessList');
    list.replaceChildren();

    const activeCount = currentAccess.filter((item) => Number(item.is_active) === 1).length;
    $('#adminAccessSummary').textContent = bookCountLabel(activeCount);
    $('#adminAccessEmpty').hidden = currentAccess.length > 0;

    currentAccess.forEach((item) => {
      const row = document.createElement('article');
      row.className = 'access-row';
      if (Number(item.is_active) !== 1) row.classList.add('expired');

      const cover = document.createElement('div');
      cover.className = 'access-book-cover';
      if (item.cover) {
        cover.style.backgroundImage = 'url("' + mediaUrl(item.cover) + '")';
      } else {
        cover.textContent = 'К';
      }

      const copy = document.createElement('div');
      copy.className = 'access-row-copy';
      const title = document.createElement('strong');
      title.textContent = item.title || 'Книга';
      const badge = document.createElement('span');
      badge.className = 'access-badge';
      if (item.access_type === 'gift_permanent' || item.access_type === 'purchase') badge.classList.add('locked');
      if (Number(item.is_active) !== 1) badge.classList.add('expired');
      badge.textContent = accessTypeLabel(item);
      const caption = document.createElement('small');
      caption.textContent = accessCaption(item);
      copy.append(title, badge, caption);

      row.append(cover, copy);

      if (canRevoke(item)) {
        const revoke = document.createElement('button');
        revoke.type = 'button';
        revoke.className = 'revoke-access';
        revoke.textContent = Number(item.is_active) === 1 ? 'Отозвать' : 'Удалить запись';
        revoke.addEventListener('click', () => revokeAccess(item, revoke));
        row.appendChild(revoke);
      } else {
        const lock = document.createElement('span');
        lock.className = 'access-lock';
        lock.textContent = '∞';
        lock.title = item.access_type === 'purchase' ? 'Покупка не отзывается' : 'Постоянный доступ';
        row.appendChild(lock);
      }

      list.appendChild(row);
    });

    refreshBookSelect();
  }

  function refreshBookSelect() {
    const select = $('#giftBookSelect');
    const previous = select.value;
    select.replaceChildren();

    const protectedBookIds = new Set(
      currentAccess
        .filter((item) => ['purchase', 'gift_permanent', 'admin'].includes(item.access_type))
        .map((item) => Number(item.book_id))
    );

    books.forEach((book) => {
      const option = document.createElement('option');
      option.value = String(book.id);
      option.textContent = book.title || 'Без названия';
      option.disabled = protectedBookIds.has(Number(book.id));
      if (option.disabled) option.textContent += ' · уже навсегда';
      select.appendChild(option);
    });

    if (previous && [...select.options].some((option) => option.value === previous && !option.disabled)) {
      select.value = previous;
    } else {
      const firstAvailable = [...select.options].find((option) => !option.disabled);
      if (firstAvailable) select.value = firstAvailable.value;
    }

    const disabled = currentUserData?.role === 'admin' || ![...select.options].some((option) => !option.disabled);
    select.disabled = disabled;
    $('#giftSubmitButton').disabled = disabled;
  }

  function renderUserDetails(data) {
    currentUserData = data.user;
    currentAccess = Array.isArray(data.access_list) ? data.access_list : [];

    $('#adminUserName').textContent = fullName(data.user);
    $('#adminUserEmail').textContent = data.user.email || '—';
    $('#adminUserRole').textContent = roleLabel(data.user.role);
    $('#adminUserCode').textContent = data.user.user_code || '--------';

    const avatarHost = $('#adminUserAvatar');
    avatarHost.replaceWith(createAvatar(data.user, 'user-admin-avatar'));
    const replacement = document.querySelector('.user-admin-avatar');
    replacement.id = 'adminUserAvatar';

    const info = $('#adminUserInfo');
    info.replaceChildren(
      infoItem('ID записи', String(data.user.id ?? '—')),
      infoItem('Имя', data.user.first_name || '—'),
      infoItem('Отчество', data.user.patronymic || '—'),
      infoItem('Фамилия', data.user.last_name || '—'),
      infoItem('Email', data.user.email || '—'),
      infoItem('Роль', roleLabel(data.user.role)),
      infoItem('Дата рождения', data.user.dob || '—'),
      infoItem('Город', data.user.city || '—'),
      infoItem('Дата регистрации', dateTimeUtc(data.user.created_at)),
      infoItem('Персональный ID', data.user.user_code || '—')
    );

    const stats = $('#adminUserStats');
    stats.replaceChildren(
      statItem(data.stats?.comments_count, 'Комментариев'),
      statItem(data.stats?.books_access, 'Доступных книг'),
      statItem(data.stats?.blogs_written, 'Публикаций')
    );

    const giftForm = $('#giftBookForm');
    if (data.user.role === 'admin') {
      giftForm.classList.add('disabled-form');
      $('#giftHint').textContent = 'Владелец уже имеет полный доступ ко всем книгам.';
    } else {
      giftForm.classList.remove('disabled-form');
      updateGiftModeUi();
    }

    renderAccessList();
  }

  async function openUserModal(userId) {
    currentUserId = userId;
    permanentArmed = false;
    clearTimeout(permanentTimer);

    const modal = $('#userAdminModal');
    modal.classList.add('show');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('user-modal-open');

    $('#adminUserName').textContent = 'Загрузка…';
    $('#adminUserEmail').textContent = '—';
    $('#adminUserInfo').replaceChildren();
    $('#adminUserStats').replaceChildren();
    $('#adminAccessList').replaceChildren();
    $('#adminAccessEmpty').hidden = true;

    try {
      const data = await api('get_user_stats', { user_id: String(userId) });
      if (!data.success || !data.user) throw new Error(data.message || 'Не удалось загрузить пользователя');
      renderUserDetails(data);
    } catch (error) {
      toast(error.message || 'Не удалось открыть карточку пользователя');
      closeUserModal();
    }
  }

  function closeUserModal() {
    $('#userAdminModal').classList.remove('show');
    $('#userAdminModal').setAttribute('aria-hidden', 'true');
    document.body.classList.remove('user-modal-open');
    currentUserId = null;
    currentUserData = null;
    currentAccess = [];
    permanentArmed = false;
    clearTimeout(permanentTimer);
  }

  function localDateTimeValue(date) {
    const pad = (n) => String(n).padStart(2, '0');
    return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate()) + 'T' + pad(date.getHours()) + ':' + pad(date.getMinutes());
  }

  function ensureTemporaryDefault() {
    if ($('#giftExpiresAt').value) return;
    const date = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    date.setMinutes(Math.ceil(date.getMinutes() / 5) * 5, 0, 0);
    $('#giftExpiresAt').value = localDateTimeValue(date);
  }

  function updateGiftModeUi() {
    const mode = $('#giftModeSelect').value;
    const expiry = $('#giftExpiryField');
    expiry.hidden = mode !== 'temporary';
    $('#giftExpiresAt').required = mode === 'temporary';

    if (mode === 'temporary') {
      ensureTemporaryDefault();
      $('#giftHint').textContent = 'После указанной даты доступ отключится автоматически. Его можно отозвать и раньше.';
    } else if (mode === 'permanent') {
      $('#giftHint').textContent = 'Подарок навсегда не получится отозвать через интерфейс.';
    } else {
      $('#giftHint').textContent = 'Доступ будет действовать, пока вы его не отзовёте.';
    }

    permanentArmed = false;
    clearTimeout(permanentTimer);
    $('#giftSubmitButton').textContent = 'Подарить книгу';
  }

  async function refreshCurrentUser() {
    if (!currentUserId) return;
    const data = await api('get_user_stats', { user_id: String(currentUserId) });
    if (!data.success) throw new Error(data.message || 'Не удалось обновить карточку');
    renderUserDetails(data);
  }

  async function revokeAccess(item, button) {
    const key = String(item.access_id);
    if (!revokeArmed.has(key)) {
      button.textContent = 'Подтвердить отзыв';
      const timer = setTimeout(() => {
        revokeArmed.delete(key);
        if (button.isConnected) button.textContent = Number(item.is_active) === 1 ? 'Отозвать' : 'Удалить запись';
      }, 3200);
      revokeArmed.set(key, timer);
      return;
    }

    clearTimeout(revokeArmed.get(key));
    revokeArmed.delete(key);
    button.disabled = true;

    try {
      const result = await api('revoke_access', { access_id: key });
      if (!result.success) throw new Error(result.message || 'Не удалось отозвать доступ');
      await refreshCurrentUser();
      toast('Доступ к книге отозван');
    } catch (error) {
      button.disabled = false;
      button.textContent = 'Отозвать';
      toast(error.message || 'Не удалось отозвать доступ');
    }
  }

  $('#giftModeSelect').addEventListener('change', updateGiftModeUi);

  $('#giftBookForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!currentUserId || currentUserData?.role === 'admin') return;

    const bookId = Number($('#giftBookSelect').value);
    const mode = $('#giftModeSelect').value;
    const button = $('#giftSubmitButton');
    if (!bookId) return;

    let expiresAt = '';
    if (mode === 'temporary') {
      const raw = $('#giftExpiresAt').value;
      if (!raw) {
        toast('Укажите дату окончания подарка');
        return;
      }
      const date = new Date(raw);
      if (Number.isNaN(date.getTime()) || date.getTime() <= Date.now()) {
        toast('Дата окончания должна быть в будущем');
        return;
      }
      expiresAt = date.toISOString();
    }

    if (mode === 'permanent' && !permanentArmed) {
      permanentArmed = true;
      button.textContent = 'Подтвердить навсегда';
      toast('Повторите нажатие: этот подарок нельзя будет отозвать');
      permanentTimer = setTimeout(() => {
        permanentArmed = false;
        if (button.isConnected) button.textContent = 'Подарить книгу';
      }, 4500);
      return;
    }

    button.disabled = true;
    button.textContent = 'Сохраняю…';

    try {
      const result = await api('grant_access', {
        user_id: String(currentUserId),
        book_id: String(bookId),
        gift_mode: mode,
        expires_at: expiresAt
      });
      if (!result.success) throw new Error(result.message || 'Не удалось подарить книгу');

      permanentArmed = false;
      clearTimeout(permanentTimer);
      await refreshCurrentUser();
      toast(mode === 'permanent' ? 'Книга подарена навсегда' : 'Доступ к книге выдан');
    } catch (error) {
      toast(error.message || 'Не удалось подарить книгу');
    } finally {
      updateGiftModeUi();
      refreshBookSelect();
    }
  });

  $('#userAdminClose').addEventListener('click', closeUserModal);
  $('#userAdminModal').addEventListener('click', (event) => {
    if (event.target.id === 'userAdminModal') closeUserModal();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && $('#userAdminModal').classList.contains('show')) closeUserModal();
  });

  async function load() {
    try {
      const auth = await api('check_auth');
      if (!auth.logged_in || auth.role !== 'admin') return;

      const [usersData, booksData] = await Promise.all([
        api('get_all_users'),
        api('get_books')
      ]);

      if (!usersData.success || !Array.isArray(usersData.users)) return;
      users = usersData.users;
      books = booksData.success && Array.isArray(booksData.books) ? booksData.books : [];

      $('#usersList').replaceChildren(...users.map(card));
      $('#usersCount').textContent = countLabel(users.length);
      $('#adminUsers').hidden = false;
      updateGiftModeUi();

      if (new URLSearchParams(location.search).get('admin') === 'users') {
        setTimeout(() => $('#adminUsers').scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
      }
    } catch {
      // Административный блок остаётся скрытым при недоступности API.
    }
  }

  load();
})();