package com.chatflow.model;

import java.util.HashMap;
import java.util.Map;

public class ChatMessage {
    private String content;
    private String sender;
    private MessageType type;
    private String roomCode;
    private String messageId;
    private Map<String, Integer> reactions = new HashMap<>(); // emoji -> count

    public enum MessageType {
        CHAT,
        JOIN,
        LEAVE,
        REACT
    }

    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }
    
    public String getSender() { return sender; }
    public void setSender(String sender) { this.sender = sender; }
    
    public MessageType getType() { return type; }
    public void setType(MessageType type) { this.type = type; }
    
    public String getRoomCode() { return roomCode; }
    public void setRoomCode(String roomCode) { this.roomCode = roomCode; }

    public String getMessageId() { return messageId; }
    public void setMessageId(String messageId) { this.messageId = messageId; }

    public Map<String, Integer> getReactions() { return reactions; }
    public void setReactions(Map<String, Integer> reactions) { this.reactions = reactions; }
}
