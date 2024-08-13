const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { User } = require('../models/database');
require('dotenv').config();

const router = express.Router();

const rateLimitMiddleware = async (req, res, next) => {
  
  const redisClient = req.redisClient;
  
  if (!redisClient || redisClient.closed) {
    return res.status(500).send('Redis client is not available');
  }
  
  const { username } = req.body;

  const loginAttemptsKey = `login_attempts_${username}`;
  const lockoutKey = `lockout_${username}`;

  try {
    const lockout = await req.redisClient.get(lockoutKey);

    if (lockout) {
      return res.status(429).json({ message: 'Account temporarily locked. Try again later.' });
    }

    const attempts = await req.redisClient.get(loginAttemptsKey);
    
    if (attempts && attempts >= 5) {
      await req.redisClient.set(lockoutKey, 300, 'locked'); 
      return res.status(429).json({ message: 'Too many login attempts. Please try again in 5 minutes.' });
    }

    req.loginAttemptsKey = loginAttemptsKey;
    next();
  } catch (error) {
    console.error('Redis error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

router.post('/login', rateLimitMiddleware, async (req, res) => {
  const { username, password } = req.body;

  try {
    const user = await User.findOne({ where: { username } });

    if (!user) {
      await req.redisClient.incr(req.loginAttemptsKey);
      return res.status(404).json({ message: 'User not found' });
    }

    const validPassword = await bcrypt.compare(password, user.password);

    if (!validPassword) {
      await req.redisClient.incr(req.loginAttemptsKey);
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    await req.redisClient.del(req.loginAttemptsKey);

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      process.env.JWT_SECRET_KEY,
      { expiresIn: '24h' }
    );

    res.json({ token });
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.post('/register', async (req, res) => {
  const { username, password, role } = req.body;

  try {
    const userExists = await User.findOne({ where: { username } });

    if (userExists) {
      return res.status(400).json({ message: 'Username already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      username,
      password: hashedPassword,
      role, 
    });

    res.status(201).json({ message: 'User registered successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;
