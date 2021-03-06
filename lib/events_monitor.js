'use strict'

const cf_client = require('cf-nodejs-client')
const EventEmitter = require('events')
const winston = require('winston')

class EventsMonitor extends EventEmitter {
  constructor (endpoint, credentials, polling_frequency) {
    super()

    this.events = new cf_client.Events(endpoint)
    this.credentials = credentials
    this.events_since = this.get_timestamp()
    this.running = false
    this.polling_frequency = (polling_frequency || 60) * 1000
  }

  get_events_query () {
    var timestamp = 'timestamp>' + this.events_since
    return { q: timestamp }
  }

  get_timestamp (ms_since_1970) {
    var date = ms_since_1970 ? new Date(ms_since_1970) : new Date()
    return date.toISOString()
  }

  process_app_event (event) {
    this.emit('event', event.entity)

    console.log(event.entity.type, event.entity.timestamp, this.events_since)
    if (event.entity.timestamp >= this.events_since) {
      var next_second = Date.parse(event.entity.timestamp) + 1000
      this.events_since = this.get_timestamp(next_second)
    }
  }

  poll () {
    if (!this.running) return

    var promise = this.events.getEvents(this.credentials.token_type,
      this.credentials.access_token, this.get_events_query())

    promise.then(result => result.resources.forEach(this.process_app_event.bind(this)))
      .catch(winston.error)
      .finally(() => setTimeout(this.poll.bind(this), this.polling_frequency))
  }

  start () {
    this.running = true
    this.poll()
  }

  stop () {
    this.running = false
  }
}

module.exports = EventsMonitor
