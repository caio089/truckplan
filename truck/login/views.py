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
from .models import DailyReport, MonthlyCost, MotoristaSalario, CustosGerais, CustoFixoMensal

logger = logging.getLogger(__name__)

@csrf_protect
@never_cache
def login(request):
    logger.info(f'Login view acessada - Método: {request.method}, Autenticado: {request.user.is_authenticated}')
    
    if request.user.is_authenticated:
        logger.info(f'Usuário já autenticado, redirecionando para dashboard')
        return redirect('dashboard')  # Redirecionar para dashboard após login
    
    if request.method == 'POST':
        username = request.POST.get('username', '').strip()
        password = request.POST.get('password', '')
        
        logger.info(f'Tentativa de login - Usuário: {username}')
        
        if not username or not password:
            logger.warning('Login rejeitado - campos vazios')
            messages.error(request, 'Por favor, preencha todos os campos.')
            return render(request, 'login/login.html')
        
        user = authenticate(request, username=username, password=password)
        
        if user is not None:
            if user.is_active:
                auth_login(request, user)
                logger.info(f'✅ Usuário {username} autenticado com sucesso, redirecionando para dashboard')
                return redirect('dashboard')
            else:
                logger.warning(f'Login rejeitado - conta desativada: {username}')
                messages.error(request, 'Conta desativada.')
        else:
            logger.warning(f'❌ Tentativa de login falhada para usuário: {username}')
            messages.error(request, 'Usuário ou senha incorretos.')
    
    logger.info('Renderizando página de login')
    return render(request, 'login/login.html')

@login_required
def dashboard(request):
    """Dashboard principal com resumo da semana atual"""
    try:
        from datetime import datetime, timedelta
        
        logger.info(f'Dashboard acessado por usuário: {request.user.username}')
        
        # Calcular início da semana atual
        hoje = datetime.now().date()
        inicio_semana = hoje - timedelta(days=hoje.weekday())
        
        logger.info(f'Buscando viagens de {inicio_semana} até {hoje}')
        
        # Buscar viagens da semana atual com timeout implícito
        viagens_semana = DailyReport.objects.filter(
            data_viagem__range=[inicio_semana, hoje]
        ).order_by('-data_viagem')
        
        # Calcular totais - otimizado em uma única query
        totais = viagens_semana.aggregate(
            total_viagens=Count('id'),
            total_diarias=Sum('diarias'),
            total_valor_diarias=Sum('valor_diarias'),
            total_gasto_gasolina=Sum('gasto_gasolina')
        )
        
        total_viagens = totais['total_viagens'] or 0
        total_diarias = totais['total_diarias'] or 0
        total_valor_diarias = totais['total_valor_diarias'] or Decimal('0')
        total_gasto_gasolina = totais['total_gasto_gasolina'] or Decimal('0')
        
        logger.info(f'Totais calculados: {total_viagens} viagens')
        
        # Buscar custos fixos mensais ativos - otimizado
        custos_fixos_mensais = CustoFixoMensal.objects.filter(
            status='ativo'
        ).filter(
            Q(data_fim__isnull=True) | Q(data_fim__gte=hoje)
        )[:20]  # Limitar a 20 registros
        
        # Calcular total de custos fixos mensais
        total_custos_fixos_mensais = sum(float(custo.valor_mensal) for custo in custos_fixos_mensais)
        
        logger.info(f'Dashboard - Custos fixos encontrados: {custos_fixos_mensais.count()}')
        
        # Buscar últimas 5 viagens - otimizado
        ultimas_viagens = DailyReport.objects.all().order_by('-data_viagem', '-created_at')[:5]
        
        context = {
            'total_viagens': total_viagens,
            'total_diarias': total_diarias,
            'total_valor_diarias': total_valor_diarias,
            'total_gasto_gasolina': total_gasto_gasolina,
            'custos_fixos_mensais': custos_fixos_mensais,
            'total_custos_fixos_mensais': total_custos_fixos_mensais,
            'ultimas_viagens': ultimas_viagens,
        }
        
        logger.info('Dashboard renderizado com sucesso')
        return render(request, 'login/dashboard.html', context)
        
    except Exception as e:
        logger.error(f'Erro no dashboard: {str(e)}', exc_info=True)
        # Retornar dashboard vazio em caso de erro
        context = {
            'total_viagens': 0,
            'total_diarias': 0,
            'total_valor_diarias': Decimal('0'),
            'total_gasto_gasolina': Decimal('0'),
            'custos_fixos_mensais': [],
            'total_custos_fixos_mensais': 0,
            'ultimas_viagens': [],
            'erro': str(e)
        }
        logger.warning('Dashboard renderizado com erro, retornando dados vazios')
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
            try:
                from datetime import datetime
                data_obj = datetime.strptime(data_viagem, '%Y-%m-%d')
            except ValueError as e:
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
                    except Exception as e:
                        pass
                else:
                    pass
                
                index += 1
            
            
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
    try:
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
    except Exception as e:
        logger.error(f'Erro ao buscar relatórios: {e}', exc_info=True)
        return JsonResponse({'relatorios': []})
    
    
    # Converter para formato JSON
    relatorios_data = []
    try:
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
            
            # Buscar TODAS as parcelas de custos gerais da viagem
            todas_parcelas = []
            print(f"=== RELATÓRIO {relatorio['id']} - COLETANDO PARCELAS ===")
            print(f"Total de custos gerais: {len(custos_gerais)}")
            
            for custo in custos_gerais:
                print(f"Custo {custo.id}: {custo.descricao} - Forma: {custo.forma_pagamento}")
                # Sempre adicionar o custo como uma "parcela"
                todas_parcelas.append({
                    'id': f"custo_{custo.id}",
                    'custo_id': custo.id,
                    'tipo_gasto': custo.get_tipo_gasto_display(),
                    'descricao': custo.descricao,
                    'oficina_fornecedor': custo.oficina_fornecedor or 'N/A',
                    'veiculo_placa': custo.veiculo_placa or 'N/A',
                    'numero_parcela': 1,
                    'valor_parcela': float(custo.valor),
                    'data_vencimento': custo.data.strftime('%d/%m/%Y'),
                    'status_pagamento': custo.get_status_pagamento_display(),
                    'paga': custo.status_pagamento == 'pago',
                    'forma_pagamento': custo.get_forma_pagamento_display(),
                    'observacoes': custo.observacoes or ''
                })
            
                # REMOVIDO: Sistema simplificado sem parcelas
                # O modelo CustosGerais não tem atributo 'parcelas'
            
            # NÃO incluir custos fixos mensais aqui (mostrados apenas no relatório mensal)
        
            # Ordenar todas as parcelas por data de vencimento
            todas_parcelas.sort(key=lambda x: datetime.strptime(x['data_vencimento'], '%d/%m/%Y'))
            
            print(f"Total de parcelas coletadas: {len(todas_parcelas)}")
            print(f"Primeiras 3 parcelas: {todas_parcelas[:3] if todas_parcelas else 'Nenhuma'}")
            
            # Preparar lista de custos gerais para o frontend (sem parcelas individuais)
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
                    'veiculo_placa': custo.veiculo_placa,
                    'data_vencimento': custo.data_vencimento.strftime('%d/%m/%Y') if custo.data_vencimento else None,
                    'observacoes': custo.observacoes
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
            
            relatorio_data = {
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
                'custosGerais': custos_gerais_list,
                'todasParcelas': todas_parcelas,
                'totalParcelas': len(todas_parcelas),
                'parcelasPagas': len([p for p in todas_parcelas if p['paga']]),
                'parcelasPendentes': len([p for p in todas_parcelas if not p['paga']])
            }

            # Campos de compatibilidade esperados pelo frontend da tabela
            relatorio_data.update({
                'data_viagem': str(relatorio['data_viagem']) if relatorio.get('data_viagem') else '',
                'partida': relatorio.get('partida') or '',
                'chegada': relatorio.get('chegada') or '',
                'motorista': relatorio.get('motorista') or '',
                'receita_frete': receita_frete or 0.0,
                'gasto_gasolina': gasto_gasolina or 0.0,
                'valor_diarias': total_diarias or 0.0,
                # Usado no resumo da busca
                'totalGastos': (gasto_gasolina + total_diarias)
            })
            
            relatorios_data.append(relatorio_data)
        
        return JsonResponse({'relatorios': relatorios_data})
    except Exception as e:
        logger.error(f'Erro ao processar relatórios: {e}', exc_info=True)
        return JsonResponse({'relatorios': []})

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
                
                # Buscar custos fixos mensais ativos no período
                custos_fixos_mensais = CustoFixoMensal.objects.filter(
                    status='ativo',
                    data_inicio__lte=data_fim
                ).filter(
                    Q(data_fim__isnull=True) | Q(data_fim__gte=data_inicio)
                )
                
                # Sistema simplificado - sem parcelas
                parcelas_periodo = []
                
                # Calcular total de custos fixos mensais (proporcional ao período)
                total_custos_fixos_mensais = 0
                for custo in custos_fixos_mensais:
                    # Calcular quantos dias do período o custo está ativo
                    inicio_ativo = max(custo.data_inicio, data_inicio)
                    fim_ativo = min(custo.data_fim or data_fim, data_fim)
                    dias_ativo = (fim_ativo - inicio_ativo).days + 1
                    dias_periodo = (data_fim - data_inicio).days + 1
                    proporcao = dias_ativo / dias_periodo
                    total_custos_fixos_mensais += float(custo.valor_mensal) * proporcao
                
                # Calcular total de parcelas vencidas no período
                total_parcelas_periodo = sum(float(parcela.valor_parcela) for parcela in parcelas_periodo)
                
                # Buscar custos gerais do período para incluir parcelas individuais
                custos_gerais_periodo = CustosGerais.objects.filter(
                    data__range=[data_inicio, data_fim]
                )
                
                # Criar lista de custos gerais incluindo parcelas individuais
                custos_gerais_detalhados = []
                
                for custo in custos_gerais_periodo:
                    # Sistema simplificado - sem parcelas
                    if False:  # Desabilitado
                        # Para custos parcelados, mostrar cada parcela como um custo separado
                        # for parcela in custo.parcelas.all():  # COMENTADO: modelo não tem parcelas

                        if False:  # Bloco desabilitado
                            # Criar um objeto similar ao custo original mas com dados da parcela
                            class ParcelaCustoWrapper:
                                def __init__(self, custo_original, parcela):
                                    self.id = f"{custo_original.id}_{parcela.id}"
                                    self.data = custo_original.data
                                    self.tipo_gasto = custo_original.tipo_gasto
                                    self.veiculo_placa = custo_original.veiculo_placa
                                    self.oficina_fornecedor = custo_original.oficina_fornecedor
                                    self.descricao = f"{custo_original.descricao} - Parcela {parcela.numero_parcela}"
                                    self.valor = parcela.valor_parcela
                                    self.forma_pagamento = custo_original.forma_pagamento
                                    self.status_pagamento = parcela.status_pagamento
                                    self.data_vencimento = parcela.data_vencimento
                                    self.observacoes = custo_original.observacoes
                                    self.comprovante = custo_original.comprovante
                                    self.created_at = custo_original.created_at
                                    self.updated_at = custo_original.updated_at
                                    self.get_tipo_gasto_display = custo_original.get_tipo_gasto_display
                                    self.get_forma_pagamento_display = custo_original.get_forma_pagamento_display
                                    self.get_status_pagamento_display = parcela.get_status_pagamento_display
                                    self.is_parcela = True
                                    self.parcela_numero = parcela.numero_parcela
                                    self.total_parcelas = custo_original.parcelas.count()
                                    self.parcelas_pagas = custo_original.parcelas.filter(status_pagamento='pago').count()
                                    self.parcelas_pendentes = custo_original.parcelas.filter(status_pagamento='pendente').count()
                                    self.valor_parcela = parcela.valor_parcela
                            
                            parcela_custo = ParcelaCustoWrapper(custo, parcela)
                            custos_gerais_detalhados.append(parcela_custo)
                    else:
                        # Para custos não parcelados, adicionar normalmente
                        custo.is_parcela = False
                        custo.total_parcelas = 0
                        # # custo.parcelas_pagas = 0  # REMOVIDO: atributo não existe  # REMOVIDO: atributo não existe
                        # # custo.parcelas_pendentes = 0  # REMOVIDO: atributo não existe  # REMOVIDO: atributo não existe
                        custo.valor_parcela = 0
                        custos_gerais_detalhados.append(custo)
                
                # Ordenar por data e descrição
                custos_gerais_detalhados.sort(key=lambda x: (x.data, x.descricao))
                
                # Recalcular total de custos gerais com as parcelas individuais
                total_custos_gerais_detalhados = sum(float(custo.valor) for custo in custos_gerais_detalhados)
                
                # Atualizar total de gastos para incluir custos gerais
                total_gastos = total_gasto_gasolina_float + total_valor_diarias_float + total_custos_gerais_detalhados
                lucro = total_receita_frete_float - total_gastos
                
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
                    'custos_fixos_mensais': custos_fixos_mensais,
                    'total_custos_fixos_mensais': total_custos_fixos_mensais,
                    'parcelas_periodo': parcelas_periodo,
                    'custos_gerais_detalhados': custos_gerais_detalhados,
                    'total_custos_gerais': total_custos_gerais_detalhados,
                    'total_parcelas_periodo': total_parcelas_periodo,
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
    
    logger.info(f'Relatório mensal - Método: {request.method}, ano_mes: {ano_mes}')
    
    if ano_mes:
        try:
            logger.info(f'Processando relatório para: {ano_mes}')
            
            # Validar formato do ano_mes
            if len(ano_mes) != 7 or ano_mes[4] != '-':
                raise ValueError(f'Formato de data inválido: {ano_mes}')
            
            # Buscar relatórios do mês usando ORM do Django
            relatorios = DailyReport.objects.filter(
                data_viagem__year=ano_mes[:4],
                data_viagem__month=ano_mes[5:7]
            ).order_by('data_viagem')
            
            # Debug: verificar dados dos relatórios
            for relatorio in relatorios:
                logger.info(f'Relatório {relatorio.id}: motorista={relatorio.motorista}, caminhao={relatorio.caminhao}, partida={relatorio.partida}, chegada={relatorio.chegada}')
            
            logger.info(f'Encontrados {relatorios.count()} relatórios para {ano_mes}')
            
            # Se não há relatórios, mostrar mensagem
            if relatorios.count() == 0:
                messages.info(request, f'Nenhum relatório encontrado para {ano_mes}')
                return render(request, 'login/relatorio_mensal.html', {
                    'ano_mes': ano_mes,
                    'relatorios': [],
                    'total_diarias': 0,
                    'total_valor_diarias': 0,
                    'total_litros': 0,
                    'total_gasto_gasolina': 0,
                    'total_receita_frete': 0,
                    'total_custos_fixos': 0,
                    'total_despesas': 0,
                    'lucro_liquido': 0,
                    'preencher_custos': False
                })
            
            # Calcular totais usando agregação direta no banco
            try:
                total_diarias = relatorios.aggregate(Sum('diarias'))['diarias__sum'] or 0
                logger.info(f'Total diárias: {total_diarias}')
            except Exception as e:
                logger.error(f'Erro ao calcular diárias: {e}')
                total_diarias = 0
            
            try:
                total_valor_diarias = relatorios.aggregate(Sum('valor_diarias'))['valor_diarias__sum'] or Decimal('0')
                logger.info(f'Total valor diárias: {total_valor_diarias}')
            except Exception as e:
                logger.error(f'Erro ao calcular valor diárias: {e}')
                total_valor_diarias = Decimal('0')
            
            try:
                total_litros = relatorios.aggregate(Sum('litros_gasolina'))['litros_gasolina__sum'] or Decimal('0')
                logger.info(f'Total litros: {total_litros}')
            except Exception as e:
                logger.error(f'Erro ao calcular litros: {e}')
                total_litros = Decimal('0')
            
            try:
                total_gasto_gasolina = relatorios.aggregate(Sum('gasto_gasolina'))['gasto_gasolina__sum'] or Decimal('0')
                logger.info(f'Total gasto gasolina: {total_gasto_gasolina}')
            except Exception as e:
                logger.error(f'Erro ao calcular gasto gasolina: {e}')
                total_gasto_gasolina = Decimal('0')
            
            try:
                total_receita_frete = relatorios.aggregate(Sum('receita_frete'))['receita_frete__sum'] or Decimal('0')
                logger.info(f'Total receita frete: {total_receita_frete}')
            except Exception as e:
                logger.error(f'Erro ao calcular receita frete: {e}')
                total_receita_frete = Decimal('0')
            
            # Buscar ou criar custos fixos do mês
            try:
                custos_fixos, created = MonthlyCost.objects.get_or_create(
                    ano_mes=ano_mes,
                    defaults={
                        'pecas': Decimal('0'),
                        'seguro': Decimal('0'),
                        'manutencao': Decimal('0')
                    }
                )
                logger.info(f'Custos fixos: {custos_fixos}, Criado: {created}')
            except Exception as e:
                logger.error(f'Erro ao buscar/criar custos fixos: {e}')
                custos_fixos = None
                created = False
            
            
            # Buscar custos gerais do mês
            try:
                custos_gerais_mes = CustosGerais.objects.filter(
                    data__year=ano_mes[:4],
                    data__month=ano_mes[5:7]
                )
                total_custos_gerais = custos_gerais_mes.aggregate(Sum('valor'))['valor__sum'] or Decimal('0')
                logger.info(f'Total custos gerais: {total_custos_gerais}')
            except Exception as e:
                logger.error(f'Erro ao calcular custos gerais: {e}')
                custos_gerais_mes = CustosGerais.objects.none()
                total_custos_gerais = Decimal('0')
            
            # Buscar custos fixos mensais ativos no período
            try:
                from datetime import datetime
                from dateutil.relativedelta import relativedelta
                
                # Buscar custos fixos mensais do modelo CustoFixoMensal
                ano = int(ano_mes[:4])
                mes = int(ano_mes[5:7])
                
                # Buscar custos fixos que estão ativos no mês específico
                from django.db import models
                from datetime import datetime
                import calendar
                
                # Obter o último dia do mês
                ultimo_dia_mes = calendar.monthrange(ano, mes)[1]
                
                custos_fixos_mensais = CustoFixoMensal.objects.filter(
                    status='ativo',
                    data_inicio__lte=f'{ano}-{mes:02d}-{ultimo_dia_mes}',  # Início antes ou no mês
                ).filter(
                    models.Q(data_fim__isnull=True) | models.Q(data_fim__gte=f'{ano}-{mes:02d}-01')  # Fim nulo ou depois do mês
                )
                
                total_custos_fixos_mensais = custos_fixos_mensais.aggregate(Sum('valor_mensal'))['valor_mensal__sum'] or Decimal('0')
                
                # Calcular período para parcelas
                data_inicio_mes = datetime.strptime(f"{ano_mes}-01", '%Y-%m-%d').date()
                data_fim_mes = (data_inicio_mes + relativedelta(months=1) - timedelta(days=1))
                logger.info(f'Período: {data_inicio_mes} a {data_fim_mes}')
                
                # Sistema simplificado - sem parcelas
                parcelas_mes = []
                total_parcelas_mes = 0
                
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
                try:
                    total_custos_fixos = custos_fixos.get_total_custos_fixos() if custos_fixos else Decimal('0')
                except:
                    total_custos_fixos = Decimal('0')
                
                # Converter para float para evitar problemas com Decimal
            except Exception as e:
                logger.error(f'Erro ao calcular datas: {e}')
                data_inicio_mes = datetime.now().date().replace(day=1)
                data_fim_mes = datetime.now().date()
            
            try:
                custos_fixos_mensais = CustoFixoMensal.objects.filter(
                    status='ativo',
                    data_inicio__lte=data_fim_mes
                ).filter(
                    Q(data_fim__isnull=True) | Q(data_fim__gte=data_inicio_mes)
                )
                total_custos_fixos_mensais = sum(float(custo.valor_mensal) for custo in custos_fixos_mensais)
                logger.info(f'Total custos fixos mensais: {total_custos_fixos_mensais}')
            except Exception as e:
                logger.error(f'Erro ao calcular custos fixos mensais: {e}')
                custos_fixos_mensais = CustoFixoMensal.objects.none()
                total_custos_fixos_mensais = 0
            
            try:
                # Não usar parcelas - simplificado
                total_parcelas_mes = 0
                logger.info('Sistema simplificado - sem parcelas')
            except Exception as e:
                logger.error(f'Erro ao calcular parcelas: {e}')
                parcelas_mes = []
                total_parcelas_mes = 0
            
            # Se é um novo registro, pedir para preencher os custos
            if created:
                logger.info(f'Novo registro de custos criado para {ano_mes}')
                messages.info(request, f'Preencha os custos fixos para {ano_mes}')
                return render(request, 'login/relatorio_mensal.html', {
                    'ano_mes': ano_mes,
                    'custos_fixos': custos_fixos,
                    'custos_fixos_mensais': custos_fixos_mensais if 'custos_fixos_mensais' in locals() else [],
                    'total_custos_fixos_mensais': total_custos_fixos_mensais if 'total_custos_fixos_mensais' in locals() else 0,
                    'relatorios': relatorios,
                    'total_diarias': total_diarias,
                    'total_valor_diarias': total_valor_diarias,
                    'total_litros': total_litros,
                    'total_gasto_gasolina': total_gasto_gasolina,
                    'total_receita_frete': total_receita_frete,
                    'preencher_custos': True
                })
            
            # Calcular lucro líquido
            try:
                if custos_fixos:
                    total_custos_fixos = custos_fixos.get_total_custos_fixos()
                    logger.info(f'Total custos fixos: {total_custos_fixos}')
                else:
                    total_custos_fixos = Decimal('0')
                    logger.info('Custos fixos não encontrados, usando 0')
            except Exception as e:
                logger.error(f'Erro ao calcular custos fixos: {e}')
                total_custos_fixos = Decimal('0')
            
            # Converter para float para evitar problemas com Decimal
            try:
                # Converter valores com tratamento de erro
                total_gasto_gasolina_float = float(total_gasto_gasolina) if total_gasto_gasolina else 0.0
                total_valor_diarias_float = float(total_valor_diarias) if total_valor_diarias else 0.0
                total_custos_gerais_float = float(total_custos_gerais) if total_custos_gerais else 0.0
                total_receita_frete_float = float(total_receita_frete) if total_receita_frete else 0.0
                total_custos_fixos_float = float(total_custos_fixos) if total_custos_fixos else 0.0
                total_custos_fixos_mensais_float = float(total_custos_fixos_mensais) if total_custos_fixos_mensais else 0.0
                total_parcelas_mes_float = 0.0
                
                logger.info(f'Valores convertidos - Gasolina: {total_gasto_gasolina_float}, Diárias: {total_valor_diarias_float}, Receita: {total_receita_frete_float}')
                
                # Incluir custos fixos mensais e parcelas no cálculo
                total_despesas = total_gasto_gasolina_float + total_valor_diarias_float + total_custos_fixos_float + total_custos_gerais_float + total_custos_fixos_mensais_float + total_parcelas_mes_float
                lucro_liquido = total_receita_frete_float - total_despesas
                
                # Garantir que os valores não sejam negativos ou NaN
                if total_despesas < 0:
                    total_despesas = 0.0
                if lucro_liquido != lucro_liquido:  # Check for NaN
                    lucro_liquido = 0.0
                
                logger.info(f'Total despesas: {total_despesas}, Lucro: {lucro_liquido}')
                logger.info(f'Receita: {total_receita_frete_float}, Gasolina: {total_gasto_gasolina_float}, Diárias: {total_valor_diarias_float}')
                logger.info(f'Custos fixos: {total_custos_fixos_float}, Custos gerais: {total_custos_gerais_float}, Custos fixos mensais: {total_custos_fixos_mensais_float}, Parcelas: {total_parcelas_mes_float}')
                
                context = {
                    'ano_mes': ano_mes,
                    'custos_fixos': custos_fixos,
                    'custos_fixos_mensais': custos_fixos_mensais,
                    'total_custos_fixos_mensais': total_custos_fixos_mensais_float,
                    'custos_gerais_mes': custos_gerais_mes,
                    'total_custos_gerais': total_custos_gerais_float,
                    'relatorios': relatorios,
                    'total_diarias': total_diarias,
                    'total_valor_diarias': total_valor_diarias_float,
                    'total_litros': float(total_litros),
                    'total_gasto_gasolina': total_gasto_gasolina_float,
                    'total_receita_frete': total_receita_frete_float,
                    'total_custos_fixos': total_custos_fixos_float,
                    'total_despesas': total_despesas,
                    'lucro_liquido': lucro_liquido,
                    'preencher_custos': False
                }
                
                logger.info(f'Contexto criado - Total despesas: {total_despesas}, Lucro: {lucro_liquido}')
                logger.info(f'Valores finais - Receita: {total_receita_frete_float}, Gasolina: {total_gasto_gasolina_float}, Diárias: {total_valor_diarias_float}')
                logger.info(f'Custos - Fixos: {total_custos_fixos_float}, Gerais: {total_custos_gerais_float}, Fixos Mensais: {total_custos_fixos_mensais_float}')
                
                return render(request, 'login/relatorio_mensal.html', context)
                
            except ValueError:
                messages.error(request, 'Formato de data inválido.')
            except Exception as e:
                logger.error(f'Erro ao calcular lucro: {e}')
                total_despesas = 0
                lucro_liquido = 0
            
            # Criar lista de custos gerais incluindo parcelas individuais
            custos_gerais_detalhados = []
            
            for custo in custos_gerais_mes:
                # Sistema simplificado - sem parcelas
                if False:  # Desabilitado
                    # Para custos parcelados, mostrar cada parcela como um custo separado
                    # for parcela in custo.parcelas.all():  # COMENTADO: modelo não tem parcelas

                    if False:  # Bloco desabilitado
                        # Criar um objeto similar ao custo original mas com dados da parcela
                        class ParcelaCustoWrapper:
                            def __init__(self, custo_original, parcela):
                                self.id = f"{custo_original.id}_{parcela.id}"
                                self.data = custo_original.data
                                self.tipo_gasto = custo_original.tipo_gasto
                                self.veiculo_placa = custo_original.veiculo_placa
                                self.oficina_fornecedor = custo_original.oficina_fornecedor
                                self.descricao = f"{custo_original.descricao} - Parcela {parcela.numero_parcela}"
                                self.valor = parcela.valor_parcela
                                self.forma_pagamento = custo_original.forma_pagamento
                                self.status_pagamento = parcela.status_pagamento
                                self.data_vencimento = parcela.data_vencimento
                                self.observacoes = custo_original.observacoes
                                self.comprovante = custo_original.comprovante
                                self.created_at = custo_original.created_at
                                self.updated_at = custo_original.updated_at
                                self.get_tipo_gasto_display = custo_original.get_tipo_gasto_display
                                self.get_forma_pagamento_display = custo_original.get_forma_pagamento_display
                                self.get_status_pagamento_display = parcela.get_status_pagamento_display
                                self.is_parcela = True
                                self.parcela_numero = parcela.numero_parcela
                                self.total_parcelas = custo_original.parcelas.count()
                                self.parcelas_pagas = custo_original.parcelas.filter(status_pagamento='pago').count()
                                self.parcelas_pendentes = custo_original.parcelas.filter(status_pagamento='pendente').count()
                                self.valor_parcela = parcela.valor_parcela
                        
                        parcela_custo = ParcelaCustoWrapper(custo, parcela)
                        custos_gerais_detalhados.append(parcela_custo)
                else:
                    # Para custos não parcelados, adicionar normalmente
                    custo.is_parcela = False
                    custo.total_parcelas = 0
                    # custo.parcelas_pagas = 0  # REMOVIDO: atributo não existe
                    # custo.parcelas_pendentes = 0  # REMOVIDO: atributo não existe
                    custo.valor_parcela = 0
                    custos_gerais_detalhados.append(custo)
            
            # Ordenar por data e descrição
            custos_gerais_detalhados.sort(key=lambda x: (x.data, x.descricao))

            # Recalcular total de custos gerais com as parcelas individuais
            total_custos_gerais_detalhados = sum(float(custo.valor) for custo in custos_gerais_detalhados)
            
            context = {
                'ano_mes': ano_mes,
                'custos_fixos': custos_fixos,
                'custos_fixos_mensais': custos_fixos_mensais,
                'total_custos_fixos_mensais': total_custos_fixos_mensais,
                'parcelas_mes': parcelas_mes,
                'total_parcelas_mes': 0,
                'custos_gerais_mes': custos_gerais_detalhados,
                'total_custos_gerais': total_custos_gerais_detalhados,
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
            
            logger.info(f'Renderizando relatório com {len(relatorios)} relatórios')
            return render(request, 'login/relatorio_mensal.html', context)
            
        except Exception as e:
            logger.error(f'Erro no relatório mensal: {e}', exc_info=True)
            messages.error(request, f'Erro ao gerar relatório: {str(e)}')
            # Retornar template com dados vazios em caso de erro
            return render(request, 'login/relatorio_mensal.html', {
                'ano_mes': ano_mes if 'ano_mes' in locals() else None,
                'relatorios': [],
                'total_diarias': 0,
                'total_valor_diarias': 0,
                'total_litros': 0,
                'total_gasto_gasolina': 0,
                'total_receita_frete': 0,
                'total_custos_fixos': 0,
                'total_despesas': 0,
                'lucro_liquido': 0,
                'preencher_custos': False,
                'erro': str(e)
            })
    
    logger.info('Renderizando página inicial do relatório mensal')
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
def relatorio_diario(request):
    """View para relatórios diários"""
    # Aceitar tanto POST quanto GET
    if request.method == 'POST':
        data_viagem = request.POST.get('data_viagem')
    else:
        data_viagem = request.GET.get('data_viagem')
        
    if data_viagem:
        try:
            data_viagem = datetime.strptime(data_viagem, '%Y-%m-%d').date()
            
            # Buscar relatório do dia
            relatorio = DailyReport.objects.filter(data_viagem=data_viagem).first()
            
            if not relatorio:
                messages.info(request, f'Nenhum relatório encontrado para {data_viagem.strftime("%d/%m/%Y")}')
                return render(request, 'login/relatorio_diario.html', {
                    'data_viagem': data_viagem,
                    'relatorio': None,
                    'custos_gerais_detalhados': [],
                    'total_custos_gerais': 0,
                    'total_gastos': 0,
                    'lucro_liquido': 0
                })
            
            # Buscar custos gerais do dia
            custos_gerais_dia = CustosGerais.objects.filter(data=data_viagem)
            
            # Criar lista de custos gerais incluindo parcelas individuais
            custos_gerais_detalhados = []
            
            for custo in custos_gerais_dia:
                # Sistema simplificado - sem parcelas
                if False:  # Desabilitado
                    # Para custos parcelados, mostrar cada parcela como um custo separado
                    # for parcela in custo.parcelas.all():  # COMENTADO: modelo não tem parcelas

                    if False:  # Bloco desabilitado
                        # Criar um objeto similar ao custo original mas com dados da parcela
                        class ParcelaCustoWrapper:
                            def __init__(self, custo_original, parcela):
                                self.id = f"{custo_original.id}_{parcela.id}"
                                self.data = custo_original.data
                                self.tipo_gasto = custo_original.tipo_gasto
                                self.veiculo_placa = custo_original.veiculo_placa
                                self.oficina_fornecedor = custo_original.oficina_fornecedor
                                self.descricao = f"{custo_original.descricao} - Parcela {parcela.numero_parcela}"
                                self.valor = parcela.valor_parcela
                                self.forma_pagamento = custo_original.forma_pagamento
                                self.status_pagamento = parcela.status_pagamento
                                self.data_vencimento = parcela.data_vencimento
                                self.observacoes = custo_original.observacoes
                                self.comprovante = custo_original.comprovante
                                self.created_at = custo_original.created_at
                                self.updated_at = custo_original.updated_at
                                self.get_tipo_gasto_display = custo_original.get_tipo_gasto_display
                                self.get_forma_pagamento_display = custo_original.get_forma_pagamento_display
                                self.get_status_pagamento_display = parcela.get_status_pagamento_display
                                self.is_parcela = True
                                self.parcela_numero = parcela.numero_parcela
                                self.total_parcelas = custo_original.parcelas.count()
                                self.parcelas_pagas = custo_original.parcelas.filter(status_pagamento='pago').count()
                                self.parcelas_pendentes = custo_original.parcelas.filter(status_pagamento='pendente').count()
                                self.valor_parcela = parcela.valor_parcela
                        
                        parcela_custo = ParcelaCustoWrapper(custo, parcela)
                        custos_gerais_detalhados.append(parcela_custo)
                else:
                    # Para custos não parcelados, adicionar normalmente
                    custo.is_parcela = False
                    custo.total_parcelas = 0
                    # custo.parcelas_pagas = 0  # REMOVIDO: atributo não existe
                    # custo.parcelas_pendentes = 0  # REMOVIDO: atributo não existe
                    custo.valor_parcela = 0
                    custos_gerais_detalhados.append(custo)
            
            # Ordenar por descrição
            custos_gerais_detalhados.sort(key=lambda x: x.descricao)
            
            # Calcular total de custos gerais
            total_custos_gerais = sum(float(custo.valor) for custo in custos_gerais_detalhados)
            
            # Calcular lucro líquido incluindo custos gerais
            total_gastos = float(relatorio.gasto_gasolina) + float(relatorio.valor_diarias) + total_custos_gerais
            lucro_liquido = float(relatorio.receita_frete) - total_gastos
            
            context = {
                'data_viagem': data_viagem,
                'relatorio': relatorio,
                'custos_gerais_detalhados': custos_gerais_detalhados,
                'total_custos_gerais': total_custos_gerais,
                'total_gastos': total_gastos,
                'lucro_liquido': lucro_liquido
            }
            
            return render(request, 'login/relatorio_diario.html', context)
            
        except ValueError:
            messages.error(request, 'Formato de data inválido. Use DD/MM/AAAA.')
        except Exception as e:
            logger.error(f'Erro no relatório diário: {e}')
            messages.error(request, f'Erro ao gerar relatório: {str(e)}')
    
    return render(request, 'login/relatorio_diario.html')

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
            
            # Se for parcelado, criar as parcelas automaticamente
            if forma_pagamento == 'parcelado':
                quantidade_parcelas = request.POST.get('quantidade_parcelas', '1')
                valor_parcela = request.POST.get('valor_parcela', valor)
                data_primeira_parcela = request.POST.get('data_primeira_parcela', data)
                dia_vencimento = request.POST.get('dia_vencimento', '15')
                
                try:
                    quantidade_parcelas = int(quantidade_parcelas)
                    valor_parcela = Decimal(valor_parcela)
                    data_primeira_parcela = datetime.strptime(data_primeira_parcela, '%Y-%m-%d').date()
                    dia_vencimento = int(dia_vencimento)
                    
                    # Criar parcelas
                    for i in range(quantidade_parcelas):
                        # Calcular data de vencimento da parcela
                        if i == 0:
                            data_vencimento_parcela = data_primeira_parcela
                        else:
                            # Adicionar meses à data da primeira parcela
                            from dateutil.relativedelta import relativedelta
                            data_vencimento_parcela = data_primeira_parcela + relativedelta(months=i)
                            # Ajustar para o dia de vencimento especificado
                            data_vencimento_parcela = data_vencimento_parcela.replace(day=min(dia_vencimento, 28))
                        
                        # Sistema simplificado - sem parcelas
                        pass
                    
                    messages.success(request, f'Custo parcelado criado com {quantidade_parcelas} parcelas!')
                    
                except (ValueError, TypeError) as e:
                    messages.warning(request, f'Custo criado, mas houve erro ao criar parcelas: {str(e)}')
            
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
                # Buscar custos gerais da viagem
                custos_gerais = CustosGerais.objects.filter(relatorio_id=relatorio.id)
                total_custos_gerais = custos_gerais.aggregate(Sum('valor'))['valor__sum'] or Decimal('0')
                
                # Buscar parcelas de custos gerais
                todas_parcelas = []
                
                for custo in custos_gerais:
                    
                    # Sempre adicionar o custo como uma "parcela"
                    todas_parcelas.append({
                        'id': f"custo_{custo.id}",
                        'custo_id': custo.id,
                        'tipo_gasto': custo.get_tipo_gasto_display(),
                        'descricao': custo.descricao,
                        'oficina_fornecedor': custo.oficina_fornecedor or 'N/A',
                        'veiculo_placa': custo.veiculo_placa or 'N/A',
                        'numero_parcela': 1,
                        'valor_parcela': float(custo.valor),
                        'data_vencimento': custo.data.strftime('%d/%m/%Y'),
                        'status_pagamento': custo.get_status_pagamento_display(),
                        'paga': custo.status_pagamento == 'pago',
                        'forma_pagamento': custo.get_forma_pagamento_display(),
                        'observacoes': custo.observacoes or ''
                    })
                    
                    # REMOVIDO: Sistema simplificado sem parcelas
                    # parcelas = custo.parcelas.all().order_by('numero_parcela')
                    # for parcela in parcelas: ...
                
                relatorio_data = {
                    'id': relatorio.id,
                    'date': relatorio.data_viagem.isoformat(),
                    'localPartida': relatorio.partida,
                    'localChegada': relatorio.chegada,
                    'nomeMotorista': relatorio.motorista,
                    'nomeCaminhao': relatorio.caminhao,
                    'quantidadeDiarias': relatorio.diarias,
                    'totalDiarias': float(relatorio.valor_diarias),
                    'litrosGasolina': float(relatorio.litros_gasolina),
                    'valorGasolina': float(relatorio.gasto_gasolina),
                    'receita': float(relatorio.receita_frete),
                    'totalGastosViagem': float(relatorio.valor_diarias) + float(relatorio.gasto_gasolina),
                    'totalCustosGerais': float(total_custos_gerais),
                    'totalDespesas': float(relatorio.valor_diarias) + float(relatorio.gasto_gasolina) + float(total_custos_gerais),
                    'lucroLiquido': float(relatorio.receita_frete) - float(relatorio.valor_diarias) - float(relatorio.gasto_gasolina) - float(total_custos_gerais),
                    'salarioLiquido': 0.0,
                    'todasParcelas': todas_parcelas,
                    'totalParcelas': len(todas_parcelas),
                    'parcelasPagas': len([p for p in todas_parcelas if p['paga']]),
                    'parcelasPendentes': len([p for p in todas_parcelas if not p['paga']])
                }

                # Campos de compatibilidade esperados pelo frontend (tabela de busca)
                relatorio_data.update({
                    'data_viagem': relatorio.data_viagem.isoformat(),
                    'partida': relatorio.partida or '',
                    'chegada': relatorio.chegada or '',
                    'motorista': relatorio.motorista or '',
                    'receita_frete': float(relatorio.receita_frete) if relatorio.receita_frete is not None else 0.0,
                    'gasto_gasolina': float(relatorio.gasto_gasolina) if relatorio.gasto_gasolina is not None else 0.0,
                    'valor_diarias': float(relatorio.valor_diarias) if relatorio.valor_diarias is not None else 0.0,
                    'totalGastos': float(relatorio.valor_diarias) + float(relatorio.gasto_gasolina)
                })
                
                
                relatorios_data.append(relatorio_data)
            
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
            todas_parcelas_mes = []
            
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
                
                # Adicionar custo como parcela
                todas_parcelas_mes.append({
                    'id': f"custo_{custo.id}",
                    'custo_id': custo.id,
                    'tipo_gasto': custo.get_tipo_gasto_display(),
                    'descricao': custo.descricao,
                    'oficina_fornecedor': custo.oficina_fornecedor or 'N/A',
                    'veiculo_placa': custo.veiculo_placa or 'N/A',
                    'numero_parcela': 1,
                    'valor_parcela': float(custo.valor),
                    'data_vencimento': custo.data.strftime('%d/%m/%Y'),
                    'status_pagamento': custo.get_status_pagamento_display(),
                    'paga': custo.status_pagamento == 'pago',
                    'forma_pagamento': custo.get_forma_pagamento_display(),
                    'observacoes': custo.observacoes or ''
                })
                
                # REMOVIDO: Sistema simplificado sem parcelas
                # parcelas = custo.parcelas.all().order_by('numero_parcela')
                # for parcela in parcelas: ...
            
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
                'custos_gerais_mes': custos_gerais_data,
                'todasParcelas': todas_parcelas_mes,
                'totalParcelas': len(todas_parcelas_mes),
                'parcelasPagas': len([p for p in todas_parcelas_mes if p['paga']]),
                'parcelasPendentes': len([p for p in todas_parcelas_mes if not p['paga']])
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
    logger.info(f'=== ATUALIZAR RELATÓRIO ===')
    logger.info(f'ID do relatório: {relatorio_id}')
    logger.info(f'Tipo do ID: {type(relatorio_id)}')
    
    # Buscar o relatório existente
    try:
        relatorio = get_object_or_404(DailyReport, id=relatorio_id)
        logger.info(f'Relatório encontrado: {relatorio.id} - {relatorio.data_viagem}')
    except Exception as e:
        logger.error(f'Erro ao buscar relatório {relatorio_id}: {e}', exc_info=True)
        messages.error(request, f'Relatório não encontrado!')
        return redirect('dashboard')
    
    if request.method == 'GET':
        # Exibir formulário de edição com dados preenchidos
        try:
            custos_gerais = CustosGerais.objects.filter(relatorio=relatorio)
            
            # Buscar salário do motorista se existir
            salario_motorista = None
            if relatorio.motorista:
                ano_mes = relatorio.data_viagem.strftime('%Y-%m')
                try:
                    salario_motorista = MotoristaSalario.objects.get(
                        motorista=relatorio.motorista,
                        ano_mes=ano_mes
                    )
                except MotoristaSalario.DoesNotExist:
                    logger.info(f'Salário não encontrado para {relatorio.motorista} em {ano_mes}')
                    pass
            
            context = {
                'relatorio': relatorio,
                'custos_gerais': custos_gerais,
                'salario_motorista': salario_motorista,
            }
            
            logger.info(f'Renderizando template de edição para relatório {relatorio_id}')
            return render(request, 'login/editar_relatorio.html', context)
        except Exception as e:
            logger.error(f'Erro ao preparar dados para edição: {e}', exc_info=True)
            messages.error(request, f'Erro ao carregar dados do relatório!')
            return redirect('dashboard')
    
    elif request.method == 'POST':
        try:
            
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
    # Garantir que sempre retorne JSON para requisições AJAX
    if request.headers.get('X-Requested-With') != 'XMLHttpRequest':
        return JsonResponse({'success': False, 'message': 'Requisição inválida'})
    
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
                return JsonResponse({'custos_fixos': custos_data})
        
        return JsonResponse({'success': False, 'message': 'Método não permitido'})
        
    except Exception as e:
        logger.error(f'Erro geral na view custos_fixos: {e}')
        return JsonResponse({'success': False, 'message': f'Erro interno do servidor: {str(e)}'})

@login_required
def editar_custo_fixo(request, custo_id):
    """View para editar custo fixo"""
    try:
        custo = get_object_or_404(CustoFixoMensal, id=custo_id)
        
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
                
                # Atualizar o custo fixo
                custo.descricao = descricao
                custo.tipo_custo = tipo_custo
                custo.valor_mensal = Decimal(valor_mensal)
                custo.data_inicio = data_inicio
                custo.data_fim = data_fim
                custo.status = status
                custo.observacoes = observacoes
                custo.save()
                
                mensagem = f'Custo fixo "{descricao}" atualizado com sucesso!'
                
                if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                    return JsonResponse({'success': True, 'message': mensagem})
                else:
                    messages.success(request, mensagem)
                    return redirect('dashboard')
                    
            except Exception as e:
                logger.error(f'Erro ao atualizar custo fixo: {e}')
                if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                    return JsonResponse({'success': False, 'message': f'Erro ao atualizar custo fixo: {str(e)}'})
                else:
                    messages.error(request, f'Erro ao atualizar custo fixo: {str(e)}')
                    return redirect('dashboard')
        
        elif request.method == 'GET':
            # Retornar dados do custo fixo para edição
            custo_data = {
                'id': custo.id,
                'descricao': custo.descricao,
                'tipo_custo': custo.tipo_custo,
                'valor_mensal': float(custo.valor_mensal),
                'data_inicio': custo.data_inicio.strftime('%Y-%m-%d'),
                'data_fim': custo.data_fim.strftime('%Y-%m-%d') if custo.data_fim else None,
                'status': custo.status,
                'observacoes': custo.observacoes,
            }
            
            if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                return JsonResponse({'success': True, 'custo': custo_data})
            else:
                return JsonResponse({'success': True, 'custo': custo_data})
                
    except Exception as e:
        logger.error(f'Erro ao buscar custo fixo: {e}')
        if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
            return JsonResponse({'success': False, 'message': f'Erro ao buscar custo fixo: {str(e)}'})
        else:
            messages.error(request, f'Erro ao buscar custo fixo: {str(e)}')
            return redirect('dashboard')

@login_required
def excluir_custo_fixo(request, custo_id):
    """View para excluir custo fixo"""
    # Garantir que sempre retorne JSON para requisições AJAX
    if request.headers.get('X-Requested-With') != 'XMLHttpRequest':
        return JsonResponse({'success': False, 'message': 'Requisição inválida'})
    
    if request.method == 'POST':
        try:
            # Verificar se o custo existe
            try:
                custo = CustoFixoMensal.objects.get(id=custo_id)
            except CustoFixoMensal.DoesNotExist:
                mensagem = f'Custo fixo com ID {custo_id} não encontrado!'
                if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                    return JsonResponse({'success': False, 'message': mensagem})
                else:
                    messages.error(request, mensagem)
                    return redirect('dashboard')
            
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




@login_required
def apagar_custo_fixo(request, custo_id):
    """View para apagar custo fixo mensal"""
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

