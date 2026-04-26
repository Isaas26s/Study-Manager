# PLANNING — PWA + Supabase + Sistema de Login + Planner
# Study Manager — Versão iPad/Web
# Versão: 1.0 | Tudo gratuito ✅

---

## ✅ CONFIRMAÇÃO DE CUSTOS (verificado em Abril/2026)

| Serviço       | Plano       | Custo    | Limite relevante para seu uso          |
|---------------|-------------|----------|----------------------------------------|
| Supabase      | Free        | R$ 0/mês | 500MB banco, 50K usuários, 1GB storage |
| Vercel        | Hobby       | R$ 0/mês | 100GB banda, deploy ilimitado          |
| GitHub        | Free        | R$ 0/mês | Repositórios privados ilimitados       |
| Domínio       | Opcional    | ~R$50/ano| Sem domínio = seuapp.vercel.app grátis |
| **TOTAL**     |             | **R$ 0** |                                        |

⚠️ ATENÇÃO — Um ponto importante sobre o Supabase Free:
O projeto pausa após 7 dias sem nenhum acesso. A solução é simples:
configure um cron job gratuito no próprio Vercel ou no cron-job.org
que faz um ping no banco a cada 5 dias. Isso mantém o projeto ativo para sempre.

---

## ARQUITETURA GERAL

```
┌─────────────────────┐        ┌─────────────────────┐
│   APP DESKTOP       │        │   PWA (iPad/Web)     │
│   Electron + React  │        │   React + Vercel     │
│   Windows .exe      │        │   seuapp.vercel.app  │
│                     │        │                      │
│  • Player de vídeo  │        │  • Planner           │
│  • Lê pasta local   │        │  • Roadmap           │
│  • Cursos Drive     │        │  • Streak            │
└────────┬────────────┘        └──────────┬───────────┘
         │                                │
         └──────────────┬─────────────────┘
                        │
              ┌─────────▼──────────┐
              │     SUPABASE       │
              │  (banco gratuito)  │
              │                   │
              │  • Autenticação    │
              │  • Progresso       │
              │  • Planner tasks   │
              │  • Streak/Sessions │
              │  • Roadmaps        │
              └────────────────────┘
```

---

## MÓDULO 1 — SUPABASE: SETUP E BANCO DE DADOS

### 1.1 Setup inicial (fazer uma vez)
- Criar conta em supabase.com
- Criar projeto: `study-manager`
- Guardar: `Project URL` e `anon public key`
- Ativar Row Level Security (RLS) em todas as tabelas

### 1.2 Tabelas do banco

```sql
-- Usuários (gerenciado pelo Supabase Auth automaticamente)
-- A tabela auth.users já existe, não precisa criar

-- Perfil do usuário
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  name TEXT,
  avatar_url TEXT,
  hardcore_mode BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Roadmaps importados
CREATE TABLE roadmaps (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  roadmap_id TEXT NOT NULL,        -- meta.id do arquivo .roadmap.json
  title TEXT NOT NULL,
  description TEXT,
  data JSONB NOT NULL,             -- conteúdo completo do .roadmap.json
  is_active BOOLEAN DEFAULT false, -- roadmap atual em uso
  imported_at TIMESTAMPTZ DEFAULT NOW()
);

-- Progresso por tarefa/recurso do roadmap
CREATE TABLE roadmap_progress (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  roadmap_id TEXT NOT NULL,
  resource_id TEXT NOT NULL,       -- id do resource no .roadmap.json
  status TEXT DEFAULT 'not_started', -- not_started | in_progress | completed
  completed_at TIMESTAMPTZ,
  notes TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Progresso por tarefa de prática
CREATE TABLE practice_progress (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  roadmap_id TEXT NOT NULL,
  practice_id TEXT NOT NULL,       -- id da practice no .roadmap.json
  completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  notes TEXT
);

-- Missões semanais
CREATE TABLE mission_progress (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  roadmap_id TEXT NOT NULL,
  week_id TEXT NOT NULL,           -- id da week no .roadmap.json
  completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ
);

-- Sessões de estudo diárias
CREATE TABLE study_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  duration_min INTEGER DEFAULT 0,
  blocks_completed JSONB,          -- array de blocos concluídos
  hardcore_met BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Streak
CREATE TABLE streak (
  user_id UUID REFERENCES auth.users(id) PRIMARY KEY,
  last_study_date DATE,
  current_streak INTEGER DEFAULT 0,
  best_streak INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Progresso de aulas (vídeos — sincroniza com o app desktop)
CREATE TABLE lesson_progress (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  lesson_path TEXT NOT NULL,       -- caminho do arquivo no drive
  course_name TEXT,
  status TEXT DEFAULT 'not_started',
  position_sec INTEGER DEFAULT 0,
  completed_at TIMESTAMPTZ,
  notes TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, lesson_path)
);
```

### 1.3 Row Level Security (RLS) — segurança

```sql
-- Aplicar em todas as tabelas para garantir que
-- cada usuário só vê os próprios dados

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE roadmaps ENABLE ROW LEVEL SECURITY;
ALTER TABLE roadmap_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE practice_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE mission_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE streak ENABLE ROW LEVEL SECURITY;
ALTER TABLE lesson_progress ENABLE ROW LEVEL SECURITY;

-- Policy padrão para todas: usuário só acessa os próprios dados
CREATE POLICY "Users can only access own data" ON profiles
  FOR ALL USING (auth.uid() = id);

CREATE POLICY "Users can only access own data" ON roadmaps
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can only access own data" ON roadmap_progress
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can only access own data" ON practice_progress
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can only access own data" ON mission_progress
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can only access own data" ON study_sessions
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can only access own data" ON streak
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can only access own data" ON lesson_progress
  FOR ALL USING (auth.uid() = user_id);
```

---

## MÓDULO 2 — SISTEMA DE LOGIN

### 2.1 Estratégia de autenticação
- Usar Supabase Auth nativo
- Método: Email + Senha (simples, sem OAuth por enquanto)
- Sessão persistente via localStorage (PWA)
- Token JWT renovado automaticamente pelo Supabase client

### 2.2 Telas de autenticação

**Tela de Login**
- Campo: email
- Campo: senha (com toggle mostrar/ocultar)
- Botão: Entrar
- Link: "Esqueci minha senha" → email de reset pelo Supabase
- Sem botão de cadastro — você é o único usuário

**Lógica de sessão**
- Ao abrir o PWA: verifica se tem sessão ativa
- Se sim: vai direto para o Dashboard
- Se não: mostra tela de login
- Token expira em 1 hora, mas Supabase renova automaticamente se o app estiver aberto

### 2.3 Proteção de rotas
Todas as rotas do app exigem sessão válida.
Se o token expirar e não renovar, redireciona para login.

---

## MÓDULO 3 — PWA (Progressive Web App)

### 3.1 O que torna o app um PWA
- Arquivo `manifest.json` com nome, ícone e cores do app
- Service Worker para funcionar offline (cache das telas principais)
- HTTPS obrigatório — Vercel fornece automaticamente
- Meta tags corretas para iOS Safari

### 3.2 Configuração do manifest.json
```json
{
  "name": "Study Manager",
  "short_name": "StudyApp",
  "description": "Planner de estudos com roadmap personalizado",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#0d0d0d",
  "theme_color": "#00e5ff",
  "orientation": "portrait-primary",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

### 3.3 Meta tags especiais para iOS
```html
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Study Manager">
<link rel="apple-touch-icon" href="/icon-192.png">
```

### 3.4 Como instalar no iPad
1. Abrir Safari em `seuapp.vercel.app`
2. Tocar no ícone de compartilhar (quadrado com seta)
3. Selecionar "Adicionar à Tela de Início"
4. Confirmar o nome e tocar em "Adicionar"
5. Ícone aparece na home do iPad — abre em tela cheia sem barra do Safari

### 3.5 Offline mode
- Cache das telas principais via Service Worker
- Dados do planner carregados ficam em memória durante a sessão
- Alterações feitas offline são sincronizadas quando voltar a internet
- Indicador visual de "offline" no topo do app

---

## MÓDULO 4 — TELAS DO PWA

### Tela 1: Login
- Fundo escuro (#0d0d0d)
- Logo/nome do app centralizado
- Formulário simples de email + senha
- Botão de entrar com loading state
- Link "Esqueci a senha"

### Tela 2: Dashboard (Home)
- Saudação com o nome do usuário
- Card de streak: 🔥 X dias seguidos
- Card da semana atual no roadmap ativo
- Missão da semana com checkbox
- Tempo estudado hoje / meta diária
- Atalho para "Continuar estudando" (última sessão)

### Tela 3: Planner / Roadmap
- Selector do roadmap ativo (se tiver mais de um importado)
- Botão: Importar novo roadmap (.roadmap.json)
- Fases expandíveis/colapsáveis
- Semanas com lista de recursos
- Badge por recurso (required, key, optional, free)
- Status por recurso: ⬜ / 🟡 / ✅ (tap para alternar)
- Missão da semana com checkbox grande
- Barra de progresso por fase (% concluído)

### Tela 4: Rotina Diária
- Data de hoje em destaque
- Blocos de estudo com cronômetro individual
  - Botão iniciar/pausar por bloco
  - Barra de progresso do bloco
- Resumo do dia: X horas estudadas
- Toggle: Modo Hardcore 🔴
- Botão: Encerrar sessão do dia

### Tela 5: Progresso
- Streak atual e recorde
- Heatmap de dias estudados (últimos 3 meses)
- Total de horas estudadas
- Projetos/missões concluídas
- Progresso por fase do roadmap ativo
- Gráfico de minutos por dia (últimos 7 dias)

### Tela 6: Configurações
- Nome do usuário (editável)
- Gerenciar roadmaps importados
- Tema: escuro (padrão) / claro
- Modo Hardcore: on/off
- Meta diária de horas (padrão: 3h)
- Botão: Sair da conta

---

## MÓDULO 5 — IMPORTAÇÃO DE ROADMAPS

### 5.1 Fluxo de importação
1. Usuário toca em "Importar Roadmap"
2. Abre seletor de arquivo (aceita apenas `.roadmap.json`)
3. App lê o arquivo e valida o JSON
4. Se válido: salva na tabela `roadmaps` no Supabase
5. Pergunta: "Ativar esse roadmap agora?" → sim/não
6. Roadmap aparece na tela do Planner

### 5.2 Validação do arquivo
Campos obrigatórios verificados antes de salvar:
- `meta.id` existe e é string
- `meta.title` existe
- `meta.total_weeks` é número
- `phases` é array não vazio
- Cada phase tem `weeks` array não vazio

### 5.3 Múltiplos roadmaps
- Usuário pode ter vários roadmaps importados
- Apenas 1 é "ativo" por vez
- Pode trocar o roadmap ativo nas configurações
- Progresso é salvo separado por `roadmap_id`

---

## MÓDULO 6 — SINCRONIZAÇÃO COM APP DESKTOP

### 6.1 O que sincroniza
| Dado                    | PC → Supabase | iPad lê |
|-------------------------|---------------|---------|
| Aula marcada como vista | ✅            | ✅      |
| Posição no vídeo        | ✅            | ❌      |
| Tarefa do planner       | ✅            | ✅      |
| Sessão de estudo        | ✅            | ✅      |
| Streak                  | ✅            | ✅      |
| Roadmap importado       | ✅            | ✅      |

### 6.2 Lógica de conflito
- Last Write Wins — o dado mais recente sempre ganha
- `updated_at` é usado para resolver conflitos
- Sem necessidade de lógica complexa para uso pessoal

### 6.3 Sincronização em tempo real (opcional)
- Supabase tem Realtime nativo
- Se abrir o iPad enquanto estuda no PC, os dados atualizam automaticamente
- Implementar com `supabase.channel()` na versão 2.0

---

## MÓDULO 7 — SOLUÇÃO DO PAUSE DO SUPABASE FREE

O Supabase pausa projetos após 7 dias sem acesso.
Solução: Ping automático a cada 5 dias.

### Opção A — Vercel Cron Job (recomendado, gratuito)
No arquivo `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/keep-alive",
      "schedule": "0 9 */5 * *"
    }
  ]
}
```

Criar arquivo `api/keep-alive.js`:
```javascript
import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  )
  await supabase.from('profiles').select('id').limit(1)
  res.status(200).json({ status: 'alive' })
}
```

### Opção B — cron-job.org (gratuito, sem código)
1. Criar conta em cron-job.org
2. Adicionar job: GET `seuapp.vercel.app/api/keep-alive`
3. Frequência: a cada 5 dias
4. Pronto — nunca pausa

---

## ORDEM DE IMPLEMENTAÇÃO

### Fase 1 — Base (entrega o login funcionando)
- [ ] Setup do projeto React (Vite + React)
- [ ] Configurar Supabase: criar projeto, tabelas e RLS
- [ ] Instalar `@supabase/supabase-js`
- [ ] Tela de login com Supabase Auth
- [ ] Proteção de rotas (redirect se não logado)
- [ ] Deploy no Vercel + variáveis de ambiente
- [ ] Testar PWA no iPad (instalar na tela de início)

### Fase 2 — Planner + Roadmap
- [ ] Tela de importação de `.roadmap.json`
- [ ] Salvar roadmap no Supabase
- [ ] Renderizar fases, semanas e recursos do JSON
- [ ] Status por recurso (tap para alternar ⬜→🟡→✅)
- [ ] Salvar progresso no Supabase
- [ ] Missão da semana com checkbox
- [ ] Barra de progresso por fase

### Fase 3 — Rotina diária + Streak
- [ ] Tela de rotina com blocos e cronômetro
- [ ] Salvar sessão de estudo ao encerrar
- [ ] Lógica de streak (verificar ao abrir o app)
- [ ] Dashboard com resumo do dia

### Fase 4 — Progresso + Polish
- [ ] Tela de progresso com métricas
- [ ] Heatmap de dias estudados
- [ ] Modo Hardcore toggle
- [ ] Configurações completas
- [ ] Keep-alive cron job (anti-pause Supabase)
- [ ] Modo offline com Service Worker
- [ ] Ícones e manifest.json corretos para iOS

---

## VARIÁVEIS DE AMBIENTE (.env)

```
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

No Vercel: adicionar as mesmas variáveis em
Settings → Environment Variables

---

## DEPENDÊNCIAS DO PROJETO

```json
{
  "dependencies": {
    "react": "^18",
    "react-dom": "^18",
    "react-router-dom": "^6",
    "@supabase/supabase-js": "^2",
    "date-fns": "^3"
  },
  "devDependencies": {
    "vite": "^5",
    "vite-plugin-pwa": "^0.19",
    "@vitejs/plugin-react": "^4"
  }
}
```

---

## RESUMO FINAL

```
Custo total: R$ 0/mês
Banco de dados: Supabase Free (PostgreSQL)
Hospedagem: Vercel Hobby (gratuito pessoal)
Login: Supabase Auth (email + senha)
iPad: PWA instalado via Safari
PC: Electron .exe (existente)
Sincronização: via Supabase em tempo real
Anti-pause: cron job a cada 5 dias
```
