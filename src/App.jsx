import "./NutriTrackAnimations.css";
import React, { useState, useEffect, useMemo, useCallback } from "react";
import PlanoAlimentar from "./components/PlanoAlimentar";
import { supabase } from "./supabase";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import {
  Plus, Search, Ruler, Scale, TrendingUp, TrendingDown, Calendar,
  Trash2, Pencil, X, ChevronRight, Leaf, Phone, Mail, Target,
  ClipboardList, AlertCircle, Loader2, Check
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend
} from "recharts";

/* ---------------------------------------------------------
   Helpers
--------------------------------------------------------- */
const genId = () => crypto.randomUUID();

const fmtDate = (iso) => {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};

const fmtDateShort = (iso) => {
  if (!iso) return "";
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
};

const calcAge = (birthDate) => {
  if (!birthDate) return null;
  const b = new Date(birthDate + "T00:00:00");
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  const monthDiff = now.getMonth() - b.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < b.getDate())) age--;
  return age;
};

const calcBMI = (weightKg, heightCm) => {
  if (!weightKg || !heightCm) return null;
  const h = heightCm / 100;
  return weightKg / (h * h);
};

const bmiCategory = (bmi) => {
  if (bmi == null) return { label: "—", color: "var(--sage-dark)" };
  if (bmi < 18.5) return { label: "Abaixo do peso", color: "var(--gold)" };
  if (bmi < 25) return { label: "Peso normal", color: "var(--forest)" };
  if (bmi < 30) return { label: "Sobrepeso", color: "var(--gold)" };
  if (bmi < 35) return { label: "Obesidade grau I", color: "var(--berry)" };
  if (bmi < 40) return { label: "Obesidade grau II", color: "var(--berry)" };
  return { label: "Obesidade grau III", color: "var(--berry)" };
};

const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

const sortedEntries = (client) =>
  [...(client.entries || [])].sort((a, b) => a.date.localeCompare(b.date));

const latestEntry = (client) => {
  const e = sortedEntries(client);
  return e.length ? e[e.length - 1] : null;
};

const currentWeight = (client) => {
  const le = latestEntry(client);
  return le ? le.weight : client.initialWeight;
};

const progressPercent = (client) => {
  const goal = parseFloat(client.goalWeight);
  const start = parseFloat(client.initialWeight);
  const cur = parseFloat(currentWeight(client));
  if (!goal || !start || goal === start) return null;
  const total = goal - start;
  const done = cur - start;
  return clamp((done / total) * 100, 0, 100);
};

/* ---------------------------------------------------------
   Storage layer
--------------------------------------------------------- */
// Armazenamento local do navegador.
// O código original usava window.storage, que existe em alguns ambientes
// específicos, mas não existe em um projeto React/Vite comum.
// Aqui usamos localStorage para que o projeto funcione normalmente no navegador.
const STORAGE_KEY = "nutri-track-clients";

async function loadClients() {
  try {
    // Primeiro verifica a sessão atual
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError) {
      console.error("Erro ao verificar sessão:", sessionError);
      throw sessionError;
    }

    const user = session?.user;

    console.log("Usuário carregando pacientes:", user?.id);

    if (!user) {
      console.log("Usuário ainda não autenticado.");
      return [];
    }

    // Busca somente os pacientes do nutricionista logado
    const { data, error } = await supabase
      .from("pacientes")
      .select("*")
      .eq("nutricionista_id", user.id)
      .order("nome", { ascending: true });

    if (error) {
      console.error("Erro ao carregar pacientes:", error);
      throw error;
    }

    console.log("Pacientes encontrados:", data);

    return (data || []).map((paciente) => ({
      id: paciente.id,
      name: paciente.nome || "",
      birthDate: paciente.data_nascimento || "",
      sexo: paciente.sexo || "",
      phone: paciente.telefone || "",
      email: paciente.email || "",
      height: paciente.altura ?? "",
      initialWeight: paciente.peso_inicial ?? "",
      goalWeight: paciente.peso_meta ?? "",
      goalNotes: paciente.observacoes || "",
    }));
  } catch (error) {
    console.error("Erro dentro de loadClients:", error);
    throw error;
  }
}

async function saveClient(client) {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error("Usuário não autenticado.");
  }

  const paciente = {
    nutricionista_id: user.id,
    nome: client.name,
    data_nascimento: client.birthDate || null,
    sexo: client.sexo || null,
    telefone: client.phone || null,
    email: client.email || null,
    altura: client.height ? Number(client.height) : null,
    peso_inicial: client.initialWeight
      ? Number(client.initialWeight)
      : null,
    peso_meta: client.goalWeight
      ? Number(client.goalWeight)
      : null,
    observacoes: client.goalNotes || null,
  };

  const uuidValido =
    typeof client.id === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      client.id
    );

  console.log("Usuário autenticado:", user.id);
  console.log("Paciente que será enviado:", paciente);  
  console.log("client.id:", client.id);
  console.log("uuidValido:", uuidValido);   

  let result;

  if (uuidValido) {
    result = await supabase
      .from("pacientes")
      .update(paciente)
      .eq("id", client.id)
      .eq("nutricionista_id", user.id)
      .select();
  } else {
    result = await supabase
      .from("pacientes")
      .insert([paciente])
      .select();


  }
  console.log("RESULTADO SUPABASE:", result);

if (result.error) {
  console.error("ERRO SUPABASE:", result.error);
  throw result.error;
}

console.log("PACIENTE SALVO NO BANCO:", result.data);

return result.data;
}

  

  


async function deleteClientStorage(id) {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error("Usuário não autenticado.");
  }

  console.log("ID usuário logado:", user.id);
  console.log("ID paciente:", id);

  const { data, error } = await supabase
    .from("pacientes")
    .delete()
    .eq("id", id)
    .eq("nutricionista_id", user.id)
    .select();

  console.log("Resultado da exclusão:", data);

  if (error) {
    console.error("Erro ao excluir paciente:", error);
    throw error;
  }

  if (!data || data.length === 0) {
    throw new Error(
      "Nenhum paciente foi excluído. Verifique o ID e as permissões."
    );
  }

  return data;
}

/* ---------------------------------------------------------
   Ring avatar — signature element (growth-ring motif)
--------------------------------------------------------- */
function RingAvatar({ name, percent, size = 44 }) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
  const r = size / 2 - 4;
  const c = 2 * Math.PI * r;
  const pct = percent == null ? 0 : percent;
  const dash = (pct / 100) * c;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--sage)"
          strokeWidth="3"
          opacity="0.5"
        />
        {percent != null && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="var(--forest)"
            strokeWidth="3"
            strokeDasharray={`${dash} ${c - dash}`}
            strokeLinecap="round"
          />
        )}
      </svg>
      <div
        className="absolute inset-0 flex items-center justify-center text-[11px] font-semibold"
        style={{ color: "var(--forest)", fontFamily: "var(--font-mono)" }}
      >
        {initials}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------
   Modal shell
--------------------------------------------------------- */
function Modal({ title, onClose, children, wide }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(34,48,31,0.45)" }}
      onClick={onClose}
    >
      <div
        className={`w-full ${wide ? "max-w-2xl" : "max-w-md"} max-h-[88vh] overflow-y-auto rounded-2xl shadow-2xl`}
        style={{ background: "var(--paper)", border: "1px solid var(--sage)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between px-6 py-4 sticky top-0 z-10"
          style={{ background: "var(--paper)", borderBottom: "1px solid var(--sage)" }}
        >
          <h2
            className="text-lg"
            style={{ fontFamily: "var(--font-display)", color: "var(--ink)", fontWeight: 600 }}
          >
            {title}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-black/5 transition-colors"
            style={{ color: "var(--ink)" }}
          >
            <X size={18} />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------
   Field components
--------------------------------------------------------- */
function Field({ label, children, required }) {
  return (
    <label className="block mb-4">
      <span
        className="block text-xs mb-1.5 uppercase tracking-wide"
        style={{ color: "var(--sage-dark)", fontFamily: "var(--font-body)", fontWeight: 600, letterSpacing: "0.06em" }}
      >
        {label} {required && <span style={{ color: "var(--berry)" }}>*</span>}
      </span>
      {children}
    </label>
  );
}

const inputClass =
  "w-full px-3 py-2.5 rounded-lg text-sm outline-none transition-colors focus:ring-2";
const inputStyle = {
  background: "#fff",
  border: "1px solid var(--sage)",
  color: "var(--ink)",
  fontFamily: "var(--font-body)",
};

/* ---------------------------------------------------------
   Client form (create / edit)
--------------------------------------------------------- */
function ClientForm({ initial, onCancel, onSave }) {
  const [form, setForm] = useState(
    initial || {
      name: "",
      birthDate: "",
      sexo: "",
      phone: "",
      email: "",
      height: "",
      initialWeight: "",
      goalWeight: "",
      goalNotes: "",
    }
  );
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      await onSave(form);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit}>
      <Field label="Nome completo" required>
        <input className={inputClass} style={inputStyle} value={form.name} onChange={set("name")} placeholder="Ex: Marina Alves" required />
      </Field>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Data de nascimento">
          <input type="date" className={inputClass} style={inputStyle} value={form.birthDate} onChange={set("birthDate")} />
          <div>
  <label className="block text-sm font-medium mb-1">
    Sexo
  </label>

  <select
    value={form.sexo}
    onChange={set("sexo")}
    className="w-full rounded-lg border px-3 py-2"
  >
    <option value="">Selecione</option>
    <option value="Masculino">Masculino</option>
    <option value="Feminino">Feminino</option>
  </select>
</div>
        </Field>
        <Field label="Altura (cm)">
          <input type="number" step="0.1" className={inputClass} style={inputStyle} value={form.height} onChange={set("height")} placeholder="165" />
        </Field>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Telefone">
          <input className={inputClass} style={inputStyle} value={form.phone} onChange={set("phone")} placeholder="(79) 99999-9999" />
        </Field>
        <Field label="E-mail">
          <input type="email" className={inputClass} style={inputStyle} value={form.email} onChange={set("email")} placeholder="cliente@email.com" />
        </Field>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Peso inicial (kg)" required>
          <input type="number" step="0.1" className={inputClass} style={inputStyle} value={form.initialWeight} onChange={set("initialWeight")} placeholder="72.5" required />
        </Field>
        <Field label="Peso meta (kg)">
          <input type="number" step="0.1" className={inputClass} style={inputStyle} value={form.goalWeight} onChange={set("goalWeight")} placeholder="65" />
        </Field>
      </div>
      <Field label="Objetivo / observações">
        <textarea rows={3} className={inputClass} style={inputStyle} value={form.goalNotes} onChange={set("goalNotes")} placeholder="Ex: reeducação alimentar, ganho de massa magra, restrições..." />
      </Field>
      <div className="flex justify-end gap-2 mt-2">
        <button type="button" onClick={onCancel} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ color: "var(--ink)", border: "1px solid var(--sage)" }}>
          Cancelar
        </button>
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 text-white disabled:opacity-60"
          style={{ background: "var(--forest)" }}
        >
          {saving && <Loader2 size={14} className="animate-spin" />}
          Salvar cliente
        </button>
      </div>
    </form>
  );
}

/* ---------------------------------------------------------
   Measurement (progress entry) form
--------------------------------------------------------- */
function EntryForm({ initial, onCancel, onSave }) {
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState(
    initial || {
      date: today,
      weight: "",
      waist: "",
      hip: "",
      chest: "",
      arm: "",
      thigh: "",
      bodyFat: "",
      notes: "",
    }
  );
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.date || !form.weight) return;
    setSaving(true);
    try {
      await onSave(form);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Data" required>
          <input type="date" className={inputClass} style={inputStyle} value={form.date} onChange={set("date")} required />
        </Field>
        <Field label="Peso (kg)" required>
          <input type="number" step="0.1" className={inputClass} style={inputStyle} value={form.weight} onChange={set("weight")} placeholder="70.2" required />
        </Field>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Field label="Cintura (cm)">
          <input type="number" step="0.1" className={inputClass} style={inputStyle} value={form.waist} onChange={set("waist")} />
        </Field>
        <Field label="Quadril (cm)">
          <input type="number" step="0.1" className={inputClass} style={inputStyle} value={form.hip} onChange={set("hip")} />
        </Field>
        <Field label="Peitoral (cm)">
          <input type="number" step="0.1" className={inputClass} style={inputStyle} value={form.chest} onChange={set("chest")} />
        </Field>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Field label="Braço (cm)">
          <input type="number" step="0.1" className={inputClass} style={inputStyle} value={form.arm} onChange={set("arm")} />
        </Field>
        <Field label="Coxa (cm)">
          <input type="number" step="0.1" className={inputClass} style={inputStyle} value={form.thigh} onChange={set("thigh")} />
        </Field>
        <Field label="Gordura (%)">
          <input type="number" step="0.1" className={inputClass} style={inputStyle} value={form.bodyFat} onChange={set("bodyFat")} />
        </Field>
      </div>
      <Field label="Observações da consulta">
        <textarea rows={3} className={inputClass} style={inputStyle} value={form.notes} onChange={set("notes")} placeholder="Como a pessoa está se sentindo, ajustes no plano..." />
      </Field>
      <div className="flex justify-end gap-2 mt-2">
        <button type="button" onClick={onCancel} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ color: "var(--ink)", border: "1px solid var(--sage)" }}>
          Cancelar
        </button>
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 text-white disabled:opacity-60"
          style={{ background: "var(--forest)" }}
        >
          {saving && <Loader2 size={14} className="animate-spin" />}
          Salvar medição
        </button>
      </div>
    </form>
  );
}

/* ---------------------------------------------------------
   Stat card
--------------------------------------------------------- */
function StatCard({ icon: Icon, label, value, sub, accent }) {
  return (
    <div className="rounded-xl p-4" style={{ background: "#fff", border: "1px solid var(--sage)" }}>
      <div className="flex items-center gap-2 mb-2" style={{ color: "var(--sage-dark)" }}>
        <Icon size={14} />
        <span className="text-[11px] uppercase tracking-wide font-semibold" style={{ letterSpacing: "0.06em" }}>{label}</span>
      </div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: "1.5rem", fontWeight: 600, color: accent || "var(--ink)" }}>
        {value}
      </div>
      {sub && <div className="text-xs mt-1" style={{ color: "var(--sage-dark)" }}>{sub}</div>}
    </div>
  );
}

/* ---------------------------------------------------------
   Client detail panel
--------------------------------------------------------- */
function ClientDetail({ client, onUpdate, onDeleteClient, onEditClient }) {
  const [enviandoConvite, setEnviandoConvite] = useState(false);

const enviarConvitePaciente = async () => {
  if (!client.email) {
    alert("Cadastre um e-mail para o paciente.");
    return;
  }

  if (client.auth_user_id) {
    alert("Este paciente já possui acesso.");
    return;
  }

  const confirmar = window.confirm(
    `Deseja enviar um convite para ${client.email}?`
  );

  if (!confirmar) return;

  setEnviandoConvite(true);

  try {
    const { data, error } = await supabase.functions.invoke(
      "convidar-paciente",
      {
        body: {
          pacienteId: client.id,
        },
      }
    );

    if (error) {
      let mensagem = error.message;

      try {
        const detalhes = await error.context?.json();
        mensagem = detalhes?.erro || mensagem;
      } catch {
        // Mantém a mensagem original
      }

      throw new Error(mensagem);
    }

    if (!data?.sucesso) {
      throw new Error(data?.erro || "Erro ao enviar convite.");
    }

    alert("Convite enviado com sucesso!");
  } catch (erro) {
    console.error("Erro ao enviar convite:", erro);
    alert(erro.message || "Não foi possível enviar o convite.");
  } finally {
    setEnviandoConvite(false);
  }
};
  const [showEntryForm, setShowEntryForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [medicoes, setMedicoes] = useState([]);
  const [loadingMedicoes, setLoadingMedicoes] = useState(false);
  const [confirmDeleteClient, setConfirmDeleteClient] = useState(false);
  const [confirmDeleteEntry, setConfirmDeleteEntry] = useState(null);
  const [showAvaliacaoForm, setShowAvaliacaoForm] = useState(false);
  const [avaliacoes, setAvaliacoes] = useState([]);
  const [loadingAvaliacoes, setLoadingAvaliacoes] = useState(false);
  const [editingAvaliacao, setEditingAvaliacao] = useState(null);

  const [avaliacao, setAvaliacao] = useState({
  protocolo: "",      
  data_avaliacao: "",
  peso: "",
  estatura: "",
  pescoco: "",
  torax: "",
  braco_relaxado: "",
  braco_contraido: "",
  antebraco: "",
  cintura: "",
  abdomen: "",
  quadril: "",
  coxa: "",
  panturrilha: "",
  tricipital: "",
  bicipital: "",
  subescapular: "",
  supra_iliaca: "",
  abdominal: "",
  peitoral: "",
  axilar_media: "",
  coxa_medial: "",
  panturrilha_medial: "",
  observacoes: "",
});

const carregarMedicoes = async () => {
  if (!client?.id) return;

  setLoadingMedicoes(true);

  try {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      throw new Error("Usuário não autenticado.");
    }

    const { data, error } = await supabase
      .from("medicoes")
      .select("*")
      .eq("paciente_id", client.id)
      .eq("nutricionista_id", user.id)
      .order("data_medicao", { ascending: false });

    console.log("Paciente selecionado:", client.id);
    console.log("Nutricionista:", user.id);
    console.log("Medições retornadas:", data);
    console.log("Erro na consulta:", error);

    if (error) throw error;

    const formatadas = (data || []).map((item) => ({
      id: item.id,
      date: item.data_medicao,
      weight: item.peso,
      waist: item.cintura,
      hip: item.quadril,
      chest: item.peitoral,
      arm: item.braco,
      thigh: item.coxa,
      bodyFat: item.percentual_gordura,
      notes: item.observacoes,
    }));

    setMedicoes(formatadas);
  } catch (error) {
    console.error("Erro ao carregar medições:", error);
  } finally {
    setLoadingMedicoes(false);
  }
};


useEffect(() => {
  carregarMedicoes();
}, [client.id]);
// Cálculos em tempo real da avaliação
const pesoAvaliacao = Number(avaliacao.peso);
const estaturaAvaliacao = Number(avaliacao.estatura);
const cinturaAvaliacao = Number(avaliacao.cintura);
const quadrilAvaliacao = Number(avaliacao.quadril);

// IMC
let imcAvaliacao = null;

if (pesoAvaliacao > 0 && estaturaAvaliacao > 0) {
  const alturaMetros = estaturaAvaliacao / 100;

  imcAvaliacao =
    pesoAvaliacao / (alturaMetros * alturaMetros);
}

// RCQ
let rcqAvaliacao = null;

if (cinturaAvaliacao > 0 && quadrilAvaliacao > 0) {
  rcqAvaliacao =
    cinturaAvaliacao / quadrilAvaliacao;
}

// Soma das pregas
const pregasAvaliacao = [
  avaliacao.tricipital,
  avaliacao.bicipital,
  avaliacao.subescapular,
  avaliacao.supra_iliaca,
  avaliacao.abdominal,
  avaliacao.peitoral,
  avaliacao.axilar_media,
  avaliacao.coxa_medial,
  avaliacao.panturrilha_medial,
];


const somaPregasAvaliacao = pregasAvaliacao.reduce(
  (total, valor) => total + (Number(valor) || 0),
  0
);
const excluirAvaliacao = async (id) => {
  const confirmar = window.confirm(
    "Tem certeza que deseja excluir esta avaliação? Esta ação não poderá ser desfeita."
  );

  if (!confirmar) return;

  try {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      throw new Error("Usuário não autenticado.");
    }

    const { data, error } = await supabase
      .from("avaliacoes")
      .delete()
      .eq("id", id)
      .eq("paciente_id", client.id)
      .select();

    console.log("ID avaliação:", id);
    console.log("ID paciente:", client.id);
    console.log("Dados retornados pelo DELETE:", data);
    console.log("Erro retornado pelo DELETE:", error);

    if (error) {
      console.error("Erro ao excluir avaliação:", error);
      throw error;
    }

    if (!data || data.length === 0) {
      throw new Error(
        "Nenhuma avaliação foi excluída. Verifique as permissões."
      );
    }

    setAvaliacoes((anteriores) =>
      anteriores.filter((item) => item.id !== id)
    );

    console.log("Avaliação excluída com sucesso.");
  } catch (error) {
    console.error("Erro ao excluir avaliação:", error);
    alert("Não foi possível excluir a avaliação.");
  }
};

const carregarAvaliacoes = async () => {
  if (!client?.id) return;

  setLoadingAvaliacoes(true);

  try {
    const { data, error } = await supabase
      .from("avaliacoes")
      .select("*")
      .eq("paciente_id", client.id)
      .order("data_avaliacao", { ascending: false });

    if (error) {
      console.error("Erro ao carregar avaliações:", error);
      return;
    }

    setAvaliacoes(data || []);
  } catch (error) {
    console.error("Erro ao carregar avaliações:", error);
  } finally {
    setLoadingAvaliacoes(false);
  }
};
useEffect(() => {
  carregarAvaliacoes();
}, [client.id]);

const salvarAvaliacao = async () => {
  try {
    
    console.log("PROTOCOLO SELECIONADO:", avaliacao.protocolo);
    console.log("AVALIAÇÃO COMPLETA:", avaliacao);

    // Valores usados nos cálculos
const peso = Number(avaliacao.peso);
const estaturaCm = Number(avaliacao.estatura);
const cintura = Number(avaliacao.cintura);
const quadril = Number(avaliacao.quadril);

// IMC
let imc = null;

if (peso > 0 && estaturaCm > 0) {
  const estaturaMetros = estaturaCm / 100;
  imc = peso / (estaturaMetros * estaturaMetros);
  imc = Number(imc.toFixed(2));
}

// Relação cintura-quadril (RCQ)
let rcq = null;

if (cintura > 0 && quadril > 0) {
  rcq = cintura / quadril;
  rcq = Number(rcq.toFixed(2));
}

// Somatório das pregas cutâneas
const pregas = [
  avaliacao.tricipital,
  avaliacao.bicipital,
  avaliacao.subescapular,
  avaliacao.supra_iliaca,
  avaliacao.abdominal,
  avaliacao.peitoral,
  avaliacao.axilar_media,
  avaliacao.coxa_medial,
  avaliacao.panturrilha_medial,
];

const somaPregas = pregas.reduce(
  (total, valor) => total + (Number(valor) || 0),
  0
);

// Resultado do protocolo de avaliação
let percentualGordura = null;
let densidadeCorporal = null;
let somaPregasProtocolo = somaPregas;

if (avaliacao.protocolo === "jackson_pollock_3") {
  try {
    const idade = calcularIdade(client.birthDate);

    if (idade === null) {
      throw new Error("O paciente precisa ter a data de nascimento cadastrada.");
    }

    const resultadoProtocolo = calcularJacksonPollock3({
      sexo: client.sexo,
      idade: idade,
      peitoral: avaliacao.peitoral,
      abdominal: avaliacao.abdominal,
      coxa: avaliacao.coxa_medial,
      tricipital: avaliacao.tricipital,
      supraIliaca: avaliacao.supra_iliaca,
    });

    percentualGordura = Number(
      resultadoProtocolo.percentualGordura.toFixed(2)
    );

    densidadeCorporal = Number(
      resultadoProtocolo.densidade.toFixed(4)
    );

    somaPregasProtocolo = Number(
      resultadoProtocolo.somaPregas.toFixed(2)
    );
  } catch (erro) {
    console.error("Erro no protocolo:", erro);
    alert(erro.message);
    return;
  }
}
console.log("===== TESTE JACKSON & POLLOCK =====");
console.log("Protocolo:", avaliacao.protocolo);
console.log("Sexo do paciente:", client.sexo);
console.log("Data nascimento:", client.birthDate);
console.log("Soma das pregas:", somaPregasProtocolo);
console.log("Densidade corporal:", densidadeCorporal);
console.log("Percentual de gordura:", percentualGordura);
console.log("==================================");
    const dadosAvaliacao = {
      paciente_id: client.id,

      protocolo: avaliacao.protocolo || null,

      data_avaliacao:
        avaliacao.data_avaliacao || new Date().toISOString().split("T")[0],

      peso: avaliacao.peso ? Number(avaliacao.peso) : null,
      estatura: avaliacao.estatura ? Number(avaliacao.estatura) : null,

      pescoco: avaliacao.pescoco ? Number(avaliacao.pescoco) : null,
      torax: avaliacao.torax ? Number(avaliacao.torax) : null,
      braco_relaxado: avaliacao.braco_relaxado
        ? Number(avaliacao.braco_relaxado)
        : null,
      braco_contraido: avaliacao.braco_contraido
        ? Number(avaliacao.braco_contraido)
        : null,
      antebraco: avaliacao.antebraco ? Number(avaliacao.antebraco) : null,
      cintura: avaliacao.cintura ? Number(avaliacao.cintura) : null,
      abdomen: avaliacao.abdomen ? Number(avaliacao.abdomen) : null,
      quadril: avaliacao.quadril ? Number(avaliacao.quadril) : null,
      coxa: avaliacao.coxa ? Number(avaliacao.coxa) : null,
      panturrilha: avaliacao.panturrilha
        ? Number(avaliacao.panturrilha)
        : null,

      tricipital: avaliacao.tricipital
        ? Number(avaliacao.tricipital)
        : null,
      bicipital: avaliacao.bicipital
        ? Number(avaliacao.bicipital)
        : null,
      subescapular: avaliacao.subescapular
        ? Number(avaliacao.subescapular)
        : null,
      supra_iliaca: avaliacao.supra_iliaca
        ? Number(avaliacao.supra_iliaca)
        : null,
      abdominal: avaliacao.abdominal
        ? Number(avaliacao.abdominal)
        : null,
      peitoral: avaliacao.peitoral
        ? Number(avaliacao.peitoral)
        : null,
      axilar_media: avaliacao.axilar_media
        ? Number(avaliacao.axilar_media)
        : null,
      coxa_medial: avaliacao.coxa_medial
        ? Number(avaliacao.coxa_medial)
        : null,
      panturrilha_medial: avaliacao.panturrilha_medial
        ? Number(avaliacao.panturrilha_medial)
        : null,

      observacoes: avaliacao.observacoes || null,
      imc: imc,
      rcq: rcq,

      soma_pregas: somaPregasProtocolo,
      percentual_gordura: percentualGordura,
      densidade_corporal: densidadeCorporal,
    };

    console.log("DADOS QUE SERÃO SALVOS:", dadosAvaliacao);

   let error;

if (editingAvaliacao?.id) {
  // EDITAR avaliação existente
  const resultado = await supabase
    .from("avaliacoes")
    .update(dadosAvaliacao)
    .eq("id", editingAvaliacao.id)
    .eq("paciente_id", client.id);

  error = resultado.error;
} else {
  // CRIAR nova avaliação
  const resultado = await supabase
    .from("avaliacoes")
    .insert(dadosAvaliacao);

  error = resultado.error;
}

if (error) {
  console.error("Erro ao salvar avaliação:", error);
  alert(
    editingAvaliacao
      ? "Não foi possível atualizar a avaliação."
      : "Não foi possível salvar a avaliação."
  );
  return;
}

await carregarAvaliacoes();

alert(
  editingAvaliacao
    ? "Avaliação atualizada com sucesso!"
    : "Avaliação salva com sucesso!"
);

setEditingAvaliacao(null);
    

    setAvaliacao({
      protocolo: "",
      data_avaliacao: "",
      peso: "",
      estatura: "",
      pescoco: "",
      torax: "",
      braco_relaxado: "",
      braco_contraido: "",
      antebraco: "",
      cintura: "",
      abdomen: "",
      quadril: "",
      coxa: "",
      panturrilha: "",
      tricipital: "",
      bicipital: "",
      subescapular: "",
      supra_iliaca: "",
      abdominal: "",
      peitoral: "",
      axilar_media: "",
      coxa_medial: "",
      panturrilha_medial: "",
      observacoes: "",
    });

    setShowAvaliacaoForm(false);
  } catch (error) {
    console.error(error);
    alert("Ocorreu um erro ao salvar a avaliação.");
  }
};



const entries = [...medicoes]
  .filter((item) => item.weight != null && item.date)
  .sort(
    (a, b) =>
      new Date(a.date) - new Date(b.date)
  )
  .map((item) => ({
    id: item.id,
    date: item.date,
    label: new Date(
      item.date + "T12:00:00"
    ).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
    }),
    weight: Number(item.weight),
    waist: item.waist,
    hip: item.hip,
    bodyFat: item.bodyFat,
  }));


  const cw = currentWeight(client);
  const bmi = calcBMI(cw, client.height);
  const cat = bmiCategory(bmi);
  const pct = progressPercent(client);
  const age = calcAge(client.birthDate);

 const pesoPrimeiraAvaliacao =
  entries.length > 0 ? Number(entries[0].weight) : null;

const pesoUltimaAvaliacao =
  entries.length > 0
    ? Number(entries[entries.length - 1].weight)
    : null;

const weightChange =
  pesoPrimeiraAvaliacao != null && pesoUltimaAvaliacao != null
    ? pesoUltimaAvaliacao - pesoPrimeiraAvaliacao
    : null;

 




// Avaliação antropométrica mais recente
const avaliacaoMaisRecente =
  avaliacoes && avaliacoes.length > 0
    ? [...avaliacoes].sort(
        (a, b) =>
          new Date(b.data_avaliacao) - new Date(a.data_avaliacao)
      )[0]
    : null;

const gerarPDF = async () => {
  try {

    const goalWeight = client.goalWeight
  ? parseFloat(client.goalWeight)
  : null;

   

console.log("AVALIAÇÃO MAIS RECENTE PARA O PDF:", avaliacaoMaisRecente);

    const pdf = new jsPDF("p", "mm", "a4");

    const larguraPagina = pdf.internal.pageSize.getWidth();

    // ==========================================
// PALETA DE CORES DO NUTRITRACK
// ==========================================

const cores = {
  forest: [47, 75, 60],
  bg: [237, 239, 231],
  paper: [245, 247, 242],
  ink: [34, 48, 31],
  sage: [199, 210, 191],
  sageDark: [108, 125, 100],
  sageTint: [233, 238, 226],
  berry: [156, 61, 84],
  gold: [184, 137, 47],
};

    // =========================
// CABEÇALHO NUTRITRACK
// =========================

// Fundo verde do cabeçalho
pdf.setFillColor(...cores.forest);
pdf.rect(0, 0, larguraPagina, 40, "F");

// Nome do sistema
pdf.setTextColor(255, 255, 255);
pdf.setFont("helvetica", "bold");
pdf.setFontSize(22);
pdf.text("NutriTrack", 15, 18);

// Subtítulo
pdf.setFont("helvetica", "normal");
pdf.setFontSize(12);
pdf.text("Relatório de Avaliação Nutricional", 15, 28);

// Linha dourada
pdf.setDrawColor(...cores.gold);
pdf.setLineWidth(1.2);
pdf.line(15, 34, larguraPagina - 15, 34);

// Volta a cor do texto para o restante do PDF
pdf.setTextColor(...cores.ink);

    // =========================
    // DADOS DO PACIENTE
    // =========================

    let y = 47;

    pdf.setFontSize(13);
    pdf.setFont("helvetica", "bold");
    pdf.text("Dados do paciente", 15, y);

    y += 9;

    pdf.setFontSize(10);
    pdf.setFont("helvetica", "normal");

    pdf.text(`Nome: ${client?.name || "—"}`, 15, y);

    y += 7;

    pdf.text(
      `Nascimento: ${client?.birthDate || client?.birth_date || "—"}`,
      15,
      y
    );

    y += 7;

    pdf.text(
      `Idade: ${age != null ? `${age} anos` : "—"}`,
      15,
      y
    );

    // =========================
    // RESUMO
    // =========================

    y += 14;

    pdf.setFontSize(13);
    pdf.setFont("helvetica", "bold");
    pdf.text("Resumo da avaliação", 15, y);

    y += 10;

    pdf.setFontSize(10);

    pdf.text("Peso", 15, y);
    pdf.text("Altura", 60, y);
    pdf.text("IMC", 105, y);
    pdf.text("Meta", 150, y);

    y += 7;

    pdf.setFont("helvetica", "bold");

  pdf.text(
  avaliacaoMaisRecente?.peso != null
    ? `${Number(avaliacaoMaisRecente.peso).toFixed(1)} kg`
    : cw != null
    ? `${Number(cw).toFixed(1)} kg`
    : "—",
  15,
  y
);

pdf.text(
  avaliacaoMaisRecente?.estatura != null
    ? `${avaliacaoMaisRecente.estatura} cm`
    : client?.height
    ? `${client.height} cm`
    : "—",
  60,
  y
);

pdf.text(
  avaliacaoMaisRecente?.imc != null
    ? Number(avaliacaoMaisRecente.imc).toFixed(2)
    : bmi != null
    ? Number(bmi).toFixed(2)
    : "—",
  105,
  y
);

pdf.text(
  goalWeight != null
    ? `${goalWeight} kg`
    : "—",
  150,
  y
);
    // =========================
    // CLASSIFICAÇÃO IMC
    // =========================

    y += 16;

    pdf.setFontSize(13);
    pdf.text("Classificação do IMC", 15, y);

    y += 8;

    pdf.setFontSize(10);
    pdf.setFont("helvetica", "normal");
pdf.text(
  cat ? `Classificação atual: ${cat.label}` : "Classificação atual: —",
  15,
  y
);

    // =========================
    // VARIAÇÃO DE PESO
    // =========================

    y += 14;

    pdf.setFontSize(13);
    pdf.setFont("helvetica", "bold");
    pdf.text("Variação de peso", 15, y);

    y += 8;

    pdf.setFontSize(10);
    pdf.setFont("helvetica", "normal");

   pdf.text(
  weightChange != null
    ? weightChange > 0
      ? `Ganho de peso: +${Number(weightChange).toFixed(1)} kg`
      : weightChange < 0
      ? `Perda de peso: ${Math.abs(Number(weightChange)).toFixed(1)} kg`
      : "Peso mantido: 0.0 kg"
    : "Variação de peso: —",
  15,
  y
);

// =========================
// EVOLUÇÃO DO PESO - GRÁFICO
// =========================

y += 16;

pdf.setFontSize(13);
pdf.setFont("helvetica", "bold");
pdf.setTextColor(...cores.forest);
pdf.text("Evolução do peso", 15, y);

y += 7;

pdf.setFontSize(9);
pdf.setFont("helvetica", "normal");
pdf.setTextColor(...cores.sageDark);

if (entries.length > 0) {
  pdf.text(
    `${entries.length} medição(ões) registrada(s).`,
    15,
    y
  );

  y += 8;

  // ==========================================
  // CONFIGURAÇÃO DO GRÁFICO
  // ==========================================

  const graficoX = 15;
  const graficoY = y;
  const graficoLargura = larguraPagina - 30;
  const graficoAltura = 65;

  const margemEsquerda = 15;
  const margemDireita = 8;
  const margemSuperior = 8;
  const margemInferior = 14;

  // Fundo do gráfico
  pdf.setFillColor(...cores.sageTint);
  pdf.roundedRect(
    graficoX,
    graficoY,
    graficoLargura,
    graficoAltura,
    3,
    3,
    "F"
  );

  // Área interna
  const areaX = graficoX + margemEsquerda;
  const areaY = graficoY + margemSuperior;

  const areaLargura =
    graficoLargura - margemEsquerda - margemDireita;

  const areaAltura =
    graficoAltura - margemSuperior - margemInferior;

  // ==========================================
  // PESOS
  // ==========================================

  const pesosGrafico = entries.map((item) =>
    Number(item.weight)
  );

  // Inclui a meta no cálculo da escala
  if (goalWeight != null) {
    pesosGrafico.push(Number(goalWeight));
  }

  let pesoMin = Math.min(...pesosGrafico);
  let pesoMax = Math.max(...pesosGrafico);

  // Margem visual
  pesoMin = Math.floor(pesoMin - 2);
  pesoMax = Math.ceil(pesoMax + 2);

  if (pesoMax === pesoMin) {
    pesoMax += 1;
  }

  // ==========================================
  // FUNÇÃO PARA CALCULAR POSIÇÃO Y
  // ==========================================

  const calcularY = (peso) => {
    return (
      areaY +
      areaAltura -
      ((peso - pesoMin) / (pesoMax - pesoMin)) *
        areaAltura
    );
  };

  // ==========================================
  // LINHAS HORIZONTAIS + VALORES
  // ==========================================

  const quantidadeLinhas = 4;

  pdf.setFontSize(7);

  for (let i = 0; i <= quantidadeLinhas; i++) {
    const valor =
      pesoMin +
      ((pesoMax - pesoMin) / quantidadeLinhas) * i;

    const posY =
      areaY +
      areaAltura -
      (areaAltura / quantidadeLinhas) * i;

    pdf.setDrawColor(...cores.sage);
    pdf.setLineWidth(0.2);

    pdf.line(
      areaX,
      posY,
      areaX + areaLargura,
      posY
    );

    pdf.setTextColor(...cores.sageDark);

    pdf.text(
      `${valor.toFixed(1)} kg`,
      areaX - 2,
      posY + 2,
      { align: "right" }
    );
  }

  // ==========================================
  // LINHA DA META
  // ==========================================

  if (
    goalWeight != null &&
    Number(goalWeight) >= pesoMin &&
    Number(goalWeight) <= pesoMax
  ) {
    const metaY = calcularY(Number(goalWeight));

    pdf.setDrawColor(...cores.gold);
    pdf.setLineWidth(0.7);

    pdf.line(
      areaX,
      metaY,
      areaX + areaLargura,
      metaY
    );

    pdf.setTextColor(...cores.gold);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(7);

    pdf.text(
      `Meta: ${Number(goalWeight).toFixed(1)} kg`,
      areaX + areaLargura,
      metaY - 2,
      { align: "right" }
    );
  }

  // ==========================================
  // PONTOS DO GRÁFICO
  // ==========================================

  const pontos = entries.map((item, index) => {
    let posX;

    if (entries.length === 1) {
      posX = areaX + areaLargura / 2;
    } else {
      posX =
        areaX +
        (index / (entries.length - 1)) *
          areaLargura;
    }

    return {
      x: posX,
      y: calcularY(Number(item.weight)),
      peso: Number(item.weight),
      label: item.label || "",
    };
  });

  // ==========================================
  // LINHA DA EVOLUÇÃO
  // ==========================================

  pdf.setDrawColor(...cores.forest);
  pdf.setLineWidth(1);

  for (let i = 0; i < pontos.length - 1; i++) {
    pdf.line(
      pontos[i].x,
      pontos[i].y,
      pontos[i + 1].x,
      pontos[i + 1].y
    );
  }

  // ==========================================
  // BOLINHAS + PESO + DATA
  // ==========================================

  pontos.forEach((ponto) => {
    // Ponto verde
    pdf.setFillColor(...cores.forest);
    pdf.circle(
      ponto.x,
      ponto.y,
      1.6,
      "F"
    );

    // Peso acima
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(7);
    pdf.setTextColor(...cores.forest);

    pdf.text(
      `${ponto.peso.toFixed(1)}`,
      ponto.x,
      ponto.y - 3,
      { align: "center" }
    );

    // Data abaixo
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(6);
    pdf.setTextColor(...cores.sageDark);

    pdf.text(
      ponto.label,
      ponto.x,
      areaY + areaAltura + 6,
      { align: "center" }
    );
  });

  // ==========================================
  // LEGENDA
  // ==========================================

  pdf.setFillColor(...cores.forest);
  pdf.circle(
    graficoX + 5,
    graficoY + graficoAltura - 4,
    1.2,
    "F"
  );

  pdf.setFontSize(6);
  pdf.setTextColor(...cores.ink);

  pdf.text(
    "Peso",
    graficoX + 8,
    graficoY + graficoAltura - 2.5
  );

  if (goalWeight != null) {
    pdf.setDrawColor(...cores.gold);
    pdf.setLineWidth(0.7);

    pdf.line(
      graficoX + 24,
      graficoY + graficoAltura - 4,
      graficoX + 31,
      graficoY + graficoAltura - 4
    );

    pdf.text(
      "Meta",
      graficoX + 34,
      graficoY + graficoAltura - 2.5
    );
  }

  // Coloca o restante do PDF depois do gráfico
  y += graficoAltura + 8;

  // Retorna a cor padrão
  pdf.setTextColor(...cores.ink);

} else {
  pdf.setTextColor(...cores.sageDark);
  pdf.text(
    "Nenhuma medição de peso registrada.",
    15,
    y
  );

  y += 8;
}

// =========================
// AVALIAÇÕES ANTROPOMÉTRICAS
// =========================

y += 16;

// Se estiver chegando perto do final da página,
// cria uma nova página
if (y > 260) {
  pdf.addPage();
  y = 20;
}

pdf.setFontSize(13);
pdf.setFont("helvetica", "bold");
pdf.text("Avaliações antropométricas", 15, y);

y += 10;

if (avaliacoes.length === 0) {
  pdf.setFontSize(10);
  pdf.setFont("helvetica", "normal");
  pdf.text("Nenhuma avaliação registrada.", 15, y);
  y += 10;
} else {
  console.log("AVALIAÇÕES PARA O PDF:", avaliacoes);
  avaliacoes.forEach((avaliacao, index) => {
  // Se não couber na página, cria outra
  if (y > 235) {
    pdf.addPage();
    y = 20;
  }

  // DATA
  let dataFormatada = "Data não informada";

  if (avaliacao.data_avaliacao) {
    const [ano, mes, dia] = avaliacao.data_avaliacao.split("-");
    dataFormatada = `${dia}/${mes}/${ano}`;
  }

  // TÍTULO DA AVALIAÇÃO
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);

  pdf.text(
    `Avaliação ${index + 1} - ${dataFormatada}`,
    15,
    y
  );

  y += 8;

  // DADOS PRINCIPAIS
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);

  pdf.text(
    `Peso: ${
      avaliacao.peso != null
        ? `${Number(avaliacao.peso).toFixed(1)} kg`
        : "—"
    }`,
    15,
    y
  );

  pdf.text(
    `IMC: ${
      avaliacao.imc != null
        ? Number(avaliacao.imc).toFixed(2)
        : "—"
    }`,
    70,
    y
  );

  pdf.text(
    `RCQ: ${
      avaliacao.rcq != null
        ? Number(avaliacao.rcq).toFixed(2)
        : "—"
    }`,
    125,
    y
  );

  y += 7;

  // GORDURA CORPORAL
  pdf.text(
    `Gordura corporal: ${
      avaliacao.percentual_gordura != null
        ? `${Number(avaliacao.percentual_gordura).toFixed(2)}%`
        : "—"
    }`,
    15,
    y
  );

  pdf.text(
    `Densidade corporal: ${
      avaliacao.densidade_corporal != null
        ? Number(avaliacao.densidade_corporal).toFixed(4)
        : "—"
    }`,
    100,
    y
  );

  y += 7;

  // SOMA DAS PREGAS
  pdf.text(
    `Soma das pregas: ${
      avaliacao.soma_pregas != null
        ? `${Number(avaliacao.soma_pregas).toFixed(1)} mm`
        : "—"
    }`,
    15,
    y
  );

  y += 7;

  // PROTOCOLO
  let nomeProtocolo = "—";

  if (avaliacao.protocolo === "jackson_pollock_3") {
    nomeProtocolo = "Jackson & Pollock - 3 dobras";
  } else if (avaliacao.protocolo === "jackson_pollock_7") {
    nomeProtocolo = "Jackson & Pollock - 7 dobras";
  } else if (avaliacao.protocolo) {
    nomeProtocolo = avaliacao.protocolo;
  }

  pdf.text(
    `Protocolo: ${nomeProtocolo}`,
    15,
    y
  );

  y += 6;

  // LINHA SEPARADORA
  pdf.setDrawColor(220);
  pdf.line(15, y, larguraPagina - 15, y);

  y += 10;
});
  // =========================
// PLANO ALIMENTAR
// =========================

if (y > 230) {
  pdf.addPage();
  y = 20;
}

y += 8;

pdf.setFontSize(13);
pdf.setFont("helvetica", "bold");
pdf.text("Plano alimentar", 15, y);

y += 10;

// Busca o plano alimentar mais recente do paciente
const { data: planoPDF, error: erroPlanoPDF } = await supabase
  .from("planos_alimentares")
  .select("*")
  .eq("paciente_id", client.id)
  .order("created_at", { ascending: false })
  .limit(1)
  .maybeSingle();

if (erroPlanoPDF) {
  console.error("Erro ao buscar plano para PDF:", erroPlanoPDF);
}

if (!planoPDF) {
  pdf.setFontSize(10);
  pdf.setFont("helvetica", "normal");
  pdf.text("Nenhum plano alimentar cadastrado.", 15, y);

  y += 10;
} else {

  // =========================
  // NOME E OBJETIVO
  // =========================

  pdf.setFontSize(11);
  pdf.setFont("helvetica", "bold");

  pdf.text(
    planoPDF.nome || "Plano alimentar",
    15,
    y
  );

  y += 7;

  pdf.setFontSize(9);
  pdf.setFont("helvetica", "normal");

  if (planoPDF.objetivo) {
    pdf.text(
      `Objetivo: ${planoPDF.objetivo}`,
      15,
      y
    );

    y += 8;
  }

  // =========================
  // METAS
  // =========================

  pdf.setFontSize(11);
  pdf.setFont("helvetica", "bold");
  pdf.text("Metas nutricionais", 15, y);

  y += 7;

  pdf.setFontSize(9);
  pdf.setFont("helvetica", "normal");

  pdf.text(
    `Calorias: ${planoPDF.calorias_meta ?? "—"} kcal`,
    15,
    y
  );

  pdf.text(
    `Proteínas: ${planoPDF.proteinas_meta ?? "—"} g`,
    60,
    y
  );

  pdf.text(
    `Carboidratos: ${planoPDF.carboidratos_meta ?? "—"} g`,
    105,
    y
  );

  pdf.text(
    `Gorduras: ${planoPDF.gorduras_meta ?? "—"} g`,
    160,
    y
  );

  y += 12;

  // =========================
  // BUSCAR REFEIÇÕES
  // =========================

  const { data: refeicoesPDF, error: erroRefeicoesPDF } =
    await supabase
      .from("refeicoes")
      .select("*")
      .eq("plano_id", planoPDF.id)
      .order("ordem", { ascending: true })
      .order("horario", { ascending: true });

  if (erroRefeicoesPDF) {
    console.error(
      "Erro ao buscar refeições para PDF:",
      erroRefeicoesPDF
    );
  }

  pdf.setFontSize(11);
  pdf.setFont("helvetica", "bold");
  pdf.text("Refeições", 15, y);

  y += 8;

  if (!refeicoesPDF || refeicoesPDF.length === 0) {

    pdf.setFontSize(9);
    pdf.setFont("helvetica", "normal");

    pdf.text(
      "Nenhuma refeição cadastrada.",
      15,
      y
    );

    y += 10;

  } else {

    // Totais do plano
    let totalCalorias = 0;
    let totalProteinas = 0;
    let totalCarboidratos = 0;
    let totalGorduras = 0;

    for (const refeicaoPDF of refeicoesPDF) {

      // Nova página se estiver chegando no final
      if (y > 250) {
        pdf.addPage();
        y = 20;
      }

      // =========================
      // REFEIÇÃO
      // =========================

      pdf.setFontSize(10);
      pdf.setFont("helvetica", "bold");

      const horarioPDF = refeicaoPDF.horario
        ? String(refeicaoPDF.horario).slice(0, 5)
        : "";

      pdf.text(
        `${refeicaoPDF.nome || "Refeição"}${
          horarioPDF ? ` - ${horarioPDF}` : ""
        }`,
        15,
        y
      );

      y += 6;

      // Observação da refeição
      if (refeicaoPDF.observacoes) {

        pdf.setFontSize(8);
        pdf.setFont("helvetica", "italic");

        const linhasObservacao = pdf.splitTextToSize(
          refeicaoPDF.observacoes,
          175
        );

        pdf.text(
          linhasObservacao,
          15,
          y
        );

        y += linhasObservacao.length * 4 + 3;
      }

      // =========================
      // BUSCAR ALIMENTOS
      // =========================

      const {
  data: alimentosPDF,
  error: erroAlimentosPDF
} = await supabase
  .from("alimentos_refeicao")
  .select("*")
  .eq("refeicao_id", refeicaoPDF.id)
  .order("ordem", { ascending: true })
  .order("created_at", { ascending: true });

      if (erroAlimentosPDF) {
        console.error(
          "Erro ao buscar alimentos para PDF:",
          erroAlimentosPDF
        );
      }

      if (!alimentosPDF || alimentosPDF.length === 0) {

        pdf.setFontSize(8);
        pdf.setFont("helvetica", "normal");

        pdf.text(
          "Nenhum alimento cadastrado.",
          20,
          y
        );

        y += 7;

      } else {

        for (const alimentoPDF of alimentosPDF) {

          if (y > 265) {
            pdf.addPage();
            y = 20;
          }

          const calorias =
            Number(alimentoPDF.calorias || 0);

          const proteinas =
            Number(alimentoPDF.proteinas || 0);

          const carboidratos =
            Number(alimentoPDF.carboidratos || 0);

          const gorduras =
            Number(alimentoPDF.gorduras || 0);

          // Soma nos totais
          totalCalorias += calorias;
          totalProteinas += proteinas;
          totalCarboidratos += carboidratos;
          totalGorduras += gorduras;

          pdf.setFontSize(9);
          pdf.setFont("helvetica", "normal");

          pdf.text(
            `${alimentoPDF.alimento || "Alimento"} - ${
              alimentoPDF.quantidade ?? "—"
            } ${alimentoPDF.unidade || "g"}`,
            20,
            y
          );

          y += 5;

          pdf.setFontSize(8);

          pdf.text(
            `${calorias.toFixed(1)} kcal | ` +
            `P: ${proteinas.toFixed(1)} g | ` +
            `C: ${carboidratos.toFixed(1)} g | ` +
            `G: ${gorduras.toFixed(1)} g`,
            25,
            y
          );

          y += 7;
        }
      }

      pdf.setDrawColor(220);

      pdf.line(
        15,
        y,
        larguraPagina - 15,
        y
      );

      y += 8;
    }

    // =========================
    // TOTAIS
    // =========================

    if (y > 245) {
      pdf.addPage();
      y = 20;
    }

    pdf.setFontSize(11);
    pdf.setFont("helvetica", "bold");

    pdf.text(
      "Totais do plano alimentar",
      15,
      y
    );

    y += 8;

    pdf.setFontSize(9);
    pdf.setFont("helvetica", "normal");

    pdf.text(
      `Calorias: ${totalCalorias.toFixed(1)} kcal`,
      15,
      y
    );

    pdf.text(
      `Proteínas: ${totalProteinas.toFixed(1)} g`,
      60,
      y
    );

    y += 6;

    pdf.text(
      `Carboidratos: ${totalCarboidratos.toFixed(1)} g`,
      15,
      y
    );

    pdf.text(
      `Gorduras: ${totalGorduras.toFixed(1)} g`,
      80,
      y
    );

    y += 10;
  }
}
// =====================================
// GRÁFICO DE EVOLUÇÃO DO PESO
// =====================================

// Usa as medições já carregadas no painel do paciente
const dadosGrafico = [...medicoesPaciente]
  .filter((item) => item.peso != null && item.data_medicao)
  .sort(
    (a, b) =>
      new Date(a.data_medicao) - new Date(b.data_medicao)
  );

if (dadosGrafico.length > 0) {
  // Nova página exclusiva para o gráfico
  pdf.addPage();

  pdf.setFillColor(47, 75, 60);
  pdf.rect(0, 0, 210, 35, "F");

  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(18);
  pdf.text("Evolucao do peso", 15, 22);

  const pesosGrafico = dadosGrafico.map((item) =>
    Number(item.peso)
  );

  const menorPeso = Math.min(...pesosGrafico);
  const maiorPeso = Math.max(...pesosGrafico);

  const minimo = Math.min(menorPeso, meta ?? menorPeso) - 2;
  const maximo = Math.max(maiorPeso, meta ?? maiorPeso) + 2;
  const intervalo = maximo - minimo || 1;

  const xInicio = 30;
  const xFim = 190;
  const yTopo = 65;
  const yBase = 180;

  const obterY = (peso) =>
    yBase - ((peso - minimo) / intervalo) * (yBase - yTopo);

  const obterX = (indice) =>
    dadosGrafico.length === 1
      ? (xInicio + xFim) / 2
      : xInicio +
        (indice / (dadosGrafico.length - 1)) *
          (xFim - xInicio);

  // Linhas horizontais e valores de referência
  pdf.setFontSize(9);

  for (let i = 0; i <= 5; i++) {
    const peso = minimo + (intervalo / 5) * i;
    const yLinha = obterY(peso);

    pdf.setDrawColor(230, 235, 226);
    pdf.line(xInicio, yLinha, xFim, yLinha);

    pdf.setTextColor(108, 125, 100);
    pdf.text(peso.toFixed(1), 25, yLinha + 1, {
      align: "right",
    });
  }

  // Linha da meta
  if (meta != null && Number.isFinite(Number(meta))) {
    const yMeta = obterY(Number(meta));

    pdf.setDrawColor(184, 137, 47);
    pdf.setLineDashPattern([3, 2], 0);
    pdf.line(xInicio, yMeta, xFim, yMeta);
    pdf.setLineDashPattern([], 0);

    pdf.setTextColor(184, 137, 47);
    pdf.text("Meta", xFim, yMeta - 3, {
      align: "right",
    });
  }

  // Linha do peso
  pdf.setDrawColor(47, 75, 60);
  pdf.setLineWidth(0.8);

  dadosGrafico.forEach((item, indice) => {
    const x = obterX(indice);
    const y = obterY(Number(item.peso));

    if (indice > 0) {
      const anterior = dadosGrafico[indice - 1];

      pdf.line(
        obterX(indice - 1),
        obterY(Number(anterior.peso)),
        x,
        y
      );
    }

    pdf.setFillColor(47, 75, 60);
    pdf.circle(x, y, 1.8, "F");

    pdf.setTextColor(47, 75, 60);
    pdf.setFontSize(8);
    pdf.text(
      `${Number(item.peso).toFixed(1)} kg`,
      x,
      y - 5,
      { align: "center" }
    );

    const data = new Date(
      `${item.data_medicao}T12:00:00`
    ).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
    });

    pdf.setTextColor(108, 125, 100);
    pdf.text(data, x, yBase + 8, {
      align: "center",
    });
  });

  // Resumo da evolução
  const pesoInicial = pesosGrafico[0];
  const pesoAtual = pesosGrafico[pesosGrafico.length - 1];
  const variacao = pesoAtual - pesoInicial;

  pdf.setFillColor(245, 247, 242);
  pdf.roundedRect(15, 210, 180, 35, 3, 3, "F");

  pdf.setTextColor(47, 75, 60);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);

  pdf.text(`Peso inicial: ${pesoInicial.toFixed(1)} kg`, 22, 222);
  pdf.text(`Peso atual: ${pesoAtual.toFixed(1)} kg`, 22, 231);
  pdf.text(
    `Variacao: ${variacao > 0 ? "+" : ""}${variacao.toFixed(1)} kg`,
    110,
    222
  );
}
// =========================
// RODAPÉ
// =========================

const totalPaginas = pdf.internal.getNumberOfPages();

for (let pagina = 1; pagina <= totalPaginas; pagina++) {

  pdf.setPage(pagina);

  pdf.setDrawColor(210);
  pdf.line(
    15,
    282,
    larguraPagina - 15,
    282
  );

  pdf.setFontSize(8);
  pdf.setFont("helvetica", "normal");

  pdf.text(
    "NutriTrack - Relatório de Avaliação Nutricional",
    15,
    288
  );

  pdf.text(
    `Página ${pagina} de ${totalPaginas}`,
    larguraPagina - 15,
    288,
    { align: "right" }
  );
}

// =========================
// SALVAR PDF
// =========================

const nomeArquivo = (client?.name || "paciente")
  .replace(/\s+/g, "-")
  .toLowerCase();

pdf.save(`relatorio-${nomeArquivo}.pdf`);
}

  

  } catch (error) {
    console.error("Erro ao gerar PDF:", error);
    alert("Não foi possível gerar o relatório.");
  }
};

  const chartData = entries.map((e) => ({
    date: e.date,
    label: fmtDateShort(e.date),
    weight: parseFloat(e.weight),
  }));

  const addOrEditEntry = async (data) => {
  try {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      throw new Error("Usuário não autenticado.");
    }

    const medicao = {
      paciente_id: client.id,
      nutricionista_id: user.id,

      data_medicao: data.date,

      peso: data.weight ? Number(data.weight) : null,
      cintura: data.waist ? Number(data.waist) : null,
      quadril: data.hip ? Number(data.hip) : null,
      peitoral: data.chest ? Number(data.chest) : null,
      braco: data.arm ? Number(data.arm) : null,
      coxa: data.thigh ? Number(data.thigh) : null,

      percentual_gordura: data.bodyFat
        ? Number(data.bodyFat)
        : null,

      observacoes: data.notes || null,
    };

    console.log("Usuário logado:", user.id);
    console.log("Paciente usado na medição:", client.id);
    console.log("Medição enviada:", medicao);

    let result;

    if (editingEntry?.id) {
      result = await supabase
        .from("medicoes")
        .update(medicao)
        .eq("id", editingEntry.id)
        .eq("nutricionista_id", user.id)
        .select();
    } else {
      result = await supabase
        .from("medicoes")
        .insert(medicao)
        .select();
    }

    if (result.error) {
      console.error(
        "Erro ao salvar medição:",
        result.error
      );

      throw result.error;
    }

    console.log(
      "Medição salva:",
      result.data
    );

    await carregarMedicoes();

    setShowEntryForm(false);
    setEditingEntry(null);

  } catch (error) {
    console.error(
      "Erro ao salvar medição:",
      error
    );

    alert("Não foi possível salvar a medição.");
  }
};

  const removeEntry = async (id) => {
  try {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      throw new Error("Usuário não autenticado.");
    }

    const { error } = await supabase
      .from("medicoes")
      .delete()
      .eq("id", id)
      .eq("paciente_id", client.id)
      .eq("nutricionista_id", user.id);

    if (error) {
      console.error("Erro ao excluir medição:", error);
      throw error;
    }

    // Remove também da tela
    setMedicoes((anteriores) =>
      anteriores.filter((medicao) => medicao.id !== id)
    );

    setConfirmDeleteEntry(null);

    console.log("Medição excluída com sucesso.");
  } catch (error) {
    console.error("Erro ao excluir medição:", error);
    alert("Não foi possível excluir a medição.");
  }
};
const editarAvaliacao = (item) => {
  setEditingAvaliacao(item);

  setAvaliacao({
    data_avaliacao: item.data_avaliacao || "",
    peso: item.peso ?? "",
    estatura: item.estatura ?? "",
    pescoco: item.pescoco ?? "",
    torax: item.torax ?? "",
    braco_relaxado: item.braco_relaxado ?? "",
    braco_contraido: item.braco_contraido ?? "",
    antebraco: item.antebraco ?? "",
    cintura: item.cintura ?? "",
    abdomen: item.abdomen ?? "",
    quadril: item.quadril ?? "",
    coxa: item.coxa ?? "",
    panturrilha: item.panturrilha ?? "",
    tricipital: item.tricipital ?? "",
    bicipital: item.bicipital ?? "",
    subescapular: item.subescapular ?? "",
    supra_iliaca: item.supra_iliaca ?? "",
    abdominal: item.abdominal ?? "",
    peitoral: item.peitoral ?? "",
    axilar_media: item.axilar_media ?? "",
    coxa_medial: item.coxa_medial ?? "",
    panturrilha_medial: item.panturrilha_medial ?? "",
    observacoes: item.observacoes ?? "",
  });

  setShowAvaliacaoForm(true);
};
  return (
    <div className="flex-1 overflow-y-auto">
      {/* Header */}
      <div className="px-4 sm:px-8 pt-6 sm:pt-8 pb-6" style={{ borderBottom: "1px solid var(--sage)" }}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <RingAvatar name={client.name} percent={pct} size={56} />
            <div>
              <h1 style={{ fontFamily: "var(--font-display)", fontSize: "1.7rem", color: "var(--ink)", fontWeight: 600, lineHeight: 1.1 }}>
                {client.name}
              </h1>
              <div className="flex items-center gap-3 mt-1.5 text-sm flex-wrap" style={{ color: "var(--sage-dark)" }}>
                {age != null && <span>{age} anos</span>}
                {client.phone && (
                  <span className="flex items-center gap-1"><Phone size={12} />{client.phone}</span>
                )}
                {client.email && (
                  <span className="flex items-center gap-1"><Mail size={12} />{client.email}</span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => onEditClient(client)}
              className="p-2 rounded-lg hover:bg-black/5"
              style={{ color: "var(--ink)", border: "1px solid var(--sage)" }}
              title="Editar cliente"
            >
              <Pencil size={16} />
            </button>
            <button
  onClick={gerarPDF}
  className="p-2 rounded-lg hover:bg-black/5"
  style={{ color: "var(--forest)", border: "1px solid var(--sage)" }}
  title="Gerar PDF"
>
  <ClipboardList size={16} />
</button>
{/* Botão para enviar convite ao paciente */}
<button
  type="button"
  onClick={enviarConvitePaciente}
  disabled={enviandoConvite || Boolean(client.auth_user_id)}
  className="px-3 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
  style={{ backgroundColor: "#2F4B3C" }}
  title="Enviar convite para o paciente"
>
  {enviandoConvite
    ? "Enviando..."
    : client.auth_user_id
    ? "Acesso criado"
    : "Enviar convite"}
</button>
            <button
              onClick={() => setConfirmDeleteClient(true)}
              className="p-2 rounded-lg hover:bg-black/5"
              style={{ color: "var(--berry)", border: "1px solid var(--sage)" }}
              title="Excluir cliente"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>

        {client.goalNotes && (
          <div className="mt-4 flex items-start gap-2 text-sm rounded-lg px-3 py-2.5" style={{ background: "var(--sage-tint)", color: "var(--ink)" }}>
            <Target size={15} className="mt-0.5 shrink-0" style={{ color: "var(--forest)" }} />
            <span>{client.goalNotes}</span>
          </div>
        )}
      </div>

      {/* Stats */}
<div className="px-4 sm:px-8 py-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">

  <StatCard
    icon={Scale}
    label="Peso atual"
    value={
      avaliacaoMaisRecente?.peso != null
        ? `${Number(avaliacaoMaisRecente.peso).toFixed(1)} kg`
        : cw != null
        ? `${Number(cw).toFixed(1)} kg`
        : "—"
    }
    sub={
      weightChange != null
        ? `${weightChange >= 0 ? "+" : ""}${weightChange.toFixed(1)} kg desde o início`
        : null
    }
    accent={
      weightChange != null
        ? weightChange < 0
          ? "var(--forest)"
          : weightChange > 0
          ? "var(--gold)"
          : undefined
        : undefined
    }
  />

  <StatCard
    icon={Ruler}
    label="Altura"
    value={
      avaliacaoMaisRecente?.estatura != null
        ? `${avaliacaoMaisRecente.estatura} cm`
        : client.height
        ? `${client.height} cm`
        : "—"
    }
  />

  <StatCard
    icon={TrendingUp}
    label="IMC"
    value={
      avaliacaoMaisRecente?.imc != null
        ? Number(avaliacaoMaisRecente.imc).toFixed(2)
        : bmi != null
        ? Number(bmi).toFixed(2)
        : "—"
    }
    sub={cat.label}
    accent={cat.color}
  />

  <StatCard
    icon={Target}
    label="Meta"
    value={client.goalWeight ? `${client.goalWeight} kg` : "—"}
    sub={pct != null ? `${Math.round(pct)}% do caminho` : null}
  />

</div>

      {/* Chart */}
      <div className="px-4 sm:px-8 pb-6">
        <div className="rounded-xl p-5" style={{ background: "#fff", border: "1px solid var(--sage)" }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: "var(--ink)", fontFamily: "var(--font-body)" }}>
              <Leaf size={15} style={{ color: "var(--forest)" }} />
              Evolução do peso
            </h3>
          </div>
          {chartData.length === 0 ? (
            <div className="text-sm text-center py-12" style={{ color: "var(--sage-dark)" }}>
              Nenhuma medição registrada ainda.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--sage)" opacity={0.5} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--sage-dark)" }} axisLine={{ stroke: "var(--sage)" }} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "var(--sage-dark)" }} axisLine={false} tickLine={false} domain={["auto", "auto"]} unit="kg" width={50} />
                <Tooltip
                  contentStyle={{ background: "var(--paper)", border: "1px solid var(--sage)", borderRadius: 8, fontSize: 12, fontFamily: "var(--font-body)" }}
                  formatter={(v) => [`${v} kg`, "Peso"]}
                />
                {client.goalWeight && (
                  <ReferenceLine y={parseFloat(client.goalWeight)} stroke="var(--gold)" strokeDasharray="4 4" label={{ value: "Meta", fontSize: 11, fill: "var(--gold)", position: "insideTopRight" }} />
                )}

                <Line type="monotone" dataKey="weight" stroke="var(--forest)" strokeWidth={2.5} dot={{ r: 3, fill: "var(--forest)" }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
      {/* Avaliações antropométricas */}
<div
  className="mt-6 rounded-xl p-5"
  style={{
    background: "var(--paper)",
    border: "1px solid var(--sage)",
  }}
>
  <div className="flex items-center justify-between gap-4">
    <div>
      <h3
        className="text-lg font-semibold"
        style={{ color: "var(--forest)" }}
      >
        Avaliações antropométricas
      </h3>


      <p
        className="text-sm mt-1"
        style={{ color: "var(--sage-dark)" }}
      >
        Registre e acompanhe as avaliações do paciente.
      </p>
    </div>

    <button
      type="button"
      onClick={() => {
  setEditingAvaliacao(null);

  setAvaliacao({
    data_avaliacao: "",
    peso: "",
    estatura: "",
    pescoco: "",
    torax: "",
    braco_relaxado: "",
    braco_contraido: "",
    antebraco: "",
    cintura: "",
    abdomen: "",
    quadril: "",
    coxa: "",
    panturrilha: "",
    tricipital: "",
    bicipital: "",
    subescapular: "",
    supra_iliaca: "",
    abdominal: "",
    peitoral: "",
    axilar_media: "",
    coxa_medial: "",
    panturrilha_medial: "",
    observacoes: "",
  });

  setShowAvaliacaoForm(true);
}}
      className="px-4 py-2 rounded-lg text-sm font-semibold"
      style={{
        background: "var(--forest)",
        color: "#fff",
      }}
    >
      + Nova avaliação
    </button>
  </div>
</div>
{showAvaliacaoForm && (
  <div
    className="mt-4 rounded-xl p-5"
    style={{
      background: "#fff",
      border: "1px solid var(--sage)",
    }}
  >
    <div className="flex items-center justify-between mb-5">
      <h3
        className="text-lg font-semibold"
        style={{ color: "var(--forest)" }}
      >
        Nova avaliação
      </h3>

      <button
        type="button"
        onClick={() => setShowAvaliacaoForm(false)}
        className="text-sm font-medium"
        style={{ color: "var(--berry)" }}
      >
        Fechar
      </button>
    </div>

    <h4
      className="font-semibold mb-3"
      style={{ color: "var(--forest)" }}
    >
      Dados básicos
    </h4>

    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div>
  <label className="block text-sm mb-1">
    Protocolo de avaliação
  </label>

  <select
    value={avaliacao.protocolo || ""}
    onChange={(e) =>
      setAvaliacao({
        ...avaliacao,
        protocolo: e.target.value,
      })
    }
    className={inputClass}
    style={inputStyle}
  >
    <option value="">Selecione um protocolo</option>

    <option value="jackson_pollock_3">
      Jackson & Pollock - 3 dobras
    </option>

    <option value="jackson_pollock_7">
      Jackson & Pollock - 7 dobras
    </option>
  </select>
</div>
      <div>
        <label className="block text-sm mb-1">Data da avaliação</label>
        <input
          type="date"
          value={avaliacao.data_avaliacao}
          onChange={(e) =>
            setAvaliacao({
              ...avaliacao,
              data_avaliacao: e.target.value,
            })
          }
          className={inputClass}
          style={inputStyle}
        />
      </div>

      <div>
        <label className="block text-sm mb-1">Peso (kg)</label>
        <input
          type="number"
          step="0.1"
          value={avaliacao.peso}
          onChange={(e) =>
            setAvaliacao({
              ...avaliacao,
              peso: e.target.value,
            })
          }
          className={inputClass}
          style={inputStyle}
          placeholder="Ex: 72.5"
        />
      </div>

      <div>
        <label className="block text-sm mb-1">Estatura (cm)</label>
        <input
          type="number"
          step="0.1"
          value={avaliacao.estatura}
          onChange={(e) =>
            setAvaliacao({
              ...avaliacao,
              estatura: e.target.value,
            })
          }
          className={inputClass}
          style={inputStyle}
          placeholder="Ex: 165"
        />
      </div>
    </div>
    <h4
  className="font-semibold mt-6 mb-3"
  style={{ color: "var(--forest)" }}
>
  Circunferências (cm)
</h4>

<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">

  <div>
    <label className="block text-sm mb-1">Pescoço</label>
    <input
      type="number"
      step="0.1"
      value={avaliacao.pescoco}
      onChange={(e) =>
        setAvaliacao({ ...avaliacao, pescoco: e.target.value })
      }
      className={inputClass}
      style={inputStyle}
    />
  </div>

  <div>
    <label className="block text-sm mb-1">Tórax / peitoral</label>
    <input
      type="number"
      step="0.1"
      value={avaliacao.torax}
      onChange={(e) =>
        setAvaliacao({ ...avaliacao, torax: e.target.value })
      }
      className={inputClass}
      style={inputStyle}
    />
  </div>

  <div>
    <label className="block text-sm mb-1">Braço relaxado</label>
    <input
      type="number"
      step="0.1"
      value={avaliacao.braco_relaxado}
      onChange={(e) =>
        setAvaliacao({ ...avaliacao, braco_relaxado: e.target.value })
      }
      className={inputClass}
      style={inputStyle}
    />
  </div>

  <div>
    <label className="block text-sm mb-1">Braço contraído</label>
    <input
      type="number"
      step="0.1"
      value={avaliacao.braco_contraido}
      onChange={(e) =>
        setAvaliacao({ ...avaliacao, braco_contraido: e.target.value })
      }
      className={inputClass}
      style={inputStyle}
    />
  </div>

  <div>
    <label className="block text-sm mb-1">Antebraço</label>
    <input
      type="number"
      step="0.1"
      value={avaliacao.antebraco}
      onChange={(e) =>
        setAvaliacao({ ...avaliacao, antebraco: e.target.value })
      }
      className={inputClass}
      style={inputStyle}
    />
  </div>

  <div>
    <label className="block text-sm mb-1">Cintura</label>
    <input
      type="number"
      step="0.1"
      value={avaliacao.cintura}
      onChange={(e) =>
        setAvaliacao({ ...avaliacao, cintura: e.target.value })
      }
      className={inputClass}
      style={inputStyle}
    />
  </div>

  <div>
    <label className="block text-sm mb-1">Abdômen</label>
    <input
      type="number"
      step="0.1"
      value={avaliacao.abdomen}
      onChange={(e) =>
        setAvaliacao({ ...avaliacao, abdomen: e.target.value })
      }
      className={inputClass}
      style={inputStyle}
    />
  </div>

  <div>
    <label className="block text-sm mb-1">Quadril</label>
    <input
      type="number"
      step="0.1"
      value={avaliacao.quadril}
      onChange={(e) =>
        setAvaliacao({ ...avaliacao, quadril: e.target.value })
      }
      className={inputClass}
      style={inputStyle}
    />
  </div>

  <div>
    <label className="block text-sm mb-1">Coxa</label>
    <input
      type="number"
      step="0.1"
      value={avaliacao.coxa}
      onChange={(e) =>
        setAvaliacao({ ...avaliacao, coxa: e.target.value })
      }
      className={inputClass}
      style={inputStyle}
    />
  </div>

  <div>
    <label className="block text-sm mb-1">Panturrilha</label>
    <input
      type="number"
      step="0.1"
      value={avaliacao.panturrilha}
      onChange={(e) =>
        setAvaliacao({ ...avaliacao, panturrilha: e.target.value })
      }
      className={inputClass}
      style={inputStyle}
    />
  </div>

</div>
<h4
  className="font-semibold mt-6 mb-3"
  style={{ color: "var(--forest)" }}
>
  Pregas cutâneas (mm)
</h4>

<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">

  <div>
    <label className="block text-sm mb-1">Tricipital</label>
    <input
      type="number"
      step="0.1"
      value={avaliacao.tricipital}
      onChange={(e) =>
        setAvaliacao({ ...avaliacao, tricipital: e.target.value })
      }
      className={inputClass}
      style={inputStyle}
    />
  </div>

  <div>
    <label className="block text-sm mb-1">Bicipital</label>
    <input
      type="number"
      step="0.1"
      value={avaliacao.bicipital}
      onChange={(e) =>
        setAvaliacao({ ...avaliacao, bicipital: e.target.value })
      }
      className={inputClass}
      style={inputStyle}
    />
  </div>

  <div>
    <label className="block text-sm mb-1">Subescapular</label>
    <input
      type="number"
      step="0.1"
      value={avaliacao.subescapular}
      onChange={(e) =>
        setAvaliacao({ ...avaliacao, subescapular: e.target.value })
      }
      className={inputClass}
      style={inputStyle}
    />
  </div>

  <div>
    <label className="block text-sm mb-1">Supra-ilíaca</label>
    <input
      type="number"
      step="0.1"
      value={avaliacao.supra_iliaca}
      onChange={(e) =>
        setAvaliacao({ ...avaliacao, supra_iliaca: e.target.value })
      }
      className={inputClass}
      style={inputStyle}
    />
  </div>

  <div>
    <label className="block text-sm mb-1">Abdominal</label>
    <input
      type="number"
      step="0.1"
      value={avaliacao.abdominal}
      onChange={(e) =>
        setAvaliacao({ ...avaliacao, abdominal: e.target.value })
      }
      className={inputClass}
      style={inputStyle}
    />
  </div>

  <div>
    <label className="block text-sm mb-1">Peitoral</label>
    <input
      type="number"
      step="0.1"
      value={avaliacao.peitoral}
      onChange={(e) =>
        setAvaliacao({ ...avaliacao, peitoral: e.target.value })
      }
      className={inputClass}
      style={inputStyle}
    />
  </div>

  <div>
    <label className="block text-sm mb-1">Axilar média</label>
    <input
      type="number"
      step="0.1"
      value={avaliacao.axilar_media}
      onChange={(e) =>
        setAvaliacao({ ...avaliacao, axilar_media: e.target.value })
      }
      className={inputClass}
      style={inputStyle}
    />
  </div>

  <div>
    <label className="block text-sm mb-1">Coxa medial</label>
    <input
      type="number"
      step="0.1"
      value={avaliacao.coxa_medial}
      onChange={(e) =>
        setAvaliacao({ ...avaliacao, coxa_medial: e.target.value })
      }
      className={inputClass}
      style={inputStyle}
    />
  </div>

  <div>
    <label className="block text-sm mb-1">Panturrilha medial</label>
    <input
      type="number"
      step="0.1"
      value={avaliacao.panturrilha_medial}
      onChange={(e) =>
        setAvaliacao({
          ...avaliacao,
          panturrilha_medial: e.target.value,
        })
      }
      className={inputClass}
      style={inputStyle}
    />
  </div>

</div>

{/* Resultados */}
<h4
  className="font-semibold mt-6 mb-3"
  style={{ color: "var(--forest)" }}
>
  Resultados da avaliação
</h4>

<div className="grid grid-cols-1 md:grid-cols-3 gap-4">

  <div
    className="rounded-xl p-4"
    style={{
      background: "var(--bg)",
      border: "1px solid var(--sage)",
    }}
  >
    <p className="text-sm" style={{ color: "var(--sage-dark)" }}>
      IMC
    </p>

    <p
      className="text-xl font-bold mt-1"
      style={{ color: "var(--forest)" }}
    >
      {imcAvaliacao !== null
        ? imcAvaliacao.toFixed(2)
        : "—"}
    </p>

    <p className="text-xs mt-1">kg/m²</p>
  </div>

  <div
    className="rounded-xl p-4"
    style={{
      background: "var(--bg)",
      border: "1px solid var(--sage)",
    }}
  >
    <p className="text-sm" style={{ color: "var(--sage-dark)" }}>
      RCQ
    </p>

    <p
      className="text-xl font-bold mt-1"
      style={{ color: "var(--forest)" }}
    >
      {rcqAvaliacao !== null
        ? rcqAvaliacao.toFixed(2)
        : "—"}
    </p>

    <p className="text-xs mt-1">Cintura / Quadril</p>
  </div>

  <div
    className="rounded-xl p-4"
    style={{
      background: "var(--bg)",
      border: "1px solid var(--sage)",
    }}
  >
    <p className="text-sm" style={{ color: "var(--sage-dark)" }}>
      Somatório das pregas
    </p>

    <p
      className="text-xl font-bold mt-1"
      style={{ color: "var(--forest)" }}
    >
      {somaPregasAvaliacao.toFixed(1)}
    </p>

    <p className="text-xs mt-1">mm</p>
  </div>

</div>
<h4

  className="font-semibold mt-6 mb-3"
  style={{ color: "var(--forest)" }}
>
  Observações
</h4>

<textarea
  rows={4}
  value={avaliacao.observacoes}
  onChange={(e) =>
    setAvaliacao({
      ...avaliacao,
      observacoes: e.target.value,
    })
  }
  className={inputClass}
  style={inputStyle}
  placeholder="Digite observações sobre a avaliação..."
/>

{/* Botões */}
<div className="flex justify-end gap-3 mt-6">
  <button
    type="button"
    onClick={() => setShowAvaliacaoForm(false)}
    className="px-4 py-2 rounded-lg font-semibold"
    style={{
      border: "1px solid var(--sage)",
      color: "var(--forest)",
      background: "#fff",
    }}
  >
    Cancelar
  </button>

  <button
    type="button"
    onClick={salvarAvaliacao}
    className="px-5 py-2 rounded-lg font-semibold shadow-sm"
    style={{
      background: "var(--forest)",
      color: "#fff",
    }}
  >
    Salvar avaliação
  </button>
</div>
  </div>
)}

{/* Histórico de avaliações antropométricas */}
<div className="px-4 sm:px-8 pb-6">
  <div
    className="rounded-xl p-5"
    style={{
      background: "var(--paper)",
      border: "1px solid var(--sage)",
    }}
  >
    <h3
      className="text-lg font-semibold mb-4"
      style={{ color: "var(--forest)" }}
    >
      Histórico de avaliações
    </h3>

    {loadingAvaliacoes ? (
      <p
        className="text-sm"
        style={{ color: "var(--sage-dark)" }}
      >
        Carregando avaliações...
      </p>
    ) : avaliacoes.length === 0 ? (
      <div
        className="rounded-xl p-6 text-center text-sm"
        style={{
          background: "#fff",
          border: "1px dashed var(--sage)",
          color: "var(--sage-dark)",
        }}
      >
        Nenhuma avaliação antropométrica registrada ainda.
      </div>
    ) : (
      <div className="space-y-3">
        {avaliacoes.map((item) => (
          <div
            key={item.id}
            className="rounded-xl p-4"
            style={{
              background: "#fff",
              border: "1px solid var(--sage)",
            }}
          >
            {/* Cabeçalho */}
            <div className="flex items-center justify-between gap-4 mb-4">
              <strong style={{ color: "var(--forest)" }}>
                Avaliação de {fmtDate(item.data_avaliacao)}
              </strong>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => editarAvaliacao(item)}
                  className="p-2 rounded-lg"
                  style={{
                    color: "var(--forest)",
                    background: "transparent",
                  }}
                  title="Editar avaliação"
                >
                  <Pencil size={16} />
                </button>

                <button
                  type="button"
                  onClick={() => excluirAvaliacao(item.id)}
                  className="p-2 rounded-lg"
                  style={{
                    color: "var(--berry)",
                    background: "transparent",
                  }}
                  title="Excluir avaliação"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>

            {/* Informações */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">

              {/* Peso */}
              <div>
                <p
                  className="text-xs"
                  style={{ color: "var(--sage-dark)" }}
                >
                  Peso
                </p>

                <p className="font-semibold">
                  {item.peso != null ? `${item.peso} kg` : "—"}
                </p>
              </div>

              {/* IMC */}
              <div>
                <p
                  className="text-xs"
                  style={{ color: "var(--sage-dark)" }}
                >
                  IMC
                </p>

                <p className="font-semibold">
                  {item.imc != null
                    ? Number(item.imc).toFixed(2)
                    : "—"}
                </p>
              </div>

              {/* RCQ */}
              <div>
                <p
                  className="text-xs"
                  style={{ color: "var(--sage-dark)" }}
                >
                  RCQ
                </p>

                <p className="font-semibold">
                  {item.rcq != null
                    ? Number(item.rcq).toFixed(2)
                    : "—"}
                </p>
              </div>

              {/* Soma das pregas */}
              <div>
                <p
                  className="text-xs"
                  style={{ color: "var(--sage-dark)" }}
                >
                  Soma das pregas
                </p>

                <p className="font-semibold">
                  {item.soma_pregas != null
                    ? `${Number(item.soma_pregas).toFixed(1)} mm`
                    : "—"}
                </p>
              </div>

              {/* Gordura corporal */}
              <div>
                <p
                  className="text-xs"
                  style={{ color: "var(--sage-dark)" }}
                >
                  Gordura corporal
                </p>

                <p className="font-semibold">
                  {item.percentual_gordura != null
                    ? `${Number(item.percentual_gordura).toFixed(2)}%`
                    : "—"}
                </p>
              </div>

              {/* Densidade corporal */}
              <div>
                <p
                  className="text-xs"
                  style={{ color: "var(--sage-dark)" }}
                >
                  Densidade corporal
                </p>

                <p className="font-semibold">
                  {item.densidade_corporal != null
                    ? Number(item.densidade_corporal).toFixed(4)
                    : "—"}
                </p>
              </div>

              {/* Protocolo */}
              <div>
                <p
                  className="text-xs"
                  style={{ color: "var(--sage-dark)" }}
                >
                  Protocolo
                </p>

                <p className="font-semibold">
                  {item.protocolo === "jackson_pollock_3"
                    ? "Jackson & Pollock - 3 dobras"
                    : item.protocolo === "jackson_pollock_7"
                    ? "Jackson & Pollock - 7 dobras"
                    : "—"}
                </p>
              </div>

            </div>
          </div>
        ))}
      </div>
    )}
  </div>
</div>
      {/* PLANO ALIMENTAR */}
<PlanoAlimentar client={client} />

      {/* History */}
      <div className="px-4 sm:px-8 pb-10">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: "var(--ink)", fontFamily: "var(--font-body)" }}>
            <ClipboardList size={15} style={{ color: "var(--forest)" }} />
            Histórico de medições
          </h3>
          <button
            onClick={() => { setEditingEntry(null); setShowEntryForm(true); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
            style={{ background: "var(--berry)" }}
          >
            <Plus size={14} /> Nova medição
          </button>
        </div>

        {entries.length === 0 ? (
          <div className="rounded-xl p-8 text-center text-sm" style={{ background: "#fff", border: "1px dashed var(--sage)", color: "var(--sage-dark)" }}>
            Registre a primeira medição para começar a acompanhar a evolução.
          </div>
        ) : (
          <div className="rounded-xl overflow-hidden" style={{ background: "#fff", border: "1px solid var(--sage)" }}>
            <table className="w-full text-sm" style={{ fontFamily: "var(--font-mono)" }}>
              <thead>
                <tr style={{ background: "var(--sage-tint)", color: "var(--sage-dark)" }}>
                  <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase tracking-wide" style={{ fontFamily: "var(--font-body)" }}>Data</th>
                  <th className="text-left px-3 py-2.5 font-semibold text-xs uppercase tracking-wide" style={{ fontFamily: "var(--font-body)" }}>Peso</th>
                  <th className="text-left px-3 py-2.5 font-semibold text-xs uppercase tracking-wide" style={{ fontFamily: "var(--font-body)" }}>Cintura</th>
                  <th className="text-left px-3 py-2.5 font-semibold text-xs uppercase tracking-wide" style={{ fontFamily: "var(--font-body)" }}>Quadril</th>
                  <th className="text-left px-3 py-2.5 font-semibold text-xs uppercase tracking-wide" style={{ fontFamily: "var(--font-body)" }}>Gordura</th>
                  <th className="px-3 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {[...entries].reverse().map((e, i) => (
                  <tr key={e.id} style={{ borderTop: i === 0 ? "none" : "1px solid var(--sage-tint)" }}>
                    <td className="px-4 py-2.5" style={{ color: "var(--ink)" }}>{fmtDate(e.date)}</td>
                    <td className="px-3 py-2.5" style={{ color: "var(--ink)" }}>{e.weight} kg</td>
                    <td className="px-3 py-2.5" style={{ color: "var(--sage-dark)" }}>{e.waist ? `${e.waist} cm` : "—"}</td>
                    <td className="px-3 py-2.5" style={{ color: "var(--sage-dark)" }}>{e.hip ? `${e.hip} cm` : "—"}</td>
                    <td className="px-3 py-2.5" style={{ color: "var(--sage-dark)" }}>{e.bodyFat ? `${e.bodyFat}%` : "—"}</td>
                    <td className="px-3 py-2.5 text-right whitespace-nowrap">
                      <button onClick={() => { setEditingEntry(e); setShowEntryForm(true); }} className="p-1.5 rounded hover:bg-black/5" style={{ color: "var(--sage-dark)" }}>
                        <Pencil size={13} />
                      </button>
                      <button onClick={() => setConfirmDeleteEntry(e.id)} className="p-1.5 rounded hover:bg-black/5" style={{ color: "var(--berry)" }}>
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {entries.some((e) => e.notes) && (
          <div className="mt-4 space-y-2">
            {[...entries].reverse().filter((e) => e.notes).slice(0, 5).map((e) => (
              <div key={e.id} className="text-xs rounded-lg px-3 py-2" style={{ background: "var(--sage-tint)", color: "var(--ink)" }}>
                <span style={{ fontFamily: "var(--font-mono)", color: "var(--sage-dark)" }}>{fmtDate(e.date)} — </span>
                {e.notes}
              </div>
            ))}
          </div>
        )}
      </div>

      {showEntryForm && (
        <Modal title={editingEntry ? "Editar medição" : "Nova medição"} onClose={() => { setShowEntryForm(false); setEditingEntry(null); }} wide>
          <EntryForm initial={editingEntry} onCancel={() => { setShowEntryForm(false); setEditingEntry(null); }} onSave={addOrEditEntry} />
        </Modal>
      )}

      {confirmDeleteClient && (
        <Modal title="Excluir cliente" onClose={() => setConfirmDeleteClient(false)}>
          <p className="text-sm mb-5" style={{ color: "var(--ink)" }}>
            Tem certeza que deseja excluir <strong>{client.name}</strong>? Todo o histórico de medições será perdido permanentemente.
          </p>
          <div className="flex justify-end gap-2">
            <button onClick={() => setConfirmDeleteClient(false)} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ border: "1px solid var(--sage)", color: "var(--ink)" }}>
              Cancelar
            </button>
            <button onClick={() => onDeleteClient(client.id)} className="px-4 py-2 rounded-lg text-sm font-medium text-white" style={{ background: "var(--berry)" }}>
              Excluir definitivamente
            </button>
          </div>
        </Modal>
      )}

      {confirmDeleteEntry && (
        <Modal title="Excluir medição" onClose={() => setConfirmDeleteEntry(null)}>
          <p className="text-sm mb-5" style={{ color: "var(--ink)" }}>Tem certeza que deseja excluir este registro?</p>
          <div className="flex justify-end gap-2">
            <button onClick={() => setConfirmDeleteEntry(null)} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ border: "1px solid var(--sage)", color: "var(--ink)" }}>
              Cancelar
            </button>
            <button onClick={() => removeEntry(confirmDeleteEntry)} className="px-4 py-2 rounded-lg text-sm font-medium text-white" style={{ background: "var(--berry)" }}>
              Excluir
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ---------------------------------------------------------
   Empty state
--------------------------------------------------------- */
function EmptyState({ onNewClient, hasClients }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
      <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4" style={{ background: "var(--sage-tint)" }}>
        <Leaf size={26} style={{ color: "var(--forest)" }} />
      </div>
      <h2 style={{ fontFamily: "var(--font-display)", fontSize: "1.3rem", color: "var(--ink)", fontWeight: 600 }}>
        {hasClients ? "Selecione um cliente" : "Nenhum cliente cadastrado"}
      </h2>
      <p className="text-sm mt-2 max-w-xs" style={{ color: "var(--sage-dark)" }}>
        {hasClients
          ? "Escolha um cliente na lista ao lado para ver o histórico e a evolução."
          : "Cadastre o primeiro cliente para começar a acompanhar sua evolução ao longo do tempo."}
      </p>
      {!hasClients && (
        <button
          onClick={onNewClient}
          className="mt-5 flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-white"
          style={{ background: "var(--forest)" }}
        >
          <Plus size={16} /> Cadastrar cliente
        </button>
      )}
    </div>
  );
}
function calcularIdade(dataNascimento) {
  if (!dataNascimento) return null;

  const hoje = new Date();
  const nascimento = new Date(`${dataNascimento}T00:00:00`);

  let idade = hoje.getFullYear() - nascimento.getFullYear();

  const mes = hoje.getMonth() - nascimento.getMonth();

  if (
    mes < 0 ||
    (mes === 0 && hoje.getDate() < nascimento.getDate())
  ) {
    idade--;
  }

  return idade;
}
function calcularJacksonPollock3({
  sexo,
  idade,
  peitoral,
  abdominal,
  coxa,
  tricipital,
  supraIliaca,
}) {
  let soma;
  let densidade;

  const sexoNormalizado = sexo?.toLowerCase();

  if (sexoNormalizado === "masculino") {
    soma =
      Number(peitoral) +
      Number(abdominal) +
      Number(coxa);

    densidade =
      1.10938 -
      0.0008267 * soma +
      0.0000016 * Math.pow(soma, 2) -
      0.0002574 * idade;
  } else if (sexoNormalizado === "feminino") {
    soma =
      Number(tricipital) +
      Number(supraIliaca) +
      Number(coxa);

    densidade =
      1.0994921 -
      0.0009929 * soma +
      0.0000023 * Math.pow(soma, 2) -
      0.0001392 * idade;
  } else {
    throw new Error(
      "O paciente precisa ter o sexo cadastrado para usar este protocolo."
    );
  }

  const percentualGordura =
    (495 / densidade) - 450;

  return {
    somaPregas: soma,
    densidade,
    percentualGordura,
  };
}
/* ---------------------------------------------------------
   Main app
--------------------------------------------------------- */
export default function NutriTrackApp() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [tipoUsuario, setTipoUsuario] = useState(null);
  const [usuarioAtual, setUsuarioAtual] = useState(null);
  const [dadosPaciente, setDadosPaciente] = useState(null);
  const [carregandoPaciente, setCarregandoPaciente] = useState(false);
  const [verificandoPerfil, setVerificandoPerfil] = useState(true);
  const [perfilUsuario, setPerfilUsuario] = useState(null);
  const [showCadastro, setShowCadastro] = useState(false);
  const [primeiroAcesso, setPrimeiroAcesso] = useState(false);
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmarNovaSenha, setConfirmarNovaSenha] = useState("");
  const [salvandoSenha, setSalvandoSenha] = useState(false);
  const [medicoesPaciente, setMedicoesPaciente] = useState([]);
  const [carregandoMedicoes, setCarregandoMedicoes] = useState(false);
  const [planoPaciente, setPlanoPaciente] = useState(null);
  const [refeicoesPaciente, setRefeicoesPaciente] = useState([]);
  const [avaliacoesPaciente, setAvaliacoesPaciente] = useState([]);
  const [avaliacaoAberta, setAvaliacaoAberta] = useState(null);
  const [carregandoResumo, setCarregandoResumo] = useState(false);
  const [erroResumo, setErroResumo] = useState("");

const [nutricionista, setNutricionista] = useState({
  nome: "",
  email: "",
  senha: "",
  confirmarSenha: "",
});


const gerarPDFAvaliacao = (avaliacao) => {
  
  if (!avaliacao) return;

  const pdf = new jsPDF("p", "mm", "a4");
  const nomeNutricionista =
    nutricionista?.nome?.trim() || "Não informado";
  const W = 210;
  const H = 297;
  const M = 16;
  const verde = [47, 75, 60];
  const verdeClaro = [237, 242, 234];
  const cinza = [100, 116, 105];
  const preto = [34, 48, 31];
  const dourado = [184, 137, 47];

  let y = 0;

  const texto = (valor, fallback = "Não informado") => {
    return valor === null || valor === undefined || valor === ""
      ? fallback
      : String(valor);
  };

  const numero = (valor, casas = 1) => {
    if (valor === null || valor === undefined || valor === "") return null;
    const n = Number(valor);
    return Number.isFinite(n) ? n.toFixed(casas) : null;
  };

  const dataBR = (data) => {
    if (!data) return "Não informada";
    const parte = String(data).slice(0, 10);
    const [ano, mes, dia] = parte.split("-");
    return dia && mes && ano ? `${dia}/${mes}/${ano}` : parte;
  };

  const nomePaciente = dadosPaciente?.nome || "Paciente";
  const alturaCm = avaliacao.altura ?? dadosPaciente?.altura;
  const peso = avaliacao.peso;
  const pesoInicial = dadosPaciente?.peso_inicial;
  const pesoMeta = dadosPaciente?.peso_meta;

  const variacaoPeso =
  Number.isFinite(Number(peso)) &&
  Number.isFinite(Number(pesoInicial)) &&
  peso != null &&
  pesoInicial != null
    ? Number(peso) - Number(pesoInicial)
    : null;

  const alturaM = Number(alturaCm) / 100;
  const imcCalculado =
    Number(peso) > 0 && alturaM > 0
      ? Number(peso) / (alturaM * alturaM)
      : null;

  const imc = avaliacao.imc ?? imcCalculado;

  const classificacaoIMC = (valor) => {
    const n = Number(valor);
    if (!Number.isFinite(n)) return "Não informado";
    if (n < 18.5) return "Baixo peso";
    if (n < 25) return "Peso adequado";
    if (n < 30) return "Sobrepeso";
    if (n < 35) return "Obesidade grau I";
    if (n < 40) return "Obesidade grau II";
    return "Obesidade grau III";
  };

  const cabecalho = (subtitulo) => {
    pdf.setFillColor(...verde);
    pdf.rect(0, 0, W, 34, "F");

    pdf.setTextColor(255, 255, 255);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(21);
    pdf.text("NutriTrack", M, 17);

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.text(subtitulo, M, 25);

    pdf.setTextColor(...preto);
    y = 45;
  };

  const tituloSecao = (titulo) => {
    if (y > 264) {
      pdf.addPage();
      cabecalho("Relatório de acompanhamento nutricional");
    }

    pdf.setFillColor(...verdeClaro);
    pdf.roundedRect(M, y, W - M * 2, 10, 2, 2, "F");

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(11);
    pdf.setTextColor(...verde);
    pdf.text(titulo, M + 4, y + 6.6);

    y += 15;
  };

  const linha = (rotulo, valor, unidade = "") => {
    if (y > 276) {
      pdf.addPage();
      cabecalho("Relatório de acompanhamento nutricional");
    }

    pdf.setDrawColor(225, 231, 223);
    pdf.line(M, y + 7, W - M, y + 7);

    pdf.setFontSize(9);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(...cinza);
    pdf.text(rotulo, M + 2, y + 4);

    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(...preto);

    const valorFinal = texto(valor);
    const exibicao =
      valorFinal === "Não informado"
        ? valorFinal
        : `${valorFinal}${unidade ? " " + unidade : ""}`;

    pdf.text(exibicao, W - M - 2, y + 4, { align: "right" });
    y += 10;
  };

  const indicador = (x, largura, titulo, valor, detalhe) => {
    pdf.setFillColor(247, 249, 245);
    pdf.setDrawColor(220, 228, 217);
    pdf.roundedRect(x, y, largura, 25, 3, 3, "FD");

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(...cinza);
    pdf.text(titulo, x + 4, y + 6);

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(15);
    pdf.setTextColor(...verde);
    pdf.text(valor, x + 4, y + 16);

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7);
    pdf.setTextColor(...cinza);
    pdf.text(detalhe, x + 4, y + 21);
  };

  // PÁGINA 1 — IDENTIFICAÇÃO E INDICADORES
  cabecalho("Relatório de avaliação antropométrica");

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(17);
  pdf.setTextColor(...verde);
  pdf.text("Relatório de acompanhamento", M, y);
  y += 9;

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdf.setTextColor(...preto);
  pdf.text(`Paciente: ${nomePaciente}`, M, y);
  y += 6;
  pdf.text(`Data da avaliação: ${dataBR(avaliacao.data_avaliacao)}`, M, y);
  y += 6;
  pdf.text(`Emitido em: ${new Date().toLocaleDateString("pt-BR")}`, M, y);
  y += 12;

  const larguraCard = (W - M * 2 - 12) / 3;

  indicador(
    M,
    larguraCard,
    "Peso avaliado",
    numero(peso) !== null ? `${numero(peso)} kg` : "—",
    "Avaliação selecionada"
  );

  indicador(
    M + larguraCard + 6,
    larguraCard,
    "Índice de massa corporal",
    numero(imc, 2) ?? "—",
    "IMC"
  );

  indicador(
    M + (larguraCard + 6) * 2,
    larguraCard,
    "Gordura corporal",
    numero(avaliacao.percentual_gordura) !== null
      ? `${numero(avaliacao.percentual_gordura)}%`
      : "—",
    "Percentual registrado"
  );

  y += 34;
  
tituloSecao("Responsável pelo acompanhamento");
linha("Nutricionista", nomeNutricionista);
y += 5;
  tituloSecao("Resumo do acompanhamento");
  linha(
  "Variação do peso",
  variacaoPeso !== null
    ? `${variacaoPeso > 0 ? "+" : ""}${variacaoPeso.toFixed(1)}`
    : null,
  "kg"
);
  linha("Peso inicial", numero(pesoInicial), "kg");
  linha("Meta de peso", numero(pesoMeta), "kg");
  linha("Altura", numero(alturaCm, 0), "cm");
  linha("Classificação do IMC", classificacaoIMC(imc));
  y += 5;

  tituloSecao("Medidas antropométricas");

  const medidas = [
    ["Peso", "peso", "kg"],
    ["Altura", "altura", "cm"],
    ["IMC", "imc", ""],
    ["Gordura corporal", "percentual_gordura", "%"],
    ["Pescoço", "pescoco", "cm"],
    ["Tórax / peitoral", "torax", "cm"],
    ["Braço relaxado", "braco_relaxado", "cm"],
    ["Braço contraído", "braco_contraido", "cm"],
    ["Antebraço", "antebraco", "cm"],
    ["Cintura", "cintura", "cm"],
    ["Abdômen", "abdomen", "cm"],
    ["Quadril", "quadril", "cm"],
    ["Coxa", "coxa", "cm"],
    ["Panturrilha", "panturrilha", "cm"],
    ["Prega tricipital", "tricipital", "mm"],
    ["Prega bicipital", "bicipital", "mm"],
    ["Prega subescapular", "subescapular", "mm"],
    ["Prega supra-ilíaca", "supra_iliaca", "mm"],
    ["Prega abdominal", "prega_abdominal", "mm"],
    ["Prega peitoral", "prega_peitoral", "mm"],
    ["Prega axilar média", "axilar_media", "mm"],
    ["Prega coxa medial", "coxa_medial", "mm"],
    ["Prega panturrilha medial", "panturrilha_medial", "mm"],
  ];

  medidas.forEach(([rotulo, campo, unidade]) => {
  if (y > 266) {
    pdf.addPage();
    cabecalho("Relatório de acompanhamento nutricional");
    tituloSecao("Medidas antropométricas — continuação");
  }

  let valor = avaliacao[campo];

  if (campo === "altura") valor = alturaCm;
  if (campo === "imc") valor = imc;

  linha(
    rotulo,
    valor === null || valor === undefined || valor === ""
      ? null
      : numero(valor, campo === "imc" ? 2 : 1),
    unidade
  );
});

  // GRÁFICO VETORIAL — NÃO É PRINT DA TELA
  pdf.addPage();
  cabecalho("Evolução do peso");

  tituloSecao("Gráfico de evolução do peso");

  const historico = [...(medicoesPaciente || [])]
    .filter((item) => {
      const pesoItem = Number(item.peso);
      return item.data_medicao && Number.isFinite(pesoItem) && pesoItem > 0;
    })
    .sort(
      (a, b) =>
        new Date(a.data_medicao) - new Date(b.data_medicao)
    );

  const gx = 29;
  const gy = y + 9;
  const gw = 158;
  const gh = 80;

  pdf.setFillColor(250, 251, 249);
  pdf.setDrawColor(225, 231, 223);
  pdf.roundedRect(M, gy - 10, W - M * 2, 111, 3, 3, "FD");

  if (historico.length > 0) {
    
const valores = historico.map((item) => Number(item.peso));

let min = Math.min(...valores);
let max = Math.max(...valores);

// Margem para os pontos não ficarem nas bordas
const margem = Math.max((max - min) * 0.15, 0.5);

min -= margem;
max += margem;


    const posY = (valor) =>
      gy + gh - ((valor - min) / (max - min)) * gh;

    const posX = (indice) =>
      historico.length === 1
        ? gx + gw / 2
        : gx + (indice / (historico.length - 1)) * gw;

    // Grade e valores do eixo Y
    for (let i = 0; i <= 4; i++) {
      const yy = gy + (i / 4) * gh;
      const valor = max - (i / 4) * (max - min);

      pdf.setDrawColor(228, 234, 226);
      pdf.setLineWidth(0.2);
      pdf.line(gx, yy, gx + gw, yy);

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(7);
      pdf.setTextColor(...cinza);
      pdf.text(`${valor.toFixed(1)}`, gx - 3, yy + 2, {
        align: "right",
      });
    }

    // Linha da meta
    {/* Este trecho é JavaScript, dentro da função do PDF */}

if (pesoMeta != null && Number(pesoMeta) > 0) {
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8);
  pdf.setTextColor(...dourado);

  pdf.text(
    `Meta de peso: ${Number(pesoMeta).toFixed(1)} kg`,
    gx + gw,
    gy - 4,
    { align: "right" }
  );
}


    // Linha da evolução
    pdf.setDrawColor(...verde);
    pdf.setLineWidth(1);

    for (let i = 1; i < historico.length; i++) {
      pdf.line(
        posX(i - 1),
        posY(Number(historico[i - 1].peso)),
        posX(i),
        posY(Number(historico[i].peso))
      );
    }

    // Pontos
    historico.forEach((item, i) => {
      const px = posX(i);
      const py = posY(Number(item.peso));

      pdf.setFillColor(...verde);
      pdf.circle(px, py, 1.5, "F");

      // Evita sobreposição de datas em históricos grandes
      if (
        historico.length <= 8 ||
        i % Math.ceil(historico.length / 7) === 0 ||
        i === historico.length - 1
      ) {
        pdf.setFontSize(7);
        pdf.setTextColor(...cinza);
        pdf.text(dataBR(item.data_medicao).slice(0, 5), px, gy + gh + 7, {
          align: "center",
        });
      }
    });

    pdf.setFontSize(8);
    pdf.setTextColor(...cinza);
    pdf.text("Peso (kg)", gx, gy - 4);
  } else {
    pdf.setFontSize(11);
    pdf.setTextColor(...cinza);
    pdf.text(
      "Nenhuma medição disponível para o gráfico.",
      W / 2,
      gy + gh / 2,
      { align: "center" }
    );
  }

  y = gy + 115;

  tituloSecao("Histórico das medições");

  if (historico.length === 0) {
    linha("Medições", "Nenhum registro encontrado");
  } else {
    historico.forEach((item) => {
      linha(
        dataBR(item.data_medicao),
        numero(item.peso),
        "kg"
      );
    });
  }

  // Rodapé e numeração
  const totalPaginas = pdf.getNumberOfPages();

  for (let pagina = 1; pagina <= totalPaginas; pagina++) {
    pdf.setPage(pagina);

    pdf.setDrawColor(220, 228, 217);
    pdf.line(M, H - 17, W - M, H - 17);

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(...cinza);
    pdf.text(
      "NutriTrack | Relatório de acompanhamento nutricional",
      M,
      H - 11
    );
    pdf.text(
      `Página ${pagina} de ${totalPaginas}`,
      W - M,
      H - 11,
      { align: "right" }
    );
  }

  const nomeArquivo = nomePaciente
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .toLowerCase();

  pdf.save(`nutritrack-relatorio-${nomeArquivo}.pdf`);
};


  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [search, setSearch] = useState("");
  const [showClientForm, setShowClientForm] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [saveError, setSaveError] = useState(null);
  
  const identificarUsuario = async (user) => {
  if (!user) {
    setTipoUsuario(null);
    setUsuarioAtual(null);
    setDadosPaciente(null);
    return false;
  }

  // Verifica se é nutricionista
  const { data: nutri, error: erroNutri } = await supabase
    .from("nutricionistas")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (erroNutri) throw erroNutri;

  if (nutri) {
    setTipoUsuario("nutricionista");
    setUsuarioAtual(user);
    setDadosPaciente(null);
    return true;
  }

  // Verifica se é paciente
  const { data: paciente, error: erroPaciente } = await supabase
    .from("pacientes")
    .select("*")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (erroPaciente) throw erroPaciente;

  if (paciente) {
    setTipoUsuario("paciente");
    setUsuarioAtual(user);
    setDadosPaciente(paciente);
    return true;
  }

  setTipoUsuario(null);
  setUsuarioAtual(null);
  setDadosPaciente(null);
  return false;
};
  const salvarSenhaPaciente = async () => {
  if (novaSenha.length < 8) {
    alert("A senha precisa ter pelo menos 8 caracteres.");
    return;
  }

  if (novaSenha !== confirmarNovaSenha) {
    alert("As senhas não são iguais.");
    return;
  }

  setSalvandoSenha(true);

  try {
    const { data: sessao } = await supabase.auth.getUser();

    if (!sessao.user) {
      throw new Error("Convite inválido ou expirado.");
    }

    const { data: paciente, error: erroPaciente } = await supabase
      .from("pacientes")
      .select("id")
      .eq("auth_user_id", sessao.user.id)
      .maybeSingle();

    if (erroPaciente || !paciente) {
      throw new Error("Não foi encontrado um paciente vinculado a esta conta.");
    }

    // Salva a nova senha do paciente
const { error } = await supabase.auth.updateUser({
  password: novaSenha,
});

if (error) throw error;

// Registra que o primeiro acesso foi concluído
const { error: erroConclusao } = await supabase.rpc(
  "concluir_primeiro_acesso"
);

if (erroConclusao) {
  throw new Error(
    "Senha salva, mas não foi possível concluir o primeiro acesso: " +
    erroConclusao.message
  );
}

    setPrimeiroAcesso(false);
    setNovaSenha("");
    setConfirmarNovaSenha("");

    await identificarUsuario(sessao.user);
    setLoggedIn(true);

    alert("Senha cadastrada com sucesso!");
  } catch (erro) {
    alert(erro.message || "Não foi possível cadastrar a senha.");
  } finally {
    setSalvandoSenha(false);
  }
};
  const handleLogin = async () => {
  const email = document.querySelector('input[type="email"]')?.value;
  const senha = document.querySelector('input[type="password"]')?.value;

  if (!email || !senha) {
    alert("Preencha o e-mail e a senha.");
    return;
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password: senha,
  });

  if (error) {
    alert("E-mail ou senha incorretos.");
    return;
  }

  setVerificandoPerfil(true);

  try {
    const encontrado = await identificarUsuario(data.user);

    
if (!encontrado) {
  await supabase.auth.signOut();
  alert("Usuário sem cadastro de nutricionista ou paciente.");
  return;
}

// Verifica se o usuário é um paciente
const { data: paciente, error: erroPaciente } = await supabase
  .from("pacientes")
  .select("id, primeiro_acesso_concluido")
  .eq("auth_user_id", data.user.id)
  .maybeSingle();

if (erroPaciente) {
  throw erroPaciente;
}

// Paciente com primeiro acesso pendente
if (paciente && !paciente.primeiro_acesso_concluido) {
  setPrimeiroAcesso(true);
  setLoggedIn(false);
  return;
}

// Nutricionista ou paciente com acesso concluído
setPrimeiroAcesso(false);
setLoggedIn(true);

  } catch (erro) {
    console.error("Erro ao identificar usuário:", erro);
    await supabase.auth.signOut();
    setTipoUsuario(null);
    setUsuarioAtual(null);
    alert("Não foi possível verificar o perfil do usuário.");
  } finally {
    setVerificandoPerfil(false);
  }
};

const handleLogout = async () => {
  const { error } = await supabase.auth.signOut();

  if (error) {
    alert("Não foi possível sair da conta.");
    return;
  }

  setLoggedIn(false);
  setTipoUsuario(null);
  setUsuarioAtual(null);
  setDadosPaciente(null);
  setMedicoesPaciente([]);
  setPrimeiroAcesso(false);
  setClients([]);
  setSelectedId(null);
};


  useEffect(() => {
    if (!loggedIn || tipoUsuario !== "nutricionista") {
      setClients([]);
      setLoading(false);
      setLoadError(false);
      return;
    }

    let ativo = true;
    setLoading(true);
    setLoadError(false);

    (async () => {
      try {
        const data = await loadClients();
        if (ativo) {
          setClients(data.sort((a, b) => a.name.localeCompare(b.name, "pt-BR")));
        }
      } catch (erro) {
        console.error("Erro ao carregar clientes:", erro);
        if (ativo) setLoadError(true);
      } finally {
        if (ativo) setLoading(false);
      }
    })();

    return () => { ativo = false; };
  }, [loggedIn, tipoUsuario]);

  // Atualiza o cadastro exibido na área do paciente autenticado.
  useEffect(() => {
    if (!loggedIn || tipoUsuario !== "paciente" || !usuarioAtual?.id) {
      setCarregandoPaciente(false);
      return;
    }

    let ativo = true;
    setCarregandoPaciente(true);

    const carregarDadosPaciente = async () => {
      try {
        const { data, error } = await supabase
          .from("pacientes")
          .select("id, nome, peso_inicial, peso_meta, altura, auth_user_id")
          .eq("auth_user_id", usuarioAtual.id)
          .maybeSingle();

        if (error) throw error;
        if (ativo) setDadosPaciente(data);
        if (!data) console.warn("Não existe paciente vinculado à conta autenticada.");
      } catch (erro) {
        console.error("Erro ao carregar dados do paciente:", erro);
        if (ativo) setDadosPaciente(null);
      } finally {
        if (ativo) setCarregandoPaciente(false);
      }
    };

    carregarDadosPaciente();
    return () => { ativo = false; };
  }, [loggedIn, tipoUsuario, usuarioAtual?.id]);

  useEffect(() => {
  let ativo = true;

  const verificarSessao = async () => {
    setVerificandoPerfil(true);

    try {
      const { data, error } = await supabase.auth.getUser();

      if (error || !data.user) {
        if (ativo) {
          setLoggedIn(false);
          setTipoUsuario(null);
          setUsuarioAtual(null);
        }
        return;
      }

      if (!ativo) return;

      const encontrado = await identificarUsuario(data.user);

if (!ativo) return;

if (!encontrado) {
  setLoggedIn(false);
  return;
}

const { data: paciente, error: erroPaciente } = await supabase
  .from("pacientes")
  .select("id, primeiro_acesso_concluido")
  .eq("auth_user_id", data.user.id)
  .maybeSingle();

if (erroPaciente) {
  throw erroPaciente;
}

if (paciente && !paciente.primeiro_acesso_concluido) {
  setPrimeiroAcesso(true);
  setLoggedIn(false);
} else {
  setPrimeiroAcesso(false);
  setLoggedIn(true);
}
    } catch (erro) {
      console.error("Erro ao verificar sessão:", erro);

      if (ativo) {
        setLoggedIn(false);
        setTipoUsuario(null);
        setUsuarioAtual(null);
      }
    } finally {
      if (ativo) {
        setVerificandoPerfil(false);
      }
    }
  };

  verificarSessao();

  return () => {
    ativo = false;
  };
}, []);
useEffect(() => {
  if (tipoUsuario !== "paciente" || !dadosPaciente?.id) {
    setMedicoesPaciente([]);
    return;
  }

  let ativo = true;

  const carregarMedicoes = async () => {
    setCarregandoMedicoes(true);

    const { data, error } = await supabase
      .from("medicoes")
      .select("id, data_medicao, peso")
      .eq("paciente_id", dadosPaciente.id)
      .order("data_medicao", { ascending: true });

    if (error) {
      console.error("Erro ao carregar medições:", error);
    }

    if (ativo) {
      setMedicoesPaciente(error ? [] : data || []);
      setCarregandoMedicoes(false);
    }
  };

  carregarMedicoes();

  return () => {
    ativo = false;
  };
}, [tipoUsuario, dadosPaciente?.id]);

useEffect(() => {
  if (tipoUsuario !== "paciente" || !dadosPaciente?.id) {
    setPlanoPaciente(null);
    setRefeicoesPaciente([]);
    setAvaliacoesPaciente([]);
    setErroResumo("");
    return;
  }
  let ativo = true;
  const carregarResumo = async () => {
    setCarregandoResumo(true);
    setErroResumo("");
    try {
      const [resPlano, resAvaliacoes] = await Promise.all([
        supabase.from("planos_alimentares").select("*")
          .eq("paciente_id", dadosPaciente.id)
          .order("created_at", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("avaliacoes").select("*")
          .eq("paciente_id", dadosPaciente.id)
          .order("data_avaliacao", { ascending: false }),
      ]);

      console.log("ID do paciente:", dadosPaciente.id);
      console.log("Plano retornado:", resPlano.data);
      console.log("Erro do plano:", resPlano.error);

      if (resPlano.error) throw resPlano.error;
      if (resAvaliacoes.error) throw resAvaliacoes.error;
      let refeicoes = [];
      if (resPlano.data?.id) {
  // Buscar as refeições do plano
  const { data: listaRefeicoes, error: erroRefeicoes } =
    await supabase
      .from("refeicoes")
      .select("*")
      .eq("plano_id", resPlano.data.id)
      .order("horario", { ascending: true });

  if (erroRefeicoes) throw erroRefeicoes;

  // Buscar os alimentos de cada refeição
  refeicoes = await Promise.all(
    (listaRefeicoes || []).map(async (refeicao) => {
      const { data: alimentos, error: erroAlimentos } =
        await supabase
          .from("alimentos_refeicao")
          .select("*")
          .eq("refeicao_id", refeicao.id);

      if (erroAlimentos) {
        console.error("Erro ao carregar alimentos:", erroAlimentos);
      }

      return {
        ...refeicao,
        alimentos: alimentos || [],
      };
    })
  );
}
      if (ativo) {
        setPlanoPaciente(resPlano.data || null);
        setRefeicoesPaciente(refeicoes);
        setAvaliacoesPaciente(resAvaliacoes.data || []);
      }
    } catch (erro) {
      console.error("Erro ao carregar acompanhamento do paciente:", erro);
      if (ativo) setErroResumo("Não foi possível consultar o plano ou as avaliações. Verifique as permissões de acesso no Supabase.");
    } finally {
      if (ativo) setCarregandoResumo(false);
    }
  };
  carregarResumo();
  return () => { ativo = false; };
}, [tipoUsuario, dadosPaciente?.id]);

useEffect(() => {
  const verificarConvite = () => {
    const parametros = new URLSearchParams(window.location.hash.slice(1));

    if (parametros.get("type") === "invite") {
      setPrimeiroAcesso(true);
    }
  };

  verificarConvite();

  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    (event) => {
      if (event === "PASSWORD_RECOVERY") {
        setPrimeiroAcesso(true);
      }
    }
  );

  return () => subscription.unsubscribe();
}, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter((c) => c.name.toLowerCase().includes(q));
  }, [clients, search]);

  const selected = clients.find((c) => c.id === selectedId) || null;

  const handleCreateOrEditClient = async (formData) => {
  try {
    if (editingClient) {
      // EDITAR paciente existente
      const updated = {
        ...editingClient,
        ...formData,
      };

      await saveClient(updated);

      setClients((cs) =>
        cs
          .map((c) => (c.id === updated.id ? updated : c))
          .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
      );

    } else {
      // CRIAR novo paciente
      // Não gera ID aqui. O Supabase vai gerar.
      const newClient = {
        ...formData,
        entries: [],
      };

      const savedData = await saveClient(newClient);

      console.log("Paciente retornado pelo Supabase:", savedData);

      if (!savedData || savedData.length === 0) {
        throw new Error("Supabase não retornou o paciente criado.");
      }

      const pacienteBanco = savedData[0];

      const savedClient = {
        ...newClient,
        id: pacienteBanco.id,
        createdAt: pacienteBanco.created_at,
      };

      setClients((cs) =>
        [...cs, savedClient].sort((a, b) =>
          a.name.localeCompare(b.name, "pt-BR")
        )
      );

      setSelectedId(savedClient.id);
    }

    setShowClientForm(false);
    setEditingClient(null);

  } catch (e) {
    console.error("Erro ao criar/editar paciente:", e);
    setSaveError("Não foi possível salvar. Tente novamente.");
  }
};

  const handleUpdateClient = async (updated) => {
    try {
      await saveClient(updated);
      setClients((cs) => cs.map((c) => (c.id === updated.id ? updated : c)));
    } catch (e) {
      setSaveError("Não foi possível salvar a alteração.");
    }
  };

  const handleDeleteClient = async (id) => {
    try {
      await deleteClientStorage(id);
      setClients((cs) => cs.filter((c) => c.id !== id));
      if (selectedId === id) setSelectedId(null);
    } catch (e) {
      setSaveError("Não foi possível excluir o cliente.");
    }
  };

const ultimaMedicao =
  medicoesPaciente.length > 0
    ? medicoesPaciente[medicoesPaciente.length - 1]
    : null;

const pesoAtual = ultimaMedicao?.peso;
  
if (verificandoPerfil && !primeiroAcesso) {
  return (
    <div className="nt-animated min-h-screen flex items-center justify-center bg-[#EDEFE7] text-[#2F4B3C]">
      <p className="nt-loading font-semibold">Verificando acesso ao NutriTrack...</p>
    </div>
  );
}

if (primeiroAcesso) {


  return (
    <div className="nt-animated min-h-screen flex items-center justify-center bg-[#EDEFE7] p-6">
      <div className="w-full max-w-md rounded-2xl bg-white p-5 sm:p-8 shadow-lg">
        <h1 className="mb-2 text-3xl font-bold text-[#2F4B3C]">
          NutriTrack
        </h1>

        <h2 className="mb-3 text-xl font-semibold">
          Primeiro acesso do paciente
        </h2>

        <p className="mb-6 text-gray-600">
          Crie uma senha para acessar seus dados e seu plano alimentar.
        </p>

        <div className="space-y-4">
          <input
            type="password"
            placeholder="Nova senha"
            value={novaSenha}
            onChange={(e) => setNovaSenha(e.target.value)}
            className="w-full rounded-xl border border-gray-300 p-3"
          />

          <input
            type="password"
            placeholder="Confirmar nova senha"
            value={confirmarNovaSenha}
            onChange={(e) => setConfirmarNovaSenha(e.target.value)}
            className="w-full rounded-xl border border-gray-300 p-3"
          />

          <button
            type="button"
            onClick={salvarSenhaPaciente}
            disabled={salvandoSenha}
            className="w-full rounded-xl p-3 font-semibold text-white disabled:opacity-50"
            style={{ backgroundColor: "#2F4B3C" }}
          >
            {salvandoSenha ? "Salvando..." : "Criar minha senha"}
          </button>
        </div>
      </div>
    </div>
  );
}
  if (!loggedIn) {
  return (
    <div className="nt-animated nutri-login-background min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-5 sm:p-8 shadow-lg">
        <h1 className="mb-2 text-3xl font-bold text-[var(--forest)]">
          NutriTrack
        </h1>

        <p className="mb-6 text-gray-600">
          Entre na sua conta para continuar
        </p>

        {!showCadastro ? (
  <>

        <div className="space-y-4">
          <input
            type="email"
            placeholder="E-mail"
            className="w-full rounded-xl border border-gray-300 p-3 outline-none"
          />

          <input
            type="password"
            placeholder="Senha"
            className="w-full rounded-xl border border-gray-300 p-3 outline-none"
          />

          <button
  onClick={handleLogin}
  style={{
    backgroundColor: "#2F4B3C",
    color: "#FFFFFF",
  }}
  className="w-full rounded-xl p-3 font-semibold shadow-md"
>
  Entrar
</button>
<p className="mt-4 text-center text-sm text-gray-600">
  Ainda não possui uma conta?
</p>

<button
  type="button"
  onClick={() => setShowCadastro(true)}
  className="mt-2 w-full rounded-xl border p-3 font-medium"
  style={{
    borderColor: "#2F4B3C",
    color: "#2F4B3C",
  }}
>
  Criar conta de nutricionista
</button>
                </div>

        </>
        ) : (
          <div>
            <h2 className="mb-4 text-2xl font-bold text-[var(--forest)]">
              Cadastro do Nutricionista
            </h2>

            <p className="mb-6 text-gray-600">
              Crie sua conta para acessar o NutriTrack.
            </p>

            <div className="space-y-4">
              <input
                type="text"
                placeholder="Nome completo"
                className="w-full rounded-xl border border-gray-300 p-3 outline-none"
                value={nutricionista.nome}
                onChange={(e) =>
                  setNutricionista({
                    ...nutricionista,
                    nome: e.target.value,
                  })
                }
              />

              <input
                type="email"
                placeholder="E-mail"
                className="w-full rounded-xl border border-gray-300 p-3 outline-none"
                value={nutricionista.email}
                onChange={(e) =>
                  setNutricionista({
                    ...nutricionista,
                    email: e.target.value,
                  })
                }
              />

              <input
                type="password"
                placeholder="Senha"
                className="w-full rounded-xl border border-gray-300 p-3 outline-none"
                value={nutricionista.senha}
                onChange={(e) =>
                  setNutricionista({
                    ...nutricionista,
                    senha: e.target.value,
                  })
                }
              />

              <input
                type="password"
                placeholder="Confirmar senha"
                className="w-full rounded-xl border border-gray-300 p-3 outline-none"
                value={nutricionista.confirmarSenha}
                onChange={(e) =>
                  setNutricionista({
                    ...nutricionista,
                    confirmarSenha: e.target.value,
                  })
                }
              />

              <button
  type="button"
  onClick={async () => {
  if (
    !nutricionista.nome ||
    !nutricionista.email ||
    !nutricionista.senha ||
    !nutricionista.confirmarSenha
  ) {
    alert("Preencha todos os campos.");
    return;
  }

  if (nutricionista.senha !== nutricionista.confirmarSenha) {
    alert("As senhas não são iguais.");
    return;
  }

  const { data, error } = await supabase.auth.signUp({
    email: nutricionista.email,
    password: nutricionista.senha,
  });

  if (error) {
    alert("Erro ao criar conta: " + error.message);
    return;
  }

  if (!data.user) {
    alert("Não foi possível criar o usuário.");
    return;
  }

  const { error: erroCadastro } = await supabase
    .from("nutricionistas")
    .insert({
      id: data.user.id,
      nome: nutricionista.nome,
    });

  if (erroCadastro) {
    alert("A conta foi criada, mas não foi possível salvar o cadastro.");
    console.error(erroCadastro);
    return;
  }

  alert("Conta criada com sucesso!");

  setShowCadastro(false);

  setNutricionista({
    nome: "",
    email: "",
    senha: "",
    confirmarSenha: "",
  });
}}
  className="w-full rounded-xl p-3 font-semibold shadow-md"
  style={{
    backgroundColor: "#2F4B3C",
    color: "#FFFFFF",
  }}
>
  Criar conta
</button>

              <button
                type="button"
                onClick={() => setShowCadastro(false)}
                className="w-full rounded-xl border p-3 font-medium"
                style={{
                  borderColor: "#2F4B3C",
                  color: "#2F4B3C",
                }}
              >
                Voltar para o login
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}


if (tipoUsuario === "paciente") {
  const pesos = medicoesPaciente.filter(m => m.peso != null && m.data_medicao)
    .map(m => ({ data: m.data_medicao, peso: Number(m.peso), label: fmtDateShort(m.data_medicao) }));
  const pesoReferencia = pesoAtual != null ? Number(pesoAtual) : null;
  const meta = dadosPaciente?.peso_meta != null ? Number(dadosPaciente.peso_meta) : null;
  const inicial = dadosPaciente?.peso_inicial != null ? Number(dadosPaciente.peso_inicial) : null;
  const variacao = pesoReferencia != null && inicial != null ? pesoReferencia - inicial : null;
  const resumoCards = [
    { titulo: "Peso atual", valor: carregandoMedicoes ? "Carregando..." : pesoReferencia != null ? `${pesoReferencia.toFixed(1)} kg` : "Sem medições", icone: Scale, detalhe: "Última medição registrada" },
    { titulo: "Peso inicial", valor: inicial != null ? `${inicial.toFixed(1)} kg` : "—", icone: Ruler, detalhe: "Início do acompanhamento" },
    { titulo: "Meta de peso", valor: meta != null ? `${meta.toFixed(1)} kg` : "—", icone: Target, detalhe: "Objetivo cadastrado" },
    { titulo: "Variação", valor: variacao != null ? `${variacao > 0 ? "+" : ""}${variacao.toFixed(1)} kg` : "—", icone: TrendingUp, detalhe: "Em relação ao peso inicial" },
  ];
  return (
    <div className="nt-animated min-h-screen bg-[#EDEFE7] text-[#22301F]" style={{ fontFamily: "Inter, sans-serif" }}>
      <header className="bg-[#2F4B3C] text-white px-5 py-5 shadow-md">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3"><div className="rounded-xl bg-white/15 p-2"><Leaf size={23}/></div>
            <div><h1 className="text-2xl font-bold">NutriTrack</h1><p className="text-sm text-white/75">Meu acompanhamento nutricional</p></div></div>
          <button type="button" onClick={handleLogout} className="rounded-xl border border-white/30 px-4 py-2 text-sm font-semibold hover:bg-white/15">Sair</button>
        </div>
      </header>
      <main className="max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 sm:py-9">
        <section className="mb-8">
          <p className="text-xs font-bold uppercase tracking-[.16em] text-[#6C7D64] mb-2">Seu espaço de saúde</p>
          <h2 className="text-3xl md:text-4xl font-bold text-[#2F4B3C]">{carregandoPaciente ? "Carregando..." : `Olá, ${dadosPaciente?.nome || "paciente"}!`}</h2>
          <p className="mt-3 text-[#6C7D64]">Acompanhe seu progresso, refeições e avaliações em um só lugar.</p>
        </section>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-7">
          {resumoCards.map(({ titulo, valor, icone: Icon, detalhe }) => (
            <div key={titulo} className="nt-hover-card min-w-0 rounded-2xl bg-white p-4 sm:p-5 border border-[#C7D2BF] shadow-sm">
              <div className="flex items-center justify-between mb-4"><span className="text-sm text-[#6C7D64]">{titulo}</span><span className="rounded-xl bg-[#E9EEE2] p-2 text-[#2F4B3C]"><Icon size={19}/></span></div>
              <p className="text-2xl font-bold text-[#2F4B3C]">{valor}</p><p className="text-xs text-[#6C7D64] mt-2">{detalhe}</p>
            </div>
          ))}
        </div>
        {erroResumo && <div role="alert" className="mb-6 rounded-xl border border-[#9C3D54]/30 bg-white px-5 py-4 text-[#9C3D54] text-sm">{erroResumo}</div>}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 sm:gap-6 mb-6">
          <section className="lg:col-span-3 min-w-0 rounded-2xl bg-white p-4 sm:p-6 border border-[#C7D2BF] shadow-sm">
            <div className="flex items-center gap-2 mb-2 text-[#2F4B3C]"><TrendingUp size={20}/><h3 className="text-xl font-bold">Minha evolução</h3></div>
            <p className="text-sm text-[#6C7D64] mb-5">Histórico de peso registrado pelo nutricionista</p>
            {carregandoMedicoes ? <p className="nt-loading text-sm text-[#6C7D64]">Carregando medições...</p> : pesos.length ? (
              <div className="w-full h-64" role="img" aria-label="Gráfico de evolução do peso">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={pesos} margin={{ top: 15, right: 15, left: -15, bottom: 5 }}>
                    <CartesianGrid stroke="#E9EEE2" strokeDasharray="4 4"/>
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#6C7D64" }}/>
                    <YAxis domain={["auto", "auto"]} tick={{ fontSize: 11, fill: "#6C7D64" }}/>
                    <Tooltip formatter={(valor) => [`${Number(valor).toFixed(1)} kg`, "Peso"]}/>
                    {meta != null && <ReferenceLine y={meta} stroke="#B8892F" strokeDasharray="5 5" label={{ value: "Meta", fill: "#B8892F", fontSize: 11 }}/>} 
                    <Line type="monotone" dataKey="peso" stroke="#2F4B3C" strokeWidth={3} dot={{ r: 4, fill: "#2F4B3C" }} activeDot={{ r: 6 }}/>
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : <div className="rounded-xl bg-[#F5F7F2] px-5 py-10 text-center text-sm text-[#6C7D64]">Nenhuma medição registrada ainda. O gráfico aparecerá após a primeira medição.</div>}
          </section>
          <section className="lg:col-span-2 min-w-0 rounded-2xl bg-white p-4 sm:p-6 border border-[#C7D2BF] shadow-sm">
            <div className="flex items-center gap-2 mb-2 text-[#2F4B3C]"><ClipboardList size={20}/><h3 className="text-xl font-bold">Meu plano alimentar</h3></div>
            <p className="text-sm text-[#6C7D64] mb-5">Refeições organizadas para você</p>
            {carregandoResumo ? <p className="nt-loading text-sm text-[#6C7D64]">Carregando plano...</p> : !planoPaciente ? <p className="rounded-xl bg-[#F5F7F2] p-5 text-sm text-[#6C7D64]">Seu nutricionista ainda não cadastrou um plano alimentar.</p> : refeicoesPaciente.length === 0 ? <p className="rounded-xl bg-[#F5F7F2] p-5 text-sm text-[#6C7D64]">Plano cadastrado, mas ainda sem refeições.</p> : (
              <div className="space-y-3 max-h-64 overflow-y-auto pr-1">{refeicoesPaciente.map(refeicao => (
                <div key={refeicao.id} className="rounded-xl bg-[#F5F7F2] border border-[#E9EEE2] p-4">
                  <div className="flex items-center justify-between gap-3"><strong className="text-[#2F4B3C] text-sm">{refeicao.nome || "Refeição"}</strong><span className="text-xs text-[#6C7D64] whitespace-nowrap">{refeicao.horario?.slice(0, 5) || ""}</span></div>
                  {refeicao.observacoes && <p className="text-xs text-[#6C7D64] mt-2">{refeicao.observacoes}</p>}
        
                  {/* Alimentos da refeição */}
<div className="mt-3 space-y-2">
  {refeicao.alimentos?.length > 0 ? (
    refeicao.alimentos.map((alimento) => (
      <div
        key={alimento.id}
        className="rounded-lg border border-[#C7D2BF] bg-white p-3"
      >
        <div className="flex items-center justify-between gap-3">
          <strong className="text-sm text-[#2F4B3C]">
            {alimento.alimento}
          </strong>

          <span className="text-xs text-[#6C7D64]">
            {alimento.quantidade} {alimento.unidade}
          </span>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-[#6C7D64]">
          <p>Calorias: {Number(alimento.calorias || 0).toFixed(1)} kcal</p>
          <p>Proteínas: {Number(alimento.proteinas || 0).toFixed(1)} g</p>
          <p>Carboidratos: {Number(alimento.carboidratos || 0).toFixed(1)} g</p>
          <p>Gorduras: {Number(alimento.gorduras || 0).toFixed(1)} g</p>
        </div>

        {alimento.observacoes && (
          <p className="mt-2 text-xs text-[#6C7D64]">
            {alimento.observacoes}
          </p>
        )}
      </div>
    ))
  ) : (
    <p className="mt-2 text-xs text-[#6C7D64]">
      Nenhum alimento cadastrado nesta refeição.
    </p>
  )}
</div>
                              </div>
              ))}
              </div>
            )}
          </section>
        </div>

        <section className="rounded-2xl bg-white p-6 border border-[#C7D2BF] shadow-sm mb-6">
  <div className="flex items-center gap-2 mb-2 text-[#2F4B3C]">
    <ClipboardList size={20} />
    <h3 className="text-xl font-bold">Minhas avaliações</h3>
  </div>

  <p className="text-sm text-[#6C7D64] mb-5">
    Resultados das avaliações antropométricas registradas
  </p>

  {carregandoResumo ? (
    <p>Carregando avaliações...</p>
  ) : avaliacoesPaciente.length === 0 ? (
    <p className="rounded-xl bg-[#F5F7F2] p-5 text-sm text-[#6C7D64]">
      Nenhuma avaliação cadastrada até o momento.
    </p>
  ) : (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
      {avaliacoesPaciente.map((avaliacao) => (
        <article
          key={avaliacao.id}
          className="rounded-xl border border-[#E9EEE2] bg-[#F5F7F2] p-4"
        >
          <div className="flex items-center gap-2 text-sm font-semibold text-[#2F4B3C] mb-3">
            <Calendar size={16} />
            {fmtDate(avaliacao.data_avaliacao)}
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Peso</span>
              <strong>
                {avaliacao.peso != null ? `${avaliacao.peso} kg` : "—"}
              </strong>
            </div>

            <div className="flex justify-between">
              <span>IMC</span>
              <strong>
                {avaliacao.imc != null
                  ? Number(avaliacao.imc).toFixed(2)
                  : "—"}
              </strong>
            </div>

            <div className="flex justify-between">
              <span>Gordura corporal</span>
              <strong>
                {avaliacao.percentual_gordura != null
                  ? `${avaliacao.percentual_gordura}%`
                  : "—"}
              </strong>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setAvaliacaoAberta(avaliacao)}
            className="mt-4 w-full rounded-lg bg-[#2F4B3C] px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
          >
            Ver avaliação completa
          </button>
          <button
  type="button"
  onClick={() => gerarPDFAvaliacao(avaliacao)}
  className="mt-2 w-full rounded-lg border border-[#2F4B3C] bg-white px-4 py-2 text-sm font-semibold text-[#2F4B3C] hover:bg-[#E9EEE2]"
>
  Baixar relatório PDF
</button>
        </article>
              ))}
        </div>
      )}
    </section>

    {avaliacaoAberta && (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={() => setAvaliacaoAberta(null)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Detalhes da avaliação"
        className="w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-[#2F4B3C]">
            Avaliação completa
          </h3>

          <button
            type="button"
            onClick={() => setAvaliacaoAberta(null)}
            className="rounded-lg px-3 py-2 text-sm hover:bg-gray-100"
          >
            Fechar ✕
          </button>
        </div>

        <p className="text-sm text-[#6C7D64] mb-5">
          Data: {fmtDate(avaliacaoAberta.data_avaliacao)}
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            ["Peso", "peso", "kg"],
            ["Altura", "altura", "cm"],
            ["IMC", "imc", ""],
            ["Gordura corporal", "percentual_gordura", "%"],
            ["Pescoço", "pescoco", "cm"],
            ["Tórax / peitoral", "torax", "cm"],
            ["Braço relaxado", "braco_relaxado", "cm"],
            ["Braço contraído", "braco_contraido", "cm"],
            ["Antebraço", "antebraco", "cm"],
            ["Cintura", "cintura", "cm"],
            ["Abdômen", "abdomen", "cm"],
            ["Quadril", "quadril", "cm"],
            ["Coxa", "coxa", "cm"],
            ["Panturrilha", "panturrilha", "cm"],
            ["Prega tricipital", "tricipital", "mm"],
            ["Prega bicipital", "bicipital", "mm"],
            ["Prega subescapular", "subescapular", "mm"],
            ["Prega supra-ilíaca", "supra_iliaca", "mm"],
            ["Prega abdominal", "prega_abdominal", "mm"],
            ["Prega peitoral", "prega_peitoral", "mm"],
            ["Prega axilar média", "axilar_media", "mm"],
            ["Prega coxa medial", "coxa_medial", "mm"],
            ["Prega panturrilha medial", "panturrilha_medial", "mm"],
          ].map(([rotulo, campo, unidade]) => (
            <div
              key={campo}
              className="rounded-lg border border-[#E9EEE2] bg-[#F5F7F2] p-3"
            >
              <p className="text-xs text-[#6C7D64]">{rotulo}</p>
              <p className="font-semibold text-[#2F4B3C]">
                {campo === "altura"
  ? (
      avaliacaoAberta.altura != null
        ? `${avaliacaoAberta.altura} cm`
        : dadosPaciente?.altura != null
          ? `${dadosPaciente.altura} cm`
          : "Não informado"
    )
  : avaliacaoAberta[campo] != null
    ? `${avaliacaoAberta[campo]} ${unidade}`
    : "Não informado"}
              </p>
              {campo === "imc" && avaliacaoAberta.imc != null && (
  <p className="mt-1 text-xs font-medium text-[#6C7D64]">
    {Number(avaliacaoAberta.imc) < 18.5
      ? "Abaixo do peso"
      : Number(avaliacaoAberta.imc) < 25
      ? "Peso adequado"
      : Number(avaliacaoAberta.imc) < 30
      ? "Sobrepeso"
      : Number(avaliacaoAberta.imc) < 35
      ? "Obesidade grau I"
      : Number(avaliacaoAberta.imc) < 40
      ? "Obesidade grau II"
      : "Obesidade grau III"}
  </p>
)}
                      </div>
                ))}
      </div>
    </div>
  </div>
)}

<p className="text-xs text-center text-[#6C7D64] pb-5">
  NutriTrack • Seu acompanhamento em cada etapa
</p>
      </main>
    </div>
  );
}

  return (
    <div
      className="nt-animated nt-nutritionist flex flex-col md:flex-row h-full w-full overflow-hidden rounded-xl"
      style={{ background: "var(--bg)", minHeight: 640, fontFamily: "var(--font-body)" }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
        :root {
          --bg: #EDEFE7;
          --paper: #F5F7F2;
          --ink: #22301F;
          --forest: #2F4B3C;
          --sage: #C7D2BF;
          --sage-dark: #6C7D64;
          --sage-tint: #E9EEE2;
          --berry: #9C3D54;
          --gold: #B8892F;
          --font-display: 'Fraunces', serif;
          --font-body: 'Inter', sans-serif;
          --font-mono: 'IBM Plex Mono', monospace;
        }
        * { box-sizing: border-box; }
        table { border-collapse: collapse; }
        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-thumb { background: var(--sage); border-radius: 4px; }
        input:focus, textarea:focus { border-color: var(--forest) !important; box-shadow: 0 0 0 3px rgba(47,75,60,0.12); }
      `}</style>

      {/* Sidebar */}
      <div className="nt-sidebar w-full md:w-[300px] shrink-0 flex flex-col" style={{ background: "var(--paper)", borderRight: "1px solid var(--sage)" }}>
        <div className="px-5 pt-6 pb-4" style={{ borderBottom: "1px solid var(--sage)" }}>
          <div className="flex items-center gap-2 mb-4">
            <Leaf size={20} style={{ color: "var(--forest)" }} />
            <h1 style={{ fontFamily: "var(--font-display)", fontSize: "1.25rem", fontWeight: 600, color: "var(--ink)" }}>
              NutriTrack
            </h1>

            <button
            onClick={handleLogout}
            className="mt-2 text-sm font-medium"
            style={{ color: "var(--berry)" }}
          >
            Sair
          </button>
        
          </div>
          <div className="relative mb-3">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--sage-dark)" }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar cliente..."
              className="w-full pl-9 pr-3 py-2 rounded-lg text-sm outline-none"
              style={{ ...inputStyle, background: "#fff" }}
            />
          </div>
          <button
            onClick={() => { setEditingClient(null); setShowClientForm(true); }}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-semibold text-white"
            style={{ background: "var(--forest)" }}
          >
            <Plus size={16} /> Novo cliente
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-2">
          {loading ? (
            <div className="flex items-center justify-center py-10" style={{ color: "var(--sage-dark)" }}>
              <Loader2 size={18} className="animate-spin" />
            </div>
          ) : loadError ? (
            <div className="px-5 py-6 text-xs flex items-start gap-2" style={{ color: "var(--berry)" }}>
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              Não foi possível carregar os clientes. Recarregue a página.
            </div>
          ) : filtered.length === 0 ? (
            <div className="px-5 py-6 text-xs" style={{ color: "var(--sage-dark)" }}>
              {clients.length === 0 ? "Nenhum cliente cadastrado ainda." : "Nenhum resultado para a busca."}
            </div>
          ) : (
            filtered.map((c) => {
              const le = latestEntry(c);
              const pct = progressPercent(c);
              const isActive = c.id === selectedId;
              return (
                <button
                  key={c.id}
                  onClick={() => setSelectedId(c.id)}
                  className="w-full flex items-center gap-3 px-5 py-3 text-left transition-colors"
                  style={{ background: isActive ? "var(--sage-tint)" : "transparent" }}
                >
                  <RingAvatar name={c.name} percent={pct} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate" style={{ color: "var(--ink)" }}>{c.name}</div>
                    <div className="text-xs truncate" style={{ color: "var(--sage-dark)" }}>
                      {le ? `Última medição: ${fmtDate(le.date)}` : "Sem medições"}
                    </div>
                  </div>
                  <ChevronRight size={15} style={{ color: "var(--sage-dark)", opacity: isActive ? 1 : 0.4 }} />
                </button>
              );
            })
          )}
        </div>

        <div className="px-5 py-3 text-xs" style={{ borderTop: "1px solid var(--sage)", color: "var(--sage-dark)" }}>
          {clients.length} {clients.length === 1 ? "cliente cadastrado" : "clientes cadastrados"}
        </div>
      </div>

      {/* Main */}
      {selected ? (
        <ClientDetail
          client={selected}
          onUpdate={handleUpdateClient}
          onDeleteClient={handleDeleteClient}
          onEditClient={(c) => { setEditingClient(c); setShowClientForm(true); }}
        />
      ) : (
        <EmptyState onNewClient={() => { setEditingClient(null); setShowClientForm(true); }} hasClients={clients.length > 0} />
      )}

      {showClientForm && (
        <Modal title={editingClient ? "Editar cliente" : "Novo cliente"} onClose={() => { setShowClientForm(false); setEditingClient(null); }} wide>
          <ClientForm initial={editingClient} onCancel={() => { setShowClientForm(false); setEditingClient(null); }} onSave={handleCreateOrEditClient} />
        </Modal>
      )}

      {saveError && (
        <div className="fixed bottom-5 right-5 px-4 py-3 rounded-lg text-sm text-white flex items-center gap-2 shadow-lg" style={{ background: "var(--berry)" }}>
          <AlertCircle size={16} /> {saveError}
          <button onClick={() => setSaveError(null)} className="ml-2"><X size={14} /></button>
        </div>
      )}
    </div>
  );
}
