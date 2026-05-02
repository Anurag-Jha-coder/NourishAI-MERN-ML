const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const morgan = require('morgan');
require('dotenv').config();

const authRoutes     = require('./routes/auth');
const dietRoutes     = require('./routes/diet');
const historyRoutes  = require('./routes/history');
const feedbackRoutes = require('./routes/feedback');
const shoppingRoutes = require('./routes/shopping');

const app = express();

// ── Middleware ──────────────────────────────────────────────
const corsOptions = {
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true
};
app.use(cors(corsOptions));
app.use(express.json());
app.use(morgan('dev'));

// ── Routes ──────────────────────────────────────────────────
app.use('/api/auth',     authRoutes);
app.use('/api/diet',     dietRoutes);
app.use('/api/history',  historyRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/shopping', shoppingRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'NourishAI API running', timestamp: new Date() });
});

// ── Error Handler ───────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
  });
});

// ── MongoDB + Start ─────────────────────────────────────────
const PORT = process.env.PORT || 5000;

mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('✅ MongoDB connected');
    app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
  })
  .catch((err) => {
    console.error('❌ MongoDB connection failed:', err.message);
    console.log('💡 Make sure MongoDB is running: mongod --dbpath /data/db');
    process.exit(1);
  });
