import { useState } from "react";
import { getIdealAnswer, getFollowUpQuestion, evaluateAnswerLLM } from "../utils/chatgpt";
import ChatBotFloating from "./ChatBotFloating";
import { db } from "../firebase";
import { collection, addDoc } from "firebase/firestore";
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
    "여행 또는 이동 시 스마트폰을 어떻게 활용하시나요?",

  ];

  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswer, setUserAnswer] = useState("");
  const [idealAnswer, setIdealAnswer] = useState("");
  const [showBot, setShowBot] = useState(false);
  const [followUp, setFollowUp] = useState("");
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [completed, setCompleted] = useState(false);

  const question = questions[currentIndex];

  async function analyzeAndEvaluate(answer) {
    setIsEvaluating(true);

    const SLResponse = idealAnswer || (await getIdealAnswer(question));
    setIdealAnswer(SLResponse);

    const humanScore = await evaluateAnswerLLM(answer);
    const HScoreA = humanScore.specificity;
    const HScoreB = humanScore.relevance;
    const HScoreC = humanScore.informativeness;
    const HScoreD = humanScore.clarity;
    const HScoreT = 0.3 * HScoreA + 0.3 * HScoreB + 0.2 * HScoreC + 0.2 * HScoreD;

    console.log("사용자 응답 평가 점수:");
    console.log("Specificity:", HScoreA);
    console.log("→", humanScore.specificity_reason);
    console.log("Relevance:", HScoreB);
    console.log("→", humanScore.relevance_reason);
    console.log("Informativeness:", HScoreC);
    console.log("→", humanScore.informativeness_reason);
    console.log("Clarity:", HScoreD);
    console.log("→", humanScore.clarity_reason);
    console.log("Total Score:", HScoreT);


    const idealScore = await evaluateAnswerLLM(SLResponse);
    const ScoreA = idealScore.specificity;
    const ScoreB = idealScore.relevance;
    const ScoreC = idealScore.informativeness;
    const ScoreD = idealScore.clarity;
    const ScoreT = 0.3 * ScoreA + 0.3 * ScoreB + 0.2 * ScoreC + 0.2 * ScoreD;

    console.log("이상적(llm) 응답 평가 점수:");
    console.log("Specificity:", ScoreA);
    console.log("Relevance:", ScoreB);
    console.log("Informativeness:", ScoreC);
    console.log("Clarity:", ScoreD);
    console.log("Total Score:", ScoreT);

    console.log("✅ Human Score T:", HScoreT);
    console.log("✅ LLM Score T:", ScoreT);
    console.log("________________________________");

    if (HScoreT >= ScoreT) {
      await submitToFirebase(
        question,
        answer,
        SLResponse,
        { HScoreA, HScoreB, HScoreC, HScoreD, HScoreT },
        { ScoreA, ScoreB, ScoreC, ScoreD, ScoreT }
      );
      goToNextQuestion();
    } else {
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
      const followUpPrompt = await getFollowUpQuestion(answer, SLResponse, gapKey);
      setFollowUp(followUpPrompt);
      setShowBot(true);
    }

    setIsEvaluating(false);
  }

  async function handleInitialSubmit() {
    if (!userAnswer.trim()) {
      alert("답변을 입력해주세요.");
      return;
    }
    await analyzeAndEvaluate(userAnswer);
  }

  async function handleFollowupSubmit(updatedAnswer) {
    setUserAnswer(updatedAnswer);
    await analyzeAndEvaluate(updatedAnswer);
  }

  async function submitToFirebase(question, answer, idealAnswer, humanScores, llmScores) {
    console.log("현재 userID:", userID);
    await addDoc(collection(db, "surveyResponses"), {
      userID,
      question,
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
      timestamp: new Date(),
    });

    alert("답변이 성공적으로 제출되었습니다.");
  }

  function goToNextQuestion() {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setUserAnswer("");
      setIdealAnswer("");
      setShowBot(false);
      setFollowUp("");
      setSubmitted(false);
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
            onChange={(e) => setUserAnswer(e.target.value)}
            disabled={submitted}
            placeholder="여기에 입력하세요..."
          />
        </div>

        {!submitted && (
          <button
            className="submit-button"
            onClick={handleInitialSubmit}
            disabled={isEvaluating}
          >
            {isEvaluating ? "평가 중..." : "제출"}
          </button>
        )}
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
