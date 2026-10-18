# Bài khóa (lesson texts)

Thư mục này chứa bài khóa của giáo trình để luyện **Đọc & Dịch** ở trang mỗi bài (`#/lesson/<id>/read`).
Khi một bài chưa có bài khóa, app tạm dùng câu ví dụ (có audio) của các từ trong bài.

## Cách thêm

1. Tạo file theo cấp: `hsk1.json`, `hsk2.json`, … (tên phải bắt đầu bằng `hsk` và kết thúc bằng `.json`).
2. Chạy `npm run import-anki -- "đường/dẫn/ZHVI HSK 3.0.apkg" --no-media` (hoặc tự thêm file vào `texts` trong `manifest.json`).
3. Chạy `npm run validate` để kiểm tra.

## Định dạng

```json
[
  {
    "lesson_id": "hsk1-b01",
    "title_zh": "AI小语，你好！",
    "title_vi": "AI Tiểu Ngữ, xin chào!",
    "sections": [
      {
        "heading": "Bài khóa 1",
        "lines": [
          { "speaker": "A", "zh": "你好！", "vi": "Xin chào!" },
          { "speaker": "B", "zh": "你好！", "pinyin": "Nǐ hǎo!", "vi": "Chào bạn!" }
        ]
      }
    ]
  }
]
```

- `lesson_id`: id của bài trong `lessons.json` (`hsk1-b01` … `hsk1-b15`, `hsk2-b01` …, `hsk3-b18`).
- `pinyin` có thể bỏ trống: app tự sinh pinyin từ từ điển (hiển thị kèm nhãn "tự sinh").
- `speaker` có thể bỏ trống với bài đọc không phải hội thoại.
- Bài khóa giáo trình là tài liệu có bản quyền: chỉ dùng cho mục đích học cá nhân.
