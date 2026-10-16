import { supabase } from "../supabase";

/* ---------------------------------------------------------
   Storage layer
--------------------------------------------------------- */
// Os dados ficam no Supabase; o acesso é restringido por RLS (veja supabase/lgpd_e_seguranca.sql).

export async function loadClients() {
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


    if (!user) {
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
      auth_user_id: paciente.auth_user_id || null,
    }));
  } catch (error) {
    console.error("Erro dentro de loadClients:", error);
    throw error;
  }
}

export async function saveClient(client) {
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
      .eq("nutricionista_id", user.id)
      .select();
  } else {
    result = await supabase
      .from("pacientes")
      .insert([paciente])
      .select();


  }

if (result.error) {
  console.error("ERRO SUPABASE:", result.error);
  throw result.error;
}


return result.data;
}

  

  


export async function deleteClientStorage(id) {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error("Usuário não autenticado.");
  }


  const { data, error } = await supabase
    .from("pacientes")
    .delete()
    .eq("id", id)
    .eq("nutricionista_id", user.id)
    .select();


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
