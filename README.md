# Kagi Translate → Anki

A Tampermonkey userscript that turns a [Kagi Translate](https://translate.kagi.com) dictionary
entry into an Anki note, via the [AnkiConnect](https://git.sr.ht/~foosoft/anki-connect) HTTP API
on `127.0.0.1:8765`.

The script adds a **加入 Anki** button right next to the site's own *Anki* button. Clicking it reads
the word, pronunciation, definitions, synonyms, examples, notes and etymology from the current
dictionary page and creates a new note.

Built by OpenCode + DeepSeek Flash V4.1.

## Compared with Kagi Translate's Built-in Anki Feature

Kagi Translate has its own **Anki** button. This userscript builds a card tuned for recall rather
than a plain export:

- **Examples on the front** — context that makes the meaning easier to recall before you flip.
- **Etymology at the top of the back** — word origins are a strong memory hook.
- **Part of speech before each definition** — `noun` / `adjective`, shown dimmed.
- **Synonyms under each definition** — shown dimmed beneath the meaning.
- **Target word highlighted** — bold and underlined in every example sentence.
- **Chinese translation on its own line, dimmed** — the English example stays prominent and the
  Chinese doesn't distract.

|       | Built-in Anki                      | This Script                 |
|-------|------------------------------------|-----------------------------|
| Front | ![](./screenshot/origin-front.png) | ![](./screenshot/front.png) |
| Back  | ![](./screenshot/origin-back.png)  | ![](./screenshot/back.png)  |

## Requirements

- Anki (desktop) with **AnkiConnect** enabled and listening on `127.0.0.1:8765`.
- A userscript manager — [Tampermonkey](https://www.tampermonkey.net/).

## Installation

### 1. AnkiConnect

- In Anki, go to `Tools → Add-ons → Get Add-ons` and enter code `2055492159`, then restart Anki.
- Go to `Tools → Add-ons → AnkiConnect → Config` and add this site to webCorsOriginList:

```json
"webCorsOriginList": [
  "http://localhost",
  "https://translate.kagi.com"
]
```
- Close and reopen Anki for the changes to take effect.

### 2. Userscript

1. Install Tampermonkey.
2. Open [`kagi-anki.user.js`](kagi-anki.user.js) — Tampermonkey should offer to install it — or create
   a new script in the Tampermonkey dashboard and paste its contents in.

## Configuration

Settings are stored by the userscript manager (Tampermonkey) as script values:

| Key        | Default                  | Meaning                                             |
| ---------- | ------------------------ | --------------------------------------------------- |
| `endpoint` | `http://127.0.0.1:8765`  | AnkiConnect URL                                     |
| `apikey`   | *(empty)*                | AnkiConnect `apiKey`, if you have one configured   |
| `deck`     | *(empty)*                | Remembered deck name                                |
| `model`    | `Kagi Dictionary`        | Remembered note type                                |
| `tags`     | `kagi-translate`         | Comma-separated tags to add to new notes            |

Change `deck` / `model` from the picker; other values can be edited in the Tampermonkey dashboard
(*Settings* / script storage).

## Licensing & attribution

**`kagi-anki.user.js` and this README** are released into the public domain under the
[Unlicense](LICENSE). The script contains no AnkiConnect code; it only talks to
AnkiConnect's public HTTP/JSON API at runtime.

## Disclaimer

This project is not affiliated with, endorsed by, or sponsored by Kagi or the AnkiConnect authors.
Kagi Translate, Anki and AnkiConnect are the property of their respective owners.
