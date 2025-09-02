const DEMO_KEY = 'cardapio-overlay-v1';
const DELETED_KEY = 'cardapio-deleted-v1';

// ====== Overlay helpers ======
function loadOverlay(){
  const arr = JSON.parse(localStorage.getItem(DEMO_KEY) || '[]');
  const del = JSON.parse(localStorage.getItem(DELETED_KEY) || '[]');
  return { arr, del };
}
function saveOverlay(arr, del){
  localStorage.setItem(DEMO_KEY, JSON.stringify(arr));
  localStorage.setItem(DELETED_KEY, JSON.stringify(del));
}
function addOrUpdateOverlay(p){
  const { arr, del } = loadOverlay();
  const i = arr.findIndex(x => x.id === p.id);
  if (i >= 0) arr[i] = p; else arr.push(p);
  const di = del.indexOf(p.id); if (di >= 0) del.splice(di,1);
  saveOverlay(arr, del);
}
function markDeleted(id){
  const { arr, del } = loadOverlay();
  const i = arr.findIndex(x => x.id === id); if (i >= 0) arr.splice(i,1);
  if (!del.includes(id)) del.push(id);
  saveOverlay(arr, del);
}
function resetOverlay(){
  localStorage.removeItem(DEMO_KEY);
  localStorage.removeItem(DELETED_KEY);
}

// ====== Data load/merge ======
async function fetchBase(){
  const res = await fetch('data/produtos.json', { cache: 'no-store' });
  if (!res.ok) throw new Error('Falha ao carregar data/produtos.json');
  return await res.json();
}
async function getMerged(){
  const base = await fetchBase();
  const { arr, del } = loadOverlay();
  const map = new Map(base.map(p => [p.id, p]));
  del.forEach(id => map.delete(id));
  arr.forEach(p => map.set(p.id, p));
  return Array.from(map.values());
}

// ====== UI helpers ======
const tbody = document.getElementById('tbody');
const statusEl = document.getElementById('status');
const q = document.getElementById('q');
const cat = document.getElementById('cat');
const sortSel = document.getElementById('sort');

let ITEMS = [];
let selId = null;

function currency(v){ return Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}) }
function norm(s){ return (s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase(); }
function basePrice(p){ return p.tamanhos?.length ? Math.min(...p.tamanhos.map(t=>t.preco)) : (p.preco ?? 0); }

function applyFilters(items){
  let arr = items;
  const nq = norm(q.value);
  if (cat.value !== 'all') arr = arr.filter(p => p.categoria === cat.value);
  if (nq) arr = arr.filter(p => norm(p.nome).includes(nq));
  switch (sortSel.value){
    case 'name-asc': arr.sort((a,b)=> norm(a.nome).localeCompare(norm(b.nome))); break;
    case 'name-desc': arr.sort((a,b)=> norm(b.nome).localeCompare(norm(a.nome))); break;
    case 'stock-asc': arr.sort((a,b)=> (a.estoque??0)-(b.estoque??0)); break;
    case 'stock-desc': arr.sort((a,b)=> (b.estoque??0)-(a.estoque??0)); break;
  }
  return arr;
}

function rowHTML(p){
  const precoBase = basePrice(p);
  const out = Number(p.estoque) === 0;
  return `<tr class="row" data-id="${p.id}">
    <td><strong>${p.nome}</strong><br><span class="small">${p.tamanhos?.length?'Pizza (com tamanhos)':'Preço fixo'}</span></td>
    <td>${p.categoria} ${out?'<span class="badge out" style="margin-left:6px">Sem estoque</span>':''}</td>
    <td class="num">${currency(precoBase)}</td>
    <td class="num">
      <div style="display:flex;gap:6px;align-items:center;justify-content:flex-end">
        <button class="btnMinus" title="-1">–</button>
        <input class="inline est" type="number" step="1" min="0" value="${Number(p.estoque??0)}"/>
        <button class="btnPlus" title="+1">+</button>
      </div>
    </td>
    <td>
      <div style="display:flex;gap:6px">
        <button class="btnSetZero">Zerar</button>
        <button class="btnEdit">Editar</button>
        <button class="btnDel">Excluir</button>
      </div>
    </td>
  </tr>`;
}

function render(items){
  tbody.innerHTML = items.map(rowHTML).join('');
  statusEl.textContent = `${items.length} itens • overlay: ${(JSON.parse(localStorage.getItem(DEMO_KEY)||'[]')).length} edit(s)`;
}

// ====== Inline actions ======
tbody.addEventListener('click', (e)=>{
  const tr = e.target.closest('tr.row');
  if (!tr) return;
  const id = tr.dataset.id;
  const p = ITEMS.find(x => x.id === id);
  if (!p) return;

  if (e.target.matches('.btnMinus')){
    const input = tr.querySelector('input.est');
    input.value = Math.max(0, Number(input.value||0) - 1);
    p.estoque = Number(input.value);
    addOrUpdateOverlay(p);
    render(applyFilters(ITEMS));
  }
  if (e.target.matches('.btnPlus')){
    const input = tr.querySelector('input.est');
    input.value = Number(input.value||0) + 1;
    p.estoque = Number(input.value);
    addOrUpdateOverlay(p);
    render(applyFilters(ITEMS));
  }
  if (e.target.matches('.btnSetZero')){
    const input = tr.querySelector('input.est');
    input.value = 0;
    p.estoque = 0;
    addOrUpdateOverlay(p);
    render(applyFilters(ITEMS));
  }
  if (e.target.matches('.btnDel')){
    if (confirm('Excluir este item do overlay?')){
      markDeleted(id);
      boot();
    }
  }
  if (e.target.matches('.btnEdit')){
    openEditor(p);
  }
});

tbody.addEventListener('change', (e)=>{
  const tr = e.target.closest('tr.row');
  if (!tr) return;
  const id = tr.dataset.id;
  const p = ITEMS.find(x => x.id === id);
  if (!p) return;
  if (e.target.matches('input.est')){
    p.estoque = Number(e.target.value||0);
    addOrUpdateOverlay(p);
    render(applyFilters(ITEMS));
  }
});

q.addEventListener('input', ()=> render(applyFilters(ITEMS)));
cat.addEventListener('change', ()=> render(applyFilters(ITEMS)));
sortSel.addEventListener('change', ()=> render(applyFilters(ITEMS)));

// ====== Editor lateral ======
const f_nome = document.getElementById('f_nome');
const f_categoria = document.getElementById('f_categoria');
const f_imagem = document.getElementById('f_imagem');
const f_estoque = document.getElementById('f_estoque');
const f_p_broto = document.getElementById('f_p_broto');
const f_p_media = document.getElementById('f_p_media');
const f_p_grande = document.getElementById('f_p_grande');
const f_preco = document.getElementById('f_preco');
const sizesWrap = document.getElementById('sizesWrap');
const priceWrap = document.getElementById('priceWrap');

function fillEditor(p){
  selId = p?.id || null;
  f_nome.value = p?.nome || '';
  f_categoria.value = p?.categoria || 'salgada';
  f_imagem.value = p?.imagem || 'img/placeholder.jpg';
  f_estoque.value = Number(p?.estoque ?? 0);
  if (p?.categoria === 'bebida'){
    sizesWrap.style.display='none'; priceWrap.style.display='block';
    f_preco.value = p?.preco ?? 0;
  } else {
    sizesWrap.style.display='block'; priceWrap.style.display='none';
    f_p_broto.value = p?.tamanhos?.[0]?.preco ?? '';
    f_p_media.value = p?.tamanhos?.[1]?.preco ?? '';
    f_p_grande.value = p?.tamanhos?.[2]?.preco ?? '';
  }
}
function openEditor(p){ fillEditor(p); }

document.getElementById('btnClear').addEventListener('click', ()=> fillEditor(null));
document.getElementById('f_categoria').addEventListener('change', ()=>{
  const v = f_categoria.value;
  if (v === 'bebida'){ sizesWrap.style.display='none'; priceWrap.style.display='block'; }
  else { sizesWrap.style.display='block'; priceWrap.style.display='none'; }
});

document.getElementById('btnSave').addEventListener('click', ()=>{
  const nome = f_nome.value.trim();
  if (!nome) return alert('Informe o nome');
  const categoria = f_categoria.value;
  const estoque = Number(f_estoque.value||0);
  const imagem = f_imagem.value.trim() || 'img/placeholder.jpg';
  let p = { id: selId || crypto.randomUUID().slice(0,8), nome, categoria, estoque, imagem };

  if (categoria === 'bebida'){
    const preco = Number(f_preco.value||0);
    p.preco = preco;
  } else {
    const t = [];
    const broto = Number(f_p_broto.value); if (!Number.isNaN(broto) && f_p_broto.value !== '') t.push({ rotulo:'Broto (4)', preco:broto });
    const media = Number(f_p_media.value); if (!Number.isNaN(media) && f_p_media.value !== '') t.push({ rotulo:'Média (6)', preco:media });
    const grande = Number(f_p_grande.value); if (!Number.isNaN(grande) && f_p_grande.value !== '') t.push({ rotulo:'Grande (8)', preco:grande });
    if (t.length) p.tamanhos = t;
    else p.preco = Number(f_preco.value||0); // fallback se usuário quiser preco fixo mesmo em "salgada"
  }

  addOrUpdateOverlay(p);
  selId = p.id;
  boot();
});

document.getElementById('btnAdd').addEventListener('click', ()=> openEditor(null));

// ====== Import/Export ======
document.getElementById('btnExport').addEventListener('click', async ()=>{
  const merged = await getMerged();
  const blob = new Blob([JSON.stringify(merged, null, 2)], { type:'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'produtos-merged.json'; a.click();
  URL.revokeObjectURL(url);
});

document.getElementById('btnImport').addEventListener('click', ()=>{
  const input = document.createElement('input'); input.type = 'file'; input.accept = 'application/json';
  input.addEventListener('change', async ()=>{
    const f = input.files[0]; if (!f) return;
    const txt = await f.text();
    try {
      const list = JSON.parse(txt);
      if (!Array.isArray(list)) throw new Error('JSON deve ser um array de produtos');
      // salva tudo como overlay (substitui overlay atual)
      localStorage.setItem(DEMO_KEY, JSON.stringify(list));
      // não mexe na lista de deletados
      boot();
      alert('Importado para overlay com sucesso!');
    } catch (e) {
      alert('Erro ao importar: ' + e.message);
    }
  });
  input.click();
});

document.getElementById('btnReset').addEventListener('click', ()=>{
  if (confirm('Limpar overlay (LocalStorage)?')){
    resetOverlay();
    boot();
  }
});

// ====== Boot ======
async function boot(){
  try{
    ITEMS = await getMerged();
    render(applyFilters(ITEMS));
    // se havia um item selecionado, tenta preencher editor
    if (selId){
      const p = ITEMS.find(x => x.id === selId);
      if (p) fillEditor(p);
    }
  } catch (e){
    tbody.innerHTML = `<tr><td colspan="5">Erro: ${e.message}</td></tr>`;
  }
}
boot();
