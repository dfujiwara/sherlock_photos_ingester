const dropbox = require('./src/dropbox')
const log = require('./src/log')
const photos = require('./src/photos')
const videos = require('./src/videos')

const run = async () => {
  const fileObjects = await dropbox.getFiles()
  const mediaPromises = fileObjects.map((fileObject) => {
    return process(fileObject)
  })
  return Promise.all(mediaPromises)
    .then(() => log.info('success!'))
    .catch((error) => log.error(error))
}

const process = async (fileObject) => {
  try {
    switch (fileObject.type) {
      case dropbox.MediaTypes.photo:
        await photos.processPhotoFile(fileObject)
        dropbox.removeFiles([fileObject.path])
        break
      case dropbox.MediaTypes.video:
        await videos.processVideoFile(fileObject)
        dropbox.removeFiles([fileObject.path])
        break
      default:
        break
    }
  } catch (error) {
    log.error(error)
  }
}

run()
