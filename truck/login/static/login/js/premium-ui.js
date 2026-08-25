(function () {
    'use strict';

    function cleanText(value) {
        return (value || '').replace(/\s+/g, ' ').trim();
    }

    const smartPasteFields = [
        { key: 'localPartida', label: 'ida', type: 'text', aliases: ['ida', 'partida', 'origem', 'local de partida'] },
        { key: 'localChegada', label: 'volta', type: 'text', aliases: ['volta', 'chegada', 'destino', 'local de chegada'] },
        { key: 'quantidadeDiarias', label: 'diárias', type: 'integer', aliases: ['diarias', 'quantidade de diarias', 'qtd diarias', 'numero de diarias'] },
        { key: 'litrosGasolina', label: 'litros', type: 'number', aliases: ['litros', 'litros de oleo', 'litros oleo', 'litros de diesel', 'litros diesel', 'litros de combustivel'] },
        { key: 'valorGasolina', label: 'valor do óleo', type: 'number', aliases: ['valor do oleo', 'valor em oleo', 'valor oleo', 'valor do diesel', 'valor diesel', 'valor do combustivel', 'gasto com diesel', 'gasto de combustivel'] },
        { key: 'receita', label: 'frete', type: 'number', aliases: ['frete', 'valor do frete', 'receita', 'receita do frete'] }
    ];

    function normalizeSmartLabel(value) {
        return cleanText(value)
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function findSmartField(label) {
        const normalized = normalizeSmartLabel(label);
        return smartPasteFields.find((field) => field.aliases.includes(normalized)) || null;
    }

    function splitSmartPasteLines(value) {
        const text = (value || '').replace(/\r/g, '').trim();
        if (!text) return [];

        let lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
        if (lines.length === 1 && /[;\t]/.test(lines[0])) {
            lines = lines[0].split(/[;\t]/).map((line) => line.trim()).filter(Boolean);
        }
        return lines;
    }

    function extractSmartLabel(line) {
        const separators = [':', '=', ' - ', ' – ', ' — '];

        for (const separator of separators) {
            const separatorIndex = line.indexOf(separator);
            if (separatorIndex < 1) continue;

            const possibleLabel = line.slice(0, separatorIndex);
            const field = findSmartField(possibleLabel);
            if (field) {
                return {
                    field,
                    value: line.slice(separatorIndex + separator.length).trim()
                };
            }
        }

        return { field: null, value: line };
    }

    function parseBrazilianNumber(value) {
        let numeric = String(value || '')
            .replace(/\s/g, '')
            .replace(/[^0-9,.-]/g, '');

        if (!numeric || numeric === '-' || numeric === '.' || numeric === ',') return null;
        if (numeric.startsWith('-')) return null;
        numeric = numeric.replace(/-/g, '');

        const lastComma = numeric.lastIndexOf(',');
        const lastDot = numeric.lastIndexOf('.');

        if (lastComma >= 0 && lastDot >= 0) {
            numeric = lastComma > lastDot
                ? numeric.replace(/\./g, '').replace(',', '.')
                : numeric.replace(/,/g, '');
        } else if (lastComma >= 0) {
            numeric = numeric.replace(/\./g, '').replace(',', '.');
        } else if (/^\d{1,3}(\.\d{3})+$/.test(numeric)) {
            numeric = numeric.replace(/\./g, '');
        }

        const parsed = Number(numeric);
        return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
    }

    function parseSmartPaste(value) {
        const lines = splitSmartPasteLines(value);
        const collected = new Map();
        const unlabeled = [];
        const errors = [];

        lines.forEach((line) => {
            const extracted = extractSmartLabel(line);
            if (!extracted.field) {
                unlabeled.push(extracted.value);
                return;
            }

            if (collected.has(extracted.field.key)) {
                errors.push(`${extracted.field.label} apareceu mais de uma vez`);
                return;
            }
            collected.set(extracted.field.key, extracted.value);
        });

        const missingForOrder = smartPasteFields.filter((field) => !collected.has(field.key));
        unlabeled.forEach((line, index) => {
            const field = missingForOrder[index];
            if (field) collected.set(field.key, line);
        });

        if (unlabeled.length > missingForOrder.length) {
            errors.push(`${unlabeled.length - missingForOrder.length} linha(s) extra(s) não foram utilizadas`);
        }

        const values = new Map();
        smartPasteFields.forEach((field) => {
            if (!collected.has(field.key)) return;

            const rawValue = cleanText(collected.get(field.key));
            if (!rawValue) {
                errors.push(`${field.label} está vazio`);
                return;
            }

            if (field.type === 'text') {
                values.set(field.key, rawValue);
                return;
            }

            const parsed = parseBrazilianNumber(rawValue);
            if (parsed === null) {
                errors.push(`${field.label} possui um valor inválido`);
                return;
            }
            if (field.type === 'integer' && (!Number.isInteger(parsed) || parsed < 1)) {
                errors.push('diárias deve ser um número inteiro maior que zero');
                return;
            }

            values.set(field.key, String(parsed));
        });

        const missing = smartPasteFields.filter((field) => !values.has(field.key));
        return { lines, values, missing, errors };
    }

    function updateSmartPasteStatus(message, type) {
        const status = document.getElementById('smartPasteStatus');
        if (!status) return;
        status.className = 'smart-paste-status' + (type ? ` is-${type}` : '');
        status.textContent = message;
    }

    function fillSmartPasteFields() {
        const input = document.getElementById('smartPasteInput');
        if (!input) return;

        const result = parseSmartPaste(input.value);
        if (!result.lines.length) {
            updateSmartPasteStatus('Cole os dados da viagem antes de preencher.', 'error');
            input.focus();
            return;
        }

        result.values.forEach((value, fieldId) => {
            const field = document.getElementById(fieldId);
            if (!field) return;

            field.value = value;
            field.dispatchEvent(new Event('input', { bubbles: true }));
            field.dispatchEvent(new Event('change', { bubbles: true }));
            field.classList.add('smart-paste-filled');
            window.setTimeout(() => field.classList.remove('smart-paste-filled'), 1400);
        });

        const filledCount = result.values.size;
        if (filledCount === smartPasteFields.length && !result.errors.length) {
            updateSmartPasteStatus('Pronto: os 6 campos foram preenchidos. Agora confira e complete data, motorista e caminhão.', 'success');
            return;
        }

        const details = [];
        if (result.missing.length) {
            details.push(`faltam: ${result.missing.map((field) => field.label).join(', ')}`);
        }
        if (result.errors.length) details.push(result.errors.join('; '));

        const message = filledCount
            ? `${filledCount} campo(s) preenchido(s); ${details.join('. ')}.`
            : `Não foi possível preencher. ${details.join('. ')}.`;
        updateSmartPasteStatus(message, filledCount ? 'warning' : 'error');

        const firstMissing = result.missing
            .map((field) => document.getElementById(field.key))
            .find(Boolean);
        if (firstMissing) firstMissing.focus({ preventScroll: true });
    }

    function setupSmartPaste() {
        const input = document.getElementById('smartPasteInput');
        const fillButton = document.getElementById('smartPasteButton');
        const clearButton = document.getElementById('smartPasteClear');
        if (!input || !fillButton) return;

        fillButton.addEventListener('click', fillSmartPasteFields);
        input.addEventListener('paste', () => {
            window.setTimeout(fillSmartPasteFields, 0);
        });
        input.addEventListener('keydown', (event) => {
            if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
                event.preventDefault();
                fillSmartPasteFields();
            }
        });

        if (clearButton) {
            clearButton.addEventListener('click', () => {
                input.value = '';
                updateSmartPasteStatus('Colagem limpa. Os campos já preenchidos foram mantidos.', '');
                input.focus();
            });
        }
    }

    function enhanceTable(table) {
        if (!table || table.dataset.premiumReady === 'true') return;

        const headers = Array.from(table.querySelectorAll('thead th')).map((th) => cleanText(th.textContent));
        if (!headers.length) return;

        table.querySelectorAll('tbody tr').forEach((row) => {
            Array.from(row.children).forEach((cell, index) => {
                if (cell.tagName === 'TD' && !cell.dataset.label) {
                    cell.dataset.label = headers[index] || 'Detalhe';
                }
            });
        });

        table.classList.add('responsive-card-table');
        table.dataset.premiumReady = 'true';
    }

    function enhanceTables(root) {
        const scope = root && root.querySelectorAll ? root : document;
        scope.querySelectorAll('table').forEach(enhanceTable);
        if (scope.matches && scope.matches('table')) enhanceTable(scope);
    }

    function setupModal(modal) {
        if (modal.dataset.premiumModal === 'true') return;

        modal.dataset.premiumModal = 'true';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.setAttribute('aria-hidden', modal.classList.contains('hidden') ? 'true' : 'false');

        const title = modal.querySelector('h1, h2, h3');
        if (title) {
            if (!title.id) title.id = modal.id + '-title';
            modal.setAttribute('aria-labelledby', title.id);
        }

        const observer = new MutationObserver(() => {
            const isOpen = !modal.classList.contains('hidden');
            modal.setAttribute('aria-hidden', String(!isOpen));
            document.body.classList.toggle('modal-open', isOpen);

            if (isOpen) {
                window.requestAnimationFrame(() => {
                    const focusTarget = modal.querySelector('input:not([type="hidden"]), select, textarea, button, a[href]');
                    if (focusTarget) focusTarget.focus({ preventScroll: true });
                });
            }
        });

        observer.observe(modal, { attributes: true, attributeFilter: ['class'] });

        modal.addEventListener('click', (event) => {
            if (event.target !== modal) return;
            closeModal(modal);
        });
    }

    function closeModal(modal) {
        const handlers = {
            reportModal: 'closeReportModal',
            custosFixosModal: 'closeCustosFixosModal'
        };
        const handler = handlers[modal.id];

        if (handler && typeof window[handler] === 'function') {
            window[handler]();
        } else {
            modal.classList.add('hidden');
        }
    }

    function setupModals() {
        document.querySelectorAll('[id$="Modal"]').forEach(setupModal);

        document.addEventListener('keydown', (event) => {
            if (event.key !== 'Escape') return;
            const openModal = Array.from(document.querySelectorAll('[id$="Modal"]')).find((modal) => !modal.classList.contains('hidden'));
            if (openModal) closeModal(openModal);
        });
    }

    function setupNavigation() {
        const navigation = document.getElementById('mainNav');
        if (!navigation) return;

        const update = () => navigation.classList.toggle('is-scrolled', window.scrollY > 8);
        update();
        window.addEventListener('scroll', update, { passive: true });
    }

    function setupForms() {
        document.querySelectorAll('form').forEach((form) => {
            form.addEventListener('submit', () => {
                if (!form.checkValidity()) return;
                const submit = form.querySelector('button[type="submit"]');
                if (!submit) return;
                submit.classList.add('is-submitting');
                submit.setAttribute('aria-busy', 'true');
            });
        });
    }

    function setupDynamicContent() {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === Node.ELEMENT_NODE) enhanceTables(node);
                });
            });
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }

    function init() {
        document.documentElement.classList.add('premium-ui-ready');
        enhanceTables(document);
        setupModals();
        setupNavigation();
        setupForms();
        setupSmartPaste();
        setupDynamicContent();
    }

    // API pequena e somente leitura para diagnóstico automatizado do parser.
    window.TruckPlanSmartPaste = Object.freeze({ parse: parseSmartPaste });

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
})();
