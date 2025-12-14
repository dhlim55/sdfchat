import "./ProgressBar.css";

export default function ProgressBar({ current, total }) {
  const progressPercent = Math.round((current / total) * 100);

  return (
    <div className="progress-wrapper">
      <div className="progress-text">
        Question {current} of {total}
      </div>
      <div className="progress-bar">
        <div
          className="progress-fill"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
    </div>
  );
}
