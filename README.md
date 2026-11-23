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
| Andar | A/D ou ←/→ | direcional virtual (metade esquerda da tela) |
| Pular | Espaço, W ou ↑ | botão ▲ |
| Descer de uma plataforma | S + Espaço | direcional para baixo + ▲ |
| Subir/descer escada | W/S ou ↑/↓ perto da escada | direcional para cima/baixo |
| Atacar (combo de 3 golpes) | J | ⚔ |
| Poderes 1, 2, 3 | K, L, I | botões coloridos |
| Falar / entrar no portal | E (ou ↑ perto) | ✋ |
| Menu (atributos e equipamentos) | M | ☰ |

O jogo é de **plataforma lateral**: chão com degraus de alturas diferentes e plataformas flutuantes
(sobe-se por baixo e pousa-se em cima). O terreno de cada fase é gerado em `src/game/terrain.ts`
e desenhado em `src/game/art/ground.ts` (um estilo por região).

No celular dá para "Adicionar à tela inicial": o jogo abre em tela cheia e funciona offline (PWA).
O progresso é salvo automaticamente no navegador.

## Sprites (pixel art)

As pranchas originais ficam em `assets-src/`. O script `tools/build_sprites.py` recorta cada desenho,
remove o fundo, gera variações de cor e monta o atlas `public/sprites/atlas.png` + `src/data/atlas.json`.
Para trocar ou acrescentar sprites: edite as listas `HERO`, `SINGLE` e `VARIANTS` no script e rode
`python3 -I tools/build_sprites.py`. Qual sprite cada inimigo usa fica em `SPRITES` (`src/data/enemies.ts`).

## Classes

5 classes jogáveis, escolhidas no primeiro jogo e trocáveis na vila (☰ → ⚔ Classe):
Guerreiro (equilibrado), Arqueiro (flechas de longe), Maga (orbes, muito MP), Lutador (socos rápidos,
muita vida) e Lanceiro (alcance longo). Cada uma tem atributos, ataque básico e 3 poderes próprios
em `src/data/classes.ts`; as animações vêm de `assets-src/sheet-classes.png` (`CLASS_FRAMES` no script).

## Poderes

Guerreiro, Maga e Assassino têm 8 poderes cada (prancha `assets-src/sheet-powers.png`, recortada por
`tools/powers_cells.py`), com animação do personagem, efeito próprio e ícone. 4 vão nos botões; troque em
☰ → ✦ Trocar poderes (alguns desbloqueiam com o nível). Teclado: K, L, I, O. Dados em `src/data/classes.ts`.

### Efeitos dos poderes

Pranchas `assets-src/fx-<classe>.png` (Guerreiro, Maga, Assassino e Arqueiro; 8 poderes × 6 quadros, recortadas
por `tools/fx_cells.py`): cada poder mostra a sua animação (`fx2_<poder>`): cortes, investida, projéteis,
explosões, chuvas, círculos, escudo, cura e clone. O Arqueiro ganhou 8 poderes: Flecha de Vento, Disparo Triplo,
Flecha Perfurante, Chuva de Flechas, Flecha Explosiva, Flecha de Gelo, Flecha Venenosa e Águia Espectral.

## Chefes

O chefe final de cada região usa a prancha `assets-src/sheet-bosses.png` (recortada por `tools/boss_cells.py`):
parado, andar/avançar, ataques 1 e 2 (alternados), ataque 3 (especial), dano e morte, e os efeitos nos
disparos, pancadas e invocações. Bosque: Golem Ancião · Pântano: Rei Esqueleto · Ruínas: Cavaleiro Sombrio ·
Dunas: Demonessa Carmesim · Caverna: Golem de Cristal · Neve: Hidra das Profundezas · Vulcão: Dragão Rubro ·
Cidadela: Dragão Negro · Ilhas Celestes: Deus das Trevas. Mapa em `BOSS_ANIMS` (`src/data/enemies.ts`).

Chefes da fase 5 (prancha `assets-src/sheet-minibosses.png`, `tools/miniboss_cells.py`): Lobo Alfa, Planta Carnívora,
Golem de Pedra, Serpente Gigante, Aranha Gigante, Troll Bruto, Orc Comandante, Cavaleiro Caído e Mago Sombrio;
Minotauro Guerreiro na fase 3-8. Mapa em `MINI_BOSSES` (`src/data/enemies.ts`).

## Itens, baús e recompensas

Prancha `assets-src/sheet-items.png` (recortada por `tools/item_cells.py`). Regras em `src/game/loot.ts`, catálogo em `src/data/items.ts`.
- **Drops**: itens saltam dos inimigos e o personagem pega passando perto. Inimigos comuns: poções, baús e chaves
  do nível deles, materiais, orbes, coletáveis, comida e (raramente) equipamentos. **Gemas só de chefes**; Mana Rara e
  Elixir também. Equipamento melhor que o atual é equipado sozinho.
- **Baús** (madeira → angelical) abrem com a chave do mesmo nível ou maior (Bolsa → Itens).
- **Sequência de abates**: a cada 3 abates seguidos, um bônus temporário de 15 s.
- **Eventos de tesouro**: 18% das fases (ou com o Passe de Evento): drops +50% e itens raros de evento.
- **Orbes, cartas (2) e runa (1)**: bônus permanentes; cada classe aproveita alguns mais (★).
- **Coleção**: álbum de coletáveis e itens de evento, com bônus de ataque e vida.
- **Ferreira**: abas Equipamentos, Materiais (poções, chaves, materiais, tíquetes) e Aprimorar (+1 a +10).
- **Arena dos Chefes** (mapa do mundo): gasta um tíquete, enfrenta um chefe no seu nível e dá gemas e baús.
- **Novos espaços**: luvas, botas e asas. As asas aparecem nas costas e a arma +4 ou mais brilha.

## Eventos: chefes Lendários e Míticos

Botão **Eventos** na tela principal (ou tecla N). Precisa de tíquete: **Tíquete Lendário** (Titã de Cristal,
Valquíria, Hidra Abissal) ou **Tíquete Mítico** (Dragão Infernal, Rei Lich, Demônio do Abismo, Arcanjo Caído).
Os tíquetes são vendidos por gemas na ferreira e às vezes caem dos chefes.
- Cada chefe tem cenário próprio, horda própria e **8 fases** (Guardião nas fases 4 e 7, chefe na 8).
- **40 minutos** para vencer as 8 fases (cronômetro no topo). Se o tempo acabar ou o personagem cair, o evento falha.
- Dificuldade **Difícil** ou **Épico** (monstros de nível mais alto, mais vida e ataque).
- Recompensa: o set (5 peças + arma preferida) da classe escolhida: Lendário/Difícil → **Lendário**,
  Lendário/Épico e Mítico/Difícil → **Divino**, Mítico/Épico → **Celestial**.
Dados em `src/data/mythic.ts`; prancha em `assets-src/sheet-mythic-*.png` (`tools/mythic_cells.py`).

## Equipamento em camadas e raridades

8 raridades: Comum, Incomum, Raro, Épico, Lendário, Mítico, Divino (e Celestial, só de eventos). Espaços:
arma, halo, armadura, braços, calças, botas, capa, asas traseiras, asas frontais, aura e acessório.
O personagem é um boneco em camadas ("layered sprites", `src/game/art/layers.ts`): o corpo base sem
equipamento da prancha (`pd_<classe>`) e, por cima, cada peça equipada no lugar do corpo: aura, asas traseiras,
capa, calças, botas, armadura, braços, arma na mão, asas frontais e o halo flutuando acima da cabeça. A posição de cabeça, pescoço,
quadril, mãos e pés de cada quadro é medida por `tools/anatomy.py` (`src/data/paperdoll.json`). Golpes e poderes
movem a arma e o corpo. Itens antigos aparecem com a peça do set da classe na mesma raridade. Sets (armadura, braços, calças e capa): 3 peças = +6%, 4 peças = +15% (mais com raridade; 1,5× no set da própria
classe). Arma preferida da classe: +25% no ataque da arma. A loja tem categorias (espadas, machados, lanças,
adagas, arcos, cajados, halos, armaduras, braços, calças, capas, botas, asas, auras); Mítico e Divino
custam gemas. Catálogo gerado em `src/data/gear.ts`.

## Corpo do Guerreiro

O Guerreiro (e Lutador e Lanceiro) usa o corpo base da prancha `assets-src/sheet-hero-white.png`
(`tools/hero_white.py`): 8 quadros de parado, andar, correr e pular (com a retomada no pouso). As peças
equipadas continuam vestidas por cima em cada quadro (anatomia em `src/data/paperdoll.json`). Prévia com as
8 raridades: `spritesheets/warrior_dress.png`.

## Inventário

Bolsa (🎒 ou G) no visual da prancha `assets-src/sheet-inventory.png` (recortada por `tools/ui_cells.py`):
abas Equipamento, Itens, Materiais, Cartas/Orbes e Coleção. Em Equipamento: o personagem com os 11 espaços,
o inventário com filtros (tudo, armas, armaduras, halos, acessórios, asas, auras), bordas por raridade, selos
**E** (equipado) e **N** (novo), setas verde/vermelha comparando com o equipado, páginas e Organizar
(por raridade ou por tipo). O painel de detalhes mostra os atributos com a diferença para o item equipado e os
botões Equipar/Desequipar e Vender (metade do preço). Toque duplo num item também equipa.

## Spritesheets em camadas (spritesheets/)

`python3 -I tools/build_layered.py` gera, para Guerreiro, Mago, Assassino e Arqueiro, uma spritesheet PNG por camada:
corpo, cabelo, rosto, halo, armadura, luvas, calças, botas, capa e arma (peças nas 8 raridades).
- Quadros de **128×128**, pés sempre no ponto (64, 112), fundo transparente, sem suavização.
- 8 colunas × 10 linhas, uma linha por animação: Idle (4), Andar (8), Correr (8), Pular (4), Cair (4),
  Ataque 1 (6), Ataque 2 (6), Ataque 3 (8), Dano (4), Morte (8).
- Todas as camadas têm os mesmos quadros, tamanho, ordem e alinhamento: troca-se armadura ou arma sem mudar a animação.
- Ordem de desenho e dados das animações (fps, repetição) em `spritesheets/layers.json`; `preview.png`/`preview.gif` de cada classe
  e `spritesheets/preview_all.png` mostram tudo junto.
- **Halo** (auréola, no espaço da cabeça, prancha `assets-src/sheet-halos.png`): o mesmo para as 4 classes —
  Comum branco, Incomum verde, Raro azul com asinhas, Épico roxo com asas, Lendário dourado, Mítico vermelho
  flamejante, Divino celestial com asas e cristais (e Celestial, só de eventos). Cada um tem 4 quadros de brilho
  e flutua logo acima da cabeça de cada quadro da animação. Prévia ampliada: `python3 -I tools/halo_preview.py`
  → `spritesheets/halo_check.png`.
- O movimento vem de `tools/rig.py`, que também gera `src/data/rig.json`: o jogo anima o personagem com o mesmo rig.

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

## Níveis

Cada monstro tem nível (aparece embaixo dele). Fases 1–5: monstros nível 1–5; a partir da fase 6
começam no nível 8 e sobem 1 por fase (fase 90 = nível 92). Alguns vêm 1 nível acima; o chefe
intermediário tem +2 e o chefe da região +3. A cor compara com o seu nível: cinza = fácil,
branco = parelho, laranja/vermelho = perigoso. Regra em `monsterLevel()` (`src/data/campaign.ts`).

## Estrelas

Cada fase tem 3 estrelas: ★ vencer, ★ vencer dentro do tempo-limite e ★ perder no máximo 50% da vida.
O cronômetro e o dano aparecem no canto superior direito durante a fase. As estrelas conquistadas
ficam salvas (somam entre tentativas) e cada estrela nova dá ouro de bônus. O mapa mostra as estrelas
de cada fase e o total por região. Tempo-limite: `parTime` em `src/data/campaign.ts`; limite de dano:
`DAMAGE_LIMIT` em `src/game/stars.ts`.

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
- PvP online (precisa de um servidor)
