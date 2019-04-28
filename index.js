const dropbox = require('./src/dropbox')
const log = require('./src/log')
const photos = require('./src/photos')

const run = () => {
  dropbox.getFiles()
    .then((fileObjects) => {
      const photoPromises = fileObjects.map((fileObject) => {
        return photos.processPhotoFile(fileObject)
          .then(() => dropbox.removeFiles([fileObject.path]))
          .catch((error) => log.error(error))
      })
      return Promise.all(photoPromises)
    })
    .then(() => log.info('success!'))
    .catch((error) => log.error(error))
}

run()
