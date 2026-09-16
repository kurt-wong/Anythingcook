<template>
  <transition name="modal">
    <div
      v-if="recipe"
      class="fixed inset-0 z-[70] flex items-center justify-center p-lg"
      @click.self="$emit('close')"
    >
      <div class="absolute inset-0 bg-black/50 backdrop-blur-sm"></div>
      <div class="relative bg-canvas rounded-xl shadow-xl max-w-lg w-full max-h-[85vh] overflow-y-auto">
        <!-- 关闭按钮 -->
        <button
          @click="$emit('close')"
          class="absolute top-sm right-sm z-10 w-8 h-8 rounded-full bg-black/30 flex items-center justify-center text-white hover:bg-black/50 transition-colors"
        >
          <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>

        <!-- 图片 -->
        <div class="h-48 bg-canvas-parchment overflow-hidden rounded-t-xl">
          <img
            :src="imageUrl"
            :alt="recipe.name"
            class="w-full h-full object-cover"
            @error="imgError = true"
          />
        </div>

        <div class="p-lg">
          <!-- 标题与徽章 -->
          <div class="flex items-center gap-sm mb-md flex-wrap">
            <h2 class="font-display text-display-md text-ink">{{ recipe.name }}</h2>
            <span
              class="text-caption font-body px-sm py-xs rounded-full"
              :class="difficultyClass"
            >
              {{ recipe.difficulty }}
            </span>
            <span
              v-if="recipe.category"
              class="text-caption font-body px-sm py-xs rounded-full bg-canvas-parchment text-ink-muted-80"
            >
              {{ recipe.category }}
            </span>
            <span
              v-if="recipe.calories"
              class="text-caption font-body px-sm py-xs rounded-full bg-orange-100 text-orange-800"
            >
              约 {{ recipe.calories }} 大卡
            </span>
          </div>

          <!-- 食材：优先带克数的 ingredients -->
          <div class="mb-lg">
            <h3 class="font-body text-body-strong text-ink mb-sm">食材</h3>
            <div
              v-if="hasAmounts"
              class="grid grid-cols-2 gap-xs"
            >
              <div
                v-for="ing in recipe.ingredients"
                :key="ing.name"
                class="flex justify-between items-center bg-canvas-parchment px-sm py-xs rounded"
              >
                <span class="text-caption text-ink">{{ ing.name }}</span>
                <span class="text-caption text-ink-muted-80 ml-xs whitespace-nowrap">{{ ing.amount }}</span>
              </div>
            </div>
            <div v-else class="flex flex-wrap gap-xs">
              <span
                v-for="item in recipe.stuff"
                :key="item"
                class="text-caption font-body px-sm py-xs rounded-full bg-canvas-parchment text-ink-muted-80"
              >
                {{ item }}
              </span>
            </div>
          </div>

          <!-- 步骤 -->
          <div v-if="recipe.steps && recipe.steps.length > 0" class="mb-lg">
            <h3 class="font-body text-body-strong text-ink mb-sm">做法</h3>
            <ol class="space-y-sm">
              <li
                v-for="(step, index) in recipe.steps"
                :key="index"
                class="flex gap-sm font-body text-body text-ink"
              >
                <span class="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-white text-caption flex items-center justify-center">
                  {{ index + 1 }}
                </span>
                <span class="pt-xs">{{ step }}</span>
              </li>
            </ol>
          </div>
          <div v-else class="mb-lg">
            <p class="font-body text-caption text-ink-muted-48 bg-canvas-parchment rounded-lg p-sm">
              暂无详细做法，可参考 B 站视频教程。
            </p>
          </div>

          <!-- 小贴士 -->
          <div v-if="recipe.tips" class="mb-lg">
            <h3 class="font-body text-body-strong text-ink mb-sm">小贴士</h3>
            <p class="font-body text-caption text-ink-muted-80 bg-canvas-parchment rounded-lg p-sm">
              {{ recipe.tips }}
            </p>
          </div>

          <!-- 工具 -->
          <div v-if="recipe.tools && recipe.tools.length > 0" class="mb-lg">
            <h3 class="font-body text-body-strong text-ink mb-sm">工具</h3>
            <div class="flex flex-wrap gap-xs">
              <span
                v-for="tool in recipe.tools"
                :key="tool"
                class="text-caption font-body px-sm py-xs rounded-full bg-canvas-parchment text-ink-muted-80"
              >
                {{ tool }}
              </span>
            </div>
          </div>

          <!-- 库存匹配信息（饲养员/推荐场景传入时显示） -->
          <div v-if="matched?.length || missing?.length" class="mb-lg">
            <h3 class="font-body text-body-strong text-ink mb-sm">食材匹配</h3>
            <div class="flex flex-wrap gap-xs">
              <span
                v-for="s in matched"
                :key="'m-' + s"
                class="inline-block bg-green-100 text-green-800 text-caption px-sm py-xs rounded-full"
              >
                {{ s }}
              </span>
              <span
                v-for="s in missing"
                :key="'x-' + s"
                class="inline-block bg-red-100 text-red-800 text-caption px-sm py-xs rounded-full"
              >
                {{ s }} (缺)
              </span>
            </div>
          </div>
        </div>

        <!-- 底部操作 -->
        <div class="bg-canvas-parchment px-lg py-md flex flex-wrap gap-sm justify-end sticky bottom-0">
          <slot name="extra-actions"></slot>
          <button
            v-if="recipe.bv"
            @click="openVideo"
            type="button"
            class="btn-secondary-pill text-caption apple-interaction"
          >
            视频教程
          </button>
          <button
            v-if="showAddButton"
            @click="$emit('add', recipe)"
            type="button"
            class="btn-primary text-caption apple-interaction"
          >
            加入菜单
          </button>
          <button
            @click="$emit('close')"
            type="button"
            class="btn-pearl-capsule text-caption apple-interaction"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup>
import { computed, ref } from 'vue'

const props = defineProps({
  recipe: {
    type: Object,
    default: null,
  },
  // 食客端显示"加入菜单"按钮
  showAddButton: {
    type: Boolean,
    default: false,
  },
  // 可选：库存匹配结果
  matched: {
    type: Array,
    default: null,
  },
  missing: {
    type: Array,
    default: null,
  },
})

defineEmits(['close', 'add'])

const imgError = ref(false)

const imageUrl = computed(() => {
  if (imgError.value || !props.recipe) {
    const name = props.recipe?.name || 'Food'
    return `https://placehold.co/600x400/f5f5f7/1d1d1f?text=${encodeURIComponent(name.slice(0, 4))}`
  }
  if (props.recipe.imageUrl) return props.recipe.imageUrl
  return `/api/image?name=${encodeURIComponent(props.recipe.name)}`
})

const hasAmounts = computed(() => {
  const ings = props.recipe?.ingredients
  return (
    Array.isArray(ings) &&
    ings.length > 0 &&
    typeof ings[0] === 'object' &&
    ings[0] !== null &&
    ings[0].name
  )
})

const difficultyClass = computed(() => {
  switch (props.recipe?.difficulty) {
    case '简单':
      return 'bg-green-100 text-green-800'
    case '普通':
    case '中等':
      return 'bg-yellow-100 text-yellow-800'
    case '困难':
      return 'bg-red-100 text-red-800'
    default:
      return 'bg-canvas-parchment text-ink-muted-80'
  }
})

const openVideo = () => {
  if (props.recipe?.bv) {
    window.open(`https://www.bilibili.com/video/${props.recipe.bv}`, '_blank')
  }
}
</script>

<style scoped>
.modal-enter-active {
  animation: modal-in 0.3s ease-out;
}
.modal-leave-active {
  animation: modal-out 0.2s ease-in;
}
@keyframes modal-in {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes modal-out {
  from { opacity: 1; }
  to { opacity: 0; }
}
</style>
