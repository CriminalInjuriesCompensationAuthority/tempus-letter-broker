FROM public.ecr.aws/lambda/nodejs:22

# --- OS deps for headless Chromium + fonts ---
RUN dnf -y update && \
    dnf -y install \
      gtk3 \
      pango \
      cairo \
      atk \
      at-spi2-atk \
      cups-libs \
      mesa-libEGL \
      mesa-libgbm \
      libdrm \
      libX11 \
      libXcomposite \
      libXcursor \
      libXdamage \
      libXext \
      libXi \
      libXrandr \
      libXScrnSaver \
      libXtst \
      libxcb \
      nss \
      alsa-lib \
      fontconfig \
      freetype \
      dejavu-sans-fonts \
      dejavu-serif-fonts \
      google-noto-sans-fonts \
      google-noto-serif-fonts \
      google-noto-emoji-fonts \
      && \
    dnf clean all && \
    rm -rf /var/cache/dnf

ENV PUPPETEER_SKIP_DOWNLOAD=1
ENV PUPPETEER_CACHE_DIR=/tmp/puppeteer
ENV HOME=/tmp

WORKDIR /var/task

COPY package.json package-lock.json ./

RUN npm ci --omit=dev && npm cache clean --force

COPY . .

CMD ["src/handler.handler"]
