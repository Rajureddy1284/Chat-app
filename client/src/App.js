import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import axios from 'axios';
import './App.css';

const socket = io('http://localhost:5000');

function App() {
    const [token, setToken] = useState(localStorage.getItem('token') || '');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [message, setMessage] = useState('');
    const [messages, setMessages] = useState([]);
    const [isAuthenticated, setIsAuthenticated] = useState(!!token);

    useEffect(() => {
        if (isAuthenticated) {
            axios.get('http://localhost:5000/api/messages', {
                headers: { Authorization: `Bearer ${token}` }
            })
            .then(res => setMessages(res.data))
            .catch(err => console.error(err));

            socket.on('chatMessage', (msg) => {
                setMessages((prev) => [...prev, msg]);
            });

            return () => {
                socket.off('chatMessage');
            };
        }
    }, [isAuthenticated]);

    const handleRegister = async () => {
        try {
            await axios.post('http://localhost:5000/api/register', { username, password });
            alert('User registered! Please log in.');
        } catch (err) {
            alert(err.response?.data?.error || 'Error registering');
        }
    };

    const handleLogin = async () => {
        try {
            const res = await axios.post('http://localhost:5000/api/login', { username, password });
            localStorage.setItem('token', res.data.token);
            setToken(res.data.token);
            setIsAuthenticated(true);
        } catch (err) {
            alert(err.response?.data?.error || 'Error logging in');
        }
    };

    const handleSendMessage = () => {
        if (message.trim()) {
            socket.emit('chatMessage', { token, message });
            setMessage('');
        }
    };

    return (
        <div className="App">
            {!isAuthenticated ? (
                <div className="auth">
                    <h2>Chat App</h2>
                    <input
                        type="text"
                        placeholder="Username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                    />
                    <input
                        type="password"
                        placeholder="Password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                    />
                    <button onClick={handleRegister}>Register</button>
                    <button onClick={handleLogin}>Login</button>
                </div>
            ) : (
                <div className="chat">
                    <h2>Chat</h2>
                    <div className="messages">
                        {messages.map((msg, index) => (
                            <div key={index}>
                                <strong>{msg.username}</strong> ({new Date(msg.timestamp).toLocaleTimeString()}): {msg.message}
                            </div>
                        ))}
                    </div>
                    <input
                        type="text"
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                    />
                    <button onClick={handleSendMessage}>Send</button>
                </div>
            )}
        </div>
    );
}

export default App;