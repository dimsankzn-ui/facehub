(() => {
  const links = [...document.querySelectorAll('a.account-link[href="portfolio.html"]')];
  if (!links.length) return;

  async function load() {
    try {
      const response = await fetch('api.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        credentials: 'same-origin',
        body: new URLSearchParams({ action: 'check_auth' }).toString()
      });
      if (!response.ok) return;
      const auth = await response.json();
      if (!auth.logged_in) return;

      const parts = [auth.first_name, auth.last_name].filter(Boolean);
      const initials = parts.length
        ? parts.map((part) => part.trim()[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()
        : (auth.email || 'П').slice(0, 2).toUpperCase();

      links.forEach((link) => {
        link.textContent = '';
        link.classList.add('profile-link');

        const avatar = document.createElement('span');
        avatar.className = 'account-mini-avatar';
        avatar.textContent = initials;

        if (auth.avatar_thumb) {
          const image = document.createElement('img');
          image.alt = '';
          image.src = new URL(auth.avatar_thumb.replace(/^\//, ''), location.origin + '/').href;
          image.addEventListener('error', () => image.remove());
          avatar.appendChild(image);
        }

        const label = document.createElement('span');
        label.textContent = 'Портфолио';
        link.append(avatar, label);
      });
    } catch {
      // Не мешаем основной навигации.
    }
  }

  if (!document.querySelector('#accountAvatarStyles')) {
    const style = document.createElement('style');
    style.id = 'accountAvatarStyles';
    style.textContent = '.account-link.profile-link{gap:8px;padding-left:7px}.account-mini-avatar{width:26px;height:26px;border-radius:50%;display:grid;place-items:center;overflow:hidden;background:linear-gradient(145deg,#eef3f8,#d9e4ee);color:#60758c;font-size:9px;font-weight:600;flex:0 0 auto;border:1px solid rgba(255,255,255,.9)}.account-mini-avatar img{width:100%;height:100%;object-fit:cover;display:block}';
    document.head.appendChild(style);
  }

  load();
})();
