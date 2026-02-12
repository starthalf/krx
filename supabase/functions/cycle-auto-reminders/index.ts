// supabase/functions/cycle-auto-reminders/index.ts
// Supabase Edge Function: 매일 자동 실행하여 OKR 수립 마감 알림 발송
// 
// 배포 방법:
//   supabase functions deploy cycle-auto-reminders
//
// 테스트:
//   supabase functions invoke cycle-auto-reminders
//
// Cron 설정 (Supabase Dashboard > Edge Functions > Schedules):
//   매일 KST 09:00 → Cron: "0 0 * * *" (UTC)
//
// 또는 외부 cron (GitHub Actions, Vercel Cron 등)에서 HTTP 호출:
//   curl -X POST https://<project>.supabase.co/functions/v1/cycle-auto-reminders \
//     -H "Authorization: Bearer <ANON_KEY>"

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Service role client (RLS 우회)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // DB 함수 호출 (모든 로직은 DB에서 처리)
    const { data, error } = await supabase.rpc('process_cycle_auto_reminders');

    if (error) {
      console.error('Auto reminder error:', error);
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Auto reminders processed:', JSON.stringify(data));

    return new Response(
      JSON.stringify({ success: true, result: data }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('Unexpected error:', err);
    return new Response(
      JSON.stringify({ success: false, error: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});