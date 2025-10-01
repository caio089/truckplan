# 🚀 Guia de Deploy no Render com Supabase

## ✅ Pré-requisitos

- [ ] Conta no Render: https://render.com
- [ ] Conta no Supabase: https://supabase.com
- [ ] Projeto no GitHub

## 📝 Passo 1: Configurar DATABASE_URL do Supabase

1. Acesse: https://supabase.com/dashboard/project/esjnamnjnvkpbocsakfp/settings/database
2. Role até **Connection String**
3. Selecione **URI**
4. Escolha **Transaction** (não Session Pooling)
5. Clique no ícone de olho para revelar a senha
6. Copie a connection string completa

**Formato correto:**
```
postgresql://postgres.esjnamnjnvkpbocsakfp:SUA_SENHA_AQUI@aws-1-us-east-2.pooler.supabase.com:6543/postgres
```

**⚠️ IMPORTANTE:**
- Porta deve ser **6543** (Transaction Pooler)
- NÃO adicione aspas
- NÃO adicione espaços
- A senha deve estar revelada (não `[YOUR-PASSWORD]`)

## 📝 Passo 2: Configurar Variáveis de Ambiente no Render

Acesse seu Web Service no Render e adicione estas variáveis em **Environment**:

### Variáveis Obrigatórias:

```
DATABASE_URL=postgresql://postgres.esjnamnjnvkpbocsakfp:SUA_SENHA@aws-1-us-east-2.pooler.supabase.com:6543/postgres

SECRET_KEY=gere-uma-chave-secreta-forte-aqui

DEBUG=False

ALLOWED_HOSTS=.onrender.com

RENDER=True
```

### Como gerar SECRET_KEY:

Execute no terminal:
```bash
python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
```

## 📝 Passo 3: Configurar o Deploy no Render

1. **New** → **Web Service**
2. Conecte seu repositório GitHub
3. Configure:
   - **Name**: `truckplan` (ou o nome que preferir)
   - **Root Directory**: `truck`
   - **Build Command**: `./build.sh`
   - **Start Command**: `gunicorn truck.wsgi:application`
   - **Instance Type**: `Free`

## 📝 Passo 4: Verificar após Deploy

Após o deploy completar:

1. Acesse os **Logs** do Render
2. Procure por mensagens de erro
3. Verifique se a migração foi executada:
   ```
   Running migrations...
   ✅ Build completed successfully!
   ```

## 🐛 Problemas Comuns e Soluções

### ❌ Erro: "password authentication failed"

**Causa:** Senha incorreta na DATABASE_URL

**Solução:**
1. Vá no Supabase e copie novamente a connection string
2. Certifique-se de revelar a senha (clique no ícone de olho)
3. Atualize a variável DATABASE_URL no Render
4. Faça manual deploy novamente

### ❌ Erro: "DisallowedHost"

**Causa:** ALLOWED_HOSTS não inclui o domínio do Render

**Solução:**
- Certifique-se que `ALLOWED_HOSTS=.onrender.com`
- O ponto inicial (`.onrender.com`) permite todos os subdomínios

### ❌ Erro: "collectstatic failed"

**Causa:** Problema com arquivos estáticos

**Solução:**
1. Verifique se `STATIC_ROOT` está configurado
2. Execute localmente: `python manage.py collectstatic`
3. Commit e faça push novamente

### ❌ Erro: "Application failed to respond"

**Causa:** Porta incorreta ou gunicorn não iniciou

**Solução:**
- Verifique se o comando de start está correto
- Render usa a porta definida pela variável `PORT` automaticamente

## 🎯 Checklist Final

- [ ] `DATABASE_URL` configurada com senha correta
- [ ] Porta é **6543** (Transaction Pooler)
- [ ] `SECRET_KEY` gerada e configurada
- [ ] `DEBUG=False` em produção
- [ ] `ALLOWED_HOSTS=.onrender.com`
- [ ] `RENDER=True` configurado
- [ ] Build command aponta para `./build.sh`
- [ ] Root directory é `truck`
- [ ] Migrations foram executadas
- [ ] Usuário default foi criado

## 📞 Suporte

Se ainda tiver problemas:
1. Verifique os logs no Render: **Logs** tab
2. Copie a mensagem de erro completa
3. Verifique se a connection string do Supabase está correta

## 🎉 Sucesso!

Após o deploy bem-sucedido:
- Acesse: `https://seu-app.onrender.com`
- Login: `admin`
- Senha: (a senha que você configurou no comando create_default_user)

---

**Última atualização:** 01/10/2025

