<template>
  <div class="min-h-screen bg-canvas">
    <!-- 厨艺小课堂（独立全屏视图，返回后保留角色） -->
    <TipsView
      v-if="showTips"
      @back="showTips = false"
    />

    <!-- 角色选择页面 -->
    <div v-else-if="!currentRole" class="min-h-screen flex items-center justify-center bg-canvas">
      <div class="max-w-md mx-auto px-lg text-center">
        <h1 class="font-display text-hero-display text-ink mb-lg">Amazing Food</h1>
        <p class="font-body text-lead text-ink-muted-80 mb-xxl">你是谁？</p>

        <div class="space-y-lg">
          <button
            @click="selectRole('guest', '大小姐')"
            class="w-full btn-store-hero apple-interaction"
          >
            <div class="flex items-center justify-center gap-sm">
              <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
              </svg>
              <span class="font-body text-body-strong">大小姐</span>
            </div>
            <p class="font-body text-caption text-white/80 mt-xs">浏览菜谱，点菜下单</p>
          </button>

          <button
            @click="selectRole('guest', '母上大人')"
            class="w-full btn-store-hero apple-interaction"
          >
            <div class="flex items-center justify-center gap-sm">
              <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
              </svg>
              <span class="font-body text-body-strong">母上大人</span>
            </div>
            <p class="font-body text-caption text-white/80 mt-xs">浏览菜谱，点菜下单</p>
          </button>

          <div class="border-t border-divider-soft pt-lg">
            <button
              @click="selectRole('cook')"
              class="w-full btn-secondary-pill apple-interaction"
            >
              <div class="flex items-center justify-center gap-sm">
                <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path>
                </svg>
                <span class="font-body text-body-strong">饲养员</span>
              </div>
              <p class="font-body text-caption text-ink-muted-80 mt-xs">接收订单，准备饭菜</p>
            </button>
          </div>

          <button
            @click="showTips = true"
            class="w-full text-link font-body text-caption apple-interaction py-sm"
          >
            📖 厨艺小课堂
          </button>
        </div>
      </div>
    </div>

    <!-- 食客界面 -->
    <GuestView
      v-else-if="currentRole === 'guest'"
      :guestName="guestName"
      @switchRole="switchRole"
      @showTips="showTips = true"
    />

    <!-- 饲养员界面 -->
    <CookView
      v-else-if="currentRole === 'cook'"
      @switchRole="switchRole"
      @showTips="showTips = true"
    />
  </div>
</template>

<script setup>
import { ref } from 'vue'
import GuestView from './components/GuestView.vue'
import CookView from './components/CookView.vue'
import TipsView from './components/TipsView.vue'

const ROLE_KEY = 'af-role'
const NAME_KEY = 'af-guest-name'

// 恢复上次选择的角色（只恢复 guest，cook 每次需手动选择）
const savedRole = localStorage.getItem(ROLE_KEY)
const currentRole = ref(savedRole === 'guest' ? 'guest' : null)
const guestName = ref(currentRole.value === 'guest' ? (localStorage.getItem(NAME_KEY) || '') : '')
const showTips = ref(false)

const selectRole = (role, name = '') => {
  currentRole.value = role
  guestName.value = name
  localStorage.setItem(ROLE_KEY, role)
  localStorage.setItem(NAME_KEY, name)
}

const switchRole = () => {
  currentRole.value = null
  guestName.value = ''
  localStorage.removeItem(ROLE_KEY)
  localStorage.removeItem(NAME_KEY)
}
</script>
