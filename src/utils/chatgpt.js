import responses from "../data/question_score"

const OPENAI_API_KEY = process.env.REACT_APP_OPENAI_API_KEY;

//이상적 점수 가져오기
export function getIdealAnswerScore(question) {
  const entry = responses.find((item) => item.question === question);

  if (entry) {
    return {
      idealAnswer: entry.ideal_answer,
      specificity: entry.specificity,
      specificity_reason: entry.rationale,
      relevance: entry.relevance,
      relevance_reason: entry.rationale,
      informativeness: entry.informativeness,
      informativeness_reason: entry.rationale,
      clarity: entry.clarity,
      clarity_reason: entry.rationale,
      total_score: entry.total_score
    };
  }

  console.warn("❗ 이상적인 점수 정보 없음:", question);
  return {
    idealAnswer: "",
    specificity: 0,
    specificity_reason: "점수 정보 없음",
    relevance: 0,
    relevance_reason: "점수 정보 없음",
    informativeness: 0,
    informativeness_reason: "점수 정보 없음",
    clarity: 0,
    clarity_reason: "점수 정보 없음",
    total_score: 0
  };
}

// 1️⃣ 이상적인 답변 생성
export async function getIdealAnswer(question) {
  const prompt = `
  당신은 자유형(open-ended) 질문에 대해 이상적인 답변을 작성하는 역할을 합니다.
  당신의 목표는 명확하고 유익하며 사람이 쉽게 이해할 수 있는 고품질 답변을 작성하는 것입니다.
  답변은 가능한 한 구체적이고, 질문과 밀접한 연관이 있어야 하며, 유효한 정보가 포함되고 명확하게 쓰여야합니다.
  막연하거나 모호한 표현은 피해주세요. 답변은 최대 300글자를 넘지 말아야 합니다.
  ---
  질문:
  "${question}"
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

  다음은 설문 응답 평가 기준입니다:
  - Specificity (구체성): 정보가 얼마나 구체적이거나 개인의 경험에 근거하고 있는가
  - Relevance (적절성): 질문에 대한 답변이 직접적으로 관련이 있고 질문의 의도에 대해 응답했는가
  - Informativeness (정보성): 실질적인 정보를 담고 있는가
  - Clarity (명확성): 문장이 얼마나 명확하고 이해하기 쉬운가

  평가 대상 응답:
  ---
  "${answerToScore}"
  ---

  1. 위 기준에 따라 각 항목을 **0~25점의 정수**로 평가하세요.
  2. 각 항목에 대해 점수를 준 이유도 간단히 설명해주세요.

  아래와 같은 JSON 형식으로 출력하세요:
  {
    "specificity": 10,
    "specificity_reason": "일반적인 설명만 있어서 구체성이 부족합니다.",
    "relevance": 20,
    "relevance_reason": "질문 의도에 맞는 주제를 다루고 있어 적절합니다.",
    "informativeness": 10,
    "informativeness_reason": "수사구만 많고 실질적인 정보가 부족합니다.",
    "clarity": 20,
    "clarity_reason": "문장이 간결하고 이해하기 쉬워 명확합니다."
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
      specificity: 50,
      relevance: 50,
      informativeness: 50,
      clarity: 50,
    };
  }
}

// 3️⃣ 후속 질문 생성
export async function getFollowUpQuestion(userAnswer, idealAnswer, gapKey = "", question) {
  const aspectMap = {
    specificity: "정보가 얼마나 구체적이거나 개인의 경험에 근거하고 있는가",
    relevance: "질문에 대한 답변이 직접적으로 관련이 있고 질문의 의도에 대해 응답했는가",
    informativeness: "실질적인 정보를 담고 있는가",
    clarity: "문장이 얼마나 명확하고 이해하기 쉬운가",
  };

  const aspectHint = gapKey && aspectMap[gapKey]
    ? `특히 "${aspectMap[gapKey]}"을(를) 보완하는 방향으로`
    : "";

  const prompt = `

  설문 질문:
"${question}"


'이 설문에 대한 이상적인 답변 예시는 다음과 같습니다:
"${idealAnswer}"

${aspectHint} follow-up 질문을 만들어주세요. 

사용자가 설문에 다음과 같이 답했습니다:
"${userAnswer}" 
다음과 같은 응답을 바탕으로, 추가적으로 더 깊이 물어볼 수 있는 follow-up 질문을 한 문장으로 만들어 주세요.

  조건:
  - 반드시 질문 문장 형태여야 합니다.
  - 특정 답을 유도하거나 이상적인 답변을 포함하면 안 됩니다.
  - 자연스럽고 대화형 문체로 작성해 주세요.
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
