FROM node:24.22.2-alpine@sha256:a34ab6d7f6f4813f4d0c5469d74685604b962fbdbf5793a7bc7b4998ecb867c8
WORKDIR /verify
RUN corepack enable
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund
COPY . .
ENTRYPOINT ["node", "run.ts"]
