
import { useEffect, useState } from "react";
import "./TelaAbertura.css";

export default function TelaAbertura({ onFinish }) {
  const [saindo, setSaindo] = useState(false);

  useEffect(() => {
    const inicioSaida = setTimeout(() => setSaindo(true), 1800);
    const finalizar = setTimeout(() => onFinish(), 2300);

    return () => {
      clearTimeout(inicioSaida);
      clearTimeout(finalizar);
    };
  }, [onFinish]);

  return (
    <div className={`nutri-splash ${saindo ? "saindo" : ""}`}>
      <div className="nutri-splash-conteudo">
        <div className="nutri-splash-icone">🌿</div>
        <h1>NutriTrack</h1>
        <p>Seu acompanhamento em cada etapa</p>
        <div className="nutri-splash-loader">
          <span />
        </div>
      </div>
    </div>
  );
}
