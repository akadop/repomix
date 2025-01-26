<script setup lang="ts">
import ace, { type Ace } from 'ace-builds';
import themeTomorrowUrl from 'ace-builds/src-noconflict/theme-tomorrow?url';
import themeTomorrowNightUrl from 'ace-builds/src-noconflict/theme-tomorrow_night?url';
import { Copy, Download } from 'lucide-vue-next';
import { useData } from 'vitepress';
import { computed, defineAsyncComponent, onMounted, ref, watch } from 'vue';
import { VAceEditor } from 'vue3-ace-editor';
import type { PackResult } from './api/client.js';
import { copyToClipboard, downloadResult, formatTimestamp, getEditorOptions } from './utils/resultViewer.js';

ace.config.setModuleUrl('ace/theme/tomorrow', themeTomorrowUrl);
ace.config.setModuleUrl('ace/theme/tomorrow_night', themeTomorrowNightUrl);

const lightTheme = 'tomorrow';
const darkTheme = 'tomorrow_night';

const props = defineProps<{
  result: PackResult | null;
  loading: boolean;
  error: string | null;
}>();

const copied = ref(false);
const { isDark } = useData();
const editorInstance = ref<Ace.Editor | null>(null);

const editorOptions = computed(() => ({
  ...getEditorOptions(),
  theme: isDark.value ? `ace/theme/${darkTheme}` : `ace/theme/${lightTheme}`,
}));

// Watch for theme changes and update editor theme
watch(isDark, (newIsDark) => {
  if (editorInstance.value) {
    editorInstance.value.setTheme(newIsDark ? `ace/theme/${darkTheme}` : `ace/theme/${lightTheme}`);
  }
});

const formattedTimestamp = computed(() => {
  if (!props.result) return '';
  return formatTimestamp(props.result.metadata.timestamp);
});

const handleCopy = async (event: Event) => {
  event.preventDefault();
  if (!props.result) return;

  const success = await copyToClipboard(props.result.content, props.result.format);
  if (success) {
    copied.value = true;
    setTimeout(() => {
      copied.value = false;
    }, 2000);
  }
};

const handleDownload = (event: Event) => {
  event.preventDefault();
  if (!props.result) return;

  downloadResult(props.result.content, props.result.format);
};

const handleEditorMount = (editor: Ace.Editor) => {
  editorInstance.value = editor;
};
</script>

<template>
  <div class="result-viewer">
    <div v-if="loading" class="loading">
      <div class="spinner"></div>
      <p>Processing repository...</p>
    </div>

    <div v-else-if="error" class="error">
      <p>{{ error }}</p>
    </div>

    <div v-else-if="result" class="content-wrapper">
      <div class="metadata-panel">
        <div class="metadata-section">
          <h3>Repository Info</h3>
          <dl>
            <dt>Repository</dt>
            <dd>{{ result.metadata.repository }}</dd>
            <dt>Generated At</dt>
            <dd>{{ formattedTimestamp }}</dd>
            <dt>Format</dt>
            <dd>{{ result.format }}</dd>
          </dl>
        </div>

        <div class="metadata-section">
          <h3>Pack Summary</h3>
          <dl v-if="result.metadata.summary">
            <dt>Total Files</dt>
            <dd>{{ result.metadata.summary.totalFiles.toLocaleString() }} files</dd>
            <dt>Total Size</dt>
            <dd>{{ result.metadata.summary.totalCharacters.toLocaleString() }} chars</dd>
            <dt>Total Tokens</dt>
            <dd>{{ result.metadata.summary.totalTokens.toLocaleString() }} tokens</dd>
          </dl>
        </div>

        <div class="metadata-section" v-if="result.metadata.topFiles">
          <h3>Top {{ result.metadata.topFiles.length }} Files</h3>
          <ol class="top-files-list">
            <li v-for="file in result.metadata.topFiles" :key="file.path">
              <div class="file-path">{{ file.path }}</div>
              <div class="file-stats">
                {{ file.charCount.toLocaleString() }} chars
              </div>
            </li>
          </ol>
        </div>
      </div>

      <div class="output-panel">
        <div class="output-actions">
          <button
              class="action-button"
              @click="handleCopy"
              :class="{ copied }"
          >
            <Copy size="16" />
            {{ copied ? 'Copied!' : 'Copy' }}
          </button>
          <button
              class="action-button"
              @click="handleDownload"
          >
            <Download size="16" />
            Download
          </button>
        </div>
        <div class="editor-container">
          <VAceEditor
              v-model:value="result.content"
              :lang="'text'"
              :style="{ height: '100%', width: '100%' }"
              :options="editorOptions"
              @mount="handleEditorMount"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.result-viewer {
  margin-top: 24px;
  border: 1px solid var(--vp-c-border);
  border-radius: 8px;
  overflow: hidden;
}

.loading {
  padding: 48px;
  text-align: center;
}

.spinner {
  width: 40px;
  height: 40px;
  margin: 0 auto 16px;
  border: 3px solid var(--vp-c-brand-1);
  border-radius: 50%;
  border-top-color: transparent;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.error {
  padding: 24px;
  color: var(--vp-c-danger-1);
  text-align: center;
}

.content-wrapper {
  display: grid;
  grid-template-columns: 300px 1fr;
  height: 500px;
}

.metadata-panel {
  padding: 16px;
  border-right: 1px solid var(--vp-c-border);
  background: var(--vp-c-bg-soft);
  overflow-y: auto;
}

.metadata-section {
  margin-bottom: 24px;
}

.metadata-section:last-child {
  margin-bottom: 0;
}

.metadata-section h3 {
  font-size: 14px;
  font-weight: 600;
  margin: 0 0 12px;
  color: var(--vp-c-text-1);
}

dl {
  margin: 0;
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 8px;
  font-size: 13px;
}

dt {
  color: var(--vp-c-text-2);
  font-weight: 500;
}

dd {
  margin: 0;
  color: var(--vp-c-text-1);
  text-transform: lowercase;
}

.top-files-list {
  margin: 0;
  padding: 0 0 0 0;
  font-size: 13px;
}

.top-files-list li {
  margin-bottom: 8px;
  border-left: 2px solid var(--vp-c-divider);
  padding-left: 8px;
}

.file-path {
  color: var(--vp-c-text-1);
  margin-bottom: 2px;
  word-break: break-all;
}

.file-stats {
  font-size: 12px;
  color: var(--vp-c-text-2);
}

.output-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  max-height: 500px;
  background: var(--vp-c-bg);
  overflow: hidden;
}

.output-actions {
  display: flex;
  gap: 8px;
  padding: 12px;
  background: var(--vp-c-bg);
  border-bottom: 1px solid var(--vp-c-border);
  flex-shrink: 0;
}

.action-button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border: 1px solid var(--vp-c-border);
  border-radius: 6px;
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-1);
  cursor: pointer;
  transition: all 0.2s ease;
}

.action-button:hover {
  border-color: var(--vp-c-brand-1);
}

.action-button.copied {
  background: var(--vp-c-brand-1);
  color: white;
  border-color: var(--vp-c-brand-1);
}

.editor-container {
  height: 100%;
  width: 100%;
  font-family: var(--vp-font-family-mono);
}

@media (max-width: 768px) {
  .content-wrapper {
    grid-template-columns: 1fr;
    height: auto;
  }

  .metadata-panel {
    border-right: none;
    border-bottom: 1px solid var(--vp-c-border);
  }

  .output-panel {
    height: 500px;
  }
}
</style>
