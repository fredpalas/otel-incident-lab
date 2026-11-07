FROM node:24.22.2-alpine
WORKDIR /verify
RUN corepack enable
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund
COPY . .
ENTRYPOINT ["node", "run.ts"]
