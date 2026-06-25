// ═══════════════════════════════════════════════
// CONFIGURAÇÃO SUPABASE
// ═══════════════════════════════════════════════
const SB_URL='https://astbkmpegcmqljltmdpx.supabase.co';
const SB_KEY='sb_publishable_7lNXC4ipqerGckfvUQvlnQ_ObfWXhmI';

function corStatus(status){
  const cores={'agendado':'#ef4444','recebido':'#ef4444','cancelado':'#ef4444','pronto':'#e91e8c','aceito':'#eab308','chegou_no_local':'#06b6d4','chegou_local':'#06b6d4','em_rota':'#1A56DB','chegou_destino':'#7c3aed','retornando':'#16a34a','finalizado':'#16a34a'};
  return cores[status]||'#6b7280';
}
// Supabase pode retornar timestamps sem sufixo de fuso (ex: "2026-06-12T15:00:00").
// JavaScript trata isso como hora local, causando offset de 3h no UTC-3.
// Esta função força interpretação como UTC adicionando 'Z' quando necessário.
function _tsUtc(ts){const s=ts||'';return new Date(s.includes('Z')||s.includes('+')?s:s+'Z').getTime();}

let currentUser=null,currentPerfil=null,map=null;
let motoboyMarkers={},pedidoMarkers={},lojaMarkers={},coletaMarkers={},realtimeInterval=null;
let allPedidos=[],allMotoboys=[],allLojas=[],filterStatus='todos',selectedPedidoId=null,_pedidosSelecionados=new Set();
let idsProntoNotificados=new Set();
const _pedidoStatusLock=new Map(); // id -> {status,status_detalhado,expires}
let _saquesPendentesCount=0;
let _navAtivo='';
const NAV_ITEMS_ADM=[{id:'mapa',icon:'🗺️',label:'Mapa ao Vivo'},{id:'pedidos',icon:'📦',label:'Relatório Entregas'},{id:'cadastros',icon:'🗂️',label:'Cadastros'},{id:'preco-dinamico',icon:'📈',label:'Preço Dinâmico'},{id:'financeiro',icon:'💵',label:'Financeiro'},{id:'creditos',icon:'💳',label:'Créditos'},{id:'whatsapp',icon:'📲',label:'Disparo WhatsApp'},{id:'configuracao',icon:'⚙️',label:'Configuração'},{id:'auditoria',icon:'🔍',label:'Auditoria'},{id:'logs',icon:'📋',label:'Logs'}];
const NAV_ITEMS_LOJA_ADM=[{id:'mapa',icon:'🗺️',label:'Mapa ao Vivo'},{id:'pedidos',icon:'📦',label:'Relatório Entregas'},{id:'meu-cardapio',icon:'🍽️',label:'Meu Cardápio'}];
const NAV_ITEMS_LOJA=[{id:'novo-pedido',icon:'➕',label:'Novo Pedido'},{id:'loja-pedidos',icon:'📦',label:'Meus Pedidos'},{id:'loja-mapa',icon:'🗺️',label:'Rastrear'},{id:'loja-relatorio',icon:'📈',label:'Relatório'}];
const NAV_ITEMS_SUPORTE=[{id:'mapa',icon:'🗺️',label:'Mapa ao Vivo'},{id:'pedidos',icon:'📦',label:'Relatório Entregas'},{id:'cadastros',icon:'🗂️',label:'Cadastros'},{id:'preco-dinamico',icon:'📈',label:'Preço Dinâmico'}];
const tabsAdm=[{id:'mapa',icon:'🗺️',label:'Mapa ao Vivo'},{id:'pedidos',icon:'📦',label:'Relatório Entregas'},{id:'cadastros',icon:'🗂️',label:'Cadastros'},{id:'logs',icon:'📋',label:'Logs'}];
const tabsLojaAdm=[{id:'mapa',icon:'🗺️',label:'Mapa ao Vivo'},{id:'pedidos',icon:'📦',label:'Relatório Entregas'},{id:'meu-cardapio',icon:'🍽️',label:'Meu Cardápio'}];
const tabsLoja=[{id:'novo-pedido',icon:'➕',label:'Novo Pedido'},{id:'loja-pedidos',icon:'📦',label:'Meus Pedidos'},{id:'loja-mapa',icon:'🗺️',label:'Rastrear'},{id:'loja-relatorio',icon:'📈',label:'Relatório'}];
const tabsSuporte=[{id:'mapa',icon:'🗺️',label:'Mapa ao Vivo'},{id:'pedidos',icon:'📦',label:'Relatório Entregas'},{id:'cadastros',icon:'🗂️',label:'Cadastros'},{id:'logs',icon:'📋',label:'Logs'}];
let _sidebarBusca='';
const _gruposColapsados=new Set();
let _tabelaPedidosDia=[],_tabelaPagina=0;
let _tabelaFiltros={busca:'',entregador:'',status:'',data:''};
let _entFiltro='todos';

const TABELA_PAGAMENTO_ID='7bf1cf41-b3f2-4694-b326-d4e830dae8e1';
const TABELA_COBRANCA_ID='a1e291f2-f815-4f67-86bf-cd4e95fb5fb6';
let _faixasPagamento=[];
let _faixasCobranca=[];
let _faixasCachePorTabela={};
let _faixasCachePorTabelaPag={};
let _tabelasPrecoCache=[];
let _saldoLojaAtual=0;
let _debitosRegistrados=new Set();
let _crLastTaxa=0;

// Núcleo matemático compartilhado: faixa[retorno] + pd + gorjeta
function _calcValorFaixa(faixas,km,temRetorno,pd,gorjeta){
  const faixa=faixas.find(f=>km<=parseFloat(f.km_ate))||faixas[faixas.length-1];
  if(!faixa)return null;
  const base=parseFloat(temRetorno?faixa.valor_com_retorno:faixa.valor_sem_retorno)||0;
  return Math.round((base+(parseFloat(pd)||0)+(parseFloat(gorjeta)||0))*100)/100;
}
function _calcTaxaMotoboy(p,faixasOverride){
  const faixas=faixasOverride||_faixasPagamento;
  if(!faixas.length)return p.taxa_entrega_motoboy!=null?parseFloat(p.taxa_entrega_motoboy):null;
  const km=parseFloat(p.distancia_km)||1;
  const temRetorno=!!(p.retorno||p.com_retorno);
  const result=_calcValorFaixa(faixas,km,temRetorno,p.preco_dinamico,p.gorjeta);
  if(result===null)return null;
  const tabelaPag=faixasOverride?`custom(loja:${p.loja_id||'?'})`:`padrão`;
  console.log(`[calcTaxaMotoboy] loja_id=${p.loja_id||'?'} tabela_pagamento=${tabelaPag} distancia_km=${km} pd_aplicado=${parseFloat(p.preco_dinamico)||0} gorjeta=${parseFloat(p.gorjeta)||0} total=${result}`);
  return result;
}
function _calcTaxaLoja(p,faixasOverride){
  const faixas=faixasOverride||_faixasCobranca;
  if(!faixas.length)return parseFloat(p.taxa_entrega)||0;
  const km=parseFloat(p.distancia_km)||1;
  const temRetorno=!!(p.retorno||p.com_retorno);
  // gorjeta entra na cobrança da loja: cliente paga junto ao pedido, loja repassa na fatura
  const result=_calcValorFaixa(faixas,km,temRetorno,p.preco_dinamico,p.gorjeta);
  if(result===null)return parseFloat(p.taxa_entrega)||0;
  const tabelaCob=faixasOverride?`custom(loja:${p.loja_id||'?'})`:`padrão`;
  console.log(`[calcTaxaLoja] loja_id=${p.loja_id||'?'} tabela_cobranca=${tabelaCob} distancia_km=${km} pd_aplicado=${parseFloat(p.preco_dinamico)||0} total=${result}`);
  return result;
}
async function _getFaixasCobranca(lojaId){
  if(!lojaId) return _faixasCobranca;
  let loja=allLojas.find(l=>l.id===lojaId);
  if(!loja){
    const _r=await db('lojas','GET',null,`?id=eq.${lojaId}&select=id,tabela_cobranca_id&limit=1`).catch(()=>[]);
    loja=Array.isArray(_r)&&_r[0]?_r[0]:null;
  }
  const tabId=loja?.tabela_cobranca_id||null;
  if(!tabId) return _faixasCobranca;
  if(_faixasCachePorTabela[tabId]) return _faixasCachePorTabela[tabId];
  const res=await db('tabelas_preco_faixas','GET',null,`?tabela_id=eq.${tabId}&order=km_ate.asc`);
  _faixasCachePorTabela[tabId]=Array.isArray(res)?res:[];
  return _faixasCachePorTabela[tabId];
}
async function _getFaixasPagamento(lojaId){
  if(!lojaId) return _faixasPagamento;
  let loja=allLojas.find(l=>l.id===lojaId);
  if(!loja){
    const _r=await db('lojas','GET',null,`?id=eq.${lojaId}&select=id,tabela_pagamento_id&limit=1`).catch(()=>[]);
    loja=Array.isArray(_r)&&_r[0]?_r[0]:null;
  }
  const tabId=loja?.tabela_pagamento_id||null;
  if(!tabId) return _faixasPagamento;
  if(_faixasCachePorTabelaPag[tabId]) return _faixasCachePorTabelaPag[tabId];
  const res=await db('tabelas_preco_faixas','GET',null,`?tabela_id=eq.${tabId}&order=km_ate.asc`);
  _faixasCachePorTabelaPag[tabId]=Array.isArray(res)?res:[];
  return _faixasCachePorTabelaPag[tabId];
}
let _precoDinTimers={};
let _precoDinValores={cliente:0,entregador:0};
let _precoDinTs={cliente:null,entregador:null};
// Chaves reais na tabela configuracoes:
//   cliente   → preco_dinamico / preco_dinamico_ativado_em
//   entregador → preco_dinamico_entregador / preco_dinamico_entregador_ativado_em
function _pdChave(tipo){return tipo==='cliente'?'preco_dinamico':`preco_dinamico_${tipo}`;}
function _pdChaveTs(tipo){return tipo==='cliente'?'preco_dinamico_ativado_em':`preco_dinamico_${tipo}_ativado_em`;}
let _pdCidades={}; // {cidade: {valor, ativado_em}}
let _pdCidadesEnt={}; // {cidade: {valor, ativado_em}}
let _pdCidadesAplicaveis={}; // {cidade: [loja_id,...]}
let _pdCidadesAplicaveisEnt={}; // {cidade: [motoboy_id,...]}
let _pdCidTimers={}; // keyed by `${tipo}_${cidade}`
function _cidadeSufixo(c){return{'Ribeirão Preto':'RP','São José dos Campos':'SJC','Campinas':'CAMPI'}[c]||'';}

// ── BRASÍLIA TIMEZONE HELPERS ──
// Supabase retorna timestamps sem 'Z'; sem o sufixo o browser trata como horário local,
// causando double-conversão. _parseUtc garante parse correto como UTC.
const _parseUtc=(s)=>{const t=String(s).trim().replace(' ','T');return new Date(/Z|[+-]\d{2}:?\d{2}$/.test(t)?t:t+'Z');};
const toBrasilia=(dataStr)=>{if(!dataStr)return null;return new Date(_parseUtc(dataStr).toLocaleString('en-US',{timeZone:'America/Sao_Paulo'}));};
const formatarHora=(dataStr)=>{if(!dataStr)return'—';return _parseUtc(dataStr).toLocaleTimeString('pt-BR',{timeZone:'America/Sao_Paulo',hour:'2-digit',minute:'2-digit'});};
const formatarDataHora=(dataStr)=>{if(!dataStr)return'—';return _parseUtc(dataStr).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});};
const formatarData=(dataStr)=>{if(!dataStr)return'—';return _parseUtc(dataStr).toLocaleDateString('pt-BR',{timeZone:'America/Sao_Paulo'});};
function formatarDataBR(data){if(!data)return'—';if(typeof data==='string'){const m=data.match(/^(\d{4})-(\d{2})-(\d{2})/);if(m)return`${m[3]}/${m[2]}/${m[1]}`;}const d=data instanceof Date?data:new Date(data);if(isNaN(d))return'—';return d.toLocaleDateString('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',year:'numeric'});}
const _dataHojeBrasilia=()=>new Date().toLocaleDateString('en-CA',{timeZone:'America/Sao_Paulo'});
const _lojaFiltro=()=>currentPerfil==='loja'&&currentUser?.loja_id?`&loja_id=eq.${currentUser.loja_id}`:'';
const _inicioDiaBrasilia=(s)=>new Date(s+'T00:00:00-03:00').toISOString();
const _fimDiaBrasilia=(s)=>new Date(s+'T23:59:59.999-03:00').toISOString();
const _agendadoInputBrasilia=(dataStr)=>{if(!dataStr)return'';return new Date(dataStr).toLocaleString('sv-SE',{timeZone:'America/Sao_Paulo'}).replace(' ','T').slice(0,16);};
const _defaultAgendadoBrasilia=(minutos=30)=>new Date(Date.now()+minutos*60000).toLocaleString('sv-SE',{timeZone:'America/Sao_Paulo'}).replace(' ','T').slice(0,16);


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
      --sb-bg: #f8fafc;
      --sb-card: #ffffff;
      --sb-border: #e2e8f0;
      --sb-text: #0f172a;
      --sb-text2: #475569;
      --sb-text3: #94a3b8;
      --sb-search-bg: #f1f5f9;
    }

    html.dark {
      --bg: #1E1E1E;
      --surface: #2D2D2D;
      --surface2: #2D2D2D;
      --border: #3A3A3A;
      --text: #FFFFFF;
      --text2: #BBBBBB;
      --text3: #888888;
      --accent: #818cf8;
      --accent2: #6366f1;
      --sb-bg: #1E1E1E;
      --sb-card: #2D2D2D;
      --sb-border: #3A3A3A;
      --sb-text: #FFFFFF;
      --sb-text2: #BBBBBB;
      --sb-text3: #888888;
      --sb-search-bg: #2D2D2D;
    }
    @media (prefers-color-scheme: dark) {
      :root:not(.light) {
        --bg: #1E1E1E;
        --surface: #2D2D2D;
        --surface2: #2D2D2D;
        --border: #3A3A3A;
        --text: #FFFFFF;
        --text2: #BBBBBB;
        --text3: #888888;
        --accent: #818cf8;
        --accent2: #6366f1;
        --sb-bg: #1E1E1E;
        --sb-card: #2D2D2D;
        --sb-border: #3A3A3A;
        --sb-text: #FFFFFF;
        --sb-text2: #BBBBBB;
        --sb-text3: #888888;
        --sb-search-bg: #2D2D2D;
      }
    }
    /* ── DARK MODE OVERRIDES ── */
    html.dark .topbar { background: #1E1E1E !important; border-color: #3A3A3A !important; }
    html.dark .sidebar-pedidos { background: #1E1E1E !important; border-color: #3A3A3A !important; }
    html.dark .sidebar-header { background: #1E1E1E !important; border-color: #3A3A3A !important; }
    html.dark .pedido-item { background: #2D2D2D !important; border-color: #3A3A3A !important; }
    html.dark .pedido-item:hover { background: #333333 !important; border-color: #6366f1 !important; }
    html.dark .pedido-item.selected { background: #383838 !important; border-color: #6366f1 !important; }
    html.dark .card,
    html.dark .stat-card { background: #2D2D2D !important; border-color: #3A3A3A !important; }
    html.dark .modal { background: #2D2D2D !important; border-color: #3A3A3A !important; }
    html.dark .modal-header { background: #252525 !important; border-color: #3A3A3A !important; }
    html.dark .modal-footer { background: #252525 !important; border-color: #3A3A3A !important; }
    html.dark .modal-close { background: #3A3A3A !important; color: #FFFFFF !important; border-color: #3A3A3A !important; }
    html.dark thead tr { background: #252525 !important; }
    html.dark th { color: #BBBBBB !important; border-color: #3A3A3A !important; }
    html.dark td { color: #BBBBBB !important; border-color: #3A3A3A !important; }
    html.dark tr:hover td { background: #333333 !important; }
    html.dark tbody tr:nth-child(even) td { background: #2D2D2D !important; }
    html.dark input, html.dark select, html.dark textarea { background: #2D2D2D !important; color: #FFFFFF !important; border-color: #3A3A3A !important; }
    html.dark .fi input, html.dark .fi select, html.dark .fi textarea { background: #2D2D2D !important; color: #FFFFFF !important; border-color: #3A3A3A !important; }
    html.dark .btn-sm { background: #3A3A3A !important; color: #FFFFFF !important; border-color: #3A3A3A !important; }
    html.dark .btn-modal-cancel { background: #3A3A3A !important; color: #FFFFFF !important; border-color: #3A3A3A !important; }
    html.dark #nav-sidebar { background: #1E1E1E !important; border-color: #3A3A3A !important; }
    html.dark #app-body { background: #1E1E1E !important; }
    html.dark .alt-page { background: #1E1E1E !important; }
    html.dark ::-webkit-scrollbar-thumb { background: #4A4A4A !important; }
    html.dark ::-webkit-scrollbar-thumb:hover { background: #555555 !important; }
    /* ── DARK MODE OVERRIDES (prefers-color-scheme) ── */
    @media (prefers-color-scheme: dark) {
      :root:not(.light) .topbar { background: #1E1E1E !important; border-color: #3A3A3A !important; }
      :root:not(.light) .sidebar-pedidos { background: #1E1E1E !important; border-color: #3A3A3A !important; }
      :root:not(.light) .sidebar-header { background: #1E1E1E !important; border-color: #3A3A3A !important; }
      :root:not(.light) .pedido-item { background: #2D2D2D !important; border-color: #3A3A3A !important; }
      :root:not(.light) .pedido-item:hover { background: #333333 !important; border-color: #6366f1 !important; }
      :root:not(.light) .pedido-item.selected { background: #383838 !important; border-color: #6366f1 !important; }
      :root:not(.light) .card,
      :root:not(.light) .stat-card { background: #2D2D2D !important; border-color: #3A3A3A !important; }
      :root:not(.light) .modal { background: #2D2D2D !important; border-color: #3A3A3A !important; }
      :root:not(.light) .modal-header { background: #252525 !important; border-color: #3A3A3A !important; }
      :root:not(.light) .modal-footer { background: #252525 !important; border-color: #3A3A3A !important; }
      :root:not(.light) .modal-close { background: #3A3A3A !important; color: #FFFFFF !important; border-color: #3A3A3A !important; }
      :root:not(.light) thead tr { background: #252525 !important; }
      :root:not(.light) th { color: #BBBBBB !important; border-color: #3A3A3A !important; }
      :root:not(.light) td { color: #BBBBBB !important; border-color: #3A3A3A !important; }
      :root:not(.light) tr:hover td { background: #333333 !important; }
      :root:not(.light) tbody tr:nth-child(even) td { background: #2D2D2D !important; }
      :root:not(.light) input, :root:not(.light) select, :root:not(.light) textarea { background: #2D2D2D !important; color: #FFFFFF !important; border-color: #3A3A3A !important; }
      :root:not(.light) .btn-sm { background: #3A3A3A !important; color: #FFFFFF !important; border-color: #3A3A3A !important; }
      :root:not(.light) .btn-modal-cancel { background: #3A3A3A !important; color: #FFFFFF !important; border-color: #3A3A3A !important; }
      :root:not(.light) #nav-sidebar { background: #1E1E1E !important; border-color: #3A3A3A !important; }
      :root:not(.light) #app-body { background: #1E1E1E !important; }
      :root:not(.light) .alt-page { background: #1E1E1E !important; }
      :root:not(.light) ::-webkit-scrollbar-thumb { background: #4A4A4A !important; }
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
    .topbar-logo-text { color: #1A56DB !important; }
    .topbar-logo-sub  { color: #1A56DB !important; }
    .topbar-logo-icon { background: #1A56DB !important; }
    .user-nome        { color: var(--text2) !important; }

    /* ── BOTÃO NOVO PEDIDO ── */
    #btn-novo-pedido, .btn-novo-pedido {
      background: #1A56DB !important;
      border: none !important;
      box-shadow: 0 4px 14px rgba(26,86,219,.35) !important;
      border-radius: 10px !important;
      font-weight: 600 !important;
      color: #fff !important;
    }

    /* ── SALDO TOPBAR ── */
    #topbar-saldo {
      background: rgba(255,255,255,.08) !important;
      border-radius: 10px !important;
      color: #fff !important;
      font-weight: 700 !important;
      padding: 5px 12px !important;
      border: 1px solid rgba(255,255,255,.15) !important;
      text-align: center !important;
      line-height: 1.2 !important;
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
    .b-agendado        { background:#fff7ed !important; color:#f97316 !important; }
    .b-recebido        { background:#fee2e2 !important; color:#EF4444 !important; }
    .b-pronto          { background:#EC4899 !important; color:#ffffff !important; }
    .b-aceito          { background:#fef9c3 !important; color:#F59E0B !important; }
    .b-chegou_local    { background:#e0f2fe !important; color:#0369a1 !important; }
    .b-em_rota         { background:#dbeafe !important; color:#1A56DB !important; }
    .b-chegou_destino  { background:#ede9fe !important; color:#7C3AED !important; }
    .b-retornando      { background:#d1fae5 !important; color:#059669 !important; }
    .b-finalizado      { background:#d1fae5 !important; color:#059669 !important; }
    .b-cancelado       { background:#fee2e2 !important; color:#EF4444 !important; }
    .b-disponivel  { background:#dbeafe !important; color:#2563eb !important; }
    .b-fila        { background:#f1f5f9 !important; color:#64748b !important; }
    .b-aguardando  { background:#fef3c7 !important; color:#d97706 !important; }
    .b-entregue    { background:#f1f5f9 !important; color:#64748b !important; }

    /* ── MAPA STATS ── */
    .mapa-stats {
      background: #ffffff !important;
      border-radius: 12px !important;
      border: 1px solid #E5E7EB !important;
      box-shadow: 0 2px 8px rgba(0,0,0,.06) !important;
      color: #111827 !important;
    }
    .mapa-stat-val { color: #111827 !important; font-weight: 800 !important; }
    .mapa-stat-label { color: #6B7280 !important; font-size: 10px !important; }
    /* Forçar sempre tema claro na barra de stats e botões flutuantes */
    html.dark .mapa-stats { background: #ffffff !important; border-color: #E5E7EB !important; box-shadow: 0 2px 8px rgba(0,0,0,.06) !important; color: #111827 !important; }
    html.dark .mapa-stat-val { color: #111827 !important; }
    html.dark .mapa-stat-label { color: #6B7280 !important; }
    #btn-filtro-motoboys, #btn-filtro-lojas { background: #ffffff !important; color: #1A56DB !important; }
    html.dark #btn-filtro-motoboys, html.dark #btn-filtro-lojas { background: #ffffff !important; color: #1A56DB !important; }
    .leaflet-popup-content-wrapper, html.dark .leaflet-popup-content-wrapper { background: #ffffff !important; color: #111827 !important; box-shadow: 0 4px 16px rgba(0,0,0,.18) !important; border-radius: 10px !important; }
    .leaflet-popup-tip, html.dark .leaflet-popup-tip { background: #ffffff !important; }
    .leaflet-popup-content, html.dark .leaflet-popup-content { color: #111827 !important; margin: 10px 14px !important; }
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
      background: #1E1E1E !important;
    }
    .login-card {
      background: #2D2D2D !important;
      border-radius: 12px !important;
      box-shadow: 0 8px 32px rgba(0,0,0,.4) !important;
      padding: 44px 40px !important;
      width: 100% !important;
      max-width: 400px !important;
      border: 0.5px solid #3A3A3A !important;
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
      box-shadow: 0 4px 14px rgba(26,86,219,.35) !important;
    }
    #login-logo-text {
      font-size: 22px !important;
      font-weight: 800 !important;
      color: #ffffff !important;
      letter-spacing: -0.4px !important;
      font-family: Inter, sans-serif !important;
    }
    #login-logo-sub {
      font-size: 12px !important;
      color: #aaaaaa !important;
      margin-top: 3px !important;
      font-weight: 500 !important;
      font-family: Inter, sans-serif !important;
    }
    .login-card label {
      font-size: 11px !important;
      font-weight: 700 !important;
      color: #aaaaaa !important;
      text-transform: uppercase !important;
      letter-spacing: 0.6px !important;
      display: block !important;
      margin-bottom: 5px !important;
    }
    .login-card input, .login-card select {
      width: 100% !important;
      background: #1E1E1E !important;
      border: 1.5px solid #3A3A3A !important;
      border-radius: 10px !important;
      padding: 11px 14px !important;
      font-size: 14px !important;
      color: #ffffff !important;
      font-family: Inter, sans-serif !important;
      margin-bottom: 14px !important;
      outline: none !important;
      transition: border-color .15s, box-shadow .15s !important;
      box-sizing: border-box !important;
    }
    .login-card input::placeholder { color: #555555 !important; }
    .login-card input:focus, .login-card select:focus {
      border-color: #1A56DB !important;
      box-shadow: 0 0 0 3px rgba(26,86,219,.20) !important;
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
    #login-btn:disabled { background: #1A56DB66 !important; cursor: default !important; }
    #login-forgot {
      display: block !important;
      text-align: center !important;
      margin-top: 18px !important;
      font-size: 13px !important;
      color: #aaaaaa !important;
      text-decoration: none !important;
      cursor: pointer !important;
      font-family: Inter, sans-serif !important;
      background: none !important;
      border: none !important;
      width: 100% !important;
      padding: 0 !important;
    }
    #login-forgot:hover { text-decoration: underline !important; color: #ffffff !important; }
    #login-error {
      background: #ef444420 !important;
      border: 1px solid #ef444455 !important;
      color: #f87171 !important;
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
    .status-dot { width:10px !important; height:10px !important; border-radius:50% !important; flex-shrink:0 !important; display:inline-block !important; }

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
    @keyframes spin { to{transform:rotate(360deg)} }

    /* ── SIDEBAR (tema-aware) ── */
    .sb-dark {
      background: #FFFFFF !important;
      border-right: 1px solid #dee2e6 !important;
      display: flex !important;
      flex-direction: column !important;
      height: 100% !important;
      overflow: hidden !important;
      width: 600px;
      min-width: 600px;
      flex-shrink: 0 !important;
      transition: width 0.3s ease, min-width 0.3s ease;
    }
    .sb-dark.sb-minimized {
      width: 0;
      min-width: 0;
      border: none !important;
    }
    .sb-header-dark {
      padding: 14px 12px 10px !important;
      border-bottom: 1px solid #dee2e6 !important;
      background: #FFFFFF !important;
      flex-shrink: 0 !important;
    }
    .sb-header-top-dark {
      display: flex !important;
      align-items: center !important;
      gap: 8px !important;
      margin-bottom: 10px !important;
    }
    .sb-title-dark {
      font-size: 14px !important;
      font-weight: 700 !important;
      color: #333333 !important;
      flex: 1 !important;
    }
    .sb-badge-dark {
      background: #1A56DB !important;
      color: #fff !important;
      font-size: 11px !important;
      font-weight: 700 !important;
      padding: 2px 9px !important;
      border-radius: 20px !important;
    }
    .sb-search-dark {
      width: 100% !important;
      background: #f8f9fa !important;
      border: 1px solid #dee2e6 !important;
      border-radius: 8px !important;
      padding: 8px 12px !important;
      font-size: 12px !important;
      color: #333333 !important;
      font-family: Inter, sans-serif !important;
      outline: none !important;
      transition: border-color .15s !important;
      box-sizing: border-box !important;
    }
    .sb-search-dark::placeholder { color: #999999 !important; }
    .sb-search-dark:focus { border-color: #1A56DB !important; }
    .sb-group-dark {
      padding: 8px 12px 6px !important;
      display: flex !important;
      align-items: center !important;
      gap: 7px !important;
      background: #1a3a5c !important;
      border-bottom: 1px solid rgba(255,255,255,.12) !important;
      flex-wrap: wrap !important;
      position: sticky !important;
      top: 0 !important;
      z-index: 2 !important;
    }
    .sb-group-name {
      font-size: 11px !important;
      font-weight: 700 !important;
      color: #FFFFFF !important;
      text-transform: uppercase !important;
      letter-spacing: .5px !important;
      flex: 1 !important;
    }
    .sb-status-bubble {
      width: 22px !important;
      height: 22px !important;
      border-radius: 50% !important;
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      font-size: 10px !important;
      font-weight: 700 !important;
      color: #fff !important;
      flex-shrink: 0 !important;
      cursor: default !important;
      position: relative !important;
    }
    .pd-card {
      background: #FFFFFF !important;
      border: 1px solid #dee2e6 !important;
      border-radius: 10px !important;
      margin: 6px 8px !important;
      padding: 10px 10px 4px !important;
      cursor: pointer !important;
      position: relative !important;
      transition: border-color .12s !important;
    }
    .pd-card:hover { border-color: #3b5fc0 !important; }
    .pd-card.selected { border-color: #1A56DB !important; box-shadow: 0 0 0 2px #1A56DB33 !important; }
    .pd-loja-tag {
      font-size: 10px !important;
      color: #60a5fa !important;
      font-weight: 600 !important;
      margin-bottom: 5px !important;
    }
    .pd-top-row {
      display: flex !important;
      align-items: center !important;
      justify-content: space-between !important;
      margin-bottom: 4px !important;
      gap: 4px !important;
    }
    .pd-num {
      font-size: 18px !important;
      font-weight: 800 !important;
      color: #1a3a5c !important;
    }
    .pd-actions { display: flex !important; align-items: center !important; gap: 4px !important; }
    .pd-action-btn {
      background: #f8f9fa !important;
      border: 1px solid #dee2e6 !important;
      border-radius: 6px !important;
      width: 24px !important; height: 24px !important;
      display: flex !important; align-items: center !important; justify-content: center !important;
      cursor: pointer !important; font-size: 11px !important; padding: 0 !important;
      transition: border-color .12s !important;
    }
    .pd-action-btn:hover { border-color: #1A56DB !important; }
    .pd-cliente { font-size: 14px !important; color: #333333 !important; font-weight: 500 !important; margin-bottom: 3px !important; overflow: hidden !important; text-overflow: ellipsis !important; white-space: nowrap !important; }
    .pd-end { font-size: 14px !important; color: #666666 !important; margin-bottom: 5px !important; overflow: hidden !important; text-overflow: ellipsis !important; white-space: nowrap !important; }
    .pd-footer { display: flex !important; align-items: center !important; justify-content: space-between !important; }
    .pd-taxa { font-size: 14px !important; font-weight: 700 !important; color: #10b981 !important; }
    .pd-hora { font-size: 13px !important; color: #888888 !important; }
    .pd-detail { border-top: 1px solid #dee2e6 !important; margin-top: 8px !important; padding-top: 8px !important; }
    .sb-dark .pedidos-lista { flex: 1 !important; overflow-y: auto !important; }
    .sb-dark .empty-lista { color: #888888 !important; }
    /* ── SIDEBAR + CARD DARK MODE ── */
    html.dark .sb-dark { background: #1E1E1E !important; border-right-color: #3A3A3A !important; }
    html.dark .sb-header-dark { background: #1E1E1E !important; border-bottom-color: #3A3A3A !important; }
    html.dark .pd-card { background: #2D2D2D !important; border-color: #3A3A3A !important; }
    html.dark .pd-card:hover { border-color: #6366f1 !important; }
    html.dark .sb-group-dark { background: #1a3a5c !important; }
    @media (prefers-color-scheme: dark) {
      :root:not(.light) .sb-dark { background: #1E1E1E !important; border-right-color: #3A3A3A !important; }
      :root:not(.light) .sb-header-dark { background: #1E1E1E !important; border-bottom-color: #3A3A3A !important; }
      :root:not(.light) .pd-card { background: #2D2D2D !important; border-color: #3A3A3A !important; }
      :root:not(.light) .pd-card:hover { border-color: #6366f1 !important; }
      :root:not(.light) .sb-group-dark { background: #1a3a5c !important; }
    }
    /* ── MOBILE ── */
    @media (max-width: 768px) {
      .mapa-container { height: 250px !important; flex-shrink: 0 !important; }
      #tabela-mapa-section { min-height: auto !important; max-height: 60vh !important; }
      #tabela-mapa-section > div:nth-child(2) { overflow-x: auto !important; -webkit-overflow-scrolling: touch !important; }
      #tabela-mapa-section table td, #tabela-mapa-section table th { font-size: 11px !important; padding: 6px 8px !important; }
      .sb-dark { width: 100% !important; min-width: 0 !important; position: absolute !important; z-index: 100 !important; top: 0 !important; bottom: 0 !important; }
    }
    /* ── DARK MODE GLOBAL OVERRIDES ── */
    html.dark body, html.dark #app, html.dark #app-body { background: #1E1E1E !important; color: #ffffff !important; }
    html.dark .sidebar, html.dark #sidebar, html.dark .sidebar-pedidos, html.dark .sb-dark { background: #2D2D2D !important; }
    html.dark .card, html.dark .stat-card, html.dark .pedido-card, html.dark .pd-card { background: #2D2D2D !important; border-color: #3A3A3A !important; }
    html.dark table { background: #1E1E1E !important; }
    html.dark thead, html.dark thead tr { background: #252525 !important; }
    html.dark tbody tr { background: #1E1E1E !important; }
    html.dark td, html.dark th { background: transparent !important; color: #ffffff !important; border-color: #3A3A3A !important; }
    html.dark tr:nth-child(even) td { background: #252525 !important; }
    html.dark tr:hover td { background: #333333 !important; }
    html.dark input, html.dark select, html.dark textarea { background: #2D2D2D !important; color: #ffffff !important; border-color: #3A3A3A !important; }
    html.dark .modal-content, html.dark .modal { background: #2D2D2D !important; color: #ffffff !important; }
    html.dark .modal-header { background: #252525 !important; }
    html.dark .modal-footer { background: #252525 !important; }
    html.dark .alt-page, html.dark .page-header { background: #1E1E1E !important; }
    html.dark .topbar { background: #1E1E1E !important; border-color: #3A3A3A !important; }
    html.dark #nav-sidebar { background: #1E1E1E !important; border-color: #3A3A3A !important; }
    html.dark .nav-item { color: #BBBBBB !important; }
    html.dark .nav-item:hover { background: #2D2D2D !important; color: #ffffff !important; }
    html.dark .nav-item.active { background: #2D2D2D !important; color: #818cf8 !important; }
    html.dark .btn-sm { background: #2D2D2D !important; color: #ffffff !important; border-color: #3A3A3A !important; }
    html.dark .btn-modal-cancel { background: #2D2D2D !important; color: #ffffff !important; border-color: #3A3A3A !important; }
    html.dark .fi label { color: #888888 !important; }
    html.dark .page-title { color: #818cf8 !important; -webkit-text-fill-color: #818cf8 !important; }
    @media (prefers-color-scheme: dark) {
      :root:not(.light) body, :root:not(.light) #app, :root:not(.light) #app-body { background: #1E1E1E !important; color: #ffffff !important; }
      :root:not(.light) .sidebar, :root:not(.light) #sidebar, :root:not(.light) .sidebar-pedidos, :root:not(.light) .sb-dark { background: #2D2D2D !important; }
      :root:not(.light) .card, :root:not(.light) .stat-card, :root:not(.light) .pedido-card, :root:not(.light) .pd-card { background: #2D2D2D !important; border-color: #3A3A3A !important; }
      :root:not(.light) table { background: #1E1E1E !important; }
      :root:not(.light) thead, :root:not(.light) thead tr { background: #252525 !important; }
      :root:not(.light) td, :root:not(.light) th { background: transparent !important; color: #ffffff !important; border-color: #3A3A3A !important; }
      :root:not(.light) tr:nth-child(even) td { background: #252525 !important; }
      :root:not(.light) tr:hover td { background: #333333 !important; }
      :root:not(.light) input, :root:not(.light) select, :root:not(.light) textarea { background: #2D2D2D !important; color: #ffffff !important; border-color: #3A3A3A !important; }
      :root:not(.light) .modal-content, :root:not(.light) .modal { background: #2D2D2D !important; color: #ffffff !important; }
      :root:not(.light) .topbar { background: #1E1E1E !important; border-color: #3A3A3A !important; }
      :root:not(.light) #nav-sidebar { background: #1E1E1E !important; border-color: #3A3A3A !important; }
      :root:not(.light) .btn-sm { background: #2D2D2D !important; color: #ffffff !important; border-color: #3A3A3A !important; }
      :root:not(.light) .alt-page { background: #1E1E1E !important; }
      /* ── sem dependência de classe: sobrescrevem inline !important ── */
      body { background: #1E1E1E !important; color: #fff !important; }
      #app, #app-body, .alt-page { background: #1E1E1E !important; }
      .card, .stat-card, .pd-card { background: #2D2D2D !important; border-color: #3A3A3A !important; }
      table, thead, tbody { background: #1E1E1E !important; }
      tr { background: transparent !important; }
      td, th { background: transparent !important; color: #ffffff !important; border-color: #3A3A3A !important; }
      input, select, textarea { background: #2D2D2D !important; color: #ffffff !important; border-color: #3A3A3A !important; }
      [class*="modal"] { background: #2D2D2D !important; color: #ffffff !important; }
      .mapa-stats, .mapa-stat { background: #2D2D2D !important; color: #ffffff !important; }
      .mapa-stat-val { color: #ffffff !important; }
      .mapa-stat-label { color: #aaaaaa !important; }
    }
    /* Google Places Autocomplete — corrige texto cortado no dropdown */
    .pac-container {
      min-width: 320px !important;
      max-width: min(560px, 96vw) !important;
      border-radius: 8px !important;
      box-shadow: 0 4px 20px rgba(0,0,0,.25) !important;
      z-index: 10000 !important;
      font-family: Inter, sans-serif !important;
    }
    .pac-item {
      white-space: normal !important;
      height: auto !important;
      min-height: 36px !important;
      padding: 8px 12px !important;
      line-height: 1.4 !important;
      cursor: pointer !important;
      display: flex !important;
      align-items: flex-start !important;
      gap: 6px !important;
    }
    .pac-item-query {
      white-space: normal !important;
      font-size: 13px !important;
    }
    .pac-matched {
      font-weight: 700 !important;
    }
    .pac-secondary-text {
      white-space: normal !important;
      font-size: 11px !important;
    }
  `;
  document.head.appendChild(style);
})();

document.documentElement.classList.add('dark');

async function db(table,method='GET',body=null,filters=''){
  const url=`${SB_URL}/rest/v1/${table}${filters}`;
  const h={'apikey':SB_KEY,'Authorization':`Bearer ${SB_KEY}`,'Content-Type':'application/json'};
  if(method==='POST'||method==='PATCH')h['Prefer']='return=representation';
  try{
    const r=await fetch(url,{method,headers:h,body:body?JSON.stringify(body):null});
    if(!r.ok){
      const errBody=await r.text().catch(()=>'');
      console.error(`[db] ERRO ${r.status} ${r.statusText} | ${method} ${url}`,errBody);
      return[];
    }
    const t=await r.text();
    return t?JSON.parse(t):[];
  }catch(e){
    console.error(`[db] EXCEPTION | ${method} ${url}`,e);
    return[];
  }
}

async function dbPatch(table,body,filter){
  const url=`${SB_URL}/rest/v1/${table}${filter}`;
  const h={'apikey':SB_KEY,'Authorization':`Bearer ${SB_KEY}`,'Content-Type':'application/json','Prefer':'return=representation'};
  try{
    const r=await fetch(url,{method:'PATCH',headers:h,body:JSON.stringify(body)});
    if(!r.ok){const msg=await r.text();console.error(`PATCH ${table} ${r.status}:`,msg);return null;}
    const t=await r.text();return t?JSON.parse(t):[];
  }catch(e){console.error(`PATCH ${table} exception:`,e);return null;}
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

async function _aplicarPrecoDinamico(p){
  const pdC=_getPdCliente(p.loja_id);
  const pdE=_getPdEntregador(p.loja_id);
  if(pdC<=0&&pdE<=0)return;
  const merged={...p,preco_dinamico:pdC};
  const taxa_entrega=_calcTaxaLoja(merged);
  const mergedE={...p,preco_dinamico:pdE};
  const taxa_entrega_motoboy=_calcTaxaMotoboy(mergedE);
  const patch={preco_dinamico:pdC,taxa_entrega,updated_at:new Date().toISOString()};
  if(pdE>0)patch.taxa_entrega_motoboy=taxa_entrega_motoboy;
  await db('pedidos','PATCH',patch,`?id=eq.${p.id}`);
  Object.assign(p,patch);
}

async function processarAutoPronto(){
  const agora=new Date();
  const pedidosRecebidos=allPedidos.filter(p=>(p.status_detalhado==='recebido'||p.status==='recebido')&&!_pedidoStatusLock.has(p.id));
  for(const p of pedidosRecebidos){
    const base=p.recebido_em||p.created_at;if(!base)continue;
    const diff=(agora-new Date(base))/1000;
    if(diff>=60){
      const codigo=String(Math.floor(Math.random()*9000)+1000);
      const res=await db('pedidos','PATCH',{status:'pronto',status_detalhado:'pronto',pronto_em:agora.toISOString(),codigo_confirmacao:codigo,updated_at:agora.toISOString()},`?id=eq.${p.id}`);
      if(res&&(Array.isArray(res)?res.length>0:res.id)){
        _pedidoStatusLock.set(p.id,{status:'pronto',status_detalhado:'pronto',expires:Infinity});
        p.status='pronto';p.status_detalhado='pronto';
        await _aplicarPrecoDinamico(p);
      }
    }
  }
}

async function processarPontosAutomaticos(){
  const agora=Date.now();
  const prontos=allPedidos.filter(p=>(p.status_detalhado==='pronto'||p.status==='pronto')&&p.created_at);
  for(const p of prontos){
    const minutos=(agora-new Date(p.created_at).getTime())/60000;
    let novosPontos=null;
    if(minutos>=40)novosPontos=754;
    else if(minutos>=25)novosPontos=354;
    else if(minutos>=10)novosPontos=54;
    if(novosPontos!==null&&(p.pontos||4)!==novosPontos){
      await db('pedidos','PATCH',{pontos:novosPontos,updated_at:new Date().toISOString()},`?id=eq.${p.id}`);
      const el=document.getElementById(`pontos-${p.id}`);if(el)el.textContent=novosPontos;
      p.pontos=novosPontos;
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
    _npRetornoAtivo=false;
    setTimeout(async()=>{
      const modalBody=document.querySelector('#modal-pedido .modal-body');
      if(!modalBody||document.getElementById('np-loja-id')){
        const _rb=document.getElementById('np-retorno-btn');const _rl=document.getElementById('np-retorno-lbl');
        if(_rb)_rb.style.background='#3a3a3a';if(_rl){_rl.textContent='Sem retorno';_rl.style.color='#888888';}
        return;
      }
      const isAdm=currentPerfil==='adm'||currentPerfil==='suporte';
      const lojas=isAdm?await db('lojas','GET',null,'?ativo=eq.true&order=nome.asc'):[];
      _npLojasData=lojas;
      const lojaNome=!isAdm?(allLojas.find(l=>l.id===currentUser?.loja_id)?.nome||'Minha Loja'):'';
      const blocoLoja=isAdm
        ?`<div class="form-row full" style="margin-bottom:4px"><div class="fi" style="position:relative"><label style="color:#1A56DB;font-weight:700">🏪 Loja</label><input type="text" id="np-loja-busca" placeholder="Digite o nome da loja..." autocomplete="off" oninput="_npLojaFiltrar(this.value)" onfocus="_npLojaFiltrar(this.value)" style="background:var(--surface2);color:var(--text);border:1px solid #1A56DB;border-radius:8px;padding:9px 12px;width:100%;font-family:Inter,sans-serif;font-size:14px;box-sizing:border-box;outline:none"/><input type="hidden" id="np-loja-id"/><div id="np-loja-dropdown" style="display:none;position:absolute;top:100%;left:0;right:0;background:#2D2D2D;border:1px solid #3A3A3A;border-radius:8px;z-index:999;max-height:240px;overflow-y:auto;box-shadow:0 4px 16px rgba(0,0,0,.4);margin-top:2px"></div></div></div>`
        :`<div class="form-row full" style="margin-bottom:4px"><div class="fi"><label style="color:#1A56DB;font-weight:700">🏪 Loja</label><input type="text" value="${lojaNome}" readonly style="background:var(--surface2);color:var(--text2);border:1px solid var(--border);border-radius:8px;padding:9px 12px;width:100%;font-family:Inter,sans-serif;font-size:14px;box-sizing:border-box;cursor:default"/><input type="hidden" id="np-loja-id" value="${currentUser?.loja_id||''}"/></div></div>`;
      modalBody.innerHTML=`
        ${blocoLoja}
        <div class="form-row">
          <div class="fi"><label>Nº Pedido</label><input id="np-numero" placeholder="0001"/></div>
          <div class="fi"><label>Cliente</label><input id="np-cliente" placeholder="Nome do cliente"/></div>
        </div>
        <div class="form-row full"><div class="fi"><label>Telefone</label><input id="np-telefone" placeholder="(16) 99999-9999"/></div></div>
        <div class="form-row full">
          <div class="fi"><label>Endereço de entrega</label><input id="np-endereco" placeholder="Rua, número, bairro" autocomplete="off" oninput="onChangeEnderecoDebounce()" onfocus="iniciarAutocompleteEndereco('np-endereco','np-lat','np-lng','np-endereco-feedback')"/><input type="hidden" id="np-lat"/><input type="hidden" id="np-lng"/></div>
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
        <div id="np-pd-badge" style="font-size:11px;color:#f59e0b;font-weight:700;margin-bottom:4px;min-height:14px;display:none"></div>
        <div id="np-gorjeta-info" style="font-size:11px;color:#f59e0b;margin-bottom:4px;min-height:14px"></div>
        <div class="form-row">
          <div class="fi"><label>Retorno</label><div id="np-retorno-btn" onclick="_npToggleRetorno()" style="display:flex;align-items:center;gap:8px;padding:10px 14px;border-radius:10px;cursor:pointer;background:#3a3a3a;transition:background .15s;user-select:none"><span style="font-size:16px">—</span><span id="np-retorno-lbl" style="font-size:13px;font-weight:600;color:#888888">Sem retorno</span></div></div>
          <div class="fi"></div>
        </div>
        <div class="form-row full"><div class="fi"><label>⭐ Pontos</label><input type="number" id="np-pontos" value="4" min="1" max="20"/></div></div>
        <div class="form-row full"><div class="fi"><label>Observações</label><textarea id="np-descricao" placeholder="Itens do pedido..."></textarea></div></div>
        <div style="border-top:1px solid var(--border);margin:10px 0 8px"></div>
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;cursor:pointer" onclick="document.getElementById('np-coleta-toggle').click()">
          <input type="checkbox" id="np-coleta-toggle" onchange="_toggleColetaExterna()" style="width:16px;height:16px;cursor:pointer;accent-color:#1A56DB"/>
          <span style="font-size:13px;font-weight:600;color:var(--text2)">📦 Coleta em outro endereço</span>
        </div>
        <div id="np-coleta-campos" style="display:none;padding:10px;background:var(--surface2);border-radius:8px;margin-bottom:8px">
          <div class="form-row full">
            <div class="fi"><label>Endereço de coleta</label><input id="np-endereco-coleta" placeholder="Rua, número, bairro" autocomplete="off"/></div>
          </div>
          <div id="np-coleta-feedback" style="font-size:11px;margin:2px 0 4px;min-height:14px"></div>
          <div class="form-row">
            <div class="fi"><label>Contato na coleta</label><input id="np-contato-coleta" placeholder="Nome do contato"/></div>
            <div class="fi"><label>Telefone da coleta</label><input id="np-telefone-coleta" placeholder="(16) 99999-9999"/></div>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;cursor:pointer" onclick="document.getElementById('np-agendar-toggle').click()">
          <input type="checkbox" id="np-agendar-toggle" onchange="_toggleAgendamento()" style="width:16px;height:16px;cursor:pointer;accent-color:#f97316"/>
          <span style="font-size:13px;font-weight:600;color:var(--text2)">⏰ Agendar pedido</span>
        </div>
        <div id="np-agendar-campos" style="display:none;padding:10px;background:var(--surface2);border-radius:8px;margin-bottom:8px">
          <div class="form-row full">
            <div class="fi"><label>Data e hora</label><input type="datetime-local" id="np-agendado-para" style="background:var(--surface);color:var(--text);border:1px solid var(--border);border-radius:8px;padding:9px 12px;width:100%;font-family:Inter,sans-serif;font-size:14px"/></div>
          </div>
        </div>
        <div id="np-feedback" style="margin-top:4px"></div>`;
      // Para perfil loja: seta lat/lng no hidden np-loja-id para calcularTaxaAuto funcionar
      if(!isAdm&&currentUser?.loja_id){
        const lojaLocal=allLojas.find(l=>l.id===currentUser.loja_id);
        const hidEl=document.getElementById('np-loja-id');
        if(hidEl){
          if(lojaLocal?.latitude&&lojaLocal?.longitude){
            hidEl.dataset.lat=lojaLocal.latitude;hidEl.dataset.lng=lojaLocal.longitude;
          } else {
            db('lojas','GET',null,`?id=eq.${currentUser.loja_id}&select=id,latitude,longitude`).then(res=>{
              const el=document.getElementById('np-loja-id');
              if(el&&res?.[0]?.latitude){el.dataset.lat=res[0].latitude;el.dataset.lng=res[0].longitude;}
            });
          }
        }
      }
    },80);
  }
  if(id==='modal-loja'){
    db('tabelas_preco','GET',null,'?order=nome.asc').then(tabs=>{
      const opts='<option value="">Selecione...</option>'+tabs.map(t=>`<option value="${t.id}">${t.nome||t.id}</option>`).join('');
      const sc=document.getElementById('loja-tabela-cobranca');if(sc)sc.innerHTML=opts;
      const sp=document.getElementById('loja-tabela-pagamento');if(sp)sp.innerHTML=opts;
    });
    // limpa lat/lng anteriores e inicia autocomplete
    const latEl=document.getElementById('loja-lat'),lngEl=document.getElementById('loja-lng');
    if(latEl)latEl.value='';if(lngEl)lngEl.value='';
    setTimeout(()=>iniciarAutocompleteEndereco('loja-endereco','loja-lat','loja-lng','loja-endereco-feedback'),100);
  }
}
function fecharModal(id){document.getElementById(id).classList.remove('open');}

function _toggleColetaExterna(){
  const on=document.getElementById('np-coleta-toggle')?.checked;
  const campos=document.getElementById('np-coleta-campos');
  if(campos)campos.style.display=on?'block':'none';
  if(on){
    const inp=document.getElementById('np-endereco-coleta');
    if(inp&&!inp.dataset.autocomplete){inp.dataset.autocomplete='1';iniciarAutocompleteEndereco('np-endereco-coleta','','','np-coleta-feedback');}
  }
}
function _toggleAgendamento(){
  const on=document.getElementById('np-agendar-toggle')?.checked;
  const campos=document.getElementById('np-agendar-campos');
  if(campos)campos.style.display=on?'block':'none';
  if(on){
    const inp=document.getElementById('np-agendado-para');
    if(inp&&!inp.value){
      inp.value=_defaultAgendadoBrasilia(30);
    }
  }
}

// Funções para cálculo automático de taxa
let _taxaTimer=null;
function onChangeEnderecoDebounce(){clearTimeout(_taxaTimer);_taxaTimer=setTimeout(()=>calcularTaxaAuto(),800);}
let _npLojasData=[];
let _crRetornoAtivo=false;
let _crCalcTimer=null;
let _crLastDistKm=null;
async function _crCalcularTaxa(){
  const endereco=(document.getElementById('cr-endereco')?.value||'').trim();
  const spanKm=document.getElementById('cr-dist-km');
  const spanTaxa=document.getElementById('cr-dist-taxa');
  if(!spanKm||!spanTaxa)return;
  if(!endereco||endereco.length<6){spanKm.textContent='';spanTaxa.textContent='';_crLastDistKm=null;return;}
  const selCrEl=document.getElementById('cr-loja-id');
  const lojaId=selCrEl?.value||selCrEl?.options?.[selCrEl?.selectedIndex]?.value||currentUser?.loja_id||null;
  if(!lojaId){spanKm.textContent='';spanTaxa.textContent='';return;}
  const loja=allLojas.find(l=>l.id===lojaId);
  if(!loja?.latitude||!loja?.longitude){spanKm.textContent='';spanTaxa.textContent='';return;}
  spanKm.textContent='📍...';
  const geo=await geocodificarEndereco(endereco).catch(()=>null);
  if(!geo){spanKm.textContent='';spanTaxa.textContent='';return;}
  const distKm=parseFloat(calcularDistancia(loja.latitude,loja.longitude,geo.lat,geo.lng).toFixed(2));
  _crLastDistKm=distKm;
  const faixasCr=await _getFaixasCobranca(lojaId);
  const {cliente:_pdCr}=await _fetchPdAtual(lojaId);
  const taxa=_calcTaxaLoja({distancia_km:distKm,com_retorno:_crRetornoAtivo,taxa_entrega:0,preco_dinamico:_pdCr},faixasCr);
  _crLastTaxa=taxa;
  spanKm.textContent=`${distKm} km`;
  const _gorjetaCr=parseFloat(document.getElementById('cr-gorjeta')?.value)||0;
  spanTaxa.textContent=`R$ ${(taxa+_gorjetaCr).toFixed(2)}`;
  const _faixaCr=faixasCr.find(f=>distKm<=parseFloat(f.km_ate))||faixasCr[faixasCr.length-1];
  console.log(`[_crCalcularTaxa] origem_usada=loja distancia_km=${distKm} faixa_aplicada=km_ate:${_faixaCr?.km_ate||'?'} pd_cliente=${_pdCr} taxa_exibida=${(taxa+_gorjetaCr).toFixed(2)}`);
  const _crBadge=document.getElementById('cr-pd-badge');
  if(_crBadge)_crBadge.style.display='none';
  _atualizarBtnCriarEntrega();
}
function _crCalcularTaxaDebounce(){clearTimeout(_crCalcTimer);_crCalcTimer=setTimeout(_crCalcularTaxa,700);}
async function _criarEntregaRapidaToggle(){
  _crRetornoAtivo=!_crRetornoAtivo;
  const track=document.getElementById('cr-retorno-track');
  const thumb=document.getElementById('cr-retorno-thumb');
  const lbl=document.getElementById('cr-retorno-lbl');
  if(track){track.style.background=_crRetornoAtivo?'#1A56DB':'#3a3a3a';track.style.border=_crRetornoAtivo?'1px solid #1A56DB':'1px solid #555';}
  if(thumb){thumb.style.left=_crRetornoAtivo?'19px':'1px';thumb.style.background=_crRetornoAtivo?'#fff':'#666';}
  if(lbl){lbl.textContent=_crRetornoAtivo?'Com ret':'Sem ret';lbl.style.color=_crRetornoAtivo?'#1A56DB':'#888';}
  if(_crLastDistKm!==null){
    const selCrEl=document.getElementById('cr-loja-id');
    const lojaId=selCrEl?.value||selCrEl?.options?.[selCrEl?.selectedIndex]?.value||currentUser?.loja_id||null;
    const faixas=await _getFaixasCobranca(lojaId);
    const spanTaxa=document.getElementById('cr-dist-taxa');
    const {cliente:_pdCrT}=await _fetchPdAtual(lojaId);
    const taxa=_calcTaxaLoja({distancia_km:_crLastDistKm,com_retorno:_crRetornoAtivo,taxa_entrega:0,preco_dinamico:_pdCrT},faixas);
    _crLastTaxa=taxa;
    const _gorjetaCrT=parseFloat(document.getElementById('cr-gorjeta')?.value)||0;
    if(spanTaxa)spanTaxa.textContent=`R$ ${(taxa+_gorjetaCrT).toFixed(2)}`;
    const _crBadgeT=document.getElementById('cr-pd-badge');
    if(_crBadgeT)_crBadgeT.style.display='none';
    _atualizarBtnCriarEntrega();
  } else {
    _crCalcularTaxa();
  }
}
async function _criarEntregaRapida(){
  const endereco=(document.getElementById('cr-endereco')?.value||'').trim();
  const numero=(document.getElementById('cr-numero')?.value||'').trim();
  const cliente=(document.getElementById('cr-cliente')?.value||'').trim();
  const telefone=(document.getElementById('cr-telefone')?.value||'').trim()||null;
  const complemento=(document.getElementById('cr-complemento')?.value||'').trim();
  const gorjeta=parseFloat(document.getElementById('cr-gorjeta')?.value)||0;
  // Lê value mesmo se o select estiver disabled (perfil loja)
  const selCrEl=document.getElementById('cr-loja-id');
  const lojaId=selCrEl?.value||selCrEl?.options?.[selCrEl?.selectedIndex]?.value||currentUser?.loja_id||null;
  console.log('[CR] loja_id:', lojaId, '| el.value:', selCrEl?.value, '| disabled:', selCrEl?.disabled, '| currentUser.loja_id:', currentUser?.loja_id, '| perfil:', currentPerfil);
  console.log('[CR] endereco:', endereco, '| complemento:', complemento, '| retorno:', _crRetornoAtivo);
  if(!lojaId){showNotif('Erro','Selecione uma loja!','var(--red)');return;}
  if(!endereco){showNotif('Erro','Endereço obrigatório','var(--red)');return;}
  const _lojaGuarda=allLojas.find(l=>l.id===currentUser?.loja_id);
  if(currentPerfil==='loja'&&(_lojaGuarda?.tipo_cobranca||'faturamento')==='credito'&&(_saldoLojaAtual<=0||(_crLastTaxa>0&&_saldoLojaAtual<_crLastTaxa))){showNotif('Saldo insuficiente','Recarregue seu saldo para criar entregas.','#f59e0b');return;}
  const agora=new Date().toISOString();
  const numFinal=numero||String(Math.floor(Math.random()*9000+1000)).padStart(4,'0');
  const endFinal=complemento?`${endereco} - ${complemento}`:endereco;
  const geo=await geocodificarEndereco(endereco).catch(e=>{console.error('[CR] geocodificarEndereco erro:',e);return null;});
  console.log('[CR] geo resultado:', geo);
  if(!geo)console.warn('[CR] geocodificação falhou — pedido será criado sem lat/lng');
  if((!_crLastDistKm)&&geo){
    const _lojaParaDist=allLojas.find(l=>l.id===lojaId);
    if(_lojaParaDist?.latitude&&_lojaParaDist?.longitude){
      _crLastDistKm=parseFloat(calcularDistancia(_lojaParaDist.latitude,_lojaParaDist.longitude,geo.lat,geo.lng).toFixed(2));
      console.log('[CR] distância calculada no momento de criar:', _crLastDistKm, 'km');
    }
  }
  const _distKm=_crLastDistKm||0;
  if(_distKm>32){alert('Para distâncias maiores que 32km, procure o Expansão responsável da região.');return;}
  const [_faixasCr,_faixasPagCr,{cliente:_pdCliente,entregador:_pdEntregador,origemCliente:_pdOrigemCr}]=await Promise.all([_getFaixasCobranca(lojaId),_getFaixasPagamento(lojaId),_fetchPdAtual(lojaId)]);
  const _taxaEntrega=_calcTaxaLoja({distancia_km:_distKm,com_retorno:_crRetornoAtivo,taxa_entrega:0,preco_dinamico:_pdCliente,loja_id:lojaId},_faixasCr);
  const _taxaMotoboy=_calcTaxaMotoboy({distancia_km:_distKm,com_retorno:_crRetornoAtivo,gorjeta:gorjeta,preco_dinamico:_pdEntregador,loja_id:lojaId},_faixasPagCr)||_taxaEntrega||null;
  const _faixaCrSubmit=_faixasCr.find(f=>_distKm<=parseFloat(f.km_ate))||_faixasCr[_faixasCr.length-1];
  console.log(`[_criarEntregaRapida] origem_usada=loja distancia_km=${_distKm} faixa_aplicada=km_ate:${_faixaCrSubmit?.km_ate||'?'} pd_cliente=${_pdCliente}(${_pdOrigemCr}) taxa_entrega=${_taxaEntrega} taxa_motoboy=${_taxaMotoboy}`);
  const pedido={numero:numFinal,numero_loja:numFinal,endereco:endFinal,valor:0,descricao:'',cliente,telefone,gorjeta,status:'recebido',status_detalhado:'recebido',origem:'backend',loja_id:lojaId,latitude:geo?.lat||null,longitude:geo?.lng||null,taxa_entrega:_taxaEntrega,taxa_motoboy:_taxaMotoboy,pontos:4,distancia_km:_distKm,com_retorno:_crRetornoAtivo,preco_dinamico:_pdCliente,preco_dinamico_origem:_pdOrigemCr||null,recebido_em:agora,codigo_confirmacao:null};
  console.log('[CR] pedido a criar:', pedido);
  let result=null;
  try{result=await db('pedidos','POST',pedido);}catch(e){console.error('[CR] db() lançou exceção:',e);showNotif('Erro','Falha ao criar entrega','var(--red)');return;}
  console.log('[CR] resultado POST:', result);
  if(result&&result.length>0){
    showNotif('✅ Entrega criada!',`#${numFinal}`);
    if(currentPerfil==='loja'&&lojaId){
      const _agora=new Date().toISOString();
      await db('creditos_lojas','POST',{loja_id:lojaId,tipo:'debito',valor:_taxaEntrega,observacoes:`Entrega #${numFinal}`,data:_dataHojeBrasilia(),created_at:_agora,updated_at:_agora});
      _carregarSaldoTopbar();
    }
    if(selCrEl&&!selCrEl.disabled)selCrEl.selectedIndex=0;
    document.getElementById('cr-numero').value='';
    document.getElementById('cr-cliente').value='';
    document.getElementById('cr-telefone').value='';
    document.getElementById('cr-endereco').value='';
    document.getElementById('cr-complemento').value='';
    document.getElementById('cr-gorjeta').value='';
    _crRetornoAtivo=false;_crLastDistKm=null;_crLastTaxa=0;
    const btn=document.getElementById('cr-retorno-btn');const lbl=document.getElementById('cr-retorno-lbl');
    if(btn)btn.style.background='#3a3a3a';if(lbl){lbl.textContent='Sem ret';lbl.style.color='#888';}
    atualizarTudo();
  }else{
    console.error('[CR] falha ao criar entrega — result:', result, '| pedido:', pedido);
    showNotif('Erro','Falha ao criar entrega','var(--red)');
  }
}
function onChangeLoja(){calcularTaxaAuto();}
function _npLojaFiltrar(val){
  const dd=document.getElementById('np-loja-dropdown');if(!dd)return;
  const q=(val||'').trim().toLowerCase();
  if(!q){dd.style.display='none';return;}
  const hits=_npLojasData.filter(l=>(l.nome||'').toLowerCase().includes(q)).slice(0,8);
  if(!hits.length){dd.style.display='none';return;}
  dd.innerHTML=hits.map(l=>`<div onclick="_npSelecionarLoja('${l.id}','${(l.nome||'').replace(/'/g,'&#39;')}',${l.latitude||0},${l.longitude||0})" style="padding:8px 12px;cursor:pointer;color:#DDD;font-size:13px;font-family:Inter,sans-serif" onmouseover="this.style.background='#3A3A3A'" onmouseout="this.style.background='none'">${l.nome}</div>`).join('');
  dd.style.display='block';
}
function _npSelecionarLoja(id,nome,lat,lng){
  const inp=document.getElementById('np-loja-busca');
  const hid=document.getElementById('np-loja-id');
  const dd=document.getElementById('np-loja-dropdown');
  if(inp)inp.value=nome;
  if(hid){hid.value=id;hid.dataset.lat=lat;hid.dataset.lng=lng;}
  if(dd)dd.style.display='none';
  onChangeLoja();
}
function onChangeGorjeta(){
  const g=parseFloat(document.getElementById('np-gorjeta')?.value)||0;
  const info=document.getElementById('np-gorjeta-info');
  if(info)info.textContent=g>0?`🎁 +R$ ${g.toFixed(2)} somado ao pagamento do motoboy`:'';
}

async function calcularTaxaAuto(){
  const lojaHid=document.getElementById('np-loja-id');
  const endereco=document.getElementById('np-endereco')?.value?.trim();
  const fb=document.getElementById('np-endereco-feedback');
  if(!endereco||endereco.length<6)return;
  if(!/\d/.test(endereco)){if(fb)fb.innerHTML='<span style="color:var(--text3)">Digite o endereço com número (ex: Rua das Flores, 123)</span>';return;}
  if(!lojaHid?.value){if(fb)fb.innerHTML='<span style="color:var(--red)">❌ Selecione uma loja primeiro</span>';return;}
  const lojaLat=parseFloat(lojaHid.dataset.lat),lojaLng=parseFloat(lojaHid.dataset.lng);
  if(!lojaLat||!lojaLng){if(fb)fb.innerHTML='<span style="color:#f59e0b">⚠️ Loja sem coordenadas GPS</span>';return;}
  if(fb)fb.innerHTML='<span style="color:var(--text2)">📍 Calculando distância...</span>';
  // Geocodifica endereço de entrega (usa autocomplete se já preenchido)
  let geo=null;
  const _lat=parseFloat(document.getElementById('np-lat')?.value);
  const _lng=parseFloat(document.getElementById('np-lng')?.value);
  if(_lat&&_lng){geo={lat:_lat,lng:_lng};}
  else{geo=await geocodificarEndereco(endereco);}
  if(!geo){if(fb)fb.innerHTML='';document.getElementById('np-km').value='—';return;}
  // Determina origem: ponto de coleta ou loja
  let latOrigem=lojaLat,lngOrigem=lojaLng,origemUsada='loja';
  const coletaOn=document.getElementById('np-coleta-toggle')?.checked;
  const endColetaVal=(document.getElementById('np-endereco-coleta')?.value||'').trim();
  if(coletaOn&&endColetaVal.length>5){
    const geoColeta=await geocodificarEndereco(endColetaVal).catch(()=>null);
    if(geoColeta){latOrigem=geoColeta.lat;lngOrigem=geoColeta.lng;origemUsada='ponto_coleta';}
  }
  const distKm=parseFloat(calcularDistancia(latOrigem,lngOrigem,geo.lat,geo.lng).toFixed(2));
  document.getElementById('np-km').value=distKm.toFixed(2)+' km';
  const faixasLoja=await _getFaixasCobranca(lojaHid.value);
  if(!faixasLoja.length){if(fb)fb.innerHTML=`<span style="color:#22c55e">✅ ${distKm.toFixed(2)} km (${origemUsada})</span>`;return;}
  const {cliente:_pdNp,entregador:_pdNpE}=await _fetchPdAtual(lojaHid.value);
  _npPdC=_pdNp;
  _npPdE=_pdNpE;
  const valorTaxa=_calcTaxaLoja({distancia_km:distKm,com_retorno:_npRetornoAtivo,preco_dinamico:_pdNp},faixasLoja);
  const _faixaAplicada=faixasLoja.find(f=>distKm<=parseFloat(f.km_ate))||faixasLoja[faixasLoja.length-1];
  console.log(`[calcularTaxaAuto] origem_usada=${origemUsada} distancia_km=${distKm} faixa_aplicada=km_ate:${_faixaAplicada?.km_ate||'?'} pd_cliente=${_pdNp} taxa_exibida=${valorTaxa.toFixed(2)}`);
  document.getElementById('np-taxa').value=valorTaxa.toFixed(2);
  const _npBadge=document.getElementById('np-pd-badge');
  if(_npBadge)_npBadge.style.display='none';
  const _gorjetaDisplay=parseFloat(document.getElementById('np-gorjeta')?.value)||0;
  const _totalDisplay=valorTaxa+_gorjetaDisplay;
  if(fb)fb.innerHTML=`<span style="color:#22c55e">✅ ${distKm.toFixed(2)} km (${origemUsada}) → Taxa: R$ ${_totalDisplay.toFixed(2)}</span>`;
}

const TODOS_STATUS=[
  {key:'agendado',       label:'Agendado',          cor:'#ef4444'},
  {key:'recebido',       label:'Recebido',           cor:'#ef4444'},
  {key:'pronto',         label:'Pronto',             cor:'#e91e8c'},
  {key:'aceito',         label:'Aceito',             cor:'#eab308'},
  {key:'chegou_no_local',label:'Chegou no local',    cor:'#06b6d4'},
  {key:'em_rota',        label:'Em rota',            cor:'#1A56DB'},
  {key:'chegou_destino', label:'Chegou no destino',  cor:'#7c3aed'},
  {key:'retornando',     label:'Retornando',         cor:'#16a34a'},
  {key:'finalizado',     label:'Finalizado',         cor:'#16a34a'},
  {key:'cancelado',      label:'Cancelado',          cor:'#ef4444'},
];
let _dropdownAberto=null;
function _criarDropdown(pedidoId,itens){
  if(_dropdownAberto){_dropdownAberto.remove();_dropdownAberto=null;}
  const dd=document.createElement('div');
  dd.id='status-dropdown-atual';
  dd.style.cssText='position:fixed;z-index:99999;background:#2D2D2D;border:1px solid #3A3A3A;border-radius:8px;box-shadow:0 4px 20px rgba(0,0,0,.5);min-width:180px;overflow:hidden';
  dd.innerHTML=itens;
  document.body.appendChild(dd);
  _dropdownAberto=dd;
  setTimeout(()=>document.addEventListener('click',()=>{dd.remove();_dropdownAberto=null;},{once:true}),10);
  return dd;
}
function _posicionarDropdown(dd,anchorEl){
  const rect=anchorEl.getBoundingClientRect();
  let top=rect.bottom+4,left=rect.left;
  const ddH=dd.offsetHeight||220;
  if(top+ddH>window.innerHeight)top=Math.max(4,rect.top-ddH-4);
  if(left+180>window.innerWidth)left=Math.max(4,window.innerWidth-184);
  dd.style.top=top+'px';dd.style.left=left+'px';
}
function abrirDropdownStatus(event,pedidoId){
  event.stopPropagation();
  const wrapper=document.getElementById('badge-wrapper-'+pedidoId);if(!wrapper)return;
  const statusVisiveis=currentPerfil==='loja'?TODOS_STATUS.filter(s=>s.key!=='cancelado'):TODOS_STATUS;
  const itens=statusVisiveis.map(s=>`<button onclick="event.stopPropagation();alterarStatusPedido('${pedidoId}','${s.key}');_dropdownAberto&&_dropdownAberto.remove();_dropdownAberto=null" style="display:flex;align-items:center;gap:8px;width:100%;padding:9px 14px;background:none;border:none;cursor:pointer;font-family:Inter,sans-serif;font-size:13px;color:#DDD;text-align:left"><span style="width:10px;height:10px;border-radius:50%;background:${s.cor};flex-shrink:0;display:inline-block"></span>${s.label}</button>`).join('');
  const dd=_criarDropdown(pedidoId,itens);
  _posicionarDropdown(dd,wrapper);
}
function fecharDropdownStatus(){if(_dropdownAberto){_dropdownAberto.remove();_dropdownAberto=null;}}
function abrirDropdownStatusTabela(event,pedidoId){
  event.stopPropagation();
  const anchor=event.currentTarget;
  const statusVisiveis=currentPerfil==='loja'?TODOS_STATUS.filter(s=>s.key!=='cancelado'):TODOS_STATUS;
  const itens=statusVisiveis.map(s=>`<button onclick="event.stopPropagation();alterarStatusPedidoTabela('${pedidoId}','${s.key}');_dropdownAberto&&_dropdownAberto.remove();_dropdownAberto=null" style="display:flex;align-items:center;gap:8px;width:100%;padding:9px 14px;background:none;border:none;cursor:pointer;font-family:Inter,sans-serif;font-size:13px;color:#DDD;text-align:left"><span style="width:10px;height:10px;border-radius:50%;background:${s.cor};flex-shrink:0;display:inline-block"></span>${s.label}</button>`).join('');
  const dd=_criarDropdown(pedidoId,itens);
  _posicionarDropdown(dd,anchor);
}

async function alterarStatusPedidoTabela(pedidoId,novoStatus){
  fecharDropdownStatus();
  const agora=new Date().toISOString();
  const update={status:novoStatus,status_detalhado:novoStatus,updated_at:agora};
  if(novoStatus==='pronto'){update.pronto_em=agora;idsProntoNotificados.delete(pedidoId);tocarSomPronto();_notificarPedidoPronto();showNotif('🔔 Pedido Pronto!','Motoboys serão notificados','var(--pink)');}
  if(novoStatus==='aceito')update.aceito_em=agora;
  if(novoStatus==='em_rota'){update.em_rota_em=agora;_dispararWhatsappEmRota(pedidoId);}
  if(novoStatus==='retornando')update.retornando_em=agora;
  if(novoStatus==='finalizado')update.finalizado_em=agora;
  if(novoStatus==='recebido')update.recebido_em=agora;
  if(novoStatus==='cancelado'){showNotif('❌ Pedido cancelado','','var(--red)');if(currentPerfil==='loja'){const _pCan=allPedidos.find(x=>x.id===pedidoId)||_tabelaPedidosDia.find(x=>x.id===pedidoId);if(_pCan)_estornarDebitoEntrega(_pCan);}}
  await db('pedidos','PATCH',update,`?id=eq.${pedidoId}`);
  _pedidoStatusLock.set(pedidoId,{status:novoStatus,status_detalhado:novoStatus,expires:Infinity});
  const ti=_tabelaPedidosDia.findIndex(p=>p.id===pedidoId);
  if(ti>=0)Object.assign(_tabelaPedidosDia[ti],update);
  const ai=allPedidos.findIndex(p=>p.id===pedidoId);
  if(ai>=0)Object.assign(allPedidos[ai],update);
  renderTabelaMapa();
  renderPedidosLista();
}

async function alterarStatusPedido(pedidoId,novoStatus){
  fecharDropdownStatus();
  const agora=new Date().toISOString();
  const update={status:novoStatus,status_detalhado:novoStatus,updated_at:agora};
  if(novoStatus==='pronto')update.pronto_em=agora;if(novoStatus==='aceito')update.aceito_em=agora;
  if(novoStatus==='em_rota'){update.em_rota_em=agora;_dispararWhatsappEmRota(pedidoId);}
  if(novoStatus==='retornando')update.retornando_em=agora;
  if(novoStatus==='finalizado')update.finalizado_em=agora;if(novoStatus==='recebido')update.recebido_em=agora;
  if(novoStatus==='pronto'){idsProntoNotificados.delete(pedidoId);tocarSomPronto();_notificarPedidoPronto();showNotif('🔔 Pedido Pronto!','Motoboys serão notificados','var(--pink)');}
  if(novoStatus==='cancelado'){showNotif('❌ Pedido cancelado','','var(--red)');if(currentPerfil==='loja'){const _pCan=allPedidos.find(x=>x.id===pedidoId);if(_pCan)_estornarDebitoEntrega(_pCan);}}
  await db('pedidos','PATCH',update,`?id=eq.${pedidoId}`);
  // Trava o status local por 5s para o Realtime não sobrescrever
  _pedidoStatusLock.set(pedidoId,{status:novoStatus,status_detalhado:novoStatus,expires:Infinity});
  const _pl=allPedidos.find(x=>x.id===pedidoId);
  if(_pl)Object.assign(_pl,update);
  await logAcao('alterar_status_manual',{pedido_id:pedidoId,novo_status:novoStatus});
  await atualizarTudo();
}

async function _estornarDebitoEntrega(pedido){
  if(!pedido?.loja_id||!pedido?.numero)return;
  const existing=await db('creditos_lojas','GET',null,`?loja_id=eq.${pedido.loja_id}&tipo=eq.debito&observacoes=ilike.*%23${pedido.numero}&limit=1`);
  if(!existing||!existing.length)return;
  const agora=new Date().toISOString();
  await db('creditos_lojas','POST',{loja_id:pedido.loja_id,tipo:'credito',valor:parseFloat(pedido.taxa_entrega)||0,observacoes:`Estorno #${pedido.numero}`,data:_dataHojeBrasilia(),created_at:agora,updated_at:agora});
  _carregarSaldoTopbar();
}
function _notificarPedidoPronto(){
  fetch(`${SB_URL}/functions/v1/notify-novo-pedido`,{method:'POST',headers:{'Content-Type':'application/json','x-webhook-secret':'letsgo2026secret'},body:JSON.stringify({tipo:'novo_pedido'})}).catch(e=>console.warn('[FCM] falha ao notificar:',e));
}

async function marcarPedidoPronto(pedidoId, statusAtual){
  if(statusAtual==='pronto')return;
  const btn=document.getElementById('btn-pronto-'+pedidoId);
  if(btn){btn.style.background='#94a3b8';btn.style.cursor='default';btn.onclick=null;}
  const agora=new Date().toISOString();
  await db('pedidos','PATCH',{status:'pronto',status_detalhado:'pronto',pronto_em:agora,updated_at:agora},`?id=eq.${pedidoId}`);
  // Trava o status local por 5s para o Realtime não sobrescrever
  _pedidoStatusLock.set(pedidoId,{status:'pronto',status_detalhado:'pronto',expires:Infinity});
  const _p=allPedidos.find(x=>x.id===pedidoId);
  if(_p){_p.status='pronto';_p.status_detalhado='pronto';_p.pronto_em=agora;_p.updated_at=agora;}
  if(_p)await _aplicarPrecoDinamico(_p);
  idsProntoNotificados.delete(pedidoId);
  tocarSomPronto();
  _notificarPedidoPronto();
  showNotif('🔔 Pedido Pronto!','Motoboys serão notificados','var(--pink)');
  await atualizarTudo();
}

async function _carregarSaldoTopbar(){
  try{
    const el=document.getElementById('topbar-saldo'),val=document.getElementById('saldo-valor');
    if(!el||!val)return;
    if(currentPerfil==='loja'&&currentUser?.loja_id){
      let lojaAtualSaldo=allLojas.find(l=>l.id===currentUser?.loja_id);
      if(!lojaAtualSaldo){const _lr=await db('lojas','GET',null,`?id=eq.${currentUser.loja_id}&select=id,tipo_cobranca`).catch(()=>[]);lojaAtualSaldo=Array.isArray(_lr)&&_lr[0]?_lr[0]:null;}
      const _tipoCobrancaSaldo=lojaAtualSaldo?.tipo_cobranca||'faturamento';
      if(_tipoCobrancaSaldo!=='credito'){
        el.style.display='none';_saldoLojaAtual=0;
        const _ab=document.getElementById('saldo-alerta-banner');if(_ab)_ab.style.display='none';
        _atualizarBtnCriarEntrega();return;
      }
      const rows=await db('creditos_lojas','GET',null,`?loja_id=eq.${currentUser.loja_id}`);
      const arr=Array.isArray(rows)?rows:[];
      const totC=arr.filter(r=>r.tipo==='credito').reduce((s,r)=>s+(parseFloat(r.valor)||0),0);
      const totD=arr.filter(r=>r.tipo==='debito').reduce((s,r)=>s+(parseFloat(r.valor)||0),0);
      const saldo=totC-totD;
      _saldoLojaAtual=saldo;
      val.textContent=Math.abs(saldo).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
      val.style.color=saldo>=0?'#4ade80':'#f87171';
      el.style.display='flex';
      let alertBanner=document.getElementById('saldo-alerta-banner');
      if(saldo<100){
        if(!alertBanner){alertBanner=document.createElement('div');alertBanner.id='saldo-alerta-banner';alertBanner.style.cssText='background:#fef3c7;color:#92400e;padding:8px 16px;text-align:center;font-size:13px;font-weight:700;font-family:Inter,sans-serif;border-bottom:2px solid #fcd34d;flex-shrink:0;';const appEl=document.getElementById('app'),bodyEl=document.getElementById('app-body');if(appEl&&bodyEl)appEl.insertBefore(alertBanner,bodyEl);}
        alertBanner.textContent='⚠️ Saldo baixo! Recarregue seu saldo para continuar criando entregas.';
        alertBanner.style.display='block';
      }else if(alertBanner){alertBanner.style.display='none';}
      _atualizarBtnCriarEntrega();
    } else if(currentPerfil==='adm'||currentPerfil==='admin'){
      val.textContent='0,00';
      el.style.display='flex';
    } else {
      el.style.display='none';
    }
  }catch(_){}
}
function _abrirCriarEntregaTopbar(){
  if(_navAtivo==='mapa'){
    const el=document.getElementById('cr-endereco');
    if(el){el.focus();el.scrollIntoView({behavior:'smooth',block:'nearest'});}
  }else{
    goTab('mapa');
    setTimeout(()=>{const el=document.getElementById('cr-endereco');if(el){el.focus();el.scrollIntoView({behavior:'smooth',block:'nearest'});}},600);
  }
}
function _atualizarBtnCriarEntrega(){
  if(currentPerfil!=='loja')return;
  const btn=document.getElementById('btn-criar-entrega');
  if(!btn)return;
  const _lojaBtn=allLojas.find(l=>l.id===currentUser?.loja_id);
  const _tipoBtn=_lojaBtn?.tipo_cobranca||'faturamento';
  const insuficiente=_tipoBtn==='credito'&&(_saldoLojaAtual<=0||(_crLastTaxa>0&&_saldoLojaAtual<_crLastTaxa));
  btn.disabled=insuficiente;
  btn.style.setProperty('background',insuficiente?'#6b7280':'#1A56DB','important');
  btn.style.cursor=insuficiente?'not-allowed':'pointer';
  btn.innerHTML=insuficiente?'🚫 Saldo insuficiente':'➕ Criar Entrega';
}

async function confirmarPagamento(pedidoId){
  const _p=allPedidos.find(x=>x.id===pedidoId);
  const patch={pagamento_confirmado:true,pagamento_confirmado_em:new Date().toISOString(),status:'finalizado',status_detalhado:'finalizado',finalizado_em:new Date().toISOString(),updated_at:new Date().toISOString()};
  if(_p&&(_p.motoboy_id||_p.entregador_id)&&_p.taxa_entrega_motoboy==null)patch.taxa_entrega_motoboy=_calcTaxaMotoboy(_p)??parseFloat(_p.taxa_entrega||0);
  await db('pedidos','PATCH',patch,`?id=eq.${pedidoId}`);
  if(_p?.loja_id&&!_debitosRegistrados.has(pedidoId)){
    const agora=new Date().toISOString();
    await db('creditos_lojas','POST',{loja_id:_p.loja_id,tipo:'debito',valor:parseFloat(_p.taxa_entrega)||0,observacoes:`Entrega #${_p.numero}`,data:_dataHojeBrasilia(),created_at:agora,updated_at:agora});
    _debitosRegistrados.add(pedidoId);
  }
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

const STATUS_LABEL={recebido:'Recebido',pronto:'Pronto',aceito:'Aceito',chegou_local:'Chegou no local',em_rota:'Em rota',chegou_destino:'Chegou no destino',retornando:'Retornando',finalizado:'Finalizado',cancelado:'Cancelado',disponivel:'Disponível',aguardando:'Aguardando',entregue:'Entregue',fila:'Na fila',agendado:'Agendado'};
const STATUS_CORES={recebido:'#ef4444',pronto:'#e91e8c',aceito:'#eab308',chegou_local:'#06b6d4',chegou_no_local:'#06b6d4',em_rota:'#1A56DB',chegou_destino:'#7c3aed',retornando:'#16a34a',finalizado:'#16a34a',cancelado:'#ef4444',disponivel:'#6b7280',aguardando:'#eab308',entregue:'#16a34a',fila:'#6b7280',agendado:'#ef4444'};
function getStatusKey(p){return p.status_detalhado||p.status||'disponivel';}
function getStatusLabel(p){const k=getStatusKey(p);return STATUS_LABEL[k]||k;}
function getStatusCor(p){return corStatus(getStatusKey(p));}

function abrirInfoPedido(pedidoId){
  const p=allPedidos.find(x=>x.id===pedidoId)||_tabelaPedidosDia.find(x=>x.id===pedidoId);
  if(!p)return;
  const motoboy=allMotoboys.find(e=>e.id===(p.motoboy_id||p.entregador_id));
  const sk=p.status_detalhado||p.status||'';
  const cor=corStatus(sk);
  const previsaoMs=_tsUtc(p.created_at)+30*60*1000;
  const restanteMs=previsaoMs-Date.now();
  const restanteTxt=restanteMs>0?`${Math.floor(restanteMs/60000)}min restantes`:'Atrasado';
  const txMoto=p.taxa_motoboy!=null?parseFloat(p.taxa_motoboy):_calcTaxaMotoboy(p);
  const stepsDone=(s)=>['aceito','chegou_local','em_rota','chegou_destino','retornando','finalizado'].includes(s);
  const stepsA=(s)=>['em_rota','chegou_destino','retornando','finalizado'].includes(s);
  const stepsF=(s)=>['finalizado'].includes(s);
  const step=(done,label)=>`<div style="display:flex;flex-direction:column;align-items:center;gap:4px;flex:1">
    <div style="width:28px;height:28px;border-radius:50%;background:${done?'#10b981':'var(--surface2)'};border:2px solid ${done?'#10b981':'var(--border)'};display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;color:${done?'#fff':'var(--text3)'}">
      ${done?'✓':'○'}
    </div>
    <span style="font-size:10px;color:${done?'#10b981':'var(--text3)'};font-weight:${done?700:400};white-space:nowrap">${label}</span>
  </div>`;
  const stepLine=(done)=>`<div style="flex:1;height:2px;background:${done?'#10b981':'var(--border)'};margin-top:13px;max-width:40px"></div>`;
  const itens=Array.isArray(p.itens)?p.itens:[];
  const linkRastreio=`${window.location.origin}${window.location.pathname}?rastrear=${p.id}`;
  let modal=document.getElementById('modal-info-pedido');
  if(!modal){modal=document.createElement('div');modal.id='modal-info-pedido';modal.className='modal-overlay';document.body.appendChild(modal);}
  modal.innerHTML=`<div class="modal" style="max-width:520px;width:95%">
    <div class="modal-header" style="display:flex;align-items:center;justify-content:space-between">
      <div style="display:flex;align-items:center;gap:10px">
        <span class="modal-title">#${p.numero||pedidoId.substring(0,6)}</span>
        <span class="p-badge b-${sk}" style="background:${cor}20;color:${cor}">${STATUS_LABEL[sk]||sk}</span>
      </div>
      <button class="modal-close" onclick="document.getElementById('modal-info-pedido').classList.remove('open')">✕</button>
    </div>
    <div class="modal-body" style="max-height:80vh;overflow-y:auto;padding:16px">
      <div style="display:flex;justify-content:space-between;align-items:center;background:var(--surface2);border-radius:10px;padding:10px 14px;margin-bottom:16px">
        <div><div style="font-size:11px;color:var(--text3);font-weight:600">PREVISÃO DE ENTREGA</div><div style="font-size:14px;font-weight:700;color:var(--text)">${formatarHora(new Date(previsaoMs).toISOString())}</div></div>
        <div style="font-size:12px;font-weight:700;color:${restanteMs>0?'#10b981':'#ef4444'}">${restanteTxt}</div>
      </div>
      <div style="display:flex;align-items:flex-start;justify-content:center;margin-bottom:20px;gap:0">
        ${step(true,'Em Preparo')}${stepLine(stepsDone(sk))}${step(stepsDone(sk),'Coletado')}${stepLine(stepsA(sk))}${step(stepsA(sk),'A caminho')}${stepLine(stepsF(sk))}${step(stepsF(sk),'Entregue')}
      </div>
      ${itens.length?`<div style="margin-bottom:16px"><div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">📦 Itens do Pedido</div>
        <div style="background:var(--surface2);border-radius:8px;overflow:hidden">
          ${itens.map(it=>`<div style="display:flex;justify-content:space-between;padding:8px 12px;border-bottom:1px solid var(--border)"><span style="color:var(--text)">${it.quantidade||1}x ${it.nome||it.name||'—'}</span><span style="color:#10b981;font-weight:700">R$ ${(parseFloat(it.preco||it.price||0)*((it.quantidade||1))).toFixed(2)}</span></div>`).join('')}
          ${p.total_pedido?`<div style="display:flex;justify-content:space-between;padding:8px 12px;font-weight:700"><span style="color:var(--text)">Total</span><span style="color:#10b981">R$ ${parseFloat(p.total_pedido).toFixed(2)}</span></div>`:''}
        </div>
      </div>`:''}
      ${p.forma_pagamento?`<div style="margin-bottom:12px;font-size:13px;color:var(--text2)">💳 <strong>Pagamento:</strong> ${p.forma_pagamento}</div>`:''}
      <div style="margin-bottom:16px"><div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">👤 Cliente</div>
        <div style="background:var(--surface2);border-radius:8px;padding:12px;display:flex;flex-direction:column;gap:6px">
          ${p.nome_cliente||p.cliente?`<div style="font-size:14px;font-weight:600;color:var(--text)">${p.nome_cliente||p.cliente}</div>`:''}
          ${p.telefone?`<div style="font-size:13px;color:var(--text2)">📞 <a href="https://wa.me/55${p.telefone.replace(/\D/g,'')}" target="_blank" style="color:#25D366;font-weight:600">${p.telefone}</a></div>`:''}
          ${p.endereco||p.endereco_entrega?`<div style="font-size:13px;color:var(--text2)">📍 ${p.endereco_entrega||p.endereco}</div>`:''}
          ${p.observacoes?`<div style="font-size:12px;color:var(--text3);background:var(--surface);border-radius:6px;padding:6px 8px">💬 ${p.observacoes}</div>`:''}
        </div>
      </div>
      ${motoboy?`<div style="margin-bottom:16px"><div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">🛵 Entregador</div>
        <div style="background:var(--surface2);border-radius:8px;padding:12px;display:flex;align-items:center;gap:12px">
          <div style="width:48px;height:48px;border-radius:50%;background:linear-gradient(135deg,#1A56DB,#6366f1);display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0">${motoboy.foto?`<img src="${motoboy.foto}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`:'🛵'}</div>
          <div style="flex:1">
            <div style="font-weight:700;color:var(--text)">${motoboy.nome||'—'}</div>
            ${motoboy.telefone?`<div style="font-size:12px;color:var(--text2)"><a href="https://wa.me/55${motoboy.telefone.replace(/\D/g,'')}" target="_blank" style="color:#25D366;font-weight:600">${motoboy.telefone}</a></div>`:''}
            <div style="display:flex;gap:12px;margin-top:4px;font-size:12px;color:var(--text3)">
              ${currentPerfil!=='suporte'&&p.distancia_km?`<span>📏 ${p.distancia_km}km</span>`:''}
              ${currentPerfil!=='suporte'&&txMoto!==null?`<span style="color:#10b981;font-weight:700">R$ ${txMoto.toFixed(2)}</span>`:''}
              ${p.gorjeta>0?`<span style="color:#f59e0b">🎁 R$ ${parseFloat(p.gorjeta).toFixed(2)}</span>`:''}
            </div>
          </div>
        </div>
      </div>`:''}
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        ${['retornando','chegou_destino'].includes(sk)?`<button onclick="confirmarPagamento('${p.id}');document.getElementById('modal-info-pedido').classList.remove('open')" style="flex:1;background:linear-gradient(135deg,#10b981,#059669);color:#fff;border:none;border-radius:10px;padding:12px;font-size:13px;font-weight:700;cursor:pointer;font-family:Inter,sans-serif">💰 Pagamento recebido</button>`:''}
        <button onclick="navigator.clipboard.writeText('${linkRastreio}').then(()=>showNotif('✅ Link copiado!',''))" style="flex:1;background:var(--surface2);color:var(--text2);border:1px solid var(--border);border-radius:10px;padding:12px;font-size:13px;font-weight:600;cursor:pointer;font-family:Inter,sans-serif">🔗 Copiar link de rastreio</button>
      </div>
    </div>
  </div>`;
  modal.classList.add('open');
}

function renderNavSidebar(activeId){
  _navAtivo=activeId||_navAtivo;
  const items=currentPerfil==='adm'?NAV_ITEMS_ADM:currentPerfil==='loja'?NAV_ITEMS_LOJA_ADM:NAV_ITEMS_SUPORTE;
  const body=document.getElementById('nav-sidebar-body');if(!body)return;
  body.innerHTML=items.map(item=>{
    const badge=item.id==='financeiro'&&_saquesPendentesCount>0?`<span style="background:#ef4444;color:#fff;border-radius:12px;padding:1px 7px;font-size:11px;font-weight:700;margin-left:auto">${_saquesPendentesCount}</span>`:'';
    return`<button class="nav-item${_navAtivo===item.id?' active':''}" onclick="navGoTab('${item.id}')"><span class="nav-item-icon">${item.icon}</span><span>${item.label}</span>${badge}</button>`;
  }).join('')+`<div style="border-top:1px solid var(--border);padding-top:8px;margin-top:16px"><button class="nav-item" onclick="logout()" style="color:var(--red)"><span class="nav-item-icon">🚪</span><span>Sair</span></button></div>`;
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
  renderTabs();setTimeout(()=>goTab('mapa'),100);
  const btnNovo=document.getElementById('btn-novo-pedido');if(btnNovo)btnNovo.style.display=currentPerfil==='adm'||currentPerfil==='loja'?'flex':'none';
  const btnCriarTop=document.getElementById('btn-criar-entrega-topbar');if(btnCriarTop)btnCriarTop.style.display=currentPerfil==='suporte'?'flex':'none';
  _carregarSaldoTopbar();
  if(currentPerfil==='adm')_carregarBadgeSaques();
  if(currentPerfil==='adm'||currentPerfil==='suporte')iniciarRoteirizacao();
  if(currentPerfil==='adm')_iniciarMonitorWhatsapp();
}
function logout(){
  clearInterval(realtimeInterval);pararRoteirizacao();sessionStorage.removeItem('lg_user');
  if(map){map.remove();map=null;}
  currentUser=null;currentPerfil=null;idsProntoNotificados=new Set();
  document.getElementById('login-screen').style.display='flex';document.getElementById('app').style.display='none';
  document.getElementById('login-email').value='';document.getElementById('login-senha').value='';
}

function renderTabs(){
  const tabs=currentPerfil==='adm'?tabsAdm:currentPerfil==='loja'?tabsLojaAdm:tabsSuporte;
  document.getElementById('tab-buttons').innerHTML=tabs.map(t=>`<button class="tab-btn" id="tab-${t.id}" onclick="goTab('${t.id}')"><span>${t.icon}</span>${t.label}</button>`).join('');
  const tabBar=document.getElementById('tab-buttons');
  if(tabBar)tabBar.style.display='none';
}
function goTab(id){
  _navAtivo=id;renderNavSidebar(id);clearInterval(realtimeInterval);
  document.querySelectorAll('.tab-btn').forEach(el=>el.classList.remove('active'));
  const tb=document.getElementById('tab-'+id);if(tb)tb.classList.add('active');
  const pages={'mapa':renderMapaPage,'pedidos':renderPedidosPage,'cadastros':renderCadastrosPage,'preco-dinamico':renderPrecoDinamicoPage,'relatorios':renderRelatoriosPage,'logs':renderLogsPage,'financeiro':renderFinanceiroPage,'creditos':renderCreditosPage,'whatsapp':renderWhatsappPage,'configuracao':renderConfiguracaoPage,'novo-pedido':renderNovoPedidoPage,'auditoria':renderAuditoriaPage,'meu-cardapio':renderMeuCardapioPage};
  if(pages[id])pages[id]();
}

function renderMapaPage(){
  _sidebarBusca='';filterStatus='todos';_pedidosSelecionados=new Set();
  const _thMapa=currentPerfil==='loja'
    ?['Nº','Hora','Cliente','Coleta','Entrega','Entregador','KM','Taxa Cobrada','Logística','Onde Cobrar','Status']
    :currentPerfil==='suporte'
    ?['Nº','Hora','Cliente','Coleta','Entrega','Entregador','KM','Logística','Status']
    :['Nº','Hora','Cliente','Coleta','Entrega','Entregador','KM','Taxa Motoboy','Taxa Cobrada','Lucro','Logística','Onde Cobrar','Status'];
  document.getElementById('app-body').innerHTML=`
    <div class="sidebar-pedidos sb-dark" id="sidebar-mapa">
      <div class="sb-header-dark">
        <div class="sb-header-top-dark">
          <span class="sb-title-dark">Pedidos</span>
          <div id="sb-status-bubbles" style="display:flex;gap:3px;flex-wrap:wrap;align-items:center"></div>
        </div>
        <input class="sb-search-dark" id="sb-busca" placeholder="Buscar número, loja ou endereço..." oninput="filtrarSidebar(this.value)">
      </div>
      <div class="pedidos-lista" id="pedidos-lista"><div class="empty-lista" style="color:#475569"><div class="ei">📦</div><p>Carregando...</p></div></div>
      <div id="sidebar-disparar-footer" style="display:none;padding:10px 8px;border-top:1px solid var(--sb-border);background:var(--sb-bg)">
        <button onclick="dispararRota()" style="width:100%;padding:12px;background:linear-gradient(135deg,#1A56DB,#3b82f6);color:white;border:none;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer;letter-spacing:0.3px;box-shadow:0 3px 12px rgba(26,86,219,.4)">🛵 Disparar Rota (0 pedidos) ++</button>
      </div>
    </div>
    <div id="mapa-tabela-col" style="flex:1;display:flex;flex-direction:column;overflow:hidden;height:100%">
      <div id="mapa-container-wrap" class="mapa-container" style="position:relative;height:30px;flex-shrink:0;overflow:hidden">
        <div id="sb-toggle-tab" title="Abrir/fechar pedidos" style="position:absolute;left:0;top:0;bottom:0;width:20px;z-index:200;cursor:pointer;display:flex;align-items:center;justify-content:center;background:var(--sb-bg);border-right:1px solid var(--sb-border);transform:translateX(-100%);transition:transform 0.3s ease;touch-action:none;box-shadow:2px 0 8px rgba(0,0,0,.15)"><span id="sb-tab-arrow" style="font-size:11px;color:var(--sb-text3);user-select:none;pointer-events:none">►</span></div>
        <div class="mapa-stats" style="display:flex;flex-wrap:wrap;gap:0;padding:4px 8px;align-items:center;background:#2D2D2D !important;border-bottom:1px solid #3A3A3A">
          <div class="mapa-stat" style="display:flex;align-items:center;gap:5px;padding:3px 8px"><span style="font-size:13px">✅</span><div><div class="mapa-stat-val" id="ms-finalizados" style="font-size:13px;color:#10b981;font-weight:700">0</div><div class="mapa-stat-label" style="font-size:9px;color:#888">Finalizados hoje</div></div></div>
          <div style="width:1px;height:22px;background:#3A3A3A;margin:0 2px;flex-shrink:0"></div>
          <div class="mapa-stat" style="display:flex;align-items:center;gap:5px;padding:3px 8px"><span style="font-size:13px">❌</span><div><div class="mapa-stat-val" id="ms-cancelados" style="font-size:13px;color:#ef4444;font-weight:700">0</div><div class="mapa-stat-label" style="font-size:9px;color:#888">Cancelados hoje</div></div></div>
        </div>
        <button class="mapa-refresh" onclick="atualizarTudo()">↻ Atualizar</button>
        <div style="position:absolute;bottom:32px;left:12px;z-index:1000;display:flex;gap:6px">
          <button id="btn-filtro-motoboys" onclick="toggleFiltroMotoboys()" title="Mostrar todos os motoboys" style="background:transparent;border:2px solid #E5E7EB;border-radius:10px;width:40px;height:40px;font-size:20px;cursor:pointer;box-shadow:0 2px 10px rgba(0,0,0,.15);display:flex;align-items:center;justify-content:center;transition:background .2s,border .2s">🪖</button>
          <button id="btn-filtro-lojas" onclick="toggleFiltroLojas()" title="Mostrar todas as lojas" style="background:transparent;border:2px solid #E5E7EB;border-radius:10px;width:40px;height:40px;font-size:20px;cursor:pointer;box-shadow:0 2px 10px rgba(0,0,0,.15);display:flex;align-items:center;justify-content:center;transition:background .2s,border .2s">🏪</button>
        </div>
        <div id="map" style="width:100%;height:100%;position:absolute;top:0;left:0"></div>
      </div>
      <div id="mapa-resize-handle" style="height:6px;background:#3A3A3A;cursor:ns-resize;flex-shrink:0;user-select:none;transition:background .15s" onmouseenter="this.style.background='#555'" onmouseleave="this.style.background='#3A3A3A'"></div>
      <div id="tabela-mapa-section" style="flex:1;min-height:80px;background:var(--bg) !important;display:flex;flex-direction:column;overflow:hidden">
        <div style="display:flex;align-items:center;gap:6px;padding:5px 10px;border-bottom:1px solid #3A3A3A;background:#2D2D2D !important;flex-shrink:0;flex-wrap:wrap">
          <input id="tf-busca" placeholder="🔍 Buscar..." oninput="_tabelaFiltrar()" style="padding:4px 8px;border:1px solid #3A3A3A;border-radius:6px;font-size:11px;background:#1E1E1E !important;color:#DDD !important;outline:none;width:120px;font-family:Inter,sans-serif"/>
          <select id="cr-loja-id" style="padding:4px 6px;border:1px solid #3A3A3A;border-radius:6px;font-size:11px;background:#1E1E1E !important;color:#DDD !important;outline:none;max-width:150px;font-family:Inter,sans-serif"><option value="">Selecione a loja...</option></select>
          <div style="width:1px;height:18px;background:#3A3A3A;flex-shrink:0"></div>
          <input id="cr-numero" placeholder="Nº" style="padding:4px 6px;border:1px solid #3A3A3A;border-radius:6px;font-size:11px;background:#1E1E1E !important;color:#DDD !important;outline:none;width:60px;font-family:Inter,sans-serif"/>
          <input id="cr-cliente" placeholder="Nome do cliente" style="padding:4px 6px;border:1px solid #3A3A3A;border-radius:6px;font-size:11px;background:#1E1E1E !important;color:#DDD !important;outline:none;width:140px;font-family:Inter,sans-serif"/>
          <input id="cr-telefone" placeholder="Telefone" type="tel" style="padding:4px 6px;border:1px solid #3A3A3A;border-radius:6px;font-size:11px;background:#1E1E1E !important;color:#DDD !important;outline:none;width:120px;font-family:Inter,sans-serif"/>
          <input id="cr-endereco" placeholder="Endereço + Nº" oninput="_crCalcularTaxaDebounce()" onblur="_crCalcularTaxa()" onfocus="iniciarAutocompleteEndereco('cr-endereco','','','')" style="padding:4px 6px;border:1px solid #3A3A3A;border-radius:6px;font-size:11px;background:#1E1E1E !important;color:#DDD !important;outline:none;width:180px;font-family:Inter,sans-serif"/>
          <input id="cr-complemento" placeholder="Complemento" style="padding:4px 6px;border:1px solid #3A3A3A;border-radius:6px;font-size:11px;background:#1E1E1E !important;color:#DDD !important;outline:none;width:100px;font-family:Inter,sans-serif"/>
          <input id="cr-gorjeta" placeholder="Gorjeta R$" type="number" step="0.50" min="0" value="" style="padding:4px 6px;border:1px solid #3A3A3A;border-radius:6px;font-size:11px;background:#1E1E1E !important;color:#DDD !important;outline:none;width:80px;font-family:Inter,sans-serif"/>
          <div id="cr-retorno-btn" onclick="_criarEntregaRapidaToggle()" style="display:inline-flex;align-items:center;gap:6px;cursor:pointer;user-select:none;flex-shrink:0"><div id="cr-retorno-track" style="width:40px;height:22px;background:#3a3a3a;border-radius:11px;position:relative;transition:background .2s;border:1px solid #555;flex-shrink:0"><div id="cr-retorno-thumb" style="width:18px;height:18px;background:#666;border-radius:50%;position:absolute;top:1px;left:1px;transition:left .2s,background .2s"></div></div><span id="cr-retorno-lbl" style="color:#888;font-size:11px;font-weight:600;white-space:nowrap">Sem ret</span></div>
          <span id="cr-dist-km" style="font-size:11px;color:#60a5fa;font-weight:700;white-space:nowrap;min-width:40px"></span>
          <span id="cr-dist-taxa" style="font-size:11px;color:#4ade80;font-weight:700;white-space:nowrap;min-width:50px"></span>
          <span id="cr-pd-badge" style="font-size:10px;color:#f59e0b;font-weight:700;white-space:nowrap;display:none"></span>
          <button id="btn-criar-entrega" onclick="_criarEntregaRapida()" style="display:inline-flex;align-items:center;gap:4px;padding:4px 10px;background:#1A56DB !important;border:none;border-radius:6px;font-size:11px;font-weight:700;color:#fff;cursor:pointer;font-family:Inter,sans-serif;white-space:nowrap">➕ Criar Entrega</button>
        </div>
        <div style="flex:1;overflow:auto;background:#1E1E1E !important;min-height:300px">
          <table style="width:100%;border-collapse:collapse;font-size:13px;font-family:Inter,sans-serif;background:#1E1E1E !important;border:1px solid #3A3A3A">
            <thead style="position:sticky;top:0;z-index:2;background:#3A3A3A !important">
              <tr style="background:#3A3A3A !important">
                ${_thMapa.map(h=>`<th style="padding:6px 7px;text-align:left;border-bottom:1px solid #444;border-right:1px solid #444;color:#BBB !important;font-size:11px;text-transform:uppercase;letter-spacing:.3px;white-space:nowrap">${h}</th>`).join('')}
              </tr>
            </thead>
            <tbody id="tabela-mapa-body">
              <tr><td colspan="${_thMapa.length}" style="text-align:center;padding:20px;color:#999 !important">Carregando...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>`;
  iniciarDragSidebar();
  _iniciarResizeMapa();
  setTimeout(()=>{
    if(map){map.remove();map=null;}
    map=L.map('map',{zoomControl:false}).setView([-21.1775,-47.8103],13);
    L.control.zoom({position:'bottomright'}).addTo(map);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',{attribution:'© OSM © CartoDB',maxZoom:19}).addTo(map);
    atualizarTudo();realtimeInterval=setInterval(atualizarTudo,5000);
    if(currentPerfil==='loja'){
      const selCr=document.getElementById('cr-loja-id');
      if(selCr){
        const lojaAtual=allLojas.find(l=>l.id===currentUser?.loja_id)||{id:currentUser?.loja_id,nome:'Minha Loja',latitude:'',longitude:''};
        selCr.innerHTML=`<option value="${lojaAtual.id}" data-lat="${lojaAtual.latitude||''}" data-lng="${lojaAtual.longitude||''}" selected>${lojaAtual.nome}</option>`;
        selCr.disabled=true;
        selCr.style.opacity='0.7';selCr.style.cursor='default';
      }
    } else {
      db('lojas','GET',null,'?ativo=eq.true&order=nome.asc').then(lojasCr=>{const selCr=document.getElementById('cr-loja-id');if(selCr)selCr.innerHTML='<option value="">Selecione a loja...</option>'+lojasCr.map(l=>`<option value="${l.id}" data-lat="${l.latitude||''}" data-lng="${l.longitude||''}">${l.nome}</option>`).join('');});
    }
    setInterval(_verificarAgendados,60000);
    setInterval(processarPontosAutomaticos,60000);
    iniciarRealtimeSupabase();
  },100);
}

async function _verificarAgendados(){
  const agora=new Date().toISOString();
  const vencidos=await db('pedidos','GET',null,`?status=eq.agendado&agendado_para=lte.${agora}`);
  for(const p of vencidos){
    await db('pedidos','PATCH',{status:'pronto',status_detalhado:'pronto',pronto_em:agora,updated_at:agora},`?id=eq.${p.id}`);
    idsProntoNotificados.delete(p.id);
    tocarSomPronto();
    showNotif(`🔔 Pedido #${p.numero||p.id.substring(0,6)} — Agendamento ativado!`,'','var(--pink)');
  }
  if(vencidos.length) atualizarTudo();
}
// ─── TABELA DE PEDIDOS ABAIXO DO MAPA ───────────────────────────────────────

function carregarTabelaMapa(){
  if(!document.getElementById('tabela-mapa-body'))return;
  _tabelaPedidosDia=allPedidos;
  renderTabelaMapa();
}

let _tabelaScrollFiltered=[],_tabelaScrollOffset=0,_tabelaScrollObserver=null;
let _tabelaFaixasPorLoja={};
let _tabelaFaixasPagPorLoja={};
const _TABELA_PAGE=20;

async function _preCarregarFaixasLojas(pedidos){
  const ids=[...new Set(pedidos.map(p=>p.loja_id).filter(Boolean))];
  const [cobEntries,pagEntries]=await Promise.all([
    Promise.all(ids.map(async id=>[id,await _getFaixasCobranca(id)])),
    Promise.all(ids.map(async id=>[id,await _getFaixasPagamento(id)])),
  ]);
  _tabelaFaixasPorLoja=Object.fromEntries(cobEntries);
  _tabelaFaixasPagPorLoja=Object.fromEntries(pagEntries);
}

function _iconsLogistica(p){
  const icons=[
    p.com_retorno?`<span title="Com retorno">🔄</span>`:'',
    parseFloat(p.gorjeta)>0?`<span title="Com gorjeta">🎁</span>`:'',
    parseFloat(p.preco_dinamico)>0?(p.preco_dinamico_origem==='global'?`<span title="Feriado/Promoção global">📅</span>`:`<span title="Taxa dinâmica (cidade)">🌧️</span>`):'',
  ].filter(Boolean);
  return icons.length?`<span style="display:inline-flex;align-items:center;gap:3px;font-size:12px">${icons.join('')}</span>`:'—';
}

function _buildTabelaRows(filtered,from){
  const to=Math.min(from+_TABELA_PAGE,filtered.length);
  const fmtR$=v=>`R$ ${(parseFloat(v)||0).toFixed(2)}`;
  const TD=(s,extra='',bg)=>`<td style="padding:6px 7px;border-bottom:1px solid #3A3A3A;border-right:1px solid #3A3A3A;color:#DDD !important;font-size:11px;${bg?'background:'+bg+' !important;':''}${extra}">${s}</td>`;
  return filtered.slice(from,to).map((p,i)=>{
    const rowBg=(from+i)%2===0?'#2D2D2D':'#333333';
    const sk=getStatusKey(p);const badgeCor=corStatus(sk);
    const loja=allLojas.find(l=>l.id===p.loja_id);
    const entId=p.motoboy_id||p.entregador_id;
    const ent=allMotoboys.find(e=>e.id===entId);
    const hora=p.created_at?formatarHora(p.created_at):'—';
    const endereco=p.endereco_entrega||p.endereco||'—';
    const taxaMotoboy=p.taxa_motoboy!=null?parseFloat(p.taxa_motoboy):_calcTaxaMotoboy(p,_tabelaFaixasPagPorLoja[p.loja_id]);const taxaCobrada=_calcTaxaLoja(p,_tabelaFaixasPorLoja[p.loja_id]);
    const kmStr=p.distancia_km>0?parseFloat(p.distancia_km).toFixed(1)+'km':'—';
    const lucroMapa=taxaCobrada-(taxaMotoboy??0);const lucroMapaStr=taxaCobrada>0?`<span style="font-weight:700;color:${lucroMapa>=0?'#4ade80':'#ef4444'}">${fmtR$(lucroMapa)}</span>`:'—';
    return `<tr style="cursor:pointer;background:${rowBg}" onclick="_irParaPedido('${p.id}')">
      ${TD(`<span style="font-weight:700;color:#60a5fa">#${p.numero||p.id?.substring(0,6)}</span>`,'white-space:nowrap',rowBg)}
      ${TD(`<span style="font-weight:500;color:#BBB;white-space:nowrap">${hora}</span>`,'',rowBg)}
      ${TD(`<span style="color:#DDD">${p.nome_cliente||p.cliente||'—'}</span>`,'',rowBg)}
      ${TD(`<span style="color:#BBB;font-size:12px">${loja?.nome||'—'}</span>`,'',rowBg)}
      ${TD(`<span style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:block;color:#DDD">${endereco}</span>`,'',rowBg)}
      ${TD(`<span style="color:#DDD">${ent?.nome||'<span style="color:#555">—</span>'}</span>`,'',rowBg)}
      ${TD(`<span style="color:#BBB;font-size:11px">${kmStr}</span>`,'',rowBg)}
      ${currentPerfil!=='loja'&&currentPerfil!=='suporte'?TD(taxaMotoboy!==null?`<span style="font-weight:700;color:#4ade80">${fmtR$(taxaMotoboy)}</span>`:`<span style="color:#555;font-size:11px">—</span>`,'',rowBg):''}
      ${currentPerfil!=='suporte'?TD(`<span style="font-weight:700;color:#4ade80">${fmtR$(taxaCobrada)}</span>`,'',rowBg):''}
      ${currentPerfil!=='loja'&&currentPerfil!=='suporte'?TD(lucroMapaStr,'text-align:right',rowBg):''}
      ${TD(_iconsLogistica(p),'text-align:center;padding:3px 5px',rowBg)}
      ${currentPerfil!=='suporte'?TD(`<span style="color:#BBB">${loja?.tipo_cobranca==='credito'?'💳 Crédito':loja?.tipo_cobranca==='faturamento'?'📄 Faturamento':'—'}</span>`,'',rowBg):''}
      ${TD(`<span id="tabela-badge-${p.id}" onclick="event.stopPropagation();abrirDropdownStatusTabela(event,'${p.id}')" style="display:inline-flex;align-items:center;gap:3px;padding:2px 7px;border-radius:20px;font-size:10px;font-weight:700;cursor:pointer;user-select:none;white-space:nowrap;background:${badgeCor}22;color:${badgeCor};border:1px solid ${badgeCor}55">${sk==='agendado'&&p.agendado_para?'⏰ '+formatarHora(p.agendado_para):getStatusLabel(p)} <span style="font-size:8px">▾</span></span>`,'',rowBg)}
    </tr>`;
  }).join('');
}

function _tabelaAnexarSentinela(){
  const el=document.getElementById('tabela-mapa-body');if(!el)return;
  if(_tabelaScrollOffset>=_tabelaScrollFiltered.length){
    el.insertAdjacentHTML('beforeend',`<tr><td colspan="${currentPerfil==='loja'?11:currentPerfil==='suporte'?9:13}" style="text-align:center;padding:12px;color:#555;font-size:12px;background:#2D2D2D">✓ Todos os pedidos carregados</td></tr>`);
    return;
  }
  el.insertAdjacentHTML('beforeend',`<tr id="tabela-sentinel"><td colspan="${currentPerfil==='loja'?11:currentPerfil==='suporte'?9:13}" style="padding:10px;text-align:center;background:#2D2D2D"><div style="width:20px;height:20px;border:2px solid #3A3A3A;border-top-color:#60a5fa;border-radius:50%;animation:spin .8s linear infinite;margin:0 auto"></div></td></tr>`);
  const sentinel=document.getElementById('tabela-sentinel');if(!sentinel)return;
  const root=el.parentElement?.parentElement;
  _tabelaScrollObserver=new IntersectionObserver(entries=>{
    if(!entries[0].isIntersecting)return;
    _tabelaScrollObserver.disconnect();_tabelaScrollObserver=null;
    sentinel.remove();
    const el2=document.getElementById('tabela-mapa-body');if(!el2)return;
    el2.insertAdjacentHTML('beforeend',_buildTabelaRows(_tabelaScrollFiltered,_tabelaScrollOffset));
    _tabelaScrollOffset=Math.min(_tabelaScrollOffset+_TABELA_PAGE,_tabelaScrollFiltered.length);
    _tabelaAnexarSentinela();
  },{root:root||null,threshold:0,rootMargin:'120px'});
  _tabelaScrollObserver.observe(sentinel);
}

async function renderTabelaMapa(){
  if(_tabelaScrollObserver){_tabelaScrollObserver.disconnect();_tabelaScrollObserver=null;}
  const el=document.getElementById('tabela-mapa-body');if(!el)return;
  const busca=(_tabelaFiltros.busca||'').toLowerCase();
  let filtered=_tabelaPedidosDia.filter(p=>{
    if(busca&&!((p.nome_cliente||p.cliente||'').toLowerCase().includes(busca)||String(p.numero||'').includes(busca)))return false;
    return true;
  });
  _tabelaScrollFiltered=filtered;_tabelaScrollOffset=0;
  const _cols=currentPerfil==='loja'?11:currentPerfil==='suporte'?9:13;
  if(!filtered.length){el.innerHTML=`<tr><td colspan="${_cols}" style="text-align:center;padding:20px;color:#555">Nenhum pedido encontrado</td></tr>`;return;}
  await _preCarregarFaixasLojas(filtered);
  el.innerHTML=_buildTabelaRows(filtered,0);
  _tabelaScrollOffset=Math.min(_TABELA_PAGE,filtered.length);
  _tabelaAnexarSentinela();
}

function _tabelaFiltrar(){
  _tabelaFiltros.busca=document.getElementById('tf-busca')?.value||'';
  renderTabelaMapa();
}
function _tabelaMudarData(){carregarTabelaMapa();}
function _tabelaIrPagina(){}

function _localizarPedidoMapa(id){
  const p=allPedidos.find(x=>x.id===id)||_tabelaPedidosDia.find(x=>x.id===id);
  if(map&&p&&p.latitude&&p.longitude)map.setView([p.latitude,p.longitude],16,{animate:true});
}

function _iniciarResizeMapa(){
  const handle=document.getElementById('mapa-resize-handle');
  const mapaWrap=document.getElementById('mapa-container-wrap');
  if(!handle||!mapaWrap)return;
  let dragging=false,startY=0,startH=0;
  const MIN_H=80,MAX_H=600;
  handle.addEventListener('mousedown',e=>{
    dragging=true;startY=e.clientY;startH=mapaWrap.offsetHeight;
    document.body.style.userSelect='none';document.body.style.cursor='ns-resize';
  });
  document.addEventListener('mousemove',e=>{
    if(!dragging)return;
    const newH=Math.max(MIN_H,Math.min(MAX_H,startH+(e.clientY-startY)));
    mapaWrap.style.height=newH+'px';
    if(map)map.invalidateSize();
  });
  document.addEventListener('mouseup',()=>{
    if(!dragging)return;
    dragging=false;document.body.style.userSelect='';document.body.style.cursor='';
    if(map)map.invalidateSize();
  });
  handle.addEventListener('touchstart',e=>{dragging=true;startY=e.touches[0].clientY;startH=mapaWrap.offsetHeight;},{passive:true});
  document.addEventListener('touchmove',e=>{if(!dragging)return;const newH=Math.max(MIN_H,Math.min(MAX_H,startH+(e.touches[0].clientY-startY)));mapaWrap.style.height=newH+'px';if(map)map.invalidateSize();},{passive:true});
  document.addEventListener('touchend',()=>{dragging=false;if(map)map.invalidateSize();});
}

// ─────────────────────────────────────────────────────────────────────────────

function iniciarDragSidebar(){
  const sb=document.getElementById('sidebar-mapa'),tab=document.getElementById('sb-toggle-tab');
  if(!sb||!tab)return;
  const SB_W=600,SNAP=80;
  let dragging=false,startX=0,startW=0,_wasMin=false,fromTab=false;
  // Handle de arrasto (faixa de 8px na borda direita da sidebar)
  const handle=document.createElement('div');
  handle.style.cssText='position:absolute;right:0;top:0;bottom:0;width:8px;cursor:ew-resize;z-index:20;touch-action:none';
  sb.style.position='relative';sb.appendChild(handle);
  function isMin(){return sb.classList.contains('sb-minimized');}
  function snapTo(minimize){
    sb.style.transition='width 0.3s ease,min-width 0.3s ease';
    sb.style.width='';sb.style.minWidth='';
    toggleSidebar(minimize);
  }
  function startDrag(x,isTab){
    dragging=true;fromTab=isTab;startX=x;_wasMin=isMin();
    sb.style.transition='none';document.body.style.userSelect='none';
    if(isTab&&_wasMin){sb.classList.remove('sb-minimized');startW=0;}
    else startW=sb.offsetWidth;
  }
  function moveDrag(x){
    if(!dragging)return;
    const newW=Math.max(0,Math.min(SB_W,startW+(x-startX)));
    sb.style.width=newW+'px';sb.style.minWidth=newW+'px';
    if(tab)tab.style.transform=newW>24?'translateX(-100%)':'translateX(0)';
  }
  function endDrag(x){
    if(!dragging)return;
    dragging=false;document.body.style.userSelect='';
    const delta=Math.abs(x-startX);
    if(delta<8){snapTo(fromTab?!_wasMin:_wasMin);}
    else{snapTo((parseFloat(sb.style.width)||0)<SB_W-SNAP);}
  }
  handle.addEventListener('mousedown',e=>{e.preventDefault();startDrag(e.clientX,false);});
  handle.addEventListener('touchstart',e=>startDrag(e.touches[0].clientX,false),{passive:true});
  tab.addEventListener('mousedown',e=>{e.preventDefault();startDrag(e.clientX,true);});
  tab.addEventListener('touchstart',e=>startDrag(e.touches[0].clientX,true),{passive:true});
  document.addEventListener('mousemove',e=>{if(dragging)moveDrag(e.clientX);});
  document.addEventListener('touchmove',e=>{if(dragging){e.preventDefault();moveDrag(e.touches[0].clientX);}},{passive:false});
  document.addEventListener('mouseup',e=>{if(dragging)endDrag(e.clientX);});
  document.addEventListener('touchend',e=>{if(dragging)endDrag(e.changedTouches[0].clientX);});
}
function setFilter(status,el){filterStatus=status;document.querySelectorAll('.filter-tab,.sb-filter-tab').forEach(e=>e.classList.remove('active'));el.classList.add('active');renderPedidosLista();}
function toggleSidebar(minimize){const sb=document.getElementById('sidebar-mapa'),tab=document.getElementById('sb-toggle-tab'),arrow=document.getElementById('sb-tab-arrow');if(!sb)return;const min=minimize!==undefined?minimize:sb.classList.toggle('sb-minimized');if(minimize!==undefined)min?sb.classList.add('sb-minimized'):sb.classList.remove('sb-minimized');if(tab)tab.style.transform=min?'translateX(0)':'translateX(-100%)';if(arrow)arrow.textContent=min?'►':'◄';if(map)setTimeout(()=>map.invalidateSize(),320);}
let _estadoLojas=0;
const _LOJAS_TITLES=['Mostrar todas as lojas','Escondendo lojas sem pedido','Lojas ocultas'];
const _LOJAS_CORES=['transparent','#eab308','#ef4444'];
function toggleFiltroLojas(){
  _estadoLojas=(_estadoLojas+1)%3;
  const btn=document.getElementById('btn-filtro-lojas');
  if(btn){btn.style.background=_LOJAS_CORES[_estadoLojas];btn.style.border='2px solid '+(_estadoLojas===0?'#E5E7EB':_LOJAS_CORES[_estadoLojas]);btn.title=_LOJAS_TITLES[_estadoLojas];}
  atualizarMarcadores();
}
let _estadoMotoboys=0;
let _detalheColapsado=new Set();
function toggleDetalheCard(id){if(_detalheColapsado.has(id))_detalheColapsado.delete(id);else _detalheColapsado.add(id);renderPedidosLista();}
const _MOTO_TITLES=['Mostrar todos os motoboys','Só disponíveis sem pedido','Motoboys ocultos'];
const _MOTO_CORES=['transparent','#eab308','#ef4444'];
function toggleFiltroMotoboys(){
  _estadoMotoboys=(_estadoMotoboys+1)%3;
  const btn=document.getElementById('btn-filtro-motoboys');
  if(btn){btn.style.background=_MOTO_CORES[_estadoMotoboys];btn.style.border='2px solid '+(_estadoMotoboys===0?'#E5E7EB':_MOTO_CORES[_estadoMotoboys]);btn.title=_MOTO_TITLES[_estadoMotoboys];}
  atualizarMarcadores();
}
function filtrarSidebar(val){_sidebarBusca=val.trim().toLowerCase();renderPedidosLista();}
function toggleGrupo(key){if(_gruposColapsados.has(key))_gruposColapsados.delete(key);else _gruposColapsados.add(key);renderPedidosLista();}
function _copiarRastreio(id){const url=window.location.origin+window.location.pathname+'?rastrear='+id;navigator.clipboard.writeText(url).then(()=>showNotif('✅ Link copiado!',''));}

function _aplicarLockStatus(lista){
  for(const [id,lock] of _pedidoStatusLock){
    const p=lista.find(x=>x.id===id);
    if(!p)continue;
    if(p.status===lock.status&&p.status_detalhado===lock.status_detalhado){
      // Banco confirmou o status — lock pode ser removido
      _pedidoStatusLock.delete(id);
    } else {
      // Banco ainda diverge — mantém o status local
      p.status=lock.status;p.status_detalhado=lock.status_detalhado;
    }
  }
}

async function atualizarTudo(){
  const _lf=_lojaFiltro();
  allPedidos=await db('pedidos','GET',null,`?order=created_at.desc&limit=200&status=not.in.(cancelado,finalizado)&status_detalhado=not.in.(cancelado,finalizado)${_lf}`);
  _aplicarLockStatus(allPedidos);
  allMotoboys=await db('entregadores','GET',null,'?disponivel=eq.true');
  allLojas=await db('lojas','GET',null,'?ativo=eq.true');
  if(!_faixasPagamento.length) _faixasPagamento=await db('tabelas_preco_faixas','GET',null,`?tabela_id=eq.${TABELA_PAGAMENTO_ID}&order=km_ate.asc`);
  if(!_faixasCobranca.length) _faixasCobranca=await db('tabelas_preco_faixas','GET',null,`?tabela_id=eq.${TABELA_COBRANCA_ID}&order=km_ate.asc`);
  await processarAutoPronto();
  allPedidos=await db('pedidos','GET',null,`?order=created_at.desc&limit=200&status=not.in.(cancelado,finalizado)&status_detalhado=not.in.(cancelado,finalizado)${_lf}`);
  _aplicarLockStatus(allPedidos);
  verificarNovosProtos(allPedidos);
  const online=allMotoboys.filter(e=>e.disponivel||e.status==='ocupado').length;
  const emPreparo=allPedidos.filter(p=>getStatusKey(p)==='recebido').length;
  const procurando=allPedidos.filter(p=>getStatusKey(p)==='pronto').length;
  const emRota=allPedidos.filter(p=>['aceito','chegou_local','em_rota','chegou_destino','retornando'].includes(getStatusKey(p))).length;
  const _hoje=_dataHojeBrasilia();
  const _ini=_inicioDiaBrasilia(_hoje),_fim=_fimDiaBrasilia(_hoje);
  const contadoresHoje=await db('pedidos','GET',null,`?select=status,status_detalhado&created_at=gte.${_ini}&created_at=lte.${_fim}&status=in.(finalizado,cancelado)${_lf}`);
  const finalizadosHoje=contadoresHoje.filter(p=>getStatusKey(p)==='finalizado').length;
  const canceladosHoje=contadoresHoje.filter(p=>getStatusKey(p)==='cancelado').length;
  const setVal=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v;};
  setVal('ms-online',online);setVal('ms-pedidos',allPedidos.length);setVal('ms-preparo',emPreparo);
  setVal('ms-procurando',procurando);setVal('ms-rota',emRota);setVal('ms-finalizados',finalizadosHoje);setVal('ms-cancelados',canceladosHoje);
  renderPedidosLista();if(map)atualizarMarcadores();
  carregarTabelaMapa();
  if(currentPerfil==='loja')_carregarSaldoTopbar();
}

let _wsRealtime=null,_wsHeartbeat=null,_wsReconTimer=null;
function iniciarRealtimeSupabase(){
  if(_wsRealtime){try{_wsRealtime.close();}catch(_){} _wsRealtime=null;}
  clearInterval(_wsHeartbeat);clearTimeout(_wsReconTimer);
  const wsUrl=SB_URL.replace('https://','wss://')+'/realtime/v1/websocket?apikey='+SB_KEY+'&vsn=1.0.0';
  try{_wsRealtime=new WebSocket(wsUrl);}catch(e){return;}
  _wsRealtime.onopen=()=>{
    _wsRealtime.send(JSON.stringify({topic:'realtime:public:pedidos',event:'phx_join',payload:{config:{broadcast:{self:false},presence:{key:''},postgres_changes:[{event:'INSERT',schema:'public',table:'pedidos'},{event:'UPDATE',schema:'public',table:'pedidos'}]}},ref:'1',join_ref:'1'}));
    _wsHeartbeat=setInterval(()=>{if(_wsRealtime?.readyState===1)_wsRealtime.send(JSON.stringify({topic:'phoenix',event:'heartbeat',payload:{},ref:'hb'}));},30000);
  };
  _wsRealtime.onmessage=e=>{
    try{const m=JSON.parse(e.data);if(m.event==='postgres_changes'||m.payload?.data?.type==='INSERT'||m.payload?.data?.type==='UPDATE')atualizarTudo();}catch(_){}
  };
  _wsRealtime.onclose=()=>{clearInterval(_wsHeartbeat);_wsReconTimer=setTimeout(iniciarRealtimeSupabase,5000);};
  _wsRealtime.onerror=()=>{try{_wsRealtime.close();}catch(_){}};
}

function renderPedidosLista(){
  const lista=document.getElementById('pedidos-lista');if(!lista)return;
  let filtered=filterStatus==='todos'?allPedidos:allPedidos.filter(p=>(p.status_detalhado===filterStatus)||(p.status===filterStatus));
  if(_sidebarBusca){
    const q=_sidebarBusca;
    filtered=filtered.filter(p=>{
      const loja=allLojas.find(l=>l.id===p.loja_id);
      return (p.numero||'').toLowerCase().includes(q)||(p.endereco||'').toLowerCase().includes(q)||(p.cliente||'').toLowerCase().includes(q)||((loja?.nome||'').toLowerCase().includes(q));
    });
  }
  const _SB_HEADER=[
    {key:'recebido',color:'#EF4444'},{key:'pronto',color:'#EC4899'},{key:'aceito',color:'#F59E0B'},
    {key:'chegou_local',color:'#38BDF8'},{key:'em_rota',color:'#1A56DB'},
    {key:'chegou_destino',color:'#7C3AED'},{key:'retornando',color:'#10B981'},
  ];
  const bubblesEl=document.getElementById('sb-status-bubbles');
  if(bubblesEl){
    bubblesEl.innerHTML=_SB_HEADER.map(sb=>{
      const n=allPedidos.filter(p=>getStatusKey(p)===sb.key).length;
      return n?`<span style="width:20px;height:20px;border-radius:50%;background:${sb.color};color:#fff;font-size:10px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0">${n}</span>`:'';
    }).join('');
  }
  if(filtered.length===0){lista.innerHTML='<div class="empty-lista" style="color:#475569"><div class="ei">📦</div><p>Nenhum pedido</p></div>';return;}
  const STATUS_BUBBLES=[
    {key:'recebido',color:'#EF4444',label:'Recebido'},
    {key:'pronto',color:'#EC4899',label:'Pronto'},
    {key:'aceito',color:'#F59E0B',label:'Aceito'},
    {key:'chegou_local',color:'#38BDF8',label:'Chegou no local'},
    {key:'em_rota',color:'#1A56DB',label:'Em rota'},
    {key:'chegou_destino',color:'#7C3AED',label:'Chegou no destino'},
    {key:'retornando',color:'#10B981',label:'Retornando'},
  ];
  const grupos={};
  filtered.forEach(p=>{
    const key=p.loja_id||'__sem__';
    if(!grupos[key]){const loja=allLojas.find(l=>l.id===p.loja_id);grupos[key]={nome:loja?.nome||'Sem loja',pedidos:[]};}
    grupos[key].pedidos.push(p);
  });
  lista.innerHTML=Object.entries(grupos).map(([key,grupo])=>{
    const colapsado=_gruposColapsados.has(key);
    const bubbles=STATUS_BUBBLES.map(sb=>{
      const n=grupo.pedidos.filter(p=>getStatusKey(p)===sb.key).length;
      return n?`<span class="sb-status-bubble" style="background:${sb.color}" title="${sb.label}">${n}</span>`:'';
    }).join('');
    const cards=grupo.pedidos.map(p=>{
      const horaC=p.created_at?formatarHora(p.created_at):'—';
      const sk=getStatusKey(p),isExpanded=selectedPedidoId===p.id,isSel=_pedidosSelecionados.has(p.id),prontoAnim=sk==='pronto'?'class="pronto-pulse"':'';
      const clienteNome=p.cliente_nome||p.nome_cliente||p.cliente||'';
      const telefone=p.telefone||p.telefone_cliente||'';
      const loja=allLojas.find(l=>l.id===p.loja_id);
      const motoboy=allMotoboys.find(e=>e.id===(p.motoboy_id||p.entregador_id));
      const txMoto=p.taxa_motoboy!=null?parseFloat(p.taxa_motoboy):_calcTaxaMotoboy(p);
      const txLoja=_calcTaxaLoja(p);
      const squareBg=p.origem==='ifood'?'#EA1D2C':'#1A56DB';
      // progress: mapa de status → etapa completada (0-3)
      const _stepMap={recebido:0,pronto:0,aceito:1,chegou_local:1,em_rota:2,chegou_destino:2,retornando:3,finalizado:3};
      const stepDone=_stepMap[sk]??0;
      const _dot=(i)=>{const done=i<=stepDone;return`<div style="width:14px;height:14px;border-radius:50%;background:${done?'#1A56DB':'var(--sb-border)'};border:2px solid ${done?'#1A56DB':'var(--sb-text3)'};flex-shrink:0"></div>`;};
      const _line=(i)=>`<div style="flex:1;height:2px;background:${i<stepDone?'#1A56DB':'var(--sb-border)'};margin:0 2px"></div>`;
      const _labels=['Em Preparo','Coletado','A caminho','Entregue'];
      const progressBar=`<div style="margin-bottom:12px">
        <div style="display:flex;align-items:center;margin-bottom:4px">${_dot(0)}${_line(0)}${_dot(1)}${_line(1)}${_dot(2)}${_line(2)}${_dot(3)}</div>
        <div style="display:flex;justify-content:space-between">${_labels.map((l,i)=>`<span style="font-size:9px;color:${i<=stepDone?'#1A56DB':'var(--sb-text3)'};font-weight:${i<=stepDone?700:400};text-align:${i===0?'left':i===3?'right':'center'};flex:${i===0||i===3?'0 0 auto':1}">${l}</span>`).join('')}</div>
      </div>`;
      const previsaoMs=_tsUtc(p.created_at)+30*60*1000;
      const restanteMin=Math.round((previsaoMs-Date.now())/60000);
      const mbIniciais=motoboy?.nome?motoboy.nome.trim().split(/\s+/).slice(0,2).map(s=>s[0]||'').join('').toUpperCase():'?';
      const itens=Array.isArray(p.itens)?p.itens:[];
      const _sec=(titulo)=>`<div style="font-size:9px;font-weight:700;color:var(--sb-text3);text-transform:uppercase;letter-spacing:.6px;margin-bottom:6px">${titulo}</div>`;
      const expandido=isExpanded?`
        <div style="margin-top:10px;border-top:1px solid var(--sb-border);padding-top:10px">
          ${itens.length?`<div style="margin-bottom:12px">${_sec('📦 Itens do Pedido')}
            ${itens.map(it=>`<div style="display:flex;justify-content:space-between;font-size:12px;padding:3px 0;border-bottom:1px solid var(--sb-border)"><span style="color:var(--sb-text)">${it.quantidade||1}x ${it.nome||it.name||'—'}</span><span style="color:#10b981;font-weight:700">R$ ${((parseFloat(it.preco||it.price||0))*(it.quantidade||1)).toFixed(2)}</span></div>`).join('')}
            ${p.total_pedido?`<div style="display:flex;justify-content:space-between;font-size:12px;font-weight:700;padding:5px 0"><span style="color:var(--sb-text)">Total</span><span style="color:#10b981">R$ ${parseFloat(p.total_pedido).toFixed(2)}</span></div>`:''}
            ${p.forma_pagamento?`<div style="font-size:11px;color:var(--sb-text3);margin-top:2px">💳 ${p.forma_pagamento}</div>`:''}
          </div>`:''}
          ${p.codigo_confirmacao?`<div style="background:var(--surface2);border:1px solid var(--sb-border);border-radius:8px;padding:8px;text-align:center;margin-bottom:10px"><div style="font-size:9px;color:var(--sb-text3);font-weight:700;letter-spacing:.5px;margin-bottom:3px">CÓDIGO</div><div style="font-size:22px;font-weight:800;letter-spacing:8px;color:var(--sb-text)">${p.codigo_confirmacao}</div></div>`:''}
          ${loja?`<div style="background:var(--surface2);border-radius:8px;padding:10px;margin-bottom:10px">${_sec('🏪 Loja')}
            <div style="font-size:13px;font-weight:600;color:var(--sb-text);margin-bottom:3px">${loja.nome||'—'}</div>
            ${loja.telefone?`<div style="font-size:12px;margin-bottom:3px"><a href="https://wa.me/55${loja.telefone.replace(/\D/g,'')}" target="_blank" onclick="event.stopPropagation()" style="color:#25D366;font-weight:600;text-decoration:none">📞 ${loja.telefone}</a></div>`:''}
            ${loja.endereco?`<div style="font-size:11px"><a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(loja.endereco)}" target="_blank" onclick="event.stopPropagation()" style="color:#60a5fa;text-decoration:none">${loja.endereco}</a></div>`:''}
          </div>`:''}
          ${p.endereco_coleta&&p.endereco_coleta.trim().toLowerCase()!==(loja?.endereco||'').trim().toLowerCase()?`<div style="background:var(--surface2);border-radius:8px;padding:10px;margin-bottom:10px">${_sec('📦 Coleta')}
            <div style="font-size:11px;margin-bottom:2px"><a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.endereco_coleta)}" target="_blank" onclick="event.stopPropagation()" style="color:#60a5fa;text-decoration:none">${p.endereco_coleta}</a></div>
            ${p.contato_coleta?`<div style="font-size:12px;color:var(--sb-text2);margin-top:3px">👤 ${p.contato_coleta}</div>`:''}
            ${p.telefone_coleta?`<div style="font-size:12px;margin-top:2px"><a href="https://wa.me/55${p.telefone_coleta.replace(/\D/g,'')}" target="_blank" onclick="event.stopPropagation()" style="color:#25D366;font-weight:600;text-decoration:none">📞 ${p.telefone_coleta}</a></div>`:''}
          </div>`:''}
          <div style="background:var(--surface2);border-radius:8px;padding:10px;margin-bottom:10px">${_sec('👤 Cliente')}
            ${clienteNome?`<div style="font-size:13px;font-weight:600;color:var(--sb-text);margin-bottom:3px">${clienteNome}</div>`:''}
            ${telefone?`<div style="font-size:12px;margin-bottom:3px"><a href="https://wa.me/55${telefone.replace(/\D/g,'')}" target="_blank" onclick="event.stopPropagation()" style="color:#25D366;font-weight:600;text-decoration:none">${telefone}</a></div>`:''}
            ${(p.endereco_entrega||p.endereco)?`<div style="font-size:11px;margin-bottom:2px">📍 <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.endereco_entrega||p.endereco)}" target="_blank" onclick="event.stopPropagation()" style="color:#60a5fa;text-decoration:none">${p.endereco_entrega||p.endereco}</a></div>`:''}
            ${p.observacoes?`<div style="font-size:11px;color:var(--sb-text3);margin-top:4px;background:var(--surface);border-radius:5px;padding:4px 6px">💬 ${p.observacoes}</div>`:''}
          </div>
          ${motoboy?`<div style="background:var(--surface2);border-radius:8px;padding:10px;margin-bottom:10px">${_sec('🛵 Entregador')}
            <div style="display:flex;align-items:center;gap:8px">
              <div style="width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#1A56DB,#6366f1);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;color:#fff;flex-shrink:0">${mbIniciais}</div>
              <div style="flex:1;min-width:0">
                <div style="font-size:13px;font-weight:700;color:var(--sb-text)">${motoboy.nome||'—'}</div>
                ${motoboy.telefone?`<div style="font-size:11px;color:var(--sb-text2)">${motoboy.telefone}</div>`:''}
              </div>
              <div style="font-size:11px;color:var(--sb-text3);text-align:right;line-height:1.8;flex-shrink:0">
                ${p.gorjeta>0?`<div style="color:#f59e0b">🎁 R$ ${parseFloat(p.gorjeta).toFixed(2)}</div>`:''}
              </div>
            </div>
          </div>`:''}
          ${progressBar}
          <div style="display:flex;justify-content:space-between;align-items:center;font-size:11px;margin-bottom:10px">
            <span style="color:var(--sb-text3)">⏱ Previsão ${formatarHora(new Date(previsaoMs).toISOString())}</span>
            <span style="font-weight:700;color:${restanteMin>0?'#10b981':'#ef4444'}">${restanteMin>0?restanteMin+'min':'Atrasado'}</span>
          </div>
          ${p.agendado_para?`<div style="background:#fff7ed;border:1px solid #fed7aa;color:#f97316;border-radius:6px;padding:4px 10px;font-size:11px;font-weight:700;margin-bottom:8px;display:inline-block">⏰ Agendado ${formatarHora(p.agendado_para)}</div>`:''}
          <div style="display:flex;gap:6px;margin-bottom:8px">
            ${['retornando','chegou_destino'].includes(sk)?`<button onclick="event.stopPropagation();confirmarPagamento('${p.id}')" style="flex:1;background:linear-gradient(135deg,#10b981,#059669);color:#fff;border:none;border-radius:8px;padding:8px 6px;font-size:11px;font-weight:700;cursor:pointer;font-family:Inter,sans-serif">💰 Pagamento recebido</button>`:''}
            <button onclick="event.stopPropagation();_copiarRastreio('${p.id}')" style="flex:1;background:var(--surface2);color:var(--sb-text2);border:1px solid var(--sb-border);border-radius:8px;padding:8px 6px;font-size:11px;font-weight:600;cursor:pointer;font-family:Inter,sans-serif">🔗 Copiar rastreio</button>
          </div>
        </div>`:'';
      // ── CARD FECHADO ──────────────────────────────────────────────
      return `<div class="pd-card${isSel?' selected':''}" onclick="selecionarPedido('${p.id}')">
        <div style="display:flex;gap:10px;align-items:flex-start">
          <div onclick="event.stopPropagation();toggleSelecaoPedido('${p.id}',event)"
            style="width:64px;height:64px;min-width:64px;border-radius:12px;background:${isSel?'#0a3080':'transparent'};display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;transition:background .15s;user-select:none;color:#fff;padding:0;gap:3px;overflow:hidden">
            ${isSel?'<span style="font-size:22px;font-weight:900;width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:#0a3080">✓</span>':
              `<img src="https://letsgodeliverybr.github.io/painel/img/logo.png" style="width:100%;height:100%;object-fit:cover;display:block;">`
            }
          </div>
          <div style="flex:1;min-width:0;overflow:hidden">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:4px;margin-bottom:3px">
              <div style="display:flex;align-items:center;gap:5px;flex-shrink:0">
                <span style="font-size:15px;font-weight:800;color:var(--sb-text)">#${p.numero||p.id?.substring(0,6)}</span>
                <span style="font-size:11px;color:var(--sb-text3)">${horaC}</span>
              </div>
              <div style="display:flex;align-items:center;gap:3px;flex-shrink:0">
                <button onclick="event.stopPropagation();abrirEditarPedido('${p.id}')" title="Editar" style="background:#2a2a2a;border:0.5px solid #3A3A3A;border-radius:6px;padding:5px 7px;cursor:pointer;display:inline-flex;align-items:center;"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#aaa" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
                <button onclick="event.stopPropagation();abrirAlocarMotoboy('${p.id}')" title="Alocar entregador" style="background:#2a2a2a;border:0.5px solid #3A3A3A;border-radius:6px;padding:5px 7px;cursor:pointer;display:inline-flex;align-items:center;"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#aaa" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg></button>
                ${sk!=='finalizado'&&sk!=='cancelado'?`<button onclick="event.stopPropagation();marcarPedidoPronto('${p.id}','${sk}')" title="Marcar como pronto" style="background:#2a2a2a;border:0.5px solid #3A3A3A;border-radius:6px;padding:5px 7px;cursor:pointer;display:inline-flex;align-items:center;"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="${sk==='pronto'?'#e91e8c':'#aaa'}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></button>`:''}
                <span id="badge-wrapper-${p.id}" style="position:relative">
                  <span ${prontoAnim} onclick="event.stopPropagation();abrirDropdownStatus(event,'${p.id}')" style="display:inline-flex;align-items:center;gap:4px;padding:5px 12px;border-radius:20px;font-size:13px;font-weight:700;cursor:pointer;user-select:none;background:${corStatus(sk)}22;color:${corStatus(sk)};border:1px solid ${corStatus(sk)}55">${sk==='agendado'&&p.agendado_para?'⏰ '+formatarHora(p.agendado_para):getStatusLabel(p)} <span style="font-size:10px">▾</span></span>
                </span>
              </div>
            </div>
            ${clienteNome?`<div style="font-size:12px;color:var(--sb-text);font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-bottom:2px">👤 ${clienteNome}</div>`:''}
            <div style="font-size:11px;color:var(--sb-text3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">📍 ${(p.endereco||'—').slice(0,45)}${(p.endereco||'').length>45?'…':''}</div>
          </div>
        </div>
        ${expandido}
      </div>`;
    }).join('');
    const safeKey=key.replace(/['"]/g,'');
    const groupHeader='<div class="sb-group-dark" onclick="toggleGrupo(\''+safeKey+'\')" style="cursor:pointer;background:#1a3a5c !important"><span style="font-size:13px">🏪</span><span class="sb-group-name">'+grupo.nome+'</span><div style="display:flex;gap:3px;flex-wrap:wrap;flex:1">'+bubbles+'</div><span style="color:#FFFFFF !important;font-size:11px;flex-shrink:0;margin-left:4px">'+(colapsado?'▲':'▼')+'</span></div>';
    return '<div>'+groupHeader+'<div id="grupo-cards-'+safeKey+'" style="'+(colapsado?'display:none':'')+'">'+cards+'</div></div>';
  }).join('');
  const footer=document.getElementById('sidebar-disparar-footer');
  if(footer){
    if(_pedidosSelecionados.size>=2){
      footer.style.display='block';
      const btn=footer.querySelector('button');
      if(btn)btn.textContent=`🛵 Disparar Rota (${_pedidosSelecionados.size} pedidos) ++`;
    } else {
      footer.style.display='none';
    }
  }
}

function toggleSelecaoPedido(id,event){event.stopPropagation();if(_pedidosSelecionados.has(id))_pedidosSelecionados.delete(id);else _pedidosSelecionados.add(id);renderPedidosLista();}

async function dispararRota(){
  const ids=[..._pedidosSelecionados];
  if(ids.length<2)return;
  const p0=allPedidos.find(p=>p.id===ids[0]);
  const agora=new Date().toISOString();
  await db('rotas','POST',{loja_id:p0?.loja_id||null,pedidos:ids,status:'aguardando',entregador_id:null,raio_atual:2,tentativas_entregador:0,created_at:agora,updated_at:agora});
  _pedidosSelecionados.clear();
  renderPedidosLista();
}

function atualizarMarcadores(){
  Object.values(motoboyMarkers).forEach(m=>map.removeLayer(m));Object.values(pedidoMarkers).forEach(m=>map.removeLayer(m));Object.values(lojaMarkers).forEach(m=>map.removeLayer(m));Object.values(coletaMarkers).forEach(m=>map.removeLayer(m));
  motoboyMarkers={};pedidoMarkers={};lojaMarkers={};coletaMarkers={};
  const lojasVisiveis=currentPerfil==='loja'
    ?allLojas.filter(l=>l.id===currentUser?.loja_id)
    :_estadoLojas===2?[]:_estadoLojas===1?allLojas.filter(l=>allPedidos.some(p=>p.loja_id===l.id)):allLojas;
  console.log('[MAPA] perfil:',currentPerfil,'loja_id:',currentUser?.loja_id,'lojas visíveis:',lojasVisiveis.length);
  const _svgPin=`<svg width="38" height="48" viewBox="0 0 1272 1236" xmlns="http://www.w3.org/2000/svg"><g transform="translate(0,1236) scale(0.1,-0.1)" fill="#1A56DB" stroke="none"><path d="M6060 12169 c-456 -42 -996 -207 -1395 -426 -156 -85 -371 -227 -515 -339 -131 -101 -388 -348 -495 -474 -426 -503 -708 -1109 -810 -1741 -37 -231 -48 -380 -48 -634 1 -1054 379 -2092 1328 -3645 351 -575 771 -1203 1410 -2110 791 -1121 813 -1152 825 -1148 5 2 78 100 161 218 84 118 211 298 283 400 71 102 179 255 240 340 2066 2927 2744 4253 2862 5600 18 202 15 604 -6 775 -83 695 -316 1266 -748 1835 -199 261 -348 414 -586 597 -560 431 -1170 680 -1837 748 -157 16 -513 18 -669 4z m507 -2070 c300 -41 594 -175 832 -381 257 -222 446 -542 524 -888 18 -80 21 -128 21 -305 0 -180 -3 -225 -22 -311 -141 -648 -644 -1140 -1287 -1260 -150 -28 -422 -26 -572 4 -315 63 -597 215 -823 443 -135 137 -223 260 -310 434 -119 241 -155 397 -155 680 0 217 14 315 71 485 190 573 664 986 1249 1089 126 22 349 27 472 10z"/></g></svg>`;
  lojasVisiveis.forEach(l=>{const lat=l.latitude,lng=l.longitude;if(!lat||!lng)return;const icon=L.divIcon({html:_svgPin,iconSize:[38,48],iconAnchor:[19,48],className:''});const _lojaPopup=`<div style="font-family:Inter,sans-serif;background:#ffffff;color:#111827;padding:4px;min-width:160px;max-width:240px"><div style="font-weight:800;font-size:14px;color:#111827;margin-bottom:4px">🏪 ${l.nome||'Loja'}</div>${l.telefone?`<div style="font-size:11px;color:#374151;margin-bottom:4px">📞 <a href="https://wa.me/55${l.telefone.replace(/\D/g,'')}" target="_blank" style="color:#25D366;font-weight:600;text-decoration:none">${l.telefone}</a></div>`:''}<div style="font-size:11px;color:#374151">${l.endereco||'—'}</div></div>`;lojaMarkers[l.id]=L.marker([lat,lng],{icon}).addTo(map).bindPopup(_lojaPopup,{maxWidth:260});if(currentPerfil==='loja')map.setView([lat,lng],14);});
  const _statusAtivos=['aceito','chegou_local','chegou_destino','em_rota'];
  const motoboysFiltrados=_estadoMotoboys===2?[]:_estadoMotoboys===1?allMotoboys.filter(e=>e.disponivel&&!allPedidos.some(p=>(p.motoboy_id===e.id||p.entregador_id===e.id)&&_statusAtivos.includes(p.status_detalhado||p.status))):allMotoboys;
  motoboysFiltrados.forEach(e=>{const lat=e.lat,lng=e.lng;if(!lat||!lng)return;const temAtivo=allPedidos.some(p=>(p.motoboy_id===e.id||p.entregador_id===e.id)&&_statusAtivos.includes(p.status_detalhado||p.status));const cor=temAtivo?'#EF4444':e.disponivel?'#10B981':'#475569';const corViseira=temAtivo?'#991b1b':e.disponivel?'#065f46':'#1f2937';const _nr=(e.nome||'');const nome=(_nr.includes('@')?_nr.split('@')[0]:_nr.split(' ')[0])||'Moto';const svgHelmet=`<svg width="48" height="48" viewBox="0 0 248 243" xmlns="http://www.w3.org/2000/svg"><circle cx="124" cy="121" r="118" fill="none" stroke="white" stroke-width="2"/><g transform="translate(0,243) scale(0.1,-0.1)" stroke="none"><path fill="${cor}" d="M1375 2020 c322 -78 591 -300 702 -578 19 -48 41 -100 48 -117 22 -51 62 -195 85 -305 12 -58 35 -153 51 -213 46 -167 46 -175 0 -316 -49 -147 -105 -251 -183 -334 l-57 -61 -113 38 c-62 21 -189 67 -283 101 -149 55 -254 88 -440 140 -27 8 -97 24 -155 35 -58 11 -135 27 -172 35 -36 8 -139 18 -227 23 -175 9 -193 15 -205 73 -5 28 -33 86 -133 280 -146 281 -162 550 -48 788 25 51 55 106 66 123 19 26 20 33 9 71 -24 86 -24 84 7 90 15 2 117 28 226 56 327 84 428 101 592 97 100 -3 166 -10 230 -26z"/><path fill="${corViseira}" d="M836 1426 c-150 -65 -39 -337 188 -460 353 -192 863 -329 1121 -301 l67 7 -7 36 c-27 154 -119 530 -133 544 -4 4 -70 12 -147 18 -267 20 -557 62 -711 101 -43 11 -105 27 -137 35 -86 22 -212 32 -241 20z"/></g></svg>`;const icon=L.divIcon({html:`<div style="display:flex;flex-direction:column;align-items:center">${svgHelmet}<div style="background:rgba(0,0,0,0.55);color:white;font-size:10px;font-weight:700;padding:1px 4px;border-radius:4px;margin-top:2px;white-space:nowrap">${nome}</div></div>`,iconSize:[64,64],iconAnchor:[32,64],className:''});const _statusAtivosPop=['aceito','chegou_local','chegou_destino','em_rota','retornando'];const _ped=allPedidos.filter(p=>(p.motoboy_id===e.id||p.entregador_id===e.id)&&_statusAtivosPop.includes(p.status_detalhado||p.status));const _badges=_ped.map(p=>`<span onclick="map.closePopup();_irParaPedido('${p.id}')" style="display:inline-block;background:${getStatusCor(p)};color:#fff;font-size:11px;font-weight:700;padding:4px 10px;border-radius:20px;cursor:pointer;margin:2px 2px 0 0">#${p.numero||p.id?.substring(0,6)}</span>`).join('');const _cpfPopup=e.cpf?`<div style="font-size:11px;color:#374151;margin-bottom:4px">🪪 ${e.cpf}</div>`:'';const _telPopup=e.telefone?`<div style="font-size:11px;color:#374151;margin-bottom:${_ped.length?8:4}px">📞 <a href="https://wa.me/55${e.telefone.replace(/\D/g,'')}" target="_blank" style="color:#25D366;font-weight:600;text-decoration:none">${e.telefone}</a></div>`:'';const _popupHtml=`<div style="font-family:Inter,sans-serif;background:#ffffff;color:#111827;padding:4px;min-width:180px;max-width:260px"><div style="font-weight:800;font-size:14px;color:#111827;margin-bottom:4px">${e.nome||'Motoboy'}</div>${_cpfPopup}${_telPopup}${_ped.length?`<div style="display:flex;flex-wrap:wrap;gap:4px">${_badges}</div>`:''}</div>`;motoboyMarkers[e.id]=L.marker([lat,lng],{icon}).addTo(map).bindPopup(_popupHtml,{maxWidth:280});});
  allPedidos.forEach(p=>{if(!p.latitude||!p.longitude)return;const cor=getStatusCor(p),num=p.numero_loja||p.numero||p.id?.substring(0,4);const icon=L.divIcon({html:`<div style="display:flex;flex-direction:column;align-items:center"><div style="background:${cor};color:white;font-size:11px;font-weight:800;padding:4px 7px;border-radius:6px;box-shadow:0 2px 8px rgba(0,0,0,.5);white-space:nowrap;border:2px solid white">#${num}</div><div style="width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:6px solid ${cor}"></div></div>`,iconSize:[50,30],iconAnchor:[25,30],className:''});const _lojaPopupNome=allLojas.find(l=>l.id===p.loja_id)?.nome||'';
pedidoMarkers[p.id]=L.marker([p.latitude,p.longitude],{icon}).addTo(map).bindPopup(`<div style="font-family:Inter,sans-serif;min-width:160px"><b style="font-size:13px">#${num}</b>${_lojaPopupNome?` <span style="font-size:11px;color:#6b7280">· ${_lojaPopupNome}</span>`:''}<br><span style="font-size:11px;color:#374151">${p.endereco||'—'}</span><br><span style="color:#10b981;font-weight:700">Taxa: R$ ${_calcTaxaLoja(p).toFixed(2)}</span>${p.valor?` · Valor: R$ ${parseFloat(p.valor).toFixed(2)}`:''}`);
const _endColetaNorm=(p.endereco_coleta||'').trim().toLowerCase();const _lojaColeta=allLojas.find(l=>l.id===p.loja_id);const _endLojaNorm=(_lojaColeta?.endereco||'').trim().toLowerCase();console.log('[COLETA] #'+num,{endereco_coleta:p.endereco_coleta,latitude_coleta:p.latitude_coleta,longitude_coleta:p.longitude_coleta,endColetaNorm:_endColetaNorm,endLojaNorm:_endLojaNorm,condicao:!!(_endColetaNorm&&_endColetaNorm!==_endLojaNorm)});if(_endColetaNorm&&_endColetaNorm!==_endLojaNorm){const _addColetaMarker=(lat,lng)=>{if(!map)return;console.log('[COLETA] adicionando pin preto #'+num,'em',lat,lng);const iconColeta=L.divIcon({html:`<div style="display:flex;flex-direction:column;align-items:center"><div style="background:#111827;color:white;font-size:11px;font-weight:800;padding:4px 7px;border-radius:6px;box-shadow:0 2px 8px rgba(0,0,0,.7);white-space:nowrap;border:2px solid white">#${num}</div><div style="width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:6px solid #111827"></div></div>`,iconSize:[50,30],iconAnchor:[25,30],className:''});coletaMarkers[p.id]=L.marker([lat,lng],{icon:iconColeta}).addTo(map).bindPopup(`<div style="font-family:Inter,sans-serif;min-width:160px"><b style="font-size:13px">#${num}</b> <span style="font-size:10px;background:#111827;color:white;padding:1px 5px;border-radius:3px;margin-left:4px">Coleta</span><br><span style="font-size:11px;color:#374151">${p.endereco_coleta}</span></div>`);};if(p.latitude_coleta&&p.longitude_coleta){_addColetaMarker(p.latitude_coleta,p.longitude_coleta);}else{const _mapSnap=map;geocodificarEndereco(p.endereco_coleta).then(geo=>{if(geo&&map===_mapSnap)_addColetaMarker(geo.lat,geo.lng);else console.warn('[COLETA] sem resultado geocoding para:',p.endereco_coleta);}).catch(e=>console.error('[COLETA] geocodificação falhou:',e));}}
});
}

function selecionarPedido(id){selectedPedidoId=selectedPedidoId===id?null:id;renderPedidosLista();if(selectedPedidoId){const p=allPedidos.find(x=>x.id===selectedPedidoId);if(map&&p&&p.latitude&&p.longitude)map.setView([p.latitude,p.longitude],15,{animate:true});}}
function fecharDetalhe(){selectedPedidoId=null;renderPedidosLista();}
function _irParaPedido(id){selecionarPedido(id);setTimeout(()=>destacarMarcador(id),450);}
function _irParaPedidoHistorico(numero){goTab('pedidos');setTimeout(()=>{const el=document.getElementById('fp-numero');if(el){el.value=numero;_buscarPedidosAdmin();}},800);}
function destacarMarcador(id){
  const marker=pedidoMarkers[id];if(!marker)return;
  const el=marker.getElement();if(!el)return;
  const inner=el.firstElementChild;if(!inner)return;
  el.style.zIndex=9999;let tick=0;
  const t=setInterval(()=>{
    inner.style.transform=tick%2===0?'scale(1.7)':'scale(1)';
    inner.style.transition='transform 0.18s ease';
    if(++tick>=6){clearInterval(t);inner.style.transform='';inner.style.transition='';el.style.zIndex='';}
  },200);
}

function abrirEditarPedido(pedidoId){
  const p=allPedidos.find(x=>x.id===pedidoId)||_tabelaPedidosDia.find(x=>x.id===pedidoId);if(!p)return;
  _epRetornoAtivo=!!(p.com_retorno);_epGeo=null;_epPedidoAtual=p;
  let modal=document.getElementById('modal-editar-pedido');
  if(!modal){modal=document.createElement('div');modal.id='modal-editar-pedido';modal.className='modal-overlay';document.body.appendChild(modal);}
  const temColeta=!!(p.endereco_coleta||p.contato_coleta||p.telefone_coleta);
  const temAgend=!!(p.agendado_para);
  const agendVal=temAgend?_agendadoInputBrasilia(p.agendado_para):'';
  const esc=v=>(v||'').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  modal.innerHTML=`<div class="modal" style="max-width:560px"><div class="modal-header"><span class="modal-title">✏️ Editar Pedido #${p.numero||pedidoId.substring(0,6)}</span><button class="modal-close" onclick="document.getElementById('modal-editar-pedido').classList.remove('open')">✕</button></div><div class="modal-body" style="max-height:78vh;overflow-y:auto">
<div class="form-row">
  <div class="fi"><label>Nº Pedido</label><input id="ep-numero" value="${esc(p.numero)}"/></div>
  <div class="fi"><label>Cliente</label><input id="ep-cliente" value="${esc(p.cliente||p.nome_cliente)}"/></div>
</div>
<div class="form-row">
  <div class="fi"><label>Telefone</label><input id="ep-telefone" value="${esc(p.telefone)}"/></div>
  <div class="fi"><label>Distância (km)</label><input id="ep-km" value="${p.distancia_km||''}" readonly style="background:var(--surface2);color:#60a5fa;font-weight:700;cursor:default"/></div>
</div>
<div class="form-row full"><div class="fi"><label>Endereço de entrega</label><div style="display:flex;gap:6px"><input id="ep-endereco" value="${esc(p.endereco)}" style="flex:1"/><button type="button" onclick="_epRecalcularTaxas()" style="background:#1A56DB;color:#fff;border:none;border-radius:8px;padding:0 12px;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap;font-family:Inter,sans-serif">📍 Recalcular</button></div></div></div>
<div class="form-row">
  <div class="fi"><label>Valor do Pedido (R$)</label><input type="number" id="ep-valor" value="${p.valor||0}" step="0.01"/></div>
  <div class="fi"><label>Taxa entrega (R$)</label><input type="number" id="ep-taxa" value="${p.taxa_entrega||0}" step="0.01"/></div>
</div>
<div class="form-row">
  <div class="fi"><label>Gorjeta (R$)</label><input type="number" id="ep-gorjeta" value="${p.gorjeta||0}" step="0.50"/></div>
  <div class="fi"><label>Retorno</label>
    <div id="ep-retorno-btn" onclick="_epToggleRetorno()" style="display:flex;align-items:center;gap:8px;padding:10px 14px;border-radius:10px;cursor:pointer;background:${p.com_retorno?'#1A56DB':'#3a3a3a'};transition:background .15s;user-select:none">
      <span style="font-size:16px">${p.com_retorno?'↩':'—'}</span>
      <span id="ep-retorno-lbl" style="font-size:13px;font-weight:600;color:${p.com_retorno?'#ffffff':'#888888'}">${p.com_retorno?'Com retorno':'Sem retorno'}</span>
    </div>
  </div>
</div>
<div class="form-row">
  <div class="fi"><label>Taxa Motoboy (R$)</label><input type="number" id="ep-taxa-motoboy" value="${p.taxa_motoboy!=null?parseFloat(p.taxa_motoboy).toFixed(2):''}" placeholder="Auto" step="0.01"/></div>
  <div class="fi"><label>Preço Dinâmico (R$)</label><input type="number" id="ep-preco-dinamico" value="${parseFloat(p.preco_dinamico)||''}" placeholder="0.00" step="0.01"/></div>
</div>
${p.taxa_extra!=null?`<div class="form-row"><div class="fi"><label>Taxa Extra (R$)</label><input type="number" id="ep-taxa-extra" value="${parseFloat(p.taxa_extra||0).toFixed(2)}" step="0.01"/></div><div class="fi"></div></div>`:''}
<div class="form-row full"><div class="fi"><label>Observações</label><textarea id="ep-descricao">${esc(p.descricao)}</textarea></div></div>
<div style="border-top:1px solid var(--border);margin:12px 0 10px;padding-top:10px">
  <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px;color:var(--text2);font-weight:600">
    <input type="checkbox" id="ep-coleta-toggle" ${temColeta?'checked':''} onchange="_epToggleColeta()" style="width:16px;height:16px;cursor:pointer;accent-color:#1A56DB"/>
    📦 Coleta em outro endereço
  </label>
  <div id="ep-coleta-campos" style="display:${temColeta?'block':'none'};margin-top:10px;padding:10px;background:var(--surface2);border-radius:8px">
    <div class="form-row full"><div class="fi"><label>Endereço de coleta</label><input id="ep-endereco-coleta" value="${esc(p.endereco_coleta)}" placeholder="Rua, número, bairro"/></div></div>
    <div class="form-row">
      <div class="fi"><label>Contato na coleta</label><input id="ep-contato-coleta" value="${esc(p.contato_coleta)}" placeholder="Nome"/></div>
      <div class="fi"><label>Telefone da coleta</label><input id="ep-telefone-coleta" value="${esc(p.telefone_coleta)}" placeholder="(16) 99999-9999"/></div>
    </div>
  </div>
</div>
<div style="border-top:1px solid var(--border);margin:0 0 10px;padding-top:10px">
  <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px;color:var(--text2);font-weight:600">
    <input type="checkbox" id="ep-agendar-toggle" ${temAgend?'checked':''} onchange="_epToggleAgendar()" style="width:16px;height:16px;cursor:pointer;accent-color:#f97316"/>
    ⏰ Agendar pedido
  </label>
  <div id="ep-agendar-campos" style="display:${temAgend?'block':'none'};margin-top:10px;padding:10px;background:var(--surface2);border-radius:8px">
    <div class="form-row full"><div class="fi"><label>Data e hora</label><input type="datetime-local" id="ep-agendado-para" value="${agendVal}" style="background:var(--surface);color:var(--text);border:1px solid var(--border);border-radius:8px;padding:9px 12px;width:100%;font-family:Inter,sans-serif;font-size:14px"/></div></div>
  </div>
</div>
<div id="ep-recalc-info" style="font-size:12px;color:var(--text2);min-height:14px;margin:2px 0 4px"></div>
<div id="ep-feedback" style="margin-top:4px"></div>
</div><div class="modal-footer"><button class="btn-modal-cancel" onclick="document.getElementById('modal-editar-pedido').classList.remove('open')">Cancelar</button><button onclick="salvarEdicaoPedido('${pedidoId}')" style="background:#10B981;border:none;border-radius:10px;padding:10px 24px;color:#fff;font-weight:700;cursor:pointer;font-family:Inter,sans-serif;font-size:14px">✓ Salvar</button></div></div>`;
  modal.classList.add('open');
}
let _npRetornoAtivo=false;
let _npPdC=0, _npPdE=0; // PD capturado no último calcularTaxaAuto, reutilizado em criarPedido
function _npToggleRetorno(){
  _npRetornoAtivo=!_npRetornoAtivo;
  const btn=document.getElementById('np-retorno-btn');
  const lbl=document.getElementById('np-retorno-lbl');
  if(btn)btn.style.background=_npRetornoAtivo?'#1A56DB':'#3a3a3a';
  if(lbl){lbl.textContent=_npRetornoAtivo?'Com retorno':'Sem retorno';lbl.style.color=_npRetornoAtivo?'#fff':'#888888';}
  calcularTaxaAuto();
}
let _epRetornoAtivo=false;
let _epGeo=null,_epPedidoAtual=null;
function _epToggleRetorno(){
  _epRetornoAtivo=!_epRetornoAtivo;
  const btn=document.getElementById('ep-retorno-btn');
  const lbl=document.getElementById('ep-retorno-lbl');
  if(btn)btn.style.background=_epRetornoAtivo?'#1A56DB':'#3a3a3a';
  if(lbl){lbl.textContent=_epRetornoAtivo?'Com retorno':'Sem retorno';lbl.style.color=_epRetornoAtivo?'#fff':'#888888';}
}
function _epToggleColeta(){
  const on=document.getElementById('ep-coleta-toggle')?.checked;
  const c=document.getElementById('ep-coleta-campos');if(c)c.style.display=on?'block':'none';
}
function _epToggleAgendar(){
  const on=document.getElementById('ep-agendar-toggle')?.checked;
  const c=document.getElementById('ep-agendar-campos');if(c)c.style.display=on?'block':'none';
  if(on){const inp=document.getElementById('ep-agendado-para');if(inp&&!inp.value){inp.value=_defaultAgendadoBrasilia(30);}}
}
async function _epRecalcularTaxas(){
  const endereco=document.getElementById('ep-endereco')?.value||'';
  if(!endereco)return;
  const info=document.getElementById('ep-recalc-info');
  if(info)info.textContent='📍 Geocodificando...';
  const geo=await geocodificarEndereco(endereco);
  if(!geo){if(info)info.textContent='❌ Endereço não encontrado';return;}
  _epGeo=geo;
  const p=_epPedidoAtual||{};
  const lojaId=p.loja_id||null;
  let latOrigem=-21.1775,lngOrigem=-47.8103;
  const lojaData=allLojas.find(l=>l.id===lojaId);
  if(lojaData?.latitude){latOrigem=parseFloat(lojaData.latitude);lngOrigem=parseFloat(lojaData.longitude);}
  else if(lojaId){const _r=await db('lojas','GET',null,`?id=eq.${lojaId}&select=latitude,longitude&limit=1`);if(_r&&_r[0]?.latitude){latOrigem=parseFloat(_r[0].latitude);lngOrigem=parseFloat(_r[0].longitude);}}
  const distKm=parseFloat(calcularDistancia(latOrigem,lngOrigem,geo.lat,geo.lng).toFixed(2));
  _epGeo.distKm=distKm;
  const kmEl=document.getElementById('ep-km');if(kmEl)kmEl.value=distKm;
  const gorjeta=parseFloat(document.getElementById('ep-gorjeta')?.value)||0;
  const pd=parseFloat(document.getElementById('ep-preco-dinamico')?.value)||0;
  const [faixasCob,faixasPag]=await Promise.all([_getFaixasCobranca(lojaId),_getFaixasPagamento(lojaId)]);
  const sim={distancia_km:distKm,com_retorno:_epRetornoAtivo,gorjeta,preco_dinamico:pd,loja_id:lojaId};
  const novaTaxaMoto=_calcTaxaMotoboy(sim,faixasPag.length?faixasPag:undefined);
  const novaTaxaEntrega=_calcTaxaLoja(sim,faixasCob.length?faixasCob:undefined);
  if(novaTaxaMoto!=null){const el=document.getElementById('ep-taxa-motoboy');if(el)el.value=novaTaxaMoto.toFixed(2);}
  if(novaTaxaEntrega>0){const el=document.getElementById('ep-taxa');if(el)el.value=novaTaxaEntrega.toFixed(2);}
  if(info)info.textContent=`✅ ${distKm}km · Taxa loja: R$ ${(novaTaxaEntrega||0).toFixed(2)} · Motoboy: R$ ${(novaTaxaMoto||0).toFixed(2)}`;
}
async function salvarEdicaoPedido(pedidoId){
  const fb=document.getElementById('ep-feedback');if(fb)fb.innerHTML='<div style="color:var(--text2);font-size:13px">⏳ Salvando...</div>';
  const coletaOn=document.getElementById('ep-coleta-toggle')?.checked;
  const agendarOn=document.getElementById('ep-agendar-toggle')?.checked;
  const agendadoParaVal=agendarOn?document.getElementById('ep-agendado-para')?.value:null;
  const _epTaxaMotoEl=document.getElementById('ep-taxa-motoboy');
  const _epPdEl=document.getElementById('ep-preco-dinamico');
  const _epTaxaExtraEl=document.getElementById('ep-taxa-extra');
  const update={
    cliente:document.getElementById('ep-cliente')?.value||'',
    endereco:document.getElementById('ep-endereco')?.value||'',
    valor:parseFloat(document.getElementById('ep-valor')?.value)||0,
    taxa_entrega:parseFloat(document.getElementById('ep-taxa')?.value)||0,
    gorjeta:parseFloat(document.getElementById('ep-gorjeta')?.value)||0,
    com_retorno:_epRetornoAtivo,
    taxa_motoboy:_epTaxaMotoEl?.value!==''?parseFloat(_epTaxaMotoEl.value):null,
    preco_dinamico:parseFloat(_epPdEl?.value)||0,
    numero:document.getElementById('ep-numero')?.value||'',
    descricao:document.getElementById('ep-descricao')?.value||'',
    telefone:document.getElementById('ep-telefone')?.value||null,
    endereco_coleta:coletaOn?(document.getElementById('ep-endereco-coleta')?.value||null):null,
    contato_coleta:coletaOn?(document.getElementById('ep-contato-coleta')?.value||null):null,
    telefone_coleta:coletaOn?(document.getElementById('ep-telefone-coleta')?.value||null):null,
    agendado_para:agendarOn&&agendadoParaVal?new Date(agendadoParaVal).toISOString():null,
    updated_at:new Date().toISOString(),
  };
  if(_epTaxaExtraEl)update.taxa_extra=parseFloat(_epTaxaExtraEl.value)||0;
  if(_epGeo?.distKm){update.latitude=_epGeo.lat;update.longitude=_epGeo.lng;update.distancia_km=_epGeo.distKm;}
  if(agendarOn&&agendadoParaVal){update.status='agendado';update.status_detalhado='agendado';}
  const res=await dbPatch('pedidos',update,`?id=eq.${pedidoId}`);
  if(res===null){if(fb)fb.innerHTML='<div style="color:var(--red);font-size:13px">❌ Erro ao salvar.</div>';showNotif('❌ Erro ao salvar pedido','','var(--red)');return;}
  await logAcao('editar_pedido',{pedido_id:pedidoId});
  // Recalcular taxa_entrega localmente usando _calcTaxaLoja
  const pedidoAtual=allPedidos.find(x=>x.id===pedidoId)||_tabelaPedidosDia.find(x=>x.id===pedidoId);
  const pedidoMerge={...(pedidoAtual||{}), ...update};
  const novaTaxa=_calcTaxaLoja(pedidoMerge);
  if(novaTaxa>0){
    await dbPatch('pedidos',{taxa_entrega:novaTaxa,updated_at:new Date().toISOString()},`?id=eq.${pedidoId}`);
    update.taxa_entrega=novaTaxa;
  }
  const ai=allPedidos.findIndex(x=>x.id===pedidoId);if(ai>=0)Object.assign(allPedidos[ai],update);
  const ti=_tabelaPedidosDia.findIndex(x=>x.id===pedidoId);if(ti>=0)Object.assign(_tabelaPedidosDia[ti],update);
  renderPedidosLista();renderTabelaMapa();
  if(fb)fb.innerHTML='<div style="color:var(--green);font-size:13px">✅ Salvo!</div>';showNotif('✅ Pedido atualizado!','');
  setTimeout(()=>{document.getElementById('modal-editar-pedido')?.classList.remove('open');atualizarTudo();},1500);
}

async function abrirAlocarMotoboy(pedidoId){
  const p=allPedidos.find(x=>x.id===pedidoId);if(!p)return;
  const _lojaAloc=allLojas.find(l=>l.id===p.loja_id);
  if(!_lojaAloc?.tabela_cobranca_id||!_lojaAloc?.tabela_pagamento_id){
    alert('Esta loja não tem tabela de cobrança/pagamento cadastrada. Configure em Cadastros → Lojas antes de alocar.');
    return;
  }
  const motoboys=await db('entregadores','GET',null,'?disponivel=eq.true&order=nome.asc');
  let modal=document.getElementById('modal-alocar-motoboy');
  if(!modal){modal=document.createElement('div');modal.id='modal-alocar-motoboy';modal.className='modal-overlay';document.body.appendChild(modal);}
  const listaMotoboys=motoboys.length===0?`<div style="text-align:center;padding:24px;color:var(--text3)"><div style="font-size:32px;margin-bottom:8px">🛵</div>Nenhum motoboy online</div>`:motoboys.map(m=>`<div onclick="alocarMotoboy('${pedidoId}','${m.id}','${(m.nome||'').replace(/'/g,"\\'")}',this)" style="display:flex;align-items:center;gap:12px;padding:12px 16px;border-radius:10px;cursor:pointer;border:1px solid var(--border);margin-bottom:8px;background:var(--surface2);" onmouseover="this.style.borderColor='var(--accent)'" onmouseout="this.style.borderColor='var(--border)'"><div style="width:36px;height:36px;background:#22c55e;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:18px">🛵</div><div style="flex:1"><div style="font-weight:700;color:var(--text);font-size:14px">${m.nome||'—'}</div><div style="font-size:11px;color:var(--text2)">${m.telefone||'Online'}</div></div><div style="background:#22c55e20;color:#22c55e;font-size:10px;font-weight:700;padding:3px 8px;border-radius:20px">Online</div></div>`).join('');
  modal.innerHTML=`<div class="modal"><div class="modal-header"><span class="modal-title">🛵 Alocar Motoboy — #${p.numero||pedidoId.substring(0,6)}</span><button class="modal-close" onclick="document.getElementById('modal-alocar-motoboy').classList.remove('open')">✕</button></div><div class="modal-body"><div style="background:var(--surface2);border-radius:8px;padding:10px 14px;margin-bottom:16px;font-size:13px">📍 ${p.endereco||'—'} · <span style="color:var(--green);font-weight:700">R$ ${(p.valor||0).toFixed(2)}</span></div><div style="font-size:11px;color:var(--text2);text-transform:uppercase;letter-spacing:1px;font-weight:600;margin-bottom:10px">Motoboys disponíveis (${motoboys.length})</div>${listaMotoboys}</div></div>`;
  modal.classList.add('open');
}
async function alocarMotoboy(pedidoId,motoboyId,motoboyNome,el){
  el.style.background='#1A56DB20';el.style.borderColor='var(--accent)';
  const _p=allPedidos.find(x=>x.id===pedidoId);
  const taxaMotoboy=_p?(_calcTaxaMotoboy(_p)??parseFloat(_p.taxa_entrega||0)):0;
  const _patch={motoboy_id:motoboyId,status:'aceito',status_detalhado:'aceito',aceito_em:new Date().toISOString(),updated_at:new Date().toISOString(),taxa_entrega_motoboy:taxaMotoboy};
  await db('pedidos','PATCH',_patch,`?id=eq.${pedidoId}`);
  await logAcao('alocar_motoboy',{pedido_id:pedidoId,motoboy_id:motoboyId,motoboy_nome:motoboyNome,taxa_motoboy:taxaMotoboy});
  showNotif('✅ Motoboy alocado!',`${motoboyNome} foi designado`);
  document.getElementById('modal-alocar-motoboy')?.classList.remove('open');await atualizarTudo();
}

function _parsearEnderecoNumerado(val){
  // Aceita "Rua X, 101" ou "Rua X 101 Bairro"
  const m=val.match(/^(.+?)[,\s]+(\d+)(.*)/);
  if(!m)return null;
  const rua=m[1].trim(),numero=m[2].trim(),resto=m[3].replace(/^[,\s]+/,'').trim();
  const q=encodeURIComponent(`${numero} ${rua}, Brasil`);
  return{numero,rua,resto,q};
}
function _labelComNumero(res,numero){
  const a=res.address||{};
  const road=a.road||a.pedestrian||a.footway||a.street||a.path||'';
  const num=a.house_number||numero||'';
  const bairro=a.suburb||a.neighbourhood||a.city_district||a.quarter||a.village||'';
  const cidade=a.city||a.town||a.municipality||'';
  const rua=road?(num?`${road}, ${num}`:road):'';
  const local=[bairro,cidade].filter(Boolean).join(', ');
  return[rua,local].filter(Boolean).join(' - ')||res.display_name.split(',').slice(0,4).join(',').trim();
}
async function geocodificarEndereco(endereco,cidade='',estado=''){
  const GMAPS_KEY='AIzaSyD8GqczdF6y70eVVlTWnKGNlrpKXpqyqqs';
  const _norm=s=>s.replace(/[()[\]{}]/g,' ').replace(/\bnº?\.\s*/gi,'').replace(/\s+/g,' ').trim();
  const base=_norm(endereco);
  const sufixo=[cidade,estado,'Brasil'].filter(Boolean).join(', ');
  const query=`${base}${sufixo?', '+sufixo:''}`;
  // Google Geocoding como primário
  try{
    const r=await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&region=br&language=pt-BR&key=${GMAPS_KEY}`);
    const d=await r.json();
    if(d?.results?.length){
      const res=d.results[0];
      return{lat:res.geometry.location.lat,lng:res.geometry.location.lng,display:res.formatted_address};
    }
  }catch(e){}
  // Fallback: Nominatim
  const NOM='https://nominatim.openstreetmap.org/search';
  const HDR={'Accept-Language':'pt-BR','User-Agent':'LetsGoDelivery/1.0'};
  try{
    const r=await fetch(`${NOM}?q=${encodeURIComponent(query)}&format=json&limit=1&addressdetails=1&countrycodes=br`,{headers:HDR});
    const d=await r.json();
    if(d?.length)return{lat:parseFloat(d[0].lat),lng:parseFloat(d[0].lon),display:d[0].display_name};
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
  const telefonePedido=(document.getElementById('np-telefone')||{}).value||'';
  const taxaInput=parseFloat((document.getElementById('np-taxa')||{}).value)||0;
  const gorjeta=parseFloat((document.getElementById('np-gorjeta')||{}).value)||0;
  const pontos=parseInt((document.getElementById('np-pontos')||{}).value)||4;
  const lojaIdSel=document.getElementById('np-loja-id')?.value||currentUser?.loja_id||null;
  const coletaOn=document.getElementById('np-coleta-toggle')?.checked;
  const enderecoColeta=coletaOn?(document.getElementById('np-endereco-coleta')?.value||''):'';
  const contatoColeta=coletaOn?(document.getElementById('np-contato-coleta')?.value||''):'';
  const telefoneColeta=coletaOn?(document.getElementById('np-telefone-coleta')?.value||''):'';
  const agendarOn=document.getElementById('np-agendar-toggle')?.checked;
  const agendadoParaVal=agendarOn?document.getElementById('np-agendado-para')?.value:null;
  if(!endereco){showNotif('Erro','Endereço obrigatório','var(--red)');return;}
  if(currentPerfil==='adm'&&!lojaIdSel){showNotif('Erro','Selecione a loja','var(--red)');return;}
  if(agendarOn&&!agendadoParaVal){showNotif('Erro','Informe data/hora do agendamento','var(--red)');return;}
  const fb=document.getElementById('np-feedback');
  if(fb)fb.innerHTML='<div style="color:var(--text2);font-size:13px">📍 Localizando endereço...</div>';
  const geo=await geocodificarEndereco(endereco);
  if(!geo){if(fb)fb.innerHTML='<div style="color:var(--red);font-size:13px">❌ Endereço não encontrado. Verifique e tente novamente.</div>';return;}
  const agora=new Date().toISOString();
  const finalLojaId=lojaIdSel;
  let latLoja=-21.1775,lngLoja=-47.8103;
  if(finalLojaId){const lojaData=await db('lojas','GET',null,`?id=eq.${finalLojaId}`);if(lojaData&&lojaData[0]?.latitude){latLoja=lojaData[0].latitude;lngLoja=lojaData[0].longitude;}}
  let latOrigem=latLoja,lngOrigem=lngLoja,origemUsada='loja',geoColeta=null;
  if(enderecoColeta){geoColeta=await geocodificarEndereco(enderecoColeta);if(geoColeta){latOrigem=geoColeta.lat;lngOrigem=geoColeta.lng;origemUsada='coleta';}}
  const distKm=parseFloat(calcularDistancia(latOrigem,lngOrigem,geo.lat,geo.lng).toFixed(2));
  console.log('[criarPedido] origem_usada='+origemUsada,'lat_origem='+latOrigem,'lng_origem='+lngOrigem,'lat_destino='+geo.lat,'lng_destino='+geo.lng,'distancia_km='+distKm);
  if(distKm>32){if(fb)fb.innerHTML='';alert('Para distâncias maiores que 32km, procure o Expansão responsável da região.');return;}
  const [_faixasLojaPed,_faixasPagNp,{cliente:_pdC,entregador:_pdE,origemCliente:_pdOrigemNp}]=await Promise.all([_getFaixasCobranca(finalLojaId),_getFaixasPagamento(finalLojaId),_fetchPdAtual(finalLojaId)]);
  const taxaCalculada=_faixasLojaPed.length?_calcTaxaLoja({distancia_km:distKm,com_retorno:_npRetornoAtivo,preco_dinamico:_pdC,loja_id:finalLojaId},_faixasLojaPed):Math.round((_pdC||0)*100)/100;
  // se há coleta, sempre recalcula (preview pode ter usado distância da loja por engano)
  const taxa=taxaInput>0&&!enderecoColeta?taxaInput:taxaCalculada;
  const taxaMotoboy=_calcTaxaMotoboy({distancia_km:distKm,com_retorno:_npRetornoAtivo,gorjeta:gorjeta,preco_dinamico:_pdE,loja_id:finalLojaId},_faixasPagNp)||taxa||null;
  const _faixaAplicadaNp=_faixasLojaPed.find(f=>distKm<=parseFloat(f.km_ate))||_faixasLojaPed[_faixasLojaPed.length-1];
  console.log(`[criarPedido] origem_usada=${origemUsada} distancia_km=${distKm} faixa_aplicada=km_ate:${_faixaAplicadaNp?.km_ate||'?'} pd_cliente=${_pdC}(${_pdOrigemNp}) taxa_entrega=${taxa} taxa_motoboy=${taxaMotoboy}`);
  if(fb)fb.innerHTML='<div style="color:var(--text2);font-size:13px">⏳ Criando pedido...</div>';
  const statusInicial=agendarOn?'agendado':'recebido';
  const pedido={numero:String(numero),numero_loja:String(numero),endereco,valor,descricao,cliente,telefone:telefonePedido||null,status:statusInicial,status_detalhado:statusInicial,origem:currentPerfil==='loja'?'loja':'backend',loja_id:finalLojaId,latitude:geo.lat,longitude:geo.lng,taxa_entrega:taxa,taxa_motoboy:taxaMotoboy,gorjeta,pontos,distancia_km:distKm,com_retorno:_npRetornoAtivo,preco_dinamico:_pdC,preco_dinamico_origem:_pdOrigemNp||null,recebido_em:agendarOn?null:agora,codigo_confirmacao:null};
  if(enderecoColeta)pedido.endereco_coleta=enderecoColeta;
  if(geoColeta){pedido.latitude_coleta=geoColeta.lat;pedido.longitude_coleta=geoColeta.lng;}
  if(contatoColeta)pedido.contato_coleta=contatoColeta;
  if(telefoneColeta)pedido.telefone_coleta=telefoneColeta;
  if(agendarOn&&agendadoParaVal)pedido.agendado_para=new Date(agendadoParaVal).toISOString();
  const result=await db('pedidos','POST',pedido);
  await logAcao('criar_pedido',{numero,endereco,valor,origem:currentPerfil,loja_id:finalLojaId,agendado:agendarOn||false});
  if(result&&result.length>0){
    console.log('[DEBITO] perfil:', currentPerfil, 'loja:', finalLojaId, 'taxa:', taxa);
    if(currentPerfil==='loja'&&finalLojaId&&taxa>0){
      const _agora=new Date().toISOString();
      await db('creditos_lojas','POST',{loja_id:finalLojaId,tipo:'debito',valor:taxa,observacoes:`Entrega #${numero}`,data:_dataHojeBrasilia(),created_at:_agora,updated_at:_agora});
      _carregarSaldoTopbar();
    }
    const msgExtra=agendarOn?`⏰ ${formatarDataHora(agendadoParaVal)}`:gorjeta>0?`🎁 Gorjeta: R$ ${gorjeta.toFixed(2)}`:'⏱ Pronto em 60s';
    if(fb)fb.innerHTML=`<div style="background:#22c55e18;border:1px solid #22c55e30;border-radius:9px;padding:12px;font-size:13px">✅ <b>Pedido #${numero} criado!</b><br><span style="color:var(--text2)">📍 ${distKm} km • ${msgExtra}</span></div>`;
    showNotif('Pedido criado!',agendarOn?'Agendado':'Ficará pronto em 60s');setTimeout(()=>fecharModal('modal-pedido'),2500);
  }else{if(fb)fb.innerHTML='<div style="color:var(--red);font-size:13px">❌ Erro ao criar pedido.</div>';}
}


// ═══════════════════════════════════════════════
// CADASTROS — página com sub-abas
// ═══════════════════════════════════════════════
let _cadastrosAba='clientes';

function renderCadastrosPage(aba){
  const todasAbas=[
    {id:'clientes',    icon:'🏪', label:'Clientes'},
    {id:'entregadores',icon:'🛵', label:'Entregadores'},
    {id:'usuarios',    icon:'👥', label:'Usuários'},
    {id:'precificacao',icon:'💰', label:'Cobrança e Pagamento'},
  ];
  const abas=currentPerfil==='suporte'?todasAbas.filter(a=>a.id==='entregadores'):todasAbas;
  const defaultAba=currentPerfil==='suporte'?'entregadores':'clientes';
  _cadastrosAba=aba||_cadastrosAba||defaultAba;
  if(!abas.find(a=>a.id===_cadastrosAba)) _cadastrosAba=abas[0].id;
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
  ['clientes','entregadores','usuarios','precificacao'].forEach(id=>{
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
  }
}

async function _renderClientesTab(el){
  el.innerHTML=`<div style="display:flex;justify-content:flex-end;margin-bottom:12px"><button class="btn-sm btn-primary-sm" onclick="abrirModal('modal-loja')">➕ Nova Loja</button></div><div class="card"><div style="overflow-x:auto"><table><thead><tr><th>Nome</th><th>Telefone</th><th>Endereço</th><th>E-mail acesso</th><th>Status</th><th>Ações</th></tr></thead><tbody id="tbody-clientes"></tbody></table></div></div>`;
  const data=await db('lojas','GET',null,'?order=created_at.desc');
  const tbody=document.getElementById('tbody-clientes');if(!tbody)return;
  tbody.innerHTML=data.length===0?'<tr><td colspan="6" style="text-align:center;padding:32px;color:var(--text3)">Nenhuma loja</td></tr>':data.map(l=>`<tr><td style="font-weight:600;color:var(--text)">🏪 ${l.nome}</td><td>${l.telefone||'—'}</td><td>${l.endereco||'—'}</td><td style="font-size:12px;color:var(--text3)">${l.email||'—'}</td><td><span class="p-badge b-${l.ativo?'em_rota':'fila'}">${l.ativo?'Ativa':'Inativa'}</span></td><td style="white-space:nowrap"><button onclick="abrirEditarLoja('${l.id}')" style="background:none;border:1px solid var(--border);border-radius:6px;width:30px;height:30px;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;font-size:14px;">✏️</button><button onclick="excluirLoja('${l.id}','${(l.nome||'').replace(/'/g,"\\'")}')" style="background:none;border:1px solid #ef4444;border-radius:6px;width:30px;height:30px;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;font-size:14px;margin-left:4px">🗑️</button></td></tr>`).join('');
}

async function _renderEntregadoresTab(el){
  const _entQuery='?select=*&order=updated_at.desc';
  const data=await db('entregadores','GET',null,_entQuery);
  const contEmAnalise=data.filter(e=>e.status_cadastro==='em_analise').length;
  const badge=contEmAnalise>0?`<span style="background:#ef4444;color:#fff;border-radius:20px;font-size:10px;font-weight:700;padding:1px 7px;margin-left:4px;vertical-align:middle">${contEmAnalise}</span>`:'';
  const btnFiltro=(id,label)=>{
    const ativo=_entFiltro===id;
    return `<button onclick="_entSetFiltro('${id}')" style="padding:6px 14px;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;font-family:Inter,sans-serif;border:1px solid ${ativo?'#1A56DB':'var(--border)'};background:${ativo?'#1A56DB':'var(--surface2)'};color:${ativo?'#fff':'var(--text2)'}">${label}</button>`;
  };
  const filtroBtns=`
    ${btnFiltro('todos','Todos')}
    ${btnFiltro('aprovados','✅ Aprovados')}
    <button onclick="_entSetFiltro('em_analise')" style="padding:6px 14px;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;font-family:Inter,sans-serif;border:1px solid ${_entFiltro==='em_analise'?'#1A56DB':'var(--border)'};background:${_entFiltro==='em_analise'?'#1A56DB':'var(--surface2)'};color:${_entFiltro==='em_analise'?'#fff':'var(--text2)'}">🔍 Em Análise${badge}</button>
    ${btnFiltro('pendentes','⏳ Pendentes')}
    ${btnFiltro('reprovados','❌ Reprovados')}`;

  let filtered;
  if(_entFiltro==='aprovados') filtered=data.filter(e=>e.status!=='bloqueado'&&(e.aprovado===true||e.status_cadastro==='aprovado'));
  else if(_entFiltro==='em_analise') filtered=data.filter(e=>e.status_cadastro==='em_analise');
  else if(_entFiltro==='pendentes') filtered=data.filter(e=>e.status==='bloqueado'||e.status_cadastro==='em_analise'||(!e.aprovado&&(!e.status_cadastro||e.status_cadastro==='pendente')));
  else if(_entFiltro==='reprovados') filtered=data.filter(e=>e.status_cadastro==='reprovado');
  else filtered=data;

  let theadHtml,tbodyHtml;
  const _fotoBtn=(url)=>url?`<button onclick="window.open('${url}','_blank')" style="padding:2px 8px;border:1px solid var(--border);border-radius:5px;background:var(--surface2);color:var(--text2);font-size:11px;font-weight:600;cursor:pointer;font-family:Inter,sans-serif">Ver</button>`:'—';
  if(_entFiltro==='em_analise'){
    theadHtml='<tr><th>Nome</th><th>Foto</th><th>CNH</th><th>CRLV</th><th>Comp. Res.</th><th>Telefone</th><th>CPF</th><th>Veículo</th><th>Placa</th><th>PIX</th><th>Data cadastro</th><th>Ações</th></tr>';
    tbodyHtml=filtered.length===0
      ?'<tr><td colspan="12" style="text-align:center;padding:32px;color:var(--text3)">Nenhum entregador em análise</td></tr>'
      :filtered.map(e=>`<tr>
        <td style="font-weight:600;color:var(--text)">🛵 ${e.nome||e.id?.substring(0,8)}</td>
        <td style="text-align:center">${_fotoBtn(e.foto_perfil||e.foto||e.avatar||e.imagem)}</td>
        <td style="text-align:center">${_fotoBtn(e.foto_cnh||e.cnh)}</td>
        <td style="text-align:center">${_fotoBtn(e.foto_crlv||e.crlv)}</td>
        <td style="text-align:center">${_fotoBtn(e.foto_comprovante_residencia||e.comprovante_residencia)}</td>
        <td>${e.telefone||'—'}</td>
        <td style="font-size:12px;color:var(--text2)">${e.cpf||'—'}</td>
        <td style="font-size:12px;color:var(--text2)">${[e.modal_veiculo,e.modelo_veiculo].filter(Boolean).join(' ')||'—'}</td>
        <td style="font-size:12px;color:var(--text2)">${e.placa_veiculo||'—'}</td>
        <td style="font-size:12px;color:var(--text2)">${e.chave_pix||'—'}</td>
        <td style="font-size:12px;color:var(--text3)">${formatarData(e.created_at)}</td>
        <td style="white-space:nowrap">
          <span onclick="_abrirDropdownCadastro(event,'${e.id}')" style="background:#3b82f6;color:#fff;border-radius:20px;padding:4px 12px;font-size:12px;font-weight:700;cursor:pointer;display:inline-block;user-select:none;margin-right:6px">🔍 Em Análise ▾</span>
          <button onclick="abrirEditarEntregador('${e.id}')" style="background:none;border:1px solid var(--border);border-radius:6px;width:28px;height:28px;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;font-size:13px;">✏️</button>
          <button onclick="excluirEntregador('${e.id}','${(e.nome||'').replace(/'/g,"\\'")}')" style="background:none;border:1px solid #ef4444;border-radius:6px;width:28px;height:28px;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;font-size:13px;margin-left:4px">🗑️</button>
        </td>
      </tr>`).join('');
  } else {
    const cadBadge=(s)=>({aprovado:'em_rota',em_analise:'aceito',reprovado:'recebido',pendente:'fila'}[s]||'fila');
    theadHtml='<tr><th>Nome</th><th>Foto</th><th>CNH</th><th>CRLV</th><th>Comp. Res.</th><th>Status</th><th>Disponível</th><th>Cadastro</th><th>Atualizado</th><th>Ações</th></tr>';
    tbodyHtml=filtered.length===0
      ?'<tr><td colspan="10" style="text-align:center;padding:32px;color:var(--text3)">Nenhum entregador</td></tr>'
      :filtered.map(e=>`<tr>
        <td style="font-weight:600;color:var(--text)">🛵 ${e.nome||e.id?.substring(0,8)}</td>
        <td style="text-align:center">${_fotoBtn(e.foto_perfil||e.foto||e.avatar||e.imagem)}</td>
        <td style="text-align:center">${_fotoBtn(e.foto_cnh||e.cnh)}</td>
        <td style="text-align:center">${_fotoBtn(e.foto_crlv||e.crlv)}</td>
        <td style="text-align:center">${_fotoBtn(e.foto_comprovante_residencia||e.comprovante_residencia)}</td>
        <td><span id="badge-status-${e.id}" onclick="_toggleStatusEntregador('${e.id}','${e.status||''}')" style="background:${e.status==='bloqueado'?'#EF4444':'#10B981'};color:#fff;border-radius:20px;padding:4px 12px;font-size:12px;font-weight:700;cursor:pointer;display:inline-block;user-select:none" title="${e.status==='bloqueado'?'Clique para desbloquear':'Clique para bloquear'}">${e.status==='bloqueado'?'🚫 Bloqueado':'✅ Disponível'}</span></td>
        <td><span id="badge-disp-${e.id}" onclick="_toggleDisponivelEntregador('${e.id}',${e.disponivel})" style="background:${e.disponivel?'#10B981':'#6B7280'};color:#fff;border-radius:20px;padding:3px 10px;font-size:11px;font-weight:600;cursor:pointer;display:inline-block">${e.disponivel?'Online':'Offline'}</span></td>
        <td><span onclick="_abrirDropdownCadastro(event,'${e.id}')" class="p-badge b-${cadBadge(e.status_cadastro)}" style="cursor:pointer;user-select:none">${e.status_cadastro||'pendente'} ▾</span></td>
        <td style="font-size:12px;color:var(--text3)">${formatarDataHora(e.updated_at)}</td>
        <td style="white-space:nowrap"><button onclick="event.stopPropagation();abrirEditarEntregador('${e.id}')" style="background:none;border:1px solid var(--border);border-radius:6px;width:30px;height:30px;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;font-size:14px;">✏️</button><button onclick="event.stopPropagation();excluirEntregador('${e.id}','${(e.nome||e.id?.substring(0,8)||'').replace(/'/g,"\\'")}')" style="background:none;border:1px solid #ef4444;border-radius:6px;width:30px;height:30px;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;font-size:14px;margin-left:4px">🗑️</button></td>
      </tr>`).join('');
  }

  el.innerHTML=`
    <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:14px;flex-wrap:wrap">
      <div style="display:flex;gap:6px;flex-wrap:wrap">${filtroBtns}</div>
      <div style="display:flex;gap:8px">
        <button class="btn-sm btn-primary-sm" onclick="abrirNovoEntregador()">➕ Novo</button>
        <button class="btn-sm btn-primary-sm" onclick="renderCadastrosPage('entregadores')">↻ Atualizar</button>
      </div>
    </div>
    <div class="card"><div style="overflow-x:auto">
      <table><thead>${theadHtml}</thead><tbody>${tbodyHtml}</tbody></table>
    </div></div>`;
}

function _entSetFiltro(filtro){_entFiltro=filtro;renderCadastrosPage('entregadores');}

async function _toggleDisponivelEntregador(id,atualDisponivel){
  const novoValor=!atualDisponivel;
  const badge=document.getElementById('badge-disp-'+id);
  if(badge){badge.textContent='…';badge.style.background='#94a3b8';badge.style.cursor='default';badge.onclick=null;}
  const res=await dbPatch('entregadores',{disponivel:novoValor,updated_at:new Date().toISOString()},`?id=eq.${id}`);
  if(res===null){
    showNotif('❌ Erro ao atualizar disponibilidade','','var(--red)');
    if(badge){badge.textContent=atualDisponivel?'Online':'Offline';badge.style.background=atualDisponivel?'#10B981':'#6B7280';badge.style.cursor='pointer';badge.onclick=()=>_toggleDisponivelEntregador(id,atualDisponivel);}
    return;
  }
  if(badge){
    badge.textContent=novoValor?'Online':'Offline';
    badge.style.background=novoValor?'#10B981':'#6B7280';
    badge.style.cursor='pointer';
    badge.onclick=()=>_toggleDisponivelEntregador(id,novoValor);
  }
  showNotif(novoValor?'🟢 Entregador Online':'⚫ Entregador Offline','','var(--green)');
}

async function _toggleStatusEntregador(id, statusAtual){
  const bloqueando=statusAtual!=='bloqueado';
  const badge=document.getElementById('badge-status-'+id);
  if(badge){badge.textContent='…';badge.style.background='#94a3b8';badge.style.cursor='default';badge.onclick=null;}
  const payload=bloqueando
    ?{status:'bloqueado',aprovado:false,disponivel:false,updated_at:new Date().toISOString()}
    :{status:'ativo',aprovado:true,disponivel:false,updated_at:new Date().toISOString()};
  const res=await dbPatch('entregadores',payload,`?id=eq.${id}`);
  if(res===null){
    showNotif('❌ Erro ao atualizar status','','var(--red)');
    if(badge){badge.textContent=statusAtual==='bloqueado'?'🚫 Bloqueado':'✅ Disponível';badge.style.background=statusAtual==='bloqueado'?'#EF4444':'#10B981';badge.style.cursor='pointer';badge.onclick=()=>_toggleStatusEntregador(id,statusAtual);}
    return;
  }
  showNotif(bloqueando?'🚫 Entregador bloqueado':'✅ Entregador desbloqueado','','var(--green)');
  setTimeout(()=>renderCadastrosPage('entregadores'),600);
}

async function _aprovarEntregador(id){
  const res=await dbPatch('entregadores',{aprovado:true,status_cadastro:'aprovado',updated_at:new Date().toISOString()},`?id=eq.${id}`);
  if(res===null){showNotif('❌ Erro ao aprovar','','var(--red)');return;}
  showNotif('✅ Entregador aprovado!','','var(--green)');
  renderCadastrosPage('entregadores');
}

function _reprovarEntregador(id,nome){
  let modal=document.getElementById('modal-reprovar-ent');
  if(!modal){modal=document.createElement('div');modal.id='modal-reprovar-ent';modal.className='modal-overlay';document.body.appendChild(modal);}
  modal.innerHTML=`<div class="modal" style="max-width:420px">
    <div class="modal-header"><span class="modal-title">❌ Reprovar Entregador</span><button class="modal-close" onclick="document.getElementById('modal-reprovar-ent').classList.remove('open')">✕</button></div>
    <div class="modal-body">
      <p style="color:var(--text2);font-size:13px;margin-bottom:14px">Informe o motivo da reprovação de <strong style="color:var(--text)">${nome}</strong>:</p>
      <div class="fi"><label>Motivo</label><textarea id="rep-motivo" placeholder="Ex: Documentação incompleta, CNH inválida..." style="min-height:80px;resize:vertical"></textarea></div>
      <div id="rep-feedback" style="min-height:16px;margin-top:8px;font-size:13px"></div>
    </div>
    <div class="modal-footer">
      <button class="btn-modal-cancel" onclick="document.getElementById('modal-reprovar-ent').classList.remove('open')">Cancelar</button>
      <button onclick="_confirmarReprovacao('${id}')" style="background:#ef4444;color:#fff;border:none;border-radius:9px;padding:11px 22px;font-family:Inter,sans-serif;font-size:13px;font-weight:700;cursor:pointer">❌ Confirmar</button>
    </div>
  </div>`;
  modal.classList.add('open');
}

async function _confirmarReprovacao(id){
  const motivo=document.getElementById('rep-motivo')?.value?.trim()||'';
  const fb=document.getElementById('rep-feedback');
  if(!motivo){if(fb)fb.innerHTML='<span style="color:#ef4444">Informe um motivo.</span>';return;}
  if(fb)fb.innerHTML='<span style="color:var(--text3)">Salvando…</span>';
  const res=await dbPatch('entregadores',{aprovado:false,status_cadastro:'reprovado',motivo_reprovacao:motivo,updated_at:new Date().toISOString()},`?id=eq.${id}`);
  if(res===null){if(fb)fb.innerHTML='<span style="color:#ef4444">Erro ao salvar.</span>';return;}
  document.getElementById('modal-reprovar-ent')?.classList.remove('open');
  showNotif('❌ Entregador reprovado',motivo.substring(0,50),'var(--red)');
  renderCadastrosPage('entregadores');
}

function _abrirDropdownCadastro(event,entId){
  event.stopPropagation();
  document.getElementById('dd-cadastro')?.remove();
  const opts=[
    {key:'aprovado',label:'✅ Aprovado',color:'#10b981'},
    {key:'em_analise',label:'🔍 Em Análise',color:'#3b82f6'},
    {key:'pendente',label:'⏳ Pendente',color:'#6b7280'},
    {key:'reprovado',label:'❌ Reprovado',color:'#ef4444'},
  ];
  const dd=document.createElement('div');
  dd.id='dd-cadastro';
  dd.style.cssText='position:fixed;z-index:9999;background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:4px;box-shadow:0 4px 16px rgba(0,0,0,.3);min-width:140px';
  const rect=event.currentTarget.getBoundingClientRect();
  dd.style.top=(rect.bottom+4)+'px';dd.style.left=rect.left+'px';
  dd.innerHTML=opts.map(o=>`<div onclick="_setCadastroStatus('${entId}','${o.key}')" style="padding:6px 12px;cursor:pointer;font-size:12px;font-weight:600;color:${o.color};border-radius:6px" onmouseover="this.style.background='var(--surface2)'" onmouseout="this.style.background=''">${o.label}</div>`).join('');
  document.body.appendChild(dd);
  setTimeout(()=>document.addEventListener('click',()=>document.getElementById('dd-cadastro')?.remove(),{once:true}),0);
}
async function _setCadastroStatus(entId,novoStatus){
  document.getElementById('dd-cadastro')?.remove();
  const patch={status_cadastro:novoStatus,updated_at:new Date().toISOString()};
  if(novoStatus==='aprovado'){patch.aprovado=true;patch.status='ativo';}
  else if(novoStatus==='reprovado'||novoStatus==='em_analise'){patch.aprovado=false;}
  await dbPatch('entregadores',patch,`?id=eq.${entId}`);
  showNotif(`Status atualizado: ${novoStatus}`,'');
  renderCadastrosPage('entregadores');
}

async function excluirEntregador(id,nome){
  if(!confirm(`Excluir permanentemente?\nO histórico de pedidos será mantido.`))return;
  await db('entregadores','DELETE',null,`?id=eq.${id}`);
  await fetch(`${SB_URL}/rest/v1/rpc/delete_auth_user`,{method:'POST',headers:{'apikey':SB_KEY,'Authorization':`Bearer ${SB_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({user_id:id})}).catch(()=>{});
  showNotif('🗑️ Entregador excluído','','var(--red)');
  renderCadastrosPage('entregadores');
}

async function excluirLoja(id,nome){
  if(!confirm(`Tem certeza que deseja excluir a loja "${nome}"?\nEsta ação não pode ser desfeita.`))return;
  await db('lojas','DELETE',null,`?id=eq.${id}`);
  showNotif('🗑️ Loja excluída','','var(--red)');
  renderCadastrosPage('clientes');
}

async function abrirEditarEntregador(entId){
  const arr=await db('entregadores','GET',null,`?id=eq.${entId}`);
  const e=Array.isArray(arr)?arr[0]:arr;if(!e)return;
  let modal=document.getElementById('modal-editar-entregador');
  if(!modal){modal=document.createElement('div');modal.id='modal-editar-entregador';modal.className='modal-overlay';document.body.appendChild(modal);}
  const sel=(id,val,opts)=>`<select id="${id}" style="background:var(--surface2);color:var(--text);border:1px solid var(--border);border-radius:8px;padding:9px 12px;width:100%;font-family:Inter,sans-serif;font-size:14px">${opts.map(([v,l])=>`<option value="${v}"${val===v?' selected':''}>${l}</option>`).join('')}</select>`;
  const inp=(id,val,ph='',type='text',extra='')=>`<input id="${id}" type="${type}" value="${(val||'').toString().replace(/"/g,'&quot;')}" placeholder="${ph}" autocomplete="off" ${extra} style="background:var(--surface2);color:var(--text);border:1px solid var(--border);border-radius:8px;padding:9px 12px;width:100%;font-family:Inter,sans-serif;font-size:14px;box-sizing:border-box"/>`;
  const sec=(title)=>`<div style="font-size:11px;font-weight:700;color:var(--accent);letter-spacing:1px;text-transform:uppercase;padding:10px 0 6px;border-bottom:1px solid var(--border);margin-bottom:10px;margin-top:4px">${title}</div>`;
  const row2=(a,b)=>`<div class="form-row">${a}${b}</div>`;
  const row1=(a)=>`<div class="form-row full">${a}</div>`;
  const fi=(label,content)=>`<div class="fi"><label>${label}</label>${content}</div>`;
  modal.innerHTML=`<div class="modal" style="max-width:560px"><div class="modal-header"><span class="modal-title">✏️ Editar Entregador</span><button class="modal-close" onclick="document.getElementById('modal-editar-entregador').classList.remove('open')">✕</button></div><div class="modal-body" style="max-height:75vh;overflow-y:auto">
${sec('👤 Dados Pessoais')}
${row2(fi('Nome completo',inp('ee-nome',(e.nome||'').includes('@')?e.nome.split('@')[0]:e.nome)+((e.nome||'').includes('@')?'<span style="font-size:11px;color:#f59e0b;display:block;margin-top:4px">⚠️ Confirme o nome real do entregador</span>':'')),fi('Telefone',inp('ee-telefone',e.telefone,'(16) 99999-9999')))}
${row2(fi('E-mail',`<input id="ee-email" type="text" value="${(e.email||'').replace(/"/g,'&quot;')}" data-original-email="${(e.email||'').replace(/"/g,'&quot;')}" autocomplete="off" style="background:var(--surface2);color:var(--text);border:1px solid var(--border);border-radius:8px;padding:9px 12px;width:100%;font-family:Inter,sans-serif;font-size:14px;box-sizing:border-box"/><span style="font-size:11px;color:var(--text3);display:block;margin-top:4px">Alterar requer confirmação — o entregador receberá um novo link de acesso</span>`),fi('CPF',inp('ee-cpf',e.cpf,'000.000.000-00')))}
${row1(fi('Código de Cadastro',inp('ee-codigo-cadastro',e.codigo_cadastro,'')))}
${row2(fi('RG',inp('ee-rg',e.rg)),fi('Data de nascimento',inp('ee-nascimento',e.data_nascimento,'','date')))}
${row2(fi('CEP',inp('ee-cep',e.cep,'00000-000')),fi('Bairro',inp('ee-bairro',e.bairro)))}
${row1(fi('Logradouro',inp('ee-logradouro',e.logradouro,'Rua, Av...')))}
${row2(fi('Número',inp('ee-end-numero',e.numero_endereco,'123')),fi('Complemento',inp('ee-complemento',e.complemento_end,'Apto, Bloco...')))}
${row2(fi('Disponibilidade',sel('ee-disponivel',e.status==='bloqueado'?'bloqueado':e.disponivel===true?'true':'false',[['true','Disponível'],['false','Indisponível'],['bloqueado','🚫 Bloqueado']])),fi('',`<div style="display:flex;align-items:flex-end;height:100%"><button onclick="redefinirSenhaEntregador('${(e.email||'').replace(/'/g,"\\'")}')" style="width:100%;padding:9px 12px;background:var(--surface2);color:var(--text);border:1px solid var(--border);border-radius:8px;cursor:pointer;font-size:13px;font-weight:600">🔑 Redefinir Senha</button></div>`))}
${sec('📎 Documentos')}
${(()=>{const _db=(url)=>url?`<button type="button" data-url="${(url||'').replace(/"/g,'&quot;')}" onclick="window.open(this.getAttribute('data-url'),'_blank')" style="padding:7px 14px;border:1px solid var(--border);border-radius:8px;background:var(--surface2);color:var(--text2);font-size:13px;font-weight:600;cursor:pointer;font-family:Inter,sans-serif;width:100%">Ver foto</button>`:'<span style="color:var(--text3);font-size:13px;padding:9px 0;display:block">Não enviado</span>';return row2(fi('Foto de Perfil',_db(e.foto_perfil||e.foto_url||e.avatar||'')),fi('CNH',_db(e.foto_cnh||e.cnh_url||'')))+row2(fi('CRLV',_db(e.foto_crlv||e.crlv_url||'')),fi('Comp. Residência',_db(e.comprovante_residencia||e.foto_comprovante||'')));})()}
${sec('🛵 Dados do Veículo')}
${row2(fi('Modal',sel('ee-modal',e.modal_veiculo,[['moto','Moto'],['carro','Carro'],['bicicleta','Bicicleta'],['van','Van']])),fi('Placa',inp('ee-placa',e.placa_veiculo,'ABC-1234')))}
${row2(fi('Modelo',inp('ee-modelo-veiculo',e.modelo_veiculo,'Honda CG 160...')),fi('Cor',inp('ee-cor-veiculo',e.cor_veiculo,'Preta')))}
${row2(fi('CNH',inp('ee-cnh',e.cnh)),fi('CNPJ',inp('ee-cnpj',e.cnpj,'00.000.000/0000-00')))}
${sec('💰 Dados de Pagamento')}
${row2(fi('Tipo de pagamento',sel('ee-tipo-pagamento',e.tipo_pagamento,[['por_tabela','Por Tabela'],['percentual','Percentual'],['fixo','Fixo']])),fi('Banco',inp('ee-banco',e.banco,'Nubank, Bradesco...')))}
${row2(fi('Tipo chave PIX',sel('ee-tipo-pix',e.tipo_chave_pix,[['cpf','CPF'],['cnpj','CNPJ'],['email','Email'],['telefone','Telefone'],['aleatoria','Aleatória']])),fi('Chave PIX',inp('ee-chave-pix',e.chave_pix)))}
${row1(`<div class="fi"><label>Máquina de cartão</label><label style="display:flex;align-items:center;gap:10px;cursor:pointer;padding:9px 0"><input id="ee-maquina-cartao" type="checkbox" ${e.maquina_cartao?'checked':''} style="width:18px;height:18px;cursor:pointer;accent-color:var(--accent)"/><span style="font-size:14px;color:var(--text)">Possui máquina de cartão</span></label></div>`)}
<div id="ee-feedback" style="margin-top:10px;font-size:13px;min-height:20px"></div></div><div class="modal-footer"><button class="btn-modal-cancel" onclick="document.getElementById('modal-editar-entregador').classList.remove('open')">Cancelar</button><button class="btn-modal-primary" onclick="salvarEdicaoEntregador('${entId}')">💾 Salvar</button></div></div>`;
  modal.classList.add('open');
}

async function salvarEdicaoEntregador(entId){
  const fb=document.getElementById('ee-feedback');
  const g=(id)=>document.getElementById(id)?.value||'';
  const dispVal=document.getElementById('ee-disponivel')?.value;
  const emailEl=document.getElementById('ee-email');
  const novoEmail=(emailEl?.value||'').trim().toLowerCase();
  const emailOriginal=(emailEl?.getAttribute('data-original-email')||'').trim().toLowerCase();
  const emailMudou=novoEmail&&novoEmail!==emailOriginal;

  if(emailMudou){
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(novoEmail)){
      if(fb)fb.innerHTML='<span style="color:#ef4444">E-mail inválido.</span>';return;
    }
    if(fb)fb.innerHTML='<span style="color:var(--text3)">Atualizando e-mail…</span>';
    try{
      const r=await fetch(`${SB_URL}/functions/v1/update-entregador-email`,{
        method:'POST',
        headers:{'Content-Type':'application/json','x-webhook-secret':'letsgo2026secret'},
        body:JSON.stringify({entregador_id:entId,email_atual:emailOriginal,novo_email:novoEmail})
      });
      const data=await r.json().catch(()=>({}));
      if(!r.ok){
        if(fb)fb.innerHTML=`<span style="color:#ef4444">❌ Erro ao atualizar e-mail: ${data.error||r.status}</span>`;
        showNotif('❌ Falha ao atualizar e-mail','','var(--red)');return;
      }
    }catch(e){
      if(fb)fb.innerHTML='<span style="color:#ef4444">❌ Erro de conexão ao atualizar e-mail.</span>';return;
    }
  }

  const update={
    nome:g('ee-nome'),telefone:g('ee-telefone'),cpf:g('ee-cpf'),
    codigo_cadastro:g('ee-codigo-cadastro')||null,
    rg:g('ee-rg'),data_nascimento:g('ee-nascimento')||null,
    cep:g('ee-cep'),bairro:g('ee-bairro'),logradouro:g('ee-logradouro'),
    numero_endereco:g('ee-end-numero'),complemento_end:g('ee-complemento'),
    disponivel:dispVal==='true',
    modal_veiculo:g('ee-modal'),placa_veiculo:g('ee-placa'),
    modelo_veiculo:g('ee-modelo-veiculo'),cor_veiculo:g('ee-cor-veiculo'),
    cnh:g('ee-cnh'),cnpj:g('ee-cnpj'),
    tipo_pagamento:g('ee-tipo-pagamento'),banco:g('ee-banco'),
    tipo_chave_pix:g('ee-tipo-pix'),chave_pix:g('ee-chave-pix'),
    maquina_cartao:document.getElementById('ee-maquina-cartao')?.checked||false,
    updated_at:new Date().toISOString()
  };
  if(emailMudou)update.email=novoEmail;
  if(dispVal==='bloqueado'){update.status='bloqueado';update.aprovado=false;update.disponivel=false;}
  console.log('[salvarEdicaoEntregador] campos enviados ao banco:', update);
  if(fb)fb.innerHTML='<span style="color:var(--text3)">Salvando…</span>';
  const res=await dbPatch('entregadores',update,`?id=eq.${entId}`);
  if(res===null){if(fb)fb.innerHTML='<span style="color:#ef4444">❌ Erro ao salvar. Veja o console.</span>';showNotif('❌ Erro ao salvar entregador','','var(--red)');return;}
  if(fb)fb.innerHTML='<span style="color:#22c55e">✅ Salvo com sucesso!</span>';showNotif('✅ Entregador atualizado com sucesso!','','var(--green)');
  setTimeout(()=>{document.getElementById('modal-editar-entregador')?.classList.remove('open');renderCadastrosPage('entregadores');},1200);
}

async function redefinirSenhaEntregador(email){
  const fb=document.getElementById('ee-feedback');
  if(!email){if(fb)fb.innerHTML='<span style="color:#ef4444">E-mail não informado.</span>';return;}
  if(fb)fb.innerHTML='<span style="color:var(--text3)">Enviando e-mail…</span>';
  try{
    const r=await fetch(`${SB_URL}/auth/v1/recover`,{method:'POST',headers:{'apikey':SB_KEY,'Content-Type':'application/json'},body:JSON.stringify({email})});
    if(fb)fb.innerHTML=r.ok?'<span style="color:#22c55e">✅ E-mail de redefinição enviado!</span>':'<span style="color:#ef4444">Erro ao enviar e-mail.</span>';
  }catch{if(fb)fb.innerHTML='<span style="color:#ef4444">Erro de conexão.</span>';}
}

function abrirNovoEntregador(){
  const sel='background:var(--surface2);color:var(--text);border:1px solid var(--border);border-radius:8px;padding:9px 12px;width:100%;font-family:Inter,sans-serif;font-size:14px';
  let modal=document.getElementById('modal-novo-entregador');
  if(!modal){modal=document.createElement('div');modal.id='modal-novo-entregador';modal.className='modal-overlay';document.body.appendChild(modal);}
  modal.innerHTML=`<div class="modal"><div class="modal-header"><span class="modal-title">➕ Novo Entregador</span><button class="modal-close" onclick="document.getElementById('modal-novo-entregador').classList.remove('open')">✕</button></div><div class="modal-body"><div class="form-row"><div class="fi"><label>Nome completo</label><input id="ne-nome" placeholder="João da Silva"/></div><div class="fi"><label>CPF</label><input id="ne-cpf" placeholder="000.000.000-00"/></div></div><div class="form-row"><div class="fi"><label>E-mail</label><input id="ne-email" type="email" placeholder="joao@email.com"/></div><div class="fi"><label>Telefone</label><input id="ne-telefone" placeholder="(16) 99999-9999"/></div></div><div class="form-row"><div class="fi"><label>Senha inicial</label><input id="ne-senha" type="password" placeholder="Mínimo 6 caracteres"/></div><div class="fi"><label>Disponibilidade</label><select id="ne-disponivel" style="${sel}"><option value="true">Disponível</option><option value="false">Indisponível</option></select></div></div><div id="ne-feedback" style="margin-top:10px;font-size:13px;min-height:20px"></div></div><div class="modal-footer"><button class="btn-modal-cancel" onclick="document.getElementById('modal-novo-entregador').classList.remove('open')">Cancelar</button><button class="btn-modal-primary" onclick="criarNovoEntregador()">🚀 Criar</button></div></div>`;
  modal.classList.add('open');
}

async function criarNovoEntregador(){
  const fb=document.getElementById('ne-feedback');
  const nome=document.getElementById('ne-nome')?.value?.trim(),email=document.getElementById('ne-email')?.value?.trim(),senha=document.getElementById('ne-senha')?.value;
  const cpf=document.getElementById('ne-cpf')?.value?.trim(),telefone=document.getElementById('ne-telefone')?.value?.trim(),disponivel=document.getElementById('ne-disponivel')?.value==='true';
  if(!nome||!email||!senha){if(fb)fb.innerHTML='<span style="color:#ef4444">Preencha nome, e-mail e senha.</span>';return;}
  if(senha.length<6){if(fb)fb.innerHTML='<span style="color:#ef4444">Senha mínima de 6 caracteres.</span>';return;}
  if(cpf&&!/^\d{3}\.\d{3}\.\d{3}-\d{2}$/.test(cpf)){if(fb)fb.innerHTML='<span style="color:#ef4444">CPF inválido. Use o formato 000.000.000-00.</span>';return;}
  if(cpf){
    const cpfExiste=await db('entregadores','GET',null,`?cpf=eq.${encodeURIComponent(cpf)}&limit=1`);
    if(cpfExiste.length>0){if(fb)fb.innerHTML='<span style="color:#ef4444">CPF já cadastrado no sistema.</span>';return;}
  }
  if(fb)fb.innerHTML='<span style="color:var(--text3)">Criando conta…</span>';
  try{
    const authRes=await fetch(`${SB_URL}/auth/v1/signup`,{method:'POST',headers:{'apikey':SB_KEY,'Content-Type':'application/json'},body:JSON.stringify({email,password:senha})});
    const authData=await authRes.json();
    if(!authRes.ok||!authData.user?.id){if(fb)fb.innerHTML=`<span style="color:#ef4444">Erro Auth: ${authData.error_description||authData.msg||'Verifique o e-mail.'}</span>`;return;}
    await db('entregadores','POST',{nome,email,cpf,telefone,disponivel,status:'livre',created_at:new Date().toISOString(),updated_at:new Date().toISOString()});
    if(fb)fb.innerHTML='<span style="color:#22c55e">✅ Entregador criado!</span>';
    setTimeout(()=>{document.getElementById('modal-novo-entregador')?.classList.remove('open');renderCadastrosPage('entregadores');},1200);
  }catch{if(fb)fb.innerHTML='<span style="color:#ef4444">Erro de conexão.</span>';}
}

async function _renderUsuariosTab(el){
  el.innerHTML=`<div style="display:flex;justify-content:flex-end;gap:8px;margin-bottom:12px"><button class="btn-sm btn-primary-sm" onclick="abrirModalUsuario()">➕ Novo Usuário</button><button class="btn-sm btn-primary-sm" onclick="renderCadastrosPage('usuarios')">↻ Atualizar</button></div><div class="card"><div style="overflow-x:auto"><table><thead><tr><th>Nome</th><th>E-mail</th><th>Perfil</th><th>Loja</th><th>Status</th><th>Criado em</th><th>Ações</th></tr></thead><tbody id="tbody-cad-usuarios"></tbody></table></div></div>`;
  const data=await db('usuarios_painel','GET',null,'?order=created_at.desc'),lojas=await db('lojas','GET',null,'');
  const tbody=document.getElementById('tbody-cad-usuarios');if(!tbody)return;
  const badgeMap={adm:'badge-adm',loja:'badge-loja',suporte:'badge-suporte'};
  tbody.innerHTML=data.length===0?'<tr><td colspan="7" style="text-align:center;padding:32px;color:var(--text3)">Nenhum usuário</td></tr>':data.map(u=>{const loja=lojas.find(l=>l.id===u.loja_id);return`<tr><td style="font-weight:600;color:var(--text)">${u.nome}</td><td style="font-size:12px">${u.email}</td><td><span class="user-perfil-badge ${badgeMap[u.perfil]||''}">${u.perfil?.toUpperCase()}</span></td><td style="font-size:12px;color:var(--text3)">${loja?loja.nome:'—'}</td><td><span class="p-badge b-${u.ativo?'em_rota':'fila'}">${u.ativo?'Ativo':'Inativo'}</span></td><td style="font-size:12px;color:var(--text3)">${formatarDataHora(u.created_at)}</td><td><button onclick="abrirEditarUsuario('${u.id}')" style="background:none;border:1px solid var(--border);border-radius:6px;width:30px;height:30px;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;font-size:14px;">✏️</button></td></tr>`;}).join('');
}

async function abrirEditarUsuario(userId){
  const arr=await db('usuarios_painel','GET',null,`?id=eq.${userId}`);
  const u=Array.isArray(arr)?arr[0]:arr;if(!u)return;
  const lojas=await db('lojas','GET',null,'');
  const sel='background:var(--surface2);color:var(--text);border:1px solid var(--border);border-radius:8px;padding:9px 12px;width:100%;font-family:Inter,sans-serif;font-size:14px';
  let modal=document.getElementById('modal-editar-usuario');
  if(!modal){modal=document.createElement('div');modal.id='modal-editar-usuario';modal.className='modal-overlay';document.body.appendChild(modal);}
  const lojaOpts='<option value="">Selecione a loja</option>'+lojas.map(l=>`<option value="${l.id}" ${u.loja_id===l.id?'selected':''}>${l.nome}</option>`).join('');
  modal.innerHTML=`<div class="modal"><div class="modal-header"><span class="modal-title">✏️ Editar Usuário</span><button class="modal-close" onclick="document.getElementById('modal-editar-usuario').classList.remove('open')">✕</button></div><div class="modal-body"><div class="form-row"><div class="fi"><label>Nome</label><input id="eu-nome" value="${(u.nome||'').replace(/"/g,'&quot;')}"/></div><div class="fi"><label>E-mail</label><input id="eu-email" type="text" value="${(u.email||'').replace(/"/g,'&quot;')}"/></div></div><div class="form-row"><div class="fi"><label>Perfil</label><select id="eu-perfil" style="${sel}" onchange="document.getElementById('eu-loja-row').style.display=this.value==='loja'?'grid':'none'"><option value="adm" ${u.perfil==='adm'?'selected':''}>Administrador</option><option value="loja" ${u.perfil==='loja'?'selected':''}>Loja</option><option value="suporte" ${u.perfil==='suporte'?'selected':''}>Suporte</option></select></div><div class="fi"><label>Status</label><select id="eu-ativo" style="${sel}"><option value="true" ${u.ativo?'selected':''}>Ativo</option><option value="false" ${!u.ativo?'selected':''}>Inativo</option></select></div></div><div class="form-row" id="eu-loja-row" style="display:${u.perfil==='loja'?'grid':'none'}"><div class="fi" style="grid-column:1/-1"><label>Loja</label><select id="eu-loja-id" style="${sel}">${lojaOpts}</select></div></div><div class="form-row"><div class="fi" style="display:flex;align-items:flex-end"><button onclick="redefinirSenhaUsuario('${(u.email||'').replace(/'/g,"\\'")}')" style="width:100%;padding:9px 12px;background:var(--surface2);color:var(--text);border:1px solid var(--border);border-radius:8px;cursor:pointer;font-size:13px;font-weight:600">🔑 Redefinir Senha</button></div></div><div id="eu-feedback" style="margin-top:10px;font-size:13px;min-height:20px"></div></div><div class="modal-footer"><button class="btn-modal-cancel" onclick="document.getElementById('modal-editar-usuario').classList.remove('open')">Cancelar</button><button class="btn-modal-primary" onclick="salvarEdicaoUsuario('${userId}')">💾 Salvar</button></div></div>`;
  modal.classList.add('open');
}

async function salvarEdicaoUsuario(userId){
  const fb=document.getElementById('eu-feedback');
  const update={nome:document.getElementById('eu-nome')?.value||'',email:document.getElementById('eu-email')?.value||'',perfil:document.getElementById('eu-perfil')?.value||'',ativo:document.getElementById('eu-ativo')?.value==='true',loja_id:document.getElementById('eu-loja-id')?.value||null,updated_at:new Date().toISOString()};
  if(fb)fb.innerHTML='<span style="color:var(--text3)">Salvando…</span>';
  const res=await dbPatch('usuarios_painel',update,`?id=eq.${userId}`);
  if(res===null){if(fb)fb.innerHTML='<span style="color:#ef4444">❌ Erro ao salvar. Veja o console.</span>';showNotif('❌ Erro ao salvar usuário','','var(--red)');return;}
  if(fb)fb.innerHTML='<span style="color:#22c55e">✅ Salvo com sucesso!</span>';showNotif('✅ Usuário atualizado!',update.nome);
  setTimeout(()=>{document.getElementById('modal-editar-usuario')?.classList.remove('open');renderCadastrosPage('usuarios');},1200);
}

async function redefinirSenhaUsuario(email){
  const fb=document.getElementById('eu-feedback');
  if(!email){if(fb)fb.innerHTML='<span style="color:#ef4444">E-mail não informado.</span>';return;}
  if(fb)fb.innerHTML='<span style="color:var(--text3)">Enviando e-mail…</span>';
  try{
    const r=await fetch(`${SB_URL}/auth/v1/recover`,{method:'POST',headers:{'apikey':SB_KEY,'Content-Type':'application/json'},body:JSON.stringify({email})});
    if(fb)fb.innerHTML=r.ok?'<span style="color:#22c55e">✅ E-mail de redefinição enviado!</span>':'<span style="color:#ef4444">Erro ao enviar e-mail.</span>';
  }catch{if(fb)fb.innerHTML='<span style="color:#ef4444">Erro de conexão.</span>';}
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

async function renderPrecoDinamicoPage(){
  document.getElementById('app-body').innerHTML=`
    <div class="alt-page">
      <div class="page-header"><div class="page-title">📈 Preço Dinâmico</div></div>
      <div style="font-size:11px;font-weight:700;color:var(--text3);letter-spacing:.6px;margin-bottom:10px">GLOBAL (TODAS AS CIDADES)</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:28px">
        <div id="pd-wrap-cliente"></div>
        <div id="pd-wrap-entregador"></div>
      </div>
      <div style="font-size:11px;font-weight:700;color:var(--text3);letter-spacing:.6px;margin-bottom:10px">POR CIDADE</div>
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px">
        <select id="pd-cidade-select" onchange="_pdSelecionarCidade(this.value)" style="padding:9px 14px;border:1px solid var(--border);border-radius:8px;font-size:13px;background:var(--surface2);color:var(--text);font-family:Inter,sans-serif;cursor:pointer">
          <option value="">Selecionar cidade...</option>
        </select>
      </div>
      <div id="pd-cidade-content" style="display:grid;grid-template-columns:1fr 1fr;gap:20px"></div>
    </div>`;
  _renderPrecoDinamicoTab(document.getElementById('pd-wrap-cliente'),'cliente');
  _renderPrecoDinamicoTab(document.getElementById('pd-wrap-entregador'),'entregador');
  const lojas=await db('lojas','GET',null,'?select=cidade&ativo=eq.true');
  const cidades=[...new Set((lojas||[]).map(l=>l.cidade).filter(Boolean))].sort();
  const sel=document.getElementById('pd-cidade-select');
  if(sel){
    cidades.forEach(c=>{
      const o=document.createElement('option');
      o.value=c;o.textContent=c;
      sel.appendChild(o);
    });
    const defaultCidade=cidades.includes('Ribeirão Preto')?'Ribeirão Preto':cidades[0]||'';
    if(defaultCidade){sel.value=defaultCidade;_pdSelecionarCidade(defaultCidade);}
  }
}

async function _inicializarPrecoDinamico(){
  const [rv1,rv2,rts1,rts2,rpdc,rpdce,raplic,raplicE]=await Promise.all([
    db('configuracoes','GET',null,`?chave=eq.${_pdChave('cliente')}`),
    db('configuracoes','GET',null,`?chave=eq.${_pdChave('entregador')}`),
    db('configuracoes','GET',null,`?chave=eq.${_pdChaveTs('cliente')}`),
    db('configuracoes','GET',null,`?chave=eq.${_pdChaveTs('entregador')}`),
    db('configuracoes','GET',null,'?chave=eq.preco_dinamico_por_cidade'),
    db('configuracoes','GET',null,'?chave=eq.preco_dinamico_entregador_por_cidade'),
    db('configuracoes','GET',null,'?chave=eq.preco_dinamico_lojas_aplicaveis_cidade'),
    db('configuracoes','GET',null,'?chave=eq.preco_dinamico_entregadores_aplicaveis_cidade'),
  ]);
  [['cliente',rv1,rts1],['entregador',rv2,rts2]].forEach(([tipo,rv,rts])=>{
    const valor=parseFloat(rv[0]?.valor||0);
    const tsStr=rts[0]?.valor;
    const expiry=tsStr?_tsUtc(tsStr)+120*60*1000:0;
    const nowMs=Date.now();
    const ativo=valor>0&&expiry>nowMs;
    const minRestantes=ativo?Math.round((expiry-nowMs)/60000):0;
    console.log(`[PD] init tipo=${tipo} valor=${valor} timestamp_salvo_utc=${tsStr||'(none)'} now_utc=${new Date(nowMs).toISOString()} diferenca_ms=${tsStr?nowMs-_tsUtc(tsStr):0} minutos_restantes=${minRestantes} ativo=${ativo}`);
    if(ativo){
      _precoDinValores[tipo]=valor;
      _precoDinTs[tipo]=tsStr;
      localStorage.setItem(`_pdAtivadoEm_${tipo}`,tsStr);
    }else{
      _precoDinValores[tipo]=0;
      _precoDinTs[tipo]=null;
      localStorage.removeItem(`_pdAtivadoEm_${tipo}`);
    }
  });
  try{_pdCidades=JSON.parse(rpdc[0]?.valor||'{}');}catch(e){_pdCidades={};}
  try{_pdCidadesEnt=JSON.parse(rpdce[0]?.valor||'{}');}catch(e){_pdCidadesEnt={};}
  try{_pdCidadesAplicaveis=JSON.parse(raplic[0]?.valor||'{}');}catch(e){_pdCidadesAplicaveis={};}
  try{_pdCidadesAplicaveisEnt=JSON.parse(raplicE[0]?.valor||'{}');}catch(e){_pdCidadesAplicaveisEnt={};}
}

async function _fetchPdAtual(lojaId){
  const [rv,rvE,rts,rtsE]=await Promise.all([
    db('configuracoes','GET',null,`?chave=eq.${_pdChave('cliente')}`),
    db('configuracoes','GET',null,`?chave=eq.${_pdChave('entregador')}`),
    db('configuracoes','GET',null,`?chave=eq.${_pdChaveTs('cliente')}`),
    db('configuracoes','GET',null,`?chave=eq.${_pdChaveTs('entregador')}`),
  ]);
  const agora=Date.now();
  let pdC=0,pdE=0,origemC=null,origemE=null;
  [['cliente',rv,rts],['entregador',rvE,rtsE]].forEach(([tipo,r,rt])=>{
    const v=parseFloat(r[0]?.valor||0);
    const tsStrDB=rt[0]?.valor||null;
    const tsStr=tsStrDB||_precoDinTs[tipo]||localStorage.getItem(`_pdAtivadoEm_${tipo}`);
    const expiry=tsStr?_tsUtc(tsStr)+120*60*1000:0;
    const ativo=v>0&&expiry>agora;
    const min=ativo?Math.round((expiry-agora)/60000):0;
    console.log(`[PD fetch] tipo=${tipo} db_valor=${v} ts_db=${tsStrDB} ts_usado=${tsStr} expiry=${expiry} agora=${agora} ativo=${ativo} min_restantes=${min}`);
    if(ativo){
      _precoDinValores[tipo]=v;
      _precoDinTs[tipo]=tsStr;
      localStorage.setItem(`_pdAtivadoEm_${tipo}`,tsStr);
      if(tipo==='cliente'){pdC=v;origemC='global';}else{pdE=v;origemE='global';}
    }
  });
  // PD global calculado — nunca filtrado por aplicáveis de cidade
  const pdGlobalC=pdC,pdGlobalE=pdE;
  console.log(`[PD fetch] global => pd_cliente=${pdGlobalC}(${origemC}) pd_entregador=${pdGlobalE}(${origemE})`);
  // verifica PD por cidade (carregado no startup) — sobrescreve global apenas se cidade PD estiver ativo E loja/entregador na lista
  const loja=allLojas.find(l=>l.id===lojaId);
  const cidade=loja?.cidade;
  if(cidade){
    const cfgC=_pdCidades[cidade];
    const cidAtC=!!(cfgC&&cfgC.valor>0&&cfgC.ativado_em&&_tsUtc(cfgC.ativado_em)+120*60*1000>agora);
    if(cidAtC){
      const aplicaveisC=_pdCidadesAplicaveis[cidade]||[];
      const aplicavel=aplicaveisC.length===0||aplicaveisC.includes(lojaId);
      console.log(`[PD fetch] cidade=${cidade} cfgC.valor=${cfgC.valor} aplicaveisC=${JSON.stringify(aplicaveisC)} lojaId=${lojaId} aplicavel=${aplicavel} pd_global=${pdGlobalC} → ${aplicavel?'soma cidade '+cfgC.valor+' ao global':'mantém global='+pdGlobalC}`);
      if(aplicavel){pdC=pdGlobalC+cfgC.valor;origemC=pdGlobalC>0?'global+cidade':'cidade';}
    }else{
      console.log(`[PD fetch] cidade=${cidade} PD cidade inativo (cfgC.valor=${cfgC?.valor||0}) → mantém pd_global=${pdGlobalC}`);
    }
    const cfgE=_pdCidadesEnt[cidade];
    if(cfgE&&cfgE.valor>0&&cfgE.ativado_em&&_tsUtc(cfgE.ativado_em)+120*60*1000>agora){pdE=pdGlobalE+cfgE.valor;origemE=pdGlobalE>0?'global+cidade':'cidade';}
  }else{
    console.log(`[PD fetch] lojaId=${lojaId} sem cidade (migration pendente?) → aplica pd_global=${pdGlobalC}`);
  }
  const pdCidadeC=origemC&&origemC.includes('cidade')?pdC-pdGlobalC:0;
  const pdCidadeE=origemE&&origemE.includes('cidade')?pdE-pdGlobalE:0;
  console.log(`[PD fetch] resultado_final lojaId=${lojaId} cidade=${cidade||'—'} pd_global_cliente=${pdGlobalC} pd_cidade_cliente=${pdCidadeC} pd_total_cliente=${pdC}(${origemC}) pd_global_entregador=${pdGlobalE} pd_cidade_entregador=${pdCidadeE} pd_total_entregador=${pdE}(${origemE})`);
  return {cliente:pdC,entregador:pdE,origemCliente:origemC,origemEntregador:origemE};
}

function _getPdCliente(lojaId){
  const v=_precoDinValores['cliente']||0;
  const tsStr=_precoDinTs['cliente']||localStorage.getItem('_pdAtivadoEm_cliente');
  const expiry=tsStr?new Date(tsStr).getTime()+120*60*1000:0;
  const ativo=v>0&&expiry>Date.now();
  const globalPd=ativo?v:0;
  const loja=allLojas.find(l=>l.id===lojaId);
  const cidade=loja?.cidade;
  let cidadePd=0;
  if(cidade){
    const cfg=_pdCidades[cidade];
    if(cfg&&cfg.valor>0&&cfg.ativado_em&&_tsUtc(cfg.ativado_em)+120*60*1000>Date.now()){
      if(!cfg.lojas||cfg.lojas.length===0||cfg.lojas.includes(lojaId)) cidadePd=cfg.valor;
    }
  }
  const minRestantes=ativo?Math.round((expiry-Date.now())/60000):0;
  console.log(`[PD] _getPdCliente lojaId=${lojaId} global=${globalPd} cidade=${cidadePd} total=${globalPd+cidadePd} minutos_restantes=${minRestantes}`);
  return globalPd+cidadePd;
}

function _getPdEntregador(lojaId){
  const v=_precoDinValores['entregador']||0;
  const tsStr=_precoDinTs['entregador']||localStorage.getItem('_pdAtivadoEm_entregador');
  const expiry=tsStr?new Date(tsStr).getTime()+120*60*1000:0;
  const ativo=v>0&&expiry>Date.now();
  const globalPd=ativo?v:0;
  const loja=allLojas.find(l=>l.id===lojaId);
  const cidade=loja?.cidade;
  let cidadePd=0;
  if(cidade){
    const cfg=_pdCidadesEnt[cidade];
    if(cfg&&cfg.valor>0&&cfg.ativado_em&&_tsUtc(cfg.ativado_em)+120*60*1000>Date.now()) cidadePd=cfg.valor;
  }
  const minRestantes=ativo?Math.round((expiry-Date.now())/60000):0;
  console.log(`[PD] _getPdEntregador lojaId=${lojaId} global=${globalPd} cidade=${cidadePd} total=${globalPd+cidadePd} minutos_restantes=${minRestantes}`);
  return globalPd+cidadePd;
}

function _renderPrecoDinamicoTab(el,tipo){
  const label=tipo==='cliente'?'Cobrança da Loja':'Pagamento do Entregador';
  const _valorMemoria=_precoDinValores[tipo]||0;
  el.innerHTML=`
    <div class="card" style="max-width:520px">
      <div class="card-header"><span class="card-title">📈 Preço Dinâmico — ${label}</span></div>
      <div style="padding:20px">
        <p style="color:var(--text2);font-size:13px;margin-bottom:16px">
          ${tipo==='cliente'?'Valor fixo extra somado à taxa cobrada da loja em todos os pedidos.':'Valor fixo extra somado ao pagamento do entregador em todos os pedidos.'}
          <br><span style="font-size:12px;color:var(--text3)">Após salvar com valor &gt; 0, o preço dinâmico é desativado automaticamente em 120 minutos.</span>
        </p>
        <div class="fi" style="margin-bottom:8px">
          <label>Valor extra (R$)</label>
          <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
            <input type="number" id="preco-din-valor-${tipo}" step="0.01" placeholder="0.00" value="${_valorMemoria>0?_valorMemoria.toFixed(2):''}" style="max-width:160px"/>
            <div id="preco-din-barra-wrap-${tipo}" style="flex:1;min-width:160px;display:none">
              <div style="background:var(--surface2);border-radius:6px;height:10px;overflow:hidden;margin-bottom:4px">
                <div id="preco-din-barra-${tipo}" style="height:100%;border-radius:6px;width:100%;background:#10b981;transition:width 1s linear"></div>
              </div>
              <div id="preco-din-timer-${tipo}" style="font-size:12px;font-weight:600;color:#10b981"></div>
            </div>
          </div>
        </div>
        <div id="preco-din-feedback-${tipo}" style="margin-bottom:12px;font-size:12px"></div>
        <button class="btn-modal-primary" onclick="salvarPrecoDinamico('${tipo}')">💾 Salvar</button>
      </div>
    </div>`;
  // Restaurar estado do localStorage imediatamente (antes da query ao banco)
  const _lsKey=`_pdAtivadoEm_${tipo}`;
  const _lsVal=localStorage.getItem(_lsKey);
  if(_lsVal){
    const _lsDate=new Date(_tsUtc(_lsVal));
    const _restante=_lsDate.getTime()+120*60*1000-Date.now();
    if(_restante>0){_iniciarBarraPrecoDin(tipo,_lsDate);}
    else{localStorage.removeItem(_lsKey);}
  }
  // Carrega valor atual e timestamp de ativação do banco
  Promise.all([
    db('configuracoes','GET',null,`?chave=eq.${_pdChave(tipo)}`),
    db('configuracoes','GET',null,`?chave=eq.${_pdChaveTs(tipo)}`)
  ]).then(([dataValor,dataAtivado])=>{
    const input=document.getElementById(`preco-din-valor-${tipo}`);
    const valor=parseFloat(dataValor[0]?.valor||0);
    if(input&&valor>0)input.value=valor.toFixed(2); // só sobrescreve se há valor real
    if(valor>0&&dataAtivado[0]?.valor&&_tsUtc(dataAtivado[0].valor)+120*60*1000>Date.now()){
      _precoDinValores[tipo]=valor;
      _precoDinTs[tipo]=dataAtivado[0].valor;
      localStorage.setItem(_lsKey,dataAtivado[0].valor);
      _iniciarBarraPrecoDin(tipo,new Date(_tsUtc(dataAtivado[0].valor)));
    }else{
      _precoDinValores[tipo]=0;
      _precoDinTs[tipo]=null;
      localStorage.removeItem(_lsKey);
    }
  }).catch(e=>console.error('[PD] erro ao carregar '+tipo,e));
}

function _iniciarBarraPrecoDin(tipo,ativadoEm){
  if(_precoDinTimers[tipo])clearInterval(_precoDinTimers[tipo]);
  const DURACAO=120*60*1000;
  const nowMs=Date.now();
  const difMs=nowMs-ativadoEm.getTime();
  console.log(`[PD timer global] tipo=${tipo} timestamp_salvo_utc=${ativadoEm.toISOString()} now_utc=${new Date(nowMs).toISOString()} diferenca_ms=${difMs} minutos_restantes=${Math.floor((ativadoEm.getTime()+DURACAO-nowMs)/60000)}`);
  const wrap=document.getElementById(`preco-din-barra-wrap-${tipo}`);
  const barra=document.getElementById(`preco-din-barra-${tipo}`);
  const timerEl=document.getElementById(`preco-din-timer-${tipo}`);
  const tick=()=>{
    const restante=ativadoEm.getTime()+DURACAO-Date.now();
    if(restante<=0){
      clearInterval(_precoDinTimers[tipo]);
      delete _precoDinTimers[tipo];
      if(wrap)wrap.style.display='none';
      _desativarPrecoDinamico(tipo);
      return;
    }
    const pct=(restante/DURACAO)*100;
    const cor=restante>60*60000?'#10b981':restante>30*60000?'#f59e0b':'#ef4444';
    if(wrap)wrap.style.display='block';
    if(barra){barra.style.width=pct+'%';barra.style.background=cor;}
    if(timerEl){
      const h=Math.floor(restante/3600000);
      const m=Math.floor((restante%3600000)/60000);
      const s=Math.floor((restante%60000)/1000);
      timerEl.textContent=`${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')} restantes`;
      timerEl.style.color=cor;
    }
  };
  tick();
  _precoDinTimers[tipo]=setInterval(tick,1000);
}

async function _desativarPrecoDinamico(tipo){
  _precoDinValores[tipo]=0;
  _precoDinTs[tipo]=null;
  localStorage.removeItem(`_pdAtivadoEm_${tipo}`);
  const inp=document.getElementById(`preco-din-valor-${tipo}`);
  if(inp)inp.value='0';
  const agora=new Date().toISOString();
  const [existingVal,existingTs]=await Promise.all([
    db('configuracoes','GET',null,`?chave=eq.${_pdChave(tipo)}`),
    db('configuracoes','GET',null,`?chave=eq.${_pdChaveTs(tipo)}`),
  ]);
  await Promise.all([
    existingVal&&existingVal.length>0?db('configuracoes','PATCH',{valor:'0',updated_at:agora},`?chave=eq.${_pdChave(tipo)}`):Promise.resolve(),
    existingTs&&existingTs.length>0?db('configuracoes','PATCH',{valor:'',updated_at:agora},`?chave=eq.${_pdChaveTs(tipo)}`):Promise.resolve(),
  ]);
  showNotif('⏰ Preço dinâmico desativado automaticamente','','var(--text2)');
}

async function salvarPrecoDinamico(tipo){
  const input=document.getElementById(`preco-din-valor-${tipo}`);
  const fb=document.getElementById(`preco-din-feedback-${tipo}`);
  const valor=parseFloat(input?.value)||0;
  if(fb)fb.innerHTML='<span style="color:var(--text2)">⏳ Salvando...</span>';
  const agora=new Date().toISOString();
  const chave=_pdChave(tipo);
  const payload={valor:String(valor),updated_at:agora};
  console.log('[PD] salvar tipo='+tipo+' chave='+chave+' valor='+valor+' payload=',JSON.stringify(payload));
  try{
    // Upsert valor
    const existing=await db('configuracoes','GET',null,`?chave=eq.${chave}`);
    let res;
    if(existing&&existing.length>0){
      res=await db('configuracoes','PATCH',payload,`?chave=eq.${chave}`);
    }else{
      res=await db('configuracoes','POST',{chave,valor:String(valor),created_at:agora,updated_at:agora});
    }
    if(!res||res.length===0) console.error('[PD] PATCH/POST retornou vazio — possível erro de permissão ou RLS. chave='+chave);
    else console.log('[PD] salvo com sucesso:',res[0]);
    // Upsert timestamp de ativação
    if(valor>0){
      const chaveTs=_pdChaveTs(tipo);
      const existingTs=await db('configuracoes','GET',null,`?chave=eq.${chaveTs}`);
      let resTs;
      if(existingTs&&existingTs.length>0){
        resTs=await db('configuracoes','PATCH',{valor:agora,updated_at:agora},`?chave=eq.${chaveTs}`);
      }else{
        resTs=await db('configuracoes','POST',{chave:chaveTs,valor:agora,created_at:agora,updated_at:agora});
      }
      if(!resTs||resTs.length===0) console.error('[PD] falha ao salvar timestamp. chaveTs='+chaveTs);
      else console.log('[PD] timestamp de ativação salvo: '+agora);
      _precoDinValores[tipo]=valor;
      _precoDinTs[tipo]=agora;
      localStorage.setItem(`_pdAtivadoEm_${tipo}`,agora);
      _iniciarBarraPrecoDin(tipo,new Date(agora));
    }else{
      _precoDinValores[tipo]=0;
      _precoDinTs[tipo]=null;
      localStorage.removeItem(`_pdAtivadoEm_${tipo}`);
      if(_precoDinTimers[tipo]){clearInterval(_precoDinTimers[tipo]);delete _precoDinTimers[tipo];}
      const wrap=document.getElementById(`preco-din-barra-wrap-${tipo}`);
      if(wrap)wrap.style.display='none';
    }
    if(fb)fb.innerHTML='<span style="color:var(--green)">✅ Salvo!</span>';
    showNotif('✅ Preço dinâmico salvo!','');
  }catch(e){
    console.error('[PD] exceção ao salvar tipo='+tipo,e);
    if(fb)fb.innerHTML='<span style="color:var(--red)">❌ Erro ao salvar</span>';
  }
}

async function _pdSelecionarCidade(cidade){
  const wrap=document.getElementById('pd-cidade-content');
  if(!wrap)return;
  if(!cidade){wrap.innerHTML='';return;}
  wrap.innerHTML='<div style="grid-column:1/-1;padding:20px;color:var(--text3);font-size:13px">⏳ Carregando...</div>';
  try{
    const [lojasCidade,entregadores,rpdc,rpdce,raplic,raplicE]=await Promise.all([
      db('lojas','GET',null,'?ativo=eq.true&select=id,nome&order=nome.asc'),
      db('entregadores','GET',null,'?select=id,nome&order=nome.asc'),
      db('configuracoes','GET',null,'?chave=eq.preco_dinamico_por_cidade'),
      db('configuracoes','GET',null,'?chave=eq.preco_dinamico_entregador_por_cidade'),
      db('configuracoes','GET',null,'?chave=eq.preco_dinamico_lojas_aplicaveis_cidade'),
      db('configuracoes','GET',null,'?chave=eq.preco_dinamico_entregadores_aplicaveis_cidade'),
    ]);
    console.log('[PD-cidade] lojas=',lojasCidade?.length,'entregadores=',entregadores?.length);
    console.log('[PD-cidade] lista entregadores completa:',entregadores?.map(e=>e.nome));
    try{_pdCidades=JSON.parse(rpdc[0]?.valor||'{}');}catch(e){_pdCidades={};}
    try{_pdCidadesEnt=JSON.parse(rpdce[0]?.valor||'{}');}catch(e){_pdCidadesEnt={};}
    try{_pdCidadesAplicaveis=JSON.parse(raplic[0]?.valor||'{}');}catch(e){_pdCidadesAplicaveis={};}
    try{_pdCidadesAplicaveisEnt=JSON.parse(raplicE[0]?.valor||'{}');}catch(e){_pdCidadesAplicaveisEnt={};}
    const cidCfgC=_pdCidades[cidade]||{valor:0};
    const cidCfgE=_pdCidadesEnt[cidade]||{valor:0};
    const cidAplicC=_pdCidadesAplicaveis[cidade]||[];
    const cidAplicE=_pdCidadesAplicaveisEnt[cidade]||[];
    wrap.innerHTML=`<div id="pd-cid-wrap-cliente"></div><div id="pd-cid-wrap-entregador"></div>`;
    _renderPdCidadeCard(document.getElementById('pd-cid-wrap-cliente'),'cliente',cidade,lojasCidade||[],cidCfgC,cidAplicC);
    _renderPdCidadeCard(document.getElementById('pd-cid-wrap-entregador'),'entregador',cidade,entregadores||[],cidCfgE,cidAplicE);
  }catch(e){
    console.error('[PD-cidade] erro ao carregar cidade='+cidade,e);
    wrap.innerHTML=`<div style="grid-column:1/-1;padding:20px;color:var(--red);font-size:13px">❌ Erro ao carregar dados da cidade. Veja o console.</div>`;
  }
}

function _renderPdCidadeCard(el,tipo,cidade,entidades,cfg,aplicaveis){
  const label=tipo==='cliente'?'Cobrança da Loja':'Pagamento do Entregador';
  const entLabel=tipo==='cliente'?'Aplicar em (vazio = todas as lojas)':'Aplicar em (vazio = todos os entregadores)';
  const cidSafe=cidade.replace(/[^a-z0-9]/gi,'_');
  const cidKey=`${tipo}_${cidSafe}`;
  const multiId=`pd-cid-multi-${cidKey}`;
  const searchId=`pd-cid-busca-${cidKey}`;
  const selecionados=aplicaveis||[];
  const valor=parseFloat(cfg.valor)||0;
  const optionsHtml=entidades.map(e=>`<label class="pd-cid-opt" style="display:flex;align-items:center;gap:8px;padding:4px 0;cursor:pointer;font-size:13px"><input type="checkbox" value="${e.id}" ${selecionados.includes(e.id)?'checked':''} style="width:14px;height:14px;cursor:pointer"/>${e.nome}</label>`).join('');
  el.innerHTML=`
    <div class="card">
      <div class="card-header"><span class="card-title">📈 ${label} · ${cidade}</span></div>
      <div style="padding:20px">
        <div class="fi" style="margin-bottom:12px">
          <label>Valor extra (R$)</label>
          <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
            <input type="number" id="pd-cid-valor-${cidKey}" step="0.01" placeholder="0.00" value="${valor>0?valor.toFixed(2):''}" style="max-width:160px"/>
            <div id="pd-cid-barra-wrap-${cidKey}" style="flex:1;min-width:160px;display:none">
              <div style="background:var(--surface2);border-radius:6px;height:10px;overflow:hidden;margin-bottom:4px">
                <div id="pd-cid-barra-${cidKey}" style="height:100%;border-radius:6px;width:100%;background:#10b981;transition:width 1s linear"></div>
              </div>
              <div id="pd-cid-timer-${cidKey}" style="font-size:12px;font-weight:600;color:#10b981"></div>
            </div>
          </div>
        </div>
        <div class="fi" style="margin-bottom:14px">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
            <label style="margin:0">${entLabel}</label>
            <span onclick="_pdSelecionarTodos('${multiId}')" style="font-size:11px;color:var(--accent);cursor:pointer;font-weight:600;user-select:none" id="pd-cid-selall-${cidKey}">Selecionar todos</span>
          </div>
          <input type="text" id="${searchId}" placeholder="Buscar..." oninput="_pdFiltrarOpcoes('${multiId}',this.value,'${cidKey}')"
            style="width:100%;padding:7px 10px;border:1px solid var(--border);border-radius:8px 8px 0 0;font-size:12px;background:var(--surface2);color:var(--text);font-family:Inter,sans-serif;box-sizing:border-box;outline:none;border-bottom:none"/>
          <div id="${multiId}" style="max-height:140px;overflow-y:auto;border:1px solid var(--border);border-radius:0 0 8px 8px;padding:6px 10px;background:var(--surface2)">
            ${optionsHtml||'<div style="color:var(--text3);font-size:12px">Nenhum encontrado</div>'}
          </div>
        </div>
        <div id="pd-cid-feedback-${cidKey}" style="margin-bottom:10px;font-size:12px"></div>
        <button class="btn-modal-primary" onclick="_salvarPdCidade('${tipo}','${cidSafe}','${cidade}','${multiId}')">💾 Salvar</button>
      </div>
    </div>`;
  if(valor>0&&cfg.ativado_em){
    const restante=_tsUtc(cfg.ativado_em)+120*60*1000-Date.now();
    if(restante>0)_iniciarBarraPdCidade(tipo,cidade,new Date(_tsUtc(cfg.ativado_em)));
  }
}

function _pdFiltrarOpcoes(multiId,busca,cidKey){
  const q=(busca||'').trim().toLowerCase();
  const wrap=document.getElementById(multiId);
  if(!wrap)return;
  const visiveis=[];
  wrap.querySelectorAll('.pd-cid-opt').forEach(lbl=>{
    const nome=lbl.textContent.toLowerCase();
    const vis=!q||nome.includes(q);
    lbl.style.display=vis?'':'none';
    if(vis)visiveis.push(lbl.querySelector('input[type=checkbox]'));
  });
  if(cidKey){
    const selAllEl=document.getElementById(`pd-cid-selall-${cidKey}`);
    if(selAllEl){
      const todosChecked=visiveis.length>0&&visiveis.every(cb=>cb?.checked);
      selAllEl.textContent=todosChecked?'Desmarcar todos':'Selecionar todos';
    }
  }
}

function _pdSelecionarTodos(multiId){
  const wrap=document.getElementById(multiId);
  if(!wrap)return;
  const visiveis=[...wrap.querySelectorAll('.pd-cid-opt')].filter(lbl=>lbl.style.display!=='none');
  const cbs=visiveis.map(lbl=>lbl.querySelector('input[type=checkbox]')).filter(Boolean);
  const todosChecked=cbs.length>0&&cbs.every(cb=>cb.checked);
  cbs.forEach(cb=>cb.checked=!todosChecked);
  // atualiza label via hack: dispara evento no primeiro checkbox para re-checar estado
  const cidKey=wrap.id.replace('pd-cid-multi-','');
  const selAllEl=document.getElementById(`pd-cid-selall-${cidKey}`);
  if(selAllEl)selAllEl.textContent=todosChecked?'Selecionar todos':'Desmarcar todos';
}

async function _salvarPdCidade(tipo,cidSafe,cidade,multiId){
  const cidKey=`${tipo}_${cidSafe}`;
  const input=document.getElementById(`pd-cid-valor-${cidKey}`);
  const fb=document.getElementById(`pd-cid-feedback-${cidKey}`);
  const valor=parseFloat(input?.value)||0;
  const checks=[...(document.getElementById(multiId)?.querySelectorAll('input[type=checkbox]:checked')||[])];
  const selecionados=checks.map(c=>c.value);
  if(fb)fb.innerHTML='<span style="color:var(--text2)">⏳ Salvando...</span>';
  const agora=new Date().toISOString();
  // chave principal: armazena valor + timer (sem lista de aplicáveis)
  const chave=tipo==='cliente'?'preco_dinamico_por_cidade':'preco_dinamico_entregador_por_cidade';
  const mem=tipo==='cliente'?_pdCidades:_pdCidadesEnt;
  const entry={valor,ativado_em:valor>0?agora:null};
  const newMap={...mem,[cidade]:entry};
  if(tipo==='cliente')_pdCidades=newMap;else _pdCidadesEnt=newMap;
  const payload={valor:JSON.stringify(newMap),updated_at:agora};
  // chave aplicáveis: armazena IDs selecionados separadamente
  const chaveAplic=tipo==='cliente'?'preco_dinamico_lojas_aplicaveis_cidade':'preco_dinamico_entregadores_aplicaveis_cidade';
  const memAplic=tipo==='cliente'?_pdCidadesAplicaveis:_pdCidadesAplicaveisEnt;
  const newAplic={...memAplic,[cidade]:selecionados};
  if(tipo==='cliente')_pdCidadesAplicaveis=newAplic;else _pdCidadesAplicaveisEnt=newAplic;
  const payloadAplic={valor:JSON.stringify(newAplic),updated_at:agora};
  console.log('[PD-cidade] salvar tipo='+tipo+' cidade='+cidade+' valor='+valor+' aplicaveis='+selecionados.length);
  try{
    const [existing,existingAplic]=await Promise.all([
      db('configuracoes','GET',null,`?chave=eq.${chave}`),
      db('configuracoes','GET',null,`?chave=eq.${chaveAplic}`),
    ]);
    const [res,resAplic]=await Promise.all([
      existing&&existing.length>0
        ?db('configuracoes','PATCH',payload,`?chave=eq.${chave}`)
        :db('configuracoes','POST',{chave,valor:JSON.stringify(newMap),created_at:agora,updated_at:agora}),
      existingAplic&&existingAplic.length>0
        ?db('configuracoes','PATCH',payloadAplic,`?chave=eq.${chaveAplic}`)
        :db('configuracoes','POST',{chave:chaveAplic,valor:JSON.stringify(newAplic),created_at:agora,updated_at:agora}),
    ]);
    if(!res||res.length===0) console.error('[PD-cidade] PATCH/POST retornou vazio. chave='+chave);
    else console.log('[PD-cidade] salvo:',res[0]);
    if(!resAplic||resAplic.length===0) console.error('[PD-cidade] PATCH/POST retornou vazio. chave='+chaveAplic);
    else console.log('[PD-cidade] aplicáveis salvo:',resAplic[0]);
    if(valor>0){
      _iniciarBarraPdCidade(tipo,cidade,new Date(agora));
    }else{
      if(_pdCidTimers[cidKey]){clearInterval(_pdCidTimers[cidKey]);delete _pdCidTimers[cidKey];}
      const ww=document.getElementById(`pd-cid-barra-wrap-${cidKey}`);
      if(ww)ww.style.display='none';
    }
    if(fb)fb.innerHTML='<span style="color:var(--green)">✅ Salvo!</span>';
    showNotif(`✅ Preço dinâmico ${cidade} salvo!`,'');
  }catch(e){
    console.error('[PD-cidade] exceção ao salvar tipo='+tipo+' cidade='+cidade,e);
    if(fb)fb.innerHTML='<span style="color:var(--red)">❌ Erro ao salvar</span>';
  }
}

function _iniciarBarraPdCidade(tipo,cidade,ativadoEm){
  const cidSafe=cidade.replace(/[^a-z0-9]/gi,'_');
  const tk=`${tipo}_${cidSafe}`;
  if(_pdCidTimers[tk])clearInterval(_pdCidTimers[tk]);
  const DURACAO=120*60*1000;
  const cidKey=`${tipo}_${cidSafe}`;
  const nowMs=Date.now();
  const difMs=nowMs-ativadoEm.getTime();
  console.log(`[PD timer cidade] tipo=${tipo} cidade=${cidade} timestamp_salvo_utc=${ativadoEm.toISOString()} now_utc=${new Date(nowMs).toISOString()} diferenca_ms=${difMs} minutos_restantes=${Math.floor((ativadoEm.getTime()+DURACAO-nowMs)/60000)}`);
  const wrap=document.getElementById(`pd-cid-barra-wrap-${cidKey}`);
  const barra=document.getElementById(`pd-cid-barra-${cidKey}`);
  const timerEl=document.getElementById(`pd-cid-timer-${cidKey}`);
  const tick=()=>{
    const restante=ativadoEm.getTime()+DURACAO-Date.now();
    if(restante<=0){
      clearInterval(_pdCidTimers[tk]);delete _pdCidTimers[tk];
      if(wrap)wrap.style.display='none';
      _desativarPdCidade(tipo,cidade);
      return;
    }
    const pct=(restante/DURACAO)*100;
    const cor=restante>60*60000?'#10b981':restante>30*60000?'#f59e0b':'#ef4444';
    if(wrap)wrap.style.display='block';
    if(barra){barra.style.width=pct+'%';barra.style.background=cor;}
    if(timerEl){
      const h=Math.floor(restante/3600000);
      const m=Math.floor((restante%3600000)/60000);
      const s=Math.floor((restante%60000)/1000);
      timerEl.textContent=`${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')} restantes`;
      timerEl.style.color=cor;
    }
  };
  tick();
  _pdCidTimers[tk]=setInterval(tick,1000);
}

async function _desativarPdCidade(tipo,cidade){
  const mem=tipo==='cliente'?_pdCidades:_pdCidadesEnt;
  if(mem[cidade]){mem[cidade].valor=0;mem[cidade].ativado_em=null;}
  const chave=tipo==='cliente'?'preco_dinamico_por_cidade':'preco_dinamico_entregador_por_cidade';
  const agora=new Date().toISOString();
  const cidSafe=cidade.replace(/[^a-z0-9]/gi,'_');
  const inp=document.getElementById(`pd-cid-valor-${tipo}_${cidSafe}`);
  if(inp)inp.value='0';
  await db('configuracoes','PATCH',{valor:JSON.stringify(mem),updated_at:agora},`?chave=eq.${chave}`);
  showNotif(`⏰ Preço dinâmico ${cidade} desativado automaticamente`,'','var(--text2)');
}

async function renderNovoPedidoPage(){
  _npRetornoAtivo=false;
  const lojas=currentPerfil==='adm'?await db('lojas','GET',null,'?ativo=eq.true&order=nome.asc'):[];
  _npLojasData=lojas;
  const seletorLoja=currentPerfil==='adm'
    ?`<div class="form-row full"><div class="fi" style="position:relative"><label style="color:#1A56DB;font-weight:700">🏪 Loja</label><input type="text" id="np-loja-busca" placeholder="Digite o nome da loja..." autocomplete="off" oninput="_npLojaFiltrar(this.value)" onfocus="_npLojaFiltrar(this.value)" style="background:var(--surface2);color:var(--text);border:1px solid #1A56DB;border-radius:8px;padding:9px 12px;width:100%;font-family:Inter,sans-serif;font-size:14px;box-sizing:border-box;outline:none"/><input type="hidden" id="np-loja-id"/><div id="np-loja-dropdown" style="display:none;position:absolute;top:100%;left:0;right:0;background:#2D2D2D;border:1px solid #3A3A3A;border-radius:8px;z-index:999;max-height:240px;overflow-y:auto;box-shadow:0 4px 16px rgba(0,0,0,.4);margin-top:2px"></div></div></div>`
    :`<input type="hidden" id="np-loja-id" value="${currentUser?.loja_id||''}">`;
  document.getElementById('app-body').innerHTML=`<div class="alt-page" style="display:flex;align-items:flex-start;justify-content:center"><div style="width:100%;max-width:520px"><div class="page-header"><div class="page-title">➕ Novo Pedido</div></div><div class="card"><div class="modal-body">${seletorLoja}<div class="form-row"><div class="fi"><label>Nº Pedido</label><input id="np-numero" placeholder="0001"/></div><div class="fi"><label>Cliente</label><input id="np-cliente" placeholder="Nome"/></div></div><div class="form-row full"><div class="fi"><label>Telefone</label><input id="np-telefone" placeholder="(16) 99999-9999"/></div></div><div class="form-row full"><div class="fi"><label>Endereço de entrega</label><input id="np-endereco" placeholder="Rua, número, bairro" autocomplete="off" oninput="onChangeEnderecoDebounce()" onfocus="iniciarAutocompleteEndereco('np-endereco','np-lat','np-lng','np-endereco-feedback')"/><input type="hidden" id="np-lat"/><input type="hidden" id="np-lng"/></div></div><div id="np-endereco-feedback" style="font-size:11px;margin:2px 0 6px;min-height:16px"></div><div class="form-row"><div class="fi"><label>Valor do Pedido (R$)</label><input type="number" id="np-valor" placeholder="0.00" step="0.01"/></div><div class="fi"><label>Distância</label><input id="np-km" placeholder="—" readonly style="background:var(--surface2);color:#60a5fa;font-weight:700;cursor:default"/></div></div><div class="form-row"><div class="fi"><label>Taxa de entrega (R$)</label><input type="number" id="np-taxa" placeholder="0.00" step="0.01"/></div><div class="fi"></div></div><div id="np-pd-badge" style="font-size:11px;color:#f59e0b;font-weight:700;margin-bottom:4px;min-height:14px;display:none"></div><div class="form-row"><div class="fi"><label>Gorjeta entregador (R$)</label><input type="number" id="np-gorjeta" placeholder="0.00" step="0.50" value="0" oninput="onChangeGorjeta()"/></div><div class="fi"><label>Retorno</label><div id="np-retorno-btn" onclick="_npToggleRetorno()" style="display:flex;align-items:center;gap:8px;padding:10px 14px;border-radius:10px;cursor:pointer;background:#3a3a3a;transition:background .15s;user-select:none"><span style="font-size:16px">—</span><span id="np-retorno-lbl" style="font-size:13px;font-weight:600;color:#888888">Sem retorno</span></div></div></div><div id="np-gorjeta-info" style="font-size:11px;color:#f59e0b;margin-bottom:4px;min-height:14px"></div><div class="form-row full"><div class="fi"><label>⭐ Pontos</label><input type="number" id="np-pontos" value="4" min="1" max="20"/></div></div><div class="form-row full"><div class="fi"><label>Observações</label><textarea id="np-descricao" placeholder="Itens do pedido..."></textarea></div></div><div id="np-feedback" style="margin-top:4px"></div><div style="display:flex;justify-content:flex-end;margin-top:16px"><button class="btn-modal-primary" onclick="criarPedido()">🚀 Criar Pedido</button></div></div></div></div></div>`;
}

let _fpLojas=[],_fpEntregadores=[];
async function renderPedidosPage(){
  const hoje=_dataHojeBrasilia();
  const _is='padding:7px 10px;border:1px solid var(--border);border-radius:8px;font-size:12px;background:var(--surface2);color:var(--text);font-family:Inter,sans-serif';
  const _lbl=t=>`<label style="display:block;font-size:10px;font-weight:600;color:var(--text2);margin-bottom:4px;letter-spacing:.4px;white-space:nowrap">${t}</label>`;
  document.getElementById('app-body').innerHTML=`<div class="alt-page">
    <div class="page-header"><div class="page-title">📦 Pedidos</div><div style="display:flex;gap:8px">${currentPerfil!=='suporte'?`<button class="btn-sm btn-primary-sm" onclick="abrirModal('modal-pedido')">➕ Novo Pedido</button>`:''}<button class="btn-sm btn-primary-sm" onclick="renderPedidosPage()">↻ Atualizar</button></div></div>
    <div class="card" style="margin-bottom:14px"><div style="padding:14px 16px">
      <div style="display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap">
        <div>${_lbl('DATA INÍCIO')}<div style="display:flex;gap:4px"><input type="date" id="fp-data-ini" value="${hoje}" style="${_is}"/><input type="time" id="fp-hora-ini" value="00:00" style="${_is};width:86px"/></div></div>
        <div>${_lbl('DATA FIM')}<div style="display:flex;gap:4px"><input type="date" id="fp-data-fim" value="${hoje}" style="${_is}"/><input type="time" id="fp-hora-fim" value="23:59" style="${_is};width:86px"/></div></div>
        <div>${_lbl('LOJA')}<select id="fp-loja" style="${_is};min-width:130px"><option value="">Todas</option></select></div>
        <div>${_lbl('ENTREGADOR')}<select id="fp-entregador" style="${_is};min-width:130px"><option value="">Todos</option></select></div>
        <div>${_lbl('BUSCAR PEDIDO')}<input type="text" id="fp-numero" placeholder="Nº pedido..." style="${_is};min-width:110px"/></div>
        <button onclick="_buscarPedidosAdmin()" style="background:var(--accent);color:#fff;border:none;border-radius:8px;padding:8px 18px;font-size:13px;font-weight:700;cursor:pointer;font-family:Inter,sans-serif;white-space:nowrap">🔍 Buscar</button>
      </div>
    </div></div>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:10px">
      <div class="stat-card"><div class="stat-label">TODOS OS PEDIDOS</div><div class="stat-value" id="fp-card-total" style="font-size:26px">—</div></div>
      <div class="stat-card"><div class="stat-label">FINALIZADOS</div><div class="stat-value" id="fp-card-finalizados" style="font-size:26px;color:var(--green)">—</div></div>
      <div class="stat-card"><div class="stat-label">CANCELADOS</div><div class="stat-value" id="fp-card-cancelados" style="font-size:26px;color:var(--red)">—</div></div>
      <div class="stat-card"><div class="stat-label">TOTAL KM</div><div class="stat-value" id="fp-card-km" style="font-size:22px;color:var(--text2)">—</div></div>
    </div>
    ${currentPerfil==='adm'?`<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:14px">
      <div class="stat-card"><div class="stat-label">FATURAMENTO</div><div class="stat-value" id="fp-card-fat" style="font-size:22px;color:var(--accent)">—</div></div>
      <div class="stat-card"><div class="stat-label">DESPESAS</div><div class="stat-value" id="fp-card-desp" style="font-size:22px;color:var(--red)">—</div></div>
      <div class="stat-card"><div class="stat-label">LUCRO LÍQUIDO</div><div class="stat-value" id="fp-card-lucro" style="font-size:22px">—</div></div>
      <div class="stat-card"><div class="stat-label">VALOR MERCADORIA</div><div class="stat-value" id="fp-card-merc" style="font-size:22px;color:var(--accent)">—</div></div>
    </div>`:''}
    <div class="card"><div style="overflow-x:auto"><table><thead><tr><th>Pedido</th><th>Loja</th><th>Endereço</th><th>Valor</th><th>Entregador</th><th>KM</th>${currentPerfil==='adm'?'<th>Pago</th>':''}${currentPerfil!=='suporte'?'<th>Cobrado</th>':''}${currentPerfil==='adm'?'<th>Lucro</th>':''}<th>Logística</th><th>Status</th><th>Cobrança</th><th>Horário</th></tr></thead><tbody id="tbody-pedidos"><tr><td colspan="${currentPerfil==='adm'?13:currentPerfil==='suporte'?10:11}" style="text-align:center;padding:32px;color:var(--text3)">Carregando...</td></tr></tbody></table></div></div>
  </div>`;
  [_fpEntregadores,_fpLojas]=await Promise.all([db('entregadores','GET',null,'?select=id,nome&order=nome.asc'),db('lojas','GET',null,'?select=id,nome,tipo_cobranca&order=nome.asc')]);
  const fpLoja=document.getElementById('fp-loja');
  const fpEnt=document.getElementById('fp-entregador');
  if(fpLoja)fpLoja.innerHTML='<option value="">Todas</option>'+_fpLojas.map(l=>`<option value="${l.id}">${l.nome}</option>`).join('');
  if(fpEnt)fpEnt.innerHTML='<option value="">Todos</option>'+_fpEntregadores.map(e=>`<option value="${e.id}">${e.nome||e.id?.substring(0,8)}</option>`).join('');
  _buscarPedidosAdmin();
}
async function _buscarPedidosAdmin(){
  const tbody=document.getElementById('tbody-pedidos');if(!tbody)return;
  tbody.innerHTML=`<tr><td colspan="${currentPerfil==='adm'?13:currentPerfil==='suporte'?10:11}" style="text-align:center;padding:32px;color:var(--text3)">Buscando...</td></tr>`;
  const dataIni=document.getElementById('fp-data-ini')?.value;
  const dataFim=document.getElementById('fp-data-fim')?.value;
  const horaIni=document.getElementById('fp-hora-ini')?.value||'00:00';
  const horaFim=document.getElementById('fp-hora-fim')?.value||'23:59';
  const lojaId=document.getElementById('fp-loja')?.value;
  const entId=document.getElementById('fp-entregador')?.value;
  const numBusca=(document.getElementById('fp-numero')?.value||'').trim();
  let qs=`?order=created_at.desc&limit=500${_lojaFiltro()}`;
  if(dataIni)qs+=`&created_at=gte.${new Date(`${dataIni}T${horaIni}:00-03:00`).toISOString()}`;
  if(dataFim)qs+=`&created_at=lte.${new Date(`${dataFim}T${horaFim}:59-03:00`).toISOString()}`;
  if(lojaId)qs+=`&loja_id=eq.${lojaId}`;
  const _res=await db('pedidos','GET',null,qs);let arr=Array.isArray(_res)?_res:[];
  if(entId)arr=arr.filter(p=>(p.motoboy_id||p.entregador_id)===entId);
  if(numBusca)arr=arr.filter(p=>String(p.numero||'').includes(numBusca));
  const _ct=document.getElementById('fp-card-total'),_cf=document.getElementById('fp-card-finalizados'),_cc=document.getElementById('fp-card-cancelados'),_ck=document.getElementById('fp-card-km');
  const _cFat=document.getElementById('fp-card-fat'),_cDesp=document.getElementById('fp-card-desp'),_cLucro=document.getElementById('fp-card-lucro'),_cMerc=document.getElementById('fp-card-merc');
  const finalizados=arr.filter(p=>getStatusKey(p)==='finalizado');
  const fat=finalizados.reduce((s,p)=>s+(parseFloat(p.taxa_entrega)||0)+(parseFloat(p.gorjeta)||0),0);
  const desp=finalizados.reduce((s,p)=>s+(parseFloat(p.taxa_motoboy)||0),0);
  const lucro=fat-desp;
  const merc=arr.reduce((s,p)=>s+(parseFloat(p.valor)||0),0);
  if(_ct)_ct.textContent=arr.length;
  if(_cf)_cf.textContent=finalizados.length;
  if(_cc)_cc.textContent=arr.filter(p=>getStatusKey(p)==='cancelado').length;
  if(_ck)_ck.textContent=finalizados.reduce((s,p)=>s+(parseFloat(p.distancia_km)||0),0).toFixed(1)+'km';
  if(_cFat)_cFat.textContent='R$ '+fat.toFixed(2);
  if(_cDesp)_cDesp.textContent='R$ '+desp.toFixed(2);
  if(_cLucro){_cLucro.textContent='R$ '+Math.abs(lucro).toFixed(2);_cLucro.style.color=lucro>=0?'var(--green)':'var(--red)';}
  if(_cMerc)_cMerc.textContent='R$ '+merc.toFixed(2);
  const _showFin=currentPerfil==='adm';
  const _isSup=currentPerfil==='suporte';
  const _fpCols=currentPerfil==='adm'?13:currentPerfil==='suporte'?10:11;
  tbody.innerHTML=arr.length===0?`<tr><td colspan="${_fpCols}" style="text-align:center;padding:32px;color:var(--text3)">Nenhum pedido encontrado</td></tr>`:arr.map(p=>{const sk=getStatusKey(p);const ent=_fpEntregadores.find(e=>e.id===(p.motoboy_id||p.entregador_id));const loja=_fpLojas.find(l=>l.id===p.loja_id);const km=p.distancia_km>0?parseFloat(p.distancia_km).toFixed(1)+'km':'—';const cobradoNum=(parseFloat(p.taxa_entrega)||0)+(parseFloat(p.gorjeta)||0);const pagoNum=parseFloat(p.taxa_motoboy)||0;const cobrado=cobradoNum>0?'R$ '+cobradoNum.toFixed(2):'—';const pago=pagoNum>0?'R$ '+pagoNum.toFixed(2):'—';const lucroLiq=cobradoNum-pagoNum;const lucroStr=cobradoNum>0?`<span style="font-weight:700;color:${lucroLiq>=0?'#22c55e':'#ef4444'}">R$ ${lucroLiq.toFixed(2)}</span>`:'—';const cobranca=loja?.tipo_cobranca==='credito'?'💳 Crédito':loja?.tipo_cobranca==='faturamento'?'📄 Faturamento':'—';return`<tr><td style="font-weight:700;color:var(--text)">#${p.numero||p.id?.substring(0,6)}</td><td style="font-size:12px;color:var(--text2)">${loja?loja.nome:'—'}</td><td>${p.endereco||'—'}</td><td style="font-weight:700;color:var(--green)">R$ ${(p.valor||0).toFixed(2)}</td><td style="font-size:12px;color:var(--text2)">${ent?ent.nome:'—'}</td><td style="font-size:12px;color:var(--text2)">${km}</td>${_showFin?`<td style="font-size:12px;color:var(--text2)">${pago}</td>`:''}${_isSup?'':`<td style="font-size:12px;color:var(--text2)">${cobrado}</td>`}${_showFin?`<td style="font-size:12px;text-align:right">${lucroStr}</td>`:''}<td style="font-size:12px;text-align:center">${_iconsLogistica(p)}</td><td><span class="p-badge b-${sk}">${getStatusLabel(p)}</span></td><td style="font-size:12px;color:var(--text2)">${cobranca}</td><td style="font-size:12px;color:var(--text3)">${formatarDataHora(p.created_at)}</td></tr>`;}).join('');
}
async function renderMotoboyPage(){
  document.getElementById('app-body').innerHTML=`<div class="alt-page"><div class="page-header"><div class="page-title">🛵 Motoboys</div><button class="btn-sm btn-primary-sm" onclick="renderMotoboyPage()">↻ Atualizar</button></div><div class="card"><div style="overflow-x:auto"><table><thead><tr><th>Nome</th><th>Status</th><th>Disponível</th><th>Localização</th><th>Atualizado</th></tr></thead><tbody id="tbody-moto"></tbody></table></div></div></div>`;
  const data=await db('entregadores','GET',null,'?order=updated_at.desc');
  const tbody=document.getElementById('tbody-moto');if(!tbody)return;
  tbody.innerHTML=data.length===0?'<tr><td colspan="5" style="text-align:center;padding:32px;color:var(--text3)">Nenhum motoboy</td></tr>':data.map(e=>`<tr><td style="font-weight:600;color:var(--text)">🛵 ${e.nome||e.id?.substring(0,8)}</td><td><span class="p-badge b-${e.status==='ocupado'?'aguardando':'entregue'}">${e.status||'—'}</span></td><td><span class="p-badge b-${e.disponivel?'em_rota':'fila'}">${e.disponivel?'Online':'Offline'}</span></td><td style="font-size:12px;color:var(--text3)">${e.lat?e.lat.toFixed(2)+', '+e.lng?.toFixed(2):'—'}</td><td style="font-size:12px;color:var(--text3)">${formatarDataHora(e.updated_at)}</td></tr>`).join('');
}

async function renderLojasPage(){
  document.getElementById('app-body').innerHTML=`<div class="alt-page"><div class="page-header"><div class="page-title">🏪 Lojas</div><button class="btn-sm btn-primary-sm" onclick="abrirModal('modal-loja')">➕ Nova Loja</button></div><div class="card"><div style="overflow-x:auto"><table><thead><tr><th>Nome</th><th>Telefone</th><th>Endereço</th><th>E-mail acesso</th><th>Status</th><th>Ações</th></tr></thead><tbody id="tbody-lojas"></tbody></table></div></div></div>`;
  const data=await db('lojas','GET',null,'?order=created_at.desc');
  const tbody=document.getElementById('tbody-lojas');if(!tbody)return;
  tbody.innerHTML=data.length===0?'<tr><td colspan="6" style="text-align:center;padding:32px;color:var(--text3)">Nenhuma loja</td></tr>':data.map(l=>`<tr><td style="font-weight:600;color:var(--text)">🏪 ${l.nome}</td><td>${l.telefone||'—'}</td><td>${l.endereco||'—'}</td><td style="font-size:12px;color:var(--text3)">${l.email||'—'}</td><td><span class="p-badge b-${l.ativo?'em_rota':'fila'}">${l.ativo?'Ativa':'Inativa'}</span></td><td style="white-space:nowrap"><button onclick="abrirEditarLoja('${l.id}')" style="background:none;border:1px solid var(--border);border-radius:6px;width:30px;height:30px;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;font-size:14px;">✏️</button><button onclick="excluirLoja('${l.id}','${(l.nome||'').replace(/'/g,"\\'")}')" style="background:none;border:1px solid #ef4444;border-radius:6px;width:30px;height:30px;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;font-size:14px;margin-left:4px">🗑️</button></td></tr>`).join('');
}

async function abrirEditarLoja(lojaId){
  const [data,tabelasCobranca,tabelasPagamento]=await Promise.all([db('lojas','GET',null,`?id=eq.${lojaId}`),db('tabelas_preco','GET',null,'?tipo=eq.cobranca&order=nome.asc'),db('tabelas_preco','GET',null,'?tipo=eq.pagamento&order=nome.asc')]);
  const l=data[0];if(!l)return;
  let modal=document.getElementById('modal-editar-loja');
  if(!modal){modal=document.createElement('div');modal.id='modal-editar-loja';modal.className='modal-overlay';document.body.appendChild(modal);}
  const ss='background:var(--surface2);color:var(--text);border:1px solid var(--border);border-radius:8px;padding:9px 12px;width:100%;font-family:Inter,sans-serif;font-size:14px';
  const is=ss+';box-sizing:border-box';
  const v=(x)=>(x||'').toString().replace(/"/g,'&quot;');
  const inp=(id,val,ph='',type='text')=>`<input id="${id}" type="${type}" value="${v(val)}" placeholder="${ph}" style="${is}"/>`;
  const sel=(id,val,opts)=>`<select id="${id}" style="${ss}">${opts.map(([ov,ol])=>`<option value="${ov}"${val===ov?' selected':''}>${ol}</option>`).join('')}</select>`;
  const sec=(t)=>`<div style="font-size:11px;font-weight:700;color:var(--accent);letter-spacing:1px;text-transform:uppercase;padding:10px 0 6px;border-bottom:1px solid var(--border);margin-bottom:10px;margin-top:4px">${t}</div>`;
  const fi=(lbl,content)=>`<div class="fi"><label>${lbl}</label>${content}</div>`;
  const r2=(a,b)=>`<div class="form-row">${a}${b}</div>`;
  const r1=(a)=>`<div class="form-row full">${a}</div>`;
  modal.innerHTML=`<div class="modal" style="max-width:560px"><div class="modal-header"><span class="modal-title">✏️ Editar Loja — ${v(l.nome)}</span><button class="modal-close" onclick="document.getElementById('modal-editar-loja').classList.remove('open')">✕</button></div><div class="modal-body" style="max-height:75vh;overflow-y:auto">
${r2(fi('Nome do Estabelecimento',inp('el-nome',l.nome)),fi('Razão Social',inp('el-razao-social',l.razao_social)))}
${r2(fi('Inscrição Estadual',inp('el-insc-estadual',l.inscricao_estadual)),fi('Inscrição Municipal',inp('el-insc-municipal',l.inscricao_municipal)))}
${r1(fi('Endereço',`<input id="el-endereco" value="${v(l.endereco)}" placeholder="Rua, número, bairro" autocomplete="off" style="${is}" onfocus="iniciarAutocompleteEndereco('el-endereco','el-lat','el-lng','el-geo-feedback')"/><input type="hidden" id="el-lat" value="${l.latitude||''}"/><input type="hidden" id="el-lng" value="${l.longitude||''}"/>`))}
<div id="el-geo-feedback" style="font-size:11px;margin:-6px 0 6px;min-height:16px"></div>
${r2(fi('CEP',inp('el-cep',l.cep,'00000-000')),fi('Complemento',inp('el-complemento',l.complemento)))}
${r2(fi('Tipo de Cliente',sel('el-tipo-cliente',l.tipo_cliente,[['','Selecione...'],['COLETA_FIXA','COLETA FIXA'],['CLIENTE_FIXO','CLIENTE FIXO'],['CLIENTE_EVENTUAL','CLIENTE EVENTUAL']])),fi('Responsável',inp('el-responsavel',l.responsavel)))}
${r2(fi('WhatsApp da Loja',inp('el-telefone',l.telefone,'(16) 3333-3333')),fi('WhatsApp Financeiro',inp('el-celular',l.celular,'(16) 99999-9999')))}
${r2(fi('E-mail',inp('el-email',l.email)),fi('Pessoa Física / Jurídica',sel('el-pessoa-juridica',l.pessoa_juridica===true?'true':l.pessoa_juridica===false?'false':'',[['','Selecione...'],['false','Pessoa Física'],['true','Pessoa Jurídica']])))}
${r2(fi('Status',sel('el-ativo',l.ativo?'true':'false',[['true','Ativa'],['false','Inativa']])),fi('',`<div style="display:flex;align-items:flex-end;height:100%"><button onclick="resetSenhaLoja('${v(l.email)}')" style="width:100%;padding:9px 12px;background:var(--surface2);color:var(--text);border:1px solid var(--border);border-radius:8px;cursor:pointer;font-size:13px;font-weight:600">🔑 Redefinir Senha</button></div>`))}
${sec('Tabelas de Preço')}
${r2(fi('Tabela de Cobrança',`<select id="el-tabela-cobranca" style="${ss}"><option value="">Padrão do sistema</option>${tabelasCobranca.map(t=>`<option value="${t.id}"${t.id===l.tabela_cobranca_id?' selected':''}>${t.nome}</option>`).join('')}</select>`),fi('Tabela de Pagamento Motoboy',`<select id="el-tabela-pagamento" style="${ss}"><option value="">Padrão do sistema</option>${tabelasPagamento.map(t=>`<option value="${t.id}"${t.id===l.tabela_pagamento_id?' selected':''}>${t.nome}</option>`).join('')}</select>`))}
${r1(fi('Tipo de Cobrança',`<select id="el-tipo-cobranca" style="${ss}"><option value="faturamento"${(l.tipo_cobranca||'faturamento')==='faturamento'?' selected':''}>📄 Faturamento</option><option value="credito"${l.tipo_cobranca==='credito'?' selected':''}>💳 Crédito</option></select>`))}

<div id="el-feedback" style="margin-top:10px"></div></div><div class="modal-footer"><button class="btn-modal-cancel" onclick="document.getElementById('modal-editar-loja').classList.remove('open')">Cancelar</button><button onclick="salvarEdicaoLoja('${lojaId}')" style="background:#22c55e;color:#fff;border:none;border-radius:10px;padding:10px 24px;font-size:14px;font-weight:700;cursor:pointer">✓ Salvar</button></div></div>`;
  modal.classList.add('open');
  setTimeout(()=>iniciarAutocompleteEndereco('el-endereco','el-lat','el-lng','el-geo-feedback'),100);
}
async function resetSenhaLoja(email){
  const fb=document.getElementById('el-feedback');
  if(!email){if(fb)fb.innerHTML='<div style="color:#ef4444;font-size:13px">E-mail não informado.</div>';return;}
  if(fb)fb.innerHTML='<div style="color:var(--text2);font-size:13px">Enviando e-mail…</div>';
  try{
    const r=await fetch(`${SB_URL}/auth/v1/recover`,{method:'POST',headers:{'apikey':SB_KEY,'Content-Type':'application/json'},body:JSON.stringify({email})});
    if(fb)fb.innerHTML=r.ok?'<div style="color:#22c55e;font-size:13px">✅ E-mail de redefinição enviado!</div>':'<div style="color:#ef4444;font-size:13px">Erro ao enviar e-mail.</div>';
  }catch{if(fb)fb.innerHTML='<div style="color:#ef4444;font-size:13px">Erro de conexão.</div>';}
}
async function geocodificarLoja(){
  const endereco=document.getElementById('el-endereco')?.value,fb=document.getElementById('el-geo-feedback');
  if(!endereco){if(fb)fb.innerHTML='<span style="color:var(--red)">Preencha o endereço primeiro</span>';return;}
  if(!/\d/.test(endereco)){if(fb)fb.innerHTML='<span style="color:var(--text3)">Digite o endereço com número (ex: Rua das Flores, 123)</span>';return;}
  if(fb)fb.innerHTML='<span style="color:var(--text2)">⏳ Buscando...</span>';
  const geo=await geocodificarEndereco(endereco);
  if(geo){document.getElementById('el-lat').value=geo.lat.toFixed(6);document.getElementById('el-lng').value=geo.lng.toFixed(6);if(fb)fb.innerHTML=`<span style="color:var(--green)">✅ ${geo.lat.toFixed(6)}, ${geo.lng.toFixed(6)}</span>`;}
  else{if(fb)fb.innerHTML='<span style="color:var(--red)">❌ Não encontrado</span>';}
}
async function salvarEdicaoLoja(lojaId){
  const fb=document.getElementById('el-feedback');if(fb)fb.innerHTML='<div style="color:var(--text2);font-size:13px">⏳ Salvando...</div>';
  const g=(id)=>document.getElementById(id)?.value||'';
  const pj=g('el-pessoa-juridica');
  const update={
    nome:g('el-nome'),razao_social:g('el-razao-social'),
    inscricao_estadual:g('el-insc-estadual'),inscricao_municipal:g('el-insc-municipal'),
    endereco:g('el-endereco'),cep:g('el-cep'),complemento:g('el-complemento'),
    tipo_cliente:g('el-tipo-cliente')||null,responsavel:g('el-responsavel'),
    telefone:g('el-telefone'),celular:g('el-celular'),email:g('el-email'),
    pessoa_juridica:pj===''?null:pj==='true',
    ativo:g('el-ativo')==='true',
    tabela_cobranca_id:g('el-tabela-cobranca')||null,
    tabela_pagamento_id:g('el-tabela-pagamento')||null,
    tipo_cobranca:g('el-tipo-cobranca')||'faturamento',
    updated_at:new Date().toISOString()
  };
  if(!update.nome){if(fb)fb.innerHTML='<div style="color:#ef4444;font-size:13px">Nome obrigatório.</div>';return;}
  let lat=parseFloat(document.getElementById('el-lat')?.value)||null;
  let lng=parseFloat(document.getElementById('el-lng')?.value)||null;
  if(update.endereco&&(!lat||!lng)){
    const geo=await geocodificarEndereco(update.endereco).catch(()=>null);
    if(geo){lat=geo.lat;lng=geo.lng;}
  }
  if(lat)update.latitude=lat;
  if(lng)update.longitude=lng;
  const res=await dbPatch('lojas',update,`?id=eq.${lojaId}`);
  if(res===null){if(fb)fb.innerHTML='<div style="color:#ef4444;font-size:13px">❌ Erro ao salvar. Veja o console.</div>';showNotif('❌ Erro ao salvar loja','','var(--red)');return;}
  await logAcao('editar_loja',{loja_id:lojaId,nome:update.nome});
  // invalida cache de faixas para a loja editada
  const _lojaEdit=allLojas.find(l=>l.id===lojaId);if(_lojaEdit){_lojaEdit.tabela_cobranca_id=update.tabela_cobranca_id;_lojaEdit.tabela_pagamento_id=update.tabela_pagamento_id;_lojaEdit.tipo_cobranca=update.tipo_cobranca;if(update.tabela_cobranca_id)delete _faixasCachePorTabela[update.tabela_cobranca_id];if(update.tabela_pagamento_id)delete _faixasCachePorTabelaPag[update.tabela_pagamento_id];}
  if(fb)fb.innerHTML='<div style="color:#22c55e;font-size:13px">✅ Loja atualizada!</div>';showNotif('✅ Loja atualizada!',update.nome);
  setTimeout(()=>{document.getElementById('modal-editar-loja')?.classList.remove('open');renderLojasPage();},1200);
}
async function criarLoja(){
  const nome=document.getElementById('loja-nome').value,telefone=document.getElementById('loja-telefone').value,endereco=document.getElementById('loja-endereco').value,email=document.getElementById('loja-email').value,senha=document.getElementById('loja-senha').value;
  const fb=document.getElementById('loja-feedback');
  if(!nome||!email||!senha){fb.innerHTML='<div style="color:var(--red);font-size:13px">Preencha nome, e-mail e senha.</div>';return;}
  fb.innerHTML='<div style="color:var(--text2);font-size:13px">⏳ Cadastrando...</div>';
  const tabCobranca=document.getElementById('loja-tabela-cobranca')?.value||null;
  const tabPagamento=document.getElementById('loja-tabela-pagamento')?.value||null;
  let lat=parseFloat(document.getElementById('loja-lat')?.value)||null;
  let lng=parseFloat(document.getElementById('loja-lng')?.value)||null;
  if(endereco&&(!lat||!lng)){
    fb.innerHTML='<div style="color:var(--text2);font-size:13px">📍 Geocodificando endereço...</div>';
    const geo=await geocodificarEndereco(endereco).catch(()=>null);
    if(geo){lat=geo.lat;lng=geo.lng;}
  }
  const tipoCobranca=document.getElementById('loja-tipo-cobranca')?.value||'faturamento';
  const lojas=await db('lojas','POST',{nome,telefone,endereco,email,ativo:true,latitude:lat,longitude:lng,tipo_cobranca:tipoCobranca});
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
  tbody.innerHTML=data.length===0?'<tr><td colspan="6" style="text-align:center;padding:32px;color:var(--text3)">Nenhum usuário</td></tr>':data.map(u=>{const loja=lojas.find(l=>l.id===u.loja_id);return`<tr><td style="font-weight:600;color:var(--text)">${u.nome}</td><td style="font-size:12px">${u.email}</td><td><span class="user-perfil-badge ${badgeMap[u.perfil]||''}">${u.perfil?.toUpperCase()}</span></td><td style="font-size:12px;color:var(--text3)">${loja?loja.nome:'—'}</td><td><span class="p-badge b-${u.ativo?'em_rota':'fila'}">${u.ativo?'Ativo':'Inativo'}</span></td><td style="font-size:12px;color:var(--text3)">${u.created_at?formatarDataHora(u.created_at):'—'}</td></tr>`;}).join('');
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
  const hoje=_dataHojeBrasilia();
  const lojas=currentPerfil!=='loja'?await db('lojas','GET',null,'?ativo=eq.true&order=nome.asc'):[];
  const opcoesLojas=currentPerfil==='loja'?'':`<option value="">Todas as lojas</option>`+lojas.map(l=>`<option value="${l.id}">${l.nome}</option>`).join('');
  const selectStyle='background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:7px 10px;font-family:Inter,sans-serif;font-size:13px;color:var(--text);min-width:160px';
  const inputStyle='background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:7px 10px;font-family:Inter,sans-serif;font-size:13px;color:var(--text)';
  document.getElementById('app-body').innerHTML=`<div class="alt-page"><div class="page-header" style="flex-wrap:wrap;gap:12px"><div class="page-title">📈 Relatórios</div><div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap"><div style="display:flex;align-items:center;gap:6px"><label style="font-size:12px;color:var(--text3);font-weight:600;white-space:nowrap">De</label><input type="date" id="r-de" value="${hoje}" style="${inputStyle}"/></div><div style="display:flex;align-items:center;gap:6px"><label style="font-size:12px;color:var(--text3);font-weight:600;white-space:nowrap">Até</label><input type="date" id="r-ate" value="${hoje}" style="${inputStyle}"/></div><div style="display:flex;align-items:center;gap:6px"><label style="font-size:12px;color:var(--text3);font-weight:600;white-space:nowrap">Loja</label><select id="r-loja" style="${selectStyle}">${opcoesLojas}</select></div><button class="btn-sm btn-primary-sm" onclick="carregarRelatorio()">🔍 Filtrar</button></div></div><div class="stats-grid"><div class="stat-card"><div class="stat-label">Total Pedidos</div><div class="stat-value" id="r-total">—</div></div><div class="stat-card"><div class="stat-label">Entregues</div><div class="stat-value" id="r-ent" style="color:var(--green)">—</div></div><div class="stat-card"><div class="stat-label">Faturamento</div><div class="stat-value" id="r-fat" style="color:var(--accent)">—</div></div>${currentPerfil!=='loja'?`<div class="stat-card"><div class="stat-label">Motoboys</div><div class="stat-value" id="r-moto">—</div></div><div class="stat-card"><div class="stat-label">Lojas</div><div class="stat-value" id="r-lojas">—</div></div><div class="stat-card"><div class="stat-label">Usuários</div><div class="stat-value" id="r-usuarios">—</div></div>`:''}</div><div class="card"><div class="card-header"><span class="card-title">Pedidos por Status</span></div><div style="padding:20px" id="status-bars"><div style="color:var(--text3);text-align:center;padding:20px">Carregando...</div></div></div></div>`;
  carregarRelatorio();
}
async function carregarRelatorio(){
  const de=document.getElementById('r-de')?.value,ate=document.getElementById('r-ate')?.value,lojaId=document.getElementById('r-loja')?.value;
  let filtro='?order=created_at.desc';
  if(de)filtro+=`&created_at=gte.${_inicioDiaBrasilia(de)}`;
  if(ate)filtro+=`&created_at=lte.${_fimDiaBrasilia(ate)}`;
  if(lojaId)filtro+=`&loja_id=eq.${lojaId}`;
  filtro+=_lojaFiltro();
  const isLoja=currentPerfil==='loja';
  const [pedidos,motoboys,lojas,usuarios]=await Promise.all([
    db('pedidos','GET',null,filtro),
    isLoja?Promise.resolve([]):db('entregadores','GET',null,''),
    isLoja?Promise.resolve([]):db('lojas','GET',null,''),
    isLoja?Promise.resolve([]):db('usuarios_painel','GET',null,''),
  ]);
  document.getElementById('r-total').textContent=pedidos.length;
  document.getElementById('r-ent').textContent=pedidos.filter(p=>p.status==='entregue'||p.status==='finalizado').length;
  document.getElementById('r-fat').textContent='R$ '+pedidos.reduce((s,p)=>s+(parseFloat(p.valor)||0),0).toFixed(2);
  if(!isLoja){
    document.getElementById('r-moto').textContent=motoboys.length;
    document.getElementById('r-lojas').textContent=lojas.length;
    document.getElementById('r-usuarios').textContent=usuarios.length;
  }
  const sc={};pedidos.forEach(p=>{const s=getStatusKey(p);sc[s]=(sc[s]||0)+1;});
  const total=pedidos.length||1;const colors={recebido:'#EF4444',pronto:'#EC4899',aceito:'#F59E0B',chegou_local:'#38BDF8',em_rota:'#1A56DB',chegou_destino:'#7C3AED',retornando:'#10B981',finalizado:'#10B981',entregue:'#475569',cancelado:'#EF4444'};
  document.getElementById('status-bars').innerHTML=pedidos.length===0?'<div style="color:var(--text3);text-align:center;padding:20px">Nenhum pedido no período</div>':Object.entries(sc).map(([s,n])=>`<div style="margin-bottom:14px"><div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:5px"><span style="color:var(--text2)">${STATUS_LABEL[s]||s}</span><span style="font-weight:700">${n}</span></div><div style="background:var(--surface2);border-radius:4px;height:8px;overflow:hidden"><div style="background:${colors[s]||'#475569'};height:100%;width:${(n/total*100).toFixed(1)}%;border-radius:4px"></div></div></div>`).join('');
}

async function renderAuditoriaPage(){
  if(currentPerfil!=='adm'){showNotif('Sem acesso','','var(--red)');return;}
  const hoje=_dataHojeBrasilia();
  const inputStyle='padding:6px 10px;border:1px solid var(--border);border-radius:8px;font-size:12px;background:var(--surface2);color:var(--text);font-family:Inter,sans-serif;outline:none';
  document.getElementById('app-body').innerHTML=`
    <div class="alt-page">
      <div class="page-header" style="flex-wrap:wrap;gap:10px">
        <div class="page-title">🔍 Auditoria</div>
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          <label style="font-size:12px;color:var(--text3);font-weight:600">De</label>
          <input type="date" id="aud-de" value="${hoje}" style="${inputStyle}"/>
          <label style="font-size:12px;color:var(--text3);font-weight:600">Até</label>
          <input type="date" id="aud-ate" value="${hoje}" style="${inputStyle}"/>
          <button class="btn-sm btn-primary-sm" onclick="_runAuditoria()">🔍 Verificar</button>
        </div>
      </div>
      <div id="aud-resultado" style="margin-top:4px">
        <div style="padding:40px;text-align:center;color:var(--text3);font-size:13px">⏳ Carregando...</div>
      </div>
    </div>`;
  _runAuditoria();
}
async function _runAuditoria(){
  const el=document.getElementById('aud-resultado');if(!el)return;
  const de=document.getElementById('aud-de')?.value||_dataHojeBrasilia();
  const ate=document.getElementById('aud-ate')?.value||_dataHojeBrasilia();
  el.innerHTML=`<div style="padding:40px;text-align:center;color:var(--text3);font-size:13px">⏳ Verificando ${de===ate?de:de+' → '+ate}...</div>`;
  try{
    const ini=_inicioDiaBrasilia(de),fim=_fimDiaBrasilia(ate);
    // Segunda-feira da semana atual (00:00 Brasília) — ciclo semanal só cobre semanas fechadas
    const _hojeStr=_dataHojeBrasilia();const [_yy,_mm,_dd]=_hojeStr.split('-').map(Number);
    const _dUtc=new Date(Date.UTC(_yy,_mm-1,_dd));const _dow=_dUtc.getUTCDay();
    const _diasDesdeSegunda=_dow===0?6:_dow-1;
    const _segundaStr=new Date(Date.UTC(_yy,_mm-1,_dd-_diasDesdeSegunda)).toISOString().slice(0,10);
    const segundaAtualInicio=_inicioDiaBrasilia(_segundaStr);
    const pedidos=await db('pedidos','GET',null,`?created_at=gte.${ini}&created_at=lte.${fim}&order=created_at.asc&limit=1000`);
    if(!Array.isArray(pedidos)){el.innerHTML=`<div class="card" style="padding:20px;color:var(--red)">❌ Erro ao buscar pedidos.</div>`;return;}
    const problemas=[];

    // CHECK 1 — Consistência de cálculo
    const lojaIdsChk=[...new Set(pedidos.map(p=>p.loja_id).filter(Boolean))];
    const faixasCobMap={},faixasPagMap={};
    await Promise.all(lojaIdsChk.map(async id=>{
      faixasCobMap[id]=await _getFaixasCobranca(id);
      faixasPagMap[id]=await _getFaixasPagamento(id);
    }));
    for(const p of pedidos){
      if((p.status_detalhado||p.status)==='cancelado'||!p.distancia_km)continue;
      const fc=faixasCobMap[p.loja_id]||_faixasCobranca;
      const fp=faixasPagMap[p.loja_id]||_faixasPagamento;
      // preco_dinamico armazena o PD do CLIENTE (sobrescrito por _aplicarPrecoDinamico)
      const pdCliente=parseFloat(p.preco_dinamico)||0;
      const expEntrega=_calcTaxaLoja({distancia_km:p.distancia_km,com_retorno:p.com_retorno,gorjeta:0,preco_dinamico:pdCliente,taxa_entrega:0,loja_id:p.loja_id},fc);
      // taxa_entrega_motoboy foi calculado com o PD do ENTREGADOR (diferente do PD do cliente)
      // quando disponível, é o valor de referência correto para validar taxa_motoboy
      const expMotoboy=p.taxa_entrega_motoboy!=null
        ?parseFloat(p.taxa_entrega_motoboy)
        :_calcTaxaMotoboy({distancia_km:p.distancia_km,com_retorno:p.com_retorno,gorjeta:parseFloat(p.gorjeta)||0,preco_dinamico:pdCliente,loja_id:p.loja_id},fp);
      const lojaNome=allLojas.find(l=>l.id===p.loja_id)?.nome||p.loja_id?.substring(0,8)||'?';
      const savedE=parseFloat(p.taxa_entrega)||0;
      const savedM=parseFloat(p.taxa_motoboy);
      if(Math.abs(savedE-expEntrega)>0.05)
        problemas.push({tipo:'CÁLCULO',descricao:`#${p.numero} (${lojaNome}) — Cobrança: esperado R$${expEntrega.toFixed(2)}, salvo R$${savedE.toFixed(2)}, diferença R$${(savedE-expEntrega).toFixed(2)}`,pedidoId:p.id,numero:p.numero,cor:'#f59e0b'});
      if(!isNaN(savedM)&&expMotoboy!==null&&Math.abs(savedM-expMotoboy)>0.05)
        problemas.push({tipo:'CÁLCULO',descricao:`#${p.numero} (${lojaNome}) — Motoboy: esperado R$${expMotoboy.toFixed(2)}, salvo R$${savedM.toFixed(2)}, diferença R$${(savedM-expMotoboy).toFixed(2)}`,pedidoId:p.id,numero:p.numero,cor:'#f59e0b'});
    }

    // CHECK 2 — Duplicados (mesmo número + mesma loja + < 5 min)
    const grpDup={};
    for(const p of pedidos){
      const k=`${p.numero||''}__${p.loja_id||''}`;
      if(!grpDup[k])grpDup[k]=[];
      grpDup[k].push(p);
    }
    for(const arr of Object.values(grpDup)){
      if(arr.length<2)continue;
      for(let i=0;i<arr.length;i++){for(let j=i+1;j<arr.length;j++){
        const diff=Math.abs(_tsUtc(arr[i].created_at)-_tsUtc(arr[j].created_at));
        if(diff<5*60*1000){
          const lojaNome=allLojas.find(l=>l.id===arr[i].loja_id)?.nome||'?';
          problemas.push({tipo:'DUPLICADO',descricao:`#${arr[i].numero} (${lojaNome}) — Dois pedidos com mesmo número criados com ${Math.round(diff/1000)}s de diferença`,pedidoId:arr[i].id,numero:arr[i].numero,cor:'#ef4444'});
        }
      }}
    }

    // CHECK 3 — Lojas faturamento sem cobrança no período
    const pedidosFin=pedidos.filter(p=>getStatusKey(p)==='finalizado');
    // Ciclo semanal (Gerar Cobranças/Pagamentos) só cobre semanas fechadas; ignora semana atual
    const pedidosFinSemanaFechada=pedidosFin.filter(p=>p.created_at<segundaAtualInicio);
    const lojasFatIds=new Set(allLojas.filter(l=>(l.tipo_cobranca||'faturamento')==='faturamento').map(l=>l.id));
    const lojaComPedFat=[...new Set(pedidosFinSemanaFechada.filter(p=>lojasFatIds.has(p.loja_id)).map(p=>p.loja_id))];
    if(lojaComPedFat.length){
      const cobs=await db('cobrancas_lojas','GET',null,`?status=in.(pendente,pago,aprovado)&created_at=gte.${ini}&created_at=lte.${fim}&select=loja_id`).catch(()=>[]);
      const cobLojaIds=new Set((Array.isArray(cobs)?cobs:[]).map(c=>c.loja_id));
      for(const lid of lojaComPedFat){
        if(!cobLojaIds.has(lid)){
          const lojaNome=allLojas.find(l=>l.id===lid)?.nome||lid?.substring(0,8)||'?';
          const qtd=pedidosFinSemanaFechada.filter(p=>p.loja_id===lid).length;
          problemas.push({tipo:'COBRANÇA',descricao:`${lojaNome} — ${qtd} pedido(s) finalizado(s) sem cobrança_loja registrada no período`,pedidoId:pedidosFinSemanaFechada.find(p=>p.loja_id===lid)?.id,numero:pedidosFinSemanaFechada.find(p=>p.loja_id===lid)?.numero,cor:'#8b5cf6'});
        }
      }
    }

    // CHECK 4 — Entregadores sem saque no período
    const entComPedFin=[...new Set(pedidosFinSemanaFechada.map(p=>p.motoboy_id||p.entregador_id).filter(Boolean))];
    if(entComPedFin.length){
      const saques=await db('saques','GET',null,`?status=in.(pago,aprovado,pendente)&created_at=gte.${ini}&created_at=lte.${fim}&select=entregador_id`).catch(()=>[]);
      const saqueEntIds=new Set((Array.isArray(saques)?saques:[]).map(s=>s.entregador_id));
      for(const eid of entComPedFin){
        if(!saqueEntIds.has(eid)){
          const ent=allMotoboys.find(e=>e.id===eid);
          const qtd=pedidosFinSemanaFechada.filter(p=>(p.motoboy_id||p.entregador_id)===eid).length;
          problemas.push({tipo:'PAGAMENTO',descricao:`${ent?.nome||eid?.substring(0,8)||'?'} — ${qtd} pedido(s) finalizado(s) sem pagamento gerado no período`,pedidoId:pedidosFinSemanaFechada.find(p=>(p.motoboy_id||p.entregador_id)===eid)?.id,numero:pedidosFinSemanaFechada.find(p=>(p.motoboy_id||p.entregador_id)===eid)?.numero,cor:'#06b6d4'});
        }
      }
    }

    if(!problemas.length){
      el.innerHTML=`<div class="card"><div style="padding:48px;text-align:center;color:var(--green);font-size:15px;font-weight:700">✅ Nenhum problema encontrado no período (${pedidos.length} pedido(s) verificado(s))</div></div>`;
      return;
    }
    const pedidoStatusMap=Object.fromEntries(pedidos.map(p=>[p.id,p.status_detalhado||p.status||'']));
    const badgeHtml=(pr)=>`<span style="display:inline-block;padding:2px 9px;border-radius:12px;font-size:11px;font-weight:700;background:${pr.cor}22;color:${pr.cor};border:1px solid ${pr.cor}44;white-space:nowrap">${pr.tipo}</span>`;
    const btnVer=(pr)=>{
      if(!pr.pedidoId)return'—';
      const st=pedidoStatusMap[pr.pedidoId]||'';
      const isTerminal=['finalizado','cancelado'].includes(st);
      const onclick=isTerminal
        ?`_irParaPedidoHistorico('${(pr.numero||'').replace(/'/g,"\\'")}')`
        :`goTab('mapa');setTimeout(()=>_irParaPedido('${pr.pedidoId}'),600)`;
      return`<button onclick="${onclick}" style="padding:3px 10px;background:var(--accent);color:#fff;border:none;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;white-space:nowrap">Ver #${pr.numero||'?'}</button>`;
    };
    el.innerHTML=`<div class="card"><div style="padding:12px 16px;border-bottom:1px solid var(--border)"><span style="font-weight:700;font-size:14px">⚠️ ${problemas.length} problema(s) encontrado(s) em ${pedidos.length} pedido(s)</span></div><div style="overflow-x:auto"><table><thead><tr><th>Tipo</th><th>Descrição</th><th></th></tr></thead><tbody>
      ${problemas.map(pr=>`<tr><td style="white-space:nowrap">${badgeHtml(pr)}</td><td style="font-size:13px;color:var(--text2)">${pr.descricao}</td><td>${btnVer(pr)}</td></tr>`).join('')}
    </tbody></table></div></div>`;
  }catch(e){
    console.error('[Auditoria] erro:',e);
    el.innerHTML=`<div class="card"><div style="padding:20px;color:var(--red);font-size:13px">❌ Erro ao rodar verificações: ${e?.message||String(e)}</div></div>`;
  }
}

async function renderLogsPage(){
  document.getElementById('app-body').innerHTML=`<div class="alt-page"><div class="page-header"><div class="page-title">📋 Logs de Ações</div><button class="btn-sm btn-primary-sm" onclick="renderLogsPage()">↻ Atualizar</button></div><div class="card"><div style="overflow-x:auto"><table><thead><tr><th>Data/Hora</th><th>Usuário</th><th>Ação</th><th>Detalhes</th></tr></thead><tbody id="tbody-logs"></tbody></table></div></div></div>`;
  const logs=await db('logs_acoes','GET',null,'?order=created_at.desc&limit=100'),usuarios=await db('usuarios_painel','GET',null,'');
  const tbody=document.getElementById('tbody-logs');if(!tbody)return;
  tbody.innerHTML=logs.length===0?'<tr><td colspan="4" style="text-align:center;padding:32px;color:var(--text3)">Nenhum log</td></tr>':logs.map(l=>{const u=usuarios.find(x=>x.id===l.usuario_id);return`<tr><td style="font-size:12px;color:var(--text3)">${formatarDataHora(l.created_at)}</td><td style="font-weight:600;color:var(--text)">${u?u.nome:'—'} <span style="font-size:10px;color:var(--text3)">(${u?.perfil||'—'})</span></td><td><span class="p-badge b-disponivel">${l.acao}</span></td><td style="font-size:12px;color:var(--text3)">${l.detalhes?JSON.stringify(l.detalhes).substring(0,80):'—'}</td></tr>`;}).join('');
}

let _financeiroAba='gerar-pagamento';
let _histFiltroStatus='';
let _histFiltroEntregador='';
let _histSaquesData=[];
let _gpResultados={};
let _gcResultados={};

async function _carregarBadgeSaques(){
  const r=await db('saques','GET',null,'?select=id&status=eq.pendente');
  _saquesPendentesCount=Array.isArray(r)?r.length:0;
  renderNavSidebar(_navAtivo);
}

async function renderFinanceiroPage(aba){
  _financeiroAba=aba||_financeiroAba||'gerar-cobranca';
  const abas=[
    {id:'gerar-cobranca',icon:'🏪',label:'Gerar Cobranças'},
    {id:'aprovar-cobrancas',icon:'📲',label:'Enviar Faturas'},
    {id:'gerar-pagamento',icon:'💸',label:'Gerar Pagamentos'},
    {id:'aprovar-saques',icon:'✅',label:'Aprovar Pagamentos'},
  ];
  document.getElementById('app-body').innerHTML=`
    <div class="alt-page">
      <div class="page-header"><div class="page-title">💵 Financeiro</div></div>
      <div style="display:flex;gap:0;margin-bottom:20px;border-bottom:1px solid var(--border);overflow-x:auto;flex-wrap:nowrap">
        ${abas.map(a=>`<button onclick="renderFinanceiroPage('${a.id}')" style="padding:10px 18px;border:none;background:none;font-family:Inter,sans-serif;font-size:13px;font-weight:600;cursor:pointer;white-space:nowrap;border-bottom:2px solid ${_financeiroAba===a.id?'var(--accent)':'transparent'};color:${_financeiroAba===a.id?'var(--accent)':'var(--text3)'}">${a.icon} ${a.label}</button>`).join('')}
      </div>
      <div id="financeiro-content"><div style="padding:32px;text-align:center;color:var(--text3)">Carregando...</div></div>
    </div>`;
  if(_financeiroAba==='gerar-pagamento')_renderGerarPagamento();
  else if(_financeiroAba==='aprovar-saques')_renderAprovarSaques();
  else if(_financeiroAba==='gerar-cobranca')_renderGerarCobranca();
  else _renderAprovarCobrancas();
}

// ── CREDITO / DEBITO ──
let _scSubAba='lojas',_scEditId=null,_scLojas=[],_scEntregadores=[];
const _scInput=s=>`padding:8px 12px;border:1px solid var(--border);border-radius:8px;font-size:13px;background:var(--surface);color:var(--text);font-family:Inter,sans-serif;width:100%;box-sizing:border-box`;
const _scLabel=t=>`<label style="display:block;font-size:11px;font-weight:600;color:var(--text2);margin-bottom:5px;letter-spacing:.4px">${t}</label>`;

function _renderCredito(){
  const el=document.getElementById('financeiro-content');if(!el)return;
  const hoje=_dataHojeBrasilia();
  const _btnTab=(id,label)=>{const a=_scSubAba===id;return`<button onclick="_scTrocarAba('${id}')" id="sc-btn-${id}" style="padding:10px 20px;border:none;background:none;font-family:Inter,sans-serif;font-size:13px;font-weight:600;cursor:pointer;white-space:nowrap;border-bottom:2px solid ${a?'var(--accent)':'transparent'};color:${a?'var(--accent)':'var(--text3)'}">${label}</button>`;};
  el.innerHTML=`
    <div style="display:flex;gap:0;margin-bottom:20px;border-bottom:1px solid var(--border);overflow-x:auto">
      ${_btnTab('lojas','Credito/Debito Lojas')}${_btnTab('entregadores','Credito/Debito Entregadores')}
    </div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:20px">
      <div class="stat-card"><div class="stat-label">Total Creditos</div><div class="stat-value" id="sc-tot-c" style="font-size:22px;color:#10b981">—</div></div>
      <div class="stat-card"><div class="stat-label">Total Debitos</div><div class="stat-value" id="sc-tot-d" style="font-size:22px;color:#ef4444">—</div></div>
      <div class="stat-card"><div class="stat-label">Saldo Total</div><div class="stat-value" id="sc-tot-s" style="font-size:22px">—</div></div>
    </div>
    <div class="card" style="margin-bottom:16px"><div style="padding:16px 20px">
      <div style="display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap">
        <div style="flex:2;min-width:140px">${_scLabel('NOME')}<input id="sc-f-nome" placeholder="Buscar por nome..." style="${_scInput()}"/></div>
        <div>${_scLabel('DATA INICIO')}<input type="date" id="sc-f-ini" style="${_scInput()}"/></div>
        <div>${_scLabel('DATA FIM')}<input type="date" id="sc-f-fim" style="${_scInput()}"/></div>
        <div>${_scLabel('TIPO')}<select id="sc-f-tipo" style="${_scInput()}"><option value="">Todos</option><option value="credito">Credito</option><option value="debito">Debito</option></select></div>
        <button onclick="_scBuscar()" style="background:var(--accent);color:#fff;border:none;border-radius:8px;padding:9px 20px;font-size:13px;font-weight:700;cursor:pointer;font-family:Inter,sans-serif">Buscar</button>
        <button onclick="_scAbrirModal(null)" style="background:#10b981;color:#fff;border:none;border-radius:8px;padding:9px 20px;font-size:13px;font-weight:700;cursor:pointer;font-family:Inter,sans-serif">Cadastrar</button>
      </div>
    </div></div>
    <div id="sc-tabela"><div style="padding:24px;text-align:center;color:var(--text3)">Buscando...</div></div>

    <div id="modal-sc" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:9000;align-items:center;justify-content:center">
      <div style="background:var(--card);border-radius:16px;padding:28px;width:100%;max-width:440px;margin:16px;box-shadow:0 24px 64px rgba(0,0,0,.4)">
        <div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:20px" id="sc-modal-titulo">Cadastrar</div>
        <div style="margin-bottom:14px" id="sc-modal-entidade-wrap">${_scLabel('ENTIDADE')}<select id="sc-m-ent" style="${_scInput()}"></select></div>
        <div style="margin-bottom:14px">${_scLabel('DATA')}<input type="date" id="sc-m-data" value="${hoje}" style="${_scInput()}"/></div>
        <div style="margin-bottom:14px">${_scLabel('TIPO')}<select id="sc-m-tipo" style="${_scInput()}"><option value="credito">Credito</option><option value="debito">Debito</option></select></div>
        <div style="margin-bottom:14px">${_scLabel('VALOR')}<input type="number" id="sc-m-valor" min="0.01" step="0.01" placeholder="0.00" style="${_scInput()}"/></div>
        <div style="margin-bottom:22px">${_scLabel('OBSERVACOES')}<input type="text" id="sc-m-obs" placeholder="Observações..." style="${_scInput()}"/></div>
        <div style="display:flex;gap:10px">
          <button onclick="document.getElementById('modal-sc').style.display='none'" style="flex:1;padding:10px;border:1px solid var(--border);border-radius:8px;background:none;color:var(--text2);font-size:13px;font-weight:600;cursor:pointer;font-family:Inter,sans-serif">Cancelar</button>
          <button onclick="_scSalvar()" style="flex:2;padding:10px;border:none;border-radius:8px;background:var(--accent);color:#fff;font-size:13px;font-weight:700;cursor:pointer;font-family:Inter,sans-serif">Salvar</button>
        </div>
      </div>
    </div>`;
  _scBuscar();
}

function renderCreditosPage(){
  document.getElementById('app-body').innerHTML=`<div class="alt-page"><div class="page-header"><div class="page-title">💳 Créditos</div></div><div id="financeiro-content"></div></div>`;
  _renderCredito();
}

function _scTrocarAba(aba){
  _scSubAba=aba;
  ['lojas','entregadores'].forEach(id=>{
    const b=document.getElementById(`sc-btn-${id}`);if(!b)return;
    const a=_scSubAba===id;
    b.style.borderBottom=`2px solid ${a?'var(--accent)':'transparent'}`;
    b.style.color=a?'var(--accent)':'var(--text3)';
  });
  document.getElementById('sc-f-nome').value='';
  _scBuscar();
}

async function _scBuscar(){
  const wrap=document.getElementById('sc-tabela');if(!wrap)return;
  wrap.innerHTML='<div style="padding:24px;text-align:center;color:var(--text3)">Buscando...</div>';
  const isLojas=_scSubAba==='lojas';
  const tabela=isLojas?'creditos_lojas':'creditos_entregadores';
  const joinField=isLojas?'lojas':'entregadores';
  const nome=(document.getElementById('sc-f-nome')?.value||'').toLowerCase();
  const ini=document.getElementById('sc-f-ini')?.value;
  const fim=document.getElementById('sc-f-fim')?.value;
  const tipo=document.getElementById('sc-f-tipo')?.value;
  let qs=`?select=*,${joinField}(nome)&order=created_at.desc&limit=500`;
  if(ini)qs+=`&created_at=gte.${_inicioDiaBrasilia(ini)}`;
  if(fim)qs+=`&created_at=lte.${_fimDiaBrasilia(fim)}`;
  if(tipo==='credito')qs+='&tipo=eq.credito';
  else if(tipo==='debito')qs+='&tipo=eq.debito';
  const rows=await db(tabela,'GET',null,qs);
  const data=(Array.isArray(rows)?rows:[])
    .filter(r=>!nome||(r[joinField]?.nome||'').toLowerCase().includes(nome))
    .filter(r=>{const obs=(r.observacoes||'').toLowerCase();return!obs.startsWith('entrega #')&&!obs.startsWith('estorno #');});
  const totC=data.filter(r=>r.tipo==='credito').reduce((s,r)=>s+(parseFloat(r.valor)||0),0);
  const totD=data.filter(r=>r.tipo==='debito').reduce((s,r)=>s+(parseFloat(r.valor)||0),0);
  const saldo=totC-totD;
  const e1=document.getElementById('sc-tot-c'),e2=document.getElementById('sc-tot-d'),e3=document.getElementById('sc-tot-s');
  if(e1)e1.textContent=`R$ ${totC.toFixed(2)}`;
  if(e2)e2.textContent=`R$ ${totD.toFixed(2)}`;
  if(e3){e3.textContent=`R$ ${Math.abs(saldo).toFixed(2)}`;e3.style.color=saldo>=0?'#10b981':'#ef4444';}
  if(!data.length){wrap.innerHTML='<div class="card"><div style="padding:48px;text-align:center;color:var(--text3)">Nenhum registro encontrado</div></div>';return;}
  const tipoBadge=t=>t==='credito'?`<span style="background:#d1fae5;color:#059669;padding:2px 8px;border-radius:20px;font-size:11px;font-weight:700">Crédito</span>`:`<span style="background:#fee2e2;color:#ef4444;padding:2px 8px;border-radius:20px;font-size:11px;font-weight:700">Débito</span>`;
  const colLabel=isLojas?'Loja':'Entregador';
  wrap.innerHTML=`<div class="card"><div style="overflow-x:auto"><table>
    <thead><tr><th>Data</th><th>${colLabel}</th><th>Tipo</th><th>Valor</th><th>Observações</th></tr></thead>
    <tbody>${data.map(r=>`<tr>
      <td style="font-size:12px;color:var(--text3)">${formatarDataHora(r.created_at)}</td>
      <td style="font-weight:600;color:var(--text)">${r[joinField]?.nome||'—'}</td>
      <td>${tipoBadge(r.tipo)}</td>
      <td style="font-weight:700;color:${r.tipo==='credito'?'#10b981':'#ef4444'}">R$ ${(parseFloat(r.valor)||0).toFixed(2)}</td>
      <td style="color:var(--text2);font-size:12px">${r.observacoes||'—'}</td>
    </tr>`).join('')}</tbody>
  </table></div></div>`;
}

async function _scAbrirModal(id){
  const isLojas=_scSubAba==='lojas';
  const entidades=await db(isLojas?'lojas':'entregadores','GET',null,'?select=id,nome&order=nome.asc');
  const sel=document.getElementById('sc-m-ent');
  if(sel){
    sel.innerHTML=(Array.isArray(entidades)?entidades:[]).map(e=>`<option value="${e.id}">${e.nome||e.id?.substring(0,8)}</option>`).join('');
    if(id){const opt=sel.querySelector(`option[value="${id}"]`);if(opt)opt.selected=true;}
  }
  const lblWrap=document.getElementById('sc-modal-entidade-wrap');
  if(lblWrap){const lbl=lblWrap.querySelector('label');if(lbl)lbl.textContent=isLojas?'LOJA':'ENTREGADOR';}
  const titulo=document.getElementById('sc-modal-titulo');
  if(titulo)titulo.textContent=`Cadastrar Crédito / Débito — ${isLojas?'Loja':'Entregador'}`;
  const modal=document.getElementById('modal-sc');
  if(modal)modal.style.display='flex';
}

async function _scSalvar(){
  const isLojas=_scSubAba==='lojas';
  const entId=document.getElementById('sc-m-ent')?.value;
  const data=document.getElementById('sc-m-data')?.value;
  const tipo=document.getElementById('sc-m-tipo')?.value;
  const valor=parseFloat(document.getElementById('sc-m-valor')?.value||0);
  const observacoes=(document.getElementById('sc-m-obs')?.value||'').trim();
  if(!entId||!data||!tipo||!(valor>0)){showNotif('Atenção','Preencha todos os campos obrigatórios','var(--yellow)');return;}
  const agora=new Date().toISOString();
  const tabela=isLojas?'creditos_lojas':'creditos_entregadores';
  const fkField=isLojas?'loja_id':'entregador_id';
  const payload={[fkField]:entId,tipo,valor,observacoes,data,created_at:agora,updated_at:agora};
  const res=await db(tabela,'POST',payload);
  if(res&&(Array.isArray(res)?res.length>0:res.id)){
    showNotif('✅ Registro salvo com sucesso!','');
    document.getElementById('modal-sc').style.display='none';
    _scBuscar();
  } else {
    showNotif('❌ Erro ao salvar',`Verifique as permissões da tabela ${tabela} no Supabase`,'var(--red)');
  }
}

async function _buscarFinanceiro(){
  const e1=document.getElementById('fin-faturamento'),e2=document.getElementById('fin-despesas'),e3=document.getElementById('fin-lucro'),e4=document.getElementById('fin-mercadoria');
  if(e1)e1.textContent='...';if(e2)e2.textContent='...';if(e3)e3.textContent='...';if(e4)e4.textContent='...';
  const [cobrancas,saques,creditos,pedidos]=await Promise.all([
    db('cobrancas_lojas','GET',null,'?select=id,valor_total&status=in.(pago,aprovado)'),
    db('saques','GET',null,'?select=valor_liquido,valor&status=eq.pago'),
    db('creditos_lojas','GET',null,'?select=valor&tipo=eq.credito'),
    db('pedidos','GET',null,'?select=valor&status=eq.finalizado'),
  ]);
  const seen=new Set();
  const fatCobrancas=(Array.isArray(cobrancas)?cobrancas:[]).reduce((s,r)=>{if(seen.has(r.id))return s;seen.add(r.id);return s+(parseFloat(r.valor_total)||0);},0);
  const fatCreditos=(Array.isArray(creditos)?creditos:[]).reduce((s,r)=>s+(parseFloat(r.valor)||0),0);
  const faturamento=fatCobrancas+fatCreditos;
  const despesas=(Array.isArray(saques)?saques:[]).reduce((s,r)=>s+(parseFloat(r.valor_liquido||r.valor)||0),0);
  const lucro=faturamento-despesas;
  const mercadoria=(Array.isArray(pedidos)?pedidos:[]).reduce((s,r)=>s+(parseFloat(r.valor)||0),0);
  if(e1)e1.textContent=`R$ ${faturamento.toFixed(2)}`;
  if(e2)e2.textContent=`R$ ${despesas.toFixed(2)}`;
  if(e3){e3.textContent=`R$ ${Math.abs(lucro).toFixed(2)}`;e3.style.color=lucro>=0?'var(--green)':'var(--red)';}
  if(e4)e4.textContent=`R$ ${mercadoria.toFixed(2)}`;
}

async function _carregarResumoFinanceiro(){
  const hojeBrStr=_dataHojeBrasilia();
  const hojeBrParts=hojeBrStr.split('-').map(Number);
  const hojeBrUtc=new Date(Date.UTC(hojeBrParts[0],hojeBrParts[1]-1,hojeBrParts[2]));
  const dow=hojeBrUtc.getUTCDay();
  const diff=dow===0?6:dow-1;
  hojeBrUtc.setUTCDate(hojeBrUtc.getUTCDate()-diff);
  const startSemanaISO=_inicioDiaBrasilia(hojeBrUtc.toISOString().slice(0,10));

  const _lf=_lojaFiltro();
  const [cobrancasPagas,saquesPagos,saquesPendentes]=await Promise.all([
    db('cobrancas_lojas','GET',null,`?select=valor_total&status=eq.pago&updated_at=gte.${startSemanaISO}${_lf}`),
    db('saques','GET',null,`?select=valor&status=eq.pago&updated_at=gte.${startSemanaISO}`),
    db('saques','GET',null,'?select=valor&status=eq.pendente'),
  ]);

  const somaValor=arr=>(Array.isArray(arr)?arr:[]).reduce((s,r)=>s+(parseFloat(r.valor)||0),0);
  const somaValorTotal=arr=>(Array.isArray(arr)?arr:[]).reduce((s,r)=>s+(parseFloat(r.valor_total)||0),0);

  const faturamento=somaValorTotal(cobrancasPagas);
  const despesas=somaValor(saquesPagos);
  const lucro=faturamento-despesas;

  _saquesPendentesCount=Array.isArray(saquesPendentes)?saquesPendentes.length:0;
  renderNavSidebar(_navAtivo);
  _buscarFinanceiro();
}

// ── GERAR PAGAMENTO ──
let _gpHistoricoOffset=0;
const _gpHistoricoPageSize=20;
function _renderGerarPagamento(){
  const el=document.getElementById('financeiro-content');if(!el)return;
  const hoje=_dataHojeBrasilia();
  el.innerHTML=`
    <div class="card" style="margin-bottom:20px"><div style="padding:20px">
      <div style="display:flex;gap:12px;align-items:flex-end;margin-bottom:20px;flex-wrap:wrap">
        <div><label style="display:block;font-size:12px;font-weight:600;color:var(--text2);margin-bottom:6px">Data início</label>
          <div style="display:flex;gap:6px">
            <input type="date" id="gp-data-inicio" value="${hoje}" style="padding:8px 12px;border:1px solid var(--border);border-radius:8px;font-size:13px;background:var(--surface);color:var(--text);font-family:Inter,sans-serif"/>
            <input type="time" id="gp-hora-inicio" value="00:00" style="padding:8px 10px;border:1px solid var(--border);border-radius:8px;font-size:13px;background:var(--surface);color:var(--text);font-family:Inter,sans-serif;width:90px"/>
          </div></div>
        <div><label style="display:block;font-size:12px;font-weight:600;color:var(--text2);margin-bottom:6px">Data fim</label>
          <div style="display:flex;gap:6px">
            <input type="date" id="gp-data-fim" value="${hoje}" style="padding:8px 12px;border:1px solid var(--border);border-radius:8px;font-size:13px;background:var(--surface);color:var(--text);font-family:Inter,sans-serif"/>
            <input type="time" id="gp-hora-fim" value="23:59" style="padding:8px 10px;border:1px solid var(--border);border-radius:8px;font-size:13px;background:var(--surface);color:var(--text);font-family:Inter,sans-serif;width:90px"/>
          </div></div>
        <button onclick="_calcularPagamentos()" style="background:var(--accent);color:#fff;border:none;border-radius:8px;padding:9px 20px;font-size:13px;font-weight:700;cursor:pointer;font-family:Inter,sans-serif">🔍 Buscar</button>
      </div>
      <div id="gp-lista"></div>
    </div></div>
    <div class="card"><div style="padding:16px 20px 8px">
      <div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:14px">📋 Pagamentos Gerados</div>
      <div id="gp-historico"><div style="padding:24px;text-align:center;color:var(--text3)">Carregando...</div></div>
    </div></div>`;
  _gpHistoricoOffset=0;
  _carregarHistoricoSaques(false);
}

async function _carregarHistoricoSaques(append){
  const el=document.getElementById('gp-historico');if(!el)return;
  const saques=await db('saques','GET',null,`?select=*,entregadores(nome)&order=created_at.desc&limit=${_gpHistoricoPageSize}&offset=${_gpHistoricoOffset}`);
  const rows=Array.isArray(saques)?saques:[];
  if(!append&&!rows.length){el.innerHTML='<div style="padding:32px;text-align:center;color:var(--text3)">Nenhum pagamento gerado ainda</div>';return;}
  const statusBadge=s=>s==='pago'?`<span style="background:#d1fae5;color:#059669;padding:2px 10px;border-radius:20px;font-size:11px;font-weight:700">✅ Pago</span>`:s==='aprovado'?`<span style="background:#dbeafe;color:#1d4ed8;padding:2px 10px;border-radius:20px;font-size:11px;font-weight:700">✅ Aprovado</span>`:s==='recusado'?`<span style="background:#fee2e2;color:#ef4444;padding:2px 10px;border-radius:20px;font-size:11px;font-weight:700">❌ Recusado</span>`:`<span style="background:#fef3c7;color:#d97706;padding:2px 10px;border-radius:20px;font-size:11px;font-weight:700">⏳ Pendente</span>`;
  const html=rows.map(s=>`<tr>
    <td style="font-weight:600;color:var(--text)">${s.entregadores?.nome||'—'}</td>
    <td>${s.qtd_pedidos??'—'}</td>
    <td style="font-weight:700;color:#10b981">R$ ${(parseFloat(s.valor)||0).toFixed(2)}</td>
    <td style="font-size:12px;color:var(--text2)">${s.data_inicio&&s.data_fim?`${formatarDataBR(s.data_inicio)} – ${formatarDataBR(s.data_fim)}`:formatarData(s.created_at)}</td>
    <td>${statusBadge(s.status)}</td>
  </tr>`).join('');
  if(append){
    const tbody=el.querySelector('tbody');
    if(tbody)tbody.insertAdjacentHTML('beforeend',html);
  } else {
    el.innerHTML=`<div style="overflow-x:auto;max-height:400px;overflow-y:auto" id="gp-hist-scroll"><table style="width:100%">
      <thead><tr><th>Entregador</th><th>Pedidos</th><th>Valor</th><th>Período</th><th>Status</th></tr></thead>
      <tbody>${html}</tbody>
    </table></div>
    ${rows.length===_gpHistoricoPageSize?`<div style="text-align:center;padding:12px"><button onclick="_gpCarregarMais()" style="background:none;border:1px solid var(--border);border-radius:8px;padding:7px 20px;font-size:12px;font-weight:600;cursor:pointer;color:var(--text2);font-family:Inter,sans-serif">Carregar mais</button></div>`:''}`;
  }
  _gpHistoricoOffset+=rows.length;
  if(append&&rows.length===_gpHistoricoPageSize){
    const btn=el.querySelector('button[onclick="_gpCarregarMais()"]');
    if(!btn){el.insertAdjacentHTML('beforeend','<div style="text-align:center;padding:12px"><button onclick="_gpCarregarMais()" style="background:none;border:1px solid var(--border);border-radius:8px;padding:7px 20px;font-size:12px;font-weight:600;cursor:pointer;color:var(--text2);font-family:Inter,sans-serif">Carregar mais</button></div>');}
  } else if(append){
    el.querySelector('button[onclick="_gpCarregarMais()"]')?.parentElement?.remove();
  }
}

function _gpCarregarMais(){_carregarHistoricoSaques(true);}

async function _calcularPagamentos(){
  const lista=document.getElementById('gp-lista');
  if(lista)lista.innerHTML='<div style="padding:24px;text-align:center;color:var(--text3)">🔍 Buscando...</div>';
  const dataIni=document.getElementById('gp-data-inicio')?.value;
  const dataFim=document.getElementById('gp-data-fim')?.value;
  if(!dataIni||!dataFim){showNotif('Atenção','Selecione o período','var(--yellow)');return;}
  const horaIni=document.getElementById('gp-hora-inicio')?.value||'00:00';
  const horaFim=document.getElementById('gp-hora-fim')?.value||'23:59';
  const inicioISO=new Date(`${dataIni}T${horaIni}:00-03:00`).toISOString();
  const fimISO=new Date(`${dataFim}T${horaFim}:59-03:00`).toISOString();
  const selectFields='motoboy_id,entregador_id,taxa_motoboy,taxa_entrega_motoboy,taxa_entrega,gorjeta,distancia_km,com_retorno,loja_id,preco_dinamico';
  const [pedidos,entregadores,saquesPeriodo]=await Promise.all([
    db('pedidos','GET',null,`?status=eq.finalizado&finalizado_em=gte.${inicioISO}&finalizado_em=lte.${fimISO}&select=${selectFields}`),
    db('entregadores','GET',null,'?select=*'),
    db('saques','GET',null,`?select=entregador_id,valor_bruto,valor&data_inicio=lte.${dataFim}&data_fim=gt.${dataIni}&status=neq.cancelado`),
  ]);
  // Soma saques gerados DENTRO do período exato (data_inicio >= inicio E data_fim <= fim)
  const saquesPorEid={};
  (Array.isArray(saquesPeriodo)?saquesPeriodo:[]).forEach(s=>{
    if(!s.entregador_id)return;
    saquesPorEid[s.entregador_id]=(saquesPorEid[s.entregador_id]||0)+parseFloat(s.valor_bruto||s.valor||0);
  });
  const arr=Array.isArray(pedidos)?pedidos:[];
  await _preCarregarFaixasLojas(arr);
  _gpResultados={};
  arr.forEach(p=>{
    const eid=p.motoboy_id||p.entregador_id;if(!eid)return;
    if(!_gpResultados[eid]){const ent=(Array.isArray(entregadores)?entregadores:[]).find(e=>e.id===eid)||{id:eid,nome:'Desconhecido'};_gpResultados[eid]={entregador:ent,total:0,qtd:0,jaRetirado:0};}
    const tx=p.taxa_motoboy!=null?parseFloat(p.taxa_motoboy):(_calcTaxaMotoboy(p,_tabelaFaixasPagPorLoja[p.loja_id])??(parseFloat(p.taxa_entrega_motoboy??p.taxa_entrega??0)+parseFloat(p.gorjeta||0)));
    _gpResultados[eid].total+=tx;
    _gpResultados[eid].total=Math.round(_gpResultados[eid].total*100)/100;
    _gpResultados[eid].qtd++;
  });
  // Desconta saques já realizados no período; oculta entregadores totalmente quitados
  Object.keys(_gpResultados).forEach(eid=>{
    const jaRetirado=Math.round((saquesPorEid[eid]||0)*100)/100;
    _gpResultados[eid].jaRetirado=jaRetirado;
    _gpResultados[eid].total=Math.max(0,Math.round((_gpResultados[eid].total-jaRetirado)*100)/100);
  });
  const rows=Object.values(_gpResultados).filter(r=>r.total>0);
  if(!lista)return;
  if(!rows.length){lista.innerHTML=`<div style="padding:48px;text-align:center;color:var(--text3)"><div style="font-size:40px;margin-bottom:12px">📭</div><div>Nenhum entregador com saldo a pagar</div></div>`;return;}
  lista.innerHTML=`
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;flex-wrap:wrap">
      <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:13px;font-weight:600"><input type="checkbox" id="gp-sel-all" onchange="_gpToggleAll(this.checked)" style="width:16px;height:16px;cursor:pointer"/> Selecionar todos</label>
      <button onclick="_gerarPagamento()" style="margin-left:auto;background:#1A56DB;color:#fff;border:none;border-radius:8px;padding:9px 20px;font-size:13px;font-weight:700;cursor:pointer;font-family:Inter,sans-serif">💳 Gerar Pagamento</button>
    </div>
    <div style="overflow-x:auto"><table>
      <thead><tr><th style="width:40px"></th><th>Entregador</th><th>Pedidos</th><th>Já Retirado</th><th>Total a Pagar</th><th>Chave PIX</th><th>Tipo PIX</th></tr></thead>
      <tbody>${rows.map(r=>`<tr>
        <td><input type="checkbox" class="gp-cb" value="${r.entregador.id}" style="width:16px;height:16px;cursor:pointer"/></td>
        <td style="font-weight:600;color:var(--text)">${r.entregador.nome||'—'}</td>
        <td>${r.qtd}</td>
        <td style="color:${r.jaRetirado>0?'#f59e0b':'var(--text3)'};">${r.jaRetirado>0?`R$ ${r.jaRetirado.toFixed(2)}`:'—'}</td>
        <td style="font-weight:700;color:#10b981">R$ ${r.total.toFixed(2)}</td>
        <td style="font-family:monospace;font-size:12px">${r.entregador.chave_pix||'—'}</td>
        <td>${r.entregador.tipo_chave_pix||'—'}</td>
      </tr>`).join('')}</tbody>
    </table></div>`;
}

async function _buscarPagamentos(){
  const pendWrap=document.getElementById('as-pendentes-wrap');
  if(pendWrap)pendWrap.innerHTML='<div style="padding:24px;text-align:center;color:var(--text3)">🔍 Buscando...</div>';
  const saques=await db('saques','GET',null,'?select=*,entregadores(nome,chave_pix,tipo_chave_pix,banco)&status=eq.pendente&order=created_at.asc');
  _saquesPendentesMap={};
  (Array.isArray(saques)?saques:[]).forEach(s=>{_saquesPendentesMap[s.id]={entregador_id:s.entregador_id,valor:s.valor};});
  if(!pendWrap)return;
  if(!saques||!saques.length){
    pendWrap.innerHTML=`<div style="padding:32px;text-align:center;color:var(--text3)"><div style="font-size:40px;margin-bottom:12px">✅</div><div style="font-size:15px;font-weight:600">Nenhum saque pendente</div></div>`;
    _renderHistoricoAprovarSaques();
    return;
  }
  pendWrap.innerHTML=`
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;flex-wrap:wrap">
      <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:13px;font-weight:600"><input type="checkbox" id="as-sel-all" onchange="_asToggleAll(this.checked)" style="width:16px;height:16px;cursor:pointer"/> Selecionar todos</label>
      <button onclick="_aprovarSaquesSelecionados()" style="margin-left:auto;background:#10b981;color:#fff;border:none;border-radius:8px;padding:9px 20px;font-size:13px;font-weight:700;cursor:pointer;font-family:Inter,sans-serif">✅ Aprovar Selecionados</button>
    </div>
    <div style="overflow-x:auto"><table>
      <thead><tr><th style="width:40px"></th><th>Data</th><th>Entregador</th><th>Bruto</th><th>Taxa</th><th>Liquido</th><th>Chave PIX</th><th>Tipo PIX</th><th>Banco</th><th>Ações</th></tr></thead>
      <tbody>${saques.map(s=>{const ent=s.entregadores||{};
        const bruto=parseFloat(s.valor_bruto||s.valor||0);
        const taxa=parseFloat(s.taxa||0);
        const liq=parseFloat(s.valor_liquido||s.valor||0);
        return`<tr id="saque-row-${s.id}">
        <td><input type="checkbox" class="as-cb" value="${s.id}" style="width:16px;height:16px;cursor:pointer"/></td>
        <td style="font-size:12px;color:var(--text3)">${formatarDataHora(s.created_at)}</td>
        <td style="font-weight:600;color:var(--text)">${ent.nome||'—'}</td>
        <td style="font-weight:700;color:var(--text)">R$ ${bruto.toFixed(2)}</td>
        <td style="color:#ef4444;font-size:12px">R$ ${taxa.toFixed(2)}</td>
        <td style="font-weight:700;color:#10b981">R$ ${liq.toFixed(2)}</td>
        <td style="font-family:monospace;font-size:12px">${ent.chave_pix||'—'}</td>
        <td>${ent.tipo_chave_pix||'—'}</td>
        <td>${ent.banco||'—'}</td>
        <td><button onclick="recusarSaque('${s.id}')" style="background:#ef4444;color:#fff;border:none;border-radius:8px;padding:7px 14px;font-size:12px;font-weight:600;cursor:pointer;font-family:Inter,sans-serif">❌ Recusar</button></td>
      </tr>`;}).join('')}</tbody>
    </table></div>`;
  _renderHistoricoAprovarSaques();
}

function _gpToggleAll(checked){document.querySelectorAll('.gp-cb').forEach(cb=>cb.checked=checked);}

async function _gerarPagamento(){
  const selecionados=[...document.querySelectorAll('.gp-cb:checked')].map(cb=>cb.value);
  if(!selecionados.length){showNotif('Atenção','Selecione ao menos um entregador','var(--yellow)');return;}
  const inicio=document.getElementById('gp-data-inicio')?.value||null;
  const fim=document.getElementById('gp-data-fim')?.value||null;
  const agora=new Date().toISOString();let ok=0;
  for(const eid of selecionados){
    const r=_gpResultados[eid];if(!r)continue;
    const valor=Math.round(r.total*100)/100;
    console.log(`[gerarPagamento] entregador_id=${eid} periodo_inicio=${inicio} periodo_fim=${fim} total_calculado=${valor} qtd_pedidos=${r.qtd}`);
    const res=await db('saques','POST',{entregador_id:eid,valor,status:'pendente',qtd_pedidos:r.qtd,data_inicio:inicio,data_fim:fim,created_at:agora,updated_at:agora});
    if(res&&(Array.isArray(res)?res.length>0:res.id))ok++;
  }
  if(ok>0){
    showNotif(`✅ ${ok} pagamento(s) gerado(s)!`,'');
    _saquesPendentesCount+=ok;renderNavSidebar(_navAtivo);
    _carregarResumoFinanceiro();
    _gpHistoricoOffset=0;
    _carregarHistoricoSaques(false);
    document.getElementById('gp-lista').innerHTML='';
  } else {
    showNotif('❌ Erro ao gerar pagamento','Verifique as permissões da tabela saques no Supabase','var(--red)');
  }
}

// ── APROVAR SAQUES ──
let _saquesPendentesMap={};
function _renderAprovarSaques(){
  const el=document.getElementById('financeiro-content');if(!el)return;
  el.innerHTML=`
    <div class="card" style="margin-bottom:20px"><div style="padding:20px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:20px;flex-wrap:wrap">
        <div style="font-size:14px;font-weight:700;color:var(--text)">Saques pendentes de aprovação</div>
        <button onclick="_buscarPagamentos()" style="margin-left:auto;background:var(--accent);color:#fff;border:none;border-radius:8px;padding:9px 20px;font-size:13px;font-weight:700;cursor:pointer;font-family:Inter,sans-serif">🔄 Atualizar</button>
      </div>
      <div id="as-pendentes-wrap"><div style="padding:24px;text-align:center;color:var(--text3)">🔍 Buscando...</div></div>
    </div></div>
    <div id="as-historico-wrap"></div>`;
  _buscarPagamentos();
}

async function _renderHistoricoAprovarSaques(inicio,fim){
  const wrap=document.getElementById('as-historico-wrap');
  if(!wrap)return;
  // Histórico sempre mostra os últimos 50 registros sem filtro de data
  // para não sumir quando os saques aprovados são de outros períodos
  const hist=await db('saques','GET',null,'?select=*,entregadores(nome)&status=in.(pago,recusado)&order=updated_at.desc&limit=50');
  if(!hist||!hist.length){wrap.innerHTML='';return;}
  const badge=s=>s.status==='pago'?`<span style="background:#d1fae5;color:#059669;padding:2px 10px;border-radius:20px;font-size:11px;font-weight:700">✅ Pago</span>`:`<span style="background:#fee2e2;color:#ef4444;padding:2px 10px;border-radius:20px;font-size:11px;font-weight:700">❌ Recusado</span>`;
  wrap.innerHTML=`<div class="card"><div style="padding:14px 20px 8px">
    <div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:12px">📜 Histórico de Saques</div>
    <div style="overflow-x:auto;max-height:360px;overflow-y:auto"><table style="width:100%">
      <thead><tr><th>Data</th><th>Entregador</th><th>Bruto</th><th>Taxa</th><th>Liquido</th><th>Aprovado em</th><th>Status</th></tr></thead>
      <tbody>${hist.map(s=>`<tr>
        <td style="font-size:12px;color:var(--text3)">${formatarDataHora(s.created_at)}</td>
        <td style="font-weight:600;color:var(--text)">${s.entregadores?.nome||'—'}</td>
        <td>R$ ${(parseFloat(s.valor_bruto||s.valor)||0).toFixed(2)}</td>
        <td style="color:#ef4444;font-size:12px">R$ ${(parseFloat(s.taxa)||0).toFixed(2)}</td>
        <td style="font-weight:700;color:#10b981">R$ ${(parseFloat(s.valor_liquido||s.valor)||0).toFixed(2)}</td>
        <td style="font-size:11px;color:var(--text3)">${s.aprovado_em?formatarDataHora(s.aprovado_em):'—'}</td>
        <td>${badge(s)}</td>
      </tr>`).join('')}</tbody>
    </table></div>
  </div></div>`;
}

function _asToggleAll(checked){document.querySelectorAll('.as-cb').forEach(cb=>cb.checked=checked);}

async function _atualizarSaldoEntregador(entregador_id,valor){
  const ent=await db('entregadores','GET',null,`?id=eq.${entregador_id}&select=*`);
  if(!ent||!ent[0]){console.warn('[SALDO] entregador não encontrado:',entregador_id);return;}
  const saldoAtual=parseFloat(ent[0].saldo)||0;
  const valorPago=parseFloat(valor)||0;
  const novoSaldo=Math.max(0,saldoAtual-valorPago);
  console.log(`[SALDO] entregador=${entregador_id} | saldo_antes=R$${saldoAtual.toFixed(2)} | pago=R$${valorPago.toFixed(2)} | saldo_depois=R$${novoSaldo.toFixed(2)}`);
  await dbPatch('entregadores',{saldo:Math.round(novoSaldo*100)/100,updated_at:new Date().toISOString()},`?id=eq.${entregador_id}`);
  console.log(`[SALDO] atualização concluída para entregador=${entregador_id}`);
}

async function _aprovarSaquesSelecionados(){
  const ids=[...document.querySelectorAll('.as-cb:checked')].map(cb=>cb.value);
  if(!ids.length){showNotif('Atenção','Selecione ao menos um saque','var(--yellow)');return;}
  const agora=new Date().toISOString();let ok=0;
  for(const id of ids){
    const res=await dbPatch('saques',{status:'pago',aprovado_em:agora,updated_at:agora},`?id=eq.${id}`);
    if(res!==null){
      document.getElementById(`saque-row-${id}`)?.remove();
      ok++;
      const s=_saquesPendentesMap[id];
      if(s)await _atualizarSaldoEntregador(s.entregador_id,s.valor);
    }
  }
  _saquesPendentesCount=Math.max(0,_saquesPendentesCount-ok);
  renderNavSidebar(_navAtivo);
  showNotif(`✅ ${ok} saque(s) aprovado(s)!`,'');
  _carregarResumoFinanceiro();
  _buscarPagamentos();
}

async function recusarSaque(id){
  const agora=new Date().toISOString();
  const s=_saquesPendentesMap[id];
  const res=await dbPatch('saques',{status:'recusado',updated_at:agora},`?id=eq.${id}`);
  if(!res){showNotif('Erro','Não foi possível recusar o saque','var(--red)');return;}
  document.getElementById(`saque-row-${id}`)?.remove();
  _saquesPendentesCount=Math.max(0,_saquesPendentesCount-1);
  renderNavSidebar(_navAtivo);
  console.log(`[SALDO] saque ${id} recusado — saldo do entregador ${s?.entregador_id} mantido`);
  showNotif('❌ Saque recusado','Saque foi recusado','var(--red)');
  _carregarResumoFinanceiro();
  _buscarPagamentos();
}

// ── GERAR COBRANÇA ──
let _gcHistoricoOffset=0;
const _gcHistoricoPageSize=20;
function _renderGerarCobranca(){
  const el=document.getElementById('financeiro-content');if(!el)return;
  const hoje=_dataHojeBrasilia();
  el.innerHTML=`
    <div class="card" style="margin-bottom:20px"><div style="padding:20px">
      <div style="display:flex;gap:12px;align-items:flex-end;margin-bottom:20px;flex-wrap:wrap">
        <div><label style="display:block;font-size:12px;font-weight:600;color:var(--text2);margin-bottom:6px">Data início</label>
          <div style="display:flex;gap:6px">
            <input type="date" id="gc-data-inicio" value="${hoje}" style="padding:8px 12px;border:1px solid var(--border);border-radius:8px;font-size:13px;background:var(--surface);color:var(--text);font-family:Inter,sans-serif"/>
            <input type="time" id="gc-hora-inicio" value="00:00" style="padding:8px 10px;border:1px solid var(--border);border-radius:8px;font-size:13px;background:var(--surface);color:var(--text);font-family:Inter,sans-serif;width:90px"/>
          </div></div>
        <div><label style="display:block;font-size:12px;font-weight:600;color:var(--text2);margin-bottom:6px">Data fim</label>
          <div style="display:flex;gap:6px">
            <input type="date" id="gc-data-fim" value="${hoje}" style="padding:8px 12px;border:1px solid var(--border);border-radius:8px;font-size:13px;background:var(--surface);color:var(--text);font-family:Inter,sans-serif"/>
            <input type="time" id="gc-hora-fim" value="23:59" style="padding:8px 10px;border:1px solid var(--border);border-radius:8px;font-size:13px;background:var(--surface);color:var(--text);font-family:Inter,sans-serif;width:90px"/>
          </div></div>
        <button onclick="_buscarCobrancas()" style="background:var(--accent);color:#fff;border:none;border-radius:8px;padding:9px 20px;font-size:13px;font-weight:700;cursor:pointer;font-family:Inter,sans-serif">🔍 Buscar</button>
      </div>
      <div id="gc-lista"></div>
    </div></div>
    <div class="card"><div style="padding:16px 20px 8px">
      <div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:14px">🏪 Cobranças Geradas</div>
      <div id="gc-historico"><div style="padding:24px;text-align:center;color:var(--text3)">Carregando...</div></div>
    </div></div>`;
  _gcHistoricoOffset=0;
  _carregarHistoricoCobrancas(false);
}

async function _carregarHistoricoCobrancas(append){
  const el=document.getElementById('gc-historico');if(!el)return;
  const rows=await db('cobrancas_lojas','GET',null,`?select=*,lojas(nome)&status=in.(pago,pendente,aprovado)&order=created_at.desc&limit=${_gcHistoricoPageSize}&offset=${_gcHistoricoOffset}`);
  const data=Array.isArray(rows)?rows:[];
  if(!append&&!data.length){el.innerHTML='<div style="padding:32px;text-align:center;color:var(--text3)">Nenhuma cobrança gerada ainda</div>';return;}
  const _gcBadge=s=>s==='pago'?`<span style="background:#d1fae5;color:#059669;padding:2px 10px;border-radius:20px;font-size:11px;font-weight:700">✅ Pago</span>`:s==='aprovado'?`<span style="background:#dbeafe;color:#1d4ed8;padding:2px 10px;border-radius:20px;font-size:11px;font-weight:700">✅ Aprovado</span>`:s==='recusado'?`<span style="background:#fee2e2;color:#ef4444;padding:2px 10px;border-radius:20px;font-size:11px;font-weight:700">❌ Recusado</span>`:`<span style="background:#fef3c7;color:#d97706;padding:2px 10px;border-radius:20px;font-size:11px;font-weight:700">⏳ Pendente</span>`;
  const html=data.map(c=>`<tr>
    <td style="font-weight:600;color:var(--text)">${c.lojas?.nome||'—'}</td>
    <td style="font-size:12px;color:var(--text2)">${formatarDataBR(c.data_inicio)} – ${formatarDataBR(c.data_fim)}</td>
    <td>${c.qtd_pedidos??'—'}</td>
    <td style="font-weight:700;color:#1A56DB">R$ ${(parseFloat(c.valor_total)||0).toFixed(2)}</td>
    <td style="font-size:12px;color:var(--text3)">${formatarData(c.created_at)}</td>
    <td>${_gcBadge(c.status)}</td>
  </tr>`).join('');
  if(append){
    const tbody=el.querySelector('tbody');
    if(tbody)tbody.insertAdjacentHTML('beforeend',html);
  }else{
    el.innerHTML=`<div style="overflow-x:auto;max-height:400px;overflow-y:auto"><table style="width:100%">
      <thead><tr><th>Loja</th><th>Período</th><th>Pedidos</th><th>Valor Total</th><th>Gerado em</th><th>Status</th></tr></thead>
      <tbody>${html}</tbody>
    </table></div>
    ${data.length===_gcHistoricoPageSize?`<div style="text-align:center;padding:12px"><button onclick="_gcCarregarMais()" style="background:none;border:1px solid var(--border);border-radius:8px;padding:7px 20px;font-size:12px;font-weight:600;cursor:pointer;color:var(--text2);font-family:Inter,sans-serif">Carregar mais</button></div>`:''}`;
  }
  _gcHistoricoOffset+=data.length;
  if(append){
    if(data.length===_gcHistoricoPageSize&&!el.querySelector('button[onclick="_gcCarregarMais()"]'))
      el.insertAdjacentHTML('beforeend','<div style="text-align:center;padding:12px"><button onclick="_gcCarregarMais()" style="background:none;border:1px solid var(--border);border-radius:8px;padding:7px 20px;font-size:12px;font-weight:600;cursor:pointer;color:var(--text2);font-family:Inter,sans-serif">Carregar mais</button></div>');
    else if(data.length<_gcHistoricoPageSize)
      el.querySelector('button[onclick="_gcCarregarMais()"]')?.parentElement?.remove();
  }
}

function _gcCarregarMais(){_carregarHistoricoCobrancas(true);}

async function _buscarCobrancas(){
  const inicio=document.getElementById('gc-data-inicio')?.value;
  const fim=document.getElementById('gc-data-fim')?.value;
  if(!inicio||!fim){showNotif('Atenção','Selecione o período','var(--yellow)');return;}
  const hIni=document.getElementById('gc-hora-inicio')?.value||'00:00';
  const hFim=document.getElementById('gc-hora-fim')?.value||'23:59';
  const inicioISO=new Date(`${inicio}T${hIni}:00-03:00`).toISOString();
  const fimISO=new Date(`${fim}T${hFim}:59-03:00`).toISOString();
  const lista=document.getElementById('gc-lista');
  if(lista)lista.innerHTML='<div style="padding:24px;text-align:center;color:var(--text3)">🔍 Buscando...</div>';
  const [pedidos,lojas,jaGeradas]=await Promise.all([
    db('pedidos','GET',null,`?status=eq.finalizado&finalizado_em=gte.${inicioISO}&finalizado_em=lte.${fimISO}&select=loja_id,taxa_entrega,gorjeta`),
    db('lojas','GET',null,'?select=id,nome'),
    db('cobrancas_lojas','GET',null,`?select=loja_id&data_inicio=eq.${inicio}&data_fim=eq.${fim}&status=in.(pendente,pago,aprovado)`),
  ]);
  const jaGeradasSet=new Set((Array.isArray(jaGeradas)?jaGeradas:[]).map(r=>r.loja_id));
  _gcResultados={};
  (Array.isArray(pedidos)?pedidos:[]).forEach(p=>{
    const lid=p.loja_id;if(!lid||jaGeradasSet.has(lid))return;
    if(!_gcResultados[lid]){const loja=(Array.isArray(lojas)?lojas:[]).find(l=>l.id===lid)||{id:lid,nome:'Desconhecida'};_gcResultados[lid]={loja,total:0,qtd:0};}
    _gcResultados[lid].total+=(parseFloat(p.taxa_entrega)||0)+(parseFloat(p.gorjeta)||0);
    _gcResultados[lid].qtd++;
  });
  const rows=Object.values(_gcResultados);
  if(!lista)return;
  if(!rows.length){lista.innerHTML=`<div style="padding:48px;text-align:center;color:var(--text3)"><div style="font-size:40px;margin-bottom:12px">📭</div><div>Nenhuma loja com pedidos finalizados no período</div></div>`;return;}
  lista.innerHTML=`
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;flex-wrap:wrap">
      <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:13px;font-weight:600"><input type="checkbox" id="gc-sel-all" onchange="_gcToggleAll(this.checked)" style="width:16px;height:16px;cursor:pointer"/> Selecionar todas</label>
      <button onclick="_gerarCobranca()" style="margin-left:auto;background:#1A56DB;color:#fff;border:none;border-radius:8px;padding:9px 20px;font-size:13px;font-weight:700;cursor:pointer;font-family:Inter,sans-serif">🏪 Gerar Cobrança</button>
    </div>
    <div style="overflow-x:auto"><table>
      <thead><tr><th style="width:40px"></th><th>Loja</th><th>Pedidos</th><th>Total a Cobrar</th></tr></thead>
      <tbody>${rows.map(r=>`<tr>
        <td><input type="checkbox" class="gc-cb" value="${r.loja.id}" style="width:16px;height:16px;cursor:pointer"/></td>
        <td style="font-weight:600;color:var(--text)">${r.loja.nome||'—'}</td>
        <td>${r.qtd}</td>
        <td style="font-weight:700;color:#1A56DB">R$ ${r.total.toFixed(2)}</td>
      </tr>`).join('')}</tbody>
    </table></div>`;
}

function _gcToggleAll(checked){document.querySelectorAll('.gc-cb').forEach(cb=>cb.checked=checked);}

async function _gerarCobranca(){
  const inicio=document.getElementById('gc-data-inicio')?.value;
  const fim=document.getElementById('gc-data-fim')?.value;
  const selecionadas=[...document.querySelectorAll('.gc-cb:checked')].map(cb=>cb.value);
  if(!selecionadas.length){showNotif('Atenção','Selecione ao menos uma loja','var(--yellow)');return;}
  const agora=new Date().toISOString();let ok=0;
  for(const lid of selecionadas){
    const r=_gcResultados[lid];if(!r)continue;
    const valor=Math.round(r.total*100)/100;
    const res=await db('cobrancas_lojas','POST',{loja_id:lid,valor_total:valor,status:'pendente',data_inicio:inicio,data_fim:fim,qtd_pedidos:r.qtd,created_at:agora,updated_at:agora});
    if(res&&(Array.isArray(res)?res.length>0:res.id))ok++;
  }
  showNotif(`✅ ${ok} cobrança(s) gerada(s)!`,'');
  _gcHistoricoOffset=0;
  _carregarHistoricoCobrancas(false);
  document.getElementById('gc-lista').innerHTML='';
}

// ── APROVAR COBRANÇAS ──
function _renderAprovarCobrancas(){
  const el=document.getElementById('financeiro-content');if(!el)return;
  const hoje=_dataHojeBrasilia();
  el.innerHTML=`
    <div class="card" style="margin-bottom:20px"><div style="padding:20px">
      <div style="display:flex;gap:12px;align-items:flex-end;margin-bottom:20px;flex-wrap:wrap">
        <div><label style="display:block;font-size:12px;font-weight:600;color:var(--text2);margin-bottom:6px">Data início</label>
          <input type="date" id="ac-data-inicio" value="${hoje}" style="padding:8px 12px;border:1px solid var(--border);border-radius:8px;font-size:13px;background:var(--surface);color:var(--text);font-family:Inter,sans-serif"/></div>
        <div><label style="display:block;font-size:12px;font-weight:600;color:var(--text2);margin-bottom:6px">Data fim</label>
          <input type="date" id="ac-data-fim" value="${hoje}" style="padding:8px 12px;border:1px solid var(--border);border-radius:8px;font-size:13px;background:var(--surface);color:var(--text);font-family:Inter,sans-serif"/></div>
        <button onclick="_buscarAprovarCobrancas()" style="background:var(--accent);color:#fff;border:none;border-radius:8px;padding:9px 20px;font-size:13px;font-weight:700;cursor:pointer;font-family:Inter,sans-serif">🔍 Buscar</button>
      </div>
      <div id="ac-pendentes-wrap"><div style="padding:24px;text-align:center;color:var(--text3)">🔍 Buscando...</div></div>
    </div></div>
    <div id="ac-historico-wrap"><div style="padding:24px;text-align:center;color:var(--text3)">Carregando histórico...</div></div>`;
  _buscarCobrancasPendentes();
  _renderHistoricoCobrancas();
}

function _buscarAprovarCobrancas(){
  const inicio=document.getElementById('ac-data-inicio')?.value;
  const fim=document.getElementById('ac-data-fim')?.value;
  _buscarCobrancasPendentes();
  _renderHistoricoCobrancas(inicio,fim);
}

async function _buscarCobrancasPendentes(){
  const inicio=document.getElementById('ac-data-inicio')?.value;
  const fim=document.getElementById('ac-data-fim')?.value;
  if(!inicio||!fim){showNotif('Atenção','Selecione o período','var(--yellow)');return;}
  const pendWrap=document.getElementById('ac-pendentes-wrap');
  if(pendWrap)pendWrap.innerHTML='<div style="padding:24px;text-align:center;color:var(--text3)">🔍 Buscando...</div>';
  const cobrancas=await db('cobrancas_lojas','GET',null,`?select=*,lojas(nome)&status=eq.pendente&created_at=gte.${_inicioDiaBrasilia(inicio)}&created_at=lte.${_fimDiaBrasilia(fim)}&order=created_at.desc`);
  if(!pendWrap)return;
  if(!cobrancas||!cobrancas.length){
    pendWrap.innerHTML=`<div style="padding:32px;text-align:center;color:var(--text3)"><div style="font-size:40px;margin-bottom:12px">✅</div><div style="font-size:15px;font-weight:600">Nenhuma cobrança pendente no período</div></div>`;
    return;
  }
  pendWrap.innerHTML=`
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;flex-wrap:wrap">
      <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:13px;font-weight:600"><input type="checkbox" id="ac-sel-all" onchange="_acToggleAll(this.checked)" style="width:16px;height:16px;cursor:pointer"/> Selecionar todas</label>
      <button onclick="_aprovarCobrancasSelecionadas()" style="margin-left:auto;background:#10b981;color:#fff;border:none;border-radius:8px;padding:9px 20px;font-size:13px;font-weight:700;cursor:pointer;font-family:Inter,sans-serif">📲 Aprovar e Enviar Fatura</button>
    </div>
    <div style="overflow-x:auto"><table>
      <thead><tr><th style="width:40px"></th><th>Loja</th><th>Período</th><th>Pedidos</th><th>Valor Total</th><th>Gerado em</th><th>Ações</th></tr></thead>
      <tbody>${cobrancas.map(c=>{const loja=c.lojas||{};return`<tr id="cob-row-${c.id}">
        <td><input type="checkbox" class="ac-cb" value="${c.id}" style="width:16px;height:16px;cursor:pointer"/></td>
        <td style="font-weight:600;color:var(--text)">${loja.nome||'—'}</td>
        <td style="font-size:12px;color:var(--text2)">${formatarDataBR(c.data_inicio)} – ${formatarDataBR(c.data_fim)}</td>
        <td>${c.qtd_pedidos||'—'}</td>
        <td style="font-weight:700;color:#1A56DB">R$ ${(parseFloat(c.valor_total)||0).toFixed(2)}</td>
        <td style="font-size:12px;color:var(--text3)">${formatarDataHora(c.created_at)}</td>
        <td style="display:flex;gap:6px"><button onclick="verFaturaCobranca('${c.id}')" style="background:#6366f1;color:#fff;border:none;border-radius:8px;padding:7px 14px;font-size:12px;font-weight:600;cursor:pointer;font-family:Inter,sans-serif">📄 Ver Fatura</button><button onclick="recusarCobranca('${c.id}')" style="background:#ef4444;color:#fff;border:none;border-radius:8px;padding:7px 14px;font-size:12px;font-weight:600;cursor:pointer;font-family:Inter,sans-serif">❌ Recusar</button></td>
      </tr>`;}).join('')}</tbody>
    </table></div>`;
}

async function _renderHistoricoCobrancas(inicio,fim){
  const wrap=document.getElementById('ac-historico-wrap');
  if(!wrap)return;
  const qs=(inicio&&fim)
    ?`?select=*,lojas(nome)&status=in.(pago,recusado)&created_at=gte.${_inicioDiaBrasilia(inicio)}&created_at=lte.${_fimDiaBrasilia(fim)}&order=updated_at.desc&limit=50`
    :`?select=*,lojas(nome)&status=in.(pago,recusado)&order=updated_at.desc&limit=30`;
  const hist=await db('cobrancas_lojas','GET',null,qs);
  if(!hist||!hist.length){wrap.innerHTML='<div style="padding:16px;text-align:center;color:var(--text3);font-size:13px">Nenhum histórico encontrado</div>';return;}
  const badge=c=>c.status==='pago'?`<span style="background:#d1fae5;color:#059669;padding:2px 10px;border-radius:20px;font-size:11px;font-weight:700">✅ Pago</span>`:`<span style="background:#fee2e2;color:#ef4444;padding:2px 10px;border-radius:20px;font-size:11px;font-weight:700">❌ Recusado</span>`;
  wrap.innerHTML=`<div class="card"><div style="padding:14px 20px 8px">
    <div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:12px">📜 Histórico de Cobranças</div>
    <div style="overflow-x:auto;max-height:360px;overflow-y:auto"><table style="width:100%">
      <thead><tr><th>Data</th><th>Loja</th><th>Período</th><th>Valor</th><th>Status</th></tr></thead>
      <tbody>${hist.map(c=>`<tr>
        <td style="font-size:12px;color:var(--text3)">${formatarDataHora(c.updated_at||c.created_at)}</td>
        <td style="font-weight:600;color:var(--text)">${c.lojas?.nome||'—'}</td>
        <td style="font-size:12px;color:var(--text2)">${formatarDataBR(c.data_inicio)} – ${formatarDataBR(c.data_fim)}</td>
        <td style="font-weight:700;color:#1A56DB">R$ ${(parseFloat(c.valor_total)||0).toFixed(2)}</td>
        <td>${badge(c)}</td>
      </tr>`).join('')}</tbody>
    </table></div>
  </div></div>`;
}

function _acToggleAll(checked){document.querySelectorAll('.ac-cb').forEach(cb=>cb.checked=checked);}

async function _aprovarCobrancasSelecionadas(){
  const ids=[...document.querySelectorAll('.ac-cb:checked')].map(cb=>cb.value);
  if(!ids.length){showNotif('Atenção','Selecione ao menos uma cobrança','var(--yellow)');return;}
  const cobRes=await db('cobrancas_lojas','GET',null,`?id=in.(${ids.join(',')})&select=id,loja_id,lojas(nome,celular)`);
  const cobMap={};
  (Array.isArray(cobRes)?cobRes:[]).forEach(c=>{cobMap[c.id]=c;});
  const agora=new Date().toISOString();let ok=0;
  for(const id of ids){
    const res=await dbPatch('cobrancas_lojas',{status:'pago',updated_at:agora},`?id=eq.${id}`);
    if(res!==null){document.getElementById(`cob-row-${id}`)?.remove();ok++;}
  }
  showNotif(`✅ ${ok} cobrança(s) aprovada(s)!`,'');
  const cfg=await _getEvolutionConfig();
  if(cfg.url&&cfg.instance&&cfg.token){
    let wok=0,werr=0;
    for(const id of ids){
      const c=cobMap[id];
      const phone=c?.lojas?.celular;
      if(!phone)continue;
      const msg=cfg.msgFinanceiro.replace(/{loja}/g,c.lojas?.nome||'');
      const sent=await _evolutionSendText(phone,msg);
      if(sent)wok++;else werr++;
      await new Promise(r=>setTimeout(r,1500));
    }
    if(wok>0||werr>0)showNotif(`📲 Fatura enviada!`,`${wok} loja(s)${werr?' · '+werr+' erro(s)':''}`,wok>0?'#22c55e':'var(--red)');
  }
  _buscarCobrancasPendentes();
}

async function recusarCobranca(id){
  const res=await dbPatch('cobrancas_lojas',{status:'recusado',updated_at:new Date().toISOString()},`?id=eq.${id}`);
  if(!res){showNotif('Erro','Não foi possível recusar a cobrança','var(--red)');return;}
  document.getElementById(`cob-row-${id}`)?.remove();
  showNotif('❌ Cobrança recusada','','var(--red)');
  _buscarCobrancasPendentes();
}

async function verFaturaCobranca(cobId){
  let modal=document.getElementById('modal-fatura-cobranca');
  if(!modal){modal=document.createElement('div');modal.id='modal-fatura-cobranca';document.body.appendChild(modal);}
  modal.style.cssText='display:flex;position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9999;align-items:center;justify-content:center;overflow-y:auto;padding:20px';
  modal.innerHTML='<div style="background:#fff;border-radius:16px;padding:40px;text-align:center;color:#6b7280;min-width:260px"><div style="font-size:36px;margin-bottom:12px">⏳</div><div style="font-size:14px;font-weight:600">Carregando fatura...</div></div>';
  modal.onclick=e=>{if(e.target===modal)modal.style.display='none';};
  const cobRes=await db('cobrancas_lojas','GET',null,`?id=eq.${cobId}&select=*,lojas(nome,email,endereco,telefone)&limit=1`);
  const c=Array.isArray(cobRes)?cobRes[0]:null;
  if(!c){modal.innerHTML='<div style="background:#fff;border-radius:16px;padding:32px;text-align:center;color:#ef4444">Cobrança não encontrada</div>';return;}
  const loja=c.lojas||{};
  const lojaNome=loja.nome||'—';
  const lojaEndereco=loja.endereco||'';
  const lojaEmail=loja.email||'';
  const dataInicio=formatarDataBR(c.data_inicio);
  const dataFim=formatarDataBR(c.data_fim);
  const valorTotal=parseFloat(c.valor_total)||0;
  const iniISO=c.data_inicio?_inicioDiaBrasilia(c.data_inicio):'';
  const fimISO=c.data_fim?_fimDiaBrasilia(c.data_fim):'';
  const numFatura=String(c.numero_fatura||'').padStart(7,'0');
  const hoje=new Date();
  const dataEmissao=formatarDataBR(hoje);
  const dtVenc=new Date(hoje);dtVenc.setDate(dtVenc.getDate()+2);
  const vencimento=formatarDataBR(dtVenc);
  let pedidosData=[];
  if(c.loja_id&&iniISO&&fimISO){
    const res=await db('pedidos','GET',null,`?loja_id=eq.${c.loja_id}&status=eq.finalizado&select=numero,finalizado_em,updated_at,endereco_entrega,endereco,taxa_entrega,gorjeta,distancia_km,com_retorno,retorno,preco_dinamico&or=(and(finalizado_em.gte.${iniISO},finalizado_em.lte.${fimISO}),and(finalizado_em.is.null,updated_at.gte.${iniISO},updated_at.lte.${fimISO}))&order=finalizado_em.asc&limit=500`);
    pedidosData=Array.isArray(res)?res:[];
  }
  const faixasLoja=await _getFaixasCobranca(c.loja_id);
  const totalEntregas=pedidosData.length>0
    ?Math.round(pedidosData.reduce((acc,p)=>acc+(_calcTaxaLoja(p,faixasLoja)-(parseFloat(p.gorjeta)||0)),0)*100)/100
    :(parseFloat(c.valor_total)||0);
  const qtdPedidos=pedidosData.length||c.qtd_pedidos||0;
  const totalGorjetas=Math.round(pedidosData.reduce((acc,p)=>acc+(parseFloat(p.gorjeta)||0),0)*100)/100;
  const tdN='padding:14px 12px;font-size:13px;color:#9ca3af';
  const tdS='padding:14px 12px;font-size:14px;font-weight:600;color:#111';
  const tdQ='padding:14px 12px;text-align:center;font-size:14px;color:#374151';
  const tdV='padding:14px 12px;text-align:right;font-size:14px;font-weight:700';
  const invoice=`<div id="fatura-doc" style="background:#ffffff;color:#111111;color-scheme:light;width:100%;max-width:760px;border-radius:14px;overflow:hidden;font-family:Inter,Arial,sans-serif;border:1px solid #e5e7eb">
    <div style="background:#fff;padding:22px 32px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;border-bottom:2px solid #1A56DB">
      <img src="https://raw.githubusercontent.com/letsgodeliverybr/painel/main/logo.jpeg" height="120" style="width:auto;max-width:300px;object-fit:contain;display:block;border-radius:8px;background:#fff;padding:4px"/>
      <div style="text-align:right"><div style="color:#111;font-size:20px;font-weight:800;letter-spacing:-.3px">FATURA</div><div style="color:#1A56DB;font-size:13px;font-weight:700;margin-top:3px;letter-spacing:.5px">Nº ${numFatura}</div></div>
    </div>
    <div style="background:#fff;padding:11px 32px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;border-bottom:1px solid #e5e7eb">
      <div style="font-size:12px;color:#374151"><span style="color:#6b7280;font-weight:600">Emitida em:</span> ${dataEmissao}</div>
      <div style="font-size:12px;color:#374151"><span style="color:#6b7280;font-weight:600">Vencimento:</span> <span style="color:#dc2626;font-weight:700">${vencimento}</span></div>
      <div style="font-size:12px;color:#374151"><span style="color:#6b7280;font-weight:600">Período:</span> ${dataInicio} – ${dataFim}</div>
    </div>
    <div style="padding:24px 32px;border-bottom:1px solid #e5e7eb;display:flex;justify-content:space-between;align-items:flex-start;gap:24px;flex-wrap:wrap">
      <div>
        <div style="font-size:10px;font-weight:700;color:#9ca3af;letter-spacing:1px;text-transform:uppercase;margin-bottom:10px">Cliente</div>
        <div style="font-size:18px;font-weight:800;color:#111;margin-bottom:5px">${lojaNome}</div>
        ${lojaEndereco?`<div style="font-size:13px;color:#6b7280;margin-bottom:3px">📍 ${lojaEndereco}</div>`:''}
        ${lojaEmail?`<div style="font-size:13px;color:#6b7280">✉️ ${lojaEmail}</div>`:''}
      </div>
      <div style="text-align:right;min-width:140px">
        <div style="font-size:10px;font-weight:700;color:#9ca3af;letter-spacing:1px;text-transform:uppercase;margin-bottom:10px">Total a pagar</div>
        <div style="font-size:30px;font-weight:800;color:#1A56DB;line-height:1">R$ ${(totalEntregas+totalGorjetas).toFixed(2)}</div>
      </div>
    </div>
    <div style="padding:20px 32px;background:#fff;border-bottom:1px solid #e5e7eb">
      <div style="font-size:10px;font-weight:700;color:#9ca3af;letter-spacing:1px;text-transform:uppercase;margin-bottom:12px">Instruções de pagamento</div>
      <div style="background:#f0f9ff;border:1.5px solid #bae6fd;border-radius:8px;padding:14px 18px;display:inline-flex;align-items:center;gap:10px">
        <span style="font-size:18px">💠</span>
        <div><div style="font-size:11px;font-weight:600;color:#0369a1;letter-spacing:.5px;text-transform:uppercase;margin-bottom:2px">PIX</div><div style="font-size:15px;font-weight:800;color:#0c4a6e;letter-spacing:.3px">CNPJ: 54.039.529/0001-48</div></div>
      </div>
    </div>
    <div style="padding:24px 32px;border-bottom:1px solid #e5e7eb">
      <div style="font-size:10px;font-weight:700;color:#9ca3af;letter-spacing:1px;text-transform:uppercase;margin-bottom:14px">Serviços</div>
      <table style="width:100%;border-collapse:collapse">
        <thead><tr style="background:#f3f4f6"><th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.4px;width:36px">#</th><th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.4px">Serviços</th><th style="padding:10px 12px;text-align:center;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.4px">Quantidade</th><th style="padding:10px 12px;text-align:right;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.4px">Valor</th></tr></thead>
        <tbody>
          <tr style="border-bottom:1px solid #f3f4f6"><td style="${tdN}">1</td><td style="${tdS}">Entregas</td><td style="${tdQ}">${qtdPedidos}</td><td style="${tdV};color:#1A56DB">R$ ${totalEntregas.toFixed(2)}</td></tr>
          <tr style="border-bottom:1px solid #f3f4f6"><td style="${tdN}">2</td><td style="${tdS}">Esperas</td><td style="${tdQ}">0</td><td style="${tdV};color:#9ca3af">R$ 0,00</td></tr>
          <tr><td style="${tdN}">3</td><td style="${tdS}">Gorjetas</td><td style="${tdQ}">${pedidosData.filter(p=>parseFloat(p.gorjeta)>0).length}</td><td style="${tdV};color:${totalGorjetas>0?'#059669':'#9ca3af'}">R$ ${totalGorjetas.toFixed(2)}</td></tr>
        </tbody>
        <tfoot><tr style="background:#f8faff;border-top:2px solid #dbeafe"><td colspan="3" style="padding:14px 12px;font-weight:700;color:#1A56DB;text-align:right;font-size:14px;letter-spacing:.3px">TOTAL</td><td style="padding:14px 12px;font-weight:800;color:#1A56DB;text-align:right;font-size:20px">R$ ${(totalEntregas+totalGorjetas).toFixed(2)}</td></tr></tfoot>
      </table>
    </div>
    <div style="background:#fff;padding:14px 32px;border-top:1px solid #e5e7eb;text-align:center">
      <div style="color:#111111;font-weight:700;font-size:12px;letter-spacing:.3px">#LetsGoDelivery &nbsp;&nbsp; #CadaKmUmSonho &nbsp;&nbsp; #ObrigadoPelaParceria</div>
    </div>
    <div id="fatura-actions" style="padding:14px 24px;display:flex;gap:10px;justify-content:flex-end;border-top:1px solid #e5e7eb;background:#fff">
      <button onclick="document.getElementById('modal-fatura-cobranca').style.display='none'" style="padding:9px 20px;border:1px solid #d1d5db;border-radius:8px;background:#fff;color:#374151;font-size:13px;font-weight:600;cursor:pointer;font-family:Inter,sans-serif">Fechar</button>
      <button onclick="_imprimirFatura()" style="padding:9px 22px;border:none;border-radius:8px;background:#1A56DB;color:#fff;font-size:13px;font-weight:700;cursor:pointer;font-family:Inter,sans-serif">🖨️ Imprimir</button>
    </div>
  </div>`;
  modal.innerHTML=invoice;
  modal.onclick=e=>{if(e.target===modal)modal.style.display='none';};
}

function _imprimirFatura(){
  const doc=document.getElementById('fatura-doc');if(!doc)return;
  const clone=doc.cloneNode(true);
  const actions=clone.querySelector('#fatura-actions');if(actions)actions.remove();
  const w=window.open('','_blank','width=860,height=720');
  w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Fatura — Let's Go Delivery</title><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet"><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Inter,Arial,sans-serif;background:#f3f4f6;padding:24px}@media print{body{background:#fff;padding:0}}</style></head><body>${clone.outerHTML}</body></html>`);
  w.document.close();w.focus();setTimeout(()=>w.print(),600);
}

let _configAba='cliente';
// ---- DISPARO WHATSAPP ----
let _evolutionCfgCache=null;
async function _getEvolutionConfig(){
  if(_evolutionCfgCache)return _evolutionCfgCache;
  const [urlR,instR,tokenR,msgER,msgFR]=await Promise.all([
    db('configuracoes','GET',null,'?chave=eq.evolution_api_url'),
    db('configuracoes','GET',null,'?chave=eq.evolution_api_instance'),
    db('configuracoes','GET',null,'?chave=eq.evolution_api_token'),
    db('configuracoes','GET',null,'?chave=eq.whatsapp_msg_em_rota'),
    db('configuracoes','GET',null,'?chave=eq.whatsapp_msg_financeiro'),
  ]);
  _evolutionCfgCache={
    url:(urlR&&urlR[0]?.valor)||'',
    instance:(instR&&instR[0]?.valor)||'',
    token:(tokenR&&tokenR[0]?.valor)||'',
    msgEmRota:(msgER&&msgER[0]?.valor)||'Olá {cliente}! 🛵 Seu pedido está a caminho!\n\nAcompanhe em tempo real:\n{link}',
    msgFinanceiro:(msgFR&&msgFR[0]?.valor)||'Olá, {loja}! 👋\n\nSegue a fatura do período de cobrança.\nEm caso de dúvidas entre em contato conosco.\n\nLet\'s Go Delivery',
  };
  return _evolutionCfgCache;
}
function _evolutionInvalidateCache(){_evolutionCfgCache=null;}

function _waFormatPhone(phone){
  if(!phone)return null;
  const d=phone.replace(/\D/g,'');
  if(!d||d.length<8)return null;
  return d.startsWith('55')?d:'55'+d;
}

async function _evolutionSendText(phone,message){
  const cfg=await _getEvolutionConfig();
  if(!cfg.url||!cfg.instance||!cfg.token)return false;
  const number=_waFormatPhone(phone);
  if(!number)return false;
  try{
    const r=await fetch(`${cfg.url}/message/sendText/${cfg.instance}`,{
      method:'POST',
      headers:{'Content-Type':'application/json','apikey':cfg.token},
      body:JSON.stringify({number,text:message}),
    });
    if(!r.ok)console.warn('[WA] sendText HTTP',r.status);
    return r.ok;
  }catch(e){console.error('[WA] sendText erro:',e);return false;}
}

async function _dispararWhatsappEmRota(pedidoId){
  const p=allPedidos.find(x=>x.id===pedidoId)||_tabelaPedidosDia.find(x=>x.id===pedidoId);
  if(!p?.telefone)return;
  const cfg=await _getEvolutionConfig();
  if(!cfg.url||!cfg.instance||!cfg.token)return;
  const link=window.location.origin+window.location.pathname+'?rastrear='+pedidoId;
  const msg=cfg.msgEmRota
    .replace(/{cliente}/g,p.cliente||'Cliente')
    .replace(/{link}/g,link)
    .replace(/{numero}/g,p.numero||p.id?.substring(0,6)||'');
  const ok=await _evolutionSendText(p.telefone,msg);
  if(ok)showNotif('📲 WhatsApp enviado!',p.cliente||'','#22c55e');
}

async function _dispararWhatsappFinanceiro(manual=true){
  const cfg=await _getEvolutionConfig();
  if(!cfg.url||!cfg.instance||!cfg.token){
    if(manual)showNotif('⚠️ API não configurada','Vá em Disparo WhatsApp → Configuração API','var(--yellow)');
    return;
  }
  const lojas=await db('lojas','GET',null,'?ativo=eq.true&order=nome.asc');
  const alvo=lojas.filter(l=>l.celular);
  if(!alvo.length){if(manual)showNotif('ℹ️ Sem lojas com WhatsApp Financeiro','','var(--text2)');return;}
  if(manual){const conf=confirm(`Disparar mensagem financeira para ${alvo.length} loja(s)?`);if(!conf)return;}
  let ok=0,err=0;
  for(const l of alvo){
    const msg=cfg.msgFinanceiro.replace(/{loja}/g,l.nome||'');
    const sent=await _evolutionSendText(l.celular,msg);
    if(sent)ok++;else err++;
    await new Promise(r=>setTimeout(r,1500));
  }
  if(manual)showNotif(`📲 Financeiro enviado!`,`${ok} loja(s)${err?' · '+err+' erro(s)':''}`,ok>0?'#22c55e':'var(--red)');
  else console.log(`[WA] Financeiro auto: ${ok} ok, ${err} erros`);
}

let _waCronInterval=null;
function _iniciarMonitorWhatsapp(){
  if(_waCronInterval)return;
  _waCronInterval=setInterval(()=>{
    const now=new Date();
    if(now.getDay()!==1||now.getHours()!==8||now.getMinutes()!==1)return;
    const key=`wa_fin_${now.getFullYear()}_${now.getMonth()}_${now.getDate()}`;
    if(localStorage.getItem(key))return;
    localStorage.setItem(key,'1');
    _dispararWhatsappFinanceiro(false);
  },60000);
}

async function _upsertConfigWa(chave,valor){
  const agora=new Date().toISOString();
  const ex=await db('configuracoes','GET',null,`?chave=eq.${chave}`);
  if(ex&&ex.length)await db('configuracoes','PATCH',{valor:String(valor),updated_at:agora},`?chave=eq.${chave}`);
  else await db('configuracoes','POST',{chave,valor:String(valor),created_at:agora,updated_at:agora});
}

async function _salvarMsgWhatsapp(tipo){
  const isEmRota=tipo==='em_rota';
  const chave=isEmRota?'whatsapp_msg_em_rota':'whatsapp_msg_financeiro';
  const elId=isEmRota?'wa-msg-em-rota':'wa-msg-fin';
  const fbId=isEmRota?'wa-emrota-fb':'wa-fin-fb';
  const msg=(document.getElementById(elId)?.value||'').trim();
  const fb=document.getElementById(fbId);
  if(!msg){if(fb)fb.innerHTML='<span style="color:var(--red);font-size:12px">Mensagem não pode ser vazia</span>';return;}
  if(fb)fb.innerHTML='<span style="color:var(--text2);font-size:12px">⏳ Salvando...</span>';
  await _upsertConfigWa(chave,msg);
  _evolutionInvalidateCache();
  if(fb)fb.innerHTML='<span style="color:#22c55e;font-size:12px">✅ Salvo!</span>';
  setTimeout(()=>{if(fb&&fb.innerHTML.includes('Salvo'))fb.innerHTML='';},3000);
}

async function _salvarConfigEvolution(){
  const url=(document.getElementById('wa-api-url')?.value||'').trim();
  const inst=(document.getElementById('wa-api-inst')?.value||'').trim();
  const token=(document.getElementById('wa-api-token')?.value||'').trim();
  const fb=document.getElementById('wa-cfg-fb');
  if(fb)fb.innerHTML='<span style="color:var(--text2);font-size:12px">⏳ Salvando...</span>';
  await Promise.all([_upsertConfigWa('evolution_api_url',url),_upsertConfigWa('evolution_api_instance',inst),_upsertConfigWa('evolution_api_token',token)]);
  _evolutionInvalidateCache();
  if(fb)fb.innerHTML='<span style="color:#22c55e;font-size:12px">✅ Salvo!</span>';
  setTimeout(()=>{if(fb&&fb.innerHTML.includes('Salvo'))fb.innerHTML='';},3000);
  showNotif('✅ Configuração salva!','Evolution API configurada','#22c55e');
}

let _waAba='em-rota';
async function renderWhatsappPage(){
  document.getElementById('app-body').innerHTML=`
    <div class="alt-page">
      <div class="page-header"><div class="page-title">📲 Disparo WhatsApp</div></div>
      <div style="display:flex;gap:0;margin-bottom:20px;border-bottom:1px solid var(--border);overflow-x:auto;flex-wrap:nowrap">
        <button onclick="_waGoAba('em-rota')" id="wat-em-rota" style="padding:10px 18px;border:none;background:none;font-family:Inter,sans-serif;font-size:13px;font-weight:600;cursor:pointer;white-space:nowrap;border-bottom:2px solid var(--accent);color:var(--accent)">🛵 Mensagem em Rota</button>
        <button onclick="_waGoAba('financeiro')" id="wat-financeiro" style="padding:10px 18px;border:none;background:none;font-family:Inter,sans-serif;font-size:13px;font-weight:600;cursor:pointer;white-space:nowrap;border-bottom:2px solid transparent;color:var(--text3)">💵 Financeiro</button>
        <button onclick="_waGoAba('config')" id="wat-config" style="padding:10px 18px;border:none;background:none;font-family:Inter,sans-serif;font-size:13px;font-weight:600;cursor:pointer;white-space:nowrap;border-bottom:2px solid transparent;color:var(--text3)">⚙️ Configuração API</button>
      </div>
      <div id="wa-content"></div>
    </div>`;
  _waAba='em-rota';
  _waGoAba('em-rota');
}

async function _waGoAba(aba){
  _waAba=aba;
  const corMap={'em-rota':'var(--accent)','financeiro':'#10b981','config':'#f59e0b'};
  ['em-rota','financeiro','config'].forEach(id=>{
    const el=document.getElementById('wat-'+id);if(!el)return;
    const active=id===aba;
    el.style.borderBottom=`2px solid ${active?corMap[id]:'transparent'}`;
    el.style.color=active?corMap[id]:'var(--text3)';
  });
  const el=document.getElementById('wa-content');if(!el)return;
  el.innerHTML='<div style="padding:24px;color:var(--text3)">⏳ Carregando...</div>';

  if(aba==='config'){
    const [urlR,instR,tokenR]=await Promise.all([
      db('configuracoes','GET',null,'?chave=eq.evolution_api_url'),
      db('configuracoes','GET',null,'?chave=eq.evolution_api_instance'),
      db('configuracoes','GET',null,'?chave=eq.evolution_api_token'),
    ]);
    el.innerHTML=`<div class="card" style="max-width:520px">
      <div style="font-size:15px;font-weight:700;margin-bottom:4px">⚙️ Evolution API</div>
      <div style="font-size:13px;color:var(--text2);margin-bottom:18px">Configure o chip para disparo automático de mensagens WhatsApp.</div>
      <div class="fi" style="margin-bottom:12px"><label>URL da API</label><input id="wa-api-url" placeholder="https://api.seudominio.com" value="${(urlR&&urlR[0]?.valor)||''}"/></div>
      <div class="fi" style="margin-bottom:12px"><label>Instância</label><input id="wa-api-inst" placeholder="nome-da-instancia" value="${(instR&&instR[0]?.valor)||''}"/></div>
      <div class="fi" style="margin-bottom:16px"><label>Token (apikey)</label><input id="wa-api-token" type="password" placeholder="••••••••••" value="${(tokenR&&tokenR[0]?.valor)||''}"/></div>
      <div id="wa-cfg-fb" style="min-height:18px;margin-bottom:12px"></div>
      <button onclick="_salvarConfigEvolution()" style="background:var(--accent);color:#fff;border:none;border-radius:10px;padding:10px 24px;font-size:14px;font-weight:600;cursor:pointer">✅ Salvar Configuração</button>
    </div>`;
    return;
  }

  if(aba==='em-rota'){
    const msgR=await db('configuracoes','GET',null,'?chave=eq.whatsapp_msg_em_rota');
    const msg=(msgR&&msgR[0]?.valor)||'Olá {cliente}! 🛵 Seu pedido está a caminho!\n\nAcompanhe em tempo real:\n{link}';
    el.innerHTML=`<div class="card" style="max-width:560px">
      <div style="font-size:15px;font-weight:700;margin-bottom:4px">🛵 Mensagem em Rota</div>
      <div style="font-size:13px;color:var(--text2);margin-bottom:16px">Enviada automaticamente ao número do cliente quando o motoboy clicar em <strong>"Em Rota"</strong>. Requer o campo <strong>Telefone</strong> preenchido no pedido.</div>
      <div class="fi" style="margin-bottom:6px"><label>Mensagem</label><textarea id="wa-msg-em-rota" rows="6" style="width:100%;background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:10px;color:var(--text);font-family:Inter,sans-serif;font-size:13px;line-height:1.5;resize:vertical">${msg}</textarea></div>
      <div style="font-size:11px;color:var(--text3);margin-bottom:16px">Variáveis: <code style="background:var(--surface2);padding:1px 5px;border-radius:4px">{cliente}</code> nome &nbsp;·&nbsp; <code style="background:var(--surface2);padding:1px 5px;border-radius:4px">{link}</code> rastreio &nbsp;·&nbsp; <code style="background:var(--surface2);padding:1px 5px;border-radius:4px">{numero}</code> nº pedido</div>
      <div id="wa-emrota-fb" style="min-height:18px;margin-bottom:12px"></div>
      <button onclick="_salvarMsgWhatsapp('em_rota')" style="background:var(--accent);color:#fff;border:none;border-radius:10px;padding:10px 24px;font-size:14px;font-weight:600;cursor:pointer">✅ Salvar Mensagem</button>
    </div>`;
    return;
  }

  if(aba==='financeiro'){
    const msgR=await db('configuracoes','GET',null,'?chave=eq.whatsapp_msg_financeiro');
    const msg=(msgR&&msgR[0]?.valor)||'Olá, {loja}! 👋\n\nSegue a fatura do período de cobrança.\nEm caso de dúvidas entre em contato conosco.\n\nLet\'s Go Delivery';
    el.innerHTML=`<div class="card" style="max-width:560px">
      <div style="font-size:15px;font-weight:700;margin-bottom:4px">💵 Disparo Financeiro</div>
      <div style="font-size:13px;color:var(--text2);margin-bottom:16px">Enviado automaticamente toda <strong>segunda-feira às 08:01</strong> ao campo <strong>"WhatsApp Financeiro"</strong> de cada loja ativa. O painel precisa estar aberto neste horário.</div>
      <div class="fi" style="margin-bottom:6px"><label>Mensagem</label><textarea id="wa-msg-fin" rows="6" style="width:100%;background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:10px;color:var(--text);font-family:Inter,sans-serif;font-size:13px;line-height:1.5;resize:vertical">${msg}</textarea></div>
      <div style="font-size:11px;color:var(--text3);margin-bottom:16px">Variáveis: <code style="background:var(--surface2);padding:1px 5px;border-radius:4px">{loja}</code> nome da loja</div>
      <div id="wa-fin-fb" style="min-height:18px;margin-bottom:12px"></div>
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        <button onclick="_salvarMsgWhatsapp('financeiro')" style="background:var(--accent);color:#fff;border:none;border-radius:10px;padding:10px 24px;font-size:14px;font-weight:600;cursor:pointer">✅ Salvar Mensagem</button>
        <button onclick="_dispararWhatsappFinanceiro(true)" style="background:#10b981;color:#fff;border:none;border-radius:10px;padding:10px 24px;font-size:14px;font-weight:600;cursor:pointer">📲 Disparar Agora</button>
      </div>
    </div>`;
    return;
  }
}

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
  document.getElementById('app-body').innerHTML=`<div class="alt-page"><div class="page-header"><div class="page-title">💰 Cobrança e Pagamento</div><div id="tp-btn-novo"></div></div><div style="display:flex;gap:0;margin-bottom:20px;border-bottom:1px solid var(--border)"><button id="aba-cobranca" onclick="trocarAbaTabela('cobranca')" style="padding:10px 24px;border:none;background:none;font-family:Inter,sans-serif;font-size:13px;font-weight:600;cursor:pointer;border-bottom:2px solid var(--accent);color:var(--accent)">📋 Cobrança Cliente</button><button id="aba-pagamento" onclick="trocarAbaTabela('pagamento')" style="padding:10px 24px;border:none;background:none;font-family:Inter,sans-serif;font-size:13px;font-weight:600;cursor:pointer;border-bottom:2px solid transparent;color:var(--text3)">🛵 Pagamento Motoboy</button></div><div class="card" id="tabelas-lista"><div style="padding:24px;text-align:center;color:var(--text3)">Carregando...</div></div></div>`;
  _tabAba='cobranca';await carregarTabelasPreco();
}
function trocarAbaTabela(aba){_tabAba=aba;const bc=document.getElementById('aba-cobranca'),bp=document.getElementById('aba-pagamento');if(aba==='cobranca'){bc.style.borderBottom='2px solid var(--accent)';bc.style.color='var(--accent)';bp.style.borderBottom='2px solid transparent';bp.style.color='var(--text3)';}else{bp.style.borderBottom='2px solid #10b981';bp.style.color='#10b981';bc.style.borderBottom='2px solid transparent';bc.style.color='var(--text3)';}carregarTabelasPreco();}
async function carregarTabelasPreco(){
  const tabelas=await db('tabelas_preco','GET',null,`?tipo=eq.${_tabAba}&order=nome.asc`);
  const el=document.getElementById('tabelas-lista'),btnNovo=document.getElementById('tp-btn-novo');if(!el)return;
  if(btnNovo){const cor=_tabAba==='pagamento'?'#10b981':'var(--accent)';const label=_tabAba==='pagamento'?'➕ Novo Pagamento':'➕ Nova Cobrança';btnNovo.innerHTML=`<button class="btn-sm" style="background:${cor};color:#fff;border:none;border-radius:8px;padding:8px 16px;font-family:Inter,sans-serif;font-size:13px;font-weight:600;cursor:pointer" onclick="abrirModalNovaTabela('${_tabAba}')">${label}</button>`;}
  if(!tabelas.length){el.innerHTML='<div style="padding:32px;text-align:center;color:var(--text3)">Nenhuma tabela. Clique ➕ para criar.</div>';return;}
  _tabelasPrecoCache=tabelas;
  tabelas.forEach(t=>console.log('[FAIXAS] tabela id:',t.id,'nome:',t.nome));
  el.innerHTML=`<div style="overflow-x:auto"><table><thead><tr><th>Nome</th><th>Status</th><th>Ações</th></tr></thead><tbody>${tabelas.map(t=>`<tr><td style="font-weight:600;color:var(--text)">💰 ${t.nome}</td><td><span class="p-badge b-${t.ativa?'em_rota':'fila'}">${t.ativa?'Ativa':'Inativa'}</span></td><td style="display:flex;gap:6px"><button class="btn-sm btn-primary-sm" onclick="verFaixasTabela('${t.id}')">📊 Ver faixas</button><button class="btn-sm" style="background:#f59e0b;color:#fff" onclick="renomearTabela('${t.id}','${(t.nome||'').replace(/'/g,"\\'")}')">✏️</button><button class="btn-sm" style="background:#6366f1;color:#fff" onclick="clonarTabela('${t.id}','${(t.nome||'').replace(/'/g,"\\'")}')" title="Clonar tabela">📋</button><button class="btn-sm" style="background:var(--red);color:#fff" onclick="excluirTabela('${t.id}')">🗑️</button></td></tr>`).join('')}</tbody></table></div>`;
}
function verFaixasTabela(id){const t=_tabelasPrecoCache.find(x=>x.id===id);if(t)verFaixas(t.id,t.nome,t.tipo||'cobranca');}
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
  if(fb)fb.innerHTML='<span style="color:var(--text2);font-size:12px">⏳ Salvando...</span>';
  const update={km_de:parseFloat(document.getElementById('ef-de').value)||0,km_ate:parseFloat(document.getElementById('ef-ate').value)||0,valor_sem_retorno:parseFloat(document.getElementById('ef-sem').value)||0,valor_com_retorno:parseFloat(document.getElementById('ef-com').value)||0};
  const res=await dbPatch('tabelas_preco_faixas',update,`?id=eq.${faixaId}`);
  if(res===null){if(fb)fb.innerHTML='<span style="color:#ef4444;font-size:12px">❌ Erro ao salvar. Veja o console.</span>';showNotif('❌ Erro ao salvar faixa','','var(--red)');return;}
  showNotif('✅ Faixa atualizada!','');verFaixas(tabelaId,tabelaNome,tipo);
}
async function excluirTabela(id){if(!confirm('Excluir tabela e faixas?'))return;await db('tabelas_preco_faixas','DELETE',null,`?tabela_id=eq.${id}`);await db('tabelas_preco','DELETE',null,`?id=eq.${id}`);showNotif('🗑️ Excluída','','var(--red)');carregarTabelasPreco();}
async function renomearTabela(id,nomeAtual){
  const novoNome=(prompt('Novo nome da tabela:',nomeAtual)||'').trim();
  if(!novoNome||novoNome===nomeAtual)return;
  const res=await dbPatch('tabelas_preco',{nome:novoNome,updated_at:new Date().toISOString()},`?id=eq.${id}`);
  if(res===null){showNotif('Erro','Não foi possível renomear','var(--red)');return;}
  showNotif('✅ Tabela renomeada!','');
  carregarTabelasPreco();
}
async function clonarTabela(id,nome){
  showNotif('⏳ Clonando...','');
  const orig=await db('tabelas_preco','GET',null,`?id=eq.${id}`);
  if(!orig||!orig[0]){showNotif('Erro','Tabela não encontrada','var(--red)');return;}
  const faixas=await db('tabelas_preco_faixas','GET',null,`?tabela_id=eq.${id}&order=km_de.asc`);
  const base={...orig[0]};delete base.id;
  const nova=await db('tabelas_preco','POST',{...base,nome:nome+' (cópia)',created_at:new Date().toISOString(),updated_at:new Date().toISOString()});
  if(!nova||!nova[0]){showNotif('Erro','Falha ao clonar','var(--red)');return;}
  for(const f of faixas){const fc={...f};delete fc.id;await db('tabelas_preco_faixas','POST',{...fc,tabela_id:nova[0].id,created_at:new Date().toISOString()});}
  showNotif('✅ Tabela clonada!',nova[0].nome);
  carregarTabelasPreco();
}

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

// ═══════════════════════════════════════════════════════════
// MEU CARDÁPIO — tela para perfil 'loja'
// ═══════════════════════════════════════════════════════════
let _mcCatSelecionada=null;
let _mcCategorias=[];
let _mcProdutos=[];

async function renderMeuCardapioPage(){
  const lojaId=currentUser?.loja_id;
  if(!lojaId){document.getElementById('app-body').innerHTML='<div class="alt-page"><div class="page-header"><div class="page-title">🍽️ Meu Cardápio</div></div><div class="card" style="padding:32px;text-align:center;color:var(--text3)">Nenhuma loja associada ao seu usuário.</div></div>';return;}
  document.getElementById('app-body').innerHTML=`
  <div class="alt-page">
    <div class="page-header">
      <div class="page-title">🍽️ Meu Cardápio</div>
    </div>
    <div style="display:grid;grid-template-columns:260px 1fr;gap:16px;height:calc(100vh - 120px);min-height:400px">
      <!-- Coluna esquerda: categorias -->
      <div class="card" style="display:flex;flex-direction:column;gap:0;overflow:hidden;padding:0">
        <div style="padding:14px 16px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between">
          <span style="font-weight:700;font-size:14px">Categorias</span>
          <button onclick="_mcAbrirModalCategoria()" style="background:var(--accent);color:#fff;border:none;border-radius:6px;padding:5px 12px;font-size:12px;font-weight:700;cursor:pointer">+ Nova</button>
        </div>
        <div id="mc-cat-lista" style="flex:1;overflow-y:auto;padding:8px"></div>
      </div>
      <!-- Coluna direita: produtos -->
      <div class="card" style="display:flex;flex-direction:column;gap:0;overflow:hidden;padding:0">
        <div style="padding:14px 16px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between">
          <span id="mc-prod-titulo" style="font-weight:700;font-size:14px;color:var(--text3)">← Selecione uma categoria</span>
          <button id="mc-btn-novo-prod" onclick="_mcAbrirModalProduto()" style="display:none;background:var(--accent);color:#fff;border:none;border-radius:6px;padding:5px 12px;font-size:12px;font-weight:700;cursor:pointer">+ Novo Produto</button>
        </div>
        <div id="mc-prod-lista" style="flex:1;overflow-y:auto;padding:8px"></div>
      </div>
    </div>
  </div>`;
  _mcCatSelecionada=null;
  await _mcCarregarCategorias();
}

async function _mcCarregarCategorias(){
  const lojaId=currentUser?.loja_id;if(!lojaId)return;
  _mcCategorias=await db('cardapio_categorias','GET',null,`?loja_id=eq.${lojaId}&order=ordem.asc,created_at.asc`)||[];
  const el=document.getElementById('mc-cat-lista');if(!el)return;
  if(!_mcCategorias.length){el.innerHTML='<div style="padding:24px;text-align:center;color:var(--text3);font-size:13px">Nenhuma categoria.<br>Crie a primeira!</div>';return;}
  el.innerHTML=_mcCategorias.map(c=>`
    <div id="mc-cat-${c.id}" onclick="_mcSelecionarCategoria('${c.id}')" style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:8px;cursor:pointer;margin-bottom:4px;border:1px solid transparent;transition:background .15s${_mcCatSelecionada===c.id?';background:var(--surface2);border-color:var(--accent)':''}">
      <span style="font-size:18px">📁</span>
      <div style="flex:1;min-width:0">
        <div style="font-weight:600;font-size:13px;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${c.nome}</div>
        <div style="font-size:11px;color:${c.ativo?'#10b981':'#ef4444'}">${c.ativo?'Ativa':'Inativa'}</div>
      </div>
      <div style="display:flex;gap:4px;flex-shrink:0" onclick="event.stopPropagation()">
        <button onclick="_mcAbrirModalCategoria('${c.id}')" title="Editar" style="background:none;border:1px solid var(--border);border-radius:5px;width:26px;height:26px;cursor:pointer;font-size:12px;display:flex;align-items:center;justify-content:center">✏️</button>
        <button onclick="_mcToggleCategoria('${c.id}',${!c.ativo})" title="${c.ativo?'Desativar':'Ativar'}" style="background:none;border:1px solid var(--border);border-radius:5px;width:26px;height:26px;cursor:pointer;font-size:12px;display:flex;align-items:center;justify-content:center">${c.ativo?'🔴':'🟢'}</button>
      </div>
    </div>`).join('');
}

async function _mcSelecionarCategoria(catId){
  _mcCatSelecionada=catId;
  // Destaca a categoria selecionada
  document.querySelectorAll('[id^="mc-cat-"]').forEach(el=>{el.style.background='';el.style.borderColor='transparent';});
  const selEl=document.getElementById(`mc-cat-${catId}`);
  if(selEl){selEl.style.background='var(--surface2)';selEl.style.borderColor='var(--accent)';}
  const cat=_mcCategorias.find(c=>c.id===catId);
  const titulo=document.getElementById('mc-prod-titulo');
  const btnNovo=document.getElementById('mc-btn-novo-prod');
  if(titulo)titulo.innerHTML=`<span style="color:var(--text)">${cat?.nome||'Produtos'}</span>`;
  if(btnNovo)btnNovo.style.display='inline-block';
  await _mcCarregarProdutos(catId);
}

async function _mcCarregarProdutos(catId){
  const el=document.getElementById('mc-prod-lista');if(!el)return;
  el.innerHTML='<div style="padding:24px;text-align:center;color:var(--text3)">🔍 Carregando...</div>';
  _mcProdutos=await db('cardapio_produtos','GET',null,`?categoria_id=eq.${catId}&order=ordem.asc,created_at.asc`)||[];
  if(!_mcProdutos.length){el.innerHTML='<div style="padding:32px;text-align:center;color:var(--text3);font-size:13px">Nenhum produto nesta categoria.<br>Clique em "+ Novo Produto".</div>';return;}
  el.innerHTML=`<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px;padding:4px">
    ${_mcProdutos.map(p=>`
    <div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;overflow:hidden;display:flex;flex-direction:column">
      ${p.foto_url?`<img src="${p.foto_url}" alt="${p.nome}" style="width:100%;height:120px;object-fit:cover">`:'<div style="width:100%;height:80px;background:var(--surface3);display:flex;align-items:center;justify-content:center;font-size:32px">🍽️</div>'}
      <div style="padding:10px;flex:1;display:flex;flex-direction:column;gap:6px">
        <div style="font-weight:700;font-size:13px;color:var(--text)">${p.nome}</div>
        ${p.descricao?`<div style="font-size:11px;color:var(--text3);line-height:1.4">${p.descricao}</div>`:''}
        <div style="font-size:15px;font-weight:700;color:var(--accent)">R$ ${parseFloat(p.preco||0).toFixed(2)}</div>
        <div style="display:flex;align-items:center;gap:6px;margin-top:auto;padding-top:6px;border-top:1px solid var(--border)">
          <span style="font-size:11px;padding:2px 8px;border-radius:10px;background:${p.disponivel?'#05966920':'#ef444420'};color:${p.disponivel?'#10b981':'#ef4444'};font-weight:600">${p.disponivel?'Disponível':'Indisponível'}</span>
          <div style="margin-left:auto;display:flex;gap:4px">
            <button onclick="_mcToggleProduto('${p.id}',${!p.disponivel})" title="${p.disponivel?'Marcar indisponível':'Marcar disponível'}" style="background:none;border:1px solid var(--border);border-radius:5px;width:26px;height:26px;cursor:pointer;font-size:12px;display:flex;align-items:center;justify-content:center">${p.disponivel?'🔴':'🟢'}</button>
            <button onclick="_mcAbrirModalProduto('${p.id}')" title="Editar" style="background:none;border:1px solid var(--border);border-radius:5px;width:26px;height:26px;cursor:pointer;font-size:12px;display:flex;align-items:center;justify-content:center">✏️</button>
            <button onclick="_mcExcluirProduto('${p.id}','${(p.nome||'').replace(/'/g,"\\'")}')" title="Excluir" style="background:none;border:1px solid #ef4444;border-radius:5px;width:26px;height:26px;cursor:pointer;font-size:12px;display:flex;align-items:center;justify-content:center">🗑️</button>
          </div>
        </div>
      </div>
    </div>`).join('')}
  </div>`;
}

function _mcAbrirModalCategoria(catId){
  const cat=catId?_mcCategorias.find(c=>c.id===catId):null;
  const v=x=>(x||'').toString().replace(/"/g,'&quot;');
  let m=document.getElementById('mc-modal-cat');
  if(!m){m=document.createElement('div');m.id='mc-modal-cat';m.className='modal-overlay';document.body.appendChild(m);}
  const ss='background:var(--surface2);color:var(--text);border:1px solid var(--border);border-radius:8px;padding:9px 12px;width:100%;font-family:Inter,sans-serif;font-size:14px;box-sizing:border-box';
  m.innerHTML=`<div class="modal" style="max-width:400px">
    <div class="modal-header"><span class="modal-title">${cat?'✏️ Editar':'➕ Nova'} Categoria</span><button class="modal-close" onclick="document.getElementById('mc-modal-cat').classList.remove('open')">✕</button></div>
    <div class="modal-body">
      <div class="fi"><label>Nome da Categoria</label><input id="mc-cat-nome" value="${v(cat?.nome)}" placeholder="Ex: Lanches, Bebidas..." style="${ss}"/></div>
      <div class="form-row" style="margin-top:12px">
        <div class="fi"><label>Ordem</label><input id="mc-cat-ordem" type="number" value="${cat?.ordem??0}" min="0" style="${ss}"/></div>
        <div class="fi"><label>Status</label><select id="mc-cat-ativo" style="${ss}"><option value="true"${cat===null||cat?.ativo?' selected':''}>Ativa</option><option value="false"${cat&&!cat.ativo?' selected':''}>Inativa</option></select></div>
      </div>
      <div id="mc-cat-fb" style="margin-top:10px"></div>
    </div>
    <div class="modal-footer"><button class="btn-modal-cancel" onclick="document.getElementById('mc-modal-cat').classList.remove('open')">Cancelar</button><button onclick="_mcSalvarCategoria(${catId?`'${catId}'`:'null'})" style="background:#22c55e;color:#fff;border:none;border-radius:10px;padding:10px 24px;font-size:14px;font-weight:700;cursor:pointer">✓ Salvar</button></div>
  </div>`;
  m.classList.add('open');
  setTimeout(()=>document.getElementById('mc-cat-nome')?.focus(),100);
}

async function _mcSalvarCategoria(catId){
  const fb=document.getElementById('mc-cat-fb');
  const nome=(document.getElementById('mc-cat-nome')?.value||'').trim();
  if(!nome){if(fb)fb.innerHTML='<span style="color:#ef4444;font-size:13px">Nome é obrigatório.</span>';return;}
  const lojaId=currentUser?.loja_id;if(!lojaId)return;
  const ordem=parseInt(document.getElementById('mc-cat-ordem')?.value||'0',10);
  const ativo=document.getElementById('mc-cat-ativo')?.value==='true';
  if(fb)fb.innerHTML='<span style="color:var(--text3);font-size:13px">⏳ Salvando...</span>';
  const agora=new Date().toISOString();
  if(catId){
    await db('cardapio_categorias','PATCH',{nome,ordem,ativo,updated_at:agora},`?id=eq.${catId}`);
  } else {
    await db('cardapio_categorias','POST',{loja_id:lojaId,nome,ordem,ativo,created_at:agora});
  }
  document.getElementById('mc-modal-cat')?.classList.remove('open');
  await _mcCarregarCategorias();
  if(_mcCatSelecionada)await _mcCarregarProdutos(_mcCatSelecionada);
  showNotif(catId?'✅ Categoria atualizada!':'✅ Categoria criada!','');
}

async function _mcToggleCategoria(catId,novoAtivo){
  await db('cardapio_categorias','PATCH',{ativo:novoAtivo},`?id=eq.${catId}`);
  await _mcCarregarCategorias();
  if(_mcCatSelecionada===catId&&!novoAtivo){
    const el=document.getElementById('mc-prod-lista');
    if(el)el.innerHTML='<div style="padding:24px;text-align:center;color:var(--text3);font-size:13px">Categoria inativa.</div>';
  }
}

function _mcAbrirModalProduto(prodId){
  const prod=prodId?_mcProdutos.find(p=>p.id===prodId):null;
  const v=x=>(x||'').toString().replace(/"/g,'&quot;');
  let m=document.getElementById('mc-modal-prod');
  if(!m){m=document.createElement('div');m.id='mc-modal-prod';m.className='modal-overlay';document.body.appendChild(m);}
  const ss='background:var(--surface2);color:var(--text);border:1px solid var(--border);border-radius:8px;padding:9px 12px;width:100%;font-family:Inter,sans-serif;font-size:14px;box-sizing:border-box';
  const catOpts=_mcCategorias.map(c=>`<option value="${c.id}"${(prod?.categoria_id||_mcCatSelecionada)===c.id?' selected':''}>${c.nome}</option>`).join('');
  const fotoAtual=prod?.foto_url||'';
  m.innerHTML=`<div class="modal" style="max-width:480px">
    <div class="modal-header"><span class="modal-title">${prod?'✏️ Editar':'➕ Novo'} Produto</span><button class="modal-close" onclick="document.getElementById('mc-modal-prod').classList.remove('open')">✕</button></div>
    <div class="modal-body" style="max-height:70vh;overflow-y:auto">
      <div class="form-row full fi"><label>Categoria</label><select id="mc-prod-cat" style="${ss}">${catOpts}</select></div>
      <div class="form-row full fi" style="margin-top:10px"><label>Nome do Produto</label><input id="mc-prod-nome" value="${v(prod?.nome)}" placeholder="Ex: X-Burguer Especial" style="${ss}"/></div>
      <div class="form-row full fi" style="margin-top:10px"><label>Descrição</label><textarea id="mc-prod-desc" placeholder="Ingredientes, observações..." style="${ss};height:70px;resize:vertical">${v(prod?.descricao)}</textarea></div>
      <div class="form-row" style="margin-top:10px">
        <div class="fi"><label>Preço (R$)</label><input id="mc-prod-preco" type="number" min="0" step="0.01" value="${parseFloat(prod?.preco||0).toFixed(2)}" style="${ss}"/></div>
        <div class="fi"><label>Ordem</label><input id="mc-prod-ordem" type="number" min="0" value="${prod?.ordem??0}" style="${ss}"/></div>
      </div>
      <div class="fi" style="margin-top:10px"><label>Status</label><select id="mc-prod-disp" style="${ss}"><option value="true"${prod===null||prod?.disponivel?' selected':''}>Disponível</option><option value="false"${prod&&!prod.disponivel?' selected':''}>Indisponível</option></select></div>
      <div class="fi" style="margin-top:14px">
        <label>Foto do Produto</label>
        ${fotoAtual?`<img id="mc-prod-foto-preview" src="${fotoAtual}" style="width:100%;max-height:140px;object-fit:cover;border-radius:8px;margin-bottom:8px"/>`:
          `<div id="mc-prod-foto-preview" style="display:none"></div>`}
        <input type="file" id="mc-prod-foto-file" accept="image/jpeg,image/png,image/webp" onchange="_mcPreviewFoto(this)" style="display:none"/>
        <input id="mc-prod-foto-url" type="text" value="${v(fotoAtual)}" placeholder="URL da foto ou escolha arquivo abaixo" style="${ss};margin-bottom:6px" oninput="_mcAtualizarPreviewUrl(this.value)"/>
        <button type="button" onclick="document.getElementById('mc-prod-foto-file').click()" style="background:var(--surface2);color:var(--text);border:1px solid var(--border);border-radius:7px;padding:7px 14px;font-size:12px;cursor:pointer;width:100%">📷 Escolher imagem (máx. 2MB)</button>
        <div id="mc-prod-foto-status" style="font-size:11px;color:var(--text3);margin-top:4px"></div>
      </div>
      <div id="mc-prod-fb" style="margin-top:10px"></div>
    </div>
    <div class="modal-footer"><button class="btn-modal-cancel" onclick="document.getElementById('mc-modal-prod').classList.remove('open')">Cancelar</button><button onclick="_mcSalvarProduto(${prodId?`'${prodId}'`:'null'})" style="background:#22c55e;color:#fff;border:none;border-radius:10px;padding:10px 24px;font-size:14px;font-weight:700;cursor:pointer">✓ Salvar</button></div>
  </div>`;
  m.classList.add('open');
  setTimeout(()=>document.getElementById('mc-prod-nome')?.focus(),100);
}

function _mcPreviewFoto(input){
  const file=input.files[0];if(!file)return;
  if(file.size>2097152){showNotif('Arquivo muito grande','Máximo 2MB','var(--red)');input.value='';return;}
  const reader=new FileReader();
  reader.onload=e=>{
    const prev=document.getElementById('mc-prod-foto-preview');
    if(prev){prev.src=e.target.result;prev.style.display='block';prev.style.width='100%';prev.style.maxHeight='140px';prev.style.objectFit='cover';prev.style.borderRadius='8px';prev.style.marginBottom='8px';}
    const status=document.getElementById('mc-prod-foto-status');
    if(status)status.innerHTML=`<span style="color:#10b981">✅ ${file.name} pronto para upload</span>`;
  };
  reader.readAsDataURL(file);
}

function _mcAtualizarPreviewUrl(url){
  const prev=document.getElementById('mc-prod-foto-preview');
  if(!prev)return;
  if(url){prev.src=url;prev.style.display='block';prev.style.width='100%';prev.style.maxHeight='140px';prev.style.objectFit='cover';prev.style.borderRadius='8px';prev.style.marginBottom='8px';}
  else{prev.style.display='none';}
}

async function _mcUploadFoto(file,prodId){
  const lojaId=currentUser?.loja_id||'sem-loja';
  const ext=file.name.split('.').pop().toLowerCase();
  const path=`${lojaId}/${prodId||('novo-'+Date.now())}.${ext}`;
  const res=await fetch(`${SB_URL}/storage/v1/object/cardapio-fotos/${path}`,{
    method:'POST',
    headers:{'apikey':SB_KEY,'Authorization':`Bearer ${SB_KEY}`,'Content-Type':file.type,'x-upsert':'true'},
    body:file
  });
  if(!res.ok)return null;
  return `${SB_URL}/storage/v1/object/public/cardapio-fotos/${path}`;
}

async function _mcSalvarProduto(prodId){
  const fb=document.getElementById('mc-prod-fb');
  const nome=(document.getElementById('mc-prod-nome')?.value||'').trim();
  if(!nome){if(fb)fb.innerHTML='<span style="color:#ef4444;font-size:13px">Nome é obrigatório.</span>';return;}
  const lojaId=currentUser?.loja_id;if(!lojaId)return;
  const catId=document.getElementById('mc-prod-cat')?.value||_mcCatSelecionada;
  const desc=(document.getElementById('mc-prod-desc')?.value||'').trim();
  const preco=parseFloat(document.getElementById('mc-prod-preco')?.value||'0')||0;
  const ordem=parseInt(document.getElementById('mc-prod-ordem')?.value||'0',10);
  const disponivel=document.getElementById('mc-prod-disp')?.value==='true';
  if(fb)fb.innerHTML='<span style="color:var(--text3);font-size:13px">⏳ Salvando...</span>';

  // Upload de foto se arquivo selecionado
  let fotoUrl=(document.getElementById('mc-prod-foto-url')?.value||'').trim();
  const fileInput=document.getElementById('mc-prod-foto-file');
  if(fileInput?.files[0]){
    if(fb)fb.innerHTML='<span style="color:var(--text3);font-size:13px">⏳ Enviando foto...</span>';
    const url=await _mcUploadFoto(fileInput.files[0],prodId||null);
    if(url)fotoUrl=url;
    else{if(fb)fb.innerHTML='<span style="color:#f59e0b;font-size:13px">⚠️ Foto não enviada, produto salvo sem ela.</span>';}
  }

  const agora=new Date().toISOString();
  const data={loja_id:lojaId,categoria_id:catId||null,nome,descricao:desc||null,preco,foto_url:fotoUrl||null,disponivel,ordem,updated_at:agora};
  if(prodId){
    await db('cardapio_produtos','PATCH',data,`?id=eq.${prodId}`);
  } else {
    await db('cardapio_produtos','POST',{...data,created_at:agora});
  }
  document.getElementById('mc-modal-prod')?.classList.remove('open');
  if(_mcCatSelecionada)await _mcCarregarProdutos(_mcCatSelecionada);
  showNotif(prodId?'✅ Produto atualizado!':'✅ Produto criado!','');
}

async function _mcToggleProduto(prodId,novoDisp){
  await db('cardapio_produtos','PATCH',{disponivel:novoDisp,updated_at:new Date().toISOString()},`?id=eq.${prodId}`);
  if(_mcCatSelecionada)await _mcCarregarProdutos(_mcCatSelecionada);
}

async function _mcExcluirProduto(prodId,nome){
  if(!confirm(`Excluir "${nome}"? Esta ação não pode ser desfeita.`))return;
  await db('cardapio_produtos','DELETE',null,`?id=eq.${prodId}`);
  if(_mcCatSelecionada)await _mcCarregarProdutos(_mcCatSelecionada);
  showNotif('🗑️ Produto excluído','');
}

document.addEventListener('DOMContentLoaded',()=>{
  if(window.matchMedia('(prefers-color-scheme: dark)').matches){
    document.documentElement.classList.add('dark');
  }
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
    const btnNovo=document.getElementById('btn-novo-pedido');if(btnNovo)btnNovo.style.display=currentPerfil==='adm'||currentPerfil==='loja'?'flex':'none';
    const btnCriarTop2=document.getElementById('btn-criar-entrega-topbar');if(btnCriarTop2)btnCriarTop2.style.display=currentPerfil==='suporte'?'flex':'none';
    renderTabs();setTimeout(()=>{goTab('mapa');_carregarSaldoTopbar();},150);
    if(currentPerfil==='adm'||currentPerfil==='suporte'){iniciarRoteirizacao();iniciarScheduler();}
    _inicializarPrecoDinamico();
  }catch(e){sessionStorage.removeItem('lg_user');}
});

// ═══════════════════════════════════════════════
// SCHEDULER — libera pedidos agendados a cada 60s
// ═══════════════════════════════════════════════
let _schedulerInterval=null;
async function _runScheduler(){
  try{
    const agendados=await db('pedidos','GET',null,`?status=eq.agendado&agendado_para=lte.${new Date().toISOString()}`);
    if(!agendados.length)return;
    const agora=new Date().toISOString();
    await Promise.all(agendados.map(p=>db('pedidos','PATCH',{status:'pronto',status_detalhado:'pronto',pronto_em:agora,updated_at:agora},`?id=eq.${p.id}`)));
    console.log(`[scheduler] ${agendados.length} pedido(s) liberado(s) para entrega`);
    atualizarTudo();
  }catch(e){console.error('[scheduler]',e);}
}
function iniciarScheduler(){
  if(_schedulerInterval)return;
  _runScheduler();
  _schedulerInterval=setInterval(_runScheduler,60000);
}

// ═══════════════════════════════════════════════
// ROTEIRIZAÇÃO DE PEDIDOS
// ═══════════════════════════════════════════════
let _rotasInterval=null,_dobrarRaioInterval=null;
let _filaDespacho=[],_processandoFila=false;

async function logDespacho(acao,dados={}){
  try{await db('logs_despacho','POST',{acao,dados,created_at:new Date().toISOString()});}catch{}
}

function _comTimeout(fn,ms=10000){
  return Promise.race([fn(),new Promise((_,r)=>setTimeout(()=>r(new Error('timeout')),ms))]);
}

async function _adquirirEntregador(id){
  try{
    const ok=await db('entregadores','GET',null,`?id=eq.${id}&em_processo=eq.false&disponivel=eq.true`);
    if(!ok||!ok.length)return false;
    await db('entregadores','PATCH',{em_processo:true},`?id=eq.${id}`);
    return true;
  }catch{return false;}
}

async function _liberarEntregador(id){
  if(!id)return;
  try{await db('entregadores','PATCH',{em_processo:false},`?id=eq.${id}`);}catch{}
}

async function _buscarEntregador(lat,lng,raio,excluir=[]){
  const lista=await db('entregadores','GET',null,'?disponivel=eq.true&em_processo=eq.false&select=*');
  if(!lista||!lista.length)return null;
  return lista
    .filter(e=>e.lat&&e.lng&&!excluir.includes(e.id))
    .map(e=>({...e,_dist:calcularDistancia(lat,lng,e.lat,e.lng)}))
    .filter(e=>e._dist<=raio)
    .sort((a,b)=>a._dist-b._dist)[0]||null;
}

function _agruparPorProximidade(pedidos){
  const grupos=[],usados=new Set();
  for(let i=0;i<pedidos.length;i++){
    if(usados.has(i))continue;
    const g=[pedidos[i]];usados.add(i);
    for(let j=i+1;j<pedidos.length&&g.length<3;j++){
      if(usados.has(j))continue;
      if(g.every(x=>calcularDistancia(x.latitude,x.longitude,pedidos[j].latitude,pedidos[j].longitude)<=4.5)){
        g.push(pedidos[j]);usados.add(j);
      }
    }
    if(g.length>=2)grupos.push(g);
  }
  return grupos;
}

async function _despacharRota(lojaId,grupo,loja){
  let entId=null;
  try{
    const pedidoIds=grupo.map(p=>p.id);
    const agora=new Date().toISOString();
    const ent=await _buscarEntregador(loja.latitude,loja.longitude,2);
    if(ent){
      if(await _adquirirEntregador(ent.id))entId=ent.id;
      else await logDespacho('entregador_ocupado',{entregador_id:ent.id});
    }
    const res=await db('rotas','POST',{
      loja_id:lojaId,pedidos:pedidoIds,status:'aguardando',
      entregador_id:entId,raio_atual:2,tentativas_entregador:entId?1:0,
      created_at:agora,updated_at:agora
    });
    const rota=Array.isArray(res)?res[0]:res;
    if(!rota?.id){await _liberarEntregador(entId);entId=null;return;}
    await logDespacho('criou_rota',{rota_id:rota.id,loja_id:lojaId,pedidos:pedidoIds});
    if(entId){
      await logDespacho('tentou_entregador',{rota_id:rota.id,entregador_id:entId,raio:2});
      await db('entregadores','PATCH',{notificacao_rota:rota.id,em_processo:false},`?id=eq.${entId}`);
      entId=null;
    }
  }finally{
    if(entId)_liberarEntregador(entId).catch(()=>{});
  }
}

async function _processarFila(){
  if(_processandoFila)return;
  _processandoFila=true;
  while(_filaDespacho.length>0){
    const fn=_filaDespacho.shift();
    try{await _comTimeout(fn,10000);}
    catch(e){if(e.message==='timeout')await logDespacho('timeout',{erro:'10s'});}
  }
  _processandoFila=false;
}

async function verificarRotas(){
  if(!currentUser||(currentPerfil!=='adm'&&currentPerfil!=='suporte'))return;
  try{
    const pedidos=await db('pedidos','GET',null,'?status=eq.recebido&latitude=not.is.null&select=id,loja_id,latitude,longitude');
    if(!pedidos||pedidos.length<2)return;
    const rotasAtivas=await db('rotas','GET',null,'?status=in.(aguardando,disponivel)&select=pedidos');
    const emRota=new Set((rotasAtivas||[]).flatMap(r=>Array.isArray(r.pedidos)?r.pedidos:[]));
    const livres=pedidos.filter(p=>!emRota.has(p.id)&&p.loja_id&&p.latitude&&p.longitude);
    const porLoja={};
    for(const p of livres){if(!porLoja[p.loja_id])porLoja[p.loja_id]=[];porLoja[p.loja_id].push(p);}
    for(const[lojaId,lista] of Object.entries(porLoja)){
      if(lista.length<2)continue;
      const lojas=await db('lojas','GET',null,`?id=eq.${lojaId}&select=id,latitude,longitude`);
      const loja=lojas?.[0];
      if(!loja?.latitude||!loja?.longitude)continue;
      for(const grupo of _agruparPorProximidade(lista)){
        _filaDespacho.push(()=>_despacharRota(lojaId,grupo,loja));
      }
    }
    _processarFila();
  }catch(e){console.warn('[verificarRotas]',e);}
}

async function dobrarRaio(){
  if(!currentUser||(currentPerfil!=='adm'&&currentPerfil!=='suporte'))return;
  try{
    const limite=new Date(Date.now()-60000).toISOString();
    const rotas=await db('rotas','GET',null,`?status=eq.aguardando&created_at=lt.${limite}`);
    if(!rotas||!rotas.length)return;
    for(const rota of rotas){
      _filaDespacho.push(async()=>{
        const tentativas=rota.tentativas_entregador||0;
        const raioAtual=rota.raio_atual||2;
        if(raioAtual>=32||tentativas>=5){
          await db('rotas','PATCH',{status:'disponivel',updated_at:new Date().toISOString()},`?id=eq.${rota.id}`);
          await logDespacho('foi_para_disponiveis',{rota_id:rota.id,tentativas,raio:raioAtual});
          return;
        }
        const novoRaio=raioAtual*2;
        const lojas=await db('lojas','GET',null,`?id=eq.${rota.loja_id}&select=id,latitude,longitude`);
        const loja=lojas?.[0];
        let novoEntId=null;
        if(loja?.latitude&&loja?.longitude){
          const excluir=rota.entregador_id?[rota.entregador_id]:[];
          const ent=await _buscarEntregador(loja.latitude,loja.longitude,novoRaio,excluir);
          if(ent){
            if(await _adquirirEntregador(ent.id))novoEntId=ent.id;
            else await logDespacho('entregador_ocupado',{rota_id:rota.id,entregador_id:ent.id});
          }
        }
        await logDespacho('raio_dobrado',{rota_id:rota.id,raio_anterior:raioAtual,novo_raio:novoRaio,entregador_id:novoEntId});
        await db('rotas','PATCH',{
          raio_atual:novoRaio,
          entregador_id:novoEntId||rota.entregador_id,
          tentativas_entregador:tentativas+1,
          updated_at:new Date().toISOString()
        },`?id=eq.${rota.id}`);
        if(novoEntId){
          await logDespacho('tentou_entregador',{rota_id:rota.id,entregador_id:novoEntId,raio:novoRaio});
          await db('entregadores','PATCH',{notificacao_rota:rota.id,em_processo:false},`?id=eq.${novoEntId}`);
        }
      });
    }
    _processarFila();
  }catch(e){console.warn('[dobrarRaio]',e);}
}

function iniciarRoteirizacao(){
  pararRoteirizacao();
  verificarRotas();dobrarRaio();
  _rotasInterval=setInterval(verificarRotas,30000);
  _dobrarRaioInterval=setInterval(dobrarRaio,60000);
}

function pararRoteirizacao(){
  clearInterval(_rotasInterval);clearInterval(_dobrarRaioInterval);
  _rotasInterval=null;_dobrarRaioInterval=null;_filaDespacho=[];
}

// ═══════════════════════════════════════════════
// AUTOCOMPLETE DE ENDEREÇO
// ═══════════════════════════════════════════════
function iniciarAutocompleteEndereco(inputId,latId,lngId,feedbackId,_retry=0){
  const input=document.getElementById(inputId);if(!input)return;
  if(input.dataset.gacInit)return;
  if(!window.google?.maps?.places){
    if(_retry>=10)return;
    setTimeout(()=>iniciarAutocompleteEndereco(inputId,latId,lngId,feedbackId,_retry+1),200);
    return;
  }
  input.dataset.gacInit='1';
  const ac=new google.maps.places.Autocomplete(input,{
    componentRestrictions:{country:'br'},
    fields:['geometry','formatted_address'],
    types:['address'],
  });
  ac.addListener('place_changed',()=>{
    const place=ac.getPlace();
    const fb=feedbackId?document.getElementById(feedbackId):null;
    if(!place.geometry){
      if(fb)fb.innerHTML='<span style="color:#f59e0b;font-size:11px">⚠️ Selecione um endereço da lista</span>';
      return;
    }
    const lat=place.geometry.location.lat(),lng=place.geometry.location.lng();
    if(latId&&document.getElementById(latId))document.getElementById(latId).value=lat.toFixed(6);
    if(lngId&&document.getElementById(lngId))document.getElementById(lngId).value=lng.toFixed(6);
    if(fb)fb.innerHTML='<span style="color:var(--green);font-size:11px">✅ Localizado</span>';
    input.dispatchEvent(new Event('input',{bubbles:true}));
  });
}
