const $ = (selector) => document.querySelector(selector);

function switchTab(name) {
  const app = document.querySelector('.auth-app');
  const card = document.querySelector('.auth-card');
  const first = card.getBoundingClientRect();

  document.querySelectorAll('.tab').forEach((tab) => {
    const active = tab.dataset.tab === name;
    tab.classList.toggle('active', active);
    tab.setAttribute('aria-selected', String(active));
  });

  document.querySelectorAll('.form-view').forEach((view) => {
    view.classList.toggle('active', view.id === 'form-' + name);
  });

  app.classList.toggle('register-mode', name === 'register');

  requestAnimationFrame(() => {
    const last = card.getBoundingClientRect();
    const dx = first.left - last.left;
    const dy = first.top - last.top;
    const sx = first.width / last.width;
    const sy = first.height / last.height;

    card.animate(
      [
        {
          transform: `translate(${dx}px,${dy}px) scale(${sx},${sy})`,
          transformOrigin: 'top left'
        },
        {
          transform: 'translate(0,0) scale(1,1)',
          transformOrigin: 'top left'
        }
      ],
      {
        duration: 520,
        easing: 'cubic-bezier(.2,.8,.2,1)'
      }
    );
  });
}

function setMessage(id, text, type = '') {
  const node = $('#' + id);
  node.textContent = text;
  node.className = 'form-message' + (type ? ' ' + type : '');
}

function toast(message) {
  const node = $('#toast');
  node.textContent = message;
  node.classList.add('show');
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => node.classList.remove('show'), 2200);
}

document.querySelectorAll('.tab').forEach((tab) => {
  tab.addEventListener('click', () => switchTab(tab.dataset.tab));
});

document.querySelectorAll('[data-switch]').forEach((button) => {
  button.addEventListener('click', () => switchTab(button.dataset.switch));
});

document.querySelectorAll('.password-toggle').forEach((button) => {
  button.addEventListener('click', () => {
    const input = $('#' + button.dataset.target);
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    button.textContent = show ? 'Скрыть' : 'Показать';
    button.setAttribute('aria-label', show ? 'Скрыть пароль' : 'Показать пароль');
  });
});

$('#forgotButton').addEventListener('click', () => {
  toast('Восстановление пароля будет подключено вместе с серверной авторизацией');
});

$('#consentOpen').addEventListener('click', () => {
  $('#consentDialog').classList.add('show');
  $('#consentDialog').setAttribute('aria-hidden', 'false');
});

$('#consentClose').addEventListener('click', () => {
  $('#consentDialog').classList.remove('show');
  $('#consentDialog').setAttribute('aria-hidden', 'true');
});

$('#consentDialog').addEventListener('click', (event) => {
  if (event.target.id === 'consentDialog') {
    $('#consentClose').click();
  }
});

$('#loginForm').addEventListener('submit', (event) => {
  event.preventDefault();
  const email = $('#loginEmail').value.trim().toLowerCase();
  const password = $('#loginPassword').value;

  if (!email || !password) {
    setMessage('loginMessage', 'Заполните электронную почту и пароль.', 'error');
    return;
  }

  setMessage('loginMessage', 'Вход выполнен. Открываю личное пространство…', 'success');

  if (email === 'dimsan.kzn@gmail.com') {
    sessionStorage.setItem('facehubDemoRole', 'owner');
    setTimeout(() => location.href = 'index.html', 450);
    return;
  }

  sessionStorage.setItem('facehubDemoRole', 'user');
  sessionStorage.setItem('facehubDemoEmail', email);
  setTimeout(() => location.href = 'index.html', 450);
});

$('#registerForm').addEventListener('submit', (event) => {
  event.preventDefault();

  const name = $('#registerName').value.trim();
  const email = $('#registerEmail').value.trim().toLowerCase();
  const password = $('#registerPassword').value;
  const repeat = $('#registerPasswordRepeat').value;
  const consent = $('#personalDataConsent').checked;

  if (!name || !email || !password || !repeat) {
    setMessage('registerMessage', 'Заполните все поля.', 'error');
    return;
  }

  if (password.length < 10) {
    setMessage('registerMessage', 'Пароль должен содержать не менее 10 символов.', 'error');
    return;
  }

  if (password !== repeat) {
    setMessage('registerMessage', 'Пароли не совпадают.', 'error');
    return;
  }

  if (!consent) {
    setMessage('registerMessage', 'Нужно отдельно подтвердить согласие на обработку данных.', 'error');
    return;
  }

  sessionStorage.setItem('facehubDemoEmail', email);
  setMessage('registerMessage', 'Аккаунт создан в демонстрационном режиме. Теперь войдите.', 'success');
  $('#loginEmail').value = email;

  setTimeout(() => {
    switchTab('login');
    $('#loginPassword').focus();
  }, 650);
});

const initialTab = new URLSearchParams(location.search).get('mode');
if (initialTab === 'register') {
  switchTab('register');
}
