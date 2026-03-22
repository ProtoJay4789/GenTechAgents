FROM ghcr.io/foundry-rs/foundry:latest

# Install system dependencies
RUN apk update && apk add --no-cache \
    python3 \
    py3-pip \
    git

# Install slither
RUN pip3 install --break-system-packages slither-analyzer

# Set working directory
WORKDIR /audits

# Copy audit script
COPY audit.sh /usr/local/bin/audit.sh
RUN chmod +x /usr/local/bin/audit.sh

ENTRYPOINT ["/bin/sh"]
