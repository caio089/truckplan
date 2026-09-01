(function () {
    'use strict';

    let trendChart;
    let mixChart;
    let selectedMonth = toYearMonth(new Date());

    function toYearMonth(date) {
        return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0');
    }

    function monthLabel(ym) {
        const [year, month] = ym.split('-').map(Number);
        return new Date(year, month - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    }

    function money(value) {
        return 'R$ ' + Number(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    function reportsOfMonth(ym) {
        return (window.reports || []).filter((report) => String(report.date || '').startsWith(ym));
    }

    function fixedCosts() {
        const node = document.getElementById('dashboardFixedCosts');
        return Number(node && node.dataset.total ? node.dataset.total : 0) || 0;
    }

    function compute(list) {
        const trips = list.length;
        const receita = list.reduce((sum, item) => sum + Number(item.receita || 0), 0);
        const combustivel = list.reduce((sum, item) => sum + Number(item.valorGasolina || 0), 0);
        const diarias = list.reduce((sum, item) => sum + Number(item.totalDiarias || 0), 0);
        const extras = list.reduce((sum, item) => sum + Number(item.totalCustosGerais || 0), 0);
        const litros = list.reduce((sum, item) => sum + Number(item.litrosGasolina || 0), 0);
        const fixos = fixedCosts();
        const gastos = combustivel + diarias + extras + fixos;
        const lucro = receita - gastos;
        const margem = receita > 0 ? (lucro / receita) * 100 : 0;
        return {
            trips,
            receita,
            combustivel,
            diarias,
            extras,
            litros,
            fixos,
            gastos,
            lucro,
            margem,
            mediaViagem: trips ? lucro / trips : 0,
            ticketMedio: trips ? receita / trips : 0
        };
    }

    function setMetric(id, value) {
        const node = document.getElementById(id);
        if (node) node.textContent = value;
    }

    function renderKpis(metrics) {
        setMetric('kpiReceita', money(metrics.receita));
        setMetric('kpiGastos', money(metrics.gastos));
        setMetric('kpiLucro', money(metrics.lucro));
        setMetric('kpiMargem', metrics.margem.toFixed(1).replace('.', ',') + '%');
        setMetric('kpiViagens', String(metrics.trips));
        setMetric('kpiTicket', money(metrics.ticketMedio));
        setMetric('kpiCombustivel', money(metrics.combustivel));
        setMetric('kpiLitros', Number(metrics.litros).toLocaleString('pt-BR', { maximumFractionDigits: 0 }) + ' L');
        setMetric('kpiDiarias', money(metrics.diarias));
        setMetric('kpiExtras', money(metrics.extras));
        setMetric('kpiFixos', money(metrics.fixos));
        setMetric('kpiMediaViagem', money(metrics.mediaViagem));

        const lucroNode = document.getElementById('kpiLucro');
        if (lucroNode) lucroNode.classList.toggle('is-negative', metrics.lucro < 0);
    }

    function dailySeries(list, ym) {
        const [year, month] = ym.split('-').map(Number);
        const days = new Date(year, month, 0).getDate();
        const map = {};
        list.forEach((report) => {
            const day = Number(String(report.date).slice(8, 10));
            if (!map[day]) map[day] = { receita: 0, gastos: 0 };
            map[day].receita += Number(report.receita || 0);
            map[day].gastos += Number(report.valorGasolina || 0) + Number(report.totalDiarias || 0) + Number(report.totalCustosGerais || 0);
        });
        const labels = [];
        const receita = [];
        const gastos = [];
        for (let day = 1; day <= days; day += 1) {
            labels.push(String(day));
            receita.push(map[day] ? map[day].receita : 0);
            gastos.push(map[day] ? map[day].gastos : 0);
        }
        return { labels, receita, gastos };
    }

    function renderCharts(list, metrics, ym) {
        if (typeof Chart === 'undefined') return;
        const series = dailySeries(list, ym);
        const trendCanvas = document.getElementById('chartTendencia');
        const mixCanvas = document.getElementById('chartMix');
        if (!trendCanvas || !mixCanvas) return;

        const common = {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { labels: { color: '#c9d4e1' } } }
        };

        if (trendChart) trendChart.destroy();
        trendChart = new Chart(trendCanvas, {
            type: 'bar',
            data: {
                labels: series.labels,
                datasets: [
                    { label: 'Receita', data: series.receita, backgroundColor: 'rgba(35, 183, 217, .78)', borderRadius: 6 },
                    { label: 'Gastos da viagem', data: series.gastos, backgroundColor: 'rgba(251, 113, 133, .72)', borderRadius: 6 }
                ]
            },
            options: {
                ...common,
                scales: {
                    x: { ticks: { color: '#91a2b7', maxRotation: 0 }, grid: { color: 'rgba(148,163,184,.08)' } },
                    y: { ticks: { color: '#91a2b7' }, grid: { color: 'rgba(148,163,184,.08)' } }
                }
            }
        });

        if (mixChart) mixChart.destroy();
        mixChart = new Chart(mixCanvas, {
            type: 'doughnut',
            data: {
                labels: ['Combustível', 'Diárias', 'Custos extras', 'Fixos'],
                datasets: [{
                    data: [metrics.combustivel, metrics.diarias, metrics.extras, metrics.fixos],
                    backgroundColor: ['#23b7d9', '#fbbf24', '#a78bfa', '#64748b'],
                    borderWidth: 0
                }]
            },
            options: {
                ...common,
                cutout: '62%',
                plugins: { legend: { position: 'bottom', labels: { color: '#c9d4e1', boxWidth: 10 } } }
            }
        });
    }

    function refreshDashboardInsights() {
        const monthInput = document.getElementById('filtroMesDashboard');
        if (monthInput && monthInput.value) selectedMonth = monthInput.value;
        const list = reportsOfMonth(selectedMonth);
        const metrics = compute(list);
        const label = monthLabel(selectedMonth);
        setMetric('dashboardPeriodLabel', label.charAt(0).toUpperCase() + label.slice(1));
        renderKpis(metrics);
        renderCharts(list, metrics, selectedMonth);
        if (typeof updateWeekSummary === 'function' && updateWeekSummary !== refreshDashboardInsights) {
            /* keep legacy cards in sync if they still exist */
        }
    }

    function shiftMonth(delta) {
        const [year, month] = selectedMonth.split('-').map(Number);
        const next = new Date(year, month - 1 + delta, 1);
        selectedMonth = toYearMonth(next);
        const monthInput = document.getElementById('filtroMesDashboard');
        if (monthInput) monthInput.value = selectedMonth;
        refreshDashboardInsights();
    }

    function bindFilters() {
        const monthInput = document.getElementById('filtroMesDashboard');
        if (monthInput) {
            monthInput.value = selectedMonth;
            monthInput.addEventListener('change', refreshDashboardInsights);
        }
        const prev = document.getElementById('filtroMesAnterior');
        const next = document.getElementById('filtroMesProximo');
        if (prev) prev.addEventListener('click', () => shiftMonth(-1));
        if (next) next.addEventListener('click', () => shiftMonth(1));
        document.querySelectorAll('[data-period-chip]').forEach((button) => {
            button.addEventListener('click', () => {
                const kind = button.getAttribute('data-period-chip');
                if (kind === 'mes') {
                    const [year, month] = selectedMonth.split('-').map(Number);
                    const start = selectedMonth + '-01';
                    const end = selectedMonth + '-' + String(new Date(year, month, 0).getDate()).padStart(2, '0');
                    if (typeof buscarRelatoriosPeriodo === 'function') {
                        buscarRelatoriosPeriodo(start, end)
                            .then((data) => mostrarResultadosBusca(data, monthLabel(selectedMonth)))
                            .catch((error) => showNotification(error.message, 'error'));
                    }
                }
                if (kind === 'semana' && typeof mostrarRelatoriosSemana === 'function') mostrarRelatoriosSemana();
                if (kind === 'hoje' && typeof mostrarRelatoriosHoje === 'function') mostrarRelatoriosHoje();
                const results = document.getElementById('resultadosBusca');
                if (results) results.scrollIntoView({ behavior: 'smooth', block: 'start' });
            });
        });
    }

    window.refreshDashboardInsights = refreshDashboardInsights;

    document.addEventListener('DOMContentLoaded', function () {
        bindFilters();
        refreshDashboardInsights();
    });
})();
