let stompClient = null;
let currentRoom = null;
let currentUsername = null;

// ---- DOM refs ----
const welcomePage   = document.getElementById('welcome-page');
const chatPage      = document.getElementById('chat-page');
const usernameInput = document.getElementById('username');
const roomCodeInput = document.getElementById('room-code-input');
const btnHost       = document.getElementById('btn-host');
const btnJoin       = document.getElementById('btn-join');
const btnLeave      = document.getElementById('btn-leave');
const btnSend       = document.getElementById('btn-send');
const messageInput  = document.getElementById('message-input');
const chatMessages  = document.getElementById('chat-messages');
const joinError     = document.getElementById('join-error');

// Modal refs
const roomModal     = document.getElementById('room-modal');
const modalRoomCode = document.getElementById('modal-room-code');
const btnCopyCode   = document.getElementById('btn-copy-code');
const copyFeedback  = document.getElementById('copy-feedback');
const btnEnterRoom  = document.getElementById('btn-enter-room');
const btnCopyHeader = document.getElementById('btn-copy-header');

// ---- Utilities ----
function generateRoomCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function generateMessageId() {
    return 'msg-' + Math.random().toString(36).substr(2, 9);
}

function copyToClipboard(text, feedbackEl) {
    navigator.clipboard.writeText(text).then(() => {
        if (feedbackEl) {
            feedbackEl.classList.remove('hidden');
            setTimeout(() => feedbackEl.classList.add('hidden'), 2500);
        }
    }).catch(() => {
        // Fallback for browsers that block clipboard on non-https
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        if (feedbackEl) {
            feedbackEl.classList.remove('hidden');
            setTimeout(() => feedbackEl.classList.add('hidden'), 2500);
        }
    });
}

// ---- HOST ----
btnHost.addEventListener('click', () => {
    const username = usernameInput.value.trim();
    if (!username) {
        joinError.textContent = '❌ Enter a Codename first.';
        joinError.classList.remove('hidden');
        return;
    }
    joinError.classList.add('hidden');
    currentUsername = username;
    currentRoom = generateRoomCode();

    // Show the share modal first
    modalRoomCode.textContent = currentRoom;
    copyFeedback.classList.add('hidden');
    roomModal.classList.remove('hidden');
});

// Copy button inside modal
btnCopyCode.addEventListener('click', () => {
    copyToClipboard(currentRoom, copyFeedback);
});

// Enter Room from modal — connect only when user clicks this
btnEnterRoom.addEventListener('click', () => {
    roomModal.classList.add('hidden');
    connectToChat();
});

// ---- JOIN ----
btnJoin.addEventListener('click', joinRoom);
roomCodeInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') joinRoom();
});

function joinRoom() {
    const username = usernameInput.value.trim();
    const room     = roomCodeInput.value.trim().toUpperCase();

    if (!username || !room) {
        joinError.textContent = '❌ Enter both a Codename and a Room Code.';
        joinError.classList.remove('hidden');
        return;
    }
    if (room.length < 4) {
        joinError.textContent = '❌ Room Code looks too short. Double-check it.';
        joinError.classList.remove('hidden');
        return;
    }
    joinError.classList.add('hidden');
    currentUsername = username;
    currentRoom     = room;
    connectToChat();
}

// ---- LEAVE ----
btnLeave.addEventListener('click', () => {
    if (stompClient && stompClient.connected) {
        stompClient.send(`/app/chat.sendMessage/${currentRoom}`, {}, JSON.stringify({
            sender: currentUsername,
            type: 'LEAVE',
            roomCode: currentRoom
        }));
        stompClient.disconnect();
    }
    chatPage.classList.add('hidden');
    welcomePage.classList.remove('hidden');
    chatMessages.innerHTML = '';
    currentRoom = null;
    stompClient = null;
});

// ---- Copy room code from chat header ----
btnCopyHeader.addEventListener('click', () => {
    if (currentRoom) {
        copyToClipboard(currentRoom, null);
        btnCopyHeader.textContent = '✅';
        setTimeout(() => { btnCopyHeader.textContent = '📋'; }, 2000);
    }
});

// ---- WEBSOCKET ----
function connectToChat() {
    const socket = new SockJS('/ws');
    stompClient  = Stomp.over(socket);
    stompClient.debug = null; // suppress STOMP logs

    stompClient.connect({}, onConnected, onError);
}

function onConnected() {
    welcomePage.classList.add('hidden');
    chatPage.classList.remove('hidden');
    document.getElementById('room-code-display').innerText = currentRoom;

    // Subscribe to this room's topic
    stompClient.subscribe(`/topic/${currentRoom}`, onMessageReceived);

    // Announce join
    stompClient.send(`/app/chat.addUser/${currentRoom}`, {},
        JSON.stringify({ sender: currentUsername, type: 'JOIN', roomCode: currentRoom })
    );
}

function onError(error) {
    console.error('WebSocket error:', error);
    alert('Could not connect to the chat server. Please refresh and try again.');
}

// ---- SEND MESSAGE ----
function sendMessage() {
    const content = messageInput.value.trim();
    if (content && stompClient && stompClient.connected) {
        stompClient.send(`/app/chat.sendMessage/${currentRoom}`, {}, JSON.stringify({
            sender:    currentUsername,
            content:   content,
            type:      'CHAT',
            roomCode:  currentRoom,
            messageId: generateMessageId(),
            reactions: {}
        }));
        messageInput.value = '';
    }
}

btnSend.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
});

// ---- REACTIONS ----
function sendReaction(messageId, emoji) {
    if (stompClient && stompClient.connected) {
        stompClient.send(`/app/chat.react/${currentRoom}`, {}, JSON.stringify({
            sender:    currentUsername,
            type:      'REACT',
            roomCode:  currentRoom,
            messageId: messageId,
            content:   emoji
        }));
    }
}

// ---- MESSAGE STORE (for reaction updates) ----
const existingMessages = {};

// ---- RECEIVE MESSAGE ----
function onMessageReceived(payload) {
    const message = JSON.parse(payload.body);

    if (message.type === 'JOIN') {
        renderEventMessage(`⚡ ${message.sender} connected to the grid.`);
    } else if (message.type === 'LEAVE') {
        renderEventMessage(`🔌 ${message.sender} disconnected from the grid.`);
    } else if (message.type === 'CHAT') {
        renderChatMessage(message);
    } else if (message.type === 'REACT') {
        updateMessageReaction(message.messageId, message.content);
    }

    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function renderEventMessage(text) {
    const el = document.createElement('div');
    el.classList.add('event-message');
    el.innerText = text;
    chatMessages.appendChild(el);
}

function renderChatMessage(msg) {
    existingMessages[msg.messageId] = { ...msg, reactions: msg.reactions || {} };

    const wrapper = document.createElement('div');
    wrapper.classList.add('message-wrapper');
    wrapper.id = msg.messageId;
    if (msg.sender === currentUsername) wrapper.classList.add('own');

    // Reaction bar (sits in padding-top area)
    const reactionBar = document.createElement('div');
    reactionBar.classList.add('reaction-bar');
    ['👍','❤️','😂','😮','😢','😡'].forEach(e => {
        const span = document.createElement('span');
        span.classList.add('react-emoji');
        span.innerText = e;
        span.title = e;
        span.onclick = () => sendReaction(msg.messageId, e);
        reactionBar.appendChild(span);
    });

    const senderName = document.createElement('div');
    senderName.classList.add('sender-name');
    senderName.innerText = msg.sender;

    const bubble = document.createElement('div');
    bubble.classList.add('message-bubble');
    bubble.innerText = msg.content;

    const reactionsDisplay = document.createElement('div');
    reactionsDisplay.classList.add('reactions-display');
    reactionsDisplay.id = `react-disp-${msg.messageId}`;

    wrapper.appendChild(reactionBar);
    wrapper.appendChild(senderName);
    wrapper.appendChild(bubble);
    wrapper.appendChild(reactionsDisplay);

    chatMessages.appendChild(wrapper);
}

function updateMessageReaction(msgId, emoji) {
    const msgObj = existingMessages[msgId];
    if (!msgObj) return;

    msgObj.reactions[emoji] = (msgObj.reactions[emoji] || 0) + 1;

    const display = document.getElementById(`react-disp-${msgId}`);
    if (display) {
        display.innerHTML = '';
        Object.entries(msgObj.reactions).forEach(([emo, count]) => {
            const chip = document.createElement('div');
            chip.classList.add('reaction-chip');
            chip.innerText = `${emo} ${count}`;
            display.appendChild(chip);
        });
    }
}
