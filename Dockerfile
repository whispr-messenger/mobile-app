# Dockerfile for Expo React Native frontend development
FROM node:18

WORKDIR /app

COPY package.json yarn.lock* package-lock.json* ./
RUN yarn install || npm install
RUN yarn global add @expo/ngrok || npm install -g @expo/ngrok

COPY . .

EXPOSE 8081 19000 19001 19002

CMD ["npx", "expo", "start", "--tunnel"]
