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
        ">Pedido Já Enviado</h1>
        <p style="
          font-size: 16px;
          line-height: 1.6;
          margin: 0 0 24px;
          color: var(--gray-600);
        ">
          Este pedido já foi enviado anteriormente e não pode mais ser editado.
        </p>
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
            💡 Você pode visualizar os detalhes do pedido abaixo
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
          👁️ Ver Pedido (Somente Leitura)
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
    
    // Renderizar a interface em modo somente leitura
    document.body.innerHTML = `
      <header>
        <h1>📋 Pedido Enviado ${session.estimated_order_number ? `#${session.estimated_order_number}` : ''}</h1>
        <div id="customer-info" style="margin: 16px 0;"></div>
        <p id="session-info">Pedido enviado em ${fmtDate(session.created_at)}</p>
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
            <h2>🛒 Itens do Pedido</h2>
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
        <small>🔒 Pedido já enviado - Visualização somente leitura</small>
      </footer>
    `;
    
    // Atualizar informações do cliente
    updateCustomerHeader();
    
    // Aguardar um pouco para garantir que o DOM foi atualizado
    setTimeout(() => {
      // Verificar se o elemento existe antes de renderizar
      const itemsListElement = document.getElementById('items-list');
      console.log('🔍 Debug - Elemento items-list encontrado:', !!itemsListElement);
      if (itemsListElement) {
        renderItemsReadonly();
      } else {
        console.error('❌ Elemento items-list não encontrado no DOM');
      }
    }, 100);
    
  } catch (error) {
    console.error('Erro ao carregar visualização:', error);
    alert('Erro ao carregar os dados do pedido: ' + error.message);
  }
}

// Tornar showUsedSessionPage disponível globalmente também
window.showUsedSessionPage = showUsedSessionPage;

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
      
      const existingItem = items.find(item => item.product_id == product.codprodfilho);
      const buttonText = existingItem ? '➕ Somar' : '✅ Adicionar';
      
      // Gerar HTML do preço com promoção
      let priceHtml;
      if (hasPromotion) {
        priceHtml = `
          <div class="product-price promotion">
            <span class="original-price">${formatBRL(basePrice)}</span>
            <span class="promo-price">🔥 ${formatBRL(promoPrice)}</span>
          </div>
        `;
      } else {
        priceHtml = `<div class="product-price">${formatBRL(unitPrice)}</div>`;
      }
      
      return `
        <div class="product-result">
          <div class="product-info">
            <div class="product-name">
              ${product.descricao || 'Sem descrição'}
              ${hasPromotion ? '<span class="promo-badge">Promoção</span>' : ''}
            </div>
            <div class="product-code">Código: ${product.codprodfilho}</div>
          </div>
          ${priceHtml}
          <div class="product-actions">
            <div class="qty-selector">
              <label>Qtd:</label>
              <input type="number" value="1" min="1" max="9999" id="qty-${product.codprodfilho}">
            </div>
            <button class="btn-add-to-order" onclick="addProductToOrder(${product.codprodfilho}, '${product.descricao?.replace(/'/g, "\\'")}', ${unitPrice})">
              ${buttonText}
            </button>
          </div>
        </div>
      `;
    }).join('');
    
    searchResults.innerHTML = html;
    
  } catch (error) {
    console.error('Erro na busca de produtos:', error);
    searchLoading.style.display = 'none';
    searchResults.innerHTML = '<div class="search-empty"><div class="search-empty-icon">❌</div><p>Erro na busca</p><small>' + error.message + '</small></div>';
  } finally {
    isSearching = false;
  }
}

async function addProductToOrder(productId, productName, unitPrice) {
  try {
    const qtyInput = document.getElementById(`qty-${productId}`);
    const qty = parseInt(qtyInput?.value || '1');
    
    if (qty <= 0) {
      alert('Quantidade deve ser maior que zero');
      return;
    }
    
    // Verificar se o produto já existe no pedido
    const existingItem = items.find(item => item.product_id == productId);
    
    if (existingItem) {
      // Somar à quantidade existente
      const newQty = existingItem.qty + qty;
      
      const { error } = await currentSupabase
        .from('order_items')
        .update({ qty: newQty })
        .eq('id', existingItem.id);
      
      if (error) throw error;
      
      existingItem.qty = newQty;
      
      // Feedback visual
      const button = document.querySelector(`button[onclick*="${productId}"]`);
      if (button) {
        const originalText = button.textContent;
        button.textContent = '✅ Adicionado!';
        button.disabled = true;
        setTimeout(() => {
          button.textContent = originalText;
          button.disabled = false;
        }, 1500);
      }
      
    } else {
      // Adicionar novo item
      const { data: newItem, error } = await currentSupabase
        .from('order_items')
        .insert({
          session_id: session.id,
          product_id: productId,
          qty: qty
        })
        .select('id, session_id, product_id, qty')
        .single();
      
      if (error) throw error;
      
      // Adicionar à lista local
      const produto = {
        codprodfilho: productId,
        descricao: productName,
        preco3: unitPrice,
        promo3: 0
      };
      
      items.push({
        ...newItem,
        produto: produto,
        unit_price: unitPrice
      });
      
      // Feedback visual
      const button = document.querySelector(`button[onclick*="${productId}"]`);
      if (button) {
        const originalText = button.textContent;
        button.textContent = '✅ Adicionado!';
        button.disabled = true;
        setTimeout(() => {
          button.textContent = '➕ Somar';
          button.disabled = false;
        }, 1500);
      }
    }
    
    // Re-renderizar lista de itens
    renderItems();
    
    // Resetar quantidade no modal
    if (qtyInput) qtyInput.value = '1';
    
  } catch (error) {
    console.error('Erro ao adicionar produto:', error);
    alert('Erro ao adicionar produto: ' + error.message);
  }
}

// Tornar a função disponível globalmente para uso no onclick
window.addProductToOrder = addProductToOrder;
async function handleQtyChange(event) {
  const input = event.target;
  const itemId = parseInt(input.dataset.itemId);
  const newQty = parseInt(input.value) || 1;
  
  // Validar quantidade
  if (newQty < 1) {
    input.value = 1;
    return;
  }
  if (newQty > 9999) {
    input.value = 9999;
    return;
  }
  
  // Atualizar item local
  const item = items.find(it => it.id === itemId);
  if (item) {
    item.qty = newQty;
    
    // Atualizar subtotal na interface
    const itemRow = input.closest('.item-row');
    const subtotalEl = itemRow.querySelector('.item-subtotal');
    const subtotal = (item.unit_price || 0) * newQty;
    subtotalEl.textContent = formatBRL(subtotal);
    
    // Atualizar totais
    updateTotalsBoth();
  }
}

async function handleRemoveItem(event) {
  const button = event.target;
  const itemId = parseInt(button.dataset.itemId);
  
  if (!confirm('Tem certeza que deseja remover este item?')) {
    return;
  }
  
  try {
    // Remover do banco de dados
    const { error } = await currentSupabase
      .from('order_items')
      .delete()
      .eq('id', itemId);
    
    if (error) throw error;
    
    // Remover da lista local
    items = items.filter(it => it.id !== itemId);
    
    // Re-renderizar
    renderItems();
    
    showAlert(''); // Limpar alertas
    
  } catch (error) {
    console.error('Erro ao remover item:', error);
    showAlert('Erro ao remover item: ' + error.message);
  }
}

async function saveChanges() {
  try {
    showAlert(''); // Limpar alertas
    
    console.log('🔍 Salvando alterações no schema:', session?.schema || schema);
    
    // Preparar updates em lote
    const updates = items.map(item => ({
      id: item.id,
      qty: item.qty || 1
    }));
    
    // Atualizar no banco
    for (const update of updates) {
      const { error } = await currentSupabase
        .from('order_items')
        .update({ qty: update.qty })
        .eq('id', update.id);
      
      if (error) throw error;
    }
    
    // Feedback visual temporário
    const saveButtons = document.querySelectorAll('#main-save-btn, #footer-save-btn');
    const originalTexts = Array.from(saveButtons).map(btn => btn.textContent);
    
    saveButtons.forEach(btn => {
      btn.textContent = '✅ Salvo!';
      btn.style.background = 'var(--success)';
      btn.style.color = 'white';
    });
    
    setTimeout(() => {
      saveButtons.forEach((btn, index) => {
        btn.textContent = originalTexts[index];
        btn.style.background = '';
        btn.style.color = '';
      });
    }, 2000);
    
  } catch (error) {
    console.error('Erro ao salvar:', error);
    showAlert('Erro ao salvar alterações: ' + error.message);
  }
}

async function submitOrder() {
  try {
    const response = await fetch(`${cfg.FUNCTIONS_BASE}/submit-order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${cfg.SUPABASE_ANON}`
      },
      body: JSON.stringify({
        session_id: session.id,
        schema: schema
      })
    });
    
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.message || 'Erro ao enviar pedido');
    }
    
    // Armazenar número do pedido para mostrar na página de sucesso
    window.lastOrderNumber = result.data?.order_number;
    
    console.log('✅ Pedido enviado com sucesso:', result);
    
  } catch (error) {
    console.error('Erro ao enviar pedido:', error);
    throw error;
  }
}

function updateCustomerHeader() {
  console.log('🔍 Debug - updateCustomerHeader chamado com:', customerData);
  
  if (!customerData) return;
  
  const customerInfoDiv = document.getElementById('customer-info');
  if (!customerInfoDiv) {
    console.error('❌ Elemento customer-info não encontrado!');
    return;
  }
  
  console.log('🔍 Debug - Elemento customer-info encontrado:', customerInfoDiv);
  console.log('🔍 Debug - customerInfoDiv.style.display antes:', customerInfoDiv.style.display);
  
  // Função para capitalizar adequadamente com suporte a caracteres especiais
  function toTitleCase(str) {
    if (!str) return '';
    
    // Lista de preposições e artigos que devem ficar em minúsculo (exceto no início)
    const smallWords = ['da', 'de', 'do', 'das', 'dos', 'e', 'em', 'na', 'no', 'nas', 'nos', 'a', 'o', 'as', 'os'];
    
    return str.toLowerCase()
      .split(' ')
      .map((word, index) => {
        // Primeira palavra sempre maiúscula
        if (index === 0) {
          return capitalizeWord(word);
        }
        
        // Preposições e artigos ficam em minúsculo (exceto se for a primeira palavra)
        if (smallWords.includes(word.toLowerCase())) {
          return word.toLowerCase();
        }
        
        return capitalizeWord(word);
      })
      .join(' ');
  }
  
  // Função auxiliar para capitalizar uma palavra considerando caracteres especiais
  function capitalizeWord(word) {
    if (!word) return '';
    
    // Usar regex que funciona com caracteres Unicode (incluindo acentos)
    return word.replace(/^\p{L}/u, char => char.toUpperCase());
  }
  
  // Formatar endereço completo
  const endereco = [
    toTitleCase(customerData.logradouro),
    customerData.numero,
    toTitleCase(customerData.bairro),
    toTitleCase(customerData.cidade),
    customerData.uf,
    customerData.cep
  ].filter(Boolean).join(', ');
  
  console.log('🔍 Debug - Endereço formatado:', endereco);
  
  // Garantir que o elemento está visível
  customerInfoDiv.style.display = 'block';
  
  customerInfoDiv.innerHTML = `
    <div class="customer-header">
      <div class="customer-main">
        <div class="customer-code">Código: ${customerData.codpessoa}</div>
        <div class="customer-name">${toTitleCase(customerData.nomefantazia || customerData.nome)}</div>
        <div class="customer-razao">${toTitleCase(customerData.nome)}</div>
      </div>
      <div class="customer-details">
        <div class="customer-cnpj">CNPJ: ${customerData.cpfcgc}</div>
        <div class="customer-address">${endereco}</div>
      </div>
    </div>
  `;
  
  console.log('✅ Debug - HTML do cliente inserido no DOM');
  console.log('🔍 Debug - customerInfoDiv.innerHTML após inserção:', customerInfoDiv.innerHTML.substring(0, 100) + '...');
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
  console.log('🔍 Schema configurado:', schema);
  console.log('🔍 Configuração Supabase URL:', cfg.SUPABASE_URL);
  console.log('🔍 Token é UUID válido:', /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(token));
  
  // Criar cliente Supabase com o schema correto da URL
  const supabaseForSession = createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON, {
    db: { schema: schema }
  });
  
  // Busca a sessão específica usando o token como ID no schema correto
  const { data, error } = await supabaseForSession
    .from("order_sessions")
    .select("id, expires_at, used, created_at, customer_id, estimated_order_number, view_name")
    .eq("id", token)
    .maybeSingle();
  
  console.log('📊 Resultado da consulta:', { 
    data, 
    error, 
    token,
    schema,
    hasData: !!data,
    errorCode: error?.code,
    errorMessage: error?.message,
    queryUsed: `SELECT id, expires_at, used, created_at, customer_id, view_name FROM order_sessions WHERE id = '${token}' (schema: ${schema})`
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
  
  // Sempre definir session, mesmo se usada
  session = data;
  
  // Atualizar cliente global para usar o schema correto
  console.log('🔄 Configurando cliente Supabase com schema:', schema);
  currentSupabase = supabaseForSession;
  
  if (data.used) {
    showUsedSessionPage();
    return; // Retorna mas session já foi definida
  }
  
  if (new Date(data.expires_at) < new Date()) {
    showErrorPage(
      "Link Expirado",
      `Este link expirou em ${fmtDate(data.expires_at)}. Solicite um novo link de acesso para continuar com seu pedido.`,
      "⏰"
    );
    throw new Error("Sessão expirada.");
  }
  
  sessionInfo.textContent = `Expira em ${fmtDate(session.expires_at)}`;
  
  // Atualizar título com número do pedido se disponível
  const titleElement = document.querySelector('h1');
  if (session.estimated_order_number && titleElement) {
    titleElement.textContent = `📋 Revisar Pedido #${session.estimated_order_number}`;
  }
  
  // Buscar dados completos do cliente
  const { data: customer, error: customerError } = await currentSupabase
    .from("clientes_atacamax")
    .select("codpessoa, nome, cpfcgc, nomefantazia, logradouro, numero, bairro, cidade, uf, cep")
    .eq("codpessoa", session.customer_id)
    .maybeSingle();
  
  console.log('🔍 Debug - Buscando cliente com ID:', session.customer_id);
  console.log('🔍 Debug - Resultado da consulta do cliente:', { customer, customerError });
  
  if (customerError) {
    console.error('Erro ao buscar dados do cliente:', customerError);
    console.error('🔍 Debug - Schema usado:', schema);
    console.error('🔍 Debug - Customer ID:', session.customer_id);
    
    // Tentar listar alguns clientes para debug
    try {
      const { data: sampleClients } = await currentSupabase
        .from("clientes_atacamax")
        .select("codpessoa, nome")
        .limit(5);
      console.log('🔍 Debug - Clientes de exemplo no schema:', sampleClients);
    } catch (e) {
      console.error('🔍 Debug - Erro ao buscar clientes de exemplo:', e);
    }
  } else {
    customerData = customer;
    console.log('🔍 Debug - customerData definido:', customerData);
    updateCustomerHeader();
  }
  
  // Esconder a linha do número estimado já que agora está no título
  orderPreview.style.display = 'none';
}

async function loadItems(){
  // 1) buscar itens da sessão atual
  console.log('🔍 Debug - Iniciando loadItems para session:', session.id);
  console.log('🔍 Debug - Schema configurado:', supabase.supabaseUrl, supabase.supabaseKey?.substring(0, 20) + '...');
  
  // Primeiro, vamos verificar se a tabela existe e tem dados
  const { data: allItems, error: allError } = await currentSupabase
    .from("order_items")
    .select("*")
    .limit(5);
  
  console.log('🔍 Debug - Teste geral da tabela order_items:', { 
    allItems: allItems?.length || 0, 
    allError,
    sample: allItems?.[0] 
  });
  
  const { data: rawItems, error } = await currentSupabase
    .from("order_items")
    .select("id, session_id, product_id, qty")
    .eq("session_id", session.id)
      
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
    
    const { data, error: prodErr } = await currentSupabase
      .from("produtos_atacamax")
      .select("codprodfilho, descricao, referencia, gtin, preco3, promo3, ativo")
      .in("codprodfilho", asNumbers);
    
    console.log('🔍 Debug - Query produtos:', {
      schema: schema,
      productIds: asNumbers,
      found: data?.length || 0,
      error: prodErr
    });
    
    if (prodErr) throw prodErr;
    
    console.log('🔍 Debug - Produtos encontrados neste lote:', data?.length || 0);
    
    // Se não encontrou produtos, tentar buscar alguns de exemplo
    if (!data || data.length === 0) {
      try {
        const { data: sampleProducts } = await currentSupabase
          .from("produtos_atacamax")
          .select("codprodfilho, descricao")
          .limit(5);
        console.log('🔍 Debug - Produtos de exemplo no schema:', sampleProducts);
      } catch (e) {
        console.error('🔍 Debug - Erro ao buscar produtos de exemplo:', e);
      }
    }
    
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
}

/* ---------- render ---------- */
function renderItems(){
  if (!items.length) {
    itemsList.innerHTML = "";
    emptyHint.style.display = "block";
    updateTotalsBoth();
    return;
  }
  
  emptyHint.style.display = "none";
  
  const html = items.map(it => {
    const p = it.produto;
    if (!p) return `<div class="item-row"><p>Produto ${it.product_id} não encontrado</p></div>`;
    
    const unitPrice = it.unit_price || 0;
    const subtotal = unitPrice * (it.qty || 0);
    
    // Verificar se há promoção
    const basePrice = toDecimal(p.preco3) || 0;
    const promoPrice = toDecimal(p.promo3) || 0;
    const hasPromotion = promoPrice > 0 && promoPrice < basePrice;
    
    let priceHtml;
    if (hasPromotion) {
      priceHtml = `
        <div class="item-price promotion">
          <span class="original-price">${formatBRL(basePrice)}</span>
          <span class="promo-price">${formatBRL(promoPrice)}</span>
        </div>
      `;
    } else {
      priceHtml = `<div class="item-price">${formatBRL(unitPrice)}</div>`;
    }
    
    return `
      <div class="item-row" data-item-id="${it.id}">
        <div class="item-title-wrap">
          <div class="item-title">
            ${p.descricao || 'Sem descrição'}
            ${hasPromotion ? '<span class="promo-badge">Promoção</span>' : ''}
          </div>
          <div class="item-meta">Código: ${p.codprodfilho}</div>
        </div>
        ${priceHtml}
        <input type="number" class="qty-input" value="${it.qty || 1}" min="1" max="9999" data-item-id="${it.id}">
        <div class="item-subtotal">${formatBRL(subtotal)}</div>
        <button class="btn-remove" data-item-id="${it.id}">🗑️ Remover</button>
      </div>
    `;
  }).join("");
  
  itemsList.innerHTML = html;
  updateTotalsBoth();
  
  // Adicionar event listeners
  document.querySelectorAll('.qty-input').forEach(input => {
    input.addEventListener('change', handleQtyChange);
    input.addEventListener('input', handleQtyChange);
  });
  
  document.querySelectorAll('.btn-remove').forEach(btn => {
    btn.addEventListener('click', handleRemoveItem);
  });
}

function renderItemsReadonly(){
  console.log('🔍 Debug - renderItemsReadonly chamado com', items.length, 'itens');
  
  const itemsList = document.getElementById('items-list');
  if (!itemsList) {
    console.error('❌ Elemento items-list não encontrado na renderItemsReadonly');
    return;
  }
  
  if (!items.length) {
    itemsList.innerHTML = "<div class='empty'><p>Nenhum item encontrado</p></div>";
    updateTotalsBoth();
    return;
  }
  
  const html = items.map(it => {
    const p = it.produto;
    if (!p) return `<div class="item-row readonly"><p>Produto ${it.product_id} não encontrado</p></div>`;
    
    const unitPrice = it.unit_price || 0;
    const subtotal = unitPrice * (it.qty || 0);
    
    // Verificar se há promoção
    const basePrice = toDecimal(p.preco3) || 0;
    const promoPrice = toDecimal(p.promo3) || 0;
    const hasPromotion = promoPrice > 0 && promoPrice < basePrice;
    
    let priceHtml;
    if (hasPromotion) {
      priceHtml = `
        <div class="item-price promotion">
          <span class="original-price">${formatBRL(basePrice)}</span>
          <span class="promo-price">${formatBRL(promoPrice)}</span>
        </div>
      `;
    } else {
      priceHtml = `<div class="item-price">${formatBRL(unitPrice)}</div>`;
    }
    
    console.log('🔍 Debug - Renderizando item:', {
      id: it.id,
      descricao: p.descricao,
      qty: it.qty,
      unitPrice,
      subtotal
    });
    
    return `
      <div class="item-row readonly">
        <div class="item-title-wrap">
          <div class="item-title">
            ${p.descricao || 'Sem descrição'}
            ${hasPromotion ? '<span class="promo-badge">Promoção</span>' : ''}
          </div>
          <div class="item-meta">Código: ${p.codprodfilho}</div>
        </div>
        <div class="qty-display">${it.qty || 1}</div>
        ${priceHtml}
        <div class="item-subtotal">${formatBRL(subtotal)}</div>
      </div>
    `;
  }).join("");
  
  console.log('🔍 Debug - HTML gerado:', html.substring(0, 200) + '...');
  
  itemsList.innerHTML = html;
  
  console.log('🔍 Debug - itemsList.innerHTML após inserção:', itemsList.innerHTML.substring(0, 200) + '...');
  
  updateTotalsBoth();
}

// Função principal de inicialização
async function init() {
  try {
    console.log('🚀 Iniciando aplicação...');
    
    // Carregar sessão e validar token
    await loadSession();
    
    // Se a sessão foi usada, não continua com a inicialização normal
    if (session && session.used) {
      console.log('✅ Sessão usada detectada - inicialização interrompida');
      return;
    }
    
    // Carregar itens do pedido
    await loadItems();
    
    // Renderizar interface
    renderItems();
    
    // Configurar event listeners para os botões principais
    const mainSaveBtn = document.getElementById("main-save-btn");
    const mainSubmitBtn = document.getElementById("main-submit-btn");
    const mainAddProductBtn = document.getElementById("main-add-product-btn");
    const footerSaveBtn = document.getElementById("footer-save-btn");
    const footerSubmitBtn = document.getElementById("footer-submit-btn");
    const footerAddProductBtn = document.getElementById("footer-add-product-btn");
    
    if (mainSaveBtn) mainSaveBtn.addEventListener('click', saveChanges);
    if (mainSubmitBtn) mainSubmitBtn.addEventListener('click', handleSubmit);
    if (mainAddProductBtn) mainAddProductBtn.addEventListener('click', showProductSearchModal);
    if (footerSaveBtn) footerSaveBtn.addEventListener('click', saveChanges);
    if (footerSubmitBtn) footerSubmitBtn.addEventListener('click', handleSubmit);
    if (footerAddProductBtn) footerAddProductBtn.addEventListener('click', showProductSearchModal);
    
    // Configurar event listeners para busca de produtos
    const addProductBtn = document.getElementById('add-product-btn');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const searchBtn = document.getElementById('search-btn');
    const searchInput = document.getElementById('product-search-input');
    
    if (addProductBtn) addProductBtn.addEventListener('click', showProductSearchModal);
    if (closeModalBtn) closeModalBtn.addEventListener('click', hideProductSearchModal);
    if (searchBtn) searchBtn.addEventListener('click', handleProductSearch);
    
    // Buscar ao pressionar Enter no campo de busca
    if (searchInput) {
      searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          handleProductSearch();
        }
      });
    }
    
    // Fechar modal ao clicar fora dele
    const modal = document.getElementById('product-search-modal');
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          hideProductSearchModal();
        }
      });
    }
    
    // Configurar controle de visibilidade das barras de ação
    window.addEventListener('scroll', updateActionBarsVisibility);
    window.addEventListener('resize', updateActionBarsVisibility);
    updateActionBarsVisibility();
    
    console.log('✅ Aplicação inicializada com sucesso');
    
  } catch (error) {
    console.error('❌ Erro na inicialização:', error);
    // Se chegou até aqui e não foi tratado pelas funções específicas,
    // mostra um erro genérico
    if (!document.body.innerHTML.includes('min-height: 100vh')) {
      showErrorPage(
        "Erro Inesperado",
        `Ocorreu um erro inesperado: ${error.message}. Tente recarregar a página ou solicite um novo link.`,
        "⚠️"
      );
    }
  }
}

// Inicializar quando o DOM estiver pronto
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}