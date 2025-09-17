// ========== DASHBOARD SIMPLIFICADO ==========

console.log('Dashboard simples carregado');

// Configurar datas padrão e carregar resumo
document.addEventListener('DOMContentLoaded', function() {
    const hoje = new Date();
    const ontem = new Date(hoje);
    ontem.setDate(hoje.getDate() - 1);
    
    document.getElementById('dataInicial').value = ontem.toISOString().split('T')[0];
    document.getElementById('dataFinal').value = hoje.toISOString().split('T')[0];
    
    // Carregar resumo semanal por padrão
    carregarResumoSemanal();
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

// Carregar resumo semanal
async function carregarResumoSemanal() {
    const hoje = new Date();
    const inicioSemana = new Date(hoje);
    inicioSemana.setDate(hoje.getDate() - hoje.getDay());
    const fimSemana = new Date(inicioSemana);
    fimSemana.setDate(inicioSemana.getDate() + 6);
    
    const dados = await simularBuscaRelatorios(
        inicioSemana.toISOString().split('T')[0],
        fimSemana.toISOString().split('T')[0]
    );
    
    atualizarResumoSemanal(dados);
}

// Carregar resumo mensal
async function carregarResumoMensal() {
    const hoje = new Date();
    const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
    
    const dados = await simularBuscaRelatorios(
        inicioMes.toISOString().split('T')[0],
        fimMes.toISOString().split('T')[0]
    );
    
    atualizarResumoMensal(dados);
}

// Atualizar resumo semanal
function atualizarResumoSemanal(dados) {
    const totalGastos = dados.totalGastoGasolina + (dados.totalValorDiarias || 0);
    const totalReceitas = dados.totalReceita || 0;
    const lucroLiquido = totalReceitas - totalGastos;
    const mediaDiaria = lucroLiquido / 7; // 7 dias da semana
    
    document.getElementById('totalGastosSemanal').textContent = `R$ ${totalGastos.toFixed(2)}`;
    document.getElementById('totalReceitasSemanal').textContent = `R$ ${totalReceitas.toFixed(2)}`;
    document.getElementById('lucroLiquidoSemanal').textContent = `R$ ${lucroLiquido.toFixed(2)}`;
    document.getElementById('mediaDiariaSemanal').textContent = `R$ ${mediaDiaria.toFixed(2)}`;
    
    // Cor do lucro
    const lucroElement = document.getElementById('lucroLiquidoSemanal');
    lucroElement.className = lucroLiquido >= 0 ? 'text-3xl font-bold text-green-300' : 'text-3xl font-bold text-red-300';
}

// Atualizar resumo mensal
function atualizarResumoMensal(dados) {
    const totalGastos = dados.totalGastoGasolina + (dados.totalValorDiarias || 0);
    const totalReceitas = dados.totalReceita || 0;
    const lucroLiquido = totalReceitas - totalGastos;
    const diasNoMes = new Date().getDate();
    const mediaDiaria = lucroLiquido / diasNoMes;
    
    document.getElementById('totalGastosMensal').textContent = `R$ ${totalGastos.toFixed(2)}`;
    document.getElementById('totalReceitasMensal').textContent = `R$ ${totalReceitas.toFixed(2)}`;
    document.getElementById('lucroLiquidoMensal').textContent = `R$ ${lucroLiquido.toFixed(2)}`;
    document.getElementById('mediaDiariaMensal').textContent = `R$ ${mediaDiaria.toFixed(2)}`;
    
    // Cor do lucro
    const lucroElement = document.getElementById('lucroLiquidoMensal');
    lucroElement.className = lucroLiquido >= 0 ? 'text-3xl font-bold text-green-300' : 'text-3xl font-bold text-red-300';
}

// Buscar relatórios por data
async function buscarRelatoriosPorData() {
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
    
    console.log('Buscando relatórios de', dataInicial, 'até', dataFinal);
    
    // Simular busca (depois será integrado com Supabase)
    const relatorios = await simularBuscaRelatorios(dataInicial, dataFinal);
    mostrarResultados(relatorios);
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

// Simular busca de relatórios (será substituído por Supabase)
async function simularBuscaRelatorios(dataInicial, dataFinal) {
    // Simular delay de rede
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Gerar dados mais realistas baseados no período
    const inicio = new Date(dataInicial);
    const fim = new Date(dataFinal);
    const dias = Math.ceil((fim - inicio) / (1000 * 60 * 60 * 24)) + 1;
    
    // Calcular valores baseados no período
    const totalViagens = Math.max(1, Math.floor(dias * 0.8)); // ~80% dos dias com viagens
    const totalDiarias = totalViagens * 2.5; // Média de 2.5 diárias por viagem
    const totalValorDiarias = totalDiarias * 70; // R$ 70 por diária
    const totalLitros = totalViagens * 45; // Média de 45L por viagem
    const totalGastoGasolina = totalLitros * 5.20; // R$ 5,20 por litro
    const totalReceita = totalViagens * 850; // R$ 850 por viagem em média
    const lucro = totalReceita - totalGastoGasolina - totalValorDiarias;
    
    // Gerar relatórios simulados
    const relatorios = [];
    const motoristas = ['João Silva', 'Maria Santos', 'Pedro Costa', 'Ana Oliveira', 'Carlos Lima'];
    const caminhoes = ['Volvo FH 540', 'Scania R500', 'Mercedes Actros', 'Iveco Stralis', 'Volvo FH 460'];
    const rotas = [
        ['São Paulo - SP', 'Rio de Janeiro - RJ'],
        ['Belo Horizonte - MG', 'Brasília - DF'],
        ['Curitiba - PR', 'Porto Alegre - RS'],
        ['Salvador - BA', 'Recife - PE'],
        ['Fortaleza - CE', 'Manaus - AM']
    ];
    
    for (let i = 0; i < totalViagens; i++) {
        const data = new Date(inicio);
        data.setDate(inicio.getDate() + i);
        
        const diarias = Math.floor(Math.random() * 3) + 1; // 1-3 diárias
        const litros = Math.floor(Math.random() * 30) + 30; // 30-60L
        const gastoGasolina = litros * 5.20;
        const receita = Math.floor(Math.random() * 500) + 600; // R$ 600-1100
        const lucroViagem = receita - gastoGasolina - (diarias * 70);
        
        relatorios.push({
            id: i + 1,
            data: data.toISOString().split('T')[0],
            motorista: motoristas[Math.floor(Math.random() * motoristas.length)],
            caminhao: caminhoes[Math.floor(Math.random() * caminhoes.length)],
            partida: rotas[Math.floor(Math.random() * rotas.length)][0],
            chegada: rotas[Math.floor(Math.random() * rotas.length)][1],
            diarias: diarias,
            valorDiarias: diarias * 70,
            litros: litros,
            gastoGasolina: gastoGasolina,
            receita: receita,
            lucro: lucroViagem
        });
    }
    
    return {
        periodo: `${dataInicial} até ${dataFinal}`,
        totalViagens: totalViagens,
        totalDiarias: totalDiarias,
        totalValorDiarias: totalValorDiarias,
        totalLitros: totalLitros,
        totalGastoGasolina: totalGastoGasolina,
        totalReceita: totalReceita,
        lucro: lucro,
        relatorios: relatorios
    };
}

// Mostrar resultados na interface
function mostrarResultados(dados) {
    const resultadosDiv = document.getElementById('resultadosBusca');
    const resumoDiv = document.getElementById('resumoResultados');
    const tabelaDiv = document.getElementById('tabelaResultados');
    
    // Mostrar seção de resultados
    resultadosDiv.classList.remove('hidden');
    
    // Atualizar resumo
    resumoDiv.innerHTML = `
        <div class="bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl p-6 text-white">
            <div class="flex items-center justify-between">
                <div>
                    <p class="text-blue-100 text-sm font-medium">Total de Viagens</p>
                    <p class="text-3xl font-bold">${dados.totalViagens}</p>
                </div>
                <div class="text-4xl opacity-80">🚛</div>
            </div>
        </div>
        
        <div class="bg-gradient-to-r from-green-600 to-green-700 rounded-2xl p-6 text-white">
            <div class="flex items-center justify-between">
                <div>
                    <p class="text-green-100 text-sm font-medium">Total de Diárias</p>
                    <p class="text-3xl font-bold">${dados.totalDiarias}</p>
                    <p class="text-sm opacity-80">R$ ${dados.totalValorDiarias.toFixed(2)}</p>
                </div>
                <div class="text-4xl opacity-80">📅</div>
            </div>
        </div>
        
        <div class="bg-gradient-to-r from-red-600 to-red-700 rounded-2xl p-6 text-white">
            <div class="flex items-center justify-between">
                <div>
                    <p class="text-red-100 text-sm font-medium">Gasolina</p>
                    <p class="text-3xl font-bold">${dados.totalLitros}L</p>
                    <p class="text-sm opacity-80">R$ ${dados.totalGastoGasolina.toFixed(2)}</p>
                </div>
                <div class="text-4xl opacity-80">⛽</div>
            </div>
        </div>
        
        <div class="bg-gradient-to-r from-purple-600 to-purple-700 rounded-2xl p-6 text-white">
            <div class="flex items-center justify-between">
                <div>
                    <p class="text-purple-100 text-sm font-medium">Lucro Total</p>
                    <p class="text-3xl font-bold">R$ ${dados.lucro.toFixed(2)}</p>
                </div>
                <div class="text-4xl opacity-80">💰</div>
            </div>
        </div>
    `;
    
    // Atualizar tabela
    tabelaDiv.innerHTML = `
        <div class="bg-gray-800/30 rounded-xl overflow-hidden">
            <div class="px-6 py-4 border-b border-gray-700/50">
                <h4 class="text-lg font-semibold text-white">Relatórios do Período: ${dados.periodo}</h4>
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
                        ${dados.relatorios.map(relatorio => `
                            <tr class="hover:bg-gray-700/30">
                                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-300">${formatarData(relatorio.data)}</td>
                                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">${relatorio.motorista}</td>
                                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-300">${relatorio.caminhao}</td>
                                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-300">${relatorio.partida} → ${relatorio.chegada}</td>
                                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-300">${relatorio.diarias} (R$ ${relatorio.valorDiarias.toFixed(2)})</td>
                                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-300">${relatorio.litros}L (R$ ${relatorio.gastoGasolina.toFixed(2)})</td>
                                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-300">R$ ${relatorio.receita.toFixed(2)}</td>
                                <td class="px-6 py-4 whitespace-nowrap text-sm font-semibold ${relatorio.lucro >= 0 ? 'text-green-400' : 'text-red-400'}">
                                    R$ ${relatorio.lucro.toFixed(2)}
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

// Função auxiliar para formatar data
function formatarData(data) {
    const date = new Date(data);
    return date.toLocaleDateString('pt-BR');
}

// Exportar funções para uso global
window.buscarRelatoriosPorData = buscarRelatoriosPorData;
window.mostrarRelatoriosHoje = mostrarRelatoriosHoje;
window.mostrarRelatoriosSemana = mostrarRelatoriosSemana;
window.mostrarRelatoriosMes = mostrarRelatoriosMes;
window.alternarResumo = alternarResumo;
window.carregarResumoSemanal = carregarResumoSemanal;
window.carregarResumoMensal = carregarResumoMensal;

console.log('Funções do dashboard exportadas');
