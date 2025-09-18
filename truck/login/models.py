from django.db import models
from django.core.validators import MinValueValidator
from decimal import Decimal

class DailyReport(models.Model):
    """Modelo para relatórios diários de viagens"""
    data_viagem = models.DateField(verbose_name="Data da Viagem")
    partida = models.CharField(max_length=200, verbose_name="Local de Partida")
    chegada = models.CharField(max_length=200, verbose_name="Local de Chegada")
    diarias = models.PositiveIntegerField(verbose_name="Número de Diárias")
    valor_diarias = models.DecimalField(
        max_digits=10, 
        decimal_places=2, 
        default=Decimal('0.00'),
        validators=[MinValueValidator(Decimal('0.00'))],
        verbose_name="Valor das Diárias"
    )
    litros_gasolina = models.DecimalField(
        max_digits=8, 
        decimal_places=2, 
        default=Decimal('0.00'),
        validators=[MinValueValidator(Decimal('0.00'))],
        verbose_name="Litros de Gasolina"
    )
    gasto_gasolina = models.DecimalField(
        max_digits=10, 
        decimal_places=2, 
        default=Decimal('0.00'),
        validators=[MinValueValidator(Decimal('0.00'))],
        verbose_name="Gasto com Gasolina"
    )
    receita_frete = models.DecimalField(
        max_digits=10, 
        decimal_places=2, 
        default=Decimal('0.00'),
        validators=[MinValueValidator(Decimal('0.00'))],
        verbose_name="Receita do Frete"
    )
    motorista = models.CharField(max_length=100, verbose_name="Motorista")
    caminhao = models.CharField(max_length=50, verbose_name="Caminhão")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Criado em")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Atualizado em")

    class Meta:
        verbose_name = "Relatório Diário"
        verbose_name_plural = "Relatórios Diários"
        ordering = ['-data_viagem', '-created_at']

    def __str__(self):
        return f"{self.data_viagem} - {self.partida} → {self.chegada} ({self.motorista})"

    def get_lucro(self):
        """Calcula o lucro da viagem (receita - gastos)"""
        try:
            return self.receita_frete - self.gasto_gasolina - self.valor_diarias
        except (TypeError, ValueError, InvalidOperation):
            return Decimal('0.00')

    def save(self, *args, **kwargs):
        # Calcular valor das diárias automaticamente (R$ 70 por diária)
        try:
            self.valor_diarias = self.diarias * Decimal('70.00')
        except (TypeError, ValueError, InvalidOperation) as e:
            # Se houver erro na operação decimal, usar valor padrão
            self.valor_diarias = Decimal('0.00')
        super().save(*args, **kwargs)

class MonthlyCost(models.Model):
    """Modelo para custos fixos mensais"""
    ano_mes = models.CharField(max_length=7, unique=True, verbose_name="Ano-Mês (YYYY-MM)")
    pecas = models.DecimalField(
        max_digits=10, 
        decimal_places=2, 
        default=Decimal('0.00'),
        validators=[MinValueValidator(Decimal('0.00'))],
        verbose_name="Peças"
    )
    seguro = models.DecimalField(
        max_digits=10, 
        decimal_places=2, 
        default=Decimal('0.00'),
        validators=[MinValueValidator(Decimal('0.00'))],
        verbose_name="Seguro"
    )
    manutencao = models.DecimalField(
        max_digits=10, 
        decimal_places=2, 
        default=Decimal('0.00'),
        validators=[MinValueValidator(Decimal('0.00'))],
        verbose_name="Manutenção"
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Criado em")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Atualizado em")

    class Meta:
        verbose_name = "Custo Mensal"
        verbose_name_plural = "Custos Mensais"
        ordering = ['-ano_mes']

    def __str__(self):
        return f"Custos de {self.ano_mes}"

    def get_total_custos_fixos(self):
        """Retorna o total dos custos fixos do mês"""
        return self.pecas + self.seguro + self.manutencao

class MotoristaSalario(models.Model):
    """Modelo para salários dos motoristas"""
    motorista = models.CharField(max_length=100, verbose_name="Motorista")
    ano_mes = models.CharField(max_length=7, verbose_name="Ano-Mês (YYYY-MM)")
    salario_base = models.DecimalField(
        max_digits=10, 
        decimal_places=2, 
        default=Decimal('0.00'),
        validators=[MinValueValidator(Decimal('0.00'))],
        verbose_name="Salário Base"
    )
    bonus_viagens = models.DecimalField(
        max_digits=10, 
        decimal_places=2, 
        default=Decimal('0.00'),
        validators=[MinValueValidator(Decimal('0.00'))],
        verbose_name="Bônus por Viagens"
    )
    desconto_faltas = models.DecimalField(
        max_digits=10, 
        decimal_places=2, 
        default=Decimal('0.00'),
        validators=[MinValueValidator(Decimal('0.00'))],
        verbose_name="Desconto por Faltas"
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Criado em")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Atualizado em")

    class Meta:
        verbose_name = "Salário do Motorista"
        verbose_name_plural = "Salários dos Motoristas"
        unique_together = ['motorista', 'ano_mes']
        ordering = ['-ano_mes', 'motorista']

    def __str__(self):
        return f"{self.motorista} - {self.ano_mes}"

    def get_salario_liquido(self):
        """Calcula o salário líquido do motorista"""
        return self.salario_base + self.bonus_viagens - self.desconto_faltas

class CustosGerais(models.Model):
    """Modelo para custos gerais do negócio"""
    
    TIPO_GASTO_CHOICES = [
        ('combustivel', 'Combustível'),
        ('manutencao', 'Manutenção'),
        ('pecas', 'Peças'),
        ('seguro', 'Seguro'),
        ('documentacao', 'Documentação'),
        ('multas', 'Multas'),
        ('estacionamento', 'Estacionamento'),
        ('pedagio', 'Pedágio'),
        ('outros', 'Outros'),
    ]
    
    FORMA_PAGAMENTO_CHOICES = [
        ('vista', 'À Vista'),
        ('credito', 'Cartão de Crédito'),
        ('debito', 'Cartão de Débito'),
        ('pix', 'PIX'),
        ('transferencia', 'Transferência'),
        ('cheque', 'Cheque'),
        ('parcelado', 'Parcelado'),
    ]
    
    STATUS_PAGAMENTO_CHOICES = [
        ('pago', 'Pago'),
        ('nao_pago', 'Não Pago'),
        ('parcial', 'Parcialmente Pago'),
    ]

    relatorio = models.ForeignKey(
        DailyReport, 
        on_delete=models.CASCADE, 
        related_name='custos_gerais',
        verbose_name="Relatório",
        null=True,
        blank=True
    )
    tipo_gasto = models.CharField(
        max_length=20, 
        choices=TIPO_GASTO_CHOICES, 
        verbose_name="Tipo de Gasto"
    )
    data = models.DateField(verbose_name="Data")
    veiculo_placa = models.CharField(max_length=20, verbose_name="Placa do Veículo")
    km_atual = models.PositiveIntegerField(null=True, blank=True, verbose_name="KM Atual")
    oficina_fornecedor = models.CharField(max_length=200, verbose_name="Oficina/Fornecedor")
    descricao = models.TextField(verbose_name="Descrição")
    valor = models.DecimalField(
        max_digits=10, 
        decimal_places=2,
        default=Decimal('0.00'),
        validators=[MinValueValidator(Decimal('0.00'))],
        verbose_name="Valor"
    )
    forma_pagamento = models.CharField(
        max_length=20, 
        choices=FORMA_PAGAMENTO_CHOICES, 
        verbose_name="Forma de Pagamento"
    )
    status_pagamento = models.CharField(
        max_length=20, 
        choices=STATUS_PAGAMENTO_CHOICES, 
        verbose_name="Status do Pagamento"
    )
    data_vencimento = models.DateField(null=True, blank=True, verbose_name="Data de Vencimento")
    observacoes = models.TextField(blank=True, verbose_name="Observações")
    comprovante = models.FileField(
        upload_to='comprovantes/', 
        null=True, 
        blank=True, 
        verbose_name="Comprovante"
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Criado em")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Atualizado em")

    class Meta:
        verbose_name = "Custo Geral"
        verbose_name_plural = "Custos Gerais"
        ordering = ['-data', '-created_at']

    def __str__(self):
        try:
            return f"{self.get_tipo_gasto_display()} - {self.oficina_fornecedor} - R$ {self.valor}"
        except (TypeError, ValueError, InvalidOperation):
            return f"Custo Geral - ID {self.id}"

    def get_tipo_gasto_display(self):
        return dict(self.TIPO_GASTO_CHOICES).get(self.tipo_gasto, self.tipo_gasto)

    def get_forma_pagamento_display(self):
        return dict(self.FORMA_PAGAMENTO_CHOICES).get(self.forma_pagamento, self.forma_pagamento)

    def get_status_pagamento_display(self):
        return dict(self.STATUS_PAGAMENTO_CHOICES).get(self.status_pagamento, self.status_pagamento)


class ParcelaCusto(models.Model):
    """Modelo para parcelas de custos"""
    custo_geral = models.ForeignKey(
        CustosGerais, 
        on_delete=models.CASCADE, 
        related_name='parcelas',
        verbose_name="Custo Geral"
    )
    numero_parcela = models.PositiveIntegerField(verbose_name="Número da Parcela")
    valor_parcela = models.DecimalField(
        max_digits=10, 
        decimal_places=2, 
        verbose_name="Valor da Parcela"
    )
    data_vencimento = models.DateField(verbose_name="Data de Vencimento")
    status_pagamento = models.CharField(
        max_length=20,
        choices=CustosGerais.STATUS_PAGAMENTO_CHOICES,
        default='pendente',
        verbose_name="Status do Pagamento"
    )
    data_pagamento = models.DateField(null=True, blank=True, verbose_name="Data do Pagamento")
    observacoes = models.TextField(blank=True, verbose_name="Observações")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Criado em")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Atualizado em")

    class Meta:
        verbose_name = "Parcela de Custo"
        verbose_name_plural = "Parcelas de Custos"
        ordering = ['custo_geral', 'numero_parcela']

    def __str__(self):
        return f"Parcela {self.numero_parcela} - {self.custo_geral.descricao} - R$ {self.valor_parcela}"

    def get_status_pagamento_display(self):
        return dict(CustosGerais.STATUS_PAGAMENTO_CHOICES).get(self.status_pagamento, self.status_pagamento)


class CustoFixoMensal(models.Model):
    """Modelo para custos fixos mensais (parcela do caminhão, seguro, IPVA, etc.)"""
    TIPO_CUSTO_CHOICES = [
        ('parcela_caminhao', 'Parcela do Caminhão'),
        ('seguro', 'Seguro'),
        ('ipva', 'IPVA'),
        ('licenciamento', 'Licenciamento'),
        ('manutencao_preventiva', 'Manutenção Preventiva'),
        ('outros', 'Outros'),
    ]
    
    STATUS_CHOICES = [
        ('ativo', 'Ativo'),
        ('inativo', 'Inativo'),
        ('finalizado', 'Finalizado'),
    ]

    descricao = models.CharField(max_length=200, verbose_name="Descrição")
    tipo_custo = models.CharField(
        max_length=30,
        choices=TIPO_CUSTO_CHOICES,
        verbose_name="Tipo de Custo"
    )
    valor_mensal = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        verbose_name="Valor Mensal"
    )
    data_inicio = models.DateField(verbose_name="Data de Início")
    data_fim = models.DateField(null=True, blank=True, verbose_name="Data de Fim")
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='ativo',
        verbose_name="Status"
    )
    observacoes = models.TextField(blank=True, verbose_name="Observações")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Criado em")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Atualizado em")

    class Meta:
        verbose_name = "Custo Fixo Mensal"
        verbose_name_plural = "Custos Fixos Mensais"
        ordering = ['-data_inicio', 'descricao']

    def __str__(self):
        return f"{self.get_tipo_custo_display()} - {self.descricao} - R$ {self.valor_mensal}/mês"

    def get_tipo_custo_display(self):
        return dict(self.TIPO_CUSTO_CHOICES).get(self.tipo_custo, self.tipo_custo)

    def get_status_display(self):
        return dict(self.STATUS_CHOICES).get(self.status, self.status)

    def is_ativo_em(self, data):
        """Verifica se o custo está ativo em uma data específica"""
        if self.status != 'ativo':
            return False
        if data < self.data_inicio:
            return False
        if self.data_fim and data > self.data_fim:
            return False
        return True
