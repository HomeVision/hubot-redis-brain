'use strict'

// Description:
//   Persist hubot's brain to redis
//
// Configuration:
//   REDISTOGO_URL or REDISCLOUD_URL or BOXEN_REDIS_URL or REDIS_URL.
//     URL format: redis://<host>:<port>
//     URL format (UNIX socket): redis://<socketpath>
//
// Commands:
//   None

const Redis = require('redis')

module.exports = async function (robot) {
  let client
  const prefix = 'hubot'
  const redisUrlEnv = getRedisEnv()
  const redisUrl = process.env[redisUrlEnv]

  if (redisUrlEnv) {
    robot.logger.info(`hubot-redis-brain: Discovered redis from ${redisUrlEnv} environment variable`)
  } else {
    robot.logger.info('hubot-redis-brain: Using default redis on localhost:6379')
  }

  if (redisUrl) {
    client = Redis.createClient({url: redisUrl, legacyMode: true})
  } else {
    client = Redis.createClient({legacyMode: true})
  }

  try {
    await client.connect()
  } catch (e) {
    robot.logger.error(e)
  }

  robot.brain.setAutoSave(false)

  const getData = () =>
    client.get(`${prefix}:storage`, function (err, reply) {
      if (err) {
        throw err
      } else if (reply) {
        robot.logger.info(`hubot-redis-brain: Data for ${prefix} brain retrieved from Redis`)
        robot.brain.mergeData(JSON.parse(reply.toString()))
        robot.brain.emit('connected')
      } else {
        robot.logger.info(`hubot-redis-brain: Initializing new data for ${prefix} brain`)
        robot.brain.mergeData({})
        robot.brain.emit('connected')
      }

      robot.brain.setAutoSave(true)
    })

  getData()

  client.on('error', function (err) {
    if (!/ECONNREFUSED/.test(err.message)) {
      robot.logger.error(err.stack)
    }
  })

  client.on('connect', function () {
    robot.logger.debug('hubot-redis-brain: Successfully connected to Redis')
    getData()
  })

  robot.brain.on('save', (data) => {
    if (!data) {
      data = {}
    }
    client.set(`${prefix}:storage`, JSON.stringify(data))
  })

  robot.brain.on('close', () => client.quit())
}

function getRedisEnv () {
  if (process.env.REDISTOGO_URL) {
    return 'REDISTOGO_URL'
  }

  if (process.env.REDISCLOUD_URL) {
    return 'REDISCLOUD_URL'
  }

  if (process.env.BOXEN_REDIS_URL) {
    return 'BOXEN_REDIS_URL'
  }

  if (process.env.REDIS_URL) {
    return 'REDIS_URL'
  }
}
