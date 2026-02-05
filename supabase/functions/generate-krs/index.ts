// supabase/functions/generate-krs/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { objectiveName, objectiveType, perspective } = await req.json()

    const prompt = `
당신은 OKR 전문가입니다. 다음 목표(Objective)를 달성하기 위한 핵심결과(KR) 3개를 추천해주세요.

[목표 정보]
- 목표: ${objectiveName}
- 유형: ${objectiveType} (BII 관점)
- 관점: ${perspective} (BSC 관점)

[요청사항]
1. KR은 구체적인 수치가 포함된 결과 중심이어야 합니다.
2. 각 KR에 대해 S/A/B/C 등급 기준을 제안하세요.
3. JSON 형식으로만 응답하세요.

JSON 예시:
{
  "krs": [
    {
      "name": "신규 리드 50건 창출",
      "definition": "마케팅 캠페인을 통한 유효 리드 확보",
      "unit": "건",
      "targetValue": 50,
      "weight": 30,
      "type": "결과",
      "gradeCriteria": { "S": 60, "A": 55, "B": 50, "C": 40, "D": 0 }
    }
  ]
}
`

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': Deno.env.get('ANTHROPIC_API_KEY')!,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }]
      })
    })

    const data = await response.json()
    const content = data.content[0].text
    const jsonStr = content.substring(content.indexOf('{'), content.lastIndexOf('}') + 1)
    const result = JSON.parse(jsonStr)

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})