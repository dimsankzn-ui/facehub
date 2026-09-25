// facehub — клиентская логика интерактивного прототипа
const $=s=>document.querySelector(s);
function showView(name){document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));const v=$('#view-'+name);if(v)v.classList.add('active');document.querySelectorAll('.nav-btn').forEach(b=>b.classList.toggle('active',b.dataset.view===name));}
document.querySelectorAll('.nav-btn').forEach(b=>b.addEventListener('click',()=>showView(b.dataset.view)));
function openGift(){$('#giftModal').classList.add('show')}
function openAddContent(){$('#addContentModal').classList.add('show')}
function closeModal(id){$('#'+id).classList.remove('show')}
document.querySelectorAll('.modal-backdrop').forEach(m=>m.addEventListener('click',e=>{if(e.target===m)m.classList.remove('show')}));
function toast(msg){const t=$('#toast');t.textContent=msg;t.classList.add('show');clearTimeout(window.__tt);window.__tt=setTimeout(()=>t.classList.remove('show'),2000)}
function giftAccess(){closeModal('giftModal');toast('Доступ подарен')}
function addContent(){closeModal('addContentModal');toast('Материал сохранён')}
function toggleBlock(btn){const st=btn.closest('tr').querySelector('.status');const blocked=st.classList.toggle('blocked');st.textContent=blocked?'заблокирован':'активен';btn.textContent=blocked?'Разблокировать':'Заблокировать'}
document.querySelectorAll('.side button[data-admin]').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('.side button[data-admin]').forEach(x=>x.classList.remove('active'));b.classList.add('active');document.querySelectorAll('.admin-section').forEach(s=>s.classList.remove('active'));$('#admin-'+b.dataset.admin).classList.add('active')}));

const requestedView = new URLSearchParams(location.search).get('view');
if (requestedView === 'admin' && sessionStorage.getItem('facehubDemoRole') === 'owner') {
  showView('admin');
} else if (['music','poetry','blog'].includes(requestedView)) {
  showView(requestedView);
}
