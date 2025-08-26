import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cfg = window.APP_CONFIG || {};
const url = new URL(location.href);
const token = url.searchParams.get("token");

const alertBox = document.getElementById("alert");
const itemsList = document.getElementById("items-list");
const sessionInfo = document.getElementById("session-info");
const emptyHint = document.getElementById("empty-hint");
const saveBtn = document.getElementById("save-btn");
const submitBtn = document.getElementById("submit-btn");

function showAlert(msg) { alertBox.textContent = msg || ""; alertBox.style.display = msg ? "block" : "none"; }
function fmtDate(s){ try{ return new Date(s).toLocaleString("pt-BR",{timeZone:"America/Sao_Paulo"});}catch{ return s; } }

if (!token) { document.body.innerHTML = "Link inválido: token ausente."; throw new Error("token ausente"); }

const supabase = createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON, {
  db: { schema: "demo" }, // ajuste se usar outro schema
  global: { headers: { Authorization: `Bearer ${token}` } }
});

let session=null, items=[];

async function loadSession() {
  const { data, error } = await supabase.from("order_sessions").select("id,expires_at,used,created_at").single();
  if (error) throw error;
  if (!data) throw new Error("Sessão não encontrada.");
  if (data.used) throw new Error("Sessão já utilizada.");
  if (new Date(data.expires_at) < new Date()) throw new Error("Sessão expirada.");
  session = data;
  sessionInfo.textContent = `Expira em ${fmtDate(session.expires_at)}`;
}

async function loadItems() {
  const { data, error } = await supabase
    .from("order_items")
    .select("id,session_id,product_id,qty,product_catalog(descricao,referencia,preco3,codprodfilho)")
    .order("id");
  if (error) throw error;
  items = data || [];
}

function renderItems() {
  itemsList.innerHTML = "";
  if (!items.length) { emptyHint.style.display = "block"; return; }
  emptyHint.style.display = "none";
  items.forEach((it, idx) => {
    console.log("Item recebido:", JSON.stringify(it, null, 2));
    const row = document.createElement("div"); row.className="item-row";
    const title = document.createElement("div");
    title.innerHTML = `<div class="item-title">${it.product_catalog?.descricao ?? it.product_id}</div>
                       <div class="item-meta">${it.product_catalog?.referencia ?? ""}</div>`;
    const qty = document.createElement("input");
    qty.type = "number"; qty.min="0"; qty.value = String(it.qty ?? 0); qty.className="qty-input";
    qty.addEventListener("input", ()=>{ const v=parseInt(qty.value||"0",10); items[idx].qty=isNaN(v)?0:v; });
    const price = document.createElement("div");
    price.textContent = (it.product_catalog?.preco3!=null) ? `R$ ${Number(it.product_catalog.preco3).toFixed(2)}` : "-";
    const del = document.createElement("button"); del.textContent="Remover";
    del.addEventListener("click", ()=>{ items.splice(idx,1); renderItems(); });
    row.append(title, qty, price, del);
    itemsList.appendChild(row);
  });
}

async function saveChanges() {
  if (!session) return;
  await supabase.from("order_items").delete().eq("session_id", session.id);
  const payload = items.filter(it => (it.qty??0)>0).map(it => ({ session_id: session.id, product_id: it.product_id, qty: it.qty }));
  if (payload.length) { const { error } = await supabase.from("order_items").insert(payload); if (error) throw error; }
}

async function submitOrder() {
  const res = await fetch(`${cfg.FUNCTIONS_BASE}/submit-order`, { method:"POST", headers:{ Authorization: `Bearer ${token}` }});
  if (!res.ok) throw new Error(`Falha ao enviar pedido: ${res.status}`);
}

(async function init(){
  try {
    await loadSession(); await loadItems(); renderItems();
    saveBtn.onclick = async ()=>{ try{ await saveChanges(); showAlert("Alterações salvas."); }catch(e){ showAlert(e.message);} };
    submitBtn.onclick = async ()=>{ try{ await saveChanges(); await submitOrder(); alert("Pedido enviado!"); location.replace("about:blank"); }catch(e){ showAlert(e.message);} };
  } catch(e){ showAlert(e.message || String(e)); }
})();
