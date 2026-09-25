const role = sessionStorage.getItem('facehubDemoRole');
if (role === 'owner') document.body.classList.add('is-owner');
if (role) document.body.classList.add('is-authenticated');
