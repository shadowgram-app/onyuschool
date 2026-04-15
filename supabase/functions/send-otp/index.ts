/**
 * Supabase Edge Function: send-otp
 * 이메일로 6자리 OTP 발송
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const { email, otp } = await req.json()
    if (!email || !otp) throw new Error('email, otp 필요')

    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') || ''

    if (!RESEND_API_KEY) {
      // API 키 없을 경우 콘솔 로그 (베타)
      console.log(`OTP for ${email}: ${otp}`)
      return new Response(
        JSON.stringify({ ok: true, msg: 'OTP logged (no email API key)' }),
        { headers: { ...CORS, 'Content-Type': 'application/json' } }
      )
    }

    // Resend API로 이메일 발송
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'noreply@onyuschool.com',
        to: email,
        subject: '[온유스쿨] 대시보드 인증코드',
        html: `
          <div style="font-family:Apple SD Gothic Neo,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
            <h2 style="color:#1A3055;margin-bottom:8px">온유스쿨 자녀양육 클래스</h2>
            <p style="color:#666;margin-bottom:24px">대시보드 접속 인증코드입니다.</p>
            <div style="background:#F0F7F4;border:2px solid #256060;border-radius:12px;
              padding:24px;text-align:center;margin-bottom:24px">
              <div style="font-size:2.4rem;font-weight:800;letter-spacing:0.3em;color:#1A3055">
                ${otp}
              </div>
              <div style="font-size:.82rem;color:#888;margin-top:8px">3분 내 입력해 주세요</div>
            </div>
            <p style="font-size:.8rem;color:#999">
              본인이 요청하지 않은 경우 이 메일을 무시해 주세요.<br>
              온유스쿨 · onyuschool.com
            </p>
          </div>`,
      }),
    })

    if (!res.ok) throw new Error('이메일 발송 실패: ' + await res.text())

    return new Response(
      JSON.stringify({ ok: true }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } }
    )
  } catch(e: any) {
    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } }
    )
  }
})
