// src/api/projectApi.js
import { client } from "./client";

export const projectApi = {
  // ✅ 내 프로젝트 목록 (JWT 기준)
  getMy: async () => {
    const { data } = await client.get("/api/projects/my");
    return data; // array of ProjectResponseDto
  },

  // (선택) 전체 프로젝트가 필요하면 백엔드 정책 확정 후 유지
  // getAll: async () => {
  //   const { data } = await client.get("/api/projects");
  //   return data;
  // },

  // 프로젝트 생성
  create: async ({ name, description }) => {
    const { data } = await client.post("/api/projects", { name, description });
    return data;
  },

  // 프로젝트 상세 조회
  getById: async (projectId) => {
    const { data } = await client.get(`/api/projects/${projectId}`);
    return data;
  },

  // 초대코드로 프로젝트 조회
  getByInviteCode: async (inviteCode) => {
    const { data } = await client.get(`/api/projects/invite/${inviteCode}`);
    return data;
  },

  // 초대코드로 참가 (userId는 JWT에서 추출)
  joinByInviteCode: async ({ projectId, inviteCode }) => {
    const { data } = await client.post(
      `/api/projects/${projectId}/members/join`,
      null,
      { params: { inviteCode } }
    );
    return data;
  },
};
