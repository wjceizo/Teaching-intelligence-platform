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
## Phase 2 · 用户认证系统

### Prompt 2-1 · 认证后端

```
在已有的 FastAPI 项目中实现完整的用户认证系统。

【Pydantic Schemas】app/schemas/user.py
- UserRegister: username, email, password（含密码强度验证：8+字符，含数字和字母）
- UserLogin: email, password
- TokenResponse: access_token, refresh_token, token_type
- UserResponse: id, username, email, role, avatar_url, created_at
- UserUpdate: username(optional), avatar_url(optional)
- PasswordChange: old_password, new_password

【Service】app/services/auth_service.py
- register(db, data: UserRegister) → User：检查邮箱/用户名唯一，bcrypt哈希密码
- login(db, email, password) → (User, access_token, refresh_token)
- create_access_token(user_id, role) → str（15分钟过期，payload含sub和role）
- create_refresh_token(user_id) → str（7天过期）
- refresh_access_token(refresh_token) → str
- change_password(db, user, old_password, new_password)

【Router】app/routers/auth.py，路径前缀 /api/v1/auth
- POST /register → 201 UserResponse
- POST /login → 200 TokenResponse（支持 OAuth2PasswordRequestForm）
- POST /refresh → 200 TokenResponse
- GET /me → 200 UserResponse（需要认证）
- PUT /me → 200 UserResponse（需要认证）
- POST /me/password → 204（需要认证）

【dependencies.py】完善 get_current_user 和 require_role("teacher","admin") 依赖

所有错误返回统一格式：{"detail": "错误信息"}
```

---

### Prompt 2-2 · 认证前端

```
在已有的 React 项目中实现认证相关页面和逻辑。

【页面】src/pages/
- LoginPage.tsx：邮箱+密码表单，记住我，跳转到注册页链接
- RegisterPage.tsx：用户名+邮箱+密码+确认密码，客户端校验

【TanStack Query Hooks】src/lib/api.ts 中新增：
- useLogin()：mutation，成功后写入 authStore，跳转到 /dashboard
- useRegister()：mutation，成功后提示并跳转登录
- useMe()：query，获取当前用户信息
- useUpdateProfile()：mutation

【authStore.ts】补充：
- login action 调用 /api/v1/auth/login，存储 access_token + refresh_token
- logout action 清空 store 并跳转 /login
- 启动时如果有 token，自动调用 useMe 验证有效性

【UI 要求】
- 使用 shadcn/ui 的 Card、Input、Button、Form 组件
- 加载时按钮显示 spinner
- 错误信息在表单下方显示（不用 alert）
- 登录页背景使用渐变色，居中卡片布局
- 表单使用 React Hook Form + zod 验证
- 响应式，移动端友好

【路由】App.tsx 中：
- /login、/register 为公开路由
- 其他路由包裹在 ProtectedRoute 中
- 已登录用户访问 /login 自动跳转 /dashboard
```

---

### Prompt 2-3 · 前端微调
LoginPage 登录按钮应该加一个边框，并且应该用黑色显示登录两字而非白色，登录密码错误时应该返回"密码错误或者该用户不存在"而不是"Authentication expired"。同时，当前登录界面将邮箱和密码都填写了内容（student@example.com和对应密码），我不需要填写，请去掉

RegisterPage 注册界面会自动读取浏览器保存的用户名和密码，这是不应该的，和登录按钮一样，应该加一个边框，并且应该用黑色显示注册两字而非白色。同时点击注册按钮必须使得4个框都有内容才可以注册，并且在输入密码的时候，用户可以选择显示和加密密码的输入情况，并且提示输入的密码得存在字母和数字，不然也不可以点击注册按钮

主界面 可以更改颜色，在推出登出后请自动调整为亮色，不然登录界面的色彩有点让人不适。每次点击菜单上的选项都应该检查jwt，如果没有jwt应该弹出弹窗"用户信息已经过期，请重新登录。"用户点击确定后返回登录界面


