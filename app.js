import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cfg = window.APP_CONFIG || {};
const url = new URL(location.href);
const token = url.searchParams.get("token");
const schema = url.searchParams.get("schema") || "demo";

const alertBox    = document.getElementById("alert");
const itemsList   = document.getElementById("items-list");
const sessionInfo = document.getElementById("session-info");
const orderPreview = document.getElementById("order-preview");
const emptyHint   = document.getElementById("empty-hint");

function showAlert(msg){ alertBox.textContent = msg || ""; alertBox.style.display = msg ? "block":"none"; }
function fmtDate(s){ 
  try{ 
    return new Date(s).toLocaleString("pt-BR", { 
      timeZone: "America/Sao_Paulo",
      weekday: 'long',
      year: 'numeric',
      month: 'long', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }); 
  } catch { 
    return s; 
  } 
}

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

function showUsedSessionPage() {
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
        <div style="font-size: 64px; margin-bottom: 20px;">✅</div>
        <h1 style="
          font-size: 28px;
          font-weight: 700;
          margin: 0 0 16px;
          color: var(--success);
        ">Orçamento Já Aprovado</h1>
        <p style="
          font-size: 16px;
          line-height: 1.6;
          margin: 0 0 24px;
          color: var(--gray-600);
        ">
          Este orçamento já foi aprovado anteriormente e não pode mais ser editado.
        </p>
        <div id="approver-info-summary" style="
          background: var(--success-light);
          padding: 16px;
          border-radius: 8px;
          border-left: 4px solid var(--success);
          margin-bottom: 24px;
          text-align: left;
        ">
          <p style="
            margin: 0 0 8px;
            font-size: 14px;
            color: var(--success);
            font-weight: 600;
          ">
            👤 Aprovado por:
          </p>
          <div id="approver-details" style="font-size: 13px; color: var(--gray-600);">
            Carregando dados do aprovador...
          </div>
        </div>
        <div style="
          background: var(--primary-light);
          padding: 16px;
          border-radius: 8px;
          border-left: 4px solid var(--primary);
          margin-bottom: 24px;
        ">
          <p style="
            margin: 0;
            font-size: 14px;
            color: var(--primary);
            font-weight: 600;
          ">
            💡 Você pode visualizar os detalhes do orçamento abaixo
          </p>
        </div>
        <button onclick="window.showReadonlyOrder()" style="
          background: var(--primary);
          color: white;
          border: none;
          padding: 12px 24px;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
          margin-bottom: 16px;
          transition: all 0.2s ease;
        " onmouseover="this.style.background='var(--primary-hover)'" onmouseout="this.style.background='var(--primary)'">
          👁️ Ver Orçamento (Somente Leitura)
        </button>
        <br>
        <small style="
          color: var(--gray-500);
          font-size: 13px;
        ">
          Entre em contato conosco se precisar fazer alterações.
        </small>
      </div>
    </div>
  `;
  
  // Carregar dados do aprovador
  loadApproverData();
}

window.showReadonlyOrder = async function() {
  try {
    // Recarregar os dados para visualização
    // Primeiro carregar dados do cliente se não estiverem disponíveis
    if (!customerData && session && session.customer_id) {
      const { data: customer, error: customerError } = await currentSupabase
        .from("clientes_atacamax")
        .select("codpessoa, nome, cpfcgc, nomefantazia, logradouro, numero, bairro, cidade, uf, cep")
        .eq("codpessoa", session.customer_id)
        .single();
      
      if (!customerError && customer) {
        customerData = customer;
      }
    }
    
    await loadItems();
    
    // Carregar dados do aprovador
    let approverInfo = '';
    try {
      const { data: submittedOrder, error } = await currentSupabase
        .from('orders_submitted')
        .select('payload')
        .eq('session_id', session.id)
        .single();
      
      if (!error && submittedOrder?.payload?.approver) {
        const approver = submittedOrder.payload.approver;
        approverInfo = `
          <div style="
            background: rgba(255, 255, 255, 0.1);
            padding: 12px;
            border-radius: 8px;
            margin-top: 16px;
            border: 1px solid rgba(255, 255, 255, 0.2);
          ">
            <p style="margin: 0 0 8px; font-size: 14px; font-weight: 600;">
              👤 Aprovado por:
            </p>
            <div style="font-size: 13px; opacity: 0.9;">
              <div><strong>Nome:</strong> ${approver.name}</div>
              <div><strong>Telefone:</strong> ${approver.phone}</div>
              <div><strong>E-mail:</strong> ${approver.email}</div>
            </div>
          </div>
        `;
      }
    } catch (e) {
      console.error('Erro ao carregar dados do aprovador:', e);
    }
    
    // Renderizar a interface em modo somente leitura
    document.body.innerHTML = `
      <header>
        <h1>📋 Orçamento Aprovado ${session.estimated_order_number ? `#${session.estimated_order_number}` : ''}</h1>
        <div id="customer-info" style="margin: 16px 0;"></div>
        <p id="session-info">Orçamento aprovado em ${fmtDate(session.created_at)}</p>
        ${approverInfo}
        <div style="
          background: rgba(255, 255, 255, 0.1);
          padding: 12px;
          border-radius: 8px;
          margin-top: 16px;
          border: 1px solid rgba(255, 255, 255, 0.2);
        ">
          <p style="margin: 0; font-size: 14px; font-weight: 600;">
            🔒 Visualização Somente Leitura
          </p>
        </div>
      </header>

      <main>
        <section id="items-section" class="card">
          <div class="card-header">
            <h2>🛒 Itens do Orçamento</h2>
          </div>
          <div id="items-list"></div>
        </section>
        
        <div class="actions">
          <span>💰 Total: <strong id="order-total">R$ 0,00</strong></span>
          <div style="display: flex; gap: 12px;">
            <button onclick="window.showUsedSessionPage()" type="button" style="
              background: var(--gray-100);
              color: var(--gray-700);
              border: 1px solid var(--gray-200);
              height: 48px;
              padding: 0 24px;
              border-radius: 8px;
              font-weight: 600;
              cursor: pointer;
            ">← Voltar</button>
          </div>
        </div>
      </main>

      <footer>
        <small>🔒 Orçamento já aprovado - Visualização somente leitura</small>
      </footer>
    `;
    
    // Atualizar informações do cliente
    updateCustomerHeader();
    
    // Aguardar um pouco para garantir que o DOM foi atualizado
    setTimeout(() => {
      // Verificar se o elemento existe antes de renderizar
      const itemsListElement = document.getElementById('items-list');      
      if (itemsListElement) {
        renderItemsReadonly();
      } else {
        console.error('❌ Elemento items-list não encontrado no DOM');
      }
    }, 100);
    
  } catch (error) {
    console.error('Erro ao carregar visualização:', error);
    alert('Erro ao carregar os dados do orçamento: ' + error.message);
  }
}

// Tornar showUsedSessionPage disponível globalmente também
window.showUsedSessionPage = showUsedSessionPage;

// Função para carregar dados do aprovador
async function loadApproverData() {
  try {
    if (!session || !session.id) return;
    
    const { data: submittedOrder, error } = await currentSupabase
      .from('orders_submitted')
      .select('payload')
      .eq('session_id', session.id)
      .single();
    
    if (error || !submittedOrder) {
      console.log('Dados do aprovador não encontrados:', error);
      return;
    }
    
    const approver = submittedOrder.payload?.approver;
    const approverDetailsDiv = document.getElementById('approver-details');
    
    if (approver && approverDetailsDiv) {
      approverDetailsDiv.innerHTML = `
        <div style="margin-bottom: 4px;"><strong>Nome:</strong> ${approver.name}</div>
        <div style="margin-bottom: 4px;"><strong>Telefone:</strong> ${approver.phone}</div>
        <div><strong>E-mail:</strong> ${approver.email}</div>
      `;
    } else if (approverDetailsDiv) {
      approverDetailsDiv.innerHTML = '<em>Dados do aprovador não disponíveis</em>';
    }
    
  } catch (error) {
    console.error('Erro ao carregar dados do aprovador:', error);
    const approverDetailsDiv = document.getElementById('approver-details');
    if (approverDetailsDiv) {
      approverDetailsDiv.innerHTML = '<em>Erro ao carregar dados do aprovador</em>';
    }
  }
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
  db: { schema: schema }
});

let session = null;
let customerData = null;
let items   = [];
let currentSupabase = supabase; // Cliente Supabase atual

// Estado do modal de busca
let searchResults = [];
let isSearching = false;
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

/* ---------- event handlers ---------- */
// Funções do modal de busca de produtos
function showProductSearchModal() {
  const modal = document.getElementById('product-search-modal');
  const searchInput = document.getElementById('product-search-input');
  const searchResults = document.getElementById('search-results');
  
  if (modal) {
    modal.style.display = 'flex';
    searchResults.innerHTML = '';
    if (searchInput) {
      searchInput.value = '';
      searchInput.focus();
    }
  }
}

function hideProductSearchModal() {
  const modal = document.getElementById('product-search-modal');
  if (modal) {
    modal.style.display = 'none';
  }
}

// Funções do modal de aprovador
let approverData = null;

function showApproverModal() {
  const modal = document.getElementById('approver-modal');
  const nameInput = document.getElementById('approver-name');
  
  if (modal) {
    modal.style.display = 'flex';
    if (nameInput) {
      nameInput.focus();
    }
  }
}

function hideApproverModal() {
  const modal = document.getElementById('approver-modal');
  if (modal) {
    modal.style.display = 'none';
  }
}

async function processApproval() {
  try {
    setSubmitting(true);
    await saveChanges();
    
    // Coletar dados de conexão para auditoria
    const connectionData = await collectConnectionData();
    
    // Enviar com dados do aprovador e conexão
    await submitOrderWithApprover(approverData, connectionData);
    showSuccessPage();
  } catch(e) {
    showAlert(e.message || String(e));
  } finally {
    setSubmitting(false);
  }
}

async function collectConnectionData() {
  const data = {
    timestamp: new Date().toISOString(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    language: navigator.language,
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    screen: {
      width: screen.width,
      height: screen.height,
      colorDepth: screen.colorDepth,
      pixelDepth: screen.pixelDepth
    },
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight
    },
    url: window.location.href,
    referrer: document.referrer || 'Direct access'
  };
  
  // Adicionar informações de conexão se disponível
  if ('connection' in navigator) {
    data.connection = {
      effectiveType: navigator.connection.effectiveType,
      downlink: navigator.connection.downlink,
      rtt: navigator.connection.rtt
    };
  }
  
  return data;
}

async function submitOrderWithApprover(approverData, connectionData) {
  try {
    const response = await fetch(`${cfg.FUNCTIONS_BASE}/submit-order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${cfg.SUPABASE_ANON}`
      },
      body: JSON.stringify({
        session_id: session.id,
        schema: schema,
        approver: approverData,
        connection_data: connectionData
      })
    });
    
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.message || 'Erro ao aprovar orçamento');
    }
    
    // Armazenar número do orçamento para mostrar na página de sucesso
    window.lastOrderNumber = result.data?.order_number;
    
    console.log('✅ Orçamento aprovado com sucesso:', result);
    
  } catch (error) {
    console.error('Erro ao aprovar orçamento:', error);
    throw error;
  }
}

async function handleProductSearch() {
  const searchInput = document.getElementById('product-search-input');
  const searchResults = document.getElementById('search-results');
  const searchLoading = document.getElementById('search-loading');
  
  if (!searchInput || !searchResults || !searchLoading) return;
  
  const query = searchInput.value.trim();
  
  if (query.length < 2) {
    searchResults.innerHTML = '<div class="search-empty"><div class="search-empty-icon">🔍</div><p>Digite pelo menos 2 caracteres para buscar</p></div>';
    return;
  }
  
  if (isSearching) return;
  
  try {
    isSearching = true;
    searchLoading.style.display = 'block';
    searchResults.innerHTML = '';
    
    // Verificar se a query é numérica para buscar por código
    const isNumeric = /^\d+$/.test(query);
    
    let products, error;
    
    if (isNumeric) {
      // Buscar por código E por nome
      const { data, error: searchError } = await currentSupabase
        .from('produtos_atacamax')
        .select('codprodfilho, descricao, referencia, gtin, preco3, promo3, ativo, grupo, subgrupo, estoque')
        .or(`descricao.ilike.%${query}%,codprodfilho.eq.${parseInt(query)}`)
        .eq('ativo', 'S')
        .neq('grupo', 'INATIVO')
        .neq('grupo', 'CONSUMO INTERNO')
        .neq('subgrupo', 'INATIVO')
        .gte('estoque', 1)
        .gt('preco3', 0)
        .limit(20);
      
      products = data;
      error = searchError;
    } else {
      // Buscar apenas por nome (texto)
      const { data, error: searchError } = await currentSupabase
        .from('produtos_atacamax')
        .select('codprodfilho, descricao, referencia, gtin, preco3, promo3, ativo, grupo, subgrupo, estoque')
        .ilike('descricao', `%${query}%`)
        .eq('ativo', 'S')
        .neq('grupo', 'INATIVO')
        .neq('grupo', 'CONSUMO INTERNO')
        .neq('subgrupo', 'INATIVO')
        .gte('estoque', 1)
        .gt('preco3', 0)
        .limit(20);
      
      products = data;
      error = searchError;
    }
    
    if (error) throw error;
    
    searchLoading.style.display = 'none';
    
    if (!products || products.length === 0) {
      searchResults.innerHTML = '<div class="search-empty"><div class="search-empty-icon">📦</div><p>Nenhum produto encontrado</p><small>Tente buscar por outro termo</small></div>';
      return;
    }
    
    // Renderizar resultados
    const html = products.map(product => {
      const unitPrice = computeUnitPrice(product) || 0;
      
      // Verificar se há promoção
      const basePrice = toDecimal(product.preco3) || 0;
      const promoPrice = toDecimal(product.promo3) || 0;
      const hasPromotion = promoPrice > 0 && promoPrice < basePrice;
      
      const