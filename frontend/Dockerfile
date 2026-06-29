FROM node:22-alpine AS base

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1

# next.config.ts's rewrites() destination is resolved into the routes
# manifest at build time (even for `output: standalone`), so this must be a
# build arg, not just a runtime environment variable.
ARG BACKEND_INTERNAL_URL=http://localhost:8000
ENV BACKEND_INTERNAL_URL=$BACKEND_INTERNAL_URL

RUN npm run build

EXPOSE 3000
CMD ["npm", "start"]
