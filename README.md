# HànZì Master

*Học ít, nhớ nhiều — Chinh phục HSK từng bước.*

Ứng dụng web học từ vựng tiếng Trung theo **chuẩn HSK 3.0**, gồm **11.013 từ HSK 1 → 7–9** nhập từ bộ thẻ Anki *ZHVI HSK 3.0*. Mỗi từ có audio phát âm thật, câu ví dụ có audio, ảnh minh hoạ, âm Hán Việt và gợi ý ghi nhớ theo bộ thủ. Từ vựng được chia theo **cấp → bài → chặng ~10 phút**. Lịch ôn dùng **FSRS-4.5**, có **15 dạng bài Active Recall** và phần **Đọc & Dịch** cho từng bài. Ứng dụng chạy offline-first, viết bằng HTML/CSS/JavaScript thuần, không cần bước build.

`CLAUDE.md` là tài liệu gốc về triết lý, quy tắc dữ liệu và thiết kế.

## Chạy ứng dụng

Yêu cầu: Node.js ≥ 22.5 (cần `node:sqlite` để đọc file Anki). Dự án không có thư viện phụ thuộc.

```bash
npm run import-anki -- "ZHVI HSK 3.0 (1).apkg"   # lần đầu: nhập từ vựng + chép ~765 MB audio/ảnh (~4 phút)
npm start                                        # máy chủ tĩnh → http://localhost:5173
npm test                                         # unit test: FSRS-4.5, grader, distractors, picker, scheduler
npm run validate                                 # kiểm tra toàn bộ dữ liệu
```

- `--no-media` chỉ sinh lại dữ liệu JSON (khoảng 5 giây), không chép lại audio.
- Không mở thẳng `index.html` bằng `file://`: trình duyệt chặn ES modules và `fetch` JSON.

## Dùng trực tuyến (mọi nơi)

Web được đăng trên GitHub Pages: **https://thienphuc246835-art.github.io/hanzi-master/**

- Mở trên điện thoại → menu trình duyệt → **Thêm vào màn hình chính** (Chrome: "Cài đặt ứng dụng"; Safari: Chia sẻ → "Thêm vào MH chính") để dùng như một ứng dụng; dữ liệu đã mở sẽ dùng được cả khi offline.
- Cập nhật web sau khi sửa code: `git add -A`, `git commit -m "..."`, `git push` — GitHub tự dựng lại trang sau 1–3 phút.
- Kho mã: https://github.com/thienphuc246835-art/hanzi-master (công khai, kèm toàn bộ audio/ảnh — xem lưu ý giấy phép ở mục Dữ liệu).

## Dùng trong mạng nội bộ (không cần Internet)

1. Máy tính và điện thoại bắt cùng một mạng Wi-Fi. Trên máy tính chạy `npm start`; dòng "Trên điện thoại" in ra địa chỉ dạng `http://192.168.x.x:5173`.
2. Mở địa chỉ đó bằng Chrome/Safari trên điện thoại.
3. Nếu điện thoại không vào được: Windows Firewall đang chặn cổng. Bấm **Allow access** khi Windows hỏi, hoặc mở PowerShell **Run as administrator** và chạy:
   `New-NetFirewallRule -DisplayName "HanZi Master 5173" -Direction Inbound -Protocol TCP -LocalPort 5173 -Action Allow -Profile Private`

Lưu ý:
- Máy tính phải bật và đang chạy `npm start`.
- Tiến độ học lưu riêng trên từng thiết bị. Muốn chuyển tiến độ: Cài đặt → Xuất JSON trên máy này, rồi Nhập JSON trên máy kia.
- Qua `http://` trong mạng nội bộ, trình duyệt không cho cài thành ứng dụng (PWA) và không chạy offline; hai tính năng này cần HTTPS.

## Tính năng

| Màn hình | Nội dung |
|---|---|
| `#/lessons/:cấp` | Tab HSK 1 … 7–9. Mỗi bài là một thẻ: số bài, tên Việt/Trung, số từ, số chặng, nút **Luyện tập**, thanh tiến độ. HSK 1–3 theo đúng thứ tự bài giáo trình; HSK 4–9 xếp tự động theo tần suất |
| `#/lesson/:id` | Chi tiết bài: học theo chặng, luyện 10 dạng bài với từ của bài, danh sách từ có audio, nghe cả bài, bài trước/sau |
| `#/lesson/:id/read` | **Đọc & Dịch**: đọc bài khóa (bật/tắt pinyin, nghĩa; nghe từng câu hoặc cả bài), dịch Trung→Việt (tự so với bản mẫu), dịch Việt→Trung (ghép từ, máy chấm) |
| `#/` | Bài học tiếp theo, chuỗi ngày học, hàng đợi hôm nay, từ của ngày, heatmap 60 ngày, dự báo 7 ngày, vòng tiến độ HSK, luyện tập tự do, huy hiệu |
| `#/study` | Phiên ôn tập FSRS (toàn bộ, hoặc `?lesson=…&seg=…` cho một bài/chặng). **Thẻ từ mới tự phát âm khi xuất hiện** |
| `#/browse` | Tra cứu 11.013 từ (phân trang) theo Hán tự / pinyin / nghĩa / Hán Việt; lọc cấp, giai đoạn, bộ thủ, ⭐ |
| `#/stats` | Heatmap 365 ngày, từ mới và ôn tập, phân bố đánh giá, dự báo, độ chính xác theo dạng bài, đám mây từ |
| `#/settings` | Giao diện **tối / sáng giấy kem**, tự phát âm, mục tiêu, dạng bài, cỡ chữ, tương phản cao, nhắc nhở, xuất/nhập dữ liệu |

Nút ☀/☾ trên thanh trên cùng dùng để chuyển nhanh giữa giao diện tối và sáng.

**Phím tắt:** `1`–`4` chọn đáp án / đánh giá · `Enter` xác nhận / lật thẻ · `Space` phát âm · `H` gợi ý bộ thủ · `←`/`→` trong Đúng/Sai.

## Dữ liệu

| File | Nội dung |
|---|---|
| `src/js/data/vocab/hsk*.json` | 11.013 từ: nghĩa, Hán Việt, audio, ảnh, câu ví dụ (có audio), cận/trái nghĩa, từ dễ nhầm, bài học |
| `src/js/data/hanzi.json` | 2.971 chữ Hán: bộ thủ Khang Hy, IDS, lục thư, số nét, gợi ý cấu tạo |
| `src/js/data/strokes/` | Dữ liệu nét viết cho HanziWriter (dùng được offline) |
| `src/js/data/lessons.json` | 467 bài (HSK 1: 15 bài + bổ sung, HSK 2: 15, HSK 3: 18, HSK 4–9 tự chia 25 từ/bài) |
| `src/js/data/lesson-titles.json` | Tên bài theo giáo trình (HSK 1 lấy từ ảnh mẫu) — thêm tên HSK 2–3 tại đây |
| `src/js/data/texts/` | **Bài khóa** — xem `texts/README.md` để biết định dạng |
| `src/assets/audio/`, `img/` | Audio mp3 và ảnh webp chép từ bộ thẻ (không đưa vào git) |

- 32 từ HSK 1 có câu chuyện ghi nhớ viết tay (gốc ở `tests/fixtures/seed-hsk1.json`). Các từ còn lại có phần "Phân tích cấu tạo" do app tự sinh từ bộ thủ, IDS và lục thư.
- Nguồn và giấy phép: xem `src/js/data/LICENSE-DATA.md`. Nghĩa v2, câu ví dụ, audio và ảnh là nội dung của ZHVI, chỉ dùng cho học cá nhân. Muốn công khai website cần xin phép tác giả.

## Cấu trúc

```
index.html, manifest.webmanifest, sw.js      App shell, PWA, cache offline (audio cache-first)
src/css/       tokens (tối + sáng) · main · components · animations
src/js/core/   constants, srs (FSRS-4.5), scheduler, exercise-picker, grader, distractors,
               session, store, db (IndexedDB), text (tách từ + pinyin tự sinh)
src/js/components/  flashcard, word-detail, progress, hsk-navigator, exercises/
src/js/pages/  dashboard, lessons, lesson, reading, study, practice, browse, stats, settings, onboarding
src/js/utils/  dom, ui, audio, tts, strokes, icons, pinyin, random, date, drag
scripts/       import-anki.mjs (+ lib/zip.mjs), serve.js, validate-vocab.js
tests/         node:test unit tests + fixtures
```

## Giới hạn đã biết

- Phần đọc & dịch hiện dùng câu ví dụ của các từ trong bài, cho tới khi bài khóa giáo trình được thêm vào `src/js/data/texts/`.
- Tên bài HSK 2–3 chưa có. Tạm thời app hiển thị nghĩa của vài từ đầu bài.
- Dữ liệu bộ thẻ thường có 2 câu ví dụ mỗi từ, không phải 3 như CLAUDE.md §4.5. Ba tầng được xếp theo độ dài câu.
- Lần mở đầu tiên tải khoảng 20 MB JSON từ vựng; các lần sau dùng cache của service worker.
- Nhắc nhở chỉ hiện khi ứng dụng đang mở.
