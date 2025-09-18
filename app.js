import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cfg = window.APP_CONFIG || {};
const url = new URL(location.href);
const token = url.searchParams.get("token");

const alertBox    = document.getElementById("alert");
const itemsList   = document.getElementById("items-list");
const sessionInfo = document.getElementById("session-info");
const orderPreview = document.getElementById("order-preview");
const emptyHint   = document.getElementById("empty-hint");

function showAlert(msg){ alertBox.textContent = msg || ""; alertBox.style.display = msg ? "block":"none"; }
function fmtDate(s){ try{ return new Date(s).toLocaleString("pt-BR",{ timeZone:"America/Sao_Paulo" }); } catch { return s; } }

function showErrorPage(title, message, icon = "❌") {
  document.body.innerHTML = `
    <div style="
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, var(--gray-50) 0%, #ffffff 100%);
      padding: 20px;
    ">
      <div style="
        max-width: 500px;
        background: white;
        padding: 40px;
        border-radius: 16px;
        box-shadow: var(--shadow-lg);
        text-align: center;
        border: 1px solid var(--gray-200);
      ">
        <div style="font-size: 64px; margin-bottom: 20px;">${icon}</div>
        <h1 style="
          font-size: 28px;
          font-weight: 700;
          margin: 0 0 16px;
          color: var(--gray-900);
        ">${title}</h1>
        <p style="
          font-size: 16px;
          line-height: 1.6;
          margin: 0 0 24px;
          color: var(--gray-600);
        ">${message}</p>
        <div style="
          background: var(--warning-light);
          padding: 16px;
          border-radius: 8px;
          border-left: 4px solid var(--warning);
          margin-bottom: 24px;
        ">
          <p style="
            margin: 0;
            font-size: 14px;
            color: var(--warning);
            font-weight: 600;
          ">
            💡 Entre em contato conosco se precisar de um novo link
          </p>
        </div>
        <small style="
          color: var(--gray-500);
          font-size: 13px;
        ">
          Você pode fechar esta página com segurança.
        </small>
      </div>
    </div>
  `;
}

if (!token) { 
  showErrorPage(
    "Link Inválido", 
    "Este link não contém um token válido. Verifique se você copiou o link completo ou solicite um novo link de acesso.",
    "🔗"
  ); 
  throw new Error("token ausente"); 
}

const supabase = createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON, {
  db: { schema: "demo" }
});

let session = null;
let items   = [];

/* ---------- helpers ---------- */
function chunk(arr, size){ const out=[]; for (let i=0;i<arr.length;i+=size) out.push(arr.slice(i, i+size)); return out; }
function toDecimal(v){
  if (v == null) return NaN;
  if (typeof v === "number") return v;
  const n = parseFloat(String(v).replace(/\s+/g,"").replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
}
function computeUnitPrice(p){
  if (!p) return null;
  const base  = toDecimal(p.preco3);
  const promo = toDecimal(p.promo3);
  const cands = [base, (promo > 0 ? promo : NaN)].filter(Number.isFinite);
  if (!cands.length) return null;
  return Math.min(...cands);
}

function formatBRL(n){
  return new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(n);
}
function lineTotal(it){ return (it?.unit_price!=null) ? (it.unit_price * (it.qty||0)) : null; }
function grandTotal(){ return items.reduce((acc, it) => acc + ((it.unit_price ?? 0) * (it.qty ?? 0)), 0); }

function updateTotalsBoth(){
  const sum = items.reduce((s,it)=> s + ((it.unit_price ?? 0) * (it.qty ?? 0)), 0);
  const txt = new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(sum);

  const pageTotal   = document.getElementById('order-total');  // total "estático"
  const footerTotal = document.getElementById('footer-total'); // total da barra flutuante

  if (pageTotal)   pageTotal.textContent   = txt;
  if (footerTotal) footerTotal.textContent = txt;
}

// --- envio (usa mesmo handler nos dois botões, se existirem) ---
let isSubmitting = false;

function setSubmitting(on){
  isSubmitting = on;
  const txt = on ? "🔄 Enviando..." : "🚀 Enviar Pedido";
  
  // Atualiza todos os botões de envio
  const mainSubmit = document.getElementById("main-submit-btn");
  const footerSubmit = document.getElementById("footer-submit-btn");
  
  if (mainSubmit) { 
    mainSubmit.disabled = on; 
    mainSubmit.textContent = txt; 
  }
  if (footerSubmit) { 
    footerSubmit.disabled = on; 
    footerSubmit.textContent = txt; 
  }
}

async function handleSubmit(){
  if (isSubmitting) return;
  try{
    setSubmitting(true);
    await saveChanges();
    await submitOrder();
    showSuccessPage();
  } catch(e){
    showAlert(e.message || String(e));
  } finally {
    setSubmitting(false);
  }
}

function showSuccessPage(){
  document.body.innerHTML = `
    <div style="
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, var(--success) 0%, #047857 100%);
      color: white;
      text-align: center;
      padding: 20px;
    ">
      <div style="
        max-width: 500px;
        background: white;
        color: var(--gray-900);
        padding: 40px;
        border-radius: 16px;
        box-shadow: 0 20px 40px rgba(0,0,0,0.1);
      ">
        <div style="font-size: 64px; margin-bottom: 20px;">✅</div>
        <h1 style="
          font-size: 28px;
          font-weight: 700;
          margin: 0 0 16px;
          color: var(--success);
        ">Pedido Enviado com Sucesso!</h1>
        ${window.lastOrderNumber ? `
        <div style="
          background: var(--success-light);
          padding: 16px;
          border-radius: 8px;
          margin-bottom: 20px;
          border: 2px solid var(--success);
        ">
          <h2 style="
            font-size: 24px;
            font-weight: 700;
            margin: 0;
            color: var(--success);
          ">Pedido Nº ${window.lastOrderNumber}</h2>
        </div>
        ` : ''}
        <p style="
          font-size: 16px;
          line-height: 1.6;
          margin: 0 0 24px;
          color: var(--gray-600);
        ">
          Obrigado por enviar seu pedido! Em breve entraremos em contato 
          para confirmar os itens e definir a forma de pagamento.
        </p>
        <div style="
          background: var(--success-light);
          padding: 16px;
          border-radius: 8px;
          border-left: 4px solid var(--success);
          margin-bottom: 24px;
        ">
          <p style="
            margin: 0;
            font-size: 14px;
            color: var(--success);
            font-weight: 600;
          ">
            📞 Nossa equipe entrará em contato em até 24 horas
          </p>
        </div>
        <small style="
          color: var(--gray-500);
          font-size: 13px;
        ">
          Você pode fechar esta página com segurança.
        </small>
      </div>
    </div>
  `;
}
// Função para controlar visibilidade das barras de ação
function updateActionBarsVisibility() {
  const mainActions = document.querySelector('.actions');
  const floatingBar = document.getElementById('actions-bar');
  
  if (!mainActions || !floatingBar) return;
  
  const mainActionsRect = mainActions.getBoundingClientRect();
  const windowHeight = window.innerHeight;
  
  // Se a barra principal está visível na tela, esconde a flutuante
  if (mainActionsRect.top < windowHeight && mainActionsRect.bottom > 0) {
    floatingBar.style.display = 'none';
  } else {
    floatingBar.style.display = 'block';
  }
}



/* ---------- data ---------- */
async function loadSession(){
  console.log('🔍 Tentando carregar sessão com token:', token);
  console.log('🔍 Configuração Supabase URL:', cfg.SUPABASE_URL);
  console.log('🔍 Schema configurado: demo');
  console.log('🔍 Token é UUID válido:', /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(token));
  
  // Busca a sessão específica usando o token como ID
  const { data, error } = await supabase
    .from("order_sessions")
    .select("id, expires_at, used, created_at, customer_id, estimated_order_number")
    .eq("id", token)
    .maybeSingle();
  
  console.log('📊 Resultado da consulta:', { 
    data, 
    error, 
    token,
    hasData: !!data,
    errorCode: error?.code,
    errorMessage: error?.message,
    queryUsed: `SELECT id, expires_at, used, created_at, customer_id FROM order_sessions WHERE id = '${token}'`
  });
  
  if (error) {
    console.error('Erro na consulta:', error);
    showErrorPage(
      "Erro de Acesso",
      `Erro na consulta: ${error.message}. Código: ${error.code || 'N/A'}`,
      "🚫"
    );
    throw error;
  }
  
  if (!data) {
    console.warn('⚠️ Nenhuma sessão encontrada para o token:', token);
    showErrorPage(
      "Sessão Não Encontrada",
      `Não foi possível encontrar sua sessão. Verifique se o link está correto ou solicite um novo link de acesso.`,
      "🚫"
    );
    throw new Error("Sessão não encontrada");
  }
  
  if (data.used) {
    showErrorPage(
      "Pedido Já Enviado",
      "Este link já foi utilizado para enviar um pedido. Cada link pode ser usado apenas uma vez por questões de segurança.",
      "✅"
    );
    throw new Error("Sessão já utilizada.");
  }
  
  if (new Date(data.expires_at) < new Date()) {
    showErrorPage(
      "Link Expirado",
      `Este link expirou em ${fmtDate(data.expires_at)}. Solicite um novo link de acesso para continuar com seu pedido.`,
      "⏰"
    );
    throw new Error("Sessão expirada.");
  }
  
  session = data;
  sessionInfo.textContent = `Expira em ${fmtDate(session.expires_at)}`;
  
  // Exibir número estimado do pedido se disponível
  if (session.estimated_order_number) {
    orderPreview.textContent = `Número estimado do pedido: #${session.estimated_order_number}`;
    orderPreview.style.display = 'block';
  } else {
    orderPreview.style.display = 'none';
  }
}

async function loadItems(){
  // 1) buscar itens da sessão atual
  console.log('🔍 Debug - Iniciando loadItems para session:', session.id);
  console.log('🔍 Debug - Schema configurado:', supabase.supabaseUrl, supabase.supabaseKey?.substring(0, 20) + '...');
  
  // Primeiro, vamos verificar se a tabela existe e tem dados
  const { data: allItems, error: allError } = await supabase
    .from("order_items")
    .select("*")
    .limit(5);
  
  console.log('🔍 Debug - Teste geral da tabela order_items:', { 
    allItems: allItems?.length || 0, 
    allError,
    sample: allItems?.[0] 
  });
  
  const { data: rawItems, error } = await supabase
    .from("order_items")
    .select("id, session_id, product_id, qty")
    .eq("session_id", session.id)
    .order("id");
     
  console.log('🔍 Debug - Query específica da sessão:', {
    sessionId: session.id,
    query: `SELECT id, session_id, product_id, qty FROM order_items WHERE session_id = '${session.id}' ORDER BY id`,
    rawItems: rawItems?.length || 0,
    error: error
  });
  
  if (error) throw error;

  console.log('🔍 Debug - Items encontrados:', rawItems?.length || 0);
  console.log('🔍 Debug - Session ID:', session.id);
  console.log('🔍 Debug - Raw items:', rawItems);

  const arr = rawItems || [];
  if (!arr.length){ items = []; return; }

  // 2) buscar produtos correspondentes
  const idStrs = Array.from(new Set(arr.map(it => String(it.product_id)).filter(Boolean)));
  console.log('🔍 Debug - Product IDs para buscar:', idStrs);
  
  const batches = chunk(idStrs, 200); // lote de 200 para evitar URLs longas
  let prods = [];

  for (const part of batches){
    // converter para números para a consulta
    const asNumbers = part.map(s => Number(s)).filter(n => Number.isFinite(n));
    console.log('🔍 Debug - Buscando produtos com IDs:', asNumbers);
    
    const { data, error: prodErr } = await supabase
      .from("produtos_atacamax")
      .select("codprodfilho, descricao, referencia, gtin, preco3, promo3, ativo")
      .in("codprodfilho", asNumbers);
    if (prodErr) throw prodErr;
    
    console.log('🔍 Debug - Produtos encontrados neste lote:', data?.length || 0);
    prods = prods.concat(data || []);
  }

  console.log('🔍 Debug - Total de produtos encontrados:', prods.length);

  // 3) index por string(codprodfilho)
  const byId = new Map(prods.map(p => [String(p.codprodfilho), p]));

  items = arr.map(it => {
    const p = byId.get(String(it.product_id)) || null;
    const unit_price = computeUnitPrice(p);
    console.log('🔍 Debug - Item mapeado:', { 
      id: it.id, 
      product_id: it.product_id, 
      qty: it.qty, 
      produto_encontrado: !!p,
      unit_price 
    });
    return { ...it, produto: p, unit_price };
  });

  const misses = items.filter(x => !x.produto).length;
  if (misses) {
    console.warn(`⚠️ Produtos não encontrados para ${misses}/${items.length} itens.`);
    console.warn('🔍 Itens sem produto:', items.filter(x => !x.produto));
  }
  
  console.log('🔍 Debug - Items finais:', items.length);
}

/* ---------- render ---------- */
function renderItems(){
  itemsList.innerHTML = "";
    if (!items.length){
    emptyHint.style.display = "block";
    updateTotalsBoth();                   // <<< garante total zerado quando não há itens
    return;
  }
  emptyHint.style.display = "none";

  // Ordenar itens por quantidade de forma decrescente
  const sortedItems = [...items].sort((a, b) => (b.qty || 0) - (a.qty || 0));

  sortedItems.forEach((it) => {
    const originalIdx = items.findIndex(item => item.id === it.id);
    const row = document.createElement("div");
    row.className = "item-row";

    const title = document.createElement("div");
    title.className = "item-title-wrap";
    const nome  = it.produto?.descricao ?? `#${it.product_id}`;
    const codigo = it.produto?.codprodfilho ?? it.product_id;
    
    const metaInfo = `Código: ${codigo}`;
    
    title.innerHTML = `
      <div class="item-title">${nome}</div>
      <div class="item-meta">${metaInfo}</div>
    `;

    const qty = document.createElement("input");
    qty.type = "number"; qty.min = "0"; qty.step = "0.01"; qty.value = String(it.qty ?? 0);
    qty.className = "qty-input";
    qty.addEventListener("input", () => {
      const v = parseFloat(qty.value || "0");
      items[originalIdx].qty = Number.isFinite(v) ? v : 0;
      // atualiza subtotal em tempo real
      const up = it.unit_price ?? null;
      subtotal.textContent = (up!=null) ? formatBRL((items[originalIdx].qty||0)*up) : "-";
      updateTotalsBoth();
      // Re-renderizar para manter a ordenação
      setTimeout(() => renderItems(), 100);
    });

    const price = document.createElement("div");
    price.className = "item-price";
    const up   = it.unit_price;
    price.textContent = (up != null) ? formatBRL(up) : "-";

    // NOVO: subtotal por item
    const subtotal = document.createElement("div");
    subtotal.className = "item-subtotal";
    subtotal.textContent = (up != null) ? formatBRL((it.qty||0)*up) : "-";

    const del = document.createElement("button");
    del.className = "btn-remove";
    del.innerHTML = "🗑️ Remover";
    del.addEventListener("click", () => {
      items.splice(originalIdx, 1);
      renderItems();
      updateTotalsBoth();            
    });

    row.append(title, price, qty, subtotal, del);
    itemsList.appendChild(row);
  });
  
  updateTotalsBoth();
}

/* ---------- event handlers ---------- */
function setupEventHandlers() {
  // Botões principais (na página)
  const mainSave = document.getElementById("main-save-btn");
  const mainSubmit = document.getElementById("main-submit-btn");
  
  // Botões da barra flutuante
  const footerSave = document.getElementById("footer-save-btn");
  const footerSubmit = document.getElementById("footer-submit-btn");
  
  // Handler para salvar
  const saveHandler = async () => {
    try { 
      await saveChanges(); 
      showAlert("✅ Alterações salvas com sucesso!"); 
      updateTotalsBoth(); 
    }
    catch(e){ 
      showAlert("❌ " + e.message); 
    }
  };
  
  // Conecta os handlers
  if (mainSave) mainSave.onclick = saveHandler;
  if (footerSave) footerSave.onclick = saveHandler;
  if (mainSubmit) mainSubmit.onclick = handleSubmit;
  if (footerSubmit) footerSubmit.onclick = handleSubmit;
  
  // Controla visibilidade das barras ao fazer scroll
  window.addEventListener('scroll', updateActionBarsVisibility);
  window.addEventListener('resize', updateActionBarsVisibility);
}



/* ---------- persist / submit ---------- */
async function saveChanges(){
  if (!session) return;
  
  // Add loading state
  document.body.classList.add('loading');
  
  await supabase.from("order_items").delete().eq("session_id", session.id);
  const payload = items
    .filter(it => (it.qty ?? 0) > 0)
    .map(it => ({ session_id: session.id, product_id: it.product_id, qty: it.qty }));
  if (payload.length){
    const { error } = await supabase.from("order_items").insert(payload);
    if (error) throw error;
  }
  
  // Remove loading state
  document.body.classList.remove('loading');
}
async function submitOrder(){
  console.log('🚀 Enviando pedido...');
  console.log('🔍 Session ID usado:', token);
  console.log('🔍 URL da função:', `${cfg.FUNCTIONS_BASE}/submit-order`);
  
  const res = await fetch(`${cfg.FUNCTIONS_BASE}/submit-order`, {
    method: "POST",
    headers: { 
      'Authorization': `Bearer ${cfg.SUPABASE_ANON}`,
      'apikey': cfg.SUPABASE_ANON,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      session_id: token
    })
  });
  
  console.log('🔍 Status da resposta:', res.status);
  console.log('🔍 Headers da resposta:', Object.fromEntries(res.headers.entries()));
  
  if (!res.ok) {
    const errorText = await res.text();
    console.error('❌ Erro na resposta:', errorText);
    throw new Error(`Falha ao enviar pedido: ${res.status} - ${errorText}`);
  }
  
  const result = await res.json();
  console.log('✅ Resposta da função:', result);
  
  // Armazenar número do pedido para exibir na página de sucesso
  if (result.data && result.data.order_number) {
    window.lastOrderNumber = result.data.order_number;
    console.log('📋 Número final do pedido:', window.lastOrderNumber);
  } else if (result.success && result.data) {
    console.log('⚠️ Resposta de sucesso mas sem order_number:', result.data);
  }
}

/* ---------- boot ---------- */
(async function init(){
  try{
    await loadSession();
    await loadItems();
    renderItems();
    setupEventHandlers();
    updateTotalsBoth();
    
    // Configura visibilidade inicial das barras
    updateActionBarsVisibility();

  } catch(e){
    // Se já não mostrou uma página de erro específica, mostra erro genérico
    if (!document.body.innerHTML.includes('min-height: 100vh')) {
      showErrorPage(
        "Erro Inesperado",
        "Ocorreu um problema ao carregar sua sessão. Tente novamente ou solicite um novo link de acesso.",
        "⚠️"
      );
    }
    console.error('Erro na inicialização:', e);
  }
})();