<template>
  <div class="min-h-screen bg-canvas">
    <!-- 导航栏 -->
    <nav class="fixed top-0 left-0 right-0 z-50 bg-surface-black bg-opacity-90 backdrop-blur-md">
      <div class="max-w-6xl mx-auto px-lg">
        <div class="flex items-center justify-between h-11">
          <span class="text-body-on-dark font-display text-tagline font-semibold tracking-tight">
            厨艺小课堂
          </span>
          <button @click="$emit('back')" class="btn-secondary-pill text-caption">
            返回
          </button>
        </div>
      </div>
    </nav>

    <main class="pt-11">
      <div class="max-w-6xl mx-auto px-lg py-lg flex flex-col lg:flex-row gap-lg">
        <!-- 侧边目录 -->
        <aside class="lg:w-64 flex-shrink-0">
          <div v-if="loading" class="font-body text-caption text-ink-muted-48 py-lg">加载中...</div>
          <div v-else-if="tipsList.length === 0" class="font-body text-caption text-ink-muted-48 py-lg">
            暂无技巧数据，请在服务器执行：<br/>
            <code class="text-micro-legal">node src/scripts/fetchTips.js</code>
          </div>
          <div v-else class="space-y-lg">
            <div v-for="group in groupedTips" :key="group.name">
              <h3 class="font-body text-caption-strong text-ink-muted-80 mb-sm px-xs">
                {{ group.name }}
              </h3>
              <div class="space-y-xs">
                <button
                  v-for="tip in group.items"
                  :key="tip.slug"
                  @click="selectTip(tip)"
                  :class="[
                    'w-full text-left px-sm py-xs rounded-lg font-body text-caption transition-colors apple-interaction',
                    currentSlug === tip.slug
                      ? 'bg-primary text-white'
                      : 'bg-canvas-parchment text-ink hover:bg-hairline'
                  ]"
                >
                  {{ tip.title }}
                </button>
              </div>
            </div>
          </div>
        </aside>

        <!-- 内容区 -->
        <section class="flex-1 min-w-0">
          <div v-if="!currentSlug" class="text-center py-xxl">
            <svg class="h-16 w-16 text-ink-muted-48 mx-auto mb-lg" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path>
            </svg>
            <p class="font-body text-body text-ink-muted-80">从左侧选择一篇文章开始学习</p>
          </div>

          <div v-else-if="loadingContent" class="text-center py-xxl">
            <div class="animate-spin-slow h-12 w-12 text-primary mx-auto mb-lg">
              <svg fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
            <p class="font-body text-body text-ink-muted-80">正在加载文章...</p>
          </div>

          <article
            v-else
            class="bg-canvas rounded-xl border border-divider-soft p-lg lg:p-xl prose-content"
          >
            <div class="markdown-body" v-html="renderedContent"></div>
          </article>
        </section>
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import axios from 'axios'
import { marked } from 'marked'
import DOMPurify from 'dompurify'

defineEmits(['back'])

const tipsList = ref([])
const loading = ref(false)
const currentSlug = ref('')
const currentContent = ref('')
const loadingContent = ref(false)

// 按分组整理（保持 基础 -> 学习 -> 进阶 顺序）
const GROUP_ORDER = ['基础', '学习', '进阶']
const groupedTips = computed(() => {
  const groups = {}
  for (const tip of tipsList.value) {
    if (!groups[tip.group]) groups[tip.group] = []
    groups[tip.group].push(tip)
  }
  return GROUP_ORDER.filter(name => groups[name]).map(name => ({
    name,
    items: groups[name],
  }))
})

const renderedContent = computed(() => {
  if (!currentContent.value) return ''
  // M5：消毒后再注入 v-html
  return DOMPurify.sanitize(marked.parse(currentContent.value))
})

const fetchTips = async () => {
  try {
    loading.value = true
    const response = await axios.get('/api/tips')
    if (response.data.success) tipsList.value = response.data.data
  } catch (error) {
    console.error('获取技巧列表失败:', error)
  } finally {
    loading.value = false
  }
}

const selectTip = async (tip) => {
  if (currentSlug.value === tip.slug) return
  currentSlug.value = tip.slug
  try {
    loadingContent.value = true
    const response = await axios.get(`/api/tips/${encodeURIComponent(tip.slug)}`)
    if (response.data.success) currentContent.value = response.data.data.content
  } catch (error) {
    console.error('获取技巧文章失败:', error)
    currentContent.value = '# 加载失败\n\n请稍后重试。'
  } finally {
    loadingContent.value = false
  }
}

onMounted(fetchTips)
</script>

<style scoped>
/* markdown 渲染样式（Apple 风格克制排版） */
.markdown-body :deep(h1) {
  @apply font-display text-display-md text-ink mb-lg;
}
.markdown-body :deep(h2) {
  @apply font-display text-tagline text-ink mb-md mt-lg;
}
.markdown-body :deep(h3) {
  @apply font-body text-body-strong text-ink mb-sm mt-md;
}
.markdown-body :deep(p) {
  @apply font-body text-body text-ink mb-md leading-relaxed;
}
.markdown-body :deep(ul),
.markdown-body :deep(ol) {
  @apply mb-md pl-lg space-y-xs;
}
.markdown-body :deep(ul) {
  @apply list-disc;
}
.markdown-body :deep(ol) {
  @apply list-decimal;
}
.markdown-body :deep(li) {
  @apply font-body text-body text-ink leading-relaxed;
}
.markdown-body :deep(strong) {
  @apply font-semibold;
}
.markdown-body :deep(code) {
  @apply bg-canvas-parchment text-ink text-caption px-xs rounded;
}
.markdown-body :deep(pre) {
  @apply bg-canvas-parchment rounded-lg p-md mb-md overflow-x-auto;
}
.markdown-body :deep(pre code) {
  @apply bg-transparent p-0;
}
.markdown-body :deep(blockquote) {
  @apply border-l-4 border-hairline pl-md text-ink-muted-80 mb-md;
}
.markdown-body :deep(table) {
  @apply w-full mb-md text-caption;
}
.markdown-body :deep(th),
.markdown-body :deep(td) {
  @apply border border-hairline px-sm py-xs text-left;
}
.markdown-body :deep(th) {
  @apply bg-canvas-parchment font-semibold;
}
.markdown-body :deep(img) {
  @apply rounded-lg max-w-full my-md;
}
.markdown-body :deep(hr) {
  @apply border-divider-soft my-lg;
}
</style>
