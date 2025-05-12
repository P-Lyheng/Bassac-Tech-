// // backend/app.js
// const express = require('express');
// const cors = require('cors');
// const helmet = require('helmet');
// const morgan = require('morgan');
// const cookieParser = require('cookie-parser');
// const dotenv = require('dotenv');

// dotenv.config();

// const authRoutes = require('./routes/auth');
// // const classRoutes = require('./routes/classRoutes');
// // const videoRoutes = require('./routes/videoRoutes');

// const app = express();

// // Middleware
// app.use(helmet()); // Security headers
// app.use(cors({
//     origin: 'http://localhost:3000', // Change to your frontend URL
//     credentials: true
// }));

// app.use(morgan('dev'));
// app.use(express.json());
// app.use(cookieParser());

// // Routes
// app.use('/api/auth', authRoutes);
// // app.use('/api/classes', classRoutes);
// // app.use('/api/video', videoRoutes);

// app.get('/', (req, res) => {
//     res.send('Bassac Academy API Running');
// });

// module.exports = app;
