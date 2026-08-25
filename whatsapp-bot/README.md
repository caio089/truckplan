# TruckPlan — bot privado de fretes no WhatsApp

Serviço Node.js + TypeScript que conecta o WhatsApp do posto como dispositivo vinculado pelo Baileys. Somente o número definido em `WHATSAPP_AUTHORIZED_NUMBER` é processado; grupos, canais, status, mensagens do próprio aparelho e qualquer outro número são ignorados sem resposta.

O bot não contém envio em massa, campanhas, listas de transmissão ou rotinas para contatar terceiros.

## Requisitos

- Node.js 22 ou superior;
- um projeto Supabase;
- um número de WhatsApp para o posto;
- um segundo número autorizado para conversar com o bot.

## 1. Preparar o Supabase

Abra o SQL Editor do Supabase e execute [`supabase/schema.sql`](supabase/schema.sql).

O script cria:

- `freight_reports`: relatórios confirmados;
- `whatsapp_bot_sessions`: etapa da conversa e relatório temporário;
- `processed_whatsapp_messages`: idempotência por `messageId`;
- `whatsapp_baileys_auth`: credenciais e chaves do dispositivo vinculado.

Todas as tabelas têm RLS ativado, não possuem políticas públicas e revogam o acesso de `anon` e `authenticated`. Apenas a role de servidor recebe permissões explícitas.

## 2. Configurar o ambiente

```bash
cp .env.example .env
```

Preencha:

```env
SUPABASE_URL=https://SEU-PROJETO.supabase.co
SUPABASE_SECRET_KEY=sb_secret_SEU_SEGREDO
WHATSAPP_AUTHORIZED_NUMBER=55XXXXXXXXXXX
WHATSAPP_SESSION_ID=truckplan-posto
BOT_RESPONSE_DELAY_MS=5000
LOG_LEVEL=info
```

Use uma chave secreta de servidor (`sb_secret_...`). Projetos antigos também podem usar `SUPABASE_SERVICE_ROLE_KEY`. Nunca coloque essa chave no Django entregue ao navegador, em JavaScript frontend ou em um repositório.

O número autorizado deve conter DDI, DDD e telefone, somente com dígitos. Exemplo: `5586999999999`.

## 3. Instalar e validar

```bash
npm ci
npm test
npm run build
```

## 4. Vincular o WhatsApp

```bash
npm start
```

Na primeira execução, um QR será exibido no terminal. No celular do posto:

1. abra o WhatsApp;
2. acesse **Dispositivos conectados**;
3. escolha **Conectar dispositivo**;
4. escaneie o QR.

As credenciais ficam criptograficamente serializadas na tabela `whatsapp_baileys_auth`, portanto o serviço pode reiniciar sem exigir outro QR.

## Conversa

O fluxo mínimo é:

```text
frete
↓
1
↓
Origem: Teresina
Chegada: Fortaleza
Diárias: 2
Litros de óleo: 180
Valor do óleo: 1080
Custo adicional: 85
↓
1
```

Os dados são interpretados pelo nome antes de `:`, sem depender da ordem. Valores como `1080`, `1080,50`, `1.080,50` e `R$ 1.080,50` são aceitos.

O relatório permanece temporário no Supabase até o usuário responder `1` para confirmar. `2` ou `cancelar` apagam os dados temporários.

## Segurança e operação

- A autorização acontece antes de qualquer acesso à sessão ou resposta.
- Se o WhatsApp entregar apenas um identificador LID sem número telefônico verificável, o evento é ignorado.
- Toda resposta passa por uma única fila e espera, por padrão, cinco segundos.
- Eventos repetidos são bloqueados pelo `messageId` com chave única no banco.
- O armazenamento de autenticação do Baileys nunca deve ser exposto nem copiado para clientes.
- Se o dispositivo for desvinculado pelo WhatsApp, apague apenas as linhas do `WHATSAPP_SESSION_ID` em `whatsapp_baileys_auth` e vincule novamente.
- Baileys é uma integração não oficial. Use somente para este fluxo privado e respeite os termos do WhatsApp.

## Docker

Depois de gerar `package-lock.json`, a imagem pode ser criada com:

```bash
docker build -t truckplan-whatsapp-bot .
docker run --env-file .env truckplan-whatsapp-bot
```

O processo deve permanecer ativo continuamente para manter o dispositivo conectado.
