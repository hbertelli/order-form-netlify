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
  
  // Carregar dados do aprovador após um pequeno delay para garantir que o DOM foi renderizado
  setTimeout(() => {
    loadApproverData();
  }, 100);
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
    if (!session || !session.id) {
      console.log('⚠️ Session não disponível para carregar dados do aprovador');
      return;
    }
    
    console.log('🔍 Carregando dados do aprovador para session:', session.id);
    
    const { data: submittedOrder, error } = await currentSupabase
      .from('orders_submitted')
      .select('payload')
      .eq('session_id', session.id)
      .single();
    
    console.log('🔍 Resultado da consulta do aprovador:', { submittedOrder, error });
    
    if (error || !submittedOrder) {
      console.log('Dados do aprovador não encontrados:', error);
      const approverDetailsDiv = document.getElementById('approver-details');
      if (approverDetailsDiv) {
        approverDetailsDiv.innerHTML = '<em>Dados do aprovador não disponíveis</em>';
      }
      return;
    }
    
    const approver = submittedOrder.payload?.approver;
    console.log('🔍 Dados do aprovador encontrados:', approver);
    
    const approverDetailsDiv = document.getElementById('approver-details');
    
    if (approver && approverDetailsDiv) {
      approverDetailsDiv.innerHTML = `
        <div style="margin-bottom: 4px;"><strong>Nome:</strong> ${approver.name}</div>
        <div style="margin-bottom: 4px;"><strong>Telefone:</strong> ${approver.phone}</div>
        <div><strong>E-mail:</strong> ${approver.email}</div>
      `;
      console.log('✅ Dados do aprovador inseridos no DOM');
    } else if (approverDetailsDiv) {
      approverDetailsDiv.innerHTML = '<em>Dados do aprovador não disponíveis</em>';
      console.log('⚠️ Aprovador não encontrado ou elemento DOM não existe');
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
      
      const priceHtml = hasPromotion ? `
        <div class="product-price promotion">
          <div class="original-price">R$ ${basePrice.toFixed(2).replace('.', ',')}</div>
          <div class="promo-price">R$ ${promoPrice.toFixed(2).replace('.', ',')}</div>
        </div>
      ` : `
        <div class="product-price">R$ ${unitPrice.toFixed(2).replace('.', ',')}</div>
      `;
      
      const nameWithBadge = hasPromotion ? 
        `${product.descricao} <span class="promo-badge">Promoção</span>` : 
        product.descricao;
      
      return `
        <div class="item-row" data-product-id="${product.codprodfilho}">
          <div class="product-info">
            <div class="product-name">${nameWithBadge}</div>
            <div class="product-code">Código: ${product.codprodfilho}</div>
          </div>
          ${priceHtml}
          <div class="product-actions">
            <div class="qty-selector">
              <label>Qtd:</label>
              <input type="number" min="1" value="1" class="qty-input-modal" data-product-id="${product.codprodfilho}">
            </div>
            <button class="btn-add-to-order" data-product-id="${product.codprodfilho}">
              ✚ Adicionar
            </button>
          </div>
        </div>
      `;
    }).join('');
    
    searchResults.innerHTML = html;
    
    // Adicionar event listeners para os botões
    searchResults.querySelectorAll('.btn-add-to-order').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const productId = e.target.dataset.productId;
        const qtyInput = searchResults.querySelector(`.qty-input-modal[data-product-id="${productId}"]`);
        const qty = parseInt(qtyInput.value) || 1;
        
        try {
          e.target.disabled = true;
          e.target.textContent = 'Adicionando...';
          
          await addProductToOrder(productId, qty);
          
          // Fechar modal após adicionar
          hideProductSearchModal();
          
        } catch (error) {
          console.error('Erro ao adicionar produto:', error);
          showAlert('Erro ao adicionar produto: ' + error.message);
        } finally {
          e.target.disabled = false;
          e.target.textContent = '✚ Adicionar';
        }
      });
    });
    
  } catch (error) {
    console.error('Erro na busca:', error);
    searchLoading.style.display = 'none';
    searchResults.innerHTML = '<div class="search-empty"><div class="search-empty-icon">❌</div><p>Erro na busca</p><small>' + error.message + '</small></div>';
  } finally {
    isSearching = false;
  }
}

async function addProductToOrder(productId, qty = 1) {
  try {
    // Buscar dados atuais do produto para capturar preços
    const { data: product, error: productError } = await currentSupabase
      .from('produtos_atacamax')
      .select('codprodfilho, descricao, preco3, promo3')
      .eq('codprodfilho', productId)
      .single();
    
    if (productError || !product) {
      throw new Error('Produto não encontrado');
    }
    
    // Calcular preços no momento da adição
    const originalPrice = toDecimal(product.preco3) || 0;
    const promoPrice = toDecimal(product.promo3) || 0;
    const unitPrice = (promoPrice > 0 && promoPrice < originalPrice) ? promoPrice : originalPrice;
    
    // Verificar se o produto já existe no pedido
    const existingItemIndex = items.findIndex(item => item.product_id === productId);
    
    if (existingItemIndex >= 0) {
      // Produto já existe, apenas aumentar quantidade
      const newQty = (items[existingItemIndex].qty || 0) + qty;
      await updateItemQty(items[existingItemIndex].id, newQty);
    } else {
      // Produto novo, adicionar à lista
      const { data: newItem, error: insertError } = await currentSupabase
        .from('order_items')
        .insert({
          session_id: session.id,
          product_id: productId,
          qty: qty,
          unit_price: unitPrice,
          promo_price: promoPrice > 0 ? promoPrice : null,
          original_price: originalPrice
        })
        .select('id, session_id, product_id, qty, unit_price, promo_price, original_price')
        .single();
      
      if (insertError) {
        throw new Error('Erro ao adicionar produto: ' + insertError.message);
      }
      
      // Adicionar à lista local
      items.push({
        id: newItem.id,
        session_id: newItem.session_id,
        product_id: newItem.product_id,
        qty: newItem.qty,
        unit_price: newItem.unit_price,
        promo_price: newItem.promo_price,
        original_price: newItem.original_price,
        descricao: product.descricao
      });
    }
    
    // Atualizar interface
    renderItems();
    updateTotalsBoth();
    
    console.log('✅ Produto adicionado:', { productId, qty, unitPrice, originalPrice, promoPrice });
    
  } catch (error) {
    console.error('Erro ao adicionar produto:', error);
    throw error;
  }
}

// Função para atualizar quantidade de um item
async function updateItemQty(itemId, newQty) {
  try {
    const { error } = await currentSupabase
      .from('order_items')
      .update({ qty: newQty })
      .eq('id', itemId);
    
    if (error) throw error;
    
    // Atualizar localmente
    const item = items.find(it => it.id === itemId);
    if (item) {
      item.qty = newQty;
    }
    
    renderItems();
    updateTotalsBoth();
    
  } catch (error) {
    console.error('Erro ao atualizar quantidade:', error);
    showAlert('Erro ao atualizar quantidade: ' + error.message);
  }
}

// Função wrapper para remover item com confirmação
async function handleRemoveItem(itemId) {
  try {
    const item = items.find(it => it.id === itemId);
    const productName = item ? item.descricao : 'este produto';
    
    if (confirm(\`Tem certeza que deseja remover "${productName}\" do orçamento?`)) {
      await removeItem(itemId);
    }
  } catch (error) {
    console.error('Erro ao remover item:', error);
    showAlert('Erro ao remover item: ' + error.message);
  }
}

async function removeItem(itemId) {
  try {
    const { error } = await currentSupabase
      .from('order_items')
      .delete()
      .eq('id', itemId);
    
    if (error) throw error;
    
    // Remover da lista local
    items = items.filter(it => it.id !== itemId);
    
    renderItems();
    updateTotalsBoth();
    
    console.log('✅ Item removido:', itemId);
    
  } catch (error) {
    console.error('Erro ao remover item:', error);
    throw error; // Re-throw para ser tratado pelo handleRemoveItem
  }
}

async function saveChanges() {
  try {
    showAlert(''); // Limpar alertas anteriores
    console.log('💾 Salvando alterações...');
    
    // Validar se há itens no orçamento
    if (!items || items.length === 0) {
      showAlert('Adicione pelo menos um item ao orçamento antes de salvar.');
      return;
    }
    
    // Mostrar feedback visual
    const saveBtns = [
      document.getElementById('main-save-btn'),
      document.getElementById('footer-save-btn')
    ];
    
    saveBtns.forEach(btn => {
      if (btn) {
        btn.disabled = true;
        btn.textContent = btn.textContent.replace('💾', '⏳').replace('Salvar', 'Salvando...');
      }
    });
    
    // Simular um pequeno delay para feedback visual
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Restaurar botões
    saveBtns.forEach(btn => {
      if (btn) {
        btn.disabled = false;
        btn.textContent = btn.textContent.replace('⏳', '💾').replace('Salvando...', 'Salvar');
      }
    });
    
    showAlert(''); // Limpar alertas
    console.log('✅ Alterações salvas automaticamente');
    
    // Mostrar mensagem de sucesso temporária
    const tempAlert = document.createElement('div');
    tempAlert.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: var(--success);
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      font-weight: 600;
      z-index: 3000;
      box-shadow: var(--shadow-lg);
    `;
    tempAlert.textContent = '✅ Alterações salvas com sucesso!';
    document.body.appendChild(tempAlert);
    
    setTimeout(() => {
      if (tempAlert.parentNode) {
        tempAlert.parentNode.removeChild(tempAlert);
      }
    }, 2000);
    
  } catch (error) {
    console.error('Erro ao salvar:', error);
    showAlert('Erro ao salvar alterações: ' + error.message);
    throw error;
  }
}

let isSubmitting = false;

function setSubmitting(state) {
  isSubmitting = state;
  
  // Desabilitar/habilitar botões de submit
  const submitButtons = [
    document.getElementById('main-submit-btn'),
    document.getElementById('footer-submit-btn')
  ];
  
  submitButtons.forEach(btn => {
    if (btn) {
      btn.disabled = state;
      if (state) {
        btn.textContent = btn.textContent.replace('✅', '⏳').replace('Aprovar', 'Aprovando...');
      } else {
        btn.textContent = btn.textContent.replace('⏳', '✅').replace('Aprovando...', 'Aprovar');
      }
    }
  });
}

async function submitOrder() {
  if (isSubmitting) return;
  
  if (!items || items.length === 0) {
    showAlert('Adicione pelo menos um item ao orçamento antes de aprovar.');
    return;
  }
  
  // Mostrar modal para coletar dados do aprovador
  showApproverModal();
}

function showSuccessPage() {
  const orderNumber = window.lastOrderNumber || session?.estimated_order_number || 'N/A';
  
  document.body.innerHTML = `
    <div style="
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, var(--success-light) 0%, #ffffff 100%);
      padding: 20px;
    ">
      <div style="
        max-width: 500px;
        background: white;
        padding: 40px;
        border-radius: 16px;
        box-shadow: var(--shadow-lg);
        text-align: center;
        border: 1px solid var(--success);
      ">
        <div style="font-size: 64px; margin-bottom: 20px;">🎉</div>
        <h1 style="
          font-size: 28px;
          font-weight: 700;
          margin: 0 0 16px;
          color: var(--success);
        ">Orçamento Aprovado!</h1>
        <p style="
          font-size: 18px;
          font-weight: 600;
          margin: 0 0 8px;
          color: var(--gray-800);
        ">Pedido #${orderNumber}</p>
        <p style="
          font-size: 16px;
          line-height: 1.6;
          margin: 0 0 24px;
          color: var(--gray-600);
        ">
          Seu orçamento foi aprovado com sucesso e nossa equipe foi notificada. 
          Em breve entraremos em contato para finalizar o pedido.
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
            ✅ Confirmação enviada por e-mail
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

/* ---------- customer info ---------- */
function formatAddress(customer) {
  if (!customer) return '';
  
  const parts = [];
  
  // Logradouro e número
  if (customer.logradouro) {
    let address = customer.logradouro;
    // Capitalizar primeira letra de cada palavra
    address = address.toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
    
    if (customer.numero) {
      address += `, ${customer.numero}`;
    }
    parts.push(address);
  }
  
  // Bairro
  if (customer.bairro) {
    let bairro = customer.bairro.toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
    parts.push(bairro);
  }
  
  // Cidade e UF
  if (customer.cidade || customer.uf) {
    let cityState = '';
    if (customer.cidade) {
      cityState = customer.cidade.toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
    }
    if (customer.uf) {
      cityState += cityState ? `, ${customer.uf.toUpperCase()}` : customer.uf.toUpperCase();
    }
    parts.push(cityState);
  }
  
  // CEP
  if (customer.cep) {
    parts.push(customer.cep);
  }
  
  return parts.join(', ');
}

function updateCustomerHeader() {
  const customerInfoDiv = document.getElementById('customer-info');
  
  console.log('🔍 Debug - Elemento customer-info encontrado:', customerInfoDiv);
  console.log('🔍 Debug - customerInfoDiv.style.display antes:', customerInfoDiv?.style.display);
  
  if (!customerInfoDiv) {
    console.error('❌ Elemento customer-info não encontrado no DOM');
    return;
  }
  
  if (!customerData) {
    console.log('⚠️ customerData não disponível');
    customerInfoDiv.style.display = 'none';
    return;
  }
  
  // Garantir que o elemento seja exibido
  customerInfoDiv.style.display = 'block';
  
  // Formatar nome fantasia ou razão social
  const displayName = customerData.nomefantazia || customerData.nome || 'Cliente';
  const razaoSocial = customerData.nome !== customerData.nomefantazia ? customerData.nome : null;
  
  // Formatar CNPJ
  const cnpj = customerData.cpfcgc || '';
  
  // Formatar endereço
  const endereco = formatAddress(customerData);
  console.log('🔍 Debug - Endereço formatado:', endereco);
  
  const customerHtml = `
    <div class="customer-header">
      <div class="customer-main">
        <div class="customer-code">Cliente ${customerData.codpessoa}</div>
        <div class="customer-name">${displayName}</div>
        ${razaoSocial ? `<div class="customer-razao">${razaoSocial}</div>` : ''}
      </div>
      <div class="customer-details">
        <div class="customer-cnpj">CNPJ: ${cnpj}</div>
        ${endereco ? `<div class="customer-address">${endereco}</div>` : ''}
      </div>
    </div>
  `;
  
  customerInfoDiv.innerHTML = customerHtml;
  
  console.log('✅ Debug - HTML do cliente inserido no DOM');
  console.log('🔍 Debug - customerInfoDiv.innerHTML após inserção:', customerInfoDiv.innerHTML);
}

/* ---------- render functions ---------- */
function renderItems() {
  if (!itemsList) return;
  
  if (!items || items.length === 0) {
    itemsList.innerHTML = '';
    if (emptyHint) emptyHint.style.display = 'block';
    return;
  }
  
  if (emptyHint) emptyHint.style.display = 'none';
  
  const html = items.map(item => {
    // Usar preços salvos da order_items, com fallback para produtos_atacamax
    const unitPrice = item.unit_price || 0;
    const originalPrice = item.original_price || 0;
    const promoPrice = item.promo_price || 0;
    
    const hasPromotion = promoPrice > 0 && promoPrice < originalPrice;
    const subtotal = unitPrice * (item.qty || 0);
    
    const priceHtml = hasPromotion ? `
      <div class="item-price promotion">
        <div class="original-price">R$ ${originalPrice.toFixed(2).replace('.', ',')}</div>
        <div class="promo-price">R$ ${promoPrice.toFixed(2).replace('.', ',')}</div>
      </div>
    ` : `
      <div class="item-price">R$ ${unitPrice.toFixed(2).replace('.', ',')}</div>
    `;
    
    const nameWithBadge = hasPromotion ? 
      \`${item.descricao} <span class="promo-badge">Promoção</span>` : 
      item.descricao;
    
    return `
      <div class="item-row" data-item-id="${item.id}">
        <div class="item-title-wrap">
          <div class="item-title">${nameWithBadge}</div>
          <div class="item-meta">Código: ${item.product_id}</div>
        </div>
        ${priceHtml}
        <input 
          type="number" 
          min="1" 
          value="${item.qty || 1}" 
          class="qty-input" 
          data-item-id="${item.id}"
          onchange="handleQtyChange('${item.id}', this.value)"
        >
        <div class="item-subtotal">R$ ${subtotal.toFixed(2).replace('.', ',')}</div>
        <button 
          class="btn-remove" 
          onclick="handleRemoveItem('${item.id}')"
        >🗑️ Remover</button>
      </div>
    `;
  }).join('');
  
  itemsList.innerHTML = html;
}

function renderItemsReadonly() {
  const itemsListElement = document.getElementById('items-list');
  if (!itemsListElement) {
    console.error('❌ Elemento items-list não encontrado para renderização readonly');
    return;
  }
  
  if (!items || items.length === 0) {
    itemsListElement.innerHTML = '<div class="empty"><div style="font-size: 48px; margin-bottom: 16px;">📦</div><p>Nenhum item encontrado</p></div>';
    return;
  }
  
  const html = items.map(item => {
    // Usar preços salvos da order_items
    const unitPrice = item.unit_price || 0;
    const originalPrice = item.original_price || 0;
    const promoPrice = item.promo_price || 0;
    
    const hasPromotion = promoPrice > 0 && promoPrice < originalPrice;
    const subtotal = unitPrice * (item.qty || 0);
    
    const priceHtml = hasPromotion ? `
      <div class="item-price promotion">
        <div class="original-price">R$ ${originalPrice.toFixed(2).replace('.', ',')}</div>
        <div class="promo-price">R$ ${promoPrice.toFixed(2).replace('.', ',')}</div>
      </div>
    ` : `
      <div class="item-price">R$ ${unitPrice.toFixed(2).replace('.', ',')}</div>
    `;
    
    const nameWithBadge = hasPromotion ? 
      `${item.descricao} <span class="promo-badge">Promoção</span>` : 
      item.descricao;
    
    return `
      <div class="item-row readonly">
        <div class="item-title-wrap">
          <div class="item-title">${nameWithBadge}</div>
          <div class="item-meta">Código: ${item.product_id}</div>
        </div>
        <div class="qty-display">${item.qty || 1}</div>
        ${priceHtml}
        <div class="item-subtotal">R$ ${subtotal.toFixed(2).replace('.', ',')}</div>
      </div>
    `;
  }).join('');
  
  itemsListElement.innerHTML = html;
  updateTotalsBoth();
}

/* ---------- data loading ---------- */
async function loadSession() {
  try {
    console.log('🔍 Tentando carregar sessão com token:', token);
    
    const { data: sessionData, error: sessionError } = await supabase
      .from('order_sessions')
      .select('id, customer_id, expires_at, used, created_at, estimated_order_number, schema, view_name')
      .eq('id', token)
      .single();

    if (sessionError || !sessionData) {
      console.error('❌ Sessão não encontrada:', sessionError);
      showErrorPage(
        "Sessão Inválida", 
        "Este link de orçamento não é válido ou expirou. Verifique se você copiou o link completo ou solicite um novo link.",
        "🔗"
      );
      return null;
    }

    // Verificar se a sessão expirou
    if (new Date(sessionData.expires_at) < new Date()) {
      showErrorPage(
        "Link Expirado", 
        "Este link de orçamento expirou. Links de orçamento são válidos por 48 horas após a criação.",
        "⏰"
      );
      return null;
    }

    // Verificar se a sessão já foi usada (orçamento aprovado)
    if (sessionData.used) {
      showUsedSessionPage();
      return sessionData; // Retorna para permitir visualização readonly
    }

    console.log('✅ Sessão carregada:', sessionData);
    return sessionData;

  } catch (error) {
    console.error('❌ Erro ao carregar sessão:', error);
    showErrorPage(
      "Erro de Conexão", 
      "Não foi possível conectar ao servidor. Verifique sua conexão com a internet e tente novamente.",
      "🌐"
    );
    return null;
  }
}

async function loadCustomer(customerId) {
  try {
    console.log('🔍 Debug - Buscando cliente com ID:', customerId);
    
    const { data: customer, error: customerError } = await currentSupabase
      .from("clientes_atacamax")
      .select("codpessoa, nome, cpfcgc, nomefantazia, logradouro, numero, bairro, cidade, uf, cep")
      .eq("codpessoa", customerId)
      .single();
    
    console.log('🔍 Debug - Resultado da consulta do cliente:', { customer, customerError });
    
    if (customerError || !customer) {
      console.error('❌ Cliente não encontrado:', customerError);
      showErrorPage(
        "Cliente Não Encontrado", 
        "Os dados do cliente não foram encontrados no sistema. Entre em contato conosco para resolver este problema.",
        "👤"
      );
      return null;
    }

    console.log('🔍 Debug - customerData definido:', customer);
    return customer;

  } catch (error) {
    console.error('❌ Erro ao carregar cliente:', error);
    showErrorPage(
      "Erro ao Carregar Cliente", 
      "Ocorreu um erro ao carregar os dados do cliente. Tente novamente em alguns instantes.",
      "❌"
    );
    return null;
  }
}

async function loadItems() {
  try {
    console.log('🔍 Debug - Iniciando loadItems para session:', session.id);
    
    // Debug: testar se a tabela order_items existe e tem dados
    const { data: allItems, error: allError } = await currentSupabase
      .from('order_items')
      .select('*')
      .limit(5);
    
    console.log('🔍 Debug - Teste geral da tabela order_items:', { allItems: allItems?.length, allError, sample: allItems?.[0] });
    
    // Buscar itens da sessão com preços salvos
    const { data: rawItems, error: itemsError } = await currentSupabase
      .from('order_items')
      .select('id, session_id, product_id, qty, unit_price, promo_price, original_price')
      .eq('session_id', session.id);

    if (itemsError) {
      console.error('❌ Erro ao carregar itens:', itemsError);
      showAlert('Erro ao carregar itens do orçamento: ' + itemsError.message);
      return;
    }

    console.log('🔍 Debug - Items encontrados:', rawItems?.length || 0);
    console.log('🔍 Debug - Session ID:', session.id);
    console.log('🔍 Debug - Raw items:', rawItems);

    if (!rawItems || rawItems.length === 0) {
      items = [];
      renderItems();
      updateTotalsBoth();
      return;
    }

    // Buscar descrições dos produtos
    const productIds = rawItems.map(item => item.product_id);
    console.log('🔍 Debug - Product IDs para buscar:', productIds);
    
    // Converter para números para a query
    const numericProductIds = productIds.map(id => parseInt(id)).filter(id => !isNaN(id));
    console.log('🔍 Debug - Buscando produtos com IDs:', numericProductIds);
    
    const { data: products, error: productsError } = await currentSupabase
      .from('produtos_atacamax')
      .select('codprodfilho, descricao, preco3, promo3')
      .in('codprodfilho', numericProductIds);

    console.log('🔍 Debug - Query produtos:', { 
      schema: schema, 
      productIds: numericProductIds, 
      found: products?.length || 0, 
      error: productsError 
    });

    if (productsError) {
      console.error('❌ Erro ao carregar produtos:', productsError);
      showAlert('Erro ao carregar dados dos produtos: ' + productsError.message);
      return;
    }

    console.log('🔍 Debug - Produtos encontrados neste lote:', products?.length || 0);

    // Criar mapa de produtos por ID
    const productsMap = new Map();
    if (products) {
      products.forEach(p => {
        productsMap.set(String(p.codprodfilho), p);
      });
    }

    console.log('🔍 Debug - Total de produtos encontrados:', productsMap.size);

    // Combinar dados dos itens com descrições dos produtos
    items = rawItems.map(item => {
      const product = productsMap.get(String(item.product_id));
      
      return {
        id: item.id,
        session_id: item.session_id,
        product_id: item.product_id,
        qty: item.qty || 1,
        // Usar preços salvos da order_items, com fallback para produtos_atacamax
        unit_price: item.unit_price || (product ? computeUnitPrice(product) : 0),
        promo_price: item.promo_price || (product ? toDecimal(product.promo3) : 0),
        original_price: item.original_price || (product ? toDecimal(product.preco3) : 0),
        descricao: product?.descricao || `Produto ${item.product_id}`
      };
    });

    renderItems();
    updateTotalsBoth();

    console.log('✅ Items carregados com sucesso:', items.length);

  } catch (error) {
    console.error('❌ Erro ao carregar itens:', error);
    showAlert('Erro inesperado ao carregar itens: ' + error.message);
  }
}

/* ---------- initialization ---------- */
function setupFloatingBar() {
  const actionsBar = document.querySelector('.actions-bar');
  const mainActions = document.querySelector('.actions');
  
  if (!actionsBar || !mainActions) return;
  
  let ticking = false;
  
  function updateFloatingBar() {
    const mainActionsRect = mainActions.getBoundingClientRect();
    const windowHeight = window.innerHeight;
    
    // Mostrar barra flutuante quando a seção principal não está visível
    if (mainActionsRect.top > windowHeight || mainActionsRect.bottom < 0) {
      actionsBar.classList.remove('hidden');
    } else {
      actionsBar.classList.add('hidden');
    }
    
    ticking = false;
  }
  
  function onScroll() {
    if (!ticking) {
      requestAnimationFrame(updateFloatingBar);
      ticking = true;
    }
  }
  
  // Configurar scroll listener
  window.addEventListener('scroll', onScroll, { passive: true });
  
  // Verificar estado inicial
  updateFloatingBar();
}

async function init() {
  try {
    console.log('🚀 Iniciando aplicação...');
    
    // Carregar sessão
    session = await loadSession();
    if (!session) return; // Erro já tratado em loadSession
    
    // Atualizar informações da sessão na interface
    if (sessionInfo) {
      const expiresText = fmtDate(session.expires_at);
      const orderNumber = session.estimated_order_number ? ` #${session.estimated_order_number}` : '';
      sessionInfo.textContent = `Orçamento${orderNumber} • Expira em ${expiresText}`;
    }
    
    // Carregar dados do cliente
    customerData = await loadCustomer(session.customer_id);
    if (!customerData) return; // Erro já tratado em loadCustomer
    
    // Atualizar cabeçalho do cliente
    updateCustomerHeader();
    
    // Carregar itens do orçamento
    await loadItems();
    
    // Configurar event listeners
    
    // Configurar scroll para barra flutuante
    setupFloatingBar();
    
    // Botões de adicionar produto
    const addProductBtns = [
      document.getElementById('add-product-btn'),
      document.getElementById('main-add-product-btn'),
      document.getElementById('footer-add-product-btn')
    ];
    
    addProductBtns.forEach(btn => {
      if (btn) {
        btn.addEventListener('click', showProductSearchModal);
      }
    });
    
    // Botões de salvar
    const saveBtns = [
      document.getElementById('main-save-btn'),
      document.getElementById('footer-save-btn')
    ];
    
    saveBtns.forEach(btn => {
      if (btn) {
        btn.addEventListener('click', async () => {
          try {
            await saveChanges();
          } catch (error) {
            console.error('Erro ao salvar:', error);
          }
        });
      }
    });
    
    // Botões de aprovar orçamento
    const submitBtns = [
      document.getElementById('main-submit-btn'),
      document.getElementById('footer-submit-btn')
    ];
    
    submitBtns.forEach(btn => {
      if (btn) {
        btn.addEventListener('click', submitOrder);
      }
    });
    
    // Modal de busca de produtos
    const closeModalBtn = document.getElementById('close-modal-btn');
    if (closeModalBtn) {
      closeModalBtn.addEventListener('click', hideProductSearchModal);
    }
    
    const searchBtn = document.getElementById('search-btn');
    if (searchBtn) {
      searchBtn.addEventListener('click', handleProductSearch);
    }
    
    const searchInput = document.getElementById('product-search-input');
    if (searchInput) {
      searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          handleProductSearch();
        }
      });
    }
    
    // Modal de aprovador
    const cancelApproval = document.getElementById('cancel-approval');
    if (cancelApproval) {
      cancelApproval.addEventListener('click', hideApproverModal);
    }
    
    const approverForm = document.getElementById('approver-form');
    if (approverForm) {
      approverForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        approverData = {
          name: formData.get('name'),
          phone: formData.get('phone'),
          email: formData.get('email')
        };
        
        // Validar dados básicos
        if (!approverData.name || !approverData.phone || !approverData.email) {
          alert('Por favor, preencha todos os campos obrigatórios.');
          return;
        }
        
        // Validar email básico
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(approverData.email)) {
          alert('Por favor, digite um e-mail válido.');
          return;
        }
        
        hideApproverModal();
        await processApproval();
      });
    }
    
    // Fechar modal ao clicar fora
    const productModal = document.getElementById('product-search-modal');
    if (productModal) {
      productModal.addEventListener('click', (e) => {
        if (e.target === productModal) {
          hideProductSearchModal();
        }
      });
    }
    
    const approverModal = document.getElementById('approver-modal');
    if (approverModal) {
      approverModal.addEventListener('click', (e) => {
        if (e.target === approverModal) {
          hideApproverModal();
        }
      });
    }
  } catch (error) {
    console.error('❌ Erro na inicialização:', error);
    showErrorPage(
      "Erro de Inicialização", 
      "Ocorreu um erro ao carregar a aplicação. Tente recarregar a página.",
      "⚠️"
    );
  }
}

// Inicializar aplicação quando DOM estiver pronto
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Funções globais para event handlers inline
window.handleQtyChange = async function(itemId, newQty) {
  try {
    const qty = parseInt(newQty);
    if (qty <= 0) {
      showAlert('Quantidade deve ser maior que zero');
      return;
    }
    
    console.log('🔄 Alterando quantidade:', { itemId, newQty: qty });
    await updateItemQty(itemId, qty);
  } catch (error) {
    console.error('Erro ao alterar quantidade:', error);
    showAlert('Erro ao alterar quantidade: ' + error.message);
  }
};

window.handleRemoveItem = async function(itemId) {
  try {
    const item = items.find(it => it.id === itemId);
    const productName = item ? item.descricao : 'este produto';
    
    if (confirm(`Tem certeza que deseja remover "${productName}" do orçamento?`)) {
      console.log('🗑️ Removendo item:', itemId);
      await removeItem(itemId);
    }
  } catch (error) {
    console.error('Erro ao remover item:', error);
    showAlert('Erro ao remover item: ' + error.message);
  }
};