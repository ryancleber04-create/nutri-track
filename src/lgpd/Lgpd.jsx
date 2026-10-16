import { useEffect, useState } from "react";
import { X, ShieldCheck, Download, Mail, FileText } from "lucide-react";
import { supabase } from "../supabase";
import { CONTROLADOR } from "../config";

export const VERSAO_POLITICA = "1.0";
export const DATA_POLITICA = "14/10/2026";

/* ---------------------------------------------------------
   Texto da Política de Privacidade e Termos de Uso
   MODELO: deve ser revisado por advogado antes de publicar.
--------------------------------------------------------- */
const secoes = () => [
  {
    titulo: "1. Quem é responsável pelos dados",
    itens: [
      "O nutricionista que cadastra o paciente é o controlador dos dados do seu paciente (LGPD, art. 5º, VI): é ele quem decide como os dados são usados no acompanhamento.",
      `A plataforma NutriTrack, mantida por ${CONTROLADOR.nome} (${CONTROLADOR.documento}), atua como operadora desses dados (art. 5º, VII) e como controladora dos dados de cadastro e acesso dos próprios usuários.`,
      `Contato de privacidade / Encarregado (DPO): ${CONTROLADOR.contato}.`,
    ],
  },
  {
    titulo: "2. Quais dados tratamos",
    itens: [
      "Nutricionista: nome, e-mail e senha (armazenada de forma criptografada pelo provedor de autenticação).",
      "Paciente: nome, data de nascimento, sexo, telefone, e-mail, altura, peso, medidas corporais, dobras cutâneas, percentual de gordura, plano alimentar, avaliações e observações do acompanhamento.",
      "Dados sobre saúde são dados pessoais sensíveis (art. 5º, II) e recebem proteção reforçada.",
    ],
  },
  {
    titulo: "3. Para que usamos e em qual base legal",
    itens: [
      "Realizar o acompanhamento nutricional: tutela da saúde, em procedimento realizado por profissional de saúde (art. 11, II, \"f\"), e consentimento específico e destacado do paciente para o uso do aplicativo (art. 11, I).",
      "Cumprir obrigações legais e regulatórias, como a guarda de registros exigida pelo conselho profissional (art. 7º, II e art. 11, II, \"a\").",
      "Exercer direitos em processos judiciais, administrativos ou arbitrais (art. 11, II, \"d\").",
      "Não vendemos dados, não os usamos para publicidade e não os compartilhamos para fins comerciais.",
    ],
  },
  {
    titulo: "4. Com quem os dados são compartilhados",
    itens: [
      "Entre o paciente e o nutricionista responsável, que enxergam apenas os dados do próprio acompanhamento.",
      `Com provedores de infraestrutura que hospedam o banco de dados e a autenticação (Supabase) e a aplicação. Os servidores ficam em: ${CONTROLADOR.regiaoDados}. Se houver transferência internacional, ela ocorrerá com as garantias do art. 33 da LGPD.`,
      "A fonte tipográfica da interface é carregada do Google Fonts, o que expõe o endereço IP do navegador a esse serviço. Nenhum dado de saúde é enviado a ele.",
      "Autoridades, quando houver obrigação legal ou ordem judicial.",
    ],
  },
  {
    titulo: "5. Segurança",
    itens: [
      "Conexão criptografada (HTTPS), autenticação por e-mail e senha, controle de acesso por usuário no banco de dados e acesso restrito ao mínimo necessário.",
      "Em caso de incidente que possa causar risco ou dano relevante, comunicaremos a ANPD e os titulares afetados (art. 48).",
    ],
  },
  {
    titulo: "6. Por quanto tempo guardamos",
    itens: [
      "Pelo tempo em que durar o acompanhamento e pelo prazo exigido pela legislação e pelo conselho profissional aplicável. Depois disso, os dados são eliminados ou anonimizados (arts. 15 e 16).",
    ],
  },
  {
    titulo: "7. Seus direitos (art. 18)",
    itens: [
      "Você pode pedir: confirmação de que tratamos seus dados; acesso; correção; anonimização, bloqueio ou eliminação de dados desnecessários; portabilidade; informação sobre compartilhamentos; e revogar o consentimento.",
      "Pacientes podem baixar seus dados e fazer pedidos na seção \"Privacidade e meus dados\" da própria conta. Também é possível escrever para o contato de privacidade acima.",
      "Responderemos em até 15 dias para a declaração completa (art. 19). Revogar o consentimento pode impedir o uso do aplicativo, sem afetar tratamentos já realizados nem a guarda legal de registros.",
    ],
  },
  {
    titulo: "8. Crianças e adolescentes",
    itens: [
      "Dados de menores de 18 anos só devem ser cadastrados com consentimento específico de ao menos um dos pais ou do responsável legal (art. 14), sempre no melhor interesse do menor.",
    ],
  },
  {
    titulo: "9. Armazenamento no navegador",
    itens: [
      "Usamos apenas o armazenamento local essencial para manter sua sessão ativa. Não usamos cookies de publicidade nem rastreamento de comportamento.",
    ],
  },
  {
    titulo: "10. Responsabilidades do nutricionista",
    itens: [
      "O nutricionista deve ter base legal para cadastrar cada paciente, informá-lo sobre o uso da plataforma, cadastrar apenas os dados necessários e manter o sigilo profissional previsto no Código de Ética e de Conduta do Nutricionista.",
      "O NutriTrack é uma ferramenta de apoio e não substitui o julgamento clínico do profissional.",
    ],
  },
  {
    titulo: "11. Alterações e contato",
    itens: [
      `Esta política pode ser atualizada. Mudanças relevantes serão informadas no aplicativo e, quando necessário, será pedido novo consentimento. Dúvidas: ${CONTROLADOR.contato}.`,
    ],
  },
];

export function PoliticaModal({ onClose }) {
  useEffect(() => {
    const fechar = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", fechar);
    return () => window.removeEventListener("keydown", fechar);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-6"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-politica"
        className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-[#C7D2BF] p-5">
          <div>
            <h2 id="titulo-politica" className="text-xl font-bold text-[#2F4B3C]">
              Política de Privacidade e Termos de Uso
            </h2>
            <p className="mt-1 text-xs text-[#6C7D64]">
              Versão {VERSAO_POLITICA} • {DATA_POLITICA}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="rounded-lg p-1 text-[#6C7D64] hover:bg-[#E9EEE2]">
            <X size={20} />
          </button>
        </div>
        <div className="space-y-5 overflow-y-auto p-5 text-sm leading-relaxed text-[#22301F]">
          {secoes().map((s) => (
            <section key={s.titulo}>
              <h3 className="mb-1.5 font-bold text-[#2F4B3C]">{s.titulo}</h3>
              <div className="space-y-2">
                {s.itens.map((t, i) => (
                  <p key={i}>{t}</p>
                ))}
              </div>
            </section>
          ))}
        </div>
        <div className="border-t border-[#C7D2BF] p-4 text-right">
          <button type="button" onClick={onClose} className="rounded-xl bg-[#2F4B3C] px-5 py-2 text-sm font-semibold text-white">
            Entendi
          </button>
        </div>
      </div>
    </div>
  );
}

/* Caixa de aceite: o texto vem como children e o link abre a política. */
export function AceiteLgpd({ checked, onChange, onAbrirPolitica, children }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[#C7D2BF] bg-[#F5F7F2] p-3 text-sm text-[#22301F]">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 h-4 w-4 shrink-0 accent-[#2F4B3C]"
      />
      <span>
        {children}{" "}
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            onAbrirPolitica();
          }}
          className="font-semibold text-[#2F4B3C] underline"
        >
          Ler política
        </button>
      </span>
    </label>
  );
}

/* Guarda a prova do aceite (tabela "consentimentos"; veja supabase/lgpd_e_seguranca.sql).
   Devolve true/false e nunca lança erro: o cadastro não pode quebrar se o registro falhar. */
export async function registrarConsentimento(tipo) {
  try {
    const {
      data: { user },
      error: erroUsuario,
    } = await supabase.auth.getUser();

    // Sem sessão (ex.: e-mail ainda não confirmado) não há como gravar. É esperado, não é erro.
    if (erroUsuario || !user) return false;

    const { error } = await supabase
      .from("consentimentos")
      .insert({ user_id: user.id, tipo, versao: VERSAO_POLITICA });

    if (error) {
      console.warn("Consentimento não registrado:", error.message);
      return false;
    }
    return true;
  } catch (erro) {
    console.warn("Consentimento não registrado:", erro?.message);
    return false;
  }
}

/* Confere se o usuário já aceitou ESTA versão da política (para pedir novo aceite quando ela mudar).
   Devolve true/false. Lança erro se a consulta falhar (ex.: tabela ainda não criada),
   para quem chamar decidir se bloqueia o acesso ou segue. */
export async function verificarConsentimento(tipo) {
  const {
    data: { user },
    error: erroUsuario,
  } = await supabase.auth.getUser();
  if (erroUsuario || !user) return false;

  const { data, error } = await supabase
    .from("consentimentos")
    .select("id")
    .eq("user_id", user.id)
    .eq("tipo", tipo)
    .eq("versao", VERSAO_POLITICA)
    .limit(1);

  if (error) throw error;
  return (data?.length ?? 0) > 0;
}

/* Portabilidade / acesso (art. 18, II e V): baixa os dados do paciente em JSON. */
export async function baixarMeusDados({ medicoes, plano, refeicoes, avaliacoes }) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Sessão expirada. Entre novamente.");

  const { data: cadastro, error } = await supabase
    .from("pacientes")
    .select("*")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (error) throw error;

  const conteudo = {
    exportado_em: new Date().toISOString(),
    versao_politica: VERSAO_POLITICA,
    conta: { email: user.email },
    cadastro,
    medicoes: medicoes || [],
    plano_alimentar: plano || null,
    refeicoes: refeicoes || [],
    avaliacoes: avaliacoes || [],
  };

  const blob = new Blob([JSON.stringify(conteudo, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `meus-dados-nutritrack-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/* Seção "Privacidade e meus dados" da área do paciente. */
export function PrivacidadePaciente({ medicoes, plano, refeicoes, avaliacoes, onAbrirPolitica }) {
  const [baixando, setBaixando] = useState(false);
  const [mensagem, setMensagem] = useState("");

  const baixar = async () => {
    setBaixando(true);
    setMensagem("");
    try {
      await baixarMeusDados({ medicoes, plano, refeicoes, avaliacoes });
      setMensagem("Arquivo gerado. Guarde-o em local seguro: ele contém dados de saúde.");
    } catch (e) {
      setMensagem(e?.message || "Não foi possível gerar o arquivo.");
    } finally {
      setBaixando(false);
    }
  };

  const pedido = (assunto) =>
    `mailto:${CONTROLADOR.contato}?subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(
      "Olá, sou paciente cadastrado no NutriTrack e gostaria de exercer meus direitos previstos na LGPD.\n\nPedido: " +
        assunto +
        "\n\nDetalhes:\n"
    )}`;

  const botao =
    "inline-flex items-center gap-2 rounded-xl border border-[#2F4B3C] px-4 py-2 text-sm font-semibold text-[#2F4B3C] hover:bg-[#E9EEE2] disabled:opacity-50";

  return (
    <section className="mb-6 rounded-2xl border border-[#C7D2BF] bg-white p-4 shadow-sm sm:p-6">
      <div className="mb-2 flex items-center gap-2 text-[#2F4B3C]">
        <ShieldCheck size={20} />
        <h3 className="text-xl font-bold">Privacidade e meus dados</h3>
      </div>
      <p className="mb-4 text-sm text-[#6C7D64]">
        Seus dados de saúde são protegidos pela LGPD. Você pode acessá-los, corrigi-los ou pedir a exclusão quando quiser.
      </p>
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={baixar} disabled={baixando} className={botao}>
          <Download size={16} /> {baixando ? "Gerando..." : "Baixar meus dados"}
        </button>
        <a href={pedido("Correção dos meus dados")} className={botao}>
          <Mail size={16} /> Pedir correção
        </a>
        <a href={pedido("Exclusão dos meus dados / revogação do consentimento")} className={botao}>
          <Mail size={16} /> Pedir exclusão
        </a>
        <button type="button" onClick={onAbrirPolitica} className={botao}>
          <FileText size={16} /> Política de Privacidade
        </button>
      </div>
      {mensagem && (
        <p role="status" className="mt-3 text-sm text-[#6C7D64]">
          {mensagem}
        </p>
      )}
    </section>
  );
}