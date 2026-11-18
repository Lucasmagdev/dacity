# $AMMO · kit de lançamento

Arquivos desta pasta e textos prontos para pump.fun, DexScreener, X e Telegram.
Textos em inglês (mesmo tom do site). Troque `[MINT]` pelo endereço do token depois de criar.

## Arquivos

| Arquivo | Uso | Formato |
|---|---|---|
| `ammo-logo-1000.png` | Imagem do token na pump.fun e ícone do DexScreener | 1000×1000, quadrado (as plataformas cortam em círculo) |
| `ammo-logo-512.png` | Mesmo logo, mais leve, se algum formulário reclamar do tamanho | 512×512 |
| `ammo-header-coin-rain-1500x500.png` | Header do DexScreener (e banner da pump.fun, se pedir) | 1500×500, 3:1 |
| `ammo-header-coin-rain-1500x500.jpg` | Mesmo header em JPG, ~200 KB | 1500×500 |

No DexScreener o ícone redondo fica por cima do centro do header e a barra Website/Twitter cobre a faixa de baixo.
O header já foi montado assim: nome e site à esquerda, Gangster Box com as raridades à direita.

## Nome e ticker

- **Nome:** Audacity Ammo
- **Ticker:** AMMO (sem o $ no formulário)

## Descrição pump.fun

```
$AMMO is the utility token of Audacity Game, a gang-farming game on Solana. Open boxes, recruit gangsters, farm every day. Weapons that boost your farm, med kits, vests and fusions are all paid in AMMO. 100% of creator rewards go to the players' Reward Pool.
audacitygame.xyz
```

## Descrição DexScreener

```
Audacity Game is a gang-farming game on Solana. Open Gangster Boxes, recruit gangsters from 5 rarities and farm DC every day, withdrawable as USDC.

$AMMO is the game's utility token. Weapons that boost farming, med kits that heal shot gangsters, kevlar vests, fusions and claim fees are all paid in AMMO. Fixed 1B supply, no mint.

100% of pump.fun creator rewards go to the Reward Pool that pays the players.

Not affiliated with Take-Two Interactive or Rockstar Games.
```

## Links

```
Website: https://audacitygame.xyz
X: https://x.com/audacitygamesol
Telegram: https://t.me/audacitygame
TikTok: https://www.tiktok.com/@audacitygame2026
```

## Perfil do X

Limite da bio: 160 caracteres (emoji conta 2).

**Bio (recomendada, 131 caracteres)**

```
Build your gang. Farm DC. Cash out in USDC. 🌴
Gang-farming game on Solana · $AMMO powers every move.
Season 01 · Nov 18, 11:00 UTC
```

**Bio alternativa: explica o jogo**

```
Open boxes. Recruit gangsters. Farm DC daily, cash out in USDC. 🌴
$AMMO buys the guns, med kits & vests. Solana.
Season 01: Nov 18
```

**Bio alternativa: tom de rua**

```
Run a crew. Farm the streets. Cash out in USDC. 🌴
The Solana crime-farming game. Gear up with $AMMO.
Season 01 drops Nov 18 · 11:00 UTC
```

**Outros campos**

- Nome: `Audacity Game 🌴`
- Site: `audacitygame.xyz`
- Localização: `Solana` (ou `Season 01 · Nov 18`)
- Foto: `ammo-logo-1000.png` (ou a ficha DC, se o perfil for do jogo e não do token)
- Capa do perfil: `ammo-header-coin-rain-1500x500.png`

## Legendas

### Antes do lançamento

```
The streets open Nov 18, 11:00 UTC.
Open a box. Recruit your crew. Farm DC every day. 🌴
audacitygame.xyz
```

```
5 rarities. 3 faces revealed.
Epic and Legendary stay in the shadows until Season 01.
Who's in your crew? 👀
```

```
Every gangster farms DC daily.
DC cashes out in USDC.
That's the whole pitch. Season 01 · Nov 18.
```

### Revelação do logo / header

```
Meet $AMMO. 🔫
The utility token of Audacity Game: guns that boost your farm, med kits, vests and fusions all run on it.
```

```
New look for the streets. 🌴
Box open, crew out, chips raining.
audacitygame.xyz
```

### Dia do lançamento (variações do tweet principal)

```
$AMMO is live. 🔥
Load up your crew: weapons boost the farm, med kits heal your shooters, vests keep them standing.
CA: [MINT]
```

```
Season 01 is open.
Open a box, build your gang, farm DC every day and cash out in USDC.
$AMMO: [MINT]
audacitygame.xyz
```

```
Reminder: only one CA.
$AMMO → [MINT]
Anything else is not us.
```

### Cards de farm diário (o player posta; troque os campos entre chaves)

```
+{daily} DC today. {gangsters} gangsters, zero days off. {gang} is recruiting: {link}
```

```
The Vault paid me again: {daily} DC (≈ ${usd}). Same time tomorrow. {link}
```

```
Day {day}: my boxes already paid for themselves. Broke even on day {roi}. {link}
```

```
Harvest report, day {day}: +{daily} DC picked fresh. 🌴 {link}
```

```
8am and the crew already paid me. {daily} DC claimed. Want in? {link}
```

### Telegram e Discord (curtas)

```
🌴 New here? Start at audacitygame.xyz → connect wallet → open your first box. Your gangsters start farming right away.
```

```
💰 Withdrawals: DC cashes out in USDC, one withdrawal every 24h. 10% stays in the Reward Pool for the players.
```

## Tweet de lançamento

```
$AMMO is live.

The utility token of Audacity Game. Guns that boost your farm, med kits, vests and fusions: all paid in AMMO. 100% of creator rewards go to the players' Reward Pool.

CA: [MINT]
audacitygame.xyz
```

## Mensagem fixada no Telegram

```
🔥 $AMMO IS LIVE 🔥

CA: [MINT]
Buy: pump.fun/coin/[MINT]
Play: audacitygame.xyz

How it works
• Open Gangster Boxes, recruit gangsters, farm DC daily
• Weapons, med kits, vests, fusions: all paid in AMMO
• 1B fixed supply. No mint.
• 100% of creator rewards → Reward Pool

Only trust the CA posted by the team here and on X.
```

## Ordem do lançamento

1. Criar o token na pump.fun: nome, ticker, `ammo-logo-1000.png`, descrição pump.fun e os links (site, X, Telegram). Conferir os links antes: não dá pra editar depois.
2. Colar o mint em `VITE_AMMO_MINT` na Vercel (o topo do site troca o "soon" pelo CA).
3. Postar o tweet e fixar a mensagem no Telegram, com o mesmo CA.
4. Quando o par aparecer no DexScreener, pedir o Enhanced Token Info (pago) com o mint, `ammo-logo-1000.png`, `ammo-header-coin-rain-1500x500.png`, descrição DexScreener e links.
5. Abrir a página do token no celular e conferir header, ícone e links.
