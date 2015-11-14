const assert = require("assert")
const EventFilter = require('../lib/event_filter')

describe('EventFilter', function () {
  describe('#match()', function () {
    it('should match everything by default', function () {
      var event = { attribute: 'property' }
      var event_filter = new EventFilter("attribute")
      assert.ok(event_filter.match(event.attribute))
      assert.ok(event_filter.match(null))
    });
    it('should match filters instead of wildcard', function () {
      var event = { attribute: 'property' }
      var event_filter = new EventFilter("attribute")
      event_filter.add_filter(event.attribute)
      assert.ok(event_filter.match(event))
    });
    it('should match multiple filters', function () {
      var events = [
        { attribute: 'property' },
        { attribute: 'another-property' },
        { attribute: 'final-property' }
      ]
      var event_filter = new EventFilter("attribute")
      events.forEach(event => event_filter.add_filter(event.attribute))
      events.forEach(event => {
        var match = event_filter.match(event)
        assert.ok(match)
      })
      var match = event_filter.match({attribute: 'non-matching-property'})
      assert.ok(!match)
    });
    it('should ignore non-matching individual filters', function () {
      var event = { attribute: 'property' }
      var event_filter = new EventFilter("attribute")
      event_filter.add_filter('prop')
      assert.ok(!event_filter.match(event))
    });
    it('should reset to wildcard matching', function () {
      var event = { attribute: 'property' }
      var event_filter = new EventFilter("attribute")
      event_filter.add_filter('another_filter')
      assert.ok(!event_filter.match(event))
      event_filter.add_filter('*')
      assert.ok(event_filter.match(event))
    });
    it('should allow wildcard postfix matching', function () {
      var event = { attribute: 'property' }
      var event_filter = new EventFilter("attribute")
      event_filter.add_filter('prop*')
      assert.ok(event_filter.match(event))
    });
    it('should allow wildcard prefix matching', function () {
      var event = { attribute: 'property' }
      var event_filter = new EventFilter("attribute")
      event_filter.add_filter('*erty')
      assert.ok(event_filter.match(event))
    });
    it('should allow wildcard postfix & prefix matching', function () {
      var event = { attribute: 'property' }
      var event_filter = new EventFilter("attribute")
      event_filter.add_filter('*oper*')
      assert.ok(event_filter.match(event))
    });
  });
});
