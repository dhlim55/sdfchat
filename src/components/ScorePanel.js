import "./ScorePanel.css";

export default function ScorePanel({ current, threshold }) {
  return (
    <div className="score-panel">
      <div>
        <strong>Your Score:</strong> {current}
      </div>
      <div>
        <strong>Threshold Score:</strong> {threshold}
      </div>
    </div>
  );
}
