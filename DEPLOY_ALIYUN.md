# RE调香室 AI文案助手 — 项目部署文档

## 一、项目概述

**RE调香室** 是一个 AI 驱动的香水文案生成工具，面向小红书/抖音/朋友圈/视频脚本等社交媒体平台，帮助品牌快速生成高质量种草文案。

- **GitHub 仓库**: https://github.com/tristanhqwu-lgtm/re-copywriter.git
- **当前分支**: `claude/review-program-O2Skn`（最新代码在这个分支）
- **当前已部署地址 (GCP)**: https://re-copywriter-500344727244.asia-east1.run.app

---

## 二、技术栈

| 层级 | 技术 | 版本 |
|------|------|------|
| **前端** | React + TypeScript | React 19, TS 5.9 |
| **前端构建** | Vite + Tailwind CSS v4 | Vite 7.3, Tailwind 4.1 |
| **后端** | FastAPI (Python) | FastAPI 0.115, Python 3.12 |
| **数据库** | SQLite (SQLAlchemy ORM) | SQLAlchemy 2.0 |
| **AI 模型** | Google Gemini | gemini-2.5-flash |
| **网页抓取** | Playwright (Chromium) | Playwright 1.48 |
| **认证** | JWT (python-jose + bcrypt) | |
| **容器化** | Docker 多阶段构建 | |

---

## 三、项目目录结构

```
re-copywriter/
├── Dockerfile              # 多阶段构建（Node构建前端 → Python后端）
├── .dockerignore
├── .gitignore
├── backend/
│   ├── main.py             # FastAPI 入口，挂载路由+静态文件
│   ├── config.py           # 环境变量配置（Pydantic Settings）
│   ├── database.py         # SQLAlchemy 引擎 & Session
│   ├── models.py           # 6个 ORM 模型
│   ├── schemas.py          # Pydantic 请求/响应模型
│   ├── auth.py             # JWT 认证 (hash/verify/create_token/get_current_user)
│   ├── seed.py             # 内置场景数据（14个节日+场景模板）
│   ├── requirements.txt    # Python 依赖
│   ├── routers/
│   │   ├── auth.py         # /api/auth (注册/登录/me)
│   │   ├── products.py     # /api/products (CRUD + CSV导入)
│   │   ├── styles.py       # /api/styles (风格管理 + 文章来源 + 风格分析)
│   │   ├── scenes.py       # /api/scenes (场景模板管理)
│   │   ├── scrape.py       # /api/scrape (小红书/抖音内容抓取)
│   │   ├── generate.py     # /api/generate (AI文案生成 + 微调 + 历史记录)
│   │   └── tasks.py        # /api/tasks (异步任务状态查询)
│   └── services/
│       ├── generator.py    # Gemini AI 文案生成逻辑（多平台支持）
│       ├── scraper.py      # Playwright 抓取（三层提取 + 重试）
│       ├── analyzer.py     # 风格分析
│       ├── task_manager.py # 异步任务管理
│       └── utils.py        # LLM JSON 解析等工具
├── frontend/
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── index.html
│   └── src/
│       ├── main.tsx
│       ├── App.tsx         # 路由配置
│       ├── index.css       # Tailwind v4 + 日式简约主题色
│       ├── api/
│       │   └── client.ts   # Axios 实例 (baseURL: /api) + 任务轮询
│       ├── types/
│       │   └── index.ts    # TypeScript 类型定义
│       ├── components/
│       │   ├── Layout.tsx
│       │   └── BottomNav.tsx
│       └── pages/
│           ├── Login.tsx
│           ├── Workbench.tsx      # 主工作台（选产品→选风格→选场景→选平台→生成）
│           ├── ProductLibrary.tsx  # 产品库管理
│           ├── StyleLibrary.tsx    # 风格库管理
│           ├── SceneLibrary.tsx    # 场景库管理
│           └── Profile.tsx        # 个人中心 + 历史记录
```

---

## 四、环境变量

| 变量名 | 必填 | 说明 | 默认值 |
|--------|------|------|--------|
| `GEMINI_API_KEY` | **是** | Google Gemini API 密钥 | 空 |
| `GEMINI_MODEL` | 否 | Gemini 模型名 | `gemini-2.5-flash` |
| `JWT_SECRET` | **是** | JWT 签名密钥，**生产环境必须修改** | `change-me-in-production` |
| `JWT_ALGORITHM` | 否 | JWT 算法 | `HS256` |
| `JWT_EXPIRE_MINUTES` | 否 | Token 过期时间（分钟） | `1440`（24小时） |
| `DATABASE_URL` | 否 | SQLAlchemy 数据库连接串 | `sqlite:///./re_copywriter.db` |
| `ALLOWED_ORIGINS` | 否 | CORS 允许的域名（逗号分隔），`*` 表示允许所有 | `http://localhost:5173` |
| `PORT` | 否 | 应用监听端口 | `8080` |

---

## 五、数据库模型

SQLite 数据库，6 张表，应用启动时自动创建（`Base.metadata.create_all`）。

| 表名 | 说明 | 关键字段 |
|------|------|----------|
| `users` | 用户表 | username, password_hash, display_name, role |
| `products` | 产品表 | name, top/middle/base_notes, price, spec, brand_story, scenarios |
| `style_templates` | 风格模板 | name, description, style_features (JSON) |
| `style_sources` | 风格参考文章 | style_id (FK), platform, source_url, source_content |
| `scene_templates` | 场景模板 | name, type, description, keywords (JSON), prompt_hint, is_builtin |
| `generated_copies` | 生成记录 | user_id, product_id, style_id, scene_id, title, content, hashtags (JSON), is_favorite |
| `async_tasks` | 异步任务 | user_id, type, status, progress, result (JSON), error |

**注意**: SQLite 数据库文件存储在 `/data/re_copywriter.db`（Docker 内）。部署时需要**持久化 `/data` 目录**，否则容器重启数据丢失。

---

## 六、API 接口概览

所有接口前缀 `/api`，前端通过 Axios 请求 `/api/xxx`。

### 认证
| 方法 | 路径 | 说明 | 鉴权 |
|------|------|------|------|
| POST | `/api/auth/register` | 注册 | 否 |
| POST | `/api/auth/login` | 登录 | 否 |
| GET | `/api/auth/me` | 获取当前用户 | Bearer |

### 产品
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/products/` | 列表（支持 search 参数） |
| POST | `/api/products/` | 创建 |
| PUT | `/api/products/{id}` | 更新 |
| DELETE | `/api/products/{id}` | 删除 |
| POST | `/api/products/import` | CSV 批量导入 |

### 风格
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/styles/` | 列表 |
| POST | `/api/styles/` | 创建 |
| GET | `/api/styles/{id}` | 详情（含参考文章） |
| DELETE | `/api/styles/{id}` | 删除 |
| POST | `/api/styles/{id}/sources` | 添加参考文章 |
| DELETE | `/api/styles/{id}/sources/{sid}` | 删除参考文章 |
| POST | `/api/styles/{id}/analyze` | 发起风格分析（异步任务） |

### 场景
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/scenes/` | 列表（支持 type 过滤） |
| POST | `/api/scenes/` | 创建自定义场景 |
| DELETE | `/api/scenes/{id}` | 删除 |

### 抓取
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/scrape/` | 抓取小红书/抖音链接（异步任务） |

### 文案生成
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/generate/` | 发起生成（异步任务），支持 platform 参数 |
| GET | `/api/generate/history` | 历史记录（支持 favorites_only） |
| PUT | `/api/generate/history/{id}` | 更新收藏/评分 |
| POST | `/api/generate/refine` | 文案微调 |

### 任务
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/tasks/{task_id}` | 查询异步任务状态/进度 |

### 健康检查
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/health` | 健康检查 |

---

## 七、Dockerfile 详解

使用**多阶段构建**：

```dockerfile
# Stage 1: 前端构建（Node 22）
FROM node:22-slim AS frontend-build
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci
COPY frontend/ ./
RUN npm run build   # tsc -b && vite build → 输出到 dist/

# Stage 2: 后端运行（Python 3.12）
FROM python:3.12-slim

# Playwright 需要的系统库
RUN apt-get update && apt-get install -y --no-install-recommends \
    libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 \
    libcups2 libdbus-1-3 libdrm2 libxkbcommon0 \
    libatspi2.0-0 libxcomposite1 libxdamage1 libxfixes3 \
    libxrandr2 libgbm1 libpango-1.0-0 libcairo2 libasound2 \
    libwayland-client0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
RUN playwright install chromium   # 安装 Chromium 浏览器
COPY backend/ .
COPY --from=frontend-build /app/frontend/dist ./static  # 前端构建产物

RUN mkdir -p /data
ENV PORT=8080
ENV DATABASE_URL=sqlite:////data/re_copywriter.db
EXPOSE 8080
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT}"]
```

**关键点：**
1. Playwright + Chromium 会让镜像较大（约 800MB+），用于抓取小红书/抖音页面
2. 前端构建产物放在 `/app/static`，由 FastAPI 直接提供静态文件服务
3. SQLite 数据库放在 `/data`，需要持久化存储

---

## 八、核心功能说明

### 1. 内容抓取（Scraper）
- 支持小红书和抖音链接
- **三层提取策略**：OG meta 标签 → SSR 数据（`__INITIAL_STATE__` / `RENDER_DATA`）→ 扩展 DOM 选择器 → body fallback
- **重试机制**：最多 2 次重试，每次间隔 2 秒，空内容也算失败触发重试
- 支持短链接自动解析（`xhslink.com`、`v.douyin.com`）
- 支持个人主页链接批量抓取文章列表

### 2. 多平台文案生成
- 4 个平台目标，长度和风格自动调整：

| 平台 | 正文长度 | 标题长度 |
|------|---------|---------|
| 小红书 | 300-500字 | 15-25字 |
| 微信朋友圈 | 50-150字 | 10-15字 |
| 抖音短文案 | 100-200字 | 10-20字 |
| 视频脚本 | 500-800字 | 15-25字 |

### 3. 风格分析
- 用户可以粘贴参考文章或输入链接抓取
- 系统用 Gemini 分析文章风格特征（语调、词汇、句式、emoji 风格、结构等）
- 生成文案时会参考学习到的风格特征

### 4. 首次启动数据
- 应用启动时会自动创建数据库表
- 自动填充 14 个内置场景模板（7 个节日 + 7 个常用场景）

---

## 九、部署到阿里云的方案

### 方案 A：阿里云容器服务 ACK / ACR + ECS

1. **构建镜像并推送到阿里云容器镜像服务 (ACR)**
```bash
# 登录阿里云 ACR
docker login --username=<your-username> registry.cn-shanghai.aliyuncs.com

# 构建镜像
docker build -t registry.cn-shanghai.aliyuncs.com/<namespace>/re-copywriter:latest .

# 推送
docker push registry.cn-shanghai.aliyuncs.com/<namespace>/re-copywriter:latest
```

2. **在 ECS 上运行**
```bash
docker run -d \
  --name re-copywriter \
  -p 80:8080 \
  -v /data/re-copywriter:/data \
  -e GEMINI_API_KEY="你的Gemini API Key" \
  -e JWT_SECRET="$(openssl rand -hex 32)" \
  -e ALLOWED_ORIGINS="*" \
  -e DATABASE_URL="sqlite:////data/re_copywriter.db" \
  registry.cn-shanghai.aliyuncs.com/<namespace>/re-copywriter:latest
```

### 方案 B：阿里云函数计算 FC / Serverless

**注意**: 由于 Playwright + Chromium 依赖较重（镜像 800MB+），Serverless 冷启动可能较慢。如果不需要抓取功能可以考虑精简。

### 方案 C：阿里云 SAE（Serverless 应用引擎）

推荐方案，类似 GCP Cloud Run：
1. 将镜像推送到 ACR
2. 在 SAE 控制台创建应用
3. 配置环境变量
4. 配置持久化存储挂载到 `/data`

### 关键注意事项

1. **持久化存储**：SQLite 数据库在 `/data` 目录，必须挂载持久化存储（云盘/NAS），否则容器重启数据丢失
2. **Gemini API Key**：需要能从阿里云网络访问 Google Gemini API。如果有网络限制，可能需要：
   - 使用代理
   - 或替换为阿里云百炼/通义千问 API（需修改 `backend/services/generator.py` 和 `backend/services/analyzer.py`）
3. **CORS**：部署后将 `ALLOWED_ORIGINS` 设为你的域名，或设为 `*`（前后端同源时可以用 `*`）
4. **Playwright Chromium**：抓取功能需要 Chromium，阿里云 ECS/SAE 需要确保系统库齐全（Dockerfile 已包含）
5. **端口**：Dockerfile 默认 8080，通过 `PORT` 环境变量可修改

---

## 十、本地开发

```bash
# 后端
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
playwright install chromium

# 创建 .env
cat > .env << EOF
GEMINI_API_KEY=你的key
JWT_SECRET=dev-secret-change-in-production
ALLOWED_ORIGINS=http://localhost:5173
EOF

uvicorn main:app --reload --port 8000

# 前端（另一个终端）
cd frontend
npm install
npm run dev
```

前端开发时 Vite dev server 在 5173 端口，需配置代理到后端 8000。

---

## 十一、GCP 部署信息（当前状态）

供参考，如需保留 GCP 部署或做迁移对比：

- **GCP 项目 ID**: `re-copywriter-app`
- **区域**: `asia-east1`（台湾）
- **Cloud Run 服务名**: `re-copywriter`
- **Artifact Registry**: `asia-east1-docker.pkg.dev/re-copywriter-app/cloud-run-source-deploy/re-copywriter`
- **服务 URL**: https://re-copywriter-500344727244.asia-east1.run.app
- **Gemini API Key**: 存储在 GCP Secret Manager 的 `gemini-api-key` 密钥中

---

## 十二、视觉风格

当前 UI 采用**日式简约风格**（Japanese Minimalist），使用硬编码的 hex 颜色值：

| 用途 | 颜色 |
|------|------|
| 主色/墨色深 | `#2A2621` |
| 主色/墨色 | `#3D3832` |
| 中间色 | `#5C564C` |
| 静音色 | `#8C8475` |
| 浅静音色 | `#B5AE9E` |
| 边框/分割线 | `#D4CFC3` |
| 卡片边框 ring | `#EBE7DE` |
| 输入框/浅背景 | `#F7F5F0` |
| 页面背景 | `#F9F8F5` |
| 金色强调 | `#B8956A` |
| 金色背景 | `#F5F0E8` |

字体：`Hiragino Sans, Noto Sans JP, -apple-system, sans-serif`
特征：`font-light`, 宽字距 `tracking-[0.15em]`, 装饰分割线 `w-8 h-px`, `ring-1` 代替阴影
