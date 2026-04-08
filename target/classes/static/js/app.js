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

const defaultActionGroup = document.getElementById('default-action-group');
const directJoinGroup    = document.getElementById('direct-join-group');
const btnDirectJoin      = document.getElementById('btn-direct-join');
const directJoinRoomCode = document.getElementById('direct-join-room-code');

// Modal refs
const roomModal      = document.getElementById('room-modal');
const modalRoomCode  = document.getElementById('modal-room-code');
const modalRoomLink  = document.getElementById('modal-room-link');
const btnCopyCode    = document.getElementById('btn-copy-code');
const btnCopyLink    = document.getElementById('btn-copy-link');
const copyFeedback   = document.getElementById('copy-feedback');
const btnEnterRoom   = document.getElementById('btn-enter-room');
const btnCopyHeader  = document.getElementById('btn-copy-header');

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

    // Build a direct join link using the current origin so it works in all environments
    const roomLink = `${window.location.origin}?room=${currentRoom}`;

    // Show the share modal first, with both code and link
    modalRoomCode.textContent = currentRoom;
    if (modalRoomLink) {
        modalRoomLink.textContent = roomLink;
    }
    copyFeedback.classList.add('hidden');
    roomModal.classList.remove('hidden');
});

// Copy button inside modal (room code)
btnCopyCode.addEventListener('click', () => {
    copyToClipboard(currentRoom, copyFeedback);
});

// Copy button for direct join link
if (btnCopyLink) {
    btnCopyLink.addEventListener('click', () => {
        if (!currentRoom) return;
        const roomLink = `${window.location.origin}?room=${currentRoom}`;
        copyToClipboard(roomLink, copyFeedback);
    });
}

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

if (btnDirectJoin) {
    btnDirectJoin.addEventListener('click', joinRoom);
}

usernameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        if (directJoinGroup && !directJoinGroup.classList.contains('hidden')) {
            joinRoom();
        }
    }
});

function joinRoom() {
    const username = usernameInput.value.trim();
    const room     = roomCodeInput.value.trim().toUpperCase();

    if (!username) {
        joinError.textContent = '❌ Enter a Codename first.';
        joinError.classList.remove('hidden');
        return;
    }
    if (!room) {
        joinError.textContent = '❌ Enter a Room Code.';
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

// ---- URL PARAM HANDLING (direct join links) ----
// If someone opens ?room=ABC123 (e.g. https://neonchat-6dzo.onrender.com?room=ABC123)
// pre-fill the room code so they just need to choose a Codename and hit JOIN.
(function prefillRoomFromUrl() {
    try {
        const params = new URLSearchParams(window.location.search);
        const roomFromUrl = params.get('room');
        if (roomFromUrl && roomCodeInput) {
            const room = roomFromUrl.toUpperCase();
            roomCodeInput.value = room;
            
            if (defaultActionGroup && directJoinGroup) {
                defaultActionGroup.classList.add('hidden');
                directJoinGroup.classList.remove('hidden');
                if (directJoinRoomCode) directJoinRoomCode.innerText = `[${room}]`;
            }

            usernameInput && usernameInput.focus();
        }
    } catch (e) {
        // Ignore malformed URLs
        console.warn('Could not parse room code from URL', e);
    }
})();

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
