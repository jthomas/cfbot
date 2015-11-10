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
  const messages = [ AppMessagePrefix(event) ]
  const metadata = event.metadata

  if (event.type === 'audit.app.update') {
    let request = metadata.request
    if (request.state) {
      messages.push(AppPropertyChangeMessage('STATE', request.state))
    }
    if (request.instances) {
      messages.push(AppPropertyChangeMessage('INSTANCES', request.instances))
    }
    if (request.memory) {
      messages.push(AppPropertyChangeMessage('MEMORY', request.memory))
    }
  } else if (event.type === 'audit.crash') {
    messages.push(AppCrashMessage(metadata.index, metadata.exit_description))
  } else if (event.type === 'audit.app.create') {
    messages.push(AppCreateMessage())
  } else if (event.type === 'audit.app.delete-request') {
    messages.push(AppDeleteMessage())
  } else if (event.type === 'audit.app.map-route') {
    messages.push(AppMapRouteMessage(metadata.route_guid))
  }

  if (messages.length <= 1) {
    messages = null
  }

  return messages
}

module.exports = EventMessage
