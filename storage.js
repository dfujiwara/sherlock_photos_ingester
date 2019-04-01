const config = require('./config')
const fs = require('fs')
const log = require('./log')
const os = require('os')
const path = require('path')
const { Storage } = require('@google-cloud/storage')

const saveFileLocally = ({
  buffer,
  fileName
}) => {
  log.trace(`Saving file with the name of ${fileName}`)
  return new Promise((resolve, reject) => {
    const filePath = path.join(os.tmpdir(), fileName)
    fs.writeFile(filePath, buffer, (err) => {
      if (err) {
        reject(err)
        return
      }
      resolve(filePath)
    })
  })
}

const saveFileInCloud = (localFileName) => {
  log.trace(`Saving file in cloud from ${localFileName}`)
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

const cleanUpLocalFile = (localFileName) => {
  log.trace(`Removing file at ${localFileName}`)
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

module.exports = {
  saveFileLocally,
  cleanUpLocalFile,
  saveFileInCloud
}
