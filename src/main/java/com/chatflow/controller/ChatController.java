package com.chatflow.controller;

import com.chatflow.model.ChatMessage;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.handler.annotation.SendTo;
import org.springframework.stereotype.Controller;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;

@Controller
public class ChatController {

    @MessageMapping("/chat.sendMessage/{roomCode}")
    @SendTo("/topic/{roomCode}")
    public ChatMessage sendMessage(@Payload ChatMessage chatMessage, @DestinationVariable String roomCode) {
        return chatMessage;
    }

    @MessageMapping("/chat.addUser/{roomCode}")
    @SendTo("/topic/{roomCode}")
    public ChatMessage addUser(@Payload ChatMessage chatMessage, @DestinationVariable String roomCode, SimpMessageHeaderAccessor headerAccessor) {
        // Add user in web socket session
        headerAccessor.getSessionAttributes().put("username", chatMessage.getSender());
        headerAccessor.getSessionAttributes().put("roomCode", roomCode);
        return chatMessage;
    }

    @MessageMapping("/chat.react/{roomCode}")
    @SendTo("/topic/{roomCode}")
    public ChatMessage reactMessage(@Payload ChatMessage chatMessage, @DestinationVariable String roomCode) {
        return chatMessage;
    }
}
