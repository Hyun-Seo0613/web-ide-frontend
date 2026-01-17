// src/api/fileApi.js
import { client } from "./client";

/**
 * Swagger:
 * GET  /api/files/project/{projectId}/tree
 * POST /api/files
 * DELETE /api/files/{fileId}
 * PUT /api/files/{fileId}/name
 */

export const fileApi = {
  async getTree(projectId) {
    const { data } = await client.get(`/api/files/project/${projectId}/tree`);
    return data; // array
  },

  async create({ projectId, parentId = null, name, type }) {
    const payload = { projectId, parentId, name, type }; // type: "FILE" | "FOLDER"
    const { data } = await client.post(`/api/files`, payload);
    return data;
  },

  async remove(fileId) {
    const { data } = await client.delete(`/api/files/${fileId}`);
    return data;
  },

  async rename({ fileId, name }) {
    const { data } = await client.put(`/api/files/${fileId}/name`, { name });
    return data; // FileResponseDto
  },
};
