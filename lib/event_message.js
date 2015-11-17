'use strict'

function AppMessagePrefix (event) {
  return `_${event.actee_name}_ has an _${event.type}_ event from _<${event.actor_name}>_:`
}

function AppPropertyChangeMessage (property, value) {
  return `_${property}_ has changed to _${value}_.`
}

function AppCrashMessage (instance, reason) {
  return `_Instance ${instance}_ crashed with reason: _${reason}._`
}

function AppCreateMessage () {
  return `New application created.`
}

function AppDeleteMessage () {
  return `Application deleted.`
}

function AppMapRouteMessage (guid) {
  return `Route (_${guid}_) mapped to application.`
}

function EventMessage (event) {
  var messages = [ AppMessagePrefix(event) ]
  const metadata = event.metadata

  switch (event.type) {
    case 'audit.app.update':
      var props = ['state', 'instances', 'memory']
      props.forEach(prop => {
        if (metadata.request[prop]) {
          messages.push(AppPropertyChangeMessage(prop.toUpperCase(), metadata.request[prop]))
        }
      })
      break
    case 'app.crash':
      messages.push(AppCrashMessage(metadata.index, metadata.exit_description))
      break
    case 'audit.app.create':
      messages.push(AppCreateMessage())
      break
    case 'audit.app.delete-request':
      messages.push(AppDeleteMessage())
      break
    case 'audit.app.map-route':
      messages.push(AppMapRouteMessage(metadata.route_guid))
      break
  }

  if (messages.length <= 1) {
    messages = null
  }

  return messages
}

module.exports = EventMessage
