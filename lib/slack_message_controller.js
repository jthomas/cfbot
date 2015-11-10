'use strict'

const Slack = require('slack-client')
const util = require('util')
const EventEmitter = require('events')

const COMMANDS = new Set(["monitor", "ignore", "config", "status"])

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

  update_bot_user(user) {
    this.bot_reply_regex = new RegExp('^<@' + user.id + '>')
  }

  send_to_all_channels(message) {
    this.channels.forEach( channel => this.send_to_channel(channel, message) )
  }

  send_to_channel(channel, message) {
    this.slack.getChannelGroupOrDMByID(channel).send(message)
  }

  process_message (message) {
    if (message.text.match(this.bot_reply_regex)) {
      var commands = message.text.split(' ')
      commands.splice(0, 1)

      if (!commands.length) {
        this.send_to_channel(message.channel, 'Hello, how can I help you?')
        return
      }

      var action = commands[0],
        parameters = commands.slice(1)

      console.log(action, parameters)

      if (!COMMANDS.has(action)) {
        this.send_to_channel(message.channel, 'Hmmm, I don\'t recognise that command...')
        return
      }

      this.emit(action, parameters)
    }
  }

  on_error (error) {
    console.error('Connection Error From Slack Websocket: ', error)
  }

  on_open () {
    console.log('Websocket connection to Slack opened successfully.')

    var channels = this.slack.channels
    this.channels = Object.keys(channels).filter( channel => channels[channel].is_member)
    var channel_names = this.channels.map( channel => channels[channel].name ).join(',')
    console.log(`CFBot is a member of the following channels: ${channel_names}`)

    this.emit('ready')
  }
}

module.exports = SlackMessageController
