# Outlier

A free daily word game. Each round gives you seven prompts and 25 seconds per prompt. Name something correct that few people would think of: obvious answers barely leave the launch pad, rare ones carry your rocket toward the Moon.

**Play:** https://claude.ai/artifact/81AB3qdr3uYPWTEt7Aevq9

## How it plays

- **Scoring:** Common +1, Uncommon +4, Rare +7, Long shot +10. A perfect 70 lands on the Moon.
- **Retries:** if an answer isn't in the list, try again. The clock keeps running.
- **Typos:** small typos, plurals and common alternate names are accepted.
- **Rounds:** each round mixes 3 constraint prompts ("…with the letter K in its name"), 2 twist prompts ("Name something that comes in pairs") and 2 classic categories.
- **Daily launch:** everyone gets the same prompts each day. Prompts are dealt like a shuffled deck, so they rarely repeat.
- **Free play:** unlimited free flights, past launches, and themed packs. No paywall.
- **Player data:** when hosted as a Claude artifact, rarity switches to real player answers once a prompt has 15 of them.

## Files

| File | What it is |
| --- | --- |
| `outlier.html` | The whole game: prompts, matching, scoring, rendering. |
| `opendata.js` | Extra answers and rarity estimates generated from Wikidata. The game still runs without it, with fewer categories. |
| `tools/build-opendata.mjs` | Rebuilds `opendata.js` from the Wikidata Query Service. |
| `tools/test-prompts.cjs` | Checks the prompt bank, answer matching and a year of daily picks. |

## Running it locally

Open `outlier.html` in a browser. Keep `opendata.js` in the same folder.

Stats and streaks are stored in the browser's local storage. The shared player-data feature only works when the page runs as a Claude artifact; elsewhere the game uses its built-in rarity ratings.

## Updating the data

Requires Node.js 18 or later.

```bash
node tools/build-opendata.mjs
node tools/test-prompts.cjs
```

The import script keeps the previous data for any category whose Wikidata query times out.

## Credits

- Extra answers come from [Wikidata](https://www.wikidata.org), available under [CC0](https://creativecommons.org/publicdomain/zero/1.0/).
- Rarity for imported answers is estimated from how many language editions of Wikipedia cover each item.
- Inspired by the rare-answer word game genre. Outlier's theme, prompts, answer lists and code are its own.
