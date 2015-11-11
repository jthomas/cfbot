'use strict'

const SlackMessageController = require('./slack_message_controller')
const EventMessage = require('./event_message')
const EventsMonitor = require('./events_monitor')
const CF_Client = require('cf-nodejs-client')

class CFBot {
  constructor (slack_bot_token, cf_endpoint, cf_credentials) {
    this.message_count = 0
    this.last_event = null

    this.filters = {
      apps: new Set('*'),
      events: new Set('*')
    }

    this.slack_message_controller = new SlackMessageController(slack_bot_token)
    this.slack_message_controller.on('ready', this.on_slack_connected.bind(this))
    SlackMessageController.COMMANDS.forEach(command => this.slack_message_controller.on(command, this['handle_' + command + '_command'].bind(this)))

    this.cf_instance = new CF_Client.CloudFoundry(cf_endpoint)
    this.cf_credentials = cf_credentials
  }

  process_filter_args (channel, filter_words, filter_set) {
    var wildcard_match = filter_words[0]
    if (wildcard_match === '*') {
      filter_set.clear()
      filter_set.add('*')
      return
    }

    if (filter_set.has('*')) {
      filter_set.delete('*')
    }

    filter_words.forEach(filter_word => filter_set.add(filter_word))
  }

  handle_filter_command (type, channel, args) {
    if (args.length) {
      this.process_filter_args(channel, args, this.filters[type])
    }
    
    var bot_response = `Now monitoring the following ${type}: ` 
      + [...this.filters[type]].join(', ')

    this.slack_message_controller.send_to_channel(channel, bot_response)
  }

  handle_events_command (channel, events) {
    this.handle_filter_command("events", channel, events)
  }

  handle_apps_command (channel, app_names) {
    this.handle_filter_command("apps", channel, app_names)
  }

  handle_status_command (channel) {
    var apps = [...this.filters.apps].join(', '),
      events = [...this.filters.events].join(', ')

    var response_lines = [`Connected to ${this.cf_instance.API_URL}, registered ${this.message_count} messages since monitoring started.`]

    if (this.last_event) {
      response_lines.push(`Last event for _${this.last_event.actee_name}_ on _${this.last_event.timestamp}_.`)
    }

    response_lines.push(`Monitoring the following apps: ${apps}`,
      `Monitoring the following events: ${events}`)

    this.slack_message_controller.send_to_channel(channel, response_lines.join('\n'))
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

  match_filter_set (set, value) {
    return (set.has('*') || set.has(value))
  }

  on_cf_event (event) {
    this.message_count++
    this.last_event = event
    console.log('New event:', event)
    var messages = EventMessage(event)
    console.log(messages)
    if (this.match_filter_set(this.filters.apps, event.actee_name)
        && this.match_filter_set(this.filters.events, event.type)) {
      this.slack_message_controller.send_to_all_channels(messages.join('\n'))
    }
  }
}

module.exports = CFBot
