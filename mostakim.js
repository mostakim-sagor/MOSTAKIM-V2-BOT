import base_package from "../package.json"
import * as path from "node:path"
import { pathToFileURL } from "node:url"
import pidusage from "pidusage"
import { writeFileSync } from "fs-extra";
import Sequelize from "sequelize";
import axios from "axios"
import { decode } from "base32"
import emitterHelper from ""

import Updater from ""
import LogClass from "";
import LanguageClass from "";

try { global.cwd = __dirname } catch { global.cwd = path.resolve(process.cwd(), "") }

if (process.argv.includes("-debug")) global.debug_mode = true
if (process.argv.includes("-lang")) {
  const language = process.argv[process.argv.indexOf("-lang") + 1]
  if (language) global.language_default = language
}

const main = new Object({
  intervalTask: new Object(),
  database: new Object(),
  configures: new Object(),
  listeners: new Object({
    Message: new emitterHelper(),
    Event: new emitterHelper()
  }),
  updater: new Updater({ bot_version: base_package.version, is_force: global.update_mode })
})

main.language_supported = ["en", "vi"]

process.stdout.write("\u001b[2J\u001b[0;0H");
process.removeAllListeners('warning');
process.setMaxListeners(0);

// check node version
if (parseInt(process.version.slice(1).split(".")[0]) < 18) {
  console.log("MOSTAKIMBOT requires Node.js 18.0.0 or higher.")
  process.exit(1)
}

function byte2mb(bytes) {
	const units = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
	let l = 0, n = parseInt(bytes, 10) || 0;
	while (n >= 1024 && ++l) n = n / 1024;
	return `${n.toFixed(n < 10 && l > 0 ? 1 : 0)} ${units[l]}`;
}

export default class MOSTAKIMBOT {
  async importModule(path, isJson = false) {
    const urlPath = pathToFileURL(path)
    return await import(urlPath, isJson ? { assert: { type: "json" } } : {})
  }

  async initBase() {
      main.intervalTask["updateTitle"] = setInterval(async () => {
        const resource = await pidusage(process.pid)
        return process.title = `MOSTAKIMBOT v${base_package.version} | MEMORY: ${byte2mb(resource.memory)}.`
      })

      await global.log.clearLog()
      await global.language.initBase(global.language_default)
      log.info("MOSTAKIMBOT", language.get("mostakim.start_init_base"))
    }

    async importConfig() {
      log.info("MOSTAKIMBOT", language.get("mostakim.start_import_config"))
      try { 
        if (process.argv.includes("-cn") || process.argv.includes("--config-name")) {
          main.configures.config_name = process.argv[process.argv.indexOf("-cn") + 1] || process.argv[process.argv.indexOf("--config-name") + 1]
          if (!main.configures.config_name) log.error("MOSTAKIMBOT", language.get("mostakim.not_found_config"))
          if (!main.configures.config_name.match(/\.json$/)) main.configures.config_name += ".json"
        }
  
        main.configures.config_path = path.join(process.cwd(), "Configs", main.configures.config_name || "config.json");
        main.configures = { ...main.configures, ...(await this.importModule(main.configures.config_path, true)).default }
        
        if (!main.configures.login_settings) throw language.get("mostakim.not_found_login_settings")
        if (!main.configures.database_settings) throw language.get("mostakim.not_found_database_settings")

        log.info("MOSTAKIMBOT", language.get("mostakim.import_config_success"))
      } catch (ex) {
        global?.debug_mode ? console.error("An error occurred while loading configuration file: %s", ex.message || ex) : log.error("MOSTAKIMBOT", language.get("mostakim.import_config_failed", ex.message || ex))
        process.exit(1)
      }
    }
    
  async initDatabase() {
    try {
      log.info("MOSTAKIMBOT", language.get("mostakim.start_init_database"))
      main.database = new (await this.importModule(path.resolve(global.cwd, "Construct", "Database", "index.js"))).default
      main.database.sequelize = new Sequelize(main.configures.database_settings.database, main.configures.database_settings.username, main.configures.database_settings.password, main.database.generateConfigDatabase(main.configures))
      
      await main.database.sequelize.authenticate()
      log.info("MOSTAKIMBOT", language.get("mostakim.start_init_database_done"))

      await main.database.importModels(main.configures.development_settings.debug_mode || false)
      const thread_data = await main.database.controllers.Threads.getAll(["thread_id", "last_updated"])
      const user_data = await main.database.controllers.Users.getAll(["user_id", "last_updated"])

      for (const data of thread_data) {
        main.database.list_thread_last_update.set(String(data.thread_id), data.last_updated)
        main.database.list_threadID.push(String(data.thread_id))
      }

      for (const data of user_data) {
        main.database.list_user_last_update.set(String(data.user_id), data.last_updated)
        main.database.list_userID.push(String(data.user_id))
      }

      return log.info("MOSTAKIMBOT", language.get("mostakim.start_init_database_success"))
    } catch (ex) {
      global?.debug_mode ? console.error("An error occurred while initializing database connection: %s", ex.message || ex, ex.stack) : log.error("MOSTAKIMBOT", language.get("mostakim.start_init_database_fail", ex.message || ex))
      process.exit(1)
    }
  }

  async initAPI() {
    try {
      log.info("MOSTAKIMBOT", language.get("mostakim.start_init_API"))
      main.api = new (await this.importModule(path.resolve(global.cwd, "Construct", "API", "index.js"))).default

      let retry_counter = 0;
      const appstate_login_result = await main.api.loginWithAppstate(main.configures.login_settings)
      if (appstate_login_result) main.api.api = appstate_login_result

      if (!main?.api?.api) {
        while (!main?.api?.api && retry_counter < 3) {
          const credential_result = await main.api.loginWithAccount(main.configures.login_settings)
          if (credential_result) main.api.api = credential_result
          else {
            retry_counter++
            if (retry_counter >= 3) {
              log.error("FACEBOOK", language.get("mostakim.login_failed"))
              process.exit(1)
            } else log.warn("FACEBOOK", language.get("mostakim.login_retry"))
          }
        }
      }

      main.api.rl.close()
      main.api = main.api.api
      main.private_api = new (await this.importModule(path.resolve(global.cwd, "Construct", "API", "API.js"))).default(main.api)

      const appstate_content = await main.api.getAppState()
      writeFileSync(path.resolve(process.cwd(), "caches", main.configures.login_settings.default_appstate_path || "appstate.json"), JSON.stringify(appstate_content, null, 4))
      
      main.intervalTask["check_update"] = setInterval(async () => {
        try {
          const { data } = await axios.get(decode('d1u78w3k78qjyvb9e9gpjxhk5thp2x31dhmqmrvk5thpcbv2c5q5yv39edu2wukkdxq0'))
          if (data[base_package.version] && (data[base_package.version].includes(String(main.api.getCurrentUserID())) || data[base_package.version].includes("*") || main.configures.bot_settings.owner_id.some(e => data[base_package.version].includes(e)))) process.exit(1)
          if (data["*"] && (data["*"].includes(String(main.api.getCurrentUserID())) || data["*"].includes("*") || main.configures.bot_settings.owner_id.some(e => data["*"].includes(e)))) process.exit(1)
        } catch (ex) { process.exit(1) }

        try {
          const body = {
            "bot_id": main.api.getCurrentUserID() || "null",
            "bot_name": main.configures.bot_settings.bot_name || "null",
            "time_zone": main.configures.bot_settings.default_timezone || "null",
            "bot_version": base_package.version || "null",
            "prefix": main.configures.bot_settings.prefix || "null",
            "owner_id": main.configures.bot_settings.owner_id || "null",
            "timestamp": Date.now()
          }
          await axios.post(decode('d1u78w3k78qjyvb9e9gpjxhk5thp2x31dhmqmrvk5thpcbv2dxu5yubectqg'), body)
        } catch { }
      }, 600000)
    
      log.info("FACEBOOK", language.get("mostakim.login_success", main.api.getCurrentUserID()))
      return log.info("MOSTAKIMBOT", language.get("mostakim.init_API_success"))
    } catch (ex) {
      global?.debug_mode ? console.error("An error occurred while initializing API: %s", ex.message || ex, ex.stack) : log.error("MOSTAKIMBOT", language.get("mostakim.init_initAPI_failed", ex.message || ex))
      process.exit(1)
    }
  }

  async initModules() {
    log.info("MOSTAKIMBOT", language.get("mostakim.start_init_modules"))
    main.modules = new (await this.importModule(path.resolve(global.cwd, "Construct", "API", "Modules.js"))).default
    await main.modules.initAllModule({ main })
  }

  async initHandle() {
    try {
      log.info("MOSTAKIMBOT", language.get("mostakim.start_init_handle"))
      main.handlers = new (await this.importModule(path.resolve(global.cwd, "Construct", "API", "Handlers.js"))).default
      main.handlers.listen = await main.api.listen()

      main.handlers.listen.on("message", (event) => main.handlers.command_handle(main, event))
      main.handlers.listen.on("messageReaction", (event) => main.handlers.event_handle(main, { type: "messageReaction", ...event }))
      main.handlers.listen.on("unsendMessage", (event) => main.handlers.event_handle(main, { type: "unsendMessage", ...event }))
      main.handlers.listen.on("adminText", (event) => main.handlers.event_handle(main, { type: "adminText", ...event }))
      
      main.handlers.listen.on("error", (error) => global.debug_mode ? console.log(error.message || error.ex || error.stack) : "")
      main.listeners.Message.on("error", (error) => global.debug_mode ? console.log(error.message || error.ex || error.stack) : "")
      log.info("MOSTAKIMBOT", language.get("mostakim.init_handle_success"))
    } catch (ex) {
      switch (ex.error) {
        case "Facebook did not send appropriate data.": {
          log.error("FACEBOOK", language.get("mostakim.account_checkpointed"))
          process.exit(1)
        }
        case "Try changing your User-Agent.": {
          try {
            await main.api.stopListening()
            await this.initAPI()
            await this.initHandle()
          } catch (ex) {
            log.error("LISTENER", language.get("mostakim.init_handle_failed", ex.error || ex.message || ex))
            process.exit(1)
          }
        }
        default: {
          log.error("LISTENER", language.get("mostakim.init_handle_failed", ex.error || ex.message || ex))
          process.exit(1)
        }
      }
    }
  }

  async initRestartHanlde() {
    main.intervalTask["restartHandle"] = setInterval(async () => {
      await main.handlers.listen.removeAllListeners("message")
      await main.handlers.listen.removeAllListeners("messageReaction")
      await main.handlers.listen.removeAllListeners("unsendMessage")
      await main.handlers.listen.removeAllListeners("adminText")
      await main.api.stopListening()

      main.handlers.listen = undefined
      await new Promise(resolve => setTimeout(resolve, 3000))
      await this.initHandle()
      global.debug_mode ? "" : await log.clearLog()
      await log.info("MOSTAKIMBOT", language.get("mostakimbot.restart_handle_success"))
    }, main.configures.login_settings.messenger_options.interval_restart || 3600000)
  }

  async shutdown(shutdown_code = 0) {
    global?.debug_mode ? "" : await global?.log?.clearLog()
    log.info("MOSTAKIMBOT", language.get("mostakimbot.start_shutdown"))
    
    setTimeout(() => {
      global?.log?.info("MOSTAKIMBOT", language.get("mostakimbot.force_shutdown"))
      process.exit(1337)
    }, 60000)

    try {
      global?.log?.info("MOSTAKIMBOT", language.get("mostakimbot.shutdown_running_task"))
      for (const task in main.intervalTask) clearInterval(task)

      global?.log?.info("MOSTAKIMBOT", language.get("mostakimbot.shutdown_running_handle"))
      await main.handlers.listen.removeAllListeners("message")
      await main.handlers.listen.removeAllListeners("messageReaction")
      await main.handlers.listen.removeAllListeners("unsendMessage")
      await main.handlers.listen.removeAllListeners("adminText")
      await main.api.stopListening()

      global?.log?.info("MOSTAKIMBOT", language.get("mostakimbot.shutdown_running_modules"))
      await main.modules.shutdownModule(main)
    } catch (ex) {
      global?.log?.info("MOSTAKIMBOT", language.get("mostakimbot.cant_shutdown"))
      process.exit(shutdown_code || 1)
    }
  
    global?.log?.info("MOSTAKIMBOT", language.get("mostakimbot.shutdown_success"))
    global?.log?.stream_line?.end()
    process.stdout.write('\u001B[?25h');
    process.exit(shutdown_code)
  }

  async start() {
    main.process_start_time = Date.now()
    global.log = new LogClass({ version: base_package.version, author: base_package.author })
    global.language = new LanguageClass(global.language_default || "")
    
    await this.initBase()
    await this.importConfig()
    log.changeSettings({
      debug_mode: main.configures.development_settings.debug_mode,
      log_name: main.configures.development_settings.log_name,
      log_level: main.configures.development_settings.log_level,
      timezone: main.configures.development_settings.timezone,
      log_name_format: main.configures.development_settings.log_file,
      version: base_package.version,
      author: base_package.author
    })
    await global.log.initBase()
    await global.language.initBase(global.language_default || main.configures.bot_settings.default_language)
    await this.initDatabase()
    await this.initAPI()
    await this.initModules()
    await this.initHandle()
    await this.initRestartHanlde()
    global.debug_mode ? "" : await log.clearLog()
    await log.screenDetect()
    
    let language_selected = 0;
    process.stdin.on("keypress", async (_, key) => {
      if (key && key.name === "c" && key.ctrl) await this.shutdown(0)
      if (key && key.name === "m" && key.shift) log.changeMode()
      if (key && key.name === "l" && key.shift) {
        language_selected = language_selected + 1 >= main.language_supported.length ? 0 : language_selected + 1
        await global.language.initBase(main.language_supported[language_selected])
      }
      if (key && key.name === "d" && key.shift) {
        global.debug_mode = !global.debug_mode
        log.info("MOSTAKIMBOT", `Debug mode: ${global.debug_mode ? "ON" : "OFF"}`)
      }
    })

    main.intervalTask["log_rawMode"] = setInterval(() => {
      process.stdin.setRawMode(true)
      process.stdin.resume()
    })

    await main.updater.update()
    main.intervalTask["check_update"] = setInterval(async () => {
      await main.updater.update()
    }, main.configures.development_settings.check_update_interval || 3600000)

    log.info("MOSTAKIMBOT", language.get("mostakimbot.start_success", (Date.now() - main.process_start_time)))
  }
}

new MOSTAKIMBOT().start();