<template>
  <div class="min-h-screen bg-canvas">
    <!-- 导航栏 -->
    <nav class="fixed top-0 left-0 right-0 z-50 bg-surface-black bg-opacity-90 backdrop-blur-md">
      <div class="max-w-6xl mx-auto px-lg">
        <div class="flex items-center justify-between h-11">
          <div class="flex items-center">
            <span class="text-body-on-dark font-display text-tagline font-semibold tracking-tight">
              {{ guestName }}的点菜台
            </span>
          </div>
          <div class="flex items-center gap-sm">
            <button
              @click="rollRandom"
              class="btn-pearl-capsule text-caption apple-interaction hidden sm:block"
            >
              🎲 今天吃什么
            </button>
            <button
              @click="$emit('showTips')"
              class="btn-pearl-capsule text-caption apple-interaction hidden md:block"
            >
              📖 小课堂
            </button>
            <button
              v-if="cartItems.length > 0"
              @click="showCart = true"
              class="btn-primary text-caption apple-interaction relative"
            >
              已选 {{ cartItems.length }} 道菜
            </button>
            <button @click="$emit('switchRole')" class="btn-secondary-pill text-caption">
              返回
            </button>
          </div>
        </div>
      </div>
    </nav>

    <!-- 主要内容 -->
    <main class="pt-11 pb-20">
      <!-- 搜索 -->
      <section class="product-tile-light py-lg sticky top-11 z-40">
        <div class="max-w-6xl mx-auto px-lg">
          <input
            v-model="searchQuery"
            type="text"
            placeholder="搜索菜品..."
            class="w-full search-input"
          />
          <!-- 分类筛选 -->
          <div class="flex flex-wrap gap-xs mt-sm">
            <button
              @click="selectedCategory = ''"
              :class="[
                'px-md py-xs rounded-full font-body text-caption transition-colors apple-interaction',
                !selectedCategory ? 'bg-primary text-white' : 'bg-canvas-parchment text-ink-muted-80 hover:bg-hairline'
              ]"
            >
              全部
            </button>
            <button
              v-for="category in categories"
              :key="category"
              @click="selectedCategory = category"
              :class="[
                'px-md py-xs rounded-full font-body text-caption transition-colors apple-interaction',
                selectedCategory === category ? 'bg-primary text-white' : 'bg-canvas-parchment text-ink-muted-80 hover:bg-hairline'
              ]"
            >
              {{ category }}
            </button>
          </div>
        </div>
      </section>

      <!-- 本周计划摘要 -->
      <section v-if="todayPlan.length > 0" class="bg-primary/5 border-b border-divider-soft">
        <div class="max-w-6xl mx-auto px-lg py-sm flex items-center justify-between gap-sm">
          <div class="flex items-center gap-sm min-w-0">
            <span class="text-caption font-body text-ink-muted-80 flex-shrink-0">今日计划：</span>
            <span class="text-caption font-body text-ink truncate">
              {{ todayPlan.map(r => r.name).join('、') }}
            </span>
          </div>
          <button
            @click="addTodayPlanToCart"
            class="btn-pearl-capsule text-caption apple-interaction flex-shrink-0"
          >
            一键点菜
          </button>
        </div>
      </section>

      <!-- 菜谱九宫格 -->
      <section class="product-tile-light">
        <div class="max-w-6xl mx-auto px-lg">
          <div v-if="loading" class="text-center py-xxl">
            <div class="animate-spin-slow h-12 w-12 text-primary mx-auto mb-lg">
              <svg fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
            <p class="font-body text-body text-ink-muted-80">正在加载菜谱...</p>
          </div>

          <div v-else-if="filteredRecipes.length === 0" class="text-center py-xxl">
            <p class="font-body text-body text-ink-muted-80">没有找到匹配的菜品</p>
          </div>

          <div v-else class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-md">
            <div
              v-for="recipe in filteredRecipes"
              :key="recipe.id"
              class="recipe-card group cursor-pointer"
              @click="openRecipe(recipe)"
            >
              <!-- 图片 -->
              <div class="aspect-square bg-canvas-parchment rounded-t-lg overflow-hidden relative">
                <img
                  :src="getImageUrl(recipe)"
                  :alt="recipe.name"
                  class="w-full h-full object-cover"
                  @error="handleImageError"
                />
                <!-- 右下角 + 按钮：快速加菜 -->
                <button
                  @click.stop="addToCart(recipe)"
                  class="absolute bottom-2 right-2 w-8 h-8 bg-primary rounded-full flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-label="快速加入菜单"
                >
                  <svg class="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
                  </svg>
                </button>
                <!-- 库存匹配标记 -->
                <div
                  v-if="getRecipeScore(recipe.id) > 0"
                  class="absolute top-2 left-2 px-xs py-[1px] bg-green-500/90 rounded text-white text-[10px] font-body"
                >
                  有库存
                </div>
                <!-- 已选数量角标 -->
                <div
                  v-if="getCartQuantity(recipe.id) > 0"
                  class="absolute top-2 right-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center"
                >
                  <span class="text-white text-caption font-body">{{ getCartQuantity(recipe.id) }}</span>
                </div>
              </div>
              <!-- 菜名 -->
              <div class="p-sm">
                <h3 class="font-body text-caption-strong text-ink truncate">{{ recipe.name }}</h3>
                <div class="flex items-center gap-xs mt-xs">
                  <span v-if="recipe.difficulty" class="text-micro-legal text-ink-muted-48">{{ recipe.difficulty }}</span>
                  <span v-for="tag in recipe.tags.slice(0, 1)" :key="tag" class="text-micro-legal text-primary bg-primary/10 px-xs rounded">
                    {{ tag }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>

    <!-- 购物车抽屉 -->
    <transition name="slide-up">
      <div v-if="showCart" class="fixed inset-0 z-50 flex items-end">
        <div class="absolute inset-0 bg-black/50" @click="showCart = false"></div>
        <div class="relative w-full max-w-2xl mx-auto bg-canvas rounded-t-2xl max-h-[80vh] overflow-hidden">
          <!-- 头部 -->
          <div class="flex items-center justify-between p-lg border-b border-divider-soft">
            <h2 class="font-display text-body-strong text-ink">我的菜单</h2>
            <button @click="showCart = false" class="w-8 h-8 rounded-full bg-canvas-parchment flex items-center justify-center">
              <svg class="h-5 w-5 text-ink" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </button>
          </div>

          <!-- 菜品列表 -->
          <div class="overflow-y-auto p-lg" style="max-height: calc(80vh - 140px);">
            <div v-if="cartItems.length === 0" class="text-center py-xxl">
              <p class="font-body text-body text-ink-muted-48">还没有选择菜品</p>
            </div>
            <div v-else class="space-y-sm">
              <div
                v-for="item in cartItems"
                :key="item.recipeId"
                class="flex items-center justify-between bg-canvas-parchment rounded-lg p-md"
              >
                <div class="flex-1 min-w-0">
                  <h3 class="font-body text-body-strong text-ink truncate">{{ item.name }}</h3>
                </div>
                <div class="flex items-center gap-sm ml-sm">
                  <button
                    @click="updateQuantity(item.recipeId, -1)"
                    class="w-8 h-8 rounded-full bg-canvas flex items-center justify-center text-ink-muted-80 hover:bg-red-100 hover:text-red-600"
                  >
                    -
                  </button>
                  <span class="font-body text-body-strong text-primary w-8 text-center">{{ item.quantity }}</span>
                  <button
                    @click="updateQuantity(item.recipeId, 1)"
                    class="w-8 h-8 rounded-full bg-canvas flex items-center justify-center text-ink-muted-80 hover:bg-green-100 hover:text-green-600"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- 底部提交 -->
          <div class="p-lg border-t border-divider-soft">
            <button
              @click="submitOrder"
              :disabled="cartItems.length === 0 || submitting"
              class="w-full btn-store-hero apple-interaction"
            >
              <span v-if="submitting">提交中...</span>
              <span v-else>提交点菜 ({{ cartItems.length }} 道菜)</span>
            </button>
          </div>
        </div>
      </div>
    </transition>

    <!-- 菜谱详情弹窗 -->
    <RecipeDetailModal
      :recipe="selectedRecipe"
      :show-add-button="true"
      :matched="selectedRecipe ? getMatched(selectedRecipe.id) : null"
      :missing="selectedRecipe ? getMissing(selectedRecipe.id) : null"
      @close="selectedRecipe = null"
      @add="handleAddFromModal"
    >
      <template #extra-actions>
        <button
          v-if="isRandomMode"
          @click="rollRandom"
          type="button"
          class="btn-secondary-pill text-caption apple-interaction"
        >
          换一个
        </button>
      </template>
    </RecipeDetailModal>

    <!-- Toast 通知 -->
    <transition name="toast">
      <div
        v-if="toast.show"
        class="fixed top-16 left-1/2 -translate-x-1/2 z-[60] px-lg py-sm rounded-lg shadow-lg font-body text-body max-w-sm text-center whitespace-nowrap"
        :class="toast.type === 'warning' ? 'bg-yellow-500 text-white' : 'bg-green-500 text-white'"
      >
        {{ toast.message }}
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import axios from 'axios'
import RecipeDetailModal from './RecipeDetailModal.vue'

const props = defineProps({
  guestName: {
    type: String,
    required: true
  }
})

defineEmits(['switchRole', 'showTips'])

const recipes = ref([])
const recommendations = ref([])
const cartItems = ref([])
const loading = ref(false)
const submitting = ref(false)
const searchQuery = ref('')
const showCart = ref(false)
const selectedRecipe = ref(null)
const selectedCategory = ref('')
const isRandomMode = ref(false)
const mealPlan = ref(null)

// Toast
const toast = ref({ show: false, message: '', type: 'success' })
let toastTimer = null
const showToast = (message, type = 'success') => {
  toast.value = { show: true, message, type }
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toast.value.show = false }, 3000)
}

// 可选分类列表（来自菜谱数据）
const categories = computed(() => {
  const set = new Set()
  recipes.value.forEach(r => { if (r.category) set.add(r.category) })
  return [...set].sort((a, b) => a.localeCompare(b, 'zh-CN'))
})

// 筛选后的菜谱（分类 + 搜索，库存匹配的排在前面）
const filteredRecipes = computed(() => {
  let list = recipes.value
  if (selectedCategory.value) {
    list = list.filter(recipe => recipe.category === selectedCategory.value)
  }
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    list = list.filter(recipe =>
      recipe.name.toLowerCase().includes(q) ||
      (recipe.stuff || []).some(s => s.toLowerCase().includes(q)) ||
      (recipe.tags || []).some(t => t.toLowerCase().includes(q))
    )
  }
  // 构建推荐分数映射
  const scoreMap = {}
  recommendations.value.forEach(r => { scoreMap[r.id] = r.score })
  // 按库存匹配分数降序排列，无匹配的排在后面
  return [...list].sort((a, b) => {
    const sa = scoreMap[a.id] || 0
    const sb = scoreMap[b.id] || 0
    return sb - sa
  })
})

// 今日（周几）计划中的菜谱对象
const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
const todayPlan = computed(() => {
  if (!mealPlan.value) return []
  const dayKey = DAY_KEYS[new Date().getDay()]
  const day = mealPlan.value.days?.[dayKey]
  if (!day) return []
  const ids = [
    ...(day.breakfast || []),
    ...(day.lunch || []),
    ...(day.dinner || []),
    ...(day.snack || [])
  ]
  return ids.map(id => recipes.value.find(r => r.id === id)).filter(Boolean)
})

// 一键把今日计划加入购物车
const addTodayPlanToCart = () => {
  if (todayPlan.value.length === 0) return
  todayPlan.value.forEach(recipe => addToCart(recipe, false))
  showToast(`已按今日计划加入 ${todayPlan.value.length} 道菜`)
}

// 随机推荐：优先库存能做的菜
const rollRandom = async () => {
  try {
    const response = await axios.get('/api/recipes/random?count=1&preferStock=1')
    if (response.data.success && response.data.data.length > 0) {
      isRandomMode.value = true
      selectedRecipe.value = response.data.data[0]
    }
  } catch (error) {
    console.error('随机推荐失败:', error)
    showToast('随机推荐失败，请重试', 'warning')
  }
}

// 获取图片URL（优先菜谱内本地直链，回退名称代理）
const getImageUrl = (recipe) => {
  if (recipe.imageUrl) return recipe.imageUrl
  return `/api/image?name=${encodeURIComponent(recipe.name)}`
}

// 打开菜谱详情
const openRecipe = (recipe) => {
  isRandomMode.value = false
  selectedRecipe.value = recipe
}

// 从详情弹窗加入菜单
const handleAddFromModal = (recipe) => {
  addToCart(recipe)
  selectedRecipe.value = null
}

// 获取菜品的库存匹配明细
const getMatched = (recipeId) => {
  const rec = recommendations.value.find(r => r.id === recipeId)
  return rec ? rec.matched : null
}

const getMissing = (recipeId) => {
  const rec = recommendations.value.find(r => r.id === recipeId)
  return rec ? rec.missing : null
}

// 图片加载失败处理（L4：加 data-fallback 标记防死循环）
const handleImageError = (event) => {
  const img = event.target
  if (img.dataset.fallback) return
  img.dataset.fallback = '1'
  const name = img.alt || 'Food'
  img.src = `https://placehold.co/200x200/f5f5f7/1d1d1f?text=${encodeURIComponent(name.slice(0, 2))}`
}

// 获取购物车中某菜品的数量
const getCartQuantity = (recipeId) => {
  const item = cartItems.value.find(i => i.recipeId === recipeId)
  return item ? item.quantity : 0
}

// 获取菜品的库存匹配分数
const getRecipeScore = (recipeId) => {
  const rec = recommendations.value.find(r => r.id === recipeId)
  return rec ? rec.score : 0
}

// 获取菜谱
const fetchRecipes = async () => {
  try {
    loading.value = true
    const response = await axios.get('/api/recipes')
    if (response.data.success) recipes.value = response.data.data
  } catch (error) {
    console.error('获取菜谱失败:', error)
  } finally {
    loading.value = false
  }
}

// 获取推荐
const fetchRecommendations = async () => {
  try {
    const response = await axios.get('/api/recipes/recommend?count=8')
    if (response.data.success) recommendations.value = response.data.data
  } catch (error) {
    console.error('获取推荐失败:', error)
  }
}

// 添加到购物车（silent=true 时不弹 toast，用于批量）
const addToCart = (recipe, silent = false) => {
  const existing = cartItems.value.find(item => item.recipeId === recipe.id)
  if (existing) {
    existing.quantity++
  } else {
    cartItems.value.push({
      recipeId: recipe.id,
      name: recipe.name,
      quantity: 1
    })
  }
  if (!silent) showToast(`已添加「${recipe.name}」`)
}

// 更新数量
const updateQuantity = (recipeId, delta) => {
  const item = cartItems.value.find(i => i.recipeId === recipeId)
  if (item) {
    item.quantity += delta
    if (item.quantity <= 0) {
      cartItems.value = cartItems.value.filter(i => i.recipeId !== recipeId)
    }
  }
}

// 提交订单
const submitOrder = async () => {
  if (cartItems.value.length === 0) {
    showToast('请先添加菜品', 'warning')
    return
  }

  try {
    submitting.value = true
    const response = await axios.post('/api/orders', {
      guestName: props.guestName,
      items: cartItems.value.map(item => ({
        recipeId: item.recipeId,
        name: item.name,
        quantity: item.quantity
      }))
    })

    if (response.data.success) {
      showToast('点菜成功！饲养员已收到你的菜单')
      cartItems.value = []
      showCart.value = false
    }
  } catch (error) {
    console.error('提交订单失败:', error)
    showToast('提交失败，请重试', 'warning')
  } finally {
    submitting.value = false
  }
}

// 获取周计划（今日计划摘要用）
const fetchMealPlan = async () => {
  try {
    const response = await axios.get('/api/meal-plan')
    if (response.data.success) mealPlan.value = response.data.data
  } catch (error) {
    console.error('获取周计划失败:', error)
  }
}

onMounted(() => {
  fetchRecipes()
  fetchRecommendations()
  fetchMealPlan()
})
</script>

<style scoped>
.recipe-card {
  background: white;
  border-radius: 0.5rem;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  transition: transform 0.2s, box-shadow 0.2s;
}
.recipe-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.toast-enter-active {
  animation: toast-in 0.3s ease-out;
}
.toast-leave-active {
  animation: toast-out 0.3s ease-in;
}
@keyframes toast-in {
  from { opacity: 0; transform: translate(-50%, -20px); }
  to { opacity: 1; transform: translate(-50%, 0); }
}
@keyframes toast-out {
  from { opacity: 1; transform: translate(-50%, 0); }
  to { opacity: 0; transform: translate(-50%, -20px); }
}

.slide-up-enter-active {
  animation: slide-up 0.3s ease-out;
}
.slide-up-leave-active {
  animation: slide-down 0.3s ease-in;
}
@keyframes slide-up {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}
@keyframes slide-down {
  from { transform: translateY(0); }
  to { transform: translateY(100%); }
}
</style>
