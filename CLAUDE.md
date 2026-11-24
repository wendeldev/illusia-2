# Crônicas de Lumen — regras do projeto

- O personagem do jogador SEMPRE veste o equipamento equipado (loja, chefes, inimigos, eventos). Nunca usar uma prancha
  com o personagem já vestido (armadura, halo, asas, arma desenhados) como visual no jogo — nem por raridade, nem só no
  combate. Pranchas novas de personagem/skin entram apenas como corpo base sem equipamento (4×8: parado, andar, correr,
  pular); as peças vão por cima em camadas (`src/game/art/layers.ts`). Se a prancha recebida vier vestida, pedir a
  versão sem equipamento.
- Build dos sprites: `python3 -I tools/build_sprites.py && python3 -I tools/build_layered.py`.
- Publicação: push no branch dispara o GitHub Actions que publica no GitHub Pages.
- Cada classe usa só a sua arma: Guerreiro espada, Maga cajado, Assassino adaga (`CLASS_WEAPON` em `src/data/gear.ts`).
  Loja, drops, baús e recompensas só oferecem a arma da classe; equipar arma de outra classe é bloqueado.
- Modo 3D (padrão): o jogador é um boneco 3D (`src/engine/hero3d.ts`, 56 px, mesmo tamanho do 2D) e cada equipamento
  vira peça 3D desse boneco (halo, armadura, luvas, calças, botas, capa, asas, aura, arma). Item novo de equipamento
  precisa da peça 3D correspondente em `buildGear`. O modo 2D (`?2d`) continua com os sprites em camadas.
