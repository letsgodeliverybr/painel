// ═══════════════════════════════════════════════
// CONFIGURAÇÃO SUPABASE
// ═══════════════════════════════════════════════
const SB_URL='https://astbkmpegcmqljltmdpx.supabase.co';
const SB_KEY='sb_publishable_8ocBGGO6EM8GYlg-6HBdmQ_LA6VDL9O';

let currentUser=null,currentPerfil=null,map=null;
let motoboyMarkers={},pedidoMarkers={},lojaMarkers={},realtimeInterval=null;
let allPedidos=[],allMotoboys=[],allLojas=[],filterStatus='todos',selectedPedidoId=null;

// IDs já notificados (para não tocar som repetido)
let idsProntoNotificados=new Set();


// ═══════════════════════════════════════════════
// SUPABASE HELPER
// ═══════════════════════════════════════════════
async function db(table,method='GET',body=null,filters=''){
  const url=`${SB_URL}/rest/v1/${table}${filters}`;
  const h={'apikey':SB_KEY,'Authorization':`Bearer ${SB_KEY}`,'Content-Type':'application/json','Prefer':method==='POST'?'return=representation':''};
  try{
    const r=await fetch(url,{method,headers:h,body:body?JSON.stringify(body):null});
    if(!r.ok)return[];
    const t=await r.text();
    return t?JSON.parse(t):[];
  }catch{return[];}
}

async function logAcao(acao,detalhes={}){
  if(!currentUser)return;
  await db('logs_acoes','POST',{usuario_id:currentUser.id,acao,detalhes});
}

// ═══════════════════════════════════════════════
// SOM DE NOTIFICAÇÃO
// ═══════════════════════════════════════════════
function tocarSomPronto(){
  try{
    const ctx=new(window.AudioContext||window.webkitAudioContext)();
    [[880,.0],[1100,.18],[880,.36],[1100,.54]].forEach(([freq,delay])=>{
      const osc=ctx.createOscillator();
      const gain=ctx.createGain();
      osc.connect(gain);gain.connect(ctx.destination);
      osc.frequency.value=freq;osc.type='sine';
      gain.gain.setValueAtTime(.35,ctx.currentTime+delay);
      gain.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+delay+.18);
      osc.start(ctx.currentTime+delay);
      osc.stop(ctx.currentTime+delay+.2);
    });
  }catch(e){}
}

// ═══════════════════════════════════════════════
// AUTO: VIRAR RECEBIDO → PRONTO APÓS 60s
// Chamado pelo polling — roda no cliente, atualiza Supabase
// ═══════════════════════════════════════════════
async function processarAutoPronto(){
  const agora=new Date();
  const pedidosRecebidos=allPedidos.filter(p=>
    (p.status_detalhado==='recebido'||p.status==='recebido')&&p.recebido_em
  );
  for(const p of pedidosRecebidos){
    const recebidoEm=new Date(p.recebido_em);
    const diff=(agora-recebidoEm)/1000; // segundos
    if(diff>=60){
      // Gera código 4 dígitos
      const codigo=String(Math.floor(Math.random()*9000)+1000);
      await db('pedidos','PATCH',{
        status:'pronto',
        status_detalhado:'pronto',
        pronto_em:agora.toISOString(),
        codigo_confirmacao:codigo,
        updated_at:agora.toISOString()
      },`?id=eq.${p.id}`);
    }
  }
}

// ═══════════════════════════════════════════════
// NOTIFICAÇÕES DE PEDIDOS PRONTOS
// ═══════════════════════════════════════════════
function verificarNovosProtos(pedidos){
  pedidos.forEach(p=>{
    if((p.status_detalhado==='pronto'||p.status==='pronto')&&!idsProntoNotificados.has(p.id)){
      idsProntoNotificados.add(p.id);
      tocarSomPronto();
      showNotif('🔔 Pedido Pronto!',`#${p.numero||p.id?.substring(0,6)} aguardando motoboy`,'var(--pink)');
    }
    // Remove da lista se finalizou
    if(p.status==='finalizado'||p.status==='entregue'){
      idsProntoNotificados.delete(p.id);
    }
  });
}

// ═══════════════════════════════════════════════
// UI HELPERS
// ═══════════════════════════════════════════════
function showNotif(title,msg,color='var(--green)'){
  const el=document.getElementById('notif');
  document.getElementById('notif-title').textContent=title;
  document.getElementById('notif-msg').textContent=msg;
  el.style.borderLeftColor=color;
  el.classList.add('show');
  setTimeout(()=>el.classList.remove('show'),4000);
}
function abrirModal(id){document.getElementById(id).classList.add('open');}
function fecharModal(id){document.getElementById(id).classList.remove('open');}

// ═══════════════════════════════════════════════
// DROPDOWN DE STATUS — clique no badge
// ═══════════════════════════════════════════════
const TODOS_STATUS = [
  {key:'recebido',    label:'Recebido',    cor:'#ef4444'},
  {key:'pronto',      label:'Pronto',      cor:'#ec4899'},
  {key:'aceito',      label:'Aceito',      cor:'#8b5cf6'},
  {key:'chegou_local',label:'No local',    cor:'#60a5fa'},
  {key:'em_rota',     label:'Em rota',     cor:'#1A56DB'},
  {key:'retornando',  label:'Retornando',  cor:'#f59e0b'},
  {key:'finalizado',  label:'Finalizado',  cor:'#22c55e'},
  {key:'cancelado',   label:'Cancelado',   cor:'#ef4444'},
];

let _dropdownAberto = null;

function abrirDropdownStatus(event, pedidoId) {
  event.stopPropagation();

  // Fecha dropdown anterior
  fecharDropdownStatus();

  const wrapper = document.getElementById(`badge-wrapper-${pedidoId}`);
  if (!wrapper) return;

  const dropdown = document.createElement('div');
  dropdown.className = 'status-dropdown';
  dropdown.id = 'status-dropdown-atual';

  dropdown.innerHTML = TODOS_STATUS.map(s => `
    <button class="status-dropdown-item" onclick="event.stopPropagation();alterarStatusPedido('${pedidoId}','${s.key}')">
      <span class="status-dot" style="background:${s.cor}"></span>
      <span style="color:${s.cor}">${s.label}</span>
    </button>
  `).join('');

  wrapper.appendChild(dropdown);
  _dropdownAberto = pedidoId;

  // Fecha ao clicar fora
  setTimeout(() => document.addEventListener('click', fecharDropdownStatus, {once:true}), 10);
}

function fecharDropdownStatus() {
  const el = document.getElementById('status-dropdown-atual');
  if (el) el.remove();
  _dropdownAberto = null;
}

async function alterarStatusPedido(pedidoId, novoStatus) {
  fecharDropdownStatus();

  const agora = new Date().toISOString();
  const update = {
    status: novoStatus,
    status_detalhado: novoStatus,
    updated_at: agora,
  };

  // Timestamps específicos por status
  if (novoStatus === 'pronto')      update.pronto_em = agora;
  if (novoStatus === 'aceito')      update.aceito_em = agora;
  if (novoStatus === 'em_rota')     update.em_rota_em = agora;
  if (novoStatus === 'retornando')  update.retornando_em = agora;
  if (novoStatus === 'finalizado')  update.finalizado_em = agora;
  if (novoStatus === 'recebido')    update.recebido_em = agora;

  // Se voltou para pronto, reseta notificação para tocar de novo no app
  if (novoStatus === 'pronto') {
    idsProntoNotificados.delete(pedidoId);
    tocarSomPronto();
    showNotif('🔔 Pedido Pronto!', 'Motoboys serão notificados', 'var(--pink)');
  }

  if (novoStatus === 'cancelado') {
    showNotif('❌ Pedido cancelado', '', 'var(--red)');
  }

  await db('pedidos', 'PATCH', update, `?id=eq.${pedidoId}`);
  await logAcao('alterar_status_manual', {pedido_id: pedidoId, novo_status: novoStatus});
  await atualizarTudo();
}

// ═══════════════════════════════════════════════
// SALDO NA TOPBAR
// ═══════════════════════════════════════════════
async function _carregarSaldoTopbar(){
  try{
    // Tenta buscar saldo da tabela de carteira/saldo se existir
    const pedidos = await db('pedidos','GET',null,'?status=eq.finalizado');
    const total = pedidos.reduce((s,p)=>s+(parseFloat(p.valor)||0),0);
    const el = document.getElementById('topbar-saldo');
    const val = document.getElementById('saldo-valor');
    if(el && val){
      val.textContent = total.toLocaleString('pt-BR',{minimumFractionDigits:2});
      el.style.display = 'flex';
    }
  }catch(_){}
}

// ═══════════════════════════════════════════════
// MENU LATERAL SIDEBAR
// ═══════════════════════════════════════════════
const NAV_ITEMS_ADM = [
  {id:'mapa',          icon:'🗺️', label:'Mapa ao Vivo'},
  {id:'pedidos',       icon:'📦', label:'Pedidos'},
  {id:'motoboys',      icon:'🛵', label:'Motoboys'},
  {id:'lojas',         icon:'🏪', label:'Lojas'},
  {id:'usuarios',      icon:'👥', label:'Usuários'},
  {id:'tabelas-preco', icon:'💰', label:'Tabelas de Preço'},
  {id:'relatorios',    icon:'📈', label:'Relatórios'},
  {id:'logs',          icon:'📋', label:'Logs'},
];
const NAV_ITEMS_LOJA = [
  {id:'novo-pedido',   icon:'➕', label:'Novo Pedido'},
  {id:'loja-pedidos',  icon:'📦', label:'Meus Pedidos'},
  {id:'loja-mapa',     icon:'🗺️', label:'Rastrear'},
  {id:'loja-relatorio',icon:'📈', label:'Relatório'},
];
const NAV_ITEMS_SUPORTE = [
  {id:'mapa',     icon:'🗺️', label:'Mapa ao Vivo'},
  {id:'pedidos',  icon:'📦', label:'Pedidos'},
  {id:'motoboys', icon:'🛵', label:'Motoboys'},
];

let _navAtivo = '';

function renderNavSidebar(activeId) {
  _navAtivo = activeId || _navAtivo;
  const items = currentPerfil==='adm' ? NAV_ITEMS_ADM :
                currentPerfil==='loja' ? NAV_ITEMS_LOJA : NAV_ITEMS_SUPORTE;
  const body = document.getElementById('nav-sidebar-body');
  if (!body) return;
  body.innerHTML = items.map(item => `
    <button class="nav-item${_navAtivo===item.id?' active':''}" onclick="navGoTab('${item.id}')">
      <span class="nav-item-icon">${item.icon}</span>
      <span>${item.label}</span>
    </button>
  `).join('') + `
    <div style="border-top:1px solid var(--border);padding-top:8px;margin-top:16px">
      <button class="nav-item" onclick="logout()" style="color:var(--red)">
        <span class="nav-item-icon">🚪</span>
        <span>Sair</span>
      </button>
    </div>
  `;
}

function abrirNavSidebar() {
  renderNavSidebar(_navAtivo);
  document.getElementById('nav-sidebar').classList.add('open');
  document.getElementById('nav-overlay').classList.add('open');
}

function fecharNavSidebar() {
  document.getElementById('nav-sidebar').classList.remove('open');
  document.getElementById('nav-overlay').classList.remove('open');
}

function navGoTab(id) {
  fecharNavSidebar();
  // Pequeno delay para o drawer fechar antes de renderizar o mapa
  setTimeout(() => goTab(id), 50);
}

// ═══════════════════════════════════════════════
// ALTERAR PONTOS DO PEDIDO
// ═══════════════════════════════════════════════
async function alterarPontos(pedidoId, delta) {
  const p = allPedidos.find(x => x.id === pedidoId);
  if (!p) return;
  const novosPontos = Math.max(0, Math.min(20, (p.pontos || 4) + delta));
  
  // Atualiza UI imediatamente
  const el = document.getElementById(`pontos-${pedidoId}`);
  if (el) el.textContent = novosPontos;
  
  // Atualiza no banco
  await db('pedidos', 'PATCH', { pontos: novosPontos, updated_at: new Date().toISOString() }, `?id=eq.${pedidoId}`);
  await logAcao('alterar_pontos', { pedido_id: pedidoId, pontos: novosPontos });
  
  // Atualiza local sem recarregar tudo
  p.pontos = novosPontos;
}

// ═══════════════════════════════════════════════
// PAGAMENTO ENTREGUE (para pedidos retornando)
// ═══════════════════════════════════════════════
async function confirmarPagamento(pedidoId) {
  await db('pedidos','PATCH',{
    pagamento_confirmado: true,
    pagamento_confirmado_em: new Date().toISOString(),
    status: 'finalizado',
    status_detalhado: 'finalizado',
    finalizado_em: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }, `?id=eq.${pedidoId}`);
  await logAcao('pagamento_confirmado',{pedido_id:pedidoId});
  showNotif('✅ Pagamento confirmado!','Entrega finalizada para o motoboy');
  await atualizarTudo();
}
// ═══════════════════════════════════════════════
const STATUS_LABEL={
  recebido:'Recebido',pronto:'Pronto',aceito:'Aceito',
  chegou_local:'No local',em_rota:'Em rota',retornando:'Retornando',
  finalizado:'Finalizado',disponivel:'Disponível',aguardando:'Aguardando',
  entregue:'Entregue',fila:'Na fila'
};
const STATUS_CORES={
  recebido:'#ef4444',pronto:'#ec4899',aceito:'#8b5cf6',
  chegou_local:'#60a5fa',em_rota:'#1A56DB',retornando:'#f59e0b',
  finalizado:'#22c55e',disponivel:'#1A56DB',aguardando:'#eab308',
  entregue:'#475569',fila:'#475569'
};
function getStatusKey(p){return p.status_detalhado||p.status||'disponivel';}
function getStatusLabel(p){const k=getStatusKey(p);return STATUS_LABEL[k]||k;}
function getStatusCor(p){return STATUS_CORES[getStatusKey(p)]||'#1A56DB';}

// ═══════════════════════════════════════════════
// LOGIN
// ═══════════════════════════════════════════════
async function fazerLogin(){
  const email=document.getElementById('login-email').value.trim();
  const senha=document.getElementById('login-senha').value;
  const perfil=document.getElementById('login-perfil').value;
  const errEl=document.getElementById('login-error');
  const btn=document.getElementById('login-btn');
  errEl.style.display='none';
  if(!email||!senha){errEl.textContent='Preencha e-mail e senha.';errEl.style.display='block';return;}
  btn.disabled=true;btn.textContent='Verificando...';
  const usuarios=await db('usuarios_painel','GET',null,`?email=eq.${encodeURIComponent(email)}&senha=eq.${encodeURIComponent(senha)}&perfil=eq.${perfil}&ativo=eq.true`);
  btn.disabled=false;btn.textContent='Entrar →';
  if(!usuarios||usuarios.length===0){
    errEl.textContent='E-mail, senha ou perfil incorretos.';errEl.style.display='block';return;
  }
  currentUser=usuarios[0];currentPerfil=currentUser.perfil;
  // Salva sessão para restaurar ao recarregar
  sessionStorage.setItem('lg_user', JSON.stringify(currentUser));
  await logAcao('login',{email,perfil});
  document.getElementById('login-screen').style.display='none';
  const appEl = document.getElementById('app');
  appEl.style.display='flex';
  // Força reflow para o DOM atualizar antes de renderizar o mapa
  appEl.getBoundingClientRect();
  document.getElementById('user-nome').textContent=currentUser.nome;
  const badgeMap={adm:'badge-adm',loja:'badge-loja',suporte:'badge-suporte'};
  const labelMap={adm:'ADM',loja:'LOJA',suporte:'SUPORTE'};
  const badge=document.getElementById('user-perfil-badge');
  badge.className='user-perfil-badge '+badgeMap[currentPerfil];
  badge.textContent=labelMap[currentPerfil];
  renderTabs();
  // Delay para garantir que o DOM está pronto antes de renderizar o mapa
  setTimeout(() => {
    goTab(currentPerfil==='adm'?'mapa':currentPerfil==='suporte'?'mapa':'novo-pedido');
  }, 100);

  // Mostra botão novo pedido na topbar (exceto suporte)
  const btnNovo = document.getElementById('btn-novo-pedido');
  if(btnNovo) btnNovo.style.display = currentPerfil!=='suporte' ? 'flex' : 'none';

  // Carrega saldo
  _carregarSaldoTopbar();
}

function logout(){
  clearInterval(realtimeInterval);
  sessionStorage.removeItem('lg_user');
  if(map){map.remove();map=null;}
  currentUser=null;currentPerfil=null;idsProntoNotificados=new Set();
  document.getElementById('login-screen').style.display='flex';
  document.getElementById('app').style.display='none';
  document.getElementById('login-email').value='';
  document.getElementById('login-senha').value='';
}

// ═══════════════════════════════════════════════
// TABS
// ═══════════════════════════════════════════════
const tabsAdm=[
  {id:'mapa',icon:'🗺️',label:'Mapa ao Vivo'},
  {id:'pedidos',icon:'📦',label:'Pedidos'},
  {id:'motoboys',icon:'🛵',label:'Motoboys'},
  {id:'lojas',icon:'🏪',label:'Lojas'},
  {id:'usuarios',icon:'👥',label:'Usuários'},
  {id:'relatorios',icon:'📈',label:'Relatórios'},
  {id:'logs',icon:'📋',label:'Logs'},
];
const tabsLoja=[
  {id:'novo-pedido',icon:'➕',label:'Novo Pedido'},
  {id:'loja-pedidos',icon:'📦',label:'Meus Pedidos'},
  {id:'loja-mapa',icon:'🗺️',label:'Rastrear'},
  {id:'loja-relatorio',icon:'📈',label:'Relatório'},
];
const tabsSuporte=[
  {id:'mapa',icon:'🗺️',label:'Mapa ao Vivo'},
  {id:'pedidos',icon:'📦',label:'Pedidos'},
  {id:'motoboys',icon:'🛵',label:'Motoboys'},
];
function renderTabs(){
  const tabs=currentPerfil==='adm'?tabsAdm:currentPerfil==='loja'?tabsLoja:tabsSuporte;
  document.getElementById('tab-buttons').innerHTML=tabs.map(t=>`
    <button class="tab-btn" id="tab-${t.id}" onclick="goTab('${t.id}')">
      <span>${t.icon}</span>${t.label}
    </button>`).join('');
}
function goTab(id){
  _navAtivo=id;
  renderNavSidebar(id);
  clearInterval(realtimeInterval);
  document.querySelectorAll('.tab-btn').forEach(el=>el.classList.remove('active'));
  const tb=document.getElementById('tab-'+id);
  if(tb)tb.classList.add('active');
  const pages={
    'mapa':renderMapaPage,'pedidos':renderPedidosPage,'motoboys':renderMotoboyPage,
    'lojas':renderLojasPage,'usuarios':renderUsuariosPage,'relatorios':renderRelatoriosPage,
    'logs':renderLogsPage,'tabelas-preco':renderTabelasPrecoPage,'novo-pedido':renderNovoPedidoPage,
    'loja-pedidos':renderLojaPedidosPage,'loja-mapa':renderLojaMapaPage,
    'loja-relatorio':renderLojaRelatorioPage,
  };
  if(pages[id])pages[id]();
}

// ═══════════════════════════════════════════════
// MAPA AO VIVO
// ═══════════════════════════════════════════════
function renderMapaPage(){
  document.getElementById('app-body').innerHTML=`
    <div class="sidebar-pedidos">
      <div class="sidebar-header">
        <div class="sidebar-header-top">
          <span class="sidebar-title">Pedidos</span>
          <span class="sidebar-count" id="sb-count">0</span>
        </div>
        <div class="filter-tabs">
          <button class="filter-tab active" onclick="setFilter('todos',this)">Todos</button>
          <button class="filter-tab" onclick="setFilter('recebido',this)">Recebidos</button>
          <button class="filter-tab" onclick="setFilter('pronto',this)">Prontos</button>
          <button class="filter-tab" onclick="setFilter('em_rota',this)">Em rota</button>
          <button class="filter-tab" onclick="setFilter('cancelado',this)">Cancelados</button>
        </div>
      </div>
      <div class="pedidos-lista" id="pedidos-lista">
        <div class="empty-lista"><div class="ei">📦</div><p>Carregando...</p></div>
      </div>
    </div>
    <div class="mapa-container">
      <div class="mapa-stats">
        <div class="mapa-stat"><span style="font-size:16px">🛵</span><div><div class="mapa-stat-val" id="ms-online">0</div><div class="mapa-stat-label">Online</div></div></div>
        <div class="mapa-stat"><span style="font-size:16px">📦</span><div><div class="mapa-stat-val" id="ms-pedidos">0</div><div class="mapa-stat-label">Pedidos</div></div></div>
        <div class="mapa-stat"><span style="font-size:16px">🔄</span><div><div class="mapa-stat-val" id="ms-rota">0</div><div class="mapa-stat-label">Em rota</div></div></div>
      </div>
      <button class="mapa-refresh" onclick="atualizarTudo()">↻ Atualizar</button>
      <div id="map"></div>
    </div>`;

  setTimeout(()=>{
    if(map){map.remove();map=null;}
    map=L.map('map',{zoomControl:false}).setView([-21.1775,-47.8103],13);
    L.control.zoom({position:'bottomright'}).addTo(map);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',{attribution:'© OSM © CartoDB',maxZoom:19}).addTo(map);
    atualizarTudo();
    // Polling a cada 10 segundos
    realtimeInterval=setInterval(atualizarTudo,10000);
  },100);
}

function setFilter(status,el){
  filterStatus=status;
  document.querySelectorAll('.filter-tab').forEach(e=>e.classList.remove('active'));
  el.classList.add('active');
  renderPedidosLista();
}

async function atualizarTudo(){
  // 1. Busca pedidos ativos (excluindo finalizados/cancelados)
  allPedidos=await db('pedidos','GET',null,'?order=created_at.desc&limit=200&status=neq.cancelado&status_detalhado=neq.cancelado');
  allMotoboys=await db('entregadores','GET',null,'');
  allLojas=await db('lojas','GET',null,'?ativo=eq.true');

  // 2. Auto-vira recebido → pronto (60s)
  await processarAutoPronto();

  // 3. Recarrega após a mutação
  allPedidos=await db('pedidos','GET',null,'?order=created_at.desc&limit=200&status=neq.cancelado&status_detalhado=neq.cancelado');

  // 4. Verifica novos prontos para tocar som
  verificarNovosProtos(allPedidos);

  // 5. Atualiza UI
  const online=allMotoboys.filter(e=>e.disponivel||e.status==='ocupado').length;
  const emRota=allPedidos.filter(p=>p.status==='em_rota').length;
  const ms1=document.getElementById('ms-online');
  const ms2=document.getElementById('ms-pedidos');
  const ms3=document.getElementById('ms-rota');
  // live-count removido da topbar
  if(ms1)ms1.textContent=online;
  if(ms2)ms2.textContent=allPedidos.length;
  if(ms3)ms3.textContent=emRota;

  renderPedidosLista();
  if(map)atualizarMarcadores();
}

// ═══════════════════════════════════════════════
// RENDER LISTA SIDEBAR
// ═══════════════════════════════════════════════
function renderPedidosLista(){
  const lista=document.getElementById('pedidos-lista');
  const count=document.getElementById('sb-count');
  if(!lista)return;

  // Filtra por status
  let filtered=allPedidos;
  if(filterStatus!=='todos'){
    filtered=allPedidos.filter(p=>
      (p.status_detalhado===filterStatus)||(p.status===filterStatus)
    );
  }
  if(count)count.textContent=filtered.length;
  if(filtered.length===0){
    lista.innerHTML='<div class="empty-lista"><div class="ei">📦</div><p>Nenhum pedido</p></div>';
    return;
  }

  lista.innerHTML=filtered.map(p=>{
    const hora=p.created_at?new Date(p.created_at).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}):'—';
    const sk=getStatusKey(p);
    const isSelected=selectedPedidoId===p.id;

    // Badge pronto pulsando
    const prontoStyle=sk==='pronto'?'class="pronto-pulse"':'';

    // Detalhes expandidos
    const detalhes=isSelected?`
      <div style="border-top:1px solid var(--border);margin-top:10px;padding-top:10px">
        ${p.codigo_confirmacao?`
          <div style="background:#ec489910;border:1px solid #ec489930;border-radius:8px;padding:10px;text-align:center;margin-bottom:10px">
            <div style="font-size:10px;color:var(--pink);margin-bottom:4px;font-weight:700">CÓDIGO DE CONFIRMAÇÃO</div>
            <div style="font-size:24px;font-weight:800;letter-spacing:8px;color:#fff">${p.codigo_confirmacao}</div>
          </div>`:''}
        ${sk==='retornando'?`
          <div style="background:#f59e0b10;border:1px solid #f59e0b40;border-radius:8px;padding:10px;margin-bottom:8px;text-align:center">
            <div style="font-size:11px;color:#f59e0b;font-weight:700;margin-bottom:4px">⚠️ MOTOBOY RETORNANDO</div>
            <div style="font-size:11px;color:#888">Aguardando confirmação de pagamento</div>
          </div>
          <button class="btn-pagamento" onclick="event.stopPropagation();confirmarPagamento('${p.id}')">
            💰 Pagamento Entregue
          </button>`:''}
        <div style="font-size:11px;color:var(--text3);margin-bottom:8px;margin-top:${sk==='retornando'?'8':'0'}px">
          Criado: ${p.created_at?new Date(p.created_at).toLocaleString('pt-BR'):'—'}
        </div>
          Criado: ${p.created_at?new Date(p.created_at).toLocaleString('pt-BR'):'—'}
        </div>
        ${p.descricao?`<div style="background:var(--bg);border-radius:6px;padding:7px;font-size:11px;color:var(--text2);margin-bottom:8px">📋 ${p.descricao}</div>`:''}
        <button onclick="event.stopPropagation();fecharDetalhe()" style="width:100%;background:none;color:var(--text3);border:1px solid var(--border);border-radius:8px;padding:7px;font-family:Inter,sans-serif;font-size:11px;cursor:pointer">Fechar</button>
        <!-- Editar pontos -->
        <div style="margin-top:8px;background:#f59e0b10;border:1px solid #f59e0b40;border-radius:8px;padding:10px">
          <div style="font-size:10px;color:#f59e0b;font-weight:700;margin-bottom:8px">⭐ PONTOS DA CORRIDA</div>
          <div style="display:flex;align-items:center;gap:8px">
            <button onclick="event.stopPropagation();alterarPontos('${p.id}', -1)" style="background:#f59e0b20;border:1px solid #f59e0b;color:#f59e0b;width:30px;height:30px;border-radius:8px;cursor:pointer;font-size:16px;font-weight:700">−</button>
            <span id="pontos-${p.id}" style="color:#fff;font-weight:800;font-size:18px;min-width:30px;text-align:center">${p.pontos||4}</span>
            <button onclick="event.stopPropagation();alterarPontos('${p.id}', 1)" style="background:#f59e0b20;border:1px solid #f59e0b;color:#f59e0b;width:30px;height:30px;border-radius:8px;cursor:pointer;font-size:16px;font-weight:700">+</button>
            <span style="font-size:11px;color:#888">pontos</span>
          </div>
        </div>
      </div>`:'';

    return`<div class="pedido-item${isSelected?' selected':''}" onclick="selecionarPedido('${p.id}')">
      <div class="pedido-item-top">
        <span class="pedido-num">#${p.numero||p.id?.substring(0,6)}</span>
        <div style="display:flex;align-items:center;gap:5px">
          <button onclick="event.stopPropagation();abrirEditarPedido('${p.id}')"
            style="background:none;border:1px solid var(--border);border-radius:6px;width:24px;height:24px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:var(--text2);font-size:12px;padding:0;"
            title="Editar pedido">✏️</button>
          <span class="badge-wrapper" id="badge-wrapper-${p.id}">
            <span ${prontoStyle} class="p-badge b-${sk}"
              onclick="event.stopPropagation();abrirDropdownStatus(event,'${p.id}')"
              style="cursor:pointer;user-select:none"
              title="Clique para alterar status">
              ${getStatusLabel(p)} ▾
            </span>
          </span>
        </div>
      </div>
      <div class="pedido-end">📍 ${p.endereco||'—'}</div>
      <div class="pedido-footer">
        <span class="pedido-val">R$ ${(p.valor||0).toFixed(2)}</span>
        <span class="pedido-hora">${hora}</span>
      </div>
      ${detalhes}
    </div>`;
  }).join('');

}

// ═══════════════════════════════════════════════
// MARCADORES NO MAPA
// ═══════════════════════════════════════════════
function atualizarMarcadores(){
  Object.values(motoboyMarkers).forEach(m=>map.removeLayer(m));
  Object.values(pedidoMarkers).forEach(m=>map.removeLayer(m));
  Object.values(lojaMarkers).forEach(m=>map.removeLayer(m));
  motoboyMarkers={};pedidoMarkers={};lojaMarkers={};

  // Ícones das LOJAS
  allLojas.forEach(l=>{
    const lat=l.latitude,lng=l.longitude;
    if(!lat||!lng)return;
    const nome=(l.nome||'Loja').substring(0,12);
    const icon=L.divIcon({
      html:`<div style="display:flex;flex-direction:column;align-items:center">
        <div style="background:#f97316;width:36px;height:36px;border-radius:8px;border:3px solid white;display:flex;align-items:center;justify-content:center;font-size:16px;box-shadow:0 2px 10px rgba(0,0,0,.5)">🏪</div>
        <div style="background:#f97316;color:white;font-size:10px;font-weight:700;padding:2px 5px;border-radius:4px;margin-top:2px;white-space:nowrap;box-shadow:0 1px 4px rgba(0,0,0,.4)">${nome}</div>
      </div>`,
      iconSize:[60,52],iconAnchor:[30,52],className:''
    });
    lojaMarkers[l.id]=L.marker([lat,lng],{icon}).addTo(map)
      .bindPopup(`<b>🏪 ${l.nome}</b><br>${l.endereco||'—'}`);
  });

  allMotoboys.forEach(e=>{
    const lat=e.lat||e.latitude,lng=e.lng||e.longitude;
    if(!lat||!lng)return;
    const cor=e.status==='ocupado'?'#f97316':e.disponivel?'#22c55e':'#475569';
    const nome=(e.nome||'').split(' ')[0]||'Moto';
    const icon=L.divIcon({
      html:`<div style="display:flex;flex-direction:column;align-items:center">
        <div style="background:${cor};width:36px;height:36px;border-radius:50%;border:3px solid white;display:flex;align-items:center;justify-content:center;font-size:16px;box-shadow:0 2px 10px rgba(0,0,0,.5)">🛵</div>
        <div style="background:${cor};color:white;font-size:10px;font-weight:700;padding:2px 5px;border-radius:4px;margin-top:2px;white-space:nowrap;box-shadow:0 1px 4px rgba(0,0,0,.4)">${nome}</div>
      </div>`,
      iconSize:[60,52],iconAnchor:[30,52],className:''
    });
    motoboyMarkers[e.id]=L.marker([lat,lng],{icon}).addTo(map)
      .bindPopup(`<b>${e.nome||'Motoboy'}</b><br>Status: ${e.status||'—'}`);
  });

  allPedidos.forEach(p=>{
    if(!p.latitude||!p.longitude)return;
    const cor=getStatusCor(p);
    const num=p.numero_loja||p.numero||p.id?.substring(0,4);
    const icon=L.divIcon({
      html:`<div style="display:flex;flex-direction:column;align-items:center">
        <div style="background:${cor};color:white;font-size:11px;font-weight:800;padding:4px 7px;border-radius:6px;box-shadow:0 2px 8px rgba(0,0,0,.5);white-space:nowrap;border:2px solid white">#${num}</div>
        <div style="width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:6px solid ${cor}"></div>
      </div>`,
      iconSize:[50,30],iconAnchor:[25,30],className:''
    });
    pedidoMarkers[p.id]=L.marker([p.latitude,p.longitude],{icon}).addTo(map)
      .bindPopup(`<b>#${num}</b><br>${p.endereco||'—'}<br>R$ ${(p.valor||0).toFixed(2)}`);
  });
}

function selecionarPedido(id){
  selectedPedidoId=selectedPedidoId===id?null:id;
  renderPedidosLista();
  if(selectedPedidoId){
    const p=allPedidos.find(x=>x.id===selectedPedidoId);
    if(map&&p&&p.latitude&&p.longitude)map.setView([p.latitude,p.longitude],15,{animate:true});
  }
}
function fecharDetalhe(){selectedPedidoId=null;renderPedidosLista();}

// ═══════════════════════════════════════════════
// EDITAR PEDIDO
// ═══════════════════════════════════════════════
function abrirEditarPedido(pedidoId){
  const p = allPedidos.find(x=>x.id===pedidoId);
  if(!p) return;
  // Cria modal dinâmico
  let modal = document.getElementById('modal-editar-pedido');
  if(!modal){
    modal = document.createElement('div');
    modal.id = 'modal-editar-pedido';
    modal.className = 'modal-overlay';
    document.body.appendChild(modal);
  }
  modal.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <span class="modal-title">✏️ Editar Pedido #${p.numero||pedidoId.substring(0,6)}</span>
        <button class="modal-close" onclick="document.getElementById('modal-editar-pedido').classList.remove('open')">✕</button>
      </div>
      <div class="modal-body">
        <div class="form-row">
          <div class="fi"><label>Cliente</label><input id="ep-cliente" value="${p.cliente||''}"/></div>
          <div class="fi"><label>Telefone</label><input id="ep-telefone" value="${p.telefone||''}"/></div>
        </div>
        <div class="form-row full"><div class="fi"><label>Endereço</label><input id="ep-endereco" value="${p.endereco||''}"/></div></div>
        <div class="form-row">
          <div class="fi"><label>Valor (R$)</label><input type="number" id="ep-valor" value="${p.valor||0}" step="0.01"/></div>
          <div class="fi"><label>Taxa entrega (R$)</label><input type="number" id="ep-taxa" value="${p.taxa_entrega||0}" step="0.01"/></div>
        </div>
        <div class="form-row">
          <div class="fi"><label>Nº Pedido</label><input id="ep-numero" value="${p.numero||''}"/></div>
          <div class="fi"><label>⭐ Pontos</label><input type="number" id="ep-pontos" value="${p.pontos||4}" min="1" max="20"/></div>
        </div>
        <div class="form-row full"><div class="fi"><label>Observações</label><textarea id="ep-descricao">${p.descricao||''}</textarea></div></div>
        <div id="ep-feedback" style="margin-top:4px"></div>
      </div>
      <div class="modal-footer">
        <button class="btn-modal-cancel" onclick="document.getElementById('modal-editar-pedido').classList.remove('open')">Cancelar</button>
        <button class="btn-modal-primary" onclick="salvarEdicaoPedido('${pedidoId}')">💾 Salvar</button>
      </div>
    </div>`;
  modal.classList.add('open');
}

async function salvarEdicaoPedido(pedidoId){
  const fb = document.getElementById('ep-feedback');
  if(fb) fb.innerHTML='<div style="color:var(--text2);font-size:13px">⏳ Salvando...</div>';
  const update = {
    cliente: document.getElementById('ep-cliente')?.value||'',
    telefone: document.getElementById('ep-telefone')?.value||'',
    endereco: document.getElementById('ep-endereco')?.value||'',
    valor: parseFloat(document.getElementById('ep-valor')?.value)||0,
    taxa_entrega: parseFloat(document.getElementById('ep-taxa')?.value)||0,
    numero: document.getElementById('ep-numero')?.value||'',
    pontos: parseInt(document.getElementById('ep-pontos')?.value)||4,
    descricao: document.getElementById('ep-descricao')?.value||'',
    updated_at: new Date().toISOString(),
  };
  await db('pedidos','PATCH',update,`?id=eq.${pedidoId}`);
  await logAcao('editar_pedido',{pedido_id:pedidoId});
  if(fb) fb.innerHTML='<div style="color:var(--green);font-size:13px">✅ Salvo!</div>';
  showNotif('✅ Pedido atualizado!','');
  setTimeout(()=>{
    document.getElementById('modal-editar-pedido')?.classList.remove('open');
    atualizarTudo();
  },1200);
}

// ═══════════════════════════════════════════════
// GEOCODING & DISTÂNCIA
// ═══════════════════════════════════════════════
async function geocodificarEndereco(endereco){
  try{
    const query=encodeURIComponent(endereco+', Ribeirão Preto, SP, Brasil');
    const r=await fetch(`https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1`,{headers:{'Accept-Language':'pt-BR','User-Agent':'LetsGoDelivery/1.0'}});
    const data=await r.json();
    if(data&&data.length>0)return{lat:parseFloat(data[0].lat),lng:parseFloat(data[0].lon),display:data[0].display_name};
  }catch(e){}
  return null;
}
function calcularDistancia(lat1,lon1,lat2,lon2){
  const R=6371,dLat=(lat2-lat1)*Math.PI/180,dLon=(lon2-lon1)*Math.PI/180;
  const a=Math.sin(dLat/2)**2+Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
  return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}
async function encontrarMotoboyMaisProximo(lat,lng){
  const motoboys=await db('entregadores','GET',null,'?disponivel=eq.true');
  if(!motoboys||motoboys.length===0)return null;
  let melhor=null,menorDist=Infinity;
  motoboys.forEach(m=>{
    const mlat=m.lat||m.latitude,mlng=m.lng||m.longitude;
    if(!mlat||!mlng)return;
    const dist=calcularDistancia(lat,lng,mlat,mlng);
    if(dist<menorDist){menorDist=dist;melhor={...m,distancia:dist};}
  });
  if(!melhor&&motoboys.length>0)melhor={...motoboys[0],distancia:null};
  return melhor;
}

// ═══════════════════════════════════════════════
// CRIAR PEDIDO
// ═══════════════════════════════════════════════
async function criarPedido(){
  const endereco=(document.getElementById('np-endereco')||{}).value||'';
  const valor=parseFloat((document.getElementById('np-valor')||{}).value)||0;
  const numero=(document.getElementById('np-numero')||{}).value||Math.floor(Math.random()*9000+1000);
  const descricao=(document.getElementById('np-descricao')||{}).value||'';
  const cliente=(document.getElementById('np-cliente')||{}).value||'';
  const taxa=parseFloat((document.getElementById('np-taxa')||{}).value)||0;
  const pontos=parseInt((document.getElementById('np-pontos')||{}).value)||4;
  if(!endereco){showNotif('Erro','Endereço obrigatório','var(--red)');return;}

  const fb=document.getElementById('np-feedback');
  if(fb)fb.innerHTML='<div style="color:var(--text2);font-size:13px">📍 Localizando endereço...</div>';

  const geo=await geocodificarEndereco(endereco);
  const lat=geo?.lat||-21.1775;
  const lng=geo?.lng||-47.8103;
  const agora=new Date().toISOString();

  // Calcula distância da loja ao cliente
  // Pega coordenadas da loja se tiver, senão usa centro de Ribeirão Preto
  let latLoja=-21.1775, lngLoja=-47.8103;
  if(currentPerfil==='loja'&&currentUser.loja_id){
    const lojaData=await db('lojas','GET',null,`?id=eq.${currentUser.loja_id}`);
    if(lojaData&&lojaData[0]?.latitude) { latLoja=lojaData[0].latitude; lngLoja=lojaData[0].longitude; }
  }
  const distKm=parseFloat(calcularDistancia(latLoja,lngLoja,lat,lng).toFixed(2));

  if(fb)fb.innerHTML='<div style="color:var(--text2);font-size:13px">⏳ Criando pedido...</div>';

  const lojaId=currentPerfil==='loja'?currentUser.loja_id:null;

  // Pedido começa como RECEBIDO — vira PRONTO automaticamente em 60s
  const pedido={
    numero:String(numero),
    numero_loja:String(numero),
    endereco,valor,descricao,cliente,
    status:'recebido',
    status_detalhado:'recebido',
    origem:currentPerfil==='loja'?'loja':'backend',
    loja_id:lojaId,
    latitude:lat,longitude:lng,
    taxa_entrega:taxa,
    pontos:pontos,
    distancia_km:distKm,
    recebido_em:agora,
    codigo_confirmacao:null,  // será gerado ao virar pronto
    created_at:agora,
    updated_at:agora
  };

  const result=await db('pedidos','POST',pedido);
  await logAcao('criar_pedido',{numero,endereco,valor,origem:currentPerfil});

  if(result&&result.length>0){
    if(fb){
      fb.innerHTML=`<div style="background:#22c55e18;border:1px solid #22c55e30;border-radius:9px;padding:12px;font-size:13px">
        ✅ <b>Pedido #${numero} criado!</b><br>
        <span style="color:var(--text2)">📍 ${distKm} km da loja • ⏱ Pronto em 60s</span>
      </div>`;
    }
    showNotif('Pedido criado!','Ficará pronto em 60s');
    setTimeout(()=>fecharModal('modal-pedido'),2500);
  }else{
    if(fb)fb.innerHTML='<div style="color:var(--red);font-size:13px">❌ Erro ao criar pedido.</div>';
  }
}

// ═══════════════════════════════════════════════
// PÁGINAS SECUNDÁRIAS
// ═══════════════════════════════════════════════
async function renderPedidosPage(){
  document.getElementById('app-body').innerHTML=`
    <div class="alt-page">
      <div class="page-header">
        <div class="page-title">📦 Pedidos</div>
        <div style="display:flex;gap:8px">
          ${currentPerfil!=='suporte'?`<button class="btn-sm btn-primary-sm" onclick="abrirModal('modal-pedido')">➕ Novo Pedido</button>`:''}
          <button class="btn-sm btn-primary-sm" onclick="renderPedidosPage()">↻ Atualizar</button>
        </div>
      </div>
      <div class="card"><div style="overflow-x:auto">
        <table><thead><tr><th>Pedido</th><th>Endereço</th><th>Valor</th><th>Status</th><th>Código</th><th>Data</th></tr></thead>
        <tbody id="tbody-pedidos"><tr><td colspan="6" style="text-align:center;padding:32px;color:var(--text3)">Carregando...</td></tr></tbody></table>
      </div></div>
    </div>`;
  const pedidos=await db('pedidos','GET',null,'?order=created_at.desc&limit=100');
  const tbody=document.getElementById('tbody-pedidos');
  if(!tbody)return;
  tbody.innerHTML=pedidos.length===0
    ?'<tr><td colspan="6" style="text-align:center;padding:32px;color:var(--text3)">Nenhum pedido</td></tr>'
    :pedidos.map(p=>{
      const sk=getStatusKey(p);
      return`<tr>
        <td style="font-weight:700;color:var(--text)">#${p.numero||p.id?.substring(0,6)}</td>
        <td>${p.endereco||'—'}</td>
        <td style="font-weight:700;color:var(--green)">R$ ${(p.valor||0).toFixed(2)}</td>
        <td><span class="p-badge b-${sk}">${getStatusLabel(p)}</span></td>
        <td style="font-weight:700;letter-spacing:4px;color:var(--pink)">${p.codigo_confirmacao||'—'}</td>
        <td style="font-size:12px;color:var(--text3)">${p.created_at?new Date(p.created_at).toLocaleString('pt-BR'):'—'}</td>
      </tr>`;
    }).join('');
}

async function renderMotoboyPage(){
  document.getElementById('app-body').innerHTML=`
    <div class="alt-page">
      <div class="page-header"><div class="page-title">🛵 Motoboys</div><button class="btn-sm btn-primary-sm" onclick="renderMotoboyPage()">↻ Atualizar</button></div>
      <div class="card"><div style="overflow-x:auto">
        <table><thead><tr><th>Nome</th><th>Status</th><th>Disponível</th><th>Localização</th><th>Atualizado</th></tr></thead>
        <tbody id="tbody-moto"><tr><td colspan="5" style="text-align:center;padding:32px;color:var(--text3)">Carregando...</td></tr></tbody></table>
      </div></div>
    </div>`;
  const data=await db('entregadores','GET',null,'?order=updated_at.desc');
  const tbody=document.getElementById('tbody-moto');
  if(!tbody)return;
  tbody.innerHTML=data.length===0
    ?'<tr><td colspan="5" style="text-align:center;padding:32px;color:var(--text3)">Nenhum motoboy</td></tr>'
    :data.map(e=>`<tr>
      <td style="font-weight:600;color:var(--text)">🛵 ${e.nome||e.id?.substring(0,8)}</td>
      <td><span class="p-badge b-${e.status==='ocupado'?'aguardando':'entregue'}">${e.status||'—'}</span></td>
      <td><span class="p-badge b-${e.disponivel?'em_rota':'fila'}">${e.disponivel?'Online':'Offline'}</span></td>
      <td style="font-size:12px;color:var(--text3)">${e.lat?e.lat.toFixed(4)+', '+e.lng?.toFixed(4):'—'}</td>
      <td style="font-size:12px;color:var(--text3)">${e.updated_at?new Date(e.updated_at).toLocaleString('pt-BR'):'—'}</td>
    </tr>`).join('');
}

async function renderLojasPage(){
  document.getElementById('app-body').innerHTML=`
    <div class="alt-page">
      <div class="page-header">
        <div class="page-title">🏪 Lojas</div>
        <button class="btn-sm btn-primary-sm" onclick="abrirModal('modal-loja')">➕ Nova Loja</button>
      </div>
      <div class="card"><div style="overflow-x:auto">
        <table><thead><tr><th>Nome</th><th>Telefone</th><th>Endereço</th><th>E-mail acesso</th><th>Status</th></tr></thead>
        <tbody id="tbody-lojas"><tr><td colspan="5" style="text-align:center;padding:32px;color:var(--text3)">Carregando...</td></tr></tbody></table>
      </div></div>
    </div>`;
  const data=await db('lojas','GET',null,'?order=created_at.desc');
  const tbody=document.getElementById('tbody-lojas');
  if(!tbody)return;
  tbody.innerHTML=data.length===0
    ?'<tr><td colspan="5" style="text-align:center;padding:32px;color:var(--text3)">Nenhuma loja</td></tr>'
    :data.map(l=>`<tr>
      <td style="font-weight:600;color:var(--text)">🏪 ${l.nome}</td>
      <td>${l.telefone||'—'}</td>
      <td>${l.endereco||'—'}</td>
      <td style="font-size:12px;color:var(--text3)">${l.email||'—'}</td>
      <td><span class="p-badge b-${l.ativo?'em_rota':'fila'}">${l.ativo?'Ativa':'Inativa'}</span></td>
    </tr>`).join('');
}

async function criarLoja(){
  const nome=document.getElementById('loja-nome').value;
  const telefone=document.getElementById('loja-telefone').value;
  const endereco=document.getElementById('loja-endereco').value;
  const email=document.getElementById('loja-email').value;
  const senha=document.getElementById('loja-senha').value;
  const fb=document.getElementById('loja-feedback');
  if(!nome||!email||!senha){fb.innerHTML='<div style="color:var(--red);font-size:13px">Preencha nome, e-mail e senha.</div>';return;}
  fb.innerHTML='<div style="color:var(--text2);font-size:13px">⏳ Cadastrando...</div>';
  const lojas=await db('lojas','POST',{nome,telefone,endereco,email,ativo:true});
  if(!lojas||lojas.length===0){fb.innerHTML='<div style="color:var(--red);font-size:13px">❌ Erro ao cadastrar loja.</div>';return;}
  const lojaId=lojas[0].id;
  await db('usuarios_painel','POST',{nome,email,senha,perfil:'loja',loja_id:lojaId,ativo:true});
  await logAcao('criar_loja',{nome,email});
  fb.innerHTML='<div style="color:var(--green);font-size:13px">✅ Loja cadastrada!</div>';
  showNotif('Loja criada!',`${nome} pode acessar com ${email}`);
  setTimeout(()=>fecharModal('modal-loja'),2000);
}

async function renderUsuariosPage(){
  document.getElementById('app-body').innerHTML=`
    <div class="alt-page">
      <div class="page-header">
        <div class="page-title">👥 Usuários do Painel</div>
        <button class="btn-sm btn-primary-sm" onclick="abrirModalUsuario()">➕ Novo Usuário</button>
      </div>
      <div class="card"><div style="overflow-x:auto">
        <table><thead><tr><th>Nome</th><th>E-mail</th><th>Perfil</th><th>Loja</th><th>Status</th><th>Criado em</th></tr></thead>
        <tbody id="tbody-usuarios"><tr><td colspan="6" style="text-align:center;padding:32px;color:var(--text3)">Carregando...</td></tr></tbody></table>
      </div></div>
    </div>`;
  const data=await db('usuarios_painel','GET',null,'?order=created_at.desc');
  const lojas=await db('lojas','GET',null,'');
  const tbody=document.getElementById('tbody-usuarios');
  if(!tbody)return;
  const badgeMap={adm:'badge-adm',loja:'badge-loja',suporte:'badge-suporte'};
  tbody.innerHTML=data.length===0
    ?'<tr><td colspan="6" style="text-align:center;padding:32px;color:var(--text3)">Nenhum usuário</td></tr>'
    :data.map(u=>{
      const loja=lojas.find(l=>l.id===u.loja_id);
      return`<tr>
        <td style="font-weight:600;color:var(--text)">${u.nome}</td>
        <td style="font-size:12px">${u.email}</td>
        <td><span class="user-perfil-badge ${badgeMap[u.perfil]||''}">${u.perfil?.toUpperCase()}</span></td>
        <td style="font-size:12px;color:var(--text3)">${loja?loja.nome:'—'}</td>
        <td><span class="p-badge b-${u.ativo?'em_rota':'fila'}">${u.ativo?'Ativo':'Inativo'}</span></td>
        <td style="font-size:12px;color:var(--text3)">${u.created_at?new Date(u.created_at).toLocaleString('pt-BR'):'—'}</td>
      </tr>`;
    }).join('');
}

async function abrirModalUsuario(){
  const lojas=await db('lojas','GET',null,'');
  const sel=document.getElementById('u-loja-id');
  sel.innerHTML='<option value="">Selecione a loja</option>'+lojas.map(l=>`<option value="${l.id}">${l.nome}</option>`).join('');
  document.getElementById('u-perfil').onchange=function(){
    document.getElementById('u-loja-row').style.display=this.value==='loja'?'grid':'none';
  };
  abrirModal('modal-usuario');
}

async function criarUsuario(){
  const nome=document.getElementById('u-nome').value;
  const email=document.getElementById('u-email').value;
  const senha=document.getElementById('u-senha').value;
  const perfil=document.getElementById('u-perfil').value;
  const lojaId=document.getElementById('u-loja-id').value||null;
  const fb=document.getElementById('u-feedback');
  if(!nome||!email||!senha){fb.innerHTML='<div style="color:var(--red);font-size:13px">Preencha todos os campos.</div>';return;}
  fb.innerHTML='<div style="color:var(--text2);font-size:13px">⏳ Cadastrando...</div>';
  const result=await db('usuarios_painel','POST',{nome,email,senha,perfil,loja_id:lojaId,ativo:true});
  await logAcao('criar_usuario',{nome,email,perfil});
  if(result&&result.length>0){
    fb.innerHTML='<div style="color:var(--green);font-size:13px">✅ Usuário cadastrado!</div>';
    showNotif('Usuário criado!',`${nome} (${perfil})`);
    setTimeout(()=>fecharModal('modal-usuario'),2000);
  }else{
    fb.innerHTML='<div style="color:var(--red);font-size:13px">❌ Erro. E-mail pode já estar cadastrado.</div>';
  }
}

async function renderRelatoriosPage(){
  document.getElementById('app-body').innerHTML=`
    <div class="alt-page">
      <div class="page-header"><div class="page-title">📈 Relatórios</div></div>
      <div class="stats-grid">
        <div class="stat-card"><div class="stat-label">Total Pedidos</div><div class="stat-value" id="r-total">—</div></div>
        <div class="stat-card"><div class="stat-label">Entregues</div><div class="stat-value" id="r-ent" style="color:var(--green)">—</div></div>
        <div class="stat-card"><div class="stat-label">Faturamento</div><div class="stat-value" id="r-fat" style="color:var(--accent)">—</div></div>
        <div class="stat-card"><div class="stat-label">Motoboys</div><div class="stat-value" id="r-moto">—</div></div>
        <div class="stat-card"><div class="stat-label">Lojas</div><div class="stat-value" id="r-lojas">—</div></div>
        <div class="stat-card"><div class="stat-label">Usuários</div><div class="stat-value" id="r-usuarios">—</div></div>
      </div>
      <div class="card">
        <div class="card-header"><span class="card-title">Pedidos por Status</span></div>
        <div style="padding:20px" id="status-bars"></div>
      </div>
    </div>`;
  const [pedidos,motoboys,lojas,usuarios]=await Promise.all([
    db('pedidos','GET',null,''),db('entregadores','GET',null,''),
    db('lojas','GET',null,''),db('usuarios_painel','GET',null,'')
  ]);
  document.getElementById('r-total').textContent=pedidos.length;
  document.getElementById('r-ent').textContent=pedidos.filter(p=>p.status==='entregue'||p.status==='finalizado').length;
  document.getElementById('r-fat').textContent='R$'+pedidos.reduce((s,p)=>s+(p.valor||0),0).toFixed(0);
  document.getElementById('r-moto').textContent=motoboys.length;
  document.getElementById('r-lojas').textContent=lojas.length;
  document.getElementById('r-usuarios').textContent=usuarios.length;
  const sc={};
  pedidos.forEach(p=>{const s=getStatusKey(p);sc[s]=(sc[s]||0)+1;});
  const total=pedidos.length||1;
  const colors={recebido:'#ef4444',pronto:'#ec4899',aceito:'#8b5cf6',em_rota:'#1A56DB',finalizado:'#22c55e',entregue:'#475569'};
  document.getElementById('status-bars').innerHTML=Object.entries(sc).map(([s,n])=>`
    <div style="margin-bottom:14px">
      <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:5px">
        <span style="color:var(--text2)">${STATUS_LABEL[s]||s}</span><span style="font-weight:700">${n}</span>
      </div>
      <div style="background:var(--surface2);border-radius:4px;height:8px;overflow:hidden">
        <div style="background:${colors[s]||'#475569'};height:100%;width:${(n/total*100).toFixed(1)}%;border-radius:4px"></div>
      </div>
    </div>`).join('');
}

async function renderLogsPage(){
  document.getElementById('app-body').innerHTML=`
    <div class="alt-page">
      <div class="page-header"><div class="page-title">📋 Logs de Ações</div><button class="btn-sm btn-primary-sm" onclick="renderLogsPage()">↻ Atualizar</button></div>
      <div class="card"><div style="overflow-x:auto">
        <table><thead><tr><th>Data/Hora</th><th>Usuário</th><th>Ação</th><th>Detalhes</th></tr></thead>
        <tbody id="tbody-logs"><tr><td colspan="4" style="text-align:center;padding:32px;color:var(--text3)">Carregando...</td></tr></tbody></table>
      </div></div>
    </div>`;
  const logs=await db('logs_acoes','GET',null,'?order=created_at.desc&limit=100');
  const usuarios=await db('usuarios_painel','GET',null,'');
  const tbody=document.getElementById('tbody-logs');
  if(!tbody)return;
  tbody.innerHTML=logs.length===0
    ?'<tr><td colspan="4" style="text-align:center;padding:32px;color:var(--text3)">Nenhum log</td></tr>'
    :logs.map(l=>{
      const u=usuarios.find(x=>x.id===l.usuario_id);
      return`<tr>
        <td style="font-size:12px;color:var(--text3)">${l.created_at?new Date(l.created_at).toLocaleString('pt-BR'):'—'}</td>
        <td style="font-weight:600;color:var(--text)">${u?u.nome:'—'} <span style="font-size:10px;color:var(--text3)">(${u?.perfil||'—'})</span></td>
        <td><span class="p-badge b-disponivel">${l.acao}</span></td>
        <td style="font-size:12px;color:var(--text3)">${l.detalhes?JSON.stringify(l.detalhes).substring(0,80):'—'}</td>
      </tr>`;
    }).join('');
}

// ═══════════════════════════════════════════════
// TABELAS DE PREÇOS
// ═══════════════════════════════════════════════
let _tabAba='cobranca';
async function renderTabelasPrecoPage(){
  document.getElementById('app-body').innerHTML=`
    <div class="alt-page">
      <div class="page-header"><div class="page-title">💰 Tabelas de Preços</div><div id="tp-btn-novo"></div></div>
      <div style="display:flex;gap:0;margin-bottom:20px;border-bottom:1px solid var(--border)">
        <button id="aba-cobranca" onclick="trocarAbaTabela('cobranca')" style="padding:10px 24px;border:none;background:none;font-family:Inter,sans-serif;font-size:13px;font-weight:600;cursor:pointer;border-bottom:2px solid var(--accent);color:var(--accent)">📋 Cobrança Cliente</button>
        <button id="aba-pagamento" onclick="trocarAbaTabela('pagamento')" style="padding:10px 24px;border:none;background:none;font-family:Inter,sans-serif;font-size:13px;font-weight:600;cursor:pointer;border-bottom:2px solid transparent;color:var(--text3)">🛵 Pagamento Motoboy</button>
      </div>
      <div class="card" id="tabelas-lista"><div style="padding:24px;text-align:center;color:var(--text3)">Carregando...</div></div>
    </div>`;
  _tabAba='cobranca'; await carregarTabelasPreco();
}
function trocarAbaTabela(aba){
  _tabAba=aba;
  const bc=document.getElementById('aba-cobranca'),bp=document.getElementById('aba-pagamento');
  if(aba==='cobranca'){bc.style.borderBottom='2px solid var(--accent)';bc.style.color='var(--accent)';bp.style.borderBottom='2px solid transparent';bp.style.color='var(--text3)';}
  else{bp.style.borderBottom='2px solid #10b981';bp.style.color='#10b981';bc.style.borderBottom='2px solid transparent';bc.style.color='var(--text3)';}
  carregarTabelasPreco();
}
async function carregarTabelasPreco(){
  const tabelas=await db('tabelas_preco','GET',null,`?tipo=eq.${_tabAba}&order=created_at.asc`);
  const el=document.getElementById('tabelas-lista'),btnNovo=document.getElementById('tp-btn-novo');
  if(!el)return;
  if(btnNovo){const cor=_tabAba==='pagamento'?'#10b981':'var(--accent)';const label=_tabAba==='pagamento'?'➕ Novo Pagamento':'➕ Nova Cobrança';btnNovo.innerHTML=`<button class="btn-sm" style="background:${cor};color:#fff;border:none;border-radius:8px;padding:8px 16px;font-family:Inter,sans-serif;font-size:13px;font-weight:600;cursor:pointer" onclick="abrirModalNovaTabela('${_tabAba}')">${label}</button>`;}
  if(!tabelas.length){el.innerHTML='<div style="padding:32px;text-align:center;color:var(--text3)">Nenhuma tabela. Clique ➕ para criar.</div>';return;}
  el.innerHTML=`<div style="overflow-x:auto"><table><thead><tr><th>Nome</th><th>Status</th><th>Ações</th></tr></thead><tbody>${tabelas.map(t=>`<tr><td style="font-weight:600;color:var(--text)">💰 ${t.nome}</td><td><span class="p-badge b-${t.ativa?'em_rota':'fila'}">${t.ativa?'Ativa':'Inativa'}</span></td><td style="display:flex;gap:6px"><button class="btn-sm btn-primary-sm" onclick="verFaixas('${t.id}','${t.nome}','${t.tipo||'cobranca'}')">📊 Ver faixas</button><button class="btn-sm" style="background:var(--red);color:#fff" onclick="excluirTabela('${t.id}')">🗑️</button></td></tr>`).join('')}</tbody></table></div>`;
}
async function verFaixas(tabelaId,tabelaNome,tipo){
  const faixas=await db('tabelas_preco_faixas','GET',null,`?tabela_id=eq.${tabelaId}&order=km_de.asc`);
  const isPag=tipo==='pagamento',corSem=isPag?'#10b981':'var(--accent)',corCom=isPag?'#60a5fa':'var(--orange)';
  document.getElementById('modal-tabela-body').innerHTML=`<div style="padding:20px"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px"><h3 style="color:#fff;margin:0">💰 ${tabelaNome}</h3><span class="p-badge" style="background:${corSem}20;color:${corSem}">${isPag?'Pagamento Motoboy':'Cobrança Cliente'}</span></div><table><thead><tr><th>Range</th><th style="color:${corSem}">${isPag?'Sem retorno (motoboy)':'Sem retorno (cliente)'}</th><th style="color:${corCom}">${isPag?'Com retorno (motoboy)':'Com retorno (cliente)'}</th><th>Ações</th></tr></thead><tbody>${faixas.map(f=>`<tr><td style="color:var(--text)">${f.km_de} a ${f.km_ate} km</td><td style="color:${corSem};font-weight:700">R$ ${parseFloat(f.valor_sem_retorno).toFixed(4)}</td><td style="color:${corCom};font-weight:700">R$ ${parseFloat(f.valor_com_retorno).toFixed(4)}</td><td style="display:flex;gap:6px"><button class="btn-sm btn-primary-sm" onclick="editarFaixa('${f.id}','${tabelaId}','${tabelaNome}','${tipo}',${f.km_de},${f.km_ate},${f.valor_sem_retorno},${f.valor_com_retorno})">✏️</button><button class="btn-sm" style="background:var(--red);color:#fff" onclick="excluirFaixa('${f.id}','${tabelaId}','${tabelaNome}','${tipo}')">🗑️</button></td></tr>`).join('')}</tbody></table><div style="margin-top:16px"><button class="btn-sm btn-primary-sm" onclick="adicionarFaixa('${tabelaId}','${tabelaNome}','${tipo}')">➕ Nova faixa</button></div></div>`;
  abrirModal('modal-tabela-preco');
}
async function excluirFaixa(faixaId,tabelaId,tabelaNome,tipo){if(!confirm('Excluir?'))return;await db('tabelas_preco_faixas','DELETE',null,`?id=eq.${faixaId}`);showNotif('🗑️ Faixa excluída','','var(--red)');verFaixas(tabelaId,tabelaNome,tipo);}
function abrirModalNovaTabela(tipo){
  _faixaCount=1;const isPag=tipo==='pagamento',cor=isPag?'#10b981':'var(--accent)';
  document.getElementById('modal-tabela-body').innerHTML=`<div style="padding:20px"><h3 style="color:#fff;margin:0 0 16px">➕ Nova Tabela <span class="p-badge" style="background:${cor}20;color:${cor}">${isPag?'Pagamento':'Cobrança'}</span></h3><div class="form-row full"><div class="fi"><label>Nome</label><input id="tp-nome" placeholder="Ex: Tabela Lets Go"/></div></div><div style="margin:12px 0 6px;font-size:12px;font-weight:600;color:var(--text2)">Faixas</div><div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:6px;margin-bottom:6px"><span style="font-size:11px;color:var(--text3)">Km de</span><span style="font-size:11px;color:var(--text3)">Km até</span><span style="font-size:11px;color:var(--text3)">Sem retorno R$</span><span style="font-size:11px;color:var(--text3)">Com retorno R$</span></div><div id="tp-faixas">${gerarLinhaFaixa(0)}</div><button onclick="adicionarLinhaFaixa()" style="background:var(--surface2);color:var(--text2);border:1px solid var(--border);border-radius:8px;padding:7px 12px;cursor:pointer;font-size:12px;margin-top:8px">➕ Faixa</button><div id="tp-feedback" style="margin-top:10px"></div><div style="display:flex;gap:10px;justify-content:flex-end;margin-top:16px"><button class="btn-modal-cancel" onclick="fecharModal('modal-tabela-preco')">Cancelar</button><button class="btn-modal-primary" onclick="salvarNovaTabela('${tipo}')">✅ Cadastrar</button></div></div>`;
  abrirModal('modal-tabela-preco');
}
let _faixaCount=1;
function gerarLinhaFaixa(idx){return`<div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:6px;margin-bottom:6px"><input type="number" id="f-de-${idx}" placeholder="0" step="0.0001"/><input type="number" id="f-ate-${idx}" placeholder="1.5" step="0.0001"/><input type="number" id="f-sem-${idx}" placeholder="0.0000" step="0.0001"/><input type="number" id="f-com-${idx}" placeholder="0.0000" step="0.0001"/></div>`;}
function adicionarLinhaFaixa(){document.getElementById('tp-faixas').insertAdjacentHTML('beforeend',gerarLinhaFaixa(_faixaCount++));}
async function salvarNovaTabela(tipo){
  const nome=document.getElementById('tp-nome').value.trim(),fb=document.getElementById('tp-feedback');
  if(!nome){fb.innerHTML='<div style="color:var(--red);font-size:12px">Informe o nome</div>';return;}
  fb.innerHTML='<div style="color:var(--text2);font-size:12px">⏳ Salvando...</div>';
  const tabela=await db('tabelas_preco','POST',{nome,ativa:true,tipo});
  if(!tabela||!tabela[0]){fb.innerHTML='<div style="color:var(--red)">Erro</div>';return;}
  const faixas=[];
  for(let i=0;i<_faixaCount;i++){const el=document.getElementById(`f-ate-${i}`);if(!el)continue;const ate=parseFloat(el.value)||0;if(ate>0)faixas.push({tabela_id:tabela[0].id,km_de:parseFloat(document.getElementById(`f-de-${i}`).value)||0,km_ate:ate,valor_sem_retorno:parseFloat(document.getElementById(`f-sem-${i}`).value)||0,valor_com_retorno:parseFloat(document.getElementById(`f-com-${i}`).value)||0});}
  if(faixas.length)await db('tabelas_preco_faixas','POST',faixas);
  showNotif('✅ Tabela criada!',nome);fecharModal('modal-tabela-preco');await carregarTabelasPreco();
}
async function adicionarFaixa(tabelaId,tabelaNome,tipo){fecharModal('modal-tabela-preco');const de=prompt('Km de:','0'),ate=prompt('Km até:',''),sem=prompt('Sem retorno (R$):','0.0000'),com=prompt('Com retorno (R$):','0.0000');if(!ate)return;await db('tabelas_preco_faixas','POST',{tabela_id:tabelaId,km_de:parseFloat(de)||0,km_ate:parseFloat(ate)||0,valor_sem_retorno:parseFloat(sem)||0,valor_com_retorno:parseFloat(com)||0});showNotif('✅ Faixa adicionada!','');verFaixas(tabelaId,tabelaNome,tipo);}
async function editarFaixa(faixaId,tabelaId,tabelaNome,tipo,de,ate,sem,com){const ns=prompt(`Sem retorno (${de}-${ate}km):`,parseFloat(sem).toFixed(4));if(ns===null)return;const nc=prompt(`Com retorno (${de}-${ate}km):`,parseFloat(com).toFixed(4));if(nc===null)return;await db('tabelas_preco_faixas','PATCH',{valor_sem_retorno:parseFloat(ns)||0,valor_com_retorno:parseFloat(nc)||0},`?id=eq.${faixaId}`);showNotif('✅ Atualizado!','');verFaixas(tabelaId,tabelaNome,tipo);}
async function excluirTabela(id){if(!confirm('Excluir tabela e faixas?'))return;await db('tabelas_preco_faixas','DELETE',null,`?tabela_id=eq.${id}`);await db('tabelas_preco','DELETE',null,`?id=eq.${id}`);showNotif('🗑️ Excluída','','var(--red)');carregarTabelasPreco();}

// ═══════════════════════════════════════════════
// PÁGINAS LOJA
// ═══════════════════════════════════════════════
function renderNovoPedidoPage(){
  document.getElementById('app-body').innerHTML=`<div class="alt-page" style="display:flex;align-items:flex-start;justify-content:center"><div style="width:100%;max-width:520px"><div class="page-header"><div class="page-title">➕ Novo Pedido</div></div><div class="card"><div class="modal-body"><div class="form-row"><div class="fi"><label>Cliente</label><input id="np-cliente" placeholder="Nome"/></div><div class="fi"><label>Telefone</label><input id="np-telefone" placeholder="(16) 99999-9999"/></div></div><div class="form-row full"><div class="fi"><label>Endereço</label><input id="np-endereco" placeholder="Rua, número, bairro"/></div></div><div class="form-row"><div class="fi"><label>Valor (R$)</label><input type="number" id="np-valor" placeholder="0.00" step="0.01"/></div><div class="fi"><label>Nº Pedido</label><input id="np-numero" placeholder="Ex: 8001"/></div></div><div class="form-row"><div class="fi"><label>Taxa entrega (R$)</label><input type="number" id="np-taxa" placeholder="0.00" step="0.01"/></div><div class="fi"><label>⭐ Pontos</label><input type="number" id="np-pontos" value="4" min="1" max="20"/></div></div><div class="form-row full"><div class="fi"><label>Observações</label><textarea id="np-descricao" placeholder="Itens..."></textarea></div></div><div id="np-feedback" style="margin-top:4px"></div><div style="display:flex;justify-content:flex-end;margin-top:16px"><button class="btn-modal-primary" onclick="criarPedido()">🚀 Criar Pedido</button></div></div></div></div></div>`;
}
async function renderLojaPedidosPage(){
  document.getElementById('app-body').innerHTML=`<div class="alt-page"><div class="page-header"><div class="page-title">📦 Meus Pedidos</div><button class="btn-sm btn-primary-sm" onclick="renderLojaPedidosPage()">↻</button></div><div class="card"><div style="overflow-x:auto"><table><thead><tr><th>Pedido</th><th>Endereço</th><th>Valor</th><th>Status</th><th>Código</th></tr></thead><tbody id="tbody-loja-pedidos"><tr><td colspan="5" style="text-align:center;padding:32px;color:var(--text3)">Carregando...</td></tr></tbody></table></div></div></div>`;
  const pedidos=currentUser?.loja_id?await db('pedidos','GET',null,`?loja_id=eq.${currentUser.loja_id}&order=created_at.desc&limit=50`):[];
  const tbody=document.getElementById('tbody-loja-pedidos');if(!tbody)return;
  tbody.innerHTML=pedidos.length===0?'<tr><td colspan="5" style="text-align:center;padding:32px;color:var(--text3)">Nenhum pedido</td></tr>':pedidos.map(p=>`<tr><td style="font-weight:700">#${p.numero||p.id?.substring(0,6)}</td><td>${p.endereco||'—'}</td><td style="color:var(--green);font-weight:700">R$ ${(p.valor||0).toFixed(2)}</td><td><span class="p-badge b-${getStatusKey(p)}">${getStatusLabel(p)}</span></td><td style="font-weight:700;letter-spacing:4px;color:var(--pink)">${p.codigo_confirmacao||'—'}</td></tr>`).join('');
}
function renderLojaMapaPage(){
  document.getElementById('app-body').innerHTML=`<div style="flex:1;position:relative;overflow:hidden;height:100%"><div class="mapa-stats"><div class="mapa-stat"><span style="font-size:16px">📦</span><div><div class="mapa-stat-val" id="ms-pedidos">0</div><div class="mapa-stat-label">Pedidos</div></div></div></div><div id="map" style="width:100%;height:100%"></div></div>`;
  setTimeout(()=>{if(map){map.remove();map=null;}map=L.map('map',{zoomControl:false}).setView([-21.1775,-47.8103],13);L.control.zoom({position:'bottomright'}).addTo(map);L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',{attribution:'© OSM © CartoDB',maxZoom:19}).addTo(map);const at=async()=>{const p=currentUser?.loja_id?await db('pedidos','GET',null,`?loja_id=eq.${currentUser.loja_id}&order=created_at.desc&limit=50`):[];allPedidos=p;const ms=document.getElementById('ms-pedidos');if(ms)ms.textContent=p.length;atualizarMarcadores();};at();realtimeInterval=setInterval(at,5000);},100);
}
async function renderLojaRelatorioPage(){
  document.getElementById('app-body').innerHTML=`<div class="alt-page"><div class="page-header"><div class="page-title">📈 Relatório</div></div><div class="stats-grid"><div class="stat-card"><div class="stat-label">Total Pedidos</div><div class="stat-value" id="lr-total">—</div></div><div class="stat-card"><div class="stat-label">Entregues</div><div class="stat-value" id="lr-ent" style="color:var(--green)">—</div></div><div class="stat-card"><div class="stat-label">Faturamento</div><div class="stat-value" id="lr-fat" style="color:var(--accent)">—</div></div></div></div>`;
  const pedidos=currentUser?.loja_id?await db('pedidos','GET',null,`?loja_id=eq.${currentUser.loja_id}`):[];
  document.getElementById('lr-total').textContent=pedidos.length;
  document.getElementById('lr-ent').textContent=pedidos.filter(p=>p.status==='finalizado'||p.status==='entregue').length;
  document.getElementById('lr-fat').textContent='R$'+pedidos.reduce((s,p)=>s+(p.valor||0),0).toFixed(2);
}

// ═══════════════════════════════════════════════
// INICIALIZAÇÃO AUTOMÁTICA (sessão persistida)
// ═══════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', async () => {
  const sessao = sessionStorage.getItem('lg_user');
  if (!sessao) return;
  try {
    const user = JSON.parse(sessao);
    currentUser=user; currentPerfil=user.perfil;
    document.getElementById('login-screen').style.display='none';
    const appEl=document.getElementById('app');
    appEl.style.display='flex'; appEl.getBoundingClientRect();
    document.getElementById('user-nome').textContent=currentUser.nome;
    const badgeMap={adm:'badge-adm',loja:'badge-loja',suporte:'badge-suporte'};
    const labelMap={adm:'ADM',loja:'LOJA',suporte:'SUPORTE'};
    const badge=document.getElementById('user-perfil-badge');
    badge.className='user-perfil-badge '+(badgeMap[currentPerfil]||'');
    badge.textContent=labelMap[currentPerfil]||currentPerfil;
    const btnNovo=document.getElementById('btn-novo-pedido');
    if(btnNovo)btnNovo.style.display=currentPerfil!=='suporte'?'flex':'none';
    renderTabs();
    setTimeout(()=>{ goTab(currentPerfil==='adm'?'mapa':currentPerfil==='suporte'?'mapa':'novo-pedido'); _carregarSaldoTopbar(); },150);
  } catch(e){ sessionStorage.removeItem('lg_user'); }
});
