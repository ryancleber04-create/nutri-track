# NutriTrack

Acompanhamento nutricional para nutricionistas e pacientes. React 19 + Vite + Tailwind 4 + Supabase.

## Rodando

```bash
npm install
cp .env.example .env.local   # preencha as variáveis
npm run dev
```

Variáveis (`.env.local`, nunca versionado):

| Variável | Para quê |
|---|---|
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` | Conexão com o Supabase (chave **publishable** apenas) |
| `VITE_CONTROLADOR_NOME`, `VITE_CONTROLADOR_DOCUMENTO` | Quem opera a plataforma (aparece na Política de Privacidade) |
| `VITE_CONTATO_PRIVACIDADE` | E-mail do encarregado/contato; recebe os pedidos dos pacientes |
| `VITE_REGIAO_DADOS` | Região dos servidores do Supabase |

## Estrutura

```
src/
  App.jsx                 telas e fluxo principal
  components/             PlanoAlimentar
  lgpd/Lgpd.jsx           política, aceites, direitos do titular
  services/clientes.js    leitura/gravação de pacientes no Supabase
  utils/helpers.js        datas, IMC, idade, Jackson-Pollock 3 dobras
  ui/toast.jsx            avisos na tela (notify), no lugar de alert()
  config.js               identificação do controlador (LGPD)
supabase/lgpd_e_seguranca.sql
```

## LGPD: o que o app faz

- **Aceite no cadastro** do nutricionista (Termos + declaração de base legal) e **consentimento específico do paciente** no primeiro acesso (dados de saúde, art. 11).
- **Prova do aceite**: tabela `consentimentos` + metadados do usuário (versão e data).
- **Política de Privacidade e Termos de Uso** acessível no login, na área do nutricionista e na do paciente (`src/lgpd/Lgpd.jsx`).
- **Direitos do titular** na área do paciente: baixar os dados (JSON), pedir correção e pedir exclusão.
- **Sem dados de pacientes no console** do navegador (os `console.log` de depuração foram removidos).
- **Relatórios em PDF** com aviso de confidencialidade.
- **Encerramento automático da sessão** após 30 min sem atividade e limpeza dos dados da memória ao sair.

## Antes de ir para produção

1. Rode `supabase/lgpd_e_seguranca.sql` no Supabase, bloco a bloco. Os blocos 1 e 2 auditam o RLS.
2. Preencha as variáveis `VITE_CONTROLADOR_*` e revise o texto da política com um advogado (é um modelo).
3. Defina os prazos de retenção conforme seu conselho profissional (CFN) e escreva na Política (seção 6).
4. Configure cabeçalhos de segurança na hospedagem (CSP, HSTS, `X-Content-Type-Options`).
5. Hospede as fontes (Fraunces/Inter/IBM Plex) localmente em vez de usar o Google Fonts.
6. Tenha um plano de resposta a incidentes (comunicação à ANPD, art. 48).

## Observações

- O cadastro funciona com ou sem confirmação de e-mail ativa no Supabase: com confirmação, o perfil do nutricionista é criado no primeiro login.
- Classificação de IMC é a de adultos; para menores de 18 anos e idosos use curvas/pontos de corte específicos.
- As confirmações de exclusão ainda usam `window.confirm`, de propósito (ação destrutiva).
