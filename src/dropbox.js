const config = require('./config')
let Dropbox = require('dropbox').Dropbox
const log = require('./log')
require('isomorphic-fetch')

const getFiles = () => {
  return new Promise((resolve, reject) => {
    let dbx = new Dropbox({
      accessToken: config.dropboxToken,
      fetch: fetch
    })
    dbx.filesListFolder({
      path: '/apps/sherlock_photos'
    })
      .then((response) => {
        const paths = response.entries.map((metadataEntry) => metadataEntry.path_lower)
        if (paths.length === 0) {
          return Promise.all([])
        }
        const promises = paths.map((path) => dbx.filesGetTemporaryLink({path: path}))
        return Promise.all(promises)
      })
      .then((responses) => {
        let contentHashSet = new Set()
        const fileObjects = responses
          .map((response) => {
            const contentHash = response.metadata.content_hash
            if (contentHashSet.has(response.metadata.content_hash)) {
              return null
            }
            contentHashSet.add(contentHash)
            return {
              url: response.link,
              contentHash: contentHash,
              path: response.metadata.path_lower
            }
          })
          .filter((fileObject) => fileObject !== null)
        resolve(fileObjects)
      })
      .catch((reason) => {
        reject(reason)
      })
  })
}

const removeFiles = (paths) => {
  let entries = paths.map((path) => {
    log.trace(`Remove photo at ${path} on Dropbox`)
    return {path}
  })
  let dbx = new Dropbox({
    accessToken: config.dropboxToken,
    fetch: fetch
  })
  return dbx.filesDeleteBatch({entries})
}

module.exports = {
  getFiles,
  removeFiles
}
