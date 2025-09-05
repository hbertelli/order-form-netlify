import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cfg = window.APP_CONFIG || {};
const url = new URL(location.href);
const token = url.searchParams.get("token");

const alertBox   = document.getElementById("alert");
const itemsList  = document.getElementById("items-list");
const sessionInfo= document.getElementById("session-info");
const emptyHint  = document.getElementById("empty-hint");
const saveBtn    = document.getElementById("save-btn");
const submitBtn  = document.getElementById("submit-btn");

function showAlert(msg){ alertBox.textContent = msg || ""; alertBox.style.display = msg ? "block":"none"; }
function fmtDate(s){ try{ return new Date(s).toLocaleString("pt-BR",{timeZone:"America/Sao_Paulo"});}catch{ return s; } }

if (!token) { document.body.innerHTML = "Link inválido: token ausente."; throw new Error("token ausente"); }

const supabase = createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON, {
  db: { schema: "demo" },
  global: { headers: { Authorization: `Bearer ${token}` } }
});

let session=null, items=[];

/** Retorna true se hoje está dentro do período de promoção do produto */
function isPromoActive(p){
  if (!p) return false;
  const start = p.dtipromo ? new Date(p.dtipromo) : null;
  const end   = p.dtfpromo ? new Date(p.dtfpromo) : null;
  const now   = new Date();
  if (start && now < start) return false;
  if (end   && now > end)   return false;
  return true;
}

function toDecimal(v) {
  if (v == null) return NaN;
  if (typeof v === "number") return v;
  const s = String(v).replace(/\s+/g, "").replace(",", ".");
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : NaN;
}


function computeUnitPrice(p){
  if (!p) return null;
  const tabela = 3; // mude se quiser 1..6
  const base  = toDecimal(p[`preco${tabela}`]);
  const promo = toDecimal(p[`promo${tabela}`]);

  // menor válido entre os dois; se promo for 0/NaN, fica o base
  const candidates = [base, promo].filter(Number.isFinite);
  if (!candidates.length) return null;
  return Math.min(...candidates);
}



async function loadSession() {
  const { data, error } = await supabase
    .from("order_sessions")
    .select("id,expires_at,used,created_at")
    .single();
  if (error) throw error;
  if (!data) throw new Error("Sessão não encontrada.");
  if (data.used) throw new Error("Sessão já utilizada.");
  if (new Date(data.expires_at) < new Date()) throw new Error("Sessão expirada.");
  session = data;
  sessionInfo.textContent = `Expira em ${fmtDate(session.expires_at)}`;
}

async function loadItems() {
  // 1) Busca apenas os itens (sem join)
  const { data: rawItems, error } = await supabase
    .from("order_items")
    .select("id,session_id,product_id,qty")
    .order("id");
  if (error) throw error;

  const arr = rawItems || [];
  if (!arr.length) { items = []; return; }

  // 2) Busca os produtos correspondentes em produtos_atacamax
  const ids = Array.from(new Set(arr.map(it => it.product_id).filter(Boolean)));
  const { data: prods, error: prodErr } = await supabase
    .from("produtos_atacamax")
    .select(`
      codprodfilho,
      gtin,
      referencia,
      descricao,
      descricaocurta,
      descricaocompleta,
      preco1,preco2,preco3,preco4,preco5,preco6,
      promo1,promo2,promo3,promo4,promo5,promo6,
      estoque, dtipromo, dtfpromo, codgrupo, grupo, codsubgrupo, subgrupo, ativo
    `)
    .in("codprodfilho", ids);

  if (prodErr) throw prodErr;

  const byId = new Map((prods || []).map(p => [p.codprodfilho, p]));

  // 3) “Enriquece” os itens com o produto
  items = arr.map(it => {
    const p = byId.get(it.product_id) || null;
    const unit_price = computeUnitPrice(p);
    // LOG útil para depurar discrepâncias:
    console.log("Preço calc:", {
      product_id: it.product_id,
      descricao: p?.descricao,
      preco3: p?.preco3,
      promo3: p?.promo3,
      unit_price
    });
    return { ...it, produto: p, unit_price };
});

}

function renderItems() {
  itemsList.innerHTML = "";
  if (!items.length) { emptyHint.style.display = "block"; return; }
  emptyHint.style.display = "none";

  items.forEach((it, idx) => {
    console.log("Item recebido:", JSON.stringify(it, null, 2));

    const row = document.createElement("div");
    row.className = "item-row";

    const title = document.createElement("div");
    const nome  = it.produto?.descricao ?? `#${it.product_id}`;
    const ref   = it.produto?.referencia ?? it.produto?.gtin ?? "";
    title.innerHTML = `
      <div class="item-title">${nome}</div>
      <div class="item-meta">${ref}</div>
    `;

    const qty = document.createElement("input");
    qty.type = "number";
    qty.min  = "0";
    qty.value= String(it.qty ?? 0);
    qty.className = "qty-input";
    qty.addEventListener("input", () => {
      const v = parseInt(qty.value || "0", 10);
      items[idx].qty = isNaN(v) ? 0 : v;
    });

    const price = document.createElement("div");
    const val = it.unit_price;
    price.textContent = (val != null) ? `R$ ${val.toFixed(2)}` : "-";

    const del = document.createElement("button");
    del.textContent = "Remover";
    del.addEventListener("click", () => { items.splice(idx, 1); renderItems(); });

    row.append(title, qty, price, del);
    itemsList.appendChild(row);
  });
}

async function saveChanges() {
  if (!session) return;
  // sobrescreve itens da sessão com as quantidades atuais (>0)
  await supabase.from("order_items").delete().eq("session_id", session.id);
  const payload = items
    .filter(it => (it.qty ?? 0) > 0)
    .map(it => ({
      session_id: session.id,
      product_id: it.product_id,
      qty: it.qty
      // se quiser “congelar” preço na sessão, adicione unit_price aqui e crie a coluna correspondente:
      // unit_price: it.unit_price ?? null
    }));
  if (payload.length) {
    const { error } = await supabase.from("order_items").insert(payload);
    if (error) throw error;
  }
}

async function submitOrder() {
  const res = await fetch(`${cfg.FUNCTIONS_BASE}/submit-order`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error(`Falha ao enviar pedido: ${res.status}`);
}

(async function init(){
  try {
    await loadSession();
    await loadItems();
    renderItems();

    saveBtn.onclick = async () => {
      try { await saveChanges(); showAlert("Alterações salvas."); }
      catch (e) { showAlert(e.message); }
    };

    submitBtn.onclick = async () => {
      try {
        await saveChanges();
        await submitOrder();
        alert("Pedido enviado!");
        location.replace("about:blank");
      } catch (e) {
        showAlert(e.message);
      }
    };
  } catch (e) {
    showAlert(e.message || String(e));
  }
})();
