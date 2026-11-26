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
| Modo arena por ondas, refino/soquetes, mais zonas | ⏳ próximos passos |
| Empacotar para Android (Capacitor) | ⏳ próximos passos |
