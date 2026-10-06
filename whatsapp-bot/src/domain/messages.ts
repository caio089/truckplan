import {
  formatCurrency,
  formatLiters,
  getFreightFieldLabel,
  type FreightParseError,
  type FreightReport
} from './freight-report.js';

export const MENU_MESSAGE = `🚛 CONTROLE DE FRETES

Escolha uma opção:

1️⃣ Cadastrar novo relatório
2️⃣ Consultar último relatório
0️⃣ Sair`;

export const NEW_REPORT_MESSAGE = `📝 NOVO RELATÓRIO

Envie os dados da viagem em texto livre, por exemplo:

Hoje Teresina pra Fortaleza, 2 diárias, 180 L de diesel por 1080, frete 4500, motorista João, caminhão Scania.

A IA monta o relatório e pede confirmação.`;

export const CANCEL_MESSAGE = `❌ Cadastro cancelado.

Nenhum dado foi salvo.

Digite "menu" para começar novamente.`;

export const EXIT_MESSAGE = `👋 Atendimento encerrado.

Digite "menu" quando precisar novamente.`;

export function confirmationMessage(report: FreightReport): string {
  return `📋 CONFIRME O RELATÓRIO

📍 Origem: ${report.cidade_origem}
🏁 Chegada: ${report.cidade_destino}
🏨 Diárias: ${report.diarias}
⛽ Óleo/Diesel: ${formatLiters(report.litros_oleo)} L
💰 Valor do óleo: ${formatCurrency(report.valor_oleo)}
💸 Custo adicional: ${formatCurrency(report.custo_adicional)}

Está tudo correto?

1️⃣ Confirmar
2️⃣ Cancelar`;
}

export function successMessage(report: FreightReport): string {
  return `✅ RELATÓRIO CADASTRADO COM SUCESSO!

📍 ${report.cidade_origem} → ${report.cidade_destino}
🏨 ${report.diarias} diárias
⛽ ${formatLiters(report.litros_oleo)} L
💰 Óleo: ${formatCurrency(report.valor_oleo)}
💸 Adicional: ${formatCurrency(report.custo_adicional)}

Digite "menu" quando precisar cadastrar outro.`;
}

export function lastReportMessage(report: FreightReport): string {
  return `📋 ÚLTIMO RELATÓRIO

📍 ${report.cidade_origem} → ${report.cidade_destino}
🏨 ${report.diarias} diárias
⛽ ${formatLiters(report.litros_oleo)} L
💰 Óleo: ${formatCurrency(report.valor_oleo)}
💸 Adicional: ${formatCurrency(report.custo_adicional)}

Digite "menu" para voltar.`;
}

export function validationMessage(errors: FreightParseError[]): string {
  const missing = errors
    .filter((error) => error.kind === 'missing' && error.field)
    .map((error) => getFreightFieldLabel(error.field!));

  if (missing.length) {
    const missingList = missing.join('\n');
    const additionalHelp = missing.includes('Custo adicional')
      ? `\n\nSe não houver custo adicional, coloque:\n\nCusto adicional: 0`
      : '';
    return `⚠️ Faltou uma informação:\n\n${missingList}\n\nEnvie novamente o relatório completo.${additionalHelp}`;
  }

  const invalid = errors.find((error) => error.kind === 'invalid');
  if (invalid?.field === 'diarias') {
    return `⚠️ O campo "Diárias" precisa ser um número inteiro.\n\nExemplo:\n\nDiárias: 2\n\nEnvie novamente o relatório completo.`;
  }
  if (invalid?.field) {
    const label = getFreightFieldLabel(invalid.field);
    return `⚠️ O campo "${label}" está inválido.\n\n${invalid.message}\n\nEnvie novamente o relatório completo.`;
  }

  const duplicate = errors.find((error) => error.kind === 'duplicate');
  if (duplicate) {
    return `⚠️ Há uma informação repetida.\n\n${duplicate.message}\n\nEnvie novamente o relatório completo.`;
  }

  return `⚠️ Não consegui entender o relatório.\n\nUse uma linha para cada informação e separe o nome do valor com dois-pontos (:).\n\nEnvie novamente o relatório completo.`;
}
