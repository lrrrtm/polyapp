const bootSplashMinMs = 450
const bootSplashMaxMs = 3500

let bootResourcesReady = false
let bootAppPainted = false
let pendingBootTasks = 0
let bootHidden = false

const bootForceHideTimeout = window.setTimeout(() => {
  bootResourcesReady = true
  bootAppPainted = true
  pendingBootTasks = 0
  requestBootSplashHide()
}, bootSplashMaxMs)

export function markBootResourcesReady() {
  bootResourcesReady = true
  requestBootSplashHide()
}

export function markBootAppPainted() {
  bootAppPainted = true
  requestBootSplashHide()
}

export function waitForBootTask() {
  if (bootHidden || !document.getElementById('boot-splash')) {
    return () => undefined
  }

  let completed = false
  pendingBootTasks += 1

  return () => {
    if (completed) {
      return
    }

    completed = true
    pendingBootTasks = Math.max(0, pendingBootTasks - 1)
    requestBootSplashHide()
  }
}

export async function waitForBootResources() {
  await Promise.allSettled([
    delay(bootSplashMinMs),
    loadInterFonts(),
  ])
}

function requestBootSplashHide() {
  if (bootHidden || !bootResourcesReady || !bootAppPainted || pendingBootTasks > 0) {
    return
  }

  bootHidden = true
  window.clearTimeout(bootForceHideTimeout)
  window.requestAnimationFrame(() => window.requestAnimationFrame(hideBootSplash))
}

function hideBootSplash() {
  const bootSplash = document.getElementById('boot-splash')
  if (!bootSplash) {
    return
  }

  bootSplash.classList.add('boot-splash--hidden')
  window.setTimeout(() => bootSplash.remove(), 200)
}

async function loadInterFonts() {
  if (!document.fonts) {
    return
  }

  await Promise.all([
    document.fonts.load('400 16px Inter', 'Политехник'),
    document.fonts.load('500 16px Inter', 'Политехник'),
    document.fonts.load('600 16px Inter', 'Политехник'),
  ])
  await document.fonts.ready
}

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}
