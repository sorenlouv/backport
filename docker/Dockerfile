# Build command: `docker build -t sqren/backport .`
FROM node:latest

RUN mkdir /app
WORKDIR /app

RUN npm install backport -g
ENTRYPOINT ["backport"]
CMD []
