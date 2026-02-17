<script setup lang="ts">
import { defaultOptions, options } from '#imports'

const dialog = ref<HTMLDialogElement>()

const decoderMethods = [
  { value: 'stringArray', label: 'String Array Length (Suitable for most scenarios)' },
  { value: 'callCount', label: 'Decoder Call Count (Ensure sufficient call count)' },
  { value: 'evalCode', label: 'Inject Custom Decryption Code (Need manual extraction)' },
] as const

const isEvalCode = computed(
  () => options.value.decoderLocationMethod === 'evalCode',
)
const isCallCount = computed(
  () => options.value.decoderLocationMethod === 'callCount',
)

const mangleModes = [
  { value: 'off', label: 'Off' },
  { value: 'hex', label: 'Hex (_0x)' },
  { value: 'short', label: 'Short Variable Name' },
  { value: 'all', label: 'All Variables' },
  { value: 'custom', label: 'Custom Regex' },
] as const

const isCustomMangle = computed(() => options.value.mangleMode === 'custom')

const keywordsStr = computed({
  get: () => options.value.keywords.join(', '),
  set: (v: string) => {
    options.value.keywords = v.split(',').map(s => s.trim()).filter(Boolean)
  },
})

function open() {
  dialog.value?.showModal()
}
function close() {
  dialog.value?.close()
}
function resetOptions() {
  const confirmed = window.confirm('Are you sure you want to restore default settings? Modified settings will be reset.')
  if (!confirmed)
    return
  const { setupCode: _discard, ...rest } = defaultOptions
  options.value = { ...rest, setupCode: '' }
}
function handleDialogClick(evt: MouseEvent) {
  if (evt.target === evt.currentTarget)
    close()
}

defineExpose({ open })
</script>

<template>
  <dialog
    ref="dialog"
    class="min-w-96 overflow-visible rounded-xl border border-zinc-200/70 bg-white/95 p-0 shadow-xl backdrop:backdrop-blur-sm dark:border-zinc-800/70 dark:bg-zinc-900/90"
    @click="handleDialogClick"
  >
    <div class="flex items-center justify-between px-5 py-4">
      <div>
        <p class="text-base font-semibold text-zinc-900 dark:text-zinc-50">
          Deobfuscation Configuration
        </p>
        <p class="text-xs text-zinc-500 dark:text-zinc-400">
          Keep it lightweight, only expose core options.
        </p>
      </div>
      <div class="flex items-center gap-2">
        <button
          class="inline-flex items-center gap-1 rounded-lg border border-amber-200/80 bg-amber-50/80 px-3 py-1 text-xs font-semibold text-amber-800 shadow-sm transition hover:border-amber-400 hover:bg-amber-100 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100"
          title="Restore Default Configuration"
          @click="resetOptions"
        >
          <div class="i-ri:refresh-line" />
          Reset
        </button>
        <button class="i-ri:close-line text-lg text-zinc-500 hover:text-zinc-800 dark:text-zinc-300" @click="close" />
      </div>
    </div>
    <hr class="border-zinc-200 dark:border-zinc-800">
    <div class="space-y-4 px-5 py-4 text-sm text-zinc-800 dark:text-zinc-100">
      <div class="space-y-2">
        <label class="flex flex-col gap-1">
          <div class="flex items-center gap-2">
            <span class="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Decoder Location Method</span>
          </div>
          <select
            v-model="options.decoderLocationMethod"
            class="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-amber-400 dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option v-for="method in decoderMethods" :key="method.value" :value="method.value">
              {{ method.label }}
            </option>
          </select>
        </label>

        <div v-if="isCallCount" class="flex items-center justify-between gap-3 rounded-lg bg-amber-50/70 px-3 py-2 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-100">
          <span>Call Count</span>
          <input
            v-model.number="options.decoderCallCount"
            class="w-24 rounded border border-amber-200 bg-white px-2 py-1 text-right focus:outline-none focus:ring-1 focus:ring-amber-400 dark:border-amber-500/40 dark:bg-zinc-900"
            type="number"
            min="1"
            step="1"
          >
        </div>

        <div v-if="isEvalCode" class="space-y-2 rounded-lg bg-amber-50/70 px-3 py-3 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-100">
          <label class="flex items-center justify-between gap-3">
            <span>Specify Decoder (Function Name)</span>
            <input
              v-model="options.decoderNames"
              class="w-48 rounded border border-amber-200 bg-white px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-amber-400 dark:border-amber-500/40 dark:bg-zinc-900"
              type="text"
              placeholder="e.g. _0xabc123"
            >
          </label>
          <label class="flex flex-col gap-1">
            <span class="text-[11px] text-zinc-600 dark:text-zinc-300">Inject Execution Code</span>
            <textarea
              v-model="options.setupCode"
              class="min-h-28 rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm leading-relaxed focus:outline-none focus:ring-1 focus:ring-amber-400 dark:border-amber-500/40 dark:bg-zinc-900"
              placeholder="// Code to be injected before execution"
            />
          </label>
        </div>
      </div>

      <div class="space-y-2 rounded-lg border border-zinc-200/80 bg-white/80 px-3 py-3 shadow-sm dark:border-zinc-800/70 dark:bg-zinc-900/70">
        <div class="flex items-center gap-2">
          <label class="flex cursor-pointer items-center gap-2">
            <input
              v-model="options.isMarkEnable"
              type="checkbox"
              class="h-4 w-4 rounded border-zinc-300 text-amber-500 focus:ring-amber-400 dark:border-zinc-600 dark:bg-zinc-800"
            >
            <span class="text-sm font-medium">Enable Keyword Marking</span>
          </label>
          <Tooltip text="Highlight specific keywords in deobfuscated code for quick location of key logic (e.g. sign, token), separated by commas">
            <span class="i-ri:question-line h-4 w-4 cursor-help text-zinc-400" />
          </Tooltip>
        </div>
        <div v-if="options.isMarkEnable" class="space-y-1">
          <label class="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-300">
            <span>Keyword List</span>
          </label>
          <input
            v-model="keywordsStr"
            type="text"
            class="w-full rounded border border-zinc-200 bg-white px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-amber-400 dark:border-zinc-700 dark:bg-zinc-900"
            placeholder="debugger, sign, token"
          >
        </div>
      </div>

      <div class="space-y-2 rounded-lg border border-zinc-200/80 bg-white/80 px-3 py-3 shadow-sm dark:border-zinc-800/70 dark:bg-zinc-900/70">
        <div class="flex items-center justify-between gap-3">
          <span class="text-sm font-medium">Variable Name Optimization (mangle)</span>
          <select
            v-model="options.mangleMode"
            class="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-amber-400 dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option v-for="mode in mangleModes" :key="mode.value" :value="mode.value">
              {{ mode.label }}
            </option>
          </select>
        </div>
        <div v-if="isCustomMangle" class="space-y-2 text-xs text-zinc-600 dark:text-zinc-300">
          <label class="flex items-center gap-2">
            <span class="whitespace-nowrap">Regex</span>
            <input
              v-model="options.manglePattern"
              class="flex-1 rounded border border-zinc-200 bg-white px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-amber-400 dark:border-zinc-700 dark:bg-zinc-900"
              placeholder="e.g. _0x[a-f\\d]+"
            >
          </label>
          <label class="flex items-center gap-2">
            <span class="whitespace-nowrap">Flags</span>
            <input
              v-model="options.mangleFlags"
              class="flex-1 rounded border border-zinc-200 bg-white px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-amber-400 dark:border-zinc-700 dark:bg-zinc-900"
              placeholder="e.g. gim"
            >
          </label>
        </div>
      </div>
    </div>
  </dialog>
</template>
