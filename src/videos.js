const fs = require('fs')
const log = require('./log')
const storage = require('./storage')
require('isomorphic-fetch')

const fetchVideo = (url, filePath) => {
  log.trace(`Fetching ${url}`)
  return new Promise((resolve, reject) => {
    const destinationStream = fs.createWriteStream(filePath)
    fetch(url)
      .then((response) => {
        if (!response.ok) {
          reject(new Error('Request failed'))
          return
        }
        response.body.pipe(destinationStream)
        destinationStream.on('end', () => {
          log.info('ending!')
          resolve(filePath)
        })
        destinationStream.on('finish', () => {
          log.info('finished!')
          resolve(filePath)
        })
      })
      .catch((reason) => {
        reject(reason)
      })
  })
}

const processVideoFile = async (fileObject) => {
  const { url, contentHash, path } = fileObject
  try {
    const fileName = `./${contentHash}.mov`
    const localFilePath = await fetchVideo(url, fileName)
    await storage.saveFileInCloud(localFilePath)
    await storage.cleanUpLocalFile(localFilePath)
  } catch (reason) {
    log.error(`Failed to process ${path}: ${reason}, ${JSON.stringify(reason)}`)
    throw reason
  }
}

module.exports = {
  processVideoFile
}
