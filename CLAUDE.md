# Crônicas de Lumen — regras do projeto

- O personagem do jogador SEMPRE veste o equipamento equipado (loja, chefes, inimigos, eventos). Nunca usar uma prancha
  com o personagem já vestido (armadura, halo, asas, arma desenhados) como visual no jogo — nem por raridade, nem só no
  combate. Pranchas novas de personagem/skin entram apenas como corpo base sem equipamento (4×8: parado, andar, correr,
  pular); as peças vão por cima em camadas (`src/game/art/layers.ts`). Se a prancha recebida vier vestida, pedir a
  versão sem equipamento.
  Exceção pedida: **trajes** (slot `costume`, `cs_<nome>`, `assets-src/warrior2/traje-*.png`) são roupas inteiras
  desenhadas do Guerreiro, que só aparecem quando o traje foi obtido (cai dos chefes, um diferente por chefe até ter
  todos) e equipado. Eles usam os mesmos 56 quadros do corpo (`tools/warrior2.py`).
- Build dos sprites: `python3 -I tools/build_sprites.py && python3 -I tools/build_layered.py`.
- Publicação: push no branch dispara o GitHub Actions que publica no GitHub Pages.
- Cada classe usa só a sua arma: Guerreiro espada, Maga cajado, Assassino adaga (`CLASS_WEAPON` em `src/data/gear.ts`).
  Loja, drops, baús e recompensas só oferecem a arma da classe; equipar arma de outra classe é bloqueado.
