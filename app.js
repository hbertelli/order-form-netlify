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
        <button onclick="showReadonlyOrder()" style="
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

async function showReadonlyOrder() {
  try {
    // Recarregar os dados para visualização
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
            <button onclick="showUsedSessionPage()" type="button" style="
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
    
    // Renderizar itens em modo somente leitura
    renderItemsReadonly();
    
  } catch (error) {
    console.error('Erro ao carregar visualização:', error);
    alert('Erro ao carregar os dados do pedido: ' + error.message);
  }
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
        <button onclick="showReadonlyOrder()" style="
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

async function showReadonlyOrder() {
  try {
    // Recarregar os dados para visualização
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
            <button onclick="showUsedSessionPage()" type="button" style="
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
    
    // Renderizar itens em modo somente leitura
    renderItemsReadonly();
    
  } catch (error) {
    console.error('Erro ao carregar visualização:', error);
    alert('Erro ao carregar os dados do pedido: ' + error.message);
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
  db: { schema: "demo" }
});

let session = null;
let customerData = null;
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
    showUsedSessionPage();
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
  
  // Atualizar título com número do pedido se disponível
  const titleElement = document.querySelector('h1');
  if (session.estimated_order_number && titleElement) {
    titleElement.textContent = `📋 Revisar Pedido #${session.estimated_order_number}`;
  }
  
  // Buscar dados completos do cliente
  const { data: customer, error: customerError } = await supabase
    .from("clientes_atacamax")
    .select("codpessoa, nome, cpfcgc, nomefantazia, logradouro, numero, bairro, cidade, uf, cep")
    .eq("codpessoa", session.customer_id)
    .single();
  
  console.log('🔍 Debug - Buscando cliente com ID:', session.customer_id);
  console.log('🔍 Debug - Resultado da consulta do cliente:', { customer, customerError });
  
  if (customerError) {
    console.error('Erro ao buscar dados do cliente:', customerError);
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
    
    return `
      <div class="item-row" data-item-id="${it.id}">
        <div class="item-title-wrap">
          <div class="item-title">${p.descricao || 'Sem descrição'}</div>
          <div class="item-meta">Código: ${p.codprodfilho}</div>
        </div>
        <div class="item-price">${formatBRL(unitPrice)}</div>
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
    
  }
  )
}
// Inicializar quando o DOM estiver pronto
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}