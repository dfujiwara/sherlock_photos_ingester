let Dropbox = require('dropbox').Dropbox
const fs = require('fs')
const os = require('os')
const path = require('path')
const jpegAutorotate = require('jpeg-autorotate')
const config = require('./config')
const Storage = require('@google-cloud/storage')
require('isomorphic-fetch')
const log = require('simple-node-logger').createSimpleLogger()
log.setLevel('all')

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
          reject(new Error('None found'))
          return
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
    const options = {quality: 25}
    jpegAutorotate.rotate(buffer, options, (error, buffer, orientation, dimensions) => {
      if (error && error.code !== 'correct_orientation') {
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

let photoData = {}
getFiles()
  .then((fileObjects) => {
    const photoPromises = fileObjects.map(({url, contentHash, path}) => {
      photoData[url] = {contentHash, path}
      return fetchPhoto(url)
    })
    return Promise.all(photoPromises)
  })
  .then((photoBuffers) => {
    const rotatedPhotoPromises = photoBuffers.map((photoBufferObject) => rotatePhoto(photoBufferObject))
    return Promise.all(rotatedPhotoPromises)
  })
  .then((photoBuffers) => {
    const localPhotoSavePromises = photoBuffers.map((photoBufferObject) => {
      const url = photoBufferObject.url
      const urlPhotoData = photoData[url]
      return savePhotoLocally({
        buffer: photoBufferObject.buffer,
        contentHash: urlPhotoData.contentHash
      })
    })
    return Promise.all(localPhotoSavePromises)
  })
  .then((fileNames) => {
    const cloudPhotoSavePromises = fileNames.map((fileName) => savePhotoInCloud(fileName))
    return Promise.all(cloudPhotoSavePromises)
  })
  .then((fileNames) => {
    const removePromises = fileNames.map((fileName) => cleanUpLocalPhoto(fileName))
    return Promise.all(removePromises)
  })
  .then(() => {
    const paths = Object.values(photoData).map(({path}) => path)
    return removeFiles(paths)
  })
  .then(() => log.info('success!'))
  .catch((reason) => {
    log.error(`Failure reason: ${reason}, ${JSON.stringify(reason)}`)
  })
