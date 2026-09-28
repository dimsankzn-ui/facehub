const role = sessionStorage.getItem('facehubDemoRole');
if (role === 'owner') document.body.classList.add('is-owner');
if (role) document.body.classList.add('is-authenticated');

(function(){
  const root = document.documentElement;
  const app = document.getElementById('homeApp');
  if (!app || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  let tx = 0, ty = 0, x = 0, y = 0, raf = 0;

  function frame(){
    x += (tx - x) * .045;
    y += (ty - y) * .045;
    root.style.setProperty('--mx', x.toFixed(2) + 'px');
    root.style.setProperty('--my', y.toFixed(2) + 'px');
    if (Math.abs(tx-x) > .08 || Math.abs(ty-y) > .08) raf = requestAnimationFrame(frame);
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
    tx = 0; ty = 0;
    if (!raf) raf = requestAnimationFrame(frame);
  }, {passive:true});
})();
