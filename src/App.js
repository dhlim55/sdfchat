import './App.css';
import React, { useState } from "react";
import SurveyPage from "./components/SurveyPage";

function App() {
  const [userId, setUserId] = useState("");
  const [isIdSubmitted, setIsIdSubmitted] = useState(false);

  return (
    <div className="App">
      {!isIdSubmitted ? (
        <div style={{ marginTop: "40px", textAlign: "center" }}>
          <h2> 설문 참여 전 응답 구분을 위해 ID를 입력해주세요</h2>
          <p>📌 ID 형식: <strong>이름의 초성 + 생일 4자리</strong> (예시: 임다희 → <code>ㄷㅎ0505</code>)</p>
          <input
            type="text"
            value={userId}
            onChange={(e) => setUserId(e.target.value.trim())}
            placeholder="예시: ㄷㅎ0505"
            style={{ padding: "10px", fontSize: "16px", width: "200px" }}
          />
          <br /><br />
          <button
            onClick={() => setIsIdSubmitted(true)}
            disabled={!userId}
            style={{ padding: "10px 20px", fontSize: "16px" }}
          >
            설문 시작하기
          </button>
        </div>
      ) : (
        <SurveyPage userID={userId} />
      )}
    </div>
  );
}

export default App;

console.log("App.js loaded");
