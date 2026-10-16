import { useEffect, useState } from "react";
import { AlertCircle, Check, X } from "lucide-react";

// Avisos na tela (substituem o alert() do navegador, que bloqueia a interface).
// Uso: notify("Paciente salvo com sucesso!"); o tipo é inferido do texto, ou passe "ok" | "erro" | "info".
const ouvintes = new Set();
let proximoId = 1;

const inferirTipo = (msg) => {
  if (/não foi possível|erro|incorret|inválid|expirad|preencha|precisa|não são|nenhum|cadastre|aceite|é necessário/i.test(msg)) return "erro";
  if (/sucesso|enviado|salv|criada|criado|gerad|excluíd/i.test(msg)) return "ok";
  return "info";
};

export function notify(mensagem, tipo) {
  const texto = String(mensagem ?? "");
  if (!texto) return;
  const aviso = { id: proximoId++, texto, tipo: tipo || inferirTipo(texto) };
  ouvintes.forEach((fn) => fn(aviso));
}

const estilos = {
  ok: { bg: "#2F4B3C", Icone: Check },
  erro: { bg: "#9C3D54", Icone: AlertCircle },
  info: { bg: "#4A5A44", Icone: AlertCircle },
};

export function ToastHost() {
  const [avisos, setAvisos] = useState([]);

  useEffect(() => {
    const aoReceber = (aviso) => {
      setAvisos((lista) => [...lista.slice(-3), aviso]);
      setTimeout(
        () => setAvisos((lista) => lista.filter((a) => a.id !== aviso.id)),
        aviso.tipo === "erro" ? 9000 : 6000
      );
    };
    ouvintes.add(aoReceber);
    return () => ouvintes.delete(aoReceber);
  }, []);

  if (!avisos.length) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed left-1/2 top-4 z-[60] flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 flex-col gap-2"
    >
      {avisos.map(({ id, texto, tipo }) => {
        const { bg, Icone } = estilos[tipo];
        return (
          <div
            key={id}
            className="flex items-start gap-3 rounded-xl px-4 py-3 text-sm text-white shadow-lg"
            style={{ background: bg }}
          >
            <Icone size={18} className="mt-0.5 shrink-0" />
            <span className="flex-1 break-words">{texto}</span>
            <button
              type="button"
              aria-label="Fechar aviso"
              onClick={() => setAvisos((lista) => lista.filter((a) => a.id !== id))}
            >
              <X size={16} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
