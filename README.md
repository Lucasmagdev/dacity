# Audacity Game

On-chain game on **Robinhood Chain** (Arbitrum Orbit L2, ETH for gas).

- Players connect a wallet, pick a boss (Nina Solano or Rico Tavares) and found their gang.
- They deposit USDC into the `DacityVault` contract and receive **Dacity Coin (DACITY)**: `1 USDC = 100 DACITY`.
- They spend DACITY on **Gangster Boxes** (1,000 DACITY each). Each box reveals a gangster NFT from one of 5 rarities.
- Each gangster **farms DACITY daily** until it reaches its rarity's career cap.

```
contracts/   Solidity + Hardhat (DacityCoin, DacityVault, DacityGang, MockUSDC)
web/         Landing page + character select (Vite, React, wagmi, RainbowKit)
```

## Networks

| Network | Chain ID | Public RPC | Explorer |
|---|---|---|---|
| Robinhood Chain | 4663 | https://rpc.mainnet.chain.robinhood.com | https://robinhoodchain.blockscout.com |
| Robinhood Chain Testnet | 46630 | https://rpc.testnet.chain.robinhood.com | https://explorer.testnet.chain.robinhood.com |

Public RPCs are rate-limited. Use a provider (Alchemy, Chainstack, QuickNode...) in production.

## Contracts

| Contract | Role |
|---|---|
| `DacityCoin` | ERC-20 (+permit). Only `MINTER_ROLE` holders can mint: the vault and the gang contract. |
| `DacityVault` | `deposit(usdc)` / `depositWithPermit(...)` → mints `usdc * 100` DACITY. Owner can withdraw the treasury. |
| `DacityGang` | `createGang`, `buyBoxes`, `openBox`, `claim`. Gangsters are ERC-721. |
| `MockUSDC` | Fake USDC with `faucet()` for testnet/local. **Never on mainnet.** |

Default rarities (owner-configurable; changes only apply to newly minted gangsters):

| Rarity | Chance | DACITY/day | Cap |
|---|---|---|---|
| Common | 60% | 10 | 1,200 |
| Uncommon | 25% | 14 | 1,600 |
| Rare | 10% | 20 | 2,200 |
| Epic | 4% | 30 | 3,200 |
| Legendary | 1% | 50 | 5,000 |

```bash
cd contracts
npm install
npm test                       # run the suite
cp .env.example .env           # PRIVATE_KEY, USDC_ADDRESS (required on mainnet)
npm run deploy:testnet         # no USDC_ADDRESS → deploys MockUSDC
```

> **Windows:** run Hardhat from `C:\...` (uppercase drive letter). The VS Code terminal sometimes opens in `c:\...`, which makes Node load `chai` twice and breaks the matchers (`Invalid Chai property: revertedWithCustomError`). `cd C:\Users\...\contracts` before `npm test`.
>
> Don't upgrade the contracts package to TypeScript 7: Hardhat 2's `ts-node` only works with TS 5.x.

The deploy script writes addresses to `contracts/deployments/<chainId>.json` **and** `web/src/contracts/deployments.json`, so the frontend picks them up automatically.

### Local (no gas)

```bash
cd contracts && npx hardhat node                 # terminal 1
cd contracts && npm run deploy:local             # terminal 2
cd web && VITE_NETWORK=local npm run dev         # terminal 3 (MetaMask on 127.0.0.1:8545, chain 31337)
```

## Web

```bash
cd web
npm install
cp .env.example .env    # VITE_NETWORK=testnet|mainnet|local, VITE_WALLETCONNECT_PROJECT_ID
npm run dev             # http://localhost:5317
```

Protagonist art: drop `web/public/characters/nina.webp` and `rico.webp` (4:5 portrait). Without them a placeholder neon silhouette is shown.

## Handoff: o que já está feito e por onde continuar

Resumo para o próximo dev. Tudo roda local com `npm run dev` em `web/`; os contratos têm testes em `contracts/test`.

### Frontend (`web/src`)

| Arquivo | O que faz | Estado |
|---|---|---|
| `App.tsx` | Roteamento por hash: `/` landing, `#/choose` escolha do chefe, `#/hq` QG. Monta o `Loader` por cima na primeira carga. | ok |
| `components/Loader.tsx` + `loader.css` | Tela de loading: monograma "AG" com gradiente pôr do sol, "audacity game" em branco por cima, barra fina de progresso. Espera fontes + `window.load` (mínimo 3s, teto 7s) e sai com fade. | ok |
| `components/Landing.tsx`, `Scene.tsx`, `Nav.tsx`, `Countdown.tsx`, `ConnectCTA.tsx` | Landing com cena (cidade/palmeiras em SVG), contagem para `VITE_SEASON_START`, botão de conectar carteira (RainbowKit). | ok |
| `components/CharacterSelect.tsx`, `Portrait.tsx` | Escolha do chefe (Nina / Rico). Sem arte em `public/characters/` mostra silhueta. | ok, falta arte |
| `components/BoxReveal.tsx` | Animação de abrir caixa (tremida → explosão na cor da raridade → cartas). Hoje usa roll **mock**; trocar `open` pela chamada `openBox` do contrato. | mock |
| `components/Hq.tsx` | QG da gangue. Ideias do pós-loop principal, só placeholders. | rascunho |
| `components/art/*` | Arte provisória em SVG (gangster chibi, moeda, caixa) até existirem os renders em `public/gangsters/`. | mock |
| `components/MusicPlayer.tsx` | Música em loop com botão flutuante, toca após a primeira interação. **Não está montado no `App.tsx` no momento**; para ativar, renderize `<MusicPlayer />` dentro do `App`. | pronto, desligado |
| `config/game.ts` | Raridades, preços e textos do jogo no front (manter em sincronia com o contrato). | ok |

**Loader, dicas rápidas**
- `http://localhost:5317/?hold` segura o loader na tela (só em dev) para ajustar visual.
- Texto: `LINES` em `Loader.tsx`. Tamanho: `.loader__word { font-size }` em `loader.css`.
- Capa de fundo opcional: salve uma arte **própria** em `web/public/loader-cover.webp`; ela surge do escuro. O arquivo está no `.gitignore`, cada um usa o seu local.

### Contratos (`contracts/`)
`DacityCoin`, `DacityVault`, `DacityGang`, `MockUSDC` — ver tabela acima. Deploy escreve os endereços direto em `web/src/contracts/deployments.json`.

### Próximos passos sugeridos
1. Ligar `BoxReveal` e o resto do front às chamadas reais do `DacityGang` (`buyBoxes`, `openBox`, `claim`).
2. Arte final: retratos dos chefes, renders dos gangsters e capa do loader (prompts em `art/leonardo-prompts.md`).
3. Decidir se o `MusicPlayer` volta para o `App.tsx`.
4. Tela do QG (`Hq.tsx`) de verdade.
5. Itens da seção abaixo antes de qualquer dinheiro real.

> **Arte/IP:** não usar nada da Rockstar/GTA (logo, personagens, artes oficiais, o emblema "VI"). Jogo com token é alvo fácil de takedown. Detalhes em `art/leonardo-prompts.md`.

## Before real money

- **Official USDC address** on Robinhood Chain (take it from Robinhood's official token contracts list).
- **Randomness**: currently commit-reveal on a future `blockhash`. Robinhood operates the Robinhood Chain sequencer, so whoever controls it could influence rolls. Switch to a VRF before launch.
- **Economy**: an average box farms ~1,518 DACITY in total and costs 1,000. Since there is no DACITY→USDC withdrawal, this can't drain the vault. If cash-out is ever added, emissions must be capped against the treasury.
- **Legal**: paid loot boxes and a USDC-pegged currency may be regulated (in Brazil, the ECA Digital law restricts loot boxes for minors). Check with a lawyer.
- **Audit** the contracts.
- Put contract ownership in a multisig (Safe).
