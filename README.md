# scu-ai-gamedev-20261125
使用ChatGPT的Codex

## 孤機
一名亡國軍人駕駛最後的偵察機，從母港穿過造船廠，突破敵軍封鎖線。這是桌面瀏覽器使用的 Phaser 正俯視射擊遊戲。

## 啟動與操作
在本資料夾執行 npm install，再執行 npm run dev，開啟終端機顯示的本機網址。npm run build 會建立發行檔。選「開始突圍」體驗三區航程，或選「試玩雙 Boss」直接演練決戰。
方向鍵移動，普通火力自動連射。滿血時拾取綠十字可充能；空白鍵依序啟動及提升三階雷射。依畫面按 A、S、D 完成 Boss 防禦。新區與 Boss 戰開始時有檢查點。

## 素材與驗收
主角、敵艦、場景與補給由內建圖片生成工具製作並整理為透明像素圖或捲動圖層。PixelFX 圖集與 Phaser 程式特效負責武器及命中回饋。素材見 config/asset-manifest.json，玩法見 GDD.md，美術見 ART_BIBLE.md，平衡與測試結果見 GAME_BALANCE.md 和 PLAYTEST.md。使用技能見 SKILLS_REGISTRY.md。完整自然通關時間仍待實測；Boss 攻擊花樣列為後續調整。
