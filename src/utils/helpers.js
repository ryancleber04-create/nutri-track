/* ---------------------------------------------------------
   Helpers
--------------------------------------------------------- */
export const genId = () => crypto.randomUUID();

export const fmtDate = (iso) => {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};

export const fmtDateShort = (iso) => {
  if (!iso) return "";
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
};

export const calcAge = (birthDate) => {
  if (!birthDate) return null;
  const b = new Date(birthDate + "T00:00:00");
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  const monthDiff = now.getMonth() - b.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < b.getDate())) age--;
  return age;
};

export const calcBMI = (weightKg, heightCm) => {
  if (!weightKg || !heightCm) return null;
  const h = heightCm / 100;
  return weightKg / (h * h);
};

export const bmiCategory = (bmi) => {
  if (bmi == null) return { label: "—", color: "var(--sage-dark)" };
  if (bmi < 18.5) return { label: "Abaixo do peso", color: "var(--gold)" };
  if (bmi < 25) return { label: "Peso normal", color: "var(--forest)" };
  if (bmi < 30) return { label: "Sobrepeso", color: "var(--gold)" };
  if (bmi < 35) return { label: "Obesidade grau I", color: "var(--berry)" };
  if (bmi < 40) return { label: "Obesidade grau II", color: "var(--berry)" };
  return { label: "Obesidade grau III", color: "var(--berry)" };
};

export const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

export const sortedEntries = (client) =>
  [...(client.entries || [])].sort((a, b) => a.date.localeCompare(b.date));

export const latestEntry = (client) => {
  const e = sortedEntries(client);
  return e.length ? e[e.length - 1] : null;
};

export const currentWeight = (client) => {
  const le = latestEntry(client);
  return le ? le.weight : client.initialWeight;
};

export const progressPercent = (client) => {
  const goal = parseFloat(client.goalWeight);
  const start = parseFloat(client.initialWeight);
  const cur = parseFloat(currentWeight(client));
  if (!goal || !start || goal === start) return null;
  const total = goal - start;
  const done = cur - start;
  return clamp((done / total) * 100, 0, 100);
};

export function calcularIdade(dataNascimento) {
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
export function calcularJacksonPollock3({
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
