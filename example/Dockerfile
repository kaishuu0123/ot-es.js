FROM node:8-slim

MAINTAINER kaishuu0123@gmail.com

RUN mkdir -p /usr/src/app

WORKDIR /usr/src/app

COPY . .

RUN npm install -g yarn
RUN yarn
RUN npm run client:build

EXPOSE $PORT

CMD ["npm", "run", "server"]
