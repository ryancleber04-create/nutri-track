// Dados de identificação usados na Política de Privacidade e nos pedidos de titulares.
// Defina no .env.local (veja .env.example). Enquanto não preenchidos, aparece um marcador [ENTRE COLCHETES].
export const CONTROLADOR = {
  nome: import.meta.env.VITE_CONTROLADOR_NOME || "[NOME DO RESPONSÁVEL PELA PLATAFORMA]",
  documento: import.meta.env.VITE_CONTROLADOR_DOCUMENTO || "[CNPJ/CPF]",
  contato: import.meta.env.VITE_CONTATO_PRIVACIDADE || "[E-MAIL DO ENCARREGADO / CONTATO DE PRIVACIDADE]",
  regiaoDados: import.meta.env.VITE_REGIAO_DADOS || "[REGIÃO DO SERVIDOR, ex.: São Paulo (Brasil)]",
};
