'use strict'

const SlackMessageController = require('./slack_message_controller')
const EventMessage = require('./event_message')
const EventsMonitor = require('./events_monitor')
const EventFilter = require('./event_filter')
const CF_Client = require('cf-nodejs-client')
const winston = require('winston')

class CFBot {
  constructor (slack_bot_token, cf_endpoint, cf_credentials) {
    winston.info(`Connecting to Slack using the following token: ${slack_bot_token}`)

    this.message_count = 0
    this.last_event = null

    this.filters = {
      apps: new EventFilter('actee_name'),
      events: new EventFilter('type')
    }

    this.slack_message_controller = new SlackMessageController(slack_bot_token)
    this.slack_message_controller.on('ready', this.on_slack_connected.bind(this))

    SlackMessageController.COMMANDS.forEach(command => {
      this.slack_message_controller.on(command, this['handle_' + command + '_command'].bind(this))
    })

    this.cf_instance = new CF_Client.CloudFoundry(cf_endpoint)
    this.cf_credentials = cf_credentials

    this.events_monitor = new EventsMonitor(cf_endpoint)
    this.events_monitor.on('event', this.on_cf_event.bind(this))
  }

  handle_filter_command (type, channel, args) {
    if (args.length) {
      var filter = this.filters[type]
      args.forEach(filter.add_filter.bind(filter))
    }

    var bot_response = `Now monitoring the following ${type}: `
      + [...this.filters[type].filters].join(', ')

    this.slack_message_controller.send_to_channel(channel, bot_response)
  }

  handle_events_command (channel, events) {
    this.handle_filter_command('events', channel, events)
  }

  handle_apps_command (channel, app_names) {
    this.handle_filter_command('apps', channel, app_names)
  }

  handle_status_command (channel) {
    var apps = [...this.filters.apps.filters].join(', '),
      events = [...this.filters.events.filters].join(', ')

    var response_lines = [`Connected to ${this.cf_instance.API_URL}, registered ${this.message_count} messages since monitoring started.`]

    if (this.last_event) {
      response_lines.push(`Last event for _${this.last_event.actee_name}_ on _${this.last_event.timestamp}_.`)
    }

    response_lines.push(`Monitoring the following apps: ${apps}`,
      `Monitoring the following events: ${events}`)

    this.slack_message_controller.send_to_channel(channel, response_lines.join('\n'))
  }

  on_slack_connected (channels) {
    winston.info(`Slack websocket connection opened.`)
    winston.info(`CFBot is a member of the following channels: ${channels}`)
    winston.info(`Authenticating with Cloud Foundry endpoint: ${this.cf_instance.API_URL}.`)

    this.slack_message_controller.send_to_all_channels(`Reporting for duty, sir.\nAttempting to connect to ${this.cf_instance.API_URL}`)
    this.refresh_cf_tokens(this.update_cf_tokens.bind(this))
  }

  update_cf_tokens (tokens) {
    winston.info('Authenticated success, retrieved access tokens from Cloud Foundry.')
    winston.debug(tokens)

    this.events_monitor.stop()
    this.events_monitor.credentials = tokens
    this.events_monitor.start()

    // refresh tokens ten minutes before they run out.
    var timeout = (tokens.expires_in - (60 * 10)) * 1000
    setTimeout(() => {
      var message = 'Authentication tokens expiring soon, refreshing...'
      this.slack_message_controller.send_to_all_channels(message)
      winston.info(message)
      this.refresh_cf_tokens(this.update_cf_tokens.bind(this))
    }, timeout)

    winston.info(`Refreshing auth tokens in ${timeout / 1000} seconds.`)
    winston.info('Monitoring for CF events started.')

    if (!this.messages) {
      this.slack_message_controller.send_to_all_channels('Authentication successful. ' +
        'Now monitoring application statuses. :100:')
    }
  }

  refresh_cf_tokens (cb) {
    winston.info('Refreshing Cloud Foundry authentication tokens.')

    var creds = this.cf_credentials

    var error = function (msg) {
      winston.error('Failed to authenticate with Cloud Foundry. Bad username or password?')
      winston.error(msg)
      if (msg.stack) winston.error(msg.stack)
    }

    this.cf_instance.getInfo()
     .then(result =>
        this.cf_instance.login(result.authorization_endpoint, creds.username, creds.password)
          .then(this.update_cf_tokens.bind(this)).catch(error))
     .catch(error)
  }

  on_cf_event (event) {
    winston.info(`Event (${event.type}) received for app (${event.actee_name})` +
      ` by <${event.actor_name}> @ ${event.timestamp}`)
    winston.debug(event)

    this.message_count++
    this.last_event = event

    var messages = EventMessage(event)
    if (messages && this.filters.apps.match(event)
        && this.filters.events.match(event)) {
      this.slack_message_controller.send_to_all_channels(messages.join('\n'))
      winston.debug(messages)
    }
  }
}

module.exports = CFBot
