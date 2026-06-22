# Base image providing Python 3.10 and common dev utilities
FROM mcr.microsoft.com/devcontainers/python:1-3.10-bullseye

# ------------------------------------------------------------
# 1. Node.js 20.x 설치
#    - Node.js는 프론트엔드(React/Vite) 빌드와 Capacitor 플러그인 개발에 필요합니다.
#    - `curl` 로 공식 설치 스크립트를 받아 실행하고, apt‑get 으로 nodejs 패키지를 설치합니다.
#    - 설치 후 apt 캐시를 정리해 이미지 용량을 최소화합니다.
# ------------------------------------------------------------
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs npm \
    && apt-get clean -y \
    && rm -rf /var/lib/apt/lists/*

# ------------------------------------------------------------
# 2. 이전에 남아있을 수 있는 Yarn 레포지터리 파일 삭제
#    - 현재 프로젝트에서는 Yarn이 필요 없으므로, 존재한다면 제거해 GPG 오류를 방지합니다.
# ------------------------------------------------------------
RUN rm -f /etc/apt/sources.list.d/yarn.list || true

# ------------------------------------------------------------
# 3. Android/Capacitor 빌드에 필수인 OpenJDK 17 과 unzip 설치
#    - `openjdk-17-jdk` 는 Android Gradle 빌드에 사용됩니다.
#    - `unzip` 은 압축된 Android SDK/NDK 파일을 풀 때 필요합니다.
#    - `DEBIAN_FRONTEND=noninteractive` 로 대화형 프롬프트를 억제하고, 설치 후 캐시 정리.
# ------------------------------------------------------------
RUN apt-get update && export DEBIAN_FRONTEND=noninteractive \
    && apt-get -y install --no-install-recommends openjdk-17-jdk unzip \
    && apt-get clean -y \
    && rm -rf /var/lib/apt/lists/*

# ------------------------------------------------------------
# 4. JAVA_HOME 환경 변수 설정 (OpenJDK 17 경로)
#    - Java 실행 파일을 PATH에 추가해 `java`/`javac` 명령을 바로 사용할 수 있게 합니다.
# ------------------------------------------------------------
ENV JAVA_HOME /usr/lib/jvm/java-17-openjdk-amd64
ENV PATH $JAVA_HOME/bin:$PATH

# ------------------------------------------------------------
# 5. 전역 npm 패키지 설치
#    - TypeScript 컴파일러, Yarn(필요 시 사용), 최신 npm을 전역으로 설치합니다.
# ------------------------------------------------------------
RUN apt-get update && apt-get install -y npm && \
    npm install -g typescript yarn npm@latest && \
    apt-get clean -y && rm -rf /var/lib/apt/lists/*

# ------------------------------------------------------------
# 6. 전역 Python 도구 설치
#    - 코드 포맷팅(black), 정적 분석(ruff), 테스트(pytest) 도구를 설치합니다.
# ------------------------------------------------------------
RUN pip install --no-cache-dir black pytest ruff

# ------------------------------------------------------------
# 7. 컨테이너 실행 사용자 및 작업 디렉터리 설정
#    - VS Code 확장과 Dev Container가 `vscode` 사용자를 통해 파일 권한 문제를 방지합니다.
#    - 작업 디렉터리를 워크스페이스 루트로 지정합니다.
# ------------------------------------------------------------
USER vscode
WORKDIR /workspaces/walkmate
