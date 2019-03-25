const config = require('./config')
let Dropbox = require('dropbox').Dropbox
const log = require('./log')
require('isomorphic-fetch')

const MediaTypes = {
  photo: 'photo',
  video: 'video'
}
Object.freeze(MediaTypes)

const getFiles = () => {
  return new Promise((resolve, reject) => {
    let dbx = new Dropbox({
      accessToken: config.dropboxToken,
      fetch: fetch
    })
    dbx.filesListFolder({
      path: '/apps/sherlock_photos',
      include_media_info: true
    })
      .then((response) => {
        if (response.entries.length === 0) {
          return Promise.all([])
        }
        const promises = response.entries.map((metadataEntry) => {
          return dbx.filesGetTemporaryLink({path: metadataEntry.path_lower})
            .then((response) => {
              return { response, metadataEntry }
            })
        })
        return Promise.all(promises)
      })
      .then((responses) => {
        let contentHashSet = new Set()
        const fileObjects = responses
          .map(({ response, metadataEntry }) => {
            const contentHash = response.metadata.content_hash
            if (contentHashSet.has(response.metadata.content_hash)) {
              return null
            }
            contentHashSet.add(contentHash)
            return {
              url: response.link,
              contentHash: contentHash,
              path: response.metadata.path_lower,
              type: parseMediaType(metadataEntry.media_info || {})
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

const parseMediaType = (mediaInfo) => {
  if (mediaInfo.metadata === undefined) {
    return MediaTypes.photo
  }
  return mediaInfo.metadata['.tag'] === MediaTypes.video ? MediaTypes.video : MediaTypes.photo
}

const removeFiles = (paths) => {
  let entries = paths.map((path) => {
    log.trace(`Remove file at ${path} on Dropbox`)
    return {path}
  })
  let dbx = new Dropbox({
    accessToken: config.dropboxToken,
    fetch: fetch
  })
  return dbx.filesDeleteBatch({entries})
}

module.exports = {
  MediaTypes,
  getFiles,
  removeFiles
}
