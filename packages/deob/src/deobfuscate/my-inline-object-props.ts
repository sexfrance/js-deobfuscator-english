import type { Transform } from '../ast-utils'
import type { Objects } from './save-objects'
import generate from '@babel/generator'

import traverse from '@babel/traverse'
// @ts-nocheck
import * as t from '@babel/types'
import { getPropName } from '../ast-utils'

/**
 * Object property replacement. Need to execute saveAllObject first to save all variables
 * @example
 * var r = {
 *   "PzXHf": "0|2|4|3|1",
 *   "LeQrV": function (n, t) {
 *     return n(t);
 *   }
 * }
 *
 * var u = r["PzXHf"]["split"]("|");
 * r["LeQrV"](_0x3028, "foo");
 * ⬇️
 * var u = "0|2|4|3|1"["split"]("|");
 * _0x3028("foo")
 */
export default {
  name: 'Object property reference replacement',
  tags: ['safe'],
  run(ast, state, objects) {
    if (!objects) return

    const usedMap = new Map()
    const usedObjects: Record<any, any> = {}

    /**
     * Literal junk code restoration
     * r["PzXHf"] ---> "0|2|4|3|1"
     */
    traverse(ast, {
      MemberExpression(path) {
        // Parent expression cannot be an assignment statement
        const asignment = path.parentPath
        if (!asignment || asignment?.type === 'AssignmentExpression')
          return

        const { object, property } = path.node
        if (object.type === 'Identifier' && (property.type === 'StringLiteral' || property.type === 'Identifier')) {
          const objectName = object.name

          // Find the definition position of objectName
          const binding = path.scope.getBinding(objectName)
          if (!binding)
            return

          const start = binding.identifier.start

          const propertyName = getPropName(property)

          if (objects[`${start}_${objectName}`]) {
            const objectInit = objects[`${start}_${objectName}`]

            const properties = objectInit.properties
            for (const prop of properties) {
              if (prop.type === 'ObjectProperty') {
                const keyName = getPropName(prop.key)
                if (
                  (prop.key.type === 'StringLiteral'
                    || prop.key.type === 'Identifier')
                  && keyName === propertyName
                  && t.isLiteral(prop.value)
                ) {
                  // Also need to determine if objectName[propertyName] has been modified
                  const binding = path.scope.getBinding(objectName)
                  if (binding && binding.constant && binding.constantViolations.length === 0) {
                    // Do not process some special code such as _0x52627b["QqaUY"]++
                    if (path.parent.type === 'UpdateExpression')
                      return

                    usedMap.set(`${objectName}.${propertyName}`, generate(prop.value))

                    usedObjects[objectName] = usedObjects[objectName] || new Set()
                    usedObjects[objectName].add(propertyName)

                    path.replaceWith(prop.value)
                  }
                }
              }
            }
          }
        }
      },
    })

    /**
     * Function junk code restoration
     * r["LeQrV"](_0x3028, "foo");  --->  _0x3028("foo");
     */
    traverse(ast, {
      CallExpression(path) {
        const { callee } = path.node
        if (callee.type === 'MemberExpression' && callee.object.type === 'Identifier') {
          const objectName = callee.object.name
          const propertyName = getPropName(callee.property)

          // Find the definition position of objectName
          const binding = path.scope.getBinding(objectName)
          if (!binding)
            return

          const start = binding.identifier.start

          if (objects[`${start}_${objectName}`]) {
            const objectInit = objects[`${start}_${objectName}`]

            const properties = objectInit.properties

            // Actual passed parameters
            const argumentList = path.node.arguments

            for (const prop of properties) {
              if (prop.type !== 'ObjectProperty')
                continue

              const keyName = getPropName(prop.key)

              if (
                (prop.key.type === 'StringLiteral'
                  || prop.key.type === 'Identifier')
                && prop.value.type === 'FunctionExpression'
                && keyName === propertyName
              ) {
                // Get definition function
                const orgFn = prop.value

                // In the original code, the function body is just one return statement, extract the argument property and replace the call node
                const firstStatement = orgFn.body.body?.[0]
                if (firstStatement?.type !== 'ReturnStatement') return

                // Return parameter
                const returnArgument = firstStatement.argument

                let isReplace = false
                if (t.isBinaryExpression(returnArgument)) {
                  // _0x5a2810 + _0x2b32f4
                  if (t.isExpression(argumentList[0]) && t.isExpression(argumentList[1])) {
                    const binaryExpression = t.binaryExpression(
                      returnArgument.operator,
                      argumentList[0],
                      argumentList[1],
                    )
                    path.replaceWith(binaryExpression)
                    isReplace = true
                  }
                }
                else if (t.isLogicalExpression(returnArgument)) {
                  // _0x5a2810 || _0x2b32f4
                  if (t.isExpression(argumentList[0]) && t.isExpression(argumentList[1])) {
                    const logicalExpression = t.logicalExpression(
                      returnArgument.operator,
                      argumentList[0],
                      argumentList[1],
                    )
                    path.replaceWith(logicalExpression)
                    isReplace = true
                  }
                }
                else if (t.isUnaryExpression(returnArgument)) {
                  // !_0x5a2810
                  if (t.isExpression(argumentList[0])) {
                    const unaryExpression = t.unaryExpression(
                      returnArgument.operator,
                      argumentList[0],
                    )
                    path.replaceWith(unaryExpression)
                    isReplace = true
                  }
                }
                else if (t.isCallExpression(returnArgument)) {
                  // function (_0x1d0a4d, _0x1df411) {
                  //   return _0x1d0a4d();
                  // }

                  // Extract which parameter is called as the function name. Because multiple parameters may be passed, take one or several of them
                  // Ensure that the called function name must be an identifier before replacement
                  if (returnArgument.callee.type !== 'Identifier')
                    return

                  const callFnName = returnArgument.callee.name // Function name of formal parameter

                  // Find index from multiple passed parameters
                  const callIndex = orgFn.params.findIndex(
                    a => t.isIdentifier(a) && a.name === callFnName,
                  )

                  // Find the real function name from the actual parameters (actual arguments)
                  const realFnName = argumentList.splice(callIndex, 1)[0]
                  if (t.isExpression(realFnName) || t.isV8IntrinsicIdentifier(realFnName)) {
                    const callExpression = t.callExpression(
                      realFnName,
                      argumentList,
                    )
                    path.replaceWith(callExpression)
                    isReplace = true
                  }
                }

                if (isReplace) {
                  usedMap.set(`${objectName}.${propertyName}`, generate(orgFn))

                  usedObjects[objectName] = usedObjects[objectName] || new Set()
                  usedObjects[objectName].add(propertyName)
                }
              }
            }
          }
        }
      },
    })

    const removeSet = new Set()

    /**
     * Remove used property(key)
     * var _0x52627b = {
     *  'QqaUY': "attribute",
     *  SDgrw: "123"
     * }
     * _0x52627b["QqaUY"]
     * 🔽
     * var _0x52627b = {
     *  SDgrw: "123"
     * }
     * "attribute"
     */
    if (Object.keys(usedObjects).length > 0) {
      traverse(ast, {
        ObjectProperty(path) {
          let objectName = ''

          const parentPath = path.parentPath.parentPath

          if (!parentPath) return

          if (parentPath?.isAssignmentExpression())
            objectName = (parentPath.node.left as t.Identifier).name

          else if (parentPath.isVariableDeclarator())
            objectName = (parentPath.node.id as t.Identifier).name

          if (!objectName) return

          const propertyName = getPropName(path.node.key)

          if (usedObjects[objectName]?.has(propertyName)) {
            path.remove()
            removeSet.add(`${objectName}.${propertyName}`)
          }
        },
      })
    }

    if (usedMap.size > 0)
      console.log(`Replaced objects: `, usedMap)

    if (removeSet.size > 0)
      console.log(`Removed key list:`, removeSet)
  },
} satisfies Transform<Objects>
