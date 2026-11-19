# Crônicas de Lumen (nome provisório)

RPG de ação 2D para navegador, feito para **celular e PC**: abre no navegador, sem instalar nada.
Inspirado no gênero dos RPGs de ação mobile antigos, com conteúdo **original**.

## Rodar

```bash
npm install
npm run dev      # abre em http://localhost:5173 (com --host, dá para abrir no celular pela mesma rede Wi-Fi)
npm run build    # gera a versão final em dist/ (pode hospedar em qualquer site estático, ex.: GitHub Pages)
```

Para depurar, abra com `?debug` e use `window.__game` no console.

## Controles

| | PC | Celular |
|---|---|---|
| Mover | WASD / setas | direcional virtual (metade esquerda da tela) |
| Atacar (combo de 3 golpes) | J | ⚔ |
| Poderes 1, 2, 3 | K, L, I | botões coloridos |
| Falar / entrar no portal | E | ✋ |
| Menu (atributos e equipamentos) | M | ☰ |

No celular dá para "Adicionar à tela inicial": o jogo abre em tela cheia e funciona offline (PWA).
O progresso é salvo automaticamente no navegador.

## Estrutura

```
src/
  data/        ← CONTEÚDO (editar aqui para criar fases, poderes, itens, NPCs)
    stages.ts      fases, portais, ondas de inimigos, posição dos NPCs
    skills.ts      poderes (até 3; projétil, área ou golpe corpo a corpo)
    equipment.ts   armas, armaduras, elmos, acessórios
    enemies.ts     inimigos, chefes e itens que deixam cair
    npcs.ts        NPCs: diálogo, loja ou cura
  engine/      ← tela (escala para qualquer aparelho) e controles (teclado/mouse/toque)
  game/        ← regras: combate, ondas, progresso, interface
  types.ts     ← formato de cada tipo de conteúdo
```

O conteúdo é verificado ao iniciar (`validateContent`): se uma fase apontar para um inimigo ou item
que não existe, o erro aparece no console com o nome do que falta.

## Próximos passos sugeridos

- Arte própria (sprites) no lugar das formas provisórias (`src/game/draw.ts`)
- Sons e música
- Mais fases, chefes com ataques especiais, missões
- PvP online (precisa de um servidor)
