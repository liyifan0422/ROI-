# 部署指南

## 第一步：部署后端到 Railway

1. 注册 [Railway](https://railway.app)，用 GitHub 登录
2. 点击 **New Project → Deploy from GitHub repo**
3. 选择本项目，**Root Directory** 设为 `backend`
4. Railway 会自动检测 Python 项目并安装依赖
5. 在 **Variables** 里添加：
   - `SECRET_KEY` = 随机字符串（例如 `openssl rand -hex 32` 生成）
6. 部署完成后，复制分配的域名，例如 `https://xxx.up.railway.app`

## 第二步：部署前端到 Vercel

1. 注册 [Vercel](https://vercel.com)，用 GitHub 登录
2. 点击 **New Project → Import Git Repository**
3. 选择本项目，**Root Directory** 设为 `frontend`
4. 在 **Environment Variables** 里添加：
   - `REACT_APP_API_URL` = 第一步得到的 Railway 域名
5. 点击 **Deploy**，完成后 Vercel 会给你一个访问地址

## 本地开发

```bash
# 后端
cd backend
pip install -r requirements.txt
python app.py

# 前端（新开一个终端）
cd frontend
npm install
npm start
```

前端默认访问 `http://localhost:5000` 的后端。
