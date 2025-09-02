const DEMO_KEY = 'cardapio-demo-overlay-v1';
const DELETED_KEY = 'cardapio-demo-deleted-v1';

// Util
const brl = (n) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(n || 0));
const by = (id) => document.getElementById(id);

// Overlay helpers
function loadOverlay() {
  const arr = JSON.parse(localStorage.getItem(DEMO_KEY) || '[]');
  const del = JSON.parse(localStorage.getItem(DELETED_KEY) || '[]');
  return { arr, del };
}
function saveOverlay(arr, del) {
  localStorage.setItem(DEMO_KEY, JSON.stringify(arr));
  localStorage.setItem(DELETED_KEY, JSON.stringify(del));
}
function addOrUpdateOverlay(p) {
  const { arr, del } = loadOverlay();
  const i = arr.findIndex(x => x.id === p.id);
  if (i >= 0) arr[i] = p; else arr.push(p);
  // se existia exclusão, remove da lista de deletados
  const di = del.indexOf(p.id);
  if (di >= 0) del.splice(di, 1);
  saveOverlay(arr, del);
}
function markDeleted(id) {
  const { arr, del } = loadOverlay();
  // remove da overlay se existir
  const i = arr.findIndex(x => x.id === id);
  if (i >= 0) arr.splice(i, 1);
  if (!del.includes(id)) del.push(id);
  saveOverlay(arr, del);
}
function resetOverlay() {
  localStorage.removeItem(DEMO_KEY);
  localStorage.removeItem(DELETED_KEY);
}

// Merge base + overlay (overlay vence; deletados somem)
async function loadProducts() {
  const base = await (await fetch('./data/produtos.json', { cache: 'no-store' })).json();
  const { arr, del } = loadOverlay();
  const map = new Map(base.map(p => [p.id, p]));
  // remove deletados do base antes
  del.forEach(id => map.delete(id));
  // aplica overlay (inclui novos e substitui existentes)
  arr.forEach(p => map.set(p.id, p));
  return Array.from(map.values());
}

function sortProducts(list, mode) {
  const arr = [...list];
  const cmpStr = (a,b) => a.localeCompare(b, 'pt-BR', { sensitivity:'base' });
  if (mode === 'nome-asc') arr.sort((a,b)=>cmpStr(a.nome,b.nome));
  if (mode === 'nome-desc') arr.sort((a,b)=>cmpStr(b.nome,a.nome));
  if (mode === 'preco-asc') arr.sort((a,b)=>Number(a.preco)-Number(b.preco));
  if (mode === 'preco-desc') arr.sort((a,b)=>Number(b.preco)-Number(a.preco));
  if (mode === 'estoque-asc') arr.sort((a,b)=>Number(a.estoque)-Number(b.estoque));
  if (mode === 'estoque-desc') arr.sort((a,b)=>Number(b.estoque)-Number(a.estoque));
  return arr;
}

function render(list) {
  const ul = by('lista');
  ul.innerHTML = '';
  list.forEach(p => {
    const li = document.createElement('li');
    li.className = 'item';
    const left = document.createElement('div');
    left.className = 'item-main';
    left.innerHTML = `
      <div>
        <strong>${p.nome}</strong>
        ${Number(p.estoque) <= 0 ? '<span class="badge">Sem estoque</span>' : ''}
      </div>
      <div class="small">${p.categoria || 'Sem categoria'} • <span class="price">${brl(p.preco)}</span> • Estoque: ${p.estoque}</div>
    `;
    const right = document.createElement('div');
    right.className = 'item-actions';
    const bEdit = document.createElement('button');
    bEdit.textContent = 'Editar';
    bEdit.addEventListener('click', ()=> fillForm(p));
    const bDel = document.createElement('button');
    bDel.textContent = 'Excluir';
    bDel.addEventListener('click', ()=> {
      if (confirm(`Excluir "${p.nome}" desta demo?`)) {
        markDeleted(p.id);
        boot();
      }
    });
    right.appendChild(bEdit);
    right.appendChild(bDel);
    li.appendChild(left);
    li.appendChild(right);
    ul.appendChild(li);
  });
  by('status').textContent = `${list.length} item(ns) após merge base + overlay`;
}

function fillForm(p) {
  by('id').value = p.id;
  by('nome').value = p.nome || '';
  by('categoria').value = p.categoria || '';
  by('preco').value = Number(p.preco || 0);
  by('estoque').value = Number(p.estoque || 0);
  by('nome').focus();
}

function clearForm() {
  by('id').value = '';
  by('form-produto').reset();
  by('nome').focus();
}

async function boot() {
  let items = await loadProducts();
  items = sortProducts(items, by('ordenar').value);
  render(items);
}

document.addEventListener('DOMContentLoaded', ()=>{
  by('ordenar').addEventListener('change', boot);
  by('resetar').addEventListener('click', ()=>{
    if (confirm('Limpar dados do modo demo (LocalStorage)?')){
      resetOverlay();
      boot();
    }
  });
  by('limpar').addEventListener('click', clearForm);
  by('form-produto').addEventListener('submit', (e)=>{
    e.preventDefault();
    const id = by('id').value || crypto.randomUUID();
    const p = {
      id,
      nome: by('nome').value.trim(),
      categoria: by('categoria').value.trim() || 'Pizzas',
      preco: Number(by('preco').value),
      estoque: Number(by('estoque').value)
    };
    if (!p.nome || isNaN(p.preco) || isNaN(p.estoque)) {
      alert('Preencha os campos corretamente.'); return;
    }
    addOrUpdateOverlay(p);
    clearForm();
    boot();
  });
  boot();
});
