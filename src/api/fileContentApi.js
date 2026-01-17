// src/api/fileContentApi.js
import { client } from "./client";

export const fileContentApi = {
  getLatest: async (fileId) => {
    const { data } = await client.get(`/api/file-contents/file/${fileId}`);
    return data; // FileContentResponseDto
  },

  save: async ({ fileId, content }) => {
    const { data } = await client.post("/api/file-contents", {
      fileId,
      content,
    });
    return data; // FileContentResponseDto (version 증가)
  },

  history: async (fileId) => {
    const { data } = await client.get(
      `/api/file-contents/file/${fileId}/history`
    );
    return data; // FileContentResponseDto[]
  },

  getByVersion: async ({ fileId, version }) => {
    const { data } = await client.get(
      `/api/file-contents/file/${fileId}/version/${version}`
    );
    return data;
  },
};
