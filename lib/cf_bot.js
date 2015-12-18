'use strict'

const SlackMessageController = require('./slack_message_controller')
const EventMessage = require('./event_message')
const EventsMonitor = require('./events_monitor')
const EventFilter = require('./event_filter')
const CF_Client = require('cf-nodejs-client')
const winston = require('winston')

class CFBot {
  constructor (endpoint, credentials, config) {
    winston.info(`Connecting to Slack using the following token: ${credentials.slack_token}`)

    this.message_count = 0
    this.last_event = null

    this.filters = {
      apps: new EventFilter('actee_name', config.apps),
      events: new EventFilter('type', config.events)
    }

    this.slack_message_controller = new SlackMessageController(credentials.slack_token)
    this.slack_message_controller.on('ready', this.on_slack_connected.bind(this))

    SlackMessageController.COMMANDS.forEach(command => {
      this.slack_message_controller.on(command, this['handle_' + command + '_command'].bind(this))
    })

    this.cf_platform = new CF_Client.CloudFoundry(endpoint)
    this.cf_uaa = new CF_Client.UsersUAA()
    this.cf_credentials = credentials.cf

    this.events_monitor = new EventsMonitor(endpoint, null, config.polling_frequency)
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

    var response_lines = [`Connected to ${this.cf_platform.API_URL}, registered ${this.message_count} messages since monitoring started.`]

    if (this.last_event) {
      response_lines.push(`Last event for _${this.last_event.actee_name}_ on _${this.last_event.timestamp}_.`)
    }

    response_lines.push(`Monitoring the following apps: ${apps}`,
      `Monitoring the following events: ${events}`)

    this.slack_message_controller.send_to_channel(channel, response_lines.join('\n'))
  }

  handle_polling_frequency_command (channel, args) {
    if (args.length) {
      this.events_monitor.polling_frequency = parseInt(args[0], 10) * 1000
    }

    var current_frequency = this.events_monitor.polling_frequency / 1000
    this.slack_message_controller.send_to_channel(channel, `Polling CF Events API every ${current_frequency} seconds.`)
  }

  on_slack_connected (channels) {
    winston.info(`Slack websocket connection opened.`)
    winston.info(`CFBot is a member of the following channels: ${channels}`)
    winston.info(`Authenticating with Cloud Foundry endpoint: ${this.cf_platform.API_URL}.`)

    this.slack_message_controller.send_to_all_channels(`Reporting for duty, sir.\nAttempting to connect to ${this.cf_platform.API_URL}`)
    this.refresh_cf_tokens(this.update_cf_tokens.bind(this))
  }

  update_cf_tokens (tokens) {
    winston.info('Authenticated success, retrieved access tokens from Cloud Foundry.')
    winston.debug(tokens)

    this.events_monitor.stop()
    this.tokens = tokens
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

    this.cf_platform.getInfo()
     .then(result => {
       this.cf_uaa.setEndPoint(result.authorization_endpoint)
       this.cf_uaa.login(creds.username, creds.password).then(
         this.update_cf_tokens.bind(this)).catch((err) => {
           this.error([`Failed to authenticate with Cloud Foundry. Bad username or password?.`, err])
         })
     })
     .catch((err) => {
       this.error([`Failed to authenticate with Cloud Foundry. Bad username or password?.`, err])
     })
  }

  on_cf_event (event) {
    winston.info(`Event (${event.type}) received for app (${event.actee_name})` +
      ` by <${event.actor_name}> @ ${event.timestamp}`)
    winston.debug(event)

    this.resolve_linked_entities(event).then((resolved) => {
      this.message_count++
      this.last_event = resolved

      var messages = EventMessage(resolved)
      if (messages && this.filters.apps.match(resolved)
          && this.filters.events.match(resolved)) {
        this.slack_message_controller.send_to_all_channels(messages.join('\n'))
        winston.debug(messages)
      }
    }).catch((err) => {
      this.error([`Unable to resolve linked entities in event (${event.metadata.guid}).`, err])
    })
  }

  resolve_linked_entities (event) {
    var promise = Promise.resolve(event)

    switch (event.type) {
      case 'audit.service_instance.create':
        promise = this.resolve_service_entities(event)
        break
      case 'audit.service_binding.create':
        promise = this.resolve_service_binding_entities(event)
        break
      case 'audit.app.map-route':
      case 'audit.app.unmap-route':
        promise = this.resolve_route_entities(event)
        break
    }

    return promise
  }

  resolve_route_entities (event) {
    var route_guid = event.metadata.route_guid

    var result = this.retrieve_model('Routes', 'getRoute', route_guid)
    .then((route) => {
      event.metadata.route = route.entity.host
      return event
    })

    return result
  }

  error (msgs) {
    msgs.forEach((msg) => {
      winston.error(msg)
      if (msg.stack) winston.error(msg.stack)
    })
  }

  resolve_service_entities (event) {
    var service_plan_guid = event.metadata.request.service_plan_guid

    var result = this.retrieve_model('ServicePlans', 'getServicePlan', service_plan_guid)
      .then((result) => this.retrieve_model('Services', 'getService', result.entity.service_guid))
      .then((result) => {
        event.actee_name = result.entity.label
        return event
      }).catch((err) => {
        this.error([`Failed to resolve CF Service for Instance from Event ${service_plan_guid}.`, err])
      })

    return result
  }

  resolve_service_binding_entities (event) {
    var service_instance_guid = event.metadata.request.service_instance_guid,
      app_guid = event.metadata.request.app_guid

    var service_instance = this.retrieve_model('ServiceInstances', 'getInstance', service_instance_guid),
      app = this.retrieve_model('Apps', 'getSummary', app_guid)

    return Promise.all([service_instance, app]).then((results) => {
      event.metadata.request.service_name = results[0].entity.name
      event.actee_name = results[1].name
      return event
    }).catch((err) => {
      this.error([`Failed to resolve CF Apps and Service Instances for App ${app_guid} and Instance ${service_instance_guid}.`, err])
    })
  }

  retrieve_model (model, method, guid) {
    var controller = new CF_Client[model](this.cf_platform.API_URL)
    return controller[method](this.tokens.token_type,
      this.tokens.access_token, guid)
  }
}

module.exports = CFBot
