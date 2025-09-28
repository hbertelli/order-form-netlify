// Configuração global
let currentSession = null;
let currentItems = [];
let isReadonly = false;

// Inicialização
document.addEventListener('DOMContentLoaded', async () => {
  console.log('🚀 Aplicação iniciada');
  
  // Verificar se há token na URL
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('token');
  const schema = urlParams.get('schema') || 'demo';
  
  if (!token) {
    showAlert('Token não encontrado na URL. Acesso negado.', 'error');
    return;
  }
  
  console.log('🔑 Token encontrado:', token);
  console.log('🗄️ Schema:', schema);
  
  try {
    await loadSession(token, schema);
    setupEventListeners();
  } catch (error) {
    console.error('❌ Erro ao carregar sessão:', error);
    showAlert('Erro ao carregar dados da sessão.', 'error');
  }
});

// Carregar dados da sessão
async function loadSession(token, schema = 'demo') {
  try {
    console.log('📡 Carregando sessão...');
    
    const response = await fetch(`${window.APP_CONFIG.SUPABASE_URL}/rest/v1/order_sessions?id=eq.${token}&select=*`, {
      headers: {
        'apikey': window.APP_CONFIG.SUPABASE_ANON,
        'Authorization': `Bearer ${window.APP_CONFIG.SUPABASE_ANON}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-Client-Info': 'supabase-js-web',
        'Accept-Profile': schema
      }
    });
    
    if (!response.ok) {
      throw new Error(`Erro HTTP: ${response.status}`);
    }
    
    const sessions = await response.json();
    
    if (!sessions || sessions.length === 0) {
      throw new Error('Sessão não encontrada');
    }
    
    currentSession = sessions[0];
    console.log('✅ Sessão carregada:', currentSession);
    
    // Verificar se a sessão já foi usada
    if (currentSession.used) {
      isReadonly = true;
      console.log('🔒 Sessão já foi utilizada - modo somente leitura');
    }
    
    // Verificar se a sessão expirou
    if (new Date(currentSession.expires_at) < new Date()) {
      showAlert('Esta sessão expirou.', 'error');
      return;
    }
    
    // Carregar dados do cliente
    await loadCustomerData(currentSession.customer_id, schema);
    
    // Carregar itens do pedido
    await loadOrderItems(token, schema);
    
    // Atualizar interface
    updateSessionInfo();
    updateOrderPreview();
    
  } catch (error) {
    console.error('❌ Erro ao carregar sessão:', error);
    throw error;
  }
}

// Carregar dados do cliente
async function loadCustomerData(customerId, schema = 'demo') {
  try {
    console.log('👤 Carregando dados do cliente:', customerId);
    
    const response = await fetch(`${window.APP_CONFIG.SUPABASE_URL}/rest/v1/clientes_atacamax?codpessoa=eq.${customerId}&select=*`, {
      headers: {
        'apikey': window.APP_CONFIG.SUPABASE_ANON,
        'Authorization': `Bearer ${window.APP_CONFIG.SUPABASE_ANON}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-Client-Info': 'supabase-js-web',
        'Accept-Profile': schema
      }
    });
    
    if (!response.ok) {
      throw new Error(`Erro HTTP: ${response.status}`);
    }
    
    const customers = await response.json();
    
    if (!customers || customers.length === 0) {
      throw new Error('Cliente não encontrado');
    }
    
    const customer = customers[0];
    console.log('✅ Cliente carregado:', customer);
    
    // Atualizar informações do cliente na interface
    updateCustomerInfo(customer);
    
  } catch (error) {
    console.error('❌ Erro ao carregar cliente:', error);
    throw error;
  }
}

// Atualizar informações do cliente
function updateCustomerInfo(customer) {
  const customerInfoEl = document.getElementById('customer-info');
  if (!customerInfoEl) return;
  
  // Formatar endereço
  const endereco = [
    customer.logradouro,
    customer.numero,
    customer.bairro,
    customer.cidade,
    customer.uf,
    customer.cep
  ].filter(Boolean).join(', ');
  
  customerInfoEl.innerHTML = `
    <div class="customer-header">
      <div class="customer-main">
        <div class="customer-code">Cliente #${customer.codpessoa}</div>
        <div class="customer-name">${customer.nome}</div>
        ${customer.nomefantazia ? `<div class="customer-razao">${customer.nomefantazia}</div>` : ''}
      </div>
      <div class="customer-details">
        <div class="customer-cnpj">${customer.cpfcgc || 'CNPJ não informado'}</div>
        <div class="customer-address">${endereco}</div>
      </div>
    </div>
  `;
}

// Carregar itens do pedido
async function loadOrderItems(sessionId, schema = 'demo') {
  try {
    console.log('📦 Carregando itens do pedido...');
    
    const response = await fetch(`${window.APP_CONFIG.SUPABASE_URL}/rest/v1/order_items?session_id=eq.${sessionId}&select=*`, {
      headers: {
        'apikey': window.APP_CONFIG.SUPABASE_ANON,
        'Authorization': `Bearer ${window.APP_CONFIG.SUPABASE_ANON}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-Client-Info': 'supabase-js-web',
        'Accept-Profile': schema
      }
    });
    
    if (!response.ok) {
      throw new Error(`Erro HTTP: ${response.status}`);
    }
    
    const items = await response.json();
    console.log('✅ Itens carregados:', items.length);
    
    if (!items || items.length === 0) {
      currentItems = [];
      renderItems();
      return;
    }
    
    // Buscar dados dos produtos
    const productIds = items.map(item => item.product_id);
    const productsResponse = await fetch(`${window.APP_CONFIG.SUPABASE_URL}/rest/v1/produtos_atacamax?codprodfilho=in.(${productIds.join(',')})&select=*`, {
      headers: {
        'apikey': window.APP_CONFIG.SUPABASE_ANON,
        'Authorization': `Bearer ${window.APP_CONFIG.SUPABASE_ANON}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-Client-Info': 'supabase-js-web',
        'Accept-Profile': schema
      }
    });
    
    if (!productsResponse.ok) {
      throw new Error(`Erro HTTP: ${productsResponse.status}`);
    }
    
    const products = await productsResponse.json();
    const productsMap = new Map(products.map(p => [p.codprodfilho, p]));
    
    // Combinar dados dos itens com dados dos produtos
    currentItems = items.map(item => {
      const product = productsMap.get(item.product_id);
      
      // Usar preços salvos no item ou calcular novamente
      const originalPrice = parseFloat(item.original_price || product?.preco3 || '0');
      const promoPrice = parseFloat(item.promo_price || product?.promo3 || '0');
      const unitPrice = parseFloat(item.unit_price || ((promoPrice > 0 && promoPrice < originalPrice) ? promoPrice : originalPrice));
      
      return {
        id: item.id,
        product_id: item.product_id,
        name: product?.descricao || 'Produto não encontrado',
        code: product?.codprodfilho || item.product_id,
        qty: parseFloat(item.qty || '1'),
        unit_price: unitPrice,
        original_price: originalPrice,
        promo_price: promoPrice,
        subtotal: unitPrice * parseFloat(item.qty || '1')
      };
    });
    
    renderItems();
    
  } catch (error) {
    console.error('❌ Erro ao carregar itens:', error);
    throw error;
  }
}

// Renderizar lista de itens
function renderItems() {
  console.log('🎨 Renderizando itens...');
  console.log('📦 Total de itens:', currentItems.length);
  console.log('📋 Itens atuais:', currentItems.map(item => ({ id: item.id, product_id: item.product_id, name: item.name })));
  
  const itemsList = document.getElementById('items-list');
  const emptyHint = document.getElementById('empty-hint');
  
  if (!itemsList) {
    console.error('❌ Elemento items-list não encontrado');
    return;
  }
  
  if (currentItems.length === 0) {
    console.log('📭 Nenhum item para renderizar');
    itemsList.innerHTML = '';
    if (emptyHint) emptyHint.style.display = 'block';
    updateTotals();
    return;
  }
  
  console.log('📝 Renderizando', currentItems.length, 'itens');
  
  if (emptyHint) emptyHint.style.display = 'none';
  
  itemsList.innerHTML = currentItems.map(item => {
    console.log('🏷️ Renderizando item:', item.id, item.name);
    
    const isPromotion = item.promo_price > 0 && item.promo_price < item.original_price;
    
    if (isReadonly) {
      return `
        <div class="item-row readonly" data-id="${item.id}">
          <div class="item-title-wrap">
            <div class="item-title">
              ${item.name}
              ${isPromotion ? '<span class="promo-badge">Promoção</span>' : ''}
            </div>
            <div class="item-meta">Código: ${item.code} | ID: ${item.id}</div>
          </div>
          <div class="qty-display">${item.qty}</div>
          <div class="item-price ${isPromotion ? 'promotion' : ''}">
            ${isPromotion ? `
              <div class="original-price">R$ ${item.original_price.toFixed(2).replace('.', ',')}</div>
              <div class="promo-price">R$ ${item.unit_price.toFixed(2).replace('.', ',')}</div>
            ` : `R$ ${item.unit_price.toFixed(2).replace('.', ',')}`}
          </div>
          <div class="item-subtotal">R$ ${item.subtotal.toFixed(2).replace('.', ',')}</div>
        </div>
      `;
    }
    
    return `
      <div class="item-row" data-id="${item.id}">
        <div class="item-title-wrap">
          <div class="item-title">
            ${item.name}
            ${isPromotion ? '<span class="promo-badge">Promoção</span>' : ''}
          </div>
          <div class="item-meta">Código: ${item.code} | ID: ${item.id}</div>
        </div>
        <input type="number" class="qty-input" value="${item.qty}" min="1" step="1" data-id="${item.id}">
        <div class="item-price ${isPromotion ? 'promotion' : ''}">
          ${isPromotion ? `
            <div class="original-price">R$ ${item.original_price.toFixed(2).replace('.', ',')}</div>
            <div class="promo-price">R$ ${item.unit_price.toFixed(2).replace('.', ',')}</div>
          ` : `R$ ${item.unit_price.toFixed(2).replace('.', ',')}`}
        </div>
        <div class="item-subtotal">R$ ${item.subtotal.toFixed(2).replace('.', ',')}</div>
        <button class="btn-remove" data-id="${item.id}">🗑️ Remover</button>
      </div>
    `;
  }).join('');
  
  console.log('✅ Itens renderizados com sucesso');
  updateTotals();
}

// Atualizar totais
function updateTotals() {
  const total = currentItems.reduce((sum, item) => sum + item.subtotal, 0);
  
  // Atualizar todos os elementos de total
  const totalElements = [
    document.getElementById('order-total'),
    document.getElementById('footer-total')
  ];
  
  totalElements.forEach(el => {
    if (el) {
      el.textContent = `R$ ${total.toFixed(2).replace('.', ',')}`;
    }
  });
}

// Atualizar informações da sessão
function updateSessionInfo() {
  const sessionInfo = document.getElementById('session-info');
  if (!sessionInfo || !currentSession) return;
  
  const expiresAt = new Date(currentSession.expires_at);
  const now = new Date();
  const hoursLeft = Math.max(0, Math.floor((expiresAt - now) / (1000 * 60 * 60)));
  
  if (isReadonly) {
    sessionInfo.innerHTML = '🔒 Pedido já foi enviado (somente leitura)';
    sessionInfo.style.color = '#dc2626';
  } else {
    sessionInfo.innerHTML = `⏰ Sessão expira em ${hoursLeft}h | 🔑 ID: ${currentSession.id.substring(0, 8)}...`;
  }
}

// Atualizar preview do pedido
function updateOrderPreview() {
  const orderPreview = document.getElementById('order-preview');
  if (!orderPreview || !currentSession) return;
  
  const itemCount = currentItems.length;
  const total = currentItems.reduce((sum, item) => sum + item.subtotal, 0);
  
  if (currentSession.estimated_order_number) {
    orderPreview.innerHTML = `📋 Pedido #${currentSession.estimated_order_number} • ${itemCount} itens • R$ ${total.toFixed(2).replace('.', ',')}`;
  } else {
    orderPreview.innerHTML = `📋 ${itemCount} itens • R$ ${total.toFixed(2).replace('.', ',')}`;
  }
}

// Configurar event listeners
function setupEventListeners() {
  // Botões de adicionar produto
  const addProductBtns = [
    document.getElementById('add-product-btn'),
    document.getElementById('main-add-product-btn'),
    document.getElementById('footer-add-product-btn')
  ];
  
  addProductBtns.forEach(btn => {
    if (btn && !isReadonly) {
      btn.addEventListener('click', openProductSearchModal);
    }
  });
  
  // Botões de salvar
  const saveBtns = [
    document.getElementById('main-save-btn'),
    document.getElementById('footer-save-btn')
  ];
  
  saveBtns.forEach(btn => {
    if (btn && !isReadonly) {
      btn.addEventListener('click', saveOrder);
    }
  });
  
  // Botões de enviar/aprovar
  const submitBtns = [
    document.getElementById('main-submit-btn'),
    document.getElementById('footer-submit-btn')
  ];
  
  submitBtns.forEach(btn => {
    if (btn && !isReadonly) {
      btn.addEventListener('click', openApproverModal);
    }
  });
  
  // Modal de busca de produtos
  const productSearchModal = document.getElementById('product-search-modal');
  const closeModalBtn = document.getElementById('close-modal-btn');
  const searchBtn = document.getElementById('search-btn');
  const searchInput = document.getElementById('product-search-input');
  
  if (closeModalBtn) {
    closeModalBtn.addEventListener('click', closeProductSearchModal);
  }
  
  if (searchBtn) {
    searchBtn.addEventListener('click', searchProducts);
  }
  
  if (searchInput) {
    searchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        searchProducts();
      }
    });
  }
  
  // Modal de aprovação
  const approverModal = document.getElementById('approver-modal');
  const cancelApprovalBtn = document.getElementById('cancel-approval');
  const approverForm = document.getElementById('approver-form');
  
  if (cancelApprovalBtn) {
    cancelApprovalBtn.addEventListener('click', closeApproverModal);
  }
  
  if (approverForm) {
    approverForm.addEventListener('submit', submitOrder);
  }
  
  // Event delegation para botões dinâmicos
  document.addEventListener('click', handleDynamicClicks);
  
  // Event delegation para inputs de quantidade - REMOVIDO O AUTO-SAVE
  document.addEventListener('input', handleQuantityInput);
  
  // Fechar modais clicando fora
  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) {
      closeProductSearchModal();
      closeApproverModal();
    }
  });
  
  // Ocultar botões se readonly
  if (isReadonly) {
    hideEditButtons();
  }
}

// Manipular cliques dinâmicos
function handleDynamicClicks(e) {
  console.log('🖱️ Clique detectado:', e.target.className, e.target.dataset);
  
  // Botão remover item
  if (e.target.classList.contains('btn-remove')) {
    e.preventDefault();
    e.stopPropagation();
    const itemId = e.target.dataset.id;
    console.log('🗑️ Tentando remover item:', itemId);
    console.log('🗑️ Elemento clicado:', e.target);
    console.log('🗑️ Dataset completo:', e.target.dataset);
    removeItem(itemId);
    return;
  }
  
  // Botão adicionar produto ao pedido
  if (e.target.classList.contains('btn-add-to-order')) {
    const productId = e.target.dataset.productId;
    const qtyInput = e.target.parentElement.querySelector('.qty-selector input');
    const qty = parseInt(qtyInput?.value || '1');
    addProductToOrder(productId, qty);
  }
}

// Manipular input de quantidade - SEM AUTO-SAVE
function handleQuantityInput(e) {
  if (e.target.classList.contains('qty-input')) {
    const itemId = e.target.dataset.id;
    const newQty = parseFloat(e.target.value) || 1;
    
    // Apenas atualizar localmente, não salvar no banco
    updateItemQuantityLocally(itemId, newQty);
  }
}

// Atualizar quantidade localmente (sem salvar no banco)
function updateItemQuantityLocally(itemId, newQty) {
  console.log('🔄 Atualizando quantidade localmente:', itemId, newQty);
  
  const item = currentItems.find(item => item.id === itemId);
  if (item) {
    console.log('📦 Item encontrado:', item.name, 'quantidade anterior:', item.qty);
    item.qty = newQty;
    item.subtotal = item.unit_price * newQty;
    
    console.log('💰 Novo subtotal:', item.subtotal);
    
    // Atualizar apenas o subtotal na interface
    const itemRow = document.querySelector(`[data-id="${itemId}"]`);
    if (itemRow) {
      const subtotalEl = itemRow.querySelector('.item-subtotal');
      if (subtotalEl) {
        subtotalEl.textContent = `R$ ${item.subtotal.toFixed(2).replace('.', ',')}`;
        console.log('✅ Subtotal atualizado na interface');
      }
    }
    
    updateTotals();
    updateOrderPreview();
  } else {
    console.error('❌ Item não encontrado:', itemId);
  }
}

// Remover item
function removeItem(itemId) {
  console.log('🗑️ Função removeItem chamada com ID:', itemId);
  console.log('🗑️ Itens atuais antes da remoção:', currentItems.map(item => ({ id: item.id, name: item.name })));
  
  if (isReadonly) {
    console.log('🔒 Modo readonly - remoção cancelada');
    return;
  }
  
  if (confirm('Tem certeza que deseja remover este item?')) {
    console.log('✅ Usuário confirmou remoção');
    const itemsBefore = currentItems.length;
    currentItems = currentItems.filter(item => item.id !== itemId);
    const itemsAfter = currentItems.length;
    console.log('📊 Itens antes:', itemsBefore, 'depois:', itemsAfter);
    console.log('🗑️ Itens restantes:', currentItems.map(item => ({ id: item.id, name: item.name })));
    renderItems();
    updateOrderPreview();
    console.log('✅ Remoção concluída');
  } else {
    console.log('❌ Usuário cancelou remoção');
  }
}

// Salvar pedido
async function saveOrder() {
  if (isReadonly) {
    showAlert('Não é possível salvar. Pedido já foi enviado.', 'error');
    return;
  }
  
  try {
    showAlert('Salvando pedido...', 'info');
    
    // Preparar dados para salvar
    const updates = currentItems.map(item => ({
      id: item.id,
      qty: item.qty
    }));
    
    // Salvar cada item individualmente
    for (const update of updates) {
      const response = await fetch(`${window.APP_CONFIG.SUPABASE_URL}/rest/v1/order_items?id=eq.${update.id}`, {
        method: 'PATCH',
        headers: {
          'apikey': window.APP_CONFIG.SUPABASE_ANON,
          'Authorization': `Bearer ${window.APP_CONFIG.SUPABASE_ANON}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Prefer': 'return=minimal',
          'X-Client-Info': 'supabase-js-web',
          'Accept-Profile': currentSession?.schema || 'demo'
        },
        body: JSON.stringify({
          qty: update.qty
        })
      });
      
      if (!response.ok) {
        throw new Error(`Erro ao salvar item ${update.id}: ${response.status}`);
      }
    }
    
    showAlert('Pedido salvo com sucesso!', 'success');
    
  } catch (error) {
    console.error('❌ Erro ao salvar pedido:', error);
    showAlert('Erro ao salvar pedido. Tente novamente.', 'error');
  }
}

// Abrir modal de busca de produtos
function openProductSearchModal() {
  if (isReadonly) return;
  
  const modal = document.getElementById('product-search-modal');
  if (modal) {
    modal.style.display = 'flex';
    
    // Focar no input de busca
    const searchInput = document.getElementById('product-search-input');
    if (searchInput) {
      setTimeout(() => searchInput.focus(), 100);
    }
  }
}

// Fechar modal de busca de produtos
function closeProductSearchModal() {
  const modal = document.getElementById('product-search-modal');
  if (modal) {
    modal.style.display = 'none';
    
    // Limpar resultados
    const searchResults = document.getElementById('search-results');
    if (searchResults) {
      searchResults.innerHTML = '';
    }
    
    // Limpar input
    const searchInput = document.getElementById('product-search-input');
    if (searchInput) {
      searchInput.value = '';
    }
  }
}

// Buscar produtos
async function searchProducts() {
  const searchInput = document.getElementById('product-search-input');
  const searchResults = document.getElementById('search-results');
  const searchLoading = document.getElementById('search-loading');
  
  if (!searchInput || !searchResults || !searchLoading) return;
  
  const query = searchInput.value.trim();
  if (!query) {
    showAlert('Digite um termo para buscar', 'error');
    return;
  }
  
  try {
    // Mostrar loading
    searchLoading.style.display = 'block';
    searchResults.innerHTML = '';
    
    console.log('🔍 Buscando produtos:', query);
    
    // Buscar produtos que contenham o termo no nome ou código
    const response = await fetch(`${window.APP_CONFIG.SUPABASE_URL}/rest/v1/produtos_atacamax?or=(descricao.ilike.*${encodeURIComponent(query)}*,codprodfilho.ilike.*${encodeURIComponent(query)}*)&ativo=eq.S&limit=20`, {
      headers: {
        'apikey': window.APP_CONFIG.SUPABASE_ANON,
        'Authorization': `Bearer ${window.APP_CONFIG.SUPABASE_ANON}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-Client-Info': 'supabase-js-web',
        'Accept-Profile': currentSession?.schema || 'demo'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Erro HTTP: ${response.status}`);
    }
    
    const products = await response.json();
    console.log('✅ Produtos encontrados:', products.length);
    
    // Ocultar loading
    searchLoading.style.display = 'none';
    
    if (!products || products.length === 0) {
      searchResults.innerHTML = `
        <div class="search-empty">
          <div class="search-empty-icon">🔍</div>
          <p>Nenhum produto encontrado</p>
          <small>Tente buscar por outro termo</small>
        </div>
      `;
      return;
    }
    
    // Renderizar resultados
    searchResults.innerHTML = products.map(product => {
      const originalPrice = parseFloat(product.preco3 || '0');
      const promoPrice = parseFloat(product.promo3 || '0');
      const isPromotion = promoPrice > 0 && promoPrice < originalPrice;
      const finalPrice = isPromotion ? promoPrice : originalPrice;
      
      return `
        <div class="product-result">
          <div class="product-info">
            <div class="product-name">
              ${product.descricao}
              ${isPromotion ? '<span class="promo-badge">Promoção</span>' : ''}
            </div>
            <div class="product-code">Código: ${product.codprodfilho}</div>
          </div>
          <div class="product-price ${isPromotion ? 'promotion' : ''}">
            ${isPromotion ? `
              <div class="original-price">R$ ${originalPrice.toFixed(2).replace('.', ',')}</div>
              <div class="promo-price">R$ ${promoPrice.toFixed(2).replace('.', ',')}</div>
            ` : `R$ ${finalPrice.toFixed(2).replace('.', ',')}`}
          </div>
          <div class="product-actions">
            <div class="qty-selector">
              <label>Qtd:</label>
              <input type="number" value="1" min="1" step="1">
            </div>
            <button class="btn-add-to-order" data-product-id="${product.codprodfilho}">
              ✚ Adicionar
            </button>
          </div>
        </div>
      `;
    }).join('');
    
  } catch (error) {
    console.error('❌ Erro ao buscar produtos:', error);
    searchLoading.style.display = 'none';
    showAlert('Erro ao buscar produtos. Tente novamente.', 'error');
  }
}

// Adicionar produto ao pedido
async function addProductToOrder(productId, qty = 1) {
  if (isReadonly) return;
  
  try {
    console.log('➕ Adicionando produto ao pedido:', productId, qty);
    
    // Verificar se o produto já existe no pedido
    const existingItem = currentItems.find(item => item.product_id === productId);
    if (existingItem) {
      // Se já existe, apenas aumentar a quantidade localmente
      updateItemQuantityLocally(existingItem.id, existingItem.qty + qty);
      showAlert('Quantidade do produto atualizada!', 'success');
      closeProductSearchModal();
      return;
    }
    
    // Buscar dados do produto
    const response = await fetch(`${window.APP_CONFIG.SUPABASE_URL}/rest/v1/produtos_atacamax?codprodfilho=eq.${productId}&select=*`, {
      headers: {
        'apikey': window.APP_CONFIG.SUPABASE_ANON,
        'Authorization': `Bearer ${window.APP_CONFIG.SUPABASE_ANON}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-Client-Info': 'supabase-js-web',
        'Accept-Profile': currentSession?.schema || 'demo'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Erro HTTP: ${response.status}`);
    }
    
    const products = await response.json();
    if (!products || products.length === 0) {
      throw new Error('Produto não encontrado');
    }
    
    const product = products[0];
    
    // Calcular preços
    const originalPrice = parseFloat(product.preco3 || '0');
    const promoPrice = parseFloat(product.promo3 || '0');
    const unitPrice = (promoPrice > 0 && promoPrice < originalPrice) ? promoPrice : originalPrice;
    
    // Adicionar ao banco de dados
    const addResponse = await fetch(`${window.APP_CONFIG.SUPABASE_URL}/rest/v1/order_items`, {
      method: 'POST',
      headers: {
        'apikey': window.APP_CONFIG.SUPABASE_ANON,
        'Authorization': `Bearer ${window.APP_CONFIG.SUPABASE_ANON}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Prefer': 'return=representation',
        'X-Client-Info': 'supabase-js-web',
        'Accept-Profile': currentSession?.schema || 'demo'
      },
      body: JSON.stringify({
        session_id: currentSession.id,
        product_id: productId,
        qty: qty,
        unit_price: unitPrice,
        original_price: originalPrice,
        promo_price: promoPrice
      })
    });
    
    if (!addResponse.ok) {
      throw new Error(`Erro ao adicionar produto: ${addResponse.status}`);
    }
    
    const newItems = await addResponse.json();
    const newItem = newItems[0];
    
    // Adicionar à lista local
    currentItems.push({
      id: newItem.id,
      product_id: productId,
      name: product.descricao,
      code: product.codprodfilho,
      qty: qty,
      unit_price: unitPrice,
      original_price: originalPrice,
      promo_price: promoPrice,
      subtotal: unitPrice * qty
    });
    
    renderItems();
    updateOrderPreview();
    showAlert('Produto adicionado com sucesso!', 'success');
    closeProductSearchModal();
    
  } catch (error) {
    console.error('❌ Erro ao adicionar produto:', error);
    showAlert('Erro ao adicionar produto. Tente novamente.', 'error');
  }
}

// Abrir modal de aprovação
function openApproverModal() {
  if (isReadonly) {
    showAlert('Pedido já foi enviado.', 'error');
    return;
  }
  
  if (currentItems.length === 0) {
    showAlert('Adicione pelo menos um item ao pedido.', 'error');
    return;
  }
  
  const modal = document.getElementById('approver-modal');
  if (modal) {
    modal.style.display = 'flex';
    
    // Focar no primeiro input
    const firstInput = modal.querySelector('input[type="text"]');
    if (firstInput) {
      setTimeout(() => firstInput.focus(), 100);
    }
  }
}

// Fechar modal de aprovação
function closeApproverModal() {
  const modal = document.getElementById('approver-modal');
  if (modal) {
    modal.style.display = 'none';
    
    // Limpar formulário
    const form = document.getElementById('approver-form');
    if (form) {
      form.reset();
    }
  }
}

// Enviar pedido
async function submitOrder(e) {
  e.preventDefault();
  
  if (isReadonly) {
    showAlert('Pedido já foi enviado.', 'error');
    return;
  }
  
  if (currentItems.length === 0) {
    showAlert('Adicione pelo menos um item ao pedido.', 'error');
    return;
  }
  
  try {
    // Coletar dados do formulário
    const formData = new FormData(e.target);
    const approverData = {
      name: formData.get('name'),
      phone: formData.get('phone'),
      email: formData.get('email')
    };
    
    // Validar dados obrigatórios
    if (!approverData.name || !approverData.phone || !approverData.email) {
      showAlert('Todos os campos são obrigatórios.', 'error');
      return;
    }
    
    // Coletar dados de auditoria
    const connectionData = {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      screen: {
        width: screen.width,
        height: screen.height
      },
      url: window.location.href,
      timestamp: new Date().toISOString()
    };
    
    showAlert('Enviando pedido...', 'info');
    
    // Desabilitar botão de envio
    const submitBtn = document.getElementById('confirm-approval');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = '⏳ Enviando...';
    }
    
    // Enviar para a edge function
    const response = await fetch(`${window.APP_CONFIG.FUNCTIONS_BASE}/submit-order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        session_id: currentSession.id,
        schema: currentSession.schema || 'demo',
        approver: approverData,
        connection_data: connectionData
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Erro HTTP: ${response.status}`);
    }
    
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.message || 'Erro desconhecido');
    }
    
    console.log('✅ Pedido enviado com sucesso:', result);
    
    // Marcar como readonly
    isReadonly = true;
    currentSession.used = true;
    
    // Atualizar interface
    hideEditButtons();
    renderItems();
    updateSessionInfo();
    
    // Fechar modal
    closeApproverModal();
    
    // Mostrar sucesso
    showAlert(`Pedido #${result.data.order_number} enviado com sucesso! 🎉`, 'success');
    
  } catch (error) {
    console.error('❌ Erro ao enviar pedido:', error);
    showAlert(`Erro ao enviar pedido: ${error.message}`, 'error');
    
    // Reabilitar botão
    const submitBtn = document.getElementById('confirm-approval');
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = '✅ Confirmar Aprovação';
    }
  }
}

// Ocultar botões de edição
function hideEditButtons() {
  const buttonsToHide = [
    'add-product-btn',
    'main-add-product-btn',
    'footer-add-product-btn',
    'main-save-btn',
    'footer-save-btn',
    'main-submit-btn',
    'footer-submit-btn'
  ];
  
  buttonsToHide.forEach(id => {
    const btn = document.getElementById(id);
    if (btn) {
      btn.style.display = 'none';
    }
  });
  
  // Ocultar barra de ações flutuante
  const actionsBar = document.getElementById('actions-bar');
  if (actionsBar) {
    actionsBar.style.display = 'none';
  }
}

// Mostrar alerta
function showAlert(message, type = 'info') {
  const alertEl = document.getElementById('alert');
  if (!alertEl) return;
  
  // Definir classes baseadas no tipo
  let className = 'alert';
  switch (type) {
    case 'success':
      className += ' alert-success';
      break;
    case 'error':
      className += ' alert-error';
      break;
    case 'warning':
      className += ' alert-warning';
      break;
    default:
      className += ' alert-info';
  }
  
  alertEl.className = className;
  alertEl.textContent = message;
  alertEl.style.display = 'block';
  
  // Auto-hide após 5 segundos para mensagens de sucesso/info
  if (type === 'success' || type === 'info') {
    setTimeout(() => {
      alertEl.style.display = 'none';
    }, 5000);
  }
}

// Adicionar estilos para os diferentes tipos de alerta
const style = document.createElement('style');
style.textContent = `
  .alert-success {
    background: var(--success-light) !important;
    color: var(--success) !important;
    border-color: var(--success) !important;
  }
  
  .alert-error {
    background: var(--danger-light) !important;
    color: var(--danger) !important;
    border-color: var(--danger) !important;
  }
  
  .alert-warning {
    background: var(--warning-light) !important;
    color: var(--warning) !important;
    border-color: var(--warning) !important;
  }
  
  .alert-info {
    background: var(--primary-light) !important;
    color: var(--primary) !important;
    border-color: var(--primary) !important;
  }
`;
document.head.appendChild(style);
  