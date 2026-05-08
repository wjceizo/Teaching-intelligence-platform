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
## Phase 4 · 问答中心（教师答疑）

### Prompt 4-1 · 问答后端

```
实现问答中心的后端 API（本阶段只做教师人工答疑，AI答疑在之后完成）。

【Schemas】app/schemas/question.py
- QuestionCreate: title, content, course_id, chapter_id(optional), type(ai/teacher),
  paragraph_ref(optional)
- AnswerCreate: content
- QuestionResponse: 完整问题信息 + user(id/username/avatar_url) + answers_count
- AnswerResponse: 完整答案信息 + user(id/username/avatar_url/role) + user_vote(1/-1/0)
- QuestionFilter: course_id, chapter_id, type, status, sort(latest/hot/unanswered)

【Service】app/services/question_service.py
- list_questions(db, user_id, filters, page, page_size)
- get_question_detail(db, question_id, user_id) → Question + answers列表
- create_question(db, user_id, data) → Question
- delete_question(db, question_id, user) → None（本人或admin）
- create_answer(db, question_id, user_id, data) → Answer
- update_answer(db, answer_id, user_id, content) → Answer
- delete_answer(db, answer_id, user) → None
- vote_answer(db, answer_id, user_id, vote: 1|-1|0) → Answer（更新upvotes/downvotes）
- toggle_pin(db, question_id, user) → Question（teacher/admin）
- resolve_question(db, question_id, user) → Question（提问者或teacher）

【Router】app/routers/questions.py，前缀 /api/v1/questions
- GET / → 分页列表（?course_id=&type=teacher&status=open&sort=latest&page=1）
- POST / → 201 QuestionResponse
- GET /{id} → QuestionResponse（含完整answers列表）
- DELETE /{id} → 204
- POST /{id}/answers → 201 AnswerResponse
- PUT /answers/{id} → AnswerResponse
- DELETE /answers/{id} → 204
- POST /answers/{id}/vote → AnswerResponse（body: {"vote": 1}）
- POST /{id}/pin → QuestionResponse（teacher/admin）
- POST /{id}/resolve → QuestionResponse
```

---

### Prompt 4-2 · 问答前端

```
实现问答中心的前端界面。

【页面和组件】

1. src/pages/QACenterPage.tsx
   - 顶部 Tab：全部 / AI答疑 / 教师答疑
   - 左侧筛选栏：课程选择、状态（未解决/已解决）、排序（最新/最热/无人回答）
   - 右侧问题列表 + 提问按钮（悬浮右下角 FAB）
   - 点击问题跳转详情

2. src/components/qa/QuestionCard.tsx
   - 标题、内容摘要（最多2行）、标签（AI/教师、已解决）
   - 提问人头像+名字、时间、回答数、浏览数
   - 置顶问题顶部显示 📌 徽章

3. src/pages/QuestionDetailPage.tsx
   - 问题内容（MarkdownRenderer）
   - 如果有段落关联，显示引用的段落内容
   - 答案列表（按投票数排序）
   - 每个答案：内容、作者、时间、投票按钮（👍/👎）、教师标识
   - 底部回答输入框（Markdown 编辑器）

4. src/components/qa/AskQuestionDialog.tsx
   - shadcn Dialog
   - 标题输入框
   - 内容：Markdown 编辑器（支持LaTeX提示）
   - 课程/章节选择下拉
   - 类型选择：AI答疑 / 教师答疑
   - 如果从讲义页面跳转过来，自动填充段落引用

5. src/components/qa/AnswerItem.tsx
   - 内容用 MarkdownRenderer 渲染
   - 投票按钮（已投票时高亮）
   - 教师/AI 角色徽章

【实时更新】
- 进入问题详情时，通过 WebSocket 订阅新答案
- 新答案到达时，TanStack Query invalidate 对应 query

【Hooks】
- useQuestions(filters, page)
- useQuestion(id)
- useCreateQuestion()
- useCreateAnswer()
- useVoteAnswer()
- useResolveQuestion()
```

### Prompt 4-3 · 问答功能修改
1.自己提出的问题可以编辑修改，也可以删除问题，删除用红色按钮高亮显示（点进问题之后删除）。
2.回答者可以修改自己的答案，也可以删除自己发布的答案。
3.在问答栏，发起提问后，整个页面颜色都暗了，我仅需要背景色变暗，输入的提问框颜色不变且提问框背景颜色应该是纯色。
4.查看问题时应该显示是哪一门课的哪一章节的问题，应在和问题上方的‘教师答疑’，‘未解决/解决’并列，课程的背景色每门课都不一样，均用浅色，但相同的课程应该用相同的颜色，章节的颜色用浅蓝色。
5.在问答栏发起提问的选择框中，不需要段落引用的选项。
6.在课程学习中，每个段落旁的提问按钮目前没有生效，请帮我生效，并且在问题中会将引用的段落放在问题里。
7.在课程学习中，右上角的提问应该出现提问框，会自动填入课程和章节，也不需要填写段落。