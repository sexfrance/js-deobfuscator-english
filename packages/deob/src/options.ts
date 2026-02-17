import type { Sandbox } from './deobfuscate/vm'
import { createBrowserSandbox, createNodeSandbox } from './deobfuscate/vm'
import { isBrowser } from './utils/platform'

export interface Options {
  /** Decoder location method */
  decoderLocationMethod?: 'callCount' | 'stringArray' | 'evalCode'
  /** Decoder call count */
  decoderCallCount?: number
  /** Execute code function */
  setupCode?: string
  /** Specify decoder function */
  decoderNames?: string | string[]

  /** Whether to mark key information */
  isMarkEnable?: boolean
  /** Key identifiers */
  keywords?: string[]
  /** Variable name optimization mode */
  mangleMode?: 'off' | 'all' | 'hex' | 'short' | 'custom'
  /** Custom variable name optimization regex */
  manglePattern?: string
  /** Custom variable name optimization regex flags */
  mangleFlags?: string
  /** Sandbox */
  sandbox?: Sandbox
}

export const defaultOptions: Required<Options> = {
  decoderLocationMethod: 'stringArray',
  decoderCallCount: 150,
  setupCode: '',
  decoderNames: '',

  isMarkEnable: true,
  keywords: ['debugger'],

  mangleMode: 'off',
  manglePattern: '',
  mangleFlags: '',
  sandbox: isBrowser() ? createBrowserSandbox() : createNodeSandbox(),
}

export function mergeOptions(options: Options): asserts options is Required<Options> {
  const mergedOptions: Required<Options> = {
    ...defaultOptions,
    ...options,
  }
  // backward compatibility: boolean mangle -> mode
  if (!options.mangleMode && typeof (options as any).mangle === 'boolean') {
    mergedOptions.mangleMode = (options as any).mangle ? 'all' : 'off'
  }
  Object.assign(options, mergedOptions)
}
