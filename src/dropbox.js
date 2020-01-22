const config = require('./config')
let Dropbox = require('dropbox').Dropbox
const log = require('./log')
require('isomorphic-fetch')

const MediaTypes = {
  photo: 'photo',
  video: 'video',
  unknown: 'unknown'
}
Object.freeze(MediaTypes)

const getFiles = async () => {
  let dbx = new Dropbox({
    accessToken: config.dropboxToken,
    fetch: fetch
  })
  const response = await dbx.filesListFolder({
    path: '/apps/sherlock_photos'
  })
  if (response.entries.length === 0) {
    return []
  }
  const responsePairs = await Promise.all(response.entries.map(async (metadataEntry) => {
    const linkResponse = await dbx.filesGetTemporaryLink({path: metadataEntry.path_lower})
    return { linkResponse, metadataEntry }
  }))

  let contentHashSet = new Set()
  const fileObjects = responsePairs
    .map(({ linkResponse, metadataEntry }) => {
      const contentHash = linkResponse.metadata.content_hash
      if (contentHashSet.has(linkResponse.metadata.content_hash)) {
        return null
      }
      contentHashSet.add(contentHash)
      return {
        url: linkResponse.link,
        contentHash: contentHash,
        path: linkResponse.metadata.path_lower,
        type: parseMediaType(metadataEntry.media_info || {})
      }
    })
    .filter((fileObject) => fileObject !== null)
  return fileObjects
}

const parseMediaType = (mediaInfo) => {
  if (mediaInfo.metadata === undefined) {
    log.error(`Invalid media info metadata: ${JSON.stringify(mediaInfo)}`)
    return MediaTypes.unknown
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
