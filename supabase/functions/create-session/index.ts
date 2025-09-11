import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    })
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      db: { schema: 'demo' }
    })

    const { customer_id, cnpj } = await req.json()

    // Validar se pelo menos um parâmetro foi fornecido
    if (!customer_id && !cnpj) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'MISSING_IDENTIFIER',
          message: 'customer_id ou cnpj é obrigatório',
          details: 'Pelo menos um dos parâmetros (customer_id ou cnpj) deve ser fornecido na requisição'
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    let customer = null
    let customerError = null
    let searchCriteria = ''

    if (customer_id) {
      // Busca por código do cliente
      const { data, error } = await supabase
        .from('clientes_atacamax')
        .select('codpessoa, nome, cpfcgc')
        .eq('codpessoa', customer_id)
        .single()
      
      customer = data
      customerError = error
      searchCriteria = `código ${customer_id}`
    } else if (cnpj) {
      // Limpar formatação do CNPJ de entrada
      const cleanInputCnpj = cnpj.replace(/[^\d]/g, '')
      
      if (cleanInputCnpj.length !== 14) {
        return new Response(
          JSON.stringify({ 
            success: false,
            error: 'INVALID_CNPJ_FORMAT',
            message: 'CNPJ inválido',
            details: 'O CNPJ deve conter exatamente 14 dígitos',
            cnpj: cnpj
          }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        )
      }

      // Busca por CNPJ usando função para limpar formatação no PostgreSQL
      const { data, error } = await supabase
        .from('clientes_atacamax')
        .select('cod_cliente, nome, cpfcgc')
        .filter('cpfcgc', 'eq', cleanInputCnpj)
        .single()
      
      // Se não encontrou com busca direta, tenta com regex
      if (error && error.code === 'PGRST116') {
        const { data: dataRegex, error: errorRegex } = await supabase
          .from('clientes_atacamax')
          .select('codpessoa, nome, cpfcgc')
          .filter('regexp_replace(cpfcgc, \'[^0-9]\', \'\', \'g\')', 'eq', cleanInputCnpj)
          .single()
        
        customer = dataRegex
        customerError = errorRegex
      } else {
        customer = data
        customerError = error
          .select('codpessoa, nome, cpfcgc')
      }
      
      searchCriteria = `CNPJ ${cnpj}`
    }

    if (customerError || !customer) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'CUSTOMER_NOT_FOUND',
          message: 'Cliente não encontrado',
          details: `O cliente com ${searchCriteria} não existe no sistema`,
          search_criteria: searchCriteria,
          customer_id: customer_id || null,
          cnpj: cnpj || null,
          debug_error: customerError?.message || 'Nenhum erro específico'
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Cliente existe, buscar produtos do último pedido na view
    const { data: lastOrderProducts, error: lastOrderError } = await supabase
      .from('v_last_order_by_product_atacamax')
      .select('cod_cliente, codprodfilho, qtde')
      .eq('cod_cliente', customer.codpessoa)

    if (lastOrderError) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'LAST_ORDER_QUERY_ERROR',
          message: 'Erro ao consultar último pedido',
          details: lastOrderError.message,
          customer_id: customer.codpessoa,
          debug_query: 'v_last_order_by_product_atacamax'
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    console.log('🔍 Debug - Customer object:', customer)
    console.log('🔍 Debug - Customer ID usado na query:', customer.codpessoa)
    console.log('🔍 Debug - Last order products found:', lastOrderProducts?.length || 0)

    if (!lastOrderProducts || lastOrderProducts.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'NO_LAST_ORDER_FOUND',
          message: 'Nenhum pedido anterior encontrado',
          details: 'Não foram encontrados produtos no último pedido deste cliente',
          customer_id: customer.codpessoa,
          customer_name: customer.nome
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Buscar preços atuais dos produtos
    const productIds = lastOrderProducts.map(p => p.codprodfilho)
    const { data: currentProducts, error: productsError } = await supabase
      .from('produtos_atacamax')
      .select('codprodfilho, descricao, referencia, gtin, preco3, promo3, ativo')
      .in('codprodfilho', productIds)
      .eq('ativo', 'S')

    if (productsError) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'PRODUCTS_QUERY_ERROR',
          message: 'Erro ao consultar produtos atuais',
          details: productsError.message,
          customer_id: customer.codpessoa,
          product_ids: productIds
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    if (!currentProducts || currentProducts.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'NO_ACTIVE_PRODUCTS_FOUND',
          message: 'Nenhum produto ativo encontrado',
          details: 'Os produtos do último pedido não estão mais ativos no sistema',
          customer_id: customer.codpessoa,
          customer_name: customer.nome,
          requested_products: productIds.length
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Criar mapa de produtos atuais por ID
    const productsMap = new Map(currentProducts.map(p => [p.codprodfilho, p]))

    // Criar sessão
    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + 24) // Expira em 24 horas

    const { data: session, error: sessionError } = await supabase
      .from('order_sessions')
      .insert({
        customer_id: customer.codpessoa,
        expires_at: expiresAt.toISOString(),
        used: false
      }
      )
      .select('id, customer_id, expires_at, used, created_at')
      .single()

    if (sessionError) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'SESSION_CREATION_FAILED',
          message: 'Erro ao criar sessão',
          details: sessionError.message,
          customer_id: customer.codpessoa
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Criar itens do pedido com quantidades do último pedido e preços atuais
    const orderItems = lastOrderProducts
      .map(lastProduct => {
        const currentProduct = productsMap.get(lastProduct.codprodfilho)
        if (!currentProduct) return null // Produto não está mais ativo
        
        return {
          session_id: session.id,
          product_id: lastProduct.codprodfilho,
          qty: lastProduct.qtde || 1
        }
      })
      .filter(Boolean) // Remove produtos nulos

    if (orderItems.length > 0) {
      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems)

      if (itemsError) {
        // Se falhar ao criar itens, remove a sessão criada
        await supabase.from('order_sessions').delete().eq('id', session.id)
        
        return new Response(
          JSON.stringify({ 
            success: false,
            error: 'ORDER_ITEMS_CREATION_FAILED',
            message: 'Erro ao criar itens do pedido',
            details: itemsError.message,
            session_id: session.id
          }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        )
      }
    }

    // Usar o session_id diretamente como token
    const token = session.id
    const orderUrl = `${req.headers.get('origin') || 'https://stellar-cranachan-2b11bb.netlify.app'}/?token=${token}`

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          session_id: session.id,
          customer: {
             id: customer.codpessoa,
            name: customer.nome,
            cnpj: customer.cpfcgc
          },
          expires_at: session.expires_at,
          order_url: orderUrl,
          token: token,
          items_loaded: orderItems.length,
          total_products_found: currentProducts.length
        },
        message: `Sessão criada com sucesso para ${customer.nome} com ${orderItems.length} itens do último pedido`
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )

  } catch (error) {
    console.error('Erro na create-session:', error)
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: 'INTERNAL_SERVER_ERROR',
        message: 'Erro interno do servidor',
        details: error.message 
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})