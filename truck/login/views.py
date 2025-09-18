from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth import authenticate, login as auth_login, logout
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.views.decorators.csrf import csrf_protect
from django.views.decorators.cache import never_cache
from django.utils.decorators import method_decorator
from django.contrib.auth.models import User
from django.db import IntegrityError
from django.http import JsonResponse
import json
from django.core.paginator import Paginator
from django.db.models import Sum, Count, Q
from datetime import datetime, timedelta
from decimal import Decimal, InvalidOperation
import logging
from .models import DailyReport, MonthlyCost, MotoristaSalario, CustosGerais, CustoFixoMensal, ParcelaCusto

logger = logging.getLogger(__name__)

@csrf_protect
@never_cache
def login(request):
    if request.user.is_authenticated:
        return redirect('dashboard')  # Redirecionar para dashboard após login
    
    if request.method == 'POST':
        username = request.POST.get('username', '').strip()
        password = request.POST.get('password', '')
        
        if not username or not password:
            messages.error(request, 'Por favor, preencha todos os campos.')
            return render(request, 'login/login.html')
        
        user = authenticate(request, username=username, password=password)
        
        if user is not None:
            if user.is_active:
                auth_login(request, user)
                logger.info(f'Usuário {username} fez login com sucesso')
                return redirect('dashboard')
            else:
                messages.error(request, 'Conta desativada.')
        else:
            logger.warning(f'Tentativa de login falhada para usuário: {username}')
            messages.error(request, 'Usuário ou senha incorretos.')
    
    return render(request, 'login/login.html')

@login_required
def dashboard(request):
    """Dashboard principal com resumo da semana atual"""
    from datetime import datetime, timedelta
    
    # Calcular início da semana atual
    hoje = datetime.now().date()
    inicio_semana = hoje - timedelta(days=hoje.weekday())
    
    # Buscar viagens da semana atual
    viagens_semana = DailyReport.objects.filter(
        data_viagem__range=[inicio_semana, hoje]
    ).order_by('-data_viagem')
    
    # Calcular totais
    total_viagens = viagens_semana.count()
    total_diarias = viagens_semana.aggregate(Sum('diarias'))['diarias__sum'] or 0
    total_valor_diarias = viagens_semana.aggregate(Sum('valor_diarias'))['valor_diarias__sum'] or Decimal('0')
    total_gasto_gasolina = viagens_semana.aggregate(Sum('gasto_gasolina'))['gasto_gasolina__sum'] or Decimal('0')
    
    # Buscar últimas 5 viagens
    ultimas_viagens = DailyReport.objects.all().order_by('-data_viagem', '-created_at')[:5]
    
    context = {
        'total_viagens': total_viagens,
        'total_diarias': total_diarias,
        'total_valor_diarias': total_valor_diarias,
        'total_gasto_gasolina': total_gasto_gasolina,
        'ultimas_viagens': ultimas_viagens,
    }
    
    return render(request, 'login/dashboard.html', context)

def logout_view(request):
    logout(request)
    messages.success(request, 'Logout realizado com sucesso.')
    return redirect('login')

def create_default_user():
    """Cria usuário padrão se não existir"""
    try:
        if not User.objects.filter(username='admin').exists():
            User.objects.create_user(
                username='admin',
                email='admin@truckplan.com',
                password='TruckPlan2024!',
                is_staff=True,
                is_superuser=True
            )
            logger.info('Usuário padrão criado: admin / TruckPlan2024!')
    except IntegrityError:
        logger.warning('Usuário padrão já existe')
# ========== NOVAS VIEWS PARA O SISTEMA DE VIAGENS ==========

@login_required
def cadastrar_viagem(request):
    """View para cadastrar nova viagem"""
    if request.method == 'POST':
        try:
            # Debug: Log dos dados recebidos
            print("=== DEBUG BACKEND CADASTRAR_VIAGEM ===")
            print("Dados POST recebidos:", dict(request.POST))
            print("Headers:", dict(request.headers))
            
            # Validar campos obrigatórios
            # Aceitar tanto data_viagem quanto dataViagem
            data_viagem = request.POST.get('data_viagem', '').strip() or request.POST.get('dataViagem', '').strip()
            partida = request.POST.get('partida', '').strip() or request.POST.get('localPartida', '').strip()
            chegada = request.POST.get('chegada', '').strip() or request.POST.get('localChegada', '').strip()
            diarias = request.POST.get('diarias', '').strip() or request.POST.get('quantidadeDiarias', '').strip()
            litros_gasolina = request.POST.get('litros_gasolina', '').strip() or request.POST.get('litrosGasolina', '').strip()
            gasto_gasolina = request.POST.get('gasto_gasolina', '').strip() or request.POST.get('valorGasolina', '').strip()
            receita_frete = request.POST.get('receita_frete', '0').strip() or request.POST.get('receita', '0').strip()
            motorista = request.POST.get('motorista', '').strip() or request.POST.get('nomeMotorista', '').strip()
            caminhao = request.POST.get('caminhao', '').strip() or request.POST.get('nomeCaminhao', '').strip()
            
            print(f"Data viagem extraída: '{data_viagem}' (tipo: {type(data_viagem)})")
            print(f"Partida extraída: '{partida}'")
            print(f"Chegada extraída: '{chegada}'")
            print("=====================================")
            
            # Dados do salário do motorista
            salario_base = request.POST.get('salario_base', '0').strip()
            bonus_viagens = request.POST.get('bonus_viagens', '0').strip()
            desconto_faltas = request.POST.get('desconto_faltas', '0').strip()
            
            # Validações
            if not all([data_viagem, partida, chegada, diarias, litros_gasolina, gasto_gasolina, motorista, caminhao]):
                error_msg = 'Todos os campos são obrigatórios.'
                if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                    return JsonResponse({'success': False, 'message': error_msg})
                else:
                    messages.error(request, error_msg)
                    return render(request, 'login/cadastrar_viagem.html')
            
            # Validar formato da data
            print(f"=== VALIDAÇÃO DE DATA ===")
            print(f"Data a ser validada: '{data_viagem}'")
            print(f"Tipo da data: {type(data_viagem)}")
            print(f"Comprimento: {len(data_viagem) if data_viagem else 'None'}")
            print(f"Representação: {repr(data_viagem)}")
            
            try:
                from datetime import datetime
                data_obj = datetime.strptime(data_viagem, '%Y-%m-%d')
                print(f"Data convertida com sucesso: {data_obj}")
            except ValueError as e:
                print(f"ERRO na conversão da data: {e}")
                error_msg = f'Formato de data inválido. Use YYYY-MM-DD. Data recebida: "{data_viagem}"'
                if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                    return JsonResponse({'success': False, 'message': error_msg})
                else:
                    messages.error(request, error_msg)
                    return render(request, 'login/cadastrar_viagem.html')
            print("=========================")
            
            # Validar campos numéricos
            try:
                diarias_int = int(diarias)
                litros_float = float(litros_gasolina)
                gasto_float = float(gasto_gasolina)
                receita_float = float(receita_frete)
            except ValueError:
                error_msg = 'Valores numéricos inválidos.'
                if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                    return JsonResponse({'success': False, 'message': error_msg})
                else:
                    messages.error(request, error_msg)
                    return render(request, 'login/cadastrar_viagem.html')
            
            # Criar relatório diário
            relatorio = DailyReport.objects.create(
                data_viagem=data_viagem,
                partida=partida,
                chegada=chegada,
                diarias=diarias_int,
                litros_gasolina=Decimal(str(litros_float)),
                gasto_gasolina=Decimal(str(gasto_float)),
                receita_frete=Decimal(str(receita_float)),
                motorista=motorista,
                caminhao=caminhao
            )
            
            # Salvar salário do motorista se fornecido
            if motorista and (salario_base != '0' or bonus_viagens != '0' or desconto_faltas != '0'):
                # Obter ano-mês da data da viagem
                ano_mes = data_obj.strftime('%Y-%m')
                
                # Validar valores do salário
                try:
                    salario_base_float = float(salario_base)
                    bonus_viagens_float = float(bonus_viagens)
                    desconto_faltas_float = float(desconto_faltas)
                except ValueError:
                    salario_base_float = 0.0
                    bonus_viagens_float = 0.0
                    desconto_faltas_float = 0.0
                
                # Criar ou atualizar salário do motorista
                salario, created = MotoristaSalario.objects.get_or_create(
                    motorista=motorista,
                    ano_mes=ano_mes,
                    defaults={
                        'salario_base': Decimal(str(salario_base_float)),
                        'bonus_viagens': Decimal(str(bonus_viagens_float)),
                        'desconto_faltas': Decimal(str(desconto_faltas_float))
                    }
                )
                
                if not created:
                    salario.salario_base = Decimal(str(salario_base_float))
                    salario.bonus_viagens = Decimal(str(bonus_viagens_float))
                    salario.desconto_faltas = Decimal(str(desconto_faltas_float))
                    salario.save()
            
            # Processar custos gerais
            print(f"🔍 Processando custos gerais para relatório {relatorio.id}")
            print(f"📋 Dados POST recebidos: {dict(request.POST)}")
            
            custos_salvos = 0
            index = 0
            while True:
                tipo_gasto = request.POST.get(f'custo_{index}_tipo_gasto')
                print(f"🔍 Verificando custo {index}: tipo_gasto = {tipo_gasto}")
                
                if not tipo_gasto:
                    print(f"❌ Nenhum tipo_gasto encontrado para índice {index}, parando loop")
                    break
                
                oficina_fornecedor = request.POST.get(f'custo_{index}_oficina_fornecedor', '').strip()
                descricao = request.POST.get(f'custo_{index}_descricao', '').strip()
                valor = request.POST.get(f'custo_{index}_valor', '0')
                forma_pagamento = request.POST.get(f'custo_{index}_forma_pagamento', 'vista')
                status_pagamento = request.POST.get(f'custo_{index}_status_pagamento', 'pago')
                
                print(f"📋 Custo {index}: {oficina_fornecedor} - {descricao} - R$ {valor}")
                
                if oficina_fornecedor and descricao and valor:
                    try:
                        custo = CustosGerais.objects.create(
                            relatorio=relatorio,
                            tipo_gasto=tipo_gasto,
                            data=data_obj.date(),  # Converter para objeto date
                            veiculo_placa=caminhao,  # Usar o nome do caminhão como placa
                            oficina_fornecedor=oficina_fornecedor,
                            descricao=descricao,
                            valor=Decimal(valor),
                            forma_pagamento=forma_pagamento,
                            status_pagamento=status_pagamento
                        )
                        custos_salvos += 1
                        print(f"✅ Custo {index} salvo com ID: {custo.id}")
                    except Exception as e:
                        print(f"❌ Erro ao salvar custo {index}: {e}")
                else:
                    print(f"❌ Custo {index} não atende critérios: oficina='{oficina_fornecedor}', descricao='{descricao}', valor='{valor}'")
                
                index += 1
            
            print(f"📊 Total de custos salvos: {custos_salvos}")
            
            mensagem = f'Viagem cadastrada com sucesso! Valor das diárias: R$ {relatorio.valor_diarias:.2f}'
            if custos_salvos > 0:
                mensagem += f' | {custos_salvos} custo(s) geral(is) adicionado(s)'
            
            # Verificar se é uma requisição AJAX
            if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                return JsonResponse({'success': True, 'message': mensagem})
            else:
                messages.success(request, mensagem)
                return redirect('cadastrar_viagem')
            
        except Exception as e:
            logger.error(f'Erro ao cadastrar viagem: {e}')
            if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                return JsonResponse({'success': False, 'message': f'Erro ao cadastrar viagem: {str(e)}'})
            else:
                messages.error(request, 'Erro ao cadastrar viagem. Tente novamente.')
    
    return render(request, 'login/cadastrar_viagem.html')

@login_required
def listar_relatorios(request):
    """View para listar todos os relatórios"""
    print("🔍 Listando relatórios...")
    
    # Usar raw SQL para evitar problemas de conversão Decimal
    from django.db import connection
    
    with connection.cursor() as cursor:
        cursor.execute("""
            SELECT id, data_viagem, partida, chegada, diarias, 
                   litros_gasolina, gasto_gasolina, receita_frete, 
                   motorista, caminhao, valor_diarias
            FROM login_dailyreport 
            ORDER BY data_viagem DESC, created_at DESC
        """)
        
        columns = [col[0] for col in cursor.description]
        relatorios_raw = [dict(zip(columns, row)) for row in cursor.fetchall()]
    
    print(f"📊 Total de relatórios encontrados: {len(relatorios_raw)}")
    
    # Converter para formato JSON
    relatorios_data = []
    for relatorio in relatorios_raw:
        # Buscar salário do motorista para o mês da viagem
        from datetime import datetime
        data_obj = datetime.strptime(str(relatorio['data_viagem']), '%Y-%m-%d')
        ano_mes = data_obj.strftime('%Y-%m')
        
        try:
            salario = MotoristaSalario.objects.get(
                motorista=relatorio['motorista'],
                ano_mes=ano_mes
            )
            salario_liquido = salario.get_salario_liquido()
        except MotoristaSalario.DoesNotExist:
            salario = None
            salario_liquido = 0
        
        # Buscar custos gerais da viagem usando o relacionamento
        custos_gerais = CustosGerais.objects.filter(relatorio_id=relatorio['id'])
        total_custos_gerais = custos_gerais.aggregate(Sum('valor'))['valor__sum'] or Decimal('0')
        
        # Preparar lista de custos gerais para o frontend
        custos_gerais_list = []
        for custo in custos_gerais:
            custos_gerais_list.append({
                'id': custo.id,
                'tipo_gasto': custo.get_tipo_gasto_display(),
                'oficina_fornecedor': custo.oficina_fornecedor,
                'descricao': custo.descricao,
                'valor': float(custo.valor),
                'forma_pagamento': custo.get_forma_pagamento_display(),
                'status_pagamento': custo.get_status_pagamento_display(),
                'veiculo_placa': custo.veiculo_placa
            })
        
        # Calcular totais com conversões seguras
        try:
            total_diarias = float(relatorio['valor_diarias']) if relatorio['valor_diarias'] else 0.0
        except (TypeError, ValueError, InvalidOperation):
            total_diarias = 0.0
            
        try:
            gasto_gasolina = float(relatorio['gasto_gasolina']) if relatorio['gasto_gasolina'] else 0.0
        except (TypeError, ValueError, InvalidOperation):
            gasto_gasolina = 0.0
            
        try:
            receita_frete = float(relatorio['receita_frete']) if relatorio['receita_frete'] else 0.0
        except (TypeError, ValueError, InvalidOperation):
            receita_frete = 0.0
            
        try:
            custos_gerais_float = float(total_custos_gerais) if total_custos_gerais else 0.0
        except (TypeError, ValueError, InvalidOperation):
            custos_gerais_float = 0.0
            
        total_despesas = gasto_gasolina + total_diarias + float(salario_liquido) + custos_gerais_float
        lucro_liquido = receita_frete - total_despesas
        
        relatorios_data.append({
            'id': relatorio['id'],
            'date': str(relatorio['data_viagem']),
            'localPartida': relatorio['partida'],
            'localChegada': relatorio['chegada'],
            'quantidadeDiarias': relatorio['diarias'],
            'totalDiarias': total_diarias,
            'litrosGasolina': float(relatorio['litros_gasolina']) if relatorio['litros_gasolina'] else 0.0,
            'valorGasolina': gasto_gasolina,
            'nomeMotorista': relatorio['motorista'],
            'nomeCaminhao': relatorio['caminhao'],
            'receita': receita_frete,
            'totalGastosViagem': gasto_gasolina + total_diarias,
            'totalCustosGerais': custos_gerais_float,
            'totalDespesas': total_despesas,
            'lucroLiquido': lucro_liquido,
            'salarioBase': float(salario.salario_base) if salario and salario.salario_base else 0,
            'bonusViagens': float(salario.bonus_viagens) if salario and salario.bonus_viagens else 0,
            'descontoFaltas': float(salario.desconto_faltas) if salario and salario.desconto_faltas else 0,
            'salarioLiquido': float(salario_liquido),
            'custosGerais': custos_gerais_list
        })
    
    print(f"✅ Relatórios processados: {len(relatorios_data)}")
    if relatorios_data:
        print(f"📋 Primeiro relatório: {relatorios_data[0]}")
        print(f"📋 Estrutura do primeiro relatório: {list(relatorios_data[0].keys())}")
        print(f"📋 Valores do primeiro relatório:")
        for key, value in relatorios_data[0].items():
            print(f"    {key}: {value} (tipo: {type(value)})")
    else:
        print("📋 Nenhum relatório encontrado")
    
    return JsonResponse({'relatorios': relatorios_data})

@login_required
def excluir_relatorio(request, relatorio_id):
    """View para excluir um relatório usando SQL direto para evitar problemas com Decimal"""
    try:
        logger.info(f'=== INÍCIO EXCLUSÃO RELATÓRIO {relatorio_id} ===')
        
        from django.db import connection
        
        # Verificar se o relatório existe
        with connection.cursor() as cursor:
            cursor.execute("SELECT id FROM login_dailyreport WHERE id = %s", [relatorio_id])
            if not cursor.fetchone():
                logger.warning(f'Relatório {relatorio_id} não encontrado')
                return JsonResponse({'success': False, 'message': 'Relatório não encontrado!'})
        
        # Excluir custos gerais relacionados primeiro via SQL
        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT COUNT(*) FROM login_custosgerais WHERE relatorio_id = %s", [relatorio_id])
                count_custos = cursor.fetchone()[0]
                logger.info(f'Encontrados {count_custos} custos gerais para o relatório')
                
                if count_custos > 0:
                    cursor.execute("DELETE FROM login_custosgerais WHERE relatorio_id = %s", [relatorio_id])
                    logger.info('Custos gerais excluídos com sucesso via SQL')
        except Exception as e:
            logger.error(f'Erro ao excluir custos gerais via SQL: {e}', exc_info=True)
            # Continuar mesmo com erro
        
        # Excluir o relatório via SQL
        try:
            with connection.cursor() as cursor:
                cursor.execute("DELETE FROM login_dailyreport WHERE id = %s", [relatorio_id])
                logger.info(f'Relatório {relatorio_id} excluído com sucesso via SQL')
        except Exception as e:
            logger.error(f'Erro ao excluir relatório via SQL: {e}', exc_info=True)
            return JsonResponse({'success': False, 'message': f'Erro ao excluir relatório: {str(e)}'})
        
        return JsonResponse({'success': True, 'message': 'Relatório excluído com sucesso!'})
        
    except Exception as e:
        logger.error(f'Erro inesperado ao excluir relatório {relatorio_id}: {e}', exc_info=True)
        return JsonResponse({'success': False, 'message': f'Erro ao excluir relatório: {str(e)}'})
    finally:
        logger.info(f'=== FIM EXCLUSÃO RELATÓRIO {relatorio_id} ===')

@login_required
def relatorio_semanal(request):
    """View para relatórios semanais"""
    # Aceitar tanto POST quanto GET
    if request.method == 'POST':
        data_inicio = request.POST.get('data_inicio')
        data_fim = request.POST.get('data_fim')
    else:
        data_inicio = request.GET.get('data_inicio')
        data_fim = request.GET.get('data_fim')
        
        if data_inicio and data_fim:
            try:
                data_inicio = datetime.strptime(data_inicio, '%Y-%m-%d').date()
                data_fim = datetime.strptime(data_fim, '%Y-%m-%d').date()
                
                # Buscar relatórios do período usando SQL raw para evitar problemas de conversão Decimal
                from django.db import connection
                
                with connection.cursor() as cursor:
                    cursor.execute("""
                        SELECT id, data_viagem, partida, chegada, diarias, 
                               litros_gasolina, gasto_gasolina, receita_frete, 
                               motorista, caminhao, valor_diarias
                        FROM login_dailyreport 
                        WHERE data_viagem BETWEEN %s AND %s 
                        ORDER BY data_viagem
                    """, [data_inicio, data_fim])
                    
                    columns = [col[0] for col in cursor.description]
                    relatorios = [dict(zip(columns, row)) for row in cursor.fetchall()]
                
                # Calcular totais usando agregação direta no banco
                try:
                    total_litros = DailyReport.objects.filter(
                        data_viagem__range=[data_inicio, data_fim]
                    ).aggregate(Sum('litros_gasolina'))['litros_gasolina__sum'] or Decimal('0')
                except Exception:
                    total_litros = Decimal('0')
                
                try:
                    total_gasto_gasolina = DailyReport.objects.filter(
                        data_viagem__range=[data_inicio, data_fim]
                    ).aggregate(Sum('gasto_gasolina'))['gasto_gasolina__sum'] or Decimal('0')
                except Exception:
                    total_gasto_gasolina = Decimal('0')
                
                try:
                    total_diarias = DailyReport.objects.filter(
                        data_viagem__range=[data_inicio, data_fim]
                    ).aggregate(Sum('diarias'))['diarias__sum'] or 0
                except Exception:
                    total_diarias = 0
                
                try:
                    total_valor_diarias = DailyReport.objects.filter(
                        data_viagem__range=[data_inicio, data_fim]
                    ).aggregate(Sum('valor_diarias'))['valor_diarias__sum'] or Decimal('0')
                except Exception:
                    total_valor_diarias = Decimal('0')
                
                try:
                    total_receita_frete = DailyReport.objects.filter(
                        data_viagem__range=[data_inicio, data_fim]
                    ).aggregate(Sum('receita_frete'))['receita_frete__sum'] or Decimal('0')
                except Exception:
                    total_receita_frete = Decimal('0')
                
                # Converter para float para evitar problemas com Decimal
                total_gasto_gasolina_float = float(total_gasto_gasolina)
                total_valor_diarias_float = float(total_valor_diarias)
                total_receita_frete_float = float(total_receita_frete)
                
                total_gastos = total_gasto_gasolina_float + total_valor_diarias_float
                lucro = total_receita_frete_float - total_gasto_gasolina_float - total_valor_diarias_float
                
                # Resumo por motorista usando agregação direta
                try:
                    resumo_motorista = DailyReport.objects.filter(
                        data_viagem__range=[data_inicio, data_fim]
                    ).values('motorista').annotate(
                        total_viagens=Count('id'),
                        total_diarias=Sum('diarias'),
                        total_valor_diarias=Sum('valor_diarias'),
                        total_gasto_gasolina=Sum('gasto_gasolina'),
                        total_receita_frete=Sum('receita_frete')
                    ).order_by('motorista')
                except Exception:
                    resumo_motorista = []
                
                # Resumo por caminhão usando agregação direta
                try:
                    resumo_caminhao = DailyReport.objects.filter(
                        data_viagem__range=[data_inicio, data_fim]
                    ).values('caminhao').annotate(
                        total_viagens=Count('id'),
                        total_diarias=Sum('diarias'),
                        total_valor_diarias=Sum('valor_diarias'),
                        total_gasto_gasolina=Sum('gasto_gasolina'),
                        total_receita_frete=Sum('receita_frete')
                    ).order_by('caminhao')
                except Exception:
                    resumo_caminhao = []
                
                context = {
                    'relatorios': relatorios,
                    'data_inicio': data_inicio,
                    'data_fim': data_fim,
                    'total_litros': float(total_litros),
                    'total_gasto_gasolina': total_gasto_gasolina_float,
                    'total_diarias': total_diarias,
                    'total_valor_diarias': total_valor_diarias_float,
                    'total_receita_frete': total_receita_frete_float,
                    'total_gastos': total_gastos,
                    'lucro': lucro,
                    'resumo_motorista': resumo_motorista,
                    'resumo_caminhao': resumo_caminhao,
                }
                
                return render(request, 'login/relatorio_semanal.html', context)
                
            except ValueError:
                messages.error(request, 'Formato de data inválido.')
    
    return render(request, 'login/relatorio_semanal.html')

@login_required
def relatorio_mensal(request):
    """View para relatórios mensais"""
    # Aceitar tanto POST quanto GET
    if request.method == 'POST':
        ano_mes = request.POST.get('ano_mes')
    else:
        ano_mes = request.GET.get('ano_mes')
        
        if ano_mes:
            try:
                # Buscar relatórios do mês usando SQL raw para evitar problemas de conversão Decimal
                from django.db import connection
                
                with connection.cursor() as cursor:
                    cursor.execute("""
                        SELECT id, data_viagem, partida, chegada, diarias, 
                               litros_gasolina, gasto_gasolina, receita_frete, 
                               motorista, caminhao, valor_diarias
                        FROM login_dailyreport 
                        WHERE strftime('%%Y', data_viagem) = %s 
                        AND strftime('%%m', data_viagem) = %s 
                        ORDER BY data_viagem
                    """, [ano_mes[:4], ano_mes[5:7]])
                    
                    columns = [col[0] for col in cursor.description]
                    relatorios = [dict(zip(columns, row)) for row in cursor.fetchall()]
                
                # Calcular totais usando agregação direta no banco
                try:
                    total_diarias = DailyReport.objects.filter(
                        data_viagem__year=ano_mes[:4],
                        data_viagem__month=ano_mes[5:7]
                    ).aggregate(Sum('diarias'))['diarias__sum'] or 0
                except Exception:
                    total_diarias = 0
                
                try:
                    total_valor_diarias = DailyReport.objects.filter(
                        data_viagem__year=ano_mes[:4],
                        data_viagem__month=ano_mes[5:7]
                    ).aggregate(Sum('valor_diarias'))['valor_diarias__sum'] or Decimal('0')
                except Exception:
                    total_valor_diarias = Decimal('0')
                
                try:
                    total_litros = DailyReport.objects.filter(
                        data_viagem__year=ano_mes[:4],
                        data_viagem__month=ano_mes[5:7]
                    ).aggregate(Sum('litros_gasolina'))['litros_gasolina__sum'] or Decimal('0')
                except Exception:
                    total_litros = Decimal('0')
                
                try:
                    total_gasto_gasolina = DailyReport.objects.filter(
                        data_viagem__year=ano_mes[:4],
                        data_viagem__month=ano_mes[5:7]
                    ).aggregate(Sum('gasto_gasolina'))['gasto_gasolina__sum'] or Decimal('0')
                except Exception:
                    total_gasto_gasolina = Decimal('0')
                
                try:
                    total_receita_frete = DailyReport.objects.filter(
                        data_viagem__year=ano_mes[:4],
                        data_viagem__month=ano_mes[5:7]
                    ).aggregate(Sum('receita_frete'))['receita_frete__sum'] or Decimal('0')
                except Exception:
                    total_receita_frete = Decimal('0')
                
                # Buscar ou criar custos fixos do mês
                custos_fixos, created = MonthlyCost.objects.get_or_create(
                    ano_mes=ano_mes,
                    defaults={
                        'pecas': Decimal('0'),
                        'seguro': Decimal('0'),
                        'manutencao': Decimal('0')
                    }
                )
                
                # Buscar custos gerais do mês
                custos_gerais_mes = CustosGerais.objects.filter(
                    data__year=ano_mes[:4],
                    data__month=ano_mes[5:7]
                )
                total_custos_gerais = custos_gerais_mes.aggregate(Sum('valor'))['valor__sum'] or Decimal('0')
                
                
                # Se é um novo registro, pedir para preencher os custos
                if created:
                    messages.info(request, f'Preencha os custos fixos para {ano_mes}')
                    return render(request, 'login/relatorio_mensal.html', {
                        'ano_mes': ano_mes,
                        'custos_fixos': custos_fixos,
                        'relatorios': relatorios,
                        'total_diarias': total_diarias,
                        'total_valor_diarias': total_valor_diarias,
                        'total_litros': total_litros,
                        'total_gasto_gasolina': total_gasto_gasolina,
                        'total_receita_frete': total_receita_frete,
                        'preencher_custos': True
                    })
                
                # Calcular lucro líquido
                total_custos_fixos = custos_fixos.get_total_custos_fixos()
                
                # Converter para float para evitar problemas com Decimal
                total_gasto_gasolina_float = float(total_gasto_gasolina)
                total_valor_diarias_float = float(total_valor_diarias)
                total_custos_gerais_float = float(total_custos_gerais)
                total_receita_frete_float = float(total_receita_frete)
                total_custos_fixos_float = float(total_custos_fixos)
                
                total_despesas = total_gasto_gasolina_float + total_valor_diarias_float + total_custos_fixos_float + total_custos_gerais_float
                lucro_liquido = total_receita_frete_float - total_despesas
                
                context = {
                    'ano_mes': ano_mes,
                    'custos_fixos': custos_fixos,
                    'custos_gerais_mes': custos_gerais_mes,
                    'total_custos_gerais': total_custos_gerais_float,
                    'relatorios': relatorios,
                    'total_diarias': total_diarias,
                    'total_valor_diarias': total_valor_diarias_float,
                    'total_litros': float(total_litros),
                    'total_gasto_gasolina': total_gasto_gasolina_float,
                    'total_receita_frete': total_receita_frete_float,
                    'total_custos_fixos': total_custos_fixos,
                    'total_despesas': total_despesas,
                    'lucro_liquido': lucro_liquido,
                    'preencher_custos': False
                }
                
                return render(request, 'login/relatorio_mensal.html', context)
                
            except ValueError:
                messages.error(request, 'Formato de data inválido.')
    
    return render(request, 'login/relatorio_mensal.html')

@login_required
def salvar_custos_mensais(request):
    """View para salvar custos fixos mensais"""
    if request.method == 'POST':
        ano_mes = request.POST.get('ano_mes')
        pecas = request.POST.get('pecas', '0')
        seguro = request.POST.get('seguro', '0')
        manutencao = request.POST.get('manutencao', '0')
        
        try:
            # Salvar custos fixos
            custos_fixos, created = MonthlyCost.objects.get_or_create(
                ano_mes=ano_mes,
                defaults={
                    'pecas': Decimal(pecas),
                    'seguro': Decimal(seguro),
                    'manutencao': Decimal(manutencao)
                }
            )
            
            if not created:
                custos_fixos.pecas = Decimal(pecas)
                custos_fixos.seguro = Decimal(seguro)
                custos_fixos.manutencao = Decimal(manutencao)
                custos_fixos.save()
            
            messages.success(request, f'Custos fixos de {ano_mes} salvos com sucesso!')
            return redirect('relatorio_mensal')
            
        except Exception as e:
            logger.error(f'Erro ao salvar custos mensais: {e}')
            messages.error(request, 'Erro ao salvar custos fixos. Tente novamente.')
    
    return redirect('relatorio_mensal')

@login_required
def apagar_relatorio_mensal(request):
    """View para apagar relatório mensal (custos fixos e salários)"""
    if request.method == 'POST':
        ano_mes = request.POST.get('ano_mes')
        
        try:
            # Apagar custos fixos do mês
            custos_deletados = MonthlyCost.objects.filter(ano_mes=ano_mes).delete()
            
            # Apagar salários do mês
            salarios_deletados = MotoristaSalario.objects.filter(ano_mes=ano_mes).delete()
            
            messages.success(request, f'Relatório mensal de {ano_mes} apagado com sucesso!')
            
        except Exception as e:
            logger.error(f'Erro ao apagar relatório mensal: {e}')
            messages.error(request, 'Erro ao apagar relatório mensal. Tente novamente.')
    
    return redirect('relatorio_mensal')

@login_required
def listar_viagens(request):
    """View para listar todas as viagens com paginação"""
    viagens = DailyReport.objects.all().order_by('-data_viagem', '-created_at')
    
    # Paginação
    paginator = Paginator(viagens, 20)  # 20 viagens por página
    page_number = request.GET.get('page')
    page_obj = paginator.get_page(page_number)
    
    # Buscar custos gerais para cada viagem
    for viagem in page_obj:
        custos = CustosGerais.objects.filter(data=viagem.data_viagem)
        viagem.custos_gerais = custos
        viagem.total_custos_gerais = custos.aggregate(Sum('valor'))['valor__sum'] or Decimal('0')
    
    context = {
        'page_obj': page_obj,
        'viagens': page_obj
    }
    
    return render(request, 'login/listar_viagens.html', context)

@login_required
def excluir_viagem(request, viagem_id):
    """View para excluir uma viagem"""
    if request.method == 'POST':
        try:
            viagem = get_object_or_404(DailyReport, id=viagem_id)
            viagem.delete()
            messages.success(request, 'Viagem excluída com sucesso!')
        except Exception as e:
            logger.error(f'Erro ao excluir viagem: {e}')
            messages.error(request, 'Erro ao excluir viagem.')
    
    return redirect('listar_viagens')

@login_required
def custos_gerais(request):
    """View para listar custos gerais com busca e filtros"""
    # Parâmetros de busca
    busca = request.GET.get('busca', '')
    tipo_gasto = request.GET.get('tipo_gasto', '')
    status_pagamento = request.GET.get('status_pagamento', '')
    placa = request.GET.get('placa', '')
    
    # Query base
    custos = CustosGerais.objects.all()
    
    # Aplicar filtros
    if busca:
        custos = custos.filter(
            Q(oficina_fornecedor__icontains=busca) |
            Q(descricao__icontains=busca) |
            Q(veiculo_placa__icontains=busca)
        )
    
    if tipo_gasto:
        custos = custos.filter(tipo_gasto=tipo_gasto)
    
    if status_pagamento:
        custos = custos.filter(status_pagamento=status_pagamento)
    
    if placa:
        custos = custos.filter(veiculo_placa__icontains=placa)
    
    # Ordenação
    custos = custos.order_by('-data', '-created_at')
    
    # Paginação
    paginator = Paginator(custos, 20)
    page_number = request.GET.get('page')
    page_obj = paginator.get_page(page_number)
    
    # Estatísticas
    total_custos = custos.aggregate(Sum('valor'))['valor__sum'] or Decimal('0')
    custos_pagos = custos.filter(status_pagamento='pago').aggregate(Sum('valor'))['valor__sum'] or Decimal('0')
    custos_pendentes = custos.filter(status_pagamento='nao_pago').aggregate(Sum('valor'))['valor__sum'] or Decimal('0')
    
    context = {
        'page_obj': page_obj,
        'busca': busca,
        'tipo_gasto': tipo_gasto,
        'status_pagamento': status_pagamento,
        'placa': placa,
        'total_custos': total_custos,
        'custos_pagos': custos_pagos,
        'custos_pendentes': custos_pendentes,
        'tipo_gasto_choices': CustosGerais.TIPO_GASTO_CHOICES,
        'status_pagamento_choices': CustosGerais.STATUS_PAGAMENTO_CHOICES,
    }
    
    return render(request, 'login/custos_gerais.html', context)

@login_required
def adicionar_custo_geral(request):
    """View para adicionar novo custo geral"""
    if request.method == 'POST':
        try:
            # Obter dados do formulário
            tipo_gasto = request.POST.get('tipo_gasto')
            data = request.POST.get('data')
            veiculo_placa = request.POST.get('veiculo_placa', '').strip().upper()
            km_atual = request.POST.get('km_atual', '') or None
            oficina_fornecedor = request.POST.get('oficina_fornecedor', '').strip()
            descricao = request.POST.get('descricao', '').strip()
            valor = request.POST.get('valor')
            forma_pagamento = request.POST.get('forma_pagamento')
            status_pagamento = request.POST.get('status_pagamento')
            data_vencimento = request.POST.get('data_vencimento') or None
            observacoes = request.POST.get('observacoes', '').strip()
            
            # Validações
            if not all([tipo_gasto, data, veiculo_placa, oficina_fornecedor, descricao, valor, forma_pagamento, status_pagamento]):
                messages.error(request, 'Todos os campos obrigatórios devem ser preenchidos.')
                return render(request, 'login/adicionar_custo_geral.html', {
                    'tipo_gasto_choices': CustosGerais.TIPO_GASTO_CHOICES,
                    'forma_pagamento_choices': CustosGerais.FORMA_PAGAMENTO_CHOICES,
                    'status_pagamento_choices': CustosGerais.STATUS_PAGAMENTO_CHOICES,
                })
            
            # Criar custo geral
            # Converter data string para objeto date
            data_obj = datetime.strptime(data, '%Y-%m-%d')
            custo = CustosGerais.objects.create(
                tipo_gasto=tipo_gasto,
                data=data_obj.date(),  # Converter para objeto date
                veiculo_placa=veiculo_placa,
                km_atual=int(km_atual) if km_atual else None,
                oficina_fornecedor=oficina_fornecedor,
                descricao=descricao,
                valor=Decimal(valor),
                forma_pagamento=forma_pagamento,
                status_pagamento=status_pagamento,
                data_vencimento=data_vencimento,
                observacoes=observacoes,
            )
            
            # Upload do comprovante se fornecido
            if 'comprovante' in request.FILES:
                custo.comprovante = request.FILES['comprovante']
                custo.save()
            
            messages.success(request, f'Custo geral adicionado com sucesso! Valor: R$ {custo.valor:.2f}')
            return redirect('custos_gerais')
            
        except Exception as e:
            logger.error(f'Erro ao adicionar custo geral: {e}')
            messages.error(request, 'Erro ao adicionar custo geral. Tente novamente.')
    
    context = {
        'tipo_gasto_choices': CustosGerais.TIPO_GASTO_CHOICES,
        'forma_pagamento_choices': CustosGerais.FORMA_PAGAMENTO_CHOICES,
        'status_pagamento_choices': CustosGerais.STATUS_PAGAMENTO_CHOICES,
    }
    
    return render(request, 'login/adicionar_custo_geral.html', context)

@login_required
def editar_custo_geral(request, custo_id):
    """View para editar custo geral"""
    custo = get_object_or_404(CustosGerais, id=custo_id)
    
    if request.method == 'POST':
        try:
            # Atualizar dados
            custo.tipo_gasto = request.POST.get('tipo_gasto')
            # Converter data string para objeto date
            data_str = request.POST.get('data')
            if data_str:
                data_obj = datetime.strptime(data_str, '%Y-%m-%d')
                custo.data = data_obj.date()
            custo.veiculo_placa = request.POST.get('veiculo_placa', '').strip().upper()
            custo.km_atual = int(request.POST.get('km_atual', '')) if request.POST.get('km_atual') else None
            custo.oficina_fornecedor = request.POST.get('oficina_fornecedor', '').strip()
            custo.descricao = request.POST.get('descricao', '').strip()
            custo.valor = Decimal(request.POST.get('valor'))
            custo.forma_pagamento = request.POST.get('forma_pagamento')
            custo.status_pagamento = request.POST.get('status_pagamento')
            custo.data_vencimento = request.POST.get('data_vencimento') or None
            custo.observacoes = request.POST.get('observacoes', '').strip()
            
            # Upload do comprovante se fornecido
            if 'comprovante' in request.FILES:
                custo.comprovante = request.FILES['comprovante']
            
            custo.save()
            
            messages.success(request, 'Custo geral atualizado com sucesso!')
            return redirect('custos_gerais')
            
        except Exception as e:
            logger.error(f'Erro ao editar custo geral: {e}')
            messages.error(request, 'Erro ao editar custo geral. Tente novamente.')
    
    context = {
        'custo': custo,
        'tipo_gasto_choices': CustosGerais.TIPO_GASTO_CHOICES,
        'forma_pagamento_choices': CustosGerais.FORMA_PAGAMENTO_CHOICES,
        'status_pagamento_choices': CustosGerais.STATUS_PAGAMENTO_CHOICES,
    }
    
    return render(request, 'login/editar_custo_geral.html', context)

@login_required
def excluir_custo_geral(request, custo_id):
    """View para excluir custo geral"""
    if request.method == 'POST':
        try:
            custo = get_object_or_404(CustosGerais, id=custo_id)
            valor = custo.valor
            custo.delete()
            messages.success(request, f'Custo geral excluído com sucesso! Valor: R$ {valor:.2f}')
        except Exception as e:
            logger.error(f'Erro ao excluir custo geral: {e}')
            messages.error(request, 'Erro ao excluir custo geral.')
    
    return redirect('custos_gerais')

@login_required
def buscar_custos_por_data(request):
    """View para buscar custos por data via AJAX"""
    if request.method == 'GET':
        data = request.GET.get('data')
        if data:
            try:
                custos = CustosGerais.objects.filter(data=data).order_by('-created_at')
                custos_data = []
                for custo in custos:
                    custos_data.append({
                        'id': custo.id,
                        'tipo_gasto': custo.get_tipo_gasto_display(),
                        'oficina_fornecedor': custo.oficina_fornecedor,
                        'descricao': custo.descricao,
                        'valor': float(custo.valor),
                        'forma_pagamento': custo.get_forma_pagamento_display(),
                        'status_pagamento': custo.get_status_pagamento_display(),
                    })
                
                return JsonResponse({
                    'success': True,
                    'custos': custos_data
                })
            except Exception as e:
                return JsonResponse({
                    'success': False,
                    'error': str(e)
                })
    
    return JsonResponse({
        'success': False,
        'error': 'Data não fornecida'
    })

@login_required
def buscar_detalhes_viagem(request, viagem_id):
    """View para buscar detalhes da viagem via AJAX"""
    try:
        viagem = get_object_or_404(DailyReport, id=viagem_id)
        
        # Buscar custos gerais da viagem
        custos = CustosGerais.objects.filter(data=viagem.data_viagem)
        total_custos_gerais = custos.aggregate(Sum('valor'))['valor__sum'] or Decimal('0')
        
        # Calcular lucro líquido incluindo custos gerais
        lucro_liquido = viagem.get_lucro() - total_custos_gerais
        
        # Preparar dados da viagem
        viagem_data = {
            'id': viagem.id,
            'data_viagem': viagem.data_viagem.strftime('%d/%m/%Y'),
            'partida': viagem.partida,
            'chegada': viagem.chegada,
            'motorista': viagem.motorista,
            'caminhao': viagem.caminhao,
            'diarias': viagem.diarias,
            'valor_diarias': float(viagem.valor_diarias),
            'gasto_gasolina': float(viagem.gasto_gasolina),
            'receita_frete': float(viagem.receita_frete),
            'total_custos_gerais': float(total_custos_gerais),
            'lucro_liquido': float(lucro_liquido),
            'custos_gerais': []
        }
        
        # Adicionar custos gerais
        for custo in custos:
            viagem_data['custos_gerais'].append({
                'id': custo.id,
                'tipo_gasto': custo.get_tipo_gasto_display(),
                'oficina_fornecedor': custo.oficina_fornecedor,
                'descricao': custo.descricao,
                'valor': float(custo.valor),
                'forma_pagamento': custo.get_forma_pagamento_display(),
                'status_pagamento': custo.get_status_pagamento_display(),
            })
        
        return JsonResponse({
            'success': True,
            'viagem': viagem_data
        })
        
    except Exception as e:
        logger.error(f'Erro ao buscar detalhes da viagem: {e}')
        return JsonResponse({
            'success': False,
            'error': str(e)
        })

@login_required
def buscar_relatorios_periodo(request):
    """API para buscar relatórios por período"""
    if request.method == 'POST':
        # Verificar se o usuário está autenticado
        if not request.user.is_authenticated:
            return JsonResponse({
                'success': False,
                'error': 'Usuário não autenticado'
            })
        try:
            data = json.loads(request.body)
            data_inicio = data.get('data_inicio')
            data_fim = data.get('data_fim')
            
            if not data_inicio or not data_fim:
                return JsonResponse({
                    'success': False,
                    'error': 'Data de início e fim são obrigatórias'
                })
            
            # Converter strings para objetos date
            data_inicio = datetime.strptime(data_inicio, '%Y-%m-%d').date()
            data_fim = datetime.strptime(data_fim, '%Y-%m-%d').date()
            
            # Buscar relatórios do período
            relatorios = DailyReport.objects.filter(
                data_viagem__range=[data_inicio, data_fim]
            ).order_by('data_viagem')
            
            # Calcular totais
            total_litros = relatorios.aggregate(Sum('litros_gasolina'))['litros_gasolina__sum'] or Decimal('0')
            total_gasto_gasolina = relatorios.aggregate(Sum('gasto_gasolina'))['gasto_gasolina__sum'] or Decimal('0')
            total_diarias = relatorios.aggregate(Sum('diarias'))['diarias__sum'] or 0
            total_valor_diarias = relatorios.aggregate(Sum('valor_diarias'))['valor_diarias__sum'] or Decimal('0')
            total_receita_frete = relatorios.aggregate(Sum('receita_frete'))['receita_frete__sum'] or Decimal('0')
            
            # Lucro = (valor total recebido pelas diárias) - (gastos com gasolina)
            lucro = total_valor_diarias - total_gasto_gasolina
            
            # Resumo por motorista
            resumo_motorista = relatorios.values('motorista').annotate(
                total_viagens=Count('id'),
                total_diarias=Sum('diarias'),
                total_valor_diarias=Sum('valor_diarias'),
                total_gasto_gasolina=Sum('gasto_gasolina'),
                total_receita_frete=Sum('receita_frete')
            ).order_by('motorista')
            
            # Resumo por caminhão
            resumo_caminhao = relatorios.values('caminhao').annotate(
                total_viagens=Count('id'),
                total_diarias=Sum('diarias'),
                total_valor_diarias=Sum('valor_diarias'),
                total_gasto_gasolina=Sum('gasto_gasolina'),
                total_receita_frete=Sum('receita_frete')
            ).order_by('caminhao')
            
            # Converter QuerySet para lista de dicionários
            relatorios_data = []
            for relatorio in relatorios:
                relatorios_data.append({
                    'id': relatorio.id,
                    'data_viagem': relatorio.data_viagem.isoformat(),
                    'motorista': relatorio.motorista,
                    'caminhao': relatorio.caminhao,
                    'partida': relatorio.partida,
                    'chegada': relatorio.chegada,
                    'diarias': relatorio.diarias,
                    'valor_diarias': float(relatorio.valor_diarias),
                    'litros_gasolina': float(relatorio.litros_gasolina),
                    'gasto_gasolina': float(relatorio.gasto_gasolina),
                    'receita_frete': float(relatorio.receita_frete)
                })
            
            return JsonResponse({
                'success': True,
                'relatorios': relatorios_data,
                'totais': {
                    'total_litros': float(total_litros),
                    'total_gasto_gasolina': float(total_gasto_gasolina),
                    'total_diarias': total_diarias,
                    'total_valor_diarias': float(total_valor_diarias),
                    'total_receita_frete': float(total_receita_frete),
                    'lucro': float(lucro)
                },
                'resumo_motorista': list(resumo_motorista),
                'resumo_caminhao': list(resumo_caminhao)
            })
            
        except Exception as e:
            logger.error(f'Erro ao buscar relatórios por período: {e}')
            return JsonResponse({
                'success': False,
                'error': str(e)
            })
    
    return JsonResponse({
        'success': False,
        'error': 'Método não permitido'
    })

@login_required
def buscar_relatorios_mes(request):
    """API para buscar relatórios por mês"""
    if request.method == 'POST':
        # Verificar se o usuário está autenticado
        if not request.user.is_authenticated:
            return JsonResponse({
                'success': False,
                'error': 'Usuário não autenticado'
            })
        try:
            data = json.loads(request.body)
            ano_mes = data.get('ano_mes')
            
            if not ano_mes:
                return JsonResponse({
                    'success': False,
                    'error': 'Ano e mês são obrigatórios'
                })
            
            # Buscar relatórios do mês
            relatorios = DailyReport.objects.filter(
                data_viagem__year=ano_mes[:4],
                data_viagem__month=ano_mes[5:7]
            ).order_by('data_viagem')
            
            # Calcular totais
            total_diarias = relatorios.aggregate(Sum('diarias'))['diarias__sum'] or 0
            total_valor_diarias = relatorios.aggregate(Sum('valor_diarias'))['valor_diarias__sum'] or Decimal('0')
            total_litros = relatorios.aggregate(Sum('litros_gasolina'))['litros_gasolina__sum'] or Decimal('0')
            total_gasto_gasolina = relatorios.aggregate(Sum('gasto_gasolina'))['gasto_gasolina__sum'] or Decimal('0')
            total_receita_frete = relatorios.aggregate(Sum('receita_frete'))['receita_frete__sum'] or Decimal('0')
            
            # Buscar custos fixos do mês
            try:
                custos_fixos = MonthlyCost.objects.get(ano_mes=ano_mes)
                custos_fixos_data = {
                    'pecas': float(custos_fixos.pecas),
                    'seguro': float(custos_fixos.seguro),
                    'manutencao': float(custos_fixos.manutencao)
                }
            except MonthlyCost.DoesNotExist:
                custos_fixos_data = {
                    'pecas': 0.0,
                    'seguro': 0.0,
                    'manutencao': 0.0
                }
            
            # Buscar custos gerais do mês
            custos_gerais_mes = CustosGerais.objects.filter(
                data__year=ano_mes[:4],
                data__month=ano_mes[5:7]
            )
            total_custos_gerais = custos_gerais_mes.aggregate(Sum('valor'))['valor__sum'] or Decimal('0')
            
            # Calcular lucro líquido
            total_custos_fixos = custos_fixos_data['pecas'] + custos_fixos_data['seguro'] + custos_fixos_data['manutencao']
            total_despesas = float(total_gasto_gasolina) + float(total_valor_diarias) + total_custos_fixos + float(total_custos_gerais)
            lucro_liquido = float(total_receita_frete) - total_despesas
            
            # Converter QuerySet para lista de dicionários
            relatorios_data = []
            for relatorio in relatorios:
                relatorios_data.append({
                    'id': relatorio.id,
                    'data_viagem': relatorio.data_viagem.isoformat(),
                    'motorista': relatorio.motorista,
                    'caminhao': relatorio.caminhao,
                    'partida': relatorio.partida,
                    'chegada': relatorio.chegada,
                    'diarias': relatorio.diarias,
                    'valor_diarias': float(relatorio.valor_diarias),
                    'litros_gasolina': float(relatorio.litros_gasolina),
                    'gasto_gasolina': float(relatorio.gasto_gasolina),
                    'receita_frete': float(relatorio.receita_frete)
                })
            
            # Converter custos gerais para lista de dicionários
            custos_gerais_data = []
            for custo in custos_gerais_mes:
                custos_gerais_data.append({
                    'id': custo.id,
                    'data': custo.data.isoformat(),
                    'tipo_gasto': custo.tipo_gasto,
                    'tipo_gasto_display': custo.get_tipo_gasto_display(),
                    'veiculo_placa': custo.veiculo_placa,
                    'descricao': custo.descricao,
                    'valor': float(custo.valor),
                    'status_pagamento': custo.status_pagamento,
                    'status_pagamento_display': custo.get_status_pagamento_display()
                })
            
            return JsonResponse({
                'success': True,
                'relatorios': relatorios_data,
                'totais': {
                    'total_diarias': total_diarias,
                    'total_valor_diarias': float(total_valor_diarias),
                    'total_litros': float(total_litros),
                    'total_gasto_gasolina': float(total_gasto_gasolina),
                    'total_receita_frete': float(total_receita_frete),
                    'total_custos_fixos': total_custos_fixos,
                    'total_custos_gerais': float(total_custos_gerais),
                    'total_despesas': total_despesas,
                    'lucro_liquido': lucro_liquido
                },
                'custos_fixos': custos_fixos_data,
                'custos_gerais_mes': custos_gerais_data
            })
            
        except Exception as e:
            logger.error(f'Erro ao buscar relatórios por mês: {e}')
            return JsonResponse({
                'success': False,
                'error': str(e)
            })
    
    return JsonResponse({
        'success': False,
        'error': 'Método não permitido'
    })

@login_required
def atualizar_relatorio(request, relatorio_id):
    """View para atualizar um relatório existente"""
    if request.method == 'POST':
        try:
            # Buscar o relatório existente
            relatorio = get_object_or_404(DailyReport, id=relatorio_id)
            
            # Obter dados do POST
            # Aceitar tanto data_viagem quanto dataViagem
            data_viagem = request.POST.get('data_viagem', '').strip() or request.POST.get('dataViagem', '').strip()
            partida = request.POST.get('partida', '').strip() or request.POST.get('localPartida', '').strip()
            chegada = request.POST.get('chegada', '').strip() or request.POST.get('localChegada', '').strip()
            diarias = request.POST.get('diarias', '0').strip() or request.POST.get('quantidadeDiarias', '0').strip()
            litros_gasolina = request.POST.get('litros_gasolina', '0').strip() or request.POST.get('litrosGasolina', '0').strip()
            gasto_gasolina = request.POST.get('gasto_gasolina', '0').strip() or request.POST.get('valorGasolina', '0').strip()
            receita_frete = request.POST.get('receita_frete', '0').strip() or request.POST.get('receita', '0').strip()
            motorista = request.POST.get('motorista', '').strip() or request.POST.get('nomeMotorista', '').strip()
            caminhao = request.POST.get('caminhao', '').strip() or request.POST.get('nomeCaminhao', '').strip()
            salario_base = request.POST.get('salario_base', '0').strip()
            bonus_viagens = request.POST.get('bonus_viagens', '0').strip()
            desconto_faltas = request.POST.get('desconto_faltas', '0').strip()
            
            # Atualizar dados do relatório
            relatorio.data_viagem = data_viagem
            relatorio.partida = partida
            relatorio.chegada = chegada
            relatorio.diarias = int(diarias)
            relatorio.litros_gasolina = Decimal(litros_gasolina)
            relatorio.gasto_gasolina = Decimal(gasto_gasolina)
            relatorio.receita_frete = Decimal(receita_frete)
            relatorio.motorista = motorista
            relatorio.caminhao = caminhao
            relatorio.save()
            
            # Atualizar ou criar salário do motorista
            if motorista and salario_base:
                ano_mes = datetime.strptime(data_viagem, '%Y-%m-%d').strftime('%Y-%m')
                salario, created = MotoristaSalario.objects.get_or_create(
                    motorista=motorista,
                    ano_mes=ano_mes,
                    defaults={
                        'salario_base': Decimal(salario_base),
                        'bonus_viagens': Decimal(bonus_viagens),
                        'desconto_faltas': Decimal(desconto_faltas)
                    }
                )
                if not created:
                    salario.salario_base = Decimal(salario_base)
                    salario.bonus_viagens = Decimal(bonus_viagens)
                    salario.desconto_faltas = Decimal(desconto_faltas)
                    salario.save()
            
            # Remover custos gerais existentes
            CustosGerais.objects.filter(relatorio=relatorio).delete()
            
            # Processar novos custos gerais
            custos_salvos = 0
            index = 0
            while True:
                tipo_gasto = request.POST.get(f'custo_{index}_tipo_gasto')
                if not tipo_gasto:
                    break
                
                oficina_fornecedor = request.POST.get(f'custo_{index}_oficina_fornecedor', '').strip()
                descricao = request.POST.get(f'custo_{index}_descricao', '').strip()
                valor = request.POST.get(f'custo_{index}_valor', '0')
                forma_pagamento = request.POST.get(f'custo_{index}_forma_pagamento', 'vista')
                status_pagamento = request.POST.get(f'custo_{index}_status_pagamento', 'pago')
                
                if oficina_fornecedor and descricao and valor:
                    # Converter data_viagem para objeto date
                    data_obj = datetime.strptime(data_viagem, '%Y-%m-%d')
                    CustosGerais.objects.create(
                        relatorio=relatorio,
                        tipo_gasto=tipo_gasto,
                        data=data_obj.date(),  # Converter para objeto date
                        veiculo_placa=caminhao,
                        oficina_fornecedor=oficina_fornecedor,
                        descricao=descricao,
                        valor=Decimal(valor),
                        forma_pagamento=forma_pagamento,
                        status_pagamento=status_pagamento
                    )
                    custos_salvos += 1
                
                index += 1
            
            mensagem = f'Relatório atualizado com sucesso! {custos_salvos} custo(s) geral(is) atualizado(s)'
            
            if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                return JsonResponse({'success': True, 'message': mensagem})
            else:
                messages.success(request, mensagem)
                return redirect('dashboard')
                
        except Exception as e:
            logger.error(f'Erro ao atualizar relatório: {e}')
            if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                return JsonResponse({'success': False, 'message': f'Erro ao atualizar relatório: {str(e)}'})
            else:
                messages.error(request, f'Erro ao atualizar relatório: {str(e)}')
                return redirect('dashboard')
    
    return JsonResponse({'success': False, 'message': 'Método não permitido'})

def teste_abas(request):
    """View para testar as abas"""
    return render(request, 'login/teste_abas.html')

@login_required
def custos_fixos(request):
    """View para gerenciar custos fixos mensais"""
    try:
        if request.method == 'POST':
            try:
                descricao = request.POST.get('descricao', '').strip()
                tipo_custo = request.POST.get('tipo_custo', '')
                valor_mensal = request.POST.get('valor_mensal', '0')
                data_inicio = request.POST.get('data_inicio')
                data_fim = request.POST.get('data_fim') or None
                status = request.POST.get('status', 'ativo')
                observacoes = request.POST.get('observacoes', '').strip()
                
                if not descricao or not tipo_custo or not valor_mensal or not data_inicio:
                    return JsonResponse({'success': False, 'message': 'Preencha todos os campos obrigatórios!'})
                
                custo_fixo = CustoFixoMensal.objects.create(
                    descricao=descricao,
                    tipo_custo=tipo_custo,
                    valor_mensal=Decimal(valor_mensal),
                    data_inicio=data_inicio,
                    data_fim=data_fim,
                    status=status,
                    observacoes=observacoes
                )
                
                mensagem = f'Custo fixo "{descricao}" cadastrado com sucesso!'
                
                if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                    return JsonResponse({'success': True, 'message': mensagem})
                else:
                    messages.success(request, mensagem)
                    return redirect('dashboard')
                    
            except Exception as e:
                logger.error(f'Erro ao salvar custo fixo: {e}')
                if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                    return JsonResponse({'success': False, 'message': f'Erro ao salvar custo fixo: {str(e)}'})
                else:
                    messages.error(request, f'Erro ao salvar custo fixo: {str(e)}')
                    return redirect('dashboard')
        
        elif request.method == 'GET':
            # Listar custos fixos
            custos_fixos = CustoFixoMensal.objects.all().order_by('-data_inicio')
            
            custos_data = []
            for custo in custos_fixos:
                custos_data.append({
                    'id': custo.id,
                    'descricao': custo.descricao,
                    'tipo_custo': custo.tipo_custo,
                    'tipo_custo_display': custo.get_tipo_custo_display(),
                    'valor_mensal': float(custo.valor_mensal),
                    'data_inicio': custo.data_inicio.strftime('%Y-%m-%d'),
                    'data_fim': custo.data_fim.strftime('%Y-%m-%d') if custo.data_fim else None,
                    'status': custo.status,
                    'status_display': custo.get_status_display(),
                    'observacoes': custo.observacoes,
                    'created_at': custo.created_at.strftime('%Y-%m-%d %H:%M')
                })
            
            if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                return JsonResponse({'custos_fixos': custos_data})
            else:
                return render(request, 'login/custos_fixos.html', {'custos_fixos': custos_fixos})
        
        return JsonResponse({'success': False, 'message': 'Método não permitido'})
        
    except Exception as e:
        logger.error(f'Erro geral na view custos_fixos: {e}')
        return JsonResponse({'success': False, 'message': f'Erro interno do servidor: {str(e)}'})

@login_required
def excluir_custo_fixo(request, custo_id):
    """View para excluir custo fixo"""
    if request.method == 'POST':
        try:
            custo = get_object_or_404(CustoFixoMensal, id=custo_id)
            descricao = custo.descricao
            custo.delete()
            
            mensagem = f'Custo fixo "{descricao}" excluído com sucesso!'
            
            if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                return JsonResponse({'success': True, 'message': mensagem})
            else:
                messages.success(request, mensagem)
                return redirect('dashboard')
                
        except Exception as e:
            logger.error(f'Erro ao excluir custo fixo: {e}')
            if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                return JsonResponse({'success': False, 'message': f'Erro ao excluir custo fixo: {str(e)}'})
            else:
                messages.error(request, f'Erro ao excluir custo fixo: {str(e)}')
                return redirect('dashboard')
    
    return JsonResponse({'success': False, 'message': 'Método não permitido'})

