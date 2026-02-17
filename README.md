<div align="center">
  <img src="https://img.kuizuo.me/js-deobfuscator.png" alt="JS Deobfuscator Logo" width="800" />

  <h1>JS Deobfuscator</h1>

  <p>
    🚀 <b>Babel AST</b> based fully automated JavaScript deobfuscator to help you efficiently restore various obfuscated codes.
  </p>
  <a href="https://js-deobfuscator-english.vercel.app/" style="display:inline-block;margin-top:8px;">
    <b>💻 Experience Playground Now →</b>
  </a>
</div>

## Features

| Feature | Description |
| --- | --- |
| **Decoder Location** | Locate by string array length, decoder call count, or manually inject code/decoder name |
| **String Decryption** | Identify string arrays and rotators, unwrap decoder encapsulation, and replace call sites with plaintext |
| **Control Flow Restoration** | Unwrap control flow flattening, remove dead code/junk instructions, merge object properties and assignments |
| **Code Formatting** | Unminify, beautify, variable renaming (hex/short/custom), optional keyword marking |
| **Self-Defense Cleanup** | Remove self-defending / anti-debug logic, support multi-pass execution for heavy obfuscation |
| **Multi-Form Usage** | CLI, Browser Playground, TypeScript API, and comes with a collection of real-world cases |

## Quick Start

### CLI / Local

```bash
git clone https://github.com/kuizuo/js-deobfuscator
cd js-deobfuscator
pnpm install

# Process single file and write to directory (generate output.js)
pnpm exec deob path/to/input.js -o ./out

# Can also be used via stdin
cat path/to/input.js | pnpm exec deob > output.js
```

Quick experience: Place obfuscated code in `tmp/input.js`, run `pnpm tmp`, result will be output to `tmp/output.js`.

### Programming Interface

```ts
import { readFileSync } from 'node:fs'
import { deob } from 'deob'

const code = readFileSync('input.js', 'utf8')
const { code: outputCode, save } = await deob(code, {
  decoderLocationMethod: 'callCount',
  decoderCallCount: 300,
  mangleMode: 'hex',
})
await save('./out') // Write to out/output.js
```

## Examples and Cases

`example/` contains multiple sets of real obfuscated samples, each subdirectory includes:

- `index.ts`: Config/driver script execution.
- `input.js` / `output.js`: Input, restored result and beautification comparison.
- `setupCode.js`: Custom code injected before running.

## Project Structure

- `packages/deob`: Core AST transformation and CLI (`deob` binary).
- `website`: Nuxt 3 + Monaco online Playground.
- `example`: Real obfuscation cases and demo scripts.
- `tmp`: Simple local quick experience directory.

## Acknowledgements

This project references and is inspired by [j4k0xb/webcrack](https://github.com/j4k0xb/webcrack), and the book [Anti-Crawler AST Principle and Deobfuscation Practice](https://book.douban.com/subject/35575838/).
