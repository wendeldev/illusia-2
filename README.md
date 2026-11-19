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

## Campanha

90 fases em 9 regiões (10 fases cada): Bosque Sussurrante, Pântano Nebuloso, Ruínas de Ferro,
Dunas Rubras, Caverna Cinzenta, Picos Gelados, Vulcão Ardente, Cidadela Sombria e Ilhas Celestes.
A fase 5 de cada região tem um chefe intermediário e a fase 10, o chefe da região.
Na vila, o portal do portão abre o **mapa do mundo**; vencer uma fase libera a próxima.

Chefes e alguns inimigos têm ataques especiais, sempre com aviso no chão antes:
pancada (círculo vermelho), investida (faixa com setas), disparos, chamar ajudantes e fúria (abaixo de 50% de vida).

- Regiões, inimigos de cada região e chefes: `src/data/campaign.ts` (`REGIONS`)
- Regras de geração das fases (ondas, largura, força): `makeStage()` no mesmo arquivo
- Ataques especiais de cada inimigo: `abilities` em `src/data/enemies.ts`

## Missões e música

- **Missões:** a Capitã Ivy (história: os 9 chefes), o Curandeiro Taro (caçadas) e a Ferreira Brida
  (materiais, com equipamentos de recompensa). `!` sobre o NPC = missão nova; `?` = pronta para entregar.
  As missões ficam em `src/data/quests.ts`; o andamento aparece no canto da tela e em ☰ → 📜 Missões.
- **Música:** cada região tem uma trilha própria e os chefes têm uma trilha mais intensa. É composta
  em tempo real pelo navegador (`src/engine/music.ts`); as "partituras" ficam em `src/data/music.ts`.
  Som e música podem ser desligados separadamente no menu.

## Estrutura

```
src/
  data/        ← CONTEÚDO (editar aqui para criar fases, poderes, itens, NPCs)
    stages.ts      vila (NPCs, construções) + campanha
    campaign.ts    as 9 regiões e a geração das 90 fases
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
- Estrelas por fase (tempo e dano recebido)
- PvP online (precisa de um servidor)
