
import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";

import App from "./App.jsx";
import { ToastHost } from "./ui/toast.jsx";
import TelaAbertura from "./TelaAbertura.jsx";

function Site() {
  const [mostrarAbertura, setMostrarAbertura] = useState(true);

  return (
    <>
      <App />
      <ToastHost />

      {mostrarAbertura && (
        <TelaAbertura
          onFinish={() => setMostrarAbertura(false)}
        />
      )}
    </>
  );
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <Site />
  </StrictMode>
);

