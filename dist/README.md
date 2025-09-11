# Order Form — Netlify

Deploy estático para Netlify que consome Supabase:
- Lê token (?token=...) da URL
- Carrega sessão/itens no schema `demo` (RLS por claim `sid`)
- Edita/remover/salva e envia para Edge Function `submit-order`

## Como publicar
1. Crie um site novo no Netlify e faça **drag-and-drop** desta pasta (ou conecte ao Git).
2. Antes do deploy, edite `config.js` com:
   - SUPABASE_URL: `https://<PROJECT>.supabase.co`
   - SUPABASE_ANON: sua anon key pública
   - FUNCTIONS_BASE: `https://<PROJECT>.supabase.co/functions/v1`
3. A URL final ficará algo como `https://<seusite>.netlify.app/?token=<JWT>`.
