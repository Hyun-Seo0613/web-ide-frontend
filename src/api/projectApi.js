import { client } from "./client";

export const projectApi = {
  // 내 프로젝트 목록
  getAll: async () => {
    const { data } = await client.get("/api/projects");
    return data;
  },

  // 프로젝트 생성
  create: async ({ name, description }) => {
    const { data } = await client.post("/api/projects", { name, description });
    return data;
  },

  // 초대코드로 프로젝트 조회
  getByInviteCode: async (inviteCode) => {
    const { data } = await client.get(`/api/projects/invite/${inviteCode}`);
    return data;
  },

  // 초대코드로 참가 (스웨거상 query로 inviteCode,userId 필요)
  joinByInviteCode: async ({ projectId, inviteCode, userId }) => {
    const { data } = await client.post(
      `/api/projects/${projectId}/members/join`,
      null,
      { params: { inviteCode, userId } }
    );
    return data;
  },
};
