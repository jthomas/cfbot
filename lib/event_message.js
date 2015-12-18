'use strict'

function AppMessagePrefix (event) {
  return `_${event.actee_name || 'Unknown'}_ has an _${event.type || 'Unknown'}_ event from _<${event.actor_name || 'Unknown'}>_:`
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

function AppRestageMessage () {
  return `Application restaged..`
}

function AppDeleteMessage () {
  return `Application deleted.`
}

function AppMapRouteMessage (route) {
  return `Route (_${route}_) mapped to application.`
}

function AppUnmapRouteMessage (route) {
  return `Route (_${route}_) unmapped from application.`
}

function ServiceCreateMessage (service_name) {
  return `Service instance (_${service_name}_) created.`
}

function ServiceDeleteMessage () {
  return `Service instance removed.`
}

function BindingCreateMessage (binding_name) {
  return `Service binding (_${binding_name}_) created.`
}

function BindingDeleteMessage () {
  return `Service binding removed.`
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
    case 'audit.app.restage':
      messages.push(AppRestageMessage())
      break
    case 'audit.app.delete-request':
      messages.push(AppDeleteMessage())
      break
    case 'audit.app.map-route':
      messages.push(AppMapRouteMessage(metadata.route))
      break
    case 'audit.app.unmap-route':
      messages.push(AppUnmapRouteMessage(metadata.route))
      break
    case 'audit.service_instance.create':
      messages.push(ServiceCreateMessage(metadata.request.name))
      break
    case 'audit.service_instance.delete':
      messages.push(ServiceDeleteMessage())
      break
    case 'audit.service_binding.create':
      messages.push(BindingCreateMessage(metadata.request.service_name))
      break
    case 'audit.service_binding.delete':
      messages.push(BindingDeleteMessage())
      break
  }

  if (messages.length <= 1) {
    messages = null
  }

  return messages
}

module.exports = EventMessage
