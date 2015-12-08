'use strict'

const CFBot = require('./lib/cf_bot')
const cfenv = require('cfenv')
const winston = require('winston')

const credentials = cfenv.getAppEnv().getServiceCreds('cfbot')
const config = {}

if (process.env.APPS) {
  config.apps = process.env.APPS.split(' ')
  winston.info(`Configuration environment, APPS, defined: ${config.apps}`)
}

if (process.env.EVENTS) {
  config.events = process.env.EVENTS.split(' ')
  winston.info(`Configuration environment, EVENTS, defined: ${config.events}`)
}

if (process.env.POLLING_FREQ) {
  config.polling_frequency = process.env.POLLING_FREQ
  winston.info(`Configuration environment, POLLING_FREQ, defined: ${config.polling_frequency}`)
}

winston.level = process.env.LOG_LEVEL || 'info'

if (!credentials) {
  winston.error('Missing service credentials for cfbot. Have you configured and bound them to your application? Exiting...')
  process.exit(1)
}

var check_missing_param = function (param) {
  if (!credentials[param]) {
    winston.error(`Invalid service credentials, missing the ${param} parameter. Exiting...`)
    process.exit(1)
  }
}

var parameters = ['slack_token', 'cf_api', 'cf_username', 'cf_password']
parameters.forEach(check_missing_param)

winston.info('Ahoy! Attempting to start CF Bot... ')
var cf_bot = new CFBot(credentials.cf_api, {slack_token: credentials.slack_token,
  cf: {username: credentials.cf_username, password: credentials.cf_password}}, config)
