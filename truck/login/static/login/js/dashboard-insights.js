(function () {
    'use strict';

    let trendChart;
    let mixChart;
    let selectedMonth = toYearMonth(new Date());
    let loadToken = 0;

    function toYearMonth(date) {
        return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0');
    }

    function normalizeMonthValue(raw) {
        const value = String(raw || '').trim();
        const iso = value.match(/(\d{4})[\/\-](\d{1,2})/);
        if (iso) return iso[1] + '-' + String(iso[2]).padStart(2, '0');
        const br = value.match(/^(\d{1,2})[\/\-](\d{4})$/);
        if (br) return br[2] + '-' + String(br[1]).padStart(2, '0');
        return value.slice(0, 7);
    }

    function monthRange(ym) {
        const [year, month] = String(ym).split('-').map(Number);
        const lastDay = new Date(year, month, 0).getDate();
        return {
            start: ym + '-01',
            end: ym + '-' + String(lastDay).padStart(2, '0')
        };
    }

    function monthLabel(ym) {
        const [year, month] = ym.split('-').map(Number);
        const label = new Date(year, month - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
        return label.charAt(0).toUpperCase() + label.slice(1);
    }

    function money(value) {
        return 'R$ ' + Number(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    function storedReports() {
        if (typeof window.reports !== 'undefined' && Array.isArray(window.reports)) return window.reports;
        return [];
    }

    function reportMonth(report) {
        const raw = String(report.date || report.data_viagem || '');
        const iso = raw.match(/(\d{4})-(\d{2})/);
        if (iso) return iso[1] + '-' + iso[2];
        const br = raw.match(/(\d{2})\/(\d{2})\/(\d{4})/);
        if (br) return br[3] + '-' + br[2];
        return '';
    }

    function normalizeReport(report) {
        return {
            date: String(report.date || report.data_viagem || '').slice(0, 10),
            receita: Number(report.receita || report.receita_frete || 0),
            valorGasolina: Number(report.valorGasolina || report.gasto_gasolina || 0),
            totalDiarias: Number(report.totalDiarias || report.valor_diarias || 0),
            totalCustosGerais: Number(report.totalCustosGerais || 0),
            litrosGasolina: Number(report.litrosGasolina || report.litros_gasolina || 0)
        };
    }

    function reportsOfMonth(ym) {
        return storedReports().filter((report) => reportMonth(report) === ym).map(normalizeReport);
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

    function paint(list, ym) {
        const metrics = compute(list);
        setMetric('dashboardPeriodLabel', monthLabel(ym));
        renderKpis(metrics);
        renderCharts(list, metrics, ym);
    }

    function readSelectedMonth() {
        const monthInput = document.getElementById('filtroMesDashboard');
        const normalized = normalizeMonthValue((monthInput && monthInput.value) || selectedMonth);
        if (/^\d{4}-\d{2}$/.test(normalized)) selectedMonth = normalized;
        if (monthInput) monthInput.value = selectedMonth;
        return selectedMonth;
    }

    function refreshDashboardInsights() {
        const ym = readSelectedMonth();
        paint(reportsOfMonth(ym), ym);
        fetchSelectedMonth(ym);
    }

    function fetchSelectedMonth(ym) {
        if (typeof buscarRelatoriosPeriodo !== 'function') return;
        const range = monthRange(ym);
        const token = ++loadToken;
        buscarRelatoriosPeriodo(range.start, range.end)
            .then((data) => {
                if (token !== loadToken) return;
                const list = (data.relatorios || []).map(normalizeReport);
                paint(list, ym);
            })
            .catch((error) => {
                if (token !== loadToken) return;
                console.error('Falha ao carregar o mês no dashboard:', error);
            });
    }

    function shiftMonth(delta) {
        const [year, month] = selectedMonth.split('-').map(Number);
        selectedMonth = toYearMonth(new Date(year, month - 1 + delta, 1));
        const monthInput = document.getElementById('filtroMesDashboard');
        if (monthInput) monthInput.value = selectedMonth;
        refreshDashboardInsights();
    }

    function bindFilters() {
        const monthInput = document.getElementById('filtroMesDashboard');
        if (monthInput) {
            monthInput.value = selectedMonth;
            ['change', 'input', 'blur'].forEach((eventName) => {
                monthInput.addEventListener(eventName, refreshDashboardInsights);
            });
            monthInput.addEventListener('paste', (event) => {
                const text = (event.clipboardData || window.clipboardData).getData('text');
                const ym = normalizeMonthValue(text);
                if (!/^\d{4}-\d{2}$/.test(ym)) return;
                event.preventDefault();
                monthInput.value = ym;
                refreshDashboardInsights();
            });
        }
        const prev = document.getElementById('filtroMesAnterior');
        const next = document.getElementById('filtroMesProximo');
        if (prev) prev.addEventListener('click', () => shiftMonth(-1));
        if (next) next.addEventListener('click', () => shiftMonth(1));
        document.querySelectorAll('[data-period-chip]').forEach((button) => {
            button.addEventListener('click', () => {
                const kind = button.getAttribute('data-period-chip');
                const ym = readSelectedMonth();
                if (kind === 'mes') {
                    const range = monthRange(ym);
                    buscarRelatoriosPeriodo(range.start, range.end)
                        .then((data) => mostrarResultadosBusca(data, monthLabel(ym)))
                        .catch((error) => showNotification(error.message, 'error'));
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
