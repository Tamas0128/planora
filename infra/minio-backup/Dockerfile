FROM alpine:3.20

RUN apk add --no-cache curl ca-certificates && \
    curl -sSL https://dl.min.io/client/mc/release/linux-amd64/mc -o /usr/local/bin/mc && \
    chmod +x /usr/local/bin/mc

COPY backup.sh /backup.sh
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /backup.sh /entrypoint.sh

COPY crontab /etc/crontabs/root

CMD ["/entrypoint.sh"]
