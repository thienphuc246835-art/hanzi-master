# CLAUDE.md — HànZì Master: Nền Tảng Học Từ Vựng Tiếng Trung Cá Nhân Hóa

> **Vai trò AI**: Bạn là một chuyên gia lập trình web full-stack đồng thời là chuyên gia giảng dạy ngôn ngữ Tiếng Trung, thành thạo phương pháp Spaced Repetition System (SRS) và Active Recall. Mọi quyết định thiết kế và kỹ thuật phải đặt hiệu quả học tập của người dùng lên hàng đầu.

---

## 1. TẦM NHÌN DỰ ÁN

**Tên sản phẩm**: HànZì Master  
**Slogan**: *"Học ít, nhớ nhiều — Chinh phục HSK từng bước."*  
**Mục tiêu cốt lõi**: Xây dựng một ứng dụng web học từ vựng Tiếng Trung cá nhân hóa, theo **chuẩn HSK 3.0** (9 cấp, 3 giai đoạn — 《国际中文教育中文水平等级标准》GF 0025-2021), mỗi từ có **3 ví dụ ngữ cảnh phân cấp** và **gợi ý ghi nhớ dựa trên bộ thủ**, ứng dụng thuật toán Spaced Repetition kết hợp Active Recall, giao diện tối giản nhưng sinh động và có chiều sâu.

**Đối tượng người dùng**:
- Người học Tiếng Trung từ mất gốc đến nâng cao (HSK 1–9)
- Người có thời gian học ngắn nhưng muốn hiệu quả cao
- Người đang ôn thi HSK các cấp

---

## 2. TRIẾT LÝ THIẾT KẾ

### 2.1 Nguyên tắc UX/UI — "Minimalist Zen"
- **Tối giản có chủ đích**: Loại bỏ mọi thứ không phục vụ hành động học. Mỗi màn hình chỉ có **một nhiệm vụ duy nhất**.
- **Khoảng trắng là ngôn ngữ**: Sử dụng negative space để từ Hán tự trở thành nhân vật trung tâm của màn hình.
- **Phản hồi tức thì**: Mọi tương tác của người dùng phải có visual feedback trong vòng 150ms.
- **Dark Mode mặc định**: Môi trường tối giảm mỏi mắt, giữ chữ Hán nổi bật. Có thêm chủ đề sáng "giấy kem" (nút ☀/☾ trên thanh trên cùng).
- **Âm thanh chủ động**: thẻ từ mới tự phát âm (audio thật của bộ từ vựng) khi xuất hiện; thẻ ôn tập phát âm khi lật.

### 2.2 Màu sắc & Typography
```
Palette:
  Background chính:   #0D0F14  (Ink Black)
  Surface card:       #161920  (Deep Slate)
  Accent chính:       #E8B86D  (Parchment Gold — gợi liên tưởng đến giấy cổ)
  Accent phụ:         #6D9EEB  (Cerulean Blue — kỹ thuật số, hiện đại)
  Thành công:         #4CAF7D  (Jade Green)
  Nguy hiểm/Quên:    #E05C5C  (Vermillion Red)
  Text chính:         #F0EDE8  (Off-White)
  Text phụ:           #8A8F9E  (Muted Grey)

Typography:
  - Hán tự:           'Noto Serif SC' (weight 700) — sang trọng, dễ đọc
  - Pinyin:           'Outfit' (weight 400–500) — hiện đại, rõ ràng
  - UI/Body:          'Inter' (weight 300–600) — trung lập, chuyên nghiệp
  - Kích thước Hán tự trên flashcard: 72px–120px (cực kỳ nổi bật)
```

### 2.3 Animation Philosophy
- Sử dụng **spring physics** (không dùng linear easing) cho cảm giác tự nhiên
- Flashcard flip: 3D perspective transform (rotateY 180deg), duration 400ms
- Chữ Hán xuất hiện: stroke animation — từng nét bút vẽ ra chữ
- Progress bar: fill animation mượt mà, không giật cục
- Confetti nhẹ khi hoàn thành session

---

## 3. KIẾN TRÚC KỸ THUẬT

### 3.1 Tech Stack
```
Frontend:
  - HTML5 + Vanilla CSS3 + Vanilla JavaScript (ES2022+)
  - Hoặc Vite + React 18 (nếu cần state management phức tạp)
  - CSS Custom Properties cho design tokens
  - Web Animations API / CSS @keyframes

Backend (tuỳ chọn, Phase 2):
  - Node.js + Express HOẶC Supabase (BaaS)
  - PostgreSQL cho user data & review history

Lưu trữ local (Phase 1 — offline-first):
  - IndexedDB (API gốc, bọc trong core/db.js — không dùng Dexie để không phụ thuộc CDN khi offline)
    cho từ vựng, thẻ & lịch sử làm bài
  - localStorage cho settings & user profile
  - Service Worker (sw.js) cache app shell + dữ liệu

Từ điển dữ liệu:
  - NGUỒN CHÍNH (đã nhập): bộ thẻ Anki "ZHVI HSK 3.0" — 11.013 từ HSK 1→7–9, audio thật,
    câu ví dụ có audio, ảnh, Hán Việt, IDS/lục thư/bộ thủ, nét viết. Nhập bằng
    `npm run import-anki -- "<file>.apkg"` → src/js/data/vocab/, hanzi.json, lessons.json, strokes/,
    src/assets/audio|img/. Giấy phép: src/js/data/LICENSE-DATA.md (nội dung ZHVI chỉ dùng cá nhân)
  - Bài học: HSK 1–3 chia theo bài giáo trình (tag Quyển-N::Bài-NN của bộ thẻ), HSK 4–9 tự chia
    25 từ/bài theo tần suất; mỗi bài chia "chặng" ~12 từ (~10 phút). Tên bài: lesson-titles.json
  - Bài khóa (đọc & dịch): src/js/data/texts/hsk*.json — do người dùng cung cấp từ giáo trình
  - CC-CEDICT (mã nguồn mở) — 120,000+ từ Trung-Anh
  - Wordlist HSK 3.0 chính thức (GF 0025-2021) — KHÔNG dùng danh sách HSK 2.0 cũ (6 cấp, 5000 từ)
    · Tham khảo bản số hoá: github.com/drkameleon/complete-hsk-vocabulary (nhánh "new")
  - Bộ thủ: 214 bộ Khang Hy (Kangxi) + tên Hán Việt + nghĩa tiếng Việt
  - Phân tích cấu tạo chữ: Make Me a Hanzi (dictionary.txt — decomposition, etymology)
  - Stroke order data từ Hanzi Writer JS library
```

### 3.2 Cấu trúc Thư mục
```
hanzhi-master/
├── index.html
├── manifest.webmanifest        # PWA
├── sw.js                       # Service worker (offline-first)
├── package.json                # npm start / npm test / npm run validate (không có dependency)
├── src/
│   ├── css/
│   │   ├── tokens.css          # Design tokens (màu, font, spacing)
│   │   ├── components.css      # Cards, buttons, modals
│   │   ├── animations.css      # Keyframes & transitions
│   │   └── main.css            # Layout & utilities
│   ├── js/
│   │   ├── core/
│   │   │   ├── constants.js    # Hằng số dùng chung (FSRS weights, HSK levels, modes, XP, badges)
│   │   │   ├── srs.js          # Thuật toán SRS (FSRS-4.5), pure functions
│   │   │   ├── scheduler.js    # Lên lịch ôn tập, giới hạn thẻ mới thích ứng, dự báo
│   │   │   ├── exercise-picker.js # Chọn dạng bài theo Recall Ladder + đan xen (4.2.1, 4.2.3)
│   │   │   ├── grader.js       # Kết quả bài tập → rating FSRS (4.2.2), pure functions
│   │   │   ├── distractors.js  # Sinh phương án nhiễu (hình gần giống, cùng bộ thủ, đồng âm)
│   │   │   ├── session.js      # Một phiên học: hàng đợi → bài tập → rating → FSRS → checkpoint
│   │   │   ├── store.js        # State: dữ liệu, settings, profile, thống kê dẫn xuất, huy hiệu
│   │   │   └── db.js           # IndexedDB layer (API gốc)
│   │   ├── pages/              # dashboard, study, practice, browse, stats, settings, onboarding
│   │   ├── utils/              # dom, ui (toast/modal/confetti), tts, pinyin, random, date, drag
│   │   ├── components/
│   │   │   ├── flashcard.js    # Flashcard component (Mode 1)
│   │   │   ├── word-detail.js  # Gợi ý bộ thủ, 3 ví dụ phân tầng, nét bút, chi tiết từ
│   │   │   ├── exercises/      # Mỗi dạng bài một file
│   │   │   │   ├── listening.js        # M2
│   │   │   │   ├── cloze.js            # M3
│   │   │   │   ├── writing.js          # M4
│   │   │   │   ├── multiple-choice.js  # M5
│   │   │   │   ├── cloze-passage.js    # M6
│   │   │   │   ├── matching.js         # M7
│   │   │   │   ├── sentence-builder.js # M8
│   │   │   │   ├── tone-drill.js       # M9
│   │   │   │   ├── radical-assembly.js # M10
│   │   │   │   ├── dictation.js        # M11
│   │   │   │   ├── translation.js      # M12
│   │   │   │   ├── speaking.js         # M13
│   │   │   │   ├── collocation.js      # M14
│   │   │   │   └── speed-round.js      # M15
│   │   │   ├── progress.js     # Progress charts
│   │   │   └── hsk-navigator.js
│   │   ├── data/
│   │   │   ├── hsk1.json       # HSK 3.0 cấp 1 — 500 từ mới
│   │   │   ├── hsk2.json       # ... cấp 2 — 772 từ mới
│   │   │   ├── hsk3.json       # ... cấp 3 — 973 từ mới
│   │   │   ├── hsk4.json       # ... cấp 4 — 1000 từ mới
│   │   │   ├── hsk5.json       # ... cấp 5 — 1071 từ mới
│   │   │   ├── hsk6.json       # ... cấp 6 — 1140 từ mới
│   │   │   ├── hsk7-9.json     # ... cấp 7–9 — 5636 từ mới (tổng 11,092)
│   │   │   ├── passages/       # Bài khóa đục lỗ theo cấp (passages-hsk1.json … passages-hsk7-9.json)
│   │   │   ├── collocations.json # Cặp kết hợp từ cho M14 (động từ–tân ngữ, lượng từ–danh từ)
│   │   │   ├── hanzi.json      # 3000 chữ Hán HSK 3.0 + bộ thủ + chiết tự + Hán Việt
│   │   │   └── radicals.json   # 214 bộ thủ Khang Hy (tên Hán Việt, nghĩa, biến thể)
│   │   └── app.js              # Main entry point
│   └── assets/
│       ├── audio/              # Phát âm TTS (offline cache)
│       └── icons/
├── scripts/
│   ├── serve.js                # Máy chủ tĩnh cho phát triển (npm start)
│   └── validate-vocab.js       # Kiểm tra schema dữ liệu (3 ví dụ, mnemonic, cấp độ từ vựng)
├── tests/                      # Unit test (node:test): srs, grader, distractors, picker/scheduler
├── README.md
└── CLAUDE.md                   # File này
```

---

## 4. PHƯƠNG PHÁP HỌC TẬP

### 4.1 Thuật Toán SRS — FSRS 4.5
> **Bắt buộc**: Implement thuật toán **FSRS 4.5** (Free Spaced Repetition Scheduler) — thuật toán hiện đại nhất, vượt trội hơn SM-2 của Anki cũ. Không dùng SM-2 đơn giản.

**Cách hoạt động**:
```javascript
// Mỗi thẻ từ vựng có các thuộc tính:
{
  word: "学习",
  pinyin: "xuéxí",
  meaning: "học tập",
  stability: 1.0,      // Độ bền trí nhớ (ngày)
  difficulty: 5.0,     // Độ khó (1-10)
  due: Date,           // Ngày ôn tập tiếp theo
  reps: 0,             // Số lần đã ôn
  lapses: 0,           // Số lần quên
  state: "new"         // new | learning | review | relearning
}
```

**Thang đánh giá 4 mức (như Anki)**:
| Nút | Ký hiệu | Ý nghĩa | Interval nhân |
|-----|---------|---------|---------------|
| 🔴 Again | 1 | Quên hoàn toàn | Reset |
| 🟡 Hard | 2 | Nhớ mờ, cần gợi ý | ×0.5 |
| 🟢 Good | 3 | Nhớ đúng, bình thường | ×1 |
| 🔵 Easy | 4 | Nhớ rất nhanh | ×1.3 |

**Hiển thị thời gian cho người dùng**:
```
[Lại] 1 phút    [Khó] 8 phút    [Tốt] 1 ngày    [Dễ] 4 ngày
```

### 4.2 Active Recall — 15 Dạng Bài Tập

> **Trạng thái hiện tại (theo yêu cầu người dùng):** chỉ bật **3 dạng chính** — **Lật thẻ** (M1), **Chọn đáp án đúng** (M5) và **Điền từ** (M3). Các dạng còn lại vẫn có code trong `components/exercises/` nhưng tắt bằng cờ `enabled: false` trong `MODES` (`core/constants.js`); checkpoint bài khóa đục lỗ và khởi động Đúng/Sai cũng tắt theo. Thang ghi nhớ khi chỉ có 3 dạng: Mức 1 = Lật thẻ, Chọn nghĩa; Mức 2 = Chọn chữ Hán theo nghĩa, Điền từ (chọn); Mức 3 = Điền từ (tự gõ), Lật thẻ.
Người dùng được hệ thống **đan xen (interleave)** nhiều dạng bài để tránh nhàm chán và buộc não truy xuất từ vựng theo nhiều hướng: nhìn → nghĩa, nghĩa → chữ, nghe → chữ, ngữ cảnh → từ, ý → câu. Mỗi dạng bài thuộc một mức trên **Thang chủ động ghi nhớ** (xem 4.2.1).

> Mọi dạng bài phải dùng được hoàn toàn bằng bàn phím (phím `1`–`4` để chọn đáp án, `Enter` để xác nhận, `Space` để phát âm) và bằng cảm ứng (kéo thả, vuốt).

**Mode 1: Classic Flashcard**
- Hiển thị Hán tự to → người dùng tự nhớ → lật thẻ xem đáp án
- Phù hợp: Nhớ nghĩa từ

**Mode 2: Listening Recognition**  
- Phát âm thanh → người dùng gõ/chọn chữ Hán
- Tích hợp Web Speech API hoặc audio file

**Mode 3: Cloze Deletion (Fill-in-the-blank)**
- Câu ví dụ có chỗ trống → điền từ còn thiếu
- Học từ trong ngữ cảnh thực
- Chọn ví dụ theo tầng (xem 4.5): thẻ mới/learning → Tầng 1; review stability < 21 ngày → Tầng 2; stability ≥ 21 ngày → Tầng 3

**Mode 4: Character Writing Quiz**
- Hiển thị nghĩa + pinyin → viết Hán tự (dùng canvas touch/mouse)
- Sử dụng HanziWriter.js để kiểm tra nét bút

**Mode 5: Multiple Choice (Trắc nghiệm)**
- 1 đáp án đúng + 3 phương án gây nhiễu, có timer 10 giây tạo áp lực nhẹ (tắt được trong Settings)
- 4 biến thể: Hán tự → nghĩa · nghĩa → Hán tự · nghe → Hán tự · câu có chỗ trống → chọn từ hợp ngữ cảnh
- Quy tắc chọn phương án nhiễu (theo thứ tự ưu tiên):
  1. Chữ có hình dạng gần giống (已/己/巳, 未/末, 人/入)
  2. Cùng bộ thủ (妈/姐/妹) — buộc người học nhìn kỹ phần còn lại của chữ
  3. Cùng âm khác thanh (买 mǎi / 卖 mài)
  4. Cùng từ loại, cùng cấp HSK
- KHÔNG dùng từ đồng nghĩa làm phương án nhiễu (tránh hai đáp án cùng đúng)

**Mode 6: Đọc Bài Khóa Đục Lỗ Theo Cấp Độ (Graded Cloze Passage)**
- Một đoạn văn ngắn liền mạch theo cấp HSK, một số từ vựng đã học bị "đục lỗ" → người học điền lại
- Mục đích: học từ trong **ngữ cảnh dài**, luyện đọc hiểu, gặp lại nhiều từ cùng lúc
- Quy tắc biên soạn bài khóa:
  - ≥ 95% từ trong bài thuộc cấp ≤ cấp của bài (input dễ hiểu); từ vượt cấp phải có chú thích pinyin + nghĩa khi chạm vào
  - Chỉ đục lỗ những từ **người dùng đã học** (state ≠ new), ưu tiên thẻ đến hạn và thẻ có difficulty cao
  - Mật độ lỗ: khoảng 1 lỗ / 10–15 chữ, không đặt 2 lỗ liền nhau
  - Độ dài theo cấp:
    ```
    HSK 1: 50–80 chữ     HSK 2: 80–150     HSK 3: 150–250
    HSK 4: 250–400       HSK 5: 400–600    HSK 6: 600–900     HSK 7–9: 900–1500
    ```
- 3 mức độ khó (tự động theo stability trung bình của các từ bị đục lỗ, người dùng có thể đổi):
  - **Dễ**: có ngân hàng từ (word bank) bên dưới, kéo thả vào chỗ trống
  - **Vừa**: mỗi chỗ trống là một menu 4 lựa chọn
  - **Khó**: gõ tự do (pinyin hoặc chữ Hán qua bộ gõ), chỉ hiện số chữ của đáp án
- Sau khi điền: 2–3 câu hỏi đọc hiểu (trắc nghiệm hoặc đúng/sai) + nút 🔊 nghe cả bài + bản dịch tiếng Việt ẩn
- Có chế độ **nghe bài khóa đục lỗ**: phát audio, chỗ trống được "bíp" → điền theo những gì nghe được

**Mode 7: Nối Cặp (Matching)**
- 5 cặp mỗi lượt: Hán tự ↔ nghĩa / pinyin / âm Hán Việt / audio (luân phiên)
- Ghép đúng → cặp biến mất với animation; ghép sai → rung nhẹ + đỏ 300ms
- Có đồng hồ đếm, lưu kỷ lục cá nhân → tạo động lực ôn nhanh nhiều từ

**Mode 8: Sắp Xếp Câu (Sentence Builder)**
- Câu ví dụ (tầng 1–2) bị xáo thành các khối từ → kéo thả sắp xếp lại cho đúng
- Luyện trật tự từ — điểm khó của người Việt (thời gian/địa điểm đứng trước động từ, vị trí 了, 过, 把, 被, bổ ngữ)
- Sai → highlight khối đặt sai vị trí, cho thử lại 1 lần trước khi hiện đáp án

**Mode 9: Luyện Thanh Điệu (Tone Drill)**
- Nghe âm → chọn thanh cho từng âm tiết (1–4 + thanh nhẹ), hoặc nhìn chữ → chọn pinyin đúng dấu
- Ưu tiên cặp tối thiểu (mǎi/mài, shuì jiào/shuǐ jiǎo) và quy tắc biến điệu (不, 一, hai thanh 3 liền nhau)
- Màu thanh điệu nhất quán trong toàn app

**Mode 10: Ghép Bộ Thủ (Radical Assembly)**
- Cho nghĩa + pinyin + 4–6 mảnh bộ thủ/thành phần (đúng + nhiễu) → ghép thành chữ Hán đúng
- Củng cố trực tiếp phần gợi ý ghi nhớ ở 4.4; ghép đúng → hiện lại câu chuyện ghi nhớ của chữ
- Áp dụng cho các chữ có cấu tạo trái–phải / trên–dưới rõ ràng; bỏ qua chữ độc thể (人, 口, 大...)

**Mode 11: Nghe Chép Chính Tả (Dictation)**
- Nghe câu ví dụ (tốc độ thường / chậm 0.75×) → gõ lại bằng pinyin hoặc chữ Hán
- Chấm theo từng ký tự, highlight chữ sai/thiếu; chữ đồng âm sai nghĩa được giải thích (在/再)

**Mode 12: Dịch Việt → Trung (Reverse Translation)**
- Hiện câu tiếng Việt → người học tạo câu tiếng Trung (ghép từ ngân hàng từ hoặc gõ tự do)
- Mức tự tạo cao nhất: buộc chủ động lấy từ ra khỏi trí nhớ và đặt vào cấu trúc đúng
- Chấp nhận nhiều đáp án đúng (mỗi câu lưu danh sách `accepted_answers`)

**Mode 13: Nói & Shadowing (Speaking)**
- Nghe câu mẫu → nhại lại; dùng Web Speech API (`SpeechRecognition`, `lang: zh-CN`) so khớp kết quả với câu mẫu
- Trình duyệt không hỗ trợ hoặc độ tin cậy thấp → chuyển sang tự đánh giá (so sánh với bản ghi âm của chính mình)
- Kết quả nhận dạng giọng nói **không tự động ghi rating FSRS** (độ chính xác chưa đủ tin cậy) — chỉ là bài luyện

**Mode 14: Kết Hợp Từ & Từ Lạc Loài (Collocation / Odd One Out)**
- Collocation: chọn động từ/lượng từ đi kèm đúng (打 篮球 / 踢 足球 / 弹 钢琴; 一 本 书 / 一 张 纸)
- Odd one out: 4 từ, chọn từ không cùng nhóm nghĩa/chủ đề → học từ theo mạng ngữ nghĩa

**Mode 15: Đúng/Sai Tốc Độ (Speed Round)**
- 60 giây, cặp Hán tự – nghĩa hiện liên tục, vuốt phải = Đúng, vuốt trái = Sai (hoặc phím ←/→)
- Dùng để khởi động đầu session hoặc ôn nhanh thẻ có stability cao; là bài luyện (practice), không cập nhật FSRS

#### 4.2.1 Thang Chủ Động Ghi Nhớ (Recall Ladder)
Nhận ra một từ dễ hơn nhiều so với tự nhớ ra nó. Thẻ đi **từ nhận diện → hồi tưởng có gợi ý → tự tạo** khi trí nhớ vững dần:

| Mức | Loại truy xuất | Dạng bài |
|-----|----------------|----------|
| 1 | Nhận diện (Recognition) | Flashcard (M1), Trắc nghiệm Hán → nghĩa (M5), Nối cặp (M7), Đúng/Sai (M15) |
| 2 | Hồi tưởng có gợi ý (Cued Recall) | Nghe chọn chữ (M2), Điền chỗ trống có lựa chọn (M3, M6 Dễ/Vừa), Thanh điệu (M9), Ghép bộ thủ (M10), Sắp xếp câu (M8), Kết hợp từ (M14) |
| 3 | Tự tạo (Free Recall / Production) | Điền chỗ trống gõ tự do (M3, M6 Khó), Chép chính tả (M11), Viết chữ (M4), Dịch Việt → Trung (M12), Nói (M13) |

**Chọn mức theo trạng thái thẻ**:
```
new                         → Flashcard đầy đủ thông tin (lần gặp đầu, chưa kiểm tra)
learning / relearning       → Mức 1–2
review, stability < 7 ngày  → Mức 2
review, stability 7–21 ngày → Mức 2–3
review, stability ≥ 21 ngày → Mức 3
Vừa bị đánh giá Again       → Lần gặp tiếp theo hạ xuống 1 mức
```

#### 4.2.2 Chấm Điểm Tự Động → Rating FSRS
Ngoài Flashcard (người dùng tự đánh giá), các dạng bài khác tự suy ra rating:

| Kết quả | Rating |
|---------|--------|
| Sai, bỏ qua, hoặc hết giờ | 1 · Again |
| Đúng nhưng đã dùng gợi ý, sai 1 lần rồi sửa, hoặc chậm hơn 2× thời gian trung vị của người dùng ở dạng bài đó | 2 · Hard |
| Đúng, tốc độ bình thường | 3 · Good |
| Đúng và nhanh (< 0.5× trung vị) **ở bài Mức 3** | 4 · Easy |

- Bài Mức 1 tối đa chỉ được **Good** — nhận diện đúng chưa chứng minh nhớ chắc.
- **Mỗi thẻ chỉ ghi 1 review FSRS mỗi ngày** (lần kiểm tra đầu tiên khi thẻ đến hạn). Các lần gặp lại trong ngày, thẻ chưa đến hạn xuất hiện trong bài khóa, và Mode 13/15 được lưu là `practice`: có trong lịch sử, không thay đổi stability/difficulty.
- Sau mỗi bài hiện rating vừa suy ra, cho phép người dùng sửa trong 3 giây (VD: bấm nhầm).

#### 4.2.3 Cấu Trúc Session Đan Xen
- Không quá 3 bài cùng dạng liên tiếp; một session 20 thẻ dùng khoảng 3–5 dạng bài khác nhau.
- Một từ mới trong session: lần 1 Flashcard → lần 2 (sau 3–5 thẻ khác) Trắc nghiệm hoặc Nối cặp → cuối session Điền chỗ trống.
- Sau khoảng 10 thẻ: một **checkpoint bài khóa đục lỗ** ngắn chứa chính các từ vừa học/ôn.
- Ưu tiên dạng bài theo mục tiêu trong Settings:
  ```
  Đọc hiểu   → M3, M5, M6, M14
  Nghe       → M2, M9, M11, M6 (bản nghe)
  Viết       → M4, M10, M12, M8
  Giao tiếp  → M13, M8, M12, M9
  ```
- Người dùng có thể tắt từng dạng bài; luôn giữ ít nhất 1 dạng ở mỗi mức của Thang chủ động ghi nhớ.

### 4.3 Cá Nhân Hóa Học Tập
```
Mục tiêu người dùng đặt ra:
  - Target HSK level: 1, 2, 3, 4, 5, 6, hoặc 7-9
  - Thời gian học/ngày: 5 / 10 / 20 / 30 phút
  - Số thẻ mới/ngày: 5 / 10 / 20 / tuỳ chỉnh
  - Ưu tiên: Đọc hiểu / Nghe / Viết / Giao tiếp

Hệ thống tự điều chỉnh:
  - Nếu tỷ lệ "Again" > 30% → giảm thẻ mới, tăng ôn tập
  - Nếu tỷ lệ "Easy" > 70% → tăng thẻ mới, giới thiệu level cao hơn
  - Adaptive difficulty: thẻ khó xuất hiện nhiều hơn trong mode quiz
```

### 4.4 Gợi Ý Ghi Nhớ Theo Bộ Thủ (Radical Mnemonics)
> **Bắt buộc**: Mọi từ vựng phải có phần gợi ý cách nhớ dựa trên bộ thủ, cho **từng chữ Hán** trong từ.

**Cấu trúc gợi ý cho mỗi chữ**:
```
1. Bộ thủ chính   → chữ + số thứ tự Khang Hy + tên Hán Việt + nghĩa
                    VD: 子 (#39) — bộ Tử — "con, đứa trẻ"
2. Thành phần     → tách các bộ phận cấu tạo, mỗi bộ phận có nghĩa tiếng Việt
3. Loại cấu tạo   → hình thanh (形声) / hội ý (会意) / tượng hình (象形) / chỉ sự (指事)
4. Câu chuyện     → tối đa 2 câu, hình ảnh cụ thể, gắn trực tiếp với nghĩa của chữ
5. Âm Hán Việt    → VD: 学 = HỌC, 习 = TẬP (cầu nối cực mạnh cho người Việt)
6. Liên kết từ    → ghép nghĩa các chữ thành nghĩa của từ: 学 HỌC + 习 TẬP = học tập
```

**Nguyên tắc biên soạn**:
- **Ưu tiên chiết tự thật** (etymology) trước, chỉ dùng câu chuyện sáng tạo khi chiết tự quá trừu tượng. Gắn nhãn `type: "etymology" | "creative"` — không bao giờ trình bày câu chuyện sáng tạo như nguồn gốc thật.
- **Chữ hình thanh** (~80% chữ Hán): chỉ rõ phần biểu nghĩa và phần gợi âm. VD: 妈 = 女 (nữ — nghĩa "phụ nữ") + 马 (mǎ — gợi âm) → "người phụ nữ đọc gần giống *mǎ* → mẹ".
- **Chữ giản thể biến đổi nhiều**: nhắc chữ phồn thể nếu giúp nhớ. VD: 习 ← 習 (羽 lông vũ: chim non vỗ cánh nhiều lần → luyện tập).
- **Bộ thủ biến thể** phải được giải thích: 氵= 水 (thủy), 亻= 人 (nhân), 扌= 手 (thủ), 忄= 心 (tâm), 讠= 言 (ngôn), 艹 = 草 (thảo), 辶 (sước — đi), 钅= 金 (kim), 饣= 食 (thực).
- **Tái sử dụng**: cùng một bộ thủ phải dùng cùng một hình ảnh xuyên suốt toàn bộ dữ liệu (VD: 氵 luôn là "nước") để người học tích lũy "bảng chữ cái hình ảnh".
- Ngôn ngữ: tiếng Việt, ngắn gọn, phù hợp mọi lứa tuổi.

**Hiển thị trong app**:
- Mặt trước: nút 💡 "Gợi ý bộ thủ" — chỉ hiện bộ thủ + nghĩa của bộ, KHÔNG lộ nghĩa của từ (giữ Active Recall). Nếu người dùng mở gợi ý trước khi lật → nút gợi ý mặc định chuyển sang [Khó].
- Mặt sau: 1 dòng `hint_short`, bấm mở rộng xem phân tích đầy đủ từng chữ.
- Nút 🏷️ liệt kê các từ **đã học** có chung bộ thủ → củng cố mạng liên kết.

### 4.5 Ba Ví Dụ Ngữ Cảnh Theo Cấp Độ
> **Bắt buộc**: Mỗi từ có **đúng 3 câu ví dụ**, độ khó tăng dần theo nguyên tắc *i+1* (chỉ thêm một chút kiến thức mới so với trình độ hiện tại).

| Tầng | Tên | Giới hạn từ vựng trong câu | Độ dài | Mục đích |
|------|-----|----------------------------|--------|----------|
| 1 | Cơ bản | Chỉ từ ≤ cấp HSK của từ đang học | ≤ 12 chữ | Nghĩa chính, ngữ cảnh đời thường |
| 2 | Mở rộng | Từ ≤ cấp của từ + 1 | 10–20 chữ | Kết hợp từ (collocation) phổ biến, cấu trúc ngữ pháp cùng cấp |
| 3 | Nâng cao | Từ ≤ cấp của từ + 2 (tối đa 7–9) | 15–30 chữ | Nghĩa mở rộng / văn viết / thành ngữ, chủ đề công việc–xã hội–học thuật |

**Quy tắc**:
- Mỗi câu gồm: `zh`, `pinyin` (có dấu thanh), `vi`, `tier`, `context` (VD: `daily`, `school`, `work`, `travel`, `society`, `academic`).
- 3 câu phải thuộc **3 ngữ cảnh khác nhau**, và nếu từ có nhiều nghĩa/từ loại thì mỗi câu nên thể hiện một cách dùng khác nhau.
- Từ cấp 7–9: cả 3 tầng đều có thể dùng từ 7–9, phân tầng bằng độ phức tạp câu và văn phong (khẩu ngữ → trang trọng → học thuật).
- Câu phải tự nhiên như người bản ngữ nói/viết; ngữ pháp dùng trong câu không vượt quá giới hạn cấp của tầng đó.
- `scripts/validate-vocab.js` tự kiểm tra: đủ 3 câu, đủ 3 tầng, mọi từ trong câu nằm trong giới hạn cấp (tách từ bằng wordlist HSK 3.0).

---

## 5. CẤU TRÚC TRANG & TÍNH NĂNG

### 5.1 Màn hình & Navigation
```
/ (Dashboard)
  ├── /lessons/:cấp   → Danh sách bài theo cấp HSK (thẻ bài: số bài, tên Việt/Trung, số từ, chặng, Luyện tập)
  ├── /lesson/:id     → Chi tiết bài: chặng, từ vựng có audio, luyện tập với từ của bài
  ├── /lesson/:id/read → Đọc & dịch bài khóa (Đọc · Trung→Việt · Việt→Trung)
  ├── /study          → Session học tập (SRS queue; ?lesson=&seg= để học theo bài/chặng)
  ├── /browse         → Duyệt từ điển HSK
  ├── /stats          → Thống kê & heatmap
  ├── /settings       → Cài đặt cá nhân hóa
  └── /onboarding     → Thiết lập lần đầu
```

### 5.2 Dashboard (/)
**Layout**: 3 cột trên desktop, stack trên mobile

**Widget bắt buộc**:
- 🔥 **Streak counter**: Chuỗi ngày học liên tiếp (hiệu ứng lửa động)
- 📚 **Today's queue**: X thẻ ôn tập + Y thẻ mới
- 📊 **Mini heatmap**: 60 ngày học gần nhất (giống GitHub contribution graph)
- 🎯 **HSK Progress**: Progress ring cho từng cấp độ
- 📅 **Forecast chart**: Dự báo số thẻ cần ôn 7 ngày tới

### 5.3 Study Session (/study)
**Luồng chính**:
```
[Bắt đầu session]
  → Load SRS queue (due cards + new cards)
  → (Tuỳ chọn) Khởi động: Speed Round 60 giây
  → Với mỗi thẻ: exercise-picker chọn dạng bài theo Recall Ladder (4.2.1)
      · Flashcard: User suy nghĩ → "Hiện đáp án" → tự đánh giá [Lại] [Khó] [Tốt] [Dễ]
      · Dạng bài khác: làm bài → grader suy ra rating (4.2.2) → sửa được trong 3 giây
  → Mỗi ~10 thẻ: checkpoint bài khóa đục lỗ (M6)
  → Tiếp theo... (animation slide)
  → [Kết thúc session] → Summary screen + confetti
```

**Flashcard layout**:
```
┌─────────────────────────────────────┐
│  HSK 1  ·  12/500 từ               │  ← Header nhỏ
│                                     │
│              学 习                   │  ← Hán tự (96px, Noto Serif SC)
│           xuéxí                     │  ← Pinyin (ẩn cho đến khi lật)
│                                     │
│         [ Hiện đáp án ]             │  ← CTA button
│                                     │
│  🔊 Phát âm  💡 Gợi ý bộ thủ  📝    │  ← Actions nhỏ
└─────────────────────────────────────┘

Sau khi lật:
┌─────────────────────────────────────┐
│              学 习                   │
│        xuéxí  ·  HỌC TẬP            │  ← Pinyin + âm Hán Việt
│         ────────────                │
│      học tập, việc học              │  ← Nghĩa chính
│                                     │
│  💡 子 đứa trẻ dưới mái 冖 → HỌC;    │  ← hint_short (bấm để mở rộng)
│     羽 chim vỗ cánh nhiều lần → TẬP │
│                                     │
│  ① 我在学校学习中文。          [≤1] │  ← 3 ví dụ phân tầng
│  ② 他每天晚上都学习两个小时。  [≤2] │    (bấm câu → pinyin + nghĩa,
│  ③ 我们应该向他学习这种…态度。 [≤3] │     🔊 đọc cả câu)
│                                     │
│  [Lại]    [Khó]    [Tốt]    [Dễ]  │
│  1ph      8ph      1ng      4ng    │
└─────────────────────────────────────┘
```

**Tính năng bổ sung trên flashcard**:
- Nút 🔊: Phát âm chuẩn (TTS hoặc audio file)
- Nút ✏️: Xem stroke animation (HanziWriter)
- Nút 🏷️: Xem các từ liên quan / từ cùng bộ thủ
- Nút ⭐: Đánh dấu từ yêu thích / từ khó

### 5.3b Lưới từ vựng (trang bài học & từ điển)
- Mỗi từ là một thẻ: chữ Hán lớn ở giữa, **viền trên tô màu theo thanh điệu âm tiết đầu** (thanh 1 đỏ · 2 cam · 3 xanh lá · 4 xanh dương · nhẹ xám), ✓ khi đã học, 🔊 phát âm, ♥ yêu thích; bấm vào thẻ → chi tiết từ
- Thanh công cụ: tìm hanzi/pinyin/nghĩa · lọc Tất cả / Chưa học / Đã học · **Hiện/Ẩn pinyin** · **Hiện/Ẩn nghĩa** (mặc định ẩn để tự kiểm tra) · lưới/danh sách · chú thích màu thanh điệu

### 5.4 Browse Từ Điển (/browse)
- Filter theo cấp HSK 3.0 (1, 2, 3, 4, 5, 6, 7–9) và theo giai đoạn (Sơ cấp / Trung cấp / Cao cấp)
- Filter theo bộ thủ (214 bộ Khang Hy) — xem tất cả từ chứa cùng một bộ
- Search theo Hán tự, pinyin, nghĩa, âm Hán Việt
- Grid/List view toggle
- Sort theo: Tần suất xuất hiện / Alphabetical / HSK order
- Quick review: bấm vào từ → popup mini flashcard

### 5.5 Thống Kê (/stats)
- **Heatmap 365 ngày**: Mật độ học theo màu (như GitHub)
- **Line chart**: Từ mới vs. ôn tập theo thời gian
- **Pie chart**: Phân bố đánh giá (Again/Hard/Good/Easy)
- **Forecast**: Dự báo thẻ sắp đáo hạn
- **Word cloud**: Các từ đã thuộc, kích thước = độ ổn định trí nhớ
- **Retention rate**: % từ nhớ đúng khi ôn
- **Độ chính xác theo dạng bài**: biểu đồ cột cho 15 dạng bài → biết mình yếu nghe, viết hay sắp xếp câu

---

## 6. DATA MODEL

### 6.1 Word Entry (từ vựng)
```json
{
  "id": "hsk1_0412",
  "hsk_version": "3.0",
  "hsk_level": 1,
  "hsk_band": "elementary",
  "simplified": "学习",
  "traditional": "學習",
  "pinyin": "xuéxí",
  "pinyin_tones": [2, 2],
  "han_viet": "học tập",
  "meanings": [
    { "pos": "v", "en": "to study; to learn", "vi": "học, học tập" },
    { "pos": "v", "en": "to learn from (sb)", "vi": "học hỏi (ai đó) — 向…学习" }
  ],
  "frequency_rank": 45,
  "examples": [
    {
      "tier": 1,
      "max_level": 1,
      "context": "school",
      "zh": "我在学校学习中文。",
      "pinyin": "Wǒ zài xuéxiào xuéxí Zhōngwén.",
      "vi": "Tôi học tiếng Trung ở trường."
    },
    {
      "tier": 2,
      "max_level": 2,
      "context": "daily",
      "zh": "他每天晚上都学习两个小时。",
      "pinyin": "Tā měitiān wǎnshang dōu xuéxí liǎng gè xiǎoshí.",
      "vi": "Tối nào anh ấy cũng học hai tiếng."
    },
    {
      "tier": 3,
      "max_level": 3,
      "context": "work",
      "zh": "我们应该向他学习这种认真负责的态度。",
      "pinyin": "Wǒmen yīnggāi xiàng tā xuéxí zhè zhǒng rènzhēn fùzé de tàidù.",
      "vi": "Chúng ta nên học hỏi thái độ nghiêm túc, có trách nhiệm này của anh ấy."
    }
  ],
  "characters": [
    {
      "char": "学",
      "traditional": "學",
      "han_viet": "HỌC",
      "stroke_count": 8,
      "radical": { "char": "子", "kangxi_no": 39, "name_vi": "Tử", "meaning_vi": "con, đứa trẻ" },
      "components": [
        { "part": "⺍", "meaning_vi": "(giản hoá từ 𦥑 — đôi tay cầm thẻ tính)" },
        { "part": "冖", "name_vi": "Mịch", "meaning_vi": "mái che" },
        { "part": "子", "name_vi": "Tử", "meaning_vi": "đứa trẻ" }
      ],
      "formation": "会意",
      "mnemonic": {
        "type": "etymology",
        "story_vi": "Đứa trẻ (子) ngồi dưới mái nhà (冖), phía trên là đôi tay thầy chỉ dạy (⺍) — đứa trẻ đang HỌC."
      }
    },
    {
      "char": "习",
      "traditional": "習",
      "han_viet": "TẬP",
      "stroke_count": 3,
      "radical": { "char": "乙", "kangxi_no": 5, "name_vi": "Ất", "meaning_vi": "(bộ tra cứu của chữ giản thể)" },
      "components": [
        { "part": "羽", "name_vi": "Vũ", "meaning_vi": "lông vũ, đôi cánh (trong chữ phồn thể 習)" }
      ],
      "formation": "会意",
      "mnemonic": {
        "type": "etymology",
        "story_vi": "Chữ gốc 習 có đôi cánh 羽: chim non vỗ cánh hết lần này đến lần khác để tập bay → LUYỆN TẬP. Giản thể 习 chỉ giữ lại một cánh."
      }
    }
  ],
  "mnemonic_summary": {
    "hint_short": "子 đứa trẻ dưới mái 冖 → HỌC; 羽 chim vỗ cánh nhiều lần → TẬP",
    "word_link_vi": "HỌC (tiếp thu) + TẬP (luyện đi luyện lại) = học tập"
  }
}
```

**Ràng buộc schema** (kiểm tra bởi `scripts/validate-vocab.js`):
- `hsk_version` luôn là `"3.0"`; `hsk_level` ∈ {1..6, 7} — giá trị `7` đại diện cho nhóm **7–9** (HSK 3.0 gộp chung một danh sách)
- `hsk_band`: `elementary` (1–3) | `intermediate` (4–6) | `advanced` (7–9)
- `examples`: đúng 3 phần tử, `tier` lần lượt 1, 2, 3, `context` không trùng nhau
- `characters`: mỗi chữ Hán trong `simplified` có đúng một entry, bắt buộc có `radical`, `han_viet`, `mnemonic`
- `mnemonic_summary.hint_short` ≤ 60 ký tự (vừa một dòng trên flashcard mobile)

### 6.2 Graded Passage (bài khóa đục lỗ — Mode 6)
```json
{
  "id": "p_hsk1_0007",
  "hsk_level": 1,
  "topic": "daily",
  "title": "我的周末",
  "text": "星期六我不{{hsk1_0215|工作}}。早上我和朋友去{{hsk1_0088|商店}}买东西，中午我们在饭店{{hsk1_0061|吃饭}}。下午我在家{{hsk1_0412|学习}}中文，晚上看电视。",
  "pinyin": "Xīngqīliù wǒ bù gōngzuò. ...",
  "translation_vi": "Thứ bảy tôi không đi làm. Buổi sáng tôi cùng bạn đi cửa hàng mua đồ, buổi trưa chúng tôi ăn cơm ở nhà hàng. Buổi chiều tôi học tiếng Trung ở nhà, buổi tối xem tivi.",
  "char_count": 62,
  "vocab_coverage": { "at_or_below_level": 1.0 },
  "glossary": [],
  "questions": [
    {
      "type": "true_false",
      "zh": "星期六他去工作。",
      "vi": "Thứ bảy anh ấy đi làm.",
      "answer": false
    },
    {
      "type": "multiple_choice",
      "zh": "他下午做什么？",
      "options": ["看电视", "学习中文", "买东西", "吃饭"],
      "answer": 1
    }
  ],
  "audio": "audio/passages/p_hsk1_0007.mp3"
}
```
- `{{word_id|chữ}}` đánh dấu những vị trí **có thể** đục lỗ; lúc chạy app chỉ đục những từ người dùng đã học (xem M6).
- `vocab_coverage.at_or_below_level` ≥ 0.95, từ vượt cấp phải có trong `glossary`.

### 6.3 Exercise Attempt (kết quả từng lần làm bài)
```json
{
  "word_id": "hsk1_0412",
  "mode": "cloze_passage",
  "recall_level": 2,
  "correct": true,
  "used_hint": false,
  "response_ms": 4200,
  "inferred_rating": 3,
  "final_rating": 3,
  "counts_for_fsrs": true,
  "timestamp": "2026-10-18T10:05:00Z"
}
```
- `counts_for_fsrs: false` với các lần luyện thêm (practice), xem 4.2.2.
- Dữ liệu này dùng để tính thời gian trung vị theo dạng bài và để thống kê điểm yếu.

### 6.4 Card Review Record (lịch sử ôn tập)
```json
{
  "word_id": "hsk3_001",
  "user_id": "local_user",
  "stability": 12.5,
  "difficulty": 4.2,
  "elapsed_days": 0,
  "scheduled_days": 12,
  "reps": 7,
  "lapses": 1,
  "state": "review",
  "due": "2026-10-30T08:00:00Z",
  "last_review": "2026-10-18T10:00:00Z",
  "review_history": [
    { "date": "2026-10-01", "rating": 3, "elapsed": 0 },
    { "date": "2026-10-02", "rating": 4, "elapsed": 1 }
  ]
}
```

### 6.5 User Profile
```json
{
  "display_name": "Nguyễn Văn A",
  "target_hsk": 6,
  "daily_new_cards": 10,
  "daily_time_goal_minutes": 20,
  "preferred_modes": ["flashcard", "multiple_choice", "cloze_passage", "matching"],
  "disabled_modes": ["speaking"],
  "study_focus": "reading",
  "streak_days": 14,
  "total_reviews": 842,
  "retention_rate": 0.87,
  "created_at": "2026-09-01T00:00:00Z"
}
```

---

## 7. GAMIFICATION & RETENTION

### 7.1 Hệ Thống Thưởng
| Mốc | Phần thưởng |
|-----|------------|
| Hoàn thành session | +XP + confetti animation |
| Streak 7 ngày | Badge "Tuần luyện thép" 🏆 |
| Streak 30 ngày | Badge "Tháng bền bỉ" 🔥 |
| Học hết HSK 1 | Chứng nhận số + animation đặc biệt |
| Retention 90%+ | Badge "Trí nhớ thép" 🧠 |
| 1000 từ thuộc | Badge "Từ điển sống" 📖 |

### 7.2 Daily Reminder Logic
- Notification nhắc nhở qua Web Push API
- Thời gian nhắc: do user đặt (VD: 7:30 sáng)
- Nội dung: *"Bạn có 23 thẻ cần ôn hôm nay. Streak của bạn: 14 ngày 🔥"*

### 7.3 Motivational Moments
- Khi đạt 100% retention hôm nay → màn hình ăn mừng
- Khi học xong 1 HSK level → milestone card đặc biệt
- Từ "Word of the Day" mỗi buổi sáng (từ thú vị/thành ngữ)

---

## 8. HỆ THỐNG HSK 3.0 — 3 GIAI ĐOẠN, 9 CẤP ĐỘ

> Nguồn: 《国际中文教育中文水平等级标准》(GF 0025-2021). Số liệu "tích lũy" bao gồm toàn bộ các cấp trước.

```
Giai đoạn   │ Cấp │ Từ mới │ Từ tích lũy │ Hán tự tích lũy │ Âm tiết tích lũy │ Điểm ngữ pháp │ Mô tả
────────────┼─────┼────────┼─────────────┼─────────────────┼──────────────────┼───────────────┼──────────────────────────────
Sơ cấp      │  1  │   500  │     500     │       300       │        269       │       48      │ Sinh hoạt hàng ngày cơ bản
(初等)      │  2  │   772  │   1,272     │       600       │        468       │       81      │ Giao tiếp đơn giản
            │  3  │   973  │   2,245     │       900       │        608       │       81      │ Ngữ cảnh quen thuộc
Trung cấp   │  4  │ 1,000  │   3,245     │     1,200       │        724       │       76      │ Chủ đề rộng, trôi chảy hơn
(中等)      │  5  │ 1,071  │   4,316     │     1,500       │        822       │       71      │ Đọc báo, xem phim
            │  6  │ 1,140  │   5,456     │     1,800       │        908       │       67      │ Thành thạo, viết luận
Cao cấp     │ 7–9 │ 5,636  │  11,092     │     3,000       │      1,110       │      148      │ Học thuật, chuyên môn,
(高等)      │     │        │             │                 │                  │               │ tiệm cận người bản ngữ
```

**Điểm khác biệt HSK 3.0 cần phản ánh trong app**:
- Cấp 1–3 nhiều từ hơn hẳn HSK 2.0 (HSK 1: 150 → 500 từ) → lộ trình sơ cấp cần nhiều thẻ mới/ngày hơn.
- Cấp 7–9 dùng **chung một danh sách** và một bài thi; app hiển thị là "HSK 7–9", không tách 7/8/9.
- Chuẩn mới yêu cầu **viết tay** Hán tự từ cấp 1 → Mode 4 (Writing Quiz) cần ưu tiên các chữ trong danh sách viết tay của từng cấp.
- Ngoài từ vựng còn có **chữ Hán** và **âm tiết** theo cấp → `hanzi.json` lưu cấp HSK riêng cho từng chữ, dùng để phân tầng gợi ý bộ thủ.

**Lộ trình học được gợi ý** (đã cộng thời gian ôn tập):
- HSK 1: ~2 tháng (10 từ/ngày)
- HSK 2: ~3 tháng (10 từ/ngày)
- HSK 3: ~3 tháng (15 từ/ngày)
- HSK 4: ~3–4 tháng (15 từ/ngày)
- HSK 5: ~4 tháng (15 từ/ngày)
- HSK 6: ~4 tháng (15 từ/ngày)
- HSK 7–9: ~12 tháng (20 từ/ngày)

---

## 9. TÍNH NĂNG NÂNG CAO (PHASE 2+)

### 9.1 AI-Powered Features
- **Câu ví dụ cá nhân hóa**: Dùng AI tạo câu ví dụ phù hợp sở thích người dùng (du lịch, kinh doanh, v.v.)
- **Phân tích điểm yếu**: AI phân tích pattern lỗi → gợi ý bộ thủ/cấu trúc cần luyện thêm
- **Ngữ cảnh văn hóa**: Giải thích thành ngữ, điển tích ẩn sau từ

### 9.2 Social Features
- **Leaderboard**: Xếp hạng trong nhóm bạn bè
- **Shared Decks**: Chia sẻ bộ thẻ tuỳ chỉnh
- **Study Rooms**: Học cùng nhau theo thời gian thực

### 9.3 Import/Export
- Export sang Anki (.apkg format)
- Import từ Anki decks
- Export dữ liệu học dạng CSV/JSON

---

## 10. PERFORMANCE & ACCESSIBILITY

### 10.1 Performance Targets
- First Contentful Paint: < 1.5s
- Time to Interactive: < 3s
- Lighthouse Score: 90+
- Offline-first: Hoạt động đầy đủ khi không có mạng (Service Worker + IndexedDB)

### 10.2 Accessibility
- WCAG 2.1 AA compliance
- Keyboard navigation đầy đủ
- Screen reader support cho người khiếm thị
- Font size điều chỉnh được (đặc biệt quan trọng cho Hán tự)
- High contrast mode

### 10.3 Mobile-First
- Touch gestures: Vuốt phải = Good, vuốt trái = Again
- Haptic feedback trên mobile
- Bottom navigation bar trên màn hình nhỏ
- PWA installable (có thể cài như app)

---

## 11. CODING CONVENTIONS

### 11.1 JavaScript
```javascript
// Dùng ES2022+ modules
// Tên hàm: camelCase, mô tả hành động
// Tên class: PascalCase
// Constants: SCREAMING_SNAKE_CASE
// Comments: Tiếng Anh cho code, Tiếng Việt cho business logic

// Ví dụ đúng:
const DAILY_NEW_CARDS_DEFAULT = 10;

class FlashcardSession {
  // Xử lý một session học tập hoàn chỉnh
  constructor(cards, options) { ... }
  
  async startReview() { ... }
  
  // Tính interval tiếp theo theo FSRS-4.5
  calculateNextInterval(card, rating) { ... }
}
```

### 11.2 CSS
```css
/* Dùng CSS Custom Properties cho tất cả tokens */
:root {
  --color-bg-primary: #0D0F14;
  --color-accent-gold: #E8B86D;
  --font-hanzi: 'Noto Serif SC', serif;
  --spacing-card-padding: 2rem;
  --radius-card: 16px;
  --transition-card-flip: 400ms cubic-bezier(0.34, 1.56, 0.64, 1);
}

/* BEM methodology cho component classes */
.flashcard { }
.flashcard__front { }
.flashcard__back { }
.flashcard--flipped { }
.flashcard--correct { }
```

### 11.3 File Organization
- Mỗi component trong file riêng
- Tách data khỏi logic
- SRS algorithm hoàn toàn pure functions (dễ test)
- Không hardcode string → dùng constants

---

## 12. ĐỊNH NGHĨA "DONE" (Definition of Done)

Một tính năng được coi là hoàn chỉnh khi:
- [ ] Hoạt động trên Chrome, Firefox, Safari (desktop + mobile)
- [ ] Responsive trên 320px → 2560px
- [ ] Lighthouse Performance score ≥ 90
- [ ] Flashcard flip animation mượt 60fps
- [ ] SRS algorithm tính đúng interval (có unit test)
- [ ] Dữ liệu persist qua IndexedDB (reload không mất)
- [ ] Dark mode không có contrast issue
- [ ] Keyboard accessible
- [ ] Không có console errors/warnings
- [ ] Mỗi dạng bài tập: làm được bằng bàn phím và cảm ứng, có unit test cho `grader.js` (kết quả → rating) và `distractors.js` (không sinh đáp án trùng/đồng nghĩa)
- [ ] Bài khóa đục lỗ qua kiểm tra độ phủ từ vựng ≥ 95% theo cấp
- [ ] Dữ liệu từ vựng đúng chuẩn HSK 3.0 và qua `scripts/validate-vocab.js`: đủ 3 ví dụ phân tầng, mỗi chữ có bộ thủ + Hán Việt + gợi ý ghi nhớ

---

## 13. PROMPT STARTERS CHO AI ASSISTANT

Khi làm việc với codebase này, AI nên:

**Khi được yêu cầu tính năng mới**:
> "Trước khi implement, hãy xác nhận: (1) Tính năng này có đặt người học lên trung tâm không? (2) Có làm phức tạp thêm UX không? (3) Có ảnh hưởng đến SRS algorithm không?"

**Khi thiết kế UI component**:
> "Component này có follow 'Minimalist Zen' principle không? Hán tự có phải là focal point không? Animation có purpose hay chỉ decoration?"

**Khi biên soạn / sinh dữ liệu từ vựng**:
> "Từ này có trong wordlist HSK 3.0 đúng cấp không? 3 ví dụ có đúng giới hạn từ vựng từng tầng và thuộc 3 ngữ cảnh khác nhau không? Gợi ý bộ thủ là chiết tự thật hay sáng tạo — đã gắn nhãn đúng chưa? Hình ảnh của bộ thủ có nhất quán với các từ khác không?"

**Khi thêm hoặc sửa dạng bài tập**:
> "Dạng bài này thuộc mức nào trên Recall Ladder? Kết quả quy đổi sang rating FSRS thế nào, và có bị ghi trùng review trong ngày không? Phương án nhiễu có thể vô tình cũng là đáp án đúng không?"

**Khi debug SRS**:
> "Kiểm tra FSRS-4.5 formula: stability, difficulty, retrievability. Log interval trước và sau khi user đánh giá."

---

*Tài liệu này là source of truth cho dự án HànZì Master. Mọi quyết định kỹ thuật và thiết kế phải nhất quán với triết lý học ngôn ngữ và UX được định nghĩa ở đây.*

*Cập nhật lần cuối: 2026-10-18*
