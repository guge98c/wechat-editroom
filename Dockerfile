# ===== 见字（wechat-editroom）容器镜像 =====
# 版本：0.9.9（上游 tag）
# 构建：GitHub Actions（fork 仓库）或本地 docker build
# 特性：
#   1) node:24-slim（见字要求 node>=24，node:sqlite 无原生编译依赖）
#   2) 系统 Google Chrome（浏览器渲染/封面/图表技能用；跳过 puppeteer 自带 Chromium 下载）
#   3) 监听补丁：127.0.0.1 -> 0.0.0.0（允许 NAS 局域网与容器外访问）
#      补丁写在 Dockerfile 里，上游更新后重新构建会自动重打，不会被覆盖

FROM node:24-slim

ENV NPM_CONFIG_REGISTRY=https://registry.npmmirror.com \
    PUPPETEER_SKIP_DOWNLOAD=true \
    PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=true \
    CHROME_PATH=/usr/bin/google-chrome-stable

WORKDIR /app

# 拷贝源码（.dockerignore 已排除 node_modules/.git/运行数据等）
COPY . /app

# 安装根依赖（--omit=dev 跳过 electron 等桌面构建大件；含 puppeteer、mermaid-cli）
# postinstall 会级联安装 4 个技能的独立依赖，渲染类失败不阻断（源码已 catch）
RUN npm ci --omit=dev --registry=https://registry.npmmirror.com

# 系统 Chrome（渲染技能用；与 duibiao-spider 镜像同款做法）
RUN apt-get update \
    && apt-get install -y --no-install-recommends wget ca-certificates gnupg \
    && wget -q https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb -O /tmp/chrome.deb \
    && apt-get install -y --no-install-recommends /tmp/chrome.deb \
    && rm -f /tmp/chrome.deb \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# 容器化监听补丁：仅放开监听地址（0.8.0/0.9.x 硬编码 127.0.0.1，config 无 host 项）
RUN sed -i "s/server.listen(config.port, '127.0.0.1'/server.listen(config.port, '0.0.0.0'/g" server.mjs

EXPOSE 4317

CMD ["node", "--disable-warning=ExperimentalWarning", "server.mjs"]
