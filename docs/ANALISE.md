# Análise do APK de referência (Illusia 2 v1.0.3)

Esta análise serviu apenas como **referência de gênero e sistemas**. Nenhum código,
sprite, som, texto, nome ou mapa do APK foi copiado para este projeto. Também não
versionamos o APK nem os arquivos extraídos.

## Tecnologia encontrada
| Item | Achado |
|---|---|
| Publicadora | Gamevil (`com.gamevil.illusia2.global`), build de 2014 |
| Engine | C++ nativa (`lib/armeabi/libgameDSO.so`) com uma camada Java fina via JNI |
| Java | billing do Google Play, DRM/licenciamento, Tapjoy (ofertas), Flurry (analytics), push C2DM |
| Dados | tabelas no estilo planilha (`Xls*.zt1`, `Str*.zt1`): cabeçalho de 8 bytes + zlib |
| Gráficos | formato próprio de sprites/animação `.pzx`; mapas `.mpl`; partículas `ptc/` |
| Scripts | ~130 quests (`script/quest`), eventos de mapa (`script/map`) |
| Tela | paisagem, D-pad virtual (`illusiaDpad.pzx`) |

## Sistemas de jogo identificados (pelos nomes de classes e tabelas)
- **3 classes:** espadachim, ladino e mago, cada uma com tabela de ações própria
- **Combate:** combo, dash attack, pulo duplo, descida de plataforma, knockback, atordoamento,
  tremor de câmera, efeitos de rastro (after-blur) e números de dano
- **Habilidades:** custo de MP, recarga, buffs temporários e quick slots
- **Progressão:** EXP por nível, pontos de atributo (manuais e automáticos), reset de status/skills
- **Itens:** raridade, refino, soquetes, inventário expansível e loja
- **Mundo:** vila central + zonas temáticas, NPCs, portais, minimapas e chefes com padrões
  (cada chefe tem uma classe própria)
- **Missões:** principais, secundárias e diárias; tipos matar, coletar e falar
- **Conquistas (Honor):** monstros derrotados, combos, ataques em dash etc.
- **Modos extras:** Rush (arena por ondas com recompensa) e PvP
- **Monetização:** itens pagos (reviver, portal, pontos extras, refino garantido) e anúncios

## O que levamos para o Ecos de Aurora (implementação própria)
| Sistema | Status |
|---|---|
| 3 classes originais (Guardião, Sombra, Arcanista) | ✅ |
| Combo, dash, ataque em dash, pulo duplo, descida de plataforma | ✅ |
| 3 habilidades por classe (corpo a corpo, avanço, projétil, área, buff/escudo) | ✅ |
| Nível, EXP, atributos FOR/VIT/INT/AGI | ✅ |
| Loot com raridade e atributos aleatórios, equipar/vender | ✅ |
| Vila + 3 zonas + chefe com 2 fases | ✅ |
| NPCs, missões em cadeia, loja | ✅ |
| Conquistas, contador de combo com bônus de dano | ✅ |
| Salvamento local, controles de toque e teclado | ✅ |
| Desafio das Ondas (inspirado no modo Rush) e Defesa do Cristal (inspirado no modo Defense) | ✅ |
| Coyote time, buffer de pulo, pausa de impacto maior no golpe final | ✅ |
| Refino/soquetes, mais zonas, modo Missão, PvP assíncrono | ⏳ próximos passos |
| Empacotar para Android (Capacitor) | ⏳ próximos passos |

## Referências da internet
O que as fontes dizem e como influenciou o projeto:

- **Modos e conteúdo do Illusia 2:** quatro mundos temáticos (Comida, Aventura, Brinquedos e Esperança)
  e quatro modos além da história: PvP assíncrono, Rush, Defense e Mission. Daqui vieram o
  *Desafio das Ondas* e a *Defesa do Cristal* (nossa versão, com regras próprias).
  Fontes: [Android Police](https://www.androidpolice.com/2012/06/18/gamevil-releases-illusia-2-save-the-dream-world-with-new-gameplay-modes-characters-and-more-customization-than-ever/),
  [Droid Gamers](https://www.droidgamers.com/news/gamevil-drops-another-rpg-onto-android-called-illusia-2/)
- **O que a crítica disse:** elogios ao visual e ao charme, ressalvas à jogabilidade. A 148Apps
  chamou o jogo de "rough cut" e a Pocket Gamer disse que não é o RPG mais refinado, mas um dos
  mais charmosos. Prioridade do nosso projeto: **controle e sensação de combate**.
  Fontes: [148Apps](https://www.148apps.com/reviews/illusia-2-review/),
  [Pocket Gamer](https://www.pocketgamer.com/illusia-2/review/),
  [Gamezebo](https://www.gamezebo.com/reviews/illusia-2-review/)
- **Sensação de combate (game feel):** a pausa de impacto (hitstop) deve congelar atacante e alvo
  juntos (aqui congela o mundo inteiro); empilhar efeitos pequenos (flash, knockback, tremor,
  partículas, som, antecipação); usar buffer de comandos e coyote time; dar mais peso ao golpe final do combo.
  Fontes: [guia de "juice" em combate 2D](https://freegamesprites.com/es/news/game-feel-2d-combat-juice-tricks),
  [checklist de game feel (Godot)](https://forum.godotengine.org/t/game-feel-checklist-for-godot-4-hit-stop-trauma-shake-coyote-time-and-more/145340),
  [combate em 9 Monkeys of Shaolin (Unreal)](https://www.unrealengine.com/tech-blog/9-monkeys-of-shaolin-developer-sobaka-studio-shares-how-to-create-a-satisfying-combat-system),
  [Pichlmair & Johansen, levantamento sobre game feel](https://arxiv.org/pdf/2011.09201)
- **Controles de toque:** menos botões, e maiores, reduzem toques acidentais. Ainda a aplicar.
  Fonte: [devlog sobre controles mobile](https://itch.io/devlog/446955/for-fun-designing-bossgames-mobile-controls.amp)
