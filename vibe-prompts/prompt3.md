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
## Phase 3 · 课程 & 章节管理

### Prompt 3-1 · 课程后端

```
实现课程和章节管理的完整后端 API。

【Schemas】app/schemas/course.py
- CourseCreate: title, description(optional), cover_image(optional)
- CourseUpdate: 同上，所有字段 optional
- ChapterCreate: title, content, order_index
- ChapterUpdate: 同上，所有字段 optional
- ChapterReorder: chapters: list[{id, order_index}]
- CourseResponse: 完整课程信息 + teacher（只含id/username/avatar_url）+ chapters_count
- ChapterResponse: 完整章节信息（不含content，用于列表）
- ChapterDetailResponse: 含完整content
- ProgressUpdate: completed: bool

【Service】app/services/course_service.py
- list_courses(db, page, page_size, status=None) → (list[Course], total)
- get_course_with_chapters(db, course_id) → Course（预加载chapters按order_index排序）
- create_course(db, data, teacher_id) → Course
- update_course(db, course_id, data, user) → Course（只有 teacher 或 admin 可修改）
- delete_course(db, course_id, user) → None
- create_chapter(db, course_id, data, user) → Chapter
- update_chapter(db, chapter_id, data, user) → Chapter
- delete_chapter(db, chapter_id, user) → None
- reorder_chapters(db, course_id, order_data, user) → None
- update_progress(db, user_id, chapter_id, completed) → ChapterProgress
- get_enrollment(db, user_id, course_id) → Enrollment | None
- enroll(db, user_id, course_id) → Enrollment

【Router】app/routers/courses.py，前缀 /api/v1/courses
- GET / → 分页课程列表（?page=1&page_size=20&status=published）
- POST / → 201 CourseResponse（需要 teacher/admin）
- GET /{id} → CourseResponse + chapters列表
- PUT /{id} → CourseResponse
- DELETE /{id} → 204
- POST /{id}/enroll → 201（学生加入课程）
- GET /{id}/chapters → 章节列表
- POST /{id}/chapters → 201 ChapterResponse（teacher/admin）
- PUT /chapters/{chapter_id} → ChapterDetailResponse
- DELETE /chapters/{chapter_id} → 204
- POST /{id}/chapters/reorder → 204
- GET /chapters/{chapter_id}/content → ChapterDetailResponse
- POST /chapters/{chapter_id}/progress → 204（学生更新进度）

统一分页响应格式：{"data": [...], "meta": {"page": 1, "page_size": 20, "total": 100}}
```

---

### Prompt 3-2 · 课程前端

```
实现课程管理的完整前端界面。

【页面和组件】

1. src/pages/CourseListPage.tsx
   - 课程卡片网格（3列桌面/2列平板/1列移动）
   - 每张卡片：封面图、标题、教师名、章节数、进度条（已加入课程）、加入按钮
   - 顶部搜索框（本地过滤）
   - 教师可见"创建课程"按钮

2. src/components/course/CourseCard.tsx
   - 使用 shadcn Card 组件
   - 封面图占位符（渐变色+首字母）
   - hover 时轻微上浮效果（CSS transition）

3. src/pages/CourseDetailPage.tsx
   - 左栏（w-64）：章节目录树，已完成章节显示勾选图标，当前章节高亮
   - 右侧：LectureReader 组件
   - 顶部面包屑导航

4. src/components/course/LectureReader.tsx
   - 使用 MarkdownRenderer 渲染章节内容
   - 右侧悬浮工具栏：提问（跳转问答）、添加笔记
   - 底部上/下一章节导航按钮
   - 完成本章按钮（调用 progress API）

5. src/components/course/MarkdownRenderer.tsx
   - react-markdown + remark-math + rehype-katex
   - 段落 hover 时右侧显示"提问"小图标
   - 代码块使用 syntax highlight（react-syntax-highlighter）

6. src/pages/CourseEditorPage.tsx（教师端）
   - 左栏：章节列表 + 添加章节按钮 + 拖拽排序（@dnd-kit/sortable）
   - 右侧：Markdown 编辑器（简单 textarea，预览切换）
   - 保存按钮（debounce 自动保存）

【TanStack Query Hooks】src/lib/api.ts 新增：
- useCourses(page, pageSize)
- useCourse(id)
- useCreateCourse()
- useUpdateCourse()
- useDeleteCourse()
- useChapterContent(chapterId)
- useEnroll()
- useUpdateProgress()

【路由】
- /courses → CourseListPage
- /courses/:id → CourseDetailPage（默认显示第一章）
- /courses/:id/chapters/:chapterId → CourseDetailPage（指定章节）
- /courses/:id/edit → CourseEditorPage（教师/管理员）
```

---


### Prompt 3-3 · 课程功能修改

1.教师只可以修改自己创建的课程，不可以修改别人创建的课程，管理员可以修改所有人创建的课程。
2.教师可以删除自己创建的课程，删除用红色按钮高亮显示。
3.教师可以删除自己创建的课程的章节（比如创建了三章，可以删除第二章），删除用红色按钮高亮显示。
4.添加章节内容时应该增加保存修改按钮，自动保存应该让老师自己勾选，勾选才自动保存（默认是勾选自动保存）。
5.在课程编辑器中，点击要编辑的章节不灵敏，比如我编辑好了章节1，想要编辑章节2，点击左侧的章节2可能要点击多次才响应，请修改成点击一次就响应。
6.增加添加课程图片，教师可以从本地选取课程的图片，用base64格式存在该课程数据库中（cover_image列），课程中心可以显示该课程图片（自适应图片大小）
7.教师如果创建属于自己的课程，在课程中心该课程应该显示编辑课程而不是加入课程，其他教师的课程应该是查看课程而不是加入课程，教师不可以加入课程。
8.学生在加入课程后，点进课程才会有完成本章的按钮。
9.增加上传markdown文件，可以按照"##"后面的内容提取章节名，两个"##"之间的内容为该章节的内容。
附加：请修改右上角的个人信息按钮，应该是鼠标移到上面自动会出现 "个人中心"和 "退出" 的选择栏，而不是点击出现，并且移走鼠标一会会自动消失。并且该选择栏背景不应该透明，而应该纯色，透明会与背景重叠，造成视觉不便。