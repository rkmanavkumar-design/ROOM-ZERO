"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json());
const server = (0, http_1.createServer)(app);
const io = new socket_io_1.Server(server, {
    cors: {
        origin: '*', // Allows local testing easily
        methods: ['GET', 'POST'],
    },
    maxHttpBufferSize: 1e7, // 10MB limit for base64 image transfers
});
const PORT = process.env.PORT || 3001;
// RAM-only Storage
const rooms = new Map();
// Game Libraries
const SCRIBBLE_WORDS = [
    'submarine', 'spaceship', 'cherry blossom', 'rollercoaster', 'volcano',
    'dinosaur', 'octopus', 'guitar', 'castle', 'butterfly', 'wizard', 'cactus',
    'kangaroo', 'lighthouse', 'waterfall', 'pyramid', 'telescope', 'dragon',
    'sunflower', 'campfire', 'mermaid', 'astronaut', 'helicopter', 'snowflake'
];
const STORY_TWISTS = [
    'Suddenly, a mysterious package was delivered to the door.',
    'At that exact moment, the lights went out completely.',
    'A talking cat appeared and warned them about the future.',
    'They realized they were in a simulation all along.',
    'An earthquake shook the ground, revealing a hidden trapdoor.',
    'One of them received a message from a number they thought was deleted.',
    'Suddenly, gravity reversed for exactly three seconds.',
    'They discovered a glowing portal behind the bookshelf.',
    'A voice boomed from the sky saying: "YOUR TIME IS RUNNING OUT!"'
];
const NHIE_CARDS = [
    'Never have I ever lied about my age.',
    'Never have I ever fallen asleep in a cinema or theater.',
    'Never have I ever sung karaoke in public.',
    'Never have I ever pretended to be busy to avoid someone.',
    'Never have I ever broken a bone.',
    'Never have I ever eaten a whole pizza by myself.',
    'Never have I ever stayed up for 24 hours straight.',
    'Never have I ever gotten lost in a foreign city.',
    'Never have I ever cried during a movie.',
    'Never have I ever snooped through someone\'s phone.',
    'Never have I ever text the wrong person something embarrassing.',
    'Never have I ever tried a weird food combination that actually tasted good.',
    'Never have I ever lied to get out of plans.'
];
const NHIE_DISCUSSIONS = [
    'Explain the story behind your answer!',
    'Who did you do this with, or when did it happen?',
    'Would you do it again under any circumstances?',
    'No judgment here, but we need details!',
    'Was it worth it?'
];
// Helper to generate 6-character room codes
function generateRoomId() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Readable chars
    let id = '';
    for (let i = 0; i < 6; i++) {
        id += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return id;
}
// Inactive Room Cleanup Timer
setInterval(() => {
    const now = Date.now();
    for (const [roomId, room] of rooms.entries()) {
        const userCount = Object.keys(room.users).length;
        // Clean up if empty or inactive for > 1 hour
        if (userCount === 0 || now - room.lastActiveAt > 60 * 60 * 1000) {
            console.log(`Cleaning up inactive/empty room: ${roomId}`);
            rooms.delete(roomId);
        }
    }
}, 5 * 60 * 1000); // Every 5 minutes
// Scribble Game Loops Map to handle timers
const scribbleIntervals = new Map();
io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}`);
    // 1. CREATE ROOM
    socket.on('create-room', ({ nickname, userId }) => {
        let roomId = generateRoomId();
        while (rooms.has(roomId)) {
            roomId = generateRoomId();
        }
        const newUser = {
            id: userId,
            nickname: nickname,
            socketId: socket.id,
            joinedAt: Date.now(),
            score: 0,
            awards: []
        };
        const newRoom = {
            id: roomId,
            users: { [userId]: newUser },
            theme: 'space',
            messages: [],
            createdAt: Date.now(),
            lastActiveAt: Date.now()
        };
        rooms.set(roomId, newRoom);
        socket.join(roomId);
        socket.data.roomId = roomId;
        socket.data.userId = userId;
        socket.emit('room-created', newRoom);
        console.log(`Room created: ${roomId} by user: ${nickname} (${userId})`);
    });
    // 2. JOIN ROOM
    socket.on('join-room', ({ roomId, nickname, userId }) => {
        const roomKey = roomId.toUpperCase().trim();
        const room = rooms.get(roomKey);
        if (!room) {
            socket.emit('join-error', 'Room not found.');
            return;
        }
        const existingUsers = Object.values(room.users);
        if (existingUsers.length >= 2) {
            socket.emit('join-error', 'This room is full (max 2 players).');
            return;
        }
        // Check if user is already in this room
        if (room.users[userId]) {
            // Reconnection or duplicate tab
            room.users[userId].socketId = socket.id;
        }
        else {
            const newUser = {
                id: userId,
                nickname: nickname,
                socketId: socket.id,
                joinedAt: Date.now(),
                score: 0,
                awards: []
            };
            room.users[userId] = newUser;
        }
        room.lastActiveAt = Date.now();
        socket.join(roomKey);
        socket.data.roomId = roomKey;
        socket.data.userId = userId;
        io.to(roomKey).emit('room-joined', room);
        console.log(`User ${nickname} joined room ${roomKey}`);
    });
    // 3. THEME CHANGE
    socket.on('change-theme', (theme) => {
        const roomId = socket.data.roomId;
        const room = rooms.get(roomId);
        if (room) {
            room.theme = theme;
            room.lastActiveAt = Date.now();
            io.to(roomId).emit('theme-changed', theme);
        }
    });
    // 4. REAL-TIME CHAT & REACTIONS
    socket.on('send-message', (msgData) => {
        const roomId = socket.data.roomId;
        const userId = socket.data.userId;
        const room = rooms.get(roomId);
        if (room && room.users[userId]) {
            const message = {
                id: Math.random().toString(36).substring(2, 9),
                senderId: userId,
                senderNickname: room.users[userId].nickname,
                text: msgData.text,
                imageUrl: msgData.imageUrl,
                isOneTime: msgData.isOneTime,
                timestamp: Date.now()
            };
            room.lastActiveAt = Date.now();
            // Broadcast to everyone in the room
            io.to(roomId).emit('message-received', message);
        }
    });
    socket.on('emoji-reaction', (emoji) => {
        const roomId = socket.data.roomId;
        if (roomId) {
            socket.to(roomId).emit('emoji-received', emoji);
        }
    });
    // 5. ACTIVITY / GAME SELECTION
    socket.on('select-game', (game) => {
        const roomId = socket.data.roomId;
        const room = rooms.get(roomId);
        if (!room)
            return;
        room.activeGame = game;
        room.lastActiveAt = Date.now();
        // Clear previous games if any
        room.scribble = undefined;
        room.story = undefined;
        room.nhie = undefined;
        // Clear any active scribble timers
        const activeInterval = scribbleIntervals.get(roomId);
        if (activeInterval) {
            clearInterval(activeInterval);
            scribbleIntervals.delete(roomId);
        }
        const usersList = Object.keys(room.users);
        if (usersList.length < 2) {
            socket.emit('game-error', 'Need two players to start a game.');
            return;
        }
        if (game === 'scribble') {
            // Choose drawer randomly
            const drawerId = usersList[Math.floor(Math.random() * usersList.length)];
            const word = SCRIBBLE_WORDS[Math.floor(Math.random() * SCRIBBLE_WORDS.length)];
            const modifiers = ['opposite-hand', 'circles-only', 'one-line'];
            // 50% chance of a chaos modifier
            const chaosModifier = Math.random() > 0.5 ? modifiers[Math.floor(Math.random() * modifiers.length)] : undefined;
            room.scribble = {
                drawerId,
                word,
                timer: 60,
                chaosModifier,
                guessedUsers: []
            };
            io.to(roomId).emit('game-started', {
                activeGame: 'scribble',
                scribble: room.scribble
            });
            // Start Countdown
            const interval = setInterval(() => {
                const r = rooms.get(roomId);
                if (r && r.scribble) {
                    r.scribble.timer--;
                    io.to(roomId).emit('scribble-tick', r.scribble.timer);
                    if (r.scribble.timer <= 0) {
                        clearInterval(interval);
                        scribbleIntervals.delete(roomId);
                        io.to(roomId).emit('scribble-round-end', {
                            winnerId: null,
                            word: r.scribble.word,
                            scores: Object.values(r.users).map(u => ({ id: u.id, score: u.score }))
                        });
                    }
                }
                else {
                    clearInterval(interval);
                    scribbleIntervals.delete(roomId);
                }
            }, 1000);
            scribbleIntervals.set(roomId, interval);
        }
        else if (game === 'story') {
            const turnUserId = usersList[Math.floor(Math.random() * usersList.length)];
            room.story = {
                turnUserId,
                sentences: [],
                turnCount: 0
            };
            io.to(roomId).emit('game-started', {
                activeGame: 'story',
                story: room.story
            });
        }
        else if (game === 'nhie') {
            const currentQuestion = NHIE_CARDS[Math.floor(Math.random() * NHIE_CARDS.length)];
            room.nhie = {
                currentQuestion,
                answers: {},
                history: [currentQuestion]
            };
            io.to(roomId).emit('game-started', {
                activeGame: 'nhie',
                nhie: room.nhie
            });
        }
    });
    // GAME EVENTS: SCRIBBLE
    socket.on('scribble-draw', (drawData) => {
        const roomId = socket.data.roomId;
        if (roomId) {
            socket.to(roomId).emit('scribble-drawing', drawData);
        }
    });
    socket.on('scribble-clear', () => {
        const roomId = socket.data.roomId;
        if (roomId) {
            socket.to(roomId).emit('scribble-cleared');
        }
    });
    socket.on('scribble-guess', (guess) => {
        const roomId = socket.data.roomId;
        const userId = socket.data.userId;
        const room = rooms.get(roomId);
        if (!room || !room.scribble)
            return;
        const session = room.scribble;
        if (session.drawerId === userId)
            return; // Drawer cannot guess
        const isCorrect = guess.toLowerCase().trim() === session.word.toLowerCase().trim();
        if (isCorrect && !session.guessedUsers.includes(userId)) {
            session.guessedUsers.push(userId);
            // Award points
            room.users[userId].score += 10; // Guesser gets 10 points
            room.users[session.drawerId].score += 5; // Drawer gets 5 points
            // Clear Scribble Timer interval
            const activeInterval = scribbleIntervals.get(roomId);
            if (activeInterval) {
                clearInterval(activeInterval);
                scribbleIntervals.delete(roomId);
            }
            // Check if user earned "Scribble Master" award
            if (room.users[userId].score >= 30 && !room.users[userId].awards.includes('Scribble Master')) {
                room.users[userId].awards.push('Scribble Master');
            }
            io.to(roomId).emit('scribble-correct', {
                guesserId: userId,
                guesserNickname: room.users[userId].nickname,
                word: session.word,
                scores: Object.values(room.users).map(u => ({ id: u.id, score: u.score, awards: u.awards }))
            });
        }
        else {
            // Forward incorrect guess to chat for social element
            io.to(roomId).emit('message-received', {
                id: Math.random().toString(36).substring(2, 9),
                senderId: userId,
                senderNickname: room.users[userId].nickname,
                text: `Guessed: ${guess}`,
                isOneTime: false,
                timestamp: Date.now()
            });
        }
    });
    // GAME EVENTS: STORY BUILDER
    socket.on('story-submit', (sentenceText) => {
        const roomId = socket.data.roomId;
        const userId = socket.data.userId;
        const room = rooms.get(roomId);
        if (!room || !room.story)
            return;
        const session = room.story;
        if (session.turnUserId !== userId)
            return; // Not their turn
        const usersList = Object.keys(room.users);
        const nextTurnUserId = usersList.find(uid => uid !== userId) || userId;
        session.turnCount++;
        const isTwistTurn = session.turnCount > 0 && session.turnCount % 3 === 0;
        session.sentences.push({
            userId,
            nickname: room.users[userId].nickname,
            text: sentenceText,
            isTwist: false // Flag if it incorporates a twist
        });
        // Award story teller points
        room.users[userId].score += 5;
        let nextTwist = undefined;
        if (isTwistTurn) {
            nextTwist = STORY_TWISTS[Math.floor(Math.random() * STORY_TWISTS.length)];
            session.currentTwist = nextTwist;
            // Mark next writer with a twist challenge
        }
        else {
            session.currentTwist = undefined;
        }
        session.turnUserId = nextTurnUserId;
        room.lastActiveAt = Date.now();
        // Check if user earned "Bard" award
        if (session.sentences.filter(s => s.userId === userId).length >= 5 && !room.users[userId].awards.includes('Legendary Bard')) {
            room.users[userId].awards.push('Legendary Bard');
        }
        io.to(roomId).emit('story-updated', {
            story: session,
            scores: Object.values(room.users).map(u => ({ id: u.id, score: u.score, awards: u.awards }))
        });
    });
    // GAME EVENTS: NEVER HAVE I EVER
    socket.on('nhie-vote', (answer) => {
        const roomId = socket.data.roomId;
        const userId = socket.data.userId;
        const room = rooms.get(roomId);
        if (!room || !room.nhie)
            return;
        const session = room.nhie;
        session.answers[userId] = answer;
        const usersList = Object.keys(room.users);
        const totalVoted = Object.keys(session.answers).length;
        room.lastActiveAt = Date.now();
        if (totalVoted >= usersList.length) {
            // Both voted, reveal answers and present a discussion prompt
            const discussionPrompt = NHIE_DISCUSSIONS[Math.floor(Math.random() * NHIE_DISCUSSIONS.length)];
            session.discussionPrompt = discussionPrompt;
            // Add scores (just a fun token point for participation)
            usersList.forEach(uid => {
                room.users[uid].score += 2;
            });
            // Award "Open Book" award for playing multiple NHIE rounds
            usersList.forEach(uid => {
                if (session.history.length >= 3 && !room.users[uid].awards.includes('Open Book')) {
                    room.users[uid].awards.push('Open Book');
                }
            });
            io.to(roomId).emit('nhie-revealed', {
                nhie: session,
                scores: Object.values(room.users).map(u => ({ id: u.id, score: u.score, awards: u.awards }))
            });
        }
        else {
            // Let other player know someone voted (status update)
            socket.to(roomId).emit('nhie-voted-status', { userId });
        }
    });
    socket.on('nhie-next', () => {
        const roomId = socket.data.roomId;
        const room = rooms.get(roomId);
        if (!room || !room.nhie)
            return;
        const session = room.nhie;
        let nextQuestion = NHIE_CARDS[Math.floor(Math.random() * NHIE_CARDS.length)];
        // Try to avoid repeats if possible
        let attempts = 0;
        while (session.history.includes(nextQuestion) && attempts < 10) {
            nextQuestion = NHIE_CARDS[Math.floor(Math.random() * NHIE_CARDS.length)];
            attempts++;
        }
        session.currentQuestion = nextQuestion;
        session.answers = {};
        session.discussionPrompt = undefined;
        session.history.push(nextQuestion);
        room.lastActiveAt = Date.now();
        io.to(roomId).emit('game-started', {
            activeGame: 'nhie',
            nhie: session
        });
    });
    // 6. WEBRTC CALL CONSENT & SIGNALING
    socket.on('call-request', ({ type }) => {
        const roomId = socket.data.roomId;
        const userId = socket.data.userId;
        if (roomId) {
            console.log(`Call request (${type}) from ${userId} in room ${roomId}`);
            socket.to(roomId).emit('call-request-received', { senderId: userId, type });
        }
    });
    socket.on('call-response', ({ accepted }) => {
        const roomId = socket.data.roomId;
        if (roomId) {
            console.log(`Call response: accepted=${accepted} in room ${roomId}`);
            socket.to(roomId).emit('call-response-received', { accepted });
        }
    });
    socket.on('webrtc-signal', (data) => {
        const roomId = socket.data.roomId;
        if (roomId) {
            // Relay signaling payload directly to peer
            socket.to(roomId).emit('webrtc-signal-received', data);
        }
    });
    socket.on('end-call', () => {
        const roomId = socket.data.roomId;
        if (roomId) {
            socket.to(roomId).emit('call-ended');
        }
    });
    // 7. DISCONNECT & LEAVE
    socket.on('disconnect', () => {
        const roomId = socket.data.roomId;
        const userId = socket.data.userId;
        console.log(`Socket disconnected: ${socket.id} (user: ${userId}, room: ${roomId})`);
        if (roomId) {
            const room = rooms.get(roomId);
            if (room) {
                // Remove user from room state
                delete room.users[userId];
                room.lastActiveAt = Date.now();
                const remainingUsers = Object.keys(room.users);
                if (remainingUsers.length === 0) {
                    console.log(`Deleting room ${roomId} - all users left`);
                    rooms.delete(roomId);
                    // Clear any scribble intervals
                    const activeInterval = scribbleIntervals.get(roomId);
                    if (activeInterval) {
                        clearInterval(activeInterval);
                        scribbleIntervals.delete(roomId);
                    }
                }
                else {
                    // Reset game if one player remains
                    room.activeGame = undefined;
                    room.scribble = undefined;
                    room.story = undefined;
                    room.nhie = undefined;
                    const activeInterval = scribbleIntervals.get(roomId);
                    if (activeInterval) {
                        clearInterval(activeInterval);
                        scribbleIntervals.delete(roomId);
                    }
                    io.to(roomId).emit('user-left', {
                        userId,
                        roomState: room
                    });
                }
            }
        }
    });
});
server.listen(PORT, () => {
    console.log(`RoomZero signaling server listening on port ${PORT}`);
});
