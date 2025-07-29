const OPENAI_API_KEY = "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";


// 1️⃣ 이상적인 답변 생성
export async function getIdealAnswer(question) {
  const prompt = `다음 질문에 대해 가장 구체적이고 완전한 이상적인 답변을 작성해주세요:\n"${question}"`;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.5,
    }),
  });

  const data = await response.json();
  if (!data.choices || !data.choices[0]) {
    console.error("GPT 이상적인 답변 실패:", data);
    return "이상적인 답변을 불러오지 못했습니다.";
  }

  return data.choices[0].message.content.trim();
}

// 2️⃣ 응답 평가
export async function evaluateAnswerLLM(answerToScore, question) {
  const prompt = `
  다음은 설문의 질문입니다.:
  ${question}

  다음은 응답입니다:
"${answerToScore}"

    질문의 핵심 의도를 먼저 요약하세요. (예: 질문이 요구하는 정보 또는 답변의 범위)

    그 후, 응답이 이 의도에 얼마나 정확히 부합하는지 판단하여 다음 기준에 따라 0~1 점수를 주세요. 
    그리고 각 항목에 대해 점수를 준 이유도 간단히 설명해주세요.:

    다음은 설문 응답 평가 기준입니다:
    - Specificity (구체성): 정보가 얼마나 구체적인가 (예: 사례, 수치, 구체적인 이유 포함 여부)
    - Relevance (적절성): ${question}에 대한 답변이 얼마나 적절한가
    - Informativeness (정보성): 새로운 정보나 통찰을 얼마나 제공하는가
    - Clarity (명확성): 문장이 얼마나 명확하고 이해하기 쉬운가


    아래와 같은 JSON 형식으로 출력하세요:
    {
    "specificity": 0.7,
    "specificity_reason": "예시나 수치 없이 일반적인 설명만 있어서 구체성이 부족합니다.",
    "relevance": 0.8,
    "relevance_reason": "질문 의도에 맞는 주제를 다루고 있어 적절합니다.",
    "informativeness": 0.6,
    "informativeness_reason": "기본적인 정보만 있고 새로운 통찰은 부족합니다.",
    "clarity": 0.9,
    "clarity_reason": "문장이 간결하고 이해하기 쉬워 명확합니다."
    }

    예시1: 질문 - "여행 또는 이동 시 스마트폰을 어떻게 활용하시나요?"
    응답 - "저는 스마트폰을 통해 매일 날씨를 확인하고 비타민 D 농도를 추적합니다. 
    이 데이터는 주로 고도에 따라 달라지기 때문에, 해발 1000m 이상에서는 스마트폰이 더 정확하게 제 몸의 건강 상태를 분석해 줍니다."

    {
    "specificity": 0.5,
    "specificity_reason": "구체적인 수치가 포함됨",
    "relevance": 0.3,
    "relevance_reason": ""스마트폰", "데이터", "위치", "고도" 같은 단어는 이동 또는 여행과 얼핏 관련 있어 보이지만, 
    여행 또는 이동 시 활용법이라는 질문과는 본질적으로 관련 없는 건강 추적과 비타민 D 농도에 초점을 맞춘 내용입니다. 질문의 의도와 완전히 벗어났습니다.",
    "informativeness": 0.2,
    "informativeness_reason": "새로운 정보나 통찰 없음",
    "clarity": 0.9,
    "clarity_reason": "문장은 명확하게 쓰임"
    }
`;


  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
    }),
  });

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;

  try {
    const match = content.match(/{[\s\S]*?}/);
    if (match) {
      return JSON.parse(match[0]);
    }
    throw new Error("No JSON object found");
  } catch (e) {
    console.error("❌ GPT 점수 응답 파싱 실패:", content);
    return {
      specificity: 0.5,
      relevance: 0.5,
      informativeness: 0.5,
      clarity: 0.5,
    };
  }
}

// 3️⃣ 후속 질문 생성
export async function getFollowUpQuestion(userAnswer, idealAnswer, gapKey = "", question) {
  const aspectMap = {
    specificity: "더 구체적인 정보나 예시",
    relevance: "설문 질문을 1회 더 설명하고 질문과 더욱 관련 있는 답변",
    informativeness: "새롭고 유익한 정보",
    clarity: "더 명확하고 이해하기 쉬운 문장",
  };

  const aspectHint = gapKey && aspectMap[gapKey]
    ? `특히 "${aspectMap[gapKey]}"을(를) 보완하는 방향으로`
    : "";

  const prompt = `

  설문 질문:
"${question}"

사용자가 설문에 다음과 같이 답했습니다:
"${userAnswer}"

이 설문에 대한 이상적인 답변 예시는 다음과 같습니다:
"${idealAnswer}"

${aspectHint} 한 문장으로 follow-up 질문을 만들어주세요. 
단, 문장은 사용자에게 직접 묻는 질문 형태여야 하며,
특정 답변을 유도하거나 정답을 알려주는 방식은 피해주세요.
`;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.5,
    }),
  });

  const data = await response.json();
  if (!data.choices || !data.choices[0]) {
    console.error("GPT follow-up 생성 실패:", data);
    return "보완 설명을 위해 다시 답변을 작성해 주세요.";
  }

  return data.choices[0].message.content.trim();
}
