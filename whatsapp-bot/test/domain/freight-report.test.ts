import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { formatCurrency, parseFreightReport } from '../../src/domain/freight-report.js';

describe('parseFreightReport', () => {
  it('interpreta o modelo completo por rótulo', () => {
    const result = parseFreightReport(`Origem: Teresina
Chegada: Fortaleza
Diárias: 2
Litros de óleo: 180
Valor do óleo: 1080
Custo adicional: 85`);

    assert.equal(result.success, true);
    if (!result.success) return;
    assert.deepEqual(result.data, {
      cidade_origem: 'Teresina',
      cidade_destino: 'Fortaleza',
      diarias: 2,
      litros_oleo: 180,
      valor_oleo: 1080,
      custo_adicional: 85
    });
  });

  it('não depende da ordem e ignora caixa e acentos', () => {
    const result = parseFreightReport(`CUSTO ADICIONAL: R$ 0,00
valor do oleo: R$ 1.080,50
LITROS DE ÓLEO: 180,5
diárias: 0
DESTINO: Fortaleza
ORIGEM: Teresina`);

    assert.equal(result.success, true);
    if (!result.success) return;
    assert.equal(result.data.diarias, 0);
    assert.equal(result.data.litros_oleo, 180.5);
    assert.equal(result.data.valor_oleo, 1080.5);
    assert.equal(result.data.custo_adicional, 0);
  });

  it('aceita os formatos monetários brasileiros solicitados', () => {
    const values = [
      ['1080', 1080],
      ['1080,50', 1080.5],
      ['1.080,50', 1080.5],
      ['R$ 1.080,50', 1080.5]
    ] as const;

    for (const [money, expected] of values) {
      const result = parseFreightReport(`Origem: A
Chegada: B
Diárias: 1
Litros de óleo: 180.5
Valor do óleo: ${money}
Custo adicional: 0`);
      assert.equal(result.success, true);
      if (result.success) assert.equal(result.data.valor_oleo, expected);
    }
  });

  it('recusa relatório com custo adicional ausente', () => {
    const result = parseFreightReport(`Origem: Teresina
Chegada: Fortaleza
Diárias: 2
Litros de óleo: 180
Valor do óleo: 1080`);

    assert.equal(result.success, false);
    if (result.success) return;
    assert.ok(result.errors.some((error) => error.field === 'custo_adicional' && error.kind === 'missing'));
  });

  it('recusa diárias por extenso e números negativos', () => {
    const invalidText = parseFreightReport(`Origem: A
Chegada: B
Diárias: duas
Litros de óleo: 180
Valor do óleo: 1080
Custo adicional: 0`);
    assert.equal(invalidText.success, false);
    if (!invalidText.success) {
      assert.ok(invalidText.errors.some((error) => error.field === 'diarias' && error.kind === 'invalid'));
    }

    const negative = parseFreightReport(`Origem: A
Chegada: B
Diárias: 2
Litros de óleo: -1
Valor do óleo: 1080
Custo adicional: 0`);
    assert.equal(negative.success, false);
  });

  it('recusa campos duplicados', () => {
    const result = parseFreightReport(`Origem: A
Origem: C
Chegada: B
Diárias: 1
Litros de óleo: 1
Valor do óleo: 1
Custo adicional: 0`);
    assert.equal(result.success, false);
    if (!result.success) assert.ok(result.errors.some((error) => error.kind === 'duplicate'));
  });
});

describe('formatCurrency', () => {
  it('formata em real brasileiro', () => {
    assert.equal(formatCurrency(1080), 'R$ 1.080,00');
  });
});
