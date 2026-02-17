import type { NodePath } from '@babel/traverse'
import type * as t from '@babel/types'
import type { Transform } from '../ast-utils'
import type { Decoder } from './decoder'

import { expression } from '@babel/template'
import { generate } from '../ast-utils'

/**
 * Nested function junk code replacement. Need to execute first. Usually nested decoder function
 * @param {number} Nesting depth. For multiple nesting, default is 2
 * @example
 * var _0x49afe4 = function (_0x254ae1, _0x559602, _0x3dfa50, _0x13ee81) {
 *   return _0x4698(_0x13ee81 - -674, _0x3dfa50);
 * };
 * _0x49afe4(-57, 1080, 828, 469)
 * ⬇️
 * _0x4698(469 - -674, 828)
 */
export default {
  name: 'inlineDecoderWrappers',
  tags: ['unsafe'],
  visitor() {
    const processFunction = (path: NodePath<t.FunctionDeclaration | t.FunctionExpression>) => {
      const fnName = path.isFunctionDeclaration()
        ? path.node.id!.name
        : path.parentPath.isVariableDeclarator()
          ? (path.parentPath.node.id as t.Identifier)!.name
          : ''

      // if (decoderNameList.includes(fnName)) return

      const firstStatement = path.get('body').get('body')?.[0] as NodePath<t.ReturnStatement>

      // In the original code, the function body is just one return statement and the argument is also a function expression
      if (firstStatement && firstStatement.isReturnStatement()) {
        // Real call function (decoder function)
        const realFn = firstStatement.get('argument')

        if (!realFn.isCallExpression()) return

        const realFnCallee = realFn.get('callee')
        if (realFnCallee.isIdentifier()) return

        // Wrapper function
        const wrapFn = path

        const binding = path.scope.getBinding(fnName)
        if (!binding) return

        // Traverse _0x49afe4(-57, 1080, 828, 469)
        binding.referencePaths.forEach((ref) => {
          // Find the call to the obfuscated function through reference, need to get the actual passed parameters
          if (ref.parentKey === 'callee' && ref.parentPath?.isCallExpression()) {
            // Call passed parameters -57, 1080, 828, 469
            const callFn_args = ref.parentPath.node.arguments

            // Template to replace
            let templateCode = generate(realFn.node)

            // Record identifiers to be replaced in subsequent templates
            const replaceIdentifiers: Record<string, any> = {}

            // Traverse (_0x254ae1, _0x559602, _0x3dfa50, _0x13ee81)
            wrapFn.node.params.forEach((param, i) => {
              if (param.type !== 'Identifier')
                return

              // If identifier does not exist in template, it is not used
              if (templateCode.includes(param.name)) {
                templateCode = templateCode.replace(new RegExp(`${param.name}`, 'g'), `%%${param.name}%%`)

                // Get passed parameter, e.g. 4th parameter _0x13ee81 corresponds to 469
                const arg = callFn_args[i]
                replaceIdentifiers[param.name] = arg
              }
            })

            const buildCallExpression = expression`${templateCode}`

            const newCallExpression = buildCallExpression(replaceIdentifiers)

            // console.log(templateCode, generate(newCallExpression))

            const callFnName = (realFnCallee.node as t.Identifier).name

            if (callFnName && newCallExpression)
              ref.parentPath.replaceWith(newCallExpression)
          }
        })

        path.skip()
      }
    }

    return {
      FunctionDeclaration(path) {
        return processFunction(path)
      },
      FunctionExpression(path) {
        if (path.parentKey === 'init' && path.parentPath.isVariableDeclarator())
          processFunction(path)
      },
    }
  },
} satisfies Transform<{ decoders: Decoder[] }>
