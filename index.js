const express = require('express');
const { createClient } = require('redis');
const authRoutes = require('./routes/auth');
const assignmentRoutes = require('./routes/assignments');
require('dotenv').config();

const app = express();

(async () => {
  try {
    const redisClient = createClient({
      password: process.env.REDIS_PASSWORD,
      socket: {
        host: process.env.REDIS_HOST,
        port: process.env.REDIS_PORT
      }
    });

    // console.log(redisClientId)

    redisClient.on('error', (err) => {
    });

    await redisClient.connect();

    app.use((req, res, next) => {
      if (!redisClient.isOpen) {
        return res.status(500).send('Redis is not connected');
      }
      req.redisClient = redisClient;
      next();
    });

    app.use(express.json());

    app.use('/auth', authRoutes);
    app.use('/assignments', assignmentRoutes);

    app.get('/', (req, res) => {
      res.send('Hello World!!!!');
    });

    const PORT = process.env.PORT || 3001;
    app.listen(PORT, () => {
      console.log(`Server running on port is: ${PORT}`);
    });

  } catch (err) {
    console.error('Failed to connect to Redis:', err);
  }
})();
