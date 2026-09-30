FROM golang:1.27.0-bookworm AS build
RUN apt-get update && apt-get install -y --no-install-recommends build-essential pkg-config libopus-dev libopusfile-dev libsoxr-dev ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /src/services/realtime-go
ENV CGO_ENABLED=1 GOWORK=off GOTOOLCHAIN=local
COPY services/realtime-go/go.mod services/realtime-go/go.sum ./
RUN go mod download
COPY services/realtime-go/ ./
RUN go build -trimpath -o /out/realtime ./cmd/realtime

FROM debian:bookworm-slim AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates libopus0 libopusfile0 libsoxr0 && rm -rf /var/lib/apt/lists/* && useradd --system --uid 10001 --create-home lumos
COPY --from=build /out/realtime /app/realtime
RUN ldd /app/realtime && ! ldd /app/realtime | grep -q 'not found'
ENV NODE_ENV=production REALTIME_PORT=8081
USER lumos
EXPOSE 8081
STOPSIGNAL SIGTERM
CMD ["/app/realtime"]
