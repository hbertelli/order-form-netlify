import { createClient } from 'npm:@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const resendApiKey = Deno.env.get('RESEND_API_KEY')!

const corsHeaders = {
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
      headers: corsHeaders,
    })
  }

  try {
    console.log('🔍 Submit-order - Iniciando processamento')
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      db: { schema: 'demo' }
    })

    // Extrair session_id do body da requisição
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
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
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
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    console.log('🔍 Submit-order - Session ID recebido:', sessionId)

    // Verificar se a sessão existe e não foi usada
    const { data: session, error: sessionError } = await supabase
      .from('order_sessions')
      .select('id, customer_id, expires_at, used, estimated_order_number')
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
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
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
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
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
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
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
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
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
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
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
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Buscar dados dos produtos
    const productIds = orderItems.map(item => item.product_id)
    const { data: products, error: productsError } = await supabase
      .from('produtos_atacamax')
      .select('codprodfilho, descricao, preco3, promo3')
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
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
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
      const subtotal = precoFinal * parseFloat(item.qty || '0')
      
      totalPedido += subtotal

      return {
        product_id: item.product_id,
        descricao: produto?.descricao || 'Produto não encontrado',
        codigo: produto?.codprodfilho || item.product_id,
        qty: parseFloat(item.qty || '0'),
        preco_unitario: precoFinal,
        subtotal: subtotal
      }
    })

    console.log('🔍 Debug - Total do pedido:', totalPedido)
    console.log('🔍 Debug - Itens detalhados:', itensDetalhados.length)

    // Preparar payload completo do pedido
    const orderPayload = {
      customer: {
        id: customer.codpessoa,
        name: customer.nome,
        cnpj: customer.cpfcgc
      },
      items: itensDetalhados,
      totals: {
        total_items: orderItems.length,
        total_value: totalPedido
      },
      session_info: {
        session_id: sessionId,
        submitted_at: new Date().toISOString()
      }
    }

    // Salvar pedido na tabela orders_submitted
    const { data: savedOrder, error: saveOrderError } = await supabase
      .from('orders_submitted')
      .insert({
        session_id: sessionId,
        customer_id: session.customer_id,
        order_number: session.estimated_order_number, // Use the same number from session
        payload: orderPayload
      })
      .select('id, order_number, submitted_at')
      .single()

    if (saveOrderError) {
      console.error('Erro ao salvar pedido:', saveOrderError)
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'ORDER_SAVE_ERROR',
          message: 'Erro ao salvar pedido no banco de dados',
          details: saveOrderError.message
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    console.log('✅ Pedido salvo na tabela orders_submitted:', savedOrder.id)
    console.log('📋 Número do pedido:', savedOrder.order_number)

    // Enviar email de notificação
    try {
      await sendOrderNotificationEmail(orderPayload, savedOrder.id, savedOrder.order_number)
      console.log('✅ Email de notificação enviado com sucesso')
    } catch (emailError) {
      console.error('❌ Erro ao enviar email:', emailError)
      // Não falha o processo se o email falhar
    }

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
      orderId: savedOrder.id,
      orderNumber: savedOrder.order_number,
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
          order_id: savedOrder.id,
          order_number: savedOrder.order_number,
          session_id: sessionId,
          customer: {
            id: customer.codpessoa,
            name: customer.nome,
            cnpj: customer.cpfcgc
          },
          items: itensDetalhados,
          total_items: orderItems.length,
          total_value: totalPedido,
          submitted_at: savedOrder.submitted_at
        }
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
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
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
async function sendOrderNotificationEmail(orderPayload: any, orderId: string, orderNumber: number) {
  const emailHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #2563eb; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; }
        .customer-info { background: white; padding: 15px; border-radius: 6px; margin-bottom: 20px; }
        .items-table { width: 100%; border-collapse: collapse; background: white; border-radius: 6px; overflow: hidden; }
        .items-table th, .items-table td { padding: 12px; text-align: left; border-bottom: 1px solid #e5e7eb; }
        .items-table th { background: #f3f4f6; font-weight: 600; }
        .total { background: #059669; color: white; padding: 15px; text-align: center; border-radius: 6px; margin-top: 20px; }
        .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #6b7280; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🛒 Novo Pedido Recebido</h1>
          <p>Pedido #${orderNumber}</p>
        </div>
        
        <div class="content">
          <div class="customer-info">
            <h3>👤 Dados do Cliente</h3>
            <p><strong>Nome:</strong> ${orderPayload.customer.name}</p>
            <p><strong>Código:</strong> ${orderPayload.customer.id}</p>
            <p><strong>CNPJ:</strong> ${orderPayload.customer.cnpj}</p>
          </div>
          
          <h3>📦 Itens do Pedido</h3>
          <table class="items-table">
            <thead>
              <tr>
                <th>Código</th>
                <th>Produto</th>
                <th>Qtd</th>
                <th>Preço Unit.</th>
                <th>Subtotal</th>
              </tr>
            </thead>
            <tbody>
              ${orderPayload.items.map(item => `
                <tr>
                  <td>${item.codigo}</td>
                  <td>${item.descricao}</td>
                  <td>${item.qty}</td>
                  <td>R$ ${item.preco_unitario.toFixed(2).replace('.', ',')}</td>
                  <td>R$ ${item.subtotal.toFixed(2).replace('.', ',')}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          
          <div class="total">
            <h3>💰 Total do Pedido: R$ ${orderPayload.totals.total_value.toFixed(2).replace('.', ',')}</h3>
            <p>${orderPayload.totals.total_items} itens</p>
          </div>
        </div>
        
        <div class="footer">
          <p>Pedido enviado em ${new Date(orderPayload.session_info.submitted_at).toLocaleString('pt-BR')}</p>
          <p>Sistema de Pedidos - Wise Sales</p>
        </div>
      </div>
    </body>
    </html>
  `

  const emailPayload = {
    from: 'Sistema de Pedidos <onboarding@resend.dev>',
    to: ['hilton.bertelli@wisesales.com.br'],
    subject: `🛒 Pedido #${orderNumber} - ${orderPayload.customer.name} - R$ ${orderPayload.totals.total_value.toFixed(2).replace('.', ',')}`,
    html: emailHtml
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(emailPayload),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Falha ao enviar email: ${response.status} - ${errorText}`)
  }

  const result = await response.json()
  console.log('📧 Email enviado:', result.id)
  
  return result
}