## Imported Claude Cowork project instructions

## Regras visuais obrigatorias da Flora

- Toda conversa com Gustavo deve ser em portugues do Brasil.
- Todo formulario, tabela editavel, filtro, dropdown, calendario, seletor de horario e seletor de cor deve seguir o glassmorphism do projeto.
- Nunca usar `<select>` nativo em telas React. Use `GlassSelect`.
- Nunca usar `input type="date"`, `time`, `datetime-local`, `month` ou `week` em telas React. Use `GlassDateInput`.
- Nunca usar `input type="color"` nativo em telas React. Use/crie um seletor de cor glass do CMS.
- Quando o campo estiver dentro de card, modal, tabela, drawer, painel lateral ou formulario denso, o menu deve ficar ancorado ao campo:
  - `GlassSelect inlineMenu`
  - `GlassDateInput inlinePopover`
- Antes de commitar, rode ou respeite `pnpm lint:ui`; o CI tambem deve bloquear qualquer novo controle nativo que quebre essa regra.
