# Melete — backlog pós-MVP e SaaS

Ideias para depois do MVP. **Para o assistente de código:** nada aqui deve ser implementado sem o Mat pedir. Quando ele pedir, a feature sai daqui e entra na spec.

## Ideias do Mat

### 2. Perguntas para fazer ao entrevistador

- **Onde:** tela própria e uma etapa final opcional na simulação. O entrevistador pergunta "Do you have any questions for us?", o usuário treina fazer as perguntas e a avaliação comenta se foram boas.
- **Base fixa curada** por categoria, cada pergunta com o motivo de ser bem vista. Exemplos:

| Categoria | Pergunta | Por que é bem vista |
| --- | --- | --- |
| Expectativas | What would success look like in the first 90 days? | Mostra foco em entregar resultado e revela a expectativa real do cargo |
| Desafios | What's the biggest challenge the team is facing right now? | Mostra interesse no problema, não só na vaga |
| Time | How is the team structured, and who would I work with most closely? | Mostra que você pensa em colaboração |
| Crescimento | What does growth look like for someone in this role? | Mostra ambição de longo prazo |
| Técnica | How does the team make technical decisions and handle tech debt? | Para entrevistador técnico; mostra maturidade de engenharia |
| Cultura | What do you enjoy most about working here? | Abre conversa pessoal e revela a cultura de verdade |
| Processo | What are the next steps in the process? | Prática, mostra organização |

- **Personalização:** o LLM escolhe e adapta 3 a 5 perguntas conforme vaga, senioridade e etapa (recrutador, gestor, técnico).
- **O que evitar:** perguntar de salário e benefícios na primeira conversa com o gestor, ou algo que está respondido no site da empresa. A tela mostra isso também.
- Base em en, pt e es.

### 3. Pesquisa da vaga e da empresa

- **Entrada:** na Nova entrevista, nome da empresa e link da vaga (opcional).
- **O que buscar:** relatos reais de perguntas para aquela empresa e aquele cargo (Glassdoor, Reddit, Blind, LeetCode Discuss, posts de candidatos), o formato do processo seletivo, os valores ou princípios da empresa (ex.: Leadership Principles da Amazon) e o texto da vaga, se houver link.
- **Resultado:** um "Briefing da empresa" com perguntas relatadas (com fonte e data), etapas do processo, valores da empresa ligados às histórias do usuário e links. Avisar que são relatos de candidatos e podem estar desatualizados.
- **Na entrevista:** `planQuestions` mistura perguntas relatadas com as geradas e marca a origem ("relatada por candidatos").
- **Como buscar sem backend (BYOK), a verificar:**
  - Modelos com busca na web pelo mesmo endpoint compatível com OpenAI: na OpenRouter, os modelos com busca (ex.: sufixo `:online`) ou os modelos Sonar da Perplexity.
  - Ou uma key de API de busca (Tavily, Brave Search, Exa), também do usuário, com o LLM resumindo os resultados. Checar o CORS de cada uma.
  - Na versão SaaS, a busca roda no backend.
- **Limites:** não fazer scraping de sites que proíbem (como o Glassdoor). Usar resultados de busca e páginas públicas, sempre com o link da fonte.
- **Cache:** guardar o briefing por empresa + cargo no IndexedDB, pra não pagar a busca de novo.

## Mais ideias

A prioridade é sugestão: o Mat decide a ordem. As de prioridade alta são baratas de fazer e mexem direto no ciclo de prática.

| Feature | O que faz | Prioridade sugerida |
| --- | --- | --- |
| Personas de entrevistador | Amigável, neutro ou cético (aperta nos detalhes, corta resposta longa) | Média |
| Evolução no tempo | Gráfico das notas por competência e das métricas ao longo das sessões | Média |
| Modo véspera | Uma página pra revisar na véspera: melhores histórias, briefing da empresa, perguntas pra fazer | Média |
| Plano até a entrevista | A partir da data da entrevista real, um plano diário de treino | Média |
| Negociação salarial | Simulação da conversa de pretensão e de proposta | Média, mais tarde |
| E-mail de agradecimento | Gera o follow-up pós-entrevista com base no que foi conversado | Baixa |
| Exportar relatório | PDF ou link pra mostrar a um mentor | Baixa |
| Entrevista técnica com código | Editor de código e system design | Talvez: escopo grande |

## SaaS: como cobrar

A recomendação é **créditos pré-pagos**, com uma entrevista grátis num modelo barato. Quem paga antes de gastar não consome seus tokens sem pagar.

**O padrão de uso decide o modelo.** Busca de emprego é sazonal: a pessoa treina muito por algumas semanas e depois some. Uma assinatura mensal tende a ser cancelada logo depois da contratação; créditos ou um passe de 30 dias combinam melhor com esse uso.

| Modelo | Risco de gastar sem receber | Observação |
| --- | --- | --- |
| Créditos pré-pagos | Nenhum: só gasta o que já pagou | Funciona bem com Pix. O preço de uma entrevista em créditos varia com o número de perguntas e o modelo |
| Passe por período (7 ou 30 dias) | Baixo, se tiver limite de uso | Bom pra quem tem entrevista marcada |
| Assinatura mensal | Baixo, mas precisa de limite mensal | Cancelamento alto num uso sazonal |
| Pagar pra ver o feedback | Baixo, se bem desenhado (abaixo) | Sem aviso prévio, pode parecer pegadinha |
| Grátis com limite | É custo de marketing | Precisa de proteção contra contas falsas |

**Sobre pagar pra ver o feedback:** é mais viável do que parece, por causa de duas decisões que o MVP já tomou.

- Fala → texto e texto → fala rodam no navegador, então não custam nada.
- As métricas (preenchimento, palavras por minuto) são calculadas no código, então também não custam nada.
- Antes do pagamento, só rodam `planQuestions` e `decideFollowUp`, que são chamadas pequenas. A parte mais cara, `evaluateAnswer` e `summarizeSession`, só roda depois do pagamento, a partir das transcrições já salvas.
- As métricas grátis servem de amostra do relatório.
- O preço tem que estar claro antes de começar a entrevista, não só no fim.

**Proteções obrigatórias, em qualquer modelo:**

- A key fica só no backend. O navegador chama o seu backend, com login.
- Limite de gasto por usuário e limite diário global, com corte automático se estourar.
- Teto de gasto configurado também na conta do provedor.
- Modelo barato no grátis, limite de tokens por resposta e de perguntas por sessão.
- Login com Google ou e-mail verificado, e limite de contas grátis por dispositivo.
- Preço dos créditos baseado no custo medido (ver "Custo por sessão" na spec, já implementado), com margem.

**Manter o BYOK:** quem trouxer a própria key continua usando de graça, como no open source. O pago é a conveniência de não precisar de key nem configurar nada.

## SaaS: o que muda na arquitetura

O SaaS precisa de um backend, que o MVP não tem. A versão open source com BYOK continua funcionando sem ele.

- **Backend:** proxy do LLM com autenticação, controle de créditos, limites de gasto, busca na web pro briefing da empresa e webhooks de pagamento. Pode ser um BFF em Python (FastAPI) ou funções serverless.
- **Login:** Supabase Auth, Clerk ou Auth.js.
- **Pagamento:** Stripe pra cartão internacional; Mercado Pago ou Asaas pra Pix e cartão no Brasil.
- **Provedor no código:** o cliente do LLM ganha um preset "Melete Cloud" que aponta pro seu backend. O resto do app não muda, porque já fala com uma interface.
- **LGPD:** CV e respostas de entrevista são dados pessoais. Guardar no servidor exige política de privacidade, exclusão de conta e dados, criptografia e prazo de retenção. Uma saída mais simples: manter o histórico no navegador mesmo no SaaS, e o servidor só processa a chamada sem guardar o conteúdo.
- **AGPL e contribuições:** como autor do código, o Mat pode rodar a versão hospedada. Mas o código que outras pessoas contribuírem chega em AGPL. Se um dia ele quiser recursos fechados no SaaS, precisa de um acordo de licença de contribuidor (CLA) desde o primeiro PR externo. Vale confirmar com alguém da área jurídica antes de abrir pra contribuições.

**Ordem sugerida:** medir o custo e as features de prática de prioridade alta (feitos em 22/11/2026, foram pra spec) → currículo → pesquisa da empresa → SaaS.
