# Local optional Wapiti runner with SSLscan for its TLS module.
# The Python virtualenv lives outside the container at /opt/jm-security/wapiti/venv
# and is mounted into /work/venv; this image never contains project secrets.
FROM python:3.13-slim@sha256:e48f59cdba69a3cbd9ed2cf0f348d90d45a8d350d98134cf1070bc106ee9ed90
RUN apt-get update \
    && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends sslscan ca-certificates \
    && rm -rf /var/lib/apt/lists/*
USER 1000:1000
ENV HOME=/work
WORKDIR /work
