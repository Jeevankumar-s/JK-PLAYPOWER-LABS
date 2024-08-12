const jwt = require('jsonwebtoken');
require('dotenv').config();

function requireRole(role) {
  return (req, res, next) => {
    if (req.user.role !== role) {
      return res.status(403).json({ message: 'NO access: Your role doesn\'t have the access' });
    }
    next();
  };
}

function authenticateToken(req, res, next) {
  const token = req.headers['authorization'];

  

  if (!token) {
    return res.status(403).json({ message: 'No token provided' });
  }

  jwt.verify(token.split(' ')[1], process.env.JWT_SECRET_PIN, (err, user) => {
    if (err) {
      console.log('Token verification failed:', err.message);
      return res.status(401).json({ message: 'Unauthorized' });
    }

    req.user = user;
    next();
  });
}

module.exports = { authenticateToken, requireRole };
