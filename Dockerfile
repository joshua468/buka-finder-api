# Stage 1 — build the React consumer
FROM node:22-alpine AS frontend
WORKDIR /src/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2 — build the Go API
FROM golang:1.27-alpine AS api
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -o /out/fooddelivery-api ./cmd/api
RUN CGO_ENABLED=0 go build -o /out/fooddelivery-seed ./seed

# Stage 3 — runtime (single binary + static assets)
FROM alpine:3.20
RUN adduser -D appuser
WORKDIR /app
COPY --from=frontend /src/frontend/dist ./frontend/dist
COPY --from=api /out/fooddelivery-api ./fooddelivery-api
COPY --from=api /out/fooddelivery-seed ./fooddelivery-seed
USER appuser
EXPOSE 8000
ENV PORT=8000
CMD ["./fooddelivery-api"]