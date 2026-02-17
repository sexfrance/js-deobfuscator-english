import type { NodePath } from '@babel/traverse'
import type { Transform } from '../ast-utils'
import * as t from '@babel/types'
import { getPropName } from '../ast-utils'

/**
 * Control flow flattening
 * @example
 * function a() {
 *   var _0x263cfa = "1|3|2|0"["split"]("|"),
 *   _0x105b9b = 0;
 *
 *   while (true) {
 *      switch (_0x263cfa[_0x105b9b++]) {
 *        case "0":
 *          return _0x4b70fb;
 *
 *        case "1":
 *          if (_0x3d66ff !== "link" && _0x3d66ff !== "script") {
 *            return;
 *          }
 *          continue;
 *
 *        case "2":
 *          _0x4b70fb["charset"] = "utf-8";
 *          continue;
 *
 *        case "3":
 *          var _0x4b70fb = document["createElement"](_0x3d66ff);
 *          continue;
 *    }
 *    break;
 *   }
 * }
 * ⬇️
 * function a(){
 *   if (_0x3d66ff !== "link" && _0x3d66ff !== "script") {
 *     return;
 *   }
 *   var _0x4b70fb = document["createElement"](_0x3d66ff);
 *   _0x4b70fb["charset"] = "utf-8";
 *   return _0x4b70fb;
 * }
 */
export default {
  name: 'controlFlowSwitch',
  tags: ['unsafe'],
  visitor() {
    return {
      SwitchStatement(path) {
        // Determine if parent node is a loop node
        const forOrWhileStatementPath = path.findParent(p => p.isForStatement() || p.isWhileStatement())

        if (!forOrWhileStatementPath) return

        // Get block statement of function
        const fnBlockStatementPath = forOrWhileStatementPath.findParent(p => p.isBlockStatement()) as unknown as NodePath<t.BlockStatement>
        if (!fnBlockStatementPath) return

        let shufferArr: string[] = []

        // Traverse whole function BlockStatement to find "1|3|2|0"["split"]
        fnBlockStatementPath.traverse({
          MemberExpression(path) {
            const { object, property } = path.node
            const propertyName = getPropName(property)
            if (
              (t.isStringLiteral(property)
                || t.isIdentifier(property))
              && propertyName === 'split'
            ) {
              if (t.isStringLiteral(object)) {
                const shufferString = object.value // "1|3|2|0"
                shufferArr = shufferString.split('|')

                // Also remove var _0x263cfa = "1|3|2|0"["split"]("|"),
                const VariableDeclarator = path.findParent(p => p.isVariableDeclarator())

                if (VariableDeclarator)
                  VariableDeclarator.remove()

                path.stop()
              }
            }
          },
        })

        if (shufferArr.length === 0)
          return

        const myArr = path.node.cases
          .filter(p => p.test?.type === 'StringLiteral')
          .map(p => p.consequent[0])

        const sequences = shufferArr
          .map(s => myArr[Number(s)])
          .filter(s => s?.type !== 'ContinueStatement') // If case statement only has continue, skip

        fnBlockStatementPath.node.body.push(...sequences)

        const parentPath = path.parentPath?.parentPath
        if (!parentPath) return

        // Remove the entire loop body
        if (['WhileStatement', 'ForStatement'].includes(parentPath.type))
          parentPath.remove()
      },
    }
  },
} satisfies Transform
