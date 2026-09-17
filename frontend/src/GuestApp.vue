<template>
  <div class="min-h-screen bg-canvas">
    <TipsView
      v-if="showTips"
      @back="showTips = false"
    />

    <!-- 角色选择（大小姐 / 母上大人） -->
    <div v-else-if="!guestName" class="min-h-screen flex items-center justify-center bg-canvas">
      <div class="max-w-md mx-auto px-lg text-center">
        <h1 class="font-display text-hero-display text-ink mb-lg">Amazing Food</h1>
        <p class="font-body text-lead text-ink-muted-80 mb-xxl">你是谁？</p>

        <div class="space-y-lg">
          <button
            @click="selectGuest('大小姐')"
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
            @click="selectGuest('母上大人')"
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
      v-else
      :guestName="guestName"
      @switchRole="switchGuest"
      @showTips="showTips = true"
    />
  </div>
</template>

<script setup>
import { ref } from 'vue'
import GuestView from './components/GuestView.vue'
import TipsView from './components/TipsView.vue'

const NAME_KEY = 'af-guest-name'

const guestName = ref(localStorage.getItem(NAME_KEY) || '')
const showTips = ref(false)

const selectGuest = (name) => {
  guestName.value = name
  localStorage.setItem(NAME_KEY, name)
}

const switchGuest = () => {
  guestName.value = ''
  localStorage.removeItem(NAME_KEY)
}
</script>
