import type { NodePath } from '@babel/traverse'
import traverse from '@babel/traverse'
import * as t from '@babel/types'
import { getPropName } from '../ast-utils'

export type Objects = Record<`${string}_${string}`, t.ObjectExpression>

/**
 * Save all objects in the code for subsequent replacement
 * @deprecated This function is deprecated, please use other ways to handle object merger and replacement
 * @example
 * var r = {
 *   "PzXHf": "0|2|4|3|1",
 *   "LeQrV": function (n, t) {
 *     return n(t);
 *   }
 * }
 * r["wPpOS"]: "webgl"
 * ⬇️
 * var r = {
 *   "PzXHf": "0|2|4|3|1",
 *   "LeQrV": function (n, t) {
 *     return n(t);
 *   }
 *   "wPpOS": "webgl"
 * }
 *
 * // Global variable state will save r object
 * globalState.objects = {
 *   r = { ... }
 * }
 */
export function saveObjects(ast: t.Node) {
  const parents: {
    parentPath: NodePath<t.Node>
    objectName: string
  }[] = []

  const objects: Objects = {}

  traverse(ast, {
    VariableDeclaration: {
      exit(path, _state) {
        path.node.declarations.forEach((declaration) => {
          if (declaration.id.type === 'Identifier') {
            const objectName = declaration.id.name
            if (declaration.init?.type === 'ObjectExpression') {
              objects[`${declaration.start}_${objectName}`] = declaration.init

              // Rename variable in the same scope var u = e; ---> var e = e; and remove it at the same time
              const binding = path.scope.getBinding(objectName)
              if (!(binding && binding.path.isVariableDeclarator() && binding.path.get('init')?.isObjectExpression())) return
              if (!binding.constant && binding.constantViolations.length === 0) return

              parents.push({
                parentPath: path.getStatementParent()!.parentPath,
                objectName,
              })
            }
          }
        })
      },
    },

  })

  /**
   * Merge objects. If there is the same key, overwrite it
   * var a = {}
   * a["b"] = 123
   * ⬇️
   * var a = {
   *  "b": 123
   * }
   */
  traverse(ast, {
    AssignmentExpression: {
      exit(path) {
        const { left, right } = path.node
        if (left.type !== 'MemberExpression') return

        if (!t.isLiteral(left.property)) return

        if (!(
          t.isFunctionExpression(right)
          || t.isLiteral(right)
          || t.isIdentifier(right)
          || t.isBinaryExpression(right)
          || t.isObjectExpression(right)
        )) {
          return
        }

        const objectName = (left.object as t.Identifier).name

        // Rename variable in the same scope var u = e; ---> var e = e; and remove it at the same time
        const binding = path.scope.getBinding(objectName)

        // Determine if the original object is var e = {}
        if (!(binding && binding.path.node.type === 'VariableDeclarator' && binding.path.node.init?.type === 'ObjectExpression')) return
        if (!binding.constant && binding.constantViolations.length === 0) return

        // Also determine the member length of object initialization (avoid unnecessary replacement), usually empty {}
        // !!! But the length of the original object will be changed when filling later, a cache may be needed here
        // if (binding.path.node.init.properties.length !== 0)
        //   return

        parents.push({
          parentPath: path.getStatementParent()!.parentPath,
          objectName,
        })

        const start = binding.identifier.start

        let isReplace = false
        try {
          const prop = t.objectProperty(left.property, right)
          if (objects[`${start}_${objectName}`]) {
            const keyIndex = objects[`${start}_${objectName}`].properties.findIndex((p) => {
              if (p.type === 'ObjectProperty') {
                const propName = getPropName(left.property)
                const keyName = getPropName(p.key)

                return propName === keyName
              }
              return false
            })
            if (keyIndex !== -1)
              objects[`${start}_${objectName}`].properties[keyIndex] = prop

            else
              objects[`${start}_${objectName}`].properties.push(prop)

            isReplace = true
          }
        }
        catch (_error: any) {
          throw new Error(`Failed to generate expression ${_error.message}`)
        }

        if (isReplace) {
          if (path.parentPath.type === 'SequenceExpression' || path.parentPath.type === 'ExpressionStatement')
            path.remove() // Remove self assignment statement
        }

        path.skip()
      },
    },
  })

  parents.forEach(({ parentPath, objectName }) => {
    parentPath?.traverse({
      VariableDeclarator(p) {
        const { id, init } = p.node

        if (init && init.type === 'Identifier' && id.type === 'Identifier') {
          if (init.name === objectName) {
            p.scope.rename(id.name, objectName)
            // !!! Re-parsing after removal will cause the start position to change, causing subsequent object replacement to fail, so do not execute reParse before executing replacement
            p.parentPath.remove()
          }
        }
      },
    })
  })

  return objects
}
