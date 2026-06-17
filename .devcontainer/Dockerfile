FROM mcr.microsoft.com/devcontainers/python:1-3.10-bullseye

# Install Node.js 20.x
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && apt-get clean -y \
    && rm -rf /var/lib/apt/lists/*

# Install OpenJDK 17 and dependencies for Android/Capacitor builds
RUN apt-get update && export DEBIAN_FRONTEND=noninteractive \
    && apt-get -y install --no-install-recommends openjdk-17-jdk unzip \
    && apt-get clean -y \
    && rm -rf /var/lib/apt/lists/*

ENV JAVA_HOME /usr/lib/jvm/java-17-openjdk-amd64
ENV PATH $JAVA_HOME/bin:$PATH

# Global npm packages for convenience
RUN npm install -g typescript yarn npm@latest

# Global Python tools
RUN pip install --no-cache-dir black pytest ruff

USER vscode
WORKDIR /workspaces/walkmate
