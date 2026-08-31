const jwt = require('jsonwebtoken');
const User = require('../models/UserModel');
const JWT_SECRET = require('../helper/jwtSecret');

const authenticate = async (req, res, next) => {
  try {
    let token = req.headers['authorization'];
    if (!token || !token.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No or invalid token provided.' });
    }

    token = token.split(' ')[1]; 

    const decoded = jwt.verify(token, JWT_SECRET);
    // Use userId from payload
    if (!decoded.id) {
      return res.status(401).json({ error: 'Invalid token payload.' });
    }

    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({ error: 'User not found.' });
    }
    
    req.userId = user._id;

    next(); 
  } catch (err) {
    console.error('Auth Error:', err);
    res.status(401).json({ error: 'Please authenticate.' });
  }
};

module.exports = authenticate;
