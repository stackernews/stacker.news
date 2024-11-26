// TODO add comments
const cluster = require('cluster')
const express = require('express')
const multer = require('multer')
const { exec } = require('child_process')
const { promisify } = require('util')
const path = require('path')
const fs = require('fs')

const execAsync = promisify(exec)
const unlinkAsync = promisify(fs.unlink)
const WORKERS = process.env.FFMPEG_WORKERS || 2

const FFMPEG_PRESET = 'slow'
const DEFAULT_CRF = 25
const DEFAULT_AUDIO_BITRATE = '96k'

if (cluster.isMaster) {
  console.log(`Server ${process.pid} is listening`)

  const jobQueue = []
  const workersStatus = {}
  const jobResponses = {}

  // spawn workers
  for (let i = 0; i < WORKERS; i++) {
    const worker = cluster.fork()
    workersStatus[worker.id] = 'IDLE' // signal that worker is available
  }

  // replace dead workers
  cluster.on('exit', (worker) => {
    console.log(`Worker ${worker.process.pid} is dead`)
    const newWorker = cluster.fork()
    workersStatus[newWorker.id] = 'IDLE'
  })

  // assign job to worker
  const assignJob = () => {
    const idleWorkerId = Object.keys(workersStatus).find((id) => workersStatus[id] === 'IDLE')
    if (idleWorkerId && jobQueue.length > 0) {
      const job = jobQueue.shift()
      workersStatus[idleWorkerId] = 'BUSY'
      cluster.workers[idleWorkerId].send(job)
    }
  }

  // initialize express http server
  const app = express()
  const storage = multer.diskStorage({ // set storage options
    destination: 'uploads/', // set working path
    filename: (req, file, cb) => { // sanitize file name
      const sanitizedFileName = file.originalname.replace(/[^a-z0-9_\-.]/gi, '_')
      cb(null, sanitizedFileName)
    }
  })
  const upload = multer({
    storage,
    fileFilter: (req, file, cb) => {
      if (!file.mimetype.startsWith('video/')) { // double check if video
        return cb(new Error('Invalid file type'))
      }
      cb(null, true)
    },
    limits: { fileSize: 50 * 1024 * 1024 } // enforce 50 MB
  })

  // transcoding stage

  app.post('/api/transcode', upload.single('file'), async (req, res) => {
    try {
      console.log(`Received file: ${req.file.originalname}`) // log file to be processed
      const inputFilePath = req.file.path
      const outputFilePath = path.join('uploads', `${req.file.filename}.mp4`)
      const jobId = `${Date.now()}-${Math.random()}` // generate unique job id

      jobResponses[jobId] = res

      const message = {
        jobId,
        inputFilePath,
        outputFilePath
      }

      jobQueue.push(message)
      assignJob()
    } catch (error) {
      console.error('Error handling transcode request:', error)
      res.status(500).send('Internal Server Error')
    }
  })

  cluster.on('message', (worker, message) => {
    if (message.jobId && jobResponses[message.jobId]) { // check if job id exists
      const res = jobResponses[message.jobId] // formulate response
      if (message.error) {
        res.status(500).send(message.error)
      } else {
        res.sendFile(message.outputFilePath, async (err) => { // send transcoded video
          if (err) {
            console.error(`Error: ${err.message}`)
            if (!res.headersSent) {
              return res.status(500).send('Error sending transcoded video')
            }
          } else {
            console.log(`Video successfully transcoded: ${message.outputFilePath}`)
          }
          try { // delete video files in any case
            if (message.inputFilePath) {
              await unlinkAsync(path.resolve(message.inputFilePath))
            }
            if (message.outputFilePath) {
              await unlinkAsync(path.resolve(message.outputFilePath))
            }
            console.log(`Deleted video files: ${message.inputFilePath}, ${message.outputFilePath}`)
          } catch (unlinkError) {
            console.error(`Error deleting files: ${unlinkError.message}`)
          }
        })
      }
      delete jobResponses[message.jobId] // job is done, remove from responses
      workersStatus[worker.id] = 'IDLE' // worker is available
      assignJob()
    }
  })

  const PORT = process.env.FFMPEG_PORT
  app.listen(PORT, () => {
    console.log(`FFmpeg cluster is listening on port ${PORT}`)
  })
} else { // engage worker transcoding stage
  process.on('message', async (message) => {
    const { jobId, inputFilePath, outputFilePath } = message

    console.log(`FFmpeg worker PID ${process.pid} received task to transcode ${inputFilePath} to ${outputFilePath}`)
    const command = ffmpegCommand(inputFilePath, outputFilePath)

    try {
      // TODO use spawn instead of exec
      const { stdout, stderr } = await execAsync(command)
      console.log(stdout)
      console.error(stderr)

      const absoluteOutputFilePath = path.resolve(outputFilePath)

      process.send({ jobId, inputFilePath, outputFilePath: absoluteOutputFilePath })
    } catch (error) {
      console.error(`Error during transcoding job ${jobId}: ${error}`)
      process.send({ jobId, error })
    }
  })
}

function ffmpegCommand (input, output) {
  const params = [
    '-i', input,
    '-c:v', 'libx264',
    '-preset', FFMPEG_PRESET,
    '-crf', DEFAULT_CRF,
    '-c:a', 'aac',
    '-b:a', DEFAULT_AUDIO_BITRATE,
    '-movflags', '+faststart',
    '-pix_fmt', 'yuv420p',
    output
  ]

  return `ffmpeg ${params.join(' ')}`
}
