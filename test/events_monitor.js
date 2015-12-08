'use strict'

const assert = require("assert")
const EventsMonitor = require('../lib/events_monitor')
const promise = require('bluebird')

var events_monitor,
  endpoint = 'endpoint', creds = {token_type: 'token_type', access_token:'access_token'}

describe('EventsMonitor', function () {
  describe('#poll()', function () {
    beforeEach(function() {
      events_monitor = new EventsMonitor(endpoint, creds)
    })
    it('should not poll when not running', function () {
      events_monitor.events = null
      events_monitor.poll()
    })
    it('should support default poll frequency', function () {
      assert.equal(events_monitor.polling_frequency, 60 * 1000)
    })
    it('should support setting polling frequency', function () {
      events_monitor = new EventsMonitor(endpoint, creds, 30)
      assert.equal(events_monitor.polling_frequency, 30 * 1000)
    })
    it('should support polling frequency rate-limiting', function (done) {
      this.timeout(5000)
      events_monitor = new EventsMonitor(endpoint, creds, 2)
      var timestamp
      events_monitor.events.getEvents = (() => {
        if (!timestamp) { 
          timestamp = new Date()
          return new promise((resolve) => { resolve({resources: []}) })
        } else {
          let difference = new Date() - timestamp
          assert.ok(difference > events_monitor.polling_frequency)
          done()
        } 
      })
      events_monitor.start()
    })
    it('should pass credentials to event service', function () {
      var called = false
      var getEvents = function (type, token) { 
        called = true
        assert.equal(type, creds.token_type)
        assert.equal(token, creds.access_token)
        return new promise(() => {})
      }
      events_monitor.events = {getEvents: getEvents}
      events_monitor.start()
      assert.ok(called)
    })
    it('should pass event query to event service', function () {
      var called = false
      var getEvents = function (type, token, query) { 
        called = true
        assert.deepEqual(query, {q: 'timestamp>timestamp'})
        return new promise(() => {})
      }
      events_monitor.events = {getEvents: getEvents}
      events_monitor.events_since = 'timestamp'
      events_monitor.start()
      assert.ok(called)
    })
    it('should notify listeners of new event', function (done) {
      var called = false
      var fake_event = {entity: {name: 'james', 
        timestamp: events_monitor.get_timestamp(Date.parse(events_monitor.events_since) + 10000)}}
      var getEvents = function (type, token, query) { 
        called = true
        return new promise((resolve) => {
          setTimeout(() => {resolve({resources:[fake_event]})}, 100)
        })
      }
      events_monitor.events = {getEvents: getEvents}
      events_monitor.once('event', (event) => {
        assert.deepEqual(event, fake_event.entity)
        process.nextTick(() => {
          var next_second = Date.parse(fake_event.entity.timestamp) + 1000
          assert.equal(events_monitor.events_since, events_monitor.get_timestamp(next_second))
          done()
        })
      })
      events_monitor.start()
      assert.ok(called)
    })
    it('should ignore old events from timestamp', function (done) {
      var called = false
      var fake_event = {entity: {name: 'james', 
        timestamp: events_monitor.get_timestamp(Date.parse(events_monitor.events_since) - 10000)}}
      var getEvents = function (type, token, query) { 
        called = true
        return new promise((resolve) => {
          setTimeout(() => {resolve({resources:[fake_event]})}, 100)
        })
      }
      events_monitor.events = {getEvents: getEvents}
      events_monitor.once('event', (event) => {
        assert.deepEqual(event, fake_event.entity)
        process.nextTick(() => {
          var next_second = Date.parse(fake_event.entity.timestamp) + 1000
          assert.notEqual(events_monitor.events_since, events_monitor.get_timestamp(next_second))
          done()
        })
      })
      events_monitor.start()
      assert.ok(called)
    })
  })
})
