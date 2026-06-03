#!/usr/bin/env bash
set -euo pipefail

PORT="${PORT:-5173}"
CONTAINER_PORT="${CONTAINER_PORT:-5173}"
IMAGE="${NODE_IMAGE:-node:25-bookworm}"
CONTAINER_NAME="${CONTAINER_NAME:-r8-rowhome-web}"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DOCKER_DIR="${ROOT_DIR}/.docker"
DOCKER_NODE_MODULES="${DOCKER_DIR}/node_modules"
DOCKER_NPM_CACHE="${DOCKER_DIR}/npm-cache"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is required but was not found on PATH." >&2
  exit 1
fi

mkdir -p "${DOCKER_NODE_MODULES}" "${DOCKER_NPM_CACHE}"

echo "Serving r8-rowhome over HTTPS from Docker."
echo "URL: https://localhost:${PORT}/"
echo "Image: ${IMAGE}"
echo "Container: ${CONTAINER_NAME}"
echo "User: $(id -u):$(id -g)"

exec docker run --rm -it \
  --name "${CONTAINER_NAME}" \
  --user "$(id -u):$(id -g)" \
  -p "${PORT}:${CONTAINER_PORT}" \
  -v "${ROOT_DIR}:/app" \
  -v "${DOCKER_NODE_MODULES}:/app/node_modules" \
  -v "${DOCKER_NPM_CACHE}:/tmp/.npm" \
  -w /app \
  -e HOME=/tmp \
  -e npm_config_cache=/tmp/.npm \
  "${IMAGE}" \
  bash -lc "npm ci && npm run build && npm run preview -- --port ${CONTAINER_PORT}"
