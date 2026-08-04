FROM node:20-alpine AS base
WORKDIR /repo

COPY package.json package-lock.json* ./
COPY apps/worker/package.json apps/worker/package.json
COPY packages/connectors/package.json packages/connectors/package.json
COPY packages/db/package.json packages/db/package.json
RUN npm install --workspace=apps/worker --include-workspace-root

COPY apps/worker apps/worker
COPY packages/connectors packages/connectors
COPY packages/db packages/db

WORKDIR /repo/apps/worker
CMD ["npm", "run", "start"]
