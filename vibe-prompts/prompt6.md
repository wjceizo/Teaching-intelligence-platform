# 数学教育智能体平台 · Vibe Coding Prompt 指南
## 总体规划

```
Phase 0 │ 部署基础数据库              ← 部署必备基础设施
Phase 1 │ 项目脚手架 & 基础设施        ← 跑通前后端开发环境
Phase 2 │ 用户认证系统                 ← 登录注册、JWT、RBAC
Phase 3 │ 课程 & 章节管理              ← 核心内容模块
Phase 4 │ 问答中心（教师答疑）          ← 社区互动
Phase 5 │ AI 答疑（RAG）               ← 智能核心
Phase 6 │ 笔记系统                     ← 学习工具
Phase 7 │ 代码实训（沙箱）             ← 实践环节
Phase 8 │ 在线测验系统                 ← 评估模块
Phase 9 │ 学习分析仪表盘               ← 数据洞察
Phase 10│ Lean 4 证明器                ← 高级功能
Phase 11│ 生产部署 & 监控              ← 上线准备
```
## Phase 6 · 笔记系统

### Prompt 6-1 · 笔记后端

```
实现笔记系统的完整后端。

【Schemas】app/schemas/note.py
- NoteCreate: title(optional), content, course_id(optional), chapter_id(optional),
  tags(list[str], default=[]), is_public(default=False), source_paragraph_ref(optional)
- NoteUpdate: 所有字段 optional
- NoteResponse: 完整笔记信息 + user(id/username/avatar_url) + course_title(optional)
- NoteFilter: course_id, chapter_id, is_public, tags, q(全文搜索关键词)

【Service】app/services/note_service.py
- list_notes(db, user_id, filters, page, page_size)
  - 私有笔记只返回自己的；公开笔记可搜索他人的（is_public=True）
  - 全文搜索：WHERE to_tsvector('english', title || ' ' || content) @@ plainto_tsquery(:q)
  - 标签过滤：WHERE :tag = ANY(tags)
- get_note(db, note_id, user_id) → Note（私有笔记只有本人可查）
- create_note(db, user_id, data) → Note
  - 创建后异步触发 index_note Celery 任务（is_public=True 时才向量化）
- update_note(db, note_id, user_id, data) → Note
- delete_note(db, note_id, user_id) → None
- get_public_notes_for_chapter(db, chapter_id, user_id) → list[Note]（章节相关的公开笔记）

【Router】app/routers/notes.py，前缀 /api/v1/notes
- GET / → 分页列表（?course_id=&tags=math,calculus&q=极限&is_public=false）
- POST / → 201 NoteResponse
- GET /{id} → NoteResponse
- PUT /{id} → NoteResponse
- DELETE /{id} → 204
- GET /chapter/{chapter_id}/public → 该章节的公开笔记列表（供讲义页右侧展示）
```

---

### Prompt 6-2 · 笔记前端

```
实现笔记系统的完整前端。

【页面和组件】

1. src/pages/NotesPage.tsx
   - 左侧筛选栏：课程筛选、标签云（点击过滤）、公开/私有切换
   - 右侧笔记列表（卡片网格，masonry 瀑布流布局）
   - 顶部搜索框（全文搜索，debounce 500ms）
   - 右下角 FAB：新建笔记

2. src/components/note/NoteCard.tsx
   - 标题、内容摘要（最多3行，overflow hidden）
   - 标签（彩色 Badge）
   - 来源（课程+章节名，如果有）
   - 时间、公开/私有图标
   - hover 显示编辑/删除按钮

3. src/components/note/NoteEditorDialog.tsx
   - shadcn Dialog（全屏或宽对话框）
   - 标题输入
   - Markdown 编辑器（带 LaTeX 工具栏快捷按钮：$、$$、\frac、\sum）
   - 标签输入（输入后按 Enter 添加，点击 × 删除）
   - 关联课程/章节选择
   - 公开/私有切换
   - 底部：保存草稿（不关闭）、发布

4. src/components/note/NoteDetailDrawer.tsx
   - 右侧抽屉（shadcn Sheet）
   - 完整内容渲染（MarkdownRenderer）
   - 顶部：编辑、删除、分享按钮

5. src/components/note/QuickNoteWidget.tsx
   - 在 LectureReader 右侧工具栏触发
   - 选中文本后自动摘录到笔记内容
   - 小型内联编辑器，支持添加注释后保存

【Hooks】
- useNotes(filters, page)
- useNote(id)
- useCreateNote()
- useUpdateNote()
- useDeleteNote()
- useChapterPublicNotes(chapterId)
```

### Prompt 6-3 · 笔记功能修改
1.在课程中添加笔记有几点需要修改：
a.点击添加笔记应该和笔记栏一样弹出整个填写框，只是自动帮用户填写笔记的关联课程和章节
b.用户使用鼠标选取文章内容后，应该浮现添加笔记的按钮，如果添加笔记则自动把用户选取的内容添加到笔记内容中并用斜体显示
2.在笔记栏中添加修改笔记有几点需要修改：
a.为在笔记显示中添加作者。
b.点击笔记后页面应该覆盖整个笔记页面，而不是在右侧使用一部分显示，应该显示在整个页面。
c.点击分享应该自动生成一个url，如果是非公开笔记则可以让用户选择分享时间（1小时，1天，7天，到时间自动销毁），其他用户（也需要登录）可以直接使用该url查看笔记，公开笔记则直接分享。
d.点开笔记后，选择编辑笔记按钮，弹出的编辑界面应该在笔记页面的上层而不是下层，你现在要把笔记页面关闭才可以编辑。