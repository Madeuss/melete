# Entrevistador de IA — spec do MVP

Nov 22, 2026 · @Mateus

Melete é um app open source que simula entrevistas de emprego em inglês por voz e devolve feedback estruturado. Cada usuário usa a própria key de qualquer API compatível com OpenAI, e o MVP roda inteiro no navegador, sem backend.

**Para o assistente de código:** o que está descrito aqui vale como decisão. O que está em "Em aberto" ainda não foi decidido: pergunte antes de assumir.

## Escopo do MVP

O MVP faz uma entrevista completa por voz (ou texto), com perguntas tiradas do banco de histórias do usuário, e entrega um relatório com nota e feedback por resposta. Tudo roda no navegador, com a key do próprio usuário.

**Entra no MVP**

- Configuração de provedor com presets, campo de key e botão "testar conexão".
- Banco de histórias (CRUD, tags, importar e exportar JSON).
- Configuração da entrevista: tipo (comportamental, técnica, mista), cargo, senioridade, descrição da vaga opcional, número de perguntas, follow-ups ligados ou não.
- Sala de entrevista: pergunta falada (TTS), resposta por voz (STT) ou digitada, transcrição editável antes de enviar.
- Follow-up opcional (no máximo 1 por pergunta).
- Avaliação estruturada por resposta e resumo da sessão.
- Métricas calculadas no código: palavras de preenchimento e palavras por minuto.
- Histórico de sessões salvo no navegador.

**Fica de fora do MVP**

- Backend, login e versão hospedada.
- Self-host com Docker (fase 2).
- API de voz em tempo real (speech-to-speech).
- Guardar o áudio das respostas: só a transcrição é salva.
- Interface de testes comparando provedores (fase 3; no MVP só a pasta `evals/` com script).

## Fluxo de uma entrevista

O motor (`src/interview/engine.ts`) é uma máquina de estados: cada pergunta passa por pergunta falada, resposta, revisão, um follow-up opcional e avaliação, até o relatório final.

```text
planning → asking → listening → reviewing ─┬─> decidingFollowUp ─(precisa)─> asking (follow-up)
                                           │          └─(não precisa)─┐
                                           └──────────────────────────┴─> evaluating → próxima pergunta (asking)
                                                                                     └─ última → summarizing → finished
```

Estados do motor: `planning → asking → listening → reviewing → decidingFollowUp → evaluating → summarizing → finished`, mais `abandoned`.

- Follow-up só acontece com a opção ligada e nunca depois de outro follow-up.
- Com feedback só no fim (`feedbackTiming: 'end'`), o passo de avaliação sai do loop e todas as respostas são avaliadas antes do resumo.
- Sair da sala cancela a chamada em andamento e marca a sessão como `abandoned`. Cada resposta é salva assim que é enviada, então nada se perde.

## Telas

São seis telas. Sem provedor configurado, o app abre direto em Configurações.

| Tela | O que faz |
| --- | --- |
| Configurações | Escolhe o preset do LLM, cola a key, testa a conexão com uma chamada mínima. Escolhe STT, TTS, a voz e o idioma da interface. Avisa que a key fica só neste navegador. |
| Banco de histórias | Lista, cria, edita e apaga histórias (título, situação, tarefa, ação, resultado, tags). Importa e exporta JSON. |
| Nova entrevista | Tipo, cargo, senioridade, descrição da vaga (opcional), número de perguntas, follow-ups, feedback imediato ou só no fim. |
| Sala de entrevista | Mostra e fala a pergunta atual. Botão gravar/parar, transcrição ao vivo, edição da transcrição antes de enviar, opção de responder digitando, progresso (pergunta 3 de 6). |
| Relatório da sessão | Por pergunta: notas STAR e clareza, se respondeu o que foi perguntado, pontos fortes, o que melhorar, resposta melhorada, preenchimento e palavras por minuto. No topo, o resumo da sessão. |
| Histórico | Lista de sessões com data, tipo e nota média. Abre o relatório de cada uma. |

## Arquitetura e provedores

O app fala com três portas plugáveis (STT, LLM, TTS), cada uma atrás de uma interface. O motor da entrevista só conhece as interfaces, nunca um provedor concreto.

**Regras**

- **LLM:** API compatível com OpenAI (`POST {baseUrl}/chat/completions`), configurada por `baseUrl`, `apiKey` e `model`.
- **Key:** fica só no navegador (IndexedDB) e nunca passa por servidor do projeto. Nunca aparece em log, erro ou export.
- **Chamadas:** saem direto do navegador pro provedor.
- **Voz:** pipeline fala → texto → LLM → fala. Sem API de voz em tempo real.

**Portas**

| Porta | Implementações do MVP | Depois |
| --- | --- | --- |
| STT | Web Speech API do navegador; resposta digitada como fallback | Whisper API; Whisper local no navegador via Transformers.js |
| LLM | Cliente único compatível com OpenAI + presets | — |
| TTS | `speechSynthesis` do navegador | TTS da OpenAI; Piper local |

```ts
interface LlmConfig { baseUrl: string; apiKey: string; model: string }

interface LlmProvider {
  chat(messages: ChatMessage[], opts?: { jsonSchema?: object; signal?: AbortSignal }): Promise<string>
}

interface SpeechToText {
  start(onPartial?: (text: string) => void): void
  stop(): Promise<string> // transcrição final
}

interface TextToSpeech {
  speak(text: string): Promise<void>
  cancel(): void
}
```

**Presets do LLM** (conferir URLs e CORS na doc de cada provedor antes de fixar):

| Preset | baseUrl | Observação |
| --- | --- | --- |
| OpenAI | `https://api.openai.com/v1` | Aceita chamada direta do navegador |
| OpenRouter | `https://openrouter.ai/api/v1` | Um key pra vários modelos |
| Groq | `https://api.groq.com/openai/v1` | Rápido, bom pra follow-up |
| Gemini | `https://generativelanguage.googleapis.com/v1beta/openai/` | Endpoint compatível com OpenAI |
| Anthropic | `https://api.anthropic.com/v1/` | Endpoint compatível; chamada direta do navegador exige o header `anthropic-dangerous-direct-browser-access: true` |
| Ollama | `http://localhost:11434/v1` | Grátis e local; precisa de `OLLAMA_ORIGINS` liberando a origem do app |
| LM Studio | `http://localhost:1234/v1` | Grátis e local |
| Personalizado | qualquer | O usuário preenche os três campos |

Cada preset guarda as capacidades do provedor (`supportsJsonSchema`, `supportsJsonObject`, `extraHeaders`), usadas pela saída estruturada.

**Saída estruturada** (avaliação, perguntas, follow-up):

1. Se o preset suporta, manda `response_format` com `json_schema`.
2. Senão, `response_format: { type: "json_object" }`.
3. Senão, só instrução no prompt e extração do primeiro objeto JSON da resposta.
4. Valida com Zod. Se falhar, tenta de novo até 2 vezes, mandando o erro de validação de volta pro modelo.

**Riscos conhecidos de voz**

- A Web Speech API do Chrome manda o áudio pros servidores do Google. Avisar isso na tela de configuração.
- O reconhecimento de voz pode não funcionar em Chromium e Firefox, e as vozes do `speechSynthesis` no Linux costumam ser ruins. Testar cedo no Linux; por isso a resposta digitada é obrigatória desde o início.

## Modelo de dados

Quatro tabelas no IndexedDB, acessadas por repositórios (nada de acesso direto ao banco nos componentes). Os schemas Zod são a fonte da verdade e os tipos saem deles com `z.infer`.

| Tabela | Chave | Índices | Guarda |
| --- | --- | --- | --- |
| `settings` | `id` (sempre `'default'`) | — | Provedores, voz, idiomas |
| `stories` | `id` | `tags`, `updatedAt` | Banco de histórias |
| `sessions` | `id` | `createdAt`, `status` | Uma entrevista e seu resumo |
| `turns` | `id` | `sessionId`, `[sessionId+index]` | Cada pergunta, resposta e feedback |

```ts
const Settings = z.object({
  id: z.literal('default'),
  llm: z.object({ preset: z.string(), baseUrl: z.string().url(), apiKey: z.string(), model: z.string() }),
  stt: z.object({ kind: z.enum(['web-speech', 'typed-only']) }),
  tts: z.object({ kind: z.enum(['browser', 'off']), voice: z.string().optional(), rate: z.number().default(1) }),
  uiLanguage: z.enum(['pt-BR', 'en', 'es']),
  interviewLanguage: z.enum(['en', 'pt']).default('en'),
})

const Story = z.object({
  id: z.string(),
  title: z.string(),
  situation: z.string(),
  task: z.string(),
  action: z.string(),
  result: z.string(),
  tags: z.array(z.string()), // ex.: conflict, leadership, failure, ownership
  createdAt: z.string(),
  updatedAt: z.string(),
})

const SessionConfig = z.object({
  type: z.enum(['behavioral', 'technical', 'mixed']),
  role: z.string(),
  seniority: z.enum(['junior', 'mid', 'senior', 'staff']),
  jobDescription: z.string().optional(),
  questionCount: z.number().int().min(1).max(15),
  followUps: z.boolean(),
  feedbackTiming: z.enum(['per-answer', 'end']),
})

const Session = z.object({
  id: z.string(),
  createdAt: z.string(),
  config: SessionConfig,
  model: z.string(), // modelo usado, pra comparar depois
  status: z.enum(['in-progress', 'finished', 'abandoned']),
  plannedQuestions: z.array(PlannedQuestion),
  summary: SessionSummary.optional(),
})

const Turn = z.object({
  id: z.string(),
  sessionId: z.string(),
  index: z.number().int(),
  kind: z.enum(['main', 'follow-up']),
  parentTurnId: z.string().optional(),
  question: z.string(),
  storyId: z.string().optional(),
  transcript: z.string(),
  answerDurationMs: z.number().optional(), // ausente quando digitada
  metrics: z.object({ fillerWords: z.record(z.number()), wordsPerMinute: z.number().optional(), wordCount: z.number() }),
  feedback: Feedback.optional(),
  createdAt: z.string(),
})
```

O áudio não é salvo. O export do usuário (JSON) inclui histórias e sessões, nunca `settings.llm.apiKey`.

## Prompts e avaliação

Uma sessão faz quatro tipos de chamada ao LLM, todas com saída estruturada. O que dá pra calcular no código não vai pro LLM.

| Chamada | Quando | Entrada | Saída (schema) |
| --- | --- | --- | --- |
| `planQuestions` | Início da sessão | `SessionConfig`, resumo das histórias (título + tags), descrição da vaga | `{ questions: PlannedQuestion[] }` |
| `decideFollowUp` | Depois de cada resposta principal, se follow-ups ligados | Pergunta, transcrição | `{ needsFollowUp: boolean, followUp?: string }` |
| `evaluateAnswer` | Depois de cada resposta (ou todas no fim, conforme `feedbackTiming`) | Pergunta, transcrição, história ligada (se houver), rubrica, métricas | `Feedback` |
| `summarizeSession` | Fim da sessão | Todos os `Feedback` da sessão | `SessionSummary` |

```ts
const PlannedQuestion = z.object({
  text: z.string(),
  competency: z.string(), // ex.: ownership, conflict, system design
  storyId: z.string().optional(), // história que a pergunta tenta puxar
})

const Score = z.number().int().min(0).max(5)

const Feedback = z.object({
  star: z.object({ situation: Score, task: Score, action: Score, result: Score }),
  clarity: Score,
  answeredTheQuestion: z.boolean(),
  strengths: z.array(z.string()).max(3),
  improvements: z.array(z.string()).max(3),
  improvedAnswer: z.string(), // a mesma história, mais bem contada, no idioma da entrevista
})

const SessionSummary = z.object({
  overall: Score,
  topStrengths: z.array(z.string()).max(3),
  focusNext: z.array(z.string()).max(3),
})
```

**Regras dos prompts**

- O entrevistador faz uma pergunta por vez, no idioma da entrevista, e não dá feedback durante a entrevista.
- Follow-up só quando falta uma parte do STAR ou o resultado não tem impacto concreto. No máximo 1 por pergunta principal.
- O avaliador só usa o que está na transcrição e na história. Não inventa números nem fatos na `improvedAnswer`.
- Para perguntas técnicas, o STAR vale como estrutura (contexto, problema, solução, resultado).
- Prompts ficam em arquivos próprios em `src/interview/prompts/`, versionados (`v1`), pra que os testes comparem versões.

**Rubrica (0 a 5)**

| Nota | Significado |
| --- | --- |
| 0 | Ausente |
| 1 | Mencionado de passagem, sem conteúdo |
| 2 | Presente, mas vago ou genérico |
| 3 | Claro, com algum detalhe concreto |
| 4 | Claro, específico e bem conectado ao resto |
| 5 | Exemplar: específico, mensurável quando cabe, e enxuto |

**Métricas calculadas no código** (`src/interview/metrics.ts`, funções puras com teste):

- `fillerWords`: contagem por palavra, comparando a transcrição com uma lista por idioma. Inglês: um, uh, like, you know, basically, actually, kind of, sort of, I mean. Português: tipo, né, então, aí, éé, basicamente.
- `wordsPerMinute`: `wordCount / (answerDurationMs / 60000)`. Só quando a resposta foi falada.
- `wordCount`: palavras da transcrição final.

## Stack, repositório e convenções

O app é uma SPA estática, sem servidor: Vite + React + TypeScript. Next.js fica pra uma eventual versão hospedada.

**Stack**

| Parte | Escolha |
| --- | --- |
| Build e app | Vite + React + TypeScript (`strict`) |
| Schemas e validação | Zod |
| IndexedDB | Dexie |
| i18n | react-i18next (pt-BR, en, es) |
| Testes | Vitest + Testing Library |
| Estilo | Tailwind |
| Deploy | Estático (GitHub Pages ou Vercel) |
| Licença | AGPL-3.0 |

**Estrutura do repositório**

```text
src/
  providers/
    llm/          openaiCompatible.ts, presets.ts, structuredOutput.ts
    stt/          webSpeech.ts, typed.ts
    tts/          browserTts.ts
    fakes/        FakeLlm.ts, FakeStt.ts, FakeTts.ts (só pra testes)
  interview/
    engine.ts     máquina de estados da sessão
    prompts/      planQuestions.v1.ts, decideFollowUp.v1.ts, evaluateAnswer.v1.ts, summarizeSession.v1.ts
    metrics.ts    preenchimento, palavras por minuto, contagem
  i18n/           pt-BR.json, en.json, es.json
  schemas/        Zod: settings, story, session, turn, feedback
  storage/        db.ts (Dexie) + repositórios
  styles/         tokens.css (claro e escuro)
  ui/             componentes base (Button, Input, RecordButton...)
  features/
    settings/  stories/  new-interview/  interview-room/  report/  history/
evals/
  fixtures/       respostas de exemplo com nota esperada
  run.ts          roda evaluateAnswer em vários provedores e compara
docs/
  SPEC.md         este documento
```

**Convenções pro assistente de código**

- Componentes não chamam provedor nem banco direto: passam pelo motor e pelos repositórios.
- Todo dado que vem do LLM ou do IndexedDB passa por `schema.parse` antes de ser usado.
- O motor é testado com `FakeLlm` (respostas fixas), sem rede. `metrics.ts` e `structuredOutput.ts` têm testes unitários.
- A key nunca vai pra log, mensagem de erro, export ou URL.
- Chamadas ao LLM aceitam `AbortSignal`; sair da sala de entrevista cancela o que estiver em andamento.
- Erros de provedor (401, 429, CORS, rede) viram mensagens claras pro usuário, com a ação sugerida ("confira a key", "libere `OLLAMA_ORIGINS`").
- Interface em pt-BR, en e es desde o MVP, com um arquivo de mensagens por idioma. Nenhum texto fixo nos componentes.

## Direção visual

A interface é clara e limpa, com fundo branco, o rosa do Melete (`#FE3E6D`) como única cor de destaque, cantos bem arredondados e a fonte Figtree. Tem modo escuro desde o início. Esta seção é o ponto de partida: os ajustes do Mat, no fim dela, têm prioridade sobre o resto.

### Referências

- **Estilo:** dashboards clean de agentes de IA que o Mat mandou. Muito espaço em branco, painéis claros separados por tom de fundo (não por sombra), hierarquia por tamanho e peso da fonte, botões e inputs em pílula, uma ação forte por tela.
- **Cor:** o rosa do banco Cora.
- As referências valem só pelo estilo. Não copiar layout, mascote, ilustração nem conteúdo delas.

### Cores

Todos os contrastes abaixo foram medidos. Qualquer texto precisa passar de 4,5:1 (WCAG AA).

| Token | Claro | Escuro | Uso |
| --- | --- | --- | --- |
| `bg` | `#FFFFFF` | `#110F0F` | Fundo da página |
| `surface-subtle` | `#F9F8F8` | `#191617` | Painéis laterais, áreas secundárias |
| `surface-sunken` | `#F3F1F1` | `#242121` | Inputs, chips, áreas recuadas |
| `border` | `#E5E2E2` | `#302D2D` | Bordas de 1px |
| `border-strong` | `#D0CDCD` | `#454141` | Borda de input em hover |
| `text` | `#191515` | `#F5F3F3` | Texto principal |
| `text-muted` | `#5B5757` | `#AEA9AA` | Texto secundário |
| `text-subtle` | `#706C6C` | `#959191` | Legendas, horários |
| `brand` | `#FE3E6D` | `#FE3E6D` | Botão de gravar, ícone ativo, anel de foco, gráficos. Nunca com texto pequeno em cima |
| `brand-strong` | `#D62D59` | `#D62D59` | Fundo do botão primário, com texto branco (4,8:1) |
| `brand-hover` | `#B21E46` | `#B21E46` | Hover e pressionado do botão primário |
| `brand-text` | `#D62D59` | `#FF6C87` | Links e texto rosa |
| `brand-soft` | `#FFE9ED` | `#3C161C` | Fundo de item ativo e destaque leve. Texto rosa em cima usa `#B21E46` no claro e `#FF6C87` no escuro |
| `success` | `#187C49` | `#62C689` | Sucesso |
| `warning` | `#9A6500` | `#EEB154` | Atenção |
| `danger` | `#BF4306` | `#F67D51` | Erro |

- O rosa puro (`#FE3E6D`) com texto branco dá só 3,4:1, por isso o botão primário usa `brand-strong`.
- Os neutros têm um toque quase imperceptível do tom do rosa. Não trocar por slate, zinc ou gray do Tailwind.
- Como a marca é rosa, o erro usa um vermelho-alaranjado (`danger`) e sempre vem com ícone e texto, nunca só cor. Botão destrutivo é contornado, não preenchido.

### Tipografia

- **Fonte:** Figtree, versão variável, via pacote `@fontsource-variable/figtree`. Ela é servida pelo próprio app, sem chamar o Google Fonts, o que combina com a promessa de privacidade.
- **Por que não Inter:** a Inter é a fonte padrão de quase toda interface gerada por IA. A Figtree é tão limpa quanto, mais redonda, e fica mais perto do estilo do Cora.
- **Tamanhos:** 13 (legenda), 14 (secundário), 16 (base), 20, 24 e 32 (títulos).
- **Pesos:** 400 no texto, 500 em rótulos e botões, 600 em títulos.
- **Espaçamento:** altura de linha 1,5 no texto e 1,2 nos títulos. Títulos de 24px pra cima com letter-spacing entre -0,01em e -0,02em.
- **Números:** sempre `font-variant-numeric: tabular-nums`. A Figtree tem esse recurso (verificado no arquivo da fonte).
- **Transcrição da resposta:** é o conteúdo principal de leitura. Usar 18px com altura de linha 1,6.

### Forma

- **Raio:** botões, inputs de uma linha, chips e toggles são pílula (`9999px`). Textarea: 20px. Cards: 20px. Painéis grandes e modais: 28px. Nenhum canto quadrado.
- **Altura:** botões e inputs têm 44px (tamanho padrão) ou 36px (pequeno). Padding horizontal do botão: 20px.
- **Bordas e sombras:** borda de 1px com `border`. Sombra só em elemento flutuante (menu, modal, toast), uma sombra suave e difusa. Card comum não tem sombra.
- **Espaçamento:** múltiplos de 4, com respiro generoso (32 a 48px entre seções).
- **Ícones:** um único conjunto (Lucide), traço 1,5, tamanho 18 a 20px, cor `text-muted`. Rosa só no ícone ativo.

### Assinatura do Melete

- **Botão de gravar:** é o elemento principal da sala de entrevista. Grande, circular, em `brand`, com um anel que acompanha o volume do microfone de forma suave. É o único elemento rosa grande na tela.
- **Transcrição:** aparece como texto de leitura, não como balões de chat.
- **Logo:** por enquanto só o nome "melete" em minúsculas, Figtree 600. Nada de ícone genérico de IA.

### Proibido (cara de IA genérica)

- Gradientes roxo, azul ou rosa, texto com gradiente, fundos com manchas ou brilho.
- Glassmorphism e blur decorativo.
- Ícone de brilho (sparkles) pra indicar IA, robôs, cérebros, mascotes 3D.
- Emojis na interface.
- Paleta padrão do Tailwind ou o visual padrão do shadcn sem ajuste.
- Hero centralizado com título gigante e três cards de feature iguais.
- Texto genérico de marketing ("Unlock your potential", "Supercharge", "AI-powered"). A copy é direta e específica.
- Sombra, borda e ring no mesmo elemento. Sombra em todo card.
- Badges decorativos ("New", "Beta", "Pro") sem função.
- Números ou estatísticas inventados. Estado vazio diz o que fazer em seguida.
- Animações chamativas (bounce, shimmer em tudo).

### Obrigatório

- Rosa com parcimônia: ação principal, estado ativo, gravação e foco. Se tudo é rosa, nada se destaca.
- Uma ação primária por tela.
- Hierarquia por tamanho, peso e espaço antes de cor.
- Modo escuro feito só com tokens: nenhuma cor fixa em componente. Segue o sistema por padrão, com opção nas configurações.
- Foco sempre visível: anel de 2px em `brand`, afastado 2px do elemento.
- Movimento de 150 a 200ms, ease-out, só em mudança de estado. Respeitar `prefers-reduced-motion`.

### Como implementar

- Tokens como CSS variables em `src/styles/tokens.css` (`:root` e `[data-theme='dark']`), ligados ao `@theme` do Tailwind. Componente nunca usa hex direto nem classe de cor padrão do Tailwind.
- Componentes base próprios em `src/ui/`: Button, Input, Textarea, Card, Chip, Toggle, RecordButton.
- Página `/styleguide`, só em desenvolvimento, mostrando cores, tipografia, componentes e o botão de gravar nos dois temas. É onde o Mat revisa o visual.

### Ajustes de design

As revisões do Mat depois do MVP entram aqui, com data e o que mudar. Quando um ajuste contradiz algo acima, o ajuste vale, e a regra antiga deve ser atualizada junto. Ainda sem ajustes.

## Tarefas do MVP

Na ordem em que fazem sentido. Cada uma termina com teste ou com a tela funcionando.

- [x] Criar o projeto (Vite, React, TS strict, Zod, Dexie, Vitest, Tailwind, react-i18next) com o LICENSE AGPL-3.0 e o `CLAUDE.md` apontando pra `docs/SPEC.md`.
- [x] Tokens de cor e tipografia (claro e escuro), componentes base de `src/ui/` e a página `/styleguide`, seguindo a Direção visual. Parar aqui pro Mat revisar antes das telas.
- [x] Schemas Zod de `schemas/` e o banco Dexie com os repositórios.
- [x] Cliente LLM compatível com OpenAI, presets e "testar conexão".
- [x] `structuredOutput.ts`: os três modos de JSON, validação e até 2 novas tentativas, com testes.
- [ ] Verificar CORS de cada preset de verdade no navegador e registrar no preset. *(Preflight real feito e registrado em 22/11; falta uma chamada com key de verdade em cada provedor e testar Ollama/LM Studio.)*
- [x] Tela de Configurações.
- [x] Banco de histórias: CRUD, tags, importar e exportar JSON.
- [x] `metrics.ts` com testes.
- [x] Prompts `v1` das quatro chamadas.
- [x] `engine.ts` (máquina de estados) testado com `FakeLlm`.
- [ ] STT Web Speech + resposta digitada; TTS do navegador. Testar no Linux. *(Implementado e testado com mocks; falta testar voz de verdade, inclusive no Linux. Depois do MVP entrou o Kokoro como opção de voz que roda no navegador: ver DECISOES 37–40.)*
- [x] Telas Nova entrevista e Sala de entrevista.
- [x] Relatório da sessão e Histórico.
- [x] `evals/`: 5 a 10 respostas de exemplo e o script comparando provedores.
- [x] README: o que é, BYOK, privacidade (onde ficam key e dados, aviso da Web Speech), como rodar com Ollama de graça.
- [ ] Deploy estático. *(Workflow pronto em `.github/workflows/ci.yml`; falta ligar o GitHub Pages, ver docs/DECISOES.md.)*

## Depois do MVP

Features que saíram do `docs/BACKLOG.md` a pedido do Mat. Cada uma vale como decisão, como o resto da spec.

### Custo por sessão (pedido em 22/11/2026)

Pra precificar o SaaS, cada sessão guarda quantos tokens gastou.

- Cada requisição ao LLM durante a sessão vira um registro (`LlmCall`) com a sessão, o tipo de chamada (`planQuestions`, `classifyReply`, `decideFollowUp`, `evaluateAnswer`, `summarizeSession`), o modelo e o `usage` (`prompt_tokens` e `completion_tokens`). Cada nova tentativa da saída estruturada conta como uma chamada.
- `usage` é opcional: alguns provedores não devolvem, e a falta dele não quebra nada. O relatório mostra "não informado pelo provedor".
- As chamadas não usam streaming, então o `usage` vem no corpo da resposta e não precisa de `stream_options`. Se um dia usarem, mandar `stream_options: { include_usage: true }`.
- Banco: tabela `llmCalls` (`id, sessionId`) na versão 2 do Dexie. A migração só adiciona a tabela; sessões antigas ficam sem chamadas e o relatório diz que são de antes da contagem.
- Relatório: total de tokens de entrada e saída, número de chamadas e o detalhamento por etapa.
- Export e import incluem as chamadas (arquivos antigos, sem elas, continuam importando); apagar a sessão apaga as chamadas.

- [x] Feito em 22/11/2026, com testes da agregação, do gravador de chamadas, da migração e do motor.

### Mapa de cobertura (pedido em 22/11/2026)

Mostra quais competências ainda não têm história, pra saber o que preparar em seguida.

- Aba "Cobertura" na tela de Histórias (`/stories?view=coverage`), ao lado da lista.
- Matriz histórias × competências. As competências são as tags sugeridas do editor (conflito, liderança, fracasso, ownership, trabalho em equipe, impacto, ambiguidade, prazo apertado, mentoria, técnica), com nome traduzido. Tags criadas pelo usuário não entram.
- Acima da matriz, as competências sem nenhuma história, cada uma com um atalho que abre o editor com a tag já marcada (`/stories/new?tag=…`).
- A linha de total destaca as competências com zero histórias.

- [x] Feito em 22/11/2026.

### Refazer a pergunta (pedido em 22/11/2026)

Responder de novo uma pergunta e ver o antes e depois lado a lado: é o ciclo de prática.

- No relatório de uma sessão terminada (ou abandonada), cada pergunta principal tem "Responder de novo".
- Isso cria uma sessão nova (`retryOf: { sessionId, turnId }`) com só aquela pergunta, a mesma configuração da original (tipo, cargo, senioridade, dificuldade), sem follow-up e com feedback logo depois de responder. A tentativa não gera resumo da sessão.
- O relatório da tentativa mostra "Antes e depois": notas de cada parte do STAR, clareza e média, palavras, palavras por minuto e palavras de preenchimento, com a mudança de cada uma (seta na direção da mudança, cor pela melhora), e as duas respostas lado a lado. Dá pra tentar mais uma vez dali.
- No relatório original, cada pergunta lista as tentativas feitas, com a média de antes e de depois.
- No histórico, a tentativa aparece como "Pergunta refeita".

- [x] Feito em 22/11/2026.

### Assistente de história (pedido em 22/11/2026)

Transforma um relato solto em STAR e pergunta o que falta.

- No editor de histórias, um painel "Organizar com ajuda" (fechado por padrão): o usuário conta a história do jeito que vier, em qualquer idioma.
- Prompt novo `structureStory` (v1): devolve título, situação, tarefa, ação, resultado, até 3 tags da lista sugerida e até 3 perguntas sobre o que falta (papel exato, ações concretas, resultado com número), no idioma da interface. Usa só fatos do relato e das respostas: nunca inventa números, nomes ou resultados. Os campos saem no idioma em que a história foi contada.
- O resultado preenche o formulário pra revisão: as partes que vieram vazias mantêm o que já estava escrito, o título só é preenchido se ainda não houver, e as tags somam às existentes. Nada é salvo sem o usuário salvar.
- O usuário responde as perguntas ali mesmo e completa; as respostas de todas as rodadas vão juntas na próxima chamada.

- [x] Feito em 22/11/2026.

### Treino do "Tell me about yourself" (pedido em 22/11/2026)

Um modo só pro pitch de abertura, com cronômetro, versões salvas e comparação.

- Tela nova "Apresentação" (`/pitch`) no menu. Funciona sem provedor (só salva); com provedor, avalia.
- Prática: cargo opcional (lembrado; o padrão é o cargo da última entrevista), gravar por voz com cronômetro e uma barra até 2 minutos com a faixa-alvo de 60 a 90 s marcada, ou digitar. Depois de gravar, a transcrição pode ser corrigida antes de avaliar. Versões digitadas ganham um tempo estimado a 140 palavras por minuto.
- Prompt novo `evaluatePitch` (v1): notas 0–5 de estrutura (presente → passado → futuro), ligação com a vaga, fatos concretos, duração e clareza; até 3 pontos fortes e 3 melhorias no idioma da interface; e uma versão mais enxuta no idioma da entrevista, só com fatos da transcrição (marcadores como [metric] no que faltar).
- Cada versão é salva (tabela `pitches`, versão 3 do Dexie) antes da avaliação, então uma falha do provedor não perde a versão. Export, import e "apagar todos os dados" incluem as versões.
- Versões: lista da mais nova pra mais antiga, com duração, cargo e média; abrir mostra a avaliação; apagar pede confirmação; marcar duas mostra a comparação (notas, duração, palavras por minuto e palavras de preenchimento, com a mudança de cada uma, e os dois textos lado a lado).

- [x] Feito em 22/11/2026.

### Etapas do processo (pedido em 22/11/2026)

Simulação por etapa real, cada uma com o tom e o tipo de pergunta próprios.

- Na Nova entrevista, "Etapa do processo" (opcional): Qualquer (como antes), Recrutador, Gestor, Técnica, Valores e cultura, Final. Cada uma tem uma linha explicando o foco. A escolha fica salva com o resto da configuração.
- Escolher uma etapa sugere o tipo de entrevista mais comum pra ela (Técnica → técnica, Final → mista, as outras → comportamental); o usuário pode trocar.
- `SessionConfig.stage` (opcional; sessões antigas ficam sem etapa).
- Prompt `planQuestions` v2 (o v1 continua no repositório): com etapa, descreve quem está entrevistando e o que aquela etapa procura, e pede o tom desse entrevistador. Também pede a `competency` da lista de competências das histórias quando alguma serve.
- O relatório mostra a etapa junto com o tipo, o cargo e a senioridade.

- [x] Feito em 22/11/2026.

## Decidido

| Tema | Decisão |
| --- | --- |
| Nome | **Melete**, a musa grega da prática (as outras duas musas originais são Mneme, a memória, e Aoide, a voz). Nome do pacote e do repositório: `melete` |
| Licença | AGPL-3.0 |
| Stack | Vite + React (sem Next.js) |
| Idioma da interface | i18n com pt-BR, en e es |
| Feedback | O usuário escolhe na configuração da entrevista: depois de cada resposta ou só no fim (`feedbackTiming`) |

## Em aberto

Decisões novas entram aqui, e o assistente de código deve perguntar antes de assumir qualquer uma delas.

- **Domínio:** getmelete.dev ou usemelete.app (os dois estavam livres em 22/11/2026). Só importa no deploy.
