import "./ProgressNavigator.css";

export default function ProgressNavigator({
  currentIndex,
  total,
  passedQuestions,
  onNavigate,
}) {
  return (
    <div className="progress-nav">
      {Array.from({ length: total }).map((_, idx) => {
        const isCurrent = idx === currentIndex;
        const isPassed = passedQuestions[idx];

        return (
          <button
            key={idx}
            className={`progress-step
              ${isCurrent ? "current" : ""}
              ${isPassed ? "passed" : ""}
            `}
            onClick={() => onNavigate(idx)}
          >
            {idx + 1}
          </button>
        );
      })}
    </div>
  );
}
