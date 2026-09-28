const role = sessionStorage.getItem('facehubDemoRole');
if (role === 'owner') document.body.classList.add('is-owner');
if (role) document.body.classList.add('is-authenticated');

(function(){
  const root = document.documentElement;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const app = document.getElementById('homeApp');

  if (app && !reduceMotion) {
    let tx = 0, ty = 0, x = 0, y = 0, raf = 0;

    function frame(){
      x += (tx - x) * .045;
      y += (ty - y) * .045;
      root.style.setProperty('--mx', x.toFixed(2) + 'px');
      root.style.setProperty('--my', y.toFixed(2) + 'px');
      if (Math.abs(tx - x) > .08 || Math.abs(ty - y) > .08) raf = requestAnimationFrame(frame);
      else raf = 0;
    }

    function move(clientX, clientY){
      const r = app.getBoundingClientRect();
      tx = ((clientX - r.left) / r.width - .5) * 28;
      ty = ((clientY - r.top) / r.height - .5) * 22;
      if (!raf) raf = requestAnimationFrame(frame);
    }

    app.addEventListener('pointermove', e => move(e.clientX, e.clientY), {passive:true});
    app.addEventListener('pointerleave', () => {
      tx = 0;
      ty = 0;
      if (!raf) raf = requestAnimationFrame(frame);
    }, {passive:true});
  }

  const donate = document.getElementById('donateLink');
  if (donate) {
    fetch('api.php', {
      method:'POST',
      headers:{'Content-Type':'application/x-www-form-urlencoded'},
      credentials:'same-origin',
      body:'action=get_settings'
    })
      .then(response => response.ok ? response.json() : null)
      .then(data => {
        const href = String(data?.donation_link || '').trim();
        if (!/^https?:\/\//i.test(href)) return;
        donate.href = href;
        donate.hidden = false;
      })
      .catch(() => {});
  }

  const spectral = document.getElementById('spectralSource');
  if (!spectral || reduceMotion || typeof spectral.animate !== 'function') return;

  const random = (min, max) => min + Math.random() * (max - min);
  const lerp = (a, b, t) => a + (b - a) * t;

  function edgePoint(edge, w, h, sw, sh){
    if (edge === 0) return {x:-sw * .78, y:random(-sh * .10, h - sh * .20)};
    if (edge === 1) return {x:w + sw * .08, y:random(-sh * .10, h - sh * .20)};
    if (edge === 2) return {x:random(-sw * .15, w - sw * .15), y:-sh * .78};
    return {x:random(-sw * .15, w - sw * .15), y:h + sh * .08};
  }

  function runSpectralPass(){
    const w = window.innerWidth;
    const h = window.innerHeight;
    const rect = spectral.getBoundingClientRect();
    const sw = rect.width || Math.min(w * .34, 660);
    const sh = rect.height || Math.min(w * .22, 430);

    const startEdge = Math.floor(Math.random() * 4);
    let endEdge = Math.floor(Math.random() * 4);
    while (endEdge === startEdge) endEdge = Math.floor(Math.random() * 4);

    const start = edgePoint(startEdge, w, h, sw, sh);
    const end = edgePoint(endEdge, w, h, sw, sh);
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const angle = Math.atan2(dy, dx) * 180 / Math.PI;
    const hue = random(-24, 30);
    const scale = random(.88, 1.10);
    const duration = random(25500, 31500);

    const p1 = {x:lerp(start.x,end.x,.10), y:lerp(start.y,end.y,.10)};
    const p2 = {x:lerp(start.x,end.x,.88), y:lerp(start.y,end.y,.88)};

    const animation = spectral.animate([
      {
        transform:`translate3d(${start.x}px,${start.y}px,0) rotate(${angle}deg) scale(${scale * .92})`,
        opacity:0,
        filter:`blur(40px) saturate(150%) hue-rotate(${hue}deg)`
      },
      {
        transform:`translate3d(${p1.x}px,${p1.y}px,0) rotate(${angle}deg) scale(${scale})`,
        opacity:.58,
        filter:`blur(36px) saturate(160%) hue-rotate(${hue}deg)`,
        offset:.10
      },
      {
        transform:`translate3d(${p2.x}px,${p2.y}px,0) rotate(${angle}deg) scale(${scale})`,
        opacity:.58,
        filter:`blur(36px) saturate(160%) hue-rotate(${hue}deg)`,
        offset:.88
      },
      {
        transform:`translate3d(${end.x}px,${end.y}px,0) rotate(${angle}deg) scale(${scale * .92})`,
        opacity:0,
        filter:`blur(40px) saturate(150%) hue-rotate(${hue}deg)`
      }
    ], {
      duration,
      easing:'linear',
      fill:'forwards'
    });

    animation.onfinish = () => {
      window.setTimeout(runSpectralPass, random(3500, 8500));
    };
  }

  window.setTimeout(runSpectralPass, random(1200, 4200));
})();