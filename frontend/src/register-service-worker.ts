if ('serviceWorker' in navigator && import.meta.env.PROD) {
  const hadController = navigator.serviceWorker.controller !== null
  let refreshing = false

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || refreshing) {
      return
    }

    refreshing = true
    window.location.reload()
  })

  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').then((registration) => registration.update())
  })
}
