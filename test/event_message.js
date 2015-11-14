'use strict'

const assert = require('assert')
const EventMessage = require('../lib/event_message')

describe('EventMessage', function () {
  describe('#EventMessage()', function () {
    it('should ignore unknown messages', function () {
      assert.equal(null, EventMessage({type: 'unknown'}))
    })
    it('should have common message prefix for known messages', function () {
      var event = {type: 'audit.app.update', actee_name: 'actee_name', 
        actor_name: 'actor_name', metadata: {request: {state: true}}}
      var messages = EventMessage(event)
      assert.equal(2, messages.length)
      assert.ok(messages[0].indexOf(event.type) != -1)
      assert.ok(messages[0].indexOf(event.actee_name) != -1)
      assert.ok(messages[0].indexOf(event.actor_name) != -1)
    })
    it('should handle app state change messages', function () {
      var event = {type: 'audit.app.update', metadata: {request: {state: 'new_state'}}}
      var messages = EventMessage(event)
      assert.equal(2, messages.length)
      assert.ok(messages[1].indexOf(event.metadata.request.state) != -1)
    })
    it('should handle app memory change messages', function () {
      var event = {type: 'audit.app.update', metadata: {request: {memory: 'new_memory'}}}
      var messages = EventMessage(event)
      assert.equal(2, messages.length)
      assert.ok(messages[1].indexOf(event.metadata.request.memory) != -1)
    })
    it('should handle app instances change messages', function () {
      var event = {type: 'audit.app.update', metadata: {request: {instances: 10}}}
      var messages = EventMessage(event)
      assert.equal(2, messages.length)
      assert.ok(messages[1].indexOf(event.metadata.request.instances) != -1)
    })
    it('should handle app crash messages', function () {
      var event = {type: 'audit.crash', metadata: {index: 99, exit_description: 'sample description'}}
      var messages = EventMessage(event)
      assert.equal(2, messages.length)
      assert.ok(messages[1].indexOf(event.metadata.index) != -1)
      assert.ok(messages[1].indexOf(event.metadata.exit_description) != -1)
    })
    it('should handle app create messages', function () {
      var event = {type: 'audit.app.create'}
      var messages = EventMessage(event)
      assert.equal(2, messages.length)
    })
    it('should handle app delete messages', function () {
      var event = {type: 'audit.app.delete-request'}
      var messages = EventMessage(event)
      assert.equal(2, messages.length)
    })
    it('should handle app map-route messages', function () {
      var event = {type: 'audit.app.map-route', metadata: {route_guid: '0123456789'}}
      var messages = EventMessage(event)
      assert.equal(2, messages.length)
      assert.ok(messages[1].indexOf(event.metadata.route_guid) != -1)
    })
  })
})
