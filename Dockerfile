FROM node:17-alpine AS builder
WORKDIR /root

COPY package*.json ./
RUN npm i

COPY . .
RUN npm run build

FROM node:17-alpine
ENV NODE_ENV production

RUN apk fix
RUN apk --update add git git-lfs less openssh && \
    git lfs install && \
    rm -rf /var/lib/apt/lists/* && \
    rm /var/cache/apk/*
RUN git config --global core.sshCommand 'ssh -o UserKnownHostsFile=/dev/null -o StrictHostKeyChecking=no'

WORKDIR /root/app

COPY --from=builder /root/package*.json ./
RUN npm ci --only=production && npm cache clean --force

COPY --from=builder /root/LICENSE ./
COPY --from=builder /root/dist/ ./dist/

VOLUME /root/repos
EXPOSE 9300

CMD ["npm", "run", "start", "--", "..", "config.json"]
