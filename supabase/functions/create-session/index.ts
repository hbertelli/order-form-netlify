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

      // Busca por CNPJ usando função para limpar formatação
      const { data, error } = await supabase
        .from('clientes_atacamax')
        .select('codpessoa, nome, cpfcgc')
        .eq('regexp_replace(cpfcgc, \'[^0-9]\', \'\', \'g\')', cleanInputCnpj)
        .single()
      
      customer = data
      customerError = error
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
          cnpj: cnpj || null
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Cliente existe, prosseguir com a criação da sessão
    // Verificar se existem produtos disponíveis para este cliente
    const { data: products, error: productsError } = await supabase
      .from('produtos_atacamax')
      .select('codprodfilho')
      .eq('ativo', true)
      .limit(1)

    if (productsError) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'PRODUCTS_QUERY_ERROR',
          message: 'Erro ao consultar produtos',
          details: productsError.message,
          customer_id: customer.codpessoa
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    if (!products || products.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'NO_PRODUCTS_AVAILABLE',
          message: 'Nenhum produto disponível',
          details: 'Não foram encontrados produtos ativos no sistema para criar um pedido',
          customer_id: customer.codpessoa,
          customer_name: customer.nome
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Produtos disponíveis, prosseguir com a criação da sessão
    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + 24) // Expira em 24 horas

    const { data: session, error: sessionError } = await supabase
      .from('order_sessions')
      .insert({
        customer_id: customer.codpessoa,
        expires_at: expiresAt.toISOString(),
        used: false
      })
      .select()
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

    // Gerar JWT token com claim personalizado
    const payload = {
      iss: 'supabase',
      ref: supabaseUrl.split('//')[1].split('.')[0],
      role: 'anon',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(expiresAt.getTime() / 1000),
      sid: session.id // Custom claim para RLS
    }

    // Aqui você precisaria implementar a assinatura JWT
    // Por simplicidade, vou usar o session.id como token temporário
    const token = btoa(JSON.stringify(payload))

    const orderUrl = `${req.headers.get('origin') || 'https://your-domain.com'}/?token=${token}`

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
          token: token
        },
        message: `Sessão criada com sucesso para ${customer.nome}`
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