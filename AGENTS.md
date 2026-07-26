## Imported Claude Cowork project instructions

## Regras visuais obrigatórias da Flora

- Toda conversa com Gustavo deve ser em português do Brasil.
- Todo formulário, tabela editável, filtro, dropdown, calendário, seletor de horário e seletor de cor deve seguir o glassmorphism do projeto.
- Nunca usar `<select>` nativo em telas React. Use `GlassSelect`.
- Nunca usar `input type="date"`, `time`, `datetime-local`, `month` ou `week` em telas React. Use `GlassDateInput`.
- Nunca usar `input type="color"` nativo em telas React. Use/crie um seletor de cor glass do CMS.
- Quando o campo estiver dentro de card, modal, tabela, drawer, painel lateral ou formulário denso, o menu deve ficar ancorado ao campo:
  - `GlassSelect inlineMenu`
  - `GlassDateInput inlinePopover`
- Menus, dropdowns, calendários, seletores de horário e seletores de cor nunca podem ficar truncados, presos atrás de cards, tabelas ou painéis. O componente base deve usar portal/fixed positioning quando houver risco de sobreposição.
- Todo texto visível da interface deve estar em português do Brasil com acentuação correta. Não deixar labels, botões, mensagens, tabelas ou exports com "Preco", "Descricao", "Nao", "Cenario", "Orcamento", "Comissao", "Logistica" sem acento.
- Antes de commitar, rode ou respeite `pnpm lint:ui`; o CI também deve bloquear qualquer novo controle nativo que quebre essa regra.
