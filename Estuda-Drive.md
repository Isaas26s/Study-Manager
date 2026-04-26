# 📚 BRIEFING — Study Manager (Cybersecurity Planner)

## 🎯 O que é esse projeto

Um aplicativo desktop `.exe` para Windows projetado para organizar, gerenciar e gamificar sua rotina de estudos em Cibersegurança. 

O app tem dois propósitos principais:
1. **Player de Cursos Locais**: Organizar e assistir videoaulas de cursos armazenados em pastas locais (sincronizadas via Google Drive para Desktop).
2. **Planner Gamificado**: Acompanhar um cronograma de estudos de Cybersecurity de 24 semanas com missões, sistema de progresso (streak) e "Modo Hardcore".

---

## 🛠️ Stack Tecnológica

- **Front-end**: React.js (Interface dinâmica e responsiva)
- **Back-end/Core**: Electron.js (Geração do `.exe` e acesso ao sistema de arquivos local)
- **Banco de Dados**: SQLite via `better-sqlite3` (Armazenamento local em `%APPDATA%/StudyManager/db.sqlite`)
- **Build & Packaging**: `electron-builder` para empacotar o instalador `.exe` (NSIS)
- **Player de Vídeo**: Tag `<video>` nativa do HTML5 para `.mp4/.webm`. (Para arquivos `.mkv`, avaliar `mpv.js` ou aviso de conversão).

---

## 🖥️ Estrutura de Telas

### 1. Home / Dashboard
- **Métricas Rápidas**: Streak atual 🔥, tempo total estudado, projetos concluídos.
- **Foco da Semana**: Destaque da semana atual no planner (ex: "Semana 3 — Controle de fluxo").
- **Missão Ativa**: Missão semanal em andamento com checkbox de conclusão.
- **Continue Assistindo**: Atalhos rápidos para as últimas aulas abertas.

### 2. Meus Cursos
- **Adicionar Curso**: Botão para selecionar pasta local do curso (file dialog).
- **Cards de Cursos**: Nome, % de progresso, thumbnail da pasta.
- **Visualização Expandida**: Lista de módulos (subpastas) e aulas (vídeos, PDFs, outros).
- **Status das Aulas**: Badges de ⬜ Não iniciado, 🟡 Em progresso, ✅ Concluído.

### 3. Player de Vídeo
- **Modo de Exibição**: Tela cheia ou split-screen (player + anotações).
- **Controles**: Play/pause, barra de progresso, volume, velocidade (0.5x a 2x), fullscreen.
- **Navegação Integrada**: Sidebar com a lista de aulas do módulo atual para navegação rápida.
- **Automações**:
  - Salva a posição exata ao pausar ou fechar o app.
  - Marca automaticamente como ✅ Concluído ao atingir 90% do vídeo.
- **Bloco de Notas**: Campo de texto para anotações rápidas por aula (salvo no SQLite).

### 4. Planner de Estudos (Cybersecurity 24 Semanas)
*Planner importado automaticamente (seed) na primeira execução.*

**Status das Tarefas:** ⬜ Não iniciado | 🟡 Em progresso | ✅ Concluído

<details open>
<summary><b>Ver Estrutura do Planner (Fases 1 a 6)</b></summary>

- **FASE 1 — Python + Lógica (Semanas 1–6)**
  - Semanas 1–2: Variáveis, tipos, operadores | Prática: calculadora, par/ímpar, média
  - Semanas 3–4: If/else, loops for/while | Prática: login simples, menu interativo, contador
  - Semanas 5–6: Funções, organização | PROJETO OBRIGATÓRIO: Jogo da velha

- **FASE 2 — Redes + Linux (Semanas 7–10)**
  - Semanas 7–8: IP, DNS, HTTP/HTTPS | Prática: ping, nslookup
  - Semanas 9–10: Comandos Linux, permissões, navegação | Prática: criar arquivos, automatizar tarefas

- **FASE 3 — Back-end + SQL (Semanas 11–14)**
  - Semanas 11–12: APIs, requisições, autenticação | PROJETO: sistema de login com validação
  - Semanas 13–14: SELECT, INSERT, UPDATE | Prática: banco simples, consultas básicas

- **FASE 4 — Cybersecurity (Semanas 15–18)**
  - Semanas 15–16: OWASP — SQL Injection, XSS, Broken Auth
  - Semanas 17–18: Nmap, Wireshark | Prática: scan de rede, análise de tráfego

- **FASE 5 — Infra + DevOps (Semanas 19–22)**
  - Semanas 19–20: Portas, serviços, redes avançadas
  - Semanas 21–22: Docker, servidores

- **FASE 6 — Especialização (Semanas 23–24)**
  - Escolha de caminho: 🔴 Red Team (exploração) ou 🔵 Blue Team (monitoramento/defesa)
</details>

### 5. Rotina Diária & Timer
- Quatro blocos de foco diários com cronômetro individual:
  1. **Conteúdo Principal (Python)** — 1h
  2. **Reforço (Lógica)** — 30min
  3. **Tópico Cyber (Cyber/Redes/Linux)** — 1h
  4. **Hands-on (Prática/Projeto)** — 30min
- Botões de Start/Pause.
- Ao concluir todos: celebração visual e incremento de streak.
- **Modo Hardcore**: Exige no mínimo 1h de estudo por dia; altera o tema/cor de destaque para vermelho.

### 6. Configurações
- Gerenciamento de pastas de cursos (adicionar/remover).
- Tema: Escuro (Padrão) / Claro.
- Notificações: Alerta às 21h caso nenhum estudo tenha sido registrado no dia.
- Exportação: Exportar dados de progresso como JSON.

---

## 🗄️ Esquema do Banco de Dados (SQLite)

```sql
-- Cursos e Aulas
CREATE TABLE courses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  folder_path TEXT NOT NULL,
  added_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE lessons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  course_id INTEGER,
  module_name TEXT,
  title TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT, -- 'video', 'pdf', 'other'
  sort_order INTEGER,
  FOREIGN KEY (course_id) REFERENCES courses(id)
);

CREATE TABLE progress (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lesson_id INTEGER UNIQUE,
  status TEXT DEFAULT 'not_started', -- 'not_started', 'in_progress', 'completed'
  position_sec INTEGER DEFAULT 0,
  completed_at DATETIME,
  notes TEXT,
  FOREIGN KEY (lesson_id) REFERENCES lessons(id)
);

-- Planner e Gamificação
CREATE TABLE planner_tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  phase INTEGER,
  week_start INTEGER,
  week_end INTEGER,
  task_order INTEGER, -- (Novo) Para manter a ordem das tarefas
  task_text TEXT,
  task_type TEXT, -- 'task', 'practice', 'project'
  status TEXT DEFAULT 'not_started'
);

CREATE TABLE missions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  week INTEGER,
  description TEXT,
  completed INTEGER DEFAULT 0
);

CREATE TABLE study_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT, -- 'YYYY-MM-DD'
  duration_min INTEGER,
  blocks_completed TEXT -- JSON array
);

CREATE TABLE streak (
  id INTEGER PRIMARY KEY DEFAULT 1,
  last_study_date TEXT,
  current_streak INTEGER DEFAULT 0,
  best_streak INTEGER DEFAULT 0
);

-- (Novo) Configurações Locais
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT
);
-- Ex: ('theme', 'dark'), ('hardcore_mode', 'false')
```

---

## 🎮 Lógica de Streak

1. **Abertura do App**: Verifica `last_study_date`.
2. **Se for hoje**: Mantém a streak atual.
3. **Se for ontem**: Mantém (usuário tem o dia de hoje para continuar).
4. **Se for antes de ontem**: Zera a streak (streak perdida).
5. **Ação de Estudo**: Ao completar um bloco de estudo do dia, atualiza `last_study_date` para hoje e incrementa `current_streak`.
6. **Modo Hardcore**: A streak só conta se a sessão diária for ≥ 60 minutos.

---

## 🎨 Design Visual & UI/UX

- **Tema Base**: Escuro (`#0d0d0d` ou `#111`), foco em conforto visual.
- **Tipografia**: 
  - `JetBrains Mono`: Para planner e elementos com visual hacker/terminal.
  - `Inter`: Para leitura geral.
- **Cores de Destaque**:
  - Padrão: Ciano (`#00e5ff`) ou Verde (`#39ff14`).
  - Modo Hardcore: Vermelho Alerta (`#ff3b3b`).
- **Componentes**:
  - Sidebar à esquerda.
  - Cards minimalistas (bordas sutis).
  - Animação suave ao concluir tarefa.
  - Barras de progresso por fase no planner.

---

## 🎯 Missões Semanais Pré-populadas

| Semana | Missão |
|--------|--------|
| 2 | Criar 3 scripts simples em Python |
| 4 | Fazer sistema de login funcional |
| 6 | Finalizar o Jogo da Velha |
| 8 | Usar ping e nslookup em 5 domínios |
| 10 | Usar Linux sem travar por 1h |
| 12 | Criar API de login com autenticação |
| 14 | Criar banco e fazer 5 consultas SQL |
| 16 | Identificar 3 vulnerabilidades OWASP |
| 18 | Fazer primeiro scan com Nmap |
| 22 | Subir um servidor com Docker |
| 24 | Completar 1 desafio Red Team ou Blue Team |

---

## 🚀 Ordem de Desenvolvimento (Fases de Build)

### Fase 1 — Fundação e Arquivos
- [ ] Setup Electron + React + SQLite.
- [ ] Leitura de pastas locais e scan de arquivos de vídeo.
- [ ] Tela "Meus Cursos" com lista de aulas.

### Fase 2 — O Player
- [ ] Player de vídeo embutido com controles.
- [ ] Salvar posição de reprodução e auto-concluir (90%).
- [ ] Notas por aula.

### Fase 3 — Planner e Dashboard
- [ ] Seed do banco com as fases e tarefas do planner.
- [ ] Tela de planner com status por tarefa.
- [ ] Missões semanais com check.
- [ ] Rotina diária com cronômetros.

### Fase 4 — Gamificação e Empacotamento
- [ ] Lógica de streak e "Modo Hardcore".
- [ ] Dashboard de métricas.
- [ ] Notificações nativas (`electron-notification`).
- [ ] Empacotar em instalador `.exe` com `electron-builder`.

---

## ⚠️ Observações Críticas e Regras
- **Offline First**: Sem dependência de APIs externas. Tudo roda localmente.
- **Caminhos Locais**: O Google Drive sincroniza a pasta no disco. O app apenas lê o caminho absoluto local (ex: `C:\User\GoogleDrive\Cursos`).
- **Entrega Contínua**: Começar sempre pelo que entrega valor imediato (leitura de pastas + player).
