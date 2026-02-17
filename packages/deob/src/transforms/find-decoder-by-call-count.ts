import type * as t from '@babel/types'
import * as parser from '@babel/parser'
import traverse from '@babel/traverse'
import { generate, deobLogger as logger } from '../ast-utils'
import { Decoder } from '../deobfuscate/decoder'

/**
 * Find decoders based on decoder call count
 *
 * ## Location Principle
 * Decoder functions in obfuscated code are usually called frequently because every encrypted string needs to be decrypted by the decoder.
 * Example: _0x4b57('0x1'), _0x4b57('0x2'), _0x4b57('0x3')...
 * This high-frequency calling characteristic can be used to identify decoder functions.
 *
 * ## Matching Conditions
 * 1. Must be a top-level FunctionDeclaration (directly under Program)
 * 2. Function reference count >= count (default 100)
 *
 * ## Matching Example
 * ```javascript
 * // If this top-level function is called more than 100 times, it will be identified as a decoder
 * function _0x4b57(x) {
 *   return stringArray[x];
 * }
 *
 * // Massive calls
 * console.log(_0x4b57('0x1'));  // Reference 1
 * console.log(_0x4b57('0x2'));  // Reference 2
 * // ... more calls
 * ```
 *
 * ## Return Value
 * - setupCode: All code from the beginning of the program to the position of the last decoder function (including string array, rotator function, decoder, etc.)
 * - decoders: All found decoders
 *
 * @param ast AST syntax tree
 * @param count Minimum call count threshold for decoder function, default 100
 * @returns Object containing setupCode and decoders
 */
export function findDecoderByCallCount(ast: t.File, count = 100) {
  let index = 0

  const decoders: Decoder[] = []

  traverse(ast, {
    /**
     * Traverse all function declarations to find frequently called functions
     *
     * Only check top-level function declarations because decoders are usually defined in the global scope
     * Get the number of times the function is referenced via binding.referencePaths.length
     */
    FunctionDeclaration(path) {
      // Only process top-level functions (function declarations directly under Program)
      if (path.parentPath.isProgram()) {
        const fnName = path.node.id!.name

        // Get binding information of the function name, including all reference paths
        const binding = path.scope.getBinding(fnName)

        if (!binding) return

        if (binding.referencePaths.length >= count) {
          logger(`Found decoder by call count: ${fnName} (called ${binding.referencePaths.length} times)`)
          decoders.push(new Decoder(fnName, fnName, path))

          const body = (path.parentPath!.scope.block as t.Program).body

          for (let i = 0; i < body.length; i++) {
            const statement = body[i]
            if (statement.start === path.node.start) {
              index = i + 1
            }
          }
        }
      }
    },
  })

  const generateOptions = {
    compact: true,
    shouldPrintComment: () => false,
  }

  const newAst = parser.parse('')
  newAst.program.body = ast.program.body.slice(0, index)
  const setupCode = generate(newAst, generateOptions)

  if (!decoders.length)
    logger(`No decoder found with call count >= ${count}`)
  else
    logger(`Decoder list: ${decoders.map(d => d.name).join(', ')}`)

  return {
    setupCode,
    decoders,
  }
}
