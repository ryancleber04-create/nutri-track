import { useEffect, useState } from "react";
import { Plus, Utensils, X, Pencil, Trash2 } from "lucide-react";
import { supabase } from "../supabase";

export default function PlanoAlimentar({ client }) {
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [mostrarFormularioRefeicao, setMostrarFormularioRefeicao] = useState(false);
  const [planoSalvo, setPlanoSalvo] = useState(null);
  const [refeicoes, setRefeicoes] = useState([]);
  const [refeicaoEditando, setRefeicaoEditando] = useState(null);
  const [alimentoEditando, setAlimentoEditando] = useState(null);
  

  const [refeicao, setRefeicao] = useState({
    nome: "",
    horario: "",
    observacoes: "",
  });

  const [plano, setPlano] = useState({
    nome: "",
    objetivo: "",
    calorias_meta: "",
    proteinas_meta: "",
    carboidratos_meta: "",
    gorduras_meta: "",
    data_inicio: "",
    data_fim: "",
    observacoes: "",
  });

  // Estados para adicionar alimentos nas refeições
const [mostrarFormularioAlimento, setMostrarFormularioAlimento] = useState(false);

const [refeicaoSelecionada, setRefeicaoSelecionada] = useState(null);

const [buscaAlimento, setBuscaAlimento] = useState("");

const [resultadosAlimentos, setResultadosAlimentos] = useState([]);

const [alimentoSelecionado, setAlimentoSelecionado] = useState(null);



const [quantidadeAlimento, setQuantidadeAlimento] = useState("");

// ==========================================
// RESUMO NUTRICIONAL DO PLANO
// ==========================================

const totaisNutricionais = refeicoes.reduce(
  (total, refeicao) => {
    const alimentos = refeicao.alimentos || [];

    alimentos.forEach((alimento) => {
      total.calorias += Number(alimento.calorias || 0);
      total.proteinas += Number(alimento.proteinas || 0);
      total.carboidratos += Number(alimento.carboidratos || 0);
      total.gorduras += Number(alimento.gorduras || 0);
    });

    return total;
  },
  {
    calorias: 0,
    proteinas: 0,
    carboidratos: 0,
    gorduras: 0,
  }
);

const metasNutricionais = {
  calorias: Number(planoSalvo?.calorias_meta || plano.calorias_meta || 0),
  proteinas: Number(planoSalvo?.proteinas_meta || plano.proteinas_meta || 0),
  carboidratos: Number(
    planoSalvo?.carboidratos_meta || plano.carboidratos_meta || 0
  ),
  gorduras: Number(planoSalvo?.gorduras_meta || plano.gorduras_meta || 0),
};
const calcularPercentual = (valor, meta) => {
  if (!meta || meta <= 0) return 0;

  return Math.min((valor / meta) * 100, 100);
};

const percentuaisNutricionais = {
  calorias: calcularPercentual(
    totaisNutricionais.calorias,
    metasNutricionais.calorias
  ),
  proteinas: calcularPercentual(
    totaisNutricionais.proteinas,
    metasNutricionais.proteinas
  ),
  carboidratos: calcularPercentual(
    totaisNutricionais.carboidratos,
    metasNutricionais.carboidratos
  ),
  gorduras: calcularPercentual(
    totaisNutricionais.gorduras,
    metasNutricionais.gorduras
  ),
};
// ==========================================
// RESTANTE DO DIA / EXCESSO DA META
// ==========================================

const calcularRestante = (consumido, meta) => {
  const diferenca = Number(meta || 0) - Number(consumido || 0);

  return {
    restante: diferenca > 0 ? diferenca : 0,
    excesso: diferenca < 0 ? Math.abs(diferenca) : 0,
    atingida: diferenca <= 0,
  };
};

const saldoNutricional = {
  calorias: calcularRestante(
    totaisNutricionais.calorias,
    metasNutricionais.calorias
  ),

  proteinas: calcularRestante(
    totaisNutricionais.proteinas,
    metasNutricionais.proteinas
  ),

  carboidratos: calcularRestante(
    totaisNutricionais.carboidratos,
    metasNutricionais.carboidratos
  ),

  gorduras: calcularRestante(
    totaisNutricionais.gorduras,
    metasNutricionais.gorduras
  ),
};

console.log("TOTAIS NUTRICIONAIS:", totaisNutricionais);
console.log("METAS NUTRICIONAIS:", metasNutricionais);
console.log("PERCENTUAIS:", percentuaisNutricionais);

  useEffect(() => {
  const carregarPlano = async () => {
    if (!client?.id) return;

    try {
      const { data, error } = await supabase
        .from("planos_alimentares")
        .select("*")
        .eq("paciente_id", client.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error("Erro ao carregar plano:", error);
        return;
      }

      if (!data) {
        setPlanoSalvo(null);
        setRefeicoes([]);
        return;
      }

      setPlanoSalvo(data);

      setPlano({
        nome: data.nome || "",
        objetivo: data.objetivo || "",
        calorias_meta: data.calorias_meta || "",
        proteinas_meta: data.proteinas_meta || "",
        carboidratos_meta: data.carboidratos_meta || "",
        gorduras_meta: data.gorduras_meta || "",
        data_inicio: data.data_inicio || "",
        data_fim: data.data_fim || "",
        observacoes: data.observacoes || "",
      });

      const { data: refeicoesData, error: refeicoesError } =
        await supabase
          .from("refeicoes")
          .select("*")
          .eq("plano_id", data.id)
          .order("horario", { ascending: true });

      if (refeicoesError) {
        console.error(
          "Erro ao carregar refeições:",
          refeicoesError
        );
        return;
      }

      setRefeicoes(refeicoesData || []);

    } catch (error) {
      console.error("Erro ao carregar plano alimentar:", error);
    }
  };

  carregarPlano();

}, [client?.id]);

  const abrirFormularioAlimento = (refeicao) => {
  setRefeicaoSelecionada(refeicao);

  // Garante que é um NOVO alimento
  setAlimentoEditando(null);

  // Limpa o formulário
  setBuscaAlimento("");
  setResultadosAlimentos([]);
  setAlimentoSelecionado(null);
  setQuantidadeAlimento("");

  // Abre o formulário
  setMostrarFormularioAlimento(true);

};

const buscarAlimentos = async (texto) => {
  setBuscaAlimento(texto);

  if (!texto.trim()) {
    setResultadosAlimentos([]);
    return;
  }

  console.log("Pesquisando:", texto);

  try {
    const { data, error } = await supabase
      .from("alimentos")
      .select("*")
      .ilike("nome", `%${texto.trim()}%`)
      .limit(20);

    console.log("DATA:", data);
    console.log("ERRO:", error);

    if (error) {
      console.error("Erro ao buscar alimentos:", error);
      setResultadosAlimentos([]);
      return;
    }

    setResultadosAlimentos(data || []);
  } catch (error) {
    console.error("Erro inesperado:", error);
  }
};
  const salvarAlimentoRefeicao = async () => {
    if (!refeicaoSelecionada?.id) {
      alert("Selecione uma refeição.");
      return;
    }

    if (!alimentoSelecionado) {
      alert("Selecione um alimento.");
      return;
    }

    const quantidade = Number(quantidadeAlimento);

    if (!quantidade || quantidade <= 0) {
      alert("Digite a quantidade em gramas.");
      return;
    }

    // Os valores da tabela de alimentos são referentes a 100 g
    const fator = quantidade / 100;

    const calorias =
      Number(alimentoSelecionado.calorias || 0) * fator;

    const proteinas =
      Number(alimentoSelecionado.proteinas || 0) * fator;

    const carboidratos =
      Number(alimentoSelecionado.carboidratos || 0) * fator;

    const gorduras =
      Number(alimentoSelecionado.gorduras || 0) * fator;

    const fibras =
      Number(alimentoSelecionado.fibras || 0) * fator;

    try {
      const { data, error } = await supabase
        .from("alimentos_refeicao")
        .insert({
          refeicao_id: refeicaoSelecionada.id,
          alimento_id: alimentoSelecionado.id,
          quantidade: quantidade,
          calorias: calorias,
          proteinas: proteinas,
          carboidratos: carboidratos,
          gorduras: gorduras,
          fibras: fibras,
        })
        .select()
        .single();

      if (error) {
        console.error("Erro Supabase:", error);
        alert("Erro ao adicionar alimento.");
        return;
      }

      console.log("Alimento adicionado:", data);

      alert("Alimento adicionado com sucesso!");

      setMostrarFormularioAlimento(false);
      setRefeicaoSelecionada(null);
      setBuscaAlimento("");
      setResultadosAlimentos([]);
      setAlimentoSelecionado(null);
      setQuantidadeAlimento("");

    } catch (error) {
      console.error("Erro ao adicionar alimento:", error);
      alert("Erro ao adicionar alimento.");
    }
  };

  const atualizarCampo = (campo, valor) => {
    setPlano((anterior) => ({ ...anterior, [campo]: valor }));
  };

  const atualizarCampoRefeicao = (campo, valor) => {
    setRefeicao((anterior) => ({ ...anterior, [campo]: valor }));
  };

  const salvarPlano = async () => {
    if (!plano.nome.trim()) {
      alert("Digite o nome do plano alimentar.");
      return;
    }

    if (!plano.objetivo) {
      alert("Selecione o objetivo.");
      return;
    }

    try {
      const { data, error } = await supabase
        .from("planos_alimentares")
        .insert([
          {
            paciente_id: client.id,
            nome: plano.nome,
            objetivo: plano.objetivo,
            calorias_meta: plano.calorias_meta ? Number(plano.calorias_meta) : null,
            proteinas_meta: plano.proteinas_meta ? Number(plano.proteinas_meta) : null,
            carboidratos_meta: plano.carboidratos_meta ? Number(plano.carboidratos_meta) : null,
            gorduras_meta: plano.gorduras_meta ? Number(plano.gorduras_meta) : null,
            data_inicio: plano.data_inicio || null,
            data_fim: plano.data_fim || null,
            observacoes: plano.observacoes || null,
          },
        ])
        .select()
        .single();

      if (error) {
        console.error("Erro ao salvar plano:", error);
        alert("Não foi possível salvar o plano alimentar.");
        return;
      }

      setPlanoSalvo(data);
      setRefeicoes([]);
      setMostrarFormulario(false);
      alert("Plano alimentar salvo com sucesso!");
    } catch (error) {
      console.error("Erro ao salvar plano:", error);
      alert("Erro ao salvar o plano alimentar.");
    }
  };

  const salvarRefeicao = async () => {
    if (!refeicao.nome.trim()) {
      alert("Digite o nome da refeição.");
      return;
    }

    if (!refeicao.horario) {
      alert("Informe o horário da refeição.");
      return;
    }

    if (!planoSalvo?.id) {
      alert("Salve o plano alimentar antes de adicionar uma refeição.");
      return;
    }
if (refeicaoEditando) {
  try {
    const { data, error } = await supabase
      .from("refeicoes")
      .update({
        nome: refeicao.nome,
        horario: refeicao.horario,
        observacoes: refeicao.observacoes || null,
      })
      .eq("id", refeicaoEditando.id)
      .select()
      .single();

    if (error) {
      console.error("Erro ao atualizar refeição:", error);
      alert("Não foi possível atualizar a refeição.");
      return;
    }

    setRefeicoes((anteriores) =>
      anteriores.map((item) =>
        item.id === data.id ? data : item
      )
    );

    setRefeicao({
      nome: "",
      horario: "",
      observacoes: "",
    });

    setRefeicaoEditando(null);
    setMostrarFormularioRefeicao(false);

    alert("Refeição atualizada com sucesso!");
    return;
  } catch (error) {
    console.error("Erro ao atualizar refeição:", error);
    alert("Erro ao atualizar a refeição.");
    return;
  }
}
    try {
      const { data, error } = await supabase
        .from("refeicoes")
        .insert([
          {
            plano_id: planoSalvo.id,
            nome: refeicao.nome,
            horario: refeicao.horario,
            observacoes: refeicao.observacoes || null,
          },
        ])
        .select()
        .single();

      if (error) {
        console.error("Erro ao salvar refeição:", error);
        alert("Não foi possível salvar a refeição.");
        return;
      }

      setRefeicoes((anteriores) => [...anteriores, data]);
      setRefeicao({ nome: "", horario: "", observacoes: "" });
      setMostrarFormularioRefeicao(false);
      alert("Refeição salva com sucesso!");
    } catch (error) {
      console.error("Erro ao salvar refeição:", error);
      alert("Erro ao salvar a refeição.");
    }
  };
const excluirRefeicao = async (id) => {
  const confirmar = window.confirm(
    "Tem certeza que deseja excluir esta refeição?"
  );

  if (!confirmar) return;

  try {
    const { error } = await supabase
      .from("refeicoes")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Erro ao excluir refeição:", error);
      alert("Não foi possível excluir a refeição.");
      return;
    }

    // Remove da tela
    setRefeicoes((anteriores) =>
      anteriores.filter((item) => item.id !== id)
    );

  } catch (error) {
    console.error("Erro ao excluir refeição:", error);
    alert("Erro ao excluir a refeição.");
  }
};
const editarRefeicao = (item) => {
  setRefeicaoEditando(item);

  setRefeicao({
    nome: item.nome || "",
    horario: item.horario?.slice(0, 5) || "",
    observacoes: item.observacoes || "",
  });

  setMostrarFormularioRefeicao(true);
};
async function salvarAlimento() {
  if (!refeicaoSelecionada?.id) {
    alert("Nenhuma refeição selecionada.");
    return;
  }

  if (!alimentoSelecionado) {
    alert("Selecione um alimento.");
    return;
  }

  const quantidade = Number(quantidadeAlimento);

  if (!quantidade || quantidade <= 0) {
    alert("Informe uma quantidade válida.");
    return;
  }

  const fator = quantidade / 100;

  const dadosAlimento = {
    refeicao_id: refeicaoSelecionada.id,
    alimento: alimentoSelecionado.nome,
    quantidade: quantidade,
    unidade: "g",

    calorias: Number(
      (Number(alimentoSelecionado.calorias || 0) * fator).toFixed(2)
    ),

    proteinas: Number(
      (Number(alimentoSelecionado.proteinas || 0) * fator).toFixed(2)
    ),

    carboidratos: Number(
      (Number(alimentoSelecionado.carboidratos || 0) * fator).toFixed(2)
    ),

    gorduras: Number(
      (Number(alimentoSelecionado.gorduras || 0) * fator).toFixed(2)
    ),

    observacoes: null,
  };

  try {
    let data;
    let error;

    // ==========================================
    // EDITANDO UM ALIMENTO EXISTENTE
    // ==========================================
    if (alimentoEditando) {
      const resposta = await supabase
        .from("alimentos_refeicao")
        .update(dadosAlimento)
        .eq("id", alimentoEditando.id)
        .select()
        .single();

      data = resposta.data;
      error = resposta.error;
    }

    // ==========================================
    // ADICIONANDO UM NOVO ALIMENTO
    // ==========================================
    else {
      const resposta = await supabase
        .from("alimentos_refeicao")
        .insert([dadosAlimento])
        .select()
        .single();

      data = resposta.data;
      error = resposta.error;
    }

    if (error) {
      console.error("Erro ao salvar alimento:", error);
      alert("Erro ao salvar alimento.");
      return;
    }

    console.log("Alimento salvo:", data);

    // ==========================================
    // ATUALIZA A LISTA NA TELA
    // ==========================================

    setRefeicoes((refeicoesAtuais) =>
      refeicoesAtuais.map((refeicao) => {

        if (refeicao.id !== refeicaoSelecionada.id) {
          return refeicao;
        }

        // EDITAR
        if (alimentoEditando) {
          return {
            ...refeicao,

            alimentos: (refeicao.alimentos || []).map((alimento) =>
              alimento.id === alimentoEditando.id
                ? data
                : alimento
            ),
          };
        }

        // ADICIONAR
        return {
          ...refeicao,

          alimentos: [
            ...(refeicao.alimentos || []),
            data,
          ],
        };
      })
    );

    // ==========================================
    // LIMPAR FORMULÁRIO
    // ==========================================

    const estavaEditando = Boolean(alimentoEditando);

    setBuscaAlimento("");
    setResultadosAlimentos([]);
    setAlimentoSelecionado(null);
    setQuantidadeAlimento("");

    setAlimentoEditando(null);

    setMostrarFormularioAlimento(false);
    setRefeicaoSelecionada(null);

    if (estavaEditando) {
      alert("Alimento atualizado com sucesso!");
    } else {
      alert("Alimento adicionado com sucesso!");
    }

  } catch (erro) {
    console.error("Erro inesperado:", erro);
    alert("Ocorreu um erro ao salvar o alimento.");
  }
}
async function excluirAlimento(alimentoId, refeicaoId) {
  const confirmar = window.confirm(
    "Tem certeza que deseja excluir este alimento?"
  );

  if (!confirmar) return;

  const { error } = await supabase
    .from("alimentos_refeicao")
    .delete()
    .eq("id", alimentoId);

  if (error) {
    console.error("Erro ao excluir alimento:", error);
    alert("Não foi possível excluir o alimento.");
    return;
  }

  // Remove da tela sem precisar atualizar a página
  setRefeicoes((refeicoesAtuais) =>
    refeicoesAtuais.map((refeicao) => {
      if (refeicao.id === refeicaoId) {
        return {
          ...refeicao,
          alimentos: (refeicao.alimentos || []).filter(
            (alimento) => alimento.id !== alimentoId
          ),
        };
      }

      return refeicao;
    })
  );

  alert("Alimento excluído com sucesso!");
}
function editarAlimento(alimento, refeicao) {
  setAlimentoEditando(alimento);

  setRefeicaoSelecionada(refeicao);

  setAlimentoSelecionado({
    nome: alimento.alimento,
    calorias:
      Number(alimento.calorias || 0) /
      (Number(alimento.quantidade) / 100),

    proteinas:
      Number(alimento.proteinas || 0) /
      (Number(alimento.quantidade) / 100),

    carboidratos:
      Number(alimento.carboidratos || 0) /
      (Number(alimento.quantidade) / 100),

    gorduras:
      Number(alimento.gorduras || 0) /
      (Number(alimento.quantidade) / 100),
  });

  setQuantidadeAlimento(String(alimento.quantidade));
  setBuscaAlimento(alimento.alimento);
  setResultadosAlimentos([]);

  setMostrarFormularioAlimento(true);
}
async function excluirAlimento(alimentoId, refeicaoId) {
  const confirmar = window.confirm(
    "Tem certeza que deseja excluir este alimento?"
  );

  if (!confirmar) {
    return;
  }

  try {
    const { error } = await supabase
      .from("alimentos_refeicao")
      .delete()
      .eq("id", alimentoId);

    if (error) {
      console.error("Erro ao excluir alimento:", error);
      alert("Não foi possível excluir o alimento.");
      return;
    }

    // Remove o alimento da tela
    setRefeicoes((refeicoesAtuais) =>
      refeicoesAtuais.map((refeicao) => {
        if (refeicao.id === refeicaoId) {
          return {
            ...refeicao,

            alimentos: (refeicao.alimentos || []).filter(
              (alimento) => alimento.id !== alimentoId
            ),
          };
        }

        return refeicao;
      })
    );

    alert("Alimento excluído com sucesso!");
  } catch (erro) {
    console.error("Erro inesperado ao excluir alimento:", erro);
    alert("Ocorreu um erro ao excluir o alimento.");
  }
}
  return (
    <div className="px-8 pb-6">
      <div
        className="rounded-xl p-5"
        style={{ background: "var(--cream)", border: "1px solid var(--sage)" }}
      >
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Utensils size={18} style={{ color: "var(--sage-dark)" }} />
              <h2
                className="font-semibold"
                style={{ fontFamily: "var(--font-display)", color: "var(--ink)" }}
              >
                Plano alimentar
              </h2>
            </div>
            <p className="text-sm mt-1" style={{ color: "var(--sage-dark)" }}>
              Monte e acompanhe a dieta do paciente.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setMostrarFormulario(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
            style={{ background: "var(--ink)", color: "white" }}
          >
            <Plus size={16} />
            Montar dieta
          </button>
        </div>

        {planoSalvo && (
          <div
            className="mt-5 rounded-xl p-5"
            style={{ background: "#fff", border: "1px solid var(--sage)" }}
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="font-semibold text-lg" style={{ color: "var(--ink)" }}>
                  {planoSalvo.nome}
                </h3>
                <p className="text-sm mt-1" style={{ color: "var(--sage-dark)" }}>
                  {planoSalvo.objetivo}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setMostrarFormularioRefeicao(true)}
                className="px-4 py-2 rounded-lg font-medium flex items-center gap-2"
                style={{ background: "var(--ink)", color: "white" }}
              >
                <Plus size={16} />
                Adicionar refeição
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-5">
              <div>
                <p className="text-xs" style={{ color: "var(--sage-dark)" }}>Calorias</p>
                <p className="font-semibold">{planoSalvo.calorias_meta ?? "—"} kcal</p>
              </div>
              <div>
                <p className="text-xs" style={{ color: "var(--sage-dark)" }}>Proteínas</p>
                <p className="font-semibold">{planoSalvo.proteinas_meta ?? "—"} g</p>
              </div>
              <div>
                <p className="text-xs" style={{ color: "var(--sage-dark)" }}>Carboidratos</p>
                <p className="font-semibold">{planoSalvo.carboidratos_meta ?? "—"} g</p>
              </div>
              <div>
                <p className="text-xs" style={{ color: "var(--sage-dark)" }}>Gorduras</p>
                <p className="font-semibold">{planoSalvo.gorduras_meta ?? "—"} g</p>
              </div>
            </div>
{/* RESUMO NUTRICIONAL */}
<div
  className="mt-6 rounded-xl p-5"
  style={{
    background: "var(--sage-tint)",
    border: "1px solid var(--sage)",
  }}
>
  <h3
    className="font-semibold text-lg mb-4"
    style={{ color: "var(--forest)" }}
  >
    Resumo nutricional
  </h3>

  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

    {/* CALORIAS */}
<div>
  <div className="flex justify-between mb-1">
    <span className="font-medium">Calorias</span>

    <span className="text-sm">
      {totaisNutricionais.calorias.toFixed(1)} /{" "}
      {metasNutricionais.calorias} kcal
    </span>
  </div>

  <div className="w-full bg-white rounded-full h-3 overflow-hidden">
    <div
      className="h-3 rounded-full"
      style={{
        width: `${Math.min(percentuaisNutricionais.calorias, 100)}%`,
        background: "var(--forest)",
      }}
    />
  </div>

  <div className="flex justify-between items-center mt-1">
    {saldoNutricional.calorias.excesso > 0 ? (
      <p
        className="text-xs font-semibold"
        style={{ color: "var(--berry)" }}
      >
        Excesso de {saldoNutricional.calorias.excesso.toFixed(1)} kcal
      </p>
    ) : (
      <p
        className="text-xs"
        style={{ color: "var(--sage-dark)" }}
      >
        Restam {saldoNutricional.calorias.restante.toFixed(1)} kcal
      </p>
    )}

    <p
      className="text-xs"
      style={{ color: "var(--sage-dark)" }}
    >
      {percentuaisNutricionais.calorias.toFixed(1)}%
    </p>
  </div>
</div>

   {/* PROTEÍNAS */}
<div>
  <div className="flex justify-between mb-1">
    <span className="font-medium">Proteínas</span>

    <span className="text-sm">
      {totaisNutricionais.proteinas.toFixed(1)} /{" "}
      {metasNutricionais.proteinas} g
    </span>
  </div>

  <div className="w-full bg-white rounded-full h-3 overflow-hidden">
    <div
      className="h-3 rounded-full"
      style={{
        width: `${Math.min(percentuaisNutricionais.proteinas, 100)}%`,
        background: "var(--forest)",
      }}
    />
  </div>

  <div className="flex justify-between items-center mt-1">
    {saldoNutricional.proteinas.excesso > 0 ? (
      <p
        className="text-xs font-semibold"
        style={{ color: "var(--berry)" }}
      >
        Excesso de {saldoNutricional.proteinas.excesso.toFixed(1)} g
      </p>
    ) : (
      <p
        className="text-xs"
        style={{ color: "var(--sage-dark)" }}
      >
        Restam {saldoNutricional.proteinas.restante.toFixed(1)} g
      </p>
    )}

    <p
      className="text-xs"
      style={{ color: "var(--sage-dark)" }}
    >
      {percentuaisNutricionais.proteinas.toFixed(1)}%
    </p>
  </div>
</div>


{/* CARBOIDRATOS */}
<div>
  <div className="flex justify-between mb-1">
    <span className="font-medium">Carboidratos</span>

    <span className="text-sm">
      {totaisNutricionais.carboidratos.toFixed(1)} /{" "}
      {metasNutricionais.carboidratos} g
    </span>
  </div>

  <div className="w-full bg-white rounded-full h-3 overflow-hidden">
    <div
      className="h-3 rounded-full"
      style={{
        width: `${Math.min(
          percentuaisNutricionais.carboidratos,
          100
        )}%`,
        background: "var(--forest)",
      }}
    />
  </div>

  <div className="flex justify-between items-center mt-1">
    {saldoNutricional.carboidratos.excesso > 0 ? (
      <p
        className="text-xs font-semibold"
        style={{ color: "var(--berry)" }}
      >
        Excesso de {saldoNutricional.carboidratos.excesso.toFixed(1)} g
      </p>
    ) : (
      <p
        className="text-xs"
        style={{ color: "var(--sage-dark)" }}
      >
        Restam {saldoNutricional.carboidratos.restante.toFixed(1)} g
      </p>
    )}

    <p
      className="text-xs"
      style={{ color: "var(--sage-dark)" }}
    >
      {percentuaisNutricionais.carboidratos.toFixed(1)}%
    </p>
  </div>
</div>


{/* GORDURAS */}
<div>
  <div className="flex justify-between mb-1">
    <span className="font-medium">Gorduras</span>

    <span className="text-sm">
      {totaisNutricionais.gorduras.toFixed(1)} /{" "}
      {metasNutricionais.gorduras} g
    </span>
  </div>

  <div className="w-full bg-white rounded-full h-3 overflow-hidden">
    <div
      className="h-3 rounded-full"
      style={{
        width: `${Math.min(percentuaisNutricionais.gorduras, 100)}%`,
        background: "var(--forest)",
      }}
    />
  </div>

  <div className="flex justify-between items-center mt-1">
    {saldoNutricional.gorduras.excesso > 0 ? (
      <p
        className="text-xs font-semibold"
        style={{ color: "var(--berry)" }}
      >
        Excesso de {saldoNutricional.gorduras.excesso.toFixed(1)} g
      </p>
    ) : (
      <p
        className="text-xs"
        style={{ color: "var(--sage-dark)" }}
      >
        Restam {saldoNutricional.gorduras.restante.toFixed(1)} g
      </p>
    )}

    <p
      className="text-xs"
      style={{ color: "var(--sage-dark)" }}
    >
      {percentuaisNutricionais.gorduras.toFixed(1)}%
    </p>
  </div>
</div>

  </div>
</div>
            <div className="mt-6">
              <h4 className="font-semibold" style={{ color: "var(--ink)" }}>Refeições</h4>

              {refeicoes.length === 0 ? (
                <p className="text-sm mt-2" style={{ color: "var(--sage-dark)" }}>
                  Nenhuma refeição adicionada ainda.
                </p>
              ) : (
                <div className="mt-3 space-y-3">
                  {refeicoes.map((item, index) => (
                    <div
                      key={item.id || index}
                      className="rounded-lg p-3"
                      style={{ border: "1px solid var(--sage)", background: "#fff" }}
                    >
                     <div className="flex justify-between items-center">
  <strong style={{ color: "var(--ink)" }}>
    {item.nome}
  </strong>

  <div className="flex items-center gap-3">

    <span
      className="text-sm"
      style={{ color: "var(--sage-dark)" }}
    >
      {item.horario?.slice(0, 5)}
    </span>

    {/* Editar */}
    <button
      type="button"
      onClick={() => editarRefeicao(item)}
      className="p-1 rounded"
      title="Editar refeição"
      style={{ color: "var(--ink)" }}
    >
      <Pencil size={16} />
    </button>

    {/* Excluir */}
    <button
      type="button"
      onClick={() => excluirRefeicao(item.id)}
      className="p-1 rounded"
      title="Excluir refeição"
      style={{ color: "#b4233c" }}
    >
      <Trash2 size={16} />
    </button>

  </div>
</div>
                                            {item.observacoes && (
                        <p
                          className="text-sm mt-2"
                          style={{ color: "var(--sage-dark)" }}
                        >
                          {item.observacoes}
                        </p>
                      )}

                   {/* Alimentos da refeição */}
<div
  className="mt-4 pt-3"
  style={{ borderTop: "1px solid var(--sage)" }}
>
  <div className="flex items-center justify-between">
    <span
      className="text-sm font-semibold"
      style={{ color: "var(--ink)" }}
    >
      Alimentos
    </span>

    <button
      type="button"
      onClick={() => abrirFormularioAlimento(item)}
      className="px-3 py-2 rounded-lg text-sm font-medium"
      style={{
        background: "var(--forest)",
        color: "#ffffff",
      }}
    >
      <Plus size={16} className="inline mr-1" />
      Adicionar alimento
    </button>
  </div>

  {/* LISTA DE ALIMENTOS */}
  {item.alimentos && item.alimentos.length > 0 ? (
    <div className="mt-3 space-y-2">
     {item.alimentos.map((alimento) => (
  <div
    key={alimento.id}
    className="rounded-lg p-3"
    style={{
      background: "var(--sage-tint)",
      border: "1px solid var(--sage)",
    }}
  >
    {/* PARTE SUPERIOR */}
    <div className="flex items-center justify-between gap-3">

      {/* NOME E QUANTIDADE */}
      <div>
        <p
          className="font-semibold"
          style={{ color: "var(--ink)" }}
        >
          {alimento.alimento}
        </p>

        <p
          className="text-sm mt-1"
          style={{ color: "var(--sage-dark)" }}
        >
          {alimento.quantidade} {alimento.unidade}
        </p>
      </div>

      {/* CALORIAS + BOTÕES */}
      <div className="flex items-center gap-3">

        <div className="text-right">
          <p
            className="font-semibold"
            style={{ color: "var(--forest)" }}
          >
            {Number(alimento.calorias || 0).toFixed(1)} kcal
          </p>
        </div>

        {/* EDITAR ALIMENTO */}
        <button
          type="button"
          onClick={() => editarAlimento(alimento, item)}
          className="p-1 rounded"
          title="Editar alimento"
          style={{ color: "var(--ink)" }}
        >
          <Pencil size={16} />
        </button>

        {/* EXCLUIR ALIMENTO */}
        <button
          type="button"
          onClick={() => excluirAlimento(alimento.id, item.id)}
          className="p-1 rounded"
          title="Excluir alimento"
          style={{ color: "#b4233c" }}
        >
          <Trash2 size={16} />
        </button>

      </div>
    </div>

          <div className="grid grid-cols-3 gap-3 mt-3">
            <div>
              <p
                className="text-xs"
                style={{ color: "var(--sage-dark)" }}
              >
                Proteínas
              </p>

              <p className="text-sm font-medium">
                {Number(alimento.proteinas || 0).toFixed(1)} g
              </p>
            </div>

            <div>
              <p
                className="text-xs"
                style={{ color: "var(--sage-dark)" }}
              >
                Carboidratos
              </p>

              <p className="text-sm font-medium">
                {Number(alimento.carboidratos || 0).toFixed(1)} g
              </p>
            </div>

            <div>
              <p
                className="text-xs"
                style={{ color: "var(--sage-dark)" }}
              >
                Gorduras
              </p>

              <p className="text-sm font-medium">
                {Number(alimento.gorduras || 0).toFixed(1)} g
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  ) : (
    <p
      className="text-sm mt-3"
      style={{ color: "var(--sage-dark)" }}
    >
      Nenhum alimento adicionado.
    </p>
  )}
</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
{/* FORMULÁRIO PARA ADICIONAR ALIMENTO */}
{mostrarFormularioAlimento && refeicaoSelecionada && (
  <div
    className="mt-5 rounded-xl p-5"
    style={{
      background: "#fff",
      border: "1px solid var(--sage)",
    }}
  >
    <div className="flex items-center justify-between mb-4">
      <div>
        <h4
          className="font-semibold"
          style={{ color: "var(--ink)" }}
        >
          Adicionar alimento
        </h4>

        <p
          className="text-sm mt-1"
          style={{ color: "var(--sage-dark)" }}
        >
          Refeição: {refeicaoSelecionada.nome}
        </p>
      </div>

      <button
        type="button"
        onClick={() => {
          setMostrarFormularioAlimento(false);
          setRefeicaoSelecionada(null);
          setBuscaAlimento("");
          setResultadosAlimentos([]);
          setAlimentoSelecionado(null);
          setQuantidadeAlimento("");
        }}
        className="text-xl"
        style={{ color: "var(--sage-dark)" }}
      >
        ×
      </button>
    </div>

    {/* PESQUISA */}
    <label
      className="text-sm font-medium"
      style={{ color: "var(--ink)" }}
    >
      Pesquisar alimento
    </label>

    <input
      type="text"
      value={buscaAlimento}
      onChange={(e) => buscarAlimentos(e.target.value)}
      placeholder="Ex: arroz, feijão, frango..."
      className="w-full mt-2 px-3 py-2 rounded-lg"
      style={{
        border: "1px solid var(--sage)",
        outline: "none",
      }}
    />

    {/* RESULTADOS */}
    {resultadosAlimentos.length > 0 && !alimentoSelecionado && (
      <div
        className="mt-2 rounded-lg overflow-hidden"
        style={{
          border: "1px solid var(--sage)",
          maxHeight: "220px",
          overflowY: "auto",
        }}
      >
        {resultadosAlimentos.map((alimento) => (
          <button
            key={alimento.id}
            type="button"
            onClick={() => {
              setAlimentoSelecionado(alimento);
              setBuscaAlimento(alimento.nome);
              setResultadosAlimentos([]);
            }}
            className="w-full text-left px-3 py-3"
            style={{
              borderBottom: "1px solid var(--sage)",
              background: "#fff",
            }}
          >
            <div
              className="font-medium"
              style={{ color: "var(--ink)" }}
            >
              {alimento.nome}
            </div>

            <div
              className="text-xs mt-1"
              style={{ color: "var(--sage-dark)" }}
            >
              {alimento.calorias} kcal / 100g
            </div>
          </button>
        ))}
      </div>
    )}

    {/* ALIMENTO SELECIONADO */}
    {alimentoSelecionado && (
      <div className="mt-5">

        <div
          className="rounded-lg p-3 mb-4"
          style={{ background: "var(--sage-tint)" }}
        >
          <strong style={{ color: "var(--ink)" }}>
            {alimentoSelecionado.nome}
          </strong>

          <p
            className="text-sm mt-1"
            style={{ color: "var(--sage-dark)" }}
          >
            Valores nutricionais calculados pela quantidade.
          </p>
        </div>

        <label
          className="text-sm font-medium"
          style={{ color: "var(--ink)" }}
        >
          Quantidade (g)
        </label>

        <input
          type="number"
          min="1"
          value={quantidadeAlimento}
          onChange={(e) => setQuantidadeAlimento(e.target.value)}
          placeholder="Ex: 100"
          className="w-full mt-2 px-3 py-2 rounded-lg"
          style={{
            border: "1px solid var(--sage)",
          }}
        />

        {/* CÁLCULO */}
        {Number(quantidadeAlimento) > 0 && (
          <div
            className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 rounded-lg p-4"
            style={{ background: "var(--sage-tint)" }}
          >
            <div>
              <span className="text-xs">Calorias</span>
              <p className="font-semibold">
                {(
                  Number(alimentoSelecionado.calorias || 0) *
                  (Number(quantidadeAlimento) / 100)
                ).toFixed(1)}{" "}
                kcal
              </p>
            </div>

            <div>
              <span className="text-xs">Proteínas</span>
              <p className="font-semibold">
                {(
                  Number(alimentoSelecionado.proteinas || 0) *
                  (Number(quantidadeAlimento) / 100)
                ).toFixed(1)}{" "}
                g
              </p>
            </div>

            <div>
              <span className="text-xs">Carboidratos</span>
              <p className="font-semibold">
                {(
                  Number(alimentoSelecionado.carboidratos || 0) *
                  (Number(quantidadeAlimento) / 100)
                ).toFixed(1)}{" "}
                g
              </p>
            </div>

            <div>
              <span className="text-xs">Gorduras</span>
              <p className="font-semibold">
                {(
                  Number(alimentoSelecionado.gorduras || 0) *
                  (Number(quantidadeAlimento) / 100)
                ).toFixed(1)}{" "}
                g
              </p>
            </div>
          </div>
        )}


        {/* BOTÕES DO ALIMENTO */}
        <div className="flex justify-end gap-3 mt-5">
          <button
            type="button"
            onClick={() => {
              setAlimentoSelecionado(null);
              setQuantidadeAlimento("");
              setBuscaAlimento("");
              setResultadosAlimentos([]);
            }}
            className="px-4 py-2 rounded-lg"
            style={{
              border: "1px solid var(--sage)",
              background: "#fff",
              color: "var(--ink)",
            }}
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={salvarAlimento}
            className="px-4 py-2 rounded-lg font-medium"
            style={{
              background: "var(--forest)",
              color: "#ffffff",
            }}
          >
            Salvar alimento
          </button>
   
   </div>

      </div>
    )}

  </div>
)}
        {mostrarFormularioRefeicao && planoSalvo && (
          <div
            className="mt-5 rounded-xl p-5"
            style={{ background: "#fff", border: "1px solid var(--sage)" }}
          >
            <div className="flex items-center justify-between mb-5">
              <div>
                <h4 className="font-semibold" style={{ color: "var(--ink)" }}>{refeicaoEditando ? "Editar refeição" : "Nova refeição"}</h4>
                <p className="text-sm" style={{ color: "var(--sage-dark)" }}>
                  Adicione uma refeição ao plano alimentar.
                </p>
              </div>
              <button type="button" onClick={() => setMostrarFormularioRefeicao(false)} className="p-2 rounded-lg">
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm mb-1">Nome da refeição</label>
                <input
                  type="text"
                  value={refeicao.nome}
                  onChange={(e) => atualizarCampoRefeicao("nome", e.target.value)}
                  placeholder="Ex: Café da manhã"
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm mb-1">Horário</label>
                <input
                  type="time"
                  value={refeicao.horario}
                  onChange={(e) => atualizarCampoRefeicao("horario", e.target.value)}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
            </div>

            <div className="mt-4">
              <label className="block text-sm mb-1">Observações</label>
              <textarea
                value={refeicao.observacoes}
                onChange={(e) => atualizarCampoRefeicao("observacoes", e.target.value)}
                placeholder="Ex: Refeição antes do treino..."
                rows={3}
                className="w-full border rounded-lg px-3 py-2"
              />
            </div>

            <div className="flex justify-end gap-3 mt-5">
              <button
                type="button"
                onClick={() => setMostrarFormularioRefeicao(false)}
                className="px-4 py-2 rounded-lg border"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={salvarRefeicao}
                className="px-4 py-2 rounded-lg font-medium"
                style={{ background: "var(--ink)", color: "white" }}
              >
                Salvar refeição
              </button>
            </div>
          </div>
        )}

        {mostrarFormulario && (
          <div
            className="mt-5 rounded-xl p-5"
            style={{ background: "#fff", border: "1px solid var(--sage)" }}
          >
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="font-semibold" style={{ color: "var(--ink)" }}>Novo plano alimentar</h3>
                <p className="text-sm" style={{ color: "var(--sage-dark)" }}>
                  Paciente: {client?.name}
                </p>
              </div>
              <button type="button" onClick={() => setMostrarFormulario(false)} className="p-2 rounded-lg">
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm mb-1">Nome do plano</label>
                <input
                  type="text"
                  value={plano.nome}
                  onChange={(e) => atualizarCampo("nome", e.target.value)}
                  placeholder="Ex: Plano para emagrecimento"
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm mb-1">Objetivo</label>
                <select
                  value={plano.objetivo}
                  onChange={(e) => atualizarCampo("objetivo", e.target.value)}
                  className="w-full border rounded-lg px-3 py-2"
                >
                  <option value="">Selecione</option>
                  <option value="Emagrecimento">Emagrecimento</option>
                  <option value="Manutenção">Manutenção</option>
                  <option value="Ganho de massa">Ganho de massa</option>
                  <option value="Reeducação alimentar">Reeducação alimentar</option>
                </select>
              </div>
            </div>

            <h4 className="font-semibold mt-6 mb-3" style={{ color: "var(--ink)" }}>Metas diárias</h4>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm mb-1">Calorias</label>
                <input type="number" value={plano.calorias_meta} onChange={(e) => atualizarCampo("calorias_meta", e.target.value)} placeholder="2000" className="w-full border rounded-lg px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm mb-1">Proteínas (g)</label>
                <input type="number" value={plano.proteinas_meta} onChange={(e) => atualizarCampo("proteinas_meta", e.target.value)} placeholder="150" className="w-full border rounded-lg px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm mb-1">Carboidratos (g)</label>
                <input type="number" value={plano.carboidratos_meta} onChange={(e) => atualizarCampo("carboidratos_meta", e.target.value)} placeholder="220" className="w-full border rounded-lg px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm mb-1">Gorduras (g)</label>
                <input type="number" value={plano.gorduras_meta} onChange={(e) => atualizarCampo("gorduras_meta", e.target.value)} placeholder="60" className="w-full border rounded-lg px-3 py-2" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
              <div>
                <label className="block text-sm mb-1">Data de início</label>
                <input type="date" value={plano.data_inicio} onChange={(e) => atualizarCampo("data_inicio", e.target.value)} className="w-full border rounded-lg px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm mb-1">Data final</label>
                <input type="date" value={plano.data_fim} onChange={(e) => atualizarCampo("data_fim", e.target.value)} className="w-full border rounded-lg px-3 py-2" />
              </div>
            </div>

            <div className="mt-5">
              <label className="block text-sm mb-1">Observações</label>
              <textarea
                value={plano.observacoes}
                onChange={(e) => atualizarCampo("observacoes", e.target.value)}
                placeholder="Orientações gerais do plano alimentar..."
                rows={3}
                className="w-full border rounded-lg px-3 py-2"
              />
            </div>

            <div className="flex justify-end gap-3 mt-5">
              <button type="button" onClick={() => setMostrarFormulario(false)} className="px-4 py-2 rounded-lg border">
                Cancelar
              </button>
              <button
                type="button"
                onClick={salvarPlano}
                className="px-4 py-2 rounded-lg font-medium"
                style={{ background: "var(--ink)", color: "white" }}
              >
                Continuar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
