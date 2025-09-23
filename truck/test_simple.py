import requests

try:
    response = requests.get('http://127.0.0.1:8000/login/listar-relatorios/')
    print(f"Status: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        print(f"Relatórios: {len(data.get('relatorios', []))}")
        
        if data.get('relatorios'):
            primeiro = data['relatorios'][0]
            print(f"Primeiro relatório ID: {primeiro.get('id')}")
            print(f"Todas parcelas: {len(primeiro.get('todasParcelas', []))}")
            
            if primeiro.get('todasParcelas'):
                print("Primeiras 3 parcelas:")
                for p in primeiro['todasParcelas'][:3]:
                    print(f"  - {p.get('descricao')}: R$ {p.get('valor_parcela')} - {p.get('status_pagamento')}")
    else:
        print(f"Erro: {response.text}")
        
except Exception as e:
    print(f"Erro: {e}")
