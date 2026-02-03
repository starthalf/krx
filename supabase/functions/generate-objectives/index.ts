const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { orgName, orgMission, orgType, functionTags, industry } = await req.json()

    // 프롬프트 엔지니어링 [cite: 54]
    const prompt = `
당신은 기업의 OKR(목표와 핵심결과) 전문가입니다.

[조직 정보]
- 조직명: ${orgName}
- 미션: ${orgMission}
- 조직유형: ${orgType}
- 핵심기능: ${functionTags?.join(', ') || '없음'}
- 업종: ${industry || 'IT/서비스'}

아래 조건에 맞는 2025년 상반기 목표(Objective) 5개를 JSON으로 생성해주세요:
1. "BII(Build/Innovate/Improve)" 유형이 골고루 섞여야 함.
2. BSC 4개 관점(재무/고객/프로세스/학습성장)을 포함할 것.
3. 한국어로 작성하며, 구체적이고 측정 가능한 언어를 사용할 것.
4. JSON 형식만 반환할 것 (마크다운 불필요).

JSON 형식 예시:
{
  "objectives": [
    {
      "name": "신규 시장 진출을 통한 매출 기반 확보",
      "biiType": "Build",
      "perspective": "재무",
      "rationale": "조직 미션 달성을 위한 기초 체력 확보"
    }
  ]
}
`

    // Anthropic (Claude) API 호출 [cite: 55]
    // (OpenAI를 쓰신다면 fetch URL과 body 포맷만 변경하면 됩니다)
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': Deno.env.get('ANTHROPIC_API_KEY')!,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307', // 속도가 빠른 Haiku 모델 추천
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }]
      })
    })

    const aiData = await response.json()
    
    // AI 응답에서 JSON만 추출
    const contentText = aiData.content[0].text
    const jsonStart = contentText.indexOf('{')
    const jsonEnd = contentText.lastIndexOf('}') + 1
    const parsed = JSON.parse(contentText.substring(jsonStart, jsonEnd))

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})