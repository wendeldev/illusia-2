# Ecos de Aurora

RPG de ação 2D side-scroller, original, feito em HTML5 Canvas + JavaScript puro
(sem dependências e sem etapa de build). Roda no navegador do PC e do celular.

## Como jogar
```bash
python3 -m http.server 8000   # ou: npx serve .
# abra http://localhost:8000
```
(os módulos ES não carregam via `file://`, por isso é preciso um servidor local)

**Teclado:** ←→ / A D mover • Espaço pular (2× = pulo duplo, ↓+pulo = descer da plataforma) •
J atacar (repita para combo) • L dash (J durante o dash = golpe especial) •
U / I / O habilidades • Q / E poções • ↑ conversar/portal • Esc menu

**Celular:** controles na tela; jogue com o aparelho na horizontal.

## Estrutura
```
index.html, style.css
src/main.js            loop de jogo (60 atualizações/s) e redimensionamento
src/ui.js              título, menus, diálogos (HTML sobre o canvas)
src/engine/            entrada, áudio sintetizado, utilidades
src/game/              jogo, jogador, inimigos, física, efeitos, HUD, desenho
src/data/              classes, habilidades, monstros, itens, mapas, missões (balanceamento aqui)
docs/ANALISE.md        análise do APK de referência
```
Para adicionar conteúdo, normalmente basta editar os arquivos em `src/data/`.

## Próximos passos sugeridos
- Modo arena por ondas e mais zonas/chefes
- Refino e soquetes de equipamento
- Sprites desenhados (hoje a arte é vetorial gerada por código)
- Empacotar como app Android com Capacitor
