import type { Decoder } from '../deobfuscate/decoder'
import type { Sandbox } from '../deobfuscate/vm'
import * as t from '@babel/types'
import { deobLogger as logger } from '../ast-utils'
import { evalCode } from '../deobfuscate/vm'

/**
 * Execute decoder (execute using eval)
 * @param sandbox Sandbox environment for executing decryption code
 * @param decoders List of decoders
 * @example
 * _0x4698(_0x13ee81, _0x3dfa50)
 * ⬇️
 * Original string
 */
export async function decodeStrings(sandbox: Sandbox, decoders: Decoder[]) {
  const map = new Map<string, string>() // Record decryption results
  let failures = 0

  for (const decoder of decoders) {
    const refs = decoder?.path.scope.getBinding(decoder.name)?.referencePaths ?? []
    for (const ref of refs) {
      if (ref?.parentKey === 'callee' && ref.parentPath?.isCallExpression()) {
        const callExpression = ref.parentPath
        try {
          // If there are variable arguments in the decoder function call, do not replace
          const hasIdentifier = callExpression.node.arguments.some(a => t.isIdentifier(a))
          if (hasIdentifier) continue

          const call = callExpression.toString()

          const value = await evalCode(sandbox, call)
          map.set(call, value as string)

          callExpression.replaceWith(t.valueToNode(value))
        }
        catch (error) {
          failures++
          // Add comment if decryption fails
          callExpression.addComment('leading', `decode_error: ${(error as any).message}`, true)
        }
      }
    }
  }

  if (failures)
    logger(`\x1B[31mDecryption failed at ${failures} places, marked decode_error in code\x1B[0m`)

  return map
}
