(() => {
  const links = [...document.querySelectorAll('a.account-link[href="portfolio.html"]')];
  if (!links.length) return;

  function fallbackIcon() {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');

    const head = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    head.setAttribute('cx', '12');
    head.setAttribute('cy', '8');
    head.setAttribute('r', '3.7');

    const body = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    body.setAttribute('d', 'M4.8 20c.6-4.1 3.1-6.2 7.2-6.2s6.6 2.1 7.2 6.2');

    svg.append(head, body);
    return svg;
  }

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

      links.forEach((link) => {
        link.replaceChildren();
        link.classList.add('profile-link');
        link.title = 'Профиль';
        link.setAttribute('aria-label', 'Открыть профиль');

        const avatar = document.createElement('span');
        avatar.className = 'account-profile-avatar';

        if (auth.avatar_thumb) {
          const image = document.createElement('img');
          image.alt = '';
          image.src = new URL(auth.avatar_thumb.replace(/^\//, ''), location.origin + '/').href;
          image.addEventListener('error', () => {
            avatar.replaceChildren(fallbackIcon());
            avatar.classList.add('fallback');
          });
          avatar.appendChild(image);
        } else {
          avatar.appendChild(fallbackIcon());
          avatar.classList.add('fallback');
        }

        link.appendChild(avatar);
      });
    } catch {
      // Публичная навигация остаётся доступной и без ответа API.
    }
  }

  if (!document.querySelector('#accountAvatarStyles')) {
    const style = document.createElement('style');
    style.id = 'accountAvatarStyles';
    style.textContent = `
      .account-link.profile-link{
        width:46px!important;height:46px!important;min-width:46px!important;
        padding:2px!important;border-radius:50%!important;
        display:inline-grid!important;place-items:center!important;
        overflow:visible!important;font-size:0!important;
        background:rgba(255,255,255,.48)!important;
        border:1px solid rgba(255,255,255,.92)!important;
        box-shadow:0 8px 22px rgba(58,77,99,.10)!important;
        transition:transform .18s,background .18s!important
      }
      .account-link.profile-link:hover{transform:translateY(-1px) scale(1.03);background:rgba(255,255,255,.70)!important}
      .account-profile-avatar{
        width:40px;height:40px;border-radius:50%;overflow:hidden;
        display:grid;place-items:center;background:#e8eef4;
        box-shadow:inset 0 0 0 1px rgba(75,96,119,.08)
      }
      .account-profile-avatar img{width:100%;height:100%;display:block;object-fit:cover}
      .account-profile-avatar svg{width:23px;height:23px;fill:none;stroke:#718498;stroke-width:1.6;stroke-linecap:round}
    `;
    document.head.appendChild(style);
  }

  load();
})();