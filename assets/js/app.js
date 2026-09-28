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

  const spectral = document.getElementById('spectralSource');
  if (!spectral || reduceMotion || typeof spectral.animate !== 'function') return;

  const random = (min, max) => min + Math.random() * (max - min);

  function edgePoint(edge, w, h, sw, sh){
    if (edge === 0) return {x:-sw * .82, y:random(-sh * .15, h - sh * .25)};
    if (edge === 1) return {x:w + sw * .10, y:random(-sh * .15, h - sh * .25)};
    if (edge === 2) return {x:random(-sw * .20, w - sw * .20), y:-sh * .82};
    return {x:random(-sw * .20, w - sw * .20), y:h + sh * .10};
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
    const midA = {
      x:random(w * .04 - sw * .20, w * .78),
      y:random(h * .04 - sh * .20, h * .62)
    };
    const midB = {
      x:random(w * .16 - sw * .20, w * .84),
      y:random(h * .18 - sh * .20, h * .74)
    };

    const angleA = random(-28, 28);
    const angleB = random(-20, 20);
    const hue = random(-22, 28);
    const duration = random(25500, 31500);

    const animation = spectral.animate([
      {
        transform:`translate3d(${start.x}px,${start.y}px,0) rotate(${angleA}deg) scale(.78)`,
        opacity:0,
        filter:`blur(38px) saturate(145%) hue-rotate(${hue}deg)`
      },
      {
        transform:`translate3d(${start.x * .88 + midA.x * .12}px,${start.y * .88 + midA.y * .12}px,0) rotate(${angleA * .7}deg) scale(.90)`,
        opacity:.22,
        offset:.09
      },
      {
        transform:`translate3d(${midA.x}px,${midA.y}px,0) rotate(${angleB}deg) scale(${random(.92,1.13)})`,
        opacity:.66,
        filter:`blur(${random(30,38)}px) saturate(${random(145,175)}%) hue-rotate(${hue + random(-10,10)}deg)`,
        offset:.40
      },
      {
        transform:`translate3d(${midB.x}px,${midB.y}px,0) rotate(${random(-18,18)}deg) scale(${random(.88,1.10)})`,
        opacity:.58,
        offset:.70
      },
      {
        transform:`translate3d(${end.x}px,${end.y}px,0) rotate(${random(-24,24)}deg) scale(.82)`,
        opacity:0,
        filter:`blur(42px) saturate(150%) hue-rotate(${hue + random(-12,12)}deg)`
      }
    ], {
      duration,
      easing:'cubic-bezier(.42,0,.18,1)',
      fill:'forwards'
    });

    animation.onfinish = () => {
      const pause = random(3500, 8500);
      window.setTimeout(runSpectralPass, pause);
    };
  }

  window.setTimeout(runSpectralPass, random(1200, 4200));
})();