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
