import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/instrument-serif/latin-400.css";
import "@fontsource/instrument-serif/latin-400-italic.css";
import "@fontsource-variable/instrument-sans/wdth.css";
import App from "./App";
import "./styles.css";

const container = document.getElementById("root");
if (!container) {
  throw new Error("LightSprint root element is missing.");
}
createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
