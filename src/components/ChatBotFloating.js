import { useState } from "react";
import "./ChatBotFloating.css";
import robotImg from "../assets/robot.png";

export default function ChatBotFloating({ message }) {
  return (
    <div className="chatbot-container">
      <div className="chatbot-bubble">{message}</div>
      <img src={robotImg} alt="chatbot" className="chatbot-img" />
    </div>
  );
}
