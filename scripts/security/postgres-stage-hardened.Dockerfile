# PFM STAGING ONLY. Image not deployed to any database automatically.
# Base official PostgreSQL 18.7 on Alpine, immutable digest.
FROM golang:1.27.4-alpine3.24@sha256:70bd7ddea8b6cbe5d6943cde279d6b67feb10cc924fb9100d1d8757c1575b280 AS gosu-builder
RUN apk add --no-cache git ca-certificates
RUN git clone --no-checkout https://github.com/tianon/gosu.git /src \
    && git -C /src checkout --detach 29b939aa5bd4dc588af765b8248f6e39150d2565
WORKDIR /src
RUN go get golang.org/x/sys@v0.44.0 \
    && go mod tidy \
    && CGO_ENABLED=0 GOTOOLCHAIN=local go build -trimpath -buildvcs=false -ldflags="-s -w" -o /out/gosu . \
    && test "$(go version -m /out/gosu | grep -Fc 'golang.org/x/sys	v0.44.0')" -eq 1

FROM postgres:18.7-alpine3.23@sha256:339a86bf416979bb4d3d2e30a1f9e096e7302564faff4151b804cf53463059d5
COPY --from=gosu-builder --chmod=0755 /out/gosu /usr/local/bin/gosu
