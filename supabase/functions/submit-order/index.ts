import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const customCorsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-requested-with',
  'Access-Control-Max-Age': '86400',
}

Deno.serve(async (req: Request) => {
  console.log('🔍 Submit-order - Método:', req.method)
  console.log('🔍 Submit-order - Headers:', Object.fromEntries(req.headers.entries()))
  console.log('🔍 Submit-order - URL:', req.url)
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('🔍 Submit-order - Respondendo OPTIONS')
    return new Response(null, {
      status: 200,
      headers: customCorsHeaders,
    })
  }

  try {
    console.log('🔍 Submit-order - Iniciando processamento')
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      db: { schema: 'demo' }
    })

    // Extrair session_id do body da requisição ao invés do header Authorization
    let sessionId
    
    try {
      const body = await req.json()
      sessionId = body.session_id
      console.log('🔍 Submit-order - Session ID do body:', sessionId)
    } catch (error) {
      console.log('❌ Submit-order - Erro ao ler body:', error)
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'INVALID_REQUEST_BODY',
          message: 'Corpo da requisição inválido'
        }),
        {
          status: 400,
          headers: { ...customCorsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }
    
    if (!sessionId) {
      console.log('❌ Submit-order - Session ID não fornecido')
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'MISSING_SESSION_ID',
          message: 'Session ID não fornecido'
        }),
        {
          status: 400,
          headers: { ...customCorsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    console.log('🔍 Submit-order - Session ID recebido:', sessionId)

    // Verificar se a sessão existe e não foi usada
    const { data: session, error: sessionError } = await supabase
      .from('order_sessions')
      .select('id, customer_id, expires_at, used')
      .eq('id', sessionId)
      .single()

    if (sessionError || !session) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'INVALID_SESSION',
          message: 'Sessão não encontrada ou inválida'
        }),
        {
          status: 401,
          headers: { ...customCorsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    if (session.used) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'SESSION_ALREADY_USED',
          message: 'Esta sessão já foi utilizada'
        }),
        {
          status: 400,
          headers: { ...customCorsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    if (new Date(session.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'SESSION_EXPIRED',
          message: 'Sessão expirada'
        }),
        {
          status: 400,
          headers: { ...customCorsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Buscar itens da sessão
    const { data: orderItems, error: itemsError } = await supabase
      .from('order_items')
      .select('id, product_id, qty')
      .eq('session_id', sessionId)

    if (itemsError) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'ITEMS_QUERY_ERROR',
          message: 'Erro ao buscar itens do pedido',
          details: itemsError.message
        }),
        {
          status: 500,
          headers: { ...customCorsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    if (!orderItems || orderItems.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'NO_ITEMS',
          message: 'Nenhum item encontrado no pedido'
        }),
        {
          status: 400,
          headers: { ...customCorsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    console.log('🔍 Debug - Itens encontrados:', orderItems.length)

    // Buscar dados do cliente
    const { data: customer, error: customerError } = await supabase
      .from('clientes_atacamax')
      .select('codpessoa, nome, cpfcgc')
      .eq('codpessoa', session.customer_id)
      .single()

    if (customerError || !customer) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'CUSTOMER_NOT_FOUND',
          message: 'Cliente não encontrado'
        }),
        {
          status: 400,
          headers: { ...customCorsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Buscar dados dos produtos
    const productIds = orderItems.map(item => item.product_id)
    const { data: products, error: productsError } = await supabase
      .from('produtos_atacamax')
      .select('codprodfilho, descricao, referencia, gtin, preco3, promo3')
      .in('codprodfilho', productIds)

    if (productsError) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'PRODUCTS_QUERY_ERROR',
          message: 'Erro ao buscar dados dos produtos',
          details: productsError.message
        }),
        {
          status: 500,
          headers: { ...customCorsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Criar mapa de produtos
    const productsMap = new Map(products?.map(p => [p.codprodfilho, p]) || [])

    // Calcular total do pedido
    let totalPedido = 0
    const itensDetalhados = orderItems.map(item => {
      const produto = productsMap.get(item.product_id)
      const precoBase = parseFloat(produto?.preco3 || '0')
      const precoPromo = parseFloat(produto?.promo3 || '0')
      const precoFinal = (precoPromo > 0 && precoPromo < precoBase) ? precoPromo : precoBase
      const subtotal = precoFinal * item.qty
      
      totalPedido += subtotal

      return {
        product_id: item.product_id,
        descricao: produto?.descricao || 'Produto não encontrado',
        referencia: produto?.referencia || '',
        gtin: produto?.gtin || '',
        qty: item.qty,
        preco_unitario: precoFinal,
        subtotal: subtotal
      }
    })

    console.log('🔍 Debug - Total do pedido:', totalPedido)
    console.log('🔍 Debug - Itens detalhados:', itensDetalhados.length)

    // Marcar sessão como usada
    const { error: updateError } = await supabase
      .from('order_sessions')
      .update({ used: true })
      .eq('id', sessionId)

    if (updateError) {
      console.error('Erro ao marcar sessão como usada:', updateError)
      // Não falha o processo, apenas loga o erro
    }

    // Aqui você pode adicionar lógica adicional como:
    // - Salvar o pedido em uma tabela de pedidos
    // - Enviar email de notificação
    // - Integrar com sistema externo
    // - etc.

    console.log('✅ Pedido processado com sucesso:', {
      sessionId,
      customerId: session.customer_id,
      customerName: customer.nome,
      totalItems: orderItems.length,
      totalValue: totalPedido
    })

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Pedido enviado com sucesso',
        data: {
          session_id: sessionId,
          customer: {
            id: customer.codpessoa,
            name: customer.nome,
            cnpj: customer.cpfcgc
          },
          items: itensDetalhados,
          total_items: orderItems.length,
          total_value: totalPedido,
          submitted_at: new Date().toISOString()
        }
      }),
      {
        status: 200,
        headers: { ...customCorsHeaders, 'Content-Type': 'application/json' },
      }
    )

  } catch (error) {
    console.error('Erro na submit-order:', error)
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: 'INTERNAL_SERVER_ERROR',
        message: 'Erro interno do servidor',
        details: error.message 
      }),
      {
        status: 500,
        headers: { ...customCorsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})