// ===== DADOS GLOBAIS =====
let reports = [];
let currentWeekData = { gastos: 0, lucros: 0, lucroLiquido: 0 };
let custosGeraisRelatorio = [];
function setTextIfPresent(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
}

// ===== FUNÇÕES PRINCIPAIS =====

// Função para buscar relatório por data específica
function buscarRelatorioPorData() {
    const dataEspecifica = document.getElementById('dataEspecifica').value;
    
    if (!dataEspecifica) {
        showNotification('Selecione uma data específica!', 'error');
        return;
    }
    
    // Formatar data para exibição (corrigir problema de fuso horário)
    const dataFormatada = new Date(dataEspecifica + 'T00:00:00').toLocaleDateString('pt-BR');
    
    // Obter CSRF token
    const csrfToken = getCSRFToken();
    if (!csrfToken) {
        console.error('CSRF token não encontrado');
        showNotification('Erro: Token CSRF não encontrado', 'error');
        return;
    }
    
    console.log('Buscando relatórios para data:', dataEspecifica);
    
    // Buscar dados do servidor
    fetch('/login/buscar-relatorios-periodo/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': csrfToken
        },
        body: JSON.stringify({
            data_inicio: dataEspecifica,
            data_fim: dataEspecifica
        })
    })
    .then(response => {
        console.log('Resposta do servidor:', response.status);
        return response.json();
    })
    .then(data => {
        console.log('Dados recebidos:', data);
        if (data.success) {
            mostrarResultadosBusca(data, dataFormatada);
        } else {
            mostrarErroBusca(data.error || 'Erro ao buscar relatórios');
        }
    })
    .catch(error => {
        console.error('Erro ao buscar relatórios:', error);
        mostrarErroBusca('Erro de conexão ao buscar relatórios');
    });
}

// Carregar relatórios do servidor
async function carregarRelatoriosDoServidor() {
    try {
        const response = await fetch('/login/listar-relatorios/');
        
        if (response.ok) {
            const data = await response.json();
            reports = data.relatorios || [];
            
            // Usar requestAnimationFrame para atualizações
            requestAnimationFrame(() => {
                updateWeekSummary();
                updateMonthSummary();
                updatePreviousReportsList();
            });
        } else {
            console.error('Erro ao carregar relatórios:', response.status);
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
    
    setTextIfPresent('totalLucrosSemanal', `R$ ${totalLucros.toFixed(2).replace('.', ',')}`);
    setTextIfPresent('totalGastosSemanal', `R$ ${totalGastos.toFixed(2).replace('.', ',')}`);
    setTextIfPresent('lucroLiquidoSemanal', `R$ ${lucroLiquido.toFixed(2).replace('.', ',')}`);
    setTextIfPresent('mediaDiariaSemanal', `R$ ${mediaDiaria.toFixed(2).replace('.', ',')}`);
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
    
    setTextIfPresent('totalLucrosMensal', `R$ ${totalLucros.toFixed(2).replace('.', ',')}`);
    setTextIfPresent('totalGastosMensal', `R$ ${totalGastos.toFixed(2).replace('.', ',')}`);
    setTextIfPresent('lucroLiquidoMensal', `R$ ${lucroLiquido.toFixed(2).replace('.', ',')}`);
    setTextIfPresent('mediaDiariaMensal', `R$ ${mediaDiaria.toFixed(2).replace('.', ',')}`);
}

// ===== NAVEGAÇÃO =====

function irParaRelatorioDiario() {
    window.location.href = '/login/relatorio-diario/';
}

function irParaRelatorioSemanal() {
    window.location.href = '/login/relatorio-semanal/';
}

function irParaRelatorioMensal() {
    window.location.href = '/login/relatorio-mensal/';
}

// ===== FUNÇÕES DE BUSCA E FILTROS =====

function showPreviousReports() {
    // Esta função não é mais usada, mantida para compatibilidade
    console.log('showPreviousReports chamada - função obsoleta');
}

// Função removida - movida para o início do arquivo

// Função para mostrar erro na busca
function mostrarErroBusca(mensagem) {
    const resultadosDiv = document.getElementById('resultadosBusca');
    if (resultadosDiv) {
        resultadosDiv.innerHTML = `
            <div class="glass-effect rounded-2xl p-8 animate-slide-up border border-red-500/30 mb-8">
                <h3 class="text-2xl font-bold text-white mb-6">❌ Erro na Busca</h3>
                <div class="text-center text-red-400 py-8">
                    <span class="text-4xl">⚠️</span>
                    <p class="mt-4 text-lg">${mensagem}</p>
                </div>
            </div>
        `;
        resultadosDiv.classList.remove('hidden');
    }
}


// ===== FUNÇÕES DE AÇÕES RÁPIDAS =====

function mostrarRelatoriosHoje() {
    try {
        console.log('Mostrando relatórios de hoje...');
        const hoje = new Date().toISOString().split('T')[0];
        console.log('Data de hoje:', hoje);
        
        // Obter CSRF token de forma mais robusta
        const csrfToken = getCSRFToken();
        if (!csrfToken) {
            console.error('CSRF token não encontrado');
            showNotification('Erro: Token CSRF não encontrado', 'error');
            return;
        }
        console.log('CSRF token encontrado:', csrfToken);
        
        // Buscar dados do servidor
        fetch('/login/buscar-relatorios-periodo/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrfToken
            },
            body: JSON.stringify({
                data_inicio: hoje,
                data_fim: hoje
            })
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            return response.json();
        })
        .then(data => {
            console.log('Dados recebidos:', data);
            if (data.success) {
                console.log('Chamando mostrarResultadosBusca com:', data.relatorios);
                mostrarResultadosBusca(data, 'Período');
            } else {
                console.error('Erro do servidor:', data.error);
                showNotification(`Erro: ${data.error || 'Erro desconhecido'}`, 'error');
            }
        })
        .catch(error => {
            console.error('Erro na requisição:', error);
            showNotification(`Erro ao carregar relatórios: ${error.message}`, 'error');
        });
    } catch (error) {
        console.error('Erro em mostrarRelatoriosHoje:', error);
        showNotification('Erro ao carregar relatórios de hoje', 'error');
    }
}

function mostrarRelatoriosSemana() {
    try {
        console.log('Mostrando relatórios da semana...');
        const hoje = new Date();
        const inicioSemana = new Date(hoje);
        inicioSemana.setDate(hoje.getDate() - hoje.getDay());
        
        const dataInicio = inicioSemana.toISOString().split('T')[0];
        const dataFim = hoje.toISOString().split('T')[0];
        console.log('Período da semana:', dataInicio, 'a', dataFim);
        
        // Obter CSRF token de forma mais robusta
        const csrfToken = getCSRFToken();
        if (!csrfToken) {
            console.error('CSRF token não encontrado');
            showNotification('Erro: Token CSRF não encontrado', 'error');
            return;
        }
        
        // Buscar dados do servidor
        fetch('/login/buscar-relatorios-periodo/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrfToken
            },
            body: JSON.stringify({
                data_inicio: dataInicio,
                data_fim: dataFim
            })
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            return response.json();
        })
        .then(data => {
            console.log('Dados recebidos:', data);
            if (data.success) {
                console.log('Chamando mostrarResultadosBusca com:', data.relatorios);
                mostrarResultadosBusca(data, 'Período');
            } else {
                console.error('Erro do servidor:', data.error);
                showNotification(`Erro: ${data.error || 'Erro desconhecido'}`, 'error');
            }
        })
        .catch(error => {
            console.error('Erro na requisição:', error);
            showNotification(`Erro ao carregar relatórios: ${error.message}`, 'error');
        });
    } catch (error) {
        console.error('Erro em mostrarRelatoriosSemana:', error);
        showNotification('Erro ao carregar relatórios da semana', 'error');
    }
}

function mostrarRelatoriosMes() {
    try {
        console.log('Mostrando relatórios do mês...');
        const hoje = new Date();
        const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
        
        const dataInicio = inicioMes.toISOString().split('T')[0];
        const dataFim = hoje.toISOString().split('T')[0];
        console.log('Período do mês:', dataInicio, 'a', dataFim);
        
        // Obter CSRF token de forma mais robusta
        const csrfToken = getCSRFToken();
        if (!csrfToken) {
            console.error('CSRF token não encontrado');
            showNotification('Erro: Token CSRF não encontrado', 'error');
            return;
        }
        
        // Buscar dados do servidor
        fetch('/login/buscar-relatorios-periodo/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrfToken
            },
            body: JSON.stringify({
                data_inicio: dataInicio,
                data_fim: dataFim
            })
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            return response.json();
        })
        .then(data => {
            console.log('Dados recebidos:', data);
            if (data.success) {
                console.log('Chamando mostrarResultadosBusca com:', data.relatorios);
                mostrarResultadosBusca(data, 'Período');
            } else {
                console.error('Erro do servidor:', data.error);
                showNotification(`Erro: ${data.error || 'Erro desconhecido'}`, 'error');
            }
        })
        .catch(error => {
            console.error('Erro na requisição:', error);
            showNotification(`Erro ao carregar relatórios: ${error.message}`, 'error');
        });
    } catch (error) {
        console.error('Erro em mostrarRelatoriosMes:', error);
        showNotification('Erro ao carregar relatórios do mês', 'error');
    }
}

// ===== MODAIS =====

function openReportModal() {
    try {
        console.log('=== ABRINDO MODAL DE RELATÓRIO ===');
        console.log('Chamando limparFormularioViagem...');
        limparFormularioViagem();
        
        console.log('Buscando elemento reportModal...');
        const modal = document.getElementById('reportModal');
        console.log('Elemento reportModal encontrado:', modal);
        
        if (modal) {
            console.log('Removendo classe hidden do modal...');
            modal.classList.remove('hidden');
            console.log('Modal deve estar visível agora');
        } else {
            console.error('Elemento reportModal não encontrado!');
        }
        
        console.log('Buscando campo dataViagem...');
        const dataField = document.getElementById('dataViagem');
        console.log('Campo dataViagem encontrado:', dataField);
        
        if (dataField) {
            const today = new Date().toISOString().split('T')[0];
            console.log('Definindo data para hoje:', today);
            dataField.value = today;
        } else {
            console.error('Campo dataViagem não encontrado!');
        }
        
        console.log('Chamando updateReportPreview...');
        updateReportPreview();
        console.log('=== MODAL DE RELATÓRIO ABERTO ===');
    } catch (error) {
        console.error('Erro ao abrir modal de relatório:', error);
    }
}

function closeReportModal() {
    document.getElementById('reportModal').classList.add('hidden');
}

function openCustosFixosModal() {
    document.getElementById('custosFixosModal').classList.remove('hidden');
}

function closeCustosFixosModal() {
    const modal = document.getElementById('custosFixosModal');
    if (modal) {
        modal.classList.add('hidden');
        console.log('Modal de custos fixos fechado');
    }
    limparFormularioCustoFixo();
}

// ===== FUNÇÕES DE RELATÓRIOS =====

function salvarRelatorio() {
    const form = document.getElementById('reportForm');
    const formData = new FormData(form);
    
    
    // Validar campos obrigatórios
    const camposObrigatorios = ['dataViagem', 'localPartida', 'localChegada', 'quantidadeDiarias', 'litrosGasolina', 'valorGasolina', 'nomeMotorista', 'nomeCaminhao'];
    const nomesCampos = {
        dataViagem: 'Data da viagem', localPartida: 'Local de partida', localChegada: 'Local de chegada',
        quantidadeDiarias: 'Quantidade de diárias', litrosGasolina: 'Litros de óleo diesel',
        valorGasolina: 'Valor gasto com óleo diesel', nomeMotorista: 'Nome do motorista', nomeCaminhao: 'Nome do caminhão'
    };
    for (const campo of camposObrigatorios) {
        const elemento = document.getElementById(campo);
        if (!elemento || !elemento.value.trim()) {
            showNotification(`${nomesCampos[campo]} é obrigatório.`, 'error');
            elemento?.focus();
            return;
        }
    }
    
    // Coletar dados do formulário com validação para evitar NaN
    const parseFloatSafe = (value) => {
        const parsed = parseFloat(value);
        return isNaN(parsed) ? 0 : parsed;
    };
    
    // Validar e formatar data
    const dataViagem = formData.get('dataViagem');
    
    // Também verificar diretamente do elemento
    const dataElement = document.getElementById('dataViagem');
    const dataValue = dataElement ? dataElement.value : '';
    
    // Usar o valor do elemento se o FormData estiver vazio
    const dataFinal = dataViagem || dataValue;
    
    
    if (!dataFinal || dataFinal.trim() === '') {
        showNotification('Data da viagem é obrigatória!', 'error');
        if (dataElement) dataElement.focus();
        return;
    }
    
    // Verificar se a data está no formato correto
    const dataRegex = /^\d{4}-\d{2}-\d{2}$/;
    const isValidFormat = dataRegex.test(dataFinal);
    
    if (!isValidFormat) {
        showNotification(`Formato de data inválido. Use YYYY-MM-DD. Recebido: "${dataFinal}"`, 'error');
        if (dataElement) dataElement.focus();
        return;
    }
    
    const reportData = {
        date: dataFinal,  // Corrigido: usar 'date' em vez de 'data'
        localPartida: formData.get('localPartida'),
        localChegada: formData.get('localChegada'),
        quantidadeDiarias: parseFloatSafe(formData.get('quantidadeDiarias')),
        litrosGasolina: parseFloatSafe(formData.get('litrosGasolina')),
        valorGasolina: parseFloatSafe(formData.get('valorGasolina')),
        nomeMotorista: formData.get('nomeMotorista'),
        nomeCaminhao: formData.get('nomeCaminhao'),
        receita: parseFloatSafe(formData.get('receita') || 0),
        salarioBase: parseFloatSafe(formData.get('salario_base') || 0),  // Corrigido: usar camelCase
        bonusViagens: parseFloatSafe(formData.get('bonus_viagens') || 0),  // Corrigido: usar camelCase
        descontoFaltas: parseFloatSafe(formData.get('desconto_faltas') || 0),  // Corrigido: usar camelCase
        custosGerais: custosGeraisRelatorio
    };
    
    // Verificar se é edição
    const editId = document.getElementById('editReportId').value;
    const isEdit = editId && editId !== '';
    
    // Salvar no servidor
    salvarRelatorioNoServidor(reportData, isEdit);
}

function viewReportSummary(reportId) {
    console.log('=== VIEW REPORT SUMMARY ===');
    console.log('Report ID:', reportId);
    console.log('Reports array:', reports);
    
    // Usar requestAnimationFrame para evitar bloqueios
    requestAnimationFrame(() => {
        const report = reports.find(r => r.id === reportId);
        
        if (!report) {
            console.error('Relatório não encontrado no array. ID:', reportId);
            showNotification('Relatório não encontrado! Recarregue a página.', 'error');
            return;
        }
        
        console.log('Relatório encontrado:', report);
        
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
                                <div class="flex justify-between items-center mb-4">
                                    <div>
                                        <p class="text-white font-semibold">🔧 Custos Gerais</p>
                                        <p class="text-gray-300 text-sm">Manutenção, pedágios, multas, etc.</p>
                                        <p class="text-gray-400 text-xs">Gastos diversos relacionados à viagem</p>
                                    </div>
                                    <span class="text-red-400 font-bold text-xl">R$ ${(report.totalCustosGerais || 0).toFixed(2).replace('.', ',')}</span>
                                </div>
                                
                                <!-- Lista simples de custos gerais -->
                                <div class="space-y-2">
                                    ${(report.todasParcelas && report.todasParcelas.length > 0) ? 
                                        report.todasParcelas.map(custo => `
                                            <div class="flex justify-between items-center bg-gray-600/30 rounded-lg p-3">
                                                <div class="flex-1">
                                                    <p class="text-white font-medium">${custo.tipo_gasto || 'Tipo não informado'}</p>
                                                    <p class="text-gray-300 text-sm">${custo.descricao || 'Sem descrição'}</p>
                                                    <div class="flex gap-2 mt-1">
                                                        <span class="text-gray-400 text-xs">🏪 ${custo.oficina_fornecedor || 'N/A'}</span>
                                                        <span class="text-gray-400 text-xs">🚛 ${custo.veiculo_placa || 'N/A'}</span>
                                                        <span class="text-gray-400 text-xs">📅 ${custo.data_vencimento}</span>
                                                    </div>
                                                </div>
                                                <div class="text-right">
                                                    <p class="text-red-400 font-bold">R$ ${custo.valor_parcela.toFixed(2).replace('.', ',')}</p>
                                                    <span class="px-2 py-1 text-xs rounded ${custo.paga ? 'bg-green-600/30 text-green-300' : 'bg-yellow-600/30 text-yellow-300'}">${custo.status_pagamento || 'Pendente'}</span>
                                                </div>
                                            </div>
                                        `).join('') : 
                                        '<div class="text-center text-gray-400 py-4"><p>Nenhum custo geral registrado</p></div>'
                                    }
                                </div>
                            </div>
                            
                            <!-- Seção de Parcelas -->
                            <div class="bg-gray-700/30 rounded-lg p-4">
                                <div class="flex justify-between items-center mb-4">
                                    <div>
                                        <p class="text-white font-semibold text-lg">📋 Custos e Parcelas</p>
                                        <p class="text-gray-300 text-sm">Todos os custos da viagem</p>
                                    </div>
                                    <div class="text-right">
                                        <p class="text-white font-bold text-xl">${report.todasParcelas ? report.todasParcelas.length : 0} itens</p>
                                    </div>
                                </div>
                                
                                
                                <!-- Lista de parcelas -->
                                <div class="space-y-3" id="parcelas-container">
                                    ${report.todasParcelas && report.todasParcelas.length > 0 ? 
                                        report.todasParcelas.map(parcela => `
                                            <div class="bg-gray-600/30 rounded-lg p-3 ${parcela.paga ? 'border-l-4 border-green-500' : 'border-l-4 border-yellow-500'}">
                                                <div class="flex justify-between items-center">
                                                    <div class="flex-1">
                                                        <p class="text-white font-medium">${parcela.tipo_gasto || 'Custo'}</p>
                                                        <p class="text-gray-300 text-sm">${parcela.descricao || 'Sem descrição'}</p>
                                                        <div class="flex gap-2 mt-1">
                                                            <span class="text-gray-400 text-xs">🏪 ${parcela.oficina_fornecedor || 'N/A'}</span>
                                                            <span class="text-gray-400 text-xs">🚛 ${parcela.veiculo_placa || 'N/A'}</span>
                                                            <span class="text-gray-400 text-xs">📅 ${parcela.data_vencimento}</span>
                                                        </div>
                                                    </div>
                                                    <div class="text-right">
                                                        <p class="text-white font-bold text-lg">R$ ${parcela.valor_parcela.toFixed(2).replace('.', ',')}</p>
                                                        <span class="px-2 py-1 text-xs rounded ${parcela.paga ? 'bg-green-600/30 text-green-300' : 'bg-yellow-600/30 text-yellow-300'}">${parcela.status_pagamento}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        `).join('') : 
                                        '<div class="text-center text-gray-400 py-4"><p>Nenhum custo registrado</p></div>'
                                    }
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
                    <div class="flex flex-col sm:flex-row justify-end gap-2 sm:gap-4">
                        <button onclick="closeReportDetailsModal()" class="bg-gray-600 hover:bg-gray-700 text-white px-3 py-1.5 rounded-lg font-semibold transition-colors text-sm mobile-touch-target w-full sm:w-auto">
                            Fechar
                        </button>
                        <button onclick="editReport(${report.id}); closeReportDetailsModal();" class="bg-yellow-600 hover:bg-yellow-700 text-white px-3 py-1.5 rounded-lg font-semibold transition-colors text-sm mobile-touch-target w-full sm:w-auto">
                            ✏️ Editar
                        </button>
                        <button onclick="deleteReport(${report.id}); closeReportDetailsModal();" class="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg font-semibold transition-colors text-sm mobile-touch-target w-full sm:w-auto">
                            🗑️ Excluir
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Adicionar modal ao body
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    });
}

function closeReportDetailsModal() {
    const modal = document.getElementById('reportDetailsModal');
    if (modal) {
        modal.remove();
    }
}

function editReport(reportId) {
    if (!reportId || isNaN(reportId) || reportId <= 0) {
        showNotification('ID do relatório inválido', 'error');
        return;
    }
    
    showNotification('Carregando página de edição...', 'info');
    window.location.href = `/login/atualizar-relatorio/${reportId}/`;
}

async function deleteReport(reportId) {
    if (confirm('Tem certeza que deseja excluir este relatório?')) {
        try {
            const csrfToken = getCSRFToken();
            
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
                // Mostrar apenas mensagem de sucesso
                showNotification('Relatório excluído com sucesso!', 'success');
                
                // Remover da lista local
                reports = reports.filter(r => r.id !== reportId);
                
                // Atualizar resumos
                updateWeekSummary();
                updateMonthSummary();
                
                // Atualizar resultados de busca se estiverem visíveis
                const resultadosBusca = document.getElementById('resultadosBusca');
                if (resultadosBusca && !resultadosBusca.classList.contains('hidden')) {
                    // Recarregar todos os relatórios do servidor para garantir consistência
                    await carregarRelatoriosDoServidor();
                }
            } else {
                // Apenas log do erro, sem mostrar mensagem para o usuário
                console.log('Erro na exclusão:', response.status);
            }
        } catch (error) {
            // Apenas log do erro, sem mostrar mensagem para o usuário
            console.log('Erro na exclusão:', error);
        }
    }
}

// ===== FORMULÁRIOS =====

function limparFormularioViagem() {
    const setValueIfExists = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.value = value;
    };

    setValueIfExists('dataViagem', new Date().toISOString().split('T')[0]);
    setValueIfExists('localPartida', '');
    setValueIfExists('localChegada', '');
    setValueIfExists('quantidadeDiarias', '');
    setValueIfExists('litrosGasolina', '');
    setValueIfExists('valorGasolina', '');
    setValueIfExists('nomeMotorista', '');
    setValueIfExists('nomeCaminhao', '');
    setValueIfExists('receita', '');
    setValueIfExists('editReportId', '');
    setValueIfExists('smartPasteInput', '');

    const smartPasteStatus = document.getElementById('smartPasteStatus');
    if (smartPasteStatus) {
        smartPasteStatus.className = 'smart-paste-status';
        smartPasteStatus.textContent = 'Ao colar, o preenchimento acontece automaticamente.';
    }

    custosGeraisRelatorio = [];
    if (typeof atualizarListaCustosGerais === 'function') {
        atualizarListaCustosGerais();
    }
    // Só limpar o formulário de custo se os campos existirem
    if (document.getElementById('tipoGasto')) {
        limparFormularioCusto();
    }
}

function limparFormularioCustoFixo() {
    document.getElementById('custoFixoForm').reset();
}

// ===== CÁLCULOS =====

// Debounce para updateReportPreview
let updatePreviewTimeout;
function debouncedUpdateReportPreview() {
    clearTimeout(updatePreviewTimeout);
    updatePreviewTimeout = setTimeout(() => {
        updateReportPreview();
    }, 150);
}

function calcularDiarias() {
    const quantidade = parseInt(document.getElementById('quantidadeDiarias').value) || 0;
    const valorDiaria = 70.00;
    const total = quantidade * valorDiaria;
    
    const totalDiariasElement = document.getElementById('totalDiarias');
    if (totalDiariasElement) {
        totalDiariasElement.textContent = `R$ ${total.toFixed(2).replace('.', ',')}`;
    }
    
    debouncedUpdateReportPreview();
}

function calcularGastosViagem() {
    const gasolina = parseFloat(document.getElementById('valorGasolina').value) || 0;
    const diarias = parseInt(document.getElementById('quantidadeDiarias').value) || 0;
    const totalDiarias = diarias * 70.00;
    const total = gasolina + totalDiarias;
    
    const totalGastosViagemElement = document.getElementById('totalGastosViagem');
    if (totalGastosViagemElement) {
        totalGastosViagemElement.textContent = `R$ ${total.toFixed(2).replace('.', ',')}`;
    }
    
    debouncedUpdateReportPreview();
}

function calcularSalarioMotorista() {
    const salarioBase = parseFloat(document.getElementById('salario_base').value) || 0;
    const bonus = parseFloat(document.getElementById('bonus_viagens').value) || 0;
    const desconto = parseFloat(document.getElementById('desconto_faltas').value) || 0;
    const salarioLiquido = salarioBase + bonus - desconto;
    
    const salarioLiquidoElement = document.getElementById('salarioLiquido');
    if (salarioLiquidoElement) {
        salarioLiquidoElement.textContent = `R$ ${salarioLiquido.toFixed(2).replace('.', ',')}`;
    }
    
    debouncedUpdateReportPreview();
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
    
    // Atualizar preview apenas se os elementos existirem
    const previewDataViagem = document.getElementById('previewDataViagem');
    if (previewDataViagem) previewDataViagem.textContent = dataViagem || 'Não informado';
    
    const previewLocalPartida = document.getElementById('previewLocalPartida');
    if (previewLocalPartida) previewLocalPartida.textContent = localPartida || 'Não informado';
    
    const previewLocalChegada = document.getElementById('previewLocalChegada');
    if (previewLocalChegada) previewLocalChegada.textContent = localChegada || 'Não informado';
    
    const previewQuantidadeDiarias = document.getElementById('previewQuantidadeDiarias');
    if (previewQuantidadeDiarias) previewQuantidadeDiarias.textContent = quantidadeDiarias;
    
    const previewTotalDiarias = document.getElementById('previewTotalDiarias');
    if (previewTotalDiarias) previewTotalDiarias.textContent = `R$ ${totalDiarias.toFixed(2).replace('.', ',')}`;
    
    const previewLitrosGasolina = document.getElementById('previewLitrosGasolina');
    if (previewLitrosGasolina) previewLitrosGasolina.textContent = litrosGasolina;
    
    const previewValorGasolina = document.getElementById('previewValorGasolina');
    if (previewValorGasolina) previewValorGasolina.textContent = `R$ ${valorGasolina.toFixed(2).replace('.', ',')}`;
    
    const previewNomeMotorista = document.getElementById('previewNomeMotorista');
    if (previewNomeMotorista) previewNomeMotorista.textContent = nomeMotorista || 'Não informado';
    
    const previewNomeCaminhao = document.getElementById('previewNomeCaminhao');
    if (previewNomeCaminhao) previewNomeCaminhao.textContent = nomeCaminhao || 'Não informado';
    
    const previewReceita = document.getElementById('previewReceita');
    if (previewReceita) previewReceita.textContent = `R$ ${receita.toFixed(2).replace('.', ',')}`;
    
    const previewTotalGastosViagem = document.getElementById('previewTotalGastosViagem');
    if (previewTotalGastosViagem) previewTotalGastosViagem.textContent = `R$ ${totalGastosViagem.toFixed(2).replace('.', ',')}`;
    // Atualizar preview dos custos gerais
    const previewCustosGerais = document.getElementById('previewTotalCustosGerais');
    if (previewCustosGerais) {
        previewCustosGerais.textContent = `R$ ${totalCustosGerais.toFixed(2).replace('.', ',')}`;
    }
    
    const previewSalarioLiquido = document.getElementById('previewSalarioLiquido');
    if (previewSalarioLiquido) {
        previewSalarioLiquido.textContent = `R$ ${salarioLiquido.toFixed(2).replace('.', ',')}`;
    }
    
    const previewTotalDespesas = document.getElementById('previewTotalDespesas');
    if (previewTotalDespesas) {
        previewTotalDespesas.textContent = `R$ ${totalDespesas.toFixed(2).replace('.', ',')}`;
    }
    
    const previewLucroLiquido = document.getElementById('previewLucroLiquido');
    if (previewLucroLiquido) {
        previewLucroLiquido.textContent = `R$ ${lucroLiquido.toFixed(2).replace('.', ',')}`;
    }
    
    // Atualizar resumo dos gastos no modal
    const resumoGastos = document.getElementById('resumoGastos');
    if (resumoGastos) {
        resumoGastos.innerHTML = `
            <div class="bg-gray-800/30 rounded-xl p-4 border border-gray-600/30">
                <h4 class="text-lg font-semibold text-white mb-3">💰 Resumo dos Gastos</h4>
                <div class="space-y-2">
                    <div class="flex justify-between items-center">
                        <span class="text-gray-300">⛽ Gasolina:</span>
                        <span class="text-red-400 font-semibold">R$ ${valorGasolina.toFixed(2).replace('.', ',')}</span>
                    </div>
                    <div class="flex justify-between items-center">
                        <span class="text-gray-300">🏨 Diárias (${quantidadeDiarias} dias):</span>
                        <span class="text-red-400 font-semibold">R$ ${totalDiarias.toFixed(2).replace('.', ',')}</span>
                    </div>
                    <div class="flex justify-between items-center">
                        <span class="text-gray-300">🔧 Custos Gerais:</span>
                        <span class="text-red-400 font-semibold">R$ ${totalCustosGerais.toFixed(2).replace('.', ',')}</span>
                    </div>
                    <div class="flex justify-between items-center">
                        <span class="text-gray-300">👨‍💼 Salário Motorista:</span>
                        <span class="text-red-400 font-semibold">R$ ${salarioLiquido.toFixed(2).replace('.', ',')}</span>
                    </div>
                    <hr class="border-gray-600">
                    <div class="flex justify-between items-center text-lg font-bold">
                        <span class="text-white">💸 Total de Gastos:</span>
                        <span class="text-red-300">R$ ${totalDespesas.toFixed(2).replace('.', ',')}</span>
                    </div>
                    <div class="flex justify-between items-center text-lg font-bold">
                        <span class="text-white">💰 Receita:</span>
                        <span class="text-green-400">R$ ${receita.toFixed(2).replace('.', ',')}</span>
                    </div>
                    <div class="flex justify-between items-center text-xl font-bold">
                        <span class="text-white">📈 Lucro Líquido:</span>
                        <span class="${lucroLiquido >= 0 ? 'text-green-400' : 'text-red-400'}">R$ ${lucroLiquido.toFixed(2).replace('.', ',')}</span>
                    </div>
                </div>
            </div>
        `;
    }
}

// ===== CUSTOS GERAIS =====

// Variável para controlar se está processando adição de custo
let processandoCusto = false;

function adicionarCustoGeral() {
    // Evitar múltiplas execuções simultâneas
    if (processandoCusto) {
        return;
    }
    
    processandoCusto = true;
    
    // Desabilitar botão durante processamento
    const btnAdicionarCusto = document.getElementById('btnAdicionarCusto');
    if (btnAdicionarCusto) {
        btnAdicionarCusto.disabled = true;
        btnAdicionarCusto.textContent = '⏳ Processando...';
    }
    
    try {
        const tipoGasto = document.getElementById('tipoGasto').value;
        const dataCusto = document.getElementById('dataCusto').value;
        const placaCusto = document.getElementById('placaCusto').value;
        const oficinaFornecedor = document.getElementById('oficinaFornecedor').value;
        const descricaoCusto = document.getElementById('descricaoCusto').value;
        const valorCusto = document.getElementById('valorCusto').value;
        const formaPagamento = document.getElementById('formaPagamento').value;
        const statusPagamento = document.getElementById('statusPagamento').value;
        const dataVencimento = document.getElementById('dataVencimento').value;
        

        // Validação mínima - apenas campos essenciais
        if (!tipoGasto || !descricaoCusto || !valorCusto) {
            showNotification('Preencha pelo menos: Tipo, Descrição e Valor!', 'error');
            processandoCusto = false;
            const btnAdicionarCusto = document.getElementById('btnAdicionarCusto');
            if (btnAdicionarCusto) {
                btnAdicionarCusto.disabled = false;
                btnAdicionarCusto.textContent = '➕ Adicionar Custo';
            }
            return;
        }

        const novoCusto = {
            id: Date.now(),
            tipo: tipoGasto,
            data: dataCusto || new Date().toISOString().split('T')[0],
            placa: placaCusto ? placaCusto.toUpperCase() : 'N/A',
            oficina: oficinaFornecedor || 'Não informado',
            descricao: descricaoCusto,
            valor: parseFloat(valorCusto),
            formaPagamento: formaPagamento || 'Não informado',
            statusPagamento: statusPagamento || 'Pendente',
            dataVencimento: dataVencimento || null,
            isNew: true
        };

        custosGeraisRelatorio.push(novoCusto);
        atualizarListaCustosGerais();
        limparFormularioCusto();
        
        // Atualizar preview com debounce para evitar loops
        debouncedUpdateReportPreview();
        
        showNotification('Custo adicionado com sucesso!', 'success');
        
    } catch (error) {
        console.error('Erro ao adicionar custo:', error);
        showNotification('Erro ao adicionar custo!', 'error');
    } finally {
        // Liberar o controle após um pequeno delay
        setTimeout(() => {
            processandoCusto = false;
            
            // Reabilitar botão
            const btnAdicionarCusto = document.getElementById('btnAdicionarCusto');
            if (btnAdicionarCusto) {
                btnAdicionarCusto.disabled = false;
                btnAdicionarCusto.textContent = '➕ Adicionar Custo';
            }
        }, 500);
    }
}

function atualizarListaCustosGerais() {
    const container = document.getElementById('listaCustosGeraisContent');
    
    if (!container) return;
    
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
    debouncedUpdateReportPreview();
    showNotification('Custo removido!', 'info');
}

function limparFormularioCusto() {
    const resetField = (id, value = '') => {
        const el = document.getElementById(id);
        if (el) el.value = value;
    };

    resetField('tipoGasto');
    resetField('dataCusto');
    resetField('placaCusto');
    resetField('oficinaFornecedor');
    resetField('descricaoCusto');
    resetField('valorCusto');
    resetField('formaPagamento');
    resetField('statusPagamento');
    resetField('dataVencimento');
}

// ===== PARCELAS =====



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
                'X-CSRFToken': getCSRFToken(),
                'X-Requested-With': 'XMLHttpRequest'
            }
        });
        
        if (response.ok) {
            const result = await response.json();
            if (result.success) {
                showNotification(result.message, 'success');
                limparFormularioCustoFixo();
                
                // Fechar o modal automaticamente
                console.log('Fechando modal de custos fixos...');
                closeCustosFixosModal();
                
                // Atualizar automaticamente todos os dados da tela
                await atualizarDashboardCompleto();
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
            const csrfToken = getCSRFToken();
            if (!csrfToken) {
                showNotification('Erro de autenticação. Faça login novamente.', 'error');
                return;
            }
            
            const response = await fetch(`/login/excluir-custo-fixo/${custoId}/`, {
                method: 'POST',
                headers: {
                    'X-CSRFToken': csrfToken,
                    'Content-Type': 'application/json',
                },
            });
            
            if (response.ok) {
                const result = await response.json();
                showNotification(result.message || 'Custo fixo excluído com sucesso!', 'success');
                
                // Atualizar automaticamente todos os dados da tela
                await atualizarDashboardCompleto();
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
    const form = document.getElementById('reportForm');
    const submitButton = form?.querySelector('button[type="submit"]');
    try {
        if (submitButton) submitButton.disabled = true;
        const formData = new FormData();
        
        // Enviar tanto data_viagem quanto dataViagem para compatibilidade
        formData.append('data_viagem', reportData.date);
        formData.append('dataViagem', reportData.date);
        
        formData.append('partida', reportData.localPartida);
        formData.append('localPartida', reportData.localPartida);
        formData.append('chegada', reportData.localChegada);
        formData.append('localChegada', reportData.localChegada);
        formData.append('diarias', reportData.quantidadeDiarias);
        formData.append('quantidadeDiarias', reportData.quantidadeDiarias);
        formData.append('litros_gasolina', reportData.litrosGasolina);
        formData.append('litrosGasolina', reportData.litrosGasolina);
        formData.append('gasto_gasolina', reportData.valorGasolina);
        formData.append('valorGasolina', reportData.valorGasolina);
        formData.append('receita_frete', reportData.receita);
        formData.append('receita', reportData.receita);
        formData.append('motorista', reportData.nomeMotorista);
        formData.append('nomeMotorista', reportData.nomeMotorista);
        formData.append('caminhao', reportData.nomeCaminhao);
        formData.append('nomeCaminhao', reportData.nomeCaminhao);
        formData.append('salario_base', reportData.salarioBase);
        formData.append('bonus_viagens', reportData.bonusViagens);
        formData.append('desconto_faltas', reportData.descontoFaltas);
        
        custosGeraisRelatorio.forEach((custo, index) => {
            formData.append(`custo_${index}_tipo_gasto`, custo.tipo);
            formData.append(`custo_${index}_data_custo`, custo.data || '');
            formData.append(`custo_${index}_placa`, custo.placa || '');
            formData.append(`custo_${index}_oficina_fornecedor`, custo.oficina || '');
            formData.append(`custo_${index}_descricao`, custo.descricao || '');
            formData.append(`custo_${index}_valor`, custo.valor || '0');
            formData.append(`custo_${index}_forma_pagamento`, custo.formaPagamento || 'vista');
            formData.append(`custo_${index}_status_pagamento`, custo.statusPagamento || 'pago');
            formData.append(`custo_${index}_data_vencimento`, custo.dataVencimento || '');
        });
        
        const editReportId = document.getElementById('editReportId').value;
        const url = isEdit ? `/login/atualizar-relatorio/${editReportId}/` : '/login/cadastrar-viagem/';
        
        
        const response = await fetch(url, {
            method: 'POST',
            body: formData,
            headers: {
                'X-CSRFToken': getCSRFToken(),
                'X-Requested-With': 'XMLHttpRequest'
            }
        });
        
        const result = await response.json().catch(() => ({ success: false, message: 'Resposta inválida do servidor.' }));
        if (response.ok) {
            if (result.success) {
                showNotification(result.message, 'success');
                closeReportModal();
                limparFormularioViagem();
                
                // Atualizar automaticamente todos os dados da tela
                await atualizarDashboardCompleto();
            } else {
                showNotification(result.message, 'error');
            }
        } else {
            showNotification(result.message || 'Erro ao salvar relatório.', 'error');
        }
    } catch (error) {
        console.error('Erro ao salvar relatório:', error);
        showNotification('Não foi possível salvar. Verifique sua conexão e tente novamente.', 'error');
    } finally {
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.classList.remove('is-submitting');
            submitButton.removeAttribute('aria-busy');
        }
        form?.removeAttribute('aria-busy');
    }
}

// ===== ATUALIZAÇÃO AUTOMÁTICA =====

async function atualizarDashboardCompleto() {
    try {
        console.log('🔄 Atualizando dashboard completo...');
        
        // Recarregar relatórios do servidor
        await carregarRelatoriosDoServidor();
        
        // Atualizar resumos financeiros
        updateWeekSummary();
        updateMonthSummary();
        
        // Atualizar lista de relatórios anteriores
        updatePreviousReportsList();
        
        // Recarregar custos fixos se o modal estiver aberto
        const custosFixosModal = document.getElementById('custosFixosModal');
        if (custosFixosModal && !custosFixosModal.classList.contains('hidden')) {
            await carregarCustosFixos();
        }
        
        // Atualizar seção de custos fixos no dashboard principal
        await atualizarSecaoCustosFixos();
        
        console.log('✅ Dashboard atualizado com sucesso!');
    } catch (error) {
        console.error('❌ Erro ao atualizar dashboard:', error);
    }
}

async function atualizarSecaoCustosFixos() {
    try {
        const response = await fetch('/login/custos-fixos/');
        if (response.ok) {
            const result = await response.json();
            const custosFixos = result.custos_fixos || [];
            
            // Recalcular total de custos fixos
            const totalCustosFixos = custosFixos.reduce((sum, custo) => sum + parseFloat(custo.valor_mensal || 0), 0);
            
            // Atualizar o total exibido no dashboard principal
            const totalElement = document.querySelector('.text-xl.sm\\:text-2xl.font-bold.text-blue-400');
            if (totalElement) {
                totalElement.textContent = `R$ ${totalCustosFixos.toFixed(2).replace('.', ',')}`;
            }
            
            // Atualizar a seção de custos fixos no dashboard principal
            const custosContainer = document.querySelector('.mb-6');
            if (custosContainer && custosFixos.length > 0) {
                // Recriar a seção de custos fixos com os dados atualizados
                let html = '<div class="mb-6">';
                
                // Custos Fixos Mensais
                html += `
                    <div>
                        <h4 class="text-base sm:text-lg font-semibold text-blue-300 mb-3 sm:mb-4">📅 Custos Fixos Mensais (R$ ${totalCustosFixos.toFixed(2).replace('.', ',')})</h4>
                        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                `;
                
                custosFixos.forEach(custo => {
                    const icone = custo.tipo_custo === 'parcela_caminhao' ? '🚛' :
                                 custo.tipo_custo === 'seguro' ? '🛡️' :
                                 custo.tipo_custo === 'ipva' ? '📋' :
                                 custo.tipo_custo === 'licenciamento' ? '📄' :
                                 custo.tipo_custo === 'manutencao_preventiva' ? '🔧' : '💰';
                    
                    html += `
                        <div class="bg-gradient-to-r from-blue-600/20 to-blue-700/20 rounded-xl p-3 sm:p-4 border border-blue-500/30">
                            <div class="flex items-start justify-between mb-2">
                                <div class="flex-1 min-w-0">
                                    <p class="text-blue-200 text-xs sm:text-sm font-medium">${custo.tipo_custo_display || custo.tipo_custo}</p>
                                    <p class="text-sm sm:text-base lg:text-lg font-bold text-white truncate">${custo.descricao}</p>
                                    <p class="text-xs sm:text-sm text-blue-300">R$ ${parseFloat(custo.valor_mensal).toFixed(2).replace('.', ',')}/mês</p>
                                    ${custo.data_fim ? `<p class="text-xs text-gray-400">Até ${custo.data_fim}</p>` : ''}
                                </div>
                                <div class="flex items-center space-x-1 sm:space-x-2 ml-2">
                                    <div class="text-lg sm:text-xl lg:text-2xl opacity-80">${icone}</div>
                                    <div class="flex flex-col space-y-1">
                                        <a href="/login/editar-custo-fixo/${custo.id}/" class="bg-yellow-600 hover:bg-yellow-700 text-white px-1 sm:px-2 py-1 rounded text-xs transition-colors text-center mobile-touch-target" title="Editar">
                                            ✏️
                                        </a>
                                        <form method="post" action="/login/apagar-custo-fixo/${custo.id}/" style="display: inline;" onsubmit="return confirm('Tem certeza que deseja apagar este custo fixo? Esta ação não pode ser desfeita.');">
                                            <input type="hidden" name="csrfmiddlewaretoken" value="${getCSRFToken()}">
                                            <button type="submit" class="bg-red-600 hover:bg-red-700 text-white px-1 sm:px-2 py-1 rounded text-xs transition-colors w-full mobile-touch-target" title="Apagar">
                                                🗑️
                                            </button>
                                        </form>
                                    </div>
                                </div>
                            </div>
                            ${custo.observacoes ? `<p class="text-xs text-gray-400 mt-2 break-words">${custo.observacoes.substring(0, 50)}${custo.observacoes.length > 50 ? '...' : ''}</p>` : ''}
                        </div>
                    `;
                });
                
                html += `
                        </div>
                    </div>
                `;
                
                // Total de custos fixos
                html += `
                    <div class="mt-3 sm:mt-4 p-3 sm:p-4 bg-gradient-to-r from-gray-700/50 to-gray-800/50 rounded-xl">
                        <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                            <span class="text-base sm:text-lg font-semibold text-white">Total de Custos Fixos</span>
                            <span class="text-xl sm:text-2xl font-bold text-blue-400">R$ ${totalCustosFixos.toFixed(2).replace('.', ',')}</span>
                        </div>
                        <p class="text-xs sm:text-sm text-gray-400 mt-1">Custos fixos mensais</p>
                    </div>
                </div>
                `;
                
                custosContainer.innerHTML = html;
            } else if (custosContainer && custosFixos.length === 0) {
                custosContainer.innerHTML = `
                    <div class="text-center text-gray-400 py-6 sm:py-8">
                        <span class="text-3xl sm:text-4xl">💳</span>
                        <p class="mt-2 text-sm sm:text-base">Nenhum custo fixo cadastrado</p>
                        <p class="text-xs sm:text-sm">Adicione custos fixos mensais como seguro, IPVA, etc.</p>
                    </div>
                `;
            }
        }
    } catch (error) {
        console.error('Erro ao atualizar seção de custos fixos:', error);
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

function getCSRFToken() {
    // Primeiro tenta obter do input hidden
    const tokenInput = document.querySelector('[name=csrfmiddlewaretoken]');
    if (tokenInput && tokenInput.value) {
        return tokenInput.value;
    }
    
    // Se não encontrar, tenta obter do cookie
    const cookieToken = getCookie('csrftoken');
    if (cookieToken) {
        return cookieToken;
    }
    
    return null;
}

function showNotification(message, type) {
    const notification = document.createElement('div');
    notification.className = `notification fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg transition-all duration-300 ${
        type === 'success' ? 'bg-green-600 text-white' :
        type === 'error' ? 'bg-red-600 text-white' :
        type === 'info' ? 'bg-blue-600 text-white' :
        'bg-gray-600 text-white'
    }`;
    notification.textContent = message;
    notification.setAttribute('role', type === 'error' ? 'alert' : 'status');
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

function formatDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Data inválida';
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
    if (reports.length > 0) {
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

// Função para buscar relatórios por data (que estava faltando)
function buscarRelatoriosPorData() {
    const dataEspecifica = document.getElementById('dataEspecifica').value;
    
    if (!dataEspecifica) {
        alert('Por favor, selecione uma data.');
        return;
    }
    
    // Converter data para formato brasileiro para exibição
    const dataObj = new Date(dataEspecifica);
    const dataFormatada = dataObj.toLocaleDateString('pt-BR');
    
    // Mostrar loading
    const resultadosDiv = document.getElementById('resultadosBusca');
    resultadosDiv.classList.remove('hidden');
    resultadosDiv.innerHTML = `
        <div class="glass-effect rounded-2xl p-8 animate-slide-up border border-gray-600/30 mb-8">
            <h3 class="text-2xl font-bold text-white mb-6">📊 Buscando Relatórios para ${dataFormatada}</h3>
            <div class="text-center text-gray-400 py-8">
                <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
                <p class="mt-4">Carregando dados...</p>
            </div>
        </div>
    `;
    
    // Buscar relatórios do servidor
    console.log('Buscando relatórios para data:', dataEspecifica);
    
    fetch('/login/buscar-relatorios-periodo/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': document.querySelector('[name=csrfmiddlewaretoken]').value
        },
        body: JSON.stringify({
            data_inicio: dataEspecifica,
            data_fim: dataEspecifica
        })
    })
    .then(response => {
        console.log('Resposta do servidor:', response.status);
        return response.json();
    })
    .then(data => {
        console.log('Dados recebidos:', data);
        if (data.success) {
            mostrarResultadosBusca(data, dataFormatada);
        } else {
            mostrarErroBusca(data.error || 'Erro ao buscar relatórios');
        }
    })
    .catch(error => {
        console.error('Erro ao buscar relatórios:', error);
        mostrarErroBusca('Erro de conexão. Tente novamente.');
    });
}

// Função para mostrar resultados da busca
function mostrarResultadosBusca(data, dataFormatada) {
    console.log('=== MOSTRAR RESULTADOS BUSCA ===');
    console.log('Data recebida:', data);
    console.log('Data formatada:', dataFormatada);
    
    const resultadosDiv = document.getElementById('resultadosBusca');
    console.log('Elemento resultadosDiv:', resultadosDiv);
    
    const relatorios = data.relatorios || [];
    console.log('Relatórios encontrados:', relatorios.length);
    
    if (relatorios.length === 0) {
        console.log('Nenhum relatório encontrado, exibindo mensagem');
        resultadosDiv.innerHTML = `
            <div class="glass-effect rounded-xl sm:rounded-2xl p-4 sm:p-6 lg:p-8 animate-slide-up border border-gray-600/30 mb-6 sm:mb-8">
                <h3 class="text-xl sm:text-2xl font-bold text-white mb-4 sm:mb-6">📊 Resultados da Busca - ${dataFormatada}</h3>
                <div class="text-center text-gray-400 py-6 sm:py-8">
                    <span class="text-3xl sm:text-4xl">📅</span>
                    <p class="mt-3 sm:mt-4 text-base sm:text-lg">Nenhum relatório encontrado para esta data</p>
                </div>
            </div>
        `;
        resultadosDiv.classList.remove('hidden');
        console.log('Elemento resultadosDiv exibido');
        return;
    }
    
    console.log('Relatórios encontrados, exibindo resultados');
    
    // Calcular totais
    const totalGastos = relatorios.reduce((sum, r) => sum + (r.totalGastos || 0), 0);
    const totalReceitas = relatorios.reduce((sum, r) => sum + (r.receita_frete || 0), 0);
    const lucroLiquido = totalReceitas - totalGastos;
    
    console.log('Totais calculados:', { totalGastos, totalReceitas, lucroLiquido });
    
    resultadosDiv.innerHTML = `
        <div class="glass-effect rounded-xl sm:rounded-2xl p-4 sm:p-6 lg:p-8 animate-slide-up border border-gray-600/30 mb-6 sm:mb-8">
            <h3 class="text-xl sm:text-2xl font-bold text-white mb-4 sm:mb-6">📊 Resultados da Busca - ${dataFormatada}</h3>
            
            <!-- Resumo -->
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8">
                <div class="bg-gradient-to-r from-red-600 to-red-700 rounded-xl p-4 sm:p-6 text-white">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-red-100 text-xs sm:text-sm font-medium">Total de Gastos</p>
                            <p class="text-xl sm:text-2xl font-bold">R$ ${totalGastos.toFixed(2).replace('.', ',')}</p>
                        </div>
                        <div class="text-2xl sm:text-3xl opacity-80">💰</div>
                    </div>
                </div>
                
                <div class="bg-gradient-to-r from-green-600 to-green-700 rounded-xl p-4 sm:p-6 text-white">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-green-100 text-xs sm:text-sm font-medium">Total de Receitas</p>
                            <p class="text-xl sm:text-2xl font-bold">R$ ${totalReceitas.toFixed(2).replace('.', ',')}</p>
                        </div>
                        <div class="text-2xl sm:text-3xl opacity-80">📈</div>
                    </div>
                </div>
                
                <div class="bg-gradient-to-r from-purple-600 to-purple-700 rounded-xl p-4 sm:p-6 text-white">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-purple-100 text-xs sm:text-sm font-medium">Lucro Líquido</p>
                            <p class="text-xl sm:text-2xl font-bold">R$ ${lucroLiquido.toFixed(2).replace('.', ',')}</p>
                        </div>
                        <div class="text-2xl sm:text-3xl opacity-80">💎</div>
                    </div>
                </div>
                
                <div class="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl p-4 sm:p-6 text-white">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-blue-100 text-xs sm:text-sm font-medium">Total de Viagens</p>
                            <p class="text-xl sm:text-2xl font-bold">${relatorios.length}</p>
                        </div>
                        <div class="text-2xl sm:text-3xl opacity-80">🚛</div>
                    </div>
                </div>
            </div>
            
            <!-- Lista de Relatórios (Cards em Mobile) -->
            <div class="bg-gray-800/50 rounded-xl p-4 sm:p-6">
                <h4 class="text-base sm:text-lg font-semibold text-white mb-3 sm:mb-4">📋 Relatórios Encontrados (${relatorios.length})</h4>
                
                <!-- Grid de Cards -->
                <div class="grid grid-cols-1 gap-3 sm:gap-4">
                    ${relatorios.map(relatorio => {
                        const receita = relatorio.receita_frete || 0;
                        const gastos = (relatorio.gasto_gasolina || 0) + (relatorio.valor_diarias || 0);
                        const lucro = receita - gastos;
                        
                        return `
                        <div class="bg-gray-700/50 rounded-lg p-4 border border-gray-600/30 hover:bg-gray-700/70 transition-colors">
                            <!-- Cabeçalho do Card -->
                            <div class="flex justify-between items-start mb-3">
                                <div class="flex-1">
                                    <p class="text-gray-400 text-xs mb-1">📅 ${relatorio.data_viagem || 'N/A'}</p>
                                    <p class="text-white font-semibold text-sm sm:text-base">${relatorio.partida || 'N/A'} → ${relatorio.chegada || 'N/A'}</p>
                                    <p class="text-gray-300 text-xs mt-1">👨‍💼 ${relatorio.motorista || 'N/A'}</p>
                                </div>
                                <div class="text-right">
                                    <p class="text-xs text-gray-400">Lucro</p>
                                    <p class="text-base sm:text-lg font-bold ${lucro >= 0 ? 'text-green-400' : 'text-red-400'}">
                                        R$ ${lucro.toFixed(2).replace('.', ',')}
                                    </p>
                                </div>
                            </div>
                            
                            <!-- Detalhes Financeiros -->
                            <div class="grid grid-cols-2 gap-2 mb-3 pb-3 border-b border-gray-600/30">
                                <div>
                                    <p class="text-xs text-gray-400">💰 Receita</p>
                                    <p class="text-sm text-green-400 font-semibold">R$ ${receita.toFixed(2).replace('.', ',')}</p>
                                </div>
                                <div>
                                    <p class="text-xs text-gray-400">💸 Gastos</p>
                                    <p class="text-sm text-red-400 font-semibold">R$ ${gastos.toFixed(2).replace('.', ',')}</p>
                                </div>
                            </div>
                            
                            <!-- Botões de Ação -->
                            <div class="flex gap-2">
                                <button onclick="viewReportSummary(${relatorio.id})" class="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-colors">
                                    👁️ Ver
                                </button>
                                <button onclick="editReport(${relatorio.id})" class="flex-1 bg-yellow-600 hover:bg-yellow-700 text-white px-3 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-colors">
                                    ✏️ Editar
                                </button>
                                <button onclick="deleteReport(${relatorio.id})" class="flex-1 bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-colors">
                                    🗑️ Excluir
                                </button>
                            </div>
                        </div>
                        `;
                    }).join('')}
                </div>
            </div>
        </div>
    `;
    
    resultadosDiv.classList.remove('hidden');
    console.log('Elemento resultadosDiv exibido com relatórios');
}

// Função para mostrar erro na busca
function mostrarErroBusca(erro) {
    const resultadosDiv = document.getElementById('resultadosBusca');
    resultadosDiv.innerHTML = `
        <div class="glass-effect rounded-2xl p-8 animate-slide-up border border-red-600/30 mb-8">
            <h3 class="text-2xl font-bold text-white mb-6">❌ Erro na Busca</h3>
            <div class="text-center text-red-300 py-8">
                <span class="text-4xl">⚠️</span>
                <p class="mt-4 text-lg">${erro}</p>
            </div>
        </div>
    `;
}

// ===== INICIALIZAÇÃO =====

// Expor funções globalmente imediatamente (fora do DOMContentLoaded)
window.mostrarRelatoriosHoje = mostrarRelatoriosHoje;
window.mostrarRelatoriosSemana = mostrarRelatoriosSemana;
window.mostrarRelatoriosMes = mostrarRelatoriosMes;
window.openReportModal = openReportModal;
window.closeReportModal = closeReportModal;
window.openCustosFixosModal = openCustosFixosModal;
window.closeCustosFixosModal = closeCustosFixosModal;
window.buscarRelatoriosPorData = buscarRelatoriosPorData;
window.buscarRelatorioPorData = buscarRelatorioPorData;
window.showPreviousReports = showPreviousReports;
window.irParaRelatorioDiario = irParaRelatorioDiario;
window.irParaRelatorioSemanal = irParaRelatorioSemanal;
window.irParaRelatorioMensal = irParaRelatorioMensal;
window.alternarResumo = alternarResumo;
window.viewReportSummary = viewReportSummary;
window.editReport = editReport;
window.deleteReport = deleteReport;
window.salvarCustoFixo = salvarCustoFixo;
window.adicionarCustoGeral = adicionarCustoGeral;
window.removerCustoGeral = removerCustoGeral;
window.salvarRelatorio = salvarRelatorio;

// Debug: verificar se a função editReport está correta
console.log('=== DEBUG FUNÇÃO EDITREPORT ===');
console.log('Tipo da função editReport:', typeof window.editReport);
console.log('Função editReport:', window.editReport.toString());

document.addEventListener('DOMContentLoaded', function() {
    carregarRelatoriosDoServidor();
    
    const inputs = ['dataViagem', 'localPartida', 'localChegada', 'quantidadeDiarias', 
                   'litrosGasolina', 'valorGasolina', 'nomeMotorista', 'nomeCaminhao', 
                   'receita', 'salario_base', 'bonus_viagens', 'desconto_faltas'];
    
    inputs.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener('input', debouncedUpdateReportPreview);
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

// Verificação adicional para garantir que as funções estão disponíveis
if (typeof window.openReportModal === 'undefined') {
    console.error('openReportModal não foi definida!');
    window.openReportModal = function() {
        console.error('openReportModal chamada mas não definida!');
    };
}
