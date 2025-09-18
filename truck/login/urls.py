from django.urls import path
from . import views

urlpatterns = [
    path('', views.login, name='login'),
    path('dashboard/', views.dashboard, name='dashboard'),
    path('logout/', views.logout_view, name='logout'),
    
    # Rotas para viagens
    path('cadastrar-viagem/', views.cadastrar_viagem, name='cadastrar_viagem'),
    path('listar-viagens/', views.listar_viagens, name='listar_viagens'),
    path('excluir-viagem/<int:viagem_id>/', views.excluir_viagem, name='excluir_viagem'),
    path('buscar-detalhes-viagem/<int:viagem_id>/', views.buscar_detalhes_viagem, name='buscar_detalhes_viagem'),
    
    # Rotas para relatórios
    path('relatorio-semanal/', views.relatorio_semanal, name='relatorio_semanal'),
    path('relatorio-mensal/', views.relatorio_mensal, name='relatorio_mensal'),
    path('salvar-custos-mensais/', views.salvar_custos_mensais, name='salvar_custos_mensais'),
    path('apagar-relatorio-mensal/', views.apagar_relatorio_mensal, name='apagar_relatorio_mensal'),
    
    # Rotas para custos gerais
    path('custos-gerais/', views.custos_gerais, name='custos_gerais'),
    path('adicionar-custo-geral/', views.adicionar_custo_geral, name='adicionar_custo_geral'),
    path('editar-custo-geral/<int:custo_id>/', views.editar_custo_geral, name='editar_custo_geral'),
    path('excluir-custo-geral/<int:custo_id>/', views.excluir_custo_geral, name='excluir_custo_geral'),
    path('buscar-custos-por-data/', views.buscar_custos_por_data, name='buscar_custos_por_data'),
    
    # Rota de teste
    path('teste-abas/', views.teste_abas, name='teste_abas'),
    
    # APIs para relatórios
    path('buscar-relatorios-periodo/', views.buscar_relatorios_periodo, name='buscar_relatorios_periodo'),
    path('buscar-relatorios-mes/', views.buscar_relatorios_mes, name='buscar_relatorios_mes'),
    path('listar-relatorios/', views.listar_relatorios, name='listar_relatorios'),
    path('excluir-relatorio/<int:relatorio_id>/', views.excluir_relatorio, name='excluir_relatorio'),
    path('atualizar-relatorio/<int:relatorio_id>/', views.atualizar_relatorio, name='atualizar_relatorio'),
    
    # Rotas para custos fixos mensais
    path('custos-fixos/', views.custos_fixos, name='custos_fixos'),
    path('excluir-custo-fixo/<int:custo_id>/', views.excluir_custo_fixo, name='excluir_custo_fixo'),
]