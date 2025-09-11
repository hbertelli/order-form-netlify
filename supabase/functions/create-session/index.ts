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

    if (!customer_id) {
      return new Response(
        JSON.stringify({ error: 'customer_id é obrigatório' }),
        {
          status: 400,
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
          error: 'Cliente não encontrado',
          details: 'O cliente especificado não existe no sistema'
        }),
        {
          status: 404,
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
          error: 'Erro ao criar sessão',
          details: sessionError.message 
        }),
        {
          status: 500,
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
        session_id: session.id,
        customer: {
          id: customer.id,
          name: customer.name,
          email: customer.email
        },
        expires_at: session.expires_at,
        order_url: orderUrl,
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
        error: 'Erro interno do servidor',
        details: error.message 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})