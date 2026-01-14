import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";

import HeaderBar from "./HeaderBar";
import FileExplorer from "./FileExplorer";
import EditorArea from "./EditorArea";
import TerminalPanel from "./TerminalPanel";
import ChatPanel from "./ChatPanel";

import { logout } from "../auth/auth";

function IDELayout() {
  const navigate = useNavigate();

  // 패널 열림/닫힘 상태
  const [isLeftOpen, setIsLeftOpen] = useState(true);
  const [isRightOpen, setIsRightOpen] = useState(true);
  const [isTerminalOpen, setIsTerminalOpen] = useState(true);

  // 더미 파일 목록(나중에 백엔드 연동 시 교체)
  const files = [
    {
      id: "app",
      type: "file",
      title: "App.jsx",
      content: "// App.jsx\n",
      savedContent: "// App.jsx\n",
    },
    {
      id: "css",
      type: "file",
      title: "index.css",
      content: "/* index.css */\n",
      savedContent: "/* index.css */\n",
    },
    {
      id: "readme",
      type: "file",
      title: "README.md",
      content: "# README\n",
      savedContent: "# README\n",
    },
  ];

  // 열린 탭 & 활성 탭
  const [tabs, setTabs] = useState([files[0]]);
  const [activeTabId, setActiveTabId] = useState(files[0].id);

  // 파일 클릭 → 탭 열기
  const handleOpenFile = (file) => {
    setTabs((prevTabs) => {
      const exists = prevTabs.some((t) => t.id === file.id);
      return exists ? prevTabs : [...prevTabs, file];
    });
    setActiveTabId(file.id);
  };

  // 탭 닫기
  const handleCloseTab = (tabId) => {
    const tab = tabs.find((t) => t.id === tabId);
    const isDirty = tab && tab.content !== tab.savedContent;

    if (isDirty) {
      const ok = window.confirm("저장되지 않은 변경사항이 있어요. 닫을까요?");
      if (!ok) return;
    }

    setTabs((prevTabs) => {
      const index = prevTabs.findIndex((t) => t.id === tabId);
      const nextTabs = prevTabs.filter((t) => t.id !== tabId);

      // 닫은 탭이 active가 아니면 active 유지
      if (activeTabId !== tabId) return nextTabs;

      // 전부 닫힌 경우
      if (nextTabs.length === 0) {
        setActiveTabId(null);
        return nextTabs;
      }

      // 닫은 탭이 active였다면 왼쪽 탭(없으면 첫 탭)으로 이동
      const nextIndex = Math.max(0, index - 1);
      setActiveTabId(nextTabs[nextIndex].id);
      return nextTabs;
    });
  };

  // 현재 활성 탭 내용 수정
  const handleChangeContent = (nextContent) => {
    setTabs((prevTabs) =>
      prevTabs.map((t) =>
        t.id === activeTabId ? { ...t, content: nextContent } : t
      )
    );
  };

  // 저장 함수
  const handleSaveActiveTab = useCallback(() => {
    if (!activeTabId) return;

    setTabs((prevTabs) =>
      prevTabs.map((t) =>
        t.id === activeTabId ? { ...t, savedContent: t.content } : t
      )
    );
  }, [activeTabId]);

  // Cmd/Ctrl + S 저장
  useEffect(() => {
    const onKeyDown = (e) => {
      const isMac = navigator.platform.toUpperCase().includes("MAC");
      const isSave =
        (isMac && e.metaKey && e.key.toLowerCase() === "s") ||
        (!isMac && e.ctrlKey && e.key.toLowerCase() === "s");

      if (!isSave) return;

      e.preventDefault();
      handleSaveActiveTab();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleSaveActiveTab]);

  // 로그아웃
  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <div
      className="ide-root"
      style={{
        gridTemplateRows: `
          48px
          1fr
          ${isTerminalOpen ? "180px" : "0px"}
        `,
      }}
    >
      <div className="ide-header">
        <HeaderBar
          onToggleLeft={() => setIsLeftOpen((x) => !x)}
          onToggleRight={() => setIsRightOpen((x) => !x)}
          onToggleTerminal={() => setIsTerminalOpen((x) => !x)}
          onSave={handleSaveActiveTab}
          onLogout={handleLogout}
          user={{ name: "developer" }}
        />
      </div>

      <div
        className="ide-body"
        style={{
          gridTemplateColumns: `
            ${isLeftOpen ? "240px" : "0px"}
            1fr
            ${isRightOpen ? "320px" : "0px"}
          `,
        }}
      >
        <aside className={`ide-left ${isLeftOpen ? "" : "closed"}`}>
          <FileExplorer
            files={files}
            onOpenFile={handleOpenFile}
            openTabs={tabs}
            activeTabId={activeTabId}
          />
        </aside>

        <main className="ide-center">
          <EditorArea
            tabs={tabs}
            activeTabId={activeTabId}
            onChangeActiveTab={setActiveTabId}
            onCloseTab={handleCloseTab}
            onChangeContent={handleChangeContent}
          />
        </main>

        <aside className={`ide-right ${isRightOpen ? "" : "closed"}`}>
          <ChatPanel />
        </aside>
      </div>

      <div className={`ide-bottom ${isTerminalOpen ? "" : "closed"}`}>
        <TerminalPanel />
      </div>
    </div>
  );
}

export default IDELayout;
