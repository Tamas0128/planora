FROM node:22-alpine AS base

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1

ARG BACKEND_INTERNAL_URL=http://localhost:8000
ENV BACKEND_INTERNAL_URL=$BACKEND_INTERNAL_URL

RUN npm run build

EXPOSE 3000
CMD ["npm", "start"]
