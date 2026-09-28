(() => {
  const params = new URLSearchParams(location.search);
  const platform = params.get('mini');
  if (!['telegram', 'max'].includes(platform)) return;

  document.body.classList.add('mini-context');

  const label = platform === 'telegram' ? 'Telegram' : 'MAX';
  const back = document.createElement('a');
  back.className = 'mini-context-back';
  back.href = '/' + platform + '/';
  back.textContent = '← ' + label;
  back.setAttribute('aria-label', 'Вернуться в facehub для ' + label);
  document.body.appendChild(back);

  document.querySelectorAll('a[href]').forEach((link) => {
    const raw = link.getAttribute('href');
    if (!raw || /^(?:https?:|mailto:|tel:|javascript:|#)/i.test(raw)) return;

    try {
      const url = new URL(raw, location.href);
      if (url.origin !== location.origin) return;
      if (url.pathname === '/' + platform + '/' || url.pathname.startsWith('/' + platform + '/')) return;

      if (url.pathname.endsWith('.html') || url.pathname === '/') {
        url.searchParams.set('mini', platform);
        link.href = url.pathname + url.search + url.hash;
      }
    } catch {}
  });

  const style = document.createElement('style');
  style.textContent = `
    .mini-context-back{
      position:fixed;left:12px;bottom:12px;z-index:18;
      height:34px;padding:0 11px;border-radius:11px;
      display:inline-flex;align-items:center;
      text-decoration:none;font:500 10px/1 -apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;
      color:#53687c;background:rgba(245,249,252,.88);
      border:1px solid rgba(255,255,255,.94);
      box-shadow:0 8px 24px rgba(39,58,78,.12);
      backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px)
    }
    body.mini-context .page-nav{display:none!important}
    @media(max-width:520px){.mini-context-back{left:8px;bottom:8px;height:32px}}
  `;
  document.head.appendChild(style);
})();