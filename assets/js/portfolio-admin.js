(() => {
  const $ = (selector) => document.querySelector(selector);

  async function api(action) {
    const response = await fetch('api.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      credentials: 'same-origin',
      body: new URLSearchParams({ action }).toString()
    });
    if (!response.ok) throw new Error('Недоступно');
    return response.json();
  }

  function mediaUrl(path) {
    if (!path) return '';
    return new URL(path.replace(/^\//, ''), location.origin + '/').href;
  }

  function initials(user) {
    const parts = [user.first_name, user.last_name].filter(Boolean);
    if (parts.length) return parts.map((part) => part.trim()[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
    return (user.email || 'П').slice(0, 2).toUpperCase();
  }

  function roleLabel(role) {
    return role === 'admin' ? 'Владелец' : 'Читатель';
  }

  function dateLabel(value) {
    if (!value) return '—';
    const parts = String(value).slice(0, 10).split('-');
    return parts.length === 3 ? [parts[2], parts[1], parts[0]].join('.') : value;
  }

  function countLabel(count) {
    const n = Math.abs(count) % 100;
    const n1 = n % 10;
    if (n > 10 && n < 20) return count + ' пользователей';
    if (n1 === 1) return count + ' пользователь';
    if (n1 >= 2 && n1 <= 4) return count + ' пользователя';
    return count + ' пользователей';
  }

  function detail(container, label, value) {
    if (!value) return;
    const node = document.createElement('span');
    const strong = document.createElement('b');
    strong.textContent = label + ': ';
    node.append(strong, document.createTextNode(value));
    container.appendChild(node);
  }

  function card(user) {
    const root = document.createElement('article');
    root.className = 'user-card';

    const avatar = document.createElement('div');
    avatar.className = 'user-card-avatar';
    avatar.textContent = initials(user);
    if (user.avatar_thumb) {
      const image = document.createElement('img');
      image.alt = '';
      image.src = mediaUrl(user.avatar_thumb);
      image.addEventListener('error', () => image.remove());
      avatar.appendChild(image);
    }

    const main = document.createElement('div');
    main.className = 'user-card-main';
    const name = document.createElement('strong');
    name.textContent = [user.first_name, user.patronymic, user.last_name].filter(Boolean).join(' ').trim() || 'Без имени';
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

    const details = document.createElement('div');
    details.className = 'user-card-details';
    detail(details, 'ID', String(user.id ?? '—'));
    detail(details, 'Город', user.city || '');
    detail(details, 'Дата рождения', user.dob || '');
    detail(details, 'Регистрация', dateLabel(user.created_at));

    root.append(avatar, main, meta, details);
    return root;
  }

  async function load() {
    try {
      const auth = await api('check_auth');
      if (!auth.logged_in || auth.role !== 'admin') return;

      const data = await api('get_all_users');
      if (!data.success || !Array.isArray(data.users)) return;

      $('#usersList').replaceChildren(...data.users.map(card));
      $('#usersCount').textContent = countLabel(data.users.length);
      $('#adminUsers').hidden = false;
    } catch {
      // Блок остаётся скрытым.
    }
  }

  load();
})();
