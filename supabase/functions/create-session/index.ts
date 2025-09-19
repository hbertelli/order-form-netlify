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
    const { customer_id, cnpj, schema, view_name } = await req.json()

    // Validar parâmetros obrigatórios
    const requestSchema = schema || 'demo'
    const requestViewName = view_name || 'v_last_order_by_product_atacamax'

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      db: { schema: requestSchema }
    })

    console.log('🔍 Debug - Parâmetros recebidos:', {
      customer_id,
      cnpj,
      schema: requestSchema,
      view_name: requestViewName
    })

    // Detectar automaticamente se é CNPJ ou customer_id
    let actualCustomerId = customer_id
    let actualCnpj = cnpj
    
    // Se customer_id parece ser um CNPJ (14 dígitos), mover para cnpj
    if (customer_id && typeof customer_id === 'string') {
      const cleanCustomerId = customer_id.replace(/[^\d]/g, '')
      if (cleanCustomerId.length === 14) {
        actualCnpj = customer_id
        actualCustomerId = null
        console.log('🔍 Debug - customer_id detectado como CNPJ:', customer_id)
      }
    }

    // Validar se pelo menos um parâmetro foi fornecido
    if (!actualCustomerId && !actualCnpj) {
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

    if (actualCustomerId) {
      // Busca por código do cliente
      const { data, error } = await supabase
        .from('clientes_atacamax')
        .select('codpessoa, nome, cpfcgc, nomefantazia, logradouro, numero, bairro, cidade, uf, cep')
        .eq('codpessoa', actualCustomerId)
        .single()
      
      customer = data
      customerError = error
      searchCriteria = `código ${actualCustomerId}`
    } else if (actualCnpj) {
      // Limpar formatação do CNPJ de entrada
      const cleanInputCnpj = actualCnpj.replace(/[^\d]/g, '')
      
      if (cleanInputCnpj.length !== 14) {
        return new Response(
          JSON.stringify({ 
            success: false,
            error: 'INVALID_CNPJ_FORMAT',
            message: 'CNPJ inválido',
            details: 'O CNPJ deve conter exatamente 14 dígitos',
            cnpj: actualCnpj
          }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        )
      }

      console.log('🔍 Debug - Buscando CNPJ:', cleanInputCnpj)
      
      // Função para formatar CNPJ
      const formatCnpj = (cnpj) => {
        const clean = cnpj.replace(/[^\d]/g, '')
        if (clean.length !== 14) return cnpj
        return `${clean.substring(0,2)}.${clean.substring(2,5)}.${clean.substring(5,8)}/${clean.substring(8,12)}-${clean.substring(12,14)}`
      }
      
      const formattedCnpj = formatCnpj(cleanInputCnpj)
      console.log('🔍 Debug - CNPJ formatado:', formattedCnpj)
      
      // Primeira tentativa: busca por CNPJ formatado
      let { data, error } = await supabase
        .from('clientes_atacamax')
        .select('codpessoa, nome, cpfcgc, nomefantazia, logradouro, numero, bairro, cidade, uf, cep')
        .eq('cpfcgc', formattedCnpj)
        .maybeSingle()
      
      console.log('🔍 Debug - Busca formatada resultado:', { data, error })
      
      // Se não encontrou, tenta busca com CNPJ limpo
      if (!data && !error) {
        console.log('🔍 Debug - Tentando busca com CNPJ limpo:', cleanInputCnpj)
        const result2 = await supabase
          .from('clientes_atacamax')
          .select('codpessoa, nome, cpfcgc, nomefantazia, logradouro, numero, bairro, cidade, uf, cep')
          .eq('cpfcgc', cleanInputCnpj)
          .maybeSingle()
        
        data = result2.data
        error = result2.error
        console.log('🔍 Debug - Busca limpa resultado:', { data, error })
      }
      
      // Se não encontrou, tenta busca com CNPJ original (como veio na requisição)
      if (!data && !error && actualCnpj !== formattedCnpj && actualCnpj !== cleanInputCnpj) {
        console.log('🔍 Debug - Tentando busca com CNPJ original:', actualCnpj)
        const result3 = await supabase
          .from('clientes_atacamax')
          .select('codpessoa, nome, cpfcgc, nomefantazia, logradouro, numero, bairro, cidade, uf, cep')
          .eq('cpfcgc', actualCnpj)
          .maybeSingle()
        
        data = result3.data
        error = result3.error
        console.log('🔍 Debug - Busca original resultado:', { data, error })
      }
      
      // Se ainda não encontrou, tenta busca com LIKE para encontrar padrões similares
      if (!data && !error) {
        console.log('🔍 Debug - Tentando busca com LIKE')
        const result4 = await supabase
          .from('clientes_atacamax')
          .select('codpessoa, nome, cpfcgc, nomefantazia, logradouro, numero, bairro, cidade, uf, cep')
          .like('cpfcgc', `%${cleanInputCnpj}%`)
          .limit(5)
        
        console.log('🔍 Debug - Busca LIKE resultado:', result4)
        
        if (result4.data && result4.data.length === 1) {
          data = result4.data[0]
          error = result4.error
        } else if (result4.data && result4.data.length > 1) {
          console.log('🔍 Debug - Múltiplos resultados encontrados:', result4.data.map(c => ({ id: c.codpessoa, cnpj: c.cpfcgc })))
          // Tenta encontrar match exato nos resultados
          const exactMatch = result4.data.find(c => 
            c.cpfcgc?.replace(/[^\d]/g, '') === cleanInputCnpj
          )
          if (exactMatch) {
            data = exactMatch
            error = null
          }
        }
      }
      
      customer = data
      customerError = error
      
      searchCriteria = `CNPJ ${actualCnpj}`
    }

    if (customerError || !customer) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'CUSTOMER_NOT_FOUND',
          message: 'Cliente não encontrado',
          details: `O cliente com ${searchCriteria} não existe no sistema`,
          search_criteria: searchCriteria,
          customer_id: actualCustomerId || null,
          cnpj: actualCnpj || null,
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
      .from(requestViewName)
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
          debug_query: requestViewName,
          schema: requestSchema
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
          customer_name: customer.nome,
          view_used: requestViewName,
          schema: requestSchema
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
      .select('codprodfilho, descricao, preco3, promo3, ativo')
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
    expiresAt.setHours(expiresAt.getHours() + 48) // Expira em 48 horas

    // Buscar o próximo número de pedido para exibição
    const { data: nextOrderNumber, error: nextOrderError } = await supabase
      .rpc('get_and_consume_order_number')
    
    console.log('🔍 Debug - Next order number query:', { nextOrderNumber, nextOrderError })
    
    const estimatedOrderNumber = nextOrderNumber || null
    console.log('🔍 Debug - Estimated order number:', estimatedOrderNumber)
    
    const { data: session, error: sessionError } = await supabase
      .from('order_sessions')
      .insert({
        customer_id: customer.codpessoa,
        expires_at: expiresAt.toISOString(),
        used: false,
        estimated_order_number: estimatedOrderNumber,
        schema: requestSchema,
        view_name: requestViewName
      }
      )
      .select('codpessoa, nome, cpfcgc, nomefantazia, razaosocial, endereco, numero, bairro, cidade, uf, cep')
      .select('id, customer_id, expires_at, used, created_at, schema, view_name')
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
          estimated_order_number: estimatedOrderNumber,
          customer: {
             id: customer.codpessoa,
            name: customer.nome,
            cnpj: customer.cpfcgc,
            nome_fantasia: customer.nomefantazia,
            razao_social: customer.nome,
            endereco: customer.logradouro,
            numero: customer.numero,
            bairro: customer.bairro,
            cidade: customer.cidade,
            uf: customer.uf,
            cep: customer.cep
          },
          expires_at: session.expires_at,
          order_url: orderUrl,
          token: token,
          items_loaded: orderItems.length,
          total_products_found: currentProducts.length,
          schema: requestSchema,
          view_name: requestViewName
        },
        message: `Sessão criada com sucesso para ${customer.nome} com ${orderItems.length} itens do último pedido (schema: ${requestSchema}, view: ${requestViewName}). Número estimado do pedido: ${estimatedOrderNumber || 'N/A'}`
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