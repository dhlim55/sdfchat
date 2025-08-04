import { useState } from "react";
import {
  getFollowUpQuestion,
  evaluateAnswerLLM,
  getIdealAnswerScore
} from "../utils/chatgpt";
import ChatBotFloating from "./ChatBotFloating";
import { db } from "../firebase";
import { collection, doc, setDoc } from "firebase/firestore";
import "./SurveyPage.css";

function findBiggestGapKey(human, ideal) {
  const keys = ["specificity", "relevance", "informativeness", "clarity"];
  let maxDiff = -1;
  let maxKey = "";
  keys.forEach((key) => {
    const diff = Math.abs((ideal[key] || 0) - (human[key] || 0));
    if (diff > maxDiff) {
      maxDiff = diff;
      maxKey = key;
    }
  });
  return maxKey;
}

export default function SurveyPage({ userID }) {
  const questions = [
    "여행 중 스마트폰을 어떤 방식으로 활용하시나요? 구체적인 예시나 유용한 기능이 있다면 함께 말씀해주세요.",
    "현재 우리가 직면한 환경 문제의 주요 원인은 무엇이라고 생각하시나요? 그러한 원인이 발생하게 된 배경이나 사회적 요인에는 어떤 것들이 있다고 보시나요?",
    "인공지능의 발전이 사회에 미치는 영향에 대해 어떻게 평가하시나요? 긍정적인 점과 우려되는 점이 있다면 무엇인가요?",
    "친환경 에너지가 미래의 주요 에너지원이 될 수 있다고 보십니까? 그에 따른 장점과 단점은 무엇이라고 생각하시나요?",
    "오늘날 인터넷이 직면한 가장 중요하고 가장 심각한 문제는 무엇이라고 생각하시며, 그 이유는 무엇인가요?",
  ];

  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswer, setUserAnswer] = useState("");
  const [idealAnswer, setIdealAnswer] = useState("");
  const [showBot, setShowBot] = useState(false);
  const [followUp, setFollowUp] = useState("");
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [charCount, setCharCount] = useState(0);
  const [followUpStep, setFollowUpStep] = useState(0);

  const question = questions[currentIndex];

  async function analyzeAndEvaluate(answer, isFollowup = false, step = 0) {
    setIsEvaluating(true);

    // ✅ 이상적인 답변과 점수를 JSON에서 가져옴
    const {
      idealAnswer: SLResponse,
      specificity: ScoreA,
      relevance: ScoreB,
      informativeness: ScoreC,
      clarity: ScoreD,
      total_score: ScoreT
    } = getIdealAnswerScore(question);

    setIdealAnswer(SLResponse);

    // ✅ 사용자 응답은 여전히 GPT 평가
    const humanScore = await evaluateAnswerLLM(answer, question);
    const HScoreA = humanScore.specificity;
    const HScoreB = humanScore.relevance;
    const HScoreC = humanScore.informativeness;
    const HScoreD = humanScore.clarity;
    const HScoreT = HScoreA + HScoreB + HScoreC + HScoreD;

    let followUpQuestion = null;

    if (HScoreT < ScoreT) {
      const gapKey = findBiggestGapKey(
        {
          specificity: HScoreA,
          relevance: HScoreB,
          informativeness: HScoreC,
          clarity: HScoreD,
        },
        {
          specificity: ScoreA,
          relevance: ScoreB,
          informativeness: ScoreC,
          clarity: ScoreD,
        }
      );
      followUpQuestion = await getFollowUpQuestion(answer, SLResponse, gapKey, question);
      setFollowUp(followUpQuestion);
      setShowBot(true);
    } else {
      goToNextQuestion();
    }

    await submitToFirebase(
      question,
      answer,
      SLResponse,
      { HScoreA, HScoreB, HScoreC, HScoreD, HScoreT },
      { ScoreA, ScoreB, ScoreC, ScoreD, ScoreT },
      followUpQuestion,
      isFollowup,
      step
    );

    setIsEvaluating(false);
  }

  async function handleInitialSubmit() {
    if (!userAnswer.trim()) {
      alert("답변을 입력해주세요.");
      return;
    }
    setSubmitted(true);
    await analyzeAndEvaluate(userAnswer, false, 0);
  }

  async function handleFollowupSubmit(updatedAnswer) {
    const nextStep = followUpStep + 1;
    setUserAnswer(updatedAnswer);
    setShowBot(false);
    setSubmitted(true);
    setFollowUpStep(nextStep);

    await analyzeAndEvaluate(updatedAnswer, true, nextStep);
  }

  async function submitToFirebase(
    question,
    answer,
    idealAnswer,
    humanScores,
    llmScores,
    followUpQuestion,
    isFollowup,
    step = 0
  ) {
    const now = new Date();
    const timestamp = `${now.getHours()}${now.getMinutes()}${now.getSeconds()}`;
    const docID = `${userID}_q${currentIndex + 1}_s${step}_t${timestamp}`;

    await setDoc(doc(collection(db, "surveyResponses"), docID), {
      userID,
      question,
      followUpStep: step,
      answer,
      idealAnswer,
      HScoreA: humanScores.HScoreA,
      HScoreB: humanScores.HScoreB,
      HScoreC: humanScores.HScoreC,
      HScoreD: humanScores.HScoreD,
      HScoreT: humanScores.HScoreT,
      ScoreA: llmScores.ScoreA,
      ScoreB: llmScores.ScoreB,
      ScoreC: llmScores.ScoreC,
      ScoreD: llmScores.ScoreD,
      ScoreT: llmScores.ScoreT,
      followUpQuestion,
      isFollowup,
      timestamp: now,
    });
  }

  function goToNextQuestion() {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setUserAnswer("");
      setIdealAnswer("");
      setShowBot(false);
      setFollowUp("");
      setSubmitted(false);
      setFollowUpStep(0);
    } else {
      setCompleted(true);
    }
  }

  if (completed) {
    return (
      <div className="survey-container">
        <header className="survey-header">
          <h1>2025 Survey</h1>
          <p>@Ewha HCIL Lab</p>
        </header>
        <hr />
        <section className="survey-section">
          <h2>모든 질문이 완료되었습니다.</h2>
          <p>참여해주셔서 감사합니다.</p>
          <p>참가자님이 응답하신 설문은 케이스3 입니다.</p>
          <p>
            아래 링크로 접속해 폼을 작성해주시면, 소정의 기프티콘이 지급됩니다!
          </p>
          <p>
            <a
              href="https://forms.gle/FwNUCTzx3kFQYqEj6"
              target="_blank"
              rel="noreferrer"
            >
              https://forms.gle/FwNUCTzx3kFQYqEj6
            </a>
          </p>
        </section>
      </div>
    );
  }

  return (
    <div className="survey-container">
      <header className="survey-header">
        <h1>Survey 2025</h1>
        <p>@Ewha HCIL Lab</p>
      </header>
      <hr />
      <section className="survey-section">
        <h2>Section 1</h2>
        <div className="question-block">
          <label>Q{currentIndex + 1}. {question}</label>
          <textarea
            value={userAnswer}
            onChange={(e) => {
              setUserAnswer(e.target.value);
              setCharCount(e.target.value.length);
            }}
            placeholder="여기에 입력하세요..."
          />
        </div>
        <div className="submit-row">
          <div className="button-wrapper">
            <button
              className="submit-button"
              onClick={handleInitialSubmit}
              disabled={isEvaluating}
            >
              {isEvaluating ? "평가 중..." : "제출"}
            </button>
            <span className="char-count">{charCount}자/300자</span>
          </div>
        </div>
      </section>
      {showBot && (
        <ChatBotFloating
          message={followUp}
          onAnswerUpdate={handleFollowupSubmit}
          defaultValue={userAnswer}
          disabled={submitted}
        />
      )}
    </div>
  );
}
