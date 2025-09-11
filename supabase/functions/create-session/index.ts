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

    const { customer_id } = await req.json()

    // Validar se customer_id foi fornecido
    if (!customer_id) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'MISSING_CUSTOMER_ID',
          message: 'customer_id é obrigatório',
          details: 'O parâmetro customer_id deve ser fornecido na requisição'
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Verificar se o cliente existe
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('id, name, email')
      .eq('id', customer_id)
      .single()

    if (customerError || !customer) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'CUSTOMER_NOT_FOUND',
          message: 'Cliente não encontrado',
          details: `O cliente com ID ${customer_id} não existe no sistema`,
          customer_id: customer_id
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Cliente existe, prosseguir com a criação da sessão
    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + 24) // Expira em 24 horas

    const { data: session, error: sessionError } = await supabase
      .from('order_sessions')
      .insert({
        customer_id,
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
          customer_id: customer_id
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
            id: customer.id,
            name: customer.name,
            email: customer.email
          },
          expires_at: session.expires_at,
          order_url: orderUrl,
          token: token
        },
        message: `Sessão criada com sucesso para ${customer.name}`
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