#!/usr/bin/env python
import os
import sys
import django

# Configurar Django
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'truck.settings')
django.setup()

from login.models import CustosGerais, ParcelaCusto, DailyReport
from datetime import datetime, timedelta

def verificar_parcelas():
    print("=== VERIFICAÇÃO DE PARCELAS NO BANCO DE DADOS ===\n")
    
    # 1. Verificar CustosGerais com parcelas
    print("1. CUSTOS GERAIS COM PARCELAS:")
    custos_com_parcelas = CustosGerais.objects.filter(forma_pagamento='parcelado')
    print(f"   Total de custos parcelados: {custos_com_parcelas.count()}")
    
    for custo in custos_com_parcelas[:5]:  # Mostrar apenas os primeiros 5
        print(f"   - ID: {custo.id}, Descrição: {custo.descricao}, Valor: R$ {custo.valor}")
        print(f"     Parcelas: {custo.parcelas.count()}")
        for parcela in custo.parcelas.all()[:3]:  # Mostrar apenas as primeiras 3 parcelas
            print(f"       * Parcela {parcela.numero_parcela}: R$ {parcela.valor_parcela} - {parcela.status_pagamento}")
    
    print()
    
    # 2. Verificar todas as parcelas
    print("2. TODAS AS PARCELAS:")
    todas_parcelas = ParcelaCusto.objects.all()
    print(f"   Total de parcelas: {todas_parcelas.count()}")
    
    for parcela in todas_parcelas[:10]:  # Mostrar apenas as primeiras 10
        print(f"   - ID: {parcela.id}, Custo: {parcela.custo_geral.id if parcela.custo_geral else 'N/A'}")
        print(f"     Parcela {parcela.numero_parcela}: R$ {parcela.valor_parcela} - {parcela.status_pagamento}")
        print(f"     Vencimento: {parcela.data_vencimento}")
    
    print()
    
    # 3. Verificar relatórios diários
    print("3. RELATÓRIOS DIÁRIOS:")
    relatorios = DailyReport.objects.all().order_by('-data_viagem')[:5]
    print(f"   Total de relatórios: {DailyReport.objects.count()}")
    
    for relatorio in relatorios:
        print(f"   - ID: {relatorio.id}, Data: {relatorio.data_viagem}")
        print(f"     Custos gerais: {relatorio.custos_gerais.count()}")
        
        # Verificar parcelas dos custos gerais deste relatório
        parcelas_relatorio = []
        for custo in relatorio.custos_gerais.all():
            parcelas_relatorio.extend(custo.parcelas.all())
        
        print(f"     Parcelas totais: {len(parcelas_relatorio)}")
        for parcela in parcelas_relatorio[:3]:
            print(f"       * {parcela.custo_geral.descricao}: R$ {parcela.valor_parcela} - {parcela.status_pagamento}")
    
    print()
    
    # 4. Testar endpoint listar_relatorios
    print("4. TESTANDO ENDPOINT listar_relatorios:")
    try:
        from django.test import Client
        from django.contrib.auth.models import User
        
        # Criar cliente de teste
        client = Client()
        
        # Fazer login (assumindo que existe um usuário)
        user = User.objects.first()
        if user:
            client.force_login(user)
            response = client.get('/login/listar-relatorios/')
            print(f"   Status da resposta: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                print(f"   Relatórios retornados: {len(data.get('relatorios', []))}")
                
                if data.get('relatorios'):
                    primeiro_relatorio = data['relatorios'][0]
                    print(f"   Primeiro relatório ID: {primeiro_relatorio.get('id')}")
                    print(f"   Todas parcelas: {len(primeiro_relatorio.get('todasParcelas', []))}")
                    
                    if primeiro_relatorio.get('todasParcelas'):
                        print("   Primeiras 3 parcelas:")
                        for parcela in primeiro_relatorio['todasParcelas'][:3]:
                            print(f"     - {parcela.get('descricao', 'N/A')}: R$ {parcela.get('valor_parcela', 0)} - {parcela.get('status_pagamento', 'N/A')}")
            else:
                print(f"   Erro na resposta: {response.content}")
        else:
            print("   Nenhum usuário encontrado no banco")
            
    except Exception as e:
        print(f"   Erro ao testar endpoint: {e}")

if __name__ == "__main__":
    verificar_parcelas()
