// ═══════════════════════════════════════════════
// CONFIGURAÇÃO SUPABASE
// ═══════════════════════════════════════════════
const SB_URL='https://astbkmpegcmqljltmdpx.supabase.co';
const SB_KEY='sb_publishable_8ocBGGO6EM8GYlg-6HBdmQ_LA6VDL9O';

let currentUser=null,currentPerfil=null,map=null;
let motoboyMarkers={},pedidoMarkers={},lojaMarkers={},realtimeInterval=null;
let allPedidos=[],allMotoboys=[],allLojas=[],filterStatus='todos',selectedPedidoId=null;
let idsProntoNotificados=new Set();


// ═══════════════════════════════════════════════
// TEMA FUTURISTA — injeta CSS no documento
// ═══════════════════════════════════════════════
(function injetarTema(){
  const style = document.createElement('style');
  style.innerHTML = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');

    :root {
      --bg: #f0f4ff;
      --surface: #ffffff;
      --surface2: #f8faff;
      --border: #e2e8f0;
      --text: #0f172a;
      --text2: #475569;
      --text3: #94a3b8;
      --accent: #6366f1;
      --accent2: #818cf8;
      --green: #10b981;
      --red: #ef4444;
      --orange: #f97316;
      --pink: #ec4899;
      --yellow: #f59e0b;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body, #app {
      background: var(--bg) !important;
      font-family: 'Inter', sans-serif !important;
      color: var(--text) !important;
    }

    /* ── TOPBAR ── */
    .topbar {
      background: #ffffff !important;
      border-bottom: 1px solid var(--border) !important;
      box-shadow: 0 1px 20px rgba(99,102,241,.08) !important;
      backdrop-filter: blur(12px) !important;
    }
    .topbar-logo-text { color: var(--text) !important; }
    .topbar-logo-sub  { color: var(--accent) !important; }
    .user-nome        { color: var(--text2) !important; }

    /* ── BOTÃO NOVO PEDIDO ── */
    #btn-novo-pedido, .btn-novo-pedido {
      background: linear-gradient(135deg, #6366f1, #8b5cf6) !important;
      border: none !important;
      box-shadow: 0 4px 14px rgba(99,102,241,.35) !important;
      border-radius: 10px !important;
      font-weight: 600 !important;
      color: #fff !important;
    }

    /* ── SALDO TOPBAR ── */
    #topbar-saldo {
      background: linear-gradient(135deg,#10b981,#059669) !important;
      border-radius: 10px !important;
      color: #fff !important;
      font-weight: 700 !important;
      padding: 6px 14px !important;
      border: none !important;
    }

    /* ── APP BODY ── */
    #app-body { background: var(--bg) !important; }

    /* ── SIDEBAR PEDIDOS ── */
    .sidebar-pedidos {
      background: #ffffff !important;
      border-right: 1px solid var(--border) !important;
      box-shadow: 2px 0 20px rgba(99,102,241,.06) !important;
    }
    .sidebar-title { color: var(--text) !important; font-weight: 700 !important; }
    .sidebar-count {
      background: linear-gradient(135deg,#6366f1,#8b5cf6) !important;
      color: #fff !important;
      border-radius: 20px !important;
      padding: 2px 10px !important;
      font-size: 12px !important;
    }
    .sidebar-header {
      background: #fff !important;
      border-bottom: 1px solid var(--border) !important;
      padding: 16px !important;
    }

    /* ── FILTER TABS ── */
    .filter-tabs { display: flex; gap: 4px; flex-wrap: wrap; margin-top: 8px; }
    .filter-tab {
      background: var(--surface2) !important;
      border: 1px solid var(--border) !important;
      color: var(--text2) !important;
      border-radius: 8px !important;
      padding: 5px 12px !important;
      font-size: 12px !important;
      font-weight: 500 !important;
      cursor: pointer !important;
      transition: all .15s !important;
      font-family: Inter,sans-serif !important;
    }
    .filter-tab.active {
      background: linear-gradient(135deg,#6366f1,#8b5cf6) !important;
      color: #fff !important;
      border-color: #6366f1 !important;
      box-shadow: 0 2px 8px rgba(99,102,241,.3) !important;
    }

    /* ── PEDIDO CARD ── */
    .pedido-item {
      background: #fff !important;
      border: 1px solid var(--border) !important;
      border-radius: 12px !important;
      margin: 8px !important;
      padding: 12px !important;
      cursor: pointer !important;
      transition: all .15s !important;
      box-shadow: 0 1px 6px rgba(0,0,0,.04) !important;
    }
    .pedido-item:hover {
      border-color: #6366f1 !important;
      box-shadow: 0 4px 16px rgba(99,102,241,.15) !important;
      transform: translateY(-1px) !important;
    }
    .pedido-item.selected {
      border-color: #6366f1 !important;
      background: linear-gradient(135deg,#f0f4ff,#faf5ff) !important;
      box-shadow: 0 4px 16px rgba(99,102,241,.2) !important;
    }
    .pedido-num { color: var(--text) !important; font-weight: 700 !important; }
    .pedido-end { color: var(--text2) !important; font-size: 12px !important; margin-top: 4px !important; }
    .pedido-footer { margin-top: 6px !important; }
    .pedido-val { color: #10b981 !important; font-weight: 700 !important; }
    .pedido-hora { color: var(--text3) !important; font-size: 11px !important; }

    /* ── BADGES ── */
    .p-badge {
      border-radius: 20px !important;
      padding: 3px 10px !important;
      font-size: 11px !important;
      font-weight: 600 !important;
    }
    .b-recebido    { background:#fee2e2 !important; color:#dc2626 !important; }
    .b-pronto      { background:#fce7f3 !important; color:#db2777 !important; }
    .b-aceito      { background:#ede9fe !important; color:#7c3aed !important; }
    .b-chegou_local{ background:#dbeafe !important; color:#2563eb !important; }
    .b-em_rota     { background:#dbeafe !important; color:#1d4ed8 !important; }
    .b-retornando  { background:#fef3c7 !important; color:#d97706 !important; }
    .b-finalizado  { background:#d1fae5 !important; color:#059669 !important; }
    .b-cancelado   { background:#fee2e2 !important; color:#dc2626 !important; }
    .b-disponivel  { background:#dbeafe !important; color:#2563eb !important; }
    .b-fila        { background:#f1f5f9 !important; color:#64748b !important; }
    .b-aguardando  { background:#fef3c7 !important; color:#d97706 !important; }
    .b-entregue    { background:#f1f5f9 !important; color:#64748b !important; }

    /* ── MAPA STATS ── */
    .mapa-stats {
      background: rgba(255,255,255,.95) !important;
      backdrop-filter: blur(12px) !important;
      border-radius: 12px !important;
      border: 1px solid var(--border) !important;
      box-shadow: 0 4px 20px rgba(0,0,0,.08) !important;
    }
    .mapa-stat-val { color: var(--accent) !important; font-weight: 800 !important; }
    .mapa-stat-label { color: var(--text3) !important; }
    .mapa-refresh {
      background: rgba(255,255,255,.95) !important;
      color: var(--accent) !important;
      border: 1px solid var(--border) !important;
      border-radius: 8px !important;
      box-shadow: 0 2px 8px rgba(0,0,0,.08) !important;
      font-weight: 600 !important;
    }

    /* ── ALT PAGE ── */
    .alt-page { padding: 24px !important; }
    .page-header { margin-bottom: 20px !important; }
    .page-title {
      font-size: 22px !important;
      font-weight: 800 !important;
      color: var(--text) !important;
      background: linear-gradient(135deg,#6366f1,#8b5cf6);
      -webkit-background-clip: text !important;
      -webkit-text-fill-color: transparent !important;
    }

    /* ── CARDS ── */
    .card {
      background: #fff !important;
      border: 1px solid var(--border) !important;
      border-radius: 16px !important;
      box-shadow: 0 1px 12px rgba(0,0,0,.05) !important;
    }
    .card-header {
      padding: 16px 20px !important;
      border-bottom: 1px solid var(--border) !important;
    }
    .card-title { color: var(--text) !important; font-weight: 700 !important; }
    .stat-card {
      background: #fff !important;
      border: 1px solid var(--border) !important;
      border-radius: 16px !important;
      box-shadow: 0 2px 12px rgba(0,0,0,.05) !important;
      padding: 20px !important;
      transition: transform .15s !important;
    }
    .stat-card:hover { transform: translateY(-2px) !important; box-shadow: 0 6px 20px rgba(99,102,241,.12) !important; }
    .stat-label { color: var(--text3) !important; font-size: 12px !important; font-weight: 600 !important; text-transform: uppercase !important; letter-spacing: .5px !important; }
    .stat-value { color: var(--text) !important; font-size: 28px !important; font-weight: 800 !important; margin-top: 6px !important; }

    /* ── TABELAS ── */
    table { width: 100% !important; border-collapse: collapse !important; }
    thead tr { background: var(--surface2) !important; }
    th {
      padding: 12px 16px !important;
      font-size: 11px !important;
      font-weight: 700 !important;
      color: var(--text3) !important;
      text-transform: uppercase !important;
      letter-spacing: .5px !important;
      border-bottom: 2px solid var(--border) !important;
      text-align: left !important;
    }
    td {
      padding: 12px 16px !important;
      border-bottom: 1px solid var(--border) !important;
      color: var(--text2) !important;
      font-size: 13px !important;
    }
    tr:last-child td { border-bottom: none !important; }
    tr:hover td { background: #f8faff !important; }

    /* ── BOTÕES ── */
    .btn-sm {
      padding: 7px 14px !important;
      border-radius: 8px !important;
      font-size: 12px !important;
      font-weight: 600 !important;
      cursor: pointer !important;
      font-family: Inter,sans-serif !important;
      border: 1px solid var(--border) !important;
      background: #fff !important;
      color: var(--text2) !important;
      transition: all .15s !important;
    }
    .btn-sm:hover { border-color: var(--accent) !important; color: var(--accent) !important; }
    .btn-primary-sm {
      background: linear-gradient(135deg,#6366f1,#8b5cf6) !important;
      color: #fff !important;
      border-color: transparent !important;
      box-shadow: 0 2px 8px rgba(99,102,241,.3) !important;
    }
    .btn-primary-sm:hover { opacity: .9 !important; color: #fff !important; }

    /* ── MODAIS ── */
    .modal-overlay {
      background: rgba(15,23,42,.5) !important;
      backdrop-filter: blur(6px) !important;
    }
    .modal {
      background: #fff !important;
      border-radius: 20px !important;
      border: 1px solid var(--border) !important;
      box-shadow: 0 20px 60px rgba(0,0,0,.15) !important;
    }
    .modal-header {
      background: linear-gradient(135deg,#f0f4ff,#faf5ff) !important;
      border-bottom: 1px solid var(--border) !important;
      border-radius: 20px 20px 0 0 !important;
      padding: 18px 20px !important;
    }
    .modal-title { color: var(--text) !important; font-weight: 700 !important; font-size: 16px !important; }
    .modal-close {
      background: #fff !important;
      border: 1px solid var(--border) !important;
      border-radius: 8px !important;
      color: var(--text3) !important;
      width: 30px !important;
      height: 30px !important;
      cursor: pointer !important;
      font-size: 14px !important;
    }
    .modal-body { padding: 20px !important; }
    .modal-footer {
      padding: 16px 20px !important;
      border-top: 1px solid var(--border) !important;
      background: var(--surface2) !important;
      border-radius: 0 0 20px 20px !important;
      display: flex !important;
      justify-content: flex-end !important;
      gap: 8px !important;
    }
    .btn-modal-cancel {
      background: #fff !important;
      border: 1px solid var(--border) !important;
      border-radius: 10px !important;
      padding: 10px 20px !important;
      color: var(--text2) !important;
      font-weight: 600 !important;
      cursor: pointer !important;
      font-family: Inter,sans-serif !important;
      font-size: 14px !important;
    }
    .btn-modal-primary {
      background: linear-gradient(135deg,#6366f1,#8b5cf6) !important;
      border: none !important;
      border-radius: 10px !important;
      padding: 10px 20px !important;
      color: #fff !important;
      font-weight: 700 !important;
      cursor: pointer !important;
      font-family: Inter,sans-serif !important;
      font-size: 14px !important;
      box-shadow: 0 4px 14px rgba(99,102,241,.35) !important;
    }
    .btn-modal-primary:hover { opacity: .9 !important; }

    /* ── FORMS ── */
    .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px; }
    .form-row.full { grid-template-columns: 1fr; }
    .fi { display: flex; flex-direction: column; gap: 4px; }
    .fi label {
      font-size: 11px !important;
      font-weight: 700 !important;
      color: var(--text3) !important;
      text-transform: uppercase !important;
      letter-spacing: .5px !important;
    }
    .fi input, .fi select, .fi textarea {
      background: var(--surface2) !important;
      border: 1px solid var(--border) !important;
      border-radius: 10px !important;
      padding: 10px 14px !important;
      color: var(--text) !important;
      font-family: Inter,sans-serif !important;
      font-size: 14px !important;
      transition: border-color .15s !important;
      outline: none !important;
    }
    .fi input:focus, .fi select:focus, .fi textarea:focus {
      border-color: var(--accent) !important;
      box-shadow: 0 0 0 3px rgba(99,102,241,.12) !important;
      background: #fff !important;
    }
    .fi textarea { min-height: 80px !important; resize: vertical !important; }

    /* ── NAV SIDEBAR ── */
    #nav-sidebar {
      background: #fff !important;
      border-right: 1px solid var(--border) !important;
      box-shadow: 4px 0 30px rgba(0,0,0,.1) !important;
    }
    .nav-item {
      border-radius: 10px !important;
      margin: 2px 8px !important;
      color: var(--text2) !important;
      font-weight: 500 !important;
      transition: all .15s !important;
      background: none !important;
      border: none !important;
      padding: 10px 12px !important;
      font-family: Inter,sans-serif !important;
      font-size: 14px !important;
      cursor: pointer !important;
      display: flex !important;
      align-items: center !important;
      gap: 10px !important;
      width: calc(100% - 16px) !important;
    }
    .nav-item:hover { background: #f0f4ff !important; color: var(--accent) !important; }
    .nav-item.active {
      background: linear-gradient(135deg,#ede9fe,#e0e7ff) !important;
      color: var(--accent) !important;
      font-weight: 700 !important;
    }
    #nav-overlay { background: rgba(15,23,42,.4) !important; backdrop-filter: blur(4px) !important; }

    /* ── PERFIL BADGES ── */
    .badge-adm    { background: linear-gradient(135deg,#6366f1,#8b5cf6) !important; color: #fff !important; border-radius: 6px !important; padding: 2px 8px !important; font-size: 11px !important; font-weight: 700 !important; }
    .badge-loja   { background: linear-gradient(135deg,#10b981,#059669) !important; color: #fff !important; border-radius: 6px !important; padding: 2px 8px !important; font-size: 11px !important; font-weight: 700 !important; }
    .badge-suporte{ background: linear-gradient(135deg,#f59e0b,#d97706) !important; color: #fff !important; border-radius: 6px !important; padding: 2px 8px !important; font-size: 11px !important; font-weight: 700 !important; }

    /* ── NOTIFICAÇÃO ── */
    #notif {
      background: #fff !important;
      border-radius: 14px !important;
      box-shadow: 0 8px 30px rgba(0,0,0,.12) !important;
      border-left: 4px solid var(--green) !important;
    }
    #notif-title { color: var(--text) !important; font-weight: 700 !important; }
    #notif-msg   { color: var(--text2) !important; font-size: 12px !important; }

    /* ── LOGIN ── */
    #login-screen {
      background: #ffffff !important;
    }
    .login-card {
      background: #ffffff !important;
      border-radius: 16px !important;
      box-shadow: 0 4px 32px rgba(0,0,0,.09) !important;
      padding: 44px 40px !important;
      width: 100% !important;
      max-width: 400px !important;
      border: 1px solid #e8ecf0 !important;
    }
    #login-logo-wrap {
      display: flex !important;
      flex-direction: column !important;
      align-items: center !important;
      margin-bottom: 28px !important;
    }
    #login-logo-icon {
      width: 64px !important;
      height: 64px !important;
      background: #1A56DB !important;
      border-radius: 16px !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      font-size: 28px !important;
      margin-bottom: 14px !important;
      box-shadow: 0 4px 14px rgba(26,86,219,.25) !important;
    }
    #login-logo-text {
      font-size: 22px !important;
      font-weight: 800 !important;
      color: #0f172a !important;
      letter-spacing: -0.4px !important;
      font-family: Inter, sans-serif !important;
    }
    #login-logo-sub {
      font-size: 12px !important;
      color: #64748b !important;
      margin-top: 3px !important;
      font-weight: 500 !important;
      font-family: Inter, sans-serif !important;
    }
    .login-card label {
      font-size: 11px !important;
      font-weight: 700 !important;
      color: #94a3b8 !important;
      text-transform: uppercase !important;
      letter-spacing: 0.6px !important;
      display: block !important;
      margin-bottom: 5px !important;
    }
    .login-card input, .login-card select {
      width: 100% !important;
      background: #f8fafc !important;
      border: 1.5px solid #e2e8f0 !important;
      border-radius: 10px !important;
      padding: 11px 14px !important;
      font-size: 14px !important;
      color: #0f172a !important;
      font-family: Inter, sans-serif !important;
      margin-bottom: 14px !important;
      outline: none !important;
      transition: border-color .15s, box-shadow .15s !important;
      box-sizing: border-box !important;
    }
    .login-card input:focus, .login-card select:focus {
      border-color: #1A56DB !important;
      background: #fff !important;
      box-shadow: 0 0 0 3px rgba(26,86,219,.10) !important;
    }
    #login-btn {
      width: 100% !important;
      background: #1A56DB !important;
      color: #fff !important;
      border: none !important;
      border-radius: 10px !important;
      padding: 13px !important;
      font-size: 15px !important;
      font-weight: 700 !important;
      cursor: pointer !important;
      font-family: Inter, sans-serif !important;
      margin-top: 6px !important;
      transition: background .15s !important;
      letter-spacing: -0.1px !important;
    }
    #login-btn:hover:not(:disabled) { background: #1648c0 !important; }
    #login-btn:disabled { background: #93c5fd !important; cursor: default !important; }
    #login-forgot {
      display: block !important;
      text-align: center !important;
      margin-top: 18px !important;
      font-size: 13px !important;
      color: #1A56DB !important;
      text-decoration: none !important;
      cursor: pointer !important;
      font-family: Inter, sans-serif !important;
      background: none !important;
      border: none !important;
      width: 100% !important;
      padding: 0 !important;
    }
    #login-forgot:hover { text-decoration: underline !important; color: #1648c0 !important; }
    #login-error {
      background: #fef2f2 !important;
      border: 1px solid #fecaca !important;
      color: #dc2626 !important;
      border-radius: 8px !important;
      padding: 10px 14px !important;
      font-size: 13px !important;
      margin-bottom: 12px !important;
    }

    /* ── STATUS DROPDOWN ── */
    .status-dropdown {
      background: #fff !important;
      border: 1px solid var(--border) !important;
      border-radius: 12px !important;
      box-shadow: 0 8px 30px rgba(0,0,0,.12) !important;
    }
    .status-dropdown-item {
      padding: 10px 14px !important;
      border-radius: 8px !important;
      margin: 2px !important;
      background: none !important;
      border: none !important;
      cursor: pointer !important;
      display: flex !important;
      align-items: center !important;
      gap: 8px !important;
      width: calc(100% - 4px) !important;
      font-family: Inter,sans-serif !important;
      font-size: 13px !important;
    }
    .status-dropdown-item:hover { background: var(--surface2) !important; }

    /* ── PAGAMENTO ── */
    .btn-pagamento {
      background: linear-gradient(135deg,#10b981,#059669) !important;
      color: #fff !important;
      border: none !important;
      border-radius: 10px !important;
      padding: 10px !important;
      width: 100% !important;
      font-weight: 700 !important;
      cursor: pointer !important;
      font-family: Inter,sans-serif !important;
      font-size: 13px !important;
      box-shadow: 0 4px 12px rgba(16,185,129,.3) !important;
    }

    /* ── SCROLLBAR ── */
    ::-webkit-scrollbar { width: 4px; height: 4px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: #c7d2fe; border-radius: 4px; }
    ::-webkit-scrollbar-thumb:hover { background: #a5b4fc; }

    /* ── EMPTY STATE ── */
    .empty-lista { color: var(--text3) !important; }
    .empty-lista .ei { font-size: 32px !important; margin-bottom: 8px !important; }

    /* ── PRONTO PULSE ── */
    .pronto-pulse { animation: pulse 1.5s infinite !important; }
    @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.6} }
  `;
  document.head.appendChild(style);
})();


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

function tocarSomPronto(){
  try{
    const ctx=new(window.AudioContext||window.webkitAudioContext)();
    [[880,.0],[1100,.18],[880,.36],[1100,.54]].forEach(([freq,delay])=>{
      const osc=ctx.createOscillator(),gain=ctx.createGain();
      osc.connect(gain);gain.connect(ctx.destination);
      osc.frequency.value=freq;osc.type='sine';
      gain.gain.setValueAtTime(.35,ctx.currentTime+delay);
      gain.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+delay+.18);
      osc.start(ctx.currentTime+delay);osc.stop(ctx.currentTime+delay+.2);
    });
  }catch(e){}
}

async function processarAutoPronto(){
  const agora=new Date();
  const pedidosRecebidos=allPedidos.filter(p=>(p.status_detalhado==='recebido'||p.status==='recebido')&&p.recebido_em);
  for(const p of pedidosRecebidos){
    const diff=(agora-new Date(p.recebido_em))/1000;
    if(diff>=60){
      const codigo=String(Math.floor(Math.random()*9000)+1000);
      await db('pedidos','PATCH',{status:'pronto',status_detalhado:'pronto',pronto_em:agora.toISOString(),codigo_confirmacao:codigo,updated_at:agora.toISOString()},`?id=eq.${p.id}`);
    }
  }
}

function verificarNovosProtos(pedidos){
  pedidos.forEach(p=>{
    if((p.status_detalhado==='pronto'||p.status==='pronto')&&!idsProntoNotificados.has(p.id)){
      idsProntoNotificados.add(p.id);tocarSomPronto();
      showNotif('🔔 Pedido Pronto!',`#${p.numero||p.id?.substring(0,6)} aguardando motoboy`,'var(--pink)');
    }
    if(p.status==='finalizado'||p.status==='entregue')idsProntoNotificados.delete(p.id);
  });
}

function showNotif(title,msg,color='var(--green)'){
  const el=document.getElementById('notif');
  document.getElementById('notif-title').textContent=title;
  document.getElementById('notif-msg').textContent=msg;
  el.style.borderLeftColor=color;el.classList.add('show');
  setTimeout(()=>el.classList.remove('show'),4000);
}

// ═══════════════════════════════════════════════
// MODAL HELPERS — com injeção de loja no modal-pedido
// ═══════════════════════════════════════════════
async function abrirModal(id){
  document.getElementById(id).classList.add('open');
  if(id==='modal-pedido'){
    setTimeout(async()=>{
      const modalBody=document.querySelector('#modal-pedido .modal-body');
      if(!modalBody||document.getElementById('np-loja-id'))return;
      const lojas=await db('lojas','GET',null,'?ativo=eq.true&order=nome.asc');
      // Substituir conteúdo inteiro do modal
      modalBody.innerHTML=`
        <div class="form-row full" style="margin-bottom:4px">
          <div class="fi">
            <label style="color:#1A56DB;font-weight:700">🏪 Loja (obrigatório para validação GPS)</label>
            <select id="np-loja-id" onchange="onChangeLoja()" style="background:var(--surface2);color:var(--text);border:1px solid #1A56DB;border-radius:8px;padding:9px 12px;width:100%;font-family:Inter,sans-serif;font-size:14px">
              <option value="">Selecione a loja...</option>
              ${lojas.map(l=>`<option value="${l.id}" data-lat="${l.latitude||''}" data-lng="${l.longitude||''}">${l.nome}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="form-row">
          <div class="fi"><label>Nº Pedido</label><input id="np-numero" placeholder="0001"/></div>
          <div class="fi"><label>Cliente</label><input id="np-cliente" placeholder="Nome do cliente"/></div>
        </div>
        <div class="form-row full"><div class="fi"><label>Telefone</label><input id="np-telefone" placeholder="(16) 99999-9999"/></div></div>
        <div class="form-row full">
          <div class="fi"><label>Endereço de entrega</label><input id="np-endereco" placeholder="Rua, número, bairro" autocomplete="off" oninput="onChangeEnderecoDebounce()"/></div>
        </div>
        <div id="np-endereco-feedback" style="font-size:11px;margin:2px 0 6px;min-height:16px"></div>
        <div class="form-row">
          <div class="fi"><label>Valor do Pedido (R$)</label><input type="number" id="np-valor" placeholder="0.00" step="0.01"/></div>
          <div class="fi"><label>Distância</label><input id="np-km" placeholder="—" readonly style="background:var(--surface2);color:#60a5fa;font-weight:700;cursor:default"/></div>
        </div>
        <div class="form-row">
          <div class="fi"><label>Taxa de entrega (R$)</label><input type="number" id="np-taxa" placeholder="0.00" step="0.01"/></div>
          <div class="fi"><label>Gorjeta entregador (R$)</label><input type="number" id="np-gorjeta" placeholder="0.00" step="0.50" value="0" oninput="onChangeGorjeta()"/></div>
        </div>
        <div id="np-gorjeta-info" style="font-size:11px;color:#f59e0b;margin-bottom:4px;min-height:14px"></div>
        <div class="form-row full"><div class="fi"><label>⭐ Pontos</label><input type="number" id="np-pontos" value="4" min="1" max="20"/></div></div>
        <div class="form-row full"><div class="fi"><label>Observações</label><textarea id="np-descricao" placeholder="Itens do pedido..."></textarea></div></div>
        <div id="np-feedback" style="margin-top:4px"></div>`;
      iniciarAutocompleteEndereco('np-endereco','','','np-endereco-feedback');
    },80);
  }
}
function fecharModal(id){document.getElementById(id).classList.remove('open');}

// Funções para cálculo automático de taxa
let _taxaTimer=null;
function onChangeEnderecoDebounce(){clearTimeout(_taxaTimer);_taxaTimer=setTimeout(()=>calcularTaxaAuto(),800);}
function onChangeLoja(){calcularTaxaAuto();}
function onChangeGorjeta(){
  const g=parseFloat(document.getElementById('np-gorjeta')?.value)||0;
  const info=document.getElementById('np-gorjeta-info');
  if(info)info.textContent=g>0?`🎁 +R$ ${g.toFixed(2)} somado ao pagamento do motoboy`:'';
}

async function calcularTaxaAuto(){
  const lojaSelect=document.getElementById('np-loja-id');
  const endereco=document.getElementById('np-endereco')?.value?.trim();
  const fb=document.getElementById('np-endereco-feedback');
  if(!lojaSelect?.value||!endereco||endereco.length<6)return;
  const lojaOpt=lojaSelect.options[lojaSelect.selectedIndex];
  const lojaLat=parseFloat(lojaOpt.dataset.lat),lojaLng=parseFloat(lojaOpt.dataset.lng);
  if(!lojaLat||!lojaLng){if(fb)fb.innerHTML='<span style="color:#f59e0b">⚠️ Loja sem coordenadas GPS</span>';return;}
  if(fb)fb.innerHTML='<span style="color:var(--text2)">📍 Calculando distância...</span>';
  const geo=await geocodificarEndereco(endereco);
  if(!geo){if(fb)fb.innerHTML='<span style="color:var(--red)">❌ Endereço não encontrado</span>';document.getElementById('np-km').value='—';return;}
  const distKm=calcularDistancia(lojaLat,lojaLng,geo.lat,geo.lng);
  document.getElementById('np-km').value=distKm.toFixed(2)+' km';
  const tabelas=await db('tabelas_preco','GET',null,'?tipo=eq.cobranca&ativa=eq.true&limit=1');
  if(!tabelas.length){if(fb)fb.innerHTML=`<span style="color:#22c55e">✅ ${distKm.toFixed(2)} km</span>`;return;}
  const faixas=await db('tabelas_preco_faixas','GET',null,`?tabela_id=eq.${tabelas[0].id}&order=km_de.asc`);
  const faixa=faixas.find(f=>distKm>=parseFloat(f.km_de)&&distKm<=parseFloat(f.km_ate));
  if(faixa){
    document.getElementById('np-taxa').value=parseFloat(faixa.valor_sem_retorno).toFixed(2);
    if(fb)fb.innerHTML=`<span style="color:#22c55e">✅ ${distKm.toFixed(2)} km → Taxa: R$ ${parseFloat(faixa.valor_sem_retorno).toFixed(2)}</span>`;
  }else{if(fb)fb.innerHTML=`<span style="color:#f59e0b">⚠️ ${distKm.toFixed(2)} km — fora das faixas, informe a taxa</span>`;}
}

const TODOS_STATUS=[
  {key:'recebido',label:'Recebido',cor:'#ef4444'},{key:'pronto',label:'Pronto',cor:'#ec4899'},
  {key:'aceito',label:'Aceito',cor:'#8b5cf6'},{key:'chegou_local',label:'No local',cor:'#60a5fa'},
  {key:'em_rota',label:'Em rota',cor:'#1A56DB'},{key:'retornando',label:'Retornando',cor:'#f59e0b'},
  {key:'finalizado',label:'Finalizado',cor:'#22c55e'},{key:'cancelado',label:'Cancelado',cor:'#ef4444'},
];
let _dropdownAberto=null;
function abrirDropdownStatus(event,pedidoId){
  event.stopPropagation();fecharDropdownStatus();
  const wrapper=document.getElementById(`badge-wrapper-${pedidoId}`);if(!wrapper)return;
  const dropdown=document.createElement('div');dropdown.className='status-dropdown';dropdown.id='status-dropdown-atual';
  dropdown.innerHTML=TODOS_STATUS.map(s=>`<button class="status-dropdown-item" onclick="event.stopPropagation();alterarStatusPedido('${pedidoId}','${s.key}')"><span class="status-dot" style="background:${s.cor}"></span><span style="color:${s.cor}">${s.label}</span></button>`).join('');
  wrapper.appendChild(dropdown);_dropdownAberto=pedidoId;
  setTimeout(()=>document.addEventListener('click',fecharDropdownStatus,{once:true}),10);
}
function fecharDropdownStatus(){const el=document.getElementById('status-dropdown-atual');if(el)el.remove();_dropdownAberto=null;}
async function alterarStatusPedido(pedidoId,novoStatus){
  fecharDropdownStatus();
  const agora=new Date().toISOString();
  const update={status:novoStatus,status_detalhado:novoStatus,updated_at:agora};
  if(novoStatus==='pronto')update.pronto_em=agora;if(novoStatus==='aceito')update.aceito_em=agora;
  if(novoStatus==='em_rota')update.em_rota_em=agora;if(novoStatus==='retornando')update.retornando_em=agora;
  if(novoStatus==='finalizado')update.finalizado_em=agora;if(novoStatus==='recebido')update.recebido_em=agora;
  if(novoStatus==='pronto'){idsProntoNotificados.delete(pedidoId);tocarSomPronto();showNotif('🔔 Pedido Pronto!','Motoboys serão notificados','var(--pink)');}
  if(novoStatus==='cancelado')showNotif('❌ Pedido cancelado','','var(--red)');
  await db('pedidos','PATCH',update,`?id=eq.${pedidoId}`);
  await logAcao('alterar_status_manual',{pedido_id:pedidoId,novo_status:novoStatus});
  await atualizarTudo();
}

async function _carregarSaldoTopbar(){
  try{
    const pedidos=await db('pedidos','GET',null,'?status=eq.finalizado');
    const total=pedidos.reduce((s,p)=>s+(parseFloat(p.valor)||0),0);
    const el=document.getElementById('topbar-saldo'),val=document.getElementById('saldo-valor');
    if(el&&val){val.textContent=total.toLocaleString('pt-BR',{minimumFractionDigits:2});el.style.display='flex';}
  }catch(_){}
}

async function confirmarPagamento(pedidoId){
  await db('pedidos','PATCH',{pagamento_confirmado:true,pagamento_confirmado_em:new Date().toISOString(),status:'finalizado',status_detalhado:'finalizado',finalizado_em:new Date().toISOString(),updated_at:new Date().toISOString()},`?id=eq.${pedidoId}`);
  await logAcao('pagamento_confirmado',{pedido_id:pedidoId});
  showNotif('✅ Pagamento confirmado!','Entrega finalizada para o motoboy');await atualizarTudo();
}
async function alterarPontos(pedidoId,delta){
  const p=allPedidos.find(x=>x.id===pedidoId);if(!p)return;
  const novosPontos=Math.max(0,Math.min(20,(p.pontos||4)+delta));
  const el=document.getElementById(`pontos-${pedidoId}`);if(el)el.textContent=novosPontos;
  await db('pedidos','PATCH',{pontos:novosPontos,updated_at:new Date().toISOString()},`?id=eq.${pedidoId}`);
  await logAcao('alterar_pontos',{pedido_id:pedidoId,pontos:novosPontos});p.pontos=novosPontos;
}

const STATUS_LABEL={recebido:'Recebido',pronto:'Pronto',aceito:'Aceito',chegou_local:'No local',em_rota:'Em rota',retornando:'Retornando',finalizado:'Finalizado',disponivel:'Disponível',aguardando:'Aguardando',entregue:'Entregue',fila:'Na fila'};
const STATUS_CORES={recebido:'#ef4444',pronto:'#ec4899',aceito:'#8b5cf6',chegou_local:'#60a5fa',em_rota:'#1A56DB',retornando:'#f59e0b',finalizado:'#22c55e',disponivel:'#1A56DB',aguardando:'#eab308',entregue:'#475569',fila:'#475569'};
function getStatusKey(p){return p.status_detalhado||p.status||'disponivel';}
function getStatusLabel(p){const k=getStatusKey(p);return STATUS_LABEL[k]||k;}
function getStatusCor(p){return STATUS_CORES[getStatusKey(p)]||'#1A56DB';}

const NAV_ITEMS_ADM=[{id:'mapa',icon:'🗺️',label:'Mapa ao Vivo'},{id:'pedidos',icon:'📦',label:'Pedidos'},{id:'cadastros',icon:'🗂️',label:'Cadastros'},{id:'relatorios',icon:'📈',label:'Relatórios'},{id:'logs',icon:'📋',label:'Logs'},{id:'financeiro',icon:'💵',label:'Financeiro'},{id:'configuracao',icon:'⚙️',label:'Configuração'}];
const NAV_ITEMS_LOJA=[{id:'novo-pedido',icon:'➕',label:'Novo Pedido'},{id:'loja-pedidos',icon:'📦',label:'Meus Pedidos'},{id:'loja-mapa',icon:'🗺️',label:'Rastrear'},{id:'loja-relatorio',icon:'📈',label:'Relatório'}];
const NAV_ITEMS_SUPORTE=[{id:'mapa',icon:'🗺️',label:'Mapa ao Vivo'},{id:'pedidos',icon:'📦',label:'Pedidos'},{id:'motoboys',icon:'🛵',label:'Motoboys'}];
let _navAtivo='';
function renderNavSidebar(activeId){
  _navAtivo=activeId||_navAtivo;
  const items=currentPerfil==='adm'?NAV_ITEMS_ADM:currentPerfil==='loja'?NAV_ITEMS_LOJA:NAV_ITEMS_SUPORTE;
  const body=document.getElementById('nav-sidebar-body');if(!body)return;
  body.innerHTML=items.map(item=>`<button class="nav-item${_navAtivo===item.id?' active':''}" onclick="navGoTab('${item.id}')"><span class="nav-item-icon">${item.icon}</span><span>${item.label}</span></button>`).join('')+`<div style="border-top:1px solid var(--border);padding-top:8px;margin-top:16px"><button class="nav-item" onclick="logout()" style="color:var(--red)"><span class="nav-item-icon">🚪</span><span>Sair</span></button></div>`;
}
function abrirNavSidebar(){renderNavSidebar(_navAtivo);document.getElementById('nav-sidebar').classList.add('open');document.getElementById('nav-overlay').classList.add('open');}
function fecharNavSidebar(){document.getElementById('nav-sidebar').classList.remove('open');document.getElementById('nav-overlay').classList.remove('open');}
function navGoTab(id){fecharNavSidebar();setTimeout(()=>goTab(id),50);}

async function fazerLogin(){
  const email=document.getElementById('login-email').value.trim(),senha=document.getElementById('login-senha').value,perfil=document.getElementById('login-perfil').value;
  const errEl=document.getElementById('login-error'),btn=document.getElementById('login-btn');
  errEl.style.display='none';
  if(!email||!senha){errEl.textContent='Preencha e-mail e senha.';errEl.style.display='block';return;}
  btn.disabled=true;btn.textContent='Verificando...';
  const usuarios=await db('usuarios_painel','GET',null,`?email=eq.${encodeURIComponent(email)}&senha=eq.${encodeURIComponent(senha)}&perfil=eq.${perfil}&ativo=eq.true`);
  btn.disabled=false;btn.textContent='Entrar →';
  if(!usuarios||usuarios.length===0){errEl.textContent='E-mail, senha ou perfil incorretos.';errEl.style.display='block';return;}
  currentUser=usuarios[0];currentPerfil=currentUser.perfil;
  sessionStorage.setItem('lg_user',JSON.stringify(currentUser));
  await logAcao('login',{email,perfil});
  document.getElementById('login-screen').style.display='none';
  const appEl=document.getElementById('app');appEl.style.display='flex';appEl.getBoundingClientRect();
  document.getElementById('user-nome').textContent=currentUser.nome;
  const badgeMap={adm:'badge-adm',loja:'badge-loja',suporte:'badge-suporte'},labelMap={adm:'ADM',loja:'LOJA',suporte:'SUPORTE'};
  const badge=document.getElementById('user-perfil-badge');badge.className='user-perfil-badge '+badgeMap[currentPerfil];badge.textContent=labelMap[currentPerfil];
  renderTabs();setTimeout(()=>goTab(currentPerfil==='adm'?'mapa':currentPerfil==='suporte'?'mapa':'novo-pedido'),100);
  const btnNovo=document.getElementById('btn-novo-pedido');if(btnNovo)btnNovo.style.display=currentPerfil!=='suporte'?'flex':'none';
  _carregarSaldoTopbar();
}
function logout(){
  clearInterval(realtimeInterval);sessionStorage.removeItem('lg_user');
  if(map){map.remove();map=null;}
  currentUser=null;currentPerfil=null;idsProntoNotificados=new Set();
  document.getElementById('login-screen').style.display='flex';document.getElementById('app').style.display='none';
  document.getElementById('login-email').value='';document.getElementById('login-senha').value='';
}

const tabsAdm=[{id:'mapa',icon:'🗺️',label:'Mapa ao Vivo'},{id:'pedidos',icon:'📦',label:'Pedidos'},{id:'cadastros',icon:'🗂️',label:'Cadastros'},{id:'relatorios',icon:'📈',label:'Relatórios'},{id:'logs',icon:'📋',label:'Logs'}];
const tabsLoja=[{id:'novo-pedido',icon:'➕',label:'Novo Pedido'},{id:'loja-pedidos',icon:'📦',label:'Meus Pedidos'},{id:'loja-mapa',icon:'🗺️',label:'Rastrear'},{id:'loja-relatorio',icon:'📈',label:'Relatório'}];
const tabsSuporte=[{id:'mapa',icon:'🗺️',label:'Mapa ao Vivo'},{id:'pedidos',icon:'📦',label:'Pedidos'},{id:'motoboys',icon:'🛵',label:'Motoboys'}];
function renderTabs(){
  const tabs=currentPerfil==='adm'?tabsAdm:currentPerfil==='loja'?tabsLoja:tabsSuporte;
  document.getElementById('tab-buttons').innerHTML=tabs.map(t=>`<button class="tab-btn" id="tab-${t.id}" onclick="goTab('${t.id}')"><span>${t.icon}</span>${t.label}</button>`).join('');
  const tabBar=document.getElementById('tab-buttons');
  if(tabBar)tabBar.style.display='none';
}
function goTab(id){
  _navAtivo=id;renderNavSidebar(id);clearInterval(realtimeInterval);
  document.querySelectorAll('.tab-btn').forEach(el=>el.classList.remove('active'));
  const tb=document.getElementById('tab-'+id);if(tb)tb.classList.add('active');
  const pages={'mapa':renderMapaPage,'pedidos':renderPedidosPage,'cadastros':renderCadastrosPage,'relatorios':renderRelatoriosPage,'logs':renderLogsPage,'financeiro':renderFinanceiroPage,'configuracao':renderConfiguracaoPage,'novo-pedido':renderNovoPedidoPage,'loja-pedidos':renderLojaPedidosPage,'loja-mapa':renderLojaMapaPage,'loja-relatorio':renderLojaRelatorioPage};
  if(pages[id])pages[id]();
}

function renderMapaPage(){
  document.getElementById('app-body').innerHTML=`
    <div class="sidebar-pedidos">
      <div class="sidebar-header">
        <div class="sidebar-header-top"><span class="sidebar-title">Pedidos</span><span class="sidebar-count" id="sb-count">0</span></div>
        <div class="filter-tabs">
          <button class="filter-tab active" onclick="setFilter('todos',this)">Todos</button>
          <button class="filter-tab" onclick="setFilter('recebido',this)">Recebidos</button>
          <button class="filter-tab" onclick="setFilter('pronto',this)">Prontos</button>
          <button class="filter-tab" onclick="setFilter('em_rota',this)">Em rota</button>
          <button class="filter-tab" onclick="setFilter('cancelado',this)">Cancelados</button>
        </div>
      </div>
      <div class="pedidos-lista" id="pedidos-lista"><div class="empty-lista"><div class="ei">📦</div><p>Carregando...</p></div></div>
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
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',{attribution:'© OSM © CartoDB',maxZoom:19}).addTo(map);
    atualizarTudo();realtimeInterval=setInterval(atualizarTudo,10000);
  },100);
}
function setFilter(status,el){filterStatus=status;document.querySelectorAll('.filter-tab').forEach(e=>e.classList.remove('active'));el.classList.add('active');renderPedidosLista();}

async function atualizarTudo(){
  allPedidos=await db('pedidos','GET',null,'?order=created_at.desc&limit=200&status=neq.cancelado&status_detalhado=neq.cancelado');
  allMotoboys=await db('entregadores','GET',null,'');
  allLojas=await db('lojas','GET',null,'?ativo=eq.true');
  await processarAutoPronto();
  allPedidos=await db('pedidos','GET',null,'?order=created_at.desc&limit=200&status=neq.cancelado&status_detalhado=neq.cancelado');
  verificarNovosProtos(allPedidos);
  const online=allMotoboys.filter(e=>e.disponivel||e.status==='ocupado').length,emRota=allPedidos.filter(p=>p.status==='em_rota').length;
  const ms1=document.getElementById('ms-online'),ms2=document.getElementById('ms-pedidos'),ms3=document.getElementById('ms-rota');
  if(ms1)ms1.textContent=online;if(ms2)ms2.textContent=allPedidos.length;if(ms3)ms3.textContent=emRota;
  renderPedidosLista();if(map)atualizarMarcadores();
}

function renderPedidosLista(){
  const lista=document.getElementById('pedidos-lista'),count=document.getElementById('sb-count');if(!lista)return;
  let filtered=filterStatus==='todos'?allPedidos:allPedidos.filter(p=>(p.status_detalhado===filterStatus)||(p.status===filterStatus));
  if(count)count.textContent=filtered.length;
  if(filtered.length===0){lista.innerHTML='<div class="empty-lista"><div class="ei">📦</div><p>Nenhum pedido</p></div>';return;}
  lista.innerHTML=filtered.map(p=>{
    const hora=p.created_at?new Date(p.created_at).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}):'—';
    const sk=getStatusKey(p),isSelected=selectedPedidoId===p.id,prontoStyle=sk==='pronto'?'class="pronto-pulse"':'';
    const detalhes=isSelected?`
      <div style="border-top:1px solid var(--border);margin-top:10px;padding-top:10px">
        ${p.codigo_confirmacao?`<div style="background:#ec489910;border:1px solid #ec489930;border-radius:8px;padding:10px;text-align:center;margin-bottom:10px"><div style="font-size:10px;color:var(--pink);margin-bottom:4px;font-weight:700">CÓDIGO DE CONFIRMAÇÃO</div><div style="font-size:24px;font-weight:800;letter-spacing:8px;color:#fff">${p.codigo_confirmacao}</div></div>`:''}
        ${sk==='retornando'?`<div style="background:#f59e0b10;border:1px solid #f59e0b40;border-radius:8px;padding:10px;margin-bottom:8px;text-align:center"><div style="font-size:11px;color:#f59e0b;font-weight:700;margin-bottom:4px">⚠️ MOTOBOY RETORNANDO</div></div><button class="btn-pagamento" onclick="event.stopPropagation();confirmarPagamento('${p.id}')">💰 Pagamento Entregue</button>`:''}
        ${p.gorjeta>0?`<div style="background:#f59e0b10;border:1px solid #f59e0b40;border-radius:6px;padding:6px 10px;font-size:11px;color:#f59e0b;margin-bottom:6px">🎁 Gorjeta: R$ ${parseFloat(p.gorjeta).toFixed(2)}</div>`:''}
        ${p.distancia_km?`<div style="font-size:11px;color:var(--text3);margin-bottom:4px">📏 ${p.distancia_km} km</div>`:''}
        ${p.descricao?`<div style="background:var(--bg);border-radius:6px;padding:7px;font-size:11px;color:var(--text2);margin-bottom:8px">📋 ${p.descricao}</div>`:''}
        <div style="font-size:11px;color:var(--text3);margin-bottom:8px">Criado: ${p.created_at?new Date(p.created_at).toLocaleString('pt-BR'):'—'}</div>
        <button onclick="event.stopPropagation();fecharDetalhe()" style="width:100%;background:none;color:var(--text3);border:1px solid var(--border);border-radius:8px;padding:7px;font-family:Inter,sans-serif;font-size:11px;cursor:pointer">Fechar</button>
        <div style="margin-top:8px;background:#f59e0b10;border:1px solid #f59e0b40;border-radius:8px;padding:10px">
          <div style="font-size:10px;color:#f59e0b;font-weight:700;margin-bottom:8px">⭐ PONTOS DA CORRIDA</div>
          <div style="display:flex;align-items:center;gap:8px">
            <button onclick="event.stopPropagation();alterarPontos('${p.id}',-1)" style="background:#f59e0b20;border:1px solid #f59e0b;color:#f59e0b;width:30px;height:30px;border-radius:8px;cursor:pointer;font-size:16px;font-weight:700">−</button>
            <span id="pontos-${p.id}" style="color:#fff;font-weight:800;font-size:18px;min-width:30px;text-align:center">${p.pontos||4}</span>
            <button onclick="event.stopPropagation();alterarPontos('${p.id}',1)" style="background:#f59e0b20;border:1px solid #f59e0b;color:#f59e0b;width:30px;height:30px;border-radius:8px;cursor:pointer;font-size:16px;font-weight:700">+</button>
            <span style="font-size:11px;color:#888">pontos</span>
          </div>
        </div>
      </div>`:'';
    return `<div class="pedido-item${isSelected?' selected':''}" onclick="selecionarPedido('${p.id}')">
      <div class="pedido-item-top">
        <span class="pedido-num">#${p.numero||p.id?.substring(0,6)}</span>
        <div style="display:flex;align-items:center;gap:5px">
          <button onclick="event.stopPropagation();abrirEditarPedido('${p.id}')" style="background:none;border:1px solid var(--border);border-radius:6px;width:24px;height:24px;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:12px;padding:0;">✏️</button>
          <button onclick="event.stopPropagation();abrirAlocarMotoboy('${p.id}')" style="background:none;border:1px solid var(--border);border-radius:6px;width:24px;height:24px;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:12px;padding:0;">🛵</button>
          <span class="badge-wrapper" id="badge-wrapper-${p.id}">
            <span ${prontoStyle} class="p-badge b-${sk}" onclick="event.stopPropagation();abrirDropdownStatus(event,'${p.id}')" style="cursor:pointer;user-select:none">${getStatusLabel(p)} ▾</span>
          </span>
        </div>
      </div>
      <div class="pedido-end">📍 ${p.endereco||'—'}</div>
      ${p.distancia_km?`<div style="font-size:11px;color:var(--text3)">📏 ${p.distancia_km} km</div>`:''}
      <div class="pedido-footer"><span class="pedido-val">R$ ${(p.valor||0).toFixed(2)}</span><span class="pedido-hora">${hora}</span></div>
      ${detalhes}
    </div>`;
  }).join('');
}

function atualizarMarcadores(){
  Object.values(motoboyMarkers).forEach(m=>map.removeLayer(m));Object.values(pedidoMarkers).forEach(m=>map.removeLayer(m));Object.values(lojaMarkers).forEach(m=>map.removeLayer(m));
  motoboyMarkers={};pedidoMarkers={};lojaMarkers={};
  allLojas.forEach(l=>{const lat=l.latitude,lng=l.longitude;if(!lat||!lng)return;const nome=(l.nome||'Loja').substring(0,12);const icon=L.divIcon({html:`<div style="display:flex;flex-direction:column;align-items:center"><div style="background:#f97316;width:36px;height:36px;border-radius:8px;border:3px solid white;display:flex;align-items:center;justify-content:center;font-size:16px;box-shadow:0 2px 10px rgba(0,0,0,.5)">🏪</div><div style="background:#f97316;color:white;font-size:10px;font-weight:700;padding:2px 5px;border-radius:4px;margin-top:2px;white-space:nowrap">${nome}</div></div>`,iconSize:[60,52],iconAnchor:[30,52],className:''});lojaMarkers[l.id]=L.marker([lat,lng],{icon}).addTo(map).bindPopup(`<b>🏪 ${l.nome}</b><br>${l.endereco||'—'}`);});
  allMotoboys.forEach(e=>{const lat=e.lat||e.latitude,lng=e.lng||e.longitude;if(!lat||!lng)return;const cor=e.status==='ocupado'?'#f97316':e.disponivel?'#22c55e':'#475569';const nome=(e.nome||'').split(' ')[0]||'Moto';const icon=L.divIcon({html:`<div style="display:flex;flex-direction:column;align-items:center"><div style="background:${cor};width:36px;height:36px;border-radius:50%;border:3px solid white;display:flex;align-items:center;justify-content:center;font-size:16px;box-shadow:0 2px 10px rgba(0,0,0,.5)">🛵</div><div style="background:${cor};color:white;font-size:10px;font-weight:700;padding:2px 5px;border-radius:4px;margin-top:2px;white-space:nowrap">${nome}</div></div>`,iconSize:[60,52],iconAnchor:[30,52],className:''});motoboyMarkers[e.id]=L.marker([lat,lng],{icon}).addTo(map).bindPopup(`<b>${e.nome||'Motoboy'}</b><br>Status: ${e.status||'—'}`);});
  allPedidos.forEach(p=>{if(!p.latitude||!p.longitude)return;const cor=getStatusCor(p),num=p.numero_loja||p.numero||p.id?.substring(0,4);const icon=L.divIcon({html:`<div style="display:flex;flex-direction:column;align-items:center"><div style="background:${cor};color:white;font-size:11px;font-weight:800;padding:4px 7px;border-radius:6px;box-shadow:0 2px 8px rgba(0,0,0,.5);white-space:nowrap;border:2px solid white">#${num}</div><div style="width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:6px solid ${cor}"></div></div>`,iconSize:[50,30],iconAnchor:[25,30],className:''});pedidoMarkers[p.id]=L.marker([p.latitude,p.longitude],{icon}).addTo(map).bindPopup(`<b>#${num}</b><br>${p.endereco||'—'}<br>R$ ${(p.valor||0).toFixed(2)}`);});
}

function selecionarPedido(id){selectedPedidoId=selectedPedidoId===id?null:id;renderPedidosLista();if(selectedPedidoId){const p=allPedidos.find(x=>x.id===selectedPedidoId);if(map&&p&&p.latitude&&p.longitude)map.setView([p.latitude,p.longitude],15,{animate:true});}}
function fecharDetalhe(){selectedPedidoId=null;renderPedidosLista();}

function abrirEditarPedido(pedidoId){
  const p=allPedidos.find(x=>x.id===pedidoId);if(!p)return;
  let modal=document.getElementById('modal-editar-pedido');
  if(!modal){modal=document.createElement('div');modal.id='modal-editar-pedido';modal.className='modal-overlay';document.body.appendChild(modal);}
  modal.innerHTML=`<div class="modal"><div class="modal-header"><span class="modal-title">✏️ Editar Pedido #${p.numero||pedidoId.substring(0,6)}</span><button class="modal-close" onclick="document.getElementById('modal-editar-pedido').classList.remove('open')">✕</button></div><div class="modal-body"><div class="form-row"><div class="fi"><label>Cliente</label><input id="ep-cliente" value="${p.cliente||''}"/></div><div class="fi"><label>Telefone</label><input id="ep-telefone" value="${p.telefone||''}"/></div></div><div class="form-row full"><div class="fi"><label>Endereço</label><input id="ep-endereco" value="${p.endereco||''}"/></div></div><div class="form-row"><div class="fi"><label>Valor do Pedido (R$)</label><input type="number" id="ep-valor" value="${p.valor||0}" step="0.01"/></div><div class="fi"><label>Taxa entrega (R$)</label><input type="number" id="ep-taxa" value="${p.taxa_entrega||0}" step="0.01"/></div></div><div class="form-row"><div class="fi"><label>Gorjeta (R$)</label><input type="number" id="ep-gorjeta" value="${p.gorjeta||0}" step="0.50"/></div><div class="fi"><label>Nº Pedido</label><input id="ep-numero" value="${p.numero||''}"/></div></div><div class="form-row full"><div class="fi"><label>Observações</label><textarea id="ep-descricao">${p.descricao||''}</textarea></div></div><div id="ep-feedback" style="margin-top:4px"></div></div><div class="modal-footer"><button class="btn-modal-cancel" onclick="document.getElementById('modal-editar-pedido').classList.remove('open')">Cancelar</button><button class="btn-modal-primary" onclick="salvarEdicaoPedido('${pedidoId}')">💾 Salvar</button></div></div>`;
  modal.classList.add('open');
}
async function salvarEdicaoPedido(pedidoId){
  const fb=document.getElementById('ep-feedback');if(fb)fb.innerHTML='<div style="color:var(--text2);font-size:13px">⏳ Salvando...</div>';
  const update={cliente:document.getElementById('ep-cliente')?.value||'',telefone:document.getElementById('ep-telefone')?.value||'',endereco:document.getElementById('ep-endereco')?.value||'',valor:parseFloat(document.getElementById('ep-valor')?.value)||0,taxa_entrega:parseFloat(document.getElementById('ep-taxa')?.value)||0,gorjeta:parseFloat(document.getElementById('ep-gorjeta')?.value)||0,numero:document.getElementById('ep-numero')?.value||'',descricao:document.getElementById('ep-descricao')?.value||'',updated_at:new Date().toISOString()};
  await db('pedidos','PATCH',update,`?id=eq.${pedidoId}`);await logAcao('editar_pedido',{pedido_id:pedidoId});
  if(fb)fb.innerHTML='<div style="color:var(--green);font-size:13px">✅ Salvo!</div>';showNotif('✅ Pedido atualizado!','');
  setTimeout(()=>{document.getElementById('modal-editar-pedido')?.classList.remove('open');atualizarTudo();},1200);
}

async function abrirAlocarMotoboy(pedidoId){
  const p=allPedidos.find(x=>x.id===pedidoId);if(!p)return;
  const motoboys=await db('entregadores','GET',null,'?disponivel=eq.true&order=nome.asc');
  let modal=document.getElementById('modal-alocar-motoboy');
  if(!modal){modal=document.createElement('div');modal.id='modal-alocar-motoboy';modal.className='modal-overlay';document.body.appendChild(modal);}
  const listaMotoboys=motoboys.length===0?`<div style="text-align:center;padding:24px;color:var(--text3)"><div style="font-size:32px;margin-bottom:8px">🛵</div>Nenhum motoboy online</div>`:motoboys.map(m=>`<div onclick="alocarMotoboy('${pedidoId}','${m.id}','${(m.nome||'').replace(/'/g,"\\'")}',this)" style="display:flex;align-items:center;gap:12px;padding:12px 16px;border-radius:10px;cursor:pointer;border:1px solid var(--border);margin-bottom:8px;background:var(--surface2);" onmouseover="this.style.borderColor='var(--accent)'" onmouseout="this.style.borderColor='var(--border)'"><div style="width:36px;height:36px;background:#22c55e;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:18px">🛵</div><div style="flex:1"><div style="font-weight:700;color:var(--text);font-size:14px">${m.nome||'—'}</div><div style="font-size:11px;color:var(--text2)">${m.telefone||'Online'}</div></div><div style="background:#22c55e20;color:#22c55e;font-size:10px;font-weight:700;padding:3px 8px;border-radius:20px">Online</div></div>`).join('');
  modal.innerHTML=`<div class="modal"><div class="modal-header"><span class="modal-title">🛵 Alocar Motoboy — #${p.numero||pedidoId.substring(0,6)}</span><button class="modal-close" onclick="document.getElementById('modal-alocar-motoboy').classList.remove('open')">✕</button></div><div class="modal-body"><div style="background:var(--surface2);border-radius:8px;padding:10px 14px;margin-bottom:16px;font-size:13px">📍 ${p.endereco||'—'} · <span style="color:var(--green);font-weight:700">R$ ${(p.valor||0).toFixed(2)}</span></div><div style="font-size:11px;color:var(--text2);text-transform:uppercase;letter-spacing:1px;font-weight:600;margin-bottom:10px">Motoboys disponíveis (${motoboys.length})</div>${listaMotoboys}</div></div>`;
  modal.classList.add('open');
}
async function alocarMotoboy(pedidoId,motoboyId,motoboyNome,el){
  el.style.background='#1A56DB20';el.style.borderColor='var(--accent)';
  await db('pedidos','PATCH',{motoboy_id:motoboyId,status:'aceito',status_detalhado:'aceito',aceito_em:new Date().toISOString(),updated_at:new Date().toISOString()},`?id=eq.${pedidoId}`);
  await logAcao('alocar_motoboy',{pedido_id:pedidoId,motoboy_id:motoboyId,motoboy_nome:motoboyNome});
  showNotif('✅ Motoboy alocado!',`${motoboyNome} foi designado`);
  document.getElementById('modal-alocar-motoboy')?.classList.remove('open');await atualizarTudo();
}

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

async function criarPedido(){
  const endereco=(document.getElementById('np-endereco')||{}).value||'';
  const valor=parseFloat((document.getElementById('np-valor')||{}).value)||0;
  const numero=(document.getElementById('np-numero')||{}).value||String(Math.floor(Math.random()*9000+1000)).padStart(4,'0');
  const descricao=(document.getElementById('np-descricao')||{}).value||'';
  const cliente=(document.getElementById('np-cliente')||{}).value||'';
  const taxa=parseFloat((document.getElementById('np-taxa')||{}).value)||0;
  const gorjeta=parseFloat((document.getElementById('np-gorjeta')||{}).value)||0;
  const pontos=parseInt((document.getElementById('np-pontos')||{}).value)||4;
  const lojaIdSel=document.getElementById('np-loja-id')?.value||null;
  if(!endereco){showNotif('Erro','Endereço obrigatório','var(--red)');return;}
  if(currentPerfil==='adm'&&!lojaIdSel){showNotif('Erro','Selecione a loja','var(--red)');return;}
  const fb=document.getElementById('np-feedback');
  if(fb)fb.innerHTML='<div style="color:var(--text2);font-size:13px">📍 Localizando endereço...</div>';
  const geo=await geocodificarEndereco(endereco);
  if(!geo){if(fb)fb.innerHTML='<div style="color:var(--red);font-size:13px">❌ Endereço não encontrado. Verifique e tente novamente.</div>';return;}
  const agora=new Date().toISOString();
  const finalLojaId=currentPerfil==='loja'?currentUser.loja_id:lojaIdSel;
  let latLoja=-21.1775,lngLoja=-47.8103;
  if(finalLojaId){const lojaData=await db('lojas','GET',null,`?id=eq.${finalLojaId}`);if(lojaData&&lojaData[0]?.latitude){latLoja=lojaData[0].latitude;lngLoja=lojaData[0].longitude;}}
  const distKm=parseFloat(calcularDistancia(latLoja,lngLoja,geo.lat,geo.lng).toFixed(2));
  if(fb)fb.innerHTML='<div style="color:var(--text2);font-size:13px">⏳ Criando pedido...</div>';
  const pedido={numero:String(numero),numero_loja:String(numero),endereco,valor,descricao,cliente,status:'recebido',status_detalhado:'recebido',origem:currentPerfil==='loja'?'loja':'backend',loja_id:finalLojaId,latitude:geo.lat,longitude:geo.lng,taxa_entrega:taxa,gorjeta,pontos,distancia_km:distKm,recebido_em:agora,codigo_confirmacao:null,created_at:agora,updated_at:agora};
  const result=await db('pedidos','POST',pedido);
  await logAcao('criar_pedido',{numero,endereco,valor,origem:currentPerfil,loja_id:finalLojaId});
  if(result&&result.length>0){
    if(fb)fb.innerHTML=`<div style="background:#22c55e18;border:1px solid #22c55e30;border-radius:9px;padding:12px;font-size:13px">✅ <b>Pedido #${numero} criado!</b><br><span style="color:var(--text2)">📍 ${distKm} km • ⏱ Pronto em 60s${gorjeta>0?' • 🎁 Gorjeta: R$ '+gorjeta.toFixed(2):''}</span></div>`;
    showNotif('Pedido criado!','Ficará pronto em 60s');setTimeout(()=>fecharModal('modal-pedido'),2500);
  }else{if(fb)fb.innerHTML='<div style="color:var(--red);font-size:13px">❌ Erro ao criar pedido.</div>';}
}


// ═══════════════════════════════════════════════
// CADASTROS — página com sub-abas
// ═══════════════════════════════════════════════
let _cadastrosAba='clientes';

function renderCadastrosPage(aba){
  _cadastrosAba=aba||_cadastrosAba||'clientes';
  const abas=[
    {id:'clientes',    icon:'🏪', label:'Clientes'},
    {id:'entregadores',icon:'🛵', label:'Entregadores'},
    {id:'usuarios',    icon:'👥', label:'Usuários'},
    {id:'precificacao',icon:'💰', label:'Precificação Padrão'},
    {id:'preco-din',   icon:'📈', label:'Preço Dinâmico'},
    {id:'preco-din-ent',icon:'📈',label:'Preço Din. Entregador'},
  ];
  document.getElementById('app-body').innerHTML=`
    <div class="alt-page">
      <div class="page-header"><div class="page-title">🗂️ Cadastros</div></div>
      <div style="display:flex;gap:0;margin-bottom:20px;border-bottom:1px solid var(--border);overflow-x:auto;flex-wrap:nowrap">
        ${abas.map(a=>`<button id="cad-aba-${a.id}" onclick="renderCadastrosPage('${a.id}')"
          style="padding:10px 18px;border:none;background:none;font-family:Inter,sans-serif;font-size:13px;font-weight:600;cursor:pointer;white-space:nowrap;border-bottom:2px solid ${_cadastrosAba===a.id?'var(--accent)':'transparent'};color:${_cadastrosAba===a.id?'var(--accent)':'var(--text3)'}">${a.icon} ${a.label}</button>`).join('')}
      </div>
      <div id="cad-content"></div>
    </div>`;
  _renderCadastrosConteudo(_cadastrosAba);
}

async function _renderCadastrosConteudo(aba){
  _cadastrosAba=aba;
  // Atualiza estilo das abas
  ['clientes','entregadores','usuarios','precificacao','preco-din','preco-din-ent'].forEach(id=>{
    const el=document.getElementById('cad-aba-'+id);
    if(!el)return;
    el.style.borderBottom=id===aba?'2px solid var(--accent)':'2px solid transparent';
    el.style.color=id===aba?'var(--accent)':'var(--text3)';
  });
  const el=document.getElementById('cad-content');
  if(!el)return;

  if(aba==='clientes'){
    await _renderClientesTab(el);
  } else if(aba==='entregadores'){
    await _renderEntregadoresTab(el);
  } else if(aba==='usuarios'){
    await _renderUsuariosTab(el);
  } else if(aba==='precificacao'){
    await _renderPrecificacaoTab(el);
  } else if(aba==='preco-din'){
    _renderPrecoDinamicoTab(el,'cliente');
  } else if(aba==='preco-din-ent'){
    _renderPrecoDinamicoTab(el,'entregador');
  }
}

async function _renderClientesTab(el){
  el.innerHTML=`<div style="display:flex;justify-content:flex-end;margin-bottom:12px"><button class="btn-sm btn-primary-sm" onclick="abrirModal('modal-loja')">➕ Nova Loja</button></div><div class="card"><div style="overflow-x:auto"><table><thead><tr><th>Nome</th><th>Telefone</th><th>Endereço</th><th>E-mail acesso</th><th>Status</th><th>Ações</th></tr></thead><tbody id="tbody-clientes"></tbody></table></div></div>`;
  const data=await db('lojas','GET',null,'?order=created_at.desc');
  const tbody=document.getElementById('tbody-clientes');if(!tbody)return;
  tbody.innerHTML=data.length===0?'<tr><td colspan="6" style="text-align:center;padding:32px;color:var(--text3)">Nenhuma loja</td></tr>':data.map(l=>`<tr><td style="font-weight:600;color:var(--text)">🏪 ${l.nome}</td><td>${l.telefone||'—'}</td><td>${l.endereco||'—'}</td><td style="font-size:12px;color:var(--text3)">${l.email||'—'}</td><td><span class="p-badge b-${l.ativo?'em_rota':'fila'}">${l.ativo?'Ativa':'Inativa'}</span></td><td><button onclick="abrirEditarLoja('${l.id}')" style="background:none;border:1px solid var(--border);border-radius:6px;width:30px;height:30px;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;font-size:14px;">✏️</button></td></tr>`).join('');
}

async function _renderEntregadoresTab(el){
  el.innerHTML=`<div style="display:flex;justify-content:flex-end;margin-bottom:12px"><button class="btn-sm btn-primary-sm" onclick="renderCadastrosPage('entregadores')">↻ Atualizar</button></div><div class="card"><div style="overflow-x:auto"><table><thead><tr><th>Nome</th><th>Status</th><th>Disponível</th><th>Localização</th><th>Atualizado</th></tr></thead><tbody id="tbody-entregadores"></tbody></table></div></div>`;
  const data=await db('entregadores','GET',null,'?order=updated_at.desc');
  const tbody=document.getElementById('tbody-entregadores');if(!tbody)return;
  tbody.innerHTML=data.length===0?'<tr><td colspan="5" style="text-align:center;padding:32px;color:var(--text3)">Nenhum entregador</td></tr>':data.map(e=>`<tr><td style="font-weight:600;color:var(--text)">🛵 ${e.nome||e.id?.substring(0,8)}</td><td><span class="p-badge b-${e.status==='ocupado'?'aguardando':'entregue'}">${e.status||'—'}</span></td><td><span class="p-badge b-${e.disponivel?'em_rota':'fila'}">${e.disponivel?'Online':'Offline'}</span></td><td style="font-size:12px;color:var(--text3)">${e.lat?e.lat.toFixed(2)+', '+e.lng?.toFixed(2):'—'}</td><td style="font-size:12px;color:var(--text3)">${e.updated_at?new Date(e.updated_at).toLocaleString('pt-BR'):'—'}</td></tr>`).join('');
}

async function _renderUsuariosTab(el){
  el.innerHTML=`<div style="display:flex;justify-content:flex-end;margin-bottom:12px"><button class="btn-sm btn-primary-sm" onclick="abrirModalUsuario()">➕ Novo Usuário</button></div><div class="card"><div style="overflow-x:auto"><table><thead><tr><th>Nome</th><th>E-mail</th><th>Perfil</th><th>Loja</th><th>Status</th><th>Criado em</th></tr></thead><tbody id="tbody-cad-usuarios"></tbody></table></div></div>`;
  const data=await db('usuarios_painel','GET',null,'?order=created_at.desc'),lojas=await db('lojas','GET',null,'');
  const tbody=document.getElementById('tbody-cad-usuarios');if(!tbody)return;
  const badgeMap={adm:'badge-adm',loja:'badge-loja',suporte:'badge-suporte'};
  tbody.innerHTML=data.length===0?'<tr><td colspan="6" style="text-align:center;padding:32px;color:var(--text3)">Nenhum usuário</td></tr>':data.map(u=>{const loja=lojas.find(l=>l.id===u.loja_id);return`<tr><td style="font-weight:600;color:var(--text)">${u.nome}</td><td style="font-size:12px">${u.email}</td><td><span class="user-perfil-badge ${badgeMap[u.perfil]||''}">${u.perfil?.toUpperCase()}</span></td><td style="font-size:12px;color:var(--text3)">${loja?loja.nome:'—'}</td><td><span class="p-badge b-${u.ativo?'em_rota':'fila'}">${u.ativo?'Ativo':'Inativo'}</span></td><td style="font-size:12px;color:var(--text3)">${u.created_at?new Date(u.created_at).toLocaleString('pt-BR'):'—'}</td></tr>`;}).join('');
}

async function _renderPrecificacaoTab(el){
  el.innerHTML=`
    <div style="display:flex;gap:0;margin-bottom:20px;border-bottom:1px solid var(--border)">
      <button id="aba-cobranca" onclick="trocarAbaTabela('cobranca')" style="padding:10px 24px;border:none;background:none;font-family:Inter,sans-serif;font-size:13px;font-weight:600;cursor:pointer;border-bottom:2px solid var(--accent);color:var(--accent)">📋 Cobrança Cliente</button>
      <button id="aba-pagamento" onclick="trocarAbaTabela('pagamento')" style="padding:10px 24px;border:none;background:none;font-family:Inter,sans-serif;font-size:13px;font-weight:600;cursor:pointer;border-bottom:2px solid transparent;color:var(--text3)">🛵 Pagamento Motoboy</button>
    </div>
    <div style="display:flex;justify-content:flex-end;margin-bottom:12px"><div id="tp-btn-novo"></div></div>
    <div class="card" id="tabelas-lista"><div style="padding:24px;text-align:center;color:var(--text3)">Carregando...</div></div>`;
  _tabAba='cobranca';await carregarTabelasPreco();
}

function _renderPrecoDinamicoTab(el,tipo){
  const label=tipo==='cliente'?'Cobrança da Loja':'Pagamento do Entregador';
  const cor=tipo==='cliente'?'var(--accent)':'#10b981';
  el.innerHTML=`
    <div class="card" style="max-width:480px">
      <div class="card-header"><span class="card-title">📈 Preço Dinâmico — ${label}</span></div>
      <div style="padding:20px">
        <p style="color:var(--text2);font-size:13px;margin-bottom:16px">
          ${tipo==='cliente'?'Valor fixo extra somado à taxa cobrada da loja em todos os pedidos.':'Valor fixo extra somado ao pagamento do entregador em todos os pedidos.'}
        </p>
        <div class="fi" style="margin-bottom:16px">
          <label>Valor extra (R$)</label>
          <input type="number" id="preco-din-valor-${tipo}" step="0.01" placeholder="0.00" style="max-width:200px"/>
        </div>
        <div id="preco-din-feedback-${tipo}" style="margin-bottom:12px;font-size:12px"></div>
        <button class="btn-modal-primary" onclick="salvarPrecoDinamico('${tipo}')">💾 Salvar</button>
      </div>
    </div>`;
  // Carrega valor atual
  db('configuracoes','GET',null,`?chave=eq.preco_dinamico_${tipo}`).then(data=>{
    const input=document.getElementById(`preco-din-valor-${tipo}`);
    if(input&&data&&data[0])input.value=parseFloat(data[0].valor||0).toFixed(2);
  });
}

async function salvarPrecoDinamico(tipo){
  const input=document.getElementById(`preco-din-valor-${tipo}`);
  const fb=document.getElementById(`preco-din-feedback-${tipo}`);
  const valor=parseFloat(input?.value)||0;
  if(fb)fb.innerHTML='<span style="color:var(--text2)">⏳ Salvando...</span>';
  // Upsert na tabela configuracoes
  const existing=await db('configuracoes','GET',null,`?chave=eq.preco_dinamico_${tipo}`);
  if(existing&&existing.length>0){
    await db('configuracoes','PATCH',{valor:String(valor),updated_at:new Date().toISOString()},`?chave=eq.preco_dinamico_${tipo}`);
  }else{
    await db('configuracoes','POST',{chave:`preco_dinamico_${tipo}`,valor:String(valor),created_at:new Date().toISOString(),updated_at:new Date().toISOString()});
  }
  if(fb)fb.innerHTML='<span style="color:var(--green)">✅ Salvo!</span>';
  showNotif('✅ Preço dinâmico salvo!','');
}

async function renderNovoPedidoPage(){
  const lojas=currentPerfil==='adm'?await db('lojas','GET',null,'?ativo=eq.true&order=nome.asc'):[];
  const seletorLoja=currentPerfil==='adm'?`<div class="form-row full"><div class="fi"><label style="color:#1A56DB;font-weight:700">🏪 Loja</label><select id="np-loja-id" onchange="onChangeLoja()" style="background:var(--surface2);color:var(--text);border:1px solid #1A56DB;border-radius:8px;padding:9px 12px;width:100%;font-family:Inter,sans-serif;font-size:14px"><option value="">Selecione a loja...</option>${lojas.map(l=>`<option value="${l.id}" data-lat="${l.latitude||''}" data-lng="${l.longitude||''}">${l.nome}</option>`).join('')}</select></div></div>`:'';
  document.getElementById('app-body').innerHTML=`<div class="alt-page" style="display:flex;align-items:flex-start;justify-content:center"><div style="width:100%;max-width:520px"><div class="page-header"><div class="page-title">➕ Novo Pedido</div></div><div class="card"><div class="modal-body">${seletorLoja}<div class="form-row"><div class="fi"><label>Nº Pedido</label><input id="np-numero" placeholder="0001"/></div><div class="fi"><label>Cliente</label><input id="np-cliente" placeholder="Nome"/></div></div><div class="form-row full"><div class="fi"><label>Telefone</label><input id="np-telefone" placeholder="(16) 99999-9999"/></div></div><div class="form-row full"><div class="fi"><label>Endereço de entrega</label><input id="np-endereco" placeholder="Rua, número, bairro" autocomplete="off" oninput="onChangeEnderecoDebounce()"/></div></div><div id="np-endereco-feedback" style="font-size:11px;margin:2px 0 6px;min-height:16px"></div><div class="form-row"><div class="fi"><label>Valor do Pedido (R$)</label><input type="number" id="np-valor" placeholder="0.00" step="0.01"/></div><div class="fi"><label>Distância</label><input id="np-km" placeholder="—" readonly style="background:var(--surface2);color:#60a5fa;font-weight:700;cursor:default"/></div></div><div class="form-row"><div class="fi"><label>Taxa de entrega (R$)</label><input type="number" id="np-taxa" placeholder="0.00" step="0.01"/></div><div class="fi"><label>Gorjeta entregador (R$)</label><input type="number" id="np-gorjeta" placeholder="0.00" step="0.50" value="0" oninput="onChangeGorjeta()"/></div></div><div id="np-gorjeta-info" style="font-size:11px;color:#f59e0b;margin-bottom:4px;min-height:14px"></div><div class="form-row full"><div class="fi"><label>⭐ Pontos</label><input type="number" id="np-pontos" value="4" min="1" max="20"/></div></div><div class="form-row full"><div class="fi"><label>Observações</label><textarea id="np-descricao" placeholder="Itens do pedido..."></textarea></div></div><div id="np-feedback" style="margin-top:4px"></div><div style="display:flex;justify-content:flex-end;margin-top:16px"><button class="btn-modal-primary" onclick="criarPedido()">🚀 Criar Pedido</button></div></div></div></div></div>`;
  setTimeout(()=>iniciarAutocompleteEndereco('np-endereco','','','np-endereco-feedback'),100);
}

async function renderPedidosPage(){
  document.getElementById('app-body').innerHTML=`<div class="alt-page"><div class="page-header"><div class="page-title">📦 Pedidos</div><div style="display:flex;gap:8px">${currentPerfil!=='suporte'?`<button class="btn-sm btn-primary-sm" onclick="abrirModal('modal-pedido')">➕ Novo Pedido</button>`:''}<button class="btn-sm btn-primary-sm" onclick="renderPedidosPage()">↻ Atualizar</button></div></div><div class="card"><div style="overflow-x:auto"><table><thead><tr><th>Pedido</th><th>Endereço</th><th>Valor</th><th>Status</th><th>Código</th><th>Data</th></tr></thead><tbody id="tbody-pedidos"></tbody></table></div></div></div>`;
  const pedidos=await db('pedidos','GET',null,'?order=created_at.desc&limit=100');
  const tbody=document.getElementById('tbody-pedidos');if(!tbody)return;
  tbody.innerHTML=pedidos.length===0?'<tr><td colspan="6" style="text-align:center;padding:32px;color:var(--text3)">Nenhum pedido</td></tr>':pedidos.map(p=>{const sk=getStatusKey(p);return`<tr><td style="font-weight:700;color:var(--text)">#${p.numero||p.id?.substring(0,6)}</td><td>${p.endereco||'—'}</td><td style="font-weight:700;color:var(--green)">R$ ${(p.valor||0).toFixed(2)}</td><td><span class="p-badge b-${sk}">${getStatusLabel(p)}</span></td><td style="font-weight:700;letter-spacing:4px;color:var(--pink)">${p.codigo_confirmacao||'—'}</td><td style="font-size:12px;color:var(--text3)">${p.created_at?new Date(p.created_at).toLocaleString('pt-BR'):'—'}</td></tr>`;}).join('');
}
async function renderMotoboyPage(){
  document.getElementById('app-body').innerHTML=`<div class="alt-page"><div class="page-header"><div class="page-title">🛵 Motoboys</div><button class="btn-sm btn-primary-sm" onclick="renderMotoboyPage()">↻ Atualizar</button></div><div class="card"><div style="overflow-x:auto"><table><thead><tr><th>Nome</th><th>Status</th><th>Disponível</th><th>Localização</th><th>Atualizado</th></tr></thead><tbody id="tbody-moto"></tbody></table></div></div></div>`;
  const data=await db('entregadores','GET',null,'?order=updated_at.desc');
  const tbody=document.getElementById('tbody-moto');if(!tbody)return;
  tbody.innerHTML=data.length===0?'<tr><td colspan="5" style="text-align:center;padding:32px;color:var(--text3)">Nenhum motoboy</td></tr>':data.map(e=>`<tr><td style="font-weight:600;color:var(--text)">🛵 ${e.nome||e.id?.substring(0,8)}</td><td><span class="p-badge b-${e.status==='ocupado'?'aguardando':'entregue'}">${e.status||'—'}</span></td><td><span class="p-badge b-${e.disponivel?'em_rota':'fila'}">${e.disponivel?'Online':'Offline'}</span></td><td style="font-size:12px;color:var(--text3)">${e.lat?e.lat.toFixed(2)+', '+e.lng?.toFixed(2):'—'}</td><td style="font-size:12px;color:var(--text3)">${e.updated_at?new Date(e.updated_at).toLocaleString('pt-BR'):'—'}</td></tr>`).join('');
}

async function renderLojasPage(){
  document.getElementById('app-body').innerHTML=`<div class="alt-page"><div class="page-header"><div class="page-title">🏪 Lojas</div><button class="btn-sm btn-primary-sm" onclick="abrirModal('modal-loja')">➕ Nova Loja</button></div><div class="card"><div style="overflow-x:auto"><table><thead><tr><th>Nome</th><th>Telefone</th><th>Endereço</th><th>E-mail acesso</th><th>Status</th><th>Ações</th></tr></thead><tbody id="tbody-lojas"></tbody></table></div></div></div>`;
  const data=await db('lojas','GET',null,'?order=created_at.desc');
  const tbody=document.getElementById('tbody-lojas');if(!tbody)return;
  tbody.innerHTML=data.length===0?'<tr><td colspan="6" style="text-align:center;padding:32px;color:var(--text3)">Nenhuma loja</td></tr>':data.map(l=>`<tr><td style="font-weight:600;color:var(--text)">🏪 ${l.nome}</td><td>${l.telefone||'—'}</td><td>${l.endereco||'—'}</td><td style="font-size:12px;color:var(--text3)">${l.email||'—'}</td><td><span class="p-badge b-${l.ativo?'em_rota':'fila'}">${l.ativo?'Ativa':'Inativa'}</span></td><td><button onclick="abrirEditarLoja('${l.id}')" style="background:none;border:1px solid var(--border);border-radius:6px;width:30px;height:30px;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;font-size:14px;">✏️</button></td></tr>`).join('');
}

async function abrirEditarLoja(lojaId){
  const data=await db('lojas','GET',null,`?id=eq.${lojaId}`);const l=data[0];if(!l)return;
  let modal=document.getElementById('modal-editar-loja');
  if(!modal){modal=document.createElement('div');modal.id='modal-editar-loja';modal.className='modal-overlay';document.body.appendChild(modal);}
  modal.innerHTML=`<div class="modal"><div class="modal-header"><span class="modal-title">✏️ Editar Loja — ${l.nome}</span><button class="modal-close" onclick="document.getElementById('modal-editar-loja').classList.remove('open')">✕</button></div><div class="modal-body"><div class="form-row"><div class="fi"><label>Nome</label><input id="el-nome" value="${l.nome||''}"/></div><div class="fi"><label>Telefone</label><input id="el-telefone" value="${l.telefone||''}"/></div></div><div class="form-row full"><div class="fi"><label>Endereço</label><input id="el-endereco" value="${l.endereco||''}" placeholder="Rua, número, bairro" autocomplete="off"/></div></div><div class="form-row"><div class="fi"><label>E-mail acesso</label><input id="el-email" value="${l.email||''}"/></div><div class="fi"><label>Status</label><select id="el-ativo" style="background:var(--surface2);color:var(--text);border:1px solid var(--border);border-radius:8px;padding:9px 12px;width:100%;font-family:Inter,sans-serif;font-size:14px"><option value="true" ${l.ativo?'selected':''}>Ativa</option><option value="false" ${!l.ativo?'selected':''}>Inativa</option></select></div></div><div style="background:#1A56DB10;border:1px solid #1A56DB40;border-radius:10px;padding:14px;margin-top:4px"><div style="font-size:11px;color:#1A56DB;font-weight:700;margin-bottom:10px">📍 COORDENADAS GPS (obrigatório para validação de 35m)</div><div class="form-row"><div class="fi"><label>Latitude</label><input type="number" id="el-lat" step="0.000001" value="${l.latitude||''}" placeholder="-21.1775"/></div><div class="fi"><label>Longitude</label><input type="number" id="el-lng" step="0.000001" value="${l.longitude||''}" placeholder="-47.8103"/></div></div><button onclick="geocodificarLoja()" style="background:#1A56DB20;color:#1A56DB;border:1px solid #1A56DB50;border-radius:8px;padding:8px 14px;cursor:pointer;font-size:12px;font-weight:600;width:100%;margin-top:4px">🔍 Buscar coordenadas pelo endereço</button><div id="el-geo-feedback" style="margin-top:6px;font-size:12px"></div></div><div id="el-feedback" style="margin-top:10px"></div></div><div class="modal-footer"><button class="btn-modal-cancel" onclick="document.getElementById('modal-editar-loja').classList.remove('open')">Cancelar</button><button class="btn-modal-primary" onclick="salvarEdicaoLoja('${lojaId}')">💾 Salvar</button></div></div>`;
  modal.classList.add('open');
  setTimeout(()=>iniciarAutocompleteEndereco('el-endereco','el-lat','el-lng','el-geo-feedback'),100);
}
async function geocodificarLoja(){
  const endereco=document.getElementById('el-endereco')?.value,fb=document.getElementById('el-geo-feedback');
  if(!endereco){if(fb)fb.innerHTML='<span style="color:var(--red)">Preencha o endereço primeiro</span>';return;}
  if(fb)fb.innerHTML='<span style="color:var(--text2)">⏳ Buscando...</span>';
  const geo=await geocodificarEndereco(endereco);
  if(geo){document.getElementById('el-lat').value=geo.lat.toFixed(6);document.getElementById('el-lng').value=geo.lng.toFixed(6);if(fb)fb.innerHTML=`<span style="color:var(--green)">✅ ${geo.lat.toFixed(6)}, ${geo.lng.toFixed(6)}</span>`;}
  else{if(fb)fb.innerHTML='<span style="color:var(--red)">❌ Não encontrado</span>';}
}
async function salvarEdicaoLoja(lojaId){
  const fb=document.getElementById('el-feedback');if(fb)fb.innerHTML='<div style="color:var(--text2);font-size:13px">⏳ Salvando...</div>';
  const lat=parseFloat(document.getElementById('el-lat')?.value)||null,lng=parseFloat(document.getElementById('el-lng')?.value)||null;
  const update={nome:document.getElementById('el-nome')?.value||'',telefone:document.getElementById('el-telefone')?.value||'',endereco:document.getElementById('el-endereco')?.value||'',email:document.getElementById('el-email')?.value||'',ativo:document.getElementById('el-ativo')?.value==='true',latitude:lat,longitude:lng,updated_at:new Date().toISOString()};
  if(!update.nome){if(fb)fb.innerHTML='<div style="color:var(--red);font-size:13px">Nome obrigatório.</div>';return;}
  await db('lojas','PATCH',update,`?id=eq.${lojaId}`);await logAcao('editar_loja',{loja_id:lojaId,nome:update.nome});
  if(fb)fb.innerHTML='<div style="color:var(--green);font-size:13px">✅ Loja atualizada!</div>';showNotif('✅ Loja atualizada!',update.nome);
  setTimeout(()=>{document.getElementById('modal-editar-loja')?.classList.remove('open');renderLojasPage();},1200);
}
async function criarLoja(){
  const nome=document.getElementById('loja-nome').value,telefone=document.getElementById('loja-telefone').value,endereco=document.getElementById('loja-endereco').value,email=document.getElementById('loja-email').value,senha=document.getElementById('loja-senha').value;
  const fb=document.getElementById('loja-feedback');
  if(!nome||!email||!senha){fb.innerHTML='<div style="color:var(--red);font-size:13px">Preencha nome, e-mail e senha.</div>';return;}
  fb.innerHTML='<div style="color:var(--text2);font-size:13px">⏳ Cadastrando...</div>';
  const lojas=await db('lojas','POST',{nome,telefone,endereco,email,ativo:true});
  if(!lojas||lojas.length===0){fb.innerHTML='<div style="color:var(--red);font-size:13px">❌ Erro ao cadastrar loja.</div>';return;}
  await db('usuarios_painel','POST',{nome,email,senha,perfil:'loja',loja_id:lojas[0].id,ativo:true});
  await logAcao('criar_loja',{nome,email});
  fb.innerHTML='<div style="color:var(--green);font-size:13px">✅ Loja cadastrada!</div>';showNotif('Loja criada!',`${nome} pode acessar com ${email}`);
  setTimeout(()=>fecharModal('modal-loja'),2000);
}

async function renderUsuariosPage(){
  document.getElementById('app-body').innerHTML=`<div class="alt-page"><div class="page-header"><div class="page-title">👥 Usuários do Painel</div><button class="btn-sm btn-primary-sm" onclick="abrirModalUsuario()">➕ Novo Usuário</button></div><div class="card"><div style="overflow-x:auto"><table><thead><tr><th>Nome</th><th>E-mail</th><th>Perfil</th><th>Loja</th><th>Status</th><th>Criado em</th></tr></thead><tbody id="tbody-usuarios"></tbody></table></div></div></div>`;
  const data=await db('usuarios_painel','GET',null,'?order=created_at.desc'),lojas=await db('lojas','GET',null,'');
  const tbody=document.getElementById('tbody-usuarios');if(!tbody)return;
  const badgeMap={adm:'badge-adm',loja:'badge-loja',suporte:'badge-suporte'};
  tbody.innerHTML=data.length===0?'<tr><td colspan="6" style="text-align:center;padding:32px;color:var(--text3)">Nenhum usuário</td></tr>':data.map(u=>{const loja=lojas.find(l=>l.id===u.loja_id);return`<tr><td style="font-weight:600;color:var(--text)">${u.nome}</td><td style="font-size:12px">${u.email}</td><td><span class="user-perfil-badge ${badgeMap[u.perfil]||''}">${u.perfil?.toUpperCase()}</span></td><td style="font-size:12px;color:var(--text3)">${loja?loja.nome:'—'}</td><td><span class="p-badge b-${u.ativo?'em_rota':'fila'}">${u.ativo?'Ativo':'Inativo'}</span></td><td style="font-size:12px;color:var(--text3)">${u.created_at?new Date(u.created_at).toLocaleString('pt-BR'):'—'}</td></tr>`;}).join('');
}
async function abrirModalUsuario(){
  const lojas=await db('lojas','GET',null,'');const sel=document.getElementById('u-loja-id');
  sel.innerHTML='<option value="">Selecione a loja</option>'+lojas.map(l=>`<option value="${l.id}">${l.nome}</option>`).join('');
  document.getElementById('u-perfil').onchange=function(){document.getElementById('u-loja-row').style.display=this.value==='loja'?'grid':'none';};
  document.getElementById('modal-usuario').classList.add('open');
}
async function criarUsuario(){
  const nome=document.getElementById('u-nome').value,email=document.getElementById('u-email').value,senha=document.getElementById('u-senha').value,perfil=document.getElementById('u-perfil').value,lojaId=document.getElementById('u-loja-id').value||null;
  const fb=document.getElementById('u-feedback');
  if(!nome||!email||!senha){fb.innerHTML='<div style="color:var(--red);font-size:13px">Preencha todos os campos.</div>';return;}
  fb.innerHTML='<div style="color:var(--text2);font-size:13px">⏳ Cadastrando...</div>';
  const result=await db('usuarios_painel','POST',{nome,email,senha,perfil,loja_id:lojaId,ativo:true});
  await logAcao('criar_usuario',{nome,email,perfil});
  if(result&&result.length>0){fb.innerHTML='<div style="color:var(--green);font-size:13px">✅ Usuário cadastrado!</div>';showNotif('Usuário criado!',`${nome} (${perfil})`);setTimeout(()=>fecharModal('modal-usuario'),2000);}
  else fb.innerHTML='<div style="color:var(--red);font-size:13px">❌ Erro. E-mail pode já estar cadastrado.</div>';
}

async function renderRelatoriosPage(){
  document.getElementById('app-body').innerHTML=`<div class="alt-page"><div class="page-header"><div class="page-title">📈 Relatórios</div></div><div class="stats-grid"><div class="stat-card"><div class="stat-label">Total Pedidos</div><div class="stat-value" id="r-total">—</div></div><div class="stat-card"><div class="stat-label">Entregues</div><div class="stat-value" id="r-ent" style="color:var(--green)">—</div></div><div class="stat-card"><div class="stat-label">Faturamento</div><div class="stat-value" id="r-fat" style="color:var(--accent)">—</div></div><div class="stat-card"><div class="stat-label">Motoboys</div><div class="stat-value" id="r-moto">—</div></div><div class="stat-card"><div class="stat-label">Lojas</div><div class="stat-value" id="r-lojas">—</div></div><div class="stat-card"><div class="stat-label">Usuários</div><div class="stat-value" id="r-usuarios">—</div></div></div><div class="card"><div class="card-header"><span class="card-title">Pedidos por Status</span></div><div style="padding:20px" id="status-bars"></div></div></div>`;
  const [pedidos,motoboys,lojas,usuarios]=await Promise.all([db('pedidos','GET',null,''),db('entregadores','GET',null,''),db('lojas','GET',null,''),db('usuarios_painel','GET',null,'')]);
  document.getElementById('r-total').textContent=pedidos.length;document.getElementById('r-ent').textContent=pedidos.filter(p=>p.status==='entregue'||p.status==='finalizado').length;document.getElementById('r-fat').textContent='R$'+pedidos.reduce((s,p)=>s+(p.valor||0),0).toFixed(0);document.getElementById('r-moto').textContent=motoboys.length;document.getElementById('r-lojas').textContent=lojas.length;document.getElementById('r-usuarios').textContent=usuarios.length;
  const sc={};pedidos.forEach(p=>{const s=getStatusKey(p);sc[s]=(sc[s]||0)+1;});const total=pedidos.length||1;const colors={recebido:'#ef4444',pronto:'#ec4899',aceito:'#8b5cf6',em_rota:'#1A56DB',finalizado:'#22c55e',entregue:'#475569'};
  document.getElementById('status-bars').innerHTML=Object.entries(sc).map(([s,n])=>`<div style="margin-bottom:14px"><div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:5px"><span style="color:var(--text2)">${STATUS_LABEL[s]||s}</span><span style="font-weight:700">${n}</span></div><div style="background:var(--surface2);border-radius:4px;height:8px;overflow:hidden"><div style="background:${colors[s]||'#475569'};height:100%;width:${(n/total*100).toFixed(1)}%;border-radius:4px"></div></div></div>`).join('');
}

async function renderLogsPage(){
  document.getElementById('app-body').innerHTML=`<div class="alt-page"><div class="page-header"><div class="page-title">📋 Logs de Ações</div><button class="btn-sm btn-primary-sm" onclick="renderLogsPage()">↻ Atualizar</button></div><div class="card"><div style="overflow-x:auto"><table><thead><tr><th>Data/Hora</th><th>Usuário</th><th>Ação</th><th>Detalhes</th></tr></thead><tbody id="tbody-logs"></tbody></table></div></div></div>`;
  const logs=await db('logs_acoes','GET',null,'?order=created_at.desc&limit=100'),usuarios=await db('usuarios_painel','GET',null,'');
  const tbody=document.getElementById('tbody-logs');if(!tbody)return;
  tbody.innerHTML=logs.length===0?'<tr><td colspan="4" style="text-align:center;padding:32px;color:var(--text3)">Nenhum log</td></tr>':logs.map(l=>{const u=usuarios.find(x=>x.id===l.usuario_id);return`<tr><td style="font-size:12px;color:var(--text3)">${l.created_at?new Date(l.created_at).toLocaleString('pt-BR'):'—'}</td><td style="font-weight:600;color:var(--text)">${u?u.nome:'—'} <span style="font-size:10px;color:var(--text3)">(${u?.perfil||'—'})</span></td><td><span class="p-badge b-disponivel">${l.acao}</span></td><td style="font-size:12px;color:var(--text3)">${l.detalhes?JSON.stringify(l.detalhes).substring(0,80):'—'}</td></tr>`;}).join('');
}

let _financeiroAba='faturamento';
function renderFinanceiroPage(aba){
  _financeiroAba=aba||_financeiroAba||'faturamento';
  const abas=[
    {id:'faturamento',        icon:'📊', label:'Faturamento',             desc:'Visão consolidada do faturamento por período, loja e entregador.'},
    {id:'credito',            icon:'💳', label:'Crédito',                 desc:'Gestão de créditos, bonificações e saldo de clientes e parceiros.'},
    {id:'contas-receber',     icon:'⬇️', label:'Contas a Receber',        desc:'Controle de valores a receber de lojas e clientes.'},
    {id:'contas-pagar',       icon:'⬆️', label:'Contas a Pagar',          desc:'Controle de valores a pagar a fornecedores e parceiros.'},
    {id:'repasse-entregadores',icon:'🛵',label:'Repasse dos Entregadores', desc:'Cálculo e registro dos repasses financeiros aos entregadores por período.'},
  ];
  document.getElementById('app-body').innerHTML=`
    <div class="alt-page">
      <div class="page-header"><div class="page-title">💵 Financeiro</div></div>
      <div style="display:flex;gap:0;margin-bottom:20px;border-bottom:1px solid var(--border);overflow-x:auto;flex-wrap:nowrap">
        ${abas.map(a=>`<button onclick="renderFinanceiroPage('${a.id}')" style="padding:10px 18px;border:none;background:none;font-family:Inter,sans-serif;font-size:13px;font-weight:600;cursor:pointer;white-space:nowrap;border-bottom:2px solid ${_financeiroAba===a.id?'var(--accent)':'transparent'};color:${_financeiroAba===a.id?'var(--accent)':'var(--text3)'}">${a.icon} ${a.label}</button>`).join('')}
      </div>
      <div id="financeiro-content"></div>
    </div>`;
  const abaInfo=abas.find(a=>a.id===_financeiroAba);
  document.getElementById('financeiro-content').innerHTML=`
    <div class="card" style="max-width:520px;margin:40px auto;text-align:center;padding:48px 32px">
      <div style="font-size:56px;margin-bottom:16px">${abaInfo.icon}</div>
      <div style="font-size:20px;font-weight:800;color:var(--text);margin-bottom:10px">${abaInfo.label}</div>
      <div style="display:inline-block;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;border-radius:20px;padding:4px 16px;font-size:12px;font-weight:700;margin-bottom:16px">Em breve</div>
      <div style="color:var(--text2);font-size:14px;line-height:1.6">${abaInfo.desc}</div>
    </div>`;
}

let _configAba='cliente';
function renderConfiguracaoPage(aba){
  _configAba=aba||_configAba||'cliente';
  const abas=[
    {id:'cliente',       icon:'👤', label:'Cliente',       desc:'Configurações de experiência do cliente final, notificações e preferências de pedido.',        icone:'👤'},
    {id:'integracao',    icon:'🔗', label:'Integração',    desc:'Conecte sistemas externos, webhooks, APIs de terceiros e integrações de pagamento.',            icone:'🔗'},
    {id:'open-delivery', icon:'🚀', label:'Open Delivery', desc:'Configurações do protocolo Open Delivery para interoperabilidade com outras plataformas.',       icone:'🚀'},
    {id:'operacao',      icon:'🛠️', label:'Operação',      desc:'Parâmetros operacionais: raio de aceite, tempo máximo, filas e regras de despacho automático.', icone:'🛠️'},
  ];
  document.getElementById('app-body').innerHTML=`
    <div class="alt-page">
      <div class="page-header"><div class="page-title">⚙️ Configuração</div></div>
      <div style="display:flex;gap:0;margin-bottom:20px;border-bottom:1px solid var(--border);overflow-x:auto;flex-wrap:nowrap">
        ${abas.map(a=>`<button onclick="renderConfiguracaoPage('${a.id}')" style="padding:10px 18px;border:none;background:none;font-family:Inter,sans-serif;font-size:13px;font-weight:600;cursor:pointer;white-space:nowrap;border-bottom:2px solid ${_configAba===a.id?'var(--accent)':'transparent'};color:${_configAba===a.id?'var(--accent)':'var(--text3)'}">${a.icon} ${a.label}</button>`).join('')}
      </div>
      <div id="config-content"></div>
    </div>`;
  const abaInfo=abas.find(a=>a.id===_configAba);
  document.getElementById('config-content').innerHTML=`
    <div class="card" style="max-width:520px;margin:40px auto;text-align:center;padding:48px 32px">
      <div style="font-size:56px;margin-bottom:16px">${abaInfo.icone}</div>
      <div style="font-size:20px;font-weight:800;color:var(--text);margin-bottom:10px">${abaInfo.label}</div>
      <div style="display:inline-block;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;border-radius:20px;padding:4px 16px;font-size:12px;font-weight:700;margin-bottom:16px">Em breve</div>
      <div style="color:var(--text2);font-size:14px;line-height:1.6">${abaInfo.desc}</div>
    </div>`;
}

let _tabAba='cobranca';
async function renderTabelasPrecoPage(){
  document.getElementById('app-body').innerHTML=`<div class="alt-page"><div class="page-header"><div class="page-title">💰 Tabelas de Preços</div><div id="tp-btn-novo"></div></div><div style="display:flex;gap:0;margin-bottom:20px;border-bottom:1px solid var(--border)"><button id="aba-cobranca" onclick="trocarAbaTabela('cobranca')" style="padding:10px 24px;border:none;background:none;font-family:Inter,sans-serif;font-size:13px;font-weight:600;cursor:pointer;border-bottom:2px solid var(--accent);color:var(--accent)">📋 Cobrança Cliente</button><button id="aba-pagamento" onclick="trocarAbaTabela('pagamento')" style="padding:10px 24px;border:none;background:none;font-family:Inter,sans-serif;font-size:13px;font-weight:600;cursor:pointer;border-bottom:2px solid transparent;color:var(--text3)">🛵 Pagamento Motoboy</button></div><div class="card" id="tabelas-lista"><div style="padding:24px;text-align:center;color:var(--text3)">Carregando...</div></div></div>`;
  _tabAba='cobranca';await carregarTabelasPreco();
}
function trocarAbaTabela(aba){_tabAba=aba;const bc=document.getElementById('aba-cobranca'),bp=document.getElementById('aba-pagamento');if(aba==='cobranca'){bc.style.borderBottom='2px solid var(--accent)';bc.style.color='var(--accent)';bp.style.borderBottom='2px solid transparent';bp.style.color='var(--text3)';}else{bp.style.borderBottom='2px solid #10b981';bp.style.color='#10b981';bc.style.borderBottom='2px solid transparent';bc.style.color='var(--text3)';}carregarTabelasPreco();}
async function carregarTabelasPreco(){
  const tabelas=await db('tabelas_preco','GET',null,`?tipo=eq.${_tabAba}&order=created_at.asc`);
  const el=document.getElementById('tabelas-lista'),btnNovo=document.getElementById('tp-btn-novo');if(!el)return;
  if(btnNovo){const cor=_tabAba==='pagamento'?'#10b981':'var(--accent)';const label=_tabAba==='pagamento'?'➕ Novo Pagamento':'➕ Nova Cobrança';btnNovo.innerHTML=`<button class="btn-sm" style="background:${cor};color:#fff;border:none;border-radius:8px;padding:8px 16px;font-family:Inter,sans-serif;font-size:13px;font-weight:600;cursor:pointer" onclick="abrirModalNovaTabela('${_tabAba}')">${label}</button>`;}
  if(!tabelas.length){el.innerHTML='<div style="padding:32px;text-align:center;color:var(--text3)">Nenhuma tabela. Clique ➕ para criar.</div>';return;}
  el.innerHTML=`<div style="overflow-x:auto"><table><thead><tr><th>Nome</th><th>Status</th><th>Ações</th></tr></thead><tbody>${tabelas.map(t=>`<tr><td style="font-weight:600;color:var(--text)">💰 ${t.nome}</td><td><span class="p-badge b-${t.ativa?'em_rota':'fila'}">${t.ativa?'Ativa':'Inativa'}</span></td><td style="display:flex;gap:6px"><button class="btn-sm btn-primary-sm" onclick="verFaixas('${t.id}','${t.nome}','${t.tipo||'cobranca'}')">📊 Ver faixas</button><button class="btn-sm" style="background:var(--red);color:#fff" onclick="excluirTabela('${t.id}')">🗑️</button></td></tr>`).join('')}</tbody></table></div>`;
}
async function verFaixas(tabelaId,tabelaNome,tipo){
  const faixas=await db('tabelas_preco_faixas','GET',null,`?tabela_id=eq.${tabelaId}&order=km_de.asc`);
  const isPag=tipo==='pagamento',corSem=isPag?'#10b981':'var(--accent)',corCom=isPag?'#60a5fa':'var(--orange)';
  document.getElementById('modal-tabela-body').innerHTML=`<div style="padding:20px"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px"><h3 style="color:#fff;margin:0">💰 ${tabelaNome}</h3><span class="p-badge" style="background:${corSem}20;color:${corSem}">${isPag?'Pagamento Motoboy':'Cobrança Cliente'}</span></div><table><thead><tr><th>Range</th><th style="color:${corSem}">Sem retorno</th><th style="color:${corCom}">Com retorno</th><th>Ações</th></tr></thead><tbody>${faixas.map(f=>`<tr><td>${f.km_de} a ${f.km_ate} km</td><td style="color:${corSem};font-weight:700">R$ ${parseFloat(f.valor_sem_retorno).toFixed(2)}</td><td style="color:${corCom};font-weight:700">R$ ${parseFloat(f.valor_com_retorno).toFixed(2)}</td><td style="display:flex;gap:6px"><button class="btn-sm btn-primary-sm" onclick="editarFaixa('${f.id}','${tabelaId}','${tabelaNome}','${tipo}',${f.km_de},${f.km_ate},${f.valor_sem_retorno},${f.valor_com_retorno})">✏️</button><button class="btn-sm" style="background:var(--red);color:#fff" onclick="excluirFaixa('${f.id}','${tabelaId}','${tabelaNome}','${tipo}')">🗑️</button></td></tr>`).join('')}</tbody></table><div style="margin-top:16px"><button class="btn-sm btn-primary-sm" onclick="adicionarFaixa('${tabelaId}','${tabelaNome}','${tipo}')">➕ Nova faixa</button></div></div>`;
  document.getElementById('modal-tabela-preco').classList.add('open');
}
async function excluirFaixa(faixaId,tabelaId,tabelaNome,tipo){if(!confirm('Excluir?'))return;await db('tabelas_preco_faixas','DELETE',null,`?id=eq.${faixaId}`);showNotif('🗑️ Faixa excluída','','var(--red)');verFaixas(tabelaId,tabelaNome,tipo);}
function abrirModalNovaTabela(tipo){
  _faixaCount=1;const isPag=tipo==='pagamento',cor=isPag?'#10b981':'var(--accent)';
  document.getElementById('modal-tabela-body').innerHTML=`<div style="padding:20px"><h3 style="color:#fff;margin:0 0 16px">➕ Nova Tabela <span class="p-badge" style="background:${cor}20;color:${cor}">${isPag?'Pagamento':'Cobrança'}</span></h3><div class="form-row full"><div class="fi"><label>Nome</label><input id="tp-nome" placeholder="Ex: Tabela Lets Go"/></div></div><div style="margin:12px 0 6px;font-size:12px;font-weight:600;color:var(--text2)">Faixas</div><div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:6px;margin-bottom:6px"><span style="font-size:11px;color:var(--text3)">Km de</span><span style="font-size:11px;color:var(--text3)">Km até</span><span style="font-size:11px;color:var(--text3)">Sem retorno R$</span><span style="font-size:11px;color:var(--text3)">Com retorno R$</span></div><div id="tp-faixas">${gerarLinhaFaixa(0)}</div><button onclick="adicionarLinhaFaixa()" style="background:var(--surface2);color:var(--text2);border:1px solid var(--border);border-radius:8px;padding:7px 12px;cursor:pointer;font-size:12px;margin-top:8px">➕ Faixa</button><div id="tp-feedback" style="margin-top:10px"></div><div style="display:flex;gap:10px;justify-content:flex-end;margin-top:16px"><button class="btn-modal-cancel" onclick="fecharModal('modal-tabela-preco')">Cancelar</button><button class="btn-modal-primary" onclick="salvarNovaTabela('${tipo}')">✅ Cadastrar</button></div></div>`;
  document.getElementById('modal-tabela-preco').classList.add('open');
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
function editarFaixa(faixaId,tabelaId,tabelaNome,tipo,de,ate,sem,com){
  const isPag=tipo==='pagamento',corSem=isPag?'#10b981':'var(--accent)',corCom=isPag?'#60a5fa':'var(--orange)';
  document.getElementById('modal-tabela-body').innerHTML=`<div style="padding:20px"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px"><h3 style="color:#fff;margin:0">✏️ Editar Faixa</h3><span class="p-badge" style="background:${corSem}20;color:${corSem}">${tabelaNome}</span></div><div class="form-row"><div class="fi"><label>Km de</label><input type="number" id="ef-de" value="${parseFloat(de).toFixed(2)}" step="0.01" min="0"/></div><div class="fi"><label>Km até</label><input type="number" id="ef-ate" value="${parseFloat(ate).toFixed(2)}" step="0.01" min="0"/></div></div><div class="form-row"><div class="fi"><label style="color:${corSem}">Sem retorno (R$)</label><input type="number" id="ef-sem" value="${parseFloat(sem).toFixed(2)}" step="0.01" min="0"/></div><div class="fi"><label style="color:${corCom}">Com retorno (R$)</label><input type="number" id="ef-com" value="${parseFloat(com).toFixed(2)}" step="0.01" min="0"/></div></div><div id="ef-feedback" style="margin-top:8px;min-height:16px"></div><div style="display:flex;gap:10px;justify-content:flex-end;margin-top:16px"><button class="btn-modal-cancel" onclick="verFaixas('${tabelaId}','${tabelaNome}','${tipo}')">Cancelar</button><button class="btn-modal-primary" onclick="salvarEdicaoFaixa('${faixaId}','${tabelaId}','${tabelaNome}','${tipo}')">✅ Salvar</button></div></div>`;
  document.getElementById('modal-tabela-preco').classList.add('open');
}
async function salvarEdicaoFaixa(faixaId,tabelaId,tabelaNome,tipo){
  const fb=document.getElementById('ef-feedback');
  fb.innerHTML='<span style="color:var(--text2);font-size:12px">⏳ Salvando...</span>';
  await db('tabelas_preco_faixas','PATCH',{km_de:parseFloat(document.getElementById('ef-de').value)||0,km_ate:parseFloat(document.getElementById('ef-ate').value)||0,valor_sem_retorno:parseFloat(document.getElementById('ef-sem').value)||0,valor_com_retorno:parseFloat(document.getElementById('ef-com').value)||0},`?id=eq.${faixaId}`);
  showNotif('✅ Atualizado!','');verFaixas(tabelaId,tabelaNome,tipo);
}
async function excluirTabela(id){if(!confirm('Excluir tabela e faixas?'))return;await db('tabelas_preco_faixas','DELETE',null,`?tabela_id=eq.${id}`);await db('tabelas_preco','DELETE',null,`?id=eq.${id}`);showNotif('🗑️ Excluída','','var(--red)');carregarTabelasPreco();}

async function renderLojaPedidosPage(){
  document.getElementById('app-body').innerHTML=`<div class="alt-page"><div class="page-header"><div class="page-title">📦 Meus Pedidos</div><button class="btn-sm btn-primary-sm" onclick="renderLojaPedidosPage()">↻</button></div><div class="card"><div style="overflow-x:auto"><table><thead><tr><th>Pedido</th><th>Endereço</th><th>Valor</th><th>Status</th><th>Código</th></tr></thead><tbody id="tbody-loja-pedidos"></tbody></table></div></div></div>`;
  const pedidos=currentUser?.loja_id?await db('pedidos','GET',null,`?loja_id=eq.${currentUser.loja_id}&order=created_at.desc&limit=50`):[];
  const tbody=document.getElementById('tbody-loja-pedidos');if(!tbody)return;
  tbody.innerHTML=pedidos.length===0?'<tr><td colspan="5" style="text-align:center;padding:32px;color:var(--text3)">Nenhum pedido</td></tr>':pedidos.map(p=>`<tr><td style="font-weight:700">#${p.numero||p.id?.substring(0,6)}</td><td>${p.endereco||'—'}</td><td style="color:var(--green);font-weight:700">R$ ${(p.valor||0).toFixed(2)}</td><td><span class="p-badge b-${getStatusKey(p)}">${getStatusLabel(p)}</span></td><td style="font-weight:700;letter-spacing:4px;color:var(--pink)">${p.codigo_confirmacao||'—'}</td></tr>`).join('');
}
function renderLojaMapaPage(){
  document.getElementById('app-body').innerHTML=`<div style="flex:1;position:relative;overflow:hidden;height:100%"><div class="mapa-stats"><div class="mapa-stat"><span style="font-size:16px">📦</span><div><div class="mapa-stat-val" id="ms-pedidos">0</div><div class="mapa-stat-label">Pedidos</div></div></div></div><div id="map" style="width:100%;height:100%"></div></div>`;
  setTimeout(()=>{if(map){map.remove();map=null;}map=L.map('map',{zoomControl:false}).setView([-21.1775,-47.8103],13);L.control.zoom({position:'bottomright'}).addTo(map);L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',{attribution:'© OSM © CartoDB',maxZoom:19}).addTo(map);const at=async()=>{const p=currentUser?.loja_id?await db('pedidos','GET',null,`?loja_id=eq.${currentUser.loja_id}&order=created_at.desc&limit=50`):[];allPedidos=p;const ms=document.getElementById('ms-pedidos');if(ms)ms.textContent=p.length;atualizarMarcadores();};at();realtimeInterval=setInterval(at,5000);},100);
}
async function renderLojaRelatorioPage(){
  document.getElementById('app-body').innerHTML=`<div class="alt-page"><div class="page-header"><div class="page-title">📈 Relatório</div></div><div class="stats-grid"><div class="stat-card"><div class="stat-label">Total Pedidos</div><div class="stat-value" id="lr-total">—</div></div><div class="stat-card"><div class="stat-label">Entregues</div><div class="stat-value" id="lr-ent" style="color:var(--green)">—</div></div><div class="stat-card"><div class="stat-label">Faturamento</div><div class="stat-value" id="lr-fat" style="color:var(--accent)">—</div></div></div></div>`;
  const pedidos=currentUser?.loja_id?await db('pedidos','GET',null,`?loja_id=eq.${currentUser.loja_id}`):[];
  document.getElementById('lr-total').textContent=pedidos.length;document.getElementById('lr-ent').textContent=pedidos.filter(p=>p.status==='finalizado'||p.status==='entregue').length;document.getElementById('lr-fat').textContent='R$'+pedidos.reduce((s,p)=>s+(p.valor||0),0).toFixed(2);
}

document.addEventListener('DOMContentLoaded',()=>{
  const card=document.querySelector('.login-card');
  if(card){
    if(!document.getElementById('login-logo-wrap')){
      const wrap=document.createElement('div');wrap.id='login-logo-wrap';
      wrap.innerHTML=`<div id="login-logo-icon">🛵</div><div id="login-logo-text">Let's Go Delivery</div><div id="login-logo-sub">Painel de Gestão</div>`;
      card.insertBefore(wrap,card.firstChild);
    }
    if(!document.getElementById('login-forgot')){
      const btn=document.getElementById('login-btn');
      if(btn){
        const link=document.createElement('button');link.id='login-forgot';link.type='button';link.textContent='Esqueci minha senha';
        link.onclick=()=>alert('Entre em contato com o administrador para redefinir sua senha.');
        btn.insertAdjacentElement('afterend',link);
      }
    }
  }
});

document.addEventListener('DOMContentLoaded',async()=>{
  const sessao=sessionStorage.getItem('lg_user');if(!sessao)return;
  try{
    const user=JSON.parse(sessao);currentUser=user;currentPerfil=user.perfil;
    document.getElementById('login-screen').style.display='none';
    const appEl=document.getElementById('app');appEl.style.display='flex';appEl.getBoundingClientRect();
    document.getElementById('user-nome').textContent=currentUser.nome;
    const badgeMap={adm:'badge-adm',loja:'badge-loja',suporte:'badge-suporte'},labelMap={adm:'ADM',loja:'LOJA',suporte:'SUPORTE'};
    const badge=document.getElementById('user-perfil-badge');badge.className='user-perfil-badge '+(badgeMap[currentPerfil]||'');badge.textContent=labelMap[currentPerfil]||currentPerfil;
    const btnNovo=document.getElementById('btn-novo-pedido');if(btnNovo)btnNovo.style.display=currentPerfil!=='suporte'?'flex':'none';
    renderTabs();setTimeout(()=>{goTab(currentPerfil==='adm'?'mapa':currentPerfil==='suporte'?'mapa':'novo-pedido');_carregarSaldoTopbar();},150);
  }catch(e){sessionStorage.removeItem('lg_user');}
});

// ═══════════════════════════════════════════════
// AUTOCOMPLETE DE ENDEREÇO
// ═══════════════════════════════════════════════
let _autocompleteTimer=null;
function iniciarAutocompleteEndereco(inputId,latId,lngId,feedbackId){
  const input=document.getElementById(inputId);if(!input)return;
  let dropdown=document.getElementById(inputId+'-suggestions');
  if(!dropdown){dropdown=document.createElement('div');dropdown.id=inputId+'-suggestions';dropdown.style.cssText='position:absolute;z-index:9999;background:#1e2130;border:1px solid #1A56DB;border-radius:8px;margin-top:2px;max-height:200px;overflow-y:auto;display:none;box-shadow:0 8px 24px rgba(0,0,0,.5);width:100%;';input.parentElement.style.position='relative';input.parentElement.appendChild(dropdown);}
  input.addEventListener('input',()=>{
    clearTimeout(_autocompleteTimer);const val=input.value.trim();
    if(val.length<4){dropdown.style.display='none';return;}
    _autocompleteTimer=setTimeout(async()=>{
      try{
        const query=encodeURIComponent(val+', Ribeirão Preto, SP, Brasil');
        const r=await fetch(`https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=5&addressdetails=1`,{headers:{'Accept-Language':'pt-BR','User-Agent':'LetsGoDelivery/1.0'}});
        const results=await r.json();
        if(!results.length){dropdown.style.display='none';return;}
        dropdown.innerHTML=results.map(res=>`<div data-lat="${res.lat}" data-lng="${res.lon}" data-label="${res.display_name.replace(/"/g,'')}" style="padding:10px 14px;cursor:pointer;font-size:12px;color:#fff;border-bottom:1px solid #2a2d3e;line-height:1.4;" onmouseover="this.style.background='#1A56DB22'" onmouseout="this.style.background='none'">📍 ${res.display_name.split(',').slice(0,3).join(',')}</div>`).join('');
        dropdown.querySelectorAll('div').forEach(item=>{
          item.addEventListener('click',()=>{
            const lat=parseFloat(item.dataset.lat),lng=parseFloat(item.dataset.lng);
            const label=item.dataset.label.split(',').slice(0,3).join(',').trim();
            input.value=label;dropdown.style.display='none';
            if(latId&&document.getElementById(latId))document.getElementById(latId).value=lat.toFixed(6);
            if(lngId&&document.getElementById(lngId))document.getElementById(lngId).value=lng.toFixed(6);
            const fb=feedbackId?document.getElementById(feedbackId):null;
            if(fb)fb.innerHTML=`<span style="color:var(--green);font-size:11px">✅ Localizado</span>`;
            setTimeout(()=>calcularTaxaAuto(),100);
          });
        });
        dropdown.style.display='block';
      }catch(e){dropdown.style.display='none';}
    },500);
  });
  document.addEventListener('click',(e)=>{if(!input.contains(e.target)&&!dropdown.contains(e.target))dropdown.style.display='none';});
}
