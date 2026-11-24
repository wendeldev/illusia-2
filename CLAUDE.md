# Crônicas de Lumen — regras do projeto

- O personagem do jogador SEMPRE veste o equipamento equipado (loja, chefes, inimigos, eventos). Nunca usar uma prancha
  com o personagem já vestido (armadura, halo, asas, arma desenhados) como visual no jogo — nem por raridade, nem só no
  combate. Pranchas novas de personagem/skin entram apenas como corpo base sem equipamento (4×8: parado, andar, correr,
  pular); as peças vão por cima em camadas (`src/game/art/layers.ts`). Se a prancha recebida vier vestida, pedir a
  versão sem equipamento.
- Build dos sprites: `python3 -I tools/build_sprites.py && python3 -I tools/build_layered.py`.
- Publicação: push no branch dispara o GitHub Actions que publica no GitHub Pages.
