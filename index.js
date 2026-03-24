const mineflayer = require('mineflayer')

// ---------------------------
// Bot configuration
// ---------------------------
const config = {
  host: 'soloblock.falix.app',
  port: 21858,
  username: 'SoloBlock',
  password: '',
  useMovement: true
}

const RECONNECT_DELAY_MS = 5000
let reconnectTimer = null

// 🔒 Target position (LOCK POINT)
const targetPos = { x: 0, y: 100, z: 0 }

/**
 * Creates and starts a Mineflayer bot instance.
 */
function createBot () {
  const bot = mineflayer.createBot({
    host: config.host,
    port: config.port,
    username: config.username,
    auth: 'offline'
  })

  let antiAfkTimeout = null

  function sendCommandSafely (command, delayMs) {
    setTimeout(() => {
      if (!bot.player) return
      bot.chat(command)
      console.log(`[COMMAND] ${command}`)
    }, delayMs)
  }

  // 🔒 POSITION LOCK SYSTEM
  function lockPosition () {
    setInterval(() => {
      if (!bot.entity) return

      const pos = bot.entity.position

      const dx = Math.abs(pos.x - targetPos.x)
      const dy = Math.abs(pos.y - targetPos.y)
      const dz = Math.abs(pos.z - targetPos.z)

      if (dx > 2 || dy > 2 || dz > 2) {
        console.log('[LOCK] Returning to center')

        bot.lookAt(targetPos, true)
        bot.setControlState('forward', true)

        setTimeout(() => {
          bot.clearControlStates()
        }, 800)
      }
    }, 2000)
  }

  function runAntiAfkStep () {
    if (!bot.entity) {
      scheduleNextAntiAfkStep()
      return
    }

    // 👀 Camera movement
    const yaw = Math.random() * Math.PI * 2
    const pitch = (Math.random() - 0.5) * Math.PI
    bot.look(yaw, pitch, true)

    // 🔥 SAFE MOVEMENT (no forward/back)
    bot.clearControlStates()

    if (config.useMovement) {
      const actions = ['left', 'right', 'jump']
      const action = actions[Math.floor(Math.random() * actions.length)]

      console.log(`[MOVE] ${action}`)

      if (action === 'jump') {
        bot.setControlState('jump', true)
        setTimeout(() => bot.setControlState('jump', false), 500)
      } else {
        bot.setControlState(action, true)
        setTimeout(() => bot.setControlState(action, false), 500)
      }
    }

    scheduleNextAntiAfkStep()
  }

  function scheduleNextAntiAfkStep () {
    const delay = Math.floor(Math.random() * 5000) + 10000
    antiAfkTimeout = setTimeout(runAntiAfkStep, delay)
  }

  function startAntiAfk () {
    stopAntiAfk()
    console.log('[ANTI-AFK] Started')
    scheduleNextAntiAfkStep()
  }

  function stopAntiAfk () {
    if (antiAfkTimeout) {
      clearTimeout(antiAfkTimeout)
      antiAfkTimeout = null
    }
    bot.clearControlStates()
  }

  bot.once('spawn', () => {
    console.log('Bot joined the server')

    if (config.password) {
      sendCommandSafely(`/login ${config.password}`, 1000)
    }

    sendCommandSafely('/gamemode spectator', 2000)

    lockPosition() // 🔥 ADD THIS
    startAntiAfk()
  })

  bot.on('kicked', (reason) => {
    console.log('[KICKED]', reason)
  })

  bot.on('error', (err) => {
    console.error('[ERROR]', err.message)
  })

  bot.on('end', () => {
    console.log('Disconnected... reconnecting')
    stopAntiAfk()
    setTimeout(createBot, RECONNECT_DELAY_MS)
  })
}

createBot()
