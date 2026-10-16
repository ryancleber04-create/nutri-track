-- =====================================================================
-- NutriTrack: LGPD e segurança no Supabase
-- Rode no SQL Editor do Supabase, DE CIMA PARA BAIXO, lendo cada bloco.
-- Os blocos 1 e 2 só consultam. Os blocos 3 e 4 alteram o banco.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) AUDITORIA: todas as tabelas devem estar com RLS ligado (rowsecurity = true).
--    Dados de saúde sem RLS ficam legíveis por qualquer pessoa com a chave publishable.
-- ---------------------------------------------------------------------
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
order by rowsecurity, tablename;

-- Se alguma tabela aparecer com false, ligue (e crie policies ANTES, senão o app perde acesso):
-- alter table public.NOME_DA_TABELA enable row level security;

-- ---------------------------------------------------------------------
-- 2) AUDITORIA: revise as policies existentes.
--    Procure: using (true), roles {public} / {anon}, e tabelas sem policy de DELETE/UPDATE coerente.
--    Esperado: nutricionista só acessa linhas com nutricionista_id = auth.uid();
--              paciente só lê as próprias linhas (via pacientes.auth_user_id = auth.uid()).
-- ---------------------------------------------------------------------
select tablename, policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public'
order by tablename, cmd, policyname;

-- Tabelas que dependem de pacientes: o que acontece ao apagar um paciente?
-- confdeltype: 'c' = apaga em cascata, 'a'/'r' = bloqueia, 'n' = mantém órfão
select conrelid::regclass as tabela, conname, confdeltype
from pg_constraint
where confrelid = 'public.pacientes'::regclass
order by 1;

-- ---------------------------------------------------------------------
-- 3) PROVA DE CONSENTIMENTO (usada por registrarConsentimento() no app)
--    Só o próprio usuário insere e lê os seus registros. Não há UPDATE/DELETE:
--    o histórico de aceites fica preservado (revogação = novo pedido ao contato de privacidade).
-- ---------------------------------------------------------------------
create table if not exists public.consentimentos (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  tipo       text not null,   -- 'nutricionista_termos' | 'paciente_dados_saude'
  versao     text not null,   -- versão da política aceita
  aceito_em  timestamptz not null default now()
);

alter table public.consentimentos enable row level security;

drop policy if exists "consentimentos_insert_proprio" on public.consentimentos;
create policy "consentimentos_insert_proprio"
  on public.consentimentos for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "consentimentos_select_proprio" on public.consentimentos;
create policy "consentimentos_select_proprio"
  on public.consentimentos for select to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- 4) OPCIONAL, mas recomendado: eliminação completa (art. 18, VI)
--    Hoje, ao excluir um paciente no app, só a linha de "pacientes" é apagada;
--    o LOGIN do paciente (e-mail em auth.users) continua existindo.
--    Este gatilho apaga também a conta de acesso. REVISE antes de rodar:
--    - confirme no bloco 2 que as tabelas filhas (medicoes, avaliacoes, planos...) apagam em cascata;
--    - teste primeiro com um paciente fictício.
-- ---------------------------------------------------------------------
create or replace function public.apagar_conta_auth_do_paciente()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if old.auth_user_id is not null then
    delete from auth.users where id = old.auth_user_id;
  end if;
  return old;
end;
$$;

drop trigger if exists trg_apagar_conta_auth_paciente on public.pacientes;
create trigger trg_apagar_conta_auth_paciente
  after delete on public.pacientes
  for each row execute function public.apagar_conta_auth_do_paciente();
