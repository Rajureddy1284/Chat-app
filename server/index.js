const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mysql = require('mysql2');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: 'http://localhost:3000' } });

app.use(cors());
app.use(express.json());

// MySQL Connection
const connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '1234', // Replace with your root password
    database: 'chat_app'
});

connection.connect((err) => {
    if (err) {
        console.error('Error connecting to MySQL:', err);
        return;
    }
    console.log('Connected to MySQL');
});

// JWT Secret
const JWT_SECRET = 'your_jwt_secret'; // Replace with a secure secret

// Register Endpoint
app.post('/api/register', async (req, res) => {
    const { username, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    connection.query(
        'INSERT INTO users (username, password) VALUES (?, ?)',
        [username, hashedPassword],
        (err) => {
            if (err) return res.status(500).json({ error: 'User already exists or database error' });
            res.status(201).json({ message: 'User registered' });
        }
    );
});

// Login Endpoint
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    connection.query(
        'SELECT * FROM users WHERE username = ?',
        [username],
        async (err, results) => {
            if (err || results.length === 0) return res.status(401).json({ error: 'Invalid credentials' });
            const user = results[0];
            const isMatch = await bcrypt.compare(password, user.password);
            if (!isMatch) return res.status(401).json({ error: 'Invalid credentials' });
            const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '1h' });
            res.json({ token });
        }
    );
});

// Middleware to Verify JWT
const verifyToken = (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token provided' });
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) return res.status(401).json({ error: 'Invalid token' });
        req.user = decoded;
        next();
    });
};

// Get Chat History
app.get('/api/messages', verifyToken, (req, res) => {
    connection.query(
        'SELECT u.username, m.message, m.timestamp FROM messages m JOIN users u ON m.user_id = u.id ORDER BY m.timestamp',
        (err, results) => {
            if (err) return res.status(500).json({ error: 'Database error' });
            res.json(results);
        }
    );
});

// Socket.IO for Real-Time Chat
io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    socket.on('chatMessage', (msg) => {
        const token = msg.token;
        jwt.verify(token, JWT_SECRET, (err, decoded) => {
            if (err) return socket.emit('error', 'Invalid token');
            connection.query(
                'INSERT INTO messages (user_id, message) VALUES (?, ?)',
                [decoded.id, msg.message],
                (err) => {
                    if (err) return socket.emit('error', 'Database error');
                    const messageData = {
                        username: decoded.username,
                        message: msg.message,
                        timestamp: new Date()
                    };
                    io.emit('chatMessage', messageData);
                }
            );
        });
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

// Start Server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});