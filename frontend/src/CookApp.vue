<template>
  <div class="min-h-screen bg-canvas">
    <TipsView
      v-if="showTips"
      @back="showTips = false"
    />
    <CookView
      v-else
      @showTips="showTips = true"
    />
  </div>
</template>

<script setup>
import { ref } from 'vue'
import CookView from './components/CookView.vue'
import TipsView from './components/TipsView.vue'

const showTips = ref(false)
</script>
