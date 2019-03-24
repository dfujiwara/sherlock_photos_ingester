const jpegAutorotate = require('jpeg-autorotate')
const log = require('./log')
const storage = require('./storage')
require('isomorphic-fetch')

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

const processPhotoFile = async (fileObject) => {
  const { url, contentHash, path } = fileObject
  try {
    const photoBuffer = await fetchPhoto(url)
    const rotatedPhotoBuffer = await rotatePhoto(photoBuffer)
    const localFileName = await storage.saveFileLocally({
      buffer: rotatedPhotoBuffer.buffer,
      contentHash: contentHash
    })
    await storage.saveFileInCloud(localFileName)
    await storage.cleanUpLocalFile(localFileName)
  } catch (reason) {
    log.error(`Failed to process ${path}: ${reason}, ${JSON.stringify(reason)}`)
    throw reason
  }
}

module.exports = {
  processPhotoFile
}
