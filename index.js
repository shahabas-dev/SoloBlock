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

/**
 * Starts anti-AFK behavior and returns a stop handler.
 * Uses a lightweight interval ticker and schedules a new action every 10-20 seconds.
 */
function startAntiAFK (bot) {
  let actionInterval = null
  let movementTimeout = null
  let isMoving = false
  let nextActionAt = Date.now() + randomInt(10000, 20000)

  const MOVEMENT_ACTIONS = ['forward', 'back', 'left', 'right', 'jump']
  const CONTROL_STATES = ['forward', 'back', 'left', 'right', 'jump', 'sprint', 'sneak']

  function resetControls () {
    for (const state of CONTROL_STATES) {
      bot.setControlState(state, false)
    }
  }

  function rotateCamera () {
    if (!bot.entity) return

    const currentYaw = bot.entity.yaw
    const currentPitch = bot.entity.pitch

    // Small smooth offsets to mimic natural head movement.
    const yawOffset = (Math.random() - 0.5) * 0.24
    const pitchOffset = (Math.random() - 0.5) * 0.12

    const nextYaw = currentYaw + yawOffset
    const nextPitch = clamp(currentPitch + pitchOffset, -1.2, 1.2)

    bot.look(nextYaw, nextPitch, false).catch((err) => {
      console.error('[ANTI-AFK] look() failed:', err.message)
    })
  }

  function doMovementAction () {
    if (!config.useMovement || !bot.entity || isMoving) return

    isMoving = true
    resetControls()

    const action = MOVEMENT_ACTIONS[randomInt(0, MOVEMENT_ACTIONS.length - 1)]
    const duration = randomInt(1000, 3000)

    bot.setControlState(action, true)
    console.log(`[ANTI-AFK] Movement: ${action} (${duration}ms)`)

    movementTimeout = setTimeout(() => {
      resetControls()
      isMoving = false
    }, duration)
  }

  function runStep () {
    if (!bot.entity) return

    // Camera movement is occasional to avoid repetitive patterns.
    if (Math.random() < 0.75) {
      rotateCamera()
    }

    doMovementAction()
  }

  function stop () {
    if (actionInterval) {
      clearInterval(actionInterval)
      actionInterval = null
    }

    if (movementTimeout) {
      clearTimeout(movementTimeout)
      movementTimeout = null
    }

    isMoving = false
    resetControls()
    console.log('[ANTI-AFK] Stopped')
  }

  actionInterval = setInterval(() => {
    if (Date.now() < nextActionAt) return

    runStep()
    nextActionAt = Date.now() + randomInt(10000, 20000)
  }, 1000)

  console.log('[ANTI-AFK] Started')
  return { stop }
}

/**
 * Creates and starts a Mineflayer bot instance.
 */
function createBot () {
  const bot = mineflayer.createBot({
    host: config.host,
    port: config.port,
    username: config.username,
    auth: 'offline' // cracked/offline-mode by default
  })

  let antiAfkController = null

  /**
   * Sends a command with a short delay to reduce command race conditions.
   */
  function sendCommandSafely (command, delayMs) {
    setTimeout(() => {
      if (!bot.player) return
      bot.chat(command)
      console.log(`[COMMAND] ${command}`)
    }, delayMs)
  }

  bot.once('spawn', () => {
    console.log('Bot joined the server')

    if (config.password && config.password.trim() !== '') {
      sendCommandSafely(`/login ${config.password}`, 1000)
    }

    sendCommandSafely('/gamemode spectator', 2000)
    antiAfkController = startAntiAFK(bot)
  })

  bot.on('kicked', (reason) => {
    console.log('[KICKED]', reason)
  })

  bot.on('error', (err) => {
    console.error('[ERROR]', err.message)
  })

  bot.on('end', () => {
    console.log(`[DISCONNECTED] Reconnecting in ${RECONNECT_DELAY_MS / 1000}s...`)

    if (antiAfkController) {
      antiAfkController.stop()
      antiAfkController = null
    }

    scheduleReconnect()
  })
}

/**
 * Schedules a reconnect attempt after a fixed delay.
 */
function scheduleReconnect () {
  if (reconnectTimer) return

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null
    createBot()
  }, RECONNECT_DELAY_MS)
}

function randomInt (min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function clamp (value, min, max) {
  return Math.max(min, Math.min(max, value))
}

createBot()
