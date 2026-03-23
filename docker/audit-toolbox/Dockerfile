FROM ghcr.io/foundry-rs/foundry:latest

# Install system dependencies (foundry image is Ubuntu 22.04-based)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    git \
    && rm -rf /var/lib/apt/lists/*

# Install slither
RUN pip3 install slither-analyzer

# Set working directory
WORKDIR /audits

# Copy audit script
COPY audit.sh /usr/local/bin/audit.sh
RUN chmod +x /usr/local/bin/audit.sh

ENTRYPOINT ["/bin/sh"]
