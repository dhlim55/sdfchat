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
import { QUESTION_BANK } from "../data/question_list";
import ProgressBar from "./ProgressBar";
import ScorePanel from "./ScorePanel";
import ProgressNavigator from "./ProgressNavigator";



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
//  const questions = [
 //   "What do you think is the most important and most serious problem facing the Internet today and why?",
 //   "In what ways do you use your smartphone while traveling? Please share any specific examples or useful features.",
 //   "What do you think are the main causes of the environmental problems we are facing today, and what do you think are the background or social factors that led to them?",
 //   "How do you assess the impact of the development of artificial intelligence on society? What are the positives and what are the concerns?",
 //   "Do you think green energy can be the main source of energy in the future? What do you think are the advantages and disadvantages of this?",
 // ];
 const questions = QUESTION_BANK;

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

  const [currentScore, setCurrentScore] = useState(null);
  const [thresholdScore, setThresholdScore] = useState(null);

  const [passedQuestions, setPassedQuestions] = useState({});


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

    setCurrentScore(HScoreT);
    setThresholdScore(ScoreT);

    if (HScoreT >= ScoreT) {
  setPassedQuestions((prev) => ({
    ...prev,
    [currentIndex]: true,
  }));
} else {
  setPassedQuestions((prev) => ({
    ...prev,
    [currentIndex]: false,
  }));
}

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
      setCurrentScore(null);
      setThresholdScore(null);

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

          <ProgressNavigator
      currentIndex={currentIndex}
      total={questions.length}
      passedQuestions={passedQuestions}
      onNavigate={(idx) => {
        setCurrentIndex(idx);
        setUserAnswer("");
        setShowBot(false);
        setFollowUp("");
        setSubmitted(false);
        setFollowUpStep(0);
      }}
    />

        {/* ✅ 진행 상황 표시 */}
        <ProgressBar
          current={currentIndex + 1}
          total={questions.length}
        />
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

      {showBot && currentScore !== null && thresholdScore !== null && (
      <ScorePanel
        current={currentScore}
        threshold={thresholdScore}
      />
    )}

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
