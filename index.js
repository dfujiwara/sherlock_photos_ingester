let Dropbox = require('dropbox').Dropbox
const fs = require('fs')
const os = require('os')
const path = require('path')
const jpegAutorotate = require('jpeg-autorotate')
const config = require('./config')
const Storage = require('@google-cloud/storage')
require('isomorphic-fetch')

const opts = {
  level: 'all',
  timestampFormat:'YYYY-MM-DD HH:mm:ss.SSS'
}
const log = require('simple-node-logger').createSimpleLogger(opts)

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

const fetchPhoto = (url) => {
  log.trace(`Fetching ${url}`)
  return new Promise((resolve, reject) => {
    fetch(url)
      .then((response) => {
        if (!response.ok) {
          reject(new Error('Request failed'))
          return
        }
        return response.buffer()
      })
      .then((buffer) => resolve({url: url, buffer: buffer}))
      .catch((reason) => reject(reason))
  })
}

const rotatePhoto = ({url, buffer}) => {
  log.trace(`Rotating photos from ${url}`)
  return new Promise((resolve, reject) => {
    const options = {quality: 15}
    const dismissableErrorSet = new Set(['correct_orientation', 'no_orientation'])
    jpegAutorotate.rotate(buffer, options, (error, buffer, orientation, dimensions) => {
      if (error && !dismissableErrorSet.has(error.code)) {
        reject(error)
        return
      }
      resolve({url: url, buffer: buffer})
    })
  })
}

const savePhotoLocally = ({
  buffer,
  contentHash
}) => {
  log.trace(`Saving photos with content hash of ${contentHash}`)
  return new Promise((resolve, reject) => {
    const fileName = path.join(os.tmpdir(), contentHash)
    fs.writeFile(fileName, buffer, (err) => {
      if (err) {
        reject(err)
        return
      }
      resolve(fileName)
    })
  })
}

const savePhotoInCloud = (localFileName) => {
  log.trace(`Saving photos in cloud from ${localFileName}`)
  const storage = new Storage({
    projectId: config.projectId
  })
  return new Promise((resolve, reject) => {
    storage
      .bucket(config.storageBucketName)
      .upload(localFileName)
      .then(() => resolve(localFileName))
  })
}

const cleanUpLocalPhoto = (localFileName) => {
  log.trace(`Removing photo at ${localFileName}`)
  return new Promise((resolve, reject) => {
    fs.unlink(localFileName, (err) => {
      if (err) {
        reject(err)
        return
      }
      resolve(localFileName)
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

const processPhotoFile = async (fileObject) => {
  const { url, contentHash, path } = fileObject
  try {
    const photoBuffer = await fetchPhoto(url)
    const rotatedPhotoBuffer = await rotatePhoto(photoBuffer)
    const localFileName = await savePhotoLocally({
      buffer: rotatedPhotoBuffer.buffer,
      contentHash: contentHash
    })
    await savePhotoInCloud(localFileName)
    await cleanUpLocalPhoto(localFileName)
    await removeFiles([path])
  } catch(reason) {
    log.error(`Failed to process ${path}: ${reason}, ${JSON.stringify(reason)}`)
  }
}

getFiles()
  .then((fileObjects) => {
    const photoPromises = fileObjects.map((fileObject) => {
      return processPhotoFile(fileObject)
    })
    return Promise.all(photoPromises)
  })
  .then(() => log.info('success!'))
