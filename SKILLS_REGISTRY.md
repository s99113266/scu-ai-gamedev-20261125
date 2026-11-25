# 遊戲開發技能登錄
2026-11-24 初始化。Node v24.19.0、npm 12.0.2、Git 2.50.1.windows.1 已實際執行版本檢查。全域技能目錄為 C:/Users/CHERRY/.agents/skills。文件型技能可直接閱讀，獨立斜線指令未測。

| 技能 | 已驗證的位置（相對全域技能目錄） | 使用階段與輸入 → 輸出 |
|---|---|---|
| game-feel | gamedev-skills/references/game-feel.SKILL.md | 戰鬥整合時，依命中事件設計回饋 |
| game-ui-ux | gamedev-skills/references/game-ui-ux.SKILL.md | 依玩家資訊需求設計 HUD |
| level-design | 專案內 .agents/skills/level-design/SKILL.md，已安裝並讀取 | 依玩家移動能力安排關卡節奏 |
| procedural-gen | gamedev-skills/references/procedural-gen.SKILL.md | 依種子與規則設計生成內容 |
| shader-programming | gamedev-skills/references/shader-programming.SKILL.md | 依視覺需求設計著色器 |
| pixelfx | pixelfx/SKILL.md | 技能描述 → 特效或圖集。安裝目錄只有操作說明，匯出階段需取得原始碼並實測 |
| agent-sprite-forge | agent-sprite-forge/SKILL.md 與 references | 美術規格 → 提示詞、角色圖集。已驗證文件，生成與裁切留待美術方向確認 |
| setup-matt-pocock-skills、grill-with-docs、improve-codebase-architecture | 三個同名資料夾各有 SKILL.md | 以本機文件管理需求、設計訪談及架構檢查。專案設定須先確認 |

安裝來源對照 game-skills.txt。前五項對應 gamedev-skills/awesome-gamedev-agent-skills，其餘依序為 patch-gg/pixelfx、0x0funky/agent-sprite-forge、mattpocock/skills。文件閱讀在本機執行。本階段未使用付費 API。

進度由 PROGRESS.json 的 currentStep、currentQuestion 與 status 讀取，completedSteps 記錄已完成階段，answers 保存開發者已確認的回答。

開發者已選擇先做設計訪談。美術方向確認後，再用第一張角色圖集與第一個戰鬥特效驗證實際輸出。
