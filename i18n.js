(function () {
'use strict';
// UI-Texte: Deutsch / English / 中文 (vereinfacht). Platzhalter {x}. Fehlt ein Text, wird Deutsch genommen.
const D = {
de: {
  sub: 'Tippe die Übersetzung – und das Monster macht <b>PLOPP!</b>', lblList: 'Vokabelliste', play: '▶ Spielen', bSettings: '⚙️ Einstellungen', bVocab: '📝 Vokabeln', bStats: '📊 Statistik', bScores: '🏆 Highscores', record: 'Rekord:',
  tSettings: '⚙️ Einstellungen', lblUi: '🌐 Sprache', lblDir: 'Richtung', lblSpeed: 'Tempo', sp_ohne: '⏸ Ohne Zeitlimit (Monster warten)', sp_sehrlangsam: '🐌 Sehr langsam (Standard)', sp_langsam: '🐢 Langsam', sp_normal: '🐇 Normal', sp_schnell: '🚀 Schnell', sp_challenger: '🔥 Challenger (sehr schnell)',
  lblInput: 'Antworten', in_tippen: '⌨ Tippen (Tastatur)', in_kacheln: '🔤 Buchstaben-Kacheln', in_mc: '✅ Multiple Choice', lblLives: 'Leben', kbChk: 'Bildschirm-Tastatur anzeigen', sndChk: 'Töne', sayPop: '🔊 Wort beim Platzen vorlesen', say: '🔊 Schwierige Wörter auf der Korrekturkarte vorlesen',
  tRewards: '🎁 Belohnungen', lblSkin: 'Held', lblLaser: 'Laserfarbe', editVocab: '📝 Vokabeln bearbeiten', done: '✔ Fertig',
  tLists: '📝 Vokabeln bearbeiten', connect: '📄 vokabeln.txt verbinden', reconnect: '🔓 vokabeln.txt wieder freigeben', create: '🆕 Neue vokabeln.txt anlegen', import: '📥 Import (.txt)', export: '📤 Export / Download',
  newList: '➕ Liste', delList: '🗑 Liste', addRow: '➕ Neue Zeile', bulkSum: 'Mehrere Zeilen auf einmal einfügen', bulkBtn: '➕ Anhängen', back: '← Zurück', lblPair: 'Sprachen (Spalte 1 · Spalte 2)', undo: '↶ Zurück', clear: '✖ Löschen',
  tStats: '📊 Diese Wörter üben', resetStats: '🗑 Statistik löschen', level: 'Level', combo: 'Combo', newWorld: 'NEUE WELT', tPause: '⏸ Pause', resume: '▶ Weiter', quit: '🏠 Beenden',
  listen: '🔊 Anhören', next: 'Weiter ▶', tWin: '🏆 SIEG! 🏆', winHint: 'Du hast den Vokabel-König besiegt!', winEnd: '🏁 Ergebnis eintragen', winEndless: '♾ Endlos weiterspielen',
  tScores: '🏆 Highscores', lblBook: 'Vokabelbuch', hsDel: '🗑 Highscores dieser Liste löschen', tTop: '🏆 Top 10!', namePh: 'Dein Name', nameOk: '✔ Eintragen', nameSkip: 'Ohne Namen', again: '🔁 Nochmal', menu: '🏠 Menü', gameOver: 'Game Over',
  saved: '✔ in Datei gespeichert', memOnly: '⚠️ Nur im Speicher – mit „Export / Download“ sichern!', saveFail: '⚠️ Speichern fehlgeschlagen: {e}', openFail: 'Datei konnte nicht geöffnet werden: {e}', exported: '✔ Exportiert: {n}',
  noVocab: 'In der Datei wurden keine Vokabeln gefunden (Format: wort;übersetzung).', importAsk: '{l} Listen mit {n} Vokabeln gefunden.\nOK = aktuelle vokabeln.txt komplett ERSETZEN\nAbbrechen = als zusätzliche Listen ANHÄNGEN',
  allLists: '🌈 Alle Listen gemischt', weakWords: '🎯 Meine Fehlerwörter', noList: 'Noch keine Liste – lege mit „➕ Liste“ eine an.', delRow: 'Zeile löschen', newListAsk: 'Name der neuen Liste (z. B. Unit 2 Station 1):', renAsk: 'Neuer Name:', delListAsk: 'Liste „{l}“ mit {n} Vokabeln löschen?',
  bulkDone: '{n} Zeilen angehängt', bulkErr: ' – nicht erkannt: Zeile {e}', noErrors: 'Noch keine Fehler – super! 🎉', resetAsk: 'Ganze Statistik löschen?', space: 'Leertaste', spaceShort: 'Leer',
  notEnoughWeak: 'Noch nicht genug Fehlerwörter – ich nehme alle Listen.', emptyList: 'Diese Liste ist leer.',
  boss_block: 'GROLLO DER KLOTZ', boss_robot: 'MEGA-BOT 3000', boss_spike: 'STACHEL-KÖNIG', boss_drill: 'DER BOHRER', banFinal: 'ENDBOSS!', banRevenge: 'REVANCHE!', banBoss: 'BOSS-KAMPF!', finalName: 'DER VOKABEL-KÖNIG · {n} TREFFER', revengeName: 'Er ist zurück …',
  revengeToast: '👊 Revanche: {q} – 3× richtig!', bossWarn: '⚠️ BOSS-MONSTER!', hitLeft: 'Treffer! Noch {n}×', revengeWon: '🏆 Revanche geschafft! Jetzt kannst du „{a}“!', bossWon: '🏆 Boss besiegt! +1 Leben', levelUp: '⬆️ Level {n}!', finalComes: '👑 Der Endboss kommt!',
  cheer: ["Fast! So geht's:", 'Kein Problem – merk dir:', "Gleich hast du's!", 'Schau mal genau:', 'Das schaffst du:'], youTyped: 'Du hast getippt: ', alsoOk: 'Auch richtig: ', noteRevenge: 'Der Boss kommt nochmal – du packst ihn! 💪', noteEscaped: "Das Wort kommt gleich als Boss zurück – dann kannst du's! 💪", noteRetry: "Probier's gleich nochmal – das Monster wartet! 💪",
  skin_hero: 'Astronaut', 'skin_skin-green': 'Grüner Glibber', 'skin_skin-blue': 'Blauer Blubb', 'skin_skin-pink': 'Pinker Pixel', 'skin_skin-yellow': 'Gelber Blitz', 'skin_skin-gold': 'Goldener Held',
  lz_red: 'Rot', lz_green: 'Grün', lz_blue: 'Blau', lz_purple: 'Lila', lz_gold: 'Gold', lz_rainbow: 'Regenbogen', needPops: 'ab {n} Monstern', needScore: 'ab {n} Punkten', needWin: 'nach dem 1. Sieg',
  progInfo: 'Bisher: {p} Monster geplatzt · bester Highscore {s} · Siege {w}', unlockedToast: '🎁 Neu freigeschaltet: {r} (⚙️ Einstellungen)',
  worlds: ['Sonnenwiese', 'Zauberwald', 'Glutwüste', 'Schneeland', 'Kristallhöhle', 'Unterwelt', 'Himmelsinsel'],
  winStats: '⭐ {s} Punkte · Level {l} · {p} Monster · beste Combo {c} · ❤️ {h}', endless: "♾ Endlos-Modus – weiter geht's!",
  tp_ohne: 'Ohne Zeitlimit', tp_sehrlangsam: 'Sehr langsam', tp_langsam: 'Langsam', tp_normal: 'Normal', tp_schnell: 'Schnell', tp_challenger: 'Challenger', md_tippen: 'Tippen', md_kacheln: 'Kacheln', md_mc: 'Multiple Choice',
  mastery: '🧠 Wörter sicher: {a} / {b}', noHs: 'Noch keine Highscores für dieses Vokabelbuch.', hsName: 'Name', hsPts: 'Punkte', hsMode: 'Modus', hsDate: 'Datum', hsDelAsk: 'Alle Highscores von „{l}“ ({m}) löschen?',
  player: 'Spieler', newRecord: 'Neuer Rekord!', victory: '👑 Sieg!', nameInfo: '{s} Punkte in „{l}“ – wie heißt du?', overInfo: 'Level {l} · {p} Monster geplatzt · beste Combo {c}', practice: 'Die übst du nochmal:',
  dirAns: '{q} → {a} (tippe {a})', dirCol1: 'Spalte 2 → Spalte 1', dirCol2: 'Spalte 1 → Spalte 2', zhNoType: '🔤 Ohne Pinyin kein Tippen bei Chinesisch – ich nehme Kacheln.', zhPinyin: '🔤 Tippe Pinyin (Töne nicht nötig)', zhNote: 'Hinweis: Chinesische Antworten ohne Pinyin (Format 你好|nǐ hǎo) → Kacheln statt Tippen.',
  st_dl: 'Tablet: Dokumente/VokabelMonster/vokabeln.txt', st_data: 'Tablet: App-interner Speicher (Dokumente nicht beschreibbar)', st_ro: 'Nur lesen', st_file: 'Datei: {n}', st_none: 'Noch keine Datei verbunden – mitgelieferte Liste (nur lesen)', st_browser: 'Nur lesen (Browser kann keine Dateien schreiben) – Änderungen per Download sichern', st_download: 'vokabeln.txt (Download)',
  lang: { de: 'Deutsch', en: 'Englisch', zh: 'Chinesisch', es: 'Spanisch', fr: 'Französisch', it: 'Italienisch', pt: 'Portugiesisch', tr: 'Türkisch', pl: 'Polnisch', ru: 'Russisch', nl: 'Niederländisch', la: 'Latein' }
},
en: {
  sub: 'Type the translation – and the monster goes <b>POP!</b>', lblList: 'Word list', play: '▶ Play', bSettings: '⚙️ Settings', bVocab: '📝 Words', bStats: '📊 Stats', bScores: '🏆 High scores', record: 'Best:',
  tSettings: '⚙️ Settings', lblUi: '🌐 Language', lblDir: 'Direction', lblSpeed: 'Speed', sp_ohne: '⏸ No time limit (monsters wait)', sp_sehrlangsam: '🐌 Very slow (default)', sp_langsam: '🐢 Slow', sp_normal: '🐇 Normal', sp_schnell: '🚀 Fast', sp_challenger: '🔥 Challenger (very fast)',
  lblInput: 'Answers', in_tippen: '⌨ Typing (keyboard)', in_kacheln: '🔤 Letter tiles', in_mc: '✅ Multiple choice', lblLives: 'Lives', kbChk: 'Show on-screen keyboard', sndChk: 'Sounds', sayPop: '🔊 Read the word aloud when it pops', say: '🔊 Read difficult words on the correction card',
  tRewards: '🎁 Rewards', lblSkin: 'Hero', lblLaser: 'Laser colour', editVocab: '📝 Edit words', done: '✔ Done',
  tLists: '📝 Edit words', connect: '📄 Connect vokabeln.txt', reconnect: '🔓 Allow vokabeln.txt again', create: '🆕 Create new vokabeln.txt', import: '📥 Import (.txt)', export: '📤 Export / download',
  newList: '➕ List', delList: '🗑 List', addRow: '➕ New row', bulkSum: 'Paste several rows at once', bulkBtn: '➕ Append', back: '← Back', lblPair: 'Languages (column 1 · column 2)', undo: '↶ Undo', clear: '✖ Clear',
  tStats: '📊 Practise these words', resetStats: '🗑 Clear stats', level: 'Level', combo: 'Combo', newWorld: 'NEW WORLD', tPause: '⏸ Pause', resume: '▶ Continue', quit: '🏠 Quit',
  listen: '🔊 Listen', next: 'Next ▶', tWin: '🏆 VICTORY! 🏆', winHint: 'You defeated the Vocab King!', winEnd: '🏁 Save result', winEndless: '♾ Keep playing (endless)',
  tScores: '🏆 High scores', lblBook: 'Word list', hsDel: '🗑 Delete high scores of this list', tTop: '🏆 Top 10!', namePh: 'Your name', nameOk: '✔ Save', nameSkip: 'No name', again: '🔁 Again', menu: '🏠 Menu', gameOver: 'Game Over',
  saved: '✔ saved to file', memOnly: '⚠️ Memory only – save with “Export / download”!', saveFail: '⚠️ Saving failed: {e}', openFail: 'Could not open file: {e}', exported: '✔ Exported: {n}',
  noVocab: 'No words found in this file (format: word;translation).', importAsk: 'Found {l} lists with {n} words.\nOK = REPLACE the current vokabeln.txt completely\nCancel = APPEND as extra lists',
  allLists: '🌈 All lists mixed', weakWords: '🎯 My mistakes', noList: 'No list yet – create one with “➕ List”.', delRow: 'Delete row', newListAsk: 'Name of the new list (e.g. Unit 2):', renAsk: 'New name:', delListAsk: 'Delete list “{l}” with {n} words?',
  bulkDone: '{n} rows appended', bulkErr: ' – not recognised: line {e}', noErrors: 'No mistakes yet – great! 🎉', resetAsk: 'Clear all statistics?', space: 'Space', spaceShort: 'Space',
  notEnoughWeak: 'Not enough mistake words yet – using all lists.', emptyList: 'This list is empty.',
  boss_block: 'GROLLO THE BLOCK', boss_robot: 'MEGA-BOT 3000', boss_spike: 'SPIKE KING', boss_drill: 'THE DRILLER', banFinal: 'FINAL BOSS!', banRevenge: 'REMATCH!', banBoss: 'BOSS FIGHT!', finalName: 'THE VOCAB KING · {n} HITS', revengeName: 'He is back …',
  revengeToast: '👊 Rematch: {q} – 3× right!', bossWarn: '⚠️ BOSS MONSTER!', hitLeft: 'Hit! {n}× to go', revengeWon: '🏆 Rematch won! Now you know “{a}”!', bossWon: '🏆 Boss defeated! +1 life', levelUp: '⬆️ Level {n}!', finalComes: '👑 The final boss is coming!',
  cheer: ['Almost! Here’s how:', 'No problem – remember:', 'You’ll get it soon!', 'Look closely:', 'You can do it:'], youTyped: 'You typed: ', alsoOk: 'Also correct: ', noteRevenge: 'The boss comes back – you’ll beat him! 💪', noteEscaped: 'This word comes back as a boss – then you’ll know it! 💪', noteRetry: 'Try again – the monster is waiting! 💪',
  skin_hero: 'Astronaut', 'skin_skin-green': 'Green Goo', 'skin_skin-blue': 'Blue Blob', 'skin_skin-pink': 'Pink Pixel', 'skin_skin-yellow': 'Yellow Flash', 'skin_skin-gold': 'Golden Hero',
  lz_red: 'Red', lz_green: 'Green', lz_blue: 'Blue', lz_purple: 'Purple', lz_gold: 'Gold', lz_rainbow: 'Rainbow', needPops: 'from {n} monsters', needScore: 'from {n} points', needWin: 'after the 1st victory',
  progInfo: 'So far: {p} monsters popped · best score {s} · victories {w}', unlockedToast: '🎁 Unlocked: {r} (⚙️ Settings)',
  worlds: ['Sunny Meadow', 'Magic Forest', 'Ember Desert', 'Snowland', 'Crystal Cave', 'Underworld', 'Sky Island'],
  winStats: '⭐ {s} points · Level {l} · {p} monsters · best combo {c} · ❤️ {h}', endless: '♾ Endless mode – let’s go on!',
  tp_ohne: 'No time limit', tp_sehrlangsam: 'Very slow', tp_langsam: 'Slow', tp_normal: 'Normal', tp_schnell: 'Fast', tp_challenger: 'Challenger', md_tippen: 'Typing', md_kacheln: 'Tiles', md_mc: 'Multiple choice',
  mastery: '🧠 Words mastered: {a} / {b}', noHs: 'No high scores for this list yet.', hsName: 'Name', hsPts: 'Points', hsMode: 'Mode', hsDate: 'Date', hsDelAsk: 'Delete all high scores of “{l}” ({m})?',
  player: 'Player', newRecord: 'New record!', victory: '👑 Victory!', nameInfo: '{s} points in “{l}” – what’s your name?', overInfo: 'Level {l} · {p} monsters popped · best combo {c}', practice: 'Practise these again:',
  dirAns: '{q} → {a} (type {a})', dirCol1: 'Column 2 → column 1', dirCol2: 'Column 1 → column 2', zhNoType: '🔤 No pinyin, no typing for Chinese – using tiles.', zhPinyin: '🔤 Type pinyin (tones optional)', zhNote: 'Note: Chinese answers without pinyin (format 你好|nǐ hǎo) → tiles instead of typing.',
  st_dl: 'Tablet: Documents/VokabelMonster/vokabeln.txt', st_data: 'Tablet: internal app storage (Documents not writable)', st_ro: 'Read only', st_file: 'File: {n}', st_none: 'No file connected yet – bundled list (read only)', st_browser: 'Read only (browser cannot write files) – save changes via download', st_download: 'vokabeln.txt (download)',
  lang: { de: 'German', en: 'English', zh: 'Chinese', es: 'Spanish', fr: 'French', it: 'Italian', pt: 'Portuguese', tr: 'Turkish', pl: 'Polish', ru: 'Russian', nl: 'Dutch', la: 'Latin' }
},
zh: {
  sub: '输入翻译——怪物就会 <b>砰！</b>', lblList: '单词列表', play: '▶ 开始', bSettings: '⚙️ 设置', bVocab: '📝 单词', bStats: '📊 统计', bScores: '🏆 排行榜', record: '最高分：',
  tSettings: '⚙️ 设置', lblUi: '🌐 语言', lblDir: '方向', lblSpeed: '速度', sp_ohne: '⏸ 不限时（怪物会等你）', sp_sehrlangsam: '🐌 很慢（默认）', sp_langsam: '🐢 慢', sp_normal: '🐇 普通', sp_schnell: '🚀 快', sp_challenger: '🔥 挑战者（非常快）',
  lblInput: '作答方式', in_tippen: '⌨ 打字（键盘）', in_kacheln: '🔤 字母方块', in_mc: '✅ 选择题', lblLives: '生命', kbChk: '显示屏幕键盘', sndChk: '声音', sayPop: '🔊 怪物爆开时朗读单词', say: '🔊 在纠错卡上朗读难词',
  tRewards: '🎁 奖励', lblSkin: '英雄', lblLaser: '激光颜色', editVocab: '📝 编辑单词', done: '✔ 完成',
  tLists: '📝 编辑单词', connect: '📄 连接 vokabeln.txt', reconnect: '🔓 重新允许 vokabeln.txt', create: '🆕 新建 vokabeln.txt', import: '📥 导入 (.txt)', export: '📤 导出 / 下载',
  newList: '➕ 列表', delList: '🗑 列表', addRow: '➕ 新的一行', bulkSum: '一次粘贴多行', bulkBtn: '➕ 添加', back: '← 返回', lblPair: '语言（第1列 · 第2列）', undo: '↶ 撤销', clear: '✖ 清除',
  tStats: '📊 练习这些单词', resetStats: '🗑 清除统计', level: '关卡', combo: '连击', newWorld: '新世界', tPause: '⏸ 暂停', resume: '▶ 继续', quit: '🏠 退出',
  listen: '🔊 听一听', next: '继续 ▶', tWin: '🏆 胜利！🏆', winHint: '你打败了单词大王！', winEnd: '🏁 记录成绩', winEndless: '♾ 无尽模式继续玩',
  tScores: '🏆 排行榜', lblBook: '单词本', hsDel: '🗑 删除此列表的排行榜', tTop: '🏆 前十名！', namePh: '你的名字', nameOk: '✔ 记录', nameSkip: '不留名', again: '🔁 再来一次', menu: '🏠 菜单', gameOver: '游戏结束',
  saved: '✔ 已保存到文件', memOnly: '⚠️ 只在内存中——请用“导出 / 下载”保存！', saveFail: '⚠️ 保存失败：{e}', openFail: '无法打开文件：{e}', exported: '✔ 已导出：{n}',
  noVocab: '文件中没有找到单词（格式：单词;翻译）。', importAsk: '找到 {l} 个列表，共 {n} 个单词。\n确定 = 完全替换当前 vokabeln.txt\n取消 = 作为新列表添加',
  allLists: '🌈 全部列表混合', weakWords: '🎯 我的错词', noList: '还没有列表——用“➕ 列表”新建一个。', delRow: '删除此行', newListAsk: '新列表的名称：', renAsk: '新名称：', delListAsk: '删除列表“{l}”（{n} 个单词）？',
  bulkDone: '已添加 {n} 行', bulkErr: ' – 无法识别：第 {e} 行', noErrors: '还没有错误——太棒了！🎉', resetAsk: '清除全部统计？', space: '空格', spaceShort: '空格',
  notEnoughWeak: '错词还不够——使用全部列表。', emptyList: '这个列表是空的。',
  boss_block: '方块怪格罗洛', boss_robot: '超级机器人3000', boss_spike: '尖刺之王', boss_drill: '钻头怪', banFinal: '最终首领！', banRevenge: '复仇战！', banBoss: '首领战！', finalName: '单词大王 · {n} 次命中', revengeName: '他回来了……',
  revengeToast: '👊 复仇战：{q}——答对 3 次！', bossWarn: '⚠️ 首领怪物！', hitLeft: '命中！还要 {n} 次', revengeWon: '🏆 复仇成功！现在你会“{a}”了！', bossWon: '🏆 打败首领！+1 生命', levelUp: '⬆️ 第 {n} 关！', finalComes: '👑 最终首领来了！',
  cheer: ['差一点！应该是：', '没关系——记住：', '马上就会了！', '仔细看：', '你能做到：'], youTyped: '你输入了：', alsoOk: '也正确：', noteRevenge: '首领还会回来——你能打败他！💪', noteEscaped: '这个词马上会作为首领回来——到时你就会了！💪', noteRetry: '再试一次——怪物在等你！💪',
  skin_hero: '宇航员', 'skin_skin-green': '绿色黏黏', 'skin_skin-blue': '蓝色泡泡', 'skin_skin-pink': '粉色像素', 'skin_skin-yellow': '黄色闪电', 'skin_skin-gold': '黄金英雄',
  lz_red: '红色', lz_green: '绿色', lz_blue: '蓝色', lz_purple: '紫色', lz_gold: '金色', lz_rainbow: '彩虹', needPops: '{n} 个怪物后', needScore: '{n} 分后', needWin: '第一次胜利后',
  progInfo: '目前：打爆 {p} 个怪物 · 最高分 {s} · 胜利 {w} 次', unlockedToast: '🎁 新解锁：{r}（⚙️ 设置）',
  worlds: ['阳光草地', '魔法森林', '炽热沙漠', '冰雪王国', '水晶洞穴', '地下世界', '天空之岛'],
  winStats: '⭐ {s} 分 · 第 {l} 关 · {p} 个怪物 · 最佳连击 {c} · ❤️ {h}', endless: '♾ 无尽模式——继续！',
  tp_ohne: '不限时', tp_sehrlangsam: '很慢', tp_langsam: '慢', tp_normal: '普通', tp_schnell: '快', tp_challenger: '挑战者', md_tippen: '打字', md_kacheln: '方块', md_mc: '选择题',
  mastery: '🧠 已掌握单词：{a} / {b}', noHs: '这个单词本还没有排行榜。', hsName: '名字', hsPts: '分数', hsMode: '模式', hsDate: '日期', hsDelAsk: '删除“{l}”（{m}）的全部排行榜？',
  player: '玩家', newRecord: '新纪录！', victory: '👑 胜利！', nameInfo: '在“{l}”中得了 {s} 分——你叫什么名字？', overInfo: '第 {l} 关 · 打爆 {p} 个怪物 · 最佳连击 {c}', practice: '再练习这些：',
  dirAns: '{q} → {a}（输入{a}）', dirCol1: '第2列 → 第1列', dirCol2: '第1列 → 第2列', zhNoType: '🔤 没有拼音就不能打中文——改用方块。', zhPinyin: '🔤 输入拼音（可不带声调）', zhNote: '提示：没有拼音的中文答案（格式 你好|nǐ hǎo）→ 用方块代替打字。',
  st_dl: '平板：文档/VokabelMonster/vokabeln.txt', st_data: '平板：应用内部存储（文档不可写）', st_ro: '只读', st_file: '文件：{n}', st_none: '还没有连接文件——自带列表（只读）', st_browser: '只读（浏览器不能写文件）——请通过下载保存修改', st_download: 'vokabeln.txt（下载）',
  lang: { de: '德语', en: '英语', zh: '中文', es: '西班牙语', fr: '法语', it: '意大利语', pt: '葡萄牙语', tr: '土耳其语', pl: '波兰语', ru: '俄语', nl: '荷兰语', la: '拉丁语' }
} };
const UIS = ['de', 'en', 'zh'];
function detect() { try { const s = JSON.parse(localStorage.getItem('vm.settings') || '{}'); if (UIS.includes(s.ui)) return s.ui; } catch {}
  const n = String((navigator.languages && navigator.languages[0]) || navigator.language || '').toLowerCase(); return n.startsWith('zh') ? 'zh' : n.startsWith('en') ? 'en' : 'de'; }
let cur = detect();
function T(k, vars) { let s = (D[cur] && D[cur][k] != null) ? D[cur][k] : D.de[k]; if (s == null) return k;
  if (typeof s === 'string' && vars) s = s.replace(/\{(\w+)\}/g, (m, v) => vars[v] != null ? vars[v] : m); return s; }
const langName = c => (T('lang')[c]) || String(c).toUpperCase();
function apply(root = document) { document.documentElement.lang = cur === 'zh' ? 'zh-CN' : cur;
  root.querySelectorAll('[data-i18n]').forEach(e => e.textContent = T(e.dataset.i18n));
  root.querySelectorAll('[data-i18n-html]').forEach(e => e.innerHTML = T(e.dataset.i18nHtml));
  root.querySelectorAll('[data-i18n-ph]').forEach(e => e.placeholder = T(e.dataset.i18nPh));
  root.querySelectorAll('[data-i18n-title]').forEach(e => e.title = T(e.dataset.i18nTitle)); }
window.VMI18N = { T, apply, langName, get lang() { return cur; }, set: l => { if (UIS.includes(l)) cur = l; }, UIS, NAMES: { de: 'Deutsch', en: 'English', zh: '中文' }, locale: () => ({ de: 'de-DE', en: 'en-GB', zh: 'zh-CN' }[cur]), dict: D };
window.T = T;
})();
