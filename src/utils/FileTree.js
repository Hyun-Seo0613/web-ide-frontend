export function buildTreeFromFlat(nodes) {
  // nodes: [{id, parentId, name, type:"FILE"|"FOLDER", ...}]
  const map = new Map();
  const roots = [];

  for (const n of nodes || []) {
    map.set(n.id, { ...n, children: [] });
  }

  for (const n of nodes || []) {
    const cur = map.get(n.id);
    const pid = n.parentId;

    // parentId가 null/undefined/0 이면 루트 취급 (서버 정책 확실하지 않음 → 안전하게 처리)
    if (pid === null || pid === undefined || pid === 0 || !map.has(pid)) {
      roots.push(cur);
    } else {
      map.get(pid).children.push(cur);
    }
  }

  // 폴더 먼저, 이름순 정렬(옵션)
  const sortRec = (arr) => {
    arr.sort((a, b) => {
      const aIsFolder = a.type === "FOLDER";
      const bIsFolder = b.type === "FOLDER";
      if (aIsFolder !== bIsFolder) return aIsFolder ? -1 : 1;
      return String(a.name).localeCompare(String(b.name));
    });
    for (const x of arr) {
      if (x.children?.length) sortRec(x.children);
    }
  };
  sortRec(roots);

  return { id: "root", name: "root", type: "FOLDER", children: roots };
}

export function findNodeById(root, id) {
  if (!root) return null;
  if (root.id === id) return root;
  const ch = root.children || [];
  for (const c of ch) {
    const found = findNodeById(c, id);
    if (found) return found;
  }
  return null;
}

export function findParentOf(root, id, parent = null) {
  if (!root) return null;
  if (root.id === id) return parent;
  for (const c of root.children || []) {
    const found = findParentOf(c, id, root);
    if (found) return found;
  }
  return null;
}
