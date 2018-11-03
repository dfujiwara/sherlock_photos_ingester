FROM node:10.13.0
WORKDIR /app
COPY *.js /app/
COPY package.json /app
COPY keys.json /app
COPY run.sh /app

RUN npm install
CMD ["/bin/bash", "/app/run.sh"]
