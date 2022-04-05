FROM node:latest

RUN mkdir /app
WORKDIR /app

COPY ./entrypoint.sh /entrypoint.sh

RUN npm install backport -g
ENTRYPOINT ["/forward-args-to-backport.sh"]
CMD []
