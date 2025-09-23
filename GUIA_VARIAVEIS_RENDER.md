# 🔧 Variáveis de Ambiente para o Render

## 📋 Lista de Variáveis para Copiar e Colar

### 1. **Variáveis Obrigatórias** (copie exatamente como está):

```
DEBUG=False
SECRET_KEY=django-insecure-%!e8du$3hdcb47yr*ko()muqp%i_ts5@hzzmxhjybw21uywl%z
ALLOWED_HOSTS=truckplan.onrender.com
```

### 2. **Configuração do Banco Supabase** (escolha UMA das opções):

#### **Opção A: DATABASE_URL (RECOMENDADO)**
```
DATABASE_URL=postgresql://postgres:[SUA_SENHA]@[SEU_HOST]:5432/postgres
```

#### **Opção B: Variáveis Individuais**
```
SUPABASE_DB_NAME=postgres
SUPABASE_DB_USER=postgres
SUPABASE_DB_PASSWORD=[SUA_SENHA]
SUPABASE_DB_HOST=[SEU_HOST]
SUPABASE_DB_PORT=5432
```

## 🎯 Como Obter os Dados do Supabase

### Passo 1: Acesse seu Projeto Supabase
1. Vá para [supabase.com](https://supabase.com)
2. Faça login e selecione seu projeto
3. Vá em **Settings** → **Database**

### Passo 2: Copie a Connection String
1. Na seção "Connection string", copie a **URI**
2. Ela será algo como:
   ```
   postgresql://postgres.abcdefghijklmnop:[password]@aws-0-us-east-1.pooler.supabase.com:5432/postgres
   ```

### Passo 3: Substitua [password]
1. Substitua `[password]` pela sua senha real do banco
2. Exemplo final:
   ```
   postgresql://postgres.abcdefghijklmnop:minhasenha123@aws-0-us-east-1.pooler.supabase.com:5432/postgres
   ```

## 🚀 Como Configurar no Render

### Passo 1: Acesse o Dashboard do Render
1. Vá para [render.com](https://render.com)
2. Selecione seu serviço web
3. Vá na aba **Environment**

### Passo 2: Adicione as Variáveis
1. Clique em **Add Environment Variable**
2. Adicione uma por uma:

| Chave | Valor |
|-------|-------|
| `DEBUG` | `False` |
| `SECRET_KEY` | `django-insecure-%!e8du$3hdcb47yr*ko()muqp%i_ts5@hzzmxhjybw21uywl%z` |
| `ALLOWED_HOSTS` | `truckplan.onrender.com` |
| `DATABASE_URL` | `postgresql://postgres.abcdefghijklmnop:minhasenha123@aws-0-us-east-1.pooler.supabase.com:5432/postgres` |

### Passo 3: Salve e Faça Deploy
1. Clique em **Save Changes**
2. O Render fará um novo deploy automaticamente

## ⚠️ Importante

- **NUNCA** compartilhe suas credenciais do banco
- **SEMPRE** use HTTPS em produção
- **VERIFIQUE** se o ALLOWED_HOSTS está correto com seu domínio do Render
- **TESTE** o sistema após o deploy

## 🔍 Verificação

Após configurar, verifique se:
- ✅ O deploy foi bem-sucedido
- ✅ O banco está conectado (sem erros de conexão)
- ✅ As páginas carregam normalmente
- ✅ O login funciona

## 📞 Suporte

Se tiver problemas:
1. Verifique os logs no Render
2. Confirme se as variáveis estão corretas
3. Teste a conexão com o banco localmente
