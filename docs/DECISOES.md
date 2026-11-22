# Decisões tomadas na implementação

Decisões que o spec não cobria e que eu (assistente) tomei pra não travar. Cada uma tem o que foi feito
e o que mudar se você preferir outra coisa. Marque ✅ (mantém) ou escreva o ajuste.

| # | Tema | O que eu fiz | Alternativa |
| --- | --- | --- | --- |
| 1 | Repositório | Criado **privado** em github.com/Madeuss/melete. Tornar público é praticamente irreversível, então deixei pra você. | `gh repo edit Madeuss/melete --visibility public --accept-visibility-change-consequences` |
| 2 | Rotas | Roteamento por hash (`#/settings`, `#/styleguide`) com react-router. Funciona em qualquer host estático (GitHub Pages sem truque de 404). | BrowserRouter + rewrite no host (URLs sem `#`). |
| 3 | Styleguide | O texto da página `/styleguide` está fixo em inglês, fora dos arquivos de tradução: é ferramenta de revisão só em dev, não aparece no build. | Traduzir também. |
| 4 | Tema | Adicionei `theme: 'system' \| 'light' \| 'dark'` (padrão `system`) no schema de Settings, já que o spec pede a opção mas o schema não tinha o campo. Uma cópia fica no localStorage só pra primeira pintura já sair no tema certo. | — |
| 5 | Paleta do Tailwind | Zerei as cores, tamanhos de fonte, raios e sombras padrão do Tailwind no `@theme`: `bg-gray-100` nem existe. Só os tokens do spec. | — |
| 6 | Componentes extras | Além dos do spec, criei `Select`, `Field` (rótulo + dica + erro), `SegmentedControl`, `Notice`, `Progress`, `Dialog` e `Logo`, todos com os tokens. | — |
| 7 | Revisão do visual | O spec pede pra parar depois do styleguide pra você revisar. Como você pediu pra seguir sem parar, continuei; qualquer ajuste visual entra em "Ajustes de design" no SPEC e eu propago. | — |
| 8 | Settings sem provedor | `settings.llm` é opcional no schema: enquanto não existe, o app abre em Configurações (como o spec pede). | — |
| 9 | Idioma da sessão | Adicionei `language` em `Session` (idioma da entrevista na hora em que ela foi feita), porque o idioma pode mudar nas configurações depois e o relatório/evals precisam saber. | — |
| 10 | Export | Dois exports: o banco de histórias exporta só histórias; Configurações tem "exportar tudo" (histórias + sessões + respostas). Import aceita os dois e faz upsert por id (importar duas vezes não duplica). Nunca inclui settings. | — |
| 11 | Tags | Tags são normalizadas (minúsculas, espaços viram hífen, sem repetição) e há uma lista de sugestões (conflict, leadership, failure, ownership...). | Tags livres sem normalizar. |
| 12 | Zod 4 | `z.record(z.number())` do spec virou `z.record(z.string(), z.number())` (o Zod 4 exige o tipo da chave) e `z.string().url()` virou `z.url()`. | — |
| 13 | Modelos padrão dos presets | Sugestões iniciais: OpenAI `gpt-4.1-mini`, OpenRouter `openai/gpt-4.1-mini`, Groq `llama-3.3-70b-versatile`, Gemini `gemini-2.5-flash`, Anthropic `claude-haiku-5-5`, Ollama `qwen3:8b`, LM Studio vazio (usa o carregado). **Não testei com key real.** A tela tem "carregar modelos" (`GET /models`) pra escolher da lista do provedor. | Trocar os padrões. |
| 14 | Capacidades de JSON | Conservador: `json_schema` só em OpenAI, Gemini e LM Studio; `json_object` em OpenAI, OpenRouter, Groq, Gemini e Ollama; Anthropic e Personalizado só por prompt. Se o provedor responder 400 ao `response_format`, o app desce sozinho pro modo seguinte. | — |
| 15 | Verificação de CORS | Feita com preflight `OPTIONS` real (Origin + Authorization/Content-Type) em 22/11: OpenAI, OpenRouter, Groq, Gemini e Anthropic liberam. O Gemini **recusa headers extras** (403), então nenhum preset manda header que não precise. Ollama e LM Studio não estavam rodando aqui: ficaram como "precisa liberar a origem". Falta o teste de verdade no navegador com key (tarefa do spec continua meio aberta). | — |
| 16 | Header do OpenRouter | Mando `X-Title: melete` (aparece no painel do OpenRouter, está na lista de headers liberados). Não identifica o usuário. | Não mandar. |
| 17 | Testar conexão | Chamada mínima de chat sem `max_tokens` (modelos de raciocínio recusam ou gastam tudo pensando). | — |
| 18 | Idioma inicial da interface | No primeiro acesso segue o idioma do navegador (pt → pt-BR, es → es, resto → en). Depois vale o que estiver salvo. | Sempre começar em pt-BR ou en. |
| 19 | Salvar nas Configurações | O bloco do provedor tem botão "Salvar" (porque envolve key e teste); voz, idioma, tema salvam na hora em que você muda. | Tudo com um único salvar. |
| 20 | Navegação | Barra lateral no desktop (Nova entrevista, Histórico, Histórias; Configurações embaixo) e barra no topo no celular. A sala de entrevista abre sem menu, em tela cheia. | — |
| 21 | Ao trocar o idioma da entrevista | A voz escolhida é limpa (ela era do idioma antigo) e volta pra voz padrão do novo idioma. | — |
| 22 | Idioma do feedback | `strengths`, `improvements` e o resumo da sessão saem no **idioma da interface** (você lê); `improvedAnswer` sai no idioma da entrevista (como o spec pede). | Tudo no idioma da entrevista. |
| 23 | Avaliação de follow-up | A resposta do follow-up também é avaliada (é um turno), e o avaliador recebe a pergunta e a resposta principais como contexto. | Avaliar a resposta principal + follow-up juntas como uma só. |
| 24 | Detalhe que falta na resposta melhorada | Quando falta um dado concreto, a `improvedAnswer` usa marcador entre colchetes (`[metric]`, `[timeframe]`) em vez de inventar. | — |
| 25 | Proteção contra prompt injection | Transcrição, descrição da vaga e histórias vão entre tags (`<transcript>…`) com aviso de que são dados, não instruções. | — |
| 26 | Pós-processamento do plano | Se o modelo devolver perguntas a mais, corto no número pedido; `storyId` inexistente ou repetido é descartado. Se devolver a menos, a sessão fica com menos perguntas. | Pedir de novo até ter o número exato. |
| 27 | Estados extras do motor | Além dos estados do spec, o motor tem `showingFeedback` (com feedback por resposta, espera você ler e apertar "próxima") e `error` (uma chamada falhou; "tentar de novo" refaz o mesmo passo sem perder nada). | — |
| 28 | Retomar sessão | Recarregar a página no meio da entrevista retoma na próxima pergunta principal não respondida (sair pelo botão marca `abandoned`, recarregar não). Um follow-up pendente no momento do reload é pulado. | — |
| 29 | Encerrar antes | Botão "encerrar agora" na sala: avalia o que já foi respondido e gera o resumo com isso. | — |
| 30 | Gravação | O microfone só abre quando você aperta o botão de gravar (não começa sozinho depois que a pergunta é lida). | Começar a ouvir automaticamente depois da pergunta. |
| 31 | Evals | 8 respostas de exemplo com nota esperada (minha avaliação: confira se concorda). O script mede erro médio, % dentro da tolerância, acerto do "respondeu a pergunta" e se a resposta melhorada inventou números. Keys só por variável de ambiente; `evals/providers.json` e `evals/results/` ficam fora do git. | — |
