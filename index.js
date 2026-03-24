const mineflayer = require("mineflayer");

// ---------------------------
// Bot configuration
// ---------------------------
const config = {
  host: "soloblock.falix.app",

  port: 21858,
  username: "SoloBlock",
  password: "",
  useMovement: true,
};

const RECONNECT_DELAY_MS = 5000;
let reconnectTimer = null;

/**
 * Creates and starts a Mineflayer bot instance.
 */
function createBot() {
  const bot = mineflayer.createBot({
    host: config.host,
    port: config.port,
    username: config.username,
    auth: "offline", // cracked/offline-mode by default
  });

  let antiAfkTimeout = null;

  /**
   * Sends a command with a short delay to reduce command race conditions.
   */
  function sendCommandSafely(command, delayMs) {
    setTimeout(() => {
      if (!bot.player) return;
      bot.chat(command);
      console.log(`[COMMAND] ${command}`);
    }, delayMs);
  }

  /**
   * Performs one anti-AFK action and schedules the next one.
   */
  function runAntiAfkStep() {
    if (!bot.entity) {
      scheduleNextAntiAfkStep();
      return;
    }

    // Slight camera movement (primary anti-AFK behavior)
    const currentYaw = bot.entity.yaw;
    const currentPitch = bot.entity.pitch;

    // Tiny angle changes to look human-like while staying almost still
    const yawOffset = (Math.random() - 0.5) * 0.16; // approx +/- 9 degrees
    const pitchOffset = (Math.random() - 0.5) * 0.08; // approx +/- 4.5 degrees

    const nextYaw = currentYaw + yawOffset;
    const nextPitch = clamp(currentPitch + pitchOffset, -1.2, 1.2);

    bot.look(nextYaw, nextPitch, true).catch((err) => {
      console.error("[ANTI-AFK] look() failed:", err.message);
    });

    // Optional tiny movement pulse (easy to toggle via config.useMovement)
    if (config.useMovement) {
      const actions = ["forward", "back", "left", "right", "jump"];
      const action = actions[Math.floor(Math.random() * actions.length)];

      console.log(`[MOVE] ${action}`);

      if (action === "jump") {
        bot.setControlState("jump", true);
        setTimeout(() => bot.setControlState("jump", false), 800);
      } else {
        bot.setControlState(action, true);

        // sometimes sprint for realism
        if (Math.random() < 0.3) {
          bot.setControlState("sprint", true);
        }

        setTimeout(
          () => {
            bot.setControlState(action, false);
            bot.setControlState("sprint", false);
          },
          randomInt(800, 2000),
        );
      }
    }

    scheduleNextAntiAfkStep();
  }

  /**
   * Schedules the next anti-AFK step every 10-15 seconds.
   */
  function scheduleNextAntiAfkStep() {
    const delay = randomInt(10000, 15000);
    antiAfkTimeout = setTimeout(runAntiAfkStep, delay);
  }

  /**
   * Starts anti-AFK loop.
   */
  function startAntiAfk() {
    stopAntiAfk();
    console.log("[ANTI-AFK] Started");
    scheduleNextAntiAfkStep();
  }

  /**
   * Stops anti-AFK loop and movement state.
   */
  function stopAntiAfk() {
    if (antiAfkTimeout) {
      clearTimeout(antiAfkTimeout);
      antiAfkTimeout = null;
    }
    bot.setControlState("forward", false);
  }

  bot.once("spawn", () => {
    console.log("Bot joined the server");

    if (config.password && config.password.trim() !== "") {
      sendCommandSafely(`/login ${config.password}`, 1000);
    }

    sendCommandSafely("/gamemode spectator", 2000);
    startAntiAfk();
  });

  bot.on("kicked", (reason) => {
    console.log("[KICKED]", reason);
  });

  bot.on("error", (err) => {
    console.error("[ERROR]", err.message);
  });

  bot.on("end", () => {
    console.log(
      `[DISCONNECTED] Reconnecting in ${RECONNECT_DELAY_MS / 1000}s...`,
    );
    stopAntiAfk();
    scheduleReconnect();
  });
}

/**
 * Schedules a reconnect attempt after a fixed delay.
 */
function scheduleReconnect() {
  if (reconnectTimer) return;

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    createBot();
  }, RECONNECT_DELAY_MS);
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

createBot();
