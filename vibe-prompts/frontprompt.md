# 前端改造审阅 Prompt
你是一个资深前端工程师和产品体验设计师。请基于当前 `frontend` 目录，对 AI 学习平台前端做一次系统性改造。目标不是重做成营销页，而是让现有学习、课程、问答、笔记、代码实训等工作流在桌面端和手机端都稳定、清晰、可用。
## 核心目标
1. 全站支持响应式布局：手机、平板、桌面都不能横向溢出、遮挡、按钮过小或表格挤爆。
2. 全站夜间模式统一：切换深色主题后，所有页面、按钮、输入框、弹窗、抽屉、卡片、状态标签、代码区、笔记页都必须跟随主题，不能出现黑字黑底、白底刺眼、边框消失等问题。
3. 优先修复笔记页面：`NotesPage`、`NoteEditorDialog`、`NoteDetailDrawer`、`NoteCard`、`QuickNoteWidget`、`ChapterPublicNotes` 必须完整适配主题和移动端。
4. 保持现有业务功能，不随意改 API 契约、不删除已有页面、不破坏 CodeLab、课程、问答和认证流程。
## 需要重点检查的文件
- `frontend/src/styles/globals.css`
- `frontend/tailwind.config.ts`
- `frontend/src/stores/uiStore.ts`
- `frontend/src/components/layout/AppLayout.tsx`
- `frontend/src/components/layout/TopNav.tsx`
- `frontend/src/components/layout/Sidebar.tsx`
- `frontend/src/pages/NotesPage.tsx`
- `frontend/src/components/note/*`
- `frontend/src/pages/CourseListPage.tsx`
- `frontend/src/pages/CourseDetailPage.tsx`
- `frontend/src/pages/CourseEditorPage.tsx`
- `frontend/src/pages/QACenterPage.tsx`
- `frontend/src/pages/QuestionDetailPage.tsx`
- `frontend/src/components/qa/*`
- `frontend/src/pages/CodeLabListPage.tsx`
- `frontend/src/pages/CodeLabDetailPage.tsx`
- `frontend/src/pages/CodeLabEditorPage.tsx`
- `frontend/src/pages/CodeLabManagePage.tsx`
- `frontend/src/components/codelab/*`
- `frontend/src/pages/LoginPage.tsx`
- `frontend/src/pages/RegisterPage.tsx`
## 主题系统改造要求
1. 扩展全局 CSS 变量，至少包含：
   - `background`
   - `foreground`
   - `surface`
   - `surface-elevated`
   - `primary`
   - `primary-foreground`
   - `muted`
   - `muted-foreground`
   - `border`
   - `destructive`
   - `success`
   - `warning`
   - `info`
2. 在 Tailwind 配置中映射这些语义颜色，避免页面继续散落 `text-black`、`bg-white`、`text-slate-*`、`border-slate-*`。
3. 将所有按钮改为主题安全样式：
   - 主按钮：`bg-primary text-primary-foreground`
   - 次按钮：`border border-border bg-surface text-foreground hover:bg-muted`
   - 危险按钮：使用 destructive token
4. 表单元素统一：
   - 输入框、select、textarea 在浅色/深色下都有明确背景、文字、placeholder、边框和 focus ring。
5. 兼容状态标签：
   - 成功、失败、运行中、等待、超时、置顶、公开/私有、教师标签等都要在深色主题可读。
6. 避免简单用 `.dark .text-black` 兜底作为主要方案；可以保留少量防御性兜底，但主要应替换到语义 token。
## 响应式改造要求
1. `AppLayout`：
   - 使用 `min-h-dvh`。
   - 主内容区 `min-w-0`，避免子组件撑出横向滚动。
   - 桌面端保留侧边栏，手机端侧边栏改为抽屉/覆盖层。
2. `Sidebar`：
   - 手机端默认关闭。
   - 点击导航后自动关闭。
   - 加遮罩层和关闭行为。
   - 折叠态不能只依赖中文首字，因为当前文本存在乱码风险；可以增加 title/aria-label。
3. `TopNav`：
   - 顶栏在手机端不要挤压。
   - 主题切换、用户菜单、菜单按钮可触摸区域至少 40px 高。
   - 用户下拉菜单必须跟随主题。
4. 页面布局：
   - 所有 `flex` 操作区在手机端允许换行或改为纵向。
   - 表格类页面如 CodeLab 管理保留横向滚动容器，但外层不能撑破页面。
   - 编辑器、预览、控制台在手机端纵向排列。
## 笔记体验专项
1. `NotesPage`：
   - 搜索框、筛选栏、标签云、瀑布流在手机端清晰排列。
   - 新建笔记浮动按钮在手机端不遮挡分页或内容，可改为底部安全区按钮。
2. `NoteEditorDialog`：
   - 手机端全屏或接近全屏，内容区可滚动，底部保存按钮固定或易触达。
   - 所有输入框、snippet 按钮、公开分享 checkbox 跟随主题。
3. `NoteDetailDrawer`：
   - 深色模式下不要固定 `bg-white text-slate-900`。
   - 分享链接输入框、复制按钮、删除按钮主题一致。
4. `NoteCard`：
   - 触屏设备上编辑/删除按钮不能只依赖 hover 才可见。
   - tag 胶囊颜色在深色模式下可读。
5. Markdown / LaTeX：
   - 代码块、引用块、表格、公式在深色模式下可读。
## 其他前端逻辑和体验优化建议
1. 登录/注册页：
   - 背景渐变适配夜间模式。
   - 登录/注册按钮不要使用 `text-black`。
   - 密码显示/隐藏按钮触摸区域增大。
2. 课程页：
   - 课程卡片按钮在深色模式可读。
   - 课程编辑器中的章节、课时、删除按钮统一主题。
   - 课程详情页章节导航手机端更紧凑。
3. 问答页：
   - `AskQuestionDialog` 深色适配。
   - 回答投票按钮、教师标签、状态标签使用语义色。
4. CodeLab：
   - Monaco 编辑器主题跟随全站 light/dark。
   - 运行/提交按钮在手机端不挤压。
   - `ConsolePanel` 输出、错误、测试用例状态深色可读。
   - 管理表格手机端保留可滚动，但操作按钮不要换到不可点击的位置。
5. 性能：
   - 当前构建包体较大，考虑对 Monaco、CodeLab 页面、Markdown 高亮语言包做懒加载或 chunk 拆分。
6. 可访问性：
   - 关键按钮补充 `aria-label`。
   - 弹窗支持 Esc 关闭和焦点可见。
   - 表单错误信息不要只依赖颜色。
7. 文字问题：
   - 当前部分中文显示为乱码，应单独检查源码编码或历史写入方式，优先修复用户可见的乱码文案。
## 实施要求
1. 改动前先审阅并列出计划。
2. 改动要尽量复用现有结构，不引入大型 UI 框架。
3. 每完成一批改动后运行：
   - `npm run build --prefix frontend`
4. 前端显著改动后，用浏览器检查至少：
   - 登录页
   - Dashboard
   - 课程列表/详情
   - 笔记列表/编辑/详情
   - 问答列表/详情
   - CodeLab 列表/详情/编辑/管理
5. 分别检查桌面宽度和手机宽度。
6. 最终输出：
   - 修改摘要
   - 重点文件
   - 已验证命令
   - 仍建议后续优化的事项