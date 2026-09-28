import { useEffect, useState } from "react";
import { Plus, Utensils, X, Pencil, Trash2 } from "lucide-react";
import { supabase } from "../supabase";

export default function PlanoAlimentar({ client }) {
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [mostrarFormularioRefeicao, setMostrarFormularioRefeicao] = useState(false);
  const [planoSalvo, setPlanoSalvo] = useState(null);
  const [refeicoes, setRefeicoes] = useState([]);
  const [refeicaoEditando, setRefeicaoEditando] = useState(null);

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
          console.error("Erro ao carregar plano alimentar:", error);
          return;
        }

        setPlanoSalvo(data);

        if (!data?.id) {
          setRefeicoes([]);
          return;
        }

        const { data: refeicoesData, error: refeicoesError } = await supabase
          .from("refeicoes")
          .select("*")
          .eq("plano_id", data.id)
          .order("horario", { ascending: true });

        if (refeicoesError) {
          console.error("Erro ao carregar refeições:", refeicoesError);
          return;
        }

        setRefeicoes(refeicoesData || []);
      } catch (error) {
        console.error("Erro ao carregar plano alimentar:", error);
      }
    };

    carregarPlano();
  }, [client?.id]);

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
                        <p className="text-sm mt-2" style={{ color: "var(--sage-dark)" }}>
                          {item.observacoes}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
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
