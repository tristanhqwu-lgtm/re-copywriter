#!/usr/bin/env bash
# =========================================================
# RE调香室 AI文案助手 — Google Cloud Run 部署脚本
# =========================================================
#
# 前置要求:
#   1. 安装 gcloud CLI: https://cloud.google.com/sdk/docs/install
#   2. 登录: gcloud auth login
#   3. 创建项目: gcloud projects create <PROJECT_ID>
#   4. 启用计费: https://console.cloud.google.com/billing
#
# 用法:
#   chmod +x deploy.sh
#   ./deploy.sh
#
# 环境变量 (部署前请设置):
#   GEMINI_API_KEY   - Google Gemini API 密钥 (必需)
#   JWT_SECRET       - JWT 签名密钥 (必需, 建议用 openssl rand -hex 32 生成)
#   GCP_PROJECT_ID   - Google Cloud 项目 ID (必需)
#   GCP_REGION       - 部署区域 (可选, 默认 asia-east1 台湾)
#   SERVICE_NAME     - Cloud Run 服务名 (可选, 默认 re-copywriter)
# =========================================================
set -euo pipefail

# ---------- 配置 ----------
PROJECT_ID="${GCP_PROJECT_ID:?请设置 GCP_PROJECT_ID 环境变量}"
REGION="${GCP_REGION:-asia-east1}"
SERVICE="${SERVICE_NAME:-re-copywriter}"
IMAGE="gcr.io/${PROJECT_ID}/${SERVICE}"

if [ -z "${GEMINI_API_KEY:-}" ]; then
  echo "错误: 请设置 GEMINI_API_KEY 环境变量"
  exit 1
fi
if [ -z "${JWT_SECRET:-}" ]; then
  echo "错误: 请设置 JWT_SECRET 环境变量 (建议: export JWT_SECRET=\$(openssl rand -hex 32))"
  exit 1
fi

echo "=========================================="
echo " RE调香室 — 部署到 Google Cloud Run"
echo "=========================================="
echo " 项目:   ${PROJECT_ID}"
echo " 区域:   ${REGION}"
echo " 服务:   ${SERVICE}"
echo "=========================================="

# ---------- Step 1: 设置项目 & 启用 API ----------
echo ""
echo "[1/4] 配置项目 & 启用所需 API..."
gcloud config set project "${PROJECT_ID}"
gcloud services enable \
  cloudbuild.googleapis.com \
  run.googleapis.com \
  containerregistry.googleapis.com \
  artifactregistry.googleapis.com

# ---------- Step 2: 构建 Docker 镜像 ----------
echo ""
echo "[2/4] 使用 Cloud Build 构建 Docker 镜像..."
gcloud builds submit --tag "${IMAGE}" .

# ---------- Step 3: 部署到 Cloud Run ----------
echo ""
echo "[3/4] 部署到 Cloud Run..."
gcloud run deploy "${SERVICE}" \
  --image "${IMAGE}" \
  --platform managed \
  --region "${REGION}" \
  --allow-unauthenticated \
  --memory 1Gi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 3 \
  --timeout 300 \
  --set-env-vars "GEMINI_API_KEY=${GEMINI_API_KEY},JWT_SECRET=${JWT_SECRET},ALLOWED_ORIGINS=*" \
  --add-volume=name=data-vol,type=cloud-storage,bucket=re-copywriter-data \
  --add-volume-mount=volume=data-vol,mount-path=/data

# ---------- Step 4: 获取服务 URL ----------
echo ""
echo "[4/4] 获取服务地址..."
SERVICE_URL=$(gcloud run services describe "${SERVICE}" \
  --platform managed \
  --region "${REGION}" \
  --format "value(status.url)")

echo ""
echo "=========================================="
echo " 部署完成!"
echo "=========================================="
echo " 服务地址: ${SERVICE_URL}"
echo ""
echo " 注意事项:"
echo "   - SQLite 数据在容器重启后会丢失"
echo "     如需持久化, 可添加 Cloud Run Volume Mount:"
echo "     gcloud run services update ${SERVICE} \\"
echo "       --add-volume name=data,type=cloud-storage,bucket=YOUR_BUCKET \\"
echo "       --add-volume-mount volume=data,mount-path=/data"
echo ""
echo "   - 如需绑定自定义域名:"
echo "     gcloud run domain-mappings create \\"
echo "       --service ${SERVICE} --domain YOUR_DOMAIN --region ${REGION}"
echo "=========================================="
