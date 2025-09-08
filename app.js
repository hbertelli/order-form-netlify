import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cfg = window.APP_CONFIG || {};
const url = new URL(location.href);
const token = url.searchParams.get("token");

const alertBox    = document.getElementById("alert");
const itemsList   = document.getElementById("items-list");
const sessionInfo = document.getElementById("session-info");
const emptyHint   = document.getElementById("empty-hint");
const saveBtn     = document.getElementById("save-btn");
const submitBtn   = document.getElementById("submit-btn");

function showAlert(msg){ alertBox.textContent = msg || ""; alertBox.style.display = msg ? "block":"none"; }
function fmtDate(s){ try{ return new Date(s).toLocaleString("pt-BR",{ timeZone:"America/Sao_Paulo" }); } catch { return s; } }
if (!token) { document.body.innerHTML = "Link inválido: token ausente."; throw new Error("token ausente"); }

const supabase = createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON, {
  db: { schema: "demo" },
  global: {
    headers: {
      apikey: cfg.SUPABASE_ANON,
      Authorization: `Bearer ${token}`,
    },
  },
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

let footerTotalEl = null;
function updateFooterTotal(){
  if (footerTotalEl) footerTotalEl.textContent = formatBRL(grandTotal());
}

/* ---------- data ---------- */
async function loadSession(){
  const { data, error } = await supabase
    .from("order_sessions")
    .select("id, expires_at, used, created_at")
    .single();
  if (error) throw error;
  if (!data) throw new Error("Sessão não encontrada.");
  if (data.used) throw new Error("Sessão já utilizada.");
  if (new Date(data.expires_at) < new Date()) throw new Error("Sessão expirada.");
  session = data;
  sessionInfo.textContent = `Expira em ${fmtDate(session.expires_at)}`;
}

async function loadItems(){
  // 1) itens (sem join)
  const { data: rawItems, error } = await supabase
    .from("order_items")
    .select("id, session_id, product_id, qty")
    .order("id");
  if (error) throw error;

  const arr = rawItems || [];
  if (!arr.length){ items = []; return; }

  // 2) busca produtos em lotes (ids normalizados como string)
  const idStrs = Array.from(new Set(arr.map(it => String(it.product_id)).filter(Boolean)));
  const batches = chunk(idStrs, 200); // lote de 200 para evitar URLs longas
  let prods = [];

  for (const part of batches){
    // para coluna numeric/bigint, mandamos números mesmo
    const asNumbers = part.map(s => Number(s)).filter(n => Number.isFinite(n));
    const { data, error: prodErr } = await supabase
      .from("produtos_atacamax")
      .select("codprodfilho, descricao, referencia, gtin, preco3, promo3, ativo")
      .in("codprodfilho", asNumbers);
    if (prodErr) throw prodErr;
    prods = prods.concat(data || []);
  }

  // 3) index por string(codprodfilho)
  const byId = new Map(prods.map(p => [String(p.codprodfilho), p]));

  items = arr.map(it => {
    const p = byId.get(String(it.product_id)) || null;
    const unit_price = computeUnitPrice(p);
    return { ...it, produto: p, unit_price };
  });

  const misses = items.filter(x => !x.produto).length;
  if (misses) console.warn(`Produtos não encontrados para ${misses}/${items.length} itens.`);
}

/* ---------- render ---------- */
function renderItems(){
  itemsList.innerHTML = "";
  if (!items.length){ emptyHint.style.display = "block"; return; }
  emptyHint.style.display = "none";

  items.forEach((it, idx) => {
    const row = document.createElement("div");
    row.className = "item-row";

    const title = document.createElement("div");
    title.className = "item-title-wrap";
    const nome  = it.produto?.descricao ?? `#${it.product_id}`;
    const ref   = it.produto?.referencia ?? it.produto?.gtin ?? "";
    title.innerHTML = `
      <div class="item-title">${nome}</div>
      <div class="item-meta">${ref}</div>
    `;

    const qty = document.createElement("input");
    qty.type = "number"; qty.min = "0"; qty.value = String(it.qty ?? 0);
    qty.className = "qty-input";
    qty.addEventListener("input", () => {
      const v = parseInt(qty.value || "0", 10);
      items[idx].qty = Number.isFinite(v) ? v : 0;
      // atualiza subtotal em tempo real
      const up = it.unit_price ?? null;
      subtotal.textContent = (up!=null) ? formatBRL((items[idx].qty||0)*up) : "-";
      updateTotal();
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
    del.textContent = "Remover";
    del.addEventListener("click", () => { items.splice(idx, 1); renderItems(); updateTotal(); });

    row.append(title, price, qty, subtotal, del);
    itemsList.appendChild(row);
  });
}

// se tiver um elemento de total com id="order-total", atualiza:
const totalEl = document.getElementById("order-total");
function updateTotal(){
  if (!totalEl) return;
  const sum = items.reduce((s,it)=> s + ((it.unit_price??0)* (it.qty??0)), 0);
  totalEl.textContent = formatBRL(sum);
}



/* --------- footer -----------------*/

function mountFooter(){
  const footer = document.createElement("div");
  footer.id = "cart-footer";
  footer.innerHTML = `
    <div class="footer-inner">
      <div class="footer-total">Total: <strong id="footer-total">R$ 0,00</strong></div>
      <div class="footer-actions">
        <button id="footer-save" class="btn-secondary" type="button">Salvar</button>
        <button id="footer-submit" class="btn-primary" type="button">Enviar pedido</button>
      </div>
    </div>
  `;
  document.body.appendChild(footer);

  footerTotalEl = document.getElementById("footer-total");
  const footerSave   = document.getElementById("footer-save");
  const footerSubmit = document.getElementById("footer-submit");

  // reaproveita suas funções existentes
  footerSave.onclick = async () => {
    try { await saveChanges(); showAlert("Alterações salvas."); updateFooterTotal(); }
    catch(e){ showAlert(e.message); }
  };
  footerSubmit.onclick = async () => {
    try { await saveChanges(); await submitOrder(); }
    catch(e){ showAlert(e.message); }
  };
}



/* ---------- persist / submit ---------- */
async function saveChanges(){
  if (!session) return;
  await supabase.from("order_items").delete().eq("session_id", session.id);
  const payload = items
    .filter(it => (it.qty ?? 0) > 0)
    .map(it => ({ session_id: session.id, product_id: it.product_id, qty: it.qty }));
  if (payload.length){
    const { error } = await supabase.from("order_items").insert(payload);
    if (error) throw error;
  }
}
async function submitOrder(){
  const res = await fetch(`${cfg.FUNCTIONS_BASE}/submit-order`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error(`Falha ao enviar pedido: ${res.status}`);
}

/* ---------- boot ---------- */
(async function init(){
  try{
    await loadSession();
    await loadItems();
    renderItems();
    mountFooter();           // << novo
    updateFooterTotal();     // << garante total correto ao abrir


    saveBtn.onclick = async () => {
      try{ await saveChanges(); showAlert("Alterações salvas."); }
      catch(e){ showAlert(e.message); }
    };
    submitBtn.onclick = async () => {
      try{
        await saveChanges();
        await submitOrder();
        alert("Pedido enviado!");
        location.replace("about:blank");
      } catch(e){ showAlert(e.message); }
    };
  } catch(e){
    showAlert(e.message || String(e));
  }
})();
