# Build command: `docker build -t sqren/backport .`
FROM node:latest

RUN mkdir /app
WORKDIR /app

COPY ./entrypoint.sh /entrypoint.sh

RUN npm install backport@beta -g
ENTRYPOINT ["/entrypoint.sh"]
CMD []
