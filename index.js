let Dropbox = require('dropbox').Dropbox
const fs = require('fs')
const os = require('os')
const path = require('path')
const jpegAutorotate = require('jpeg-autorotate')
const config = require('./config')
const Storage = require('@google-cloud/storage');
require('isomorphic-fetch')

const getFiles = () => {
  return new Promise((resolve, reject) => {
    let dbx = new Dropbox({
      accessToken: config.dropboxToken
    })
    dbx.filesListFolder({
      path: '/apps/sherlock_photos'
    })
      .then((response) => {
        const paths = response.entries.map((metadataEntry) => {
          return metadataEntry.path_lower
        })
        if (paths.length === 0) {
          reject(new Error('None found'))
          return
        }
        const promises = paths.map((path) => {
          return dbx.filesGetTemporaryLink({
            path: path
          })
        })
        return Promise.all(promises)
      })
      .then((responses) => {
        const fileObjects = responses.map((response) => {
          return {url: response.link, contentHash: response.metadata.content_hash}
        })
        resolve(fileObjects)
      })
      .catch((reason) => {
        reject(reason)
      })
  })
}

const fetchPhoto = (url) => {
  console.log(`Fetching ${url}`)
  return new Promise((resolve, reject) => {
    fetch(url)
      .then((response) => {
        if (!response.ok) {
          reject(new Error('Request failed'))
          return
        }
        return response.buffer()
      })
      .then((buffer) => {
        resolve({url: url, buffer: buffer})
      })
      .catch((reason) => {
        reject(reason)
      })
  })
}

const rotatePhoto = ({url, buffer}) => {
  console.log(`Rotating photos from ${url}`)
  return new Promise((resolve, reject) => {
    const options = {quality: 85}
    jpegAutorotate.rotate(buffer, options, (error, buffer, orientation, dimensions) => {
      if (error) {
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
  console.log(`Saving photos with content hash of ${contentHash}`)
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
  console.log(`Saving photos in cloud from ${localFileName}`)
  const storage = new Storage({
    projectId: config.projectId
  })
  return storage
    .bucket(config.storageBucketName)
    .upload(localFileName)
}

let photoData = {}
getFiles()
  .then((fileObjects) => {
    const photoPromises = fileObjects.map(({url, contentHash}) => {
      photoData[url] = contentHash
      return fetchPhoto(url)
    })
    return Promise.all(photoPromises)
  })
  .then((photoBuffers) => {
    const rotatedPhotoPromises = photoBuffers.map((photoBufferObject) => {
      return rotatePhoto(photoBufferObject)
    })
    return Promise.all(rotatedPhotoPromises)
  })
  .then((photoBuffers) => {
    const localPhotoSavePromises = photoBuffers.map((photoBufferObject) => {
      const url = photoBufferObject.url
      return savePhotoLocally({
        buffer: photoBufferObject.buffer,
        contentHash: photoData[url]
      })
    })
    return Promise.all(localPhotoSavePromises)
  })
  .then((fileNames) => {
    const cloudPhotoSavePromises = fileNames.map((fileName) => {
      return savePhotoInCloud(fileName)
    })
    return Promise.all(cloudPhotoSavePromises)
  })
  .then(() => {
    console.log('success!')
  })
  .catch((reason) => {
    console.error(`Failure reason: ${reason}`)
    console.error(`Failure reason: ${JSON.stringify(reason)}`)
  })
