FROM easi6/alpine-node-buildtool
RUN mkdir -p /usr/app
WORKDIR /usr/app

COPY package.json .
COPY yarn.lock .
COPY main.js .
RUN yarn install --frozen-lockfile --production=false

ENV NODE_ENV development

CMD ["node", "main.js"]
