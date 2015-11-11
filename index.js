const CFBot = require('./lib/cf_bot')
const cfenv = require("cfenv")

var credentials = cfenv.getAppEnv().getServiceCreds('cfbot')

if (!credentials) {
  console.error('ERROR: Missing service credentials for cfbot.\nHave you configured and bound them to your application? Exiting...')
  process.exit(1)
}

var parameters = ['slack_token', 'cf_api', 'cf_username', 'cf_password']

var check_missing_param = function (param) {
  if (!credentials[param]) {
    console.error(`ERROR: Invalid service credentials, missing the ${param} parameter. Exiting...`)
    process.exit(1)
  }
}

parameters.forEach(check_missing_param)

var cf_bot = new CFBot(credentials.slack_token, credentials.cf_api, {username: credentials.cf_username, password: credentials.cf_password})
