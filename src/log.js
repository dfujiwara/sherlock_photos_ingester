
const opts = {
  level: 'all',
  timestampFormat: 'YYYY-MM-DD HH:mm:ss.SSS'
}
const log = require('simple-node-logger').createSimpleLogger(opts)
module.exports = log
