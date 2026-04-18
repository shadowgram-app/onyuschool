/**
 * Supabase Edge Function: send-otp
 *
 * action=send  : OTP 생성 → workshops 테이블 otp_code/otp_expires_at 저장 → Resend 발송
 * action=verify: DB의 OTP와 비교 → 일치하면 ok:true
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const { action, code, token, email: inputEmail } = await req.json()

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // ── 워크숍 조회 ──
    const { data: ws, error: wsErr } = await supabase
      .from('workshops')
      .select('code, church_name, leader_email, otp_code, otp_expires_at')
      .eq('code', code)
      .single()

    if (wsErr || !ws) {
      return new Response(
        JSON.stringify({ error: '워크숍 코드를 찾을 수 없습니다.' }),
        { status: 404, headers: { ...CORS, 'Content-Type': 'application/json' } }
      )
    }

    // ══════════════════════════════
    //  action=send : OTP 발송
    // ══════════════════════════════
    if (action === 'send') {
      // 입력한 이메일 우선, 없으면 DB 저장 이메일 사용
      const targetEmail = inputEmail || ws.leader_email
      if (!targetEmail) {
        return new Response(
          JSON.stringify({ error: '이메일을 입력해 주세요.' }),
          { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } }
        )
      }

      // 6자리 OTP 생성
      const otp = String(Math.floor(100000 + Math.random() * 900000))
      const expires = new Date(Date.now() + 3 * 60 * 1000).toISOString() // 3분

      // DB 저장 (OTP)
      await supabase
        .from('workshops')
        .update({ otp_code: otp, otp_expires_at: expires })
        .eq('code', code)

      // Resend 발송
      const RESEND_KEY = Deno.env.get('RESEND_API_KEY') || ''
      if (!RESEND_KEY) throw new Error('RESEND_API_KEY 미설정')

      const resendRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'onboarding@resend.dev',
          to: targetEmail,
          subject: '[온유스쿨] 대시보드 인증코드: ' + otp,
          html: `
<div style="font-family:'Apple SD Gothic Neo',sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#F5F3EE">
  <div style="background:#1A3055;border-radius:12px;padding:28px 24px;text-align:center;margin-bottom:24px">
    <div style="color:#8FC49A;font-size:11px;font-weight:800;letter-spacing:2px;margin-bottom:12px">ONYUSCHOOL</div>
    <div style="color:#fff;font-size:1.1rem;font-weight:700;margin-bottom:6px">팀빌딩 대시보드</div>
    <div style="color:rgba(255,255,255,.65);font-size:.85rem">${ws.church_name} 워크숍</div>
  </div>
  <div style="background:#fff;border-radius:12px;padding:28px 24px;text-align:center;margin-bottom:16px;border:1px solid #DDD">
    <div style="font-size:.82rem;color:#888;margin-bottom:12px">아래 6자리 코드를 입력해 주세요</div>
    <div style="font-size:2.8rem;font-weight:900;letter-spacing:0.35em;color:#1A3055;
      background:#F0F7F4;border-radius:10px;padding:18px 24px;display:inline-block">
      ${otp}
    </div>
    <div style="font-size:.78rem;color:#999;margin-top:12px">⏱ 3분 내 입력해 주세요</div>
  </div>
  <div style="font-size:.75rem;color:#aaa;text-align:center;line-height:1.7">
    본인이 요청하지 않은 경우 이 메일을 무시해 주세요.<br>
    온유스쿨 · onyuschool.com
  </div>
</div>`,
        }),
      })

      if (!resendRes.ok) {
        const err = await resendRes.text()
        throw new Error('이메일 발송 실패: ' + err)
      }

      // 이메일 마스킹 (프론트에 표시용)
      const masked = targetEmail.replace(/(.{2})(.*)(@.*)/, (_: string, a: string, b: string, c: string) =>
        a + '*'.repeat(Math.max(2, b.length)) + c
      )

      return new Response(
        JSON.stringify({ ok: true, maskedEmail: masked }),
        { headers: { ...CORS, 'Content-Type': 'application/json' } }
      )
    }

    // ══════════════════════════════
    //  action=verify : OTP 검증
    // ══════════════════════════════
    if (action === 'verify') {
      if (!token) throw new Error('token 필요')

      if (!ws.otp_code || !ws.otp_expires_at) {
        return new Response(
          JSON.stringify({ error: '인증코드가 없습니다. 다시 요청해 주세요.' }),
          { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } }
        )
      }

      // 만료 확인
      if (new Date() > new Date(ws.otp_expires_at)) {
        return new Response(
          JSON.stringify({ error: '인증코드가 만료되었습니다. 다시 요청해 주세요.' }),
          { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } }
        )
      }

      // 코드 비교
      if (ws.otp_code !== token) {
        return new Response(
          JSON.stringify({ error: '인증코드가 올바르지 않습니다.' }),
          { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } }
        )
      }

      // 검증 성공 → OTP 소진
      await supabase
        .from('workshops')
        .update({ otp_code: null, otp_expires_at: null })
        .eq('code', code)

      return new Response(
        JSON.stringify({ ok: true, church_name: ws.church_name }),
        { headers: { ...CORS, 'Content-Type': 'application/json' } }
      )
    }

    throw new Error('action은 send 또는 verify 이어야 합니다.')

  } catch(e: any) {
    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } }
    )
  }
})
