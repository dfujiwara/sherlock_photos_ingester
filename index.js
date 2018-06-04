let Dropbox = require('dropbox').Dropbox
const fs = require('fs')
const os = require('os')
const path = require('path')
const jpegAutorotate = require('jpeg-autorotate')
const config = require('./config')
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
        const randomIndex = Math.floor(Math.random() * paths.length)
        return dbx.filesGetTemporaryLink({
          path: paths[randomIndex]
        })
      })
      .then((response) => {
        resolve({url: response.link, contentHash: response.metadata.content_hash})
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
        resolve(response.buffer())
      })
      .catch((reason) => {
        reject(reason)
      })
  })
}

const rotatePhoto = (buffer) => {
  return new Promise((resolve, reject) => {
    const options = {quality: 85}
    jpegAutorotate.rotate(buffer, options, (error, buffer, orientation, dimensions) => {
      if (error) {
        reject(error)
        return
      }
      resolve(buffer)
    })
  })
}

const savePhotoLocally = ({
  buffer,
  contentHash
}) => {
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

let photoData = {}
getFiles()
  .then(({ url, contentHash }) => {
    photoData.url = url
    photoData.contentHash = contentHash
    return fetchPhoto(url)
  })
  .then((buffer) => {
    return rotatePhoto(buffer)
  })
  .then((buffer) => {
    return savePhotoLocally({
      buffer: buffer,
      contentHash: photoData.contentHash
    })
  })
  .then((fileName) => {
    console.log(`success in ${fileName}`)
  })
  .catch((reason) => {
    console.error(`Failure reason: ${JSON.stringify(reason)}`)
  })
