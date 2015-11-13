'use strict'

const Slack = require('slack-client')
const EventEmitter = require('events')
const winston = require('winston')

const COMMANDS = new Set(['apps', 'events', 'status'])

class SlackMessageController extends EventEmitter {
  constructor (credentials) {
    super()

    this.slack = new Slack(credentials, true, true)
    this.slack.on('message', this.process_message.bind(this))
    this.slack.on('loggedIn', this.update_bot_user.bind(this))
    this.slack.on('error', this.on_error.bind(this))
    this.slack.on('open', this.on_open.bind(this))

    this.slack.login()
  }

  update_bot_user (user) {
    this.bot_reply_regex = new RegExp('^<@' + user.id + '>')
  }

  send_to_all_channels (message) {
    this.bot_channels().forEach(channel => this.send_to_channel(channel, message))
  }

  send_to_channel (channel, message) {
    this.slack.getChannelGroupOrDMByID(channel).send(message)
  }

  process_message (message) {
    if (message.text && message.text.match(this.bot_reply_regex)) {
      var commands = message.text.split(' ')
      commands.splice(0, 1)

      if (!commands.length) {
        this.send_to_channel(message.channel, 'Hello, how can I help you?\nThe following commands are available: _apps_, _events_ and _status_.')
        return
      }

      var action = commands[0],
        parameters = commands.slice(1)

      if (!COMMANDS.has(action)) {
        this.send_to_channel(message.channel, 'Hmmm, I don\'t recognise that command...')
        return
      }

      this.emit(action, message.channel, parameters)
    }
  }

  bot_channels () {
    var channel_keys = Object.keys(this.slack.channels)
    return channel_keys.filter(channel => this.slack.channels[channel].is_member)
  }

  on_error (error) {
    winston.error('Connection Error From Slack Websocket')
    winston.error(error)
  }

  on_open () {
    var bot_channels = this.bot_channels(),
      channel_names = bot_channels.map(channel => this.slack.channels[channel].name)
    this.emit('ready', channel_names)
  }
}

SlackMessageController.COMMANDS = COMMANDS

module.exports = SlackMessageController
