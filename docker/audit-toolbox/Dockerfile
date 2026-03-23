FROM ghcr.io/foundry-rs/foundry:latest

# Install system dependencies (foundry image is Ubuntu 22.04-based)
RUN apt-get update && apt-get install -y --no-install-recommends \
    software-properties-common \
    git \
    wget \
    xdg-utils \
    libasound2 \
    libnss3 \
    libatk-bridge2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Install Python 3.11 (browser-use requires >=3.11, Ubuntu 22.04 ships 3.10)
RUN add-apt-repository ppa:deadsnakes/ppa && \
    apt-get update && apt-get install -y --no-install-recommends \
    python3.11 \
    python3.11-venv \
    python3.11-dev \
    && rm -rf /var/lib/apt/lists/*

# Create venv with Python 3.11 and install tools
RUN python3.11 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
RUN pip install --no-cache-dir \
    slither-analyzer \
    browser-use \
    playwright

# Install Chromium for browser-use
RUN playwright install --with-deps chromium

# Set working directory
WORKDIR /audits

# Copy audit script
COPY audit.sh /usr/local/bin/audit.sh
RUN chmod +x /usr/local/bin/audit.sh

ENTRYPOINT ["/bin/sh"]
