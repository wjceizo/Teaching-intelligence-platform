# Teaching Intelligence Platform

数学教育智能平台（前后端分离）：
- `backend/`：FastAPI + SQLAlchemy + Alembic
- `frontend/`：React + Vite + TanStack Query
- 基础服务：PostgreSQL、Redis、Milvus、MinIO（通过 Docker Compose）

## 1. 环境要求

- Python 3.12+
- Node.js 20+
- Docker Desktop（已启动）
- `uv`（Python 包管理）

## 2. 初始化

在仓库根目录执行：

```powershell
Copy-Item .env.example .env
docker compose up -d
docker pull python:3.12-slim
docker pull node:20-slim
docker pull gcc:13
```

## 3. 启动后端

```powershell
cd backend
uv venv .venv
.\.venv\Scripts\activate
uv sync --extra dev
alembic upgrade head
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

后端健康检查：
- `http://localhost:8000/health`
- `http://localhost:8000/api/health`

## 4. 启动前端

新开一个终端：

```powershell
cd frontend
npm install
npm run dev
```

前端地址：`http://localhost:3000`

## 5. 默认测试账号

后端启动时会自动创建：

- 学生：`student@example.com` / `Password123`
- 教师：`teacher@example.com` / `Password123`

## 6. 常用命令

```powershell
# 停止基础容器
docker compose down

# 查看容器状态
docker compose ps

# 前端构建
cd frontend
npm run build

# 后端测试
cd backend
.\.venv\Scripts\python.exe -m pytest -q tests
```
