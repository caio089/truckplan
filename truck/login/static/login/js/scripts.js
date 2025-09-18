// ===== DADOS GLOBAIS =====
let reports = [];
let currentWeekData = { gastos: 0, lucros: 0, lucroLiquido: 0 };
let custosGeraisRelatorio = [];

// ===== FUNÇÕES PRINCIPAIS =====

// Carregar relatórios do servidor
async function carregarRelatoriosDoServidor() {
    try {
        const response = await fetch('/login/listar-relatorios/');
        if (response.ok) {
            const data = await response.json();
            reports = data.relatorios || [];
            updateWeekSummary();
        }
    } catch (error) {
        console.error('Erro ao carregar relatórios:', error);
    }
}

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
    } else if (tipo === 'mensal') {
        btnSemanal.className = 'px-4 py-2 bg-gray-600 text-white rounded-lg font-semibold transition-all duration-300';
        btnMensal.className = 'px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold transition-all duration-300';
        resumoSemanal.classList.add('hidden');
        resumoMensal.classList.remove('hidden');
    }
}

// Atualizar resumo semanal
function updateWeekSummary() {
    const hoje = new Date();
    const inicioSemana = new Date(hoje);
    inicioSemana.setDate(hoje.getDate() - hoje.getDay());
    
    const weekReports = reports.filter(report => {
        const reportDate = new Date(report.date);
        return reportDate >= inicioSemana && reportDate <= hoje;
    });
    
    const totalLucros = weekReports.reduce((sum, report) => sum + (report.receita || 0), 0);
    const totalGastos = weekReports.reduce((sum, report) => {
        const gastosViagem = (report.valorGasolina || 0) + (report.totalDiarias || 0);
        const custosGerais = report.totalCustosGerais || 0;
        const salario = report.salarioLiquido || 0;
        return sum + gastosViagem + custosGerais + salario;
    }, 0);
    
    const lucroLiquido = totalLucros - totalGastos;
    const mediaDiaria = weekReports.length > 0 ? lucroLiquido / weekReports.length : 0;
    
    document.getElementById('totalLucrosSemanal').textContent = `R$ ${totalLucros.toFixed(2).replace('.', ',')}`;
    document.getElementById('totalGastosSemanal').textContent = `R$ ${totalGastos.toFixed(2).replace('.', ',')}`;
    document.getElementById('lucroLiquidoSemanal').textContent = `R$ ${lucroLiquido.toFixed(2).replace('.', ',')}`;
    document.getElementById('mediaDiariaSemanal').textContent = `R$ ${mediaDiaria.toFixed(2).replace('.', ',')}`;
}

// Atualizar resumo mensal
function updateMonthSummary() {
    const hoje = new Date();
    const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    
    const monthReports = reports.filter(report => {
        const reportDate = new Date(report.date);
        return reportDate >= inicioMes && reportDate <= hoje;
    });
    
    const totalLucros = monthReports.reduce((sum, report) => sum + (report.receita || 0), 0);
    const totalGastos = monthReports.reduce((sum, report) => {
        const gastosViagem = (report.valorGasolina || 0) + (report.totalDiarias || 0);
        const custosGerais = report.totalCustosGerais || 0;
        const salario = report.salarioLiquido || 0;
        return sum + gastosViagem + custosGerais + salario;
    }, 0);
    
    const lucroLiquido = totalLucros - totalGastos;
    const mediaDiaria = monthReports.length > 0 ? lucroLiquido / monthReports.length : 0;
    
    document.getElementById('totalLucrosMensal').textContent = `R$ ${totalLucros.toFixed(2).replace('.', ',')}`;
    document.getElementById('totalGastosMensal').textContent = `R$ ${totalGastos.toFixed(2).replace('.', ',')}`;
    document.getElementById('lucroLiquidoMensal').textContent = `R$ ${lucroLiquido.toFixed(2).replace('.', ',')}`;
    document.getElementById('mediaDiariaMensal').textContent = `R$ ${mediaDiaria.toFixed(2).replace('.', ',')}`;
}

// ===== NAVEGAÇÃO =====

function irParaRelatorioSemanal() {
    window.location.href = '/login/relatorio-semanal/';
}

function irParaRelatorioMensal() {
    window.location.href = '/login/relatorio-mensal/';
}

// ===== FUNÇÕES DE BUSCA E FILTROS =====

function showPreviousReports() {
    // Mostrar todos os relatórios em uma tabela
    mostrarResultadosBusca(reports);
}

function buscarRelatoriosPorData() {
    const dataInicial = document.getElementById('dataInicial').value;
    const dataFinal = document.getElementById('dataFinal').value;
    
    if (!dataInicial || !dataFinal) {
        showNotification('Selecione as datas inicial e final!', 'error');
        return;
    }
    
    const relatoriosFiltrados = reports.filter(report => {
        const reportDate = new Date(report.date);
        const inicio = new Date(dataInicial);
        const fim = new Date(dataFinal);
        return reportDate >= inicio && reportDate <= fim;
    });
    
    mostrarResultadosBusca(relatoriosFiltrados);
}

function mostrarResultadosBusca(relatorios) {
    const container = document.getElementById('resultadosBusca');
    const resumo = document.getElementById('resumoResultados');
    const tabela = document.getElementById('tabelaResultados');
    
    if (relatorios.length === 0) {
        resumo.innerHTML = '<div class="col-span-full text-center text-gray-400 py-8">Nenhum relatório encontrado no período selecionado</div>';
        tabela.innerHTML = '';
    } else {
        // Calcular resumo
        const totalLucros = relatorios.reduce((sum, report) => sum + (report.receita || 0), 0);
        const totalGastos = relatorios.reduce((sum, report) => {
            const gastosViagem = (report.valorGasolina || 0) + (report.totalDiarias || 0);
            const custosGerais = report.totalCustosGerais || 0;
            const salario = report.salarioLiquido || 0;
            return sum + gastosViagem + custosGerais + salario;
        }, 0);
        const lucroLiquido = totalLucros - totalGastos;
        const mediaDiaria = relatorios.length > 0 ? lucroLiquido / relatorios.length : 0;
        
        resumo.innerHTML = `
            <div class="bg-gradient-to-r from-red-600 to-red-700 rounded-2xl p-6 text-white">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-red-100 text-sm font-medium">Total de Gastos</p>
                        <p class="text-3xl font-bold">R$ ${totalGastos.toFixed(2).replace('.', ',')}</p>
                    </div>
                    <div class="text-4xl opacity-80">💰</div>
                </div>
            </div>
            <div class="bg-gradient-to-r from-green-600 to-green-700 rounded-2xl p-6 text-white">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-green-100 text-sm font-medium">Total de Receitas</p>
                        <p class="text-3xl font-bold">R$ ${totalLucros.toFixed(2).replace('.', ',')}</p>
                    </div>
                    <div class="text-4xl opacity-80">📈</div>
                </div>
            </div>
            <div class="bg-gradient-to-r from-purple-600 to-purple-700 rounded-2xl p-6 text-white">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-purple-100 text-sm font-medium">Lucro Líquido</p>
                        <p class="text-3xl font-bold">R$ ${lucroLiquido.toFixed(2).replace('.', ',')}</p>
                    </div>
                    <div class="text-4xl opacity-80">💎</div>
                </div>
            </div>
            <div class="bg-gradient-to-r from-yellow-600 to-yellow-700 rounded-2xl p-6 text-white">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-yellow-100 text-sm font-medium">Média Diária</p>
                        <p class="text-3xl font-bold">R$ ${mediaDiaria.toFixed(2).replace('.', ',')}</p>
                    </div>
                    <div class="text-4xl opacity-80">📊</div>
                </div>
            </div>
        `;
        
        // Gerar tabela
        tabela.innerHTML = `
            <table class="w-full text-white">
                <thead>
                    <tr class="border-b border-gray-600">
                        <th class="text-left py-3 px-4">Data</th>
                        <th class="text-left py-3 px-4">Rota</th>
                        <th class="text-left py-3 px-4">Motorista</th>
                        <th class="text-left py-3 px-4">Receita</th>
                        <th class="text-left py-3 px-4">Gastos</th>
                        <th class="text-left py-3 px-4">Lucro</th>
                        <th class="text-left py-3 px-4">Ações</th>
                    </tr>
                </thead>
                <tbody>
                    ${relatorios.map(report => `
                        <tr class="border-b border-gray-700 hover:bg-gray-800/50">
                            <td class="py-3 px-4">${formatDate(report.date)}</td>
                            <td class="py-3 px-4">${report.localPartida || ''} → ${report.localChegada || ''}</td>
                            <td class="py-3 px-4">${report.nomeMotorista || ''}</td>
                            <td class="py-3 px-4 text-green-400">R$ ${(report.receita || 0).toFixed(2).replace('.', ',')}</td>
                            <td class="py-3 px-4 text-red-400">R$ ${((report.valorGasolina || 0) + (report.totalDiarias || 0) + (report.totalCustosGerais || 0) + (report.salarioLiquido || 0)).toFixed(2).replace('.', ',')}</td>
                            <td class="py-3 px-4 ${(report.receita || 0) - ((report.valorGasolina || 0) + (report.totalDiarias || 0) + (report.totalCustosGerais || 0) + (report.salarioLiquido || 0)) >= 0 ? 'text-green-400' : 'text-red-400'}">
                                R$ ${((report.receita || 0) - ((report.valorGasolina || 0) + (report.totalDiarias || 0) + (report.totalCustosGerais || 0) + (report.salarioLiquido || 0))).toFixed(2).replace('.', ',')}
                            </td>
                            <td class="py-3 px-4">
                                <button onclick="viewReportSummary(${report.id})" class="text-blue-400 hover:text-blue-300 mr-2">Ver</button>
                                <button onclick="editReport(${report.id})" class="text-yellow-400 hover:text-yellow-300 mr-2">Editar</button>
                                <button onclick="deleteReport(${report.id})" class="text-red-400 hover:text-red-300">Excluir</button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }
    
    container.classList.remove('hidden');
}

// ===== FUNÇÕES DE AÇÕES RÁPIDAS =====

function mostrarRelatoriosHoje() {
    const hoje = new Date().toISOString().split('T')[0];
    const relatoriosHoje = reports.filter(report => report.date === hoje);
    mostrarResultadosBusca(relatoriosHoje);
}

function mostrarRelatoriosSemana() {
    const hoje = new Date();
    const inicioSemana = new Date(hoje);
    inicioSemana.setDate(hoje.getDate() - hoje.getDay());
    
    const relatoriosSemana = reports.filter(report => {
        const reportDate = new Date(report.date);
        return reportDate >= inicioSemana && reportDate <= hoje;
    });
    
    mostrarResultadosBusca(relatoriosSemana);
}

function mostrarRelatoriosMes() {
    const hoje = new Date();
    const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    
    const relatoriosMes = reports.filter(report => {
        const reportDate = new Date(report.date);
        return reportDate >= inicioMes && reportDate <= hoje;
    });
    
    mostrarResultadosBusca(relatoriosMes);
}

// ===== MODAIS =====

function openReportModal() {
    limparFormularioViagem();
    document.getElementById('reportModal').classList.remove('hidden');
    document.getElementById('dataViagem').value = new Date().toISOString().split('T')[0];
    updateReportPreview();
}

function closeReportModal() {
    document.getElementById('reportModal').classList.add('hidden');
}

function openCustosFixosModal() {
    document.getElementById('custosFixosModal').classList.remove('hidden');
    carregarCustosFixos();
}

function closeCustosFixosModal() {
    document.getElementById('custosFixosModal').classList.add('hidden');
    limparFormularioCustoFixo();
}

// ===== FUNÇÕES DE RELATÓRIOS =====

function salvarRelatorio() {
    const form = document.getElementById('reportForm');
    const formData = new FormData(form);
    
    // Validar campos obrigatórios
    const camposObrigatorios = ['dataViagem', 'localPartida', 'localChegada', 'quantidadeDiarias', 'litrosGasolina', 'valorGasolina', 'nomeMotorista', 'nomeCaminhao'];
    for (const campo of camposObrigatorios) {
        const elemento = document.getElementById(campo);
        if (!elemento || !elemento.value.trim()) {
            showNotification(`Campo ${campo} é obrigatório!`, 'error');
            elemento?.focus();
            return;
        }
    }
    
    // Coletar dados do formulário
    const reportData = {
        data: formData.get('dataViagem'),
        localPartida: formData.get('localPartida'),
        localChegada: formData.get('localChegada'),
        quantidadeDiarias: parseFloat(formData.get('quantidadeDiarias')),
        litrosGasolina: parseFloat(formData.get('litrosGasolina')),
        valorGasolina: parseFloat(formData.get('valorGasolina')),
        nomeMotorista: formData.get('nomeMotorista'),
        nomeCaminhao: formData.get('nomeCaminhao'),
        receita: parseFloat(formData.get('receita') || 0),
        salario_base: parseFloat(formData.get('salario_base') || 0),
        bonus_viagens: parseFloat(formData.get('bonus_viagens') || 0),
        desconto_faltas: parseFloat(formData.get('desconto_faltas') || 0),
        custosGerais: custosGeraisRelatorio
    };
    
    // Verificar se é edição
    const editId = document.getElementById('editReportId').value;
    const isEdit = editId && editId !== '';
    
    // Salvar no servidor
    salvarRelatorioNoServidor(reportData, isEdit);
}

function viewReportSummary(reportId) {
    const report = reports.find(r => r.id === reportId);
    if (!report) return;
    
    // Calcular totais
    const totalDiarias = (report.quantidadeDiarias || 0) * 70;
    const totalGastos = (report.valorGasolina || 0) + totalDiarias + (report.totalCustosGerais || 0) + (report.salarioLiquido || 0);
    const lucroLiquido = (report.receita || 0) - totalGastos;
    const margemLucro = totalGastos > 0 ? ((lucroLiquido / totalGastos) * 100) : 0;
    
    // Criar modal de detalhes
    const modalHTML = `
        <div id="reportDetailsModal" class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div class="glass-effect rounded-2xl p-8 w-full max-w-6xl max-h-[90vh] overflow-y-auto">
                <div class="flex justify-between items-center mb-6">
                    <h3 class="text-2xl font-bold text-white">📊 Relatório Detalhado da Viagem</h3>
                    <button onclick="closeReportDetailsModal()" class="text-gray-400 hover:text-white text-2xl">×</button>
                </div>
                
                <div class="space-y-6">
                    <!-- Informações da Viagem -->
                    <div class="bg-gray-800/30 rounded-xl p-6 border border-gray-600/30">
                        <h4 class="text-lg font-semibold text-white mb-4 flex items-center">
                            🚛 Informações da Viagem
                            <span class="ml-2 text-sm text-gray-400 font-normal">(Dados básicos da operação)</span>
                        </h4>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div class="space-y-4">
                                <div>
                                    <p class="text-gray-300 text-sm mb-1">📅 Data da Viagem</p>
                                    <p class="text-white font-semibold text-lg">${formatDate(report.date)}</p>
                                    <p class="text-gray-400 text-xs">Data em que a viagem foi realizada</p>
                                </div>
                                <div>
                                    <p class="text-gray-300 text-sm mb-1">🛣️ Rota</p>
                                    <p class="text-white font-semibold text-lg">${report.localPartida || 'Não informado'} → ${report.localChegada || 'Não informado'}</p>
                                    <p class="text-gray-400 text-xs">Cidade de origem e destino da carga</p>
                                </div>
                            </div>
                            <div class="space-y-4">
                                <div>
                                    <p class="text-gray-300 text-sm mb-1">👨‍💼 Motorista Responsável</p>
                                    <p class="text-white font-semibold text-lg">${report.nomeMotorista || 'Não informado'}</p>
                                    <p class="text-gray-400 text-xs">Nome do motorista que conduziu a viagem</p>
                                </div>
                                <div>
                                    <p class="text-gray-300 text-sm mb-1">🚛 Veículo Utilizado</p>
                                    <p class="text-white font-semibold text-lg">${report.nomeCaminhao || 'Não informado'}</p>
                                    <p class="text-gray-400 text-xs">Modelo e identificação do caminhão</p>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Resumo Financeiro -->
                    <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div class="bg-gradient-to-r from-green-600 to-green-700 rounded-xl p-6 text-white">
                            <div class="flex items-center justify-between">
                                <div>
                                    <p class="text-green-100 text-sm font-medium">💰 Receita Total</p>
                                    <p class="text-3xl font-bold">R$ ${(report.receita || 0).toFixed(2).replace('.', ',')}</p>
                                    <p class="text-green-200 text-xs">Valor recebido pelo frete</p>
                                </div>
                                <div class="text-4xl opacity-80">💰</div>
                            </div>
                        </div>
                        
                        <div class="bg-gradient-to-r from-red-600 to-red-700 rounded-xl p-6 text-white">
                            <div class="flex items-center justify-between">
                                <div>
                                    <p class="text-red-100 text-sm font-medium">💸 Gastos Totais</p>
                                    <p class="text-3xl font-bold">R$ ${totalGastos.toFixed(2).replace('.', ',')}</p>
                                    <p class="text-red-200 text-xs">Soma de todos os custos</p>
                                </div>
                                <div class="text-4xl opacity-80">💸</div>
                            </div>
                        </div>
                        
                        <div class="bg-gradient-to-r from-purple-600 to-purple-700 rounded-xl p-6 text-white">
                            <div class="flex items-center justify-between">
                                <div>
                                    <p class="text-purple-100 text-sm font-medium">📈 Lucro Líquido</p>
                                    <p class="text-3xl font-bold ${lucroLiquido >= 0 ? 'text-white' : 'text-red-200'}">R$ ${lucroLiquido.toFixed(2).replace('.', ',')}</p>
                                    <p class="text-purple-200 text-xs">Receita - Gastos</p>
                                </div>
                                <div class="text-4xl opacity-80">${lucroLiquido >= 0 ? '📈' : '📉'}</div>
                            </div>
                        </div>
                        
                        <div class="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl p-6 text-white">
                            <div class="flex items-center justify-between">
                                <div>
                                    <p class="text-blue-100 text-sm font-medium">📊 Margem de Lucro</p>
                                    <p class="text-3xl font-bold">${margemLucro.toFixed(1)}%</p>
                                    <p class="text-blue-200 text-xs">Lucro em % dos gastos</p>
                                </div>
                                <div class="text-4xl opacity-80">📊</div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Detalhamento dos Gastos -->
                    <div class="bg-gray-800/30 rounded-xl p-6 border border-gray-600/30">
                        <h4 class="text-lg font-semibold text-white mb-4 flex items-center">
                            💸 Detalhamento Completo dos Gastos
                            <span class="ml-2 text-sm text-gray-400 font-normal">(Breakdown de todos os custos)</span>
                        </h4>
                        <div class="space-y-4">
                            <!-- Gasolina -->
                            <div class="bg-gray-700/30 rounded-lg p-4">
                                <div class="flex justify-between items-center">
                                    <div>
                                        <p class="text-white font-semibold">⛽ Combustível (Gasolina)</p>
                                        <p class="text-gray-300 text-sm">${report.litrosGasolina || 0} litros consumidos</p>
                                        <p class="text-gray-400 text-xs">Custo com combustível para a viagem</p>
                                    </div>
                                    <span class="text-red-400 font-bold text-xl">R$ ${(report.valorGasolina || 0).toFixed(2).replace('.', ',')}</span>
                                </div>
                            </div>
                            
                            <!-- Diárias -->
                            <div class="bg-gray-700/30 rounded-lg p-4">
                                <div class="flex justify-between items-center">
                                    <div>
                                        <p class="text-white font-semibold">🏨 Diárias do Motorista</p>
                                        <p class="text-gray-300 text-sm">${report.quantidadeDiarias || 0} dias × R$ 70,00/dia</p>
                                        <p class="text-gray-400 text-xs">Valor fixo por dia de viagem (alimentação e hospedagem)</p>
                                    </div>
                                    <span class="text-red-400 font-bold text-xl">R$ ${totalDiarias.toFixed(2).replace('.', ',')}</span>
                                </div>
                            </div>
                            
                            <!-- Custos Gerais -->
                            <div class="bg-gray-700/30 rounded-lg p-4">
                                <div class="flex justify-between items-center">
                                    <div>
                                        <p class="text-white font-semibold">🔧 Custos Gerais</p>
                                        <p class="text-gray-300 text-sm">Manutenção, pedágios, multas, etc.</p>
                                        <p class="text-gray-400 text-xs">Gastos diversos relacionados à viagem</p>
                                    </div>
                                    <span class="text-red-400 font-bold text-xl">R$ ${(report.totalCustosGerais || 0).toFixed(2).replace('.', ',')}</span>
                                </div>
                            </div>
                            
                            <!-- Salário do Motorista -->
                            <div class="bg-gray-700/30 rounded-lg p-4">
                                <div class="flex justify-between items-center">
                                    <div>
                                        <p class="text-white font-semibold">👨‍💼 Salário do Motorista</p>
                                        <p class="text-gray-300 text-sm">Salário base + bônus - descontos</p>
                                        <p class="text-gray-400 text-xs">Remuneração líquida do motorista</p>
                                    </div>
                                    <span class="text-red-400 font-bold text-xl">R$ ${(report.salarioLiquido || 0).toFixed(2).replace('.', ',')}</span>
                                </div>
                            </div>
                            
                            <!-- Total -->
                            <div class="bg-gradient-to-r from-red-600/20 to-red-700/20 rounded-lg p-4 border border-red-500/30">
                                <div class="flex justify-between items-center">
                                    <div>
                                        <p class="text-white font-bold text-lg">💸 TOTAL DE GASTOS</p>
                                        <p class="text-gray-300 text-sm">Soma de todos os custos acima</p>
                                    </div>
                                    <span class="text-red-300 font-bold text-2xl">R$ ${totalGastos.toFixed(2).replace('.', ',')}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Análise de Rentabilidade -->
                    <div class="bg-gray-800/30 rounded-xl p-6 border border-gray-600/30">
                        <h4 class="text-lg font-semibold text-white mb-4 flex items-center">
                            📊 Análise de Rentabilidade
                            <span class="ml-2 text-sm text-gray-400 font-normal">(Métricas de performance)</span>
                        </h4>
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div class="text-center">
                                <p class="text-gray-300 text-sm">Receita por Dia</p>
                                <p class="text-white font-bold text-xl">R$ ${((report.receita || 0) / (report.quantidadeDiarias || 1)).toFixed(2).replace('.', ',')}</p>
                                <p class="text-gray-400 text-xs">Receita dividida pelos dias</p>
                            </div>
                            <div class="text-center">
                                <p class="text-gray-300 text-sm">Custo por Dia</p>
                                <p class="text-white font-bold text-xl">R$ ${(totalGastos / (report.quantidadeDiarias || 1)).toFixed(2).replace('.', ',')}</p>
                                <p class="text-gray-400 text-xs">Gastos divididos pelos dias</p>
                            </div>
                            <div class="text-center">
                                <p class="text-gray-300 text-sm">ROI (Retorno)</p>
                                <p class="text-white font-bold text-xl">${margemLucro.toFixed(1)}%</p>
                                <p class="text-gray-400 text-xs">Retorno sobre investimento</p>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Ações -->
                    <div class="flex justify-end space-x-4">
                        <button onclick="closeReportDetailsModal()" class="bg-gray-600 hover:bg-gray-700 text-white px-6 py-2 rounded-lg font-semibold transition-colors">
                            Fechar
                        </button>
                        <button onclick="editReport(${report.id}); closeReportDetailsModal();" class="bg-yellow-600 hover:bg-yellow-700 text-white px-6 py-2 rounded-lg font-semibold transition-colors">
                            ✏️ Editar Relatório
                        </button>
                        <button onclick="deleteReport(${report.id}); closeReportDetailsModal();" class="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg font-semibold transition-colors">
                            🗑️ Excluir Relatório
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Adicionar modal ao body
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

function closeReportDetailsModal() {
    const modal = document.getElementById('reportDetailsModal');
    if (modal) {
        modal.remove();
    }
}

function editReport(reportId) {
    const report = reports.find(r => r.id === reportId);
    if (!report) return;
    
    // Preencher formulário com dados do relatório
    document.getElementById('editReportId').value = report.id;
    document.getElementById('dataViagem').value = report.date;
    document.getElementById('localPartida').value = report.localPartida || '';
    document.getElementById('localChegada').value = report.localChegada || '';
    document.getElementById('quantidadeDiarias').value = report.quantidadeDiarias || '';
    document.getElementById('litrosGasolina').value = report.litrosGasolina || '';
    document.getElementById('valorGasolina').value = report.valorGasolina || '';
    document.getElementById('nomeMotorista').value = report.nomeMotorista || '';
    document.getElementById('nomeCaminhao').value = report.nomeCaminhao || '';
    document.getElementById('receita').value = report.receita || '';
    document.getElementById('salario_base').value = report.salario_base || '';
    document.getElementById('bonus_viagens').value = report.bonus_viagens || '';
    document.getElementById('desconto_faltas').value = report.desconto_faltas || '';
    
    // Abrir modal
    openReportModal();
}

async function deleteReport(reportId) {
    if (confirm('Tem certeza que deseja excluir este relatório?')) {
        try {
            const csrfToken = getCookie('csrftoken');
            if (!csrfToken) {
                showNotification('Erro de autenticação. Faça login novamente.', 'error');
                return;
            }
            
            const response = await fetch(`/login/excluir-relatorio/${reportId}/`, {
                method: 'POST',
                headers: {
                    'X-CSRFToken': csrfToken,
                    'Content-Type': 'application/json',
                },
            });
            
            if (response.ok) {
                const result = await response.json();
                showNotification(result.message || 'Relatório excluído com sucesso!', 'success');
                
                // Remover da lista local
                reports = reports.filter(r => r.id !== reportId);
                
                // Atualizar resumos
                updateWeekSummary();
                updateMonthSummary();
                
                // Atualizar resultados de busca se estiverem visíveis
                const resultadosBusca = document.getElementById('resultadosBusca');
                if (resultadosBusca && !resultadosBusca.classList.contains('hidden')) {
                    // Recarregar resultados de busca
                    buscarRelatoriosPorData();
                }
            } else {
                // Verificar se é erro de autenticação
                if (response.status === 403) {
                    showNotification('Erro de autenticação. Faça login novamente.', 'error');
                    return;
                }
                
                // Tentar ler como JSON, se falhar, mostrar erro genérico
                try {
                    const result = await response.json();
                    showNotification(result.message || 'Erro ao excluir relatório!', 'error');
                } catch (jsonError) {
                    showNotification(`Erro ao excluir relatório! (Status: ${response.status})`, 'error');
                }
            }
        } catch (error) {
            console.error('Erro ao excluir relatório:', error);
            showNotification('Erro de conexão ao excluir relatório!', 'error');
        }
    }
}

// ===== FORMULÁRIOS =====

function limparFormularioViagem() {
    document.getElementById('dataViagem').value = new Date().toISOString().split('T')[0];
    document.getElementById('localPartida').value = '';
    document.getElementById('localChegada').value = '';
    document.getElementById('quantidadeDiarias').value = '';
    document.getElementById('litrosGasolina').value = '';
    document.getElementById('valorGasolina').value = '';
    document.getElementById('nomeMotorista').value = '';
    document.getElementById('nomeCaminhao').value = '';
    document.getElementById('receita').value = '';
    document.getElementById('editReportId').value = '';
    custosGeraisRelatorio = [];
    atualizarListaCustosGerais();
}

function limparFormularioCustoFixo() {
    document.getElementById('custoFixoForm').reset();
}

// ===== CÁLCULOS =====

function calcularDiarias() {
    const quantidade = parseInt(document.getElementById('quantidadeDiarias').value) || 0;
    const valorDiaria = 70.00;
    const total = quantidade * valorDiaria;
    document.getElementById('totalDiarias').textContent = `R$ ${total.toFixed(2).replace('.', ',')}`;
    updateReportPreview();
}

function calcularGastosViagem() {
    const gasolina = parseFloat(document.getElementById('valorGasolina').value) || 0;
    const diarias = parseInt(document.getElementById('quantidadeDiarias').value) || 0;
    const totalDiarias = diarias * 70.00;
    const total = gasolina + totalDiarias;
    document.getElementById('totalGastosViagem').textContent = `R$ ${total.toFixed(2).replace('.', ',')}`;
    updateReportPreview();
}

function calcularSalarioMotorista() {
    const salarioBase = parseFloat(document.getElementById('salario_base').value) || 0;
    const bonus = parseFloat(document.getElementById('bonus_viagens').value) || 0;
    const desconto = parseFloat(document.getElementById('desconto_faltas').value) || 0;
    const salarioLiquido = salarioBase + bonus - desconto;
    document.getElementById('salarioLiquido').textContent = `R$ ${salarioLiquido.toFixed(2).replace('.', ',')}`;
    updateReportPreview();
}

function updateReportPreview() {
    const dataViagem = document.getElementById('dataViagem').value;
    const localPartida = document.getElementById('localPartida').value;
    const localChegada = document.getElementById('localChegada').value;
    const quantidadeDiarias = parseInt(document.getElementById('quantidadeDiarias').value) || 0;
    const litrosGasolina = parseFloat(document.getElementById('litrosGasolina').value) || 0;
    const valorGasolina = parseFloat(document.getElementById('valorGasolina').value) || 0;
    const nomeMotorista = document.getElementById('nomeMotorista').value;
    const nomeCaminhao = document.getElementById('nomeCaminhao').value;
    const receita = parseFloat(document.getElementById('receita').value) || 0;
    const salarioBase = parseFloat(document.getElementById('salario_base').value) || 0;
    const bonusViagens = parseFloat(document.getElementById('bonus_viagens').value) || 0;
    const descontoFaltas = parseFloat(document.getElementById('desconto_faltas').value) || 0;
    
    const totalDiarias = quantidadeDiarias * 70.00;
    const totalCustosGerais = custosGeraisRelatorio.reduce((sum, custo) => sum + custo.valor, 0);
    const totalGastosViagem = valorGasolina + totalDiarias;
    const salarioLiquido = salarioBase + bonusViagens - descontoFaltas;
    const totalDespesas = totalGastosViagem + totalCustosGerais + salarioLiquido;
    const lucroLiquido = receita - totalDespesas;
    
    document.getElementById('previewDataViagem').textContent = dataViagem || 'Não informado';
    document.getElementById('previewLocalPartida').textContent = localPartida || 'Não informado';
    document.getElementById('previewLocalChegada').textContent = localChegada || 'Não informado';
    document.getElementById('previewQuantidadeDiarias').textContent = quantidadeDiarias;
    document.getElementById('previewTotalDiarias').textContent = `R$ ${totalDiarias.toFixed(2).replace('.', ',')}`;
    document.getElementById('previewLitrosGasolina').textContent = litrosGasolina;
    document.getElementById('previewValorGasolina').textContent = `R$ ${valorGasolina.toFixed(2).replace('.', ',')}`;
    document.getElementById('previewNomeMotorista').textContent = nomeMotorista || 'Não informado';
    document.getElementById('previewNomeCaminhao').textContent = nomeCaminhao || 'Não informado';
    document.getElementById('previewReceita').textContent = `R$ ${receita.toFixed(2).replace('.', ',')}`;
    document.getElementById('previewTotalGastosViagem').textContent = `R$ ${totalGastosViagem.toFixed(2).replace('.', ',')}`;
    document.getElementById('previewTotalCustosGerais').textContent = `R$ ${totalCustosGerais.toFixed(2).replace('.', ',')}`;
    document.getElementById('previewSalarioLiquido').textContent = `R$ ${salarioLiquido.toFixed(2).replace('.', ',')}`;
    document.getElementById('previewTotalDespesas').textContent = `R$ ${totalDespesas.toFixed(2).replace('.', ',')}`;
    document.getElementById('previewLucroLiquido').textContent = `R$ ${lucroLiquido.toFixed(2).replace('.', ',')}`;
}

// ===== CUSTOS GERAIS =====

function adicionarCustoGeral() {
    const tipoGasto = document.getElementById('tipoGasto').value;
    const dataCusto = document.getElementById('dataCusto').value;
    const placaCusto = document.getElementById('placaCusto').value;
    const oficinaFornecedor = document.getElementById('oficinaFornecedor').value;
    const descricaoCusto = document.getElementById('descricaoCusto').value;
    const valorCusto = document.getElementById('valorCusto').value;
    const formaPagamento = document.getElementById('formaPagamento').value;
    const statusPagamento = document.getElementById('statusPagamento').value;
    const dataVencimento = document.getElementById('dataVencimento').value;
    const comprovante = document.getElementById('comprovante').files[0];

    if (!tipoGasto || !dataCusto || !placaCusto || !oficinaFornecedor || !descricaoCusto || !valorCusto || !formaPagamento || !statusPagamento) {
        showNotification('Preencha todos os campos obrigatórios!', 'error');
        return;
    }

    const novoCusto = {
        id: Date.now(),
        tipo: tipoGasto,
        data: dataCusto,
        placa: placaCusto.toUpperCase(),
        oficina: oficinaFornecedor,
        descricao: descricaoCusto,
        valor: parseFloat(valorCusto),
        formaPagamento: formaPagamento,
        statusPagamento: statusPagamento,
        dataVencimento: dataVencimento || null,
        comprovante: comprovante ? comprovante.name : null,
        isNew: true
    };

    custosGeraisRelatorio.push(novoCusto);
    atualizarListaCustosGerais();
    limparFormularioCusto();
    updateReportPreview();
    showNotification('Custo adicionado com sucesso!', 'success');
}

function atualizarListaCustosGerais() {
    const container = document.getElementById('listaCustosGerais');
    
    if (!container) {
        console.log('Elemento listaCustosGerais não encontrado');
        return;
    }
    
    if (custosGeraisRelatorio.length === 0) {
        container.innerHTML = '<p class="text-gray-400 text-sm text-center py-4">Nenhum custo adicionado</p>';
        return;
    }

    const totalCustos = custosGeraisRelatorio.reduce((sum, custo) => sum + custo.valor, 0);

    const html = `
        <div class="bg-gray-800/30 p-4 rounded-xl border border-gray-600/30">
            <div class="flex justify-between items-center mb-3">
                <h6 class="text-md font-semibold text-white">Custos Adicionados (${custosGeraisRelatorio.length})</h6>
                <span class="text-lg font-bold text-red-400">Total: R$ ${totalCustos.toFixed(2).replace('.', ',')}</span>
            </div>
            <div class="space-y-2 max-h-60 overflow-y-auto">
                ${custosGeraisRelatorio.map((custo, index) => `
                    <div class="bg-gray-700/50 p-3 rounded-lg border border-gray-600/30">
                        <div class="flex justify-between items-start">
                            <div class="flex-1">
                                <div class="flex items-center justify-between mb-1">
                                    <span class="text-white font-medium text-sm">${custo.descricao}</span>
                                    <span class="text-white font-bold">R$ ${custo.valor.toFixed(2).replace('.', ',')}</span>
                                </div>
                                <div class="flex items-center justify-between text-xs text-gray-400">
                                    <span>🏢 ${custo.oficina}</span>
                                    <span>📋 ${getTipoDisplay(custo.tipo)}</span>
                                </div>
                                <div class="flex items-center justify-between text-xs text-gray-400 mt-1">
                                    <span>💳 ${custo.formaPagamento}</span>
                                    <span class="px-2 py-1 rounded text-xs ${custo.statusPagamento === 'Pago' ? 'bg-green-600/30 text-green-300' : 'bg-yellow-600/30 text-yellow-300'}">${custo.statusPagamento}</span>
                                </div>
                            </div>
                            <button onclick="removerCustoGeral(${index})" class="text-red-400 hover:text-red-300 ml-2">🗑️</button>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
    
    container.innerHTML = html;
}

function removerCustoGeral(index) {
    custosGeraisRelatorio.splice(index, 1);
    atualizarListaCustosGerais();
    updateReportPreview();
    showNotification('Custo removido!', 'info');
}

function limparFormularioCusto() {
    document.getElementById('tipoGasto').value = '';
    document.getElementById('dataCusto').value = '';
    document.getElementById('placaCusto').value = '';
    document.getElementById('oficinaFornecedor').value = '';
    document.getElementById('descricaoCusto').value = '';
    document.getElementById('valorCusto').value = '';
    document.getElementById('formaPagamento').value = '';
    document.getElementById('statusPagamento').value = '';
    document.getElementById('dataVencimento').value = '';
    document.getElementById('comprovante').value = '';
}

// ===== PARCELAS =====

function toggleParcelas() {
    const formaPagamento = document.getElementById('formaPagamento').value;
    const camposParcelas = document.getElementById('camposParcelas');
    
    if (formaPagamento === 'credito' || formaPagamento === 'parcelado') {
        camposParcelas.classList.remove('hidden');
    } else {
        camposParcelas.classList.add('hidden');
        document.getElementById('quantidadeParcelas').value = '';
        document.getElementById('valorParcela').value = '';
        document.getElementById('dataPrimeiraParcela').value = '';
        document.getElementById('diaVencimento').value = '';
        document.getElementById('previewParcelas').classList.add('hidden');
    }
}

function calcularParcelas() {
    const quantidade = parseInt(document.getElementById('quantidadeParcelas').value);
    const valorParcela = parseFloat(document.getElementById('valorParcela').value);
    const dataPrimeira = document.getElementById('dataPrimeiraParcela').value;
    const diaVencimento = parseInt(document.getElementById('diaVencimento').value) || 15;
    
    if (!quantidade || !valorParcela || !dataPrimeira) {
        showNotification('Preencha todos os campos obrigatórios!', 'error');
        return;
    }
    
    const preview = document.getElementById('previewParcelas');
    const lista = document.getElementById('listaParcelas');
    
    let html = '';
    const dataInicio = new Date(dataPrimeira);
    
    for (let i = 1; i <= quantidade; i++) {
        const dataVencimento = new Date(dataInicio);
        dataVencimento.setMonth(dataVencimento.getMonth() + (i - 1));
        dataVencimento.setDate(diaVencimento);
        
        const dataFormatada = dataVencimento.toLocaleDateString('pt-BR');
        
        html += `
            <div class="flex justify-between items-center p-2 bg-gray-700/50 rounded-lg">
                <div class="flex items-center space-x-3">
                    <span class="text-blue-400 font-semibold">${i}ª</span>
                    <span class="text-white">${dataFormatada}</span>
                </div>
                <span class="text-green-400 font-bold">R$ ${valorParcela.toFixed(2).replace('.', ',')}</span>
            </div>
        `;
    }
    
    lista.innerHTML = html;
    preview.classList.remove('hidden');
}

// ===== CUSTOS FIXOS MENSAIS =====

async function salvarCustoFixo() {
    const descricao = document.getElementById('descricaoCustoFixo').value.trim();
    const tipo = document.getElementById('tipoCustoFixo').value;
    const valorMensal = parseFloat(document.getElementById('valorMensalCustoFixo').value);
    const dataInicio = document.getElementById('dataInicioCustoFixo').value;
    const dataFim = document.getElementById('dataFimCustoFixo').value;
    const status = document.getElementById('statusCustoFixo').value;
    const observacoes = document.getElementById('observacoesCustoFixo').value.trim();
    
    if (!descricao || !tipo || !valorMensal || !dataInicio) {
        showNotification('Preencha todos os campos obrigatórios!', 'error');
        return;
    }
    
    try {
        const formData = new FormData();
        formData.append('descricao', descricao);
        formData.append('tipo_custo', tipo);
        formData.append('valor_mensal', valorMensal);
        formData.append('data_inicio', dataInicio);
        formData.append('data_fim', dataFim);
        formData.append('status', status);
        formData.append('observacoes', observacoes);
        
        const response = await fetch('/login/custos-fixos/', {
            method: 'POST',
            body: formData,
            headers: {
                'X-CSRFToken': document.querySelector('[name=csrfmiddlewaretoken]').value,
                'X-Requested-With': 'XMLHttpRequest'
            }
        });
        
        if (response.ok) {
            const result = await response.json();
            if (result.success) {
                showNotification(result.message, 'success');
                limparFormularioCustoFixo();
                carregarCustosFixos();
            } else {
                showNotification(result.message, 'error');
            }
        } else {
            showNotification('Erro ao salvar custo fixo!', 'error');
        }
    } catch (error) {
        console.error('Erro ao salvar custo fixo:', error);
        showNotification('Erro ao salvar custo fixo!', 'error');
    }
}

async function carregarCustosFixos() {
    try {
        const response = await fetch('/login/custos-fixos/');
        if (response.ok) {
            const result = await response.json();
            atualizarListaCustosFixos(result.custos_fixos || []);
        }
    } catch (error) {
        console.error('Erro ao carregar custos fixos:', error);
    }
}

function atualizarListaCustosFixos(custosFixos) {
    const container = document.getElementById('listaCustosFixos');
    
    if (custosFixos.length === 0) {
        container.innerHTML = '<p class="text-gray-400 text-center py-4">Nenhum custo fixo cadastrado</p>';
        return;
    }
    
    let html = '';
    custosFixos.forEach(custo => {
        const statusClass = custo.status === 'ativo' ? 'bg-green-600/30 text-green-300' : 
                          custo.status === 'inativo' ? 'bg-yellow-600/30 text-yellow-300' : 
                          'bg-red-600/30 text-red-300';
        
        html += `
            <div class="bg-gray-700/30 rounded-lg p-4 border border-gray-600/30">
                <div class="flex justify-between items-start">
                    <div class="flex-1">
                        <h5 class="text-white font-semibold">${custo.descricao}</h5>
                        <p class="text-gray-300 text-sm">${custo.tipo_custo_display}</p>
                        <p class="text-green-400 font-bold">R$ ${parseFloat(custo.valor_mensal).toFixed(2).replace('.', ',')}/mês</p>
                        <p class="text-gray-400 text-xs">Início: ${custo.data_inicio} ${custo.data_fim ? `| Fim: ${custo.data_fim}` : ''}</p>
                    </div>
                    <div class="flex items-center space-x-2">
                        <span class="px-2 py-1 rounded text-xs ${statusClass}">${custo.status_display}</span>
                        <button onclick="editarCustoFixo(${custo.id})" class="text-blue-400 hover:text-blue-300">✏️</button>
                        <button onclick="excluirCustoFixo(${custo.id})" class="text-red-400 hover:text-red-300">🗑️</button>
                    </div>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

function editarCustoFixo(custoId) {
    // Buscar custo fixo na lista
    carregarCustosFixos().then(() => {
        // Implementar edição de custo fixo
        showNotification('Funcionalidade de edição em desenvolvimento!', 'info');
    });
}

async function excluirCustoFixo(custoId) {
    if (confirm('Tem certeza que deseja excluir este custo fixo?')) {
        try {
            const response = await fetch(`/login/excluir-custo-fixo/${custoId}/`, {
                method: 'POST',
                headers: {
                    'X-CSRFToken': getCookie('csrftoken'),
                    'Content-Type': 'application/json',
                },
            });
            
            if (response.ok) {
                const result = await response.json();
                showNotification(result.message || 'Custo fixo excluído com sucesso!', 'success');
                
                // Recarregar lista de custos fixos
                carregarCustosFixos();
            } else {
                const result = await response.json();
                showNotification(result.message || 'Erro ao excluir custo fixo!', 'error');
            }
        } catch (error) {
            console.error('Erro ao excluir custo fixo:', error);
            showNotification('Erro ao excluir custo fixo!', 'error');
        }
    }
}

// ===== SALVAMENTO =====

async function salvarRelatorioNoServidor(reportData, isEdit) {
    try {
        const formData = new FormData();
        
        formData.append('data_viagem', reportData.date);
        formData.append('partida', reportData.localPartida);
        formData.append('chegada', reportData.localChegada);
        formData.append('diarias', reportData.quantidadeDiarias);
        formData.append('litros_gasolina', reportData.litrosGasolina);
        formData.append('gasto_gasolina', reportData.valorGasolina);
        formData.append('receita_frete', reportData.receita);
        formData.append('motorista', reportData.nomeMotorista);
        formData.append('caminhao', reportData.nomeCaminhao);
        formData.append('salario_base', reportData.salarioBase);
        formData.append('bonus_viagens', reportData.bonusViagens);
        formData.append('desconto_faltas', reportData.descontoFaltas);
        
        custosGeraisRelatorio.forEach((custo, index) => {
            formData.append(`custo_${index}_tipo_gasto`, custo.tipo);
            formData.append(`custo_${index}_oficina_fornecedor`, custo.oficina || '');
            formData.append(`custo_${index}_descricao`, custo.descricao || '');
            formData.append(`custo_${index}_valor`, custo.valor || '0');
            formData.append(`custo_${index}_forma_pagamento`, custo.formaPagamento || 'vista');
            formData.append(`custo_${index}_status_pagamento`, custo.statusPagamento || 'pago');
        });
        
        const editReportId = document.getElementById('editReportId').value;
        const isEdit = editReportId && editReportId !== '';
        const url = isEdit ? `/login/atualizar-relatorio/${editReportId}/` : '/login/cadastrar-viagem/';
        
        const response = await fetch(url, {
            method: 'POST',
            body: formData,
            headers: {
                'X-CSRFToken': document.querySelector('[name=csrfmiddlewaretoken]').value,
                'X-Requested-With': 'XMLHttpRequest'
            }
        });
        
        if (response.ok) {
            const result = await response.json();
            if (result.success) {
                showNotification(result.message, 'success');
                closeReportModal();
                limparFormularioViagem();
                await carregarRelatoriosDoServidor();
                updateWeekSummary();
                updateMonthSummary();
                updatePreviousReportsList();
            } else {
                showNotification(result.message, 'error');
            }
        } else {
            showNotification('Erro ao salvar relatório!', 'error');
        }
    } catch (error) {
        console.error('Erro ao salvar relatório:', error);
        showNotification('Erro ao salvar relatório!', 'error');
    }
}

// ===== UTILITÁRIOS =====

function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            if (cookie.substring(0, name.length + 1) === (name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
}

function showNotification(message, type) {
    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg transition-all duration-300 ${
        type === 'success' ? 'bg-green-600 text-white' :
        type === 'error' ? 'bg-red-600 text-white' :
        type === 'info' ? 'bg-blue-600 text-white' :
        'bg-gray-600 text-white'
    }`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR');
}

function getTipoDisplay(tipo) {
    const statusMap = {
        'manutencao': 'Manutenção',
        'combustivel': 'Combustível',
        'pedagio': 'Pedágio',
        'alimentacao': 'Alimentação',
        'hospedagem': 'Hospedagem',
        'outros': 'Outros'
    };
    return statusMap[tipo] || tipo;
}

// ===== FUNÇÕES ADICIONAIS =====

function updatePreviousReportsList() {
    // Atualizar lista de relatórios anteriores
    // Esta função é chamada quando os relatórios são carregados
    // A lista é atualizada automaticamente pela função mostrarResultadosBusca
    if (reports.length > 0) {
        // Se houver uma seção específica para relatórios anteriores, atualizar aqui
        const container = document.getElementById('relatoriosAnteriores');
        if (container) {
            container.innerHTML = `
                <div class="text-center text-gray-400 py-4">
                    ${reports.length} relatório(s) encontrado(s)
                </div>
            `;
        }
    }
}

function atualizarTodasAsSecoes() {
    updateWeekSummary();
    updateMonthSummary();
    updatePreviousReportsList();
}

// ===== INICIALIZAÇÃO =====

document.addEventListener('DOMContentLoaded', function() {
    carregarRelatoriosDoServidor();
    
    const inputs = ['dataViagem', 'localPartida', 'localChegada', 'quantidadeDiarias', 
                   'litrosGasolina', 'valorGasolina', 'nomeMotorista', 'nomeCaminhao', 
                   'receita', 'salario_base', 'bonus_viagens', 'desconto_faltas'];
    
    inputs.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener('input', updateReportPreview);
        }
    });
    
    document.getElementById('quantidadeDiarias').addEventListener('input', calcularDiarias);
    document.getElementById('valorGasolina').addEventListener('input', calcularGastosViagem);
    document.getElementById('salario_base').addEventListener('input', calcularSalarioMotorista);
    document.getElementById('bonus_viagens').addEventListener('input', calcularSalarioMotorista);
    document.getElementById('desconto_faltas').addEventListener('input', calcularSalarioMotorista);
    
    // Event listener para o formulário de relatório
    const reportForm = document.getElementById('reportForm');
    if (reportForm) {
        reportForm.addEventListener('submit', function(e) {
            e.preventDefault();
            salvarRelatorio();
        });
    }
});
