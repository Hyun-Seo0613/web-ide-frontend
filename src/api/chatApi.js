// src/api/chatApi.js
import { client } from "./client";

/**
 * Swagger:
 * GET  /api/chat/rooms
 * POST /api/chat/rooms
 * GET  /api/chat/rooms/{roomId}/messages
 * GET  /api/chat/rooms/{roomId}/search?keyword=...
 *
 * 응답 래퍼: { status, message, data: ... }
 */

function unwrap(resData) {
  // ApiResponse...Dto 형태면 data만 꺼내기
  if (resData && typeof resData === "object" && "data" in resData)
    return resData.data;
  return resData;
}

export const chatApi = {
  async getRooms() {
    const { data } = await client.get("/api/chat/rooms");
    return unwrap(data); // ChatRoomDto[]
  },

  async createRoom({ name }) {
    const { data } = await client.post("/api/chat/rooms", { name });
    return unwrap(data); // ChatRoomDto
  },

  async getMessages(roomId) {
    const { data } = await client.get(`/api/chat/rooms/${roomId}/messages`);
    return unwrap(data); // ChatMessageDto[]
  },

  async searchMessages({ roomId, keyword }) {
    const { data } = await client.get(`/api/chat/rooms/${roomId}/search`, {
      params: { keyword },
    });
    return unwrap(data); // ChatMessageDto[]
  },
};
