import React, { useState, useEffect, useMemo, useCallback } from "react";
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
const genId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

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
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return [];
  }

  const { data, error } = await supabase
    .from("pacientes")
    .select("*")
    .eq("nutricionista_id", user.id)
    .order("nome", { ascending: true });

  if (error) {
    console.error("Erro ao carregar pacientes:", error);
    throw error;
  }

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
    entries: [],
    createdAt: paciente.created_at,
  }));
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

  let result;

  if (uuidValido) {
    result = await supabase
      .from("pacientes")
      .update(paciente)
      .eq("id", client.id)
      .eq("nutricionista_id", user.id);
  } else {
    result = await supabase
      .from("pacientes")
      .insert(paciente);
  }

  if (result.error) {
    console.error("Erro ao salvar paciente:", result.error);
    throw result.error;
  }
}

  

  


async function deleteClientStorage(id) {
  const clients = await loadClients();
  const updated = clients.filter((client) => client.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
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
    await onSave(form);
    setSaving(false);
  };

  return (
    <form onSubmit={submit}>
      <Field label="Nome completo" required>
        <input className={inputClass} style={inputStyle} value={form.name} onChange={set("name")} placeholder="Ex: Marina Alves" required />
      </Field>
      <div className="grid grid-cols-2 gap-3">
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
      <div className="grid grid-cols-2 gap-3">
        <Field label="Telefone">
          <input className={inputClass} style={inputStyle} value={form.phone} onChange={set("phone")} placeholder="(79) 99999-9999" />
        </Field>
        <Field label="E-mail">
          <input type="email" className={inputClass} style={inputStyle} value={form.email} onChange={set("email")} placeholder="cliente@email.com" />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
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
    await onSave(form);
    setSaving(false);
  };

  return (
    <form onSubmit={submit}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Data" required>
          <input type="date" className={inputClass} style={inputStyle} value={form.date} onChange={set("date")} required />
        </Field>
        <Field label="Peso (kg)" required>
          <input type="number" step="0.1" className={inputClass} style={inputStyle} value={form.weight} onChange={set("weight")} placeholder="70.2" required />
        </Field>
      </div>
      <div className="grid grid-cols-3 gap-3">
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
      <div className="grid grid-cols-3 gap-3">
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
  const [showEntryForm, setShowEntryForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [confirmDeleteClient, setConfirmDeleteClient] = useState(false);
  const [confirmDeleteEntry, setConfirmDeleteEntry] = useState(null);
  const [showAvaliacaoForm, setShowAvaliacaoForm] = useState(false);
  const [avaliacoes, setAvaliacoes] = useState([]);
  const [loadingAvaliacoes, setLoadingAvaliacoes] = useState(false);

  const [avaliacao, setAvaliacao] = useState({
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

    const dadosAvaliacao = {
      paciente_id: client.id,

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
soma_pregas: somaPregas,
    };

    const { error } = await supabase
      .from("avaliacoes")
      .insert(dadosAvaliacao);

    if (error) {
      console.error("Erro ao salvar avaliação:", error);
      alert("Não foi possível salvar a avaliação.");
      return;
    }

    await carregarAvaliacoes();
    alert("Avaliação salva com sucesso!");  
    

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

    setShowAvaliacaoForm(false);
  } catch (error) {
    console.error(error);
    alert("Ocorreu um erro ao salvar a avaliação.");
  }
};
{/* Histórico de avaliações */}
<div
  className="mt-6 rounded-xl p-5"
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
    <p
      className="text-sm"
      style={{ color: "var(--sage-dark)" }}
    >
      Nenhuma avaliação registrada ainda.
    </p>
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
          <div className="flex items-center justify-between gap-4 mb-3">
            <strong style={{ color: "var(--forest)" }}>
              Avaliação de {fmtDate(item.data_avaliacao)}
            </strong>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
          </div>
        </div>
      ))}
    </div>
  )}
</div>
  const entries = sortedEntries(client);
  const cw = currentWeight(client);
  const bmi = calcBMI(cw, client.height);
  const cat = bmiCategory(bmi);
  const pct = progressPercent(client);
  const age = calcAge(client.birthDate);
  const weightChange = client.initialWeight ? cw - parseFloat(client.initialWeight) : null;

  const gerarPDF = async () => {
  const elemento = document.getElementById("relatorio-paciente");

  if (!elemento) {
    alert("Não foi possível encontrar o relatório.");
    return;
  }

  try {
    const canvas = await html2canvas(elemento, {
      scale: 2,
      backgroundColor: "#EDEFE7",
      useCORS: true,
      logging: false,
    });

    const imagem = canvas.toDataURL("image/png");

    const pdf = new jsPDF("p", "mm", "a4");

    const larguraPagina = 210;
    const alturaPagina = 297;
    const margem = 12;
    const larguraConteudo = larguraPagina - margem * 2;

    // =========================
    // CABEÇALHO
    // =========================

    pdf.setFillColor(47, 75, 60);
    pdf.rect(0, 0, larguraPagina, 32, "F");

    pdf.setTextColor(255, 255, 255);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(22);
    pdf.text("NutriTrack", margem, 14);

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.text("Relatório de Avaliação Nutricional", margem, 21);

    pdf.setFontSize(8);
    pdf.text(
      `Gerado em ${new Date().toLocaleDateString("pt-BR")}`,
      larguraPagina - margem,
      14,
      { align: "right" }
    );

    // =========================
    // DADOS DO PACIENTE
    // =========================

    let y = 43;

    pdf.setTextColor(34, 48, 31);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(14);
    pdf.text("Dados do paciente", margem, y);

    y += 8;

    pdf.setFillColor(245, 247, 242);
    pdf.roundedRect(
      margem,
      y,
      larguraConteudo,
      28,
      3,
      3,
      "F"
    );

    pdf.setFontSize(10);
    pdf.setTextColor(34, 48, 31);

    pdf.setFont("helvetica", "bold");
    pdf.text("Paciente:", margem + 5, y + 8);

    pdf.setFont("helvetica", "normal");
    pdf.text(
      client.name || "Não informado",
      margem + 28,
      y + 8
    );

    pdf.setFont("helvetica", "bold");
    pdf.text("Data de nascimento:", margem + 5, y + 17);

    pdf.setFont("helvetica", "normal");
    pdf.text(
      client.birthDate
        ? new Date(client.birthDate + "T00:00:00").toLocaleDateString("pt-BR")
        : "Não informado",
      margem + 43,
      y + 17
    );

    pdf.setFont("helvetica", "bold");
    pdf.text("Idade:", 125, y + 17);

    pdf.setFont("helvetica", "normal");
    pdf.text(
      age ? `${age} anos` : "Não informado",
      138,
      y + 17
    );

    y += 38;

    // =========================
    // RESUMO DA AVALIAÇÃO
    // =========================

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(14);
    pdf.setTextColor(34, 48, 31);
    pdf.text("Resumo da avaliação", margem, y);

    y += 7;

    const cards = [
      {
        titulo: "Peso atual",
        valor: cw ? `${parseFloat(cw).toFixed(1)} kg` : "—",
      },
      {
        titulo: "Altura",
        valor: client.height ? `${client.height} cm` : "—",
      },
      {
        titulo: "IMC",
        valor: bmi ? bmi.toFixed(1) : "—",
      },
      {
        titulo: "Meta",
        valor: client.goalWeight
          ? `${client.goalWeight} kg`
          : "—",
      },
    ];

    const espaco = 3;
    const larguraCard =
      (larguraConteudo - espaco * 3) / 4;

    cards.forEach((card, index) => {
      const x =
        margem + index * (larguraCard + espaco);

      pdf.setFillColor(245, 247, 242);
      pdf.roundedRect(
        x,
        y,
        larguraCard,
        25,
        3,
        3,
        "F"
      );

      pdf.setTextColor(108, 125, 100);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8);
      pdf.text(card.titulo, x + 4, y + 8);

      pdf.setTextColor(47, 75, 60);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(13);
      pdf.text(card.valor, x + 4, y + 18);
    });

    y += 33;

    // =========================
    // CLASSIFICAÇÃO DO IMC
    // =========================

    pdf.setFillColor(233, 238, 226);
    pdf.roundedRect(
      margem,
      y,
      larguraConteudo,
      17,
      3,
      3,
      "F"
    );

    pdf.setTextColor(34, 48, 31);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    pdf.text("Classificação do IMC", margem + 5, y + 7);

    pdf.setFont("helvetica", "normal");
    pdf.text(
      cat.label || "Não informado",
      margem + 45,
      y + 7
    );

    if (weightChange != null) {
      pdf.setFont("helvetica", "bold");
      pdf.text("Variação de peso:", margem + 5, y + 13);

      pdf.setFont("helvetica", "normal");
      pdf.text(
        `${weightChange >= 0 ? "+" : ""}${weightChange.toFixed(1)} kg`,
        margem + 40,
        y + 13
      );
    }

    y += 25;

    // =========================
    // GRÁFICO
    // =========================

    pdf.setTextColor(34, 48, 31);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(14);
    pdf.text("Evolução do peso", margem, y);

    y += 5;

    const larguraImagem = larguraConteudo;
    const alturaImagem =
      (canvas.height * larguraImagem) / canvas.width;

    const alturaDisponivel =
      alturaPagina - y - 20;

    if (alturaImagem <= alturaDisponivel) {
      pdf.addImage(
        imagem,
        "PNG",
        margem,
        y,
        larguraImagem,
        alturaImagem
      );
    } else {
      const alturaReduzida = alturaDisponivel;

      pdf.addImage(
        imagem,
        "PNG",
        margem,
        y,
        larguraImagem,
        alturaReduzida
      );
    }

    // =========================
    // RODAPÉ
    // =========================

    pdf.setDrawColor(199, 210, 191);
    pdf.line(
      margem,
      alturaPagina - 14,
      larguraPagina - margem,
      alturaPagina - 14
    );

    pdf.setTextColor(108, 125, 100);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7);

    pdf.text(
      "NutriTrack • Relatório de Avaliação Nutricional",
      margem,
      alturaPagina - 8
    );

    pdf.text(
      "Documento gerado pelo sistema",
      larguraPagina - margem,
      alturaPagina - 8,
      { align: "right" }
    );

    // =========================
    // SALVAR
    // =========================

    const nomeArquivo = (client.name || "paciente")
      .replace(/[^a-zA-Z0-9À-ÿ ]/g, "")
      .replace(/\s+/g, "-");

    pdf.save(`relatorio-nutritrack-${nomeArquivo}.pdf`);
  } catch (error) {
    console.error("Erro ao gerar PDF:", error);
    alert("Ocorreu um erro ao gerar o PDF.");
  }
};

  const chartData = entries.map((e) => ({
    date: e.date,
    label: fmtDateShort(e.date),
    weight: parseFloat(e.weight),
  }));

  const addOrEditEntry = async (data) => {
    let newEntries;
    if (editingEntry) {
      newEntries = client.entries.map((e) => (e.id === editingEntry.id ? { ...data, id: e.id } : e));
    } else {
      newEntries = [...(client.entries || []), { ...data, id: genId() }];
    }
    await onUpdate({ ...client, entries: newEntries });
    setShowEntryForm(false);
    setEditingEntry(null);
  };

  const removeEntry = async (id) => {
    const newEntries = client.entries.filter((e) => e.id !== id);
    await onUpdate({ ...client, entries: newEntries });
    setConfirmDeleteEntry(null);
  };

  return (
    <div id="relatorio-paciente" className="flex-1 overflow-y-auto">
      {/* Header */}
      <div className="px-8 pt-8 pb-6" style={{ borderBottom: "1px solid var(--sage)" }}>
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
      <div className="px-8 py-6 grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={Scale} label="Peso atual" value={cw ? `${parseFloat(cw).toFixed(1)} kg` : "—"}
          sub={weightChange != null ? `${weightChange >= 0 ? "+" : ""}${weightChange.toFixed(1)} kg desde o início` : null}
          accent={weightChange != null ? (weightChange < 0 ? "var(--forest)" : weightChange > 0 ? "var(--gold)" : undefined) : undefined}
        />
        <StatCard icon={Ruler} label="Altura" value={client.height ? `${client.height} cm` : "—"} />
        <StatCard icon={TrendingUp} label="IMC" value={bmi ? bmi.toFixed(1) : "—"} sub={cat.label} accent={cat.color} />
        <StatCard icon={Target} label="Meta" value={client.goalWeight ? `${client.goalWeight} kg` : "—"}
          sub={pct != null ? `${Math.round(pct)}% do caminho` : null} />
      </div>

      {/* Chart */}
      <div className="px-8 pb-6">
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
      onClick={() => setShowAvaliacaoForm(true)}
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
<div className="px-8 pb-6">
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
            <div className="mb-3">
              <strong style={{ color: "var(--forest)" }}>
                Avaliação de {fmtDate(item.data_avaliacao)}
              </strong>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">

              <div>
                <p
                  className="text-xs"
                  style={{ color: "var(--sage-dark)" }}
                >
                  Peso
                </p>
                <p className="font-semibold">
                  {item.peso != null
                    ? `${item.peso} kg`
                    : "—"}
                </p>
              </div>

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

            </div>
          </div>
        ))}
      </div>
    )}
  </div>
</div>
      {/* History */}
      <div className="px-8 pb-10">
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

/* ---------------------------------------------------------
   Main app
--------------------------------------------------------- */
export default function NutriTrackApp() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [showCadastro, setShowCadastro] = useState(false);

const [nutricionista, setNutricionista] = useState({
  nome: "",
  email: "",
  senha: "",
  confirmarSenha: "",
});
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [search, setSearch] = useState("");
  const [showClientForm, setShowClientForm] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [saveError, setSaveError] = useState(null);
  
  const handleLogin = async () => {
  const email = document.querySelector('input[type="email"]').value;
  const senha = document.querySelector('input[type="password"]').value;

  if (!email || !senha) {
    alert("Preencha o e-mail e a senha.");
    return;
  }

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password: senha,
  });

  

  if (error) {
    alert("E-mail ou senha incorretos.");
    return;
  }

  setLoggedIn(true);
};

const handleLogout = async () => {
  await supabase.auth.signOut();
  setLoggedIn(false);
};

const gerarPDF = async () => {
  const elemento = document.getElementById("relatorio-paciente");

  if (!elemento) {
    alert("Não foi possível encontrar o relatório.");
    return;
  }

  const canvas = await html2canvas(elemento, {
    scale: 2,
    backgroundColor: "#EDEFE7",
    useCORS: true,
  });

  const imagem = canvas.toDataURL("image/png");

  const pdf = new jsPDF("p", "mm", "a4");

  const larguraPDF = 190;
  const alturaPDF = (canvas.height * larguraPDF) / canvas.width;

  pdf.addImage(
    imagem,
    "PNG",
    10,
    10,
    larguraPDF,
    alturaPDF
  );

  pdf.save("relatorio-nutritrack.pdf");
};

  useEffect(() => {
    (async () => {
      try {
        const data = await loadClients();
        data.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
        setClients(data);
      } catch (e) {
        setLoadError(true);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
  const verificarSessao = async () => {
    const { data } = await supabase.auth.getSession();

    if (data.session) {
      setLoggedIn(true);
    } else {
      setLoggedIn(false);
    }
  };

  verificarSessao();
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
        const updated = { ...editingClient, ...formData };
        await saveClient(updated);
        setClients((cs) => cs.map((c) => (c.id === updated.id ? updated : c)).sort((a, b) => a.name.localeCompare(b.name, "pt-BR")));
      } else {
        const newClient = { ...formData, id: genId(), entries: [], createdAt: new Date().toISOString() };
        await saveClient(newClient);
        setClients((cs) => [...cs, newClient].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")));
        setSelectedId(newClient.id);
      }
      setShowClientForm(false);
      setEditingClient(null);
    } catch (e) {
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

  if (!loggedIn) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg)] p-6">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg">
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



  return (
    <div
      className="flex h-full w-full overflow-hidden rounded-xl"
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
      <div className="w-[300px] shrink-0 flex flex-col" style={{ background: "var(--paper)", borderRight: "1px solid var(--sage)" }}>
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
