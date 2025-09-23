#!/usr/bin/env python3
"""
Script para testar se as parcelas estão sendo enviadas corretamente do backend
"""

import requests
import json

def test_listar_relatorios():
    """Testa a função listar_relatorios"""
    print("=== TESTANDO LISTAR RELATÓRIOS ===")
    
    try:
        response = requests.get('http://localhost:8000/login/listar-relatorios/')
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"Quantidade de relatórios: {len(data.get('relatorios', []))}")
            
            if data.get('relatorios'):
                primeiro = data['relatorios'][0]
                print(f"Primeiro relatório ID: {primeiro.get('id')}")
                print(f"Todas parcelas: {len(primeiro.get('todasParcelas', []))}")
                print(f"Primeiras 3 parcelas: {primeiro.get('todasParcelas', [])[:3]}")
            else:
                print("Nenhum relatório encontrado")
        else:
            print(f"Erro: {response.text}")
            
    except Exception as e:
        print(f"Erro na requisição: {e}")

def test_buscar_relatorios_periodo():
    """Testa a função buscar_relatorios_periodo"""
    print("\n=== TESTANDO BUSCAR RELATÓRIOS PERÍODO ===")
    
    try:
        # Buscar relatórios da semana atual
        from datetime import datetime, timedelta
        hoje = datetime.now().date()
        inicio_semana = hoje - timedelta(days=hoje.weekday())
        
        data = {
            'data_inicio': inicio_semana.isoformat(),
            'data_fim': hoje.isoformat()
        }
        
        response = requests.post(
            'http://localhost:8000/login/buscar-relatorios-periodo/',
            json=data,
            headers={'Content-Type': 'application/json'}
        )
        
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"Success: {data.get('success')}")
            print(f"Quantidade de relatórios: {len(data.get('relatorios', []))}")
            
            if data.get('relatorios'):
                primeiro = data['relatorios'][0]
                print(f"Primeiro relatório ID: {primeiro.get('id')}")
                print(f"Todas parcelas: {len(primeiro.get('todasParcelas', []))}")
                print(f"Primeiras 3 parcelas: {primeiro.get('todasParcelas', [])[:3]}")
            else:
                print("Nenhum relatório encontrado")
        else:
            print(f"Erro: {response.text}")
            
    except Exception as e:
        print(f"Erro na requisição: {e}")

if __name__ == "__main__":
    test_listar_relatorios()
    test_buscar_relatorios_periodo()