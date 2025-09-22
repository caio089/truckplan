-- Script SQL para PostgreSQL - Dados de Parcelas e Valores
-- Este script permite buscar informações de parcelas de custos no sistema

-- 1. BUSCAR TODAS AS PARCELAS COM DADOS COMPLETOS
SELECT 
    pc.id as parcela_id,
    pc.numero_parcela,
    pc.valor_parcela,
    pc.data_vencimento,
    pc.status_pagamento,
    cg.id as custo_id,
    cg.descricao,
    cg.tipo_gasto,
    cg.valor as valor_total_custo,
    cg.forma_pagamento,
    cg.veiculo_placa,
    cg.oficina_fornecedor,
    cg.data as data_custo,
    dr.caminhao,
    dr.motorista
FROM login_parcelacusto pc
JOIN login_custosgerais cg ON pc.custo_geral_id = cg.id
JOIN login_dailyreport dr ON cg.relatorio_id = dr.id
ORDER BY pc.data_vencimento, pc.numero_parcela;

-- 2. BUSCAR PARCELAS POR STATUS DE PAGAMENTO
SELECT 
    pc.status_pagamento,
    COUNT(*) as quantidade_parcelas,
    SUM(pc.valor_parcela) as valor_total
FROM login_parcelacusto pc
GROUP BY pc.status_pagamento;

-- 3. BUSCAR PARCELAS VENCIDAS (PENDENTES)
SELECT 
    pc.id,
    pc.numero_parcela,
    pc.valor_parcela,
    pc.data_vencimento,
    cg.descricao,
    cg.veiculo_placa,
    dr.caminhao,
    (CURRENT_DATE - pc.data_vencimento) as dias_atraso
FROM login_parcelacusto pc
JOIN login_custosgerais cg ON pc.custo_geral_id = cg.id
JOIN login_dailyreport dr ON cg.relatorio_id = dr.id
WHERE pc.status_pagamento = 'pendente' 
  AND pc.data_vencimento < CURRENT_DATE
ORDER BY pc.data_vencimento;

-- 4. BUSCAR PARCELAS POR MÊS DE VENCIMENTO
SELECT 
    EXTRACT(YEAR FROM pc.data_vencimento) as ano,
    EXTRACT(MONTH FROM pc.data_vencimento) as mes,
    COUNT(*) as quantidade_parcelas,
    SUM(pc.valor_parcela) as valor_total_mes
FROM login_parcelacusto pc
GROUP BY EXTRACT(YEAR FROM pc.data_vencimento), EXTRACT(MONTH FROM pc.data_vencimento)
ORDER BY ano DESC, mes DESC;

-- 5. BUSCAR PARCELAS POR CAMINHÃO
SELECT 
    dr.caminhao,
    cg.veiculo_placa,
    COUNT(pc.id) as total_parcelas,
    SUM(pc.valor_parcela) as valor_total,
    SUM(CASE WHEN pc.status_pagamento = 'pago' THEN pc.valor_parcela ELSE 0 END) as valor_pago,
    SUM(CASE WHEN pc.status_pagamento = 'pendente' THEN pc.valor_parcela ELSE 0 END) as valor_pendente
FROM login_parcelacusto pc
JOIN login_custosgerais cg ON pc.custo_geral_id = cg.id
JOIN login_dailyreport dr ON cg.relatorio_id = dr.id
GROUP BY dr.caminhao, cg.veiculo_placa
ORDER BY valor_total DESC;

-- 6. BUSCAR PARCELAS VENCENDO NOS PRÓXIMOS 30 DIAS
SELECT 
    pc.id,
    pc.numero_parcela,
    pc.valor_parcela,
    pc.data_vencimento,
    cg.descricao,
    cg.veiculo_placa,
    dr.caminhao,
    (pc.data_vencimento - CURRENT_DATE) as dias_para_vencimento
FROM login_parcelacusto pc
JOIN login_custosgerais cg ON pc.custo_geral_id = cg.id
JOIN login_dailyreport dr ON cg.relatorio_id = dr.id
WHERE pc.status_pagamento = 'pendente' 
  AND pc.data_vencimento BETWEEN CURRENT_DATE AND (CURRENT_DATE + INTERVAL '30 days')
ORDER BY pc.data_vencimento;

-- 7. RESUMO GERAL DE PARCELAS
SELECT 
    'Total de Parcelas' as descricao,
    COUNT(*) as quantidade,
    SUM(pc.valor_parcela) as valor_total
FROM login_parcelacusto pc
UNION ALL
SELECT 
    'Parcelas Pagas' as descricao,
    COUNT(*) as quantidade,
    SUM(pc.valor_parcela) as valor_total
FROM login_parcelacusto pc
WHERE pc.status_pagamento = 'pago'
UNION ALL
SELECT 
    'Parcelas Pendentes' as descricao,
    COUNT(*) as quantidade,
    SUM(pc.valor_parcela) as valor_total
FROM login_parcelacusto pc
WHERE pc.status_pagamento = 'pendente'
UNION ALL
SELECT 
    'Parcelas Vencidas' as descricao,
    COUNT(*) as quantidade,
    SUM(pc.valor_parcela) as valor_total
FROM login_parcelacusto pc
WHERE pc.status_pagamento = 'pendente' 
  AND pc.data_vencimento < CURRENT_DATE;

-- 8. BUSCAR PARCELAS POR TIPO DE GASTO
SELECT 
    cg.tipo_gasto,
    COUNT(pc.id) as total_parcelas,
    SUM(pc.valor_parcela) as valor_total,
    AVG(pc.valor_parcela) as valor_medio_parcela
FROM login_parcelacusto pc
JOIN login_custosgerais cg ON pc.custo_geral_id = cg.id
GROUP BY cg.tipo_gasto
ORDER BY valor_total DESC;

-- 9. BUSCAR PARCELAS POR PERÍODO ESPECÍFICO
-- (Substitua as datas conforme necessário)
SELECT 
    pc.id,
    pc.numero_parcela,
    pc.valor_parcela,
    pc.data_vencimento,
    pc.status_pagamento,
    cg.descricao,
    cg.veiculo_placa,
    dr.caminhao
FROM login_parcelacusto pc
JOIN login_custosgerais cg ON pc.custo_geral_id = cg.id
JOIN login_dailyreport dr ON cg.relatorio_id = dr.id
WHERE pc.data_vencimento BETWEEN '2025-01-01' AND '2025-12-31'
ORDER BY pc.data_vencimento;

-- 10. BUSCAR PARCELAS COM DETALHES DE CUSTO ORIGINAL
SELECT 
    pc.id as parcela_id,
    pc.numero_parcela,
    pc.valor_parcela,
    pc.data_vencimento,
    pc.status_pagamento,
    cg.id as custo_original_id,
    cg.descricao as descricao_original,
    cg.valor as valor_total_original,
    cg.forma_pagamento,
    cg.data as data_custo_original,
    dr.caminhao,
    dr.motorista,
    dr.data_viagem
FROM login_parcelacusto pc
JOIN login_custosgerais cg ON pc.custo_geral_id = cg.id
JOIN login_dailyreport dr ON cg.relatorio_id = dr.id
WHERE cg.forma_pagamento = 'parcelado'
ORDER BY cg.data DESC, pc.numero_parcela;

-- 11. BUSCAR PARCELAS VENCENDO HOJE
SELECT 
    pc.id,
    pc.numero_parcela,
    pc.valor_parcela,
    pc.data_vencimento,
    cg.descricao,
    cg.veiculo_placa,
    dr.caminhao,
    dr.motorista
FROM login_parcelacusto pc
JOIN login_custosgerais cg ON pc.custo_geral_id = cg.id
JOIN login_dailyreport dr ON cg.relatorio_id = dr.id
WHERE pc.status_pagamento = 'pendente' 
  AND pc.data_vencimento = CURRENT_DATE
ORDER BY pc.numero_parcela;

-- 12. BUSCAR PARCELAS POR VALOR (MAIORES QUE X)
-- (Substitua 100.00 pelo valor desejado)
SELECT 
    pc.id,
    pc.numero_parcela,
    pc.valor_parcela,
    pc.data_vencimento,
    cg.descricao,
    cg.veiculo_placa,
    dr.caminhao
FROM login_parcelacusto pc
JOIN login_custosgerais cg ON pc.custo_geral_id = cg.id
JOIN login_dailyreport dr ON cg.relatorio_id = dr.id
WHERE pc.valor_parcela > 100.00
ORDER BY pc.valor_parcela DESC;

-- 13. BUSCAR PARCELAS POR MOTORISTA
SELECT 
    dr.motorista,
    COUNT(pc.id) as total_parcelas,
    SUM(pc.valor_parcela) as valor_total,
    SUM(CASE WHEN pc.status_pagamento = 'pago' THEN pc.valor_parcela ELSE 0 END) as valor_pago,
    SUM(CASE WHEN pc.status_pagamento = 'pendente' THEN pc.valor_parcela ELSE 0 END) as valor_pendente
FROM login_parcelacusto pc
JOIN login_custosgerais cg ON pc.custo_geral_id = cg.id
JOIN login_dailyreport dr ON cg.relatorio_id = dr.id
GROUP BY dr.motorista
ORDER BY valor_total DESC;

-- 14. BUSCAR PARCELAS COM MAIS DE X DIAS DE ATRASO
-- (Substitua 7 pelo número de dias desejado)
SELECT 
    pc.id,
    pc.numero_parcela,
    pc.valor_parcela,
    pc.data_vencimento,
    cg.descricao,
    cg.veiculo_placa,
    dr.caminhao,
    (CURRENT_DATE - pc.data_vencimento) as dias_atraso
FROM login_parcelacusto pc
JOIN login_custosgerais cg ON pc.custo_geral_id = cg.id
JOIN login_dailyreport dr ON cg.relatorio_id = dr.id
WHERE pc.status_pagamento = 'pendente' 
  AND pc.data_vencimento < CURRENT_DATE
  AND (CURRENT_DATE - pc.data_vencimento) > 7
ORDER BY dias_atraso DESC;

-- 15. BUSCAR PARCELAS POR OFICINA/FORNECEDOR
SELECT 
    cg.oficina_fornecedor,
    COUNT(pc.id) as total_parcelas,
    SUM(pc.valor_parcela) as valor_total,
    AVG(pc.valor_parcela) as valor_medio_parcela
FROM login_parcelacusto pc
JOIN login_custosgerais cg ON pc.custo_geral_id = cg.id
WHERE cg.oficina_fornecedor IS NOT NULL
GROUP BY cg.oficina_fornecedor
ORDER BY valor_total DESC;
