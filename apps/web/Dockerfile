FROM node:20-alpine AS base
WORKDIR /repo

COPY package.json package-lock.json* ./
COPY apps/web/package.json apps/web/package.json
RUN npm install --workspace=apps/web --include-workspace-root

COPY apps/web apps/web

WORKDIR /repo/apps/web
RUN npm run build

EXPOSE 3000
CMD ["npm", "run", "start"]
