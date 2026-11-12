# Dacity · Prompts para Leonardo.ai

Prompts em inglês (os modelos respondem melhor). Explicações em português.
Cada asset tem **IMAGEM** (gera o quadro parado) e **MOTION** (anima esse quadro em Image to Video).

> **Nunca escreva nos prompts:** "GTA", "Grand Theft Auto", "Vice City", "Leonida", "Rockstar", "Jason", "Lucia".
> Personagens, nomes e logo são IP da Rockstar/Take-Two, e jogo com token usando isso é alvo fácil de takedown.
> A vibe (Miami neon, pôr do sol, crime, palmeiras) é gênero e pode usar à vontade. Por isso os chefões são **Nina** e **Rico**.

---

## 0. Como usar

1. **Imagem** (Image Generation)
   - Modelo: Lucid Origin ou Phoenix (ou o flagship mais novo da Leonardo).
   - Style preset: `Illustration` para arte 2D (seções A, B, C). `3D Render` para box, gangsters e moeda (D, E, F).
   - **Prompt Enhance: OFF.** Ligado, ele reescreve o prompt e o estilo muda.
   - Gere 4, escolha 1, **anote o seed** para variações.
2. **Consistência**
   - Gere primeiro as fichas **B0** (Nina e Rico). Use a ficha em `Image Guidance → Character Reference` (força média/alta) em todo prompt com o personagem.
   - Escolha o melhor hero (**A1**) e use em `Style Reference` nos outros assets 2D.
   - Duas pessoas na mesma imagem (A3) costumam misturar rostos. Se acontecer, gere cada um separado e monte no Canva/Photoshop.
3. **Animação** (Video → Image to Video)
   - Suba a imagem escolhida e cole só o MOTION (descreve movimento, não a cena).
   - 5 s, 720p ou mais. Se o modelo aceitar **end frame**, use a mesma imagem no início e no fim: loop perfeito.
4. **Fundo** (decide como encaixa no site)
   - Fica sobre o fundo do site (box, revelação, moeda): fundo **violeta quase preto** (igual `#07040f`). Encaixa sem recorte; suaviza a borda com máscara radial no CSS.
   - Luz, brilho, partícula: fundo **preto puro**. No site use `mix-blend-mode: screen` e o preto some.
   - Precisa de PNG recortado: fundo **verde chroma liso** + "Remove Background" da Leonardo.
5. **Sem texto na arte.** IA erra letra. Nome do jogo, gangue, valores e botões ficam no HTML.

### Negative prompt (quando o modelo tiver o campo)

```
text, letters, words, logo, watermark, signature, brand names, blurry, low resolution, jpeg artifacts, deformed hands, extra fingers, extra limbs, distorted face, cropped head, duplicate characters, washed out colors
```

### Paleta (a mesma do site)

| Cor | Hex | Uso |
|---|---|---|
| Hot pink | `#ff2e88` | Nina, CTA |
| Electric cyan | `#22e4ff` | Rico |
| Sunset orange | `#ff8a3d` | luz de pôr do sol |
| Gold | `#ffd36b` | moeda, destaques |
| Deep violet | `#2a0f4a` | sombras |
| Fundo | `#07040f` | fundo do site |

---

## A. Landing page

### A1 · Hero de fundo (desktop) · 16:9

Fundo atrás do botão **Conectar carteira**. Centro escuro e vazio de propósito.

IMAGEM
```
Wide establishing shot of a fictional tropical coastal metropolis at sunset seen from a long causeway bridge, art deco hotels and glass towers with glowing pink and cyan neon signs, tall palm tree silhouettes framing the left and right edges, calm ocean reflecting a huge orange and magenta sky, a few vintage sports cars with light trails on the bridge, the center of the image is a darker calm area of sky and water with a soft vignette and empty negative space, painted crime-thriller key art, bold digital painting, clean ink outlines, cel shading with painterly texture, golden-hour rim light, saturated palette of hot pink, sunset orange, gold, electric cyan and deep violet, cinematic, highly detailed, no text, no logos
```

MOTION
```
Very slow cinematic dolly-in toward the skyline, palm fronds swaying gently in the sea breeze, neon signs flickering softly, car headlights streaming across the bridge, clouds drifting slowly, sparkles on the water, no camera cuts, no new objects appearing, stable horizon, seamless ambient loop
```

### A2 · Hero mobile · 9:16

IMAGEM
```
Vertical composition of a fictional tropical coastal metropolis at sunset, palm tree leaves hanging into the top corners, neon-lit art deco skyline and calm ocean in the lower third, huge orange and magenta sky filling the middle with a darker calm empty area in the center, a few birds in the distance, painted crime-thriller key art, bold digital painting, clean ink outlines, cel shading with painterly texture, golden-hour rim light, saturated palette of hot pink, sunset orange, gold, electric cyan and deep violet, cinematic, highly detailed, no text, no logos
```

MOTION: mesmo do A1.

### A3 · Key art Nina + Rico · 16:9 (recorte 4:5 para redes)

IMAGEM
```
Cinematic movie-poster key art of two original crime partners standing back to back in front of a red vintage convertible on a beachfront boulevard at sunset. Left: Nina Solano, woman in her early 30s, warm tan skin, jet-black asymmetric bob with one hot-pink streak, thin gold cat-eye glasses, confident smirk, cream blazer with rolled sleeves over a black silk camisole, leather ledger in hand. Right: Rico Tavares, tall athletic Brazilian man in his mid-30s, deep brown skin, tight fade with a shaved line, thin mustache and short goatee, mirrored cyan aviators pushed up on his head, white vintage racing jacket with cyan and pink stripes, car keys on one finger. Neon hotel signs and palm trees behind them, dramatic low angle, strong orange backlight with pink and cyan rim lights, painted crime-thriller key art, bold digital painting, clean ink outlines, cel shading, saturated synthwave palette, highly detailed, no text, no logos
```

MOTION
```
Subtle parallax push-in, wind moving her hair and his jacket, he spins the car keys once around his finger, her glasses catch a glint of light, headlights of a passing car sweep across them, neon flickers behind, both keep the same pose and identity, no talking, seamless loop
```

### A4 · Halo neon atrás do botão · 1:1 · fundo preto

No site: `mix-blend-mode: screen` atrás do botão.

IMAGEM
```
Glowing neon ring made of hot pink and electric cyan light tubes, soft bloom and light haze, tiny floating sparks around it, centered, perfectly round, on a pure solid black background, minimalist, high contrast, no text
```

MOTION
```
The neon ring pulses slowly in brightness, sparks orbit the ring clockwise, the light haze breathes in and out, camera static, the background stays pure black, seamless loop
```

### A5 · Tela de loading · 16:9 e 9:16

IMAGEM
```
First-person view from the driver seat of a vintage convertible cruising down a neon-lit beachfront boulevard at night, palm trees and art deco buildings on both sides, pink and cyan neon reflections on wet asphalt, glowing retro dashboard, light motion blur, painted crime-thriller key art, bold digital painting, cel shading with painterly texture, saturated palette of hot pink, electric cyan and deep violet, cinematic, no text, no logos
```

MOTION
```
Continuous forward driving at steady speed, palm trees and neon signs passing on both sides, reflections sliding on the road, slight steering sway, camera locked to the car, seamless loop
```

---

## B. Personagens (tela de seleção)

### B0 · Fichas de personagem (gere primeiro) · 16:9

Nina
```
Character reference sheet of Nina Solano, a sharp woman in her early 30s with warm tan skin, jet-black asymmetric bob haircut with a single hot-pink streak, thin gold cat-eye glasses, confident smirk, tailored cream blazer with rolled sleeves over a black silk camisole, high-waisted black trousers, gold bracelet with a tiny calculator charm, holding a leather ledger notebook. Full body in front view, three-quarter view, side view and back view, plus a close-up head portrait, same outfit in every view, plain light grey background, even lighting, clean turnaround layout, painted crime-thriller character art, clean ink outlines, cel shading, no text
```

Rico
```
Character reference sheet of Rico Tavares, a tall athletic Brazilian man in his mid-30s with deep brown skin, tight fade haircut with a shaved line, thin mustache and short goatee, mirrored cyan aviator sunglasses pushed up on his head, vintage white racing jacket with cyan and pink stripes over a black t-shirt, dark jeans, fingerless black leather driving gloves, car keys hanging from one finger, cocky grin. Full body in front view, three-quarter view, side view and back view, plus a close-up head portrait, same outfit in every view, plain light grey background, even lighting, clean turnaround layout, painted crime-thriller character art, clean ink outlines, cel shading, no text
```

### B1 · Retrato Nina · 4:5 · vai para `web/public/characters/nina.webp`

IMAGEM (Character Reference = ficha B0 da Nina)
```
Waist-up portrait of Nina Solano, woman in her early 30s, warm tan skin, jet-black asymmetric bob with one hot-pink streak, thin gold cat-eye glasses, confident smirk, cream blazer with rolled sleeves over a black silk camisole, gold calculator-charm bracelet, tapping a pen on a leather ledger, three-quarter view looking at the viewer, hotel rooftop at sunset with a blurred neon skyline behind her, hot pink rim light and warm orange key light, space above her head, painted crime-thriller key art, bold digital painting, clean ink outlines, cel shading with painterly texture, highly detailed, no text, no logos
```

### B2 · Retrato Rico · 4:5 · vai para `web/public/characters/rico.webp`

IMAGEM (Character Reference = ficha B0 do Rico)
```
Waist-up portrait of Rico Tavares, tall athletic Brazilian man in his mid-30s, deep brown skin, tight fade with a shaved line, thin mustache and short goatee, mirrored cyan aviators pushed up on his head, white vintage racing jacket with cyan and pink stripes over a black tee, fingerless leather driving gloves, car keys on one finger, cocky grin, three-quarter view looking at the viewer, leaning on the hood of a vintage muscle car in a neon-lit parking garage, electric cyan rim light and warm orange key light, space above his head, painted crime-thriller key art, bold digital painting, clean ink outlines, cel shading with painterly texture, highly detailed, no text, no logos
```

### B3 · Idle Nina (loop, a partir do B1)

MOTION
```
Subtle idle animation: she breathes calmly, blinks naturally, taps the pen on the ledger twice, the pink hair streak moves slightly in the breeze, skyline lights twinkle in the background, camera static, same face and outfit throughout, no talking, seamless loop
```

### B4 · Idle Rico (loop, a partir do B2)

MOTION
```
Subtle idle animation: he breathes calmly, blinks, spins the car keys around his finger and catches them, the cyan sunglasses reflect passing lights, neon tubes in the garage flicker softly, camera static, same face and outfit throughout, no talking, seamless loop
```

### B5 · Reação "SELECIONADO" (toca uma vez, 3 a 5 s)

Nina
```
She snaps the ledger shut, lowers her glasses slightly and gives a confident smirk straight to the camera, hot pink light flares up behind her, slow camera push-in, ends on a held pose
```

Rico
```
He pulls the cyan aviator sunglasses down over his eyes and grins at the camera, car headlights flare on behind him with cyan light, slow camera push-in, ends on a held pose
```

---

## C. Gangue

### C1 · Brasão da gangue · 1:1 · fundo preto

Template. Troque `[MOTIF]`. O nome da gangue vai por cima no HTML.

IMAGEM
```
Street gang emblem badge, circular crest with [MOTIF] in the center, ornate border of palm leaves and neon tube outlines, chrome and enamel finish, hot pink and electric cyan accents, centered, symmetrical, clean vector-like shapes, on a pure solid black background, no text, no letters
```

Ideias de `[MOTIF]`:
- a coiled snake wearing sunglasses
- a flamingo holding a pair of dice
- a panther head with a gold chain
- a crowned skull between two palm trees
- two crossed switchblades with roses
- a shark fin cutting through waves
- a pair of burning dice
- a lion with a diamond grill

MOTION (opcional)
```
The emblem tilts slowly left and right, a light sweep glints across the chrome, the neon outline flickers on, black background, seamless loop
```

### C2 · QG da gangue · 16:9

IMAGEM
```
Interior of a secret gang headquarters inside an old waterfront warehouse at night, big wooden table covered with a city map, stacks of cash and an open briefcase, neon signs on brick walls glowing pink and cyan, ceiling fan, smoky haze in shafts of light from high windows, vintage sports car parked in the background, empty leather chair at the head of the table, painted crime-thriller key art, bold digital painting, cel shading with painterly texture, saturated palette of hot pink, sunset orange, electric cyan and deep violet, cinematic, highly detailed, no text, no logos
```

MOTION
```
Ceiling fan spinning slowly, haze drifting through the light beams, neon signs buzzing and flickering, dust particles floating, very slow camera push toward the table, no people appear, seamless loop
```

### C3 · Mapa da cidade (feature futura de território) · 16:9

IMAGEM
```
Stylized top-down illustrated map of a fictional tropical coastal city divided into colorful districts, beach strip, port with cargo ships, downtown towers, marina, small islands connected by bridges, glowing neon district borders in pink and cyan, treasure map meets synthwave aesthetic, painted illustration, clean outlines, no text, no labels, no logos
```

---

## D. Gangster Box

Design: maleta blindada de dinheiro. Todas as boxes são iguais; a raridade só aparece na abertura (D4).

### D1 · Box fechada · 1:1

IMAGEM
```
Mysterious loot box shaped like a vintage armored cash briefcase, black carbon leather with polished chrome corners, heavy gold padlock on the front, neon seams leaking pink and cyan light from inside, small embossed palm tree emblem, floating slightly above the floor, three-quarter view, centered, plain very dark violet-black background with a faint floor reflection, stylized 3D render, premium game asset, soft studio lighting with pink and cyan rim lights, glossy reflections, sharp focus, no text, no logos
```

### D2 · Box parada (loop)

MOTION
```
The briefcase floats and bobs gently up and down, neon light pulses through the seams like a heartbeat, small sparks drift upward, the padlock swings slightly, camera static, background stays dark, seamless loop
```

### D3 · Box tremendo (antes de abrir, 2 a 3 s)

MOTION
```
The briefcase starts shaking harder and harder, the padlock rattles, light leaking from the seams grows brighter and more intense, small sparks burst out, tiny camera shake, background stays dark
```

### D4 · Abertura por raridade (5 s, 5 versões)

Gere 5 vídeos a partir do D1 trocando `[LIGHT]` e `[FX]`.

MOTION
```
The padlock snaps open and the armored briefcase bursts open toward the camera, a blinding beam of [LIGHT] shoots out from inside, [FX], camera pushes in slowly, the light fills the whole frame at the end, background stays dark
```

| Raridade | `[LIGHT]` | `[FX]` |
|---|---|---|
| Comum | soft silver-grey light | a few dust particles float upward |
| Incomum | bright emerald green light | green sparks swirl upward |
| Raro | intense electric blue light | blue lightning crackles and sparkles spiral outward |
| Épico | deep purple and magenta light | purple energy smoke and floating crystal shards explode outward |
| Lendário | radiant golden light with god rays | gold coins and diamonds erupt like a fountain, golden confetti rains down, a shockwave ring expands |

Dica: o vídeo termina com a tela tomada pela luz. No site, faça crossfade desse último quadro para a carta do gangster revelado.

---

## E. Gangsters (NFT)

"Boneco" colecionável estilo vinyl toy. Template com dois campos: `[ARCHETYPE]` e a linha da raridade.

### E1 · Figura do gangster · 1:1

IMAGEM
```
Collectible vinyl toy figure of an original gangster character: [ARCHETYPE]. Chibi proportions with a slightly oversized head, expressive face, standing confidently on a round display pedestal, [MATERIAL], centered, full body, front three-quarter view, plain background of [BG], stylized 3D render, smooth sculpted surfaces, soft studio lighting, sharp focus, no text, no logos, no watermark
```

| Raridade | Cor no site | `[MATERIAL]` | `[BG]` |
|---|---|---|---|
| Comum | `#a7afc2` | matte grey vinyl finish, simple outfit, no glow | flat cool grey gradient |
| Incomum | `#3ddc84` | glossy vinyl finish with small emerald green neon accents | dark teal to green gradient |
| Raro | `#2fb4ff` | semi-metallic paint, electric blue neon trims, tiny sparkles around | deep navy with soft blue glow |
| Épico | `#b45cff` | translucent purple resin with an inner glow, holographic jacket, floating violet particles | dark violet with magenta haze |
| Lendário | `#ffb020` | polished gold chrome with diamond inlays, golden aura, floating gold coins, light rays | black with a radiant golden glow |

Ideias de `[ARCHETYPE]`:
1. a young getaway driver in a racing jacket with a steering wheel keychain
2. a hulking nightclub bouncer in a tight black tee with an earpiece, arms crossed
3. a hacker girl with a glowing cyber visor, oversized hoodie and a laptop
4. a dock smuggler in a captain hat and raincoat carrying a wooden crate
5. a casino card dealer in a vest and bow tie fanning playing cards
6. a roller-skate street hustler with a fanny pack stuffed with cash
7. a tattooed enforcer with a baseball bat over the shoulder and a gold chain
8. a counterfeiter with a jeweler's loupe holding freshly printed bills
9. a mechanic in oil-stained overalls holding a giant wrench
10. a pool-hall shark with a cue stick and a toothpick
11. a jet-ski courier in a wetsuit with a waterproof cash bag
12. a silver-haired crime boss in a pinstripe suit with a gold cane and a fedora (ideal para Lendário)

### E2 · Gangster parado (loop)

MOTION
```
The toy figure bobs gently on its pedestal, blinks and does a small signature gesture, the pedestal rotates a few degrees left and right, the rarity glow pulses softly, camera static, seamless loop
```

Lendário: acrescente `gold coins slowly orbit around the figure` no final.

### E3 · Gangster farmando (card do dashboard) · 1:1

IMAGEM
```
Collectible vinyl toy figure of [ARCHETYPE] sitting at a tiny desk counting a stack of cash, a small pile of gold coins growing next to the figure, desk lamp casting warm light, [MATERIAL], plain very dark violet background, stylized 3D render, soft studio lighting, sharp focus, no text, no logos
```

MOTION
```
The figure counts bills quickly and stamps them into a stack, gold coins pop out one by one and land on the growing pile with small sparkles, the desk lamp flickers, camera static, seamless loop
```

---

## F. Dacity Coin e cofre

### F1 · Moeda (frente e verso) · 1:1 · fundo preto

Frente
```
Front view of a thick gold coin, the face embossed with a stylized palm tree in front of a setting sun with horizontal stripes and a bold geometric letter D monogram, ridged edge with a thin hot pink neon rim glow, polished gold with subtle scratches, centered, perfectly round, on a pure solid black background, stylized 3D render, studio lighting, sharp focus
```

Verso
```
Back view of a thick gold coin, the face embossed with a small crown above two crossed palm leaves, ridged edge with a thin hot pink neon rim glow, polished gold with subtle scratches, centered, perfectly round, on a pure solid black background, stylized 3D render, studio lighting, sharp focus, no text
```

Se o "D" sair torto, gere sem a letra e coloque no Figma.

### F2 · Moeda girando

Vídeo de IA costuma deformar moeda em rotação. Melhor: frente + verso do F1 com `transform: rotateY()` no CSS. Se quiser tentar em vídeo:

MOTION
```
The coin spins smoothly around its vertical axis at constant speed, light glints sweep across the gold, the pink rim glow stays steady, camera static, black background, seamless loop
```

### F3 · Explosão de moedas (botão Claim) · 16:9 · fundo preto

IMAGEM
```
Burst of shiny gold coins with thin pink neon rims exploding from the center toward the camera, sparkles and light streaks, on a pure solid black background, stylized 3D render, motion blur, no text
```

MOTION
```
Gold coins burst outward from the center toward the camera, then rain down spinning and sparkling, light streaks fade out, the background stays pure black
```

### F4 · Depósito no cofre (USDC → DACITY) · 16:9

O logo do USDC é marca da Circle: não gere com IA. Se quiser mostrar, coloque o logo oficial por cima no HTML.

IMAGEM
```
Round steel bank vault door wide open with pink and cyan neon light strips, inside a glowing coin machine with brass pipes and gears, a single glowing blue digital token hovering at the entrance, stacks of gold coins inside the vault, very dark violet background, stylized 3D render, cinematic lighting, no text, no logos
```

MOTION
```
The blue glowing token drops into the coin machine, gears turn and lights flash, the machine pulses, then a stream of gold coins pours out toward the camera, slow camera push-in
```

---

## G. Extra

### G1 · Moldura de carta NFT por raridade · 2:3

Troque `[COLOR]` por: silver grey / emerald green / electric blue / violet purple / radiant gold.

IMAGEM
```
Ornate trading card frame, art deco border with palm leaf ornaments, [COLOR] neon glow lines along the edges, empty dark center area, very dark violet background, clean vector-like shapes, no text, no numbers
```

---

## Onde salvar

| ID | Arquivo |
|---|---|
| A1 / A2 | `web/public/video/hero-desktop.mp4`, `hero-mobile.mp4` (+ `.jpg` poster) |
| A4 | `web/public/fx/halo.mp4` |
| A5 | `web/public/video/loading.mp4` |
| B1 / B2 | `web/public/characters/nina.webp`, `rico.webp` (o site já procura esses dois) |
| B3 / B4 | `web/public/characters/nina-idle.mp4`, `rico-idle.mp4` |
| B5 | `web/public/characters/nina-select.mp4`, `rico-select.mp4` |
| D | `web/public/box/idle.mp4`, `shake.mp4`, `open-0.mp4` … `open-4.mp4` (0 = Comum, 4 = Lendário) |
| E | `web/public/gangsters/<arquetipo>-<raridade>.webp` |
| F | `web/public/coin/front.webp`, `back.webp`, `burst.mp4`, `vault.mp4` |

## Pós-processamento (ffmpeg)

```bash
# Vídeo leve para web: sem áudio, começa a tocar rápido
ffmpeg -i in.mp4 -vf "scale=1920:-2" -c:v libx264 -crf 26 -preset slow -pix_fmt yuv420p -an -movflags +faststart out.mp4

# Loop vai-e-volta (bom para idle e cenário parado; ruim se tiver carro andando)
ffmpeg -i in.mp4 -filter_complex "[0:v]split[a][b];[b]reverse[r];[a][r]concat=n=2:v=1:a=0" -an pingpong.mp4

# Poster (primeiro quadro) para mostrar enquanto o vídeo carrega
ffmpeg -i out.mp4 -frames:v 1 -q:v 3 poster.jpg

# PNG para WebP
ffmpeg -i nina.png -c:v libwebp -quality 85 nina.webp
```

No HTML, vídeo de fundo precisa de `autoplay muted loop playsinline` para tocar sozinho no celular.
