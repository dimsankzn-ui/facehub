(() => {
  const ROLE_KEY = 'facehubDemoRole';
  const EMAIL_KEY = 'facehubDemoEmail';

  function clearLocalAuth() {
    sessionStorage.removeItem(ROLE_KEY);
    sessionStorage.removeItem(EMAIL_KEY);
    document.body.classList.remove('is-owner', 'is-authenticated');
  }

  async function syncAuth() {
    try {
      const response = await fetch('api.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        credentials: 'same-origin',
        body: new URLSearchParams({ action: 'check_auth' }).toString()
      });
      if (!response.ok) return;

      const auth = await response.json();

      if (!auth.logged_in) {
        clearLocalAuth();
        return;
      }

      const role = auth.role === 'admin' ? 'owner' : 'user';
      sessionStorage.setItem(ROLE_KEY, role);
      sessionStorage.setItem(EMAIL_KEY, auth.email || '');
      document.body.classList.add('is-authenticated');
      document.body.classList.toggle('is-owner', role === 'owner');

      document.querySelectorAll('a[href="profile.html"]').forEach((link) => {
        link.href = 'profile.html';
        if (link.textContent.trim() === 'Личный кабинет') link.textContent = 'Профиль';
      });
    } catch {
      // При временной недоступности API не разлогиниваем пользователя локально.
    }
  }

  syncAuth();
})();