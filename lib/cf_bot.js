'use strict'

const SlackMessageController = require('./slack_message_controller')
const EventMessage = require('./event_message')
const EventsMonitor = require('./events_monitor')
const CF_Client = require('cf-nodejs-client')

class CFBot {
  constructor (slack_bot_token, cf_endpoint, cf_credentials) {
    this.monitor_apps = new Set('*')
    this.slack_message_controller = new SlackMessageController(slack_bot_token)
    this.slack_message_controller.on('ready', this.on_slack_connected.bind(this))
    this.slack_message_controller.on('monitor', this.handle_monitor_command.bind(this))
    this.cf_instance = new CF_Client.CloudFoundry(cf_endpoint)
    this.cf_credentials = cf_credentials
  }

  handle_monitor_command (channel, app_names) {
    var bot_response = 'monitor command help text.'

    if (app_names.length) {
      var wildcard_match = app_names[0]
      if (wildcard_match === '*') {
        this.monitor_apps.clear()
      } else {
        this.monitor_apps.delete('*')
      }

      app_names.forEach(app_name => this.monitor_apps.add(app_name))
      bot_response = 'now monitoring the following apps: ' + [...this.monitor_apps].join(', ')
    }

    this.slack_message_controller.send_to_channel(channel, bot_response)
  }

  on_slack_connected () {
    this.slack_message_controller.send_to_all_channels(`Reporting for duty, sir.\nAttempting to connect to ${this.cf_instance.API_URL}`)
    this.refresh_cf_tokens(this.update_cf_tokens.bind(this))
  }

  update_cf_tokens (tokens) {
    if (this.events_monitor) this.events_monitor.stop()

    this.events_monitor = new EventsMonitor(this.cf_instance.API_URL, tokens)
    this.events_monitor.on('event', this.on_cf_event.bind(this))
    this.events_monitor.start()

    this.slack_message_controller.send_to_all_channels('Authentication successful. Now monitoring application statuses. :100:')
  }

  refresh_cf_tokens (cb) {
    var creds = this.cf_credentials

    var error = function (msg) {
      console.error(msg)
    }
    this.cf_instance.getInfo()
     .then(result => this.cf_instance.login(result.authorization_endpoint, creds.username, creds.password).then(this.update_cf_tokens.bind(this)).catch(error))
     .catch(error)
  }

  on_cf_event (event) {
    console.log('New event:', event)
    var messages = EventMessage(event)
    console.log(messages)
    if (this.monitor_apps.has('*') || this.monitor_apps.has(event.actee_name)) {
      this.slack_message_controller.send_to_all_channels(messages.join('\n'))
    }
  }
}

module.exports = CFBot
