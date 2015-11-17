'use strict'

class EventFilter {
  constructor (attribute, filters) {
    this.attr = attribute
    this.filters = new Set(filters || '*')
  }

  add_filter (filter) {
    if (filter === '*') {
      this.filters.clear()
    } else if (this.filters.has('*')) {
      this.filters.delete('*')
    }

    this.filters.add(filter)
  }

  match (event) {
    if (this.filters.has('*')) return true

    return !![...this.filters].find(filter => {
      var filter_regex = new RegExp('^' + filter.replace(/\*/g, '.*') + '$')
      return event[this.attr].match(filter_regex)
    })
  }
}

module.exports = EventFilter
