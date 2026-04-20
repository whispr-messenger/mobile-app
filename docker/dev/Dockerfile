# Dockerfile for Expo React Native frontend development
FROM node:22

WORKDIR /app

# Install dependencies globally to avoid volume mount issues
COPY package.json package-lock.json* ./
RUN npm install

# Expo environment variables
ENV EXPO_DEVTOOLS_LISTEN_ADDRESS=0.0.0.0
ENV REACT_NATIVE_PACKAGER_HOSTNAME=0.0.0.0

EXPOSE 8081 19000 19001 19002

CMD ["npx", "expo", "start", "--tunnel"]
