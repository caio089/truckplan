# TruckPlan - Deploy no Render

## Instruções de Deploy

### 1. Preparação do Repositório

O projeto já está configurado com todos os arquivos necessários para deploy no Render:

- ✅ `requirements.txt` - Dependências Python
- ✅ `render.yaml` - Configuração do Render
- ✅ `Procfile` - Comando de inicialização
- ✅ `build.sh` - Script de build
- ✅ `settings.py` - Configurado para produção

### 2. Deploy no Render

1. **Conecte seu repositório GitHub ao Render:**
   - Acesse [render.com](https://render.com)
   - Faça login e clique em "New +"
   - Selecione "Web Service"
   - Conecte seu repositório GitHub

2. **Configure o serviço:**
   - **Name:** `truckplan`
   - **Environment:** `Python 3`
   - **Build Command:** `pip install -r requirements.txt && python manage.py collectstatic --noinput && python manage.py migrate`
   - **Start Command:** `gunicorn truck.wsgi:application`

3. **Configure as variáveis de ambiente:**
   - `DEBUG`: `False`
   - `SECRET_KEY`: (será gerado automaticamente pelo Render)
   - `ALLOWED_HOSTS`: `truckplan.onrender.com` (substitua pelo seu domínio)
   - `DATABASE_URL`: (será configurado automaticamente se você adicionar um banco PostgreSQL)

4. **Adicione um banco PostgreSQL:**
   - No dashboard do Render, clique em "New +"
   - Selecione "PostgreSQL"
   - Escolha o plano gratuito
   - Conecte o banco ao seu serviço web

### 3. Configurações de Segurança

O sistema já está configurado com:
- ✅ HTTPS obrigatório em produção
- ✅ Cookies seguros
- ✅ Proteção CSRF
- ✅ Headers de segurança
- ✅ WhiteNoise para arquivos estáticos

### 4. Primeiro Acesso

Após o deploy:
1. Acesse a URL fornecida pelo Render
2. O sistema criará automaticamente as tabelas do banco
3. Use as credenciais padrão para login (se configuradas)

### 5. Monitoramento

- Acesse o dashboard do Render para monitorar logs
- Configure alertas se necessário
- Monitore o uso de recursos

## Estrutura de Arquivos para Deploy

```
truckplan/
├── requirements.txt          # Dependências Python
├── render.yaml              # Configuração do Render
├── Procfile                 # Comando de inicialização
├── build.sh                 # Script de build
├── env.example              # Exemplo de variáveis de ambiente
├── README_DEPLOY.md         # Este arquivo
└── truck/                   # Projeto Django
    ├── manage.py
    ├── truck/
    │   ├── settings.py      # Configurado para produção
    │   ├── urls.py
    │   └── wsgi.py
    └── login/
        └── templates/
```

## Troubleshooting

### Problemas Comuns:

1. **Erro de static files:**
   - Verifique se o WhiteNoise está configurado
   - Execute `python manage.py collectstatic` localmente

2. **Erro de banco de dados:**
   - Verifique se o DATABASE_URL está configurado
   - Execute as migrações: `python manage.py migrate`

3. **Erro de ALLOWED_HOSTS:**
   - Adicione seu domínio do Render nas variáveis de ambiente

### Logs:
- Acesse o dashboard do Render
- Vá em "Logs" para ver os logs em tempo real
- Verifique se há erros de build ou runtime
