<template>
  <div class="min-h-screen bg-canvas">
    <!-- 导航栏 -->
    <nav class="fixed top-0 left-0 right-0 z-50 bg-surface-black bg-opacity-90 backdrop-blur-md">
      <div class="max-w-3xl mx-auto px-lg">
        <div class="flex items-center justify-between h-11">
          <div class="flex items-center">
            <span class="text-body-on-dark font-display text-tagline font-semibold tracking-tight">
              饲养员看板
            </span>
          </div>
          <div class="flex items-center gap-sm">
            <button @click="$emit('showTips')" class="btn-pearl-capsule text-caption apple-interaction hidden md:block">
              📖 小课堂
            </button>
            <button @click="$emit('switchRole')" class="btn-secondary-pill text-caption">
              返回选择
            </button>
          </div>
        </div>
      </div>
    </nav>

    <!-- 主要内容 -->
    <main class="pt-11">
      <!-- Tab 切换 -->
      <section class="product-tile-light py-lg">
        <div class="max-w-4xl mx-auto px-lg">
          <div class="flex gap-sm">
            <button
              @click="mainTab = 'orders'"
              :class="mainTab === 'orders' ? 'btn-primary' : 'btn-pearl-capsule'"
              class="apple-interaction"
            >
              订单管理
            </button>
            <button
              @click="mainTab = 'inventory'"
              :class="mainTab === 'inventory' ? 'btn-primary' : 'btn-pearl-capsule'"
              class="apple-interaction"
            >
              库存管理
            </button>
            <button
              @click="mainTab = 'plan'"
              :class="mainTab === 'plan' ? 'btn-primary' : 'btn-pearl-capsule'"
              class="apple-interaction"
            >
              周计划
            </button>
          </div>
        </div>
      </section>

      <!-- 订单管理 -->
      <template v-if="mainTab === 'orders'">
        <!-- 统计信息 -->
        <section class="product-tile-parchment">
          <div class="max-w-4xl mx-auto px-lg">
            <div class="grid grid-cols-3 gap-lg">
              <div class="text-center">
                <div class="font-display text-display-lg text-primary">{{ pendingOrders.length }}</div>
                <div class="font-body text-caption text-ink-muted-80">待处理</div>
              </div>
              <div class="text-center">
                <div class="font-display text-display-lg text-yellow-500">{{ cookingOrders.length }}</div>
                <div class="font-body text-caption text-ink-muted-80">正在做</div>
              </div>
              <div class="text-center">
                <div class="font-display text-display-lg text-green-500">{{ completedOrders.length }}</div>
                <div class="font-body text-caption text-ink-muted-80">已完成</div>
              </div>
            </div>
          </div>
        </section>

        <!-- 近 30 天下厨统计 -->
        <section v-if="stats" class="product-tile-light py-lg">
          <div class="max-w-4xl mx-auto px-lg">
            <h2 class="font-display text-tagline text-ink mb-md text-left">近 30 天</h2>
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-md mb-md">
              <div class="bg-canvas-parchment rounded-lg p-md text-center">
                <div class="font-display text-display-md text-primary">{{ stats.completedOrders }}</div>
                <div class="font-body text-caption text-ink-muted-80">完成订单</div>
              </div>
              <div class="bg-canvas-parchment rounded-lg p-md text-center">
                <div class="font-display text-display-md text-primary">{{ stats.totalDishes }}</div>
                <div class="font-body text-caption text-ink-muted-80">做菜道数</div>
              </div>
              <div
                v-for="(guest, name) in stats.byGuest"
                :key="name"
                class="bg-canvas-parchment rounded-lg p-md text-center"
              >
                <div class="font-display text-display-md text-ink-muted-80">{{ guest }}</div>
                <div class="font-body text-caption text-ink-muted-80">{{ name }}的订单</div>
              </div>
            </div>
            <div v-if="stats.topDishes.length > 0" class="text-left">
              <h3 class="font-body text-body-strong text-ink mb-sm">最常做的菜</h3>
              <div class="flex flex-wrap gap-sm">
                <span
                  v-for="dish in stats.topDishes"
                  :key="dish.name"
                  class="inline-flex items-center gap-xs bg-canvas-parchment px-md py-xs rounded-full"
                >
                  <span class="font-body text-caption text-ink">{{ dish.name }}</span>
                  <span class="font-body text-caption-strong text-primary">×{{ dish.count }}</span>
                </span>
              </div>
            </div>
          </div>
        </section>

        <!-- 营养看板 -->
        <section v-if="nutritionSummary" class="product-tile-parchment py-lg">
          <div class="max-w-4xl mx-auto px-lg">
            <h2 class="font-display text-tagline text-ink mb-md text-left">营养看板（近 7 天）</h2>
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-md">
              <div class="bg-canvas rounded-lg p-md text-center">
                <div class="font-display text-display-md text-primary">{{ nutritionSummary.totalCalories.toLocaleString() }}</div>
                <div class="font-body text-caption text-ink-muted-80">总热量 (大卡)</div>
              </div>
              <div class="bg-canvas rounded-lg p-md text-center">
                <div class="font-display text-display-md text-primary">{{ nutritionSummary.dailyAverage.toLocaleString() }}</div>
                <div class="font-body text-caption text-ink-muted-80">日均热量 (大卡)</div>
              </div>
              <div class="bg-canvas rounded-lg p-md text-center">
                <div class="font-display text-display-md text-primary">{{ nutritionSummary.totalDishes }}</div>
                <div class="font-body text-caption text-ink-muted-80">做菜道数</div>
              </div>
              <div class="bg-canvas rounded-lg p-md text-center">
                <div class="font-display text-display-md text-primary">{{ nutritionSummary.byMealType.lunch + nutritionSummary.byMealType.dinner }}</div>
                <div class="font-body text-caption text-ink-muted-80">午晚餐道数</div>
              </div>
            </div>
          </div>
        </section>

        <!-- 今日饮食日志 -->
        <section class="product-tile-light py-lg">
          <div class="max-w-4xl mx-auto px-lg">
            <h2 class="font-display text-tagline text-ink mb-md text-left">今日饮食日志</h2>
            <div v-if="todayLogs.length === 0" class="text-center py-xl">
              <p class="font-body text-caption text-ink-muted-48">今天还没有饮食记录，完成订单后会自动记录</p>
            </div>
            <div v-else class="space-y-sm">
              <div
                v-for="log in todayLogs"
                :key="log.id"
                class="flex items-center justify-between bg-canvas-parchment rounded-lg p-md"
              >
                <div class="flex items-center gap-sm min-w-0">
                  <span class="inline-block bg-primary/10 text-primary text-micro-legal px-xs py-[1px] rounded-full flex-shrink-0">
                    {{ mealTypeLabel(log.mealType) }}
                  </span>
                  <span class="font-body text-body text-ink truncate">{{ log.recipeName }}</span>
                  <span v-if="log.calories" class="font-body text-caption text-ink-muted-48 flex-shrink-0">{{ log.calories }} 大卡</span>
                </div>
                <div class="flex items-center gap-sm flex-shrink-0">
                  <span class="font-body text-caption text-ink-muted-48">{{ log.guestName || '' }}</span>
                  <button
                    @click="deleteDietLog(log.id)"
                    class="text-red-400 hover:text-red-600 text-caption"
                    title="删除记录"
                  >
                    ×
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- 订单筛选 -->
        <section class="product-tile-light">
          <div class="max-w-4xl mx-auto px-lg">
            <div class="flex gap-sm overflow-x-auto pb-sm">
              <button
                v-for="tab in orderTabs"
                :key="tab.key"
                @click="activeOrderTab = tab.key"
                :class="activeOrderTab === tab.key ? 'btn-primary' : 'btn-pearl-capsule'"
                class="whitespace-nowrap apple-interaction"
              >
                {{ tab.label }}
                <span v-if="tab.count > 0" class="ml-xs bg-white/20 px-xs rounded-full">{{ tab.count }}</span>
              </button>
            </div>
          </div>
        </section>

        <!-- 订单列表 -->
        <section class="product-tile-light">
          <div class="max-w-4xl mx-auto px-lg">
            <div v-if="loadingOrders" class="text-center py-xxl">
              <div class="animate-spin-slow h-12 w-12 text-primary mx-auto mb-lg">
                <svg fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              </div>
              <p class="font-body text-body text-ink-muted-80">正在加载订单...</p>
            </div>

            <div v-else-if="filteredOrders.length === 0" class="text-center py-xxl">
              <svg class="h-16 w-16 text-ink-muted-48 mx-auto mb-lg" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path>
              </svg>
              <p class="font-body text-body text-ink-muted-80 mb-lg">暂无订单</p>
              <p class="font-body text-caption text-ink-muted-48">食客点菜后会在这里显示</p>
            </div>

            <div v-else class="space-y-lg">
              <div
                v-for="order in filteredOrders"
                :key="order.id"
                class="bg-canvas rounded-lg p-lg shadow-sm"
              >
                <div class="flex items-center justify-between mb-md">
                  <div class="flex items-center gap-sm">
                    <h3 class="font-body text-body-strong text-ink">{{ order.guestName }}</h3>
                    <span class="text-caption font-body px-sm py-xs rounded-full" :class="getStatusClass(order.status)">
                      {{ getStatusLabel(order.status) }}
                    </span>
                  </div>
                  <span class="font-body text-caption text-ink-muted-48">{{ formatTime(order.createdAt) }}</span>
                </div>

                <div class="space-y-sm mb-md">
                  <div
                    v-for="item in order.items"
                    :key="item.recipeId"
                    class="flex items-center justify-between bg-canvas-parchment rounded-lg p-sm cursor-pointer hover:bg-canvas-parchment/80 transition-colors"
                    @click="viewRecipe(item.recipeId)"
                  >
                    <span class="font-body text-body text-ink">{{ item.name }}</span>
                    <span class="font-body text-caption text-primary">x{{ item.quantity }}</span>
                  </div>
                </div>

                <div class="flex justify-end gap-sm">
                  <button
                    v-if="order.status === 'pending'"
                    @click="updateOrderStatus(order.id, 'cooking')"
                    class="btn-primary text-caption apple-interaction"
                  >
                    开始做
                  </button>
                  <button
                    v-if="order.status === 'cooking'"
                    @click="updateOrderStatus(order.id, 'completed')"
                    class="btn-primary text-caption apple-interaction bg-green-500 hover:bg-green-600"
                  >
                    完成
                  </button>
                  <button
                    v-if="order.status === 'completed'"
                    @click="deleteOrder(order.id)"
                    class="btn-pearl-capsule text-caption apple-interaction"
                  >
                    删除
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </template>

      <!-- 库存管理 -->
      <template v-if="mainTab === 'inventory'">
        <!-- 搜索和统计 -->
        <section class="product-tile-parchment">
          <div class="max-w-4xl mx-auto px-lg">
            <div class="flex flex-col sm:flex-row gap-sm items-start sm:items-center justify-between">
              <div class="flex-1 w-full sm:w-auto">
                <input
                  v-model="ingredientSearch"
                  type="text"
                  placeholder="搜索食材..."
                  class="w-full search-input"
                />
              </div>
              <div class="flex items-center gap-lg">
                <div class="text-center">
                  <div class="font-display text-display-lg text-primary">{{ inStockCount }}</div>
                  <div class="font-body text-caption text-ink-muted-80">有库存</div>
                </div>
                <div class="text-center">
                  <div class="font-display text-display-lg text-ink-muted-48">{{ allIngredients.length - inStockCount }}</div>
                  <div class="font-body text-caption text-ink-muted-80">缺货</div>
                </div>
                <button @click="clearIngredients" class="text-caption text-red-500 hover:text-red-700 font-body">清空全部</button>
              </div>
            </div>
          </div>
        </section>

        <!-- 食材分类展示 -->
        <section class="product-tile-light">
          <div class="max-w-4xl mx-auto px-lg">
            <h2 class="font-display text-display-lg text-ink mb-lg">食材库存</h2>
            
            <!-- 分类筛选标签 -->
            <div class="flex flex-wrap gap-xs mb-lg">
              <button
                @click="selectedCategory = ''; ingredientSearch = ''"
                :class="[
                  'px-md py-xs rounded-full font-body text-caption transition-colors',
                  !selectedCategory ? 'bg-primary text-white' : 'bg-canvas-parchment text-ink-muted-80 hover:bg-canvas-parchment/80'
                ]"
              >
                全部
              </button>
              <button
                v-for="category in categories"
                :key="category"
                @click="selectedCategory = category; ingredientSearch = ''"
                :class="[
                  'px-md py-xs rounded-full font-body text-caption transition-colors',
                  selectedCategory === category ? 'bg-primary text-white' : 'bg-canvas-parchment text-ink-muted-80 hover:bg-canvas-parchment/80'
                ]"
              >
                {{ category }}
              </button>
            </div>
            
            <!-- 按分类分组展示 -->
            <div v-for="[category, items] in ingredientsByCategory" :key="category" class="mb-xl">
              <h3 class="font-display text-heading text-ink mb-md flex items-center gap-xs">
                <span class="w-2 h-2 rounded-full bg-primary"></span>
                {{ category }}
                <span class="font-body text-caption text-ink-muted-48">({{ items.length }})</span>
              </h3>
              <div class="flex flex-wrap gap-sm">
                <button
                  v-for="item in items"
                  :key="item.name"
                  @click="incrementIngredient(item.name)"
                  :class="[
                    'flex items-center gap-xs rounded-full pl-md pr-xs py-xs transition-colors apple-interaction',
                    item.count > 0 
                      ? 'bg-primary/10 border border-primary/30 hover:bg-primary/20' 
                      : 'bg-canvas-parchment hover:bg-canvas-parchment/80'
                  ]"
                >
                  <span :class="[
                    'font-body text-caption',
                    item.count > 0 ? 'text-ink' : 'text-ink-muted-80'
                  ]">{{ item.name }}</span>
                  <span :class="[
                    'font-body text-caption-strong px-xs rounded-full',
                    item.count > 0 
                      ? 'text-primary bg-primary/20' 
                      : 'text-ink-muted-48 bg-canvas-parchment/50'
                  ]">{{ item.count }}</span>
                </button>
              </div>
            </div>
            
            <!-- 空状态 -->
            <div v-if="filteredIngredients.length === 0" class="text-center py-xl">
              <p class="font-body text-body text-ink-muted-48">没有找到匹配的食材</p>
            </div>
          </div>
        </section>
      </template>

      <!-- 周计划 -->
      <template v-if="mainTab === 'plan'">
        <section class="product-tile-parchment py-lg">
          <div class="max-w-4xl mx-auto px-lg flex items-center justify-between">
            <div>
              <h2 class="font-display text-tagline text-ink">本周菜单</h2>
              <p class="font-body text-caption text-ink-muted-80 mt-xs">
                {{ mealPlan?.weekStart }} 起 · 点击格子选择菜品
              </p>
            </div>
            <button
              @click="saveMealPlan"
              :disabled="savingPlan"
              class="btn-primary text-caption apple-interaction"
            >
              {{ savingPlan ? '保存中...' : '保存计划' }}
            </button>
          </div>
        </section>

        <section class="product-tile-light">
          <div class="max-w-4xl mx-auto px-lg">
            <div v-if="loadingPlan" class="text-center py-xxl">
              <p class="font-body text-body text-ink-muted-80">正在加载周计划...</p>
            </div>
            <div v-else class="space-y-md">
              <div
                v-for="day in planDays"
                :key="day.key"
                class="bg-canvas rounded-lg border border-divider-soft p-md"
              >
                <div class="flex flex-col sm:flex-row sm:items-start gap-md">
                  <div class="font-body text-body-strong text-ink w-12 flex-shrink-0 pt-xs">
                    {{ day.label }}
                  </div>
                  <div class="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-md">
                    <div v-for="meal in MEAL_TYPES" :key="meal.key">
                      <div class="font-body text-caption text-ink-muted-80 mb-xs">
                        {{ meal.label }}
                      </div>
                      <div class="flex flex-wrap gap-xs">
                        <button
                          v-for="recipeId in planDraft[day.key][meal.key]"
                          :key="recipeId"
                          @click="removeFromPlan(day.key, meal.key, recipeId)"
                          class="inline-flex items-center gap-xs bg-primary/10 border border-primary/30 px-sm py-xs rounded-full apple-interaction hover:bg-red-100 hover:border-red-300"
                          title="点击移除"
                        >
                          <span class="font-body text-caption text-ink">{{ recipeName(recipeId) }}</span>
                          <span class="text-red-500 text-caption">×</span>
                        </button>
                        <button
                          @click="openPlanPicker(day.key, meal.key)"
                          class="px-sm py-xs rounded-full border border-dashed border-hairline font-body text-caption text-ink-muted-48 hover:border-primary hover:text-primary apple-interaction"
                        >
                          + 添加
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </template>
    </main>

    <!-- 周计划选菜弹窗 -->
    <transition name="modal">
      <div
        v-if="planPicker.open"
        class="fixed inset-0 z-[65] flex items-center justify-center p-lg"
        @click.self="planPicker.open = false"
      >
        <div class="absolute inset-0 bg-black/50 backdrop-blur-sm"></div>
        <div class="relative bg-canvas rounded-xl shadow-xl max-w-lg w-full max-h-[80vh] flex flex-col">
          <div class="p-lg border-b border-divider-soft">
            <h3 class="font-display text-body-strong text-ink">选择菜品</h3>
            <input
              v-model="planPicker.search"
              type="text"
              placeholder="搜索菜品..."
              class="w-full search-input mt-sm"
            />
          </div>
          <div class="flex-1 overflow-y-auto p-lg">
            <div class="flex flex-wrap gap-sm">
              <button
                v-for="recipe in pickerRecipes"
                :key="recipe.id"
                @click="addToPlan(recipe.id)"
                class="px-md py-xs rounded-full bg-canvas-parchment font-body text-caption text-ink hover:bg-primary hover:text-white transition-colors apple-interaction"
              >
                {{ recipe.name }}
              </button>
            </div>
            <div v-if="pickerRecipes.length === 0" class="text-center py-xl">
              <p class="font-body text-caption text-ink-muted-48">没有匹配的菜品</p>
            </div>
          </div>
          <div class="p-md border-t border-divider-soft text-right">
            <button @click="planPicker.open = false" class="btn-pearl-capsule text-caption apple-interaction">
              完成
            </button>
          </div>
        </div>
      </div>
    </transition>

    <!-- 菜谱详情弹窗（共享组件） -->
    <RecipeDetailModal
      :recipe="selectedRecipe"
      @close="closeRecipeModal"
    />

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
import { ref, computed, onMounted, onUnmounted } from 'vue'
import axios from 'axios'
import RecipeDetailModal from './RecipeDetailModal.vue'

defineEmits(['switchRole', 'showTips'])

// 主 Tab
const mainTab = ref('orders')

// 订单相关
const orders = ref([])
const loadingOrders = ref(false)
const activeOrderTab = ref('pending')
let pollInterval = null

// 下厨统计
const stats = ref(null)

// 饮食日志与营养汇总
const todayLogs = ref([])
const nutritionSummary = ref(null)

// 菜谱列表（周计划选菜用）
const allRecipes = ref([])

// 周计划
const DAY_LABELS = [
  { key: 'mon', label: '周一' },
  { key: 'tue', label: '周二' },
  { key: 'wed', label: '周三' },
  { key: 'thu', label: '周四' },
  { key: 'fri', label: '周五' },
  { key: 'sat', label: '周六' },
  { key: 'sun', label: '周日' },
]
const MEAL_TYPES = [
  { key: 'breakfast', label: '早餐' },
  { key: 'lunch', label: '午餐' },
  { key: 'dinner', label: '晚餐' },
  { key: 'snack', label: '加餐' },
]
const planDays = DAY_LABELS
const emptyPlanDays = () => {
  const days = {}
  for (const { key } of DAY_LABELS) {
    days[key] = { breakfast: [], lunch: [], dinner: [], snack: [] }
  }
  return days
}
const mealPlan = ref(null)
const planDraft = ref(emptyPlanDays())
const loadingPlan = ref(false)
const savingPlan = ref(false)
const planPicker = ref({ open: false, day: '', meal: '', search: '' })

// 菜谱详情弹窗
const selectedRecipe = ref(null)

// 库存相关
const ingredients = ref({})
const allIngredients = ref([])
const ingredientSearch = ref('')
const selectedCategory = ref('')

// Toast
const toast = ref({ show: false, message: '', type: 'success' })
let toastTimer = null
const showToast = (message, type = 'success') => {
  toast.value = { show: true, message, type }
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toast.value.show = false }, 3000)
}

// 订单分类
const pendingOrders = computed(() => orders.value.filter(o => o.status === 'pending'))
const cookingOrders = computed(() => orders.value.filter(o => o.status === 'cooking'))
const completedOrders = computed(() => orders.value.filter(o => o.status === 'completed'))

const orderTabs = computed(() => [
  { key: 'pending', label: '待处理', count: pendingOrders.value.length },
  { key: 'cooking', label: '正在做', count: cookingOrders.value.length },
  { key: 'completed', label: '已完成', count: completedOrders.value.length },
  { key: 'all', label: '全部', count: orders.value.length }
])

const filteredOrders = computed(() => {
  if (activeOrderTab.value === 'all') return orders.value
  return orders.value.filter(o => o.status === activeOrderTab.value)
})

// 食材筛选
const filteredIngredients = computed(() => {
  let result = allIngredients.value
  
  // 按分类筛选
  if (selectedCategory.value) {
    result = result.filter(item => item.category === selectedCategory.value)
  }
  
  // 按名称搜索
  if (ingredientSearch.value) {
    const q = ingredientSearch.value.toLowerCase()
    result = result.filter(item => item.name.toLowerCase().includes(q))
  }
  
  return result
})

const inStockCount = computed(() => {
  return allIngredients.value.filter(item => item.count > 0).length
})

// 按分类分组的食材
const ingredientsByCategory = computed(() => {
  const groups = {}
  filteredIngredients.value.forEach(item => {
    const category = item.category || '其他'
    if (!groups[category]) {
      groups[category] = []
    }
    groups[category].push(item)
  })
  // 按分类名称排序
  return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b, 'zh-CN'))
})

// 分类列表
const categories = computed(() => {
  return [...new Set(allIngredients.value.map(item => item.category || '其他'))].sort((a, b) => a.localeCompare(b, 'zh-CN'))
})

// 订单相关函数
const fetchOrders = async () => {
  try {
    const response = await axios.get('/api/orders')
    if (response.data.success) orders.value = response.data.data
  } catch (error) {
    console.error('获取订单失败:', error)
  }
}

const updateOrderStatus = async (orderId, status) => {
  try {
    const response = await axios.put(`/api/orders/${orderId}`, { status })
    if (response.data.success) {
      showToast(`订单状态已更新为：${getStatusLabel(status)}`)
      fetchOrders()
      if (status === 'completed') {
        fetchStats()
        fetchTodayLogs()
        fetchNutritionSummary()
      }
    }
  } catch (error) {
    showToast('更新失败，请重试', 'warning')
  }
}

const deleteOrder = async (orderId) => {
  try {
    const response = await axios.delete(`/api/orders/${orderId}`)
    if (response.data.success) {
      showToast('订单已删除')
      fetchOrders()
    }
  } catch (error) {
    showToast('删除失败，请重试', 'warning')
  }
}

// 菜谱详情
const viewRecipe = async (recipeId) => {
  selectedRecipe.value = null
  try {
    const response = await axios.get(`/api/recipes/${encodeURIComponent(recipeId)}`)
    if (response.data.success) {
      selectedRecipe.value = response.data.data
    }
  } catch (error) {
    showToast('获取菜谱详情失败', 'warning')
  }
}

const closeRecipeModal = () => {
  selectedRecipe.value = null
}

// 库存相关函数
const fetchIngredients = async () => {
  try {
    const response = await axios.get('/api/ingredients')
    if (response.data.success) ingredients.value = response.data.data
  } catch (error) {
    console.error('获取食材失败:', error)
  }
}

const fetchAllIngredients = async () => {
  try {
    const response = await axios.get('/api/ingredients/all')
    if (response.data.success) allIngredients.value = response.data.data
  } catch (error) {
    console.error('获取所有食材失败:', error)
  }
}

const incrementIngredient = async (name) => {
  const item = allIngredients.value.find(i => i.name === name)
  const newCount = (item?.count || 0) + 1
  try {
    const response = await axios.post('/api/ingredients/batch', {
      items: [{ name, count: newCount }]
    })
    if (response.data.success) {
      ingredients.value = response.data.data
      await fetchAllIngredients()
      showToast(`${name} +1`)
    }
  } catch (error) {
    showToast('更新失败', 'warning')
  }
}

const clearIngredients = async () => {
  try {
    const response = await axios.delete('/api/ingredients')
    if (response.data.success) {
      ingredients.value = response.data.data
      await fetchAllIngredients()
      showToast('库存已清空')
    }
  } catch (error) {
    showToast('清空失败', 'warning')
  }
}

// 下厨统计
const fetchStats = async () => {
  try {
    const response = await axios.get('/api/stats/summary')
    if (response.data.success) stats.value = response.data.data
  } catch (error) {
    console.error('获取统计失败:', error)
  }
}

// 今日饮食日志
const fetchTodayLogs = async () => {
  try {
    const response = await axios.get('/api/diet-log')
    if (response.data.success) todayLogs.value = response.data.data
  } catch (error) {
    console.error('获取饮食日志失败:', error)
  }
}

// 营养汇总
const fetchNutritionSummary = async () => {
  try {
    const response = await axios.get('/api/diet-log/summary?days=7')
    if (response.data.success) nutritionSummary.value = response.data.data
  } catch (error) {
    console.error('获取营养汇总失败:', error)
  }
}

// 删除饮食记录
const deleteDietLog = async (logId) => {
  try {
    const response = await axios.delete(`/api/diet-log/${logId}`)
    if (response.data.success) {
      showToast('记录已删除')
      fetchTodayLogs()
      fetchNutritionSummary()
    }
  } catch (error) {
    showToast('删除失败', 'warning')
  }
}

// 餐次标签
const mealTypeLabel = (type) => {
  const map = { breakfast: '早餐', lunch: '午餐', dinner: '晚餐', snack: '加餐' }
  return map[type] || type
}

// 菜谱列表（周计划选菜用）
const fetchAllRecipes = async () => {
  try {
    const response = await axios.get('/api/recipes')
    if (response.data.success) allRecipes.value = response.data.data
  } catch (error) {
    console.error('获取菜谱列表失败:', error)
  }
}

// 周计划
const fetchMealPlan = async () => {
  try {
    loadingPlan.value = true
    const response = await axios.get('/api/meal-plan')
    if (response.data.success) {
      mealPlan.value = response.data.data
      planDraft.value = JSON.parse(JSON.stringify(response.data.data.days))
    }
  } catch (error) {
    console.error('获取周计划失败:', error)
    showToast('获取周计划失败', 'warning')
  } finally {
    loadingPlan.value = false
  }
}

const saveMealPlan = async () => {
  try {
    savingPlan.value = true
    const response = await axios.put('/api/meal-plan', { days: planDraft.value })
    if (response.data.success) {
      mealPlan.value = response.data.data
      showToast('周计划已保存')
    }
  } catch (error) {
    console.error('保存周计划失败:', error)
    showToast('保存失败，请重试', 'warning')
  } finally {
    savingPlan.value = false
  }
}

const recipeName = (recipeId) => {
  const r = allRecipes.value.find(x => x.id === recipeId)
  return r ? r.name : recipeId
}

const pickerRecipes = computed(() => {
  let list = allRecipes.value
  const q = planPicker.value.search.toLowerCase()
  if (q) {
    list = list.filter(r => r.name.toLowerCase().includes(q))
  }
  return list.slice(0, 100)
})

const openPlanPicker = (day, meal) => {
  planPicker.value = { open: true, day, meal, search: '' }
}

const addToPlan = (recipeId) => {
  const { day, meal } = planPicker.value
  if (!planDraft.value[day][meal].includes(recipeId)) {
    planDraft.value[day][meal].push(recipeId)
  }
}

const removeFromPlan = (day, meal, recipeId) => {
  planDraft.value[day][meal] = planDraft.value[day][meal].filter(id => id !== recipeId)
}

// 状态相关
const getStatusClass = (status) => {
  switch (status) {
    case 'pending': return 'bg-yellow-500 text-white'
    case 'cooking': return 'bg-blue-500 text-white'
    case 'completed': return 'bg-green-500 text-white'
    default: return 'bg-gray-500 text-white'
  }
}

const getStatusLabel = (status) => {
  switch (status) {
    case 'pending': return '待处理'
    case 'cooking': return '正在做'
    case 'completed': return '已完成'
    default: return '未知'
  }
}

const formatTime = (dateStr) => {
  const date = new Date(dateStr)
  return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

// 轮询
const startPolling = () => {
  pollInterval = setInterval(fetchOrders, 5000)
}

onMounted(() => {
  loadingOrders.value = true
  fetchOrders().finally(() => { loadingOrders.value = false })
  fetchIngredients()
  fetchAllIngredients()
  fetchStats()
  fetchAllRecipes()
  fetchMealPlan()
  fetchTodayLogs()
  fetchNutritionSummary()
  startPolling()
})

onUnmounted(() => {
  if (pollInterval) clearInterval(pollInterval)
})
</script>

<style scoped>
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
