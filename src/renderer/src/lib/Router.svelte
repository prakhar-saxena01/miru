<script context='module'>
  import { writable } from 'svelte/store'

  export const files = writable([])

  </script>

<script>
  import Home from './pages/home/Home.svelte'
  import Player from './pages/Player.svelte'
  import Settings from './pages/Settings.svelte'
  import Schedule from './pages/Schedule.svelte'
  export let page = 'home'
</script>

<div class="overflow-y-hidden content-wrapper">
  <Player files={$files} miniplayer={page !== 'player'} bind:page />
  {#if page === 'schedule'}
    <Schedule />
  {:else if page === 'settings'}
    <Settings />
  {:else if page === 'home'}
    <Home />
  {/if}
</div>

<style>
  .content-wrapper {
    will-change: width;
  }
  :global(.nav-hidden) > .content-wrapper {
    left: 0 !important;
    width: 100% !important;
  }
</style>
