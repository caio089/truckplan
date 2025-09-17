// ========== DASHBOARD SIMPLIFICADO ==========

console.log('Dashboard simples carregado');

// Configurar datas padrão (sem carregar dados)
document.addEventListener('DOMContentLoaded', function() {
    const hoje = new Date();
    const ontem = new Date(hoje);
    ontem.setDate(hoje.getDate() - 1);
    
    document.getElementById('dataInicial').value = ontem.toISOString().split('T')[0];
    document.getElementById('dataFinal').value = hoje.toISOString().split('T')[0];
    
    // NÃO carregar resumo automaticamente para manter sistema limpo
    // carregarResumoSemanal(); // Removido para evitar recarregamento
});

// Alternar entre resumo semanal e mensal
function alternarResumo(tipo) {
    const btnSemanal = document.getElementById('btnSemanal');
    const btnMensal = document.getElementById('btnMensal');
    const resumoSemanal = document.getElementById('resumoSemanal');
    const resumoMensal = document.getElementById('resumoMensal');
    
    if (tipo === 'semanal') {
        btnSemanal.className = 'px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold transition-all duration-300';
        btnMensal.className = 'px-4 py-2 bg-gray-600 text-white rounded-lg font-semibold transition-all duration-300';
        resumoSemanal.classList.remove('hidden');
        resumoMensal.classList.add('hidden');
        carregarResumoSemanal();
    } else {
        btnSemanal.className = 'px-4 py-2 bg-gray-600 text-white rounded-lg font-semibold transition-all duration-300';
        btnMensal.className = 'px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold transition-all duration-300';
        resumoSemanal.classList.add('hidden');
        resumoMensal.classList.remove('hidden');
        carregarResumoMensal();
    }
}

// Carregar resumo semanal com dados reais
function carregarResumoSemanal() {
    const hoje = new Date();
    const inicioSemana = new Date(hoje);
    inicioSemana.setDate(hoje.getDate() - hoje.getDay());
    const fimSemana = new Date(inicioSemana);
    fimSemana.setDate(inicioSemana.getDate() + 6);
    
    // Buscar relatórios reais da semana
    const relatoriosSalvos = JSON.parse(localStorage.getItem('truckReports')) || [];
    const relatoriosSemana = relatoriosSalvos.filter(relatorio => {
        const dataRelatorio = new Date(relatorio.date);
        return dataRelatorio >= inicioSemana && dataRelatorio <= fimSemana;
    });
    
    // Calcular totais reais
    const totalGastoGasolina = relatoriosSemana.reduce((sum, r) => sum + (r.valorGasolina || 0), 0);
    const totalValorDiarias = relatoriosSemana.reduce((sum, r) => sum + (r.totalDiarias || 0), 0);
    const totalReceita = relatoriosSemana.reduce((sum, r) => sum + (r.receita || 0), 0);
    const totalCustosGerais = relatoriosSemana.reduce((sum, r) => sum + (r.totalCustosGerais || 0), 0);
    const lucro = totalReceita - totalGastoGasolina - totalValorDiarias - totalCustosGerais;
    
    const dados = {
        totalGastoGasolina,
        totalValorDiarias,
        totalReceita,
        lucro
    };
    
    atualizarResumoSemanal(dados);
}

// Carregar resumo mensal com dados reais
function carregarResumoMensal() {
    const hoje = new Date();
    const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
    
    // Buscar relatórios reais do mês
    const relatoriosSalvos = JSON.parse(localStorage.getItem('truckReports')) || [];
    const relatoriosMes = relatoriosSalvos.filter(relatorio => {
        const dataRelatorio = new Date(relatorio.date);
        return dataRelatorio >= inicioMes && dataRelatorio <= fimMes;
    });
    
    // Calcular totais reais
    const totalGastoGasolina = relatoriosMes.reduce((sum, r) => sum + (r.valorGasolina || 0), 0);
    const totalValorDiarias = relatoriosMes.reduce((sum, r) => sum + (r.totalDiarias || 0), 0);
    const totalReceita = relatoriosMes.reduce((sum, r) => sum + (r.receita || 0), 0);
    const totalCustosGerais = relatoriosMes.reduce((sum, r) => sum + (r.totalCustosGerais || 0), 0);
    const lucro = totalReceita - totalGastoGasolina - totalValorDiarias - totalCustosGerais;
    
    const dados = {
        totalGastoGasolina,
        totalValorDiarias,
        totalReceita,
        lucro
    };
    
    atualizarResumoMensal(dados);
}

// Atualizar resumo semanal com dados reais
function atualizarResumoSemanal(dados) {
    const totalGastos = dados.totalGastoGasolina + (dados.totalValorDiarias || 0);
    const totalReceitas = dados.totalReceita || 0;
    const lucroLiquido = totalReceitas - totalGastos;
    const mediaDiaria = lucroLiquido / 7; // 7 dias da semana
    
    const totalGastosElement = document.getElementById('totalGastosSemanal');
    const totalReceitasElement = document.getElementById('totalReceitasSemanal');
    const lucroLiquidoElement = document.getElementById('lucroLiquidoSemanal');
    const mediaDiariaElement = document.getElementById('mediaDiariaSemanal');
    
    if (totalGastosElement) totalGastosElement.textContent = `R$ ${totalGastos.toFixed(2)}`;
    if (totalReceitasElement) totalReceitasElement.textContent = `R$ ${totalReceitas.toFixed(2)}`;
    if (lucroLiquidoElement) {
        lucroLiquidoElement.textContent = `R$ ${lucroLiquido.toFixed(2)}`;
        lucroLiquidoElement.className = lucroLiquido >= 0 ? 'text-3xl font-bold text-green-300' : 'text-3xl font-bold text-red-300';
    }
    if (mediaDiariaElement) mediaDiariaElement.textContent = `R$ ${mediaDiaria.toFixed(2)}`;
}

// Atualizar resumo mensal com dados reais
function atualizarResumoMensal(dados) {
    const totalGastos = dados.totalGastoGasolina + (dados.totalValorDiarias || 0);
    const totalReceitas = dados.totalReceita || 0;
    const lucroLiquido = totalReceitas - totalGastos;
    const diasNoMes = new Date().getDate();
    const mediaDiaria = lucroLiquido / diasNoMes;
    
    const totalGastosElement = document.getElementById('totalGastosMensal');
    const totalReceitasElement = document.getElementById('totalReceitasMensal');
    const lucroLiquidoElement = document.getElementById('lucroLiquidoMensal');
    const mediaDiariaElement = document.getElementById('mediaDiariaMensal');
    
    if (totalGastosElement) totalGastosElement.textContent = `R$ ${totalGastos.toFixed(2)}`;
    if (totalReceitasElement) totalReceitasElement.textContent = `R$ ${totalReceitas.toFixed(2)}`;
    if (lucroLiquidoElement) {
        lucroLiquidoElement.textContent = `R$ ${lucroLiquido.toFixed(2)}`;
        lucroLiquidoElement.className = lucroLiquido >= 0 ? 'text-3xl font-bold text-green-300' : 'text-3xl font-bold text-red-300';
    }
    if (mediaDiariaElement) mediaDiariaElement.textContent = `R$ ${mediaDiaria.toFixed(2)}`;
}

// Buscar relatórios reais por data
function buscarRelatoriosPorData() {
    const dataInicial = document.getElementById('dataInicial').value;
    const dataFinal = document.getElementById('dataFinal').value;
    
    if (!dataInicial || !dataFinal) {
        alert('Por favor, selecione as datas inicial e final.');
        return;
    }
    
    if (new Date(dataInicial) > new Date(dataFinal)) {
        alert('A data inicial deve ser anterior à data final.');
        return;
    }
    
    console.log('Buscando relatórios reais de', dataInicial, 'até', dataFinal);
    
    // Buscar relatórios reais do localStorage
    const relatoriosSalvos = JSON.parse(localStorage.getItem('truckReports')) || [];
    
    // Filtrar relatórios por período
    const relatoriosFiltrados = relatoriosSalvos.filter(relatorio => {
        const dataRelatorio = new Date(relatorio.date);
        const dataIni = new Date(dataInicial);
        const dataFim = new Date(dataFinal);
        return dataRelatorio >= dataIni && dataRelatorio <= dataFim;
    });
    
    // Mostrar resultados reais
    mostrarResultadosReais(relatoriosFiltrados, dataInicial, dataFinal);
}

// Mostrar relatórios de hoje
function mostrarRelatoriosHoje() {
    const hoje = new Date().toISOString().split('T')[0];
    document.getElementById('dataInicial').value = hoje;
    document.getElementById('dataFinal').value = hoje;
    buscarRelatoriosPorData();
}

// Mostrar relatórios da semana
function mostrarRelatoriosSemana() {
    const hoje = new Date();
    const inicioSemana = new Date(hoje);
    inicioSemana.setDate(hoje.getDate() - hoje.getDay());
    const fimSemana = new Date(inicioSemana);
    fimSemana.setDate(inicioSemana.getDate() + 6);
    
    document.getElementById('dataInicial').value = inicioSemana.toISOString().split('T')[0];
    document.getElementById('dataFinal').value = fimSemana.toISOString().split('T')[0];
    buscarRelatoriosPorData();
}

// Mostrar relatórios do mês
function mostrarRelatoriosMes() {
    const hoje = new Date();
    const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
    
    document.getElementById('dataInicial').value = inicioMes.toISOString().split('T')[0];
    document.getElementById('dataFinal').value = fimMes.toISOString().split('T')[0];
    buscarRelatoriosPorData();
}

// Função removida - não mais necessária

// Mostrar resultados reais
function mostrarResultadosReais(relatorios, dataInicial, dataFinal) {
    const resultadosDiv = document.getElementById('resultadosBusca');
    const resumoDiv = document.getElementById('resumoResultados');
    const tabelaDiv = document.getElementById('tabelaResultados');
    
    // Mostrar seção de resultados
    resultadosDiv.classList.remove('hidden');
    
    if (relatorios.length === 0) {
        // Mostrar mensagem de vazio
        resumoDiv.innerHTML = `
            <div class="bg-gradient-to-r from-gray-600 to-gray-700 rounded-2xl p-6 text-white">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-gray-100 text-sm font-medium">Nenhum Relatório</p>
                        <p class="text-3xl font-bold">0</p>
                    </div>
                    <div class="text-4xl opacity-80">📊</div>
                </div>
            </div>
        `;
        
        tabelaDiv.innerHTML = `
            <div class="bg-gray-800/30 rounded-xl overflow-hidden">
                <div class="px-6 py-4 border-b border-gray-700/50">
                    <h4 class="text-lg font-semibold text-white">Relatórios do Período: ${dataInicial} até ${dataFinal}</h4>
                </div>
                <div class="p-8 text-center">
                    <div class="text-6xl mb-4">📊</div>
                    <h3 class="text-xl font-semibold text-white mb-2">Nenhum relatório encontrado</h3>
                    <p class="text-gray-400">Não há relatórios para o período selecionado.</p>
                    <p class="text-gray-500 text-sm mt-2">Crie um novo relatório para começar a acompanhar suas viagens.</p>
                </div>
            </div>
        `;
        return;
    }
    
    // Calcular totais dos relatórios reais
    const totalViagens = relatorios.length;
    const totalDiarias = relatorios.reduce((sum, r) => sum + (r.quantidadeDiarias || 0), 0);
    const totalValorDiarias = relatorios.reduce((sum, r) => sum + (r.totalDiarias || 0), 0);
    const totalLitros = relatorios.reduce((sum, r) => sum + (r.litrosGasolina || 0), 0);
    const totalGastoGasolina = relatorios.reduce((sum, r) => sum + (r.valorGasolina || 0), 0);
    const totalReceita = relatorios.reduce((sum, r) => sum + (r.receita || 0), 0);
    const totalCustosGerais = relatorios.reduce((sum, r) => sum + (r.totalCustosGerais || 0), 0);
    const lucroTotal = totalReceita - totalGastoGasolina - totalValorDiarias - totalCustosGerais;
    
    // Atualizar resumo
    resumoDiv.innerHTML = `
        <div class="bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl p-6 text-white">
            <div class="flex items-center justify-between">
                <div>
                    <p class="text-blue-100 text-sm font-medium">Total de Viagens</p>
                    <p class="text-3xl font-bold">${totalViagens}</p>
                </div>
                <div class="text-4xl opacity-80">🚛</div>
            </div>
        </div>
        
        <div class="bg-gradient-to-r from-green-600 to-green-700 rounded-2xl p-6 text-white">
            <div class="flex items-center justify-between">
                <div>
                    <p class="text-green-100 text-sm font-medium">Total de Diárias</p>
                    <p class="text-3xl font-bold">${totalDiarias}</p>
                    <p class="text-sm opacity-80">R$ ${totalValorDiarias.toFixed(2)}</p>
                </div>
                <div class="text-4xl opacity-80">📅</div>
            </div>
        </div>
        
        <div class="bg-gradient-to-r from-red-600 to-red-700 rounded-2xl p-6 text-white">
            <div class="flex items-center justify-between">
                <div>
                    <p class="text-red-100 text-sm font-medium">Gasolina</p>
                    <p class="text-3xl font-bold">${totalLitros.toFixed(1)}L</p>
                    <p class="text-sm opacity-80">R$ ${totalGastoGasolina.toFixed(2)}</p>
                </div>
                <div class="text-4xl opacity-80">⛽</div>
            </div>
        </div>
        
        <div class="bg-gradient-to-r from-purple-600 to-purple-700 rounded-2xl p-6 text-white">
            <div class="flex items-center justify-between">
                <div>
                    <p class="text-purple-100 text-sm font-medium">Lucro Total</p>
                    <p class="text-3xl font-bold">R$ ${lucroTotal.toFixed(2)}</p>
                </div>
                <div class="text-4xl opacity-80">💰</div>
            </div>
        </div>
    `;
    
    // Atualizar tabela com relatórios reais
    tabelaDiv.innerHTML = `
        <div class="bg-gray-800/30 rounded-xl overflow-hidden">
            <div class="px-6 py-4 border-b border-gray-700/50">
                <h4 class="text-lg font-semibold text-white">Relatórios do Período: ${dataInicial} até ${dataFinal}</h4>
            </div>
            <div class="overflow-x-auto">
                <table class="w-full">
                    <thead class="bg-gray-700/50">
                        <tr>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Data</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Motorista</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Caminhão</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Rota</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Diárias</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Gasolina</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Receita</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Lucro</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-700/50">
                        ${relatorios.map(relatorio => `
                            <tr class="hover:bg-gray-700/30 cursor-pointer" onclick="abrirModalDetalhes(${relatorio.id})">
                                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-300">${formatarData(relatorio.date)}</td>
                                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">${relatorio.nomeMotorista || 'N/A'}</td>
                                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-300">${relatorio.nomeCaminhao || 'N/A'}</td>
                                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-300">${relatorio.localPartida || 'N/A'} → ${relatorio.localChegada || 'N/A'}</td>
                                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-300">${relatorio.quantidadeDiarias || 0} (R$ ${(relatorio.totalDiarias || 0).toFixed(2)})</td>
                                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-300">${(relatorio.litrosGasolina || 0).toFixed(1)}L (R$ ${(relatorio.valorGasolina || 0).toFixed(2)})</td>
                                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-300">R$ ${(relatorio.receita || 0).toFixed(2)}</td>
                                <td class="px-6 py-4 whitespace-nowrap text-sm font-semibold ${(relatorio.lucroLiquido || 0) >= 0 ? 'text-green-400' : 'text-red-400'}">
                                    R$ ${(relatorio.lucroLiquido || 0).toFixed(2)}
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

// Função removida - não mais necessária para sistema limpo

// Função auxiliar para formatar data
function formatarData(data) {
    const date = new Date(data);
    return date.toLocaleDateString('pt-BR');
}

// Abrir modal de detalhes do relatório
function abrirModalDetalhes(relatorioId) {
    const relatoriosSalvos = JSON.parse(localStorage.getItem('truckReports')) || [];
    const relatorio = relatoriosSalvos.find(r => r.id === relatorioId);
    
    if (!relatorio) {
        alert('Relatório não encontrado!');
        return;
    }
    
    // Criar modal se não existir
    let modal = document.getElementById('modalDetalhesRelatorio');
    if (!modal) {
        modal = criarModalDetalhes();
        document.body.appendChild(modal);
    }
    
    // Armazenar ID do relatório no modal
    modal.dataset.relatorioId = relatorioId;
    
    // Preencher dados do relatório
    preencherModalDetalhes(relatorio);
    
    // Mostrar modal
    modal.classList.remove('hidden');
}

// Criar modal de detalhes
function criarModalDetalhes() {
    const modal = document.createElement('div');
    modal.id = 'modalDetalhesRelatorio';
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 hidden';
    
    modal.innerHTML = `
        <div class="bg-gray-800 rounded-2xl p-8 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div class="flex justify-between items-center mb-6">
                <h3 class="text-2xl font-bold text-white">Detalhes do Relatório</h3>
                <button onclick="fecharModalDetalhes()" class="text-gray-400 hover:text-white text-2xl">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            
            <div id="conteudoDetalhes" class="space-y-6">
                <!-- Conteúdo será preenchido dinamicamente -->
            </div>
            
            <div class="flex justify-end space-x-4 mt-8">
                <button onclick="fecharModalDetalhes()" class="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors">
                    Fechar
                </button>
                <button onclick="editarRelatorio()" class="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                    <i class="fas fa-edit mr-2"></i>Editar
                </button>
                <button onclick="excluirRelatorio()" class="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors">
                    <i class="fas fa-trash mr-2"></i>Excluir
                </button>
            </div>
        </div>
    `;
    
    return modal;
}

// Preencher modal com detalhes do relatório
function preencherModalDetalhes(relatorio) {
    const conteudo = document.getElementById('conteudoDetalhes');
    
    conteudo.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <!-- Informações Básicas -->
            <div class="bg-gray-700/50 rounded-xl p-6">
                <h4 class="text-lg font-semibold text-white mb-4">Informações Básicas</h4>
                <div class="space-y-3">
                    <div>
                        <span class="text-gray-300 text-sm">Data da Viagem:</span>
                        <p class="text-white font-medium">${formatarData(relatorio.date)}</p>
                    </div>
                    <div>
                        <span class="text-gray-300 text-sm">Motorista:</span>
                        <p class="text-white font-medium">${relatorio.nomeMotorista || 'N/A'}</p>
                    </div>
                    <div>
                        <span class="text-gray-300 text-sm">Caminhão:</span>
                        <p class="text-white font-medium">${relatorio.nomeCaminhao || 'N/A'}</p>
                    </div>
                    <div>
                        <span class="text-gray-300 text-sm">Rota:</span>
                        <p class="text-white font-medium">${relatorio.localPartida || 'N/A'} → ${relatorio.localChegada || 'N/A'}</p>
                    </div>
                </div>
            </div>
            
            <!-- Despesas -->
            <div class="bg-gray-700/50 rounded-xl p-6">
                <h4 class="text-lg font-semibold text-white mb-4">Despesas</h4>
                <div class="space-y-3">
                    <div class="flex justify-between">
                        <span class="text-gray-300 text-sm">Diárias (${relatorio.quantidadeDiarias || 0}):</span>
                        <span class="text-white font-medium">R$ ${(relatorio.totalDiarias || 0).toFixed(2)}</span>
                    </div>
                    <div class="flex justify-between">
                        <span class="text-gray-300 text-sm">Gasolina (${(relatorio.litrosGasolina || 0).toFixed(1)}L):</span>
                        <span class="text-white font-medium">R$ ${(relatorio.valorGasolina || 0).toFixed(2)}</span>
                    </div>
                    <div class="flex justify-between">
                        <span class="text-gray-300 text-sm">Custos Gerais:</span>
                        <span class="text-white font-medium">R$ ${(relatorio.totalCustosGerais || 0).toFixed(2)}</span>
                    </div>
                    <div class="flex justify-between border-t border-gray-600 pt-2">
                        <span class="text-gray-300 font-semibold">Total Despesas:</span>
                        <span class="text-white font-bold">R$ ${(relatorio.totalDespesas || 0).toFixed(2)}</span>
                    </div>
                </div>
            </div>
            
            <!-- Receita e Lucro -->
            <div class="bg-gray-700/50 rounded-xl p-6">
                <h4 class="text-lg font-semibold text-white mb-4">Receita e Lucro</h4>
                <div class="space-y-3">
                    <div class="flex justify-between">
                        <span class="text-gray-300 text-sm">Receita/Frete:</span>
                        <span class="text-white font-medium">R$ ${(relatorio.receita || 0).toFixed(2)}</span>
                    </div>
                    <div class="flex justify-between border-t border-gray-600 pt-2">
                        <span class="text-gray-300 font-semibold">Lucro Líquido:</span>
                        <span class="font-bold text-lg ${(relatorio.lucroLiquido || 0) >= 0 ? 'text-green-400' : 'text-red-400'}">
                            R$ ${(relatorio.lucroLiquido || 0).toFixed(2)}
                        </span>
                    </div>
                </div>
            </div>
            
            <!-- Custos Gerais Detalhados -->
            <div class="bg-gray-700/50 rounded-xl p-6">
                <h4 class="text-lg font-semibold text-white mb-4">Custos Gerais</h4>
                <div id="custosGeraisDetalhes">
                    ${relatorio.custosGerais && relatorio.custosGerais.length > 0 ? 
                        relatorio.custosGerais.map((custo, index) => `
                            <div class="flex justify-between items-center py-2 border-b border-gray-600 last:border-b-0 hover:bg-gray-600/30 cursor-pointer rounded px-2" onclick="editarCustoGeral(${relatorio.id}, ${index})">
                                <div>
                                    <p class="text-white text-sm">${custo.descricao || 'Custo'}</p>
                                    <p class="text-gray-400 text-xs">${custo.tipo || 'Geral'} - ${custo.data || 'Sem data'}</p>
                                </div>
                                <div class="flex items-center space-x-2">
                                    <span class="text-white font-medium">R$ ${(custo.valor || 0).toFixed(2)}</span>
                                    <i class="fas fa-edit text-blue-400 text-xs"></i>
                                </div>
                            </div>
                        `).join('') : 
                        '<p class="text-gray-400 text-sm">Nenhum custo geral registrado</p>'
                    }
                </div>
            </div>
        </div>
    `;
}

// Fechar modal de detalhes
function fecharModalDetalhes() {
    const modal = document.getElementById('modalDetalhesRelatorio');
    if (modal) {
        modal.classList.add('hidden');
    }
}

// Editar relatório
function editarRelatorio() {
    // Obter ID do relatório atual
    const modal = document.getElementById('modalDetalhesRelatorio');
    const relatorioId = modal.dataset.relatorioId;
    
    if (!relatorioId) {
        alert('ID do relatório não encontrado!');
        return;
    }
    
    // Fechar modal de detalhes
    fecharModalDetalhes();
    
    // Abrir modal de edição (reutilizar modal de criação)
    const relatoriosSalvos = JSON.parse(localStorage.getItem('truckReports')) || [];
    const relatorio = relatoriosSalvos.find(r => r.id == relatorioId);
    
    if (!relatorio) {
        alert('Relatório não encontrado!');
        return;
    }
    
    // Preencher formulário com dados do relatório
    preencherFormularioEdicao(relatorio);
    
    // Abrir modal de criação/edição
    document.getElementById('reportModal').classList.remove('hidden');
}

// Preencher formulário para edição
function preencherFormularioEdicao(relatorio) {
    document.getElementById('dataViagem').value = relatorio.date;
    document.getElementById('localPartida').value = relatorio.localPartida || '';
    document.getElementById('localChegada').value = relatorio.localChegada || '';
    document.getElementById('quantidadeDiarias').value = relatorio.quantidadeDiarias || 0;
    document.getElementById('litrosGasolina').value = relatorio.litrosGasolina || 0;
    document.getElementById('valorGasolina').value = relatorio.valorGasolina || 0;
    document.getElementById('nomeMotorista').value = relatorio.nomeMotorista || '';
    document.getElementById('nomeCaminhao').value = relatorio.nomeCaminhao || '';
    document.getElementById('receita').value = relatorio.receita || 0;
    
    // Limpar custos gerais atuais e adicionar os do relatório
    if (typeof custosGeraisRelatorio !== 'undefined') {
        custosGeraisRelatorio = [...(relatorio.custosGerais || [])];
        if (typeof atualizarListaCustosGerais === 'function') {
            atualizarListaCustosGerais();
        }
    }
    
    // Atualizar preview se a função existir
    if (typeof updateReportPreview === 'function') {
        updateReportPreview();
    }
    
    // Armazenar ID para edição
    document.getElementById('reportForm').dataset.editId = relatorio.id;
}

// Excluir relatório
function excluirRelatorio() {
    const modal = document.getElementById('modalDetalhesRelatorio');
    const relatorioId = modal.dataset.relatorioId;
    
    if (!relatorioId) {
        alert('ID do relatório não encontrado!');
        return;
    }
    
    if (confirm('Tem certeza que deseja excluir este relatório? Esta ação não pode ser desfeita.')) {
        // Remover do localStorage
        const relatoriosSalvos = JSON.parse(localStorage.getItem('truckReports')) || [];
        const relatoriosAtualizados = relatoriosSalvos.filter(r => r.id != relatorioId);
        localStorage.setItem('truckReports', JSON.stringify(relatoriosAtualizados));
        
        // Fechar modal
        fecharModalDetalhes();
        
        // Atualizar interface
        buscarRelatoriosPorData();
        
        alert('Relatório excluído com sucesso!');
    }
}

// Editar custo geral
function editarCustoGeral(relatorioId, custoIndex) {
    const relatoriosSalvos = JSON.parse(localStorage.getItem('truckReports')) || [];
    const relatorio = relatoriosSalvos.find(r => r.id === relatorioId);
    
    if (!relatorio || !relatorio.custosGerais || !relatorio.custosGerais[custoIndex]) {
        alert('Custo não encontrado!');
        return;
    }
    
    const custo = relatorio.custosGerais[custoIndex];
    
    // Criar modal de edição de custo se não existir
    let modal = document.getElementById('modalEditarCusto');
    if (!modal) {
        modal = criarModalEditarCusto();
        document.body.appendChild(modal);
    }
    
    // Preencher formulário com dados do custo
    preencherFormularioCusto(custo);
    
    // Armazenar IDs para edição
    modal.dataset.relatorioId = relatorioId;
    modal.dataset.custoIndex = custoIndex;
    
    // Mostrar modal
    modal.classList.remove('hidden');
}

// Criar modal de edição de custo
function criarModalEditarCusto() {
    const modal = document.createElement('div');
    modal.id = 'modalEditarCusto';
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 hidden';
    
    modal.innerHTML = `
        <div class="bg-gray-800 rounded-2xl p-8 max-w-2xl w-full mx-4">
            <div class="flex justify-between items-center mb-6">
                <h3 class="text-2xl font-bold text-white">Editar Custo Geral</h3>
                <button onclick="fecharModalEditarCusto()" class="text-gray-400 hover:text-white text-2xl">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            
            <form id="formEditarCusto" class="space-y-6">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label class="block text-sm font-medium text-gray-300 mb-2">Tipo de Gasto</label>
                        <select id="editTipoGasto" class="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                            <option value="manutencao">Manutenção</option>
                            <option value="ipva">IPVA</option>
                            <option value="seguro">Seguro</option>
                            <option value="batida">Batida</option>
                            <option value="pecas">Peças</option>
                            <option value="acessorios">Acessórios</option>
                            <option value="combustivel">Combustível</option>
                            <option value="pedagio">Pedágio</option>
                            <option value="outros">Outros</option>
                        </select>
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium text-gray-300 mb-2">Data</label>
                        <input type="date" id="editDataCusto" class="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium text-gray-300 mb-2">Veículo (Placa)</label>
                        <input type="text" id="editPlacaCusto" placeholder="Ex: ABC-1234" class="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium text-gray-300 mb-2">Oficina/Fornecedor</label>
                        <input type="text" id="editOficinaFornecedor" placeholder="Nome da oficina ou fornecedor" class="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                    </div>
                    
                    <div class="md:col-span-2">
                        <label class="block text-sm font-medium text-gray-300 mb-2">Descrição</label>
                        <textarea id="editDescricaoCusto" rows="3" placeholder="Descrição do serviço ou peça" class="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"></textarea>
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium text-gray-300 mb-2">Valor (R$)</label>
                        <input type="number" id="editValorCusto" step="0.01" min="0" placeholder="0.00" class="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium text-gray-300 mb-2">Forma de Pagamento</label>
                        <select id="editFormaPagamento" class="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                            <option value="boleto">Boleto</option>
                            <option value="vista">À Vista</option>
                            <option value="fiado">Fiado</option>
                            <option value="aberto">Em Aberto</option>
                        </select>
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium text-gray-300 mb-2">Status de Pagamento</label>
                        <select id="editStatusPagamento" class="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                            <option value="pago">Pago</option>
                            <option value="nao_pago">Não Pago</option>
                        </select>
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium text-gray-300 mb-2">Data de Vencimento</label>
                        <input type="date" id="editDataVencimento" class="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                    </div>
                </div>
                
                <div class="flex justify-end space-x-4">
                    <button type="button" onclick="fecharModalEditarCusto()" class="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors">
                        Cancelar
                    </button>
                    <button type="button" onclick="excluirCustoGeral()" class="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors">
                        <i class="fas fa-trash mr-2"></i>Excluir
                    </button>
                    <button type="submit" class="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                        <i class="fas fa-save mr-2"></i>Salvar Alterações
                    </button>
                </div>
            </form>
        </div>
    `;
    
    // Adicionar event listener para o formulário
    const form = modal.querySelector('#formEditarCusto');
    form.addEventListener('submit', function(e) {
        e.preventDefault();
        salvarCustoEditado();
    });
    
    return modal;
}

// Salvar custo editado
function salvarCustoEditado() {
    const modal = document.getElementById('modalEditarCusto');
    const relatorioId = modal.dataset.relatorioId;
    const custoIndex = parseInt(modal.dataset.custoIndex);
    
    if (!relatorioId || custoIndex === undefined) {
        alert('Dados do custo não encontrados!');
        return;
    }
    
    // Validar campos obrigatórios
    const valor = parseFloat(document.getElementById('editValorCusto').value) || 0;
    if (valor <= 0) {
        alert('Por favor, informe um valor válido para o custo!');
        return;
    }
    
    // Coletar dados do formulário
    const custoEditado = {
        tipo: document.getElementById('editTipoGasto').value,
        data: document.getElementById('editDataCusto').value,
        placa: document.getElementById('editPlacaCusto').value.trim(),
        oficinaFornecedor: document.getElementById('editOficinaFornecedor').value.trim(),
        descricao: document.getElementById('editDescricaoCusto').value.trim(),
        valor: valor,
        formaPagamento: document.getElementById('editFormaPagamento').value,
        statusPagamento: document.getElementById('editStatusPagamento').value,
        dataVencimento: document.getElementById('editDataVencimento').value
    };
    
    // Atualizar relatório no localStorage
    const relatoriosSalvos = JSON.parse(localStorage.getItem('truckReports')) || [];
    const relatorio = relatoriosSalvos.find(r => r.id == relatorioId);
    
    if (relatorio && relatorio.custosGerais) {
        // Atualizar custo específico
        relatorio.custosGerais[custoIndex] = custoEditado;
        
        // Recalcular totais
        const totalCustosGerais = relatorio.custosGerais.reduce((sum, custo) => sum + (custo.valor || 0), 0);
        const totalGastosViagem = (relatorio.valorGasolina || 0) + (relatorio.totalDiarias || 0);
        relatorio.totalCustosGerais = totalCustosGerais;
        relatorio.totalDespesas = totalGastosViagem + totalCustosGerais;
        relatorio.lucroLiquido = (relatorio.receita || 0) - relatorio.totalDespesas;
        
        localStorage.setItem('truckReports', JSON.stringify(relatoriosSalvos));
        
        // Fechar modal
        fecharModalEditarCusto();
        
        // Atualizar modal de detalhes
        preencherModalDetalhes(relatorio);
        
        // Atualizar interface
        buscarRelatoriosPorData();
        
        alert('Custo atualizado com sucesso!');
    }
}

// Preencher formulário de edição de custo
function preencherFormularioCusto(custo) {
    document.getElementById('editTipoGasto').value = custo.tipo || 'outros';
    document.getElementById('editDataCusto').value = custo.data || '';
    document.getElementById('editPlacaCusto').value = custo.placa || '';
    document.getElementById('editOficinaFornecedor').value = custo.oficinaFornecedor || '';
    document.getElementById('editDescricaoCusto').value = custo.descricao || '';
    document.getElementById('editValorCusto').value = custo.valor || 0;
    document.getElementById('editFormaPagamento').value = custo.formaPagamento || 'vista';
    document.getElementById('editStatusPagamento').value = custo.statusPagamento || 'pago';
    document.getElementById('editDataVencimento').value = custo.dataVencimento || '';
}

// Fechar modal de edição de custo
function fecharModalEditarCusto() {
    const modal = document.getElementById('modalEditarCusto');
    if (modal) {
        modal.classList.add('hidden');
    }
}

// Excluir custo geral
function excluirCustoGeral() {
    const modal = document.getElementById('modalEditarCusto');
    const relatorioId = modal.dataset.relatorioId;
    const custoIndex = parseInt(modal.dataset.custoIndex);
    
    if (!relatorioId || custoIndex === undefined) {
        alert('Dados do custo não encontrados!');
        return;
    }
    
    if (confirm('Tem certeza que deseja excluir este custo? Esta ação não pode ser desfeita.')) {
        // Atualizar relatório no localStorage
        const relatoriosSalvos = JSON.parse(localStorage.getItem('truckReports')) || [];
        const relatorio = relatoriosSalvos.find(r => r.id == relatorioId);
        
        if (relatorio && relatorio.custosGerais) {
            relatorio.custosGerais.splice(custoIndex, 1);
            
            // Recalcular totais
            const totalCustosGerais = relatorio.custosGerais.reduce((sum, custo) => sum + (custo.valor || 0), 0);
            const totalGastosViagem = (relatorio.valorGasolina || 0) + (relatorio.totalDiarias || 0);
            relatorio.totalCustosGerais = totalCustosGerais;
            relatorio.totalDespesas = totalGastosViagem + totalCustosGerais;
            relatorio.lucroLiquido = (relatorio.receita || 0) - relatorio.totalDespesas;
            
            localStorage.setItem('truckReports', JSON.stringify(relatoriosSalvos));
            
            // Fechar modal
            fecharModalEditarCusto();
            
            // Atualizar modal de detalhes
            preencherModalDetalhes(relatorio);
            
            // Atualizar interface
            buscarRelatoriosPorData();
            
            alert('Custo excluído com sucesso!');
        }
    }
}

// Exportar funções para uso global
window.buscarRelatoriosPorData = buscarRelatoriosPorData;
window.mostrarRelatoriosHoje = mostrarRelatoriosHoje;
window.mostrarRelatoriosSemana = mostrarRelatoriosSemana;
window.mostrarRelatoriosMes = mostrarRelatoriosMes;
window.alternarResumo = alternarResumo;
window.carregarResumoSemanal = carregarResumoSemanal;
window.carregarResumoMensal = carregarResumoMensal;
window.abrirModalDetalhes = abrirModalDetalhes;
window.fecharModalDetalhes = fecharModalDetalhes;
window.editarRelatorio = editarRelatorio;
window.excluirRelatorio = excluirRelatorio;
window.editarCustoGeral = editarCustoGeral;
window.fecharModalEditarCusto = fecharModalEditarCusto;
window.excluirCustoGeral = excluirCustoGeral;
window.salvarCustoEditado = salvarCustoEditado;

console.log('Funções do dashboard exportadas');
